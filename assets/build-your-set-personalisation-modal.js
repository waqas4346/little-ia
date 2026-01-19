import { DialogComponent, DialogOpenEvent, DialogCloseEvent } from '@theme/dialog';
import { Component } from '@theme/component';

/**
 * A custom element that manages the personalisation modal for Build Your Set.
 * This is a simplified version that works independently with product data from session storage.
 *
 * @extends DialogComponent
 */
export class BuildYourSetPersonaliseDialogComponent extends DialogComponent {
  requiredRefs = ['dialog', 'saveButton', 'closeButton', 'formContainer'];

  connectedCallback() {
    super.connectedCallback();
    this.productData = null;
    this.productIndex = null;
    this.personalisationData = {};
    
    console.log('Build Your Set: Personalization dialog component connected', {
      hasDialog: !!this.refs.dialog,
      hasSaveButton: !!this.refs.saveButton,
      hasCloseButton: !!this.refs.closeButton,
      hasFormContainer: !!this.refs.formContainer,
      hasProductImage: !!this.refs.productImage,
      hasProductPlaceholder: !!this.refs.productPlaceholder,
      hasProductTitle: !!this.refs.productTitle
    });
  }

  /**
   * Opens the dialog with product data
   * @param {Object} productData - Product data from session storage
   * @param {number} index - Index of product in session cart
   */
  openWithProduct(productData, index) {
    console.log('Build Your Set: openWithProduct called', { productData, index });
    
    if (!productData) {
      console.error('Build Your Set: No product data provided');
      return;
    }
    
    this.productData = productData;
    this.productIndex = index;
    
    // Remove hidden attribute from parent element
    if (this.hasAttribute('hidden')) {
      this.removeAttribute('hidden');
      console.log('Build Your Set: Removed hidden attribute from dialog element');
    }
    
    // Ensure refs are available
    if (!this.refs) {
      console.error('Build Your Set: Refs not available yet');
      setTimeout(() => this.openWithProduct(productData, index), 100);
      return;
    }
    
    // Set product image and title (optional refs)
    if (this.refs.productImage) {
      if (productData.images && productData.images.length > 0) {
        this.refs.productImage.src = productData.images[0];
        this.refs.productImage.alt = productData.name || '';
        this.refs.productImage.style.display = 'block';
        if (this.refs.productPlaceholder) {
          this.refs.productPlaceholder.style.display = 'none';
        }
      } else {
        this.refs.productImage.style.display = 'none';
        if (this.refs.productPlaceholder && this.refs.productTitle) {
          this.refs.productTitle.textContent = productData.name || 'Product';
          this.refs.productPlaceholder.style.display = 'flex';
        }
      }
    }

    // Load existing personalizations
    if (productData.personalizations) {
      this.personalisationData = { ...productData.personalizations };
    } else {
      this.personalisationData = {};
    }

    // Generate form fields based on personalization_fields
    this.generateFormFields(productData.personalization_fields || []);

    // Open the dialog
    this.showDialog();
  }

