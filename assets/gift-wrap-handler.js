/**
 * Gift Wrap Handler
 * Handles adding gift wrap products to cart before the main product
 * Based on GIFT_MESSAGE_AND_WRAP_SYSTEM.md documentation
 */

(function() {
  'use strict';

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    const productForms = document.querySelectorAll('form[data-type="add-to-cart-form"]');
    
    productForms.forEach(form => {
      form.addEventListener('submit', handleFormSubmit);
    });
  }

  async function handleFormSubmit(event) {
    const form = event.target;
    const giftWrapCheckbox = form.querySelector('.chk_add_gift');
    const christmasGiftCheckbox = form.querySelector('.christmas-chk_add_gift');
    
    let giftWrapChecked = false;
    let christmasGiftChecked = false;
    let giftWrapVariantId = null;
    let christmasGiftVariantId = null;
    let productId = null;

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
      return;
    }

    // Prevent default form submission
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    try {
      // Add regular gift wrap first if checked
      if (giftWrapChecked && giftWrapVariantId) {
        await addGiftWrapToCart(giftWrapVariantId, productId, form, 'regular');
        
        // Add property to form for the original product
        const giftWrapLabel = giftWrapCheckbox.closest('.gift-wrap-option__content')
          ?.querySelector('.gift-wrap-option__text')?.textContent?.trim();
        if (giftWrapLabel) {
          addHiddenInput(form, 'properties[Add-On]', giftWrapLabel);
        }
      }

      // Add Christmas gift wrap if checked
      if (christmasGiftChecked && christmasGiftVariantId) {
        await addGiftWrapToCart(christmasGiftVariantId, productId, form, 'christmas');
        
        // Add property to form for the original product
        const christmasLabel = christmasGiftCheckbox.closest('.gift-wrap-option__content')
          ?.querySelector('.gift-wrap-option__text')?.textContent?.trim();
        if (christmasLabel) {
          addHiddenInput(form, 'properties[Christmas Add-On]', christmasLabel);
        }
      }

      // Now submit the original form by triggering the product form component's handleSubmit
      const productFormComponent = form.closest('product-form-component');
      if (productFormComponent && typeof productFormComponent.handleSubmit === 'function') {
        // Create a synthetic event that mimics the original
        const syntheticEvent = {
          target: form,
          currentTarget: form,
          preventDefault: () => {},
          stopPropagation: () => {},
          stopImmediatePropagation: () => {},
          type: 'submit',
          bubbles: true,
          cancelable: true,
          defaultPrevented: false
        };
        
        // Call handleSubmit directly
        productFormComponent.handleSubmit(syntheticEvent);
      } else {
        // Fallback: create a new submit event and dispatch it
        const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
        form.dispatchEvent(submitEvent);
      }

    } catch (error) {
      console.error('Error adding gift wrap to cart:', error);
      // Show error message to user
      showError('Failed to add gift wrap. Please try again.');
      // Re-enable form submission
      form.removeAttribute('data-gift-wrap-processing');
    }
  }

  async function addGiftWrapToCart(variantId, productId, form, type) {
    const properties = {
      '_added_with_product': productId
    };

    const data = {
      id: variantId,
      quantity: 1,
      properties: properties
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
      document.dispatchEvent(new CustomEvent('cart:update', { detail: result }));
      
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

