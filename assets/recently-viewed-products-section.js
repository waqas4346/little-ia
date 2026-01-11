import { RecentlyViewed } from '@theme/recently-viewed-products';
import { sectionRenderer } from '@theme/section-renderer';

/**
 * Custom element for displaying recently viewed products in a slider
 */
class RecentlyViewedProductsComponent extends HTMLElement {
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

  /**
   * Map to store product data (id -> {id, handle, url})
   * @type {Map<string, {id: string, handle: string, url: string}>}
   */
  #productDataMap = new Map();

  connectedCallback() {
    this.#intersectionObserver.observe(this);
    
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
    
    // Check localStorage directly to verify
    const rawStorage = localStorage.getItem('viewedProducts');
    console.log('Raw localStorage value:', rawStorage);
    
    if (viewedProducts.length === 0) {
      console.log('No recently viewed products found');
      this.dataset.hasProducts = 'false';
      this.dataset.loaded = 'true';
      return;
    }

    this.dataset.hasProducts = 'true';
    
    // Clear any cached data to ensure fresh fetch
    console.log('Clearing section renderer cache for fresh fetch');

    try {
      // Use search API to get products by ID (same approach as predictive-search)
      const url = new URL(Theme.routes.search_url, location.origin);
      url.searchParams.set('q', viewedProducts.map((id) => `id:${id}`).join(' OR '));
      url.searchParams.set('resources[type]', 'product');

      console.log('Fetching products from URL:', url.toString());

      // Use predictive-search section which already handles recently viewed products
      const sectionHTML = await sectionRenderer.getSectionHTML('predictive-search', false, url);
      
      if (!sectionHTML) {
        console.log('No section HTML returned');
        this.dataset.hasProducts = 'false';
        this.dataset.loaded = 'true';
        return;
      }

      console.log('Section HTML length:', sectionHTML.length);

      // Parse the HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(sectionHTML, 'text/html');
      
      // Find the predictive search products list (same structure as predictive-search uses)
      const productsList = doc.querySelector('#predictive-search-products');
      
      if (!productsList) {
        console.log('No products list found');
        this.dataset.hasProducts = 'false';
        this.dataset.loaded = 'true';
        return;
      }

      // Get product cards from the list
      let productItems = Array.from(productsList.querySelectorAll('.predictive-search-results__card--product'));
      
      // If not found, try alternative selectors
      if (productItems.length === 0) {
        productItems = Array.from(productsList.querySelectorAll('li[data-product-id]'));
      }
      
      if (productItems.length === 0) {
        productItems = Array.from(productsList.querySelectorAll('[data-product-id]'));
      }
      
      console.log('Found product items:', productItems.length);
      
      if (productItems.length === 0) {
        console.log('No product items found. HTML structure:', productsList.innerHTML.substring(0, 500));
        this.dataset.hasProducts = 'false';
        this.dataset.loaded = 'true';
        return;
      }

      // First, let's log what we found to debug
      console.log('Product items details:', productItems.map(item => {
        // Check for product-card-link first (this is where the ID is stored)
        const productCardLink = item.querySelector('product-card-link');
        const productIdFromLink = productCardLink?.dataset.productId || productCardLink?.getAttribute('data-product-id');
        
        const productId = item.dataset.productId || 
                         productIdFromLink ||
                         item.querySelector('[data-product-id]')?.dataset.productId ||
                         item.getAttribute('data-product-id');
        const resourceCard = item.querySelector('resource-card');
        const resourceCardId = resourceCard?.dataset.resourceId;
        const link = item.querySelector('a[href*="/products/"]');
        const productUrl = link ? link.getAttribute('href') : null;
        
        return {
          productId,
          productIdFromLink,
          resourceCardId,
          productUrl,
          innerHTML: item.innerHTML.substring(0, 200)
        };
      }));

      // Since we can't match by ID directly, we'll use the products in the order they come from search
      // The search API should return products matching our IDs, so we'll use them as-is
      // Extract product URLs/handles from all items
      const allProductData = productItems.map((item) => {
        const link = item.querySelector('a[href*="/products/"]');
        const productUrl = link ? link.getAttribute('href') : null;
        const handle = productUrl ? productUrl.split('/products/')[1]?.split('?')[0] : null;
        
        return {
          element: item,
          url: productUrl,
          handle: handle
        };
      }).filter(item => item.handle); // Only keep items with valid handles

      console.log('All product data extracted:', allProductData.map(p => ({ handle: p.handle, url: p.url })));

      // Since we can't match by ID, we'll use the products in the order they appear
      // and limit to the number of products in localStorage
      const productData = allProductData
        .slice(0, viewedProducts.length)
        .map((item, index) => {
          return {
            id: viewedProducts[index], // Use the ID from localStorage for reference
            element: item.element,
            url: item.url,
            handle: item.handle
          };
        });

      console.log('Ordered products count:', productData.length);
      console.log('Product data:', productData.map(p => ({ id: p.id, handle: p.handle, url: p.url })));

      if (productData.length === 0) {
        console.log('No ordered products found after filtering');
        this.dataset.hasProducts = 'false';
        this.dataset.loaded = 'true';
        return;
      }

      // Render the products in slider format
      // Use the handles we extracted to fetch products via search-results
      // Pass the original viewedProducts order to ensure correct ordering
      await this.#renderProductsFromHandles(productData, viewedProducts);
      
      // Store product data for later use in adding actions
      if (!this.#productDataMap) {
        this.#productDataMap = new Map();
      }
      productData.forEach(({ id, handle, url }) => {
        if (id && handle) {
          this.#productDataMap.set(String(id), { id: String(id), handle, url });
        }
      });
      console.log(`[Recently Viewed] Stored ${this.#productDataMap.size} products in productDataMap`);
      
      this.dataset.loaded = 'true';
    } catch (error) {
      console.error('Error loading recently viewed products:', error);
      this.dataset.hasProducts = 'false';
      this.dataset.loaded = 'true';
    }
  }

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
   * Render products using handles to fetch from search-results
   * @param {Array<{id: string, element: HTMLElement, url: string, handle: string}>} productData - Array of product data
   * @param {string[]} viewedProductsOrder - The exact order from localStorage
   */
  async #renderProductsFromHandles(productData, viewedProductsOrder) {
    const itemsPerView = parseInt(this.dataset.itemsPerView) || 4;
    const columnsGap = parseInt(this.dataset.columnsGap) || 8;
    const iconsStyle = this.dataset.iconsStyle || 'arrow';

