import { morph } from '@theme/morph';
import { Component } from '@theme/component';
import { CartUpdateEvent, ThemeEvents, VariantSelectedEvent } from '@theme/events';
import { DialogComponent, DialogCloseEvent } from '@theme/dialog';
import { mediaQueryLarge, isMobileBreakpoint, getIOSVersion } from '@theme/utilities';

export class QuickAddComponent extends Component {
  /** @type {AbortController | null} */
  #abortController = null;
  /** @type {Map<string, Element>} */
  #cachedContent = new Map();
  /** @type {AbortController} */
  #cartUpdateAbortController = new AbortController();

  get productPageUrl() {
    const productCard = /** @type {import('./product-card').ProductCard | null} */ (this.closest('product-card'));
    const hotspotProduct = /** @type {import('./product-hotspot').ProductHotspotComponent | null} */ (
      this.closest('product-hotspot-component')
    );
    const productLink = productCard?.getProductCardLink() || hotspotProduct?.getHotspotProductLink();

    if (!productLink?.href) return '';

    const url = new URL(productLink.href);

    if (url.searchParams.has('variant')) {
      return url.toString();
    }

    const selectedVariantId = this.#getSelectedVariantId();
    if (selectedVariantId) {
      url.searchParams.set('variant', selectedVariantId);
    }

    return url.toString();
  }

