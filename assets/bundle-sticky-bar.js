import { Component } from '@theme/component';
import { ThemeEvents } from '@theme/events';

/**
 * Component for managing the bundle sticky bar
 */
export class BundleStickyBarComponent extends Component {
  requiredRefs = ['productsContainer', 'startOverButton', 'addAllButton', 'totalPrice'];

  connectedCallback() {
    super.connectedCallback();
    this.updateDisplay();
    
    // Listen for bundle updates
    document.addEventListener('bundle-updated', this.updateDisplay.bind(this));
    
    // Set up button handlers
    if (this.refs.startOverButton) {
      this.refs.startOverButton.addEventListener('click', this.handleStartOver.bind(this));
    }
    if (this.refs.addAllButton) {
      this.refs.addAllButton.addEventListener('click', this.handleAddAllToCart.bind(this));
    }
  }

  /**
   * Updates the sticky bar display
   */
  updateDisplay() {
    const bundleItems = this.getBundleItems();
    
    if (bundleItems.length === 0) {
      this.style.display = 'none';
      return;
    }

    this.style.display = 'flex';
    this.renderProducts(bundleItems);
    this.updateTotalPrice(bundleItems);
  }

  /**
   * Gets bundle items from sessionStorage
   * @returns {Array} Array of bundle items
   */
  getBundleItems() {
    const bundleKey = 'bundle_items';
    const bundleItemsJson = sessionStorage.getItem(bundleKey);
    if (!bundleItemsJson) return [];

    try {
      return JSON.parse(bundleItemsJson);
    } catch (e) {
      console.error('Error parsing bundle items:', e);
      return [];
    }
  }

