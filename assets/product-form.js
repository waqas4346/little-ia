import { Component } from '@theme/component';
import { fetchConfig, preloadImage, onAnimationEnd } from '@theme/utilities';
import { ThemeEvents, CartAddEvent, CartErrorEvent, CartUpdateEvent, VariantUpdateEvent } from '@theme/events';
import { cartPerformance } from '@theme/performance';
import { morph } from '@theme/morph';

// Error message display duration - gives users time to read the message
const ERROR_MESSAGE_DISPLAY_DURATION = 10000;

// Button re-enable delay after error - prevents rapid repeat attempts
const ERROR_BUTTON_REENABLE_DELAY = 1000;

// Success message display duration for screen readers
const SUCCESS_MESSAGE_DISPLAY_DURATION = 5000;

/**
 * A custom element that manages an add to cart button.
 *
 * @typedef {object} AddToCartRefs
 * @property {HTMLButtonElement} addToCartButton - The add to cart button.
 * @extends Component<AddToCartRefs>
 */
export class AddToCartComponent extends Component {
  requiredRefs = ['addToCartButton'];

  /** @type {number[] | undefined} */
  #resetTimeouts = /** @type {number[]} */ ([]);

  connectedCallback() {
    super.connectedCallback();

    this.addEventListener('pointerenter', this.#preloadImage);
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    if (this.#resetTimeouts) {
      this.#resetTimeouts.forEach(/** @param {number} timeoutId */ (timeoutId) => clearTimeout(timeoutId));
    }
    this.removeEventListener('pointerenter', this.#preloadImage);
  }

  /**
   * Disables the add to cart button.
   */
  disable() {
    this.refs.addToCartButton.disabled = true;
  }

  /**
   * Enables the add to cart button.
   */
  enable() {
    this.refs.addToCartButton.disabled = false;
  }

  /**
   * Handles the click event for the add to cart button.
   * @param {MouseEvent & {target: HTMLElement}} event - The click event.
   */
  handleClick(event) {
    const form = this.closest('form');
    if (!form?.checkValidity()) return;

    // Check if adding would exceed max before animating
    const productForm = /** @type {ProductFormComponent | null} */ (this.closest('product-form-component'));
    const quantitySelector = productForm?.refs.quantitySelector;
    if (quantitySelector?.canAddToCart) {
      const validation = quantitySelector.canAddToCart();
      // Don't animate if it would exceed max
      if (!validation.canAdd) {
        return;
      }
    }
    if (this.refs.addToCartButton.dataset.puppet !== 'true') {
      const animationEnabled = this.dataset.addToCartAnimation === 'true';
      if (animationEnabled && !event.target.closest('.quick-add-modal')) {
        this.#animateFlyToCart();
      }
      this.animateAddToCart();
    }
  }

  #preloadImage = () => {
    const image = this.dataset.productVariantMedia;

    if (!image) return;

    preloadImage(image);
  };

  /**
   * Animates the fly to cart animation.
   */
  #animateFlyToCart() {
    const { addToCartButton } = this.refs;
    const cartIcon = document.querySelector('.header-actions__cart-icon');

    const image = this.dataset.productVariantMedia;

    if (!cartIcon || !addToCartButton || !image) return;

    const flyToCartElement = /** @type {FlyToCart} */ (document.createElement('fly-to-cart'));

    let flyToCartClass = addToCartButton.classList.contains('quick-add__button')
      ? 'fly-to-cart--quick'
      : 'fly-to-cart--main';

    flyToCartElement.classList.add(flyToCartClass);
    flyToCartElement.style.setProperty('background-image', `url(${image})`);
    flyToCartElement.style.setProperty('--start-opacity', '0');
    flyToCartElement.source = addToCartButton;
    flyToCartElement.destination = cartIcon;

    document.body.appendChild(flyToCartElement);
  }

  /**
   * Animates the add to cart button.
   */
  animateAddToCart = async function () {
    const { addToCartButton } = this.refs;

    // Initialize the array if it doesn't exist
    if (!this.#resetTimeouts) {
      this.#resetTimeouts = [];
    }

    // Clear all existing timeouts
    this.#resetTimeouts.forEach(/** @param {number} timeoutId */ (timeoutId) => clearTimeout(timeoutId));
    this.#resetTimeouts = [];

    if (addToCartButton.dataset.added !== 'true') {
      addToCartButton.dataset.added = 'true';
    }

    await onAnimationEnd(addToCartButton);

    // Create new timeout and store it in the array
    const timeoutId = setTimeout(() => {
      addToCartButton.removeAttribute('data-added');

      // Remove this timeout from the array
      const index = this.#resetTimeouts.indexOf(timeoutId);
      if (index > -1) {
        this.#resetTimeouts.splice(index, 1);
      }
    }, 800);

    this.#resetTimeouts.push(timeoutId);
  };
}