  /**
   * Gets the currently selected variant ID from the product card
   * @returns {string | null} The variant ID or null
   */
  #getSelectedVariantId() {
    const productCard = /** @type {import('./product-card').ProductCard | null} */ (this.closest('product-card'));
    return productCard?.getSelectedVariantId() || null;
  }

  connectedCallback() {
    super.connectedCallback();

    mediaQueryLarge.addEventListener('change', this.#closeQuickAddModal);
    document.addEventListener(ThemeEvents.cartUpdate, this.#handleCartUpdate, {
      signal: this.#cartUpdateAbortController.signal,
    });
    document.addEventListener(ThemeEvents.variantSelected, this.#updateQuickAddButtonState.bind(this));
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    mediaQueryLarge.removeEventListener('change', this.#closeQuickAddModal);
    this.#abortController?.abort();
    this.#cartUpdateAbortController.abort();
    document.removeEventListener(ThemeEvents.variantSelected, this.#updateQuickAddButtonState.bind(this));
  }

  /**
   * Clears the cached content when cart is updated
   */
  #handleCartUpdate = () => {
    this.#cachedContent.clear();
  };

  /**
   * Handles quick add button click
   * @param {Event} event - The click event
   */
  handleClick = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const currentUrl = this.productPageUrl;

    if (!currentUrl) {
      console.warn('Quick Add: Product page URL is empty');
      // Still try to open the modal with empty content
      this.#openQuickAddModal();
      return;
    }

    // Open the modal immediately, then load content asynchronously
    this.#openQuickAddModal();

    // Load content asynchronously
    (async () => {
      try {
        // Check if we have cached content for this URL
        let productGrid = this.#cachedContent.get(currentUrl);

        if (!productGrid) {
          try {
            // Fetch and cache the content with timeout
            const html = await Promise.race([
              this.fetchProductPage(currentUrl),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Fetch timeout')), 10000)
              )
            ]);
            
            if (html) {
              const gridElement = html.querySelector('[data-product-grid-content]');
              if (gridElement) {
                // Cache the cloned element to avoid modifying the original
                productGrid = /** @type {Element} */ (gridElement.cloneNode(true));
                this.#cachedContent.set(currentUrl, productGrid);
              }
            }
          } catch (error) {
            console.error('Quick Add: Error fetching product page', error);
            return;
          }
        }

        if (productGrid) {
          try {
            // Use a fresh clone from the cache
            const freshContent = /** @type {Element} */ (productGrid.cloneNode(true));
            await this.updateQuickAddModal(freshContent);
          } catch (error) {
            console.error('Quick Add: Error updating modal content', error);
          }
        }
      } catch (error) {
        console.error('Quick Add: Unexpected error loading content', error);
      }
    })();
  };

  /** @param {QuickAddDialog} dialogComponent */
  #stayVisibleUntilDialogCloses(dialogComponent) {
    this.toggleAttribute('stay-visible', true);

    dialogComponent.addEventListener(DialogCloseEvent.eventName, () => this.toggleAttribute('stay-visible', false), {
      once: true,
    });
  }

  #openQuickAddModal = () => {
    const dialogComponent = document.getElementById('quick-add-dialog');
    if (!dialogComponent) {
      console.warn('Quick Add: Dialog element not found');
      return;
    }

    // Check if it's a QuickAddDialog instance or the right custom element
    if (!(dialogComponent instanceof QuickAddDialog) && dialogComponent.tagName.toLowerCase() !== 'quick-add-dialog') {
      console.warn('Quick Add: Dialog element is not a QuickAddDialog instance');
      return;
    }

    // Function to actually open the dialog
    const openDialog = (/** @type {QuickAddDialog} */ dialog) => {
      if (!dialog || !dialog.refs || !dialog.refs.dialog) {
        console.warn('Quick Add: Dialog refs not ready');
        // Try again after a short delay
        setTimeout(() => {
          if (dialog && dialog.refs && dialog.refs.dialog) {
            this.#stayVisibleUntilDialogCloses(dialog);
            dialog.showDialog();
          }
        }, 100);
        return;
      }

      this.#stayVisibleUntilDialogCloses(dialog);
      dialog.showDialog();
    };

    // If the custom element hasn't been upgraded yet, wait for it
    if (!(dialogComponent instanceof QuickAddDialog)) {
      // Wait for custom element to be defined
      customElements.whenDefined('quick-add-dialog').then(() => {
        if (dialogComponent instanceof QuickAddDialog) {
          openDialog(dialogComponent);
        }
      }).catch((error) => {
        console.error('Quick Add: Error waiting for custom element', error);
      });
      return;
    }

    openDialog(dialogComponent);
  };

  #closeQuickAddModal = () => {
    const dialogComponent = document.getElementById('quick-add-dialog');
    if (!(dialogComponent instanceof QuickAddDialog)) return;

    dialogComponent.closeDialog();
  };

  /**
   * Fetches the product page content
   * @param {string} productPageUrl - The URL of the product page to fetch
   * @returns {Promise<Document | null>}
   */
  async fetchProductPage(productPageUrl) {
    if (!productPageUrl) return null;

    // We use this to abort the previous fetch request if it's still pending.
    this.#abortController?.abort();
    this.#abortController = new AbortController();

    try {
      const response = await fetch(productPageUrl, {
        signal: this.#abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch product page: HTTP error ${response.status}`);
      }

      const responseText = await response.text();
      const html = new DOMParser().parseFromString(responseText, 'text/html');

      return html;
    } catch (error) {
      if (error.name === 'AbortError') {
        return null;
      } else {
        throw error;
      }
    } finally {
      this.#abortController = null;
    }
  }

  /**
   * Re-renders the variant picker.
   * @param {Element} productGrid - The product grid element
   */
  async updateQuickAddModal(productGrid) {
    const modalContent = document.getElementById('quick-add-modal-content');

    if (!productGrid || !modalContent) return;

    if (isMobileBreakpoint()) {
      const productDetails = productGrid.querySelector('.product-details');
      const productFormComponent = productGrid.querySelector('product-form-component');
      const variantPicker = productGrid.querySelector('variant-picker');
      const productPrice = productGrid.querySelector('product-price');
      const productTitle = document.createElement('a');
      productTitle.textContent = this.dataset.productTitle || '';

      // Make product title as a link to the product page
      productTitle.href = this.productPageUrl;

      const productHeader = document.createElement('div');
      productHeader.classList.add('product-header');

      productHeader.appendChild(productTitle);
      if (productPrice) {
        productHeader.appendChild(productPrice);
      }
      productGrid.appendChild(productHeader);

      if (variantPicker) {
        productGrid.appendChild(variantPicker);
      }
      if (productFormComponent) {
        productGrid.appendChild(productFormComponent);
      }

      productDetails?.remove();
    }

    morph(modalContent, productGrid);

    this.#syncVariantSelection(modalContent);
  }

  /**
   * Updates the quick-add button state based on whether a swatch is selected
   * @param {VariantSelectedEvent} event - The variant selected event
   */
  #updateQuickAddButtonState(event) {
    if (!(event.target instanceof HTMLElement)) return;
    if (event.target.closest('product-card') !== this.closest('product-card')) return;
    const productOptionsCount = this.dataset.productOptionsCount;
    const quickAddButton = productOptionsCount === '1' ? 'add' : 'choose';
    this.setAttribute('data-quick-add-button', quickAddButton);
  }

  /**
   * Syncs the variant selection from the product card to the modal
   * @param {Element} modalContent - The modal content element
   */
  #syncVariantSelection(modalContent) {
    const selectedVariantId = this.#getSelectedVariantId();
    if (!selectedVariantId) return;

    // Find and check the corresponding input in the modal
    const modalInputs = modalContent.querySelectorAll('input[type="radio"][data-variant-id]');
    for (const input of modalInputs) {
      if (input instanceof HTMLInputElement && input.dataset.variantId === selectedVariantId && !input.checked) {
        input.checked = true;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        break;
      }
    }
  }
}