    // Try to get product cards from main-collection first, fallback to resource-card
    let productCardsHTML;
    
    // Use the exact order from localStorage, not from productData
    const productIds = viewedProductsOrder || productData.map(p => p.id);
    console.log('Product IDs to fetch (in exact localStorage order):', productIds);
    console.log('Product data order:', productData.map(p => p.id));
    
    const searchUrl = new URL(Theme.routes.search_url, location.origin);
    searchUrl.searchParams.set('q', productIds.map(id => `id:${id}`).join(' OR '));
    searchUrl.searchParams.set('resources[type]', 'product');
    
    console.log('Fetching products from search-results section (which uses full product card structure):', searchUrl.toString());
    
    try {
      // Try fetching from search-results section first, which should render products with full card-gallery structure
      // Add timestamp to URL to bust any caching
      searchUrl.searchParams.set('_t', Date.now().toString());
      let sectionHTML = await sectionRenderer.getSectionHTML('search-results', false, searchUrl);
      let sectionName = 'search-results';
      
      // If search-results didn't work, try main-collection
      if (!sectionHTML || sectionHTML.trim().length === 0) {
        console.log('search-results returned empty, trying main-collection...');
        sectionHTML = await sectionRenderer.getSectionHTML('main-collection', false, searchUrl);
        sectionName = 'main-collection';
      }
      
      if (sectionHTML) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(sectionHTML, 'text/html');
        const productItems = Array.from(doc.querySelectorAll('.product-grid__item[data-product-id]'));
        
        console.log(`Found ${productItems.length} product items in ${sectionName}`);
        
        if (productItems.length > 0) {
          const orderedProducts = productIds
            .map((id) => {
              const item = productItems.find((p) => {
                const productId = p.dataset.productId || p.getAttribute('data-product-id');
                return String(productId) === String(id);
              });
              return item;
            })
            .filter(Boolean);

          if (orderedProducts.length > 0) {
            // Map in the exact order from localStorage - need to use async map for fallback fetching
            const productCardsPromises = productIds.map(async (productId) => {
              // Find the item that matches this product ID
              const item = orderedProducts.find((p) => {
                const itemId = p.dataset.productId || p.getAttribute('data-product-id');
                return String(itemId) === String(productId);
              });
              
              if (!item) {
                console.warn(`Product ${productId} not found in ordered products`);
                return null;
              }
              
              const productCardHTML = item.innerHTML;
              
              // Check if product card has content and card-gallery with slideshow-component
              const tempDiv = document.createElement('div');
              tempDiv.innerHTML = productCardHTML;
              const productCard = tempDiv.querySelector('product-card');
              const cardContent = productCard?.querySelector('.product-card__content');
              const hasContent = cardContent && cardContent.innerHTML.trim().length > 0;
              
              // Check if card-gallery and slideshow-component are present
              const cardGallery = tempDiv.querySelector('.card-gallery');
              const slideshowComponent = tempDiv.querySelector('.card-gallery slideshow-component');
              
              console.log(`Product ${productId} from ${sectionName}:`, {
                hasContent,
                hasCardGallery: !!cardGallery,
                hasSlideshowComponent: !!slideshowComponent,
                cardGalleryHTML: cardGallery ? cardGallery.outerHTML.substring(0, 300) : 'NONE',
                slideshowHTML: slideshowComponent ? slideshowComponent.outerHTML.substring(0, 200) : 'NONE',
                anchorTag: tempDiv.querySelector('a[ref="cardGalleryLink"], .card-gallery a'),
                anchorHasSlideshow: tempDiv.querySelector('a[ref="cardGalleryLink"] slideshow-component, .card-gallery a slideshow-component') ? 'YES' : 'NO',
                fullCardHTML: productCardHTML.substring(0, 1000)
              });
              
              // CRITICAL: If card-gallery or slideshow-component is missing, the product card structure is incomplete
              // This means products are being rendered with resource-card instead of full product-card with card-gallery
              if (!cardGallery || !slideshowComponent) {
                console.error(`Product ${productId} is MISSING card-gallery or slideshow-component!`);
                console.error(`hasCardGallery: ${!!cardGallery}, hasSlideshowComponent: ${!!slideshowComponent}`);
                console.error('This is why the slider is not showing - the slideshow-component is not in the HTML at all.');
                console.error('Full product card HTML:', productCardHTML);
                
                // Product is rendered with resource-card or simple structure without card-gallery
                // We need to inject card-gallery with slideshow-component structure
                // But first, try fetching from a different section that might have full structure
                const fallbackCard = await this.#fetchIndividualProductCard(productId, productData);
                if (fallbackCard && fallbackCard.html) {
                  const fallbackDiv = document.createElement('div');
                  fallbackDiv.innerHTML = fallbackCard.html;
                  const fallbackCardGallery = fallbackDiv.querySelector('.card-gallery');
                  const fallbackSlideshow = fallbackDiv.querySelector('.card-gallery slideshow-component');
                  
                  if (fallbackCardGallery && fallbackSlideshow) {
                    console.log(`Successfully fetched product ${productId} with full structure from fallback method`);
                    return fallbackCard;
                  }
                }
                
                // If fallback didn't work, try fetching from collections.all collection
                // This should render products with full product card structure
                const collectionCard = await this.#fetchProductFromCollection(productId, productData);
                if (collectionCard && collectionCard.html) {
                  const collectionDiv = document.createElement('div');
                  collectionDiv.innerHTML = collectionCard.html;
                  const collectionCardGallery = collectionDiv.querySelector('.card-gallery');
                  const collectionSlideshow = collectionDiv.querySelector('.card-gallery slideshow-component');
                  
                  if (collectionCardGallery && collectionSlideshow) {
                    console.log(`Successfully fetched product ${productId} with full structure from collection page`);
                    return collectionCard;
                  }
                }
                
                // If all methods fail, log error and skip this product for now
                // Products without card-gallery won't have slider functionality
                console.error(`Cannot fetch product ${productId} with full card-gallery structure using any method. Skipping slider for this product.`);
                return null;
              }
              
              // Verify slideshow-component is inside the anchor tag (as expected per card-gallery.liquid structure)
              const anchorTag = tempDiv.querySelector('a[ref="cardGalleryLink"], .card-gallery a');
              const slideshowInAnchor = anchorTag?.querySelector('slideshow-component');
              
              if (!slideshowInAnchor && slideshowComponent) {
                console.warn(`Product ${productId}: slideshow-component exists but NOT inside anchor tag! Structure might be different.`);
                console.warn('Anchor tag:', anchorTag?.outerHTML.substring(0, 200));
                console.warn('Slideshow location:', slideshowComponent.parentElement?.tagName);
              } else if (slideshowInAnchor) {
                console.log(`Product ${productId}: slideshow-component is correctly inside anchor tag ✓`);
              }
              
              return { id: productId, html: productCardHTML };
            });
            
            // Wait for all promises to resolve
            productCardsHTML = (await Promise.all(productCardsPromises))
              .filter(card => {
                if (!card) return false;
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = card.html;
                const productCard = tempDiv.querySelector('product-card');
                const cardContent = productCard?.querySelector('.product-card__content');
                return cardContent && cardContent.innerHTML.trim().length > 0;
              });
          }
        }
      }
    } catch (error) {
      console.error('Error fetching from main-collection:', error);
    }
    
    // Fallback to resource-card if main-collection didn't work
    if (!productCardsHTML || productCardsHTML.length === 0) {
      console.log('Using resource-card from predictive-search as fallback');
      productCardsHTML = this.#useResourceCardsFromPredictiveSearch(productData, viewedProductsOrder);
    }
    
    if (!productCardsHTML || productCardsHTML.length === 0) {
      console.log('No valid product cards extracted');
      this.dataset.hasProducts = 'false';
      return;
    }

    console.log(`Extracted ${productCardsHTML.length} product cards with full HTML`);
    console.log('Product cards order:', productCardsHTML.map(c => c.id));

    // Create list items - the html from search-results is the content of .product-grid__item
    // which includes the full product card with all blocks (gallery, title, price, etc.)
    const listItems = productCardsHTML.map(({ id, html }) => {
      // Extract handle from rendered HTML if not already in map
      if (!this.#productDataMap) {
        this.#productDataMap = new Map();
      }
      if (!this.#productDataMap.has(String(id))) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        const handle = this.#extractHandleFromCard(tempDiv);
        if (handle) {
          // Extract URL from product card link
          const link = tempDiv.querySelector('a[href*="/products/"]');
          const url = link ? link.getAttribute('href') : null;
          this.#productDataMap.set(String(id), { id: String(id), handle, url });
          console.log(`[Recently Viewed] Extracted and stored handle "${handle}" for product ${id}`);
        } else {
          console.warn(`[Recently Viewed] Could not extract handle from rendered HTML for product ${id}`);
        }
      }
      
      // The html already contains the product card with all blocks
      // Just wrap it in resource-list__item structure like product-slider does
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

    // Use the resource-list-carousel snippet structure via Section Rendering API
    // This will properly render the slideshow with all required refs and arrows
    // First, let's try rendering a simple product-slider section structure
    // But since we can't easily do that, let's manually create the proper structure
    
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
                    class="slideshow-control slideshow-control--previous slideshow-control--style-${iconsStyle}${iconShape !== 'none' ? ` slideshow-control--shape-${iconShape}` : ''} button button-unstyled button-unstyled--transparent${iconsStyle === 'blue_arrows' ? '' : ' flip-x'}"
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
                    class="slideshow-control slideshow-control--next slideshow-control--style-${iconsStyle}${iconShape !== 'none' ? ` slideshow-control--shape-${iconShape}` : ''} button button-unstyled button-unstyled--transparent${iconsStyle === 'blue_arrows' ? ' flip-x' : ''}"
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
      
                    contentEl.innerHTML = carouselHTML;
                    
                    // Check if slideshow was created and verify structure
                    setTimeout(() => {
                      const slideshow = contentEl.querySelector('slideshow-component[ref="recentlyViewedProductsSlider"]');
                      const scroller = contentEl.querySelector('slideshow-slides[ref="scroller"]');
                      const slides = contentEl.querySelectorAll('slideshow-slide');
                      const productCards = contentEl.querySelectorAll('product-card');
                      
                      console.log('After HTML insertion:');
                      console.log('- Slideshow found:', !!slideshow);
                      console.log('- Scroller found:', !!scroller);
                      console.log('- Slides count:', slides.length);
                      console.log('- Product cards count:', productCards.length);
                      
                      if (slideshow && scroller) {
                        console.log('Slideshow structure is correct');
                      } else {
                        console.error('Slideshow structure is missing required elements!');
                        console.log('Full HTML:', contentEl.innerHTML.substring(0, 1000));
                      }
                      
                      // Setup product cards first
                      this.#setupProductCards();
                      
                      // Wait for products to be fully rendered before adding actions
                      setTimeout(async () => {
                        // Run setup again to catch any dynamically added cards
                        this.#setupProductCards();
                        
                        await this.#enableProductCardImageSliders();
                        await this.#addProductActions();
                        
                        // Run setup one more time after adding actions to ensure attributes are set
                        setTimeout(() => {
                          this.#setupProductCards();
                        }, 100);
                        
                        // The slideshow component should auto-initialize, but we need to set up arrow handlers
                        // Wait a bit longer to ensure slideshow is fully initialized
                        setTimeout(() => {
                          this.#initializeSlideshow();
                        }, 200);
                      }, 300);
                    }, 300);
    } else {
      console.error('Content element not found!');
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

    // Wait for slideshow to be fully connected and initialized
    if (!slideshow.isConnected || !slideshow.refs?.scroller) {
      console.log('Slideshow not ready yet, waiting...');
      setTimeout(() => this.#initializeSlideshow(), 100);
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

      // Update arrow visibility after scroll
      setTimeout(updateArrowVisibility, 100);
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

      // Update arrow visibility after scroll
      setTimeout(updateArrowVisibility, 100);
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

    // Wait a bit for product cards to be rendered
    setTimeout(() => {
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
    }, 50);
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

    // Wait a bit for DOM to be fully ready and for product cards to be rendered
    await new Promise(resolve => setTimeout(resolve, 200));

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

    // Wait a bit for products to be fully rendered
    await new Promise(resolve => setTimeout(resolve, 100));

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
      
      // Get product handle from stored data or extract from URL
      const productData = this.#productDataMap.get(String(productId));
      let handle = productData?.handle;
      
      // If handle not in map, try to extract from card or item
      if (!handle) {
        console.log(`[Recently Viewed] Product ${productId}: Handle not in map, extracting from card...`);
        handle = this.#extractHandleFromCard(productCard || item);
        if (handle) {
          // Store it in the map for future use
          const link = (productCard || item).querySelector('a[href*="/products/"]');
          const url = link ? link.getAttribute('href') : null;
          this.#productDataMap.set(String(productId), { id: String(productId), handle, url });
          console.log(`[Recently Viewed] Product ${productId}: Extracted and stored handle "${handle}"`);
        }
      }
      
      if (!handle) {
        console.warn(`[Recently Viewed] Product ${productId}: No handle found`, {
          hasProductDataMap: !!this.#productDataMap,
          mapSize: this.#productDataMap?.size || 0,
          mapKeys: Array.from(this.#productDataMap?.keys() || []),
          productData: productData,
          hasProductCard: !!productCard,
          hasItem: !!item,
          cardHtml: (productCard || item)?.outerHTML?.substring(0, 500)
        });
        return { productId, item, cardContent, product: null, productCard };
      }
      
      console.log(`[Recently Viewed] Product ${productId}: Using handle "${handle}"`);

      console.log(`[Recently Viewed] Fetching product data for ${handle} (ID: ${productId})`);

      // Fetch product JSON data efficiently
      try {
        const productUrl = `/products/${handle}.js`;
        const response = await fetch(productUrl);
        if (!response.ok) {
          console.error(`[Recently Viewed] Failed to fetch product data for ${handle}: ${response.status}`);
          return { productId, item, cardContent, product: null, productCard };
        }

        const product = await response.json();
        console.log(`[Recently Viewed] Successfully fetched product ${handle}:`, {
          id: product.id,
          title: product.title,
          available: product.available,
          variantsCount: product.variants?.length || 0
        });
        return { productId, item, cardContent, product, productCard };
      } catch (error) {
        console.error(`[Recently Viewed] Error fetching product data for ${handle}:`, error);
        return { productId, item, cardContent, product: null, productCard };
      }
    });

    const productResults = await Promise.all(productPromises);
    console.log(`[Recently Viewed] Processed ${productResults.length} products`);
    
    let actionsAdded = 0;
    
    // Add actions to each product card (use for-await to handle async properly)
    for (const { productId, item, cardContent, product, productCard } of productResults) {
      if (!productId || !item || !cardContent) {
        return;
      }

      if (!product) {
        console.warn(`[Recently Viewed] Product ${productId}: No product data available`);
        return;
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
      
      // Wait a bit for custom elements to initialize after DOM insertion
      await new Promise(resolve => setTimeout(resolve, 150));
      
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
          // Wait a bit more for custom element to be fully connected
          setTimeout(() => {
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
                // Component might not be fully initialized yet, try again in a moment
                setTimeout(async () => {
                  if (quickAddComponent && typeof quickAddComponent.handleClick === 'function') {
                    await quickAddComponent.handleClick(e);
                  } else {
                    console.warn(`[Recently Viewed] Quick-add component not fully initialized for product ${productId}`);
                  }
                }, 100);
              }
            }, { once: false, passive: false });
          }, 200);
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
    // Force visibility with inline styles
    addButton.style.cssText = 'width: 32px !important; height: 32px !important; min-width: 32px !important; min-height: 32px !important; max-width: 32px !important; max-height: 32px !important; padding: 0 !important; margin: 0 !important; display: flex !important; align-items: center !important; justify-content: center !important; opacity: 1 !important; visibility: visible !important; border-radius: 50% !important; border: 1px solid #1D425A !important; background: transparent !important; cursor: pointer !important; position: relative !important; z-index: 1 !important; pointer-events: auto !important;';

    // Create + span
    const plusSpan = document.createElement('span');
    plusSpan.className = 'product-card-actions__quick-add-plus';
    plusSpan.textContent = '+';
    plusSpan.style.cssText = 'font-family: "Geologica", sans-serif; font-style: normal; font-weight: 100; font-size: 19.5279px; line-height: 24px; display: flex; align-items: center; justify-content: center; text-align: center; color: #1D425A; margin: 0; padding: 0; height: 100%; width: 100%; position: relative; top: -1px;';
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

      // Try fetching from search-results with a different search approach
      const searchUrl = new URL('/search', location.origin);
      searchUrl.searchParams.set('q', `id:${productId}`);
      searchUrl.searchParams.set('resources[type]', 'product');
      
      console.log(`Attempting to fetch product ${productId} from search-results with different approach...`);
      
      const sectionHTML = await sectionRenderer.getSectionHTML('search-results', false, searchUrl);
      
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
            console.log(`Successfully fetched product ${productId} with full card-gallery structure from search-results fallback`);
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
