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
    
    console.log('Fetching products from main-collection via search:', searchUrl.toString());
    
    try {
      // Use cache: false to ensure we get fresh results
      // Add timestamp to URL to bust any caching
      searchUrl.searchParams.set('_t', Date.now().toString());
      const sectionHTML = await sectionRenderer.getSectionHTML('main-collection', false, searchUrl);
      
      if (sectionHTML) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(sectionHTML, 'text/html');
        const productItems = Array.from(doc.querySelectorAll('.product-grid__item[data-product-id]'));
        
        console.log(`Found ${productItems.length} product items in main-collection`);
        
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
            // Map in the exact order from localStorage
            productCardsHTML = productIds
              .map((productId) => {
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
                
                // Check if product card has content
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = productCardHTML;
                const productCard = tempDiv.querySelector('product-card');
                const cardContent = productCard?.querySelector('.product-card__content');
                const hasContent = cardContent && cardContent.innerHTML.trim().length > 0;
                
                console.log(`Product ${productId} from main-collection, has content: ${hasContent}`);
                
                return { id: productId, html: productCardHTML };
              })
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
}

if (!customElements.get('recently-viewed-products-component')) {
  customElements.define('recently-viewed-products-component', RecentlyViewedProductsComponent);
}
