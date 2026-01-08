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
    
    // Load saved personalisation if exists
    this.loadSavedPersonalisation();
  }

  /**
   * Loads saved personalisation from localStorage
   */
  loadSavedPersonalisation() {
    const productId = this.closest('product-form-component')?.dataset?.productId;
    if (productId) {
      // Ensure productId is a string to match localStorage key
      const key = `personalisation_${String(productId)}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          this.personalisationData = data;
          if (data.font) {
            this.selectFontByName(data.font);
          }
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
    super.showDialog();
    
    // Load saved personalisation
    this.loadSavedPersonalisation();
    
    // Update form fields with saved data
    if (this.refs.nameInput) {
      this.refs.nameInput.value = this.personalisationData.name || '';
      const charCounter = this.refs.charCounter?.querySelector('[ref="charCount"]') || this.refs.charCount;
      if (charCounter) {
        charCounter.textContent = this.personalisationData.name?.length || 0;
      }
    }
    
    // Set font selection only if saved personalisation exists
    if (this.personalisationData.font) {
      this.selectFontByName(this.personalisationData.font);
    }
    
    // Set color selection if saved
    if (this.personalisationData.color) {
      this.selectColorByName(this.personalisationData.color);
    }
    
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

    // Store in localStorage with product ID as key
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
      // Ensure productId is a string to match localStorage key format
      productId = String(productId);
      const key = `personalisation_${productId}`;
      
      console.log('Saving personalisation:', { productId, key, personalisation });
      localStorage.setItem(key, JSON.stringify(personalisation));
      
      // Verify it was saved
      const saved = localStorage.getItem(key);
      console.log('Verification - saved to localStorage:', saved ? 'SUCCESS' : 'FAILED');
      
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
    // Find the product form
    const productForm = document.querySelector(`form[data-type="add-to-cart-form"]`);
    if (!productForm) return;

    // Remove existing properties fields
    const existingProps = productForm.querySelectorAll('input[name^="properties["], textarea[name^="properties["]');
    existingProps.forEach(input => input.remove());

    // Helper function to add hidden input
    const addProperty = (name, value) => {
      if (value) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        productForm.appendChild(input);
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
  }
}

customElements.define('personalise-dialog', PersonaliseDialogComponent);

