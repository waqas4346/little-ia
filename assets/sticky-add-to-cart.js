import { Component } from '@theme/component';
import { ThemeEvents, QuantitySelectorUpdateEvent } from '@theme/events';
import { morph } from '@theme/morph';
import { onAnimationEnd } from '@theme/utilities';

/**
 * @typedef {Object} ProductVariant
 * @property {string|number} [id] - Variant ID
 * @property {string} [title] - Variant title
 * @property {string} [name] - Variant name
 * @property {boolean} [available] - Whether variant is available
 * @property {Object} [featured_media] - Featured media object
 * @property {Object} [featured_media.preview_image] - Preview image data
 * @property {string} [featured_media.preview_image.src] - Image source URL
 * @property {string} [featured_media.alt] - Alt text for the image
 */

/**
 * @typedef {HTMLElement & {
 *   source: Element,
 *   destination: Element,
 *   useSourceSize: string | boolean
 * }} FlyToCart
 */

/**
 * @typedef {Object} StickyAddToCartRefs
 * @property {HTMLElement} stickyBar - The floating bar container
 * @property {HTMLButtonElement} addToCartButton - Sticky bar's button
 * @property {HTMLElement} quantityDisplay - Quantity display container
 * @property {HTMLElement} quantityNumber - Quantity number element
 * @property {HTMLImageElement} productImage - Product image element
 */

/**
 * A custom element that manages a sticky add-to-cart bar.
 * Shows when the main buy buttons scroll out of view.
 *
 * @extends {Component<StickyAddToCartRefs>}
 */
class StickyAddToCartComponent extends Component {
  requiredRefs = ['stickyBar', 'addToCartButton', 'quantityDisplay', 'quantityNumber'];

  /** @type {IntersectionObserver | null} */
  #buyButtonsIntersectionObserver = null;

  /** @type {IntersectionObserver | null} */
  #mainBottomObserver = null;

  /** @type {number | undefined} */
  #resetTimeout;

  /** @type {boolean} */
  #isStuck = false;

  /** @type {number | null} */
  #animationTimeout = null;

  /** @type {AbortController} */
  #abortController = new AbortController();

  /** @type {HTMLButtonElement | null} */
  #targetAddToCartButton = null;

  /** @type {number} */
  #currentQuantity = 1;

  /** @type {boolean} */
  #hiddenByBottom = false;

