import { Component } from '@theme/component';
import { ThemeEvents, CartAddEvent } from '@theme/events';
import { fetchConfig } from '@theme/utilities';
import { sectionRenderer } from '@theme/section-renderer';

/**
 * Component for managing the build-your-set sticky bar
 */
export class BuildYourSetStickyBarComponent extends Component {
  requiredRefs = ['productsContainer', 'startOverButton', 'addAllButton', 'totalPrice'];
  
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
      
      // Store handlers for cleanup
      this._updateHandler = updateHandler;
      this._clearedHandler = clearedHandler;
      
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
    if (this._clearedHandler) {
      document.removeEventListener('build-your-set-cleared', this._clearedHandler);
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
      if (item.personalizations && Object.keys(item.personalizations).length > 0) {
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

      productElement.innerHTML = `
        <img src="${imageUrl}" alt="${productName}" class="build-your-set-sticky-bar__product-image" loading="lazy" onerror="this.style.display='none'">
        <div class="build-your-set-sticky-bar__product-info">
          <h4 class="build-your-set-sticky-bar__product-name">${productName}</h4>
          <div class="build-your-set-sticky-bar__product-price">${price}</div>
          ${personalisationText ? `<div class="build-your-set-sticky-bar__product-personalisation">${personalisationText}</div>` : ''}
        </div>
      `;

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