if (!customElements.get('add-to-cart-component')) {
  customElements.define('add-to-cart-component', AddToCartComponent);
}

/**
 * A custom element that manages a product form.
 *
 * @typedef {{items: Array<{quantity: number, variant_id: number}>}} Cart
 *
 * @typedef {object} ProductFormRefs
 * @property {HTMLInputElement} variantId - The form input for submitting the variant ID.
 * @property {AddToCartComponent | undefined} addToCartButtonContainer - The add to cart button container element.
 * @property {HTMLElement | undefined} addToCartTextError - The add to cart text error.
 * @property {HTMLElement | undefined} acceleratedCheckoutButtonContainer - The accelerated checkout button container element.
 * @property {HTMLElement} liveRegion - The live region.
 * @property {HTMLElement | undefined} quantityLabelCartCount - The quantity label cart count element.
 * @property {HTMLElement | undefined} quantityRules - The quantity rules element.
 * @property {HTMLElement | undefined} productFormButtons - The product form buttons container.
 * @property {HTMLElement | undefined} volumePricing - The volume pricing component.
 * @property {any | undefined} quantitySelector - The quantity selector component.
 * @property {HTMLElement | undefined} quantitySelectorWrapper - The quantity selector wrapper element.
 * @property {HTMLElement | undefined} quantityLabel - The quantity label element.
 * @property {HTMLElement | undefined} pricePerItem - The price per item component.
 *
 * @extends Component<ProductFormRefs>
 */
class ProductFormComponent extends Component {
  requiredRefs = ['variantId', 'liveRegion'];
  #abortController = new AbortController();

  /** @type {number | undefined} */
  #timeout;
  
  /** @type {boolean | undefined} */
  #variantAvailable = true;

