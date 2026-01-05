# Gift Message and Gift Wrap System Reference

## Overview
This document provides comprehensive documentation for the gift message and gift wrap functionality implemented in the Shopify theme.

---

## 1. Gift Message System

### How Gift Message Works

Gift message is a separate field from personalization that allows customers to add a custom message to their order.

**Trigger:**
- Product must have the `gift_message` tag

**Display:**
- Appears as a text input field on the product page
- Field is required (marked with red asterisk)
- Located in the `gift_html` capture block, separate from personalization section

**Field Details:**
- **Property Name:** `properties[Gift Message]`
- **Type:** Text input
- **Max Length:** 300 characters
- **Label:** "Enter a gift message" (with required indicator)
- **Storage:** Saved as line item property (same mechanism as personalization)

**Code Location:** `sections/product-template.liquid` lines 42-47

**Example:**
```liquid
{%- if product.tags contains 'gift_message' -%}
  <div class="personalized_field_block">
    <label class="text_label">Enter a gift message<span style="color: red;">*</span></label>
    <input type="text" name="properties[Gift Message]" id="custm_name" maxlength="300" style="width: 100%;">
  </div>
{% endif %}
```

---

## 2. Gift Wrap Products System

The system supports two types of gift wrap products that can be added to cart alongside products.

### A. Regular Gift Wrap (`custom_gift_wrap`)

#### Product Configuration
- **Product Tag:** `custom_gift_wrap`
- **Product Handle:** `gift-wrap` (configured in settings)
- **Settings Location:** `config/settings_data.json` line 1903

#### How it Works

1. **Product Page Display:**
   - When a product has the `custom_gift_wrap` tag, a checkbox appears
   - Checkbox label shows: `{gift-wrap product title}(+{price})`
   - Example: "Gift Wrap (+AED 25.00)"

2. **Add to Cart Flow:**
   - When checkbox is checked and "Add to Cart" is clicked:
     - Gift wrap product is added to cart first via AJAX
     - Added with property: `_added_with_product: {original_product_id}`
     - Original product is then added to cart
     - Gift wrap appears in cart but is linked to the original product

3. **Code Flow:**
   - **Checkbox HTML:** `sections/product-template.liquid` lines 22-29
   - **JavaScript Handler:** `assets/theme.old.js` lines 6743-6786
   - **AJAX Call:** Adds gift wrap with `_added_with_product` property containing the original product ID

#### Cart Display Behavior
- Gift wrap items with `_added_with_product` property are hidden from cart display
- They are linked to the original product via the property value
- Hidden items use `ctm_hide` class and are not counted in cart item count
- **Code:** `sections/cart-template.liquid` lines 48-64

#### Implementation Details

**Product Page Checkbox:**
```liquid
{%- if product.tags contains 'custom_gift_wrap' -%}
  {%- assign gift_product = all_products['gift-wrap'] -%}
  <div class="add-gift-wrap">
    <div class="add-gift">
      <input type="checkbox" id="chkAddGift" class="chk_add_gift" 
             value="{{ gift_product.selected_or_first_available_variant.id }}" 
             data="{{ product.id }}">
      <label for="chkAddGift">
        <span class="gift-icon">{%- render 'icon-gift' -%}</span>
        <span class="lbl-text">{{ gift_product.title }}(+{{ gift_product.price | money }})</span>
      </label>
    </div>
  </div>
{% endif %}
```

**JavaScript Add to Cart Logic:**
```javascript
// From assets/theme.old.js lines 6743-6786
if($gift.length) {
  value = $gift.prop('value').trim();
  if($gift.is(':checked') && value != '') {
    evt.preventDefault();
    gift_checked = true;
    $form.append('<input type="hidden" name="properties[Add-On]" class="add_gift" value="'+$form.find('.add-gift label .lbl-text').text()+'" >');
    $.ajax({
      url: '/cart/add.js',
      type: 'post',
      dataType: 'json',
      data: {
        id: value,
        quantity: 1,
        properties: {
          '_added_with_product': $gift.attr('data')
        }
      },
      complete: function(data) {
        // Then add original product to cart
      }
    });
  }
}
```