  connectedCallback() {
    super.connectedCallback();

    // Set up intersection observer - with retry if it fails
    try {
      this.#setupIntersectionObserver();
    } catch (error) {
      console.warn('Sticky add to cart: Failed to set up intersection observer, retrying...', error);
      // Retry after a short delay
      setTimeout(() => {
        try {
          this.#setupIntersectionObserver();
        } catch (retryError) {
          console.error('Sticky add to cart: Failed to set up intersection observer after retry', retryError);
          // Fallback: use scroll listener if intersection observer fails
          this.#setupScrollFallback();
        }
      }, 500);
    }

    // Also set up a scroll fallback as backup
    this.#setupScrollFallback();

    const { signal } = this.#abortController;
    const target = this.closest('.shopify-section');
    target?.addEventListener(ThemeEvents.variantUpdate, this.#handleVariantUpdate, { signal });
    target?.addEventListener(ThemeEvents.variantSelected, this.#handleVariantSelected, { signal });

    document.addEventListener(ThemeEvents.cartUpdate, this.#handleCartAddComplete, { signal });
    document.addEventListener(ThemeEvents.cartError, this.#handleCartAddComplete, { signal });
    document.addEventListener(ThemeEvents.quantitySelectorUpdate, this.#handleQuantityUpdate, { signal });

    this.#getInitialQuantity();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#buyButtonsIntersectionObserver?.disconnect();
    this.#mainBottomObserver?.disconnect();
    this.#abortController.abort();
    if (this.#animationTimeout) {
      clearTimeout(this.#animationTimeout);
    }
  }

  /**
   * Sets up the IntersectionObserver to watch the buy buttons visibility
   */
  #setupIntersectionObserver() {
    const productForm = this.#getProductForm();
    if (!productForm) {
      console.warn('Sticky add to cart: Product form not found');
      return;
    }

    // Try to find buy-buttons-block - it could be a parent of product-form or in the same section
    let buyButtonsBlock = productForm.closest('.buy-buttons-block');
    if (!buyButtonsBlock) {
      // Fallback: search within the same section
      const sectionElement = this.closest('.shopify-section');
      if (sectionElement) {
        buyButtonsBlock = sectionElement.querySelector('.buy-buttons-block');
      }
    }
    if (!buyButtonsBlock) {
      console.warn('Sticky add to cart: Buy buttons block not found');
      return;
    }

    // Observer for buy buttons visibility
    this.#buyButtonsIntersectionObserver = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (!entry) return;

      // Only show sticky bar if buy buttons have been scrolled past (above viewport)
      if (!entry.isIntersecting && !this.#isStuck) {
        // Check if the element is above the viewport (scrolled past) or below (not yet reached)
        const rect = entry.target.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top < 0) {
          // Element is above viewport - show sticky bar
          this.#showStickyBar();
        }
        // If rect.top >= 0, element is below viewport - don't show sticky bar yet
      } else if (entry.isIntersecting && this.#isStuck) {
        this.#hiddenByBottom = false;
        this.#hideStickyBar();
      }
    }, {
      rootMargin: '0px',
      threshold: 0
    });

    // Observer for footer visibility - disabled to keep sticky bar visible even when footer appears
    // this.#mainBottomObserver = new IntersectionObserver(
    //   (entries) => {
    //     const [entry] = entries;
    //     if (!entry) return;

    //     if (entry.isIntersecting && this.#isStuck) {
    //       this.#hiddenByBottom = true;
    //       this.#hideStickyBar();
    //     } else if (!entry.isIntersecting && this.#hiddenByBottom) {
    //       // Footer out of view - check if we should show sticky bar again
    //       const rect = buyButtonsBlock.getBoundingClientRect();
    //       // Only show if buy buttons are above the viewport (scrolled past)
    //       if (rect.bottom < 0 || rect.top < 0) {
    //         this.#hiddenByBottom = false;
    //         this.#showStickyBar();
    //       }
    //     }
    //   },
    //   {
    //     rootMargin: '200px 0px 0px 0px',
    //   }
    // );

    this.#buyButtonsIntersectionObserver.observe(buyButtonsBlock);
    // this.#mainBottomObserver.observe(footer);
    
    // Find the target add to cart button - try multiple selectors
    this.#targetAddToCartButton = productForm.querySelector('[ref="addToCartButton"]') ||
                                   productForm.querySelector('add-to-cart-component [ref="addToCartButton"]') ||
                                   productForm.querySelector('.add-to-cart-button');

    // Check initial state - if buy buttons are already out of view, show sticky bar immediately
    const rect = buyButtonsBlock.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top < 0) {
      this.#showStickyBar();
    } else {
      // Also check after a short delay in case the page is still loading
      setTimeout(() => {
        const rectAfterDelay = buyButtonsBlock.getBoundingClientRect();
        if (rectAfterDelay.bottom < 0 || rectAfterDelay.top < 0) {
          this.#showStickyBar();
        }
      }, 100);
    }
  }

  // Public action handlers
  /**
   * Handles the add to cart button click in the sticky bar
   */
  handleAddToCartClick = async () => {
    // First check if the sticky button itself is disabled
    if (this.refs.addToCartButton.disabled) {
      return;
    }
    
    // Get the form to check if we can submit
    const productForm = this.#getProductForm();
    const form = productForm?.querySelector('form');
    
    if (!form) return;
    
    // Check form validity before proceeding
    if (!form.checkValidity()) {
      // Show validation message if form is invalid
      form.reportValidity();
      return;
    }
    
    // If target button exists and is enabled, use it (for animations)
    if (this.#targetAddToCartButton && !this.#targetAddToCartButton.disabled) {
      this.#targetAddToCartButton.dataset.puppet = 'true';
      // Try clicking the button first (this triggers animations and form submission)
      this.#targetAddToCartButton.click();
      
      // If clicking didn't work, submit the form directly as fallback
      setTimeout(() => {
        // Check if form was already submitted by checking if button still has puppet flag
        if (this.#targetAddToCartButton && this.#targetAddToCartButton.dataset.puppet === 'true') {
          // Form might not have submitted, try submitting directly
          form.requestSubmit();
        }
      }, 100);
    } else {
      // Target button doesn't exist or is disabled, submit form directly
      // This ensures the form submits even if the main button is disabled
      form.requestSubmit();
    }
    const cartIcon = document.querySelector('.header-actions__cart-icon');

    if (this.refs.addToCartButton.dataset.added !== 'true') {
      this.refs.addToCartButton.dataset.added = 'true';
    }

    if (!cartIcon || !this.refs.addToCartButton || !this.refs.productImage) return;
    if (this.#resetTimeout) clearTimeout(this.#resetTimeout);

    const flyToCartElement = /** @type {FlyToCart} */ (document.createElement('fly-to-cart'));
    const sourceStyles = getComputedStyle(this.refs.productImage);

    flyToCartElement.classList.add('fly-to-cart--sticky');
    flyToCartElement.style.setProperty('background-image', `url(${this.refs.productImage.src})`);
    flyToCartElement.useSourceSize = 'true';
    flyToCartElement.source = this.refs.productImage;
    flyToCartElement.destination = cartIcon;

    document.body.appendChild(flyToCartElement);

    await onAnimationEnd([this.refs.addToCartButton, flyToCartElement]);
    this.#resetTimeout = setTimeout(() => {
      this.refs.addToCartButton.removeAttribute('data-added');
    }, 800);
  };

