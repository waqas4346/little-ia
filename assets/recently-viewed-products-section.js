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
   * Load and render recently viewed products
   */
  async #loadProducts() {
    const viewedProducts = RecentlyViewed.getProducts();
    const maxProducts = RecentlyViewed.getMaxProducts();
    
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
      this.#productDataMap = new Map();
      productData.forEach(({ id, handle, url }) => {
        this.#productDataMap.set(id, { id, handle, url });
      });
      
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
                    class="slideshow-control slideshow-control--previous slideshow-control--style-${iconsStyle}${iconShape !== 'none' ? ` slideshow-control--shape-${iconShape}` : ''} button button-unstyled button-unstyled--transparent flip-x"
                    aria-label="Previous slide"
                    ref="previous"
                  >
                    <span class="svg-wrapper icon-${iconsStyle.includes('chevron') ? 'caret' : 'arrow'}">
                      ${iconsStyle.includes('chevron') ? `
                        <svg width="11" height="19" viewBox="0 0 11 19" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M9.36328 2.31563L1.26025 9.83979L9.36328 17.364" stroke="#7295BB" stroke-width="2.31515" stroke-linecap="square" stroke-linejoin="round"/>
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
                    class="slideshow-control slideshow-control--next slideshow-control--style-${iconsStyle}${iconShape !== 'none' ? ` slideshow-control--shape-${iconShape}` : ''} button button-unstyled button-unstyled--transparent"
                    aria-label="Next slide"
                    ref="next"
                  >
                    <span class="svg-wrapper icon-${iconsStyle.includes('chevron') ? 'caret' : 'arrow'}">
                      ${iconsStyle.includes('chevron') ? `
                        <svg width="11" height="19" viewBox="0 0 11 19" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1.63672 16.6844L9.73975 9.16021L1.63672 1.63596" stroke="#7295BB" stroke-width="2.31515" stroke-linecap="square" stroke-linejoin="round"/>
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
                      
                      // Setup product cards and actions like product-slider does
                      this.#setupProductCards();
                      this.#enableProductCardImageSliders();
                      this.#addProductActions();
                      
                      // The slideshow component should auto-initialize, but we need to set up arrow handlers
                      // Wait a bit longer to ensure slideshow is fully initialized
                      setTimeout(() => {
                        this.#initializeSlideshow();
                      }, 100);
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
    if (!carousel) return;

    const productCards = carousel.querySelectorAll('product-card');
    productCards.forEach((card) => {
      card.setAttribute('data-collection-page', 'true');
      // Enable view product button
      card.setAttribute('data-view-product-button-enabled', 'true');
      card.setAttribute('data-view-product-button-setting', 'true');
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
   * Fetches product data from product pages and extracts/generates actions
   */
  async #addProductActions() {
    const carousel = this.querySelector('[data-testid="recently-viewed-products-grid"]');
    if (!carousel) return;

    const quickAddEnabled = this.dataset.quickAdd !== 'false';
    if (!quickAddEnabled) {
      console.log('Quick add is disabled, skipping product actions');
      return;
    }

    const productItems = carousel.querySelectorAll('[data-product-slider-item="true"]');
    const sectionId = this.dataset.sectionId;
    
    // Add actions to each product card
    for (const item of productItems) {
      const productId = item.getAttribute('data-product-id');
      if (!productId) continue;

      // Check if actions already exist
      if (item.querySelector('.product-card-actions')) {
        continue;
      }

      const productCard = item.querySelector('product-card');
      if (!productCard) continue;

      const cardContent = productCard.querySelector('.product-card__content');
      if (!cardContent) continue;

      // Get product handle from stored data or extract from URL
      const productData = this.#productDataMap.get(productId);
      const handle = productData?.handle || this.#extractHandleFromCard(productCard);
      
      if (!handle) {
        console.log(`No handle found for product ${productId}`);
        continue;
      }

      // Fetch product page to get product data
      try {
        const productUrl = `/products/${handle}`;
        const response = await fetch(`${productUrl}?view=json`);
        if (!response.ok) continue;

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Try to find product JSON data
        const jsonScript = doc.querySelector('script[type="application/json"][data-product-json]');
        if (!jsonScript) continue;

        const product = JSON.parse(jsonScript.textContent);
        
        // Generate product-card-actions HTML
        const actionsHTML = this.#generateProductCardActions(product, sectionId);
        
        if (actionsHTML) {
          // Parse and insert actions
          const actionsDoc = parser.parseFromString(actionsHTML, 'text/html');
          const actions = actionsDoc.querySelector('.product-card-actions');
          
          if (actions) {
            // Find price block and insert after it
            const priceBlock = cardContent.querySelector('product-price');
            if (priceBlock) {
              if (priceBlock.nextSibling) {
                cardContent.insertBefore(actions, priceBlock.nextSibling);
              } else {
                cardContent.appendChild(actions);
              }
            } else {
              cardContent.appendChild(actions);
            }
          }
        }
      } catch (error) {
        console.error(`Error adding actions for product ${productId}:`, error);
      }
    }
  }

  /**
   * Extract product handle from product card link
   */
  #extractHandleFromCard(productCard) {
    const link = productCard.querySelector('a[href*="/products/"]');
    if (!link) return null;
    
    const href = link.getAttribute('href');
    const match = href.match(/\/products\/([^\/\?]+)/);
    return match ? match[1] : null;
  }

  /**
   * Generate product-card-actions HTML based on product data
   */
  #generateProductCardActions(product, sectionId) {
    if (!product) return '';

    // Handle different product data structures
    const productId = product.id || product.product_id;
    const productTitle = product.title || '';
    const productAvailable = product.available !== false;
    const variants = product.variants || [];
    const options = product.options || [];
    
    if (!productAvailable || variants.length === 0) return '';

    const variant = variants.find(v => v.available) || variants[0];
    if (!variant) return '';

    const productFormId = `ProductCardActions-ProductForm-${productId}-${sectionId}`;
    const variantUrl = variant.url || product.url || `/products/${product.handle || ''}`;

    return `
      <div class="product-card-actions" onclick="event.stopPropagation();">
        <a 
          href="${variantUrl}" 
          class="product-card-actions__view-product-button"
          onclick="event.stopPropagation();"
        >
          VIEW PRODUCT
        </a>
        <div onclick="event.stopPropagation();" class="product-card-actions__quick-add-wrapper">
          <quick-add-component
            class="quick-add product-card-actions__quick-add"
            ref="quickAdd"
            data-product-title="${this.#escapeHtml(productTitle)}"
            data-quick-add-button="choose"
            data-product-options-count="${options.length}"
          >
            <product-form-component
              data-section-id="${sectionId}"
              data-product-id="${productId}"
              on:submit="/handleSubmit"
              class="quick-add__product-form-component"
            >
              <form id="${productFormId}" novalidate="novalidate" data-type="add-to-cart-form">
                <input type="hidden" name="id" ref="variantId" value="${variant.id}" ${!variant.available ? 'disabled' : ''}>
                <input type="hidden" name="quantity" value="${variant.quantity_rule?.min || 1}">
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
      </div>
    `;
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
