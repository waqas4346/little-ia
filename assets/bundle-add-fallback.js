/**
 * Fallback script to handle bundle mode when Liquid parameters don't pass correctly
 * This intercepts quick-add clicks inside bundle wrappers and redirects to bundle-add
 */

(function() {
  'use strict';

  function getProductUrlFromCard(card) {
    if (!card) return '';
    const link = card.querySelector('a.product-card__link, a[href*="/products/"]');
    return link?.href || '';
  }

  async function handleBundleAddClick(e, wrapper) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    console.log('Bundle Add Fallback: Intercepted click in bundle wrapper');

    // Get product info
    const productCard = wrapper.querySelector('product-card');
    const productUrl = getProductUrlFromCard(productCard);

    if (!productUrl) {
      console.error('Bundle Add Fallback: Could not find product URL');
      return;
    }

    // Check if bundle-add-dialog exists
    let bundleAddDialog = document.getElementById('bundle-add-dialog');
    if (!bundleAddDialog) {
      console.error('Bundle Add Fallback: bundle-add-dialog not found in DOM');
      return;
    }

    // Wait for bundle-add-component to be defined
    await customElements.whenDefined('bundle-add-component');

    // Try to find existing bundle-add-component
    let bundleAddComponent = wrapper.querySelector('bundle-add-component');
    
    // If no bundle-add-component exists, create one temporarily
    if (!bundleAddComponent) {
      console.log('Bundle Add Fallback: Creating temporary bundle-add-component');
      bundleAddComponent = document.createElement('bundle-add-component');
      bundleAddComponent.setAttribute('data-product-title', wrapper.querySelector('.product-title-text')?.textContent?.trim() || 'Product');
      bundleAddComponent.setAttribute('data-bundle-add-button', 'choose');
      bundleAddComponent.setAttribute('data-product-url', productUrl);
      wrapper.appendChild(bundleAddComponent);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // If component has handleClick method, use it
    if (bundleAddComponent && typeof bundleAddComponent.handleClick === 'function') {
      console.log('Bundle Add Fallback: Calling bundle-add-component.handleClick');
      await bundleAddComponent.handleClick(e);
    } else {
      console.error('Bundle Add Fallback: bundle-add-component.handleClick not available');
    }
  }

  function initBundleAddFallback() {
    // Find all bundle item wrappers
    const bundleWrappers = document.querySelectorAll(
      '[data-product-bundle-item="true"], ' +
      '[data-require-bundle-mode="true"], ' +
      '.product-bundle-item'
    );

    console.log('Bundle Add Fallback: Found', bundleWrappers.length, 'bundle wrappers');

    bundleWrappers.forEach(wrapper => {
      // Find quick-add buttons in this wrapper that aren't already handled
      const quickAddButton = wrapper.querySelector(
        '.product-card-actions__quick-add-button:not([data-bundle-fallback-handled]), ' +
        'button[on:click*="quick-add-component"]:not([data-bundle-fallback-handled]), ' +
        'button[data-quick-add-trigger]:not([data-bundle-fallback-handled])'
      );

      if (quickAddButton) {
        console.log('Bundle Add Fallback: Setting up intercept for button in bundle wrapper', quickAddButton);

        // Add our click handler with high priority (capture phase)
        const handler = function(e) {
          handleBundleAddClick(e, wrapper);
        };
        
        quickAddButton.addEventListener('click', handler, { capture: true });

        // Mark as handled
        quickAddButton.setAttribute('data-bundle-fallback-handled', 'true');
        quickAddButton.setAttribute('data-bundle-mode', 'true');
      }
    });
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBundleAddFallback);
  } else {
    initBundleAddFallback();
  }

  // Also run after delays to catch dynamically loaded content
  setTimeout(initBundleAddFallback, 500);
  setTimeout(initBundleAddFallback, 2000);
  
  // Listen for new content being added (for AJAX-loaded content)
  if (typeof MutationObserver !== 'undefined' && document.body) {
    const observer = new MutationObserver(() => {
      initBundleAddFallback();
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  } else if (typeof MutationObserver !== 'undefined') {
    // Wait for body to be available
    document.addEventListener('DOMContentLoaded', () => {
      if (document.body) {
        const observer = new MutationObserver(() => {
          initBundleAddFallback();
        });
        
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
      }
    });
  }
})();
