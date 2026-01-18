import { DialogComponent } from '@theme/dialog';

/**
 * A custom element that manages the size guide modal.
 *
 * @extends DialogComponent
 */
export class SizeGuideDialogComponent extends DialogComponent {
  requiredRefs = ['dialog', 'closeButton'];

  connectedCallback() {
    super.connectedCallback();
    
    // Set up click handler for size guide buttons using event delegation
    // This ensures it works even if buttons are dynamically added
    this.#ensureClickListener();
  }

  /**
   * Ensures the click listener is attached to document
   * This must be called globally, not just when dialog element exists
   * @private
   */
  #ensureClickListener() {
    if (!document.hasSizeGuideListener) {
      document.addEventListener('click', this.#handleSizeGuideButtonClick, true);
      document.hasSizeGuideListener = true;
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    // Note: We don't remove the listener on disconnect since it's shared
    // This is acceptable for event delegation patterns
  }

  /**
   * Handles clicks on size guide buttons
   * @param {Event} event - The click event
   * @private
   */
  #handleSizeGuideButtonClick = (event) => {
    const button = event.target.closest('[data-size-guide-button]');
    if (!button) return;

    // Check if this button is inside a quick add modal - if so, prevent the quick add modal from closing
    const quickAddModal = button.closest('.quick-add-modal') || 
                          button.closest('#quick-add-modal-content') ||
                          button.closest('quick-add-dialog');
    
    if (quickAddModal) {
      // Mark the event so the quick add dialog knows not to close
      event.sizeGuideButtonClick = true;
    }

    // Prevent default action
    event.preventDefault();
    
    // Stop propagation early to prevent other handlers from interfering
    event.stopPropagation();
    event.stopImmediatePropagation();

    // Find the size guide dialog instance or create it if it doesn't exist
    let dialogElement = document.querySelector('size-guide-dialog');
    
    if (dialogElement) {
      // Dialog exists, try to open it
      this.#openSizeGuideDialog(dialogElement);
    } else {
      // Dialog doesn't exist - create it dynamically (e.g., when using quick add from collection page)
      this.#createSizeGuideDialogFromQuickAdd(button);
    }
  };

  /**
   * Opens the size guide dialog
   * @param {HTMLElement} dialogElement - The dialog element to open
   * @private
   */
  #openSizeGuideDialog(dialogElement) {
    try {
      // Check if refs are available
      if (dialogElement.refs && dialogElement.refs.dialog) {
        dialogElement.showDialog();
      } else if (dialogElement.showDialog && typeof dialogElement.showDialog === 'function') {
        // If showDialog method exists but refs aren't ready, try calling it anyway
        dialogElement.showDialog();
      } else {
        // Wait for custom element to be fully initialized
        customElements.whenDefined('size-guide-dialog').then(() => {
          if (dialogElement && dialogElement.showDialog && typeof dialogElement.showDialog === 'function') {
            dialogElement.showDialog();
          }
        });
      }
      } catch (error) {
        // Silently handle errors
      }
  }

  /**
   * Creates a size guide dialog dynamically when using quick add from collection pages
   * @param {HTMLElement} button - The size guide button that was clicked
   * @private
   */
  #createSizeGuideDialogFromQuickAdd(button) {
    // Try to find the product URL from various sources
    let productUrl = null;

    // Method 1: Try to get URL from quick add component (most reliable)
    // Walk up the DOM to find quick-add-component
    let currentElement = button;
    let quickAddComponent = null;
    while (currentElement && currentElement !== document.body) {
      if (currentElement.tagName && currentElement.tagName.toLowerCase() === 'quick-add-component') {
        quickAddComponent = currentElement;
        break;
      }
      currentElement = currentElement.parentElement;
    }

    if (quickAddComponent) {
      // Try to access the productPageUrl getter property
        try {
          const url = quickAddComponent.productPageUrl;
          if (url) {
            productUrl = url;
          }
        } catch (e) {
          // Property access might throw, continue to other methods
        }
    }

    // Method 2: Try to get URL from quick add content (view product link)
    if (!productUrl) {
      const quickAddContent = button.closest('#quick-add-modal-content');
      if (quickAddContent) {
        const viewProductLink = quickAddContent.querySelector('.view-product-title a, a[href*="/products/"]');
        if (viewProductLink) {
          productUrl = viewProductLink.href;
        }
      }
    }

    // Method 3: Try to get URL from product card (if available)
    if (!productUrl) {
      const productCard = button.closest('product-card');
      if (productCard) {
        const productLink = productCard.querySelector('a[href*="/products/"]');
        if (productLink) {
          productUrl = productLink.href;
        }
      }
    }

    if (!productUrl) {
      return;
    }

    // Remove variant parameter if present to get base product URL
    try {
      const url = new URL(productUrl, window.location.origin);
      url.searchParams.delete('variant');
      productUrl = url.toString();
    } catch (error) {
      return;
    }

    // Fetch the product page to get the size guide modal HTML
    fetch(productUrl)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.text();
      })
      .then(html => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const sizeGuideDialog = doc.querySelector('size-guide-dialog');
        
        if (!sizeGuideDialog) {
          return;
        }

        // Check if dialog already exists (in case it was created in another request)
        let existingDialog = document.querySelector('size-guide-dialog');
        if (existingDialog) {
          // If it exists but has no dialog refs, remove it first
          if (!existingDialog.refs || !existingDialog.refs.dialog) {
            existingDialog.remove();
            existingDialog = null;
          } else {
            // Dialog exists and is ready, just open it
            this.#openSizeGuideDialog(existingDialog);
            return;
          }
        }

        // Create new dialog if it doesn't exist or wasn't properly initialized
        if (!existingDialog) {
          // Clone and append to body
          const clonedDialog = sizeGuideDialog.cloneNode(true);
          document.body.appendChild(clonedDialog);
          
          // Wait for custom element to initialize, then open
          customElements.whenDefined('size-guide-dialog').then(() => {
            const dialogElement = document.querySelector('size-guide-dialog');
            if (dialogElement) {
              // Use setTimeout to ensure DOM and refs are ready
              setTimeout(() => {
                this.#openSizeGuideDialog(dialogElement);
              }, 150);
            }
          });
        }
      })
      .catch(() => {
        // Silently handle fetch errors
      });
  }
}

