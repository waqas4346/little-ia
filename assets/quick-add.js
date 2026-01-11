import { morph } from '@theme/morph';
import { Component } from '@theme/component';
import { CartUpdateEvent, ThemeEvents, VariantSelectedEvent } from '@theme/events';
import { DialogComponent, DialogCloseEvent } from '@theme/dialog';
import { mediaQueryLarge, isMobileBreakpoint, getIOSVersion, onAnimationEnd } from '@theme/utilities';

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

    // Fallback: Try to find product link manually if getProductCardLink doesn't work
    let productUrl = productLink?.href || '';
    
    if (!productUrl) {
      // Try to find link with ref="productCardLink" or class="product-card__link"
      const cardElement = this.closest('product-card');
      if (cardElement) {
        const linkWithRef = cardElement.querySelector('a[ref="productCardLink"]');
        const linkWithClass = cardElement.querySelector('a.product-card__link');
        const anyProductLink = cardElement.querySelector('a[href*="/products/"]');
        productUrl = linkWithRef?.href || linkWithClass?.href || anyProductLink?.href || '';
      }
    }
    
    // Final fallback: Check data attributes on the quick-add component itself
    if (!productUrl) {
      productUrl = this.getAttribute('data-product-url') || '';
      if (!productUrl && this.getAttribute('data-product-handle')) {
        const handle = this.getAttribute('data-product-handle');
        productUrl = `/products/${handle}`;
      }
    }

    if (!productUrl) return '';

    const url = new URL(productUrl, window.location.origin);

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

    // Abort any previous fetch requests and reset state
    this.#abortController?.abort();
    this.#abortController = new AbortController();

    // Check if we have cached content first
    const modalContent = document.getElementById('quick-add-modal-content');
    
    // Clear any stuck loader state from previous errors
    if (modalContent) {
      // Check if content is stuck showing loader (skeleton)
      const hasSkeleton = modalContent.querySelector('.quick-add-modal__loading-skeleton');
      if (hasSkeleton && modalContent.innerHTML.trim() === this.#createLoadingSkeleton().trim()) {
        // Content is stuck on loader, clear it
        modalContent.innerHTML = '';
      }
    }
    
    let productGrid = this.#cachedContent.get(currentUrl);

    // If we have cached content, use it immediately (no loader needed)
    if (productGrid && modalContent) {
      // Open modal first
      this.#openQuickAddModal();
      // Update with cached content immediately (no loader)
      const freshContent = /** @type {Element} */ (productGrid.cloneNode(true));
      requestAnimationFrame(async () => {
        if (!this.#abortController?.signal.aborted) {
          try {
            await this.updateQuickAddModal(freshContent);
            // Clear abort controller after successful update (ready for next operation)
            if (this.#abortController) {
              this.#abortController = null;
            }
          } catch (error) {
            if (error.name !== 'AbortError') {
              console.error('Quick Add: Error updating modal with cached content', error);
            }
            // Clear abort controller even on error (unless it was aborted)
            if (this.#abortController && !this.#abortController.signal.aborted) {
              this.#abortController = null;
            }
          }
        }
      });
      return;
    }

    // No cached content - show loading skeleton
    if (modalContent) {
      modalContent.innerHTML = this.#createLoadingSkeleton();
    }

    // Open the modal immediately, then load content asynchronously
    this.#openQuickAddModal();

    // Load content asynchronously
    (async () => {
      try {
        // Check if we have cached content for this URL (double check after fetch)
        if (!productGrid) {
          let timeoutId;
          try {
            // Create a timeout promise that can be cancelled
            const timeoutPromise = new Promise((_, reject) => {
              timeoutId = setTimeout(() => {
                if (!this.#abortController?.signal.aborted) {
                  reject(new Error('Fetch timeout'));
                }
              }, 10000);
            });

            // Fetch and cache the content with timeout
            const html = await Promise.race([
              this.fetchProductPage(currentUrl),
              timeoutPromise
            ]);
            
            // Clear timeout since one of the promises resolved
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
            
            // Check if aborted before processing
            if (this.#abortController?.signal.aborted) {
              return;
            }
            
            if (html) {
              const gridElement = html.querySelector('[data-product-grid-content]');
              if (gridElement) {
                // Cache the cloned element to avoid modifying the original
                productGrid = /** @type {Element} */ (gridElement.cloneNode(true));
                this.#cachedContent.set(currentUrl, productGrid);
              }
            }
          } catch (error) {
            // Clear timeout on error
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
            if (error.name !== 'AbortError' && error.message !== 'Fetch timeout') {
              console.error('Quick Add: Error fetching product page', error);
            }
            return;
          }
        }

        // Check if this request was aborted (user clicked another product)
        if (this.#abortController?.signal.aborted) {
          return;
        }

        if (productGrid) {
          try {
            // Use a fresh clone from the cache
            const freshContent = /** @type {Element} */ (productGrid.cloneNode(true));
            await this.updateQuickAddModal(freshContent);
            // Clear abort controller after successful update (ready for next operation)
            if (this.#abortController) {
              this.#abortController = null;
            }
          } catch (error) {
            if (error.name !== 'AbortError') {
              console.error('Quick Add: Error updating modal content', error);
              // Clear loader if there was an error
              const modalContent = document.getElementById('quick-add-modal-content');
              if (modalContent && modalContent.querySelector('.quick-add-modal__loading-skeleton')) {
                modalContent.innerHTML = '<div style="padding: 2rem; text-align: center;">Error loading product. Please try again.</div>';
              }
            }
            // Clear abort controller even on error (unless it was aborted)
            if (this.#abortController && !this.#abortController.signal.aborted) {
              this.#abortController = null;
            }
          }
        } else {
          // No product grid found - clear loader and show error
          const modalContent = document.getElementById('quick-add-modal-content');
          if (modalContent && modalContent.querySelector('.quick-add-modal__loading-skeleton')) {
            modalContent.innerHTML = '<div style="padding: 2rem; text-align: center;">Product not found. Please try again.</div>';
          }
          // Clear abort controller
          if (this.#abortController && !this.#abortController.signal.aborted) {
            this.#abortController = null;
          }
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Quick Add: Unexpected error loading content', error);
          // Clear loader on unexpected error
          const modalContent = document.getElementById('quick-add-modal-content');
          if (modalContent && modalContent.querySelector('.quick-add-modal__loading-skeleton')) {
            modalContent.innerHTML = '<div style="padding: 2rem; text-align: center;">Error loading product. Please try again.</div>';
          }
          // Clear abort controller
          if (this.#abortController && !this.#abortController.signal.aborted) {
            this.#abortController = null;
          }
        }
      }
    })();
  };

  /** @param {QuickAddDialog} dialogComponent */
  #stayVisibleUntilDialogCloses(dialogComponent) {
    this.toggleAttribute('stay-visible', true);

    const handleClose = () => {
      this.toggleAttribute('stay-visible', false);
      // Clean up state when dialog closes
      this.#cleanupOnDialogClose();
    };

    dialogComponent.addEventListener(DialogCloseEvent.eventName, handleClose, {
      once: true,
    });
  }

  /**
   * Cleans up state when dialog closes (abort requests, reset content if needed)
   */
  #cleanupOnDialogClose() {
    // Abort any pending fetch requests
    if (this.#abortController && !this.#abortController.signal.aborted) {
      this.#abortController.abort();
    }
    // Reset abort controller so it can be reused
    this.#abortController = null;
    
    // Note: We don't clear the modal content here because the user might want to see
    // the last product they viewed when reopening. Only clear on new product selection.
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
            // Ensure close button handler is attached after opening
            this.#ensureCloseButtonHandler(dialog);
          }
        }, 100);
        return;
      }

      this.#stayVisibleUntilDialogCloses(dialog);
      dialog.showDialog();
      // Ensure close button handler is attached after opening
      this.#ensureCloseButtonHandler(dialog);
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

    // Use the existing abort controller (should be set by handleClick)
    if (!this.#abortController) {
      this.#abortController = new AbortController();
    }

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
    }
  }

  /**
   * Creates a loading skeleton that matches the modal design
   * @returns {string} HTML string for the loading skeleton
   */
  #createLoadingSkeleton() {
    return `
      <div class="quick-add-modal__loading-skeleton product-information__grid">
        <div class="quick-add-modal__skeleton-media product-information__media">
          <div class="quick-add-modal__skeleton-image"></div>
        </div>
        <div class="quick-add-modal__skeleton-details product-details">
          <div class="quick-add-modal__skeleton-line quick-add-modal__skeleton-title"></div>
          <div class="quick-add-modal__skeleton-line quick-add-modal__skeleton-price"></div>
          <div class="quick-add-modal__skeleton-line quick-add-modal__skeleton-line--medium"></div>
          <div class="quick-add-modal__skeleton-line quick-add-modal__skeleton-line--small"></div>
          <div class="quick-add-modal__skeleton-variants">
            <div class="quick-add-modal__skeleton-variant"></div>
            <div class="quick-add-modal__skeleton-variant"></div>
            <div class="quick-add-modal__skeleton-variant"></div>
          </div>
          <div class="quick-add-modal__skeleton-button"></div>
        </div>
      </div>
    `;
  }

  /**
   * Re-renders the variant picker.
   * @param {Element} productGrid - The product grid element
   */
  async updateQuickAddModal(productGrid) {
    const modalContent = document.getElementById('quick-add-modal-content');

    if (!productGrid || !modalContent) return;

    // Check if the request was aborted before updating
    if (this.#abortController?.signal.aborted) {
      return;
    }

    // Keep content same as desktop - no mobile-specific restructuring
    // The CSS will handle the layout differences

    morph(modalContent, productGrid);

    this.#syncVariantSelection(modalContent);
    
    // Ensure close button handler is re-attached after content is loaded
    // Use multiple callbacks to ensure DOM is settled after morph
    requestAnimationFrame(() => {
      const dialogComponent = document.getElementById('quick-add-dialog');
      if (dialogComponent instanceof QuickAddDialog) {
        // Trigger updatedCallback to ensure close button handler is set up via refs
        dialogComponent.updatedCallback();
        // Also use our helper method to ensure close button handler
        this.#ensureCloseButtonHandler(dialogComponent);
        
        // Try again after a short delay to be sure
        setTimeout(() => {
          this.#ensureCloseButtonHandler(dialogComponent);
        }, 100);
      }

      // Add View Product button to image container
      this.#addViewProductButton(modalContent);
    });
    
    // Ensure personalise button event listeners work with dynamically loaded content
    requestAnimationFrame(() => {
      this.#ensurePersonaliseButtonHandlers(modalContent);
    });

    // Prevent media gallery flickering on variant update - update image smoothly
    requestAnimationFrame(() => {
      this.#preventMediaGalleryFlicker(modalContent);
    });
  }

  /**
   * Prevents media gallery flickering by ensuring smooth image updates
   * Similar to personalize modal - shows single static image without flicker
   * @param {Element} modalContent - The modal content element
   */
  #preventMediaGalleryFlicker(modalContent) {
    if (!modalContent) return;

    // Add data attribute to mark this as a quick-add modal media gallery
    const mediaGallery = modalContent.querySelector('media-gallery');
    if (mediaGallery) {
      mediaGallery.setAttribute('data-quick-add-modal', 'true');
    }

    // Find the first image element (the one that should be displayed)
    const findFirstImage = () => {
      return modalContent.querySelector(
        '.product-information__media slideshow-slide:first-child img, .product-information__media .product-media img, .product-information__media img'
      );
    };

    let firstImage = findFirstImage();
    
    // Disable any transitions/animations on images to prevent flicker
    if (firstImage) {
      firstImage.style.transition = 'none';
      firstImage.style.animation = 'none';
      firstImage.style.opacity = '1';
    }

    // Listen for variant updates within the modal to update image smoothly
    const dialog = modalContent.closest('dialog');
    if (!dialog) return;

    const handleVariantUpdate = (event) => {
      // Only handle variant updates within this quick add modal
      if (!modalContent.contains(event.target)) return;

      const newHtml = event.detail?.data?.html;
      if (!newHtml) return;

      // Find the new first image from the updated content
      const newMediaGallery = newHtml.querySelector('media-gallery');
      if (!newMediaGallery) return;

      const newFirstImage = newMediaGallery.querySelector(
        'slideshow-slide:first-child img, .product-media img, img'
      );
      
      if (!newFirstImage) return;

      // Get current first image (might have changed due to DOM updates)
      firstImage = findFirstImage();
      if (!firstImage) return;

      // Get the new image src
      const newImageSrc = newFirstImage.src || newFirstImage.getAttribute('src') || 
                         newFirstImage.getAttribute('srcset')?.split(' ')[0];
      
      if (!newImageSrc || firstImage.src === newImageSrc) return;

      // Update image instantly without fade (like personalize modal)
      // Remove any existing transition
      firstImage.style.transition = 'none';
      firstImage.style.opacity = '1';
      
      // Update image source immediately
      firstImage.src = newImageSrc;
      
      if (newFirstImage.srcset) {
        firstImage.srcset = newFirstImage.srcset;
      }
      if (newFirstImage.sizes) {
        firstImage.sizes = newFirstImage.sizes;
      }
      if (newFirstImage.alt) {
        firstImage.alt = newFirstImage.alt;
      }
    };

    // Listen for variant update events on the dialog (capture phase to run before media-gallery handler)
    dialog.addEventListener(ThemeEvents.variantUpdate, handleVariantUpdate, { 
      capture: true,
      passive: true
    });
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
   * Ensures the close button handler is attached to the dialog
   * @param {QuickAddDialog} dialogComponent - The dialog component
   */
  #ensureCloseButtonHandler(dialogComponent) {
    if (!(dialogComponent instanceof QuickAddDialog)) return;
    
    // Try multiple ways to find the close button
    let closeButton = null;
    
    // Method 1: Try refs
    if (dialogComponent.refs && dialogComponent.refs.closeButton && !Array.isArray(dialogComponent.refs.closeButton)) {
      closeButton = dialogComponent.refs.closeButton;
    }
    
    // Method 2: Find by class or ref attribute
    if (!closeButton) {
      const dialog = dialogComponent.refs?.dialog || dialogComponent.querySelector('dialog');
      if (dialog) {
        closeButton = dialog.querySelector('.quick-add-modal__close') || 
                     dialog.querySelector('button[ref="closeButton"]') ||
                     dialog.querySelector('button.quick-add-modal__close');
      }
    }
    
    // Method 3: Direct query from dialogComponent
    if (!closeButton) {
      closeButton = dialogComponent.querySelector('.quick-add-modal__close') || 
                   dialogComponent.querySelector('button[ref="closeButton"]') ||
                   dialogComponent.querySelector('button.quick-add-modal__close');
    }
    
    if (closeButton instanceof HTMLElement) {
      // Remove any existing handler
      if (closeButton._closeHandler) {
        closeButton.removeEventListener('click', closeButton._closeHandler, { capture: true });
        closeButton.removeEventListener('click', closeButton._closeHandler);
        delete closeButton._closeHandler;
      }
      
      // Create a robust handler that definitely closes the dialog
      const clickHandler = (event) => {
        console.log('Close button clicked', event);
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        
        // Try to close the dialog
        try {
          if (dialogComponent && typeof dialogComponent.closeDialog === 'function') {
            dialogComponent.closeDialog();
          } else {
            // Fallback: close the dialog element directly
            const dialog = dialogComponent.refs?.dialog || dialogComponent.querySelector('dialog');
            if (dialog && dialog.open) {
              dialog.close();
            }
          }
        } catch (error) {
          console.error('Error closing dialog:', error);
          // Last resort: try to close the dialog element directly
          const dialog = dialogComponent.querySelector('dialog');
          if (dialog) {
            dialog.close();
          }
        }
      };
      
      // Attach handler in both capture and bubble phases to ensure it runs
      closeButton.addEventListener('click', clickHandler, { capture: true });
      closeButton.addEventListener('click', clickHandler);
      closeButton._closeHandler = clickHandler;
      
      // Ensure the on:click attribute is set for the component system
      if (!closeButton.hasAttribute('on:click')) {
        closeButton.setAttribute('on:click', '/closeDialog');
      }
      
      // Also set a data attribute to mark it as handled
      closeButton.dataset.closeHandlerAttached = 'true';
    } else {
      console.warn('Quick Add: Close button not found', dialogComponent);
    }
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

  /**
   * Adds View Product button to the image container
   * @param {Element} modalContent - The modal content element
   */
  #addViewProductButton(modalContent) {
    if (!modalContent || !this.productPageUrl) return;

    const mediaContainer = modalContent.querySelector('.product-information__media');
    if (!mediaContainer) return;

    // Check if button already exists
    let viewProductButton = mediaContainer.querySelector('.quick-add-modal__view-product-button');
    if (viewProductButton) {
      // Update href if it exists
      viewProductButton.href = this.productPageUrl;
      return;
    }

    // Create the button
    viewProductButton = document.createElement('a');
    viewProductButton.href = this.productPageUrl;
    viewProductButton.className = 'quick-add-modal__view-product-button';
    viewProductButton.setAttribute('aria-label', 'View Product');

    // Create icon container
    const iconContainer = document.createElement('span');
    iconContainer.className = 'quick-add-modal__view-product-button-icon';
    
    // Create eye icon SVG
    const iconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    iconSvg.setAttribute('width', '18');
    iconSvg.setAttribute('height', '18');
    iconSvg.setAttribute('viewBox', '0 0 24 24');
    iconSvg.setAttribute('fill', 'none');
    iconSvg.setAttribute('stroke', 'currentColor');
    iconSvg.setAttribute('stroke-width', '2');
    iconSvg.setAttribute('stroke-linecap', 'round');
    iconSvg.setAttribute('stroke-linejoin', 'round');
    
    const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path1.setAttribute('d', 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z');
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '12');
    circle.setAttribute('cy', '12');
    circle.setAttribute('r', '3');
    
    iconSvg.appendChild(path1);
    iconSvg.appendChild(circle);
    iconContainer.appendChild(iconSvg);

    // Create text
    const text = document.createTextNode('View Product');

    // Assemble button
    viewProductButton.appendChild(iconContainer);
    viewProductButton.appendChild(text);

    // Add to media container
    mediaContainer.appendChild(viewProductButton);
  }

  /**
   * Ensures personalise button event handlers work with dynamically loaded content
   * @param {Element} modalContent - The modal content element
   */
  #ensurePersonaliseButtonHandlers(modalContent) {
    // Check if personalise modal exists, if not, try to find it in the loaded content
    let personaliseModal = document.querySelector('personalise-dialog');
    if (!personaliseModal) {
      // Try to find it in the loaded content
      personaliseModal = modalContent.querySelector('personalise-dialog');
      if (personaliseModal) {
        // Move it to the document body so it's accessible globally
        document.body.appendChild(personaliseModal);
      }
    }

    // Ensure the personalise modal script is loaded and event listeners are set up
    // The event listener should already be set up globally via the script in buy-buttons.liquid
    // But we need to ensure it works with dynamically loaded content
    // Since event delegation is used (listening on document), it should work automatically
    // However, we need to make sure the personalise modal is available when the button is clicked
    
    // Find all personalise buttons in the modal content and ensure they work
    const personaliseButtons = modalContent.querySelectorAll('[data-personalise-button]');
    personaliseButtons.forEach(button => {
      // The global event listener should handle this, but we can add a direct handler as fallback
      if (!button.dataset.personaliseHandlerAttached) {
        button.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          // Try to find the personalise dialog
          const dialog = document.querySelector('personalise-dialog');
          if (dialog && typeof dialog.showDialog === 'function') {
            dialog.showDialog();
          } else if (dialog) {
            // Fallback: try to open the dialog directly
            const dialogElement = dialog.querySelector('dialog');
            if (dialogElement) {
              dialogElement.showModal();
            }
          }
        });
        button.dataset.personaliseHandlerAttached = 'true';
      }
    });
  }
}