---

### B. Christmas Gift Wrap (`christmas_gift`)

#### Product Configuration
- **Product Tag:** `christmas_gift`
- **Product Handle:** `christmas-gift-wrap` (configured in settings)
- **Settings Location:** `config/settings_data.json` line 1904

#### How it Works

1. **Product Page Display:**
   - Similar to regular gift wrap but for Christmas-themed wrapping
   - Checkbox appears when product has `christmas_gift` tag
   - Checkbox label shows: "Add {christmas-gift-wrap product title} ({price})"

2. **Add to Cart Flow:**
   - When checked:
     - Christmas gift wrap product is added via AJAX
     - Added with property: `_added_with_product: {product_id}`
     - Also adds property: `properties[Christmas Add-On]` to original product
     - Original product is then added to cart

3. **Code Flow:**
   - **Checkbox HTML:** `sections/product-template.liquid` lines 31-40
   - **JavaScript Handler:** `assets/theme.old.js` lines 6700-6741

#### Implementation Details

**Product Page Checkbox:**
```liquid
{% if product.tags contains 'christmas_gift' %}
  {%- assign christmas_product = all_products['christmas-gift-wrap'] -%}
  <div class="christmas-add-gift-wrap">
    <div class="christmas-add-gift">
      <input type="checkbox" id="christmas_chkAddGift" class="christmas-chk_add_gift" 
             value="{{ christmas_product.selected_or_first_available_variant.id }}" 
             data="{{ product.id }}">
      <label for="christmas_chkAddGift">
        <span class="gift-icon">{%- render 'icon-gift' -%}</span>
        <span class="lbl-text">Add {{ christmas_product.title }} ({{ christmas_product.price | money }})</span>
      </label>
    </div>
  </div>
{% endif %}
```

**JavaScript Add to Cart Logic:**
```javascript
// From assets/theme.old.js lines 6700-6741
if($christmas_gift.is(':checked') && christmas_value != '') {
  evt.preventDefault();
  christmas_gift_checked = true;
  $form.append('<input type="hidden" name="properties[Christmas Add-On]" class="christmas_add_gift" value="'+$form.find('.christmas-add-gift label .lbl-text').text()+'" >');
  $.ajax({
    url: '/cart/add.js',
    type: 'post',
    dataType: 'json',
    data: {
      id: christmas_value,
      quantity: 1,
      properties: {
        '_added_with_product': $christmas_gift.attr('data')
      }
    },
    success: function(data){
      // Update cart count
    }
  });
}
```

---

## 3. Gift Wrap in Cart Page

### Additional Gift Wrap Options

The cart page also provides options to add gift wrap directly without going back to the product page.

#### Regular Gift Wrap in Cart

**Display:**
- Checkbox appears in cart footer: "Add another gift wrap (AED 25.00)"
- Uses product handle from settings: `section.settings.gift` (default: "gift-wrap")
- Only shows if gift wrap product is available

**Implementation:**
```liquid
{%- if section.settings.gift != blank -%}
  {%- assign gift_pro = all_products[section.settings.gift] -%}
  {%- if gift_pro.available -%}
    <div class="gift-wrap jsGiftWrap{% if gift_found %} hide{% endif %}">
      <div class="text_content_gift">
        <input type="checkbox" id="chkgift" class="jsChkGift" 
               value="{{ gift_pro.selected_or_first_available_variant.id }}">
        <span>{%- include 'icon-gift' -%}</span>
        <label for="chkgift">Add another gift wrap (AED 25.00)</label>
        <span class="info_text">info</span>
      </div>
      <div class="info_show_text">Gift wrap includes a beautiful box and tissue paper</div>
    </div>
  {%- endif -%}
{%- endif -%}
```

**Code Location:** `sections/cart-template.liquid` lines 293-306