  /**
   * Generates form fields based on personalization_fields structure
   * @param {Array} fields - Array of personalization field definitions
   */
  generateFormFields(fields) {
    if (!this.refs.formContainer) return;

    // Clear existing fields
    this.refs.formContainer.innerHTML = '';

    if (!fields || fields.length === 0) {
      this.refs.formContainer.innerHTML = '<p>No personalization options available for this product.</p>';
      return;
    }

    // Find the first text/name field to determine maxLength for instructions
    const firstTextField = fields.find(f => {
      const isTextType = f.type === 'text' || f.type === 'name' || !f.type;
      const hasMaxLength = f.maxlength || f.maxLength;
      const isNameField = f.name?.toLowerCase().includes('name') || 
                         f.name?.includes("personalise-name") ||
                         f.name?.includes("Baby's Name") ||
                         f.name?.includes("Kid's Name") ||
                         f.name?.includes("Mum's Name");
      return isTextType && (isNameField || hasMaxLength);
    });
    
    // Get maxLength from the first text field, or default to 9
    const maxLength = firstTextField ? (firstTextField.maxlength || firstTextField.maxLength || 9) : 9;
    
    // Add instruction text before form fields if there's a text field with maxLength
    // Show it for name fields or any text field with maxlength <= 20 (typical for personalization)
    if (firstTextField && (maxLength <= 20 || firstTextField.name?.toLowerCase().includes('name'))) {
      const instructionsHTML = `
        <p class="personalise-modal__instructions">
          Maximum ${maxLength} characters. No special characters.
        </p>
      `;
      this.refs.formContainer.insertAdjacentHTML('beforeend', instructionsHTML);
    }

    fields.forEach((field, index) => {
      const fieldType = field.type || 'text';
      const fieldName = field.name || field.key || `field_${index}`;
      const fieldLabel = field.label || fieldName;
      // Use maxlength (from stored data) or maxLength (fallback) or default to 50
      const maxLength = field.maxlength || field.maxLength || 50;
      const required = field.required || false;

      let fieldHTML = '';

      if (fieldType === 'text' || fieldType === 'name') {
        // Text input field
        fieldHTML = `
          <div class="personalise-modal__field">
            <label for="build-your-set-${fieldName}" class="personalise-modal__label">
              ${fieldLabel}${required ? ' <span style="color: red;">*</span>' : ''}
            </label>
            <div class="personalise-modal__input-wrapper">
              <input
                type="text"
                id="build-your-set-${fieldName}"
                name="${fieldName}"
                class="personalise-modal__input"
                placeholder="${field.placeholder || `Enter ${fieldLabel}`}"
                maxlength="${maxLength}"
                value="${this.personalisationData[fieldName] || ''}"
                data-field-name="${fieldName}"
                ${required ? 'required' : ''}
              />
              <span class="personalise-modal__counter" data-counter="${fieldName}">
                <span data-count="${fieldName}">${(this.personalisationData[fieldName] || '').length}</span>/${maxLength}
              </span>
            </div>
          </div>
        `;
      } else if (fieldType === 'textarea' || fieldType === 'textbox') {
        // Textarea field
        fieldHTML = `
          <div class="personalise-modal__field">
            <label for="build-your-set-${fieldName}" class="personalise-modal__label">
              ${fieldLabel}${required ? ' <span style="color: red;">*</span>' : ''}
            </label>
            <div class="personalise-modal__input-wrapper">
              <textarea
                id="build-your-set-${fieldName}"
                name="${fieldName}"
                class="personalise-modal__input personalise-modal__input--textarea"
                placeholder="${field.placeholder || `Enter ${fieldLabel}`}"
                maxlength="${maxLength}"
                rows="3"
                data-field-name="${fieldName}"
                ${required ? 'required' : ''}
              >${this.personalisationData[fieldName] || ''}</textarea>
              <span class="personalise-modal__counter" data-counter="${fieldName}">
                <span data-count="${fieldName}">${(this.personalisationData[fieldName] || '').length}</span>/${maxLength}
              </span>
            </div>
          </div>
        `;
      } else if (fieldType === 'select' && field.options) {
        // Select dropdown
        const optionsHTML = field.options.map(option => {
          const optionValue = typeof option === 'string' ? option : option.value;
          const optionLabel = typeof option === 'string' ? option : option.label;
          const selected = this.personalisationData[fieldName] === optionValue ? 'selected' : '';
          return `<option value="${optionValue}" ${selected}>${optionLabel}</option>`;
        }).join('');

        fieldHTML = `
          <div class="personalise-modal__field">
            <label for="build-your-set-${fieldName}" class="personalise-modal__label">
              ${fieldLabel}${required ? ' <span style="color: red;">*</span>' : ''}
            </label>
            <div class="personalise-modal__input-wrapper">
              <select
                id="build-your-set-${fieldName}"
                name="${fieldName}"
                class="personalise-modal__input"
                data-field-name="${fieldName}"
                ${required ? 'required' : ''}
              >
                <option value="">Select ${fieldLabel}</option>
                ${optionsHTML}
              </select>
            </div>
          </div>
        `;
      }

      if (fieldHTML) {
        this.refs.formContainer.insertAdjacentHTML('beforeend', fieldHTML);
      }
    });

    // Set up event listeners for character counting
    this.setupCharacterCounters();
  }

  /**
   * Sets up character counters for text inputs
   */
  setupCharacterCounters() {
    const textInputs = this.refs.formContainer.querySelectorAll('input[type="text"], textarea');
    textInputs.forEach(input => {
      input.addEventListener('input', () => {
        const fieldName = input.dataset.fieldName;
        const counter = this.refs.formContainer.querySelector(`[data-counter="${fieldName}"] [data-count="${fieldName}"]`);
        if (counter) {
          counter.textContent = input.value.length;
        }
      });
    });
  }