if (!customElements.get('quick-add-component')) {
  customElements.define('quick-add-component', QuickAddComponent);
}

class QuickAddDialog extends DialogComponent {
  #abortController = new AbortController();
  #previousScrollY = 0;

  connectedCallback() {
    super.connectedCallback();

    // Ensure we have the correct dialog ref - find the quick-add-modal dialog
    if (!this.refs?.dialog || !this.refs.dialog.classList.contains('quick-add-modal')) {
      const quickAddDialog = this.querySelector('dialog.quick-add-modal');
      if (quickAddDialog && this.refs) {
        this.refs.dialog = quickAddDialog;
      }
    }

    // Ensure close button has the event handler
    this.#ensureCloseButtonHandler();

    this.addEventListener(ThemeEvents.cartUpdate, this.handleCartUpdate, { signal: this.#abortController.signal });
    this.addEventListener(ThemeEvents.variantUpdate, this.#updateProductTitleLink);

    this.addEventListener(DialogCloseEvent.eventName, this.#handleDialogClose);
  }

  updatedCallback() {
    super.updatedCallback();
    
    // Ensure we have the correct dialog ref - find the quick-add-modal dialog
    if (!this.refs?.dialog || !this.refs.dialog.classList.contains('quick-add-modal')) {
      const quickAddDialog = this.querySelector('dialog.quick-add-modal');
      if (quickAddDialog && this.refs) {
        this.refs.dialog = quickAddDialog;
      }
    }
    
    // Ensure close button handler is set up after updates
    this.#ensureCloseButtonHandler();
  }

  /**
   * Override showDialog to ensure close button handler is attached when dialog opens
   */
  showDialog() {
    // Store scroll position before opening
    this.#previousScrollY = window.scrollY;
    
    // Ensure we have the correct dialog ref before showing
    const quickAddDialog = this.querySelector('dialog.quick-add-modal');
    if (quickAddDialog && this.refs) {
      this.refs.dialog = quickAddDialog;
    }
    
    super.showDialog();
    // Ensure close button handler is attached after dialog is shown
    requestAnimationFrame(() => {
      this.#ensureCloseButtonHandler();
      // Try again after a short delay to be sure
      setTimeout(() => {
        this.#ensureCloseButtonHandler();
      }, 50);
    });
  }

  /**
   * Override closeDialog to ensure we're closing the correct dialog
   * Since parent's closeDialog is an arrow function (instance property), we implement it directly
   */
  closeDialog = async () => {
    // Get the correct dialog - the quick-add-modal, not personalise-modal
    let dialog = this.querySelector('dialog.quick-add-modal');
    
    // If we found the correct dialog, update refs
    if (dialog && this.refs) {
      this.refs.dialog = dialog;
    } else {
      // Fallback to refs
      dialog = this.refs?.dialog;
    }
    
    if (!dialog) {
      console.warn('QuickAddDialog: No dialog found to close');
      // Still reset body styles in case they're stuck
      document.body.style.width = '';
      document.body.style.position = '';
      document.body.style.top = '';
      return;
    }
    
    // Verify it's the quick-add-modal
    if (!dialog.classList.contains('quick-add-modal')) {
      console.warn('QuickAddDialog: Dialog is not quick-add-modal, finding correct one');
      const quickAddDialog = this.querySelector('dialog.quick-add-modal');
      if (!quickAddDialog) {
        console.error('QuickAddDialog: Cannot find quick-add-modal dialog');
        // Reset styles anyway
        document.body.style.width = '';
        document.body.style.position = '';
        document.body.style.top = '';
        return;
      }
      // Update refs to point to correct dialog
      if (this.refs) {
        this.refs.dialog = quickAddDialog;
      }
      dialog = quickAddDialog;
    }

    if (!dialog.open) {
      // Still reset body styles in case they're stuck (even if dialog appears closed)
      document.body.style.width = '';
      document.body.style.position = '';
      document.body.style.top = '';
      return;
    }

    // Store original refs and ensure dialog ref is correct
    const originalRefsDialog = this.refs?.dialog;
    if (this.refs) {
      this.refs.dialog = dialog;
    }
    
    // Implement parent's closeDialog logic directly (since it's an arrow function instance property)
    // Remove event listeners (parent does this but we can't access their private methods)
    // The parent's #handleClick and #handleKeyDown are private, but removing listeners won't hurt even if they don't exist
    
    dialog.classList.add('dialog-closing');

    try {
      await onAnimationEnd(dialog, undefined, { subtree: false });
    } catch (error) {
      // Ignore animation errors - continue with closing
      console.warn('QuickAddDialog: Animation end error (ignored):', error);
    }

    document.body.style.width = '';
    document.body.style.position = '';
    document.body.style.top = '';
    window.scrollTo({ top: this.#previousScrollY || 0, behavior: 'instant' });

    dialog.close();
    dialog.classList.remove('dialog-closing');

    this.dispatchEvent(new DialogCloseEvent());
    
    // Restore original refs if it was different (though we want to keep the correct one)
    // Actually, keep the correct dialog ref instead of restoring potentially wrong one
    if (this.refs && originalRefsDialog && originalRefsDialog !== dialog && originalRefsDialog.classList?.contains('quick-add-modal')) {
      // Only restore if the original was also a valid quick-add-modal
      this.refs.dialog = originalRefsDialog;
    }
  };

  disconnectedCallback() {
    super.disconnectedCallback();

    // Clean up close button event listener
    // Try multiple ways to find the button
    let closeButton = this.refs?.closeButton;
    if (!closeButton || Array.isArray(closeButton)) {
      const dialog = this.refs?.dialog || this.querySelector('dialog');
      if (dialog) {
        closeButton = dialog.querySelector('.quick-add-modal__close') || 
                     dialog.querySelector('button[ref="closeButton"]');
      }
    }
    
    if (closeButton && !Array.isArray(closeButton)) {
      const button = /** @type {HTMLElement & { _closeHandler?: (event: MouseEvent) => void }} */ (closeButton);
      if (button._closeHandler) {
        // Remove from both capture and bubble phases
        button.removeEventListener('click', button._closeHandler, { capture: true });
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
    // Try multiple ways to find the close button
    let closeButton = null;
    
    // Method 1: Try refs
    if (this.refs && this.refs.closeButton && !Array.isArray(this.refs.closeButton)) {
      closeButton = this.refs.closeButton;
    }
    
    // Method 2: Find by selector as fallback
    if (!closeButton) {
      const dialog = this.refs?.dialog || this.querySelector('dialog');
      if (dialog) {
        closeButton = dialog.querySelector('.quick-add-modal__close') || 
                     dialog.querySelector('button[ref="closeButton"]') ||
                     dialog.querySelector('button.quick-add-modal__close');
      }
    }
    
    // Method 3: Direct query
    if (!closeButton) {
      closeButton = this.querySelector('.quick-add-modal__close') || 
                   this.querySelector('button[ref="closeButton"]') ||
                   this.querySelector('button.quick-add-modal__close');
    }
    
    if (!closeButton || !(closeButton instanceof HTMLElement)) {
      console.warn('QuickAddDialog: Close button not found');
      return;
    }
    
    const button = /** @type {HTMLElement} */ (closeButton);

    // Set the declarative event handler attribute
    if (!button.hasAttribute('on:click')) {
      button.setAttribute('on:click', '/closeDialog');
    }

    // Remove any existing handler first
    if (button._closeHandler) {
      button.removeEventListener('click', button._closeHandler, { capture: true });
      button.removeEventListener('click', button._closeHandler);
      delete button._closeHandler;
    }

    // Add a direct event listener as a fallback to ensure it works
    // Use both capture and bubble phases to ensure it runs
    const clickHandler = async (/** @type {MouseEvent} */ event) => {
      console.log('QuickAddDialog: Close button clicked', event);
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      
      // Call closeDialog method
      try {
        // Get the correct dialog - should be in refs, but verify it's the quick-add-modal
        let dialog = this.refs?.dialog;
        
        // Verify we have the right dialog (quick-add-modal, not personalise-modal)
        if (dialog && !dialog.classList.contains('quick-add-modal')) {
          console.warn('QuickAddDialog: refs.dialog is wrong dialog, finding correct one');
          dialog = this.querySelector('dialog.quick-add-modal');
        }
        
        // If still no dialog, try to find it
        if (!dialog) {
          dialog = this.querySelector('dialog.quick-add-modal');
        }
        
        console.log('QuickAddDialog: Attempting to close dialog', {
          hasCloseDialog: typeof this.closeDialog === 'function',
          hasDialogRef: !!this.refs?.dialog,
          dialogElement: !!dialog,
          dialogOpen: dialog?.open,
          dialogClassList: dialog?.classList?.toString(),
          isQuickAddModal: dialog?.classList?.contains('quick-add-modal')
        });
        
        // If we don't have the right dialog, try to close it directly
        if (!dialog || !dialog.classList.contains('quick-add-modal')) {
          console.error('QuickAddDialog: Cannot find quick-add-modal dialog');
          return;
        }
        
        // If dialog is not open, something is wrong
        if (!dialog.open) {
          console.warn('QuickAddDialog: Dialog is not open, but trying to close anyway');
          // Still try to close it and reset styles
          dialog.close();
          document.body.style.width = '';
          document.body.style.position = '';
          document.body.style.top = '';
          return;
        }
        
        if (typeof this.closeDialog === 'function') {
          // closeDialog is async, so await it
          console.log('QuickAddDialog: Calling closeDialog method');
          await this.closeDialog();
          console.log('QuickAddDialog: closeDialog completed');
          
          // Double-check: if dialog is still open, force close it
          const checkDialog = this.refs?.dialog || this.querySelector('dialog.quick-add-modal');
          if (checkDialog && checkDialog.open) {
            console.warn('QuickAddDialog: Dialog still open after closeDialog, forcing close');
            checkDialog.close();
            // Also reset body styles in case closeDialog didn't complete properly
            document.body.style.width = '';
            document.body.style.position = '';
            document.body.style.top = '';
          }
        } else {
          console.warn('QuickAddDialog: closeDialog is not a function, using fallback');
          // Fallback: close dialog directly
          if (dialog.open) {
            dialog.close();
            // Reset body styles
            document.body.style.width = '';
            document.body.style.position = '';
            document.body.style.top = '';
            console.log('QuickAddDialog: Dialog close() called');
          }
        }
      } catch (error) {
        console.error('QuickAddDialog: Error closing dialog:', error, error.stack);
        // Last resort: try to close the quick-add dialog element directly
        try {
          const quickAddDialog = this.querySelector('dialog.quick-add-modal');
          if (quickAddDialog) {
            quickAddDialog.close();
            document.body.style.width = '';
            document.body.style.position = '';
            document.body.style.top = '';
            console.log('QuickAddDialog: Fallback - Quick-add dialog close() called directly');
          }
        } catch (fallbackError) {
          console.error('QuickAddDialog: Fallback close also failed:', fallbackError);
        }
      }
    };
    
    // Attach in both phases to ensure it works
    button.addEventListener('click', clickHandler, { capture: true });
    button.addEventListener('click', clickHandler);
    button.dataset.closeHandlerAttached = 'true';
    // @ts-ignore - storing handler reference for cleanup
    button._closeHandler = clickHandler;
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