  connectedCallback() {
    super.connectedCallback();

    const { signal } = this.#abortController;
    const target = this.closest('.shopify-section, dialog, product-card');
    target?.addEventListener(ThemeEvents.variantUpdate, this.#onVariantUpdate, { signal });
    target?.addEventListener(ThemeEvents.variantSelected, this.#onVariantSelected, { signal });

    // Listen for cart updates to sync data-cart-quantity
    document.addEventListener(ThemeEvents.cartUpdate, this.#onCartUpdate, { signal });
    
    // Listen for personalization checkbox changes (use document to catch events from anywhere)
    document.addEventListener('change', this.#onPersonalisationCheckboxChange, { signal });
    
    // Listen for personalization saved event
    document.addEventListener('personalisation-saved', this.#onPersonalisationSaved, { signal });
    
    // Initial button state check
    setTimeout(() => this.#updateAddToCartButtonState(), 100);
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    this.#abortController.abort();
  }

  /**
   * Checks if personalization confirmation checkbox is required and checked
   * @returns {boolean} true if personalization is confirmed or not required, false if required but not checked
   */
  #isPersonalisationConfirmed() {
    const form = this.querySelector('form');
    if (!form) return true; // No form, assume confirmed
    
    const personalisationConfirmation = this.querySelector('[data-personalise-confirmation]');
    const personalisationCheckbox = personalisationConfirmation?.querySelector('[data-personalise-confirm-checkbox]');
    
    if (!personalisationConfirmation || !personalisationCheckbox) return true; // No personalization, assume confirmed
    
    // Check if confirmation container is visible
    const isVisible = personalisationConfirmation.offsetParent !== null || 
                      personalisationConfirmation.style.display !== 'none' ||
                      window.getComputedStyle(personalisationConfirmation).display !== 'none';
    
    if (!isVisible) return true; // Not visible, personalization not present
    
    // If visible, checkbox must be checked
    return personalisationCheckbox.checked;
  }

  /**
   * Updates the add to cart button state based on variant availability and personalization confirmation
   */
  #updateAddToCartButtonState() {
    const { addToCartButtonContainer } = this.refs;
    if (!addToCartButtonContainer) return;
    
    // Use stored variant availability (defaults to true if not set yet)
    const variantAvailable = this.#variantAvailable !== false;
    
    // Check personalization confirmation
    const personalisationConfirmed = this.#isPersonalisationConfirmed();
    
    // Disable if variant not available OR personalization not confirmed
    if (!variantAvailable || !personalisationConfirmed) {
      addToCartButtonContainer.disable();
    } else {
      addToCartButtonContainer.enable();
    }
    
    // Also update sticky bar button if it exists
    const productId = this.dataset.productId;
    if (productId) {
      const stickyBar = document.querySelector(`sticky-add-to-cart[data-product-id="${productId}"]`);
      if (stickyBar) {
        // Try to access via component refs first (if component is defined)
        let stickyButton = null;
        if (stickyBar.refs && stickyBar.refs.addToCartButton) {
          stickyButton = stickyBar.refs.addToCartButton;
        } else {
          // Fallback to class selector
          stickyButton = stickyBar.querySelector('.sticky-add-to-cart__button');
        }
        
        if (stickyButton) {
          if (!variantAvailable || !personalisationConfirmed) {
            stickyButton.disabled = true;
          } else {
            stickyButton.disabled = false;
          }
        }
      }
    }
  }

  /**
   * Handles personalization checkbox change events
   * @param {Event} event - The change event
   */
  #onPersonalisationCheckboxChange = (event) => {
    if (event.target?.matches('[data-personalise-confirm-checkbox]')) {
      this.#updateAddToCartButtonState();
    }
  };

  /**
   * Handles personalization saved events
   */
  #onPersonalisationSaved = () => {
    setTimeout(() => this.#updateAddToCartButtonState(), 200);
  };

  /**
   * Updates quantity selector with cart data for current variant
   * @param {Cart} cart - The cart object with items array
   * @returns {number} The cart quantity for the current variant
   */
  #updateCartQuantityFromData(cart) {
    const variantIdInput = /** @type {HTMLInputElement | null} */ (this.querySelector('input[name="id"]'));
    if (!variantIdInput?.value || !cart?.items) return 0;

    const cartItem = cart.items.find((item) => item.variant_id.toString() === variantIdInput.value.toString());
    const cartQty = cartItem ? cartItem.quantity : 0;

    // Use public API to update quantity selector
    const quantitySelector = /** @type {any | undefined} */ (this.querySelector('quantity-selector-component'));
    if (quantitySelector?.setCartQuantity) {
      quantitySelector.setCartQuantity(cartQty);
    }

    // Update quantity label if it exists
    this.#updateQuantityLabel(cartQty);

    return cartQty;
  }

  /**
   * Fetches cart and updates quantity selector for current variant
   * @returns {Promise<number>} The cart quantity for the current variant
   */
  async #fetchAndUpdateCartQuantity() {
    const variantIdInput = /** @type {HTMLInputElement | null} */ (this.querySelector('input[name="id"]'));
    if (!variantIdInput?.value) return 0;

    try {
      const response = await fetch('/cart.js');
      const cart = await response.json();

      return this.#updateCartQuantityFromData(cart);
    } catch (error) {
      console.error('Failed to fetch cart quantity:', error);
      return 0;
    }
  }

  /**
   * Updates data-cart-quantity when cart is updated from elsewhere
   * @param {CartUpdateEvent|CartAddEvent} event
   */
  #onCartUpdate = async (event) => {
    // Skip if this event came from this component
    if (event.detail?.sourceId === this.id || event.detail?.data?.source === 'product-form-component') return;

    const cart = /** @type {Cart} */ (event.detail?.resource);
    if (cart?.items) {
      this.#updateCartQuantityFromData(cart);
    } else {
      await this.#fetchAndUpdateCartQuantity();
    }
  };

