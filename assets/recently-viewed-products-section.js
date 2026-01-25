import { RecentlyViewed } from '@theme/recently-viewed-products';
import { sectionRenderer } from '@theme/section-renderer';

/**
 * Custom element for displaying recently viewed products in a slider
 */
class RecentlyViewedProductsComponent extends HTMLElement {
  /**
   * Map to store product data (id -> {id, handle, url})
   * @type {Map<string, {id: string, handle: string, url: string}>}
   */
  #productDataMap = new Map();

  /**
   * Cache for search-results responses to avoid re-fetching
   * @type {Map<string, {html: string, timestamp: number}>}
   */
  #searchResultsCache = new Map();

  /**
   * Cache TTL for search results (5 minutes)
   */
  static #CACHE_TTL = 5 * 60 * 1000;

  /**
   * Cache TTL for product data (24 hours)
   */
  static #PRODUCT_DATA_CACHE_TTL = 24 * 60 * 60 * 1000;

  /**
   * localStorage key for product data cache
   */
  static #PRODUCT_DATA_CACHE_KEY = 'recentlyViewedProductData';

  /**
   * Get the current product ID if we're on a product page
   * @returns {string | null} The current product ID or null if not on a product page
   */
  #getCurrentProductId() {
    // Try to get from sticky-add-to-cart
    const stickyAddToCart = document.querySelector('sticky-add-to-cart');
    if (stickyAddToCart?.dataset?.productId) {
      return String(stickyAddToCart.dataset.productId);
    }

    // Try to get from product-form-component
    const productForm = document.querySelector('product-form-component');
    if (productForm?.dataset?.productId) {
      return String(productForm.dataset.productId);
    }

    // Try to get from URL (if on /products/[handle] page)
    const urlMatch = window.location.pathname.match(/\/products\/([^\/]+)/);
    if (urlMatch) {
      // We can't easily get the product ID from handle without fetching, but we can check if the handle matches
      // For now, we'll rely on the data attributes above
      // If those fail, we can try to match by handle later
    }

