import { morphSection } from '@theme/section-renderer';

/**
 * Auto-applies discount code for party-favours products
 */
class PartyFavoursDiscount {
  constructor() {
    this.isApplyingDiscount = false;
    this.pendingDiscountApplication = false;
    this.discountCode = null;
    this.section = null;
  }

  /**
   * Initializes the discount auto-apply functionality
   * @param {HTMLElement} section - The party-favours section element
   * @param {string} discountCode - The discount code to apply
   */
  init(section, discountCode) {
    if (!discountCode || discountCode.trim() === '') return;
    if (!section) return;
    
    this.discountCode = discountCode.trim();
    this.section = section;
    
    // Store section ID for verification
    this.sectionId = section.id || section.getAttribute('data-section-id') || null;

    // Mark product forms from party-favours section
    this.markPartyFavoursForms();

    // Listen for cart updates - use bound handler
    this.boundHandler = this.handleCartUpdate.bind(this);
    document.addEventListener('cart:update', this.boundHandler, { passive: true, capture: true });

    // Re-mark forms periodically in case new ones are added
    setInterval(() => this.markPartyFavoursForms(), 2000);
  }
  
  /**
   * Cleanup method to remove event listeners
   */
  destroy() {
    if (this.boundHandler) {
      document.removeEventListener('cart:update', this.boundHandler);
      this.boundHandler = null;
    }
  }

  /**
   * Marks product forms as coming from party-favours section
   */
  markPartyFavoursForms() {
    if (!this.section) return;
    
    // Only mark forms that are actually within the party-favours section
    const productForms = this.section.querySelectorAll('product-form-component');
    productForms.forEach((form) => {
      // Only mark if form is actually contained within the section
      if (this.section.contains(form)) {
        form.setAttribute('data-party-favours', 'true');
      } else {
        // Remove attribute if form is no longer in section
        form.removeAttribute('data-party-favours');
      }
    });

    // Also mark forms in quick-add modal ONLY if modal is marked as party-favours
    const modalContent = document.getElementById('quick-add-modal-content');
    if (modalContent && modalContent.hasAttribute('data-party-favours')) {
      const modalForms = modalContent.querySelectorAll('product-form-component');
      modalForms.forEach((form) => {
        form.setAttribute('data-party-favours', 'true');
      });
    } else {
      // Remove attribute from modal forms if modal is not party-favours
      const modalForms = document.querySelectorAll('#quick-add-modal-content product-form-component[data-party-favours]');
      modalForms.forEach((form) => {
        form.removeAttribute('data-party-favours');
      });
    }
  }

  /**
   * Handles cart update events
   * @param {Event} event - The cart update event
   */
  handleCartUpdate(event) {
    if (this.isApplyingDiscount || this.pendingDiscountApplication) return;
    if (!this.section) return;

    // Check event detail to see if this is from a product form
    const eventDetail = event.detail;
    const eventSource = eventDetail?.data?.source;
    
    // Only process events from product-form-component
    if (eventSource !== 'product-form-component') {
      return; // Not from a product form, ignore
    }

    // Find the product-form-component that triggered this event
    // Try event.target first, then search by sourceId
    let formComponent = event.target;
    
    // If event.target is not a product-form-component, try to find it by sourceId
    if (!formComponent || 
        !(formComponent instanceof HTMLElement) ||
        formComponent.tagName.toLowerCase() !== 'product-form-component') {
      const sourceId = eventDetail?.sourceId;
      if (sourceId) {
        formComponent = document.getElementById(sourceId);
      }
      
      // If still not found, try to find the form component in the event path
      if (!formComponent || formComponent.tagName.toLowerCase() !== 'product-form-component') {
        const path = event.composedPath ? event.composedPath() : [];
        formComponent = path.find(el => 
          el instanceof HTMLElement && 
          el.tagName.toLowerCase() === 'product-form-component'
        );
      }
    }
    
    // Final check: Is this actually a product-form-component?
    if (!formComponent || 
        !(formComponent instanceof HTMLElement) ||
        formComponent.tagName.toLowerCase() !== 'product-form-component') {
      return; // Not a product form, ignore
    }
    
    // CRITICAL CHECK: Verify the form is actually within our specific section
    // This is the most important check - if form is not in our section, ignore immediately
    const isFormInOurSection = this.section.contains(formComponent);
    
    // SAFETY CHECK: If we're on a product page (has main-product section), don't apply discount
    // unless the form is explicitly in our party-favours section
    const productPageSection = document.querySelector('[data-section-type="main-product"]');
    if (productPageSection) {
      // If form is in product page section and NOT in our section, definitely ignore
      if (productPageSection.contains(formComponent) && !isFormInOurSection) {
        return; // This is a product page form, not from party-favours section
      }
    }
    
    // If form is not in our section at all, check if it's from modal
    // Otherwise, ignore completely
    if (!isFormInOurSection) {
      // SECONDARY CHECK: Is this from quick-add modal opened from party-favours?
      // Only check if form has the attribute AND modal is marked as party-favours
      if (!formComponent.hasAttribute('data-party-favours')) {
        return; // Form doesn't have party-favours attribute, ignore
      }
      
      const modalContent = document.getElementById('quick-add-modal-content');
      // Verify modal is currently marked as party-favours (not stale)
      // AND verify the form is actually in the modal
      if (!modalContent || 
          !modalContent.hasAttribute('data-party-favours') ||
          !modalContent.contains(formComponent)) {
        return; // Modal is not marked as party-favours or form not in modal, ignore
      }
      
      // CRITICAL: Verify the modal was opened from a product card within OUR section
      // Check if there's a product card with data-party-favours that's within our section
      const partyFavoursCard = this.section.querySelector('product-card[data-party-favours="true"]');
      if (!partyFavoursCard || !this.section.contains(partyFavoursCard)) {
        return; // No party-favours card in our section, ignore
      }
    }

    // If we get here, the form is from party-favours (either in section or modal from section)
    this.pendingDiscountApplication = true;
    
    // Mark the form so we don't apply multiple times
    formComponent.setAttribute('data-discount-applied', 'true');
    
    // Apply discount after cart is updated
    setTimeout(() => {
      this.applyDiscountCode();
    }, 800);
  }