  /**
   * Handles variant update events
   * @param {CustomEvent} event - The variant update event
   */
  #handleVariantUpdate = (event) => {
    if (event.detail.data.productId !== this.dataset.productId) return;

    const variant = event.detail.resource;

    // Get the new sticky add to cart HTML from the server response
    const newStickyAddToCart = event.detail.data.html.querySelector('sticky-add-to-cart');
    if (!newStickyAddToCart) return;

    const newStickyBar = newStickyAddToCart.querySelector('[ref="stickyBar"]');
    if (!newStickyBar) return;

    // Store current visibility state before morphing
    const currentStuck = this.refs.stickyBar.getAttribute('data-stuck') || 'false';
    const variantAvailable = newStickyAddToCart.dataset.variantAvailable;

    // Morph the entire sticky bar content
    morph(this.refs.stickyBar, newStickyBar, { childrenOnly: true });

    // Restore visibility state after morphing
    this.refs.stickyBar.setAttribute('data-stuck', currentStuck);
    this.dataset.variantAvailable = variantAvailable;

    // Update the dataset attributes with new variant info
    if (variant && variant.id) {
      this.dataset.currentVariantId = variant.id;
    }

    // Re-cache the target add to cart button after morphing
    const productForm = this.#getProductForm();
    if (productForm) {
      this.#targetAddToCartButton = productForm.querySelector('[ref="addToCartButton"]');
    }

    if (variant == null) {
      this.#handleVariantUnavailable();
    }
    // Restore the current quantity display if needed
    this.#updateButtonText();
    
