import { Component } from '@theme/component';
import { ThemeEvents, CartAddEvent } from '@theme/events';
import { fetchConfig } from '@theme/utilities';
import { sectionRenderer } from '@theme/section-renderer';

/**
 * Component for managing the build-your-set sticky bar
 */
export class BuildYourSetStickyBarComponent extends Component {
  requiredRefs = ['productsContainer', 'startOverButton', 'personaliseAllButton', 'addAllButton', 'totalPrice'];
  
  /** @type {boolean} */
  #isAddingToCart = false;

  connectedCallback() {
    super.connectedCallback();
    
    // Keep sticky bar hidden by default - only show if session has items
    // Don't check session immediately, wait for session clearing to complete
    // The session is cleared in DOMContentLoaded, so wait for that
    
    // Wait for DOMContentLoaded to complete (session clearing happens there)
    const initStickyBar = () => {
      // Check session - only show if items exist
      const sessionCart = this.getSessionCart();
      
      // If no items, ensure it stays hidden
      if (!sessionCart || sessionCart.length === 0) {
        this.style.display = 'none';
        this.style.visibility = 'hidden';
        this.setAttribute('hidden', '');
      } else {
        // Only show if we have items
        this.updateDisplay();
      }
      
      // Set up event listeners
      const updateHandler = () => {
        console.log('Build Your Set: Sticky bar received update event');
        this.updateDisplay();
      };
      document.addEventListener('build-your-set-updated', updateHandler);
      
      const clearedHandler = () => {
        console.log('Build Your Set: Sticky bar received cleared event');
        this.updateDisplay();
      };
      document.addEventListener('build-your-set-cleared', clearedHandler);
      
      // Listen for personalization saved events to update session
      const personalizationSavedHandler = (event) => {
        const personalisation = event.detail || {};
        const productId = personalisation.productId || this._pendingPersonalizationProductId;
        const index = this._pendingPersonalizationIndex;
        
        if (typeof index === 'number' && productId) {
          // Convert personalisation object to the format stored in session
          const personalizations = {};
          if (personalisation.name) personalizations['personalise-name'] = personalisation.name;
          if (personalisation.font) personalizations['personalise-font'] = personalisation.font;
          if (personalisation.color) personalizations['personalise-color'] = personalisation.color;
          if (personalisation.dob) personalizations['properties[Date of Birth]'] = personalisation.dob;
          if (personalisation.schoolYear) personalizations['properties[School Year]'] = personalisation.schoolYear;
          if (personalisation.name1) personalizations['properties[Name 1]'] = personalisation.name1;
          if (personalisation.name2) personalizations['properties[Name 2]'] = personalisation.name2;
          if (personalisation.name3) personalizations['properties[Name 3]'] = personalisation.name3;
          if (personalisation.name4) personalizations['properties[Name 4]'] = personalisation.name4;
          if (personalisation.textbox) personalizations['properties[Personalisation:]'] = personalisation.textbox;
          if (personalisation.message) personalizations['properties[Message]'] = personalisation.message;
          if (personalisation.babyName) personalizations["properties[Baby's Name]"] = personalisation.babyName;
          if (personalisation.kidName) personalizations["properties[Kid's Name]"] = personalisation.kidName;
          if (personalisation.mumName) personalizations["properties[Mum's Name]"] = personalisation.mumName;
          
          console.log('Build Your Set: Personalization saved, updating session', { productId, index, personalizations });
          this.updateProductPersonalization(index, personalizations);
          
          // Clear pending personalization data
          this._pendingPersonalizationProductId = null;
          this._pendingPersonalizationIndex = null;
        }
      };
      document.addEventListener('personalisation-saved', personalizationSavedHandler);
      
      // Store handlers for cleanup
      this._updateHandler = updateHandler;
      this._clearedHandler = clearedHandler;
      this._personalizationSavedHandler = personalizationSavedHandler;
      
      // Set up button handlers
      if (this.refs.startOverButton) {
        // Remove any existing handler to prevent duplicates
        if (this.refs.startOverButton._clickHandler) {
          this.refs.startOverButton.removeEventListener('click', this.refs.startOverButton._clickHandler);
        }
        const startOverHandler = this.handleStartOver.bind(this);
        this.refs.startOverButton.addEventListener('click', startOverHandler);
        this.refs.startOverButton._clickHandler = startOverHandler;
      }
      if (this.refs.personaliseAllButton) {
        // Remove any existing handler to prevent duplicates
        if (this.refs.personaliseAllButton._clickHandler) {
          this.refs.personaliseAllButton.removeEventListener('click', this.refs.personaliseAllButton._clickHandler);
        }
        const personaliseAllHandler = (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.handlePersonaliseAll();
        };
        this.refs.personaliseAllButton.addEventListener('click', personaliseAllHandler);
        this.refs.personaliseAllButton._clickHandler = personaliseAllHandler;
      }
      if (this.refs.addAllButton) {
        // Remove any existing handler to prevent duplicates
        if (this.refs.addAllButton._clickHandler) {
          this.refs.addAllButton.removeEventListener('click', this.refs.addAllButton._clickHandler);
        }
        const addAllHandler = (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.handleAddAllToCart();
        };
        this.refs.addAllButton.addEventListener('click', addAllHandler);
        this.refs.addAllButton._clickHandler = addAllHandler;
      }
    };
    
    // Wait for DOMContentLoaded to finish (where session is cleared)
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        // Wait a bit more to ensure session clearing script has run
        setTimeout(initStickyBar, 100);
      });
    } else {
      // DOMContentLoaded already fired, wait a bit then check
      setTimeout(initStickyBar, 100);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._updateHandler) {
      document.removeEventListener('build-your-set-updated', this._updateHandler);
    }
    if (this._clearedHandler) {
      document.removeEventListener('build-your-set-cleared', this._clearedHandler);
    }
    if (this._personalizationSavedHandler) {
      document.removeEventListener('personalisation-saved', this._personalizationSavedHandler);
    }
  }

  /**
   * Updates the sticky bar display
   */
  updateDisplay() {
    // Ensure refs are ready
    if (!this.refs.productsContainer) {
      console.warn('Build Your Set: Products container not ready, retrying...');
      setTimeout(() => this.updateDisplay(), 100);
      return;
    }
    
    const sessionCart = this.getSessionCart();
    console.log('Build Your Set: Updating sticky bar display', { itemCount: sessionCart.length });
    
    // Always check if session is empty first - don't show if empty
    if (!sessionCart || sessionCart.length === 0) {
      // Force hide the sticky bar immediately with all methods
      this.style.setProperty('display', 'none', 'important');
      this.style.setProperty('visibility', 'hidden', 'important');
      this.style.setProperty('opacity', '0', 'important');
      this.style.setProperty('pointer-events', 'none', 'important');
      this.setAttribute('hidden', '');
      
      // Clear the products container
      if (this.refs.productsContainer) {
        this.refs.productsContainer.innerHTML = '';
      }
      if (this.refs.totalPrice) {
        this.refs.totalPrice.textContent = '';
      }
      return;
    }

    // Only show if we have items in session - remove all hiding styles
    this.removeAttribute('hidden');
    this.style.setProperty('display', 'flex', 'important');
    this.style.setProperty('visibility', 'visible', 'important');
    this.style.setProperty('opacity', '1', 'important');
    this.style.setProperty('pointer-events', 'auto', 'important');
    
    this.renderProducts(sessionCart);
    this.updateTotalPrice(sessionCart);
  }

  /**
   * Gets products from sessionStorage
   * @returns {Array} Array of product items
   */
  getSessionCart() {
    const storageKey = 'build-your-set-session-cart';
    const sessionCartJson = sessionStorage.getItem(storageKey);
    if (!sessionCartJson) return [];

    try {
      return JSON.parse(sessionCartJson);
    } catch (e) {
      console.error('Build Your Set: Error parsing session cart:', e);
      return [];
    }
  }

  /**
   * Renders products in the sticky bar
   * @param {Array} sessionCart - Array of product items
   */
  renderProducts(sessionCart) {
    if (!this.refs.productsContainer) return;

    this.refs.productsContainer.innerHTML = '';

    sessionCart.forEach((item, index) => {
      const productElement = document.createElement('div');
      productElement.className = 'build-your-set-sticky-bar__product';
      productElement.dataset.productIndex = index;

      // Build personalisation text - only values separated by |
      let personalisationText = '';
      const hasPersonalizations = item.personalizations && Object.keys(item.personalizations).length > 0;
      if (hasPersonalizations) {
        const parts = [];
        const personalizations = item.personalizations;
        
        // Iterate through all personalization keys and collect only values
        Object.keys(personalizations).forEach(key => {
          const value = personalizations[key];
          if (value && value.toString().trim() && value !== 'null' && value !== 'undefined') {
            parts.push(value.toString().trim());
          }
        });
        
        personalisationText = parts.join(' | ');
      }

      const imageUrl = item.featured_image || (item.images && item.images[0]) || '';
      const productName = item.product_name || 'Product';
      const price = item.price || 'AED 0.00';
      const needsPersonalization = item.needs_personalization === true;
      const showAddPersonalizationButton = needsPersonalization && !hasPersonalizations;
      const showEditButton = hasPersonalizations && needsPersonalization;

      productElement.innerHTML = `
        <button class="build-your-set-sticky-bar__product-remove" data-product-index="${index}" aria-label="Remove ${productName} from set">
          <svg class="build-your-set-sticky-bar__product-remove-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
        <img src="${imageUrl}" alt="${productName}" class="build-your-set-sticky-bar__product-image" loading="lazy" onerror="this.style.display='none'">
        <div class="build-your-set-sticky-bar__product-info">
          <h4 class="build-your-set-sticky-bar__product-name">${productName}</h4>
          <div class="build-your-set-sticky-bar__product-price">${price}</div>
          ${personalisationText ? `
            <div class="build-your-set-sticky-bar__product-personalisation">
              <span class="build-your-set-sticky-bar__personalisation-text">${personalisationText}</span>
              ${showEditButton ? `
                <button class="build-your-set-sticky-bar__product-edit-personalisation" data-product-index="${index}" data-product-id="${item.product_id}" data-variant-id="${item.variant_id}" aria-label="Edit personalization for ${productName}">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M11.3333 2.00004C11.5084 1.82493 11.7163 1.68605 11.9441 1.59129C12.1719 1.49652 12.4151 1.44775 12.6667 1.44775C12.9182 1.44775 13.1614 1.49652 13.3892 1.59129C13.617 1.68605 13.8249 1.82493 14 2.00004C14.1751 2.17515 14.314 2.38306 14.4087 2.61087C14.5035 2.83868 14.5523 3.08188 14.5523 3.33337C14.5523 3.58487 14.5035 3.82807 14.4087 4.05588C14.314 4.28369 14.1751 4.4916 14 4.66671L5.00001 13.6667L1.33334 14.6667L2.33334 11L11.3333 2.00004Z" stroke="#7295BB" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
              ` : ''}
            </div>
          ` : ''}
          ${showAddPersonalizationButton ? `
            <button class="build-your-set-sticky-bar__product-add-personalisation" data-product-index="${index}" data-product-id="${item.product_id}" data-variant-id="${item.variant_id}" aria-label="Add personalization for ${productName}">
              Add Personalization
            </button>
          ` : ''}
        </div>
      `;

      // Add click handler for remove button
      const removeButton = productElement.querySelector('.build-your-set-sticky-bar__product-remove');
      if (removeButton) {
        removeButton.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.removeProductFromSet(index);
        });
      }

      // Add click handler for add personalization button
      const addPersonalizationButton = productElement.querySelector('.build-your-set-sticky-bar__product-add-personalisation');
      if (addPersonalizationButton) {
        addPersonalizationButton.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.openPersonalizationForProduct(item, index);
        });
      }

      // Add click handler for edit personalization button
      const editPersonalizationButton = productElement.querySelector('.build-your-set-sticky-bar__product-edit-personalisation');
      if (editPersonalizationButton) {
        editPersonalizationButton.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.openPersonalizationForProduct(item, index);
        });
      }

      this.refs.productsContainer.appendChild(productElement);
    });
  }

  /**
   * Updates the total price display
   * @param {Array} sessionCart - Array of product items
   */
  updateTotalPrice(sessionCart) {
    if (!this.refs.totalPrice) return;

    // Calculate total (simplified - you may need to parse prices properly)
    let total = 0;
    sessionCart.forEach(item => {
      if (item.price_value) {
        total += item.price_value * (item.quantity || 1);
      }
    });

    if (total > 0) {
      // Format price (you may want to use a proper currency formatter)
      const formattedTotal = `AED ${total.toFixed(2)}`;
      this.refs.totalPrice.textContent = `(${formattedTotal})`;
    } else {
      this.refs.totalPrice.textContent = '';
    }
  }

  /**
   * Opens personalization modal for a product
   * @param {Object} item - Product item from session
   * @param {number} index - Index of the product in the session cart
   */
  async openPersonalizationForProduct(item, index) {
    const productId = item.product_id;
    const variantId = item.variant_id;

    if (!productId || !variantId) {
      console.error('Build Your Set: Missing product ID or variant ID for personalization');
      return;
    }

    console.log('Build Your Set: Opening personalization for product', { productId, variantId, item });

    try {
      // First check if element exists in DOM
      let personaliseDialogElement = document.getElementById('build-your-set-personalise-dialog');
      if (!personaliseDialogElement) {
        personaliseDialogElement = document.querySelector('build-your-set-personalise-dialog');
      }
      
      if (!personaliseDialogElement) {
        console.error('Build Your Set: Personalization dialog element not found in DOM');
        console.log('Build Your Set: Checking if snippet is rendered...');
        // Try waiting a bit and check again
        await new Promise(resolve => setTimeout(resolve, 500));
        personaliseDialogElement = document.getElementById('build-your-set-personalise-dialog') || 
                                   document.querySelector('build-your-set-personalise-dialog');
        if (!personaliseDialogElement) {
          console.error('Build Your Set: Personalization dialog still not found after waiting');
          return;
        }
      }
      
      console.log('Build Your Set: Found dialog element', personaliseDialogElement);
      
      // Wait for custom element to be defined
      await customElements.whenDefined('build-your-set-personalise-dialog');
      
      // Get the component instance
      let personaliseDialog = /** @type {any} */ (personaliseDialogElement);
      
      // Wait a bit more for component to initialize
      if (!personaliseDialog.refs || !personaliseDialog.refs.dialog) {
        console.log('Build Your Set: Component not fully initialized, waiting...');
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      console.log('Build Your Set: Dialog component ready', {
        hasRefs: !!personaliseDialog.refs,
        hasDialog: !!(personaliseDialog.refs && personaliseDialog.refs.dialog),
        hasOpenWithProduct: typeof personaliseDialog.openWithProduct === 'function'
      });
      
      // Open the dialog with product data
      if (typeof personaliseDialog.openWithProduct === 'function') {
        console.log('Build Your Set: Opening personalization modal with product data');
        personaliseDialog.openWithProduct(item, index);
      } else {
        console.error('Build Your Set: Personalization dialog does not have openWithProduct method', personaliseDialog);
        console.log('Build Your Set: Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(personaliseDialog)));
        console.log('Build Your Set: Component class:', personaliseDialog.constructor.name);
      }
    } catch (error) {
      console.error('Build Your Set: Error opening personalization modal:', error);
      console.error('Build Your Set: Error stack:', error.stack);
    }
  }

  /**
   * Updates personalization for a product in the session
   * @param {number} index - Index of the product in the session cart
   * @param {Object} personalizations - Personalization data
   */
  updateProductPersonalization(index, personalizations) {
    const sessionCart = this.getSessionCart();
    
    if (index < 0 || index >= sessionCart.length) {
      console.warn('Build Your Set: Invalid product index to update personalization', index);
      return;
    }

    // Update personalizations for the product
    sessionCart[index].personalizations = personalizations;

    // Save updated cart to session storage
    const storageKey = 'build-your-set-session-cart';
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(sessionCart));
      
      // Update display
      this.updateDisplay();

      // Dispatch event to notify other components
      document.dispatchEvent(new CustomEvent('build-your-set-updated', {
        bubbles: true,
        cancelable: true,
        detail: { productCount: sessionCart.length }
      }));
    } catch (error) {
      console.error('Build Your Set: Error updating product personalization:', error);
    }
  }

  /**
   * Removes a product from the set by index
   * @param {number} index - Index of the product to remove
   */
  removeProductFromSet(index) {
    const sessionCart = this.getSessionCart();
    
    if (index < 0 || index >= sessionCart.length) {
      console.warn('Build Your Set: Invalid product index to remove', index);
      return;
    }

    const removedProduct = sessionCart[index];
    console.log('Build Your Set: Removing product from set', {
      index,
      product_id: removedProduct?.product_id,
      variant_id: removedProduct?.variant_id
    });

    // Personalization is now stored in form inputs, no storage cleanup needed

    // Remove the product at the specified index
    sessionCart.splice(index, 1);

    // Save updated cart to session storage
    const storageKey = 'build-your-set-session-cart';
    try {
      if (sessionCart.length === 0) {
        // If cart is empty, remove the key entirely
        sessionStorage.removeItem(storageKey);
        // Hide sticky bar
        this.style.display = 'none';
        this.style.visibility = 'hidden';
        this.setAttribute('hidden', '');
      } else {
        sessionStorage.setItem(storageKey, JSON.stringify(sessionCart));
      }

      // Update display
      this.updateDisplay();

      // Dispatch event to notify other components
      document.dispatchEvent(new CustomEvent('build-your-set-updated', {
        bubbles: true,
        cancelable: true,
        detail: { productCount: sessionCart.length }
      }));
    } catch (error) {
      console.error('Build Your Set: Error removing product from session:', error);
    }
  }

  /**
   * Handles "Personalise All" button click
   * Opens personalization modal with union of all product tags
   */
  async handlePersonaliseAll() {
    const sessionCart = this.getSessionCart();
    if (!sessionCart || sessionCart.length === 0) {
      console.warn('Build Your Set: No products in bundle to personalise');
      return;
    }

    // Collect all products that need personalization
    const productsNeedingPersonalization = sessionCart.filter(item => item.needs_personalization === true);
    if (productsNeedingPersonalization.length === 0) {
      console.warn('Build Your Set: No products in bundle need personalization');
      return;
    }

    // Collect union of all product tags
    const allTagsSet = new Set();
    productsNeedingPersonalization.forEach(product => {
      if (product.product_tags && Array.isArray(product.product_tags)) {
        product.product_tags.forEach(tag => allTagsSet.add(tag));
      }
    });
    const unionTags = Array.from(allTagsSet);

    if (unionTags.length === 0) {
      console.warn('Build Your Set: No tags found in products');
      return;
    }

    // Find the personalization dialog
    let personaliseDialogElement = document.getElementById('build-your-set-personalise-dialog');
    if (!personaliseDialogElement) {
      personaliseDialogElement = document.querySelector('build-your-set-personalise-dialog');
    }
    
    if (!personaliseDialogElement) {
      console.error('Build Your Set: Personalization dialog element not found');
      return;
    }

    // Wait for custom element to be defined
    await customElements.whenDefined('build-your-set-personalise-dialog');
    
    const personaliseDialog = /** @type {any} */ (personaliseDialogElement);
    
    // Wait for component to initialize
    if (!personaliseDialog.refs || !personaliseDialog.refs.dialog) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Open dialog with all products mode
    if (typeof personaliseDialog.openForAllProducts === 'function') {
      personaliseDialog.openForAllProducts(productsNeedingPersonalization, unionTags);
    } else {
      console.error('Build Your Set: openForAllProducts method not found on dialog');
    }
  }

  /**
   * Handles start over button click
   */
  handleStartOver() {
    const storageKey = 'build-your-set-session-cart';
    try {
      sessionStorage.removeItem(storageKey);
      
      // Update display immediately
      requestAnimationFrame(() => {
        this.updateDisplay();
      });
      
      // Dispatch event to notify other components
      document.dispatchEvent(new CustomEvent('build-your-set-cleared', {
        bubbles: true,
        cancelable: true
      }));
    } catch (error) {
      console.error('Build Your Set: Error clearing session:', error);
    }
  }

  /**
   * Handles add all to cart button click
   */
  async handleAddAllToCart() {
    // Prevent duplicate calls
    if (this.#isAddingToCart) {
      console.warn('Build Your Set: Already adding products to cart, ignoring duplicate call');
      return;
    }

    const sessionCart = this.getSessionCart();
    if (sessionCart.length === 0) {
      console.warn('Build Your Set: No products to add to cart');
      return;
    }

    if (!this.refs.addAllButton) return;

    // Set flag to prevent duplicates
    this.#isAddingToCart = true;

    // Disable button during processing
    this.refs.addAllButton.disabled = true;
    const originalText = this.refs.addAllButton.querySelector('.build-your-set-sticky-bar__button-text')?.textContent || 'Add All to Cart';
    const buttonText = this.refs.addAllButton.querySelector('.build-your-set-sticky-bar__button-text');
    if (buttonText) {
      buttonText.textContent = 'Adding...';
    }

    try {
      // Get cart section IDs that need to be updated
      const cartSectionIds = this.#getCartSectionIds();
      
      // Add each product to cart (one at a time to avoid conflicts)
      for (const item of sessionCart) {
        await this.addProductToCart(item);
      }

      // Fetch updated cart with sections after all products are added
      const cartData = await this.#fetchCartWithSections(cartSectionIds);
      
      // Calculate total items added
      const totalItemsAdded = sessionCart.reduce((sum, item) => sum + (item.quantity || 1), 0);

      // Clear session after successful add
      const storageKey = 'build-your-set-session-cart';
      sessionStorage.removeItem(storageKey);
      
      // Force update display immediately to hide sticky bar
      // Use multiple methods to ensure it updates
      this.updateDisplay();
      requestAnimationFrame(() => {
        this.updateDisplay();
      });
      
      // Also dispatch cleared event to ensure all listeners update
      document.dispatchEvent(new CustomEvent('build-your-set-cleared', {
        bubbles: true,
        cancelable: true
      }));

      // Dispatch cart update event with sections
      document.dispatchEvent(
        new CartAddEvent(cartData, this.id, {
          source: 'build-your-set-sticky-bar',
          itemCount: totalItemsAdded,
          sections: cartData.sections || {}
        })
      );

      // Show success message (optional)
      if (buttonText) {
        buttonText.textContent = 'Added!';
        setTimeout(() => {
          if (buttonText) {
            buttonText.textContent = originalText;
          }
          if (this.refs.addAllButton) {
            this.refs.addAllButton.disabled = false;
          }
          this.#isAddingToCart = false;
        }, 2000);
      } else {
        this.#isAddingToCart = false;
      }
    } catch (error) {
      console.error('Build Your Set: Error adding products to cart:', error);
      if (buttonText) {
        buttonText.textContent = 'Error - Try Again';
      }
      setTimeout(() => {
        if (buttonText) {
          buttonText.textContent = originalText;
        }
        if (this.refs.addAllButton) {
          this.refs.addAllButton.disabled = false;
        }
        this.#isAddingToCart = false;
      }, 2000);
    }
  }

  /**
   * Gets cart section IDs that need to be updated
   * @returns {Array<string>} Array of section IDs
   */
  #getCartSectionIds() {
    const sectionIds = [];
    
    // Get section IDs from cart-items-component
    const cartItemsComponents = document.querySelectorAll('cart-items-component');
    cartItemsComponents.forEach((item) => {
      if (item instanceof HTMLElement && item.sectionId) {
        sectionIds.push(item.sectionId);
      }
    });
    
    // Also check for cart-icon and other cart-related components
    const cartIcon = document.querySelector('cart-icon');
    if (cartIcon && cartIcon.dataset.sectionId) {
      sectionIds.push(cartIcon.dataset.sectionId);
    }
    
    // Remove duplicates
    return [...new Set(sectionIds)];
  }

  /**
   * Fetches cart with sections
   * @param {Array<string>} sectionIds - Section IDs to fetch
   * @returns {Promise<Object>} Cart data with sections
   */
  async #fetchCartWithSections(sectionIds) {
    try {
      let url = '/cart.js';
      if (sectionIds && sectionIds.length > 0) {
        const sectionsParam = sectionIds.join(',');
        url = `/cart.js?sections=${sectionsParam}`;
      }
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      if (!response.ok) {
        console.warn('Build Your Set: Failed to fetch cart sections, continuing without sections');
        const cartData = await fetch('/cart.js', {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          }
        }).then(r => r.ok ? r.json() : {});
        return { ...cartData, sections: {} };
      }

      const data = await response.json();
      // Shopify returns sections in a 'sections' property when using ?sections= parameter
      return {
        ...data,
        sections: data.sections || {}
      };
    } catch (error) {
      console.warn('Build Your Set: Error fetching cart sections:', error);
      // Fallback: fetch cart without sections
      try {
        const response = await fetch('/cart.js', {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          }
        });
        if (response.ok) {
          const cartData = await response.json();
          return { ...cartData, sections: {} };
        }
      } catch (e) {
        console.error('Build Your Set: Error fetching cart:', e);
      }
      return { sections: {} };
    }
  }

  /**
   * Adds a single product to cart with personalizations
   * @param {Object} item - Product item from session
   * @returns {Promise} Promise that resolves when product is added
   */
  async addProductToCart(item) {
    const formData = new FormData();
    
    // Ensure variant_id is a string (Shopify expects string)
    const variantId = String(item.variant_id);
    formData.append('id', variantId);
    formData.append('quantity', String(item.quantity || 1));

    // Add personalizations as item properties
    if (item.personalizations && Object.keys(item.personalizations).length > 0) {
      // Map of personalization keys to Shopify property names
      const propertyKeyMap = {
        'name': 'Name',
        'personalise-name': 'Name',
        'babyName': "Baby's Name",
        "Baby's Name": "Baby's Name",
        'kidName': "Kid's Name",
        "Kid's Name": "Kid's Name",
        'mumName': "Mum's Name",
        "Mum's Name": "Mum's Name",
        'font': 'Text Font',
        'personalise-font': 'Text Font',
        'color': 'Text Color',
        'personalise-color': 'Text Color',
        'dob': 'Date of Birth',
        'schoolYear': 'School Year',
        'name1': 'Name 1',
        'name2': 'Name 2',
        'name3': 'Name 3',
        'name4': 'Name 4',
        'textbox': 'Personalisation:',
        'message': 'Message',
        'time': 'Time',
        'weight': 'Weight',
        'optionalDob': 'Personalise Date of Birth'
      };
      
      Object.keys(item.personalizations).forEach(key => {
        const value = item.personalizations[key];
        if (value && value.toString().trim() && value !== 'null' && value !== 'undefined') {
          let propertyKey;
          
          // If key already has properties[ format, use it as is
          if (key.startsWith('properties[') && key.endsWith(']')) {
            propertyKey = key;
          } else {
            // Map the key to the correct Shopify property name
            const mappedKey = propertyKeyMap[key] || key;
            propertyKey = `properties[${mappedKey}]`;
          }
          
          formData.append(propertyKey, String(value));
        }
      });
    }

    try {
      // Use FormData - don't set Content-Type header, let browser set it with boundary
      const response = await fetch('/cart/add.js', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: formData
      });

      const responseText = await response.text();
      let data;
      
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Build Your Set: Failed to parse cart API response:', responseText);
        throw new Error(`Invalid response from cart API: ${response.status} ${response.statusText}`);
      }

      if (!response.ok || data.status === 422 || data.errors) {
        const errorMessage = data.description || data.message || (data.errors ? JSON.stringify(data.errors) : null) || `Failed to add product ${item.product_id} to cart`;
        console.error('Build Your Set: Cart API error response:', {
          status: response.status,
          statusText: response.statusText,
          data: data,
          variant_id: variantId,
          quantity: item.quantity,
          personalizations: item.personalizations
        });
        throw new Error(typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage));
      }

      return data;
    } catch (error) {
      console.error(`Build Your Set: Error adding product ${item.product_id} to cart:`, error);
      throw error;
    }
  }
}

if (!customElements.get('build-your-set-sticky-bar')) {
  customElements.define('build-your-set-sticky-bar', BuildYourSetStickyBarComponent);
}