if (!customElements.get('quick-add-component')) {
  customElements.define('quick-add-component', QuickAddComponent);
}

class QuickAddDialog extends DialogComponent {
  #abortController = new AbortController();

  connectedCallback() {
    super.connectedCallback();

    // Ensure close button has the event handler
    this.#ensureCloseButtonHandler();

    this.addEventListener(ThemeEvents.cartUpdate, this.handleCartUpdate, { signal: this.#abortController.signal });
    this.addEventListener(ThemeEvents.variantUpdate, this.#updateProductTitleLink);

    this.addEventListener(DialogCloseEvent.eventName, this.#handleDialogClose);
  }

  updatedCallback() {
    super.updatedCallback();
    // Ensure close button handler is set up after updates
    this.#ensureCloseButtonHandler();
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    // Clean up close button event listener
    const closeButton = this.refs.closeButton;
    if (closeButton && !Array.isArray(closeButton)) {
      const button = /** @type {HTMLElement & { _closeHandler?: (event: MouseEvent) => void }} */ (closeButton);
      if (button._closeHandler) {
        button.removeEventListener('click', button._closeHandler);
        delete button._closeHandler;
        delete button.dataset.closeHandlerAttached;
      }
    }

    this.#abortController.abort();
    this.removeEventListener(DialogCloseEvent.eventName, this.#handleDialogClose);
  }

  /**
   * Ensures the close button has the proper event handler
   */
  #ensureCloseButtonHandler() {
    const closeButton = this.refs.closeButton;
    if (!closeButton || Array.isArray(closeButton)) return;
    
    const button = /** @type {HTMLElement} */ (closeButton);

    // Set the declarative event handler attribute
    if (!button.hasAttribute('on:click')) {
      button.setAttribute('on:click', '/closeDialog');
    }

    // Add a direct event listener as a fallback to ensure it works
    if (!button.dataset.closeHandlerAttached) {
      const clickHandler = (/** @type {MouseEvent} */ event) => {
        event.preventDefault();
        event.stopPropagation();
        this.closeDialog();
      };
      
      button.addEventListener('click', clickHandler);
      button.dataset.closeHandlerAttached = 'true';
      // @ts-ignore - storing handler reference for cleanup
      button._closeHandler = clickHandler;
    }
  }

  /**
   * Closes the dialog
   * @param {CartUpdateEvent} event - The cart update event
   */
  handleCartUpdate = (event) => {
    if (event.detail.data.didError) return;
    this.closeDialog();
  };

  #updateProductTitleLink = (/** @type {CustomEvent} */ event) => {
    const anchorElement = /** @type {HTMLAnchorElement} */ (
      event.detail.data.html?.querySelector('.view-product-title a')
    );
    const viewMoreDetailsLink = /** @type {HTMLAnchorElement} */ (this.querySelector('.view-product-title a'));
    const mobileProductTitle = /** @type {HTMLAnchorElement} */ (this.querySelector('.product-header a'));

    if (!anchorElement) return;

    if (viewMoreDetailsLink) viewMoreDetailsLink.href = anchorElement.href;
    if (mobileProductTitle) mobileProductTitle.href = anchorElement.href;
  };

  #handleDialogClose = () => {
    const iosVersion = getIOSVersion();
    /**
     * This is a patch to solve an issue with the UI freezing when the dialog is closed.
     * To reproduce it, use iOS 16.0.
     */
    if (!iosVersion || iosVersion.major >= 17 || (iosVersion.major === 16 && iosVersion.minor >= 4)) return;

    requestAnimationFrame(() => {
      /** @type {HTMLElement | null} */
      const grid = document.querySelector('#ResultsList [product-grid-view]');
      if (grid) {
        const currentWidth = grid.getBoundingClientRect().width;
        grid.style.width = `${currentWidth - 1}px`;
        requestAnimationFrame(() => {
          grid.style.width = '';
        });
      }
    });
  };
}

if (!customElements.get('quick-add-dialog')) {
  customElements.define('quick-add-dialog', QuickAddDialog);
}
