import { DialogComponent, DialogOpenEvent, DialogCloseEvent } from '@theme/dialog';
import { Component } from '@theme/component';

/**
 * A custom element that manages the personalisation modal for Build Your Set.
 * This is a simplified version that works independently with product data from session storage.
 *
 * @extends DialogComponent
 */
export class BuildYourSetPersonaliseDialogComponent extends DialogComponent {
  requiredRefs = ['dialog', 'saveButton', 'closeButton', 'cancelButton', 'formContainer'];

  connectedCallback() {
    super.connectedCallback();
    this.productData = null;
    this.productIndex = null;
    this.personalisationData = {};
    this.isAllProductsMode = false;
    this.allProducts = [];
    this.unionTags = [];
    this._savedScrollPosition = 0; // Store scroll position before opening modal
  }

  /**
   * Opens the modal for personalizing all products at once
   * @param {Array} products - Array of all products that need personalization
   * @param {Array} unionTags - Union of all product tags
   */
  async openForAllProducts(products, unionTags) {
    if (!products || products.length === 0) {
      return;
    }

    this.isAllProductsMode = true;
    this.allProducts = products;
    this.unionTags = unionTags || [];
    this.productData = null; // Not a single product
    this.productIndex = null; // Not a single product index

    // Collect existing personalizations from all products (merge common values)
    this.personalisationData = {};
    products.forEach(product => {
      if (product.personalizations) {
        Object.keys(product.personalizations).forEach(key => {
          const value = product.personalizations[key];
          // If multiple products have the same value, use it; otherwise keep first non-empty
          if (value && value.toString().trim()) {
            if (!this.personalisationData[key] || this.personalisationData[key] === value) {
              this.personalisationData[key] = value;
            }
          }
        });
      }
    });

    // Remove hidden attribute from parent element
    if (this.hasAttribute('hidden')) {
      this.removeAttribute('hidden');
    }

    // Ensure refs are available
    if (!this.refs) {
      setTimeout(() => this.openForAllProducts(products, unionTags), 100);
      return;
    }

    // Set a generic title/image for "all products" mode
    if (this.refs.productImage) {
      this.refs.productImage.style.display = 'none';
      if (this.refs.productPlaceholder && this.refs.productTitle) {
        this.refs.productTitle.textContent = `Personalise All Products (${products.length} items)`;
        this.refs.productPlaceholder.style.display = 'flex';
      }
    }

    // Open the dialog first for immediate visual feedback
    this.showDialog();
    
    // Generate form fields based on union tags
    requestAnimationFrame(() => {
      if (this.unionTags && this.unionTags.length > 0) {
        this.generateFormFieldsFromTags(this.unionTags, []);
      } else {
        this.refs.formContainer.innerHTML = '<p>No personalization options available for these products.</p>';
      }
    });
  }