  /**
   * Applies the discount code to the cart
   */
  async applyDiscountCode() {
    if (this.isApplyingDiscount) return;
    this.isApplyingDiscount = true;

    try {
      // Wait a bit for cart to be fully updated
      await new Promise(resolve => setTimeout(resolve, 500));

      // Get current cart to check existing discount codes
      const cartResponse = await fetch('/cart.js');
      const cart = await cartResponse.json();
      
      // Check if discount code is already applied
      const existingDiscounts = cart.discount_codes || [];
      if (existingDiscounts.some((d) => d.code === this.discountCode)) {
        this.isApplyingDiscount = false;
        this.pendingDiscountApplication = false;
        return; // Already applied
      }

      // Find cart section ID
      let sectionId = null;
      
      // Try cart drawer first
      const cartDrawer = document.querySelector('cart-drawer-component');
      if (cartDrawer?.dataset.sectionId) {
        sectionId = cartDrawer.dataset.sectionId;
      } else {
        // Try cart items component
        const cartItems = document.querySelector('cart-items-component');
        if (cartItems?.dataset.sectionId) {
          sectionId = cartItems.dataset.sectionId;
        } else {
          // Try cart page
          const cartPage = document.querySelector('[data-section-type="cart"]');
          if (cartPage) {
            sectionId = cartPage.id?.replace('shopify-section-', '');
          }
        }
      }

      if (!sectionId) {
        console.warn('Party Favours: Could not find cart section ID to apply discount');
        this.isApplyingDiscount = false;
        this.pendingDiscountApplication = false;
        return;
      }

      // Get existing discount codes from cart
      const existingCodes = existingDiscounts.map((d) => d.code).filter(Boolean);
      const discountCodesToApply = [...existingCodes, this.discountCode].join(',');

      // Apply discount code using the same method as cart-discount component
      const response = await fetch(window.Theme?.routes?.cart_update_url || '/cart/update.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          discount: discountCodesToApply,
          sections: sectionId
        })
      });

      if (!response.ok) {
        console.warn('Party Favours: Failed to apply discount code', response.statusText);
        this.isApplyingDiscount = false;
        this.pendingDiscountApplication = false;
        return;
      }

      const data = await response.json();

      // Check if discount was successfully applied
      if (data.discount_codes) {
        const applied = data.discount_codes.some((d) => {
          return d.code === this.discountCode && d.applicable === true;
        });
        if (applied && data.sections && data.sections[sectionId]) {
          // Update cart UI using morphSection
          try {
            await morphSection(sectionId, data.sections[sectionId]);
          } catch (e) {
            console.warn('Party Favours: Error updating cart section with morphSection', e);
            // Fallback: manual update
            const sectionElement = document.getElementById('shopify-section-' + sectionId);
            if (sectionElement) {
              const parser = new DOMParser();
              const doc = parser.parseFromString(data.sections[sectionId], 'text/html');
              const newSection = doc.getElementById('shopify-section-' + sectionId);
              if (newSection) {
                sectionElement.innerHTML = newSection.innerHTML;
              }
            }
          }
          
          // Dispatch discount update event (same as cart-discount component)
          document.dispatchEvent(new CustomEvent('discount:update', {
            bubbles: true,
            detail: {
              resource: data,
              sourceId: 'party-favours-auto-discount'
            }
          }));
          
          // Also dispatch cart update event
          document.dispatchEvent(new CustomEvent('cart:update', {
            bubbles: true,
            detail: data
          }));
        }
      }
    } catch (error) {
      console.warn('Party Favours: Error applying discount code', error);
    } finally {
      this.isApplyingDiscount = false;
      this.pendingDiscountApplication = false;
    }
  }
}

// Create singleton instance
const partyFavoursDiscount = new PartyFavoursDiscount();

// Export for use in Liquid template
if (typeof window !== 'undefined') {
  window.partyFavoursDiscount = partyFavoursDiscount;
}

export default partyFavoursDiscount;
