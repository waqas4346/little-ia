/**
 * Gift Wrap Handler
 * Handles adding gift wrap products to cart before the main product
 * Based on GIFT_MESSAGE_AND_WRAP_SYSTEM.md documentation
 */

(function() {
  'use strict';
  const pendingGiftWrapAdds = [];

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    const productForms = document.querySelectorAll('form[data-type="add-to-cart-form"]');
    
    productForms.forEach(form => {
      if (form.dataset.giftWrapHandlerBound === 'true') return;
      form.dataset.giftWrapHandlerBound = 'true';
      form.addEventListener('submit', handleFormSubmit);
      setupGiftMessageVisibility(form);
    });

    if (!window.__giftWrapCartUpdateBound) {
      window.__giftWrapCartUpdateBound = true;
      document.addEventListener('cart:update', handleCartUpdate);
    }
  }

  function setupGiftMessageVisibility(form) {
    const giftWrapCheckbox = form.querySelector('.chk_add_gift');
    const christmasGiftCheckbox = form.querySelector('.christmas-chk_add_gift');
    const giftMessageSection = form.querySelector('.gift-message-section');
    if (!giftMessageSection) return;

    const toggle = () => {
      const hasGiftWrapSelected = !!(giftWrapCheckbox?.checked || christmasGiftCheckbox?.checked);
      giftMessageSection.classList.toggle('gift-message-section--hidden', !hasGiftWrapSelected);
    };

    giftWrapCheckbox?.addEventListener('change', toggle);
    christmasGiftCheckbox?.addEventListener('change', toggle);
    toggle();
  }

  async function handleFormSubmit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;

    const giftWrapCheckbox = form.querySelector('.chk_add_gift');
    const christmasGiftCheckbox = form.querySelector('.christmas-chk_add_gift');
    const giftMessageInput = form.querySelector('[data-gift-message-input]');
    
    let giftWrapChecked = false;
    let christmasGiftChecked = false;
    let giftWrapVariantId = null;
    let christmasGiftVariantId = null;
    let productId = null;
    const giftMessage = giftMessageInput?.value?.trim() || '';

    // Check regular gift wrap
    if (giftWrapCheckbox && giftWrapCheckbox.checked) {
      giftWrapChecked = true;
      giftWrapVariantId = giftWrapCheckbox.value;
      productId = giftWrapCheckbox.getAttribute('data-product-id');
    }

    // Check Christmas gift wrap
    if (christmasGiftCheckbox && christmasGiftCheckbox.checked) {
      christmasGiftChecked = true;
      christmasGiftVariantId = christmasGiftCheckbox.value;
      productId = christmasGiftCheckbox.getAttribute('data-product-id');
    }

    // If no gift wrap is selected, proceed with normal form submission
    if (!giftWrapChecked && !christmasGiftChecked) {
      removeHiddenInput(form, 'properties[_gift_wrap_instance_id]');
      removeHiddenInput(form, 'properties[Gift Wrap Instance]');
      return;
    }

    const wrapperInstanceId = giftWrapChecked && giftWrapVariantId ? generateWrapperInstanceId() : '';
    if (wrapperInstanceId) {
      addHiddenInput(form, 'properties[_gift_wrap_instance_id]', wrapperInstanceId);
      addHiddenInput(form, 'properties[Gift Wrap Instance]', wrapperInstanceId);
    }

    const giftWrapLabel = giftWrapCheckbox?.closest('.gift-wrap-option__content')
      ?.querySelector('.gift-wrap-option__text')?.textContent?.trim();
    if (giftWrapLabel) {
      addHiddenInput(form, 'properties[Add-On]', giftWrapLabel);
    }

    const christmasLabel = christmasGiftCheckbox?.closest('.gift-wrap-option__content')
      ?.querySelector('.gift-wrap-option__text')?.textContent?.trim();
    if (christmasLabel) {
      addHiddenInput(form, 'properties[Christmas Add-On]', christmasLabel);
    }

    // Queue gift-wrap add to run only after main product is successfully added.
    pendingGiftWrapAdds.push({
      productId: productId ? String(productId) : '',
      createdAt: Date.now(),
      regular: giftWrapChecked && giftWrapVariantId ? {
        variantId: giftWrapVariantId,
        wrapperInstanceId,
      } : null,
      christmas: christmasGiftChecked && christmasGiftVariantId ? {
        variantId: christmasGiftVariantId,
      } : null,
      giftMessage,
      processing: false,
    });
  }

  async function handleCartUpdate(event) {
    const source = event?.detail?.data?.source;
    if (source !== 'product-form-component') return;

    const productId = String(event?.detail?.data?.productId || '');
    const pending = pendingGiftWrapAdds.find((item) => !item.processing && item.productId === productId);
    if (!pending) return;

    pending.processing = true;
    try {
      if (pending.regular) {
        await addGiftWrapToCart(pending.regular.variantId, productId, null, 'regular', {
          wrapperInstanceId: pending.regular.wrapperInstanceId,
          giftMessage: pending.giftMessage
        });
      }
      if (pending.christmas) {
        await addGiftWrapToCart(pending.christmas.variantId, productId, null, 'christmas', {
          giftMessage: pending.giftMessage
        });
      }
    } catch (error) {
      console.error('Error adding pending gift wrap:', error);
      showError('Failed to add gift wrap. Please try again.');
    } finally {
      const index = pendingGiftWrapAdds.indexOf(pending);
      if (index > -1) {
        pendingGiftWrapAdds.splice(index, 1);
      }
    }
  }

  function generateWrapperInstanceId() {
    return `gw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function getSectionIds() {
    return Array.from(document.querySelectorAll('cart-items-component[data-section-id]'))
      .map((element) => element.dataset.sectionId)
      .filter(Boolean);
  }

  async function addGiftWrapToCart(variantId, productId, form, type, options) {
    const wrapperInstanceId = options?.wrapperInstanceId;
    const giftMessage = options?.giftMessage;
    const properties = {
      '_added_with_product': productId,
      '_gift_wrap_source': 'product_page'
    };
    if (wrapperInstanceId) {
      properties['_gift_wrap_instance_id'] = wrapperInstanceId;
      properties['Gift Wrap Instance'] = wrapperInstanceId;
    }
    if (giftMessage) {
      properties['_gift_wrap_message'] = giftMessage;
    }

    const data = {
      id: variantId,
      quantity: 1,
      properties: properties,
      sections: getSectionIds().join(','),
      sections_url: window.location.pathname
    };

    try {
      const response = await fetch('/cart/add.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add gift wrap to cart');
      }

      const result = await response.json();
      
      // Dispatch cart update event
      document.dispatchEvent(
        new CustomEvent('cart:update', {
          bubbles: true,
          detail: {
            sourceId: 'gift-wrap-handler',
            data: {
              source: 'gift-wrap-handler',
              sections: result?.sections || {},
            },
          },
        })
      );
      
      return result;
    } catch (error) {
      console.error(`Error adding ${type} gift wrap:`, error);
      throw error;
    }
  }

  function addHiddenInput(form, name, value) {
    // Remove existing input with same name
    const existing = form.querySelector(`input[name="${name}"]`);
    if (existing) {
      existing.remove();
    }

    // Add new hidden input
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }

  function removeHiddenInput(form, name) {
    const existing = form.querySelector(`input[name="${name}"]`);
    if (existing) {
      existing.remove();
    }
  }

  function formatMoney(cents) {
    // Simple money formatter - Shopify stores prices in cents
    if (typeof cents === 'string') {
      cents = parseFloat(cents);
    }
    // Return as-is if already formatted, otherwise convert from cents
    if (cents > 10000) {
      // Likely already in smallest currency unit, convert
      return (cents / 100).toFixed(2);
    }
    return cents.toString();
  }

  function showError(message) {
    // Find or create error display element
    let errorElement = document.querySelector('.gift-wrap-error');
    if (!errorElement) {
      errorElement = document.createElement('div');
      errorElement.className = 'gift-wrap-error';
      errorElement.style.cssText = 'color: red; padding: 10px; margin: 10px 0;';
      document.querySelector('.gift-wrap-message-section')?.prepend(errorElement);
    }
    errorElement.textContent = message;
    
    setTimeout(() => {
      errorElement.remove();
    }, 5000);
  }
})();