customElements.define('size-guide-dialog', SizeGuideDialogComponent);

// Ensure the click listener is attached immediately when the script loads
// This is necessary because the size guide dialog element may not exist on all pages (e.g., collection pages)
// But we still need the listener to handle size guide buttons in quick add popups
if (!document.hasSizeGuideListener) {
  // Create a temporary instance just to get access to the handler method
  // We'll use a function reference instead
  const handleSizeGuideButtonClick = (event) => {
    const button = event.target.closest('[data-size-guide-button]');
    if (!button) return;

    // Check if this button is inside a quick add modal - if so, prevent the quick add modal from closing
    const quickAddModal = button.closest('.quick-add-modal') || 
                          button.closest('#quick-add-modal-content') ||
                          button.closest('quick-add-dialog');
    
    if (quickAddModal) {
      // Mark the event so the quick add dialog knows not to close
      event.sizeGuideButtonClick = true;
    }

    // Prevent default action
    event.preventDefault();
    
    // Stop propagation early to prevent other handlers from interfering
    event.stopPropagation();
    event.stopImmediatePropagation();

    // Find the size guide dialog instance or create it if it doesn't exist
    let dialogElement = document.querySelector('size-guide-dialog');
    
    if (dialogElement) {
      // Dialog exists, try to open it
      if (dialogElement.refs && dialogElement.refs.dialog) {
        dialogElement.showDialog();
      } else if (dialogElement.showDialog && typeof dialogElement.showDialog === 'function') {
        dialogElement.showDialog();
      }
    } else {
      // Dialog doesn't exist - create it dynamically (e.g., when using quick add from collection page)
      
      // Try to find the product URL from various sources
      let productUrl = null;

      // Method 1: Try to get URL from quick add component (most reliable)
      let currentElement = button;
      let quickAddComponent = null;
      while (currentElement && currentElement !== document.body) {
        if (currentElement.tagName && currentElement.tagName.toLowerCase() === 'quick-add-component') {
          quickAddComponent = currentElement;
          break;
        }
        currentElement = currentElement.parentElement;
      }

      if (quickAddComponent) {
        try {
          const url = quickAddComponent.productPageUrl;
          if (url) {
            productUrl = url;
          }
        } catch (e) {
          // Property access might throw, continue to other methods
        }
      }

      // Method 2: Try to get URL from quick add content
      if (!productUrl) {
        const quickAddContent = button.closest('#quick-add-modal-content');
        if (quickAddContent) {
          const viewProductLink = quickAddContent.querySelector('.view-product-title a, a[href*="/products/"]');
          if (viewProductLink) {
            productUrl = viewProductLink.href;
          }
        }
      }

      // Method 3: Try to get URL from product card
      if (!productUrl) {
        const productCard = button.closest('product-card');
        if (productCard) {
          const productLink = productCard.querySelector('a[href*="/products/"]');
          if (productLink) {
            productUrl = productLink.href;
          }
        }
      }

      if (!productUrl) {
        return;
      }

      // Remove variant parameter if present
      try {
        const url = new URL(productUrl, window.location.origin);
        url.searchParams.delete('variant');
        productUrl = url.toString();
      } catch (error) {
        return;
      }

      // Fetch the product page to get the size guide modal HTML
      fetch(productUrl)
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.text();
        })
        .then(html => {
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          const sizeGuideDialog = doc.querySelector('size-guide-dialog');
          
          if (!sizeGuideDialog) {
            return;
          }

          // Check if dialog already exists
          let existingDialog = document.querySelector('size-guide-dialog');
          if (existingDialog) {
            if (!existingDialog.refs || !existingDialog.refs.dialog) {
              existingDialog.remove();
              existingDialog = null;
            } else {
              // Dialog exists and is ready, just open it
              if (existingDialog.showDialog) {
                existingDialog.showDialog();
              }
              return;
            }
          }

          // Create new dialog if it doesn't exist
          if (!existingDialog) {
            const clonedDialog = sizeGuideDialog.cloneNode(true);
            document.body.appendChild(clonedDialog);
            
            // Wait for custom element to initialize, then open
            customElements.whenDefined('size-guide-dialog').then(() => {
              const dialogElement = document.querySelector('size-guide-dialog');
              if (dialogElement) {
                setTimeout(() => {
                  if (dialogElement.showDialog) {
                    dialogElement.showDialog();
                  }
                }, 150);
              }
            });
          }
        })
        .catch(() => {
          // Silently handle fetch errors
        });
    }
  };

  document.addEventListener('click', handleSizeGuideButtonClick, true);
  document.hasSizeGuideListener = true;
}