  /**
   * Handles the submit event for the product form.
   *
   * @param {Event} event - The submit event.
   */
  handleSubmit(event) {
    const { addToCartTextError } = this.refs;
    
    console.log('ProductFormComponent.handleSubmit called', {
      productId: this.dataset.productId,
      hasPersonalisationFunction: !!this._addPersonalisationFields,
      hasPersonalisationForm: !!this._personalisationForm,
      windowCurrentPersonalisation: window.currentPersonalisation ? 'exists' : 'missing'
    });
    
    // Stop default behaviour from the browser
    event.preventDefault();

    if (this.#timeout) clearTimeout(this.#timeout);

    // Query for ALL add-to-cart components
    const allAddToCartContainers = /** @type {NodeListOf<AddToCartComponent>} */ (
      this.querySelectorAll('add-to-cart-component')
    );

    // Check if ANY add to cart button is disabled and do an early return if it is
    const anyButtonDisabled = Array.from(allAddToCartContainers).some(
      (container) => container.refs.addToCartButton?.disabled
    );
    if (anyButtonDisabled) return;

    // Send the add to cart information to the cart
    const form = this.querySelector('form');

    if (!form) throw new Error('Product form element missing');

    // Check if personalization confirmation is required and checked
    if (!this.#isPersonalisationConfirmed()) {
      // Disable all add to cart buttons and return early
      for (const container of allAddToCartContainers) {
        container.disable();
      }
      return;
    }

    if (this.refs.quantitySelector?.canAddToCart) {
      const validation = this.refs.quantitySelector.canAddToCart();

      if (!validation.canAdd) {
        // Disable ALL add-to-cart buttons
        for (const container of allAddToCartContainers) {
          container.disable();
        }

        const errorTemplate = this.dataset.quantityErrorMax || '';
        const errorMessage = errorTemplate.replace('{{ maximum }}', validation.maxQuantity?.toString() || '');
        if (addToCartTextError) {
          addToCartTextError.classList.remove('hidden');

          const textNode = addToCartTextError.childNodes[2];
          if (textNode) {
            textNode.textContent = errorMessage;
          } else {
            const newTextNode = document.createTextNode(errorMessage);
            addToCartTextError.appendChild(newTextNode);
          }

          this.#setLiveRegionText(errorMessage);

          if (this.#timeout) clearTimeout(this.#timeout);
          this.#timeout = setTimeout(() => {
            if (!addToCartTextError) return;
            addToCartTextError.classList.add('hidden');
            this.#clearLiveRegionText();
          }, ERROR_MESSAGE_DISPLAY_DURATION);
        }

        setTimeout(() => {
          // Re-enable ALL add-to-cart buttons
          for (const container of allAddToCartContainers) {
            container.enable();
          }
        }, ERROR_BUTTON_REENABLE_DELAY);

        return;
      }
    }

    // Ensure personalisation fields are in the form before creating FormData
    // Check if there's a function to add personalisation fields
    if (this._addPersonalisationFields && this._personalisationForm) {
      console.log('ProductFormComponent: Adding personalisation fields before FormData creation');
      this._addPersonalisationFields(this._personalisationForm);
    } else if (window.currentPersonalisation) {
      // Fallback: directly add personalisation fields if function not available
      console.log('ProductFormComponent: Direct fallback - adding personalisation fields from window.currentPersonalisation');
      
      // Try to get personalisation by product ID first
      const productId = this.dataset.productId;
      let personalisation = null;
      
      if (productId && window.currentPersonalisation[productId]) {
        personalisation = { ...window.currentPersonalisation[productId] };
        console.log('Found personalisation for product ID:', productId);
      } else if (window.currentPersonalisation._latest) {
        personalisation = { ...window.currentPersonalisation._latest };
        console.log('Using latest personalisation as fallback');
      } else if (typeof window.currentPersonalisation === 'object' && !Array.isArray(window.currentPersonalisation)) {
        // Check if it's a direct object (old format)
        const hasProductKeys = Object.keys(window.currentPersonalisation).some(key => key.startsWith('_') || /^\d+$/.test(key));
        if (!hasProductKeys) {
          personalisation = { ...window.currentPersonalisation };
          console.log('Using direct personalisation object');
        }
      }
      
      if (!personalisation) {
        console.warn('ProductFormComponent: window.currentPersonalisation exists but no valid personalisation found');
        personalisation = {};
      }
      
      // Remove existing personalisation inputs first
      const existingProps = form.querySelectorAll('input[name^="properties["], textarea[name^="properties["]');
      existingProps.forEach(input => {
        const name = input.name;
        const isPersonalisation = 
          name === 'properties[Name]' ||
          name === 'properties[Name 1]' ||
          name === 'properties[Name 2]' ||
          name === 'properties[Name 3]' ||
          name === 'properties[Name 4]' ||
          name.includes('[Text Font]') || 
          name.includes('[Text Color]') || 
          (name.includes('[Date of Birth]') && !name.includes('Gift')) || 
          name.includes('[School Year]') || 
          name.includes('[Personalisation:]') || 
          name.includes('[Personalise Date of Birth]') || 
          name.includes('[Time]') || 
          name.includes('[Weight]') ||
          name.includes('[Baby\'s Name]') ||
          name.includes('[Kid\'s Name]') ||
          name.includes('[Mum\'s Name]') ||
          (name === 'properties[Message]' && !name.includes('Gift'));
        
        if (isPersonalisation) {
          input.remove();
        }
      });
      
      // Add personalisation properties
      const addProperty = (name, value) => {
        if (value && value.toString().trim() !== '') {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = name;
          input.value = value.toString().trim();
          const variantInput = form.querySelector('input[name="id"]');
          if (variantInput) {
            variantInput.parentNode.insertBefore(input, variantInput.nextSibling);
          } else {
            form.appendChild(input);
          }
          console.log('Added personalisation property (fallback):', name, '=', input.value);
        }
      };
      
      if (personalisation.name) addProperty('properties[Name]', personalisation.name);
      if (personalisation.font) addProperty('properties[Text Font]', personalisation.font);
      if (personalisation.color) addProperty('properties[Text Color]', personalisation.color);
      if (personalisation.dob) addProperty('properties[Date of Birth]', personalisation.dob);
      if (personalisation.schoolYear) addProperty('properties[School Year]', personalisation.schoolYear);
      if (personalisation.name1) addProperty('properties[Name 1]', personalisation.name1);
      if (personalisation.name2) addProperty('properties[Name 2]', personalisation.name2);
      if (personalisation.name3) addProperty('properties[Name 3]', personalisation.name3);
      if (personalisation.name4) addProperty('properties[Name 4]', personalisation.name4);
      if (personalisation.textbox) addProperty('properties[Personalisation:]', personalisation.textbox);
      if (personalisation.message) addProperty('properties[Message]', personalisation.message);
      if (personalisation.optionalDob) addProperty('properties[Personalise Date of Birth]', personalisation.optionalDob);
      if (personalisation.time) addProperty('properties[Time]', personalisation.time);
      if (personalisation.weight) addProperty('properties[Weight]', personalisation.weight);
      if (personalisation.babyName) addProperty('properties[Baby\'s Name]', personalisation.babyName);
      if (personalisation.kidName) addProperty('properties[Kid\'s Name]', personalisation.kidName);
      if (personalisation.mumName) addProperty('properties[Mum\'s Name]', personalisation.mumName);
    }
    
    // Also check if form has personalisation inputs
    const personalisationInputs = form.querySelectorAll('input[name^="properties["]');
    const actualPersonalisationInputs = Array.from(personalisationInputs).filter(input => {
      const name = input.name;
      return name === 'properties[Name]' ||
             name.includes('[Text Font]') || 
             name.includes('[Text Color]') || 
             name.includes('[Date of Birth]') || 
             name.includes('[School Year]') || 
             name.includes('[Name 1]') || 
             name.includes('[Name 2]') || 
             name.includes('[Name 3]') || 
             name.includes('[Name 4]') || 
             name.includes('[Personalisation:]') || 
             name.includes('[Personalise Date of Birth]') || 
             name.includes('[Time]') || 
             name.includes('[Weight]') ||
             name.includes('[Baby\'s Name]') ||
             name.includes('[Kid\'s Name]') ||
             name.includes('[Mum\'s Name]') ||
             name === 'properties[Message]';
    });
    console.log('ProductFormComponent: Found', actualPersonalisationInputs.length, 'personalisation inputs in form before FormData');
    if (actualPersonalisationInputs.length > 0) {
      actualPersonalisationInputs.forEach(input => {
        console.log('  - Personalisation input:', input.name, '=', input.value);
      });
    } else {
      console.warn('ProductFormComponent: WARNING - No personalisation inputs found in form!');
    }

    // Create FormData and manually ensure personalisation is included
    const formData = new FormData(form);
    
    // Double-check: if no personalisation in FormData, add it directly
    const formDataEntries = Array.from(formData.entries());
    const personalisationEntries = formDataEntries.filter(([key]) => {
      const name = key;
      return name === 'properties[Name]' ||
             name.includes('[Text Font]') || 
             name.includes('[Text Color]') || 
             name.includes('[Date of Birth]') || 
             name.includes('[School Year]') || 
             name.includes('[Name 1]') || 
             name.includes('[Name 2]') || 
             name.includes('[Name 3]') || 
             name.includes('[Name 4]') || 
             name.includes('[Personalisation:]') || 
             name.includes('[Personalise Date of Birth]') || 
             name.includes('[Time]') || 
             name.includes('[Weight]') ||
             name.includes('[Baby\'s Name]') ||
             name.includes('[Kid\'s Name]') ||
             name.includes('[Mum\'s Name]') ||
             name === 'properties[Message]';
    });
    
    console.log('ProductFormComponent: FormData contains', personalisationEntries.length, 'personalisation properties');
    if (personalisationEntries.length > 0) {
      personalisationEntries.forEach(([key, value]) => {
        console.log('  - FormData personalisation property:', key, '=', value);
      });
    } else {
      // No personalisation in FormData - try to add it directly
      console.warn('ProductFormComponent: WARNING - No personalisation in FormData, attempting to add directly');
      
      const productId = this.dataset.productId;
      let personalisation = null;
      
      if (productId && window.currentPersonalisation?.[productId]) {
        personalisation = { ...window.currentPersonalisation[productId] };
      } else if (window.currentPersonalisation?._latest) {
        personalisation = { ...window.currentPersonalisation._latest };
      } else if (window.currentPersonalisation && typeof window.currentPersonalisation === 'object' && !Array.isArray(window.currentPersonalisation)) {
        const hasProductKeys = Object.keys(window.currentPersonalisation).some(key => key.startsWith('_') || /^\d+$/.test(key));
        if (!hasProductKeys) {
          personalisation = { ...window.currentPersonalisation };
        }
      }
      
      if (personalisation) {
        const addToFormData = (name, value) => {
          if (value && value.toString().trim() !== '') {
            formData.append(name, value.toString().trim());
            console.log('Added to FormData directly:', name, '=', value);
          }
        };
        
        if (personalisation.name) addToFormData('properties[Name]', personalisation.name);
        if (personalisation.font) addToFormData('properties[Text Font]', personalisation.font);
        if (personalisation.color) addToFormData('properties[Text Color]', personalisation.color);
        if (personalisation.dob) addToFormData('properties[Date of Birth]', personalisation.dob);
        if (personalisation.schoolYear) addToFormData('properties[School Year]', personalisation.schoolYear);
        if (personalisation.name1) addToFormData('properties[Name 1]', personalisation.name1);
        if (personalisation.name2) addToFormData('properties[Name 2]', personalisation.name2);
        if (personalisation.name3) addToFormData('properties[Name 3]', personalisation.name3);
        if (personalisation.name4) addToFormData('properties[Name 4]', personalisation.name4);
        if (personalisation.textbox) addToFormData('properties[Personalisation:]', personalisation.textbox);
        if (personalisation.message) addToFormData('properties[Message]', personalisation.message);
        if (personalisation.optionalDob) addToFormData('properties[Personalise Date of Birth]', personalisation.optionalDob);
        if (personalisation.time) addToFormData('properties[Time]', personalisation.time);
        if (personalisation.weight) addToFormData('properties[Weight]', personalisation.weight);
        if (personalisation.babyName) addToFormData('properties[Baby\'s Name]', personalisation.babyName);
        if (personalisation.kidName) addToFormData('properties[Kid\'s Name]', personalisation.kidName);
        if (personalisation.mumName) addToFormData('properties[Mum\'s Name]', personalisation.mumName);
        
        console.log('Added personalisation directly to FormData');
      } else {
        console.error('ProductFormComponent: ERROR - No personalisation data available to add to FormData');
      }
    }

    const cartItemsComponents = document.querySelectorAll('cart-items-component');
    let cartItemComponentsSectionIds = [];
    cartItemsComponents.forEach((item) => {
      if (item instanceof HTMLElement && item.dataset.sectionId) {
        cartItemComponentsSectionIds.push(item.dataset.sectionId);
      }
      formData.append('sections', cartItemComponentsSectionIds.join(','));
    });

    const fetchCfg = fetchConfig('javascript', { body: formData });

    fetch(Theme.routes.cart_add_url, {
      ...fetchCfg,
      headers: {
        ...fetchCfg.headers,
        Accept: 'text/html',
      },
    })
      .then((response) => response.json())
      .then(async (response) => {
        if (response.status) {
          this.dispatchEvent(
            new CartErrorEvent(form.getAttribute('id') || '', response.message, response.description, response.errors)
          );

          if (!addToCartTextError) return;
          addToCartTextError.classList.remove('hidden');

          // Reuse the text node if the user is spam-clicking
          const textNode = addToCartTextError.childNodes[2];
          if (textNode) {
            textNode.textContent = response.message;
          } else {
            const newTextNode = document.createTextNode(response.message);
            addToCartTextError.appendChild(newTextNode);
          }

          // Create or get existing error live region for screen readers
          this.#setLiveRegionText(response.message);

          this.#timeout = setTimeout(() => {
            if (!addToCartTextError) return;
            addToCartTextError.classList.add('hidden');

            // Clear the announcement
            this.#clearLiveRegionText();
          }, ERROR_MESSAGE_DISPLAY_DURATION);

          // When we add more than the maximum amount of items to the cart, we need to dispatch a cart update event
          // because our back-end still adds the max allowed amount to the cart.
          this.dispatchEvent(
            new CartAddEvent({}, this.id, {
              didError: true,
              source: 'product-form-component',
              itemCount: Number(formData.get('quantity')) || Number(this.dataset.quantityDefault),
              productId: this.dataset.productId,
            })
          );

          return;
        } else {
          const id = formData.get('id');

          if (addToCartTextError) {
            addToCartTextError.classList.add('hidden');
            addToCartTextError.removeAttribute('aria-live');
          }

          if (!id) throw new Error('Form ID is required');

          // Add aria-live region to inform screen readers that the item was added
          // Get the added text from any add-to-cart button
          const anyAddToCartButton = allAddToCartContainers[0]?.refs.addToCartButton;
          if (anyAddToCartButton) {
            const addedTextElement = anyAddToCartButton.querySelector('.add-to-cart-text--added');
            const addedText = addedTextElement?.textContent?.trim() || Theme.translations.added;

            this.#setLiveRegionText(addedText);

            setTimeout(() => {
              this.#clearLiveRegionText();
            }, SUCCESS_MESSAGE_DISPLAY_DURATION);
          }

          // Fetch the updated cart to get the actual total quantity for this variant
          await this.#fetchAndUpdateCartQuantity();

          this.dispatchEvent(
            new CartAddEvent({}, id.toString(), {
              source: 'product-form-component',
              itemCount: Number(formData.get('quantity')) || Number(this.dataset.quantityDefault),
              productId: this.dataset.productId,
              sections: response.sections,
            })
          );
        }
      })
      .catch((error) => {
        console.error(error);
      })
      .finally(() => {
        cartPerformance.measureFromEvent('add:user-action', event);
      });
  }

  /**
   * Updates the quantity label with the current cart quantity
   * @param {number} cartQty - The quantity in cart
   */
  #updateQuantityLabel(cartQty) {
    const quantityLabel = this.refs.quantityLabelCartCount;
    if (quantityLabel) {
      const inCartText = quantityLabel.textContent?.match(/\((\d+)\s+(.+)\)/);
      if (inCartText && inCartText[2]) {
        quantityLabel.textContent = `(${cartQty} ${inCartText[2]})`;
      }

      // Show/hide based on quantity
      quantityLabel.classList.toggle('hidden', cartQty === 0);
    }
  }

  /**
   * @param {*} text
   */
  #setLiveRegionText(text) {
    const liveRegion = this.refs.liveRegion;
    liveRegion.textContent = text;
  }

  #clearLiveRegionText() {
    const liveRegion = this.refs.liveRegion;
    liveRegion.textContent = '';
  }

  /**
   * Morphs or removes/adds an element based on current and new element states
   * @param {Element | null | undefined} currentElement - The current element in the DOM
   * @param {Element | null | undefined} newElement - The new element from the server response
   * @param {Element | null} [insertReferenceElement] - Element to insert before if adding new element
   */
  #morphOrUpdateElement(currentElement, newElement, insertReferenceElement = null) {
    if (currentElement && newElement) {
      morph(currentElement, newElement);
    } else if (currentElement && !newElement) {
      currentElement.remove();
    } else if (!currentElement && newElement && insertReferenceElement) {
      insertReferenceElement.insertAdjacentElement('beforebegin', /** @type {Element} */ (newElement.cloneNode(true)));
    }
  }

  /**
   * @param {VariantUpdateEvent} event
   */
  #onVariantUpdate = async (event) => {
    if (event.detail.data.newProduct) {
      this.dataset.productId = event.detail.data.newProduct.id;
    } else if (event.detail.data.productId !== this.dataset.productId) {
      return;
    }

    const { variantId } = this.refs;

    // Update the variant ID
    variantId.value = event.detail.resource?.id ?? '';
    const { addToCartButtonContainer: currentAddToCartButtonContainer, acceleratedCheckoutButtonContainer } = this.refs;
    const currentAddToCartButton = currentAddToCartButtonContainer?.refs.addToCartButton;

    // Update state and text for add-to-cart button
    if (!currentAddToCartButtonContainer || (!currentAddToCartButton && !acceleratedCheckoutButtonContainer)) return;

    // Update the button state - check both variant availability and personalization confirmation
    this.#variantAvailable = event.detail.resource != null && event.detail.resource.available !== false;
    
    // Update button state (this will handle both main button and sticky bar button)
    this.#updateAddToCartButtonState();

    if (acceleratedCheckoutButtonContainer) {
      if (event.detail.resource == null || event.detail.resource.available == false) {
        acceleratedCheckoutButtonContainer?.setAttribute('hidden', 'true');
      } else {
        acceleratedCheckoutButtonContainer?.removeAttribute('hidden');
      }
    }

    // Set the data attribute for the product variant media if it exists
    if (event.detail.resource) {
      const productVariantMedia = event.detail.resource.featured_media?.preview_image?.src;
      if (productVariantMedia) {
        this.refs.addToCartButtonContainer?.setAttribute(
          'data-product-variant-media',
          productVariantMedia + '&width=100'
        );
      }
    }

    // Skip morph operations when html is not provided (e.g. variant changed from personalisation modal)
    const html = event.detail.data?.html;
    if (!html) return;

    const newAddToCartButton = html.querySelector('product-form-component [ref="addToCartButton"]');
    if (newAddToCartButton && currentAddToCartButton) {
      morph(currentAddToCartButton, newAddToCartButton);
    }

    // Check if quantity rules, price-per-item, or add-to-cart are appearing/disappearing (causes layout shift)
    const {
      quantityRules,
      pricePerItem,
      quantitySelector,
      productFormButtons,
      quantityLabel,
      quantitySelectorWrapper,
    } = this.refs;

    // Update quantity selector's min/max/step attributes and cart quantity for the new variant
    const newQuantityInput = /** @type {HTMLInputElement | null} */ (
      html.querySelector('quantity-selector-component input[ref="quantityInput"]')
    );

    if (quantitySelector?.updateConstraints && newQuantityInput) {
      quantitySelector.updateConstraints(newQuantityInput.min, newQuantityInput.max || null, newQuantityInput.step);
    }

    const newQuantityRules = html.querySelector('.quantity-rules');
    const isQuantityRulesChanging = !!quantityRules !== !!newQuantityRules;

    const newPricePerItem = html.querySelector('price-per-item');
    const isPricePerItemChanging = !!pricePerItem !== !!newPricePerItem;

    if ((isQuantityRulesChanging || isPricePerItemChanging) && quantitySelector) {
      // Store quantity value before morphing entire container
      const currentQuantityValue = quantitySelector.getValue?.();

      const newProductFormButtons = html.querySelector('.product-form-buttons');

      if (productFormButtons && newProductFormButtons) {
        morph(productFormButtons, newProductFormButtons);

        // Get the NEW quantity selector after morphing and update its constraints
        const newQuantityInputElement = /** @type {HTMLInputElement | null} */ (
          html.querySelector('quantity-selector-component input[ref="quantityInput"]')
        );

        if (this.refs.quantitySelector?.updateConstraints && newQuantityInputElement && currentQuantityValue) {
          // Temporarily set the old value so updateConstraints can snap it properly
          this.refs.quantitySelector.setValue(currentQuantityValue);
          // updateConstraints will snap to valid increment if needed
          this.refs.quantitySelector.updateConstraints(
            newQuantityInputElement.min,
            newQuantityInputElement.max || null,
            newQuantityInputElement.step
          );
        }
      }
    } else {
      // Update elements individually when layout isn't changing
      /** @type {Array<[string, HTMLElement | undefined, HTMLElement | undefined]>} */
      const morphTargets = [
        ['.quantity-label', quantityLabel, quantitySelector],
        ['.quantity-rules', quantityRules, this.refs.productFormButtons],
        ['price-per-item', pricePerItem, quantitySelectorWrapper],
      ];

      for (const [selector, currentElement, fallback] of morphTargets) {
        this.#morphOrUpdateElement(currentElement, html.querySelector(selector), fallback);
      }
    }

    // Morph volume pricing if it exists
    const currentVolumePricing = this.refs.volumePricing;
    const newVolumePricing = html.querySelector('volume-pricing');
    this.#morphOrUpdateElement(currentVolumePricing, newVolumePricing, this.refs.productFormButtons);

    const hasB2BFeatures =
      quantityRules || newQuantityRules || pricePerItem || newPricePerItem || currentVolumePricing || newVolumePricing;

    if (!hasB2BFeatures) return;

    // Fetch and update cart quantity for the new variant
    await this.#fetchAndUpdateCartQuantity();
  };

  /**
   * Disable the add to cart button while the UI is updating before #onVariantUpdate is called.
   * Accelerated checkout button is also disabled via its own event listener not exposed to the theme.
   */
  #onVariantSelected = () => {
    this.refs.addToCartButtonContainer?.disable();
  };
}

if (!customElements.get('product-form-component')) {
  customElements.define('product-form-component', ProductFormComponent);
}
