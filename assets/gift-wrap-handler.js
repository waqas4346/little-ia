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
      if (form.dataset.giftWrapHandlerBound === 'true') return;
      form.dataset.giftWrapHandlerBound = 'true';
      // Capture phase ensures wrapper properties are injected before product-form submit logic reads FormData.
      form.addEventListener('submit', handleFormSubmit, true);
      setupGiftMessageVisibility(form);
    });

  }

  function setupGiftMessageVisibility(form) {
    const giftWrapCheckbox = form.querySelector('.chk_add_gift');
    const christmasGiftCheckbox = form.querySelector('.christmas-chk_add_gift');
    const giftMessageSection = form.querySelector('.gift-message-section');
    const giftMessageInput = form.querySelector('[data-gift-message-input]');
    if (!giftMessageSection) return;

    const submitButtons = Array.from(form.querySelectorAll('button[type="submit"], input[type="submit"]'));

    const toggle = () => {
      const hasGiftWrapSelected = !!(giftWrapCheckbox?.checked || christmasGiftCheckbox?.checked);
      giftMessageSection.classList.toggle('gift-message-section--hidden', !hasGiftWrapSelected);
      submitButtons.forEach((button) => {
        if (!(button instanceof HTMLButtonElement || button instanceof HTMLInputElement)) return;
        if (button.dataset.giftWrapMessageDisabled === 'true') {
          button.disabled = false;
          delete button.dataset.giftWrapMessageDisabled;
        }
      });
    };

    giftWrapCheckbox?.addEventListener('change', toggle);
    christmasGiftCheckbox?.addEventListener('change', toggle);
    giftMessageInput?.addEventListener('input', toggle);
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
      form.dataset.giftWrapCombined = 'false';
      removeHiddenInput(form, 'properties[_gift_wrap_instance_id]');
      removeHiddenInput(form, 'properties[Gift Wrap Instance]');
      return;
    }
    form.dataset.giftWrapCombined = 'true';

    const shouldCreateWrapperInstance = (giftWrapChecked && giftWrapVariantId) || (christmasGiftChecked && christmasGiftVariantId);
    const wrapperInstanceId = shouldCreateWrapperInstance ? generateWrapperInstanceId() : '';
    if (wrapperInstanceId) {
      addHiddenInput(form, 'properties[_gift_wrap_instance_id]', wrapperInstanceId);
      removeHiddenInput(form, 'properties[Gift Wrap Instance]');
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

  }

  function generateWrapperInstanceId() {
    return `gw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function getSectionIds() {
    return Array.from(document.querySelectorAll('cart-items-component[data-section-id]'))
      .map((element) => element.dataset.sectionId)
      .filter(Boolean);
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

