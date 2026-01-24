# QTY_ Tag System Reference

## Overview

The `qty_` tag system enforces minimum quantity requirements for products in the Shopify store. When a product has a tag in the format `qty_X` (where X is a number), it sets a minimum order quantity for that product.

## Tag Format

- **Format:** `qty_X` where X is the minimum quantity
- **Examples:**
  - `qty_5` - Minimum quantity of 5
  - `qty_10` - Minimum quantity of 10
  - `qty_3` - Minimum quantity of 3

## How It Works

### 1. Product Page Implementation

**File:** `sections/product-template.liquid` (lines 551-580)

#### Logic Flow:

1. **Tag Detection:**
   ```liquid
   {% for tag in product.tags %}
     {% if tag contains "qty_" %}
       {% assign tag = true %}
       {% assign tagsplit = tag | split: '_' %}
       {% assign max_qty = tagsplit[1] %}
     {% endif %}
   {% endfor %}
   ```

2. **Hidden Value Storage:**
   - Stores the minimum quantity in a hidden `<p>` element for JavaScript access:
   ```liquid
   {% if tag == true %}
     <p class="tagsplit_val" value="{{ max_qty }}" style="display:none;">{{ max_qty }}</p>
   {% endif %}
   ```

3. **Quantity Input Setup:**
   - If `qty_` tag exists: Sets default value to the tag number and makes input readonly
   - If no `qty_` tag: Default value is 1, input is still readonly (but can be changed via +/- buttons)
   
   ```liquid
   {% if tag == true %}
     <input type="text" 
            name="quantity" 
            value="{{ tagsplit[1] }}" 
            min="{{ tagsplit[1] }}" 
            class="product-form__input product-form__input--quantity quantity-selector quantity-input" 
            data-quantity-input 
            readonly>
   {% else %}
     <input type="text" 
            name="quantity" 
            value="1" 
            min="1" 
            class="product-form__input product-form__input--quantity quantity-selector quantity-input" 
            data-quantity-input 
            readonly>
   {% endif %}
   ```

#### Key Features:
- ✅ Input field is **readonly** (users cannot type directly)
- ✅ Default quantity is set to the tag value (e.g., `qty_5` → quantity starts at 5)
- ✅ HTML `min` attribute is set to enforce minimum
- ✅ Users can only adjust quantity using +/- buttons

---

### 2. JavaScript Quantity Control

**File:** `assets/theme.old.js` (lines 8489-8500)

#### Minus Button Logic:

```javascript
$(document).on('click', '.qtyminus', function(){
  var qty_button = $('.product-form__input.quantity-input');
  var qty_tag_val = $('.tagsplit_val').text();  // Gets the minimum from hidden element
  var qty_val = $('.product-form__input.quantity-input').val();
  var qty_val_pluse = parseInt(qty_val) - 1;
  
  // If decreasing would go below minimum, disable the minus button
  if(qty_val_pluse < qty_tag_val) {
    $(this).addClass("intro");  // Disables the minus button
  }
});
```

#### Plus Button Logic:

```javascript
$(document).on('click', '.qtyplus', function(){
  $(".qtyminus").removeClass("intro");  // Re-enables minus button when increasing
});
```

#### Behavior:
- **Minus button:** Disabled when quantity would go below the minimum
- **Plus button:** Always enabled, and re-enables minus button when clicked
- **Visual feedback:** The `intro` class is used to disable the minus button visually

---

### 3. Cart Page Implementation

**File:** `sections/cart-template.liquid` (lines 34-40, 226, 242)

#### Tag Detection:

```liquid
{% assign qty_tag = false %}
{%- for item in cart.items -%}
  {% for tag in item.product.tags %}
    {% if tag contains "qty_" %}
      {% assign qty_tag = true %}
    {% endif %}
  {% endfor %}
```

#### Readonly Quantity Inputs:

The cart page makes quantity inputs readonly for products with `qty_` tags:

**Mobile View (line 226):**
```liquid
<input id="updates_{{ item.key }}" 
       class="cart__qty-input" 
       type="number"
       {% if qty_tag %}readonly{% endif %}
       value="{{ item.quantity }}" 
       min="0" 
       pattern="[0-9]*"
       data-quantity-input 
       data-quantity-input-mobile>
```

**Desktop View (line 242):**
```liquid
<input id="updates_large_{{ item.key }}" 
       class="cart__qty-input" 
       type="number"
       {% if qty_tag %}readonly{% endif %}
       name="updates[]" 
       value="{{ item.quantity }}" 
       min="0" 
       pattern="[0-9]*"
       data-quantity-input 
       data-quantity-input-desktop>
```