#### Christmas Gift Wrap in Cart

**Display:**
- Checkbox appears: "Add Christmas Gift Wrap (AED 15.00)"
- Uses product handle: `section.settings.christmas_gift` (default: "christmas-gift-wrap")

**Code Location:** `sections/cart-template.liquid` lines 307-318

### Cart Gift Wrap Management Logic

**JavaScript Function:** `_manageGift`

**How it Works:**
- Handles cart gift wrap checkbox changes
- When checked: Adds gift wrap product to cart via `/cart/add.js`
- When unchecked: Removes gift wrap product from cart via `/cart/change.js` (sets quantity to 0)

**Implementation:**
```javascript
// From assets/theme.old.js lines 5340-5371
_manageGift: function(evt){
  var $chk = $(evt.target);
  var _id = null;
  if($('[data-cart-item][data-cart-item-id="'+$chk.prop('value')+'"]')) 
    _id = $('[data-cart-item][data-cart-item-id="'+$chk.prop('value')+'"]').attr('data-cart-item-index');
  if(_id == null) _id = $chk.prop('value');
  
  var params = {
    url: '/cart/change.js',
    data: { quantity: 0, id: _id },
    dataType: 'json'
  }
  
  if($chk.is(':checked')) {
    params = {
      url: '/cart/add.js',
      data: { quantity: 1, id: $chk.prop('value') },
      dataType: 'json'
    }
  }
  
  $.post(params)
    .done(function(state) {
      $.getJSON('/cart.js',function(cart){
        if (cart.item_count === 0) {
          this._emptyCart();
        } else {
          this._createCart(cart);
        }
      }.bind(this));
    }.bind(this));
}
```

**Code Location:** `assets/theme.old.js` lines 5340-5371

---

## 4. Gift Wrap Product Properties

### Properties Added to Gift Wrap Items

When gift wrap is added from product page, the following properties are set:

| Property | Value | Purpose |
|----------|-------|---------|
| `_added_with_product` | Original product ID | Links gift wrap to the product it was added with |
| `_added_with_christmas_product` | Original product ID | Links Christmas gift wrap to the product (alternative property name) |

### Properties Added to Original Product

When Christmas gift wrap is selected, the original product also gets:

| Property | Value | Purpose |
|----------|-------|---------|
| `properties[Christmas Add-On]` | Gift wrap product title | Indicates Christmas gift wrap was added |
| `properties[Add-On]` | Gift wrap product title | Indicates regular gift wrap was added (for regular gift wrap) |

---

## 5. Cart Display and Filtering Logic

### How Gift Wrap Items are Handled in Cart

**Cart Filtering:**
- Items with `_added_with_product` or `_added_with_christmas_product` properties are:
  - Hidden from cart display using `ctm_hide` class
  - Not counted in cart item count (`cart_count`)
  - Linked to parent product via hidden input fields
  - Skipped in cart loop using `{%- continue -%}`

**Implementation:**
```liquid
{%- assign is_gift = false -%}
{%- assign gift_by_product = false -%}
{%- if gift_product != blank or christmas_product != blank -%}
  {%- if item.product_id == gift_product.id or item.product_id == christmas_product.id -%}
    {%- assign item_prop = item.properties | join: ', ' -%}
    {%- if item_prop contains '_added_with_product' or item_prop contains '_added_with_christmas_product' -%}
      {%- assign gift_by_product = true -%}
    {%- else -%}
      {%- assign gift_found = true -%}
      {%- assign is_gift = true -%}
    {%- endif -%}
  {%- endif -%}
{%- endif -%}

{%- if gift_by_product -%}
  <input type="hidden" class="gift_item" 
         data-id="{{ item.properties['_added_with_product'] }}" 
         data-cart-item-index="{{ forloop.index }}" 
         data-cart-item-quantity="{{ item.quantity }}">
  {%- continue -%}
{%- endif -%}
```

