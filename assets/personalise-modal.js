import { DialogComponent } from '@theme/dialog';
import { Component } from '@theme/component';

/**
 * A custom element that manages the personalisation modal.
 *
 * @extends DialogComponent
 */
export class PersonaliseDialogComponent extends DialogComponent {
  requiredRefs = ['dialog', 'nameInput', 'charCount', 'fontGrid', 'saveButton', 'closeButton'];

  connectedCallback() {
    super.connectedCallback();
    this.selectedFont = null;
    this.personalisationData = {
      name: '',
      font: null
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
      const saved = localStorage.getItem(`personalisation_${productId}`);
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
      this.updateCharCounter(this.personalisationData.name?.length || 0);
    }
    
    // Set font selection only if saved personalisation exists
    if (this.personalisationData.font) {
      this.selectFontByName(this.personalisationData.font);
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
    const charCount = this.refs.charCount;
    if (charCount) {
      charCount.textContent = count;
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
      const hasName = this.personalisationData.name.trim().length > 0;
      this.refs.saveButton.disabled = !hasName;
    }
  }

  /**
   * Saves the personalisation
   * @param {Event} event - The click event
   */
  savePersonalisation = (event) => {
    event.preventDefault();
    
    const name = this.personalisationData.name.trim();
    if (!name) {
      return;
    }

    // Store personalisation data in localStorage and as data attributes
    const personalisation = {
      name: name,
      font: this.personalisationData.font
    };

    // Store in localStorage with product ID as key
    const productId = this.closest('product-form-component')?.dataset?.productId;
    if (productId) {
      localStorage.setItem(`personalisation_${productId}`, JSON.stringify(personalisation));
    }

    // Also store globally for the current product
    window.currentPersonalisation = personalisation;

    // Update hidden form fields if they exist
    this.updateFormFields(personalisation);

    // Dispatch custom event for other components to listen to
    const customEvent = new CustomEvent('personalisation-saved', {
      detail: personalisation,
      bubbles: true
    });
    this.dispatchEvent(customEvent);

    // Close the dialog
    this.closeDialog();
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
    const existingProps = productForm.querySelectorAll('input[name^="properties["]');
    existingProps.forEach(input => input.remove());

    // Add personalisation as properties
    if (personalisation.name) {
      const nameInput = document.createElement('input');
      nameInput.type = 'hidden';
      nameInput.name = 'properties[Personalised Name]';
      nameInput.value = personalisation.name;
      productForm.appendChild(nameInput);
    }

    if (personalisation.font) {
      const fontInput = document.createElement('input');
      fontInput.type = 'hidden';
      fontInput.name = 'properties[Font Style]';
      fontInput.value = personalisation.font;
      productForm.appendChild(fontInput);
    }
  }
}

customElements.define('personalise-dialog', PersonaliseDialogComponent);

