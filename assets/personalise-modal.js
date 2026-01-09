import { DialogComponent } from '@theme/dialog';
import { Component } from '@theme/component';

/**
 * A custom element that manages the personalisation modal.
 *
 * @extends DialogComponent
 */
export class PersonaliseDialogComponent extends DialogComponent {
  requiredRefs = ['dialog', 'saveButton', 'closeButton'];

  connectedCallback() {
    super.connectedCallback();
    this.selectedFont = null;
    this.selectedColor = null;
    
    // Initialize personalisationData structure (fresh on each page load)
    this.personalisationData = {
      name: '',
      font: null,
      color: null,
      dob: null,
      schoolYear: null,
      name1: null,
      name2: null,
      name3: null,
      name4: null,
      textbox: null,
      message: null,
      optionalDob: null,
      time: null,
      weight: null
    };
    
    // Set up form submit listener
    setTimeout(() => {
      this.#setupFormSubmitListenerForCurrentSession();
    }, 100);
  }
  
  /**
   * Sets up form submit listener for current session only
   */
  #setupFormSubmitListenerForCurrentSession() {
    // Find the product form
    let productForm = null;
    const productFormComponent = this.closest('product-form-component');
    if (productFormComponent) {
      productForm = productFormComponent.querySelector('form[data-type="add-to-cart-form"]');
    }
    if (!productForm) {
      productForm = document.querySelector(`form[data-type="add-to-cart-form"]`);
    }
    if (productForm) {
      this.#setupFormSubmitListener(productForm);
    }
  }

  /**
   * Loads saved personalisation from sessionStorage (current session only)
   */
  loadSavedPersonalisation() {
    const productId = this.closest('product-form-component')?.dataset?.productId;
    
    // If not found, try to get from sticky-add-to-cart
    if (!productId) {
      const stickyCart = document.querySelector('sticky-add-to-cart');
      if (stickyCart) {
        productId = stickyCart.dataset?.productId;
      }
    }
    
    // If still not found, try to get from the form
    if (!productId) {
      const form = document.querySelector('form[data-type="add-to-cart-form"]');
      if (form) {
        const formComponent = form.closest('product-form-component');
        productId = formComponent?.dataset?.productId;
      }
    }
    
    if (productId) {
      // Use sessionStorage instead of localStorage (clears on page reload)
      const key = `personalisation_${String(productId)}`;
      const saved = sessionStorage.getItem(key);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          // Merge with existing personalisationData to preserve structure
          this.personalisationData = {
            ...this.personalisationData,
            ...data
          };
          console.log('Loaded personalisation data from current session:', this.personalisationData);
        } catch (e) {
          console.error('Error loading personalisation:', e);
        }
      }
    }
  }

  /**
   * Shows the dialog.
   */
  showDialog() {
    // Call parent showDialog FIRST to open the dialog immediately
    super.showDialog();
    
    // Load saved personalisation from current session only (non-blocking)
    try {
      this.loadSavedPersonalisation();
    } catch (error) {
      console.error('Error loading personalisation:', error);
    }
    
    // Wait for dialog to be fully open and refs to be available
    // The base showDialog uses requestAnimationFrame, so we need to wait a bit longer
    let attempts = 0;
    const maxAttempts = 20; // Maximum 1 second (20 * 50ms)
    
    const checkAndPopulate = () => {
      attempts++;
      const dialog = this.refs.dialog;
      
      if (dialog && dialog.open) {
        // Dialog is open, try to populate fields
        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
          try {
            this.#populateFieldsFromSavedData();
          } catch (error) {
            console.error('Error populating fields:', error);
          }
        });
      } else if (attempts < maxAttempts) {
        // Dialog not open yet, try again
        setTimeout(checkAndPopulate, 50);
      } else {
        // Max attempts reached, try to populate anyway
        console.warn('Dialog may not be fully open, attempting to populate fields anyway');
        try {
          this.#populateFieldsFromSavedData();
        } catch (error) {
          console.error('Error populating fields after max attempts:', error);
        }
      }
    };
    
    // Start checking after a small delay to let the dialog open
    setTimeout(checkAndPopulate, 100);
  }
  
  /**
   * Populates all form fields from saved personalisation data
   * @private
   */
  #populateFieldsFromSavedData() {
    // Only populate if we have data (from current session)
    if (!this.personalisationData || (!this.personalisationData.name && !this.personalisationData.font && !this.personalisationData.color)) {
      return; // No data to populate
    }
    
    // Update name input field
    const nameInput = this.refs.nameInput || this.querySelector('#personalise-name');
    if (nameInput && this.personalisationData.name) {
      nameInput.value = this.personalisationData.name;
      // Trigger input event to update character counter
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      const charCounter = this.refs.charCounter?.querySelector('[ref="charCount"]') || this.refs.charCount;
      if (charCounter) {
        charCounter.textContent = this.personalisationData.name.length;
      }
    }
    
    // Set font selection if saved
    if (this.personalisationData.font) {
      setTimeout(() => {
        this.selectFontByName(this.personalisationData.font);
      }, 100);
    }
    
    // Set color selection if saved
    if (this.personalisationData.color) {
      setTimeout(() => {
        this.selectColorByName(this.personalisationData.color);
      }, 100);
    }
    
    // Load other fields
    const dobInput = this.refs.dobInput || this.querySelector('input[name="properties[Date of Birth]"]');
    if (dobInput && this.personalisationData.dob) dobInput.value = this.personalisationData.dob;
    
    const schoolYearInput = this.refs.schoolYearInput || this.querySelector('input[name="properties[School Year]"]');
    if (schoolYearInput && this.personalisationData.schoolYear) schoolYearInput.value = this.personalisationData.schoolYear;
    
    const name1Input = this.refs.name1Input || this.querySelector('input[name="properties[Name 1]"]');
    if (name1Input && this.personalisationData.name1) name1Input.value = this.personalisationData.name1;
    
    const name2Input = this.refs.name2Input || this.querySelector('input[name="properties[Name 2]"]');
    if (name2Input && this.personalisationData.name2) name2Input.value = this.personalisationData.name2;
    
    const name3Input = this.refs.name3Input || this.querySelector('input[name="properties[Name 3]"]');
    if (name3Input && this.personalisationData.name3) name3Input.value = this.personalisationData.name3;
    
    const name4Input = this.refs.name4Input || this.querySelector('input[name="properties[Name 4]"]');
    if (name4Input && this.personalisationData.name4) name4Input.value = this.personalisationData.name4;
    
    const textboxInput = this.refs.textboxInput || this.querySelector('textarea[name="properties[Personalisation:]"]');
    if (textboxInput && this.personalisationData.textbox) textboxInput.value = this.personalisationData.textbox;
    
    const messageInput = this.refs.messageInput || this.querySelector('textarea[name="properties[Message]"]');
    if (messageInput && this.personalisationData.message) messageInput.value = this.personalisationData.message;
    
    const optionalDobInput = this.refs.optionalDobInput || this.querySelector('#dob_field_val');
    if (optionalDobInput && this.personalisationData.optionalDob) {
      const dateParts = this.personalisationData.optionalDob.split('-');
      if (dateParts.length === 3) {
        optionalDobInput.value = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
      }
    }
    
    const timeInput = this.refs.timeInput || this.querySelector('input[name="properties[Time]"]');
    if (timeInput && this.personalisationData.time) timeInput.value = this.personalisationData.time;
    
    const weightInput = this.refs.weightInput || this.querySelector('input[name="properties[Weight]"]');
    if (weightInput && this.personalisationData.weight) weightInput.value = this.personalisationData.weight;
    
    this.updateSaveButton();
  }

  /**
   * Handles name input changes
   * @param {Event} event - The input event
   */
  handleNameInput = (event) => {
    const input = event.target;
    const value = input.value;
    
    // Remove special characters (only allow letters, numbers, and spaces)
    const sanitized = value.replace(/[^a-zA-Z0-9\s]/g, '');
    if (sanitized !== value) {
      input.value = sanitized;
    }
    
    const length = sanitized.length;
    this.updateCharCounter(length);
    this.personalisationData.name = sanitized;
    
    // Update save button state
    this.updateSaveButton();
  };

  /**
   * Updates the character counter
   * @param {number} count - The current character count
   */
  updateCharCounter(count) {
    const charCounter = this.refs.charCounter?.querySelector('[ref="charCount"]') || this.refs.charCount;
    if (charCounter) {
      charCounter.textContent = count;
    }
  }

  /**
   * Handles color selection
   * @param {Event} event - The click event
   */
  selectColor = (event) => {
    const button = event.target.closest('.personalise-modal__color-button');
    if (!button) return;

    const colorName = button.dataset.color;
    this.selectColorByName(colorName);
  };

  /**
   * Selects a color by name
   * @param {string} colorName - The color name to select
   */
  selectColorByName(colorName) {
    const colorGrid = this.refs.colorGrid || this.querySelector('.personalise-modal__color-grid');
    if (!colorGrid) return;

    // Uncheck all radio inputs
    const radioInputs = colorGrid.querySelectorAll('input[type="radio"]');
    radioInputs.forEach(input => {
      input.checked = false;
    });

    // Check the selected radio input
    const selectedButton = Array.from(colorGrid.querySelectorAll('.personalise-modal__color-button')).find(
      btn => btn.dataset.color === colorName
    );
    if (selectedButton) {
      const radioInput = selectedButton.querySelector('input[type="radio"]');
      if (radioInput) {
        radioInput.checked = true;
      }
      this.selectedColor = colorName;
      this.personalisationData.color = colorName;
    }
  }

  /**
   * Handles font selection
   * @param {Event} event - The click event
   */
  selectFont = (event) => {
    const button = event.target.closest('.personalise-modal__font-button');
    if (!button) return;

    const fontName = button.dataset.font;
    this.selectFontByName(fontName);
  };

  /**
   * Selects a font by name
   * @param {string} fontName - The font name to select
   */
  selectFontByName(fontName) {
    if (!this.refs.fontGrid) return;

    // Remove selected class from all buttons
    const buttons = this.refs.fontGrid.querySelectorAll('.personalise-modal__font-button');
    buttons.forEach(btn => {
      btn.classList.remove('personalise-modal__font-button--selected');
    });

    // Add selected class to the clicked button
    const selectedButton = Array.from(buttons).find(
      btn => btn.dataset.font === fontName
    );
    if (selectedButton) {
      selectedButton.classList.add('personalise-modal__font-button--selected');
      this.selectedFont = fontName;
      this.personalisationData.font = fontName;
    }
  }

  /**
   * Updates the save button enabled/disabled state
   */
  updateSaveButton() {
    if (this.refs.saveButton) {
      // Check if name field exists and has value (for personalized_name products)
      const nameInput = this.refs.nameInput || this.querySelector('#personalise-name');
      const hasName = nameInput ? nameInput.value.trim().length > 0 : true;
      
      // For products with personalized_name, name is required
      if (nameInput) {
        this.refs.saveButton.disabled = !hasName;
      } else {
        // For other personalization types, allow saving without name
        this.refs.saveButton.disabled = false;
      }
    }
  }

  /**
   * Saves the personalisation
   * @param {Event} event - The click event
   */
  savePersonalisation = (event) => {
    event.preventDefault();
    console.log('savePersonalisation called');
    
    // Collect all field values
    const nameInput = this.refs.nameInput || this.querySelector('#personalise-name');
    const name = nameInput ? nameInput.value.trim() : '';
    
    // Validate required fields (name is required for personalized_name products)
    if (nameInput && !name) {
      console.log('Validation failed: name is required');
      return;
    }

    // Collect all personalisation data
    const personalisation = {
      name: name,
      font: this.personalisationData.font || this.selectedFont,
      color: this.personalisationData.color || this.selectedColor,
      dob: null,
      schoolYear: null,
      name1: null,
      name2: null,
      name3: null,
      name4: null,
      textbox: null,
      message: null,
      optionalDob: null,
      time: null,
      weight: null
    };

    // Collect optional fields
    const dobInput = this.refs.dobInput || this.querySelector('input[name="properties[Date of Birth]"]');
    if (dobInput) personalisation.dob = dobInput.value.trim();

    const schoolYearInput = this.refs.schoolYearInput || this.querySelector('input[name="properties[School Year]"]');
    if (schoolYearInput) personalisation.schoolYear = schoolYearInput.value.trim();

    const name1Input = this.refs.name1Input || this.querySelector('input[name="properties[Name 1]"]');
    if (name1Input) personalisation.name1 = name1Input.value.trim();

    const name2Input = this.refs.name2Input || this.querySelector('input[name="properties[Name 2]"]');
    if (name2Input) personalisation.name2 = name2Input.value.trim();

    const name3Input = this.refs.name3Input || this.querySelector('input[name="properties[Name 3]"]');
    if (name3Input) personalisation.name3 = name3Input.value.trim();

    const name4Input = this.refs.name4Input || this.querySelector('input[name="properties[Name 4]"]');
    if (name4Input) personalisation.name4 = name4Input.value.trim();

    const textboxInput = this.refs.textboxInput || this.querySelector('textarea[name="properties[Personalisation:]"]');
    if (textboxInput) personalisation.textbox = textboxInput.value.trim();

    const messageInput = this.refs.messageInput || this.querySelector('textarea[name="properties[Message]"]');
    if (messageInput) personalisation.message = messageInput.value.trim();

    const optionalDobInput = this.refs.optionalDobInput || this.querySelector('#dob_field_val');
    if (optionalDobInput && optionalDobInput.value) {
      // Convert date input (YYYY-MM-DD) to dd-mm-yyyy format
      const date = new Date(optionalDobInput.value);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      personalisation.optionalDob = `${day}-${month}-${year}`;
    }

    const timeInput = this.refs.timeInput || this.querySelector('input[name="properties[Time]"]');
    if (timeInput) personalisation.time = timeInput.value.trim();

    const weightInput = this.refs.weightInput || this.querySelector('input[name="properties[Weight]"]');
    if (weightInput) personalisation.weight = weightInput.value.trim();

    // Store in sessionStorage with product ID as key (clears on page reload)
    let productId = this.closest('product-form-component')?.dataset?.productId;
    
    // If not found, try to get from sticky-add-to-cart
    if (!productId) {
      productId = document.querySelector('sticky-add-to-cart')?.dataset?.productId;
    }
    
    // If still not found, try to get from the form
    if (!productId) {
      const form = document.querySelector('form[data-type="add-to-cart-form"]');
      if (form) {
        const formComponent = form.closest('product-form-component');
        productId = formComponent?.dataset?.productId;
      }
    }
    
    if (productId) {
      // Ensure productId is a string to match sessionStorage key format
      productId = String(productId);
      const key = `personalisation_${productId}`;
      
      console.log('Saving personalisation to sessionStorage:', { productId, key, personalisation });
      sessionStorage.setItem(key, JSON.stringify(personalisation));
      
      // Verify it was saved
      const saved = sessionStorage.getItem(key);
      console.log('Verification - saved to sessionStorage:', saved ? 'SUCCESS' : 'FAILED');
      
      // Trigger update of button text
      setTimeout(() => {
        if (typeof window.updatePersonaliseButtonText === 'function') {
          window.updatePersonaliseButtonText();
        }
      }, 100);
    } else {
      console.error('Product ID not found when saving personalisation');
    }

    // Also store globally for the current product
    window.currentPersonalisation = personalisation;

    // Update hidden form fields if they exist
    this.updateFormFields(personalisation);

    // Dispatch custom event for other components to listen to
    const customEvent = new CustomEvent('personalisation-saved', {
      detail: personalisation,
      bubbles: true,
      cancelable: true
    });
    this.dispatchEvent(customEvent);
    
    // Also dispatch on document to ensure it's caught
    document.dispatchEvent(customEvent);

    // Close the dialog
    this.closeDialog();
    
    // Update buttons after a short delay to ensure localStorage is set and DOM is updated
    setTimeout(() => {
      if (typeof window.updatePersonaliseButtonText === 'function') {
        window.updatePersonaliseButtonText();
      }
    }, 300);
  };

  /**
   * Updates form fields with personalisation data
   * @param {Object} personalisation - The personalisation data
   */
  updateFormFields(personalisation) {
    // Find the product form - try multiple methods to ensure we get the right one
    let productForm = null;
    
    // First, try to find form associated with this dialog's product
    const productFormComponent = this.closest('product-form-component');
    if (productFormComponent) {
      productForm = productFormComponent.querySelector('form[data-type="add-to-cart-form"]');
    }
    
    // Fallback: find any product form
    if (!productForm) {
      productForm = document.querySelector(`form[data-type="add-to-cart-form"]`);
    }
    
    if (!productForm) {
      console.warn('Product form not found for updating personalisation fields');
      return;
    }

    // Remove existing properties fields
    const existingProps = productForm.querySelectorAll('input[name^="properties["], textarea[name^="properties["]');
    existingProps.forEach(input => input.remove());

    // Helper function to add hidden input
    const addProperty = (name, value) => {
      if (value && value.toString().trim() !== '') {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value.toString().trim();
        productForm.appendChild(input);
        console.log('Added property field:', name, '=', input.value);
      }
    };

    // Add all personalisation properties
    if (personalisation.name) {
      addProperty('properties[Name]', personalisation.name);
    }

    if (personalisation.font) {
      addProperty('properties[Text Font]', personalisation.font);
    }

    if (personalisation.color) {
      addProperty('properties[Text Color]', personalisation.color);
    }

    if (personalisation.dob) {
      addProperty('properties[Date of Birth]', personalisation.dob);
    }

    if (personalisation.schoolYear) {
      addProperty('properties[School Year]', personalisation.schoolYear);
    }

    if (personalisation.name1) {
      addProperty('properties[Name 1]', personalisation.name1);
    }

    if (personalisation.name2) {
      addProperty('properties[Name 2]', personalisation.name2);
    }

    if (personalisation.name3) {
      addProperty('properties[Name 3]', personalisation.name3);
    }

    if (personalisation.name4) {
      addProperty('properties[Name 4]', personalisation.name4);
    }

    if (personalisation.textbox) {
      addProperty('properties[Personalisation:]', personalisation.textbox);
    }

    if (personalisation.message) {
      addProperty('properties[Message]', personalisation.message);
    }

    if (personalisation.optionalDob) {
      addProperty('properties[Personalise Date of Birth]', personalisation.optionalDob);
    }

    if (personalisation.time) {
      addProperty('properties[Time]', personalisation.time);
    }

    if (personalisation.weight) {
      addProperty('properties[Weight]', personalisation.weight);
    }
    
    // Also set up a listener to re-add fields before form submission
    this.#setupFormSubmitListener(productForm);
  }
  
  /**
   * Sets up a listener to ensure personalisation fields are added before form submission
   * @param {HTMLFormElement} form - The form element
   */
  #setupFormSubmitListener(form) {
    // Remove any existing listener to avoid duplicates
    if (form.dataset.personalisationListenerAdded) {
      return;
    }
    
    form.dataset.personalisationListenerAdded = 'true';
    
    // Helper function to add personalisation fields to form
    const addPersonalisationFieldsToForm = (targetForm) => {
      // Get the current product ID
      const productFormComponent = targetForm.closest('product-form-component');
      const productId = productFormComponent?.dataset?.productId;
      
      if (!productId) {
        console.warn('Product ID not found for personalisation fields');
        return;
      }
      
      // Get saved personalisation from sessionStorage (current session only, clears on reload)
      const key = `personalisation_${String(productId)}`;
      const saved = sessionStorage.getItem(key);
      
      if (!saved) {
        console.log('No saved personalisation found for product:', productId);
        return;
      }
      
      try {
        const personalisation = JSON.parse(saved);
        
        // Remove existing properties fields (but keep gift message and other non-personalisation properties)
        const existingProps = targetForm.querySelectorAll('input[name^="properties["], textarea[name^="properties["]');
        existingProps.forEach(input => {
          const name = input.name;
          // Only remove personalisation-related properties, not gift message or other properties
          if (name.includes('[Name]') || 
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
              name.includes('[Weight]')) {
            input.remove();
          }
        });
        
        // Re-add all personalisation properties directly to the form
        const addProperty = (name, value) => {
          if (value && value.toString().trim() !== '') {
            // Remove any existing input with this exact name first
            const existing = targetForm.querySelector(`input[name="${name}"]`);
            if (existing) {
              existing.remove();
            }
            
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = name;
            input.value = value.toString().trim();
            // Insert before the variant ID input to ensure it's in the form
            const variantInput = targetForm.querySelector('input[name="id"]');
            if (variantInput) {
              variantInput.parentNode.insertBefore(input, variantInput.nextSibling);
            } else {
              targetForm.appendChild(input);
            }
            console.log('Added personalisation property:', name, '=', input.value);
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
        
        console.log('Successfully added all personalisation fields to form');
      } catch (e) {
        console.error('Error re-adding personalisation fields:', e);
      }
    };
    
    // Listen for form submit event (capture phase to run early, before preventDefault)
    form.addEventListener('submit', (event) => {
      console.log('Form submit event detected, adding personalisation fields');
      addPersonalisationFieldsToForm(form);
    }, { capture: true, passive: false });
    
    // Also intercept the product-form-component's handleSubmit by listening on the component
    const productFormComponent = form.closest('product-form-component');
    if (productFormComponent) {
      // Store reference to the form for later use
      productFormComponent._personalisationForm = form;
      productFormComponent._addPersonalisationFields = addPersonalisationFieldsToForm;
      
      // Override or wrap the handleSubmit method to ensure fields are added BEFORE FormData is created
      const originalHandleSubmit = productFormComponent.handleSubmit;
      if (originalHandleSubmit) {
        productFormComponent.handleSubmit = function(event) {
          console.log('ProductFormComponent handleSubmit called, adding personalisation fields');
          // Add fields BEFORE calling original handleSubmit (which creates FormData)
          if (this._addPersonalisationFields && this._personalisationForm) {
            this._addPersonalisationFields(this._personalisationForm);
          }
          return originalHandleSubmit.call(this, event);
        };
      }
    }
    
    // Also listen for clicks on add-to-cart buttons as an additional safety measure
    const addToCartButtons = form.querySelectorAll('button[type="submit"], add-to-cart-component button, .add-to-cart-button');
    addToCartButtons.forEach(button => {
      button.addEventListener('click', () => {
        console.log('Add to cart button clicked, adding personalisation fields');
        addPersonalisationFieldsToForm(form);
      }, { capture: true });
    });
  }
}

customElements.define('personalise-dialog', PersonaliseDialogComponent);