    // Update personalization button text after variant change
    // Wait a bit for DOM to settle after morphing
    setTimeout(() => {
      if (window.updatePersonaliseButtonText) {
        // Get the form to pass to the update function
        const productForm = this.#getProductForm();
        const form = productForm?.querySelector('form[data-type="add-to-cart-form"]');
        window.updatePersonaliseButtonText(form);
        
        // Also update add to cart button state after updating personalization button
        // This ensures the button is disabled if personalization is present but not confirmed
        if (window.updateAddToCartButtonState) {
          setTimeout(() => {
            window.updateAddToCartButtonState();
          }, 50);
        }
      }
    }, 100);
  };

  /**
   * Handles variant selected events
   * @param {CustomEvent} event - The variant selected event
   */
  #handleVariantSelected = (event) => {
    // The variant update event will follow and handle all updates via morph
    // We just update the dataset here for tracking
    const variantId = event.detail.resource?.id;
    if (!variantId) return;
    this.dataset.currentVariantId = variantId;
  };

  /**
   * Updates the variant title based on selected options when the variant is unavailable
   */
  #handleVariantUnavailable = () => {
    this.dataset.currentVariantId = '';
    const variantTitleElement = this.querySelector('.sticky-add-to-cart__variant');
    const productId = this.dataset.productId;
    const variantPicker = document.querySelector(`variant-picker[data-product-id="${productId}"]`);
    if (!variantTitleElement || !variantPicker) return;

    const selectedOptions = Array.from(variantPicker.querySelectorAll('input:checked'))
      .map((option) => /** @type {HTMLInputElement} */ (option).value)
      .filter((value) => value !== '')
      .join(' / ');
    if (!selectedOptions) return;
    variantTitleElement.textContent = selectedOptions;
  };

  /**
   * Handles cart add complete (success or error) - resets puppet flag
   * @param {CustomEvent} _event - The cart event (unused)
   */
  #handleCartAddComplete = (_event) => {
    // Reset the puppet flag after cart operation
    if (this.#targetAddToCartButton) {
      this.#targetAddToCartButton.dataset.puppet = 'false';
    }
  };

  /**
   * Handles quantity selector update events
   * @param {QuantitySelectorUpdateEvent} event - The quantity update event
   */
  #handleQuantityUpdate = (event) => {
    // Only respond to product page quantity selector updates, not cart drawer
    if (event.detail.cartLine) return;

    this.#currentQuantity = event.detail.quantity;
    this.#updateButtonText();
  };

  /**
   * Sets up a scroll-based fallback to show/hide sticky bar
   */
  #setupScrollFallback() {
    const { signal } = this.#abortController;
    let scrollTimeout;
    
    const handleScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const productForm = this.#getProductForm();
        if (!productForm) return;
        
        // Try to find buy-buttons-block
        let buyButtonsBlock = productForm.closest('.buy-buttons-block');
        if (!buyButtonsBlock) {
          const sectionElement = this.closest('.shopify-section');
          if (sectionElement) {
            buyButtonsBlock = sectionElement.querySelector('.buy-buttons-block');
          }
        }
        
        if (buyButtonsBlock) {
          const rect = buyButtonsBlock.getBoundingClientRect();
          if (rect.bottom < 0 || rect.top < 0) {
            // Buy buttons are out of view, show sticky bar
            if (!this.#isStuck) {
              this.#showStickyBar();
            }
          } else if (rect.top >= 0 && rect.bottom <= window.innerHeight) {
            // Buy buttons are in view, hide sticky bar
            if (this.#isStuck) {
              this.#hideStickyBar();
            }
          }
        }
      }, 50);
    };
    
    window.addEventListener('scroll', handleScroll, { signal, passive: true });
    // Check initial state
    handleScroll();
  }

  /**
   * Shows the sticky bar with animation
   */
  #showStickyBar() {
    const { stickyBar } = this.refs;
    if (!stickyBar) return;
    this.#isStuck = true;
    stickyBar.dataset.stuck = 'true';
  }

  /**
   * Hides the sticky bar with animation
   */
  #hideStickyBar() {
    const { stickyBar } = this.refs;
    this.#isStuck = false;
    stickyBar.dataset.stuck = 'false';
  }

  // Helper methods
  /**
   * Gets the product form element
   * @returns {HTMLElement | null}
   */
  #getProductForm() {
    const productId = this.dataset.productId;
    if (!productId) {
      console.warn('Sticky add to cart: No product ID found on sticky-add-to-cart element');
      return null;
    }

    const sectionElement = this.closest('.shopify-section');
    if (!sectionElement) {
      console.warn('Sticky add to cart: No section element found');
      return null;
    }

    const sectionId = sectionElement.id.replace('shopify-section-', '');
    
    // Try multiple selectors to find the product form
    let productForm = document.querySelector(
      `#shopify-section-${sectionId} product-form-component[data-product-id="${productId}"]`
    );
    
    // Fallback: search without section ID
    if (!productForm) {
      productForm = document.querySelector(
        `product-form-component[data-product-id="${productId}"]`
      );
    }
    
    // Another fallback: search within the section
    if (!productForm) {
      productForm = sectionElement.querySelector(
        `product-form-component[data-product-id="${productId}"]`
      );
    }
    
    if (!productForm) {
      console.warn('Sticky add to cart: Product form component not found', {
        productId,
        sectionId,
        sectionElement: sectionElement.id
      });
    }
    
    return productForm;
  }

  /**
   * Gets the initial quantity from the data attribute
   */
  #getInitialQuantity() {
    this.#currentQuantity = parseInt(this.dataset.initialQuantity || '1') || 1;
    this.#updateButtonText();
  }

  /**
   * Updates the button text to include quantity
   */
  #updateButtonText() {
    const { addToCartButton, quantityDisplay, quantityNumber } = this.refs;

    const available = !addToCartButton.disabled;

    // Update the quantity number
    quantityNumber.textContent = this.#currentQuantity.toString();

    // Show/hide the quantity display based on availability and quantity
    if (available && this.#currentQuantity > 1) {
      quantityDisplay.style.display = 'inline';
    } else {
      quantityDisplay.style.display = 'none';
    }
  }
}

if (!customElements.get('sticky-add-to-cart')) {
  customElements.define('sticky-add-to-cart', StickyAddToCartComponent);
}