  /**
   * Collects personalization data from form fields
   * @returns {Object} Personalization data object
   */
  collectPersonalisationData() {
    const data = {};
    const inputs = this.refs.formContainer.querySelectorAll('input, textarea, select');
    
    inputs.forEach(input => {
      const fieldName = input.dataset.fieldName || input.name;
      if (fieldName && input.value.trim()) {
        data[fieldName] = input.value.trim();
      }
    });

    return data;
  }

  /**
   * Handles save button click
   */
  handleSave() {
    if (!this.productData || this.productIndex === null) {
      console.error('Build Your Set: Missing product data or index');
      return;
    }

    // Collect personalization data
    const personalisations = this.collectPersonalisationData();

    // Update product data in session storage
    const sessionCart = this.getSessionCart();
    if (sessionCart && sessionCart[this.productIndex]) {
      sessionCart[this.productIndex].personalizations = personalisations;
      
      // Save back to session storage
      try {
        sessionStorage.setItem('build-your-set-session-cart', JSON.stringify(sessionCart));
        
        // Dispatch event to update sticky bar
        document.dispatchEvent(new CustomEvent('build-your-set-updated', {
          bubbles: true,
          cancelable: true
        }));

        // Dispatch personalisation saved event
        document.dispatchEvent(new CustomEvent('personalisation-saved', {
          bubbles: true,
          cancelable: true,
          detail: {
            productId: this.productData.product_id,
            index: this.productIndex,
            personalisations: personalisations
          }
        }));

        // Close the dialog
        this.hideDialog();
      } catch (error) {
        console.error('Build Your Set: Error saving personalization', error);
      }
    }
  }

  /**
   * Gets session cart from session storage
   * @returns {Array|null} Session cart array or null
   */
  getSessionCart() {
    try {
      const stored = sessionStorage.getItem('build-your-set-session-cart');
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Build Your Set: Error reading session cart', error);
      return null;
    }
  }

  showDialog() {
    console.log('Build Your Set: showDialog called', { refs: this.refs });
    
    const { dialog } = this.refs;
    if (!dialog) {
      console.error('Build Your Set: Dialog ref not found', this.refs);
      return;
    }
    
    if (dialog.open) {
      console.log('Build Your Set: Dialog already open');
      return;
    }

    // Remove hidden attribute from parent element to make it visible
    if (this.hasAttribute('hidden')) {
      this.removeAttribute('hidden');
      console.log('Build Your Set: Removed hidden attribute');
    }
    
    // Ensure dialog element is visible
    if (dialog.style) {
      dialog.style.display = '';
      dialog.style.visibility = '';
      dialog.style.opacity = '';
    }

    const scrollY = window.scrollY;

    requestAnimationFrame(() => {
      try {
        document.body.style.width = '100%';
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;

        console.log('Build Your Set: Opening dialog modal');
        dialog.showModal();
        this.dispatchEvent(new DialogOpenEvent());

        // Set up save button handler (remove old one first to prevent duplicates)
        if (this.refs.saveButton) {
          const saveHandler = this.handleSave.bind(this);
          // Remove existing listener if any
          if (this._saveHandler) {
            this.refs.saveButton.removeEventListener('click', this._saveHandler);
          }
          this._saveHandler = saveHandler;
          this.refs.saveButton.addEventListener('click', this._saveHandler);
        }
        
        // Set up close button handler
        if (this.refs.closeButton) {
          const closeHandler = () => {
            console.log('Build Your Set: Close button clicked');
            this.hideDialog();
          };
          if (this._closeHandler) {
            this.refs.closeButton.removeEventListener('click', this._closeHandler);
          }
          this._closeHandler = closeHandler;
          this.refs.closeButton.addEventListener('click', this._closeHandler);
        }
        
        console.log('Build Your Set: Dialog opened successfully', {
          dialogOpen: dialog.open,
          dialogDisplay: window.getComputedStyle(dialog).display,
          dialogVisibility: window.getComputedStyle(dialog).visibility,
          dialogOpacity: window.getComputedStyle(dialog).opacity
        });
      } catch (error) {
        console.error('Build Your Set: Error opening dialog', error);
      }
    });
  }

  hideDialog() {
    const { dialog } = this.refs;
    if (!dialog || !dialog.open) return;

    const scrollY = document.body.style.top;
    dialog.close();
    this.dispatchEvent(new DialogCloseEvent());

    document.body.style.width = '';
    document.body.style.position = '';
    document.body.style.top = '';
    window.scrollTo(0, parseInt(scrollY || '0') * -1);
    
    // Add hidden attribute back to parent element
    this.setAttribute('hidden', '');
  }
}

customElements.define('build-your-set-personalise-dialog', BuildYourSetPersonaliseDialogComponent);
