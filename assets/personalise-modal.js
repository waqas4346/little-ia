import { DialogComponent, DialogOpenEvent, DialogCloseEvent } from '@theme/dialog';
import { Component } from '@theme/component';
import { onAnimationEnd } from '@theme/utilities';
import { morphSection } from '@theme/section-renderer';

/**
 * A custom element that manages the personalisation modal.
 *
 * @extends DialogComponent
 */
export class PersonaliseDialogComponent extends DialogComponent {
  requiredRefs = ['dialog', 'saveButton', 'closeButton'];
  #previousScrollY = 0;

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
    
    // Set up direct click handlers for close buttons to stop propagation
    setTimeout(() => {
      this.#setupCloseButtonHandlers();
    }, 100);
    
    // Set up form submit listener
    setTimeout(() => {
      this.setupFormSubmitListenerForCurrentSession();
    }, 100);
    
    // Set form attribute on Baby/Kid/Mum inputs
    this.#setFormAttributeOnInputs();
    
    // Set up event listeners for input changes to update save button
    this.#setupInputChangeListeners();
  }
  
  /**
   * Sets up event listeners for all input changes to update save button state
   * @private
   */
  #setupInputChangeListeners() {
    // Use a MutationObserver to watch for dynamically added fields
    const observer = new MutationObserver(() => {
      this.#attachInputListeners();
    });
    
    // Start observing when dialog is available
    const checkDialog = () => {
      const dialog = this.refs?.dialog || this.querySelector('dialog');
      if (dialog) {
        observer.observe(dialog, { childList: true, subtree: true });
        // Initial attachment
        this.#attachInputListeners();
      } else {
        setTimeout(checkDialog, 100);
      }
    };
    
    setTimeout(checkDialog, 100);
  }
  
  /**
   * Attaches event listeners to all inputs for save button validation
   * @private
   */
  #attachInputListeners() {
    const dialog = this.refs?.dialog || this.querySelector('dialog');
    if (!dialog) return;
    
    // Listen for color radio button changes
    const colorRadios = dialog.querySelectorAll('.personalise-modal__color-grid input[type="radio"]');
    colorRadios.forEach(radio => {
      // Remove existing listener to avoid duplicates
      radio.removeEventListener('change', this.#handleColorRadioChange);
      radio.addEventListener('change', this.#handleColorRadioChange);
    });
    
    // Listen for all other input/textarea/select changes
    const allInputs = dialog.querySelectorAll('input:not([type="radio"]):not([type="checkbox"]), textarea, select');
    allInputs.forEach(input => {
      // Skip if already has listener (check by data attribute)
      if (input.dataset.hasSaveButtonListener) return;
      
      input.dataset.hasSaveButtonListener = 'true';
      input.addEventListener('input', () => this.updateSaveButton());
      input.addEventListener('change', () => this.updateSaveButton());
    });
    
    // Listen for checkbox changes
    const checkboxes = dialog.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      if (checkbox.dataset.hasSaveButtonListener) return;
      checkbox.dataset.hasSaveButtonListener = 'true';
      checkbox.addEventListener('change', () => this.updateSaveButton());
    });
  }
  
  /**
   * Handles color radio button change events
   * @private
   */
  #handleColorRadioChange = (event) => {
    const radio = event.target;
    if (radio.checked) {
      const colorButton = radio.closest('.personalise-modal__color-button');
      if (colorButton) {
        const colorName = colorButton.dataset.color;
        this.selectedColor = colorName;
        this.personalisationData.color = colorName;
      }
    }
    this.updateSaveButton();
  }

  /**
   * Sets up direct click handlers for close and cancel buttons to prevent event bubbling
   * @private
   */
  #setupCloseButtonHandlers() {
    
    // Store reference to component for use in event handlers
    const component = this;
    
    const dialogElement = this.refs?.dialog || this.querySelector('dialog');
    
    if (!dialogElement) {
      // Dialog element not ready yet, try again later
      setTimeout(() => this.#setupCloseButtonHandlers(), 50);
      return;
    }
    
    // DIRECT HANDLER FUNCTION - MUST stop propagation IMMEDIATELY before anything else
    const handleClose = (event) => {
      // CRITICAL: Stop ALL propagation FIRST before anything else can process
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      
      // Mark event so other handlers (like quick-add) know to ignore it
      event.personaliseDialogClick = true;
      event.cancelBubble = true;
      event.returnValue = false;
      
      
      // Call close method immediately
      component.closePersonaliseOnly();
      
      // Return false to ensure no other handlers run
      return false;
    };
    
    // Find ALL close buttons by multiple selectors
    const selectors = [
      '[data-personalise-close="true"]',
      '.personalise-modal__close',
      '.personalise-modal__cancel-button'
    ];
    
    let buttonsFound = 0;
    selectors.forEach(selector => {
      const buttons = this.querySelectorAll(selector);
      buttons.forEach(btn => {
        buttonsFound++;
        // Remove any existing handlers first to avoid duplicates
        btn.removeEventListener('click', handleClose, { capture: true });
        btn.removeEventListener('mousedown', handleClose, { capture: true });
        
        // Create wrapped handlers that ensure propagation is stopped IMMEDIATELY
        const wrappedMousedown = (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          e.personaliseDialogClick = true;
          handleClose(e);
          return false;
        };
        
        const wrappedClick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          e.personaliseDialogClick = true;
          handleClose(e);
          return false;
        };
        
        // Add handlers with capture phase FIRST to catch events BEFORE quick-add handlers
        btn.addEventListener('mousedown', wrappedMousedown, { capture: true, passive: false });
        btn.addEventListener('click', wrappedClick, { capture: true, passive: false });
      });
    });
    
    // ALSO set up delegation on dialog element as additional safety
    if (!dialogElement.dataset.personaliseCloseHandlerSetup) {
      const handleDelegatedClick = (event) => {
        const closeBtn = event.target.closest('[data-personalise-close="true"], .personalise-modal__close, .personalise-modal__cancel-button');
        if (closeBtn) {
          handleClose(event);
        }
      };
      
      dialogElement.addEventListener('click', handleDelegatedClick, { capture: true, passive: false });
      dialogElement.dataset.personaliseCloseHandlerSetup = 'true';
    }
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
    
    // If not found, check if we're in a quick-add modal context
    if (!productForm) {
      const quickAddModal = document.querySelector('#quick-add-modal-content');
      if (quickAddModal) {
        productForm = quickAddModal.querySelector('form[data-type="add-to-cart-form"]');
      }
    }
    
    // Fallback to any form
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
  setupFormSubmitListenerForCurrentSession() {
    // Find the product form
    let productForm = null;
    const productFormComponent = this.closest('product-form-component');
    if (productFormComponent) {
      productForm = productFormComponent.querySelector('form[data-type="add-to-cart-form"]');
    }
    
    // If not found, check if we're in a quick-add modal context
    if (!productForm) {
      const quickAddModal = document.querySelector('#quick-add-modal-content');
      if (quickAddModal) {
        productForm = quickAddModal.querySelector('form[data-type="add-to-cart-form"]');
      }
    }
    
    // Fallback to any form
    if (!productForm) {
      productForm = document.querySelector(`form[data-type="add-to-cart-form"]`);
    }
    if (productForm) {
      this.setupFormSubmitListener(productForm);
    }
  }

  /**
   * Loads saved personalisation from form inputs (not from storage)
   */
  loadSavedPersonalisation() {
    // First, check if we're opening from cart drawer (cart edit context)
    if (window.cartPersonalizationContext && window.cartPersonalizationContext.properties) {
      
      // Convert cart properties to personalisation data format
      const properties = window.cartPersonalizationContext.properties;
      const personalisation = {
        name: properties['Name'] || null,
        name1: properties['Name 1'] || null,
        name2: properties['Name 2'] || null,
        name3: properties['Name 3'] || null,
        name4: properties['Name 4'] || null,
        babyName: properties['Baby\'s Name'] || null,
        kidName: properties['Kid\'s Name'] || null,
        mumName: properties['Mum\'s Name'] || null,
        dob: properties['Date of Birth'] || null,
        optionalDob: properties['Personalise Date of Birth'] || null,
        schoolYear: properties['School Year'] || null,
        color: properties['Text Color'] || null,
        font: properties['Text Font'] || null,
        textbox: properties['Personalisation:'] || null,
        message: properties['Message'] || null,
        time: properties['Time'] || null,
        weight: properties['Weight'] || null
      };
      
      // Filter out null/empty values
      Object.keys(personalisation).forEach(key => {
        if (!personalisation[key] || (typeof personalisation[key] === 'string' && !personalisation[key].trim())) {
          delete personalisation[key];
        }
      });
      
      // Merge with existing personalisationData
      this.personalisationData = {
        ...this.personalisationData,
        ...personalisation
      };
      
      if (Object.keys(personalisation).length > 0) {
        return; // Exit early, we have the data from cart
      }
    }
    
    // Find the product form
    // PRIORITIZE: If we're in a quick-add modal context, always use that form first
    // This ensures we read personalization from the correct product in quick-add
    let form = null;
    const quickAddModal = document.querySelector('#quick-add-modal-content');
    if (quickAddModal) {
      // If quick-add modal exists, use its form (this is the current product being personalized)
      form = quickAddModal.querySelector('form[data-type="add-to-cart-form"]');
    }
    
    // If not in quick-add context, try closest product-form-component
    if (!form) {
      form = this.closest('product-form-component')?.querySelector('form[data-type="add-to-cart-form"]');
    }
    
    // Fallback to any form (but this should rarely happen)
    if (!form) {
      form = document.querySelector('form[data-type="add-to-cart-form"]');
    }
    
    if (!form) {
      return; // No form found
    }
    
    // Read personalisation data directly from form inputs
    const personalisation = {};
    
    // Read name
    const nameInput = form.querySelector('input[name="properties[Name]"]');
    if (nameInput && nameInput.value.trim()) {
      personalisation.name = nameInput.value.trim();
    }
    
    // Read font
    const fontInput = form.querySelector('input[name="properties[Text Font]"]:checked') || 
                      form.querySelector('input[name="properties[Text Font]"]');
    if (fontInput && fontInput.value.trim()) {
      personalisation.font = fontInput.value.trim();
    }
    
    // Read color
    const colorInput = form.querySelector('input[name="properties[Text Color]"]:checked') || 
                       form.querySelector('input[name="properties[Text Color]"]');
    if (colorInput && colorInput.value.trim()) {
      personalisation.color = colorInput.value.trim();
    }
    
    // Read DOB
    const dobInput = form.querySelector('input[name="properties[Date of Birth]"]');
    if (dobInput && dobInput.value.trim()) {
      personalisation.dob = dobInput.value.trim();
    }
    
    // Read school year
    const schoolYearInput = form.querySelector('input[name="properties[School Year]"]');
    if (schoolYearInput && schoolYearInput.value.trim()) {
      personalisation.schoolYear = schoolYearInput.value.trim();
    }
    
    // Read name1-4
    const name1Input = form.querySelector('input[name="properties[Name 1]"]');
    if (name1Input && name1Input.value.trim()) {
      personalisation.name1 = name1Input.value.trim();
    }
    
    const name2Input = form.querySelector('input[name="properties[Name 2]"]');
    if (name2Input && name2Input.value.trim()) {
      personalisation.name2 = name2Input.value.trim();
    }
    
    const name3Input = form.querySelector('input[name="properties[Name 3]"]');
    if (name3Input && name3Input.value.trim()) {
      personalisation.name3 = name3Input.value.trim();
    }
    
    const name4Input = form.querySelector('input[name="properties[Name 4]"]');
    if (name4Input && name4Input.value.trim()) {
      personalisation.name4 = name4Input.value.trim();
    }
    
    // Read textbox
    const textboxInput = form.querySelector('textarea[name="properties[Personalisation:]"]');
    if (textboxInput && textboxInput.value.trim()) {
      personalisation.textbox = textboxInput.value.trim();
    }
    
    // Read message
    const messageInput = form.querySelector('textarea[name="properties[Message]"]');
    if (messageInput && messageInput.value.trim()) {
      personalisation.message = messageInput.value.trim();
    }
    
    // Read optional DOB
    const optionalDobInput = form.querySelector('input[name="properties[Personalise Date of Birth]"]');
    if (optionalDobInput && optionalDobInput.value.trim()) {
      personalisation.optionalDob = optionalDobInput.value.trim();
    }
    
    // Read time
    const timeInput = form.querySelector('input[name="properties[Time]"]');
    if (timeInput && timeInput.value.trim()) {
      personalisation.time = timeInput.value.trim();
    }
    
    // Read weight
    const weightInput = form.querySelector('input[name="properties[Weight]"]');
    if (weightInput && weightInput.value.trim()) {
      personalisation.weight = weightInput.value.trim();
    }
    
    // Read Baby/Kid/Mum names
    const babyNameInput = form.querySelector('input[name="properties[Baby\'s Name]"]');
    if (babyNameInput && babyNameInput.value.trim()) {
      personalisation.babyName = babyNameInput.value.trim();
    }
    
    const kidNameInput = form.querySelector('input[name="properties[Kid\'s Name]"]');
    if (kidNameInput && kidNameInput.value.trim()) {
      personalisation.kidName = kidNameInput.value.trim();
    }
    
    const mumNameInput = form.querySelector('input[name="properties[Mum\'s Name]"]');
    if (mumNameInput && mumNameInput.value.trim()) {
      personalisation.mumName = mumNameInput.value.trim();
    }
    
    // Merge with existing personalisationData to preserve structure
    this.personalisationData = {
      ...this.personalisationData,
      ...personalisation
    };
    
    // CRITICAL: If no personalisation found in form inputs, check window.currentPersonalisation as fallback
    // This is important because after adding to cart, form inputs might be cleared/morphed
    // but the data is still stored in window.currentPersonalisation
    if (Object.keys(personalisation).length === 0) {
      // Try to get product ID to look up stored personalisation
      let productId = null;
      const productFormComponent = form?.closest('product-form-component');
      if (productFormComponent) {
        productId = productFormComponent.dataset?.productId;
      }
      
      // If not found, try to get from quick-add modal
      if (!productId && quickAddModal) {
        const quickAddFormComponent = quickAddModal.querySelector('product-form-component');
        productId = quickAddFormComponent?.dataset?.productId;
      }
      
      // Check window.currentPersonalisation for this product
      if (productId && window.currentPersonalisation) {
        let savedPersonalisation = null;
        
        // Try to get personalisation by product ID first
        if (window.currentPersonalisation[productId]) {
          savedPersonalisation = { ...window.currentPersonalisation[productId] };
        } else if (window.currentPersonalisation._latest) {
          // Fallback to latest
          savedPersonalisation = { ...window.currentPersonalisation._latest };
        } else if (window.currentPersonalisation && typeof window.currentPersonalisation === 'object' && !Array.isArray(window.currentPersonalisation)) {
          // Check if it's a direct object (old format)
          const hasProductKeys = Object.keys(window.currentPersonalisation).some(key => key.startsWith('_') || /^\d+$/.test(key));
          if (!hasProductKeys) {
            savedPersonalisation = { ...window.currentPersonalisation };
          }
        }
        
        if (savedPersonalisation) {
          // Filter out null/empty values and internal keys
          Object.keys(savedPersonalisation).forEach(key => {
            if (key.startsWith('_') || 
                !savedPersonalisation[key] || 
                (typeof savedPersonalisation[key] === 'string' && !savedPersonalisation[key].trim())) {
              delete savedPersonalisation[key];
            }
          });
          
          // Merge saved personalisation into personalisationData
          if (Object.keys(savedPersonalisation).length > 0) {
            this.personalisationData = {
              ...this.personalisationData,
              ...savedPersonalisation
            };
          }
        }
      }
    }
    
  }

  /**
   * Shows the dialog.
   * Overridden to prevent click handlers from interfering with parent dialog
   */
  showDialog() {
    const { dialog } = this.refs;

    if (dialog.open) return;

    const scrollY = window.scrollY;
    this.#previousScrollY = scrollY;

    // Set up close button handlers BEFORE opening dialog
    // This ensures they're ready when the dialog opens
    this.#setupCloseButtonHandlers();

    // Prevent layout thrashing by separating DOM reads from DOM writes
    requestAnimationFrame(() => {
      document.body.style.width = '100%';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;

      dialog.showModal();
      this.dispatchEvent(new DialogOpenEvent());
      
      // Initialize save button state
      this.#initializeSaveButtonState();

      // Update overlay position on resize (dynamic personalization; position in px from visible image rect)
      if (this.dataset.cbPersonalizationImage) {
        if (!this._cbPreviewResizeHandler) {
          this._cbPreviewResizeHandler = () => this.updateCbPreviewOverlay();
        }
        window.addEventListener('resize', this._cbPreviewResizeHandler);
      }

      // Only add keydown listener for Escape key, NOT click listener
      // This prevents the personalise dialog from closing parent dialog
      this.addEventListener('keydown', this.#handleKeyDownPersonalise);
      
      // Set up close button handlers again after dialog opens (ensure they're attached)
      // CRITICAL: Must set up handlers AFTER dialog is shown to catch events before quick-add handlers
      requestAnimationFrame(() => {
        this.#setupCloseButtonHandlers();
        // Try multiple times to ensure refs are populated and handlers are attached
        setTimeout(() => {
          this.#setupCloseButtonHandlers();
          // One more time after animation completes
          setTimeout(() => {
            this.#setupCloseButtonHandlers();
            // Final attempt after everything is fully loaded
            setTimeout(() => {
              this.#setupCloseButtonHandlers();
            }, 200);
          }, 200);
        }, 100);
      });
    });
    
    // Check if this is for build-your-set or quick-add modal - if so, clear state first
    // BUT don't clear if we're opening from cart drawer (cart edit context)
    const quickAddModal = document.getElementById('quick-add-modal-content');
    const isBuildYourSet = quickAddModal?.hasAttribute('data-build-your-set');
    const isCartContext = window.cartPersonalizationContext && window.cartPersonalizationContext.properties;
    const isQuickAddContext = quickAddModal && !isBuildYourSet;
    
    // Track the current product ID to detect when switching products
    const currentProductForm = quickAddModal?.querySelector('form[data-type="add-to-cart-form"]');
    const currentProductId = currentProductForm?.closest('product-form-component')?.dataset?.productId;
    const previousProductId = this._lastProductId;
    
    // Clear state if:
    // 1. It's build-your-set (and not cart context)
    // 2. It's a quick-add modal AND we're opening for a different product (product switched)
    // 3. It's a quick-add modal AND we don't have a previous product ID (first time opening)
    const shouldClearState = (isBuildYourSet && !isCartContext) || 
                             (isQuickAddContext && !isCartContext && (currentProductId !== previousProductId || !previousProductId));
    
    if (shouldClearState) {
      // Clear internal state to ensure fresh start for new product
      // But preserve cart context data if we're editing from cart
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
        weight: null,
        babyName: null,
        kidName: null,
        mumName: null
      };
      
      // CRITICAL: Also clear visual fields in the dialog to prevent showing old values
      // Wait for dialog to be available before clearing
      requestAnimationFrame(() => {
        // Clear name input
        const nameInput = this.refs.nameInput || this.querySelector('#personalise-name');
        if (nameInput) {
          nameInput.value = '';
          const charCounter = this.refs.charCounter?.querySelector('[ref="charCount"]') || this.refs.charCount;
          if (charCounter) {
            charCounter.textContent = '0';
          }
        }
        
        // Clear font selection
        if (this.refs.fontGrid) {
          const fontButtons = this.refs.fontGrid.querySelectorAll('.personalise-modal__font-button');
          fontButtons.forEach(btn => {
            btn.classList.remove('personalise-modal__font-button--selected');
          });
        }
        
        // Clear color selection
        const colorGrid = this.refs.colorGrid || this.querySelector('.personalise-modal__color-grid');
        if (colorGrid) {
          const colorRadios = colorGrid.querySelectorAll('input[type="radio"]');
          colorRadios.forEach(radio => {
            radio.checked = false;
          });
        }
        
        // Clear Baby/Kid/Mum name inputs
        const babyNameInput = this.refs.babyNameInput || this.querySelector('[data-name-input="baby"]');
        if (babyNameInput) {
          babyNameInput.value = '';
          this.updateNameTabCharCounter('baby', 0);
          this.updateNameTabIcon('baby', false);
        }
        
        const kidNameInput = this.refs.kidNameInput || this.querySelector('[data-name-input="kid"]');
        if (kidNameInput) {
          kidNameInput.value = '';
          this.updateNameTabCharCounter('kid', 0);
          this.updateNameTabIcon('kid', false);
        }
        
        const mumNameInput = this.refs.mumNameInput || this.querySelector('[data-name-input="mum"]');
        if (mumNameInput) {
          mumNameInput.value = '';
          this.updateNameTabCharCounter('mum', 0);
          this.updateNameTabIcon('mum', false);
        }
        
        // Clear all other input fields
        const allInputs = this.querySelectorAll('input[type="text"], textarea, input[type="date"]');
        allInputs.forEach(input => {
          // Skip radio buttons and checkboxes - they're handled separately
          if (input.type !== 'radio' && input.type !== 'checkbox') {
            input.value = '';
          }
        });
      });
    }
    
    // Store current product ID for next comparison
    if (currentProductId) {
      this._lastProductId = currentProductId;
    }
    
    // Load saved personalisation from current session only (non-blocking)
    // This will check cart context first, then form inputs, then window.currentPersonalisation
    // BUT: If we just cleared state for a new product, we still want to load from the form
    // (which should be empty for the new product, or have its own saved values)
    try {
      this.loadSavedPersonalisation();
      
      // After loading, if we got data from window.currentPersonalisation (not from form),
      // re-add the hidden inputs to the form so they're available for next add-to-cart
      if (this.personalisationData && Object.keys(this.personalisationData).length > 0) {
        // Check if form has the inputs - if not, we loaded from window.currentPersonalisation
        const form = quickAddModal?.querySelector('form[data-type="add-to-cart-form"]') ||
                    this.closest('product-form-component')?.querySelector('form[data-type="add-to-cart-form"]') ||
                    document.querySelector('form[data-type="add-to-cart-form"]');
        
        if (form) {
          const hasNameInput = form.querySelector('input[name="properties[Name]"]');
          const hasFontInput = form.querySelector('input[name="properties[Text Font]"]');
          const hasColorInput = form.querySelector('input[name="properties[Text Color]"]');
          
          // If form doesn't have personalization inputs but we have data, re-add them
          if ((this.personalisationData.name && !hasNameInput) ||
              (this.personalisationData.font && !hasFontInput) ||
              (this.personalisationData.color && !hasColorInput)) {
            // Re-add inputs to form using the updateFormFields method
            this.updateFormFields(this.personalisationData);
          }
        }
      }
    } catch (error) {
      console.error('Error loading personalisation:', error);
    }
    
    // Wait for dialog to be fully open and refs to be available
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
            // Set up input listeners after fields are populated
            this.#attachInputListeners();
            // Update dynamic personalization text overlay if variant/product has cb metafields
            this.updateCbPreviewOverlay();
          } catch (error) {
            console.error('Error populating fields:', error);
          }
        });
      } else if (attempts < maxAttempts) {
        // Dialog not open yet, try again
        setTimeout(checkAndPopulate, 50);
      } else {
        // Max attempts reached, try to populate anyway
        try {
          this.#populateFieldsFromSavedData();
          // Set up input listeners after fields are populated
          this.#attachInputListeners();
          this.updateCbPreviewOverlay();
        } catch (error) {
          console.error('Error populating fields after max attempts:', error);
        }
      }
    };
    
    // Start checking after a small delay to let the dialog open
    setTimeout(checkAndPopulate, 100);
  }

  /**
   * Handle Escape key for personalise dialog only
   * @private
   */
  #handleKeyDownPersonalise = (event) => {
    if (event.key !== 'Escape') return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    this.closePersonaliseDialog();
  };

  /**
   * COMPLETELY SEPARATE CLOSE METHOD - bypasses ALL parent logic
   * Only called by buttons with data-personalise-close="true"
   * This method name is unique and won't conflict with anything
   */
  closePersonaliseOnly = async () => {
    if (this._cbPreviewResizeHandler) {
      window.removeEventListener('resize', this._cbPreviewResizeHandler);
    }

    // Clear internal state when closing (especially for build-your-set to prevent font persistence)
    this.selectedFont = null;
    this.selectedColor = null;
    // Reset personalisationData to initial state
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
    
    // Get dialog directly - don't rely on refs if they might be stale
    const dialogElement = this.querySelector('dialog') || this.refs?.dialog;

    if (!dialogElement) {
      // Even if dialog isn't open, ensure body styles are reset if no other dialogs are open
      const quickAddDialog = document.querySelector('#quick-add-dialog dialog');
      const quickAddIsOpen = quickAddDialog && quickAddDialog.open;
      if (!quickAddIsOpen) {
        document.body.style.width = '';
        document.body.style.position = '';
        document.body.style.top = '';
      }
      return;
    }
    
    if (!dialogElement.open) {
      // Even if dialog isn't open, ensure body styles are reset if no other dialogs are open
      const quickAddDialog = document.querySelector('#quick-add-dialog dialog');
      const quickAddIsOpen = quickAddDialog && quickAddDialog.open;
      if (!quickAddIsOpen) {
        document.body.style.width = '';
        document.body.style.position = '';
        document.body.style.top = '';
      }
      return;
    }

    // Remove keydown listener
    try {
      this.removeEventListener('keydown', this.#handleKeyDownPersonalise);
    } catch (e) {
      // Ignore
    }

    dialogElement.classList.add('dialog-closing');

    try {
      await onAnimationEnd(dialogElement, undefined, {
        subtree: false,
      });
    } catch (e) {
      console.warn('Animation end error:', e);
    }

    // Close this dialog FIRST - don't check anything else
    try {
      dialogElement.close();
    } catch (e) {
      console.error('Error calling dialog.close():', e);
    }
    
    dialogElement.classList.remove('dialog-closing');

    // Check if quick-add dialog is still open AFTER closing this one
    const quickAddDialog = document.querySelector('#quick-add-dialog dialog');
    const quickAddIsOpen = quickAddDialog && quickAddDialog.open;
    
    // Only reset body styles if quick-add dialog is also closed
    if (!quickAddIsOpen) {
      document.body.style.width = '';
      document.body.style.position = '';
      document.body.style.top = '';
      // Restore scroll position using saved value
      window.scrollTo({ top: this.#previousScrollY, behavior: 'instant' });
    }

    try {
      this.dispatchEvent(new DialogCloseEvent());
    } catch (e) {
      console.error('Error dispatching event:', e);
    }
  };

  /**
   * Keep old method names for backwards compatibility but delegate to new method
   */
  handleCloseButton = async (event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
    await this.closePersonaliseOnly();
  };

  closePersonaliseDialog = async () => {
    return this.closePersonaliseOnly();
  };

  /**
   * Override closeDialog to use our custom implementation
   * This prevents parent dialog checks from interfering
   */
  closeDialog = async () => {
    return this.closePersonaliseOnly();
  };
  
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
   * Initializes save button state when dialog opens
   * @private
   */
  #initializeSaveButtonState() {
    // Wait a bit for DOM to be ready
    setTimeout(() => {
      this.updateSaveButton();
    }, 100);
  }

  /**
   * Updates the dynamic personalization text overlay on the preview image when
   * variant/product has cb_personalization_image and cb_personalization_position metafields.
   * Positions overlay in pixels from the visible (object-fit: contain) image rect so the
   * image stays full size and text placement is correct at all viewports.
   */
  updateCbPreviewOverlay() {
    const imageUrl = this.dataset.cbPersonalizationImage;
    const positionJson = this.dataset.cbPersonalizationPosition;
    if (!imageUrl || !positionJson) return;

    const wrap = this.querySelector('.personalise-modal__preview-image-wrap');
    const img = wrap && wrap.querySelector('.personalise-modal__preview-image--dynamic');
    if (img && !img.complete) {
      img.addEventListener('load', () => this.updateCbPreviewOverlay(), { once: true });
    }

    const overlay = (this.refs && this.refs.previewTextOverlay) || this.querySelector('.personalise-modal__preview-text-overlay');
    if (!overlay) return;

    let position;
    try {
      position = typeof positionJson === 'string' ? JSON.parse(positionJson) : positionJson;
    } catch (e) {
      return;
    }
    const xPct = position.x != null ? Number(position.x) : 20;
    const yPct = position.y != null ? Number(position.y) : 20;
    const fontSize = position.font_size != null ? Number(position.font_size) : 20;

    const nameInput = (this.refs && this.refs.nameInput) || this.querySelector('#personalise-name');
    const nameVal = (nameInput && nameInput.value) || (this.personalisationData && this.personalisationData.name) || '';
    const name = String(nameVal).trim();
    const colorName = (this.personalisationData && this.personalisationData.color) || this.selectedColor || '';
    const fontName = (this.personalisationData && this.personalisationData.font) || this.selectedFont || '';

    overlay.textContent = name;
    overlay.style.fontSize = `${fontSize}px`;
    overlay.style.fontFamily = fontName ? `"${fontName}", sans-serif` : '';
    overlay.style.transform = 'translate(-50%, 50%)';
    overlay.style.top = '';

    const colorMap = {
      black: '#000000',
      white: '#ffffff',
      blue: '#DEE8EF',
      gold: '#DEB035',
      green: '#E4EFDB',
      grey: '#E8EBEC',
      gray: '#E8EBEC',
      orange: '#F8CF89',
      pink: '#F7DDE2',
      purple: '#F0D9E6',
      red: '#BC3725',
      silver: '#DEEBF7',
      yellow: '#F9F3DB'
    };
    const colorKey = colorName && colorName.toLowerCase ? colorName.toLowerCase() : '';
    const cssColor = (colorKey && colorMap[colorKey]) || colorName || '';
    overlay.style.color = cssColor || 'inherit';

    if (!wrap || !img || !img.naturalWidth) return;
    const wrapW = wrap.clientWidth;
    const wrapH = wrap.clientHeight;
    if (!wrapW || !wrapH) return;
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    const scale = Math.min(wrapW / nw, wrapH / nh);
    const vW = nw * scale;
    const vH = nh * scale;
    const vL = (wrapW - vW) / 2;
    const vT = (wrapH - vH) / 2;
    const leftPx = vL + (vW * xPct / 100);
    const bottomPx = wrapH - vT - (vH * (1 - yPct / 100));
    overlay.style.left = Math.round(leftPx) + 'px';
    overlay.style.bottom = Math.round(bottomPx) + 'px';
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
    this.updateCbPreviewOverlay();
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
    
    // Update save button state after color selection
    this.updateSaveButton();
    this.updateCbPreviewOverlay();
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
    
    // Update save button state after font selection
    this.updateSaveButton();
    this.updateCbPreviewOverlay();
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
      
      // Check if font field exists (required field with red asterisk)
      const fontGrid = this.refs.fontGrid || this.querySelector('.personalise-modal__font-grid');
      const hasFont = fontGrid ? (this.selectedFont || this.personalisationData.font) : true;
      const fontRequired = fontGrid && !hasFont;
      
      // Check if color field exists (required field with red asterisk)
      const colorGrid = this.refs.colorGrid || this.querySelector('.personalise-modal__color-grid');
      const colorRadioInputs = colorGrid ? colorGrid.querySelectorAll('input[type="radio"]') : [];
      const hasColor = colorGrid ? (this.selectedColor || this.personalisationData.color || Array.from(colorRadioInputs).some(input => input.checked)) : true;
      const colorRequired = colorGrid && colorRadioInputs.length > 0 && !hasColor;
      
      // Check for any other required fields (fields with required attribute or aria-required)
      const allInputs = this.querySelectorAll('input, textarea, select');
      let hasMissingRequiredField = false;
      allInputs.forEach(input => {
        // Skip radio buttons that aren't checked (they're handled separately)
        if (input.type === 'radio' && !input.checked) {
          return;
        }
        // Check if field is required
        if (input.hasAttribute('required') || input.hasAttribute('aria-required')) {
          // For text inputs, textareas, and selects, check if they have a value
          if ((input.type === 'text' || input.type === 'textarea' || input.tagName === 'TEXTAREA' || input.tagName === 'SELECT') && !input.value.trim()) {
            hasMissingRequiredField = true;
          }
          // For checkboxes, check if they're checked
          if (input.type === 'checkbox' && !input.checked) {
            hasMissingRequiredField = true;
          }
        }
      });
      
      // Disable save button if any required field is missing:
      // 1. Name input exists but is empty (for personalized_name products)
      // 2. Any baby/kid/mum name input exists but is empty
      // 3. Font field exists but no font is selected
      // 4. Color field exists but no color is selected
      // 5. Any other required field is missing
      if (nameInput && !hasName) {
        this.refs.saveButton.disabled = true;
      } else if (babyNameRequired || kidNameRequired || mumNameRequired) {
        this.refs.saveButton.disabled = true;
      } else if (fontRequired) {
        this.refs.saveButton.disabled = true;
      } else if (colorRequired) {
        this.refs.saveButton.disabled = true;
      } else if (hasMissingRequiredField) {
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
  savePersonalisation = async (event) => {
    event.preventDefault();
    
    // Collect all field values
    const nameInput = this.refs.nameInput || this.querySelector('#personalise-name');
    const name = nameInput ? nameInput.value.trim() : '';
    
    // Validate required fields (name is required for personalized_name products)
    if (nameInput && !name) {
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
    
    // Declare form variable outside if/else so it's accessible later
    let form = null;
    
    if (cartContext && cartContext.cartLine) {
      // Update cart item properties ONLY - do NOT update product page form
      // The product page form should keep its original personalization
      await this.#updateCartItemProperties(cartContext, personalisation);
      
      // Find form only for event detail, but don't modify it
      form = this.closest('product-form-component')?.querySelector('form[data-type="add-to-cart-form"]');
      if (!form) {
        const quickAddModal = document.querySelector('#quick-add-modal-content');
        if (quickAddModal) {
          form = quickAddModal.querySelector('form[data-type="add-to-cart-form"]');
        }
      }
      if (!form) {
        form = document.querySelector('form[data-type="add-to-cart-form"]');
      }
      
    } else {
      // Write personalisation directly to form inputs (not to storage)
      form = this.closest('product-form-component')?.querySelector('form[data-type="add-to-cart-form"]');
      
      // If not found, check if we're in a quick-add modal context
      if (!form) {
        const quickAddModal = document.querySelector('#quick-add-modal-content');
        if (quickAddModal) {
          form = quickAddModal.querySelector('form[data-type="add-to-cart-form"]');
        }
      }
      
      // Fallback to any form
      if (!form) {
        form = document.querySelector('form[data-type="add-to-cart-form"]');
      }
      
      if (form) {
        // Remove existing personalisation properties (but keep gift message and other non-personalisation properties)
        const existingProps = form.querySelectorAll('input[name^="properties["], textarea[name^="properties["]');
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
              name.includes('[Mum\'s Name]') ||
              name.includes('[Message]')) {
            input.remove();
          }
        });
        
        // Add personalisation properties as hidden inputs
        const addProperty = (name, value) => {
          if (value && value.toString().trim() !== '') {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = name;
            input.value = value.toString().trim();
            // Insert before the variant ID input to ensure it's in the form
            const variantInput = form.querySelector('input[name="id"]');
            if (variantInput) {
              variantInput.parentNode.insertBefore(input, variantInput.nextSibling);
            } else {
              form.appendChild(input);
            }
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
        
        // Verify inputs were added
        const addedInputs = form.querySelectorAll('input[name^="properties["]');
        const inputDetails = Array.from(addedInputs).map(input => ({
          name: input.name,
          value: input.value
        }));
        
        // Use requestAnimationFrame to ensure DOM is updated before checking
        requestAnimationFrame(() => {
          // Trigger update of button text - with multiple retries to ensure buttons are in DOM
          const updateButtonWithRetry = (attempts = 0) => {
            if (typeof window.updatePersonaliseButtonText === 'function') {
              // Verify inputs are still in the form before updating
              const verifyInputs = form.querySelectorAll('input[name^="properties["]');
              
              window.updatePersonaliseButtonText();
              
              // Check if buttons were updated, if not retry
              setTimeout(() => {
                const buttons = document.querySelectorAll('[data-personalise-button]');
                let anyButtonUpdated = false;
                buttons.forEach((button) => {
                  const textSpan = button.querySelector('[data-personalise-text]');
                  if (textSpan && textSpan.textContent === 'EDIT') {
                    anyButtonUpdated = true;
                  }
                });
                
                // If no buttons were updated and we haven't exceeded retries, try again
                if (!anyButtonUpdated && attempts < 15) {
                  setTimeout(() => updateButtonWithRetry(attempts + 1), 200);
                }
              }, 100);
            } else if (attempts < 15) {
              // Function not defined yet, retry
              setTimeout(() => updateButtonWithRetry(attempts + 1), 200);
            }
          };
          
          // Start with a small delay to ensure DOM is ready
          setTimeout(() => updateButtonWithRetry(0), 50);
        });
      } else {
      }

      // Also store globally for the current product (keyed by product ID to avoid conflicts)
      const productId = form?.closest('product-form-component')?.dataset?.productId;
      if (productId) {
        if (!window.currentPersonalisation) {
          window.currentPersonalisation = {};
        }
        window.currentPersonalisation[productId] = personalisation;
        window.currentPersonalisation._latest = personalisation; // Also store latest for fallback
      } else {
        // Fallback if product ID not found
        window.currentPersonalisation = personalisation;
      }

      // Update hidden form fields if they exist
      this.updateFormFields(personalisation);
    }

    // Dispatch custom event for other components to listen to
    // Include form reference and product ID in event detail
    const formComponent = form?.closest('product-form-component');
    const productId = formComponent?.dataset?.productId || this.dataset?.productId;
    
    const customEvent = new CustomEvent('personalisation-saved', {
      detail: {
        ...personalisation,
        form: form,
        formId: form?.id,
        productId: productId,
        formComponent: formComponent
      },
      bubbles: true,
      cancelable: true
    });
    this.dispatchEvent(customEvent);
    
    // Also dispatch on document to ensure it's caught
    document.dispatchEvent(customEvent);

    // Close the dialog
    this.closeDialog();

    // Button text is updated by document listener (buy-buttons) on 'personalisation-saved'.
    // We do not update here to avoid duplicate retry loops that caused the Edit
    // personalisation button to flash in the quick-add popup.
    
    // Clear cart context after save
    if (cartContext) {
      window.cartPersonalizationContext = null;
    }
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
    
    // If not found, check if we're in a quick-add modal context
    if (!productForm) {
      const quickAddModal = document.querySelector('#quick-add-modal-content');
      if (quickAddModal) {
        // Find the form within the quick-add modal
        productForm = quickAddModal.querySelector('form[data-type="add-to-cart-form"]');
      }
    }
    
    // Fallback: find any product form
    if (!productForm) {
      productForm = document.querySelector(`form[data-type="add-to-cart-form"]`);
    }
    
    if (!productForm) {
      return;
    }

    // Remove existing personalisation properties fields (but keep gift message and other non-personalisation properties)
    const existingProps = productForm.querySelectorAll('input[name^="properties["], textarea[name^="properties["]');
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
          name.includes('[Mum\'s Name]') ||
          name.includes('[Message]')) {
        input.remove();
      }
    });

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
    this.setupFormSubmitListener(productForm);
  }
  
  /**
   * Sets up a listener to ensure personalisation fields are added before form submission
   * @param {HTMLFormElement} form - The form element
   */
  setupFormSubmitListener(form) {
    // Remove any existing listener to avoid duplicates
    if (form.dataset.personalisationListenerAdded) {
      return;
    }
    
    form.dataset.personalisationListenerAdded = 'true';
    
    // Helper function to add personalisation fields to form
    const addPersonalisationFieldsToForm = (targetForm) => {
      // Get the current product ID
      let productFormComponent = targetForm.closest('product-form-component');
      let productId = productFormComponent?.dataset?.productId;
      
      // If not found, check if we're in a quick-add modal context
      if (!productId) {
        const quickAddModal = document.querySelector('#quick-add-modal-content');
        if (quickAddModal) {
          productFormComponent = quickAddModal.querySelector('product-form-component');
          productId = productFormComponent?.dataset?.productId;
        }
      }
      
      if (!productId) {
        return;
      }
      
      // Read personalisation directly from form inputs (not from storage)
      const personalisation = {};
      
      // Read all personalisation fields from form
      const nameInput = targetForm.querySelector('input[name="properties[Name]"]');
      if (nameInput && nameInput.value.trim()) {
        personalisation.name = nameInput.value.trim();
      }
      
      const fontInput = targetForm.querySelector('input[name="properties[Text Font]"]:checked') || 
                        targetForm.querySelector('input[name="properties[Text Font]"]');
      if (fontInput && fontInput.value.trim()) {
        personalisation.font = fontInput.value.trim();
      }
      
      const colorInput = targetForm.querySelector('input[name="properties[Text Color]"]:checked') || 
                         targetForm.querySelector('input[name="properties[Text Color]"]');
      if (colorInput && colorInput.value.trim()) {
        personalisation.color = colorInput.value.trim();
      }
      
      const dobInput = targetForm.querySelector('input[name="properties[Date of Birth]"]');
      if (dobInput && dobInput.value.trim()) {
        personalisation.dob = dobInput.value.trim();
      }
      
      const schoolYearInput = targetForm.querySelector('input[name="properties[School Year]"]');
      if (schoolYearInput && schoolYearInput.value.trim()) {
        personalisation.schoolYear = schoolYearInput.value.trim();
      }
      
      const name1Input = targetForm.querySelector('input[name="properties[Name 1]"]');
      if (name1Input && name1Input.value.trim()) {
        personalisation.name1 = name1Input.value.trim();
      }
      
      const name2Input = targetForm.querySelector('input[name="properties[Name 2]"]');
      if (name2Input && name2Input.value.trim()) {
        personalisation.name2 = name2Input.value.trim();
      }
      
      const name3Input = targetForm.querySelector('input[name="properties[Name 3]"]');
      if (name3Input && name3Input.value.trim()) {
        personalisation.name3 = name3Input.value.trim();
      }
      
      const name4Input = targetForm.querySelector('input[name="properties[Name 4]"]');
      if (name4Input && name4Input.value.trim()) {
        personalisation.name4 = name4Input.value.trim();
      }
      
      const textboxInput = targetForm.querySelector('textarea[name="properties[Personalisation:]"]');
      if (textboxInput && textboxInput.value.trim()) {
        personalisation.textbox = textboxInput.value.trim();
      }
      
      const messageInput = targetForm.querySelector('textarea[name="properties[Message]"]');
      if (messageInput && messageInput.value.trim()) {
        personalisation.message = messageInput.value.trim();
      }
      
      const optionalDobInput = targetForm.querySelector('input[name="properties[Personalise Date of Birth]"]');
      if (optionalDobInput && optionalDobInput.value.trim()) {
        personalisation.optionalDob = optionalDobInput.value.trim();
      }
      
      const timeInput = targetForm.querySelector('input[name="properties[Time]"]');
      if (timeInput && timeInput.value.trim()) {
        personalisation.time = timeInput.value.trim();
      }
      
      const weightInput = targetForm.querySelector('input[name="properties[Weight]"]');
      if (weightInput && weightInput.value.trim()) {
        personalisation.weight = weightInput.value.trim();
      }
      
      const babyNameInput = targetForm.querySelector('input[name="properties[Baby\'s Name]"]');
      if (babyNameInput && babyNameInput.value.trim()) {
        personalisation.babyName = babyNameInput.value.trim();
      }
      
      const kidNameInput = targetForm.querySelector('input[name="properties[Kid\'s Name]"]');
      if (kidNameInput && kidNameInput.value.trim()) {
        personalisation.kidName = kidNameInput.value.trim();
      }
      
      const mumNameInput = targetForm.querySelector('input[name="properties[Mum\'s Name]"]');
      if (mumNameInput && mumNameInput.value.trim()) {
        personalisation.mumName = mumNameInput.value.trim();
      }
      
      // Check if we have any personalisation data from form inputs
      let hasPersonalisation = Object.keys(personalisation).length > 0;
      
      // ALWAYS check window.currentPersonalisation as the source of truth
      // This ensures we have the data even if inputs were removed
      let savedPersonalisation = null;
      
      // Try to get personalisation by product ID first
      if (window.currentPersonalisation && productId && window.currentPersonalisation[productId]) {
        savedPersonalisation = { ...window.currentPersonalisation[productId] };
      } else if (window.currentPersonalisation?._latest) {
        // Fallback to latest
        savedPersonalisation = { ...window.currentPersonalisation._latest };
      } else if (window.currentPersonalisation && typeof window.currentPersonalisation === 'object' && !Array.isArray(window.currentPersonalisation)) {
        // Check if it's a direct object (old format)
        const hasProductKeys = Object.keys(window.currentPersonalisation).some(key => key.startsWith('_') || /^\d+$/.test(key));
        if (!hasProductKeys) {
          savedPersonalisation = { ...window.currentPersonalisation };
        }
      }
      
      if (savedPersonalisation) {
        // Filter out null/empty values and internal keys
        Object.keys(savedPersonalisation).forEach(key => {
          if (key.startsWith('_') || 
              !savedPersonalisation[key] || 
              (typeof savedPersonalisation[key] === 'string' && !savedPersonalisation[key].trim())) {
            delete savedPersonalisation[key];
          }
        });
        // Merge with form inputs (form inputs take precedence if they exist)
        Object.assign(personalisation, savedPersonalisation);
        hasPersonalisation = Object.keys(personalisation).length > 0;
      } else {
      }
      
      if (!hasPersonalisation) {
        return;
      }
      
      try {
        
        // Remove existing personalisation properties fields (but keep gift message and other non-personalisation properties)
        const existingProps = targetForm.querySelectorAll('input[name^="properties["], textarea[name^="properties["]');
        let removedCount = 0;
        existingProps.forEach(input => {
          const name = input.name;
          // Only remove personalisation-related properties, not gift message or other properties
          // Check for exact matches or specific patterns - be very specific to avoid removing Gift Message
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
            removedCount++;
            console.log('Removed personalisation input:', name);
          }
        });
        
        // Re-add all personalisation properties directly to the form
        const addProperty = (name, value) => {
          if (value && value.toString().trim() !== '') {
            // Remove any existing input with this exact name first
            const existing = targetForm.querySelector(`input[name="${name}"], textarea[name="${name}"]`);
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
            console.log('Added personalisation property to form:', name, '=', input.value);
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
        
        // Verify inputs are in the form
        const verifyInputs = targetForm.querySelectorAll('input[name^="properties["]');
        const personalisationInputs = Array.from(verifyInputs).filter(input => {
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
        
        console.log('Successfully added all personalisation fields to form before submit');
        console.log('Verification: Found', personalisationInputs.length, 'personalisation inputs in form after adding');
        personalisationInputs.forEach(input => {
          console.log('  - Personalisation input:', input.name, '=', input.value);
        });
        
        if (personalisationInputs.length === 0) {
          console.error('ERROR: No personalisation inputs found in form after adding!');
        }
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
      if (originalHandleSubmit && !productFormComponent._personalisationHandleSubmitWrapped) {
        productFormComponent._personalisationHandleSubmitWrapped = true;
        productFormComponent.handleSubmit = function(event) {
          console.log('ProductFormComponent handleSubmit called, adding personalisation fields');
          // Add fields BEFORE calling original handleSubmit (which creates FormData)
          if (this._addPersonalisationFields && this._personalisationForm) {
            this._addPersonalisationFields(this._personalisationForm);
            
            // Double-check that inputs are in the form before creating FormData
            const checkInputs = this._personalisationForm.querySelectorAll('input[name^="properties["]');
            console.log('Before FormData creation: Found', checkInputs.length, 'property inputs');
          }
          return originalHandleSubmit.call(this, event);
        };
      }
    }
    
    // Also listen for clicks on add-to-cart buttons as an additional safety measure
    const addToCartButtons = form.querySelectorAll('button[type="submit"], add-to-cart-component button, .add-to-cart-button');
    addToCartButtons.forEach(button => {
      button.addEventListener('click', () => {
        addPersonalisationFieldsToForm(form);
      }, { capture: true });
    });
  }
}

customElements.define('personalise-dialog', PersonaliseDialogComponent);