  async openWithProduct(productData, index) {
    if (!productData) {
      return;
    }
    
    this.isAllProductsMode = false;
    this.allProducts = [];
    this.unionTags = [];
    this.productData = productData;
    this.productIndex = index;
    
    // Remove hidden attribute from parent element
    if (this.hasAttribute('hidden')) {
      this.removeAttribute('hidden');
    }
    
    // Ensure refs are available
    if (!this.refs) {
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

    // Open the dialog first for immediate visual feedback
    this.showDialog();
    
    // Generate form fields asynchronously to avoid blocking UI
    requestAnimationFrame(() => {
      // Use product tags from session (should already be saved)
      const productTags = productData.product_tags;

      // Generate form fields based on product tags (same logic as original modal)
      // If we have tags, use tag-based generation, otherwise fall back to personalization_fields
      if (productTags && productTags.length > 0) {
        this.generateFormFieldsFromTags(productTags, productData.personalization_fields || []);
      } else if (productData.personalization_fields && productData.personalization_fields.length > 0) {
        // Fallback to personalization_fields if no tags
        this.generateFormFields(productData.personalization_fields);
      } else {
        this.refs.formContainer.innerHTML = '<p>No personalization options available for this product.</p>';
      }
    });
  }

  /**
   * Generates form fields based on product tags (same logic as original personalise-modal.liquid)
   * @param {Array} tags - Array of product tags
   * @param {Array} collectedFields - Previously collected fields for reference
   */
  generateFormFieldsFromTags(tags, collectedFields) {
    if (!this.refs.formContainer) return;

    // Clear existing fields
    this.refs.formContainer.innerHTML = '';

    // Use exact tag matching - be strict about which tags exist
    const tagsLowercase = tags.map(t => String(t).toLowerCase().trim());
    const hasTag = (tagPattern) => {
      const patternLower = String(tagPattern).toLowerCase().trim();
      // Check for exact match first, then check if tag starts with pattern (for tags like color_red, font_arial)
      return tagsLowercase.some(t => {
        if (t === patternLower) return true;
        // For patterns like "personalized_textcolor", also check if tag starts with it
        if (patternLower.includes('_') && t.startsWith(patternLower + '_')) return true;
        return false;
      });
    };
    
    // Determine field flags (same logic as original modal)
    // Note: show_personalized is only used as a general flag, not to show specific fields
    const show_personalized = hasTag('cust_personalized');
    const personalized_name = hasTag('personalized_name');
    const personalized_textcolour = hasTag('personalized_textcolor');
    const personalized_dob = hasTag('personalized_dob');
    const personalized_textbox = hasTag('personalise_textbox');
    const has_baby_name = tagsLowercase.includes('baby_name');
    const has_kid_name = tagsLowercase.includes('kid_name');
    const has_mum_name = tagsLowercase.includes('mum_name');
    const show_name_tabs = has_baby_name || has_kid_name || has_mum_name;
    
    // Determine max length
    let dynamic_max = 9;
    if (tagsLowercase.includes('personalise_5')) dynamic_max = 5;
    else if (tagsLowercase.includes('personalise_7')) dynamic_max = 7;
    else if (tagsLowercase.includes('personalise_9')) dynamic_max = 9;
    
    const font_family_feild = tagsLowercase.some(t => t.includes('font_'));
    const has_school_year = hasTag('school_year');
    const has_name1 = hasTag('name1');
    const has_name2 = hasTag('name2');
    const has_name3 = hasTag('name3');
    const has_name4 = hasTag('name4');
    const has_optional_fields = tagsLowercase.includes('optional_fields');
    const has_create_20 = tagsLowercase.includes('create_20');
    
    // Generate fields based on tags (same order as original modal)
    let fieldsHTML = '';
    
    // Name tabs (Baby/Kid/Mum)
    if (show_name_tabs) {
      fieldsHTML += `
        <p class="personalise-modal__instructions">
          Maximum 9 characters. No special characters.
        </p>
        <div class="personalise-name-tabs" data-name-tabs>
          <div class="personalise-name-tabs__tablist" role="tablist">
            ${has_baby_name ? `
              <button type="button" role="tab" class="personalise-name-tabs__tab is-active" aria-selected="true" data-tab="baby">
                <span class="personalise-name-tabs__tab-text">Baby</span>
              </button>
            ` : ''}
            ${has_kid_name ? `
              <button type="button" role="tab" class="personalise-name-tabs__tab ${!has_baby_name ? 'is-active' : ''}" aria-selected="${!has_baby_name}" data-tab="kid">
                <span class="personalise-name-tabs__tab-text">Kid</span>
              </button>
            ` : ''}
            ${has_mum_name ? `
              <button type="button" role="tab" class="personalise-name-tabs__tab ${!has_baby_name && !has_kid_name ? 'is-active' : ''}" aria-selected="${!has_baby_name && !has_kid_name}" data-tab="mum">
                <span class="personalise-name-tabs__tab-text">Mum</span>
              </button>
            ` : ''}
          </div>
          <div class="personalise-name-tabs__panels">
            ${has_baby_name ? `
              <div role="tabpanel" class="personalise-name-tabs__panel is-active" data-panel="baby">
                <h3 class="personalise-name-tabs__panel-title">Baby's Name (Free Personalisation)</h3>
                <div class="personalise-name-tabs__input-wrapper">
                  <input type="text" class="personalise-name-tabs__input" name="properties[Baby's Name]" placeholder="Enter the Name or Initials" maxlength="9" data-field-name="properties[Baby's Name]" value="${this.personalisationData["properties[Baby's Name]"] || ''}" />
                  <span class="personalise-name-tabs__counter"><span data-count="baby">${(this.personalisationData["properties[Baby's Name]"] || '').length}</span>/9</span>
                </div>
              </div>
            ` : ''}
            ${has_kid_name ? `
              <div role="tabpanel" class="personalise-name-tabs__panel ${!has_baby_name ? 'is-active' : ''}" data-panel="kid">
                <h3 class="personalise-name-tabs__panel-title">Kid's Name (Free Personalisation)</h3>
                <div class="personalise-name-tabs__input-wrapper">
                  <input type="text" class="personalise-name-tabs__input" name="properties[Kid's Name]" placeholder="Enter the Name or Initials" maxlength="9" data-field-name="properties[Kid's Name]" value="${this.personalisationData["properties[Kid's Name]"] || ''}" />
                  <span class="personalise-name-tabs__counter"><span data-count="kid">${(this.personalisationData["properties[Kid's Name]"] || '').length}</span>/9</span>
                </div>
              </div>
            ` : ''}
            ${has_mum_name ? `
              <div role="tabpanel" class="personalise-name-tabs__panel ${!has_baby_name && !has_kid_name ? 'is-active' : ''}" data-panel="mum">
                <h3 class="personalise-name-tabs__panel-title">Mum's Name (Free Personalisation)</h3>
                <div class="personalise-name-tabs__input-wrapper">
                  <input type="text" class="personalise-name-tabs__input" name="properties[Mum's Name]" placeholder="Enter the Name or Initials" maxlength="9" data-field-name="properties[Mum's Name]" value="${this.personalisationData["properties[Mum's Name]"] || ''}" />
                  <span class="personalise-name-tabs__counter"><span data-count="mum">${(this.personalisationData["properties[Mum's Name]"] || '').length}</span>/9</span>
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }
    
    // Regular name field (only if personalized_name or personalized_textbox tag exists, and not using tabs)
    // Don't use show_personalized (cust_personalized) alone - it's too general
    if ((personalized_name || personalized_textbox) && !show_name_tabs) {
      fieldsHTML += `
        <p class="personalise-modal__instructions">
          Maximum ${dynamic_max} characters. No special characters.
        </p>
        <div class="personalise-modal__field">
          <label for="build-your-set-personalise-name" class="personalise-modal__label">
            Name (Free Personlisation)
          </label>
          <div class="personalise-modal__input-wrapper">
            <input
              type="text"
              id="build-your-set-personalise-name"
              name="personalise-name"
              class="personalise-modal__input"
              placeholder="Enter the Name or Initials"
              maxlength="${dynamic_max}"
              value="${this.personalisationData['personalise-name'] || ''}"
              data-field-name="personalise-name"
            />
            <span class="personalise-modal__counter" data-counter="personalise-name">
              <span data-count="personalise-name">${(this.personalisationData['personalise-name'] || '').length}</span>/${dynamic_max}
            </span>
          </div>
        </div>
      `;
    }
    
    // Color selection
    if (personalized_textcolour) {
      const colorOptions = [];
      tags.forEach(tag => {
        if (tag.toLowerCase().includes('color_')) {
          const colorParts = tag.split('_');
          if (colorParts.length > 1) {
            const colorValue = colorParts.slice(1).join('_');
            colorOptions.push({
              value: colorValue,
              label: colorValue.charAt(0).toUpperCase() + colorValue.slice(1),
              display: colorValue.toLowerCase()
            });
          }
        }
      });
      
      if (colorOptions.length > 0) {
        const colorHTML = colorOptions.map((option, idx) => {
          const checked = this.personalisationData['personalise-color'] === option.value ? 'checked' : '';
          return `
            <label
              class="personalise-modal__color-button variant-option__button-label variant-option__button-label--image-thumbnail"
              data-color="${option.value}"
              title="${option.label}"
            >
              <input
                type="radio"
                name="personalise-color"
                value="${option.value}"
                data-field-name="personalise-color"
                ${checked}
                required
              >
              <div class="variant-option__image-thumbnail">
                <span
                  class="swatch swatch--unscaled"
                  style="--swatch-background: ${option.display}; background-color: ${option.display};"
                ></span>
              </div>
            </label>
          `;
        }).join('');
        
        fieldsHTML += `
          <div class="personalise-modal__field">
            <label class="personalise-modal__label">Text Colour <span style="color: red;">*</span></label>
            <div class="personalise-modal__color-grid variant-option--image-thumbnails">
              ${colorHTML}
            </div>
          </div>
        `;
      }
    }
    
    // Font selection
    if (font_family_feild) {
      const fontOptions = [];
      const fontTagMap = {
        'font_rockwell-condensed': 'Rockwell Condensed',
        'font_ariel': 'Ariel round',
        'font_monotype-corsiva': 'Monotype Corsiva',
        'font_coronation': 'Coronation',
        'font_ballantines': 'Ballantines',
        'font_jester': 'Jester',
        'font_miss-neally': 'Miss Neally',
        'font_castle': 'Castle',
        'font_london': 'London',
        'font_garamond': 'Garamond',
        'font_comic-sans': 'Comic Sans',
        'font_amsterdam': 'Amsterdam',
        'font_black_jack': 'Black Jack',
        'font_rochester': 'Rochester',
        'font_poppins': 'Poppins',
        'font_playfair-display': 'Playfair Display',
        'font_playball': 'Playball',
        'font_roboto-serif': 'Roboto Serif',
        'font_helvetica': 'Helvetica'
      };
      
      tags.forEach(tag => {
        const tagLower = tag.toLowerCase();
        if (fontTagMap[tagLower]) {
          fontOptions.push({
            value: fontTagMap[tagLower],
            label: fontTagMap[tagLower],
            display: fontTagMap[tagLower]
          });
        }
      });
      
      if (fontOptions.length > 0) {
        const fontHTML = fontOptions.map(option => {
          const isSelected = this.personalisationData['personalise-font'] === option.value;
          const selectedClass = isSelected ? 'personalise-modal__font-button--selected' : '';
          return `
            <button type="button" class="personalise-modal__font-button ${selectedClass}" data-font="${option.value}" data-field-name="personalise-font" data-field-value="${option.value}">
              <span style="font-family: ${option.value};">${option.display}</span>
            </button>
          `;
        }).join('');
        
        fieldsHTML += `
          <div class="personalise-modal__field">
            <label class="personalise-modal__label">Choose Your Font <span style="color: red;">*</span></label>
            <div class="personalise-modal__font-grid personalise-modal__input-wrapper">
              ${fontHTML}
            </div>
            <input type="hidden" name="personalise-font" data-field-name="personalise-font" value="${this.personalisationData['personalise-font'] || ''}" required />
          </div>
        `;
      }
    }
    
    // School Year
    if (has_school_year) {
      fieldsHTML += `
        <div class="personalise-modal__field">
          <label class="personalise-modal__label">School Year</label>
          <input type="text" class="personalise-modal__input" name="properties[School Year]" maxlength="20" data-field-name="properties[School Year]" value="${this.personalisationData['properties[School Year]'] || ''}" />
        </div>
      `;
    }
    
    // Name 1-4
    if (has_name1) {
      fieldsHTML += `
        <div class="personalise-modal__field">
          <label class="personalise-modal__label">Name 1</label>
          <input type="text" class="personalise-modal__input" name="properties[Name 1]" maxlength="8" data-field-name="properties[Name 1]" value="${this.personalisationData['properties[Name 1]'] || ''}" />
          <p class="personalise-modal__info-text">English or Arabic. Maximum 8 characters.*</p>
        </div>
      `;
    }
    if (has_name2) {
      fieldsHTML += `
        <div class="personalise-modal__field">
          <label class="personalise-modal__label">Name 2</label>
          <input type="text" class="personalise-modal__input" name="properties[Name 2]" maxlength="8" data-field-name="properties[Name 2]" value="${this.personalisationData['properties[Name 2]'] || ''}" />
          <p class="personalise-modal__info-text">English or Arabic. Maximum 8 characters.*</p>
        </div>
      `;
    }
    if (has_name3) {
      fieldsHTML += `
        <div class="personalise-modal__field">
          <label class="personalise-modal__label">Name 3</label>
          <input type="text" class="personalise-modal__input" name="properties[Name 3]" maxlength="8" data-field-name="properties[Name 3]" value="${this.personalisationData['properties[Name 3]'] || ''}" />
          <p class="personalise-modal__info-text">English or Arabic. Maximum 8 characters.</p>
        </div>
      `;
    }
    if (has_name4) {
      fieldsHTML += `
        <div class="personalise-modal__field">
          <label class="personalise-modal__label">Name 4</label>
          <input type="text" class="personalise-modal__input" name="properties[Name 4]" maxlength="8" data-field-name="properties[Name 4]" value="${this.personalisationData['properties[Name 4]'] || ''}" />
          <p class="personalise-modal__info-text">English or Arabic. Maximum 8 characters.*</p>
        </div>
      `;
    }
    
    // Date of Birth
    if (personalized_dob) {
      fieldsHTML += `
        <div class="personalise-modal__field">
          <label class="personalise-modal__label">Date of Birth + AED 10 (optional)</label>
          <input type="text" class="personalise-modal__input" name="properties[Date of Birth]" placeholder="dd-mm-yyyy" pattern="\\d{2}-\\d{2}-\\d{4}" data-field-name="properties[Date of Birth]" value="${this.personalisationData['properties[Date of Birth]'] || ''}" />
        </div>
      `;
    }
    
    // Optional fields (DOB, Time, Weight)
    if (has_optional_fields) {
      fieldsHTML += `
        <div class="personalise-modal__field">
          <label class="personalise-modal__label">Date of Birth (optional)</label>
          <input type="date" class="personalise-modal__input" name="optionalDob" data-field-name="optionalDob" value="${this.personalisationData['optionalDob'] || ''}" />
        </div>
        <div class="personalise-modal__field">
          <label class="personalise-modal__label">Time of Birth (optional)</label>
          <input type="text" class="personalise-modal__input" name="properties[Time]" placeholder="HH:MM AM/PM" data-field-name="properties[Time]" value="${this.personalisationData['properties[Time]'] || ''}" />
        </div>
        <div class="personalise-modal__field">
          <label class="personalise-modal__label">Weight (kg) (optional)</label>
          <input type="text" class="personalise-modal__input" name="properties[Weight]" data-field-name="properties[Weight]" value="${this.personalisationData['properties[Weight]'] || ''}" />
        </div>
      `;
    }
    
    // Textbox
    if (personalized_textbox) {
      fieldsHTML += `
        <div class="personalise-modal__field">
          <label class="personalise-modal__label">Enter the names here:</label>
          <textarea class="personalise-modal__input personalise-modal__input--textarea" name="properties[Personalisation:]" placeholder="(e.g. Sarah,Jane,Robert)" maxlength="500" rows="3" data-field-name="properties[Personalisation:]">${this.personalisationData['properties[Personalisation:]'] || ''}</textarea>
        </div>
      `;
    }
    
    // Message (create_20)
    if (has_create_20) {
      fieldsHTML += `
        <div class="personalise-modal__field">
          <label class="personalise-modal__label">Enter the text here:</label>
          <textarea class="personalise-modal__input personalise-modal__input--textarea" name="properties[Message]" maxlength="50" rows="3" data-field-name="properties[Message]">${this.personalisationData['properties[Message]'] || ''}</textarea>
        </div>
      `;
    }
    
    // Don't fallback to collectedFields - they might contain incorrect data
    // Only use tags to determine which fields to show
    if (!fieldsHTML) {
      this.refs.formContainer.innerHTML = '<p>No personalization options available for this product.</p>';
      return;
    }
    
    // Use requestAnimationFrame for smooth DOM updates
    requestAnimationFrame(() => {
      this.refs.formContainer.innerHTML = fieldsHTML;
      
      // Set up event listeners in next frame to avoid blocking
      requestAnimationFrame(() => {
        this.setupCharacterCounters();
        this.setupFontButtons();
        this.setupColorButtons();
        this.setupNameTabs();
      });
    });
  }

  /**
   * Sets up name tabs functionality
   */
  setupNameTabs() {
    const tabButtons = this.refs.formContainer.querySelectorAll('.personalise-name-tabs__tab');
    const tabPanels = this.refs.formContainer.querySelectorAll('.personalise-name-tabs__panel');
    
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const tabName = button.dataset.tab;
        
        // Update active states
        tabButtons.forEach(btn => {
          btn.classList.remove('is-active');
          btn.setAttribute('aria-selected', 'false');
        });
        button.classList.add('is-active');
        button.setAttribute('aria-selected', 'true');
        
        tabPanels.forEach(panel => {
          panel.classList.remove('is-active');
        });
        const activePanel = this.refs.formContainer.querySelector(`.personalise-name-tabs__panel[data-panel="${tabName}"]`);
        if (activePanel) {
          activePanel.classList.add('is-active');
        }
      });
    });
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
                rows="${field.rows || 3}"
                data-field-name="${fieldName}"
                ${required ? 'required' : ''}
              >${this.personalisationData[fieldName] || ''}</textarea>
              <span class="personalise-modal__counter" data-counter="${fieldName}">
                <span data-count="${fieldName}">${(this.personalisationData[fieldName] || '').length}</span>/${maxLength}
              </span>
            </div>
          </div>
        `;
      } else if (fieldType === 'date') {
        // Date input field
        fieldHTML = `
          <div class="personalise-modal__field">
            <label for="build-your-set-${fieldName}" class="personalise-modal__label">
              ${fieldLabel}${required ? ' <span style="color: red;">*</span>' : ''}
            </label>
            <div class="personalise-modal__input-wrapper">
              <input
                type="date"
                id="build-your-set-${fieldName}"
                name="${fieldName}"
                class="personalise-modal__input"
                value="${this.personalisationData[fieldName] || ''}"
                data-field-name="${fieldName}"
                ${field.pattern ? `pattern="${field.pattern}"` : ''}
                ${required ? 'required' : ''}
              />
            </div>
          </div>
        `;
      } else if (fieldType === 'radio' && field.options) {
        // Radio button group (for color selection)
        const radioHTML = field.options.map((option, optIndex) => {
          const optionValue = typeof option === 'string' ? option : option.value;
          const optionLabel = typeof option === 'string' ? option : (option.label || optionValue);
          const checked = this.personalisationData[fieldName] === optionValue ? 'checked' : '';
          const radioId = `build-your-set-${fieldName}-${optIndex}`;
          
          return `
            <label class="personalise-modal__color-button" data-color="${optionValue}" title="${optionLabel}">
              <input
                type="radio"
                id="${radioId}"
                name="${fieldName}"
                value="${optionValue}"
                data-field-name="${fieldName}"
                ${checked}
                ${required ? 'required' : ''}
              />
              ${option.display ? `<span class="swatch" style="background-color: ${option.display}"></span>` : ''}
              <span>${optionLabel}</span>
            </label>
          `;
        }).join('');

        fieldHTML = `
          <div class="personalise-modal__field">
            <label class="personalise-modal__label">
              ${fieldLabel}${required ? ' <span style="color: red;">*</span>' : ''}
            </label>
            <div class="personalise-modal__color-grid personalise-modal__input-wrapper">
              ${radioHTML}
            </div>
          </div>
        `;
      } else if (fieldType === 'select' && field.options && field.field_type === 'font') {
        // Font buttons (for font selection - rendered as buttons, not select)
        const fontButtonsHTML = field.options.map((option, optIndex) => {
          const optionValue = typeof option === 'string' ? option : option.value;
          const optionLabel = typeof option === 'string' ? option : (option.label || optionValue);
          const optionDisplay = typeof option === 'string' ? option : (option.display || optionLabel);
          const isSelected = this.personalisationData[fieldName] === optionValue;
          const selectedClass = isSelected ? 'personalise-modal__font-button--selected' : '';
          
          return `
            <button
              type="button"
              class="personalise-modal__font-button ${selectedClass}"
              data-font="${optionValue}"
              data-field-name="${fieldName}"
              data-field-value="${optionValue}"
            >
              <span style="font-family: ${optionValue};">${optionDisplay}</span>
            </button>
          `;
        }).join('');

        fieldHTML = `
          <div class="personalise-modal__field">
            <label class="personalise-modal__label">
              ${fieldLabel}${required ? ' <span style="color: red;">*</span>' : ''}
            </label>
            <div class="personalise-modal__font-grid personalise-modal__input-wrapper">
              ${fontButtonsHTML}
            </div>
            <input
              type="hidden"
              name="${fieldName}"
              data-field-name="${fieldName}"
              value="${this.personalisationData[fieldName] || ''}"
              ${required ? 'required' : ''}
            />
          </div>
        `;
      } else if (fieldType === 'select' && field.options) {
        // Select dropdown (for other select fields)
        const optionsHTML = field.options.map(option => {
          const optionValue = typeof option === 'string' ? option : option.value;
          const optionLabel = typeof option === 'string' ? option : (option.label || optionValue);
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
    
    // Set up event listeners for font buttons
    this.setupFontButtons();
    
    // Set up event listeners for color radio buttons
    this.setupColorButtons();
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
   * Sets up click handlers for font buttons
   */
  setupFontButtons() {
    const fontButtons = this.refs.formContainer.querySelectorAll('.personalise-modal__font-button');
    fontButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const fieldName = button.dataset.fieldName;
        const fieldValue = button.dataset.fieldValue;
        const hiddenInput = this.refs.formContainer.querySelector(`input[type="hidden"][data-field-name="${fieldName}"]`);
        
        if (hiddenInput) {
          hiddenInput.value = fieldValue;
        }
        
        // Update visual selection
        const allButtons = this.refs.formContainer.querySelectorAll(`.personalise-modal__font-button[data-field-name="${fieldName}"]`);
        allButtons.forEach(btn => {
          btn.classList.remove('personalise-modal__font-button--selected');
        });
        button.classList.add('personalise-modal__font-button--selected');
      });
    });
  }
  
  /**
   * Sets up change handlers for color radio buttons
   */
  setupColorButtons() {
    const colorRadios = this.refs.formContainer.querySelectorAll('.personalise-modal__color-button input[type="radio"]');
    colorRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        // Visual selection is handled by CSS :has() selector
      });
    });
  }

  /**
   * Collects personalization data from form fields
   * @returns {Object} Personalization data object
   */
  collectPersonalisationData() {
    const data = {};
    // Collect from all inputs, textareas, selects, and hidden inputs (for font buttons)
    const inputs = this.refs.formContainer.querySelectorAll('input, textarea, select');
    
    inputs.forEach(input => {
      // Skip radio buttons that aren't checked
      if (input.type === 'radio' && !input.checked) {
        return;
      }
      
      const fieldName = input.dataset.fieldName || input.name;
      if (fieldName && input.value && input.value.trim()) {
        data[fieldName] = input.value.trim();
      }
    });

    return data;
  }

  /**
   * Handles save button click
   */
  handleSave() {
    // Collect personalization data
    const personalisations = this.collectPersonalisationData();

    if (this.isAllProductsMode) {
      // Save personalizations to all products that support the fields
      const sessionCart = this.getSessionCart();
      if (!sessionCart) {
        return;
      }

      // Apply personalizations to each product based on its tags
      let updated = false;
      this.allProducts.forEach(product => {
        // Find the product in session cart by variant_id
        const productIndex = sessionCart.findIndex(item => item.variant_id === product.variant_id);
        if (productIndex >= 0) {
          // Only apply personalizations that are relevant to this product's tags
          const productPersonalizations = {};
          const productTags = product.product_tags || [];
          const tagsLowercase = productTags.map(t => String(t).toLowerCase());

          // Check each personalization field and see if this product supports it
          Object.keys(personalisations).forEach(key => {
            const value = personalisations[key];
            if (value && value.toString().trim()) {
              // Determine if this field is relevant to this product
              let isRelevant = false;

              // Name field
              if (key === 'personalise-name' && (tagsLowercase.includes('personalized_name') || tagsLowercase.includes('cust_personalized'))) {
                isRelevant = true;
              }
              // Color field
              else if (key === 'personalise-color' && tagsLowercase.some(t => t.includes('personalized_textcolor'))) {
                isRelevant = true;
              }
              // Font field
              else if (key === 'personalise-font' && tagsLowercase.some(t => t.includes('font_'))) {
                isRelevant = true;
              }
              // Date of Birth
              else if (key === 'properties[Date of Birth]' && tagsLowercase.some(t => t.includes('personalized_dob'))) {
                isRelevant = true;
              }
              // Textbox
              else if (key === 'properties[Personalisation:]' && tagsLowercase.some(t => t.includes('personalise_textbox'))) {
                isRelevant = true;
              }
              // Baby/Kid/Mum names
              else if (key === "properties[Baby's Name]" && tagsLowercase.includes('baby_name')) {
                isRelevant = true;
              }
              else if (key === "properties[Kid's Name]" && tagsLowercase.includes('kid_name')) {
                isRelevant = true;
              }
              else if (key === "properties[Mum's Name]" && tagsLowercase.includes('mum_name')) {
                isRelevant = true;
              }
              // Name 1-4
              else if (key === 'properties[Name 1]' && tagsLowercase.includes('name1')) {
                isRelevant = true;
              }
              else if (key === 'properties[Name 2]' && tagsLowercase.includes('name2')) {
                isRelevant = true;
              }
              else if (key === 'properties[Name 3]' && tagsLowercase.includes('name3')) {
                isRelevant = true;
              }
              else if (key === 'properties[Name 4]' && tagsLowercase.includes('name4')) {
                isRelevant = true;
              }
              // School Year
              else if (key === 'properties[School Year]' && tagsLowercase.includes('school_year')) {
                isRelevant = true;
              }
              // Message
              else if (key === 'properties[Message]' && tagsLowercase.includes('create_20')) {
                isRelevant = true;
              }
              // Optional fields
              else if ((key === 'optionalDob' || key === 'properties[Time]' || key === 'properties[Weight]') && tagsLowercase.includes('optional_fields')) {
                isRelevant = true;
              }

              if (isRelevant) {
                productPersonalizations[key] = value;
              }
            }
          });

          // Update product personalizations
          if (Object.keys(productPersonalizations).length > 0) {
            sessionCart[productIndex].personalizations = {
              ...(sessionCart[productIndex].personalizations || {}),
              ...productPersonalizations
            };
            updated = true;
          }
        }
      });

      if (updated) {
        try {
          sessionStorage.setItem('build-your-set-session-cart', JSON.stringify(sessionCart));
          
          // Dispatch event to update sticky bar
          document.dispatchEvent(new CustomEvent('build-your-set-updated', {
            bubbles: true,
            cancelable: true
          }));

          // Dispatch personalisation saved event for each product
          this.allProducts.forEach((product) => {
            document.dispatchEvent(new CustomEvent('personalisation-saved', {
              bubbles: true,
              cancelable: true
            }));
          });

          // Hide dialog
          this.hideDialog();
        } catch (error) {
          // Error saving personalizations
        }
      }
    } else {
      // Single product mode (existing behavior)
      if (!this.productData || this.productIndex === null) {
        return;
      }

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
          // Error saving personalization
        }
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
      return null;
    }
  }

  showDialog() {
    const { dialog } = this.refs;
    if (!dialog) {
      return;
    }
    
    if (dialog.open) {
      return;
    }

    // Remove hidden attribute from parent element to make it visible
    if (this.hasAttribute('hidden')) {
      this.removeAttribute('hidden');
    }
    
    // Ensure dialog element is visible
    if (dialog.style) {
      dialog.style.display = '';
      dialog.style.visibility = '';
      dialog.style.opacity = '';
    }

    // Save current scroll position before opening modal
    this._savedScrollPosition = window.scrollY || window.pageYOffset || 0;

    requestAnimationFrame(() => {
      try {
        document.body.style.width = '100%';
        document.body.style.position = 'fixed';
        document.body.style.top = `-${this._savedScrollPosition}px`;

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
            this.hideDialog();
          };
          if (this._closeHandler) {
            this.refs.closeButton.removeEventListener('click', this._closeHandler);
          }
          this._closeHandler = closeHandler;
          this.refs.closeButton.addEventListener('click', this._closeHandler);
        }
        
        // Set up cancel button handler
        if (this.refs.cancelButton) {
          const cancelHandler = () => {
            this.hideDialog();
          };
          if (this._cancelHandler) {
            this.refs.cancelButton.removeEventListener('click', this._cancelHandler);
          }
          this._cancelHandler = cancelHandler;
          this.refs.cancelButton.addEventListener('click', cancelHandler);
        }
      } catch (error) {
        // Error opening dialog
      }
    });
  }

  hideDialog() {
    const { dialog } = this.refs;
    if (!dialog || !dialog.open) return;

    // Restore scroll position smoothly without causing jump
    const savedScrollPosition = this._savedScrollPosition || 0;
    
    dialog.close();
    this.dispatchEvent(new DialogCloseEvent());

    // Restore body styles
    document.body.style.width = '';
    document.body.style.position = '';
    document.body.style.top = '';
    
    // Restore scroll position without animation to prevent visible scrolling
    requestAnimationFrame(() => {
      window.scrollTo({
        top: savedScrollPosition,
        behavior: 'instant' // Use 'instant' to prevent smooth scrolling
      });
    });
    
    // Add hidden attribute back to parent element
    this.setAttribute('hidden', '');
  }
}

customElements.define('build-your-set-personalise-dialog', BuildYourSetPersonaliseDialogComponent);