    return null;
  }

  /**
   * Render products by fetching individual product cards using section-rendering-product-card
   * @param {string[]} productIds - Array of product IDs in the exact order from localStorage
   */
  async #renderProductsFromMainCollection(productIds) {
    // Load cached product data first
    this.#loadCachedProductData(productIds);
    
    const itemsPerView = parseInt(this.dataset.itemsPerView) || 4;
    const columnsGap = parseInt(this.dataset.columnsGap) || 8;
    const iconsStyle = this.dataset.iconsStyle || 'arrow';

    console.log('Product IDs to fetch (in exact localStorage order):', productIds);
    
    try {
      // First, try to get handles from localStorage cache
      let productHandlesMap = new Map();
      const cachedHandles = this.#getCachedHandles(productIds);
      const missingIds = productIds.filter(id => !cachedHandles.has(String(id)));
      
      console.log(`Found ${cachedHandles.size} cached handles, ${missingIds.length} missing`);
      
      // Only fetch from search-results if we have missing handles
      if (missingIds.length > 0) {
        // Get product handles from search-results (optimized with caching)
        const handlesFromSearch = await this.#fetchHandlesFromSearch(missingIds);
        handlesFromSearch.forEach((handle, id) => {
          productHandlesMap.set(id, handle);
          // Cache the handle for future use
          this.#cacheHandle(id, handle);
        });
      }
      
      // Merge cached and fetched handles
      cachedHandles.forEach((handle, id) => {
        productHandlesMap.set(id, handle);
      });
    
    console.log(`Found ${productHandlesMap.size} product handles (${cachedHandles.size} cached, ${productHandlesMap.size - cachedHandles.size} fetched)`);
    
    // Fetch individual product cards using section-rendering-product-card
    // This section includes full content (gallery, title, price) without needing blocks
    const productCardsPromises = productIds.map(async (productId) => {
      try {
        // Get handle from map, or try to construct URL
        let handle = productHandlesMap.get(String(productId));
        
        if (!handle) {
          console.warn(`No handle found for product ${productId}, skipping...`);
          return null;
        }
        
        // Build product URL with section_id parameter
        const productUrl = new URL(`/products/${handle}`, location.origin);
        productUrl.searchParams.set('section_id', 'section-rendering-product-card');
        
        console.log(`Fetching product card for ID ${productId} (handle: ${handle})...`);
        
        // Fetch using section-rendering-product-card which has full content
        const sectionHTML = await sectionRenderer.getSectionHTML('section-rendering-product-card', false, productUrl);
        
        if (!sectionHTML || sectionHTML.trim().length === 0) {
          console.warn(`No HTML returned for product ${productId}`);
          return null;
        }
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(sectionHTML, 'text/html');
        const productCard = doc.querySelector('product-card');
        
        if (!productCard) {
          console.warn(`No product-card found in HTML for product ${productId}`);
          return null;
        }
        
        // Check if card has full content
        const cardContent = productCard.querySelector('.product-card__content');
        const cardGallery = productCard.querySelector('.card-gallery');
        const hasFullContent = cardContent && cardContent.innerHTML.trim().length > 0 && 
                              cardGallery && cardGallery.innerHTML.trim().length > 0;
        
        console.log(`Product ${productId} card check:`, {
          hasProductCard: !!productCard,
          hasCardContent: !!cardContent,
          hasCardGallery: !!cardGallery,
          contentLength: cardContent?.innerHTML.trim().length || 0,
          galleryLength: cardGallery?.innerHTML.trim().length || 0,
          hasFullContent: hasFullContent,
          cardOuterHTMLLength: productCard.outerHTML.trim().length
        });
        
        if (!hasFullContent) {
          console.warn(`Product ${productId} card is incomplete. HTML preview:`, productCard.outerHTML.substring(0, 500));
          return null;
        }
        
        // Extract URL for productDataMap (we already have handle from the map)
        const link = productCard.querySelector('a[href*="/products/"]');
        const productUrlValue = link ? link.getAttribute('href') : null;
        
        // Check cache first for product data
        let productData = this.#getCachedProductData(productId);
        
        // If not in cache, extract from embedded script tag
        if (!productData) {
          const productJsonScript = doc.querySelector('script[type="application/json"][data-product-json]');
          if (productJsonScript) {
            try {
              productData = JSON.parse(productJsonScript.textContent);
              console.log(`[Recently Viewed] Extracted product data from HTML for ${productId}:`, {
                id: productData.id,
                title: productData.title,
                available: productData.available,
                variantsCount: productData.variants?.length || 0,
                optionsCount: productData.options?.length || 0
              });
              // Cache the extracted data
              this.#cacheProductData(productId, productData);
            } catch (error) {
              console.warn(`[Recently Viewed] Failed to parse product JSON for ${productId}:`, error);
            }
          } else {
            console.log(`[Recently Viewed] No product JSON script found in HTML for ${productId}, will extract from card after render`);
          }
        } else {
          console.log(`[Recently Viewed] Using cached product data for ${productId}`);
        }
        
        // Extract product title from HTML as fallback (if JSON not available)
        const productTitle = productCard.querySelector('.product-title-text, .text-block--product_title')?.textContent?.trim() || 
                            productCard.querySelector('a[href*="/products/"]')?.getAttribute('aria-label') ||
                            '';
        
        // Extract availability from price block or other indicators (if JSON not available)
        const priceBlock = productCard.querySelector('product-price');
        const isAvailable = productData ? productData.available : (priceBlock !== null);
        
        // Store in productDataMap with full product data
        if (!this.#productDataMap) {
          this.#productDataMap = new Map();
        }
        if (productId && handle) {
          const finalProductData = productData || {
            id: String(productId),
            title: productTitle,
            handle: handle,
            url: productUrlValue || `/products/${handle}`,
            available: isAvailable,
            variants: [],
            options: []
          };
          
          this.#productDataMap.set(String(productId), { 
            id: String(productId), 
            handle, 
            url: productUrlValue,
            product: finalProductData
          });
          
          // Cache the product data if we have complete data
          if (productData) {
            this.#cacheProductData(productId, productData);
          }
        }
        
        return { id: String(productId), html: productCard.outerHTML };
      } catch (error) {
        console.error(`Error fetching product card for ${productId}:`, error);
        return null;
      }
    });
    
    // Wait for all product cards to be fetched
    const productCardsHTML = (await Promise.all(productCardsPromises))
      .filter(card => card !== null);
    
    console.log(`Fetched ${productCardsHTML.length} product cards out of ${productIds.length} requested`);
      
    if (productCardsHTML.length === 0) {
      console.log('No valid product cards fetched');
      this.dataset.hasProducts = 'false';
      return;
    }

    // Render the carousel
    this.#renderCarousel(productCardsHTML, itemsPerView, columnsGap, iconsStyle);
    } catch (error) {
      console.error('Error fetching product cards:', error);
      this.dataset.hasProducts = 'false';
    }
  }

  /**
   * Get cached handles from localStorage
   * @param {string[]} productIds - Array of product IDs
   * @returns {Map<string, string>} Map of product ID to handle
   */
  #getCachedHandles(productIds) {
    const handlesMap = new Map();
    try {
      const cacheKey = 'recentlyViewedProductHandles';
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        const now = Date.now();
        // Filter out expired entries (older than 24 hours)
        const validEntries = Object.entries(parsed).filter(([_, data]) => {
          return data.timestamp && (now - data.timestamp) < (24 * 60 * 60 * 1000);
        });
        
        // Rebuild cache with only valid entries
        const validCache = {};
        validEntries.forEach(([id, data]) => {
          validCache[id] = data;
          if (productIds.includes(id)) {
            handlesMap.set(id, data.handle);
          }
        });
        
        // Update cache if we removed expired entries
        if (validEntries.length !== Object.keys(parsed).length) {
          localStorage.setItem(cacheKey, JSON.stringify(validCache));
        }
      }
    } catch (error) {
      console.warn('Error reading cached handles:', error);
    }
    return handlesMap;
  }

  /**
   * Cache a product handle in localStorage
   * @param {string} productId - Product ID
   * @param {string} handle - Product handle
   */
  #cacheHandle(productId, handle) {
    try {
      const cacheKey = 'recentlyViewedProductHandles';
      const cached = localStorage.getItem(cacheKey);
      const cache = cached ? JSON.parse(cached) : {};
      cache[String(productId)] = {
        handle: handle,
        timestamp: Date.now()
      };
      localStorage.setItem(cacheKey, JSON.stringify(cache));
    } catch (error) {
      console.warn('Error caching handle:', error);
    }
  }

  /**
   * Fetch product handles from search-results with caching and optimized parsing
   * @param {string[]} productIds - Array of product IDs to fetch handles for
   * @returns {Promise<Map<string, string>>} Map of product ID to handle
   */
  async #fetchHandlesFromSearch(productIds) {
    const handlesMap = new Map();
    
    if (productIds.length === 0) {
      return handlesMap;
    }

    try {
      // Create search URL
      const searchUrl = new URL(Theme.routes.search_url, location.origin);
      searchUrl.searchParams.set('q', productIds.map(id => `id:${id}`).join(' OR '));
      searchUrl.searchParams.set('resources[type]', 'product');
      const searchUrlString = searchUrl.toString();
      
      // Check cache first
      const cached = this.#searchResultsCache.get(searchUrlString);
      const now = Date.now();
      let searchSectionHTML = null;
      
      if (cached && (now - cached.timestamp) < RecentlyViewedProductsComponent.#CACHE_TTL) {
        console.log('Using cached search-results response');
        searchSectionHTML = cached.html;
      } else {
        // Fetch from API
        console.log(`Fetching handles for ${productIds.length} products from search-results...`);
        searchSectionHTML = await sectionRenderer.getSectionHTML('search-results', false, searchUrl);
        
        // Cache the response
        if (searchSectionHTML) {
          this.#searchResultsCache.set(searchUrlString, {
            html: searchSectionHTML,
            timestamp: now
          });
        }
      }
      
      if (searchSectionHTML) {
        // Optimized parsing: use regex to extract handles directly from HTML
        // Pattern: data-product-id="ID" ... href="/products/handle" (within same product item)
        // This regex looks for product ID followed by href within reasonable distance
        const productItemPattern = /data-product-id="(\d+)"[^>]*>[\s\S]{0,2000}?href="([^"]*\/products\/([^"?#]+))/gi;
        const matches = [...searchSectionHTML.matchAll(productItemPattern)];
        
        matches.forEach(match => {
          const id = match[1];
          const handle = match[3];
          if (id && handle && productIds.includes(id)) {
            handlesMap.set(String(id), handle);
            this.#cacheHandle(id, handle);
          }
        });
        
        // Fallback to DOM parsing if regex didn't find all handles
        if (handlesMap.size < productIds.length) {
          const missingIds = productIds.filter(id => !handlesMap.has(String(id)));
          console.log(`Regex found ${handlesMap.size}/${productIds.length} handles, using DOM parsing for ${missingIds.length} remaining...`);
          
          const parser = new DOMParser();
          const doc = parser.parseFromString(searchSectionHTML, 'text/html');
          const productItems = Array.from(doc.querySelectorAll('.product-grid__item[data-product-id]'));
          
          productItems.forEach((item) => {
            const id = item.dataset.productId || item.getAttribute('data-product-id');
            if (missingIds.includes(String(id)) && !handlesMap.has(String(id))) {
              const link = item.querySelector('a[href*="/products/"]');
              if (link && id) {
                const href = link.getAttribute('href');
                const handle = href ? href.split('/products/')[1]?.split('?')[0] : null;
                if (handle) {
                  handlesMap.set(String(id), handle);
                  this.#cacheHandle(id, handle);
                }
              }
            }
          });
        }
      }
    } catch (error) {
      console.warn('Error fetching product handles from search:', error);
    }
    
    return handlesMap;
  }

  /**
   * Load and render recently viewed products
   */
  async #loadProducts() {
    let viewedProducts = RecentlyViewed.getProducts();
    const maxProducts = RecentlyViewed.getMaxProducts();
    
    // Get current product ID and filter it out if we're on a product page
    const currentProductId = this.#getCurrentProductId();
    if (currentProductId) {
      viewedProducts = viewedProducts.filter(id => String(id) !== String(currentProductId));
      console.log('Filtered out current product from recently viewed:', currentProductId);
    }
    
    console.log('Recently viewed products IDs from localStorage:', viewedProducts);
    console.log('Number of products in localStorage:', viewedProducts.length);
    console.log('Max products setting:', maxProducts);
    
    if (viewedProducts.length === 0) {
      console.log('No recently viewed products found');
      this.dataset.hasProducts = 'false';
      this.dataset.loaded = 'true';
      return;
    }

    this.dataset.hasProducts = 'true';

    try {
      // Fetch products directly using section-rendering-product-card
      await this.#renderProductsFromMainCollection(viewedProducts);
      
      this.dataset.loaded = 'true';
    } catch (error) {
      console.error('Error loading recently viewed products:', error);
      this.dataset.hasProducts = 'false';
      this.dataset.loaded = 'true';
    }
  }

  /**
   * Intersection observer for lazy loading
   * @type {IntersectionObserver}
   */
  #intersectionObserver = new IntersectionObserver(
    (entries, observer) => {
      if (!entries[0]?.isIntersecting) return;
      observer.disconnect();
      this.#loadProducts();
    },
    { rootMargin: '0px 0px 400px 0px' }
  );

  connectedCallback() {
    this.#intersectionObserver.observe(this);
    
    // Clean up old cache entries on connect
    this.#cleanupCache();
    
    // Preload cached product data for recently viewed products
    const viewedProducts = RecentlyViewed.getProducts();
    if (viewedProducts.length > 0) {
      this.#loadCachedProductData(viewedProducts);
    }
    
    // Initialize max products setting from section
    const maxProducts = this.dataset.maxProducts;
    if (maxProducts) {
      RecentlyViewed.setMaxProducts(maxProducts);
      console.log(`Max products set to: ${maxProducts}`);
    }
    
    // Listen for storage changes to update when new products are viewed
    window.addEventListener('storage', this.#handleStorageChange);
    
    // Also listen for custom event if products are updated on same page
    document.addEventListener('recently-viewed-updated', this.#handleRecentlyViewedUpdate);
  }

  disconnectedCallback() {
    this.#intersectionObserver.disconnect();
    window.removeEventListener('storage', this.#handleStorageChange);
    document.removeEventListener('recently-viewed-updated', this.#handleRecentlyViewedUpdate);
    
    // Clean up cache when component is disconnected
    this.#cleanupCache();
  }

  /**
   * Clean up expired cache entries to prevent memory leaks
   */
  #cleanupCache() {
    const now = Date.now();
    const entriesToDelete = [];
    
    // Find expired entries
    this.#searchResultsCache.forEach((value, key) => {
      if ((now - value.timestamp) >= RecentlyViewedProductsComponent.#CACHE_TTL) {
        entriesToDelete.push(key);
      }
    });
    
    // Remove expired entries
    entriesToDelete.forEach(key => {
      this.#searchResultsCache.delete(key);
    });
    
    if (entriesToDelete.length > 0) {
      console.log(`Cleaned up ${entriesToDelete.length} expired cache entries`);
    }
    
    // Also clean up product data cache
    this.#cleanupProductDataCache();
  }

  /**
   * Load cached product data from localStorage for given product IDs
   * @param {string[]} productIds - Array of product IDs to load
   */
  #loadCachedProductData(productIds) {
    if (!this.#productDataMap) {
      this.#productDataMap = new Map();
    }
    
    try {
      const cached = localStorage.getItem(RecentlyViewedProductsComponent.#PRODUCT_DATA_CACHE_KEY);
      if (!cached) {
        return;
      }
      
      const parsed = JSON.parse(cached);
      const now = Date.now();
      let loadedCount = 0;
      
      productIds.forEach(productId => {
        const cachedEntry = parsed[String(productId)];
        if (cachedEntry && cachedEntry.timestamp) {
          // Check if cache is still valid
          if ((now - cachedEntry.timestamp) < RecentlyViewedProductsComponent.#PRODUCT_DATA_CACHE_TTL) {
            const productData = cachedEntry.data;
            if (productData) {
              // Only load if we don't already have it (to avoid overwriting fresh data)
              if (!this.#productDataMap.has(String(productId))) {
                // We need handle and url, try to get from cache or construct
                const handle = productData.handle || cachedEntry.handle;
                const url = productData.url || (handle ? `/products/${handle}` : null);
                
                this.#productDataMap.set(String(productId), {
                  id: String(productId),
                  handle: handle,
                  url: url,
                  product: productData
                });
                loadedCount++;
              }
            }
          }
        }
      });
      
      if (loadedCount > 0) {
        console.log(`Loaded ${loadedCount} product data entries from cache`);
      }
    } catch (error) {
      console.warn('Error loading cached product data:', error);
    }
  }

  /**
   * Get cached product data for a specific product ID
   * @param {string} productId - Product ID
   * @returns {object|null} Cached product data or null
   */
  #getCachedProductData(productId) {
    try {
      const cached = localStorage.getItem(RecentlyViewedProductsComponent.#PRODUCT_DATA_CACHE_KEY);
      if (!cached) {
        return null;
      }
      
      const parsed = JSON.parse(cached);
      const cachedEntry = parsed[String(productId)];
      
      if (cachedEntry && cachedEntry.timestamp) {
        const now = Date.now();
        // Check if cache is still valid
        if ((now - cachedEntry.timestamp) < RecentlyViewedProductsComponent.#PRODUCT_DATA_CACHE_TTL) {
          return cachedEntry.data;
        }
      }
    } catch (error) {
      console.warn(`Error getting cached product data for ${productId}:`, error);
    }
    
    return null;
  }

  /**
   * Cache product data in localStorage
   * @param {string} productId - Product ID
   * @param {object} productData - Product data object
   */
  #cacheProductData(productId, productData) {
    try {
      const cacheKey = RecentlyViewedProductsComponent.#PRODUCT_DATA_CACHE_KEY;
      const cached = localStorage.getItem(cacheKey);
      const cache = cached ? JSON.parse(cached) : {};
      
      // Only cache if we have complete data (with variants/options)
      if (productData && (productData.variants || productData.options)) {
        cache[String(productId)] = {
          data: productData,
          handle: productData.handle,
          timestamp: Date.now()
        };
        
        localStorage.setItem(cacheKey, JSON.stringify(cache));
        console.log(`Cached product data for ${productId}`);
      }
    } catch (error) {
      console.warn(`Error caching product data for ${productId}:`, error);
      // If storage is full, try to clean up old entries
      try {
        this.#cleanupProductDataCache();
        // Retry caching
        const cacheKey = RecentlyViewedProductsComponent.#PRODUCT_DATA_CACHE_KEY;
        const cached = localStorage.getItem(cacheKey);
        const cache = cached ? JSON.parse(cached) : {};
        cache[String(productId)] = {
          data: productData,
          handle: productData.handle,
          timestamp: Date.now()
        };
        localStorage.setItem(cacheKey, JSON.stringify(cache));
      } catch (retryError) {
        console.warn('Failed to cache product data after cleanup:', retryError);
      }
    }
  }

  /**
   * Clean up expired product data cache entries
   */
  #cleanupProductDataCache() {
    try {
      const cacheKey = RecentlyViewedProductsComponent.#PRODUCT_DATA_CACHE_KEY;
      const cached = localStorage.getItem(cacheKey);
      if (!cached) {
        return;
      }
      
      const parsed = JSON.parse(cached);
      const now = Date.now();
      const validCache = {};
      let removedCount = 0;
      
      // Keep only valid (non-expired) entries
      Object.entries(parsed).forEach(([id, entry]) => {
        if (entry && entry.timestamp) {
          if ((now - entry.timestamp) < RecentlyViewedProductsComponent.#PRODUCT_DATA_CACHE_TTL) {
            validCache[id] = entry;
          } else {
            removedCount++;
          }
        }
      });
      
      // Update cache if we removed entries
      if (removedCount > 0) {
        localStorage.setItem(cacheKey, JSON.stringify(validCache));
        console.log(`Cleaned up ${removedCount} expired product data cache entries`);
      }
    } catch (error) {
      console.warn('Error cleaning up product data cache:', error);
    }
  }

  /**
   * Handle storage change event (when localStorage is updated in another tab)
   */
  #handleStorageChange = (event) => {
    if (event.key === 'viewedProducts') {
      console.log('Storage changed, reloading products');
      this.dataset.loaded = 'false';
      this.#loadProducts();
    }
  };

  /**
   * Handle custom event when recently viewed products are updated on same page
   */
  #handleRecentlyViewedUpdate = () => {
    console.log('Recently viewed products updated, reloading');
    this.dataset.loaded = 'false';
    this.#loadProducts();
  };

  /**
   * Use resource-card from predictive-search as fallback
   * @param {Array<{id: string, element: HTMLElement, url: string, handle: string}>} productData - Array of product data
   * @param {string[]} [viewedProductsOrder] - Optional order from localStorage
   * @returns {Array<{id: string, html: string}>}
   */
  #useResourceCardsFromPredictiveSearch(productData, viewedProductsOrder = null) {
    console.log('Using resource-card from predictive-search as fallback');
    
    // Use the order from localStorage if provided, otherwise use productData order
    const orderToUse = viewedProductsOrder || productData.map(p => p.id);
    console.log('Resource-card fallback order:', orderToUse);
    
    return orderToUse.map((productId) => {
      // Find the matching product data
      const productInfo = productData.find(p => String(p.id) === String(productId));
      
      if (!productInfo) {
        console.warn(`Product ${productId} not found in productData`);
        return null;
      }
      
      const { element } = productInfo;
      try {
        // Get the resource-card from predictive search (has images, title, price)
        const resourceCard = element.querySelector('.resource-card') || element.querySelector('resource-card');
        
        if (!resourceCard) {
          console.log(`No resource-card found for product ${productId}`);
          return null;
        }
        
        const cardHTML = resourceCard.outerHTML;
        console.log(`Product ${productId} resource-card HTML length: ${cardHTML.length}`);
        
        // Wrap in product-card structure
        const productCardHTML = `
          <product-card class="product-card" data-product-id="${productId}" data-product-transition="false">
            ${cardHTML}
          </product-card>
        `;
        
        return { id: productId, html: productCardHTML };
      } catch (error) {
        console.error(`Error processing resource-card for ${productId}:`, error);
        return null;
      }
    }).filter(Boolean);
  }

  /**
   * Extract product cards HTML from product items
   * @param {HTMLElement[]} productItems - Array of product item elements
   * @returns {Array<{id: string, html: string}>}
   */
  #extractProductCards(productItems) {
    return productItems.map((item) => {
      const productId = item.dataset.productId || item.getAttribute('data-product-id');
      
      // Get the product-card element directly from the item
      const productCard = item.querySelector('product-card');
      
      if (!productCard) {
        console.warn(`Product ${productId} has no product-card element! Using item.innerHTML as fallback`);
        const productCardHTML = item.innerHTML;
        return { id: String(productId), html: productCardHTML };
      }
      
      // Check if product card has full content BEFORE extracting
      const cardContent = productCard.querySelector('.product-card__content');
      const cardGallery = productCard.querySelector('.card-gallery');
      const hasFullContent = cardContent && cardContent.innerHTML.trim().length > 0 && 
                            cardGallery && cardGallery.innerHTML.trim().length > 0;
      
      console.log(`Product ${productId} BEFORE extraction check:`, {
        hasProductCard: !!productCard,
        hasCardContent: !!cardContent,
        hasCardGallery: !!cardGallery,
        contentLength: cardContent?.innerHTML.trim().length || 0,
        galleryLength: cardGallery?.innerHTML.trim().length || 0,
        hasFullContent: hasFullContent,
        productCardInnerHTMLLength: productCard.innerHTML.trim().length,
        productCardOuterHTMLLength: productCard.outerHTML.trim().length
      });
      
      // If the product card doesn't have full content, it might not be fully rendered yet
      // Use the entire item's innerHTML which should include all blocks
      let productCardHTML;
      if (!hasFullContent) {
        console.warn(`Product ${productId} card appears incomplete. Using item.innerHTML instead.`);
        // Use the full item innerHTML which includes all content blocks
        productCardHTML = item.innerHTML;
      } else {
        // Use the product-card's outerHTML to get the complete element
        productCardHTML = productCard.outerHTML;
      }
      
      console.log(`Extracting product ${productId}, HTML length: ${productCardHTML.length}`);
      console.log(`Product ${productId} HTML preview:`, productCardHTML.substring(0, 800));
      
      // Extract handle and URL for productDataMap
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = productCardHTML;
      const link = tempDiv.querySelector('a[href*="/products/"]') || productCard.querySelector('a[href*="/products/"]');
      const productUrl = link ? link.getAttribute('href') : null;
      const handle = productUrl ? productUrl.split('/products/')[1]?.split('?')[0] : null;
      
      // Store in productDataMap for later use
      if (!this.#productDataMap) {
        this.#productDataMap = new Map();
      }
      if (productId && handle) {
        this.#productDataMap.set(String(productId), { id: String(productId), handle, url: productUrl });
      }
      
      // Verify the extracted HTML has content
      const extractedCard = tempDiv.querySelector('product-card');
      const extractedContent = extractedCard?.querySelector('.product-card__content');
      const extractedGallery = extractedCard?.querySelector('.card-gallery');
      
      console.log(`Product ${productId} AFTER extraction check:`, {
        hasExtractedCard: !!extractedCard,
        hasExtractedContent: !!extractedContent,
        hasExtractedGallery: !!extractedGallery,
        extractedContentLength: extractedContent?.innerHTML.trim().length || 0,
        extractedGalleryLength: extractedGallery?.innerHTML.trim().length || 0
      });
      
      if (!extractedContent || extractedContent.innerHTML.trim().length === 0) {
        console.error(`Product ${productId} extracted HTML has no content! Full HTML:`, productCardHTML);
      }
      
      return { id: String(productId), html: productCardHTML };
    }).filter(card => {
      // More lenient filter - just check if we have HTML
      if (!card || !card.html || card.html.trim().length === 0) {
        return false;
      }
      return true;
    });
  }

  /**
   * Render the carousel with product cards
   * @param {Array<{id: string, html: string}>} productCardsHTML - Array of product card HTML
   * @param {number} itemsPerView - Number of items per view
   * @param {number} columnsGap - Gap between columns
   * @param {string} iconsStyle - Icon style for arrows
   */
  #renderCarousel(productCardsHTML, itemsPerView, columnsGap, iconsStyle) {
    // Create list items - wrap each product card in resource-list__item structure
    const listItems = productCardsHTML.map(({ id, html }) => {
      return `
        <div class="resource-list__item" data-product-slider-item="true" data-product-id="${id}">
          ${html}
        </div>
      `;
    }).join('<!--@list/split-->');

    // Split into array
    const listItemsArray = listItems.split('<!--@list/split-->').filter(item => item.trim());

    // Create slides
    const slides = listItemsArray.map((item, index) => {
      return `
        <slideshow-slide index="${index}" class="resource-list__slide product-slider-slide">
          ${item}
        </slideshow-slide>
      `;
    }).join('');

    // Determine if we should show arrows
    // Show arrows if iconsStyle is not 'none' AND there are more products than items_per_view
    const showArrows = iconsStyle !== 'none' && listItemsArray.length > itemsPerView;
    const iconShape = this.dataset.iconsShape || 'none';
    
    console.log('Arrow visibility check:', {
      iconsStyle,
      iconShape,
      showArrows,
      productCount: listItemsArray.length,
      itemsPerView,
      shouldShow: listItemsArray.length > itemsPerView
    });
    
    // Generate timeline for slideshow (required by slideshow component)
    const timeline = Array.from({length: listItemsArray.length}, (_, i) => `--slide-${i}`).join(' ');

    // Create slideshow using the exact structure from slideshow snippet
    const timelineStyle = `--slideshow-timeline: ${timeline};`;
    
    const carouselHTML = `
      <div class="product-slider-wrapper">
        <div
          class="resource-list resource-list__carousel product-slider-carousel product-slider-desktop"
          style="--gutter-slide-width: 0px; --column-count: ${itemsPerView}; --resource-list-column-gap-desktop: ${columnsGap}px; --items-per-view: ${itemsPerView}; --columns-gap: ${columnsGap}px;"
          data-testid="recently-viewed-products-grid"
          data-items-per-view="${itemsPerView}"
        >
          <slideshow-component 
            ref="recentlyViewedProductsSlider" 
            class="resource-list__carousel"
            initial-slide="0"
            style="${timelineStyle}"
          >
            <slideshow-container ref="slideshowContainer">
              ${showArrows ? `
                <slideshow-arrows position="center" data-icon-style="${iconsStyle}" data-icon-shape="${iconShape}">
                  <button
                    type="button"
                    class="slideshow-control slideshow-control--previous slideshow-control--style-${iconsStyle}${iconShape !== 'none' ? ` slideshow-control--shape-${iconShape}` : ''} button button-unstyled button-unstyled--transparent${iconsStyle === 'blue_arrows' ? '' : iconsStyle.includes('chevron') ? '' : ' flip-x'}"
                    aria-label="Previous slide"
                    ref="previous"
                  >
                    <span class="svg-wrapper icon-${iconsStyle.includes('chevron') ? 'caret' : 'arrow'}">
                      ${iconsStyle.includes('chevron') ? `
                        <svg width="11" height="19" viewBox="0 0 11 19" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M9.36328 2.31563L1.26025 9.83979L9.36328 17.364" stroke="#7295BB" stroke-width="2.31515" stroke-linecap="square" stroke-linejoin="round"/>
                        </svg>
                      ` : iconsStyle === 'blue_arrows' ? `
                        <svg width="35" height="35" viewBox="0 0 35 35" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect x="-0.5" y="0.5" width="33.6973" height="33.6973" rx="16.8487" transform="matrix(-1 0 0 1 33.6973 0)" stroke="#7295BB"/>
                          <path d="M20.8486 23.8486L13.8486 17.3486L20.8486 10.8486" stroke="#7295BB" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                      ` : `
                        <svg width="39" height="39" viewBox="0 0 39 39" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="19.425" cy="19.425" r="19.175" transform="matrix(1 0 0 -1 0 38.85)" fill="black" fill-opacity="0.5" stroke="white" stroke-width="0.5"/>
                          <path d="M16.6504 12.2101L23.7607 20.0085L16.6504 27.807" stroke="white" stroke-width="1.83655"/>
                        </svg>
                      `}
                    </span>
                  </button>
                  <button
                    type="button"
                    class="slideshow-control slideshow-control--next slideshow-control--style-${iconsStyle}${iconShape !== 'none' ? ` slideshow-control--shape-${iconShape}` : ''} button button-unstyled button-unstyled--transparent${iconsStyle === 'blue_arrows' ? ' flip-x' : iconsStyle.includes('chevron') ? '' : ''}"
                    aria-label="Next slide"
                    ref="next"
                  >
                    <span class="svg-wrapper icon-${iconsStyle.includes('chevron') ? 'caret' : 'arrow'}">
                      ${iconsStyle.includes('chevron') ? `
                        <svg width="11" height="19" viewBox="0 0 11 19" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1.63672 16.6844L9.73975 9.16021L1.63672 1.63596" stroke="#7295BB" stroke-width="2.31515" stroke-linecap="square" stroke-linejoin="round"/>
                        </svg>
                      ` : iconsStyle === 'blue_arrows' ? `
                        <svg width="35" height="35" viewBox="0 0 35 35" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect x="-0.5" y="0.5" width="33.6973" height="33.6973" rx="16.8487" transform="matrix(-1 0 0 1 33.6973 0)" stroke="#7295BB"/>
                          <path d="M20.8486 23.8486L13.8486 17.3486L20.8486 10.8486" stroke="#7295BB" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                      ` : `
                        <svg width="39" height="39" viewBox="0 0 39 39" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="19.425" cy="19.425" r="19.175" transform="matrix(1 0 0 -1 0 38.85)" fill="black" fill-opacity="0.5" stroke="white" stroke-width="0.5"/>
                          <path d="M16.6504 12.2101L23.7607 20.0085L16.6504 27.807" stroke="white" stroke-width="1.83655"/>
                        </svg>
                      `}
                    </span>
                  </button>
                </slideshow-arrows>
              ` : ''}
              <slideshow-slides
                tabindex="-1"
                ref="scroller"
              >
                ${slides}
              </slideshow-slides>
            </slideshow-container>
          </slideshow-component>
        </div>
      </div>
    `;

    // Update the content
    const contentEl = this.querySelector('.recently-viewed-products-content');
    if (contentEl) {
      console.log('Inserting carousel HTML, length:', carouselHTML.length);
      console.log('Carousel HTML preview:', carouselHTML.substring(0, 500));
      
      // Use a more reliable method to insert HTML that allows custom elements to initialize
      // Create a temporary container to parse and upgrade custom elements
      const tempContainer = document.createElement('div');
      tempContainer.innerHTML = carouselHTML;
      
      // Upgrade any custom elements in the temp container
      const productCardsInTemp = tempContainer.querySelectorAll('product-card');
      productCardsInTemp.forEach(card => {
        // Force custom element upgrade if needed
        if (customElements.get('product-card') && card.constructor === HTMLElement) {
          // The browser should auto-upgrade, but ensure it happens
          console.log('Product card needs upgrade in temp container');
        }
      });
      
      // Clear and insert
      contentEl.innerHTML = '';
      contentEl.appendChild(tempContainer);
      
      // Move all children from temp container to contentEl (this preserves custom elements)
      while (tempContainer.firstChild) {
        contentEl.appendChild(tempContainer.firstChild);
      }
      
      // Use requestAnimationFrame to ensure DOM is ready, then process
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const slideshow = contentEl.querySelector('slideshow-component[ref="recentlyViewedProductsSlider"]');
          const scroller = contentEl.querySelector('slideshow-slides[ref="scroller"]');
          const slides = contentEl.querySelectorAll('slideshow-slide');
          const productCards = contentEl.querySelectorAll('product-card');
          const resourceListItems = contentEl.querySelectorAll('.resource-list__item');
          
          console.log('After HTML insertion:');
          console.log('- Slideshow found:', !!slideshow);
          console.log('- Scroller found:', !!scroller);
          console.log('- Slides count:', slides.length);
          console.log('- Resource list items count:', resourceListItems.length);
          console.log('- Product cards count:', productCards.length);
          
          // Ensure product cards are visible and properly initialized
          productCards.forEach((card, index) => {
            // Force visibility
            card.style.display = '';
            card.style.visibility = '';
            card.style.opacity = '';
            
            // Ensure card content is visible
            const cardContent = card.querySelector('.product-card__content');
            if (cardContent) {
              cardContent.style.display = '';
              cardContent.style.visibility = '';
            }
            
            // Ensure card gallery is visible
            const cardGallery = card.querySelector('.card-gallery');
            if (cardGallery) {
              cardGallery.style.display = '';
              cardGallery.style.visibility = '';
            }
          });
          
          // Also ensure resource-list__item containers are visible
          resourceListItems.forEach((item) => {
            item.style.display = '';
            item.style.visibility = '';
          });
          
          if (slideshow && scroller) {
            console.log('Slideshow structure is correct');
          } else {
            console.error('Slideshow structure is missing required elements!');
            console.log('Full HTML:', contentEl.innerHTML.substring(0, 1000));
          }
          
          // Wait for custom elements to be connected using MutationObserver
          // This will call #processAfterRender which handles all setup in one pass
          this.#waitForCustomElementsAndProcess();
        });
      });
    } else {
      console.error('Content element not found!');
    }
  }

  /**
   * Wait for custom elements to be ready and process
   */
  #waitForCustomElementsAndProcess() {
    const carousel = this.querySelector('[data-testid="recently-viewed-products-grid"]');
    if (!carousel) return;
    
    // Use requestAnimationFrame to ensure DOM is ready, then check and process
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const productCards = carousel.querySelectorAll('product-card');
        const slideshow = carousel.querySelector('slideshow-component[ref="recentlyViewedProductsSlider"]');
        
        // Check if we have product cards
        if (productCards.length === 0) {
          // Wait for product cards using MutationObserver
          const observer = new MutationObserver(() => {
            const cards = carousel.querySelectorAll('product-card');
            if (cards.length > 0) {
              observer.disconnect();
              this.#processAfterRender();
            }
          });
          
          observer.observe(carousel, { childList: true, subtree: true });
          
          // Fallback: process after max 300ms (reduced from 500ms)
          setTimeout(() => {
            observer.disconnect();
            this.#processAfterRender();
          }, 300);
        } else {
          // Product cards exist, process immediately
          this.#processAfterRender();
        }
      });
    });
  }

  /**
   * Process products after they're rendered
   * Combined optimized version that does setup, slider enable, and actions in one pass
   */
  async #processAfterRender() {
    // Wait for DOM to be ready
    await new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    });
    
    // Cache the carousel selector once
    const carousel = this.querySelector('[data-testid="recently-viewed-products-grid"]');
    if (!carousel) {
      console.warn('[Recently Viewed] Carousel not found in #processAfterRender()');
      return;
    }
    
    // Cache all selectors once
    const productCards = Array.from(carousel.querySelectorAll('product-card'));
    const productItems = Array.from(carousel.querySelectorAll('[data-product-slider-item="true"]'));
    const cardGalleries = Array.from(carousel.querySelectorAll('.card-gallery'));
    
    console.log(`[Recently Viewed] Processing ${productCards.length} product cards, ${productItems.length} items, ${cardGalleries.length} galleries`);
    
    // Process all products in one pass
    await this.#processAllProductsInOnePass(carousel, productCards, productItems, cardGalleries);
    
    // Initialize slideshow
    this.#initializeSlideshow();
  }

  /**
   * Process all products in a single optimized pass
   * Combines setupProductCards, enableProductCardImageSliders, and addProductActions
   * @param {HTMLElement} carousel - The carousel container
   * @param {HTMLElement[]} productCards - Array of product-card elements
   * @param {HTMLElement[]} productItems - Array of product item elements
   * @param {HTMLElement[]} cardGalleries - Array of card-gallery elements
   */
  async #processAllProductsInOnePass(carousel, productCards, productItems, cardGalleries) {
    const quickAddEnabled = this.dataset.quickAdd !== 'false';
    
    // Create a map of productId -> {card, item, gallery} for efficient lookup
    const productMap = new Map();
    
    // Map product cards by ID
    productCards.forEach(card => {
      const productId = card.getAttribute('data-product-id');
      if (productId) {
        if (!productMap.has(productId)) {
          productMap.set(productId, {});
        }
        productMap.get(productId).card = card;
      }
    });
    
    // Map product items by ID
    productItems.forEach(item => {
      const productId = item.getAttribute('data-product-id');
      if (productId) {
        if (!productMap.has(productId)) {
          productMap.set(productId, {});
        }
        productMap.get(productId).item = item;
      }
    });
    
    // Map card galleries by ID
    cardGalleries.forEach(gallery => {
      const productId = gallery.getAttribute('data-product-id');
      if (productId) {
        if (!productMap.has(productId)) {
          productMap.set(productId, {});
        }
        productMap.get(productId).gallery = gallery;
      }
    });
    
    // Process all products in parallel
    const processPromises = Array.from(productMap.entries()).map(async ([productId, elements]) => {
      const { card, item, gallery } = elements;
      
      // 1. Setup product card attributes (from setupProductCards)
      if (card) {
        card.setAttribute('data-collection-page', 'true');
        card.setAttribute('data-view-product-button-enabled', 'true');
        card.setAttribute('data-view-product-button-setting', 'true');
      }
      
      if (item) {
        item.setAttribute('data-view-product-button-setting', 'true');
        item.setAttribute('data-view-product-button-enabled', 'true');
      }
      
      // 2. Enable product card image sliders (from enableProductCardImageSliders)
      if (gallery) {
        await this.#processCardGallery(gallery, productId);
      }
      
      // 3. Add product actions (from addProductActions)
      if (quickAddEnabled && item) {
        await this.#processProductActions(item, productId, card);
      }
    });
    
    await Promise.all(processPromises);
    console.log(`[Recently Viewed] Completed processing ${productMap.size} products in one pass`);
  }

  /**
   * Process a single card gallery (slider enablement)
   * @param {HTMLElement} cardGallery - The card-gallery element
   * @param {string} productId - Product ID
   */
  async #processCardGallery(cardGallery, productId) {
    const slideshowComponent = cardGallery.querySelector('slideshow-component');
    if (!slideshowComponent) {
      return;
    }

    const slides = slideshowComponent.querySelectorAll('slideshow-slide');
    const slidesContainer = slideshowComponent.querySelector('slideshow-slides');
    
    if (!slidesContainer) {
      return;
    }

    // Check if carousel is disabled
    const isDisabled = slideshowComponent.hasAttribute('disabled') || slideshowComponent.getAttribute('disabled') === 'true';
    
    // If disabled, remove disabled attribute to enable scrolling
    if (isDisabled) {
      slideshowComponent.removeAttribute('disabled');
    }

    // Check visible slides count
    const visibleSlides = Array.from(slides).filter(slide => {
      const isHidden = slide.hasAttribute('hidden') || 
                      slide.getAttribute('aria-hidden') === 'true' ||
                      window.getComputedStyle(slide).display === 'none';
      return !isHidden;
    });

    // If only 1 visible slide, try to make all slides visible or fetch additional images
    if (visibleSlides.length <= 1 && slides.length > 1) {
      // Make all hidden slides visible for scrolling
      slides.forEach((slide, index) => {
        if (index > 0 && (slide.hasAttribute('hidden') || slide.getAttribute('aria-hidden') === 'true')) {
          slide.removeAttribute('hidden');
          slide.setAttribute('aria-hidden', 'false');
          slide.style.display = '';
        }
      });
    } else if (visibleSlides.length === 1 && slides.length === 1 && productId) {
      // Only 1 slide exists - fetch product media and add more slides
      await this.#fetchAndAddProductImages(cardGallery, slideshowComponent, productId);
    }

    // Ensure scrolling is enabled on slides container
    slidesContainer.style.overflowX = 'auto';
    slidesContainer.style.scrollSnapType = 'x mandatory';
    slidesContainer.style.webkitOverflowScrolling = 'touch';
    slidesContainer.style.scrollBehavior = 'smooth';
    
    // Ensure all slides have proper width for scrolling
    const allSlides = slideshowComponent.querySelectorAll('slideshow-slide');
    allSlides.forEach((slide) => {
      slide.style.flexShrink = '0';
      slide.style.flexBasis = '100%';
    });
  }

  /**
   * Process product actions for a single product
   * @param {HTMLElement} item - Product item element
   * @param {string} productId - Product ID
   * @param {HTMLElement|null} productCard - Product card element (optional, will be found if not provided)
   */
  async #processProductActions(item, productId, productCard = null) {
    // Check if actions already exist
    const existingActions = item.querySelector('.product-card-actions');
    if (existingActions) {
      return;
    }

    // Cache selectors - find card and content once
    if (!productCard) {
      productCard = item.querySelector('product-card');
    }
    
    let cardContent = productCard?.querySelector('.product-card__content');
    
    // If no product-card element but content exists directly, look for content in item
    if (!cardContent) {
      cardContent = item.querySelector('.product-card__content');
    }
    
    // Fallback: try resource-card structure
    if (!cardContent) {
      const resourceCard = item.querySelector('.resource-card');
      if (resourceCard) {
        cardContent = resourceCard.querySelector('.resource-card__content');
      }
    }

    // Also check if item itself is the content container
    if (!cardContent && item.classList.contains('product-card__content')) {
      cardContent = item;
    }

    if (!cardContent) {
      return;
    }
    
    // If we found cardContent but no productCard, try to find parent product-card
    if (!productCard && cardContent) {
      productCard = cardContent.closest('product-card');
    }

    // Ensure productDataMap is initialized
    if (!this.#productDataMap) {
      this.#productDataMap = new Map();
    }
    
    // Get product data from stored map (already extracted from HTML, no need to fetch)
    const storedData = this.#productDataMap.get(String(productId));
    let product = storedData?.product;
    let handle = storedData?.handle;
    
    // If product data not in map, try to extract from card or item
    if (!product || !handle) {
      // Try to extract handle from card
      if (!handle) {
        handle = this.#extractHandleFromCard(productCard || item);
      }
      
      // Try to extract product JSON from embedded script in the rendered HTML
      if (!product && (productCard || item)) {
        // Check cache first
        product = this.#getCachedProductData(productId);
        
        if (!product) {
          const cardElement = productCard || item;
          const productJsonScript = cardElement.querySelector('script[type="application/json"][data-product-json]');
          if (productJsonScript) {
            try {
              product = JSON.parse(productJsonScript.textContent);
              // Cache the extracted data
              if (product && product.variants) {
                this.#cacheProductData(productId, product);
              }
            } catch (error) {
              console.warn(`[Recently Viewed] Product ${productId}: Failed to parse product JSON:`, error);
            }
          }
        }
      }
      
      // If still no product data, construct minimal product object from available info
      if (!product && handle) {
        const link = (productCard || item).querySelector('a[href*="/products/"]');
        const url = link ? link.getAttribute('href') : `/products/${handle}`;
        const title = productCard?.querySelector('.product-title-text, .text-block--product_title')?.textContent?.trim() || '';
        const priceBlock = productCard?.querySelector('product-price');
        const available = priceBlock !== null;
        
        product = {
          id: String(productId),
          title: title,
          handle: handle,
          url: url,
          available: available,
          variants: [],
          options: []
        };
      }
      
      // Update map with extracted data
      if (product && handle) {
        const link = (productCard || item).querySelector('a[href*="/products/"]');
        const url = link ? link.getAttribute('href') : null;
        this.#productDataMap.set(String(productId), { 
          id: String(productId), 
          handle, 
          url,
          product: product
        });
        
        // Cache the product data if we have complete data
        if (product.variants && product.variants.length > 0) {
          this.#cacheProductData(productId, product);
        }
      }
    }
    
    if (!product) {
      return;
    }
    
    // Check if product is available - actions only show for available products
    if (!product.available) {
      return;
    }

    if (!product.variants || product.variants.length === 0) {
      return;
    }

    // Ensure product-card has the data-view-product-button-setting attribute BEFORE inserting actions
    if (!productCard && cardContent) {
      productCard = cardContent.closest('product-card');
    }
    
    if (productCard) {
      // Set attribute BEFORE inserting actions so CSS can match
      productCard.setAttribute('data-view-product-button-setting', 'true');
      productCard.setAttribute('data-view-product-button-enabled', 'true');
      productCard.setAttribute('data-collection-page', 'true');
      
      // Ensure product-card has a link with ref="productCardLink" for quick-add to work
      const productHandle = product.handle || this.#extractHandleFromCard(productCard) || '';
      const productUrl = product.url || (productHandle ? `/products/${productHandle}` : '');
      
      let productCardLink = productCard.querySelector('a[ref="productCardLink"]') || 
                            productCard.querySelector('a.product-card__link') ||
                            productCard.querySelector('a[href*="/products/"]');
      
      if (!productCardLink && productUrl) {
        // If no link exists, create one
        productCardLink = document.createElement('a');
        productCardLink.href = productUrl;
        productCardLink.className = 'product-card__link';
        productCardLink.setAttribute('ref', 'productCardLink');
        productCardLink.innerHTML = '<span class="visually-hidden">' + (product.title || 'Product') + '</span>';
        
        // Insert at the beginning of the product-card (before cardContent)
        if (cardContent && cardContent.parentElement === productCard) {
          productCard.insertBefore(productCardLink, cardContent);
        } else if (productCard.firstChild) {
          productCard.insertBefore(productCardLink, productCard.firstChild);
        } else {
          productCard.appendChild(productCardLink);
        }
      } else if (productCardLink) {
        // Ensure the link has the ref attribute if it doesn't
        if (!productCardLink.hasAttribute('ref')) {
          productCardLink.setAttribute('ref', 'productCardLink');
        }
        // Update href if it's empty or incorrect
        if (productUrl && (!productCardLink.href || productCardLink.href === window.location.href)) {
          productCardLink.href = productUrl;
        }
      }
    } else {
      // If no product-card element, set attribute on the item itself for CSS targeting
      item.setAttribute('data-view-product-button-setting', 'true');
      item.setAttribute('data-view-product-button-enabled', 'true');
    }
    
    // Generate product-card-actions element
    const sectionId = this.dataset.sectionId;
    const actions = this.#generateProductCardActions(product, sectionId);
    
    if (!actions) {
      return;
    }
    
    // Find price block and insert after it
    const priceBlock = cardContent.querySelector('product-price') || cardContent.querySelector('.price-snippet');
    
    if (priceBlock) {
      priceBlock.insertAdjacentElement('afterend', actions);
    } else {
      cardContent.appendChild(actions);
    }
  }

  /**
   * Initialize the slideshow component
   */
  #initializeSlideshow() {
    const carousel = this.querySelector('[data-testid="recently-viewed-products-grid"]');
    if (!carousel) {
      console.log('Carousel not found');
      return;
    }

    const slideshow = carousel.querySelector('slideshow-component[ref="recentlyViewedProductsSlider"]');
    if (!slideshow) {
      console.log('Slideshow component not found');
      return;
    }

    // Wait for slideshow to be fully connected and initialized using requestAnimationFrame
    if (!slideshow.isConnected || !slideshow.refs?.scroller) {
      console.log('Slideshow not ready yet, waiting...');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (slideshow.isConnected && slideshow.refs?.scroller) {
            this.#initializeSlideshow();
          } else {
            // Fallback: try once more using requestAnimationFrame
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                if (slideshow.isConnected && slideshow.refs?.scroller) {
                  this.#initializeSlideshow();
                }
              });
            });
          }
        });
      });
      return;
    }

    const itemsPerView = parseInt(carousel.getAttribute('data-items-per-view')) || 4;
    const previousBtn = slideshow.querySelector('slideshow-arrows .slideshow-control--previous');
    const nextBtn = slideshow.querySelector('slideshow-arrows .slideshow-control--next');
    const slides = Array.from(slideshow.querySelectorAll('slideshow-slide'));
    const scroller = slideshow.refs.scroller;

    console.log('Initializing slideshow:', {
      itemsPerView,
      slidesCount: slides.length,
      hasPreviousBtn: !!previousBtn,
      hasNextBtn: !!nextBtn,
      hasScroller: !!scroller
    });

    if (!previousBtn || !nextBtn || slides.length === 0 || !scroller) {
      console.log('Missing required elements for slideshow initialization');
      return;
    }

    const totalSlides = slides.length;
    const maxIndex = Math.max(0, totalSlides - itemsPerView);

    // Calculate scroll distance per item
    const getScrollDistance = () => {
      if (slides.length === 0) return 0;
      const firstSlide = slides[0];
      const slideWidth = firstSlide.offsetWidth;
      const gap = parseInt(getComputedStyle(scroller).gap) || 8;
      return slideWidth + gap;
    };

    // Update arrow visibility based on scroll position
    const updateArrowVisibility = () => {
      const currentScroll = scroller.scrollLeft;
      const maxScroll = scroller.scrollWidth - scroller.clientWidth;
      const threshold = 5; // Small threshold to account for rounding

      // Show/hide previous (left) arrow
      if (currentScroll <= threshold) {
        // At the start - hide previous arrow
        previousBtn.setAttribute('disabled', '');
        previousBtn.style.opacity = '0.3';
        previousBtn.style.pointerEvents = 'none';
      } else {
        // Not at start - show previous arrow
        previousBtn.removeAttribute('disabled');
        previousBtn.style.opacity = '1';
        previousBtn.style.pointerEvents = 'auto';
      }

      // Show/hide next (right) arrow
      if (currentScroll >= maxScroll - threshold) {
        // At the end - hide next arrow
        nextBtn.setAttribute('disabled', '');
        nextBtn.style.opacity = '0.3';
        nextBtn.style.pointerEvents = 'none';
      } else {
        // Not at end - show next arrow
        nextBtn.removeAttribute('disabled');
        nextBtn.style.opacity = '1';
        nextBtn.style.pointerEvents = 'auto';
      }

      console.log('Arrow visibility updated:', {
        currentScroll,
        maxScroll,
        previousVisible: currentScroll > threshold,
        nextVisible: currentScroll < maxScroll - threshold
      });
    };

    // Override previous button
    previousBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const scrollDistance = getScrollDistance() * itemsPerView;
      const currentScroll = scroller.scrollLeft;
      const newScroll = Math.max(0, currentScroll - scrollDistance);
      
      console.log('Previous clicked:', { currentScroll, newScroll, scrollDistance });
      
      scroller.scrollTo({
        left: newScroll,
        behavior: 'smooth'
      });

      // Update arrow visibility after scroll using requestAnimationFrame
      requestAnimationFrame(() => {
        requestAnimationFrame(updateArrowVisibility);
      });
    }, true);

    // Override next button
    nextBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const scrollDistance = getScrollDistance() * itemsPerView;
      const currentScroll = scroller.scrollLeft;
      const maxScroll = scroller.scrollWidth - scroller.clientWidth;
      const newScroll = Math.min(maxScroll, currentScroll + scrollDistance);
      
      console.log('Next clicked:', { currentScroll, newScroll, maxScroll, scrollDistance });
      
      scroller.scrollTo({
        left: newScroll,
        behavior: 'smooth'
      });

      // Update arrow visibility after scroll using requestAnimationFrame
      requestAnimationFrame(() => {
        requestAnimationFrame(updateArrowVisibility);
      });
    }, true);

    // Update arrow visibility on scroll
    scroller.addEventListener('scroll', () => {
      updateArrowVisibility();
    }, { passive: true });

    // Initial arrow visibility update
    updateArrowVisibility();

    console.log('Slideshow initialization complete');
  }

  /**
   * Setup product cards like product-slider does
   */
  #setupProductCards() {
    const carousel = this.querySelector('[data-testid="recently-viewed-products-grid"]');
    if (!carousel) {
      console.warn('[Recently Viewed] Carousel not found in #setupProductCards()');
      return;
    }

    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      const productCards = carousel.querySelectorAll('product-card');
      console.log(`[Recently Viewed] #setupProductCards: Found ${productCards.length} product cards`);
      
      productCards.forEach((card) => {
        card.setAttribute('data-collection-page', 'true');
        // Enable view product button
        card.setAttribute('data-view-product-button-enabled', 'true');
        card.setAttribute('data-view-product-button-setting', 'true');
        console.log(`[Recently Viewed] Set data-view-product-button-setting on product card ${card.getAttribute('data-product-id') || 'unknown'}`);
      });
      
      // Also set attribute on items themselves as fallback
      const productItems = carousel.querySelectorAll('[data-product-slider-item="true"]');
      productItems.forEach((item) => {
        item.setAttribute('data-view-product-button-setting', 'true');
        item.setAttribute('data-view-product-button-enabled', 'true');
      });
    });
  }

  /**
   * Enable product card image sliders for recently viewed products
   * This ensures the carousel works even when product_card_carousel is disabled globally
   * The slider should work like it does in product-list section
   */
  async #enableProductCardImageSliders() {
    const carousel = this.querySelector('[data-testid="recently-viewed-products-grid"]');
    if (!carousel) {
      console.log('Carousel not found for enabling product card sliders');
      return;
    }

    // Wait for DOM to be ready using requestAnimationFrame
    await new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    });

    // Find all card-gallery elements in the recently viewed section
    const cardGalleries = carousel.querySelectorAll('.card-gallery');
    
    console.log(`Found ${cardGalleries.length} card-gallery elements in recently viewed section`);
    
    if (cardGalleries.length === 0) {
      console.warn('No card-gallery elements found! Product cards might not be rendering with gallery.');
      // Check if product cards are rendered at all
      const productCards = carousel.querySelectorAll('product-card');
      console.log(`Found ${productCards.length} product-card elements`);
      
      if (productCards.length > 0) {
        // Product cards exist but no card-gallery - this means cards aren't using card-gallery block
        // They might be using resource-card instead which doesn't have slider
        console.warn('Product cards found but no card-gallery - products might be using resource-card instead of full product card structure');
      }
      return;
    }
    
    for (const cardGallery of cardGalleries) {
      const slideshowComponent = cardGallery.querySelector('slideshow-component');
      if (!slideshowComponent) {
        console.log('No slideshow-component found in card-gallery');
        continue;
      }

      const slides = slideshowComponent.querySelectorAll('slideshow-slide');
      const slidesContainer = slideshowComponent.querySelector('slideshow-slides');
      
      if (!slidesContainer) {
        console.log('No slideshow-slides container found');
        continue;
      }

      // Check if carousel is disabled
      const isDisabled = slideshowComponent.hasAttribute('disabled') || slideshowComponent.getAttribute('disabled') === 'true';
      
      // Get product ID
      const productId = cardGallery.getAttribute('data-product-id');
      console.log(`Processing product ${productId}, disabled: ${isDisabled}, slides: ${slides.length}`);

      // If disabled, remove disabled attribute to enable scrolling
      if (isDisabled) {
        slideshowComponent.removeAttribute('disabled');
        console.log(`Removed disabled attribute from product ${productId}`);
      }

      // Check visible slides count
      const visibleSlides = Array.from(slides).filter(slide => {
        const isHidden = slide.hasAttribute('hidden') || 
                        slide.getAttribute('aria-hidden') === 'true' ||
                        window.getComputedStyle(slide).display === 'none';
        return !isHidden;
      });

      console.log(`Product ${productId}: ${visibleSlides.length} visible slides out of ${slides.length} total`);

      // If only 1 visible slide, try to make all slides visible or fetch additional images
      if (visibleSlides.length <= 1 && slides.length > 1) {
        // Make all hidden slides visible for scrolling
        slides.forEach((slide, index) => {
          if (index > 0 && (slide.hasAttribute('hidden') || slide.getAttribute('aria-hidden') === 'true')) {
            slide.removeAttribute('hidden');
            slide.setAttribute('aria-hidden', 'false');
            slide.style.display = '';
            console.log(`Made slide ${index} visible for product ${productId}`);
          }
        });
      } else if (visibleSlides.length === 1 && slides.length === 1 && productId) {
        // Only 1 slide exists - fetch product media and add more slides
        // This happens when product_card_carousel is disabled globally and only 1 image is rendered
        console.log(`Only 1 slide for product ${productId}, fetching additional images...`);
        await this.#fetchAndAddProductImages(cardGallery, slideshowComponent, productId);
      }

      // Ensure scrolling is enabled on slides container (CSS should handle this, but enforce it)
      slidesContainer.style.overflowX = 'auto';
      slidesContainer.style.scrollSnapType = 'x mandatory';
      slidesContainer.style.webkitOverflowScrolling = 'touch';
      slidesContainer.style.scrollBehavior = 'smooth';
      
      // Ensure all slides have proper width for scrolling
      const allSlides = slideshowComponent.querySelectorAll('slideshow-slide');
      allSlides.forEach((slide) => {
        slide.style.flexShrink = '0';
        slide.style.flexBasis = '100%';
        slide.style.width = '100%';
        slide.style.minWidth = '100%';
        slide.style.scrollSnapAlign = 'start';
        
        // Make sure hidden slides are visible for scrolling
        if (slide.hasAttribute('hidden')) {
          slide.removeAttribute('hidden');
        }
        if (slide.getAttribute('aria-hidden') === 'true') {
          slide.setAttribute('aria-hidden', 'false');
        }
      });

      const finalVisibleCount = Array.from(allSlides).filter(s => 
        window.getComputedStyle(s).display !== 'none' && 
        s.getAttribute('aria-hidden') !== 'true'
      ).length;

      console.log(`Enabled slider for product ${productId || 'unknown'}, total slides: ${allSlides.length}, visible: ${finalVisibleCount}`);
    }
  }

  /**
   * Fetch product media and add additional slides to card gallery
   * This is needed when product_card_carousel is disabled globally, so only 1 image is rendered
   */
  async #fetchAndAddProductImages(cardGallery, slideshowComponent, productId) {
    try {
      // Get product handle from stored data
      const productData = this.#productDataMap?.get(productId);
      if (!productData || !productData.handle) {
        console.log(`No product data or handle found for product ${productId}`);
        return;
      }

      const handle = productData.handle;
      
      // Fetch product JSON data
      const productUrl = `/products/${handle}`;
      const response = await fetch(`${productUrl}?view=json`);
      if (!response.ok) {
        console.log(`Failed to fetch product data for ${handle}`);
        return;
      }

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Try to find product JSON data
      const jsonScript = doc.querySelector('script[type="application/json"][data-product-json]');
      if (!jsonScript) {
        console.log(`No product JSON found for ${handle}`);
        return;
      }

        const product = JSON.parse(jsonScript.textContent);
        
        // Handle different product JSON structures - try multiple ways to get media
        let productMedia = product.media || product.images || [];
        
        // If media is not in the JSON, try to extract from product HTML
        if (!productMedia || productMedia.length === 0) {
          // Try to find media in the product page HTML
          const productGallery = doc.querySelector('media-gallery, .product-media-gallery, .card-gallery');
          if (productGallery) {
            const galleryImages = productGallery.querySelectorAll('img[src*="shopify"], img[data-src*="shopify"]');
            if (galleryImages.length > 0) {
              productMedia = Array.from(galleryImages).map(img => ({
                src: img.src || img.dataset.src,
                id: img.dataset.mediaId || Math.random().toString()
              }));
            }
          }
        }
        
        if (!productMedia || productMedia.length <= 1) {
          console.log(`Product ${productId} has only ${productMedia?.length || 0} images - cannot add slider`);
          return;
        }

        const slidesContainer = slideshowComponent.querySelector('slideshow-slides');
        if (!slidesContainer) return;

        // Get existing slide as template
        const firstSlide = slidesContainer.querySelector('slideshow-slide');
        if (!firstSlide) return;

        // Get existing media IDs to avoid duplicates
        const existingMediaIds = new Set();
        Array.from(slidesContainer.querySelectorAll('slideshow-slide')).forEach(slide => {
          const mediaId = slide.getAttribute('slide-id');
          if (mediaId) existingMediaIds.add(mediaId);
        });

        // Get the first slide's image container structure
        const firstMediaContainer = firstSlide.querySelector('.product-media-container');
        if (!firstMediaContainer) return;

        // Add slides for remaining media (up to 5 total including the first one)
        const maxSlides = 5;
        let addedCount = 0;

      for (let i = 1; i < Math.min(productMedia.length, maxSlides); i++) {
        const media = productMedia[i];
        const mediaId = String(media.id || media.media_id || i);

        if (existingMediaIds.has(mediaId)) continue;

        // Try different ways to get the media URL
        let mediaUrl = null;
        if (media.preview_image && media.preview_image.src) {
          mediaUrl = media.preview_image.src;
        } else if (media.src) {
          mediaUrl = media.src;
        } else if (media.url) {
          mediaUrl = media.url;
        } else if (typeof media === 'string') {
          mediaUrl = media;
        }
        
        if (!mediaUrl) continue;

        // Clone the first slide structure
        const newSlide = firstSlide.cloneNode(true);
        newSlide.setAttribute('slide-id', mediaId);
        newSlide.setAttribute('index', i);
        newSlide.setAttribute('aria-hidden', 'false');
        newSlide.removeAttribute('hidden');
        newSlide.style.display = '';

        // Update image src
        const img = newSlide.querySelector('img');
        const picture = newSlide.querySelector('picture');
        
        if (img) {
          img.src = mediaUrl;
          img.srcset = '';
          img.alt = product.title || '';
        } else if (picture) {
          const pictureImg = picture.querySelector('img');
          if (pictureImg) {
            pictureImg.src = mediaUrl;
            pictureImg.srcset = '';
            pictureImg.alt = product.title || '';
          }
        }

        slidesContainer.appendChild(newSlide);
        existingMediaIds.add(mediaId);
        addedCount++;

        console.log(`Added slide ${i + 1} for product ${productId}`);
      }

      if (addedCount > 0) {
        console.log(`Added ${addedCount} additional slides for product ${productId}`);
        
        // Re-enable scrolling now that we have multiple slides
        slidesContainer.style.overflowX = 'auto';
        slidesContainer.style.scrollSnapType = 'x mandatory';
        slidesContainer.style.webkitOverflowScrolling = 'touch';
      }
    } catch (error) {
      console.error(`Error fetching and adding images for product ${productId}:`, error);
    }
  }

  /**
   * Add product-card-actions to each product card
   * Fetches product data efficiently using product handles and JSON endpoints
   */
  async #addProductActions() {
    console.log('[Recently Viewed] Starting #addProductActions()');
    
    const carousel = this.querySelector('[data-testid="recently-viewed-products-grid"]');
    if (!carousel) {
      console.error('[Recently Viewed] Carousel not found!');
      return;
    }

    const quickAddEnabled = this.dataset.quickAdd !== 'false';
    if (!quickAddEnabled) {
      console.log('[Recently Viewed] Quick add is disabled in section settings, skipping product actions');
      return;
    }

    // Wait for DOM to be ready using requestAnimationFrame
    await new Promise(resolve => {
      requestAnimationFrame(resolve);
    });

    const productItems = Array.from(carousel.querySelectorAll('[data-product-slider-item="true"]'));
    console.log(`[Recently Viewed] Found ${productItems.length} product items`);
    
    if (productItems.length === 0) {
      console.warn('[Recently Viewed] No product items found!');
      return;
    }

    const sectionId = this.dataset.sectionId;
    console.log(`[Recently Viewed] Section ID: ${sectionId}`);
    
    // Fetch product data for all products in parallel using product handles
    const productPromises = productItems.map(async (item) => {
      const productId = item.getAttribute('data-product-id');
      if (!productId) {
        console.warn('[Recently Viewed] Product item missing data-product-id attribute');
        return null;
      }

      // Check if actions already exist
      const existingActions = item.querySelector('.product-card-actions');
      if (existingActions) {
        console.log(`[Recently Viewed] Product ${productId} already has actions`);
        return null;
      }

      // Check for both product-card and resource-card structures
      let productCard = item.querySelector('product-card');
      let cardContent = productCard?.querySelector('.product-card__content');
      
      // If no product-card element but content exists directly, look for content in item
      if (!cardContent) {
        cardContent = item.querySelector('.product-card__content');
      }
      
      // Fallback: try resource-card structure
      if (!cardContent) {
        const resourceCard = item.querySelector('.resource-card');
        if (resourceCard) {
          cardContent = resourceCard.querySelector('.resource-card__content');
          console.log(`[Recently Viewed] Product ${productId} using resource-card structure`);
        }
      }

      // Also check if item itself is the content container
      if (!cardContent && item.classList.contains('product-card__content')) {
        cardContent = item;
        console.log(`[Recently Viewed] Product ${productId}: Item itself is the card content`);
      }

      if (!cardContent) {
        console.warn(`[Recently Viewed] Product ${productId}: No card content found`, {
          hasProductCard: !!productCard,
          hasResourceCard: !!item.querySelector('.resource-card'),
          itemClasses: item.className,
          itemHTML: item.outerHTML.substring(0, 300)
        });
        return null;
      }
      
      // If we found cardContent but no productCard, try to find parent product-card
      if (!productCard && cardContent) {
        productCard = cardContent.closest('product-card');
      }
      
      console.log(`[Recently Viewed] Product ${productId}: Found card structure`, {
        hasProductCard: !!productCard,
        hasCardContent: !!cardContent,
        cardContentClasses: cardContent.className
      });

      // Ensure productDataMap is initialized
      if (!this.#productDataMap) {
        this.#productDataMap = new Map();
      }
      
      // Get product data from stored map (already extracted from HTML, no need to fetch)
      const storedData = this.#productDataMap.get(String(productId));
      let product = storedData?.product;
      let handle = storedData?.handle;
      
      // If product data not in map, try to extract from card or item
      if (!product || !handle) {
        console.log(`[Recently Viewed] Product ${productId}: Data not in map, extracting from card...`);
        
        // Try to extract handle from card
        if (!handle) {
          handle = this.#extractHandleFromCard(productCard || item);
        }
        
        // Try to extract product JSON from embedded script in the rendered HTML
        if (!product && (productCard || item)) {
          // Check cache first
          product = this.#getCachedProductData(productId);
          
          if (!product) {
            const cardElement = productCard || item;
            const productJsonScript = cardElement.querySelector('script[type="application/json"][data-product-json]');
            if (productJsonScript) {
              try {
                product = JSON.parse(productJsonScript.textContent);
                console.log(`[Recently Viewed] Product ${productId}: Extracted product JSON from card HTML`);
                // Cache the extracted data
                if (product && product.variants) {
                  this.#cacheProductData(productId, product);
                }
              } catch (error) {
                console.warn(`[Recently Viewed] Product ${productId}: Failed to parse product JSON from card:`, error);
              }
            }
          } else {
            console.log(`[Recently Viewed] Product ${productId}: Using cached product data`);
          }
        }
        
        // If still no product data, construct minimal product object from available info
        if (!product && handle) {
          const link = (productCard || item).querySelector('a[href*="/products/"]');
          const url = link ? link.getAttribute('href') : `/products/${handle}`;
          const title = productCard?.querySelector('.product-title-text, .text-block--product_title')?.textContent?.trim() || '';
          const priceBlock = productCard?.querySelector('product-price');
          const available = priceBlock !== null; // Assume available if price block exists
          
          product = {
            id: String(productId),
            title: title,
            handle: handle,
            url: url,
            available: available,
            variants: [],
            options: []
          };
          
          console.log(`[Recently Viewed] Product ${productId}: Constructed minimal product object (variants/options missing)`);
        }
        
        // Update map with extracted data
        if (product && handle) {
          const link = (productCard || item).querySelector('a[href*="/products/"]');
          const url = link ? link.getAttribute('href') : null;
          this.#productDataMap.set(String(productId), { 
            id: String(productId), 
            handle, 
            url,
            product: product
          });
          
          // Cache the product data if we have complete data (with variants/options)
          if (product.variants && product.variants.length > 0) {
            this.#cacheProductData(productId, product);
          }
        }
      }
      
      if (!product) {
        console.warn(`[Recently Viewed] Product ${productId}: No product data available`, {
          hasProductDataMap: !!this.#productDataMap,
          mapSize: this.#productDataMap?.size || 0,
          mapKeys: Array.from(this.#productDataMap?.keys() || []),
          storedData: storedData,
          hasProductCard: !!productCard,
          hasItem: !!item
        });
        return { productId, item, cardContent, product: null, productCard };
      }
      
      console.log(`[Recently Viewed] Product ${productId}: Using product data from map (no fetch needed):`, {
        id: product.id,
        title: product.title,
        available: product.available,
        variantsCount: product.variants?.length || 0,
        optionsCount: product.options?.length || 0
      });
      
      return { productId, item, cardContent, product, productCard };
    });

    const productResults = await Promise.all(productPromises);
    console.log(`[Recently Viewed] Processed ${productResults.length} products`);
    
    // Filter out null results
    const validResults = productResults.filter(result => result !== null);
    console.log(`[Recently Viewed] Valid results: ${validResults.length} out of ${productResults.length}`);
    
    let actionsAdded = 0;
    
    // Add actions to each product card (use for-await to handle async properly)
    for (const { productId, item, cardContent, product, productCard } of validResults) {
      if (!productId || !item || !cardContent) {
        continue;
      }

      if (!product) {
        console.warn(`[Recently Viewed] Product ${productId}: No product data available`);
        continue;
      }
      
      // Check if product is available - actions only show for available products
      if (!product.available) {
        console.log(`[Recently Viewed] Product ${productId} is not available, skipping actions`);
        return;
      }

      if (!product.variants || product.variants.length === 0) {
        console.log(`[Recently Viewed] Product ${productId} has no variants, skipping actions`);
        return;
      }

      // CRITICAL: Ensure product-card has the data-view-product-button-setting attribute BEFORE inserting actions
      // This is required for CSS to show the buttons
      // Also check if cardContent's parent is a product-card
      if (!productCard && cardContent) {
        productCard = cardContent.closest('product-card');
      }
      
      if (productCard) {
        // Set attribute BEFORE inserting actions so CSS can match
        productCard.setAttribute('data-view-product-button-setting', 'true');
        productCard.setAttribute('data-view-product-button-enabled', 'true');
        productCard.setAttribute('data-collection-page', 'true');
        
        // CRITICAL: Ensure product-card has a link with ref="productCardLink" for quick-add to work
        // The quick-add component needs this to get the product URL
        // Extract handle from product or find it from the card
        const productHandle = product.handle || this.#extractHandleFromCard(productCard) || '';
        const productUrl = product.url || (productHandle ? `/products/${productHandle}` : '');
        
        let productCardLink = productCard.querySelector('a[ref="productCardLink"]') || 
                              productCard.querySelector('a.product-card__link') ||
                              productCard.querySelector('a[href*="/products/"]');
        
        if (!productCardLink && productUrl) {
          // If no link exists, create one
          productCardLink = document.createElement('a');
          productCardLink.href = productUrl;
          productCardLink.className = 'product-card__link';
          productCardLink.setAttribute('ref', 'productCardLink');
          productCardLink.innerHTML = '<span class="visually-hidden">' + (product.title || 'Product') + '</span>';
          
          // Insert at the beginning of the product-card (before cardContent)
          if (cardContent && cardContent.parentElement === productCard) {
            productCard.insertBefore(productCardLink, cardContent);
          } else if (productCard.firstChild) {
            productCard.insertBefore(productCardLink, productCard.firstChild);
          } else {
            productCard.appendChild(productCardLink);
          }
          
          console.log(`[Recently Viewed] Created product-card__link for product ${productId}: ${productUrl}`);
        } else if (productCardLink) {
          // Ensure the link has the ref attribute if it doesn't
          if (!productCardLink.hasAttribute('ref')) {
            productCardLink.setAttribute('ref', 'productCardLink');
          }
          // Update href if it's empty or incorrect
          if (productUrl && (!productCardLink.href || productCardLink.href === window.location.href)) {
            productCardLink.href = productUrl;
            console.log(`[Recently Viewed] Updated product-card__link href for product ${productId}: ${productUrl}`);
          } else {
            console.log(`[Recently Viewed] Found product-card__link for product ${productId}: ${productCardLink.href}`);
          }
        } else {
          console.warn(`[Recently Viewed] Product ${productId}: No product URL or handle found, quick-add modal may not work`);
        }
        
        console.log(`[Recently Viewed] Set data-view-product-button-setting on product card ${productId}`);
      } else {
        // If no product-card element, set attribute on the item itself for CSS targeting
        item.setAttribute('data-view-product-button-setting', 'true');
        item.setAttribute('data-view-product-button-enabled', 'true');
        console.log(`[Recently Viewed] No product-card found, set data-view-product-button-setting on item ${productId}`);
      }

      // Generate product-card-actions element (returns DOM element directly)
      const actions = this.#generateProductCardActions(product, sectionId);
      
      if (!actions) {
        console.warn(`[Recently Viewed] Product ${productId}: Failed to generate actions element`);
        return;
      }
      
      console.log(`[Recently Viewed] Product ${productId}: Generated actions element`, {
        hasViewButton: !!actions.querySelector('.product-card-actions__view-product-button'),
        hasQuickAdd: !!actions.querySelector('quick-add-component'),
        hasForm: !!actions.querySelector('product-form-component')
      });
      
      // Find price block and insert after it (same as product-slider structure)
      const priceBlock = cardContent.querySelector('product-price') || cardContent.querySelector('.price-snippet');
      
      // Insert the actual element (removes it from tempContainer) so custom elements initialize
      if (priceBlock) {
        // Insert after price block
        if (priceBlock.nextSibling) {
          cardContent.insertBefore(actions, priceBlock.nextSibling);
        } else {
          cardContent.appendChild(actions);
        }
        console.log(`[Recently Viewed] Product ${productId}: Inserted actions after price block`);
      } else {
        // If no price block, append to end of content
        cardContent.appendChild(actions);
        console.warn(`[Recently Viewed] Product ${productId}: No price block found, appended actions to end of content`);
      }
      
      // Wait for custom elements to initialize using requestAnimationFrame
      await new Promise(resolve => {
        requestAnimationFrame(() => {
          requestAnimationFrame(resolve);
        });
      });
      
      // Verify actions were actually inserted
      const verifyActions = cardContent.querySelector('.product-card-actions');
      if (verifyActions) {
        // Verify product-card has the attribute set (required for CSS visibility)
        if (productCard) {
          const hasAttribute = productCard.hasAttribute('data-view-product-button-setting') && 
                               productCard.getAttribute('data-view-product-button-setting') === 'true';
          if (!hasAttribute) {
            productCard.setAttribute('data-view-product-button-setting', 'true');
            productCard.setAttribute('data-view-product-button-enabled', 'true');
            console.warn(`[Recently Viewed] Product ${productId}: Had to re-set data-view-product-button-setting attribute`);
          }
        }
        
        // Check if custom elements are initialized
        const quickAddComponent = verifyActions.querySelector('quick-add-component');
        const productFormComponent = verifyActions.querySelector('product-form-component');
        const addButton = verifyActions.querySelector('.product-card-actions__quick-add-button');
        const viewButton = verifyActions.querySelector('.product-card-actions__view-product-button');
        
        console.log(`[Recently Viewed] Product ${productId}: Elements found:`, {
          actionsDiv: !!verifyActions,
          hasViewButton: !!viewButton,
          hasQuickAddComponent: !!quickAddComponent,
          hasProductFormComponent: !!productFormComponent,
          hasAddButton: !!addButton,
          productCardHasAttribute: productCard ? productCard.getAttribute('data-view-product-button-setting') : 'no product-card',
          actionsDisplay: window.getComputedStyle(verifyActions).display,
          actionsVisibility: window.getComputedStyle(verifyActions).visibility,
          actionsOpacity: window.getComputedStyle(verifyActions).opacity
        });
        
        // Ensure quick-add component has the product URL before adding event listeners
        // This is critical for the modal to work
        if (quickAddComponent && !quickAddComponent.getAttribute('data-product-url')) {
          const productUrl = product.url || `/products/${product.handle || handle}`;
          quickAddComponent.setAttribute('data-product-url', productUrl);
          console.log(`[Recently Viewed] Set data-product-url="${productUrl}" on quick-add component for product ${productId}`);
        }
        
        // Verify the product URL can be found
        if (quickAddComponent) {
          const testUrl = quickAddComponent.productPageUrl || quickAddComponent.getAttribute('data-product-url');
          console.log(`[Recently Viewed] Product ${productId}: Quick-add productPageUrl:`, testUrl);
          if (!testUrl) {
            console.warn(`[Recently Viewed] Product ${productId}: Quick-add component has no product URL!`);
            // Try to find and set the URL from the product card link
            const productCard = quickAddComponent.closest('product-card');
            if (productCard) {
              const cardLink = productCard.querySelector('a.product-card__link, a[ref="productCardLink"], a[href*="/products/"]');
              if (cardLink) {
                quickAddComponent.setAttribute('data-product-url', cardLink.href);
                console.log(`[Recently Viewed] Product ${productId}: Found product URL from card link:`, cardLink.href);
              }
            }
          }
        }
        
        // Add click event listener to + button for quick add
        // The on:click attribute should work with Shopify's declarative event system,
        // but we'll also add a standard event listener as fallback
        if (addButton && !addButton.hasAttribute('data-event-listener-added')) {
          // Wait for custom element to be ready using requestAnimationFrame
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              addButton.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                
                console.log(`[Recently Viewed] Quick add button clicked for product ${productId}`);
                
                // Verify product URL before opening modal
                if (quickAddComponent) {
                  const productUrl = quickAddComponent.productPageUrl || quickAddComponent.getAttribute('data-product-url');
                  if (!productUrl) {
                    console.error(`[Recently Viewed] Product ${productId}: Cannot open quick-add modal - no product URL found!`);
                    return;
                  }
                  console.log(`[Recently Viewed] Product ${productId}: Opening quick-add modal with URL:`, productUrl);
                }
                
                // Try to trigger quick-add component's handleClick method
                if (quickAddComponent && typeof quickAddComponent.handleClick === 'function') {
                  await quickAddComponent.handleClick(e);
                } else {
                  // Component might not be fully initialized yet, wait and try again
                  requestAnimationFrame(() => {
                    requestAnimationFrame(async () => {
                      if (quickAddComponent && typeof quickAddComponent.handleClick === 'function') {
                        await quickAddComponent.handleClick(e);
                      } else {
                        console.warn(`[Recently Viewed] Quick-add component not fully initialized for product ${productId}`);
                      }
                    });
                  });
                }
              }, { once: false, passive: false });
            });
          });
          addButton.setAttribute('data-event-listener-added', 'true');
        }
        
        // Force visibility with inline styles as final fallback (override any CSS)
        verifyActions.style.cssText += 'display: flex !important; visibility: visible !important; opacity: 1 !important;';
        
        // Also ensure buttons are visible
        if (viewButton) {
          viewButton.style.cssText += 'display: flex !important; visibility: visible !important; opacity: 1 !important;';
        }
        if (addButton) {
          addButton.style.cssText += 'display: flex !important; visibility: visible !important; opacity: 1 !important;';
        }
        
        actionsAdded++;
        console.log(`[Recently Viewed] ✓ Successfully added and made visible product-card-actions to product ${productId}`);
      } else {
        console.error(`[Recently Viewed] ✗ Failed to add actions to product ${productId} - actions not found in DOM after insertion`);
        console.error('Product card:', productCard?.outerHTML?.substring(0, 300));
        console.error('Card content HTML:', cardContent.innerHTML.substring(0, 500));
      }
    }
    
    console.log(`[Recently Viewed] Completed: Added actions to ${actionsAdded} out of ${productResults.filter(r => r && r.product).length} products`);
    
    // Final verification - check if any actions are visible in the DOM
    const allActions = carousel.querySelectorAll('.product-card-actions');
    console.log(`[Recently Viewed] Final check: Found ${allActions.length} product-card-actions elements in carousel`);
    
    if (allActions.length === 0 && productItems.length > 0) {
      console.error('[Recently Viewed] ⚠️ WARNING: No product-card-actions found in DOM despite processing products!');
      console.error('Possible issues:');
      console.error('1. Products might not have product-card structure');
      console.error('2. Actions HTML generation might be failing');
      console.error('3. DOM insertion might be failing');
    }
  }

  /**
   * Extract product handle from product card link or any element with product URL
   */
  #extractHandleFromCard(productCardOrElement) {
    if (!productCardOrElement) return null;
    
    // Try multiple selectors to find product links
    const selectors = [
      'a[href*="/products/"]',
      '.product-card__link[href*="/products/"]',
      'a.product-card__link',
      '[href*="/products/"]'
    ];
    
    for (const selector of selectors) {
      const link = productCardOrElement.querySelector(selector);
      if (link) {
        const href = link.getAttribute('href');
        if (href) {
          const match = href.match(/\/products\/([^\/\?]+)/);
          if (match && match[1]) {
            return match[1];
          }
        }
      }
    }
    
    // Also check the element itself if it's a link
    if (productCardOrElement.tagName === 'A' || productCardOrElement.tagName === 'a') {
      const href = productCardOrElement.getAttribute('href');
      if (href) {
        const match = href.match(/\/products\/([^\/\?]+)/);
        if (match && match[1]) {
          return match[1];
        }
      }
    }
    
    return null;
  }

  /**
   * Generate product-card-actions element based on product data
   * Creates DOM elements directly to ensure custom elements initialize properly
   * Matches the structure from snippets/product-card-actions.liquid
   */
  #generateProductCardActions(product, sectionId) {
    if (!product) return null;

    // Handle Shopify product JSON structure (from .js endpoint)
    const productId = product.id;
    const productTitle = product.title || '';
    const productAvailable = product.available !== false;
    const variants = product.variants || [];
    const options = product.options || [];
    const handle = product.handle || '';
    
    if (!productAvailable || variants.length === 0) return null;

    // Get first available variant or first variant
    const variant = variants.find(v => v.available) || variants[0];
    if (!variant) return null;

      // Get variant URL - Shopify JSON provides variant.url
      // Use product.url if available, otherwise construct from handle
      const productUrl = product.url || (handle ? `/products/${handle}` : '');
      const variantUrl = variant.url || productUrl;
      const productFormId = `ProductCardActions-ProductForm-${productId}-${sectionId}`;
      const variantId = variant.id;
      const variantAvailable = variant.available !== false;
      const quantityMin = variant.quantity_rule?.min || 1;

    // Create container div
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'product-card-actions';
    // Stop propagation on the container to prevent product card navigation
    actionsDiv.addEventListener('click', (e) => {
      e.stopPropagation();
    }, { passive: false });
    // Force visibility with inline styles to override any CSS
    actionsDiv.style.cssText = 'display: flex !important; visibility: visible !important; opacity: 1 !important; align-items: center; gap: 5px; margin-top: 12px; position: relative; z-index: 10; width: 100%;';

    // Create View Product button
    const viewProductLink = document.createElement('a');
    viewProductLink.href = variantUrl;
    viewProductLink.className = 'product-card-actions__view-product-button';
    viewProductLink.textContent = 'VIEW PRODUCT';
    // Stop propagation to prevent product card click handler from firing
    // But allow normal link navigation
    viewProductLink.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent bubbling to product card
      // Don't prevent default - allow normal link navigation
      // The link will navigate normally unless modifier keys are pressed
    }, { passive: false });
    // Also handle mouseenter to ensure hover state works
    viewProductLink.addEventListener('mouseenter', (e) => {
      e.stopPropagation();
    }, { passive: true });
    // Force visibility with inline styles - but don't use !important on background/border/color to allow hover CSS to work
    viewProductLink.style.cssText = 'background: #7295BB; border: 1px solid #7295BB; flex: 1; padding: 10px 6px; margin: 0; font-family: "Outfit", sans-serif; font-style: normal; font-weight: 500; font-size: 12px; line-height: 20px; text-transform: uppercase; color: #FFFFFF; text-decoration: none !important; display: flex !important; align-items: center !important; justify-content: center !important; transition: background-color 0.2s ease, color 0.2s ease, border 0.2s ease !important; cursor: pointer !important; pointer-events: auto !important; z-index: 100; position: relative;';
    actionsDiv.appendChild(viewProductLink);

    // Create quick-add wrapper
    const quickAddWrapper = document.createElement('div');
    quickAddWrapper.className = 'product-card-actions__quick-add-wrapper';
    quickAddWrapper.addEventListener('click', (e) => {
      e.stopPropagation();
    }, { passive: false });

    // Create quick-add-component custom element
    const quickAddComponent = document.createElement('quick-add-component');
    quickAddComponent.className = 'quick-add product-card-actions__quick-add';
    quickAddComponent.setAttribute('ref', 'quickAdd');
    quickAddComponent.setAttribute('data-product-title', productTitle);
    quickAddComponent.setAttribute('data-quick-add-button', 'choose');
    quickAddComponent.setAttribute('data-product-options-count', options.length);
    // CRITICAL: Set product URL so quick-add can fetch the product form
    // The quick-add component looks for productCard.getProductCardLink().href
    // So we'll store the URL here as a fallback
    if (productUrl) {
      quickAddComponent.setAttribute('data-product-url', productUrl);
    }
    if (handle) {
      quickAddComponent.setAttribute('data-product-handle', handle);
    }

    // Create product-form-component custom element
    const productFormComponent = document.createElement('product-form-component');
    productFormComponent.setAttribute('data-section-id', sectionId);
    productFormComponent.setAttribute('data-product-id', productId);
    productFormComponent.setAttribute('on:submit', '/handleSubmit');
    productFormComponent.className = 'quick-add__product-form-component';

    // Create form
    const form = document.createElement('form');
    form.id = productFormId;
    form.setAttribute('novalidate', 'novalidate');
    form.setAttribute('data-type', 'add-to-cart-form');

    // Create hidden variant ID input
    const variantIdInput = document.createElement('input');
    variantIdInput.type = 'hidden';
    variantIdInput.name = 'id';
    variantIdInput.setAttribute('ref', 'variantId');
    variantIdInput.value = variantId;
    if (!variantAvailable) {
      variantIdInput.disabled = true;
    }
    form.appendChild(variantIdInput);

    // Create hidden quantity input
    const quantityInput = document.createElement('input');
    quantityInput.type = 'hidden';
    quantityInput.name = 'quantity';
    quantityInput.value = quantityMin;
    form.appendChild(quantityInput);

    // Create + button
    const addButton = document.createElement('button');
    addButton.className = 'button product-card-actions__quick-add-button';
    addButton.type = 'button';
    addButton.name = 'add';
    addButton.setAttribute('on:click', 'quick-add-component/handleClick');
    addButton.setAttribute('onclick', 'event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();');
    addButton.setAttribute('data-quick-add-trigger', 'true');
    addButton.setAttribute('data-no-navigation', 'true');

    // Create + span
    const plusSpan = document.createElement('span');
    plusSpan.className = 'product-card-actions__quick-add-plus';
    plusSpan.textContent = '+';
    addButton.appendChild(plusSpan);

    form.appendChild(addButton);
    productFormComponent.appendChild(form);
    quickAddComponent.appendChild(productFormComponent);
    quickAddWrapper.appendChild(quickAddComponent);
    actionsDiv.appendChild(quickAddWrapper);

    return actionsDiv;
  }

  /**
   * Escape HTML to prevent XSS
   */
  #escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Fetch individual product card from collection page to ensure full structure with card-gallery
   * This is a fallback when Section Rendering API with search doesn't render full structure
   */
  async #fetchIndividualProductCard(productId, productDataArray) {
    try {
      const productData = productDataArray.find(p => p.id === productId);
      if (!productData || !productData.handle) {
        return null;
      }

      // Try fetching from search-results with caching
      const searchUrl = new URL('/search', location.origin);
      searchUrl.searchParams.set('q', `id:${productId}`);
      searchUrl.searchParams.set('resources[type]', 'product');
      const searchUrlString = searchUrl.toString();
      
      console.log(`Attempting to fetch product ${productId} from search-results fallback...`);
      
      // Check cache first
      const cached = this.#searchResultsCache.get(searchUrlString);
      const now = Date.now();
      let sectionHTML = null;
      
      if (cached && (now - cached.timestamp) < RecentlyViewedProductsComponent.#CACHE_TTL) {
        console.log('Using cached search-results response for fallback');
        sectionHTML = cached.html;
      } else {
        sectionHTML = await sectionRenderer.getSectionHTML('search-results', false, searchUrl);
        
        // Cache the response
        if (sectionHTML) {
          this.#searchResultsCache.set(searchUrlString, {
            html: sectionHTML,
            timestamp: now
          });
        }
      }
      
      if (sectionHTML) {
        // Use optimized parsing: try regex first for faster extraction
        const productIdMatch = sectionHTML.match(new RegExp(`data-product-id="${productId}"[^>]*>([\\s\\S]*?)</li>`, 'i'));
        if (productIdMatch) {
          const productCardHTML = productIdMatch[1];
          // Quick check if it has card-gallery
          if (productCardHTML.includes('card-gallery') && productCardHTML.includes('slideshow-component')) {
            console.log(`Successfully fetched product ${productId} with full card-gallery structure from search-results fallback (regex)`);
            return { id: productId, html: productCardHTML };
          }
        }
        
        // Fallback to DOM parsing if regex didn't work
        const parser = new DOMParser();
        const doc = parser.parseFromString(sectionHTML, 'text/html');
        const productItem = doc.querySelector(`.product-grid__item[data-product-id="${productId}"]`);
        
        if (productItem) {
          const productCardHTML = productItem.innerHTML;
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = productCardHTML;
          const cardGallery = tempDiv.querySelector('.card-gallery');
          const slideshowComponent = tempDiv.querySelector('.card-gallery slideshow-component');
          
          if (cardGallery && slideshowComponent) {
            console.log(`Successfully fetched product ${productId} with full card-gallery structure from search-results fallback (DOM)`);
            return { id: productId, html: productCardHTML };
          }
        }
      }
    } catch (error) {
      console.error(`Error fetching individual product card for ${productId}:`, error);
    }
    
    return null;
  }

  /**
   * Fetch product from collections.all collection page to ensure full structure
   */
  async #fetchProductFromCollection(productId, productDataArray) {
    try {
      // Try fetching from collections/all which should render products with full structure
      const collectionUrl = new URL('/collections/all', location.origin);
      
      console.log(`Attempting to fetch product ${productId} from collections/all...`);
      
      // Use a filter or search parameter that includes this product
      // Note: This might not work perfectly, but it's worth trying
      const sectionHTML = await sectionRenderer.getSectionHTML('main-collection', false, collectionUrl);
      
      if (sectionHTML) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(sectionHTML, 'text/html');
        const productItem = doc.querySelector(`.product-grid__item[data-product-id="${productId}"]`);
        
        if (productItem) {
          const productCardHTML = productItem.innerHTML;
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = productCardHTML;
          const cardGallery = tempDiv.querySelector('.card-gallery');
          const slideshowComponent = tempDiv.querySelector('.card-gallery slideshow-component');
          
          if (cardGallery && slideshowComponent) {
            console.log(`Successfully fetched product ${productId} with full structure from collections/all`);
            return { id: productId, html: productCardHTML };
          }
        }
      }
    } catch (error) {
      console.error(`Error fetching product from collection for ${productId}:`, error);
    }
    
    return null;
  }
}

if (!customElements.get('recently-viewed-products-component')) {
  customElements.define('recently-viewed-products-component', RecentlyViewedProductsComponent);
}