  /**
   * Renders products in the sticky bar
   * @param {Array} bundleItems - Array of bundle items
   */
  renderProducts(bundleItems) {
    if (!this.refs.productsContainer) return;

    this.refs.productsContainer.innerHTML = '';

    bundleItems.forEach((item, index) => {
      const productElement = document.createElement('div');
      productElement.className = 'bundle-sticky-bar__product';
      productElement.dataset.bundleIndex = index;

      // Build personalisation text
      let personalisationText = '';
      if (item.personalisation) {
        const parts = [];
        if (item.personalisation.name) parts.push(`Name: ${item.personalisation.name}`);
        if (item.personalisation.babyName) parts.push(`Baby: ${item.personalisation.babyName}`);
        if (item.personalisation.kidName) parts.push(`Kid: ${item.personalisation.kidName}`);
        if (item.personalisation.mumName) parts.push(`Mum: ${item.personalisation.mumName}`);
        if (item.personalisation.font) parts.push(`Font: ${item.personalisation.font}`);
        if (item.personalisation.color) parts.push(`Color: ${item.personalisation.color}`);
        if (item.personalisation.textbox) parts.push(`Text: ${item.personalisation.textbox}`);
        personalisationText = parts.join(', ');
      }

      productElement.innerHTML = `
        <button class="bundle-sticky-bar__product-remove" data-bundle-index="${index}" aria-label="Remove from bundle">
          <svg class="bundle-sticky-bar__product-remove-icon" width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
        <img src="${item.image || ''}" alt="${item.title || 'Product'}" class="bundle-sticky-bar__product-image" loading="lazy" onerror="this.style.display='none'">
        <div class="bundle-sticky-bar__product-info">
          <h4 class="bundle-sticky-bar__product-name">${item.title || 'Product'}</h4>
          <div class="bundle-sticky-bar__product-price">${item.price || 'AED 0.00'}</div>
          ${personalisationText ? `<div class="bundle-sticky-bar__product-personalisation">${personalisationText}</div>` : ''}
        </div>
      `;

      // Add remove handler
      const removeButton = productElement.querySelector('.bundle-sticky-bar__product-remove');
      if (removeButton) {
        removeButton.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.removeFromBundle(index);
        });
      }

      this.refs.productsContainer.appendChild(productElement);
    });
  }

  /**
   * Updates the total price display
   * @param {Array} bundleItems - Array of bundle items
   */
  updateTotalPrice(bundleItems) {
    if (!this.refs.totalPrice) return;

    let totalPrice = 0;
    bundleItems.forEach(item => {
      // Extract numeric price value (remove currency symbols and text)
      const priceMatch = item.price?.match(/[\d,]+\.?\d*/);
      if (priceMatch) {
        const numericPrice = parseFloat(priceMatch[0].replace(/,/g, ''));
        totalPrice += numericPrice * (item.quantity || 1);
      }
    });

    // Format as AED
    this.refs.totalPrice.textContent = `(AED ${totalPrice.toFixed(2)})`;
  }

  /**
   * Removes an item from the bundle
   * @param {number} index - The index of the item to remove
   */
  removeFromBundle(index) {
    const bundleItems = this.getBundleItems();
    bundleItems.splice(index, 1);

    const bundleKey = 'bundle_items';
    if (bundleItems.length === 0) {
      sessionStorage.removeItem(bundleKey);
    } else {
      sessionStorage.setItem(bundleKey, JSON.stringify(bundleItems));
    }

    // Dispatch event to update display
    document.dispatchEvent(new CustomEvent('bundle-updated'));
    this.updateDisplay();
  }

  /**
   * Handles start over button click
   */
  handleStartOver = () => {
    sessionStorage.removeItem('bundle_items');
    this.updateDisplay();
    document.dispatchEvent(new CustomEvent('bundle-updated'));
  };

  /**
   * Handles add all to cart button click
   */
  handleAddAllToCart = async () => {
    const bundleItems = this.getBundleItems();
    if (bundleItems.length === 0) return;

    // Add each item to cart with personalisation
    for (const item of bundleItems) {
      try {
        await this.#addItemToCart(item);
      } catch (error) {
        console.error('Error adding item to cart:', error);
        // Continue with other items even if one fails
      }
    }

    // Clear bundle after adding to cart
    sessionStorage.removeItem('bundle_items');
    this.updateDisplay();
    document.dispatchEvent(new CustomEvent('bundle-updated'));

    // Trigger cart update event
    document.dispatchEvent(new CustomEvent(ThemeEvents.cartUpdate, { bubbles: true }));
  };

  /**
   * Adds a single item to cart
   * @param {Object} item - The bundle item to add
   */
  async #addItemToCart(item) {
    const formData = new FormData();
    formData.append('id', item.variantId);
    formData.append('quantity', item.quantity || 1);

    // Add personalisation properties if they exist
    if (item.personalisation) {
      if (item.personalisation.name) {
        formData.append('properties[Name]', item.personalisation.name);
      }
      if (item.personalisation.font) {
        formData.append('properties[Text Font]', item.personalisation.font);
      }
      if (item.personalisation.color) {
        formData.append('properties[Text Color]', item.personalisation.color);
      }
      if (item.personalisation.dob) {
        formData.append('properties[Date of Birth]', item.personalisation.dob);
      }
      if (item.personalisation.schoolYear) {
        formData.append('properties[School Year]', item.personalisation.schoolYear);
      }
      if (item.personalisation.name1) {
        formData.append('properties[Name 1]', item.personalisation.name1);
      }
      if (item.personalisation.name2) {
        formData.append('properties[Name 2]', item.personalisation.name2);
      }
      if (item.personalisation.name3) {
        formData.append('properties[Name 3]', item.personalisation.name3);
      }
      if (item.personalisation.name4) {
        formData.append('properties[Name 4]', item.personalisation.name4);
      }
      if (item.personalisation.textbox) {
        formData.append('properties[Personalisation:]', item.personalisation.textbox);
      }
      if (item.personalisation.message) {
        formData.append('properties[Message]', item.personalisation.message);
      }
      if (item.personalisation.optionalDob) {
        formData.append('properties[Personalise Date of Birth]', item.personalisation.optionalDob);
      }
      if (item.personalisation.time) {
        formData.append('properties[Time]', item.personalisation.time);
      }
      if (item.personalisation.weight) {
        formData.append('properties[Weight]', item.personalisation.weight);
      }
      if (item.personalisation.babyName) {
        formData.append('properties[Baby\'s Name]', item.personalisation.babyName);
      }
      if (item.personalisation.kidName) {
        formData.append('properties[Kid\'s Name]', item.personalisation.kidName);
      }
      if (item.personalisation.mumName) {
        formData.append('properties[Mum\'s Name]', item.personalisation.mumName);
      }
    }

    const response = await fetch(Theme.routes.cart_add_url, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to add item to cart: ${response.statusText}`);
    }

    return await response.json();
  }
}

if (!customElements.get('bundle-sticky-bar')) {
  customElements.define('bundle-sticky-bar', BundleStickyBarComponent);
}
