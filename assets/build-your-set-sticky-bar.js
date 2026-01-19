import { Component } from '@theme/component';
import { ThemeEvents } from '@theme/events';
import { fetchConfig } from '@theme/utilities';

/**
 * Component for managing the build-your-set sticky bar
 */
export class BuildYourSetStickyBarComponent extends Component {
  requiredRefs = ['productsContainer', 'startOverButton', 'addAllButton', 'totalPrice'];

  connectedCallback() {
    super.connectedCallback();
    
    // Wait a bit for refs to be ready
    requestAnimationFrame(() => {
      // Initial check on load
      this.updateDisplay();
      
      // Listen for build-your-set updates
      const updateHandler = () => {
        console.log('Build Your Set: Sticky bar received update event');
        this.updateDisplay();
      };
      document.addEventListener('build-your-set-updated', updateHandler);
      
      // Store handler for cleanup
      this._updateHandler = updateHandler;
      
      // Also check on page load in case products were added before component loaded
      if (document.readyState === 'loading') {
        window.addEventListener('load', () => {
          this.updateDisplay();
        });
      } else {
        // Already loaded, check immediately
        this.updateDisplay();
      }
      
      // Set up button handlers
      if (this.refs.startOverButton) {
        this.refs.startOverButton.addEventListener('click', this.handleStartOver.bind(this));
      }
      if (this.refs.addAllButton) {
        this.refs.addAllButton.addEventListener('click', this.handleAddAllToCart.bind(this));
      }
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._updateHandler) {
      document.removeEventListener('build-your-set-updated', this._updateHandler);
    }
  }

  /**
   * Updates the sticky bar display
   */
  updateDisplay() {
    const sessionCart = this.getSessionCart();
    console.log('Build Your Set: Updating sticky bar display', { itemCount: sessionCart.length });
    
    if (sessionCart.length === 0) {
      this.style.display = 'none';
      return;
    }

    this.style.display = 'flex';
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
      this.updateDisplay();
      
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
    const sessionCart = this.getSessionCart();
    if (sessionCart.length === 0) {
      console.warn('Build Your Set: No products to add to cart');
      return;
    }

    if (!this.refs.addAllButton) return;

    // Disable button during processing
    this.refs.addAllButton.disabled = true;
    const originalText = this.refs.addAllButton.querySelector('.build-your-set-sticky-bar__button-text')?.textContent || 'Add All to Cart';
    const buttonText = this.refs.addAllButton.querySelector('.build-your-set-sticky-bar__button-text');
    if (buttonText) {
      buttonText.textContent = 'Adding...';
    }

    try {
      // Add each product to cart
      const addPromises = sessionCart.map(item => this.addProductToCart(item));
      await Promise.all(addPromises);

      // Clear session after successful add
      const storageKey = 'build-your-set-session-cart';
      sessionStorage.removeItem(storageKey);
      this.updateDisplay();

      // Dispatch cart update event
      document.dispatchEvent(new CustomEvent(ThemeEvents.cartUpdate, {
        bubbles: true,
        cancelable: true,
        detail: { itemsAdded: sessionCart.length }
      }));

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
        }, 2000);
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
      }, 2000);
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
