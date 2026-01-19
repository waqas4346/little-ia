import { morph } from '@theme/morph';
import { Component } from '@theme/component';
import { CartUpdateEvent, ThemeEvents, VariantSelectedEvent } from '@theme/events';
import { DialogComponent, DialogCloseEvent, DialogOpenEvent } from '@theme/dialog';
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

    // Check if this quick-add is from build-your-set and mark it
    const productCard = /** @type {import('./product-card').ProductCard | null} */ (this.closest('product-card'));
    const isFromBuildYourSet = productCard?.hasAttribute('data-build-your-set') || 
                                productCard?.closest('[data-testid="build-your-set"], .build-your-set-section') !== null;
    
    // Mark the modal content element with a data attribute if from build-your-set
    const modalContent = document.getElementById('quick-add-modal-content');
    if (modalContent) {
      if (isFromBuildYourSet) {
        modalContent.setAttribute('data-build-your-set', 'true');
      } else {
        modalContent.removeAttribute('data-build-your-set');
      }
    }

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
    // Clear personalization when dialog closes
    const modalContent = document.getElementById('quick-add-modal-content');
    if (modalContent) {
      const productFormComponent = modalContent.querySelector('product-form-component');
      const productId = productFormComponent?.dataset?.productId;
      if (productId) {
        const key = `personalisation_${String(productId)}`;
        sessionStorage.removeItem(key);
      }
    }
    
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
    // Ensure modal content marker is set after modal opens (in case it wasn't set before)
    requestAnimationFrame(() => {
      const modalContent = document.getElementById('quick-add-modal-content');
      if (modalContent) {
        const productCard = /** @type {import('./product-card').ProductCard | null} */ (this.closest('product-card'));
        const isFromBuildYourSet = productCard?.hasAttribute('data-build-your-set') || 
                                    productCard?.closest('[data-testid="build-your-set"], .build-your-set-section') !== null;
        if (isFromBuildYourSet) {
          modalContent.setAttribute('data-build-your-set', 'true');
        }
      }
    });
    
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
    
    // Preserve build-your-set marker if it was set before content update
    const wasBuildYourSet = modalContent.hasAttribute('data-build-your-set');

    // Check if the request was aborted before updating
    if (this.#abortController?.signal.aborted) {
      return;
    }

    // Keep content same as desktop - no mobile-specific restructuring
    // The CSS will handle the layout differences

    morph(modalContent, productGrid);
    
    // Restore build-your-set marker after morphing
    if (wasBuildYourSet) {
      modalContent.setAttribute('data-build-your-set', 'true');
    }

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
      
      // Replace add-to-cart button with custom button for build-your-set
      if (wasBuildYourSet) {
        this.#replaceAddToCartButtonForBuildYourSet(modalContent);
      }
    });
    
    // Ensure personalise button event listeners work with dynamically loaded content
    requestAnimationFrame(() => {
      this.#ensurePersonaliseButtonHandlers(modalContent);
      
      // Clear any existing personalization for this product when modal opens
      // This ensures a fresh state each time the popup is opened
      const productFormComponent = modalContent.querySelector('product-form-component');
      const productId = productFormComponent?.dataset?.productId;
      if (productId) {
        const key = `personalisation_${String(productId)}`;
        sessionStorage.removeItem(key);
      }

      // Update personalise button text after modal content is loaded
      // Use multiple retries to ensure buttons are in DOM and function is available
      const updateButtonWithRetry = (attempts = 0) => {
        // Check if function exists in the morphed content's scripts
        if (attempts === 0) {
          // Execute all scripts in the morphed content (morph doesn't execute scripts automatically)
          const scripts = modalContent.querySelectorAll('script');
          scripts.forEach((script) => {
            if (script.textContent) {
              try {
                // Execute the script to define functions and run initialization code
                const newScript = document.createElement('script');
                newScript.textContent = script.textContent;
                document.head.appendChild(newScript);
                document.head.removeChild(newScript);
              } catch (e) {
                console.error('Quick Add: Error executing script:', e);
              }
            }
          });
        }
        
        if (typeof window.updatePersonaliseButtonText === 'function') {
          window.updatePersonaliseButtonText();
          
          // Check if buttons in quick-add modal were updated
          const quickAddButtons = modalContent.querySelectorAll('[data-personalise-button]');
          let anyButtonUpdated = false;
          quickAddButtons.forEach((button) => {
            const textSpan = button.querySelector('[data-personalise-text]');
            if (textSpan && textSpan.textContent === 'EDIT') {
              anyButtonUpdated = true;
            }
          });
          
          // If buttons exist but weren't updated, retry
          if (quickAddButtons.length > 0 && !anyButtonUpdated && attempts < 10) {
            setTimeout(() => updateButtonWithRetry(attempts + 1), 300);
          }
        } else if (attempts < 10) {
          // Function not defined yet, retry
          setTimeout(() => updateButtonWithRetry(attempts + 1), 300);
        }
      };
      
      setTimeout(() => updateButtonWithRetry(0), 300);
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
   * Collects all product information from the modal content
   * @param {Element} modalContent - The modal content element
   * @param {string} productId - The product ID
   * @param {string} variantId - The variant ID
   * @returns {Object} Product information object
   */
  #collectProductInformation(modalContent, productId, variantId) {
    const productData = {
      product_id: productId,
      variant_id: variantId
    };

    // Get product name/title
    const productTitle = modalContent.querySelector('.product-title-text, .view-product-title, h1, [data-product-title]');
    if (productTitle) {
      productData.product_name = productTitle.textContent?.trim() || '';
    }

    // Get product handle/URL
    const productLink = modalContent.querySelector('.view-product-title a, .product-header a, a[href*="/products/"]');
    if (productLink) {
      productData.product_url = productLink.href || '';
      const urlMatch = productLink.href?.match(/\/products\/([^/?]+)/);
      if (urlMatch) {
        productData.product_handle = urlMatch[1];
      }
    }

    // Get price information
    const priceElement = modalContent.querySelector('product-price');
    if (priceElement) {
      const priceText = priceElement.textContent?.trim() || '';
      const priceValue = priceElement.querySelector('.price, .price-snippet');
      if (priceValue) {
        productData.price = priceValue.textContent?.trim() || priceText;
      } else {
        productData.price = priceText;
      }

      // Try to get numeric price value
      const priceMatch = priceText.match(/[\d,]+\.?\d*/);
      if (priceMatch) {
        productData.price_value = parseFloat(priceMatch[0].replace(/,/g, ''));
      }
    }

    // Get variant information
    const variantPicker = modalContent.querySelector('variant-picker, variant-main-picker');
    if (variantPicker) {
      const selectedVariant = variantPicker.querySelector(`input[data-variant-id="${variantId}"], [data-variant-id="${variantId}"]`);
      if (selectedVariant) {
        productData.variant_title = selectedVariant.getAttribute('data-variant-title') || 
                                    selectedVariant.getAttribute('aria-label') || 
                                    selectedVariant.textContent?.trim() || '';
      }
    }

    // Get product images
    const images = [];
    const mediaGallery = modalContent.querySelector('media-gallery, slideshow-component');
    if (mediaGallery) {
      const imageElements = mediaGallery.querySelectorAll('img[src], img[data-src]');
      imageElements.forEach((img) => {
        const imageUrl = img.src || img.getAttribute('data-src') || img.getAttribute('srcset')?.split(' ')[0];
        if (imageUrl && !images.includes(imageUrl)) {
          images.push(imageUrl);
        }
      });
    }
    
    // Fallback: get images from product media containers
    if (images.length === 0) {
      const mediaContainers = modalContent.querySelectorAll('.product-media img, .product-information__media img');
      mediaContainers.forEach((img) => {
        const imageUrl = img.src || img.getAttribute('data-src') || img.getAttribute('srcset')?.split(' ')[0];
        if (imageUrl && !images.includes(imageUrl)) {
          images.push(imageUrl);
        }
      });
    }

    // Get featured image (first image)
    if (images.length > 0) {
      productData.featured_image = images[0];
      productData.images = images;
    }

    // Check if product supports personalization (has personalization button)
    const personaliseButton = modalContent.querySelector('[data-personalise-button]');
    productData.needs_personalization = personaliseButton !== null;
    
    // Collect personalization field structure (what fields are available for this product)
    productData.personalization_fields = null;
    if (productData.needs_personalization) {
      const personalizationFields = [];
      
      // Find the personalise modal/dialog
      const personaliseModal = document.querySelector('personalise-dialog');
      const personaliseModalContent = personaliseModal?.querySelector('.personalise-modal') || 
                                      document.querySelector('.personalise-modal');
      
      if (personaliseModalContent) {
        // Collect all personalization input fields
        const nameInputs = personaliseModalContent.querySelectorAll('input[name="personalise-name"], input[name^="properties["]');
        nameInputs.forEach((input) => {
          const fieldInfo = {
            name: input.name || '',
            type: input.type || 'text',
            maxlength: input.maxlength || null,
            placeholder: input.placeholder || '',
            required: input.hasAttribute('required') || input.hasAttribute('aria-required'),
            label: ''
          };
          
          // Try to find the label for this input
          const label = personaliseModalContent.querySelector(`label[for="${input.id}"]`) ||
                        input.closest('.personalise-modal__field')?.querySelector('.personalise-modal__label') ||
                        input.closest('.personalise-name-tabs__panel')?.querySelector('.personalise-name-tabs__panel-title');
          if (label) {
            fieldInfo.label = label.textContent?.trim() || '';
          }
          
          // Check for specific field types
          if (input.name === 'personalise-name') {
            fieldInfo.field_type = 'name';
            // Get maxlength from dynamic_max if available
            const charCounter = personaliseModalContent.querySelector('.personalise-modal__counter');
            if (charCounter) {
              const maxText = charCounter.textContent?.match(/\/(\d+)/);
              if (maxText) {
                fieldInfo.maxlength = parseInt(maxText[1], 10);
              }
            }
          } else if (input.name.includes("Baby's Name")) {
            fieldInfo.field_type = 'baby_name';
          } else if (input.name.includes("Kid's Name")) {
            fieldInfo.field_type = 'kid_name';
          } else if (input.name.includes("Mum's Name")) {
            fieldInfo.field_type = 'mum_name';
          } else if (input.name.includes('Name 1')) {
            fieldInfo.field_type = 'name1';
          } else if (input.name.includes('Name 2')) {
            fieldInfo.field_type = 'name2';
          } else if (input.name.includes('Name 3')) {
            fieldInfo.field_type = 'name3';
          } else if (input.name.includes('Name 4')) {
            fieldInfo.field_type = 'name4';
          } else if (input.name.includes('Date of Birth')) {
            fieldInfo.field_type = 'dob';
            fieldInfo.pattern = input.pattern || '';
          } else if (input.name.includes('School Year')) {
            fieldInfo.field_type = 'school_year';
          }
          
          personalizationFields.push(fieldInfo);
        });
        
        // Collect color options if available
        const colorGrid = personaliseModalContent.querySelector('.personalise-modal__color-grid');
        if (colorGrid) {
          const colorOptions = [];
          const colorButtons = colorGrid.querySelectorAll('.personalise-modal__color-button, [data-color]');
          colorButtons.forEach((button) => {
            const colorValue = button.getAttribute('data-color') || 
                              button.querySelector('input[type="radio"]')?.value || '';
            if (colorValue) {
              colorOptions.push({
                value: colorValue,
                label: button.getAttribute('title') || colorValue,
                display: button.querySelector('.swatch')?.style.backgroundColor || colorValue
              });
            }
          });
          if (colorOptions.length > 0) {
            personalizationFields.push({
              field_type: 'text_color',
              name: 'personalise-color',
              type: 'radio',
              options: colorOptions,
              required: true,
              label: 'Text Colour'
            });
          }
        }
        
        // Collect font options if available
        const fontGrid = personaliseModalContent.querySelector('.personalise-modal__font-grid');
        if (fontGrid) {
          const fontOptions = [];
          const fontButtons = fontGrid.querySelectorAll('.personalise-modal__font-button, [data-font]');
          fontButtons.forEach((button) => {
            const fontValue = button.getAttribute('data-font') || '';
            if (fontValue) {
              fontOptions.push({
                value: fontValue,
                label: fontValue,
                display: button.textContent?.trim() || fontValue
              });
            }
          });
          if (fontOptions.length > 0) {
            personalizationFields.push({
              field_type: 'font',
              name: 'personalise-font',
              type: 'select',
              options: fontOptions,
              required: true,
              label: 'Choose Your Font'
            });
          }
        }
      }
      
      if (personalizationFields.length > 0) {
        productData.personalization_fields = personalizationFields;
      }
    }
    
    // Get personalizations from sessionStorage (if they exist - the actual values filled by user)
    productData.personalizations = null;
    if (productId) {
      const personalisationKey = `personalisation_${String(productId)}`;
      try {
        const personalisationData = sessionStorage.getItem(personalisationKey);
        if (personalisationData) {
          const parsed = JSON.parse(personalisationData);
          // Check if personalizations exist and have data
          if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
            productData.personalizations = parsed;
          }
        }
      } catch (error) {
        console.warn('Build Your Set: Error reading personalization data', error);
      }
    }

    // Get variant options/attributes
    const variantOptions = {};
    const optionInputs = modalContent.querySelectorAll('input[type="radio"][name^="options"], select[name^="options"]');
    optionInputs.forEach((input) => {
      if (input.checked || (input instanceof HTMLSelectElement && input.selectedIndex >= 0)) {
        const optionName = input.name.replace('options[', '').replace(']', '');
        const optionValue = input.value || (input instanceof HTMLSelectElement ? input.options[input.selectedIndex]?.text : input.getAttribute('data-option-value'));
        if (optionName && optionValue) {
          variantOptions[optionName] = optionValue;
        }
      }
    });
    if (Object.keys(variantOptions).length > 0) {
      productData.variant_options = variantOptions;
    }

    // Get product description if available
    const productDescription = modalContent.querySelector('.product-description, [data-product-description]');
    if (productDescription) {
      productData.product_description = productDescription.textContent?.trim() || '';
    }

    // Get SKU if available
    const skuElement = modalContent.querySelector('product-sku-component, [data-sku]');
    if (skuElement) {
      productData.sku = skuElement.textContent?.trim() || skuElement.getAttribute('data-sku') || '';
    }

    return productData;
  }

  /**
   * Replaces the default add-to-cart button with a custom button for build-your-set
   * @param {Element} modalContent - The modal content element
   */
  #replaceAddToCartButtonForBuildYourSet(modalContent) {
    if (!modalContent) return;
    
    // Find the add-to-cart button(s) in the modal
    const addToCartButtons = modalContent.querySelectorAll('add-to-cart-component, [ref="addToCartButton"], button[type="submit"][name="add"]');
    const productForm = modalContent.querySelector('product-form-component');
    
    if (!productForm || addToCartButtons.length === 0) return;
    
    const productId = productForm.dataset.productId;
    
    // Find the form to get variant ID and quantity
    const form = modalContent.querySelector('form[data-type="add-to-cart-form"]');
    if (!form) return;
    
    // Hide all existing add-to-cart buttons
    addToCartButtons.forEach(button => {
      if (button instanceof HTMLElement) {
        button.style.display = 'none';
      }
    });
    
    // Find the button container (usually inside buy-buttons-block or product-form)
    const buyButtonsBlock = modalContent.querySelector('.buy-buttons-block');
    const buttonContainer = buyButtonsBlock || productForm;
    
    if (!buttonContainer) return;
    
    // Check if custom button already exists
    let customButton = buttonContainer.querySelector('.build-your-set-add-to-session-button');
    
    if (!customButton) {
      // Create custom button with same styling as original
      customButton = document.createElement('button');
      customButton.type = 'button';
      customButton.className = 'button build-your-set-add-to-session-button';
      customButton.setAttribute('data-product-id', productId || '');
      
      // Get the text from the original button if available
      const originalButton = modalContent.querySelector('button[type="submit"][name="add"]');
      let buttonText = 'Add to Set';
      if (originalButton) {
        const textElement = originalButton.querySelector('.add-to-cart-text, .add-to-cart-text__content');
        if (textElement) {
          buttonText = textElement.textContent.trim() || 'Add to Set';
        }
      }
      
      customButton.innerHTML = `
        <span class="add-to-cart-text">
          <span class="add-to-cart-text__content">
            <span>
              <span>${buttonText}</span>
            </span>
          </span>
        </span>
      `;
      
      // Add click handler
      customButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Get variant ID and quantity from form
        const variantIdInput = form.querySelector('input[name="id"][ref="variantId"]');
        const quantityInput = form.querySelector('input[name="quantity"]');
        
        const variantId = variantIdInput?.value;
        const quantity = quantityInput ? Number(quantityInput.value) || 1 : 1;
        
        if (!variantId) {
          console.error('Build Your Set: Variant ID not found');
          return;
        }
        
        // Collect all product information
        const productData = this.#collectProductInformation(modalContent, productId, variantId);
        
        // Ensure product_id and variant_id are set (in case they weren't collected)
        productData.product_id = productId;
        productData.variant_id = variantId;
        
        // Store in session storage
        const storageKey = 'build-your-set-session-cart';
        let sessionCart = [];
        try {
          const stored = sessionStorage.getItem(storageKey);
          if (stored) {
            sessionCart = JSON.parse(stored);
          }
        } catch (error) {
          console.error('Build Your Set: Error reading session storage', error);
          sessionCart = [];
        }
        
        // Check if variant already exists, update quantity, otherwise add new
        const existingIndex = sessionCart.findIndex(item => item.variant_id === variantId);
        
        if (existingIndex >= 0) {
          // Update quantity and refresh product data
          sessionCart[existingIndex].quantity += quantity;
          // Update product data in case it changed (e.g., personalizations)
          sessionCart[existingIndex] = {
            ...sessionCart[existingIndex],
            ...productData,
            quantity: sessionCart[existingIndex].quantity
          };
        } else {
          // Add new product to session cart
          const newProduct = {
            ...productData,
            variant_id: variantId,
            product_id: productId,
            quantity: quantity,
            added_at: Date.now()
          };
          sessionCart.push(newProduct);
        }
        
        try {
          sessionStorage.setItem(storageKey, JSON.stringify(sessionCart));
          console.log('Build Your Set: Product added to session', {
            product_id: productId,
            variant_id: variantId,
            needs_personalization: productData.needs_personalization,
            has_personalizations: !!productData.personalizations
          });
          
          // Close the modal
          const quickAddDialog = document.getElementById('quick-add-dialog');
          if (quickAddDialog && typeof quickAddDialog.closeDialog === 'function') {
            quickAddDialog.closeDialog();
          }
        } catch (error) {
          console.error('Build Your Set: Error saving to session storage', error);
        }
      });
      
      // Insert the button in the same position as the original
      const firstAddToCart = Array.from(addToCartButtons)[0];
      if (firstAddToCart && firstAddToCart.parentElement) {
        firstAddToCart.parentElement.insertBefore(customButton, firstAddToCart);
      } else {
        buttonContainer.appendChild(customButton);
      }
    }
    
    // Show the custom button
    if (customButton instanceof HTMLElement) {
      customButton.style.display = '';
    }
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
        
        // CRITICAL: Ensure custom element is properly defined and initialized
        // When content is loaded via morph, the script might not have run yet
        customElements.whenDefined('personalise-dialog').then(() => {
          console.log('PersonaliseDialog: Custom element defined');
          
          // Force re-initialization by temporarily disconnecting and reconnecting
          // This ensures connectedCallback runs and sets up all handlers and functionality
          const parent = personaliseModal.parentNode;
          if (parent) {
            console.log('PersonaliseDialog: Re-initializing element after move to body');
            parent.removeChild(personaliseModal);
            document.body.appendChild(personaliseModal);
            
            // The element should now be properly initialized with all its methods
            console.log('PersonaliseDialog: Element re-initialized, methods available:', {
              showDialog: typeof personaliseModal.showDialog === 'function',
              closePersonaliseOnly: typeof personaliseModal.closePersonaliseOnly === 'function'
            });
          }
        }).catch((error) => {
          console.error('PersonaliseDialog: Error waiting for custom element definition:', error);
        });
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
   * Also prevents closing on outside clicks - only closes via close button
   */
  showDialog() {
    const { dialog } = this.refs;

    // Ensure we have the correct dialog ref before showing
    const quickAddDialog = this.querySelector('dialog.quick-add-modal');
    if (quickAddDialog && this.refs) {
      this.refs.dialog = quickAddDialog;
    }

    // Use the refs dialog if available, otherwise use the found one
    const dialogToShow = this.refs?.dialog || quickAddDialog || dialog;
    if (!dialogToShow) return;

    if (dialogToShow.open) return;

    // Store scroll position before opening
    const scrollY = window.scrollY;
    this.#previousScrollY = scrollY;

    // Prevent layout thrashing by separating DOM reads from DOM writes
    requestAnimationFrame(() => {
      document.body.style.width = '100%';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;

      dialogToShow.showModal();
      this.dispatchEvent(new DialogOpenEvent());

      // Only attach keydown listener for Escape key, NOT click listener for outside clicks
      // This prevents the dialog from closing when clicking outside
      this.addEventListener('keydown', this.#handleKeyDown);
    });

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
   * Handle Escape key to close dialog
   * @param {KeyboardEvent} event - The keyboard event
   * @private
   */
  #handleKeyDown = (event) => {
    if (event.key !== 'Escape') return;

    event.preventDefault();
    this.closeDialog();
  }

  /**
   * Clear personalization for the product in the quick add modal
   * @private
   */
  #clearQuickAddPersonalisation() {
    const modalContent = document.getElementById('quick-add-modal-content');
    if (!modalContent) return;

    // Find the product ID from the modal content
    const productFormComponent = modalContent.querySelector('product-form-component');
    const productId = productFormComponent?.dataset?.productId;

    if (productId) {
      const key = `personalisation_${String(productId)}`;
      sessionStorage.removeItem(key);
      
      // Also update button text to reset it
      if (typeof window.updatePersonaliseButtonText === 'function') {
        window.updatePersonaliseButtonText();
      }
    }
  }

  /**
   * Override closeDialog to ensure we're closing the correct dialog
   * Since parent's closeDialog is an arrow function (instance property), we implement it directly
   */
  closeDialog = async () => {
    // CRITICAL: Don't close if a personalise dialog is currently open
    // This prevents closing parent dialog when closing personalise popup
    const personaliseDialogElement = document.querySelector('personalise-dialog');
    if (personaliseDialogElement) {
      const personaliseNativeDialog = personaliseDialogElement.refs?.dialog || 
                                      personaliseDialogElement.querySelector('dialog');
      if (personaliseNativeDialog && personaliseNativeDialog.open) {
        // Personalise dialog is open, don't close quick-add dialog
        return;
      }
    }

    // Clear personalization when closing the quick add popup
    this.#clearQuickAddPersonalisation();

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
      // Still reset body styles in case they're stuck (only if personalise dialog is also closed)
      const personaliseDialog = document.querySelector('personalise-dialog');
      const personaliseIsOpen = personaliseDialog && 
                                 (personaliseDialog.refs?.dialog?.open || 
                                  personaliseDialog.querySelector('dialog')?.open);
      if (!personaliseIsOpen) {
        document.body.style.width = '';
        document.body.style.position = '';
        document.body.style.top = '';
      }
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
    
    // Remove event listeners before closing
    this.removeEventListener('keydown', this.#handleKeyDown);
    
    dialog.classList.add('dialog-closing');

    try {
      await onAnimationEnd(dialog, undefined, { subtree: false });
    } catch (error) {
      // Ignore animation errors - continue with closing
      console.warn('QuickAddDialog: Animation end error (ignored):', error);
    }

    // Check if personalise dialog is still open - if so, don't reset body styles
    // This fixes the overlay issue where body styles weren't being reset properly
    const personaliseDialog = document.querySelector('personalise-dialog');
    const personaliseIsOpen = personaliseDialog && 
                               (personaliseDialog.refs?.dialog?.open || 
                                personaliseDialog.querySelector('dialog')?.open);
    
    // Only reset body styles if personalise dialog is also closed
    if (!personaliseIsOpen) {
      document.body.style.width = '';
      document.body.style.position = '';
      document.body.style.top = '';
      window.scrollTo({ top: this.#previousScrollY || 0, behavior: 'instant' });
    }

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