#### Behavior:
- ✅ Quantity fields are **readonly** in cart for products with `qty_` tags
- ✅ Users cannot modify quantity directly in the cart
- ✅ Prevents users from reducing quantity below minimum after adding to cart

---

## Usage Examples

### Example 1: Product with `qty_5` tag

**Product Setup:**
- Tag: `qty_5`

**User Experience:**
1. Product page shows quantity selector with default value of **5**
2. Minus button is disabled (can't go below 5)
3. Plus button works normally (can increase to 6, 7, 8, etc.)
4. In cart, quantity field is readonly showing **5**

### Example 2: Product with `qty_10` tag

**Product Setup:**
- Tag: `qty_10`

**User Experience:**
1. Product page shows quantity selector with default value of **10**
2. Minus button is disabled (can't go below 10)
3. Plus button works normally (can increase to 11, 12, etc.)
4. In cart, quantity field is readonly showing **10**

### Example 3: Product without `qty_` tag

**Product Setup:**
- No `qty_` tag

**User Experience:**
1. Product page shows quantity selector with default value of **1**
2. Both plus and minus buttons work normally
3. In cart, quantity field is editable

---

## Implementation Details

### Files Involved

1. **`sections/product-template.liquid`**
   - Lines 551-580: Quantity selector logic and tag detection
   - Line 566: Hidden element storing minimum quantity for JavaScript

2. **`assets/theme.old.js`**
   - Lines 8489-8500: JavaScript handlers for +/- buttons
   - Prevents decreasing below minimum

3. **`sections/cart-template.liquid`**
   - Lines 34-40: Tag detection for cart items
   - Lines 226, 242: Readonly attribute application

### Key Variables

- `tag` (boolean): Indicates if product has a `qty_` tag
- `tagsplit`: Array from splitting tag by underscore (e.g., `["qty", "5"]`)
- `max_qty`: The minimum quantity value extracted from tag
- `qty_tag`: Boolean flag used in cart template

### CSS Classes

- `.tagsplit_val`: Hidden element containing minimum quantity (for JavaScript)
- `.qtyminus`: Minus button class
- `.qtyplus`: Plus button class
- `.intro`: Class added to disable minus button when at minimum
- `.quantity-input`: Quantity input field class

---

## Edge Cases & Notes

### Important Considerations:

1. **Readonly Inputs:**
   - Quantity inputs are always readonly (even without `qty_` tag)
   - Users must use +/- buttons to change quantity
   - This prevents manual entry errors

2. **Tag Format:**
   - Tag must start with `qty_` followed by a number
   - Case-sensitive: `qty_5` works, `QTY_5` or `Qty_5` may not
   - Only the first `qty_` tag found is used (if multiple exist)

3. **Cart Behavior:**
   - Once in cart, quantity cannot be changed if product has `qty_` tag
   - Users would need to remove item and re-add with correct quantity

4. **JavaScript Dependency:**
   - The minus button disable functionality requires JavaScript
   - If JavaScript is disabled, HTML `min` attribute provides fallback

5. **Related Tags:**
   - `no_qty`: If product has this tag, quantity selector is hidden entirely
   - `qty_` tags work independently of `no_qty` tag

---

## Testing Checklist

When implementing or modifying `qty_` tags, verify:

- [ ] Product page shows correct default quantity
- [ ] Minus button is disabled when at minimum
- [ ] Plus button increases quantity correctly
- [ ] Plus button re-enables minus button
- [ ] Cart page shows readonly quantity field
- [ ] Quantity cannot be manually edited in cart
- [ ] Multiple `qty_` tags (only first is used)
- [ ] Products without `qty_` tag work normally

---

## Troubleshooting

### Issue: Quantity not setting to minimum
**Solution:** Check that tag format is exactly `qty_X` (lowercase, underscore, number)

### Issue: Minus button not disabling
**Solution:** Verify `.tagsplit_val` element exists and contains correct value

### Issue: Cart quantity editable when it shouldn't be
**Solution:** Check that `qty_tag` variable is being set correctly in cart template

### Issue: Multiple `qty_` tags
**Solution:** Only the first `qty_` tag found in the loop will be used

---

## Related Documentation

- See `PERSONALIZATION_SYSTEM_REFERENCE.md` for other product tag systems
- See `GIFT_MESSAGE_AND_WRAP_SYSTEM.md` for gift-related functionality

---

**Last Updated:** January 2026  
**Maintained By:** Development Team