**Code Location:** `sections/cart-template.liquid` lines 43-64

### Gift Wrap Detection Logic

**Two Types of Gift Wrap Items:**

1. **Gift Wrap Added with Product** (`gift_by_product = true`)
   - Has `_added_with_product` property
   - Hidden from display
   - Linked to parent product

2. **Standalone Gift Wrap** (`is_gift = true`)
   - Gift wrap product without `_added_with_product` property
   - Visible in cart
   - Counted in cart item count
   - Added directly from cart page

---

## 6. Settings Configuration

### Product Handle Configuration

Gift wrap product handles are configured in theme settings:

**File:** `config/settings_data.json`

**Settings:**
```json
{
  "gift": "gift-wrap",
  "christmas_gift": "christmas-gift-wrap"
}
```

**Location:** Lines 1903-1904

**Usage:**
- These handles are used to fetch the actual gift wrap products
- Can be changed in theme customizer under cart section settings
- Products must exist with these exact handles

---

## 7. File Locations Reference

| File | Purpose | Key Lines |
|------|---------|-----------|
| `sections/product-template.liquid` | Gift message field | 42-47 |
| `sections/product-template.liquid` | Gift wrap checkboxes | 22-40 |
| `sections/cart-template.liquid` | Gift wrap cart logic & filtering | 43-64 |
| `sections/cart-template.liquid` | Cart page gift wrap options | 293-318 |
| `assets/theme.old.js` | Gift wrap add to cart (product page) | 6690-6786 |
| `assets/theme.old.js` | Cart gift wrap management | 5340-5371 |
| `config/settings_data.json` | Gift wrap product handles | 1903-1904 |

---

## 8. Summary

### Gift Message
- **Tag:** `gift_message`
- **Property:** `properties[Gift Message]`
- **Max Length:** 300 characters
- **Required:** Yes
- **Storage:** Line item property

### Gift Wrap Products

**Regular Gift Wrap:**
- **Tag:** `custom_gift_wrap`
- **Product Handle:** `gift-wrap`
- **Property:** `_added_with_product: {product_id}`
- **Behavior:** Hidden in cart, linked to original product

**Christmas Gift Wrap:**
- **Tag:** `christmas_gift`
- **Product Handle:** `christmas-gift-wrap`
- **Property:** `_added_with_product: {product_id}`
- **Additional Property:** `properties[Christmas Add-On]` on original product
- **Behavior:** Hidden in cart, linked to original product

**Cart Page Gift Wrap:**
- Can be added directly from cart
- Uses same product handles from settings
- Managed by `_manageGift` JavaScript function
- Visible in cart (not hidden like product-page-added gift wrap)

---

## 9. Testing Checklist

### Testing Gift Message:
1. Add `gift_message` tag to a product
2. View product page - gift message field should appear
3. Enter message (max 300 characters)
4. Add to cart
5. Verify `properties[Gift Message]` appears in cart
6. Complete checkout and verify in order

### Testing Gift Wrap (Product Page):
1. Add `custom_gift_wrap` tag to a product
2. Ensure `gift-wrap` product exists with handle "gift-wrap"
3. View product page - gift wrap checkbox should appear
4. Check the checkbox
5. Add product to cart
6. Verify gift wrap is added with `_added_with_product` property
7. Verify gift wrap is hidden in cart display
8. Verify original product shows in cart

### Testing Christmas Gift Wrap:
1. Add `christmas_gift` tag to a product
2. Ensure `christmas-gift-wrap` product exists
3. Check Christmas gift wrap checkbox
4. Add to cart
5. Verify both `_added_with_product` and `properties[Christmas Add-On]` are set

### Testing Cart Page Gift Wrap:
1. Add any product to cart
2. Go to cart page
3. Check "Add another gift wrap" checkbox
4. Verify gift wrap is added to cart
5. Uncheck checkbox
6. Verify gift wrap is removed from cart

---

*Last Updated: Based on codebase analysis*
*Documentation Version: 1.0*

