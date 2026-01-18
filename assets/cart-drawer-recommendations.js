/**
 * A custom element that manages product recommendations in the cart drawer.
 * Tries complementary products first, then falls back to related products.
 */

class CartDrawerRecommendations extends HTMLElement {
  /**
   * The observer for the recommendations
   * @type {IntersectionObserver}
   */
  #intersectionObserver = new IntersectionObserver(
    (entries, observer) => {
      if (!entries[0]?.isIntersecting) return;

      observer.disconnect();
      // Only load if not already loaded (avoid duplicate loads)
      if (!this.#recommendationsLoaded) {
        this.#loadRecommendations();
      }
    },
    { rootMargin: '0px 0px 200px 0px' }
  );

  /**
   * The cached recommendations
   * @type {Record<string, string>}
   */
  #cachedRecommendations = {};

  /**
   * An abort controller for the active fetch (if there is one)
   * @type {AbortController | null}
   */
  #activeFetch = null;

  /**
   * Whether recommendations have been loaded
   * @type {boolean}
   */
  #recommendationsLoaded = false;

  /**
   * The product ID from the most recent cart update event
   * @type {string | null}
   */
  #lastAddedProductId = null;

  connectedCallback() {
    // Start observing for intersection
    this.#intersectionObserver.observe(this);
    
    // Listen for cart updates to reload recommendations
    document.addEventListener('cart:update', this.#handleCartUpdate);
    
    // Try loading when connected - wait multiple frames to ensure cart state is ready
    // This handles both initial page load and when element appears after cart morph
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (!this.#recommendationsLoaded && document.contains(this)) {
            this.#loadRecommendations();
          }
        }, 200);
      });
    });
  }

  disconnectedCallback() {
    this.#intersectionObserver.disconnect();
    document.removeEventListener('cart:update', this.#handleCartUpdate);
  }

  /**
   * Handles cart update events
   */
  #handleCartUpdate = (event) => {
    // Store product ID from event if available (more reliable than guessing from cart array)
    if (event?.detail?.data?.productId) {
      this.#lastAddedProductId = event.detail.data.productId.toString();
    }
    
    // Reset state when cart changes
    this.#recommendationsLoaded = false;
    this.#cachedRecommendations = {};
    
    // Wait for DOM to settle after morphing, then load
    // The element might be disconnected/reconnected during morphing
    queueMicrotask(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (document.contains(this) && !this.#recommendationsLoaded) {
            this.#loadRecommendations();
          }
        });
      });
    });
  };

  /**
   * Gets the most recent cart item's product ID
   * @returns {Promise<string | null>}
   */
  async #getMostRecentProductId() {
    // First, try using product ID from the cart update event (most reliable)
    if (this.#lastAddedProductId) {
      return this.#lastAddedProductId;
    }

    // Fallback: Get the first item in cart array (most recent items appear first)
    try {
      const response = await fetch('/cart.js');
      if (!response.ok) return null;

      const cart = await response.json();
      if (!cart.items || cart.items.length === 0) return null;

      // The first item in the array is the most recently added
      const mostRecentItem = cart.items[0];
      return mostRecentItem.product_id?.toString() || null;
    } catch (error) {
      console.error('Failed to fetch cart:', error);
      return null;
    }
  }

  /**
   * Load the product recommendations with fallback logic
   */
  async #loadRecommendations() {
    if (this.#recommendationsLoaded) {
      return;
    }

    // Ensure element is visible when starting to load
    this.classList.remove('hidden');

    // Try to get product ID with retry in case cart isn't ready yet
    let productId = await this.#getMostRecentProductId();
    
    // If no productId from event data, wait a bit and retry (cart might be updating)
    if (!productId) {
      await new Promise(resolve => setTimeout(resolve, 300));
      productId = await this.#getMostRecentProductId();
    }
    
    // Clear stored product ID after use so we always get fresh data from cart
    this.#lastAddedProductId = null;
    
    if (!productId) {
      this.classList.add('hidden');
      return;
    }

    const maxProducts = this.dataset.maxProducts || '4';

    // Try complementary first
    let result = await this.#fetchRecommendationsJSON(productId, maxProducts, 'complementary');

    // If no complementary products, fallback to related
    if (!result.success || !this.#hasProducts(result.data)) {
      result = await this.#fetchRecommendationsJSON(productId, maxProducts, 'related');
    }

    const hasProducts = result.success && this.#hasProducts(result.data);
    
    if (hasProducts) {
      this.#renderRecommendations(result.data);
      this.#recommendationsLoaded = true;
    } else {
      this.classList.add('hidden');
    }
  }

  /**
   * Checks if the recommendations HTML contains products
   * @param {string} html - The HTML response
   * @returns {boolean}
   */
  #hasProducts(html) {
    if (!html || !html.trim()) {
      return false;
    }
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // Check for scroll container or cart-items__table (from our JSON rendering)
    const scrollContainer = tempDiv.querySelector('.cart-drawer-recommendations__scroll-container');
    const table = tempDiv.querySelector('.cart-items__table');
    if (scrollContainer || table) {
      const rows = (scrollContainer || tempDiv).querySelectorAll('.cart-items__table-row');
      return rows.length > 0;
    }
    
    // Fallback: Check for resource-list (from Section Rendering API)
    let resourceList = tempDiv.querySelector('.resource-list');
    if (!resourceList) {
      const recommendations = tempDiv.querySelector('product-recommendations');
      if (recommendations) {
        resourceList = recommendations.querySelector('.resource-list');
      }
    }
    
    if (!resourceList) {
      return false;
    }
    
    const items = resourceList.querySelectorAll('.resource-list__item, product-card');
    const itemCount = items.length;
    const hasRecommendations = resourceList.getAttribute('data-has-recommendations') !== 'false';
    const hasProducts = itemCount > 0;
    
    return hasProducts && hasRecommendations;
  }

  /**
   * Fetches recommendations from the Product Recommendations API
   * @param {string} productId
   * @param {string | undefined} sectionId
   * @param {string} intent
   * @param {string} baseUrl
   * @returns {Promise<{ success: true, data: string } | { success: false, status: number }>}
   */
  async #fetchRecommendations(productId, sectionId, intent, baseUrl) {
    // First, try with section_id (Section Rendering API - returns HTML)
    // If that fails, fall back to JSON API (returns JSON, we'll render manually)
    const sectionIdParam = sectionId || 'product-recommendations';
    
    // Parse the base URL to get the limit
    let limit = '4';
    try {
      const urlObj = new URL(baseUrl, window.location.origin);
      limit = urlObj.searchParams.get('limit') || '4';
    } catch (e) {
      // If baseUrl parsing fails, extract limit manually
      const limitMatch = baseUrl.match(/[?&]limit=(\d+)/);
      if (limitMatch) limit = limitMatch[1];
    }
    
    // Build the recommendations API URL with section_id (for HTML response)
    // Parse the base URL properly to avoid malformed URLs
    let url;
    try {
      const urlObj = new URL(baseUrl, window.location.origin);
      // Clear existing params and set new ones
      urlObj.searchParams.set('product_id', productId);
      urlObj.searchParams.set('limit', limit);
      urlObj.searchParams.set('section_id', sectionIdParam);
      urlObj.searchParams.set('intent', intent);
      url = urlObj.toString();
    } catch (e) {
      // Fallback: manual URL construction
      const basePath = baseUrl.split('?')[0] || '/recommendations/products.json';
      url = `${basePath}?product_id=${productId}&limit=${limit}&section_id=${sectionIdParam}&intent=${intent}`;
      if (!url.startsWith('http')) {
        url = new URL(url, window.location.origin).toString();
      }
    }
    
    // Ensure URL is absolute
    if (!url.startsWith('http')) {
      url = new URL(url, window.location.origin).toString();
    }
    
    const cacheKey = url;

    // Check cache
    if (this.#cachedRecommendations[cacheKey]) {
      return { success: true, data: this.#cachedRecommendations[cacheKey] };
    }

    // Abort any active fetch
    this.#activeFetch?.abort();
    this.#activeFetch = new AbortController();

    try {
      const response = await fetch(url, { signal: this.#activeFetch.signal });
      
      if (!response.ok) {
        // If 404, try fetching JSON directly (without section_id)
        if (response.status === 404) {
          return this.#fetchRecommendationsJSON(productId, limit, intent);
        }
        return { success: false, status: response.status };
      }

      const text = await response.text();
      
      // Check if response is JSON (could be sections object or error)
      if (text.trim().startsWith('{')) {
        try {
          const json = JSON.parse(text);
          
          // Check if it's an error response
          if (json.status || json.message) {
            return { success: false, status: json.status || 422 };
          }
          
          // Check if it's a sections object (Section Rendering API format)
          if (json.sections && json.sections[sectionIdParam]) {
            this.#cachedRecommendations[cacheKey] = json.sections[sectionIdParam];
            return { success: true, data: json.sections[sectionIdParam] };
          }
        } catch (e) {
          // Not valid JSON, continue with HTML parsing
        }
      }
      
      // Assume it's HTML
      this.#cachedRecommendations[cacheKey] = text;
      return { success: true, data: text };
    } catch (error) {
      if (error.name === 'AbortError') {
        return { success: false, status: 0 };
      }
      console.error('Cart drawer recommendations: Fetch error:', error);
      return { success: false, status: 0 };
    } finally {
      this.#activeFetch = null;
    }
  }

  /**
   * Fetches recommendations as JSON (fallback when section_id doesn't work)
   * @param {string} productId
   * @param {string} limit
   * @param {string} intent
   * @returns {Promise<{ success: true, data: string } | { success: false, status: number }>}
   */
  async #fetchRecommendationsJSON(productId, limit, intent) {
    // Fetch JSON directly from recommendations API (no section_id)
    const jsonUrl = new URL('/recommendations/products.json', window.location.origin);
    jsonUrl.searchParams.set('product_id', productId);
    jsonUrl.searchParams.set('limit', limit);
    jsonUrl.searchParams.set('intent', intent);
    
    const url = jsonUrl.toString();
    const cacheKey = `json:${url}`;

    // Check cache
    if (this.#cachedRecommendations[cacheKey]) {
      return { success: true, data: this.#cachedRecommendations[cacheKey] };
    }

    try {
      const response = await fetch(url, { signal: this.#activeFetch?.signal });
      if (!response.ok) {
        return { success: false, status: response.status };
      }

      const json = await response.json();
      
      // Check if we got products
      if (!json.products || json.products.length === 0) {
        return { success: false, status: 404 };
      }

      // Render products manually
      const html = this.#renderProductsFromJSON(json.products);
      this.#cachedRecommendations[cacheKey] = html;
      return { success: true, data: html };
    } catch (error) {
      console.error('Cart drawer recommendations: JSON fetch error:', error);
      return { success: false, status: 0 };
    }
  }

  /**
   * Formats money using Shopify's money format (simplified version)
   * @param {number} moneyValueInCents - The money value in cents
   * @param {string} currency - The currency code (e.g., 'USD', 'EUR')
   * @returns {string} Formatted money string
   */
  #formatMoney(moneyValueInCents, currency = 'USD') {
    const amount = moneyValueInCents / 100;
    
    // Try to get money format template from page if available
    const moneyFormatElement = document.querySelector('template[ref="moneyFormat"]');
    const moneyFormatTemplate = (moneyFormatElement instanceof HTMLTemplateElement && moneyFormatElement.content?.textContent) || '{{amount}}';
    
    // Get currency decimals (default 2 for most currencies)
    const CURRENCY_DECIMALS = {
      BHD: 3, BIF: 0, BYR: 0, CLF: 4, CLP: 0, DJF: 0, GNF: 0, ISK: 0, 
      IQD: 3, JOD: 3, JPY: 0, KMF: 0, KRW: 0, KWD: 3, LYD: 3, OMR: 3, 
      PYG: 0, RWF: 0, TND: 3, UGX: 0, UYI: 0, VND: 0, VUV: 0, XAF: 0, 
      XOF: 0, XPF: 0, ZMK: 0, ZWD: 0
    };
    const currencyUpper = currency.toUpperCase();
    const precision = (currencyUpper in CURRENCY_DECIMALS ? CURRENCY_DECIMALS[currencyUpper] : undefined) ?? 2;
    
    // Format the amount
    const formattedAmount = amount.toFixed(precision).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    
    // Replace template placeholders
    return moneyFormatTemplate
      .replace(/{{\s*amount\s*}}/g, formattedAmount)
      .replace(/{{\s*currency\s*}}/g, currency);
  }

  /**
   * Renders product cards from JSON product data
   * @param {Array} products - Array of product objects from API
   * @returns {string} HTML string
   */
  #renderProductsFromJSON(products) {
    // Render product cards matching the cart drawer's horizontal layout
    const items = products.map((product, index) => {
      // Get the first available variant
      const variant = product.variants && product.variants.length > 0 ? product.variants[0] : null;
      const variantUrl = variant ? variant.url : product.url;
      
      // Get featured image - request 86x86 size
      const featuredImage = product.featured_image || (product.images && product.images.length > 0 ? product.images[0] : null);
      let imageUrl = '';
      if (featuredImage) {
        const baseUrl = typeof featuredImage === 'string' ? featuredImage : featuredImage.src;
        if (baseUrl) {
          // Shopify image URLs can be modified to request specific size
          // Try to add or replace width parameter
          if (baseUrl.includes('cdn.shopify.com')) {
            // Shopify CDN URL - modify to request 86x86
            imageUrl = baseUrl.replace(/(\?|&)width=\d+/, '$1width=86');
            if (!imageUrl.includes('width=')) {
              const separator = imageUrl.includes('?') ? '&' : '?';
              imageUrl = `${imageUrl}${separator}width=86`;
            }
            // Also set height
            imageUrl = imageUrl.replace(/(\?|&)height=\d+/, '$1height=86');
            if (!imageUrl.includes('height=')) {
              imageUrl = `${imageUrl}&height=86`;
            }
          } else {
            imageUrl = baseUrl;
          }
        }
      }
      
      // Format prices using Shopify's money format
      // Get currency from product or use default, and format using Shopify's format
      const currency = product.currency || 'USD';
      const priceInCents = product.price;
      const compareAtPriceInCents = product.compare_at_price || null;
      
      // Use Shopify money format helper
      const priceFormatted = this.#formatMoney(priceInCents, currency);
      const compareAtPriceFormatted = compareAtPriceInCents ? this.#formatMoney(compareAtPriceInCents, currency) : null;
      
      // Calculate percentage off if on sale
      let percentageOff = null;
      if (compareAtPriceInCents && compareAtPriceInCents > priceInCents) {
        const priceDifference = compareAtPriceInCents - priceInCents;
        percentageOff = Math.floor((priceDifference / compareAtPriceInCents) * 100);
      }
      
      return `
        <tr class="cart-items__table-row cart-drawer-recommendations__item" role="row">
          <td class="cart-items__media" role="cell">
            ${imageUrl ? `
              <a
                href="${variantUrl || product.url}"
                class="cart-items__media-container"
                style="--ratio: 1;"
              >
                <img
                  src="${imageUrl}"
                  alt="${this.#escapeHtml(product.title)}"
                  class="cart-items__media-image border-style"
                  loading="lazy"
                  width="86"
                  height="86"
                />
              </a>
            ` : ''}
          </td>
          <td class="cart-items__details cart-primary-typography" role="cell">
            <p>
              <a href="${variantUrl || product.url}" class="cart-items__title">
                ${this.#escapeHtml(product.title)}
              </a>
            </p>
            <div>
              ${compareAtPriceFormatted && compareAtPriceInCents > priceInCents ? `
                <span class="visually-hidden">Sale price</span>
                <span>${priceFormatted}</span>
                <span class="visually-hidden">Regular price</span>
                <s class="compare-at-price">${compareAtPriceFormatted}</s>
                ${percentageOff ? `<span class="cart-items__percentage-off">${percentageOff}% OFF</span>` : ''}
              ` : `
                <span class="visually-hidden">Price</span>
                <span>${priceFormatted}</span>
              `}
            </div>
          </td>
          <td class="cart-items__quick-add" role="cell">
            <div onclick="event.stopPropagation();" class="product-card-actions__quick-add-wrapper">
              <quick-add-component
                class="quick-add product-card-actions__quick-add"
                ref="quickAdd"
                data-product-title="${this.#escapeHtml(product.title)}"
                data-product-url="${variantUrl || product.url}"
                data-product-handle="${product.handle || ''}"
                data-quick-add-button="choose"
                data-product-options-count="${product.options ? product.options.length : 0}"
              >
                <product-form-component
                  data-section-id="cart-drawer-recommendations"
                  data-product-id="${product.id}"
                  on:submit="/handleSubmit"
                  class="quick-add__product-form-component"
                >
                  <form id="ProductCardActions-ProductForm-${product.id}-cart-drawer-recommendations" novalidate="novalidate" data-type="add-to-cart-form">
                    <input
                      type="hidden"
                      name="id"
                      ref="variantId"
                      value="${variant ? variant.id : ''}"
                      ${variant && !variant.available ? 'disabled' : ''}
                    >
                    <input
                      type="hidden"
                      name="quantity"
                      value="${variant && variant.quantity_rule && variant.quantity_rule.min ? variant.quantity_rule.min : 1}"
                    >
                    <button
                      class="button product-card-actions__quick-add-button"
                      type="button"
                      name="add"
                      on:click="quick-add-component/handleClick"
                      onclick="event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();"
                      data-quick-add-trigger="true"
                      data-no-navigation="true"
                    >
                      <span class="product-card-actions__quick-add-plus">+</span>
                    </button>
                  </form>
                </product-form-component>
              </quick-add-component>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    return `
      <div class="cart-drawer-recommendations__scroll-container">
        <table class="cart-items__table" role="table">
          <tbody role="rowgroup">
            ${items}
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Escapes HTML to prevent XSS
   * @param {string} text
   * @returns {string}
   */
  #escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Renders the recommendations HTML
   * @param {string} html - The HTML response
   */
  #renderRecommendations(html) {
    if (!html || !html.trim()) {
      this.classList.add('hidden');
      return;
    }

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // Try to find scroll container or cart-items__table (from our JSON rendering)
    let scrollContainer = tempDiv.querySelector('.cart-drawer-recommendations__scroll-container');
    let table = tempDiv.querySelector('.cart-items__table');
    
    // If not found, try to find resource-list (from Section Rendering API fallback)
    let resourceList = tempDiv.querySelector('.resource-list');
    if (!resourceList) {
      let recommendations = tempDiv.querySelector(`product-recommendations[id="${this.id}"]`);
      if (!recommendations) {
        recommendations = tempDiv.querySelector('product-recommendations');
      }
      if (recommendations) {
        resourceList = recommendations.querySelector('.resource-list');
      }
    }
    
    // If still not found, check if the HTML itself is a scroll container, table or resource-list
    if (!scrollContainer && tempDiv.firstElementChild) {
      if (tempDiv.firstElementChild.classList.contains('cart-drawer-recommendations__scroll-container')) {
        scrollContainer = tempDiv.firstElementChild;
      } else if (tempDiv.firstElementChild.classList.contains('cart-items__table')) {
        table = tempDiv.firstElementChild;
      } else if (tempDiv.firstElementChild.classList.contains('resource-list')) {
        resourceList = tempDiv.firstElementChild;
      }
    }

    // Clear loading state
    const loading = this.querySelector('.cart-drawer-recommendations__loading');
    if (loading) {
      loading.remove();
    }

    if (scrollContainer && scrollContainer.innerHTML.trim()) {
      // Insert the scroll container directly (from JSON rendering)
      this.innerHTML = '';
      this.appendChild(scrollContainer.cloneNode(true));
      this.classList.remove('hidden');
    } else if (table && table.innerHTML.trim()) {
      // Wrap table in scroll container if it's not already wrapped
      const newScrollContainer = document.createElement('div');
      newScrollContainer.className = 'cart-drawer-recommendations__scroll-container';
      newScrollContainer.appendChild(table.cloneNode(true));
      this.innerHTML = '';
      this.appendChild(newScrollContainer);
      this.classList.remove('hidden');
    } else if (resourceList && resourceList.innerHTML.trim()) {
      // Fallback: Insert resource-list (from Section Rendering API)
      const resourceListClone = resourceList.cloneNode(true);
      resourceListClone.classList.remove('resource-list--grid');
      
      const items = Array.from(resourceListClone.querySelectorAll('.resource-list__item'));
      const newResourceList = document.createElement('div');
      newResourceList.className = 'resource-list';
      newResourceList.setAttribute('data-has-recommendations', 'true');
      
      items.forEach((item) => {
        newResourceList.appendChild(item.cloneNode(true));
      });
      
      this.innerHTML = '';
      this.appendChild(newResourceList);
      this.classList.remove('hidden');
    } else {
      this.classList.add('hidden');
      return;
    }
    
    // Force layout recalculation
    this.offsetHeight; // Trigger reflow
  }
}

// Register the custom element
try {
  if (!customElements.get('cart-drawer-recommendations')) {
    customElements.define('cart-drawer-recommendations', CartDrawerRecommendations);
  }
} catch (error) {
  console.error('Cart drawer recommendations: Error registering custom element:', error);
}
