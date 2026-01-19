import { DialogComponent } from '@theme/dialog';
import { Component } from '@theme/component';
import { morphSection } from '@theme/section-renderer';

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
      weight: null,
      babyName: null,
      kidName: null,
      mumName: null
    };
    
    // Set up form submit listener
    setTimeout(() => {
      this.#setupFormSubmitListenerForCurrentSession();
    }, 100);
    
    // Set form attribute on Baby/Kid/Mum inputs
    this.#setFormAttributeOnInputs();
  }
  
  /**
   * Sets the form attribute on Baby/Kid/Mum name inputs
   */
  #setFormAttributeOnInputs() {
    // Find the product form
    let productForm = null;
    const productFormComponent = this.closest('product-form-component');
    if (productFormComponent) {
      productForm = productFormComponent.querySelector('form[data-type="add-to-cart-form"]');
    }
    if (!productForm) {
      productForm = document.querySelector('form[data-type="add-to-cart-form"]');
    }
    
    if (productForm && productForm.id) {
      // Set form attribute on all inputs with data-form-id
      const inputs = this.querySelectorAll('[data-form-id]');
      inputs.forEach(input => {
        input.setAttribute('form', productForm.id);
      });
    }
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
    let productId = this.closest('product-form-component')?.dataset?.productId;
    
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
    // Check if ANY personalization field has data, not just name/font/color
    if (!this.personalisationData) {
      return; // No data to populate
    }
    
    // Check if any personalization field has data
    const hasAnyData = 
      this.personalisationData.name ||
      this.personalisationData.font ||
      this.personalisationData.color ||
      this.personalisationData.dob ||
      this.personalisationData.optionalDob ||
      this.personalisationData.schoolYear ||
      this.personalisationData.name1 ||
      this.personalisationData.name2 ||
      this.personalisationData.name3 ||
      this.personalisationData.name4 ||
      this.personalisationData.textbox ||
      this.personalisationData.message ||
      this.personalisationData.time ||
      this.personalisationData.weight ||
      this.personalisationData.babyName ||
      this.personalisationData.kidName ||
      this.personalisationData.mumName;
    
    if (!hasAnyData) {
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
    
    // Populate Baby/Kid/Mum name inputs
    const babyNameInput = this.refs.babyNameInput || this.querySelector('[data-name-input="baby"]');
    if (babyNameInput && this.personalisationData.babyName) {
      babyNameInput.value = this.personalisationData.babyName;
      // Update character counter
      this.updateNameTabCharCounter('baby', babyNameInput.value.length);
      // Update icon after DOM is ready - retry up to 5 times
      let attempts = 0;
      const maxAttempts = 5;
      const updateBabyIcon = () => {
        attempts++;
        const hasValue = babyNameInput.value.trim().length > 0;
        const icon = this.querySelector(`[data-tab-icon="baby"]`);
        if (icon) {
          this.updateNameTabIcon('baby', hasValue);
        } else if (attempts < maxAttempts) {
          setTimeout(updateBabyIcon, 100);
        }
      };
      setTimeout(updateBabyIcon, 100);
    }
    
    const kidNameInput = this.refs.kidNameInput || this.querySelector('[data-name-input="kid"]');
    if (kidNameInput && this.personalisationData.kidName) {
      kidNameInput.value = this.personalisationData.kidName;
      // Update character counter
      this.updateNameTabCharCounter('kid', kidNameInput.value.length);
      // Update icon after DOM is ready - retry up to 5 times
      let attempts = 0;
      const maxAttempts = 5;
      const updateKidIcon = () => {
        attempts++;
        const hasValue = kidNameInput.value.trim().length > 0;
        const icon = this.querySelector(`[data-tab-icon="kid"]`);
        if (icon) {
          this.updateNameTabIcon('kid', hasValue);
        } else if (attempts < maxAttempts) {
          setTimeout(updateKidIcon, 100);
        }
      };
      setTimeout(updateKidIcon, 100);
    }
    
    const mumNameInput = this.refs.mumNameInput || this.querySelector('[data-name-input="mum"]');
    if (mumNameInput && this.personalisationData.mumName) {
      mumNameInput.value = this.personalisationData.mumName;
      // Update character counter
      this.updateNameTabCharCounter('mum', mumNameInput.value.length);
      // Update icon after DOM is ready - retry up to 5 times
      let attempts = 0;
      const maxAttempts = 5;
      const updateMumIcon = () => {
        attempts++;
        const hasValue = mumNameInput.value.trim().length > 0;
        const icon = this.querySelector(`[data-tab-icon="mum"]`);
        if (icon) {
          this.updateNameTabIcon('mum', hasValue);
        } else if (attempts < maxAttempts) {
          setTimeout(updateMumIcon, 100);
        }
      };
      setTimeout(updateMumIcon, 100);
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
   * Handles name tab input changes (Baby/Kid/Mum)
   * @param {Event} event - The input event
   */
  handleNameTabInput = (event) => {
    const input = event.target;
    const tabType = input.dataset.nameInput; // 'baby', 'kid', or 'mum'
    
    // Remove special characters (only allow letters, numbers, and spaces)
    const sanitized = input.value.replace(/[^a-zA-Z0-9\s]/g, '');
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
    
    const value = sanitized.trim();
    const length = sanitized.length;
    
    // Update character counter
    this.updateNameTabCharCounter(tabType, length);
    
    // Update personalisation data
    if (tabType === 'baby') {
      this.personalisationData.babyName = value;
    } else if (tabType === 'kid') {
      this.personalisationData.kidName = value;
    } else if (tabType === 'mum') {
      this.personalisationData.mumName = value;
    }
    
    // Show/hide tick icon based on whether value exists
    this.updateNameTabIcon(tabType, value.length > 0);
    
    // Update save button state
    this.updateSaveButton();
  };
  
  /**
   * Updates the character counter for name tab inputs
   * @param {string} tabType - The tab type ('baby', 'kid', or 'mum')
   * @param {number} count - The current character count
   */
  updateNameTabCharCounter(tabType, count) {
    let charCounter = null;
    if (tabType === 'baby') {
      charCounter = this.refs.babyCharCounter?.querySelector('[ref="babyCharCount"]') || this.refs.babyCharCount;
    } else if (tabType === 'kid') {
      charCounter = this.refs.kidCharCounter?.querySelector('[ref="kidCharCount"]') || this.refs.kidCharCount;
    } else if (tabType === 'mum') {
      charCounter = this.refs.mumCharCounter?.querySelector('[ref="mumCharCount"]') || this.refs.mumCharCount;
    }
    
    if (charCounter) {
      charCounter.textContent = count;
    }
  }

  /**
   * Switches between name tabs (Baby/Kid/Mum)
   * @param {Event} event - The click event
   */
  switchNameTab = (event) => {
    const button = event.target.closest('.personalise-name-tabs__tab');
    if (!button) return;
    
    const tabType = button.dataset.tab; // 'baby', 'kid', or 'mum'
    
    // Get all tabs and panels
    const tabsContainer = this.querySelector('.personalise-name-tabs__tablist');
    const panelsContainer = this.querySelector('.personalise-name-tabs__panels');
    
    if (!tabsContainer || !panelsContainer) return;
    
    // Remove active class from all tabs
    const allTabs = tabsContainer.querySelectorAll('.personalise-name-tabs__tab');
    allTabs.forEach(tab => {
      tab.classList.remove('is-active');
      tab.setAttribute('aria-selected', 'false');
    });
    
    // Add active class to clicked tab
    button.classList.add('is-active');
    button.setAttribute('aria-selected', 'true');
    
    // Hide all panels
    const allPanels = panelsContainer.querySelectorAll('.personalise-name-tabs__panel');
    allPanels.forEach(panel => {
      panel.classList.remove('is-active');
    });
    
    // Show corresponding panel
    const activePanel = panelsContainer.querySelector(`[data-panel="${tabType}"]`);
    if (activePanel) {
      activePanel.classList.add('is-active');
    }
  };

  /**
   * Updates the tick icon visibility for a name tab
   * @param {string} tabType - The tab type ('baby', 'kid', or 'mum')
   * @param {boolean} show - Whether to show the icon
   */
  updateNameTabIcon(tabType, show) {
    const icon = this.querySelector(`[data-tab-icon="${tabType}"]`);
    if (icon) {
      icon.style.display = show ? 'inline-flex' : 'none';
      console.log(`Updated ${tabType} tab icon:`, show, icon);
    } else {
      console.warn(`Tab icon not found for type: ${tabType}`, this.querySelectorAll('[data-tab-icon]'));
    }
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
      
      // Check if baby/kid/mum name inputs exist and have values
      const babyNameInput = this.refs.babyNameInput || this.querySelector('[data-name-input="baby"]');
      const kidNameInput = this.refs.kidNameInput || this.querySelector('[data-name-input="kid"]');
      const mumNameInput = this.refs.mumNameInput || this.querySelector('[data-name-input="mum"]');
      
      const hasBabyName = babyNameInput ? babyNameInput.value.trim().length > 0 : true;
      const hasKidName = kidNameInput ? kidNameInput.value.trim().length > 0 : true;
      const hasMumName = mumNameInput ? mumNameInput.value.trim().length > 0 : true;
      
      // If any of these inputs exist, they must have values
      const babyNameRequired = babyNameInput && !hasBabyName;
      const kidNameRequired = kidNameInput && !hasKidName;
      const mumNameRequired = mumNameInput && !hasMumName;
      
      // Disable save button if:
      // 1. Name input exists but is empty (for personalized_name products)
      // 2. Any baby/kid/mum name input exists but is empty
      if (nameInput && !hasName) {
        this.refs.saveButton.disabled = true;
      } else if (babyNameRequired || kidNameRequired || mumNameRequired) {
        this.refs.saveButton.disabled = true;
      } else {
        // All required fields have values, enable save button
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

    // Collect Baby/Kid/Mum name values from inputs FIRST
    const babyNameInput = this.refs.babyNameInput || this.querySelector('[data-name-input="baby"]');
    const babyNameValue = babyNameInput && babyNameInput.value.trim() ? babyNameInput.value.trim() : null;
    
    const kidNameInput = this.refs.kidNameInput || this.querySelector('[data-name-input="kid"]');
    const kidNameValue = kidNameInput && kidNameInput.value.trim() ? kidNameInput.value.trim() : null;
    
    const mumNameInput = this.refs.mumNameInput || this.querySelector('[data-name-input="mum"]');
    const mumNameValue = mumNameInput && mumNameInput.value.trim() ? mumNameInput.value.trim() : null;

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
      weight: null,
      babyName: babyNameValue,
      kidName: kidNameValue,
      mumName: mumNameValue
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

    // Update personalisationData for next time
    if (babyNameValue !== null) this.personalisationData.babyName = babyNameValue;
    if (kidNameValue !== null) this.personalisationData.kidName = kidNameValue;
    if (mumNameValue !== null) this.personalisationData.mumName = mumNameValue;

    // Check if we're editing from cart context
    const cartContext = window.cartPersonalizationContext;
    
    if (cartContext && cartContext.cartLine) {
      // Update cart item properties
      this.#updateCartItemProperties(cartContext, personalisation);
    } else {
      // Normal flow: save to sessionStorage for product page
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
        
        sessionStorage.setItem(key, JSON.stringify(personalisation));
        
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
    }

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
    
    // Clear cart context after save
    if (cartContext) {
      window.cartPersonalizationContext = null;
    }
    
    // Update buttons after a short delay to ensure localStorage is set and DOM is updated
    setTimeout(() => {
      if (typeof window.updatePersonaliseButtonText === 'function') {
        window.updatePersonaliseButtonText();
      }
    }, 300);
  };

  /**
   * Updates cart item properties using cart/change.js
   * @param {Object} cartContext - The cart context with cartLine, productId, variantId
   * @param {Object} personalisation - The personalisation data
   * @private
   */
  async #updateCartItemProperties(cartContext, personalisation) {
    try {
      // First, fetch current cart to get the existing quantity for this line item
      const cartResponse = await fetch('/cart.js');
      const currentCart = await cartResponse.json();
      
      // Find the line item by line index (1-based)
      const lineIndex = parseInt(cartContext.cartLine) - 1; // Convert to 0-based index
      const currentCartItem = currentCart.items[lineIndex];
      
      if (!currentCartItem) {
        throw new Error('Cart item not found');
      }
      
      // Get the current quantity to preserve it
      const currentQuantity = currentCartItem.quantity || 1;
      
      // Convert personalisation object to properties format for cart API
      const properties = {};
      
      if (personalisation.name) properties['Name'] = personalisation.name;
      if (personalisation.name1) properties['Name 1'] = personalisation.name1;
      if (personalisation.name2) properties['Name 2'] = personalisation.name2;
      if (personalisation.name3) properties['Name 3'] = personalisation.name3;
      if (personalisation.name4) properties['Name 4'] = personalisation.name4;
      if (personalisation.babyName) properties['Baby\'s Name'] = personalisation.babyName;
      if (personalisation.kidName) properties['Kid\'s Name'] = personalisation.kidName;
      if (personalisation.mumName) properties['Mum\'s Name'] = personalisation.mumName;
      if (personalisation.dob) properties['Date of Birth'] = personalisation.dob;
      if (personalisation.optionalDob) properties['Personalise Date of Birth'] = personalisation.optionalDob;
      if (personalisation.schoolYear) properties['School Year'] = personalisation.schoolYear;
      if (personalisation.color) properties['Text Color'] = personalisation.color;
      if (personalisation.font) properties['Text Font'] = personalisation.font;
      if (personalisation.textbox) properties['Personalisation:'] = personalisation.textbox;
      if (personalisation.message) properties['Message'] = personalisation.message;
      if (personalisation.time) properties['Time'] = personalisation.time;
      if (personalisation.weight) properties['Weight'] = personalisation.weight;
      
      // Get cart sections to update - find all cart-items-components
      const cartItemsComponents = document.querySelectorAll('cart-items-component');
      const sectionIdSet = new Set();
      cartItemsComponents.forEach(comp => {
        if (comp.dataset?.sectionId) {
          sectionIdSet.add(comp.dataset.sectionId);
        }
      });
      const sectionIds = Array.from(sectionIdSet).join(',');
      
      // Build request body - include quantity to preserve it
      const body = {
        line: cartContext.cartLine,
        quantity: currentQuantity,
        properties: properties
      };
      
      // Add sections parameter if we have section IDs (comma-separated string)
      if (sectionIds) {
        body.sections = sectionIds;
        // Also include sections_url for proper section rendering
        body.sections_url = window.location.pathname;
      }
      
      // Update cart via AJAX
      const response = await fetch('/cart/change.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      
      if (!response.ok) {
        throw new Error(`Cart update failed: ${response.statusText}`);
      }
      
      const cart = await response.json();
      
      // If cart API returned sections, use them to update the DOM
      if (cart.sections) {
        // Update each section
        Object.keys(cart.sections).forEach(sectionId => {
          if (cart.sections[sectionId]) {
            morphSection(sectionId, cart.sections[sectionId]);
          }
        });
      } else if (sectionIds) {
        // Fetch updated cart sections manually
        const sectionsResponse = await fetch(`/?sections=${sectionIds}`);
        const sectionsData = await sectionsResponse.json();
        
        Object.keys(sectionsData).forEach(sectionId => {
          if (sectionsData[sectionId]) {
            morphSection(sectionId, sectionsData[sectionId]);
          }
        });
      } else {
        // Fallback: reload the page
        window.location.reload();
      }
      
    } catch (error) {
      console.error('Error updating cart item properties:', error);
      alert('Failed to update personalization. Please try again.');
    }
  }

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

    if (personalisation.babyName) {
      addProperty('properties[Baby\'s Name]', personalisation.babyName);
    }

    if (personalisation.kidName) {
      addProperty('properties[Kid\'s Name]', personalisation.kidName);
    }

    if (personalisation.mumName) {
      addProperty('properties[Mum\'s Name]', personalisation.mumName);
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
              name.includes('[Weight]') ||
              name.includes('[Baby\'s Name]') ||
              name.includes('[Kid\'s Name]') ||
              name.includes('[Mum\'s Name]')) {
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
        if (personalisation.babyName) {
          addProperty('properties[Baby\'s Name]', personalisation.babyName);
          console.log('Added Baby\'s Name to form:', personalisation.babyName);
        }
        if (personalisation.kidName) {
          addProperty('properties[Kid\'s Name]', personalisation.kidName);
          console.log('Added Kid\'s Name to form:', personalisation.kidName);
        }
        if (personalisation.mumName) {
          addProperty('properties[Mum\'s Name]', personalisation.mumName);
          console.log('Added Mum\'s Name to form:', personalisation.mumName);
        }
        
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

