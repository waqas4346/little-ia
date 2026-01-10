# Size Guide System Reference

## Overview
This document provides comprehensive documentation for the size guide functionality implemented on product pages in the Shopify theme. The system supports two different size guide implementations based on product metafields and collection metafields.

---

## 1. Size Guide Implementations

The theme supports **two different size guide systems** that can be used independently or together:

### A. Product Metafield Size Guide
- **Trigger:** Product metafield `product.metafields.custom.size_guide`
- **Display:** Icon with "Size guide" text
- **Popup:** Custom popup in theme layout
- **Image Source:** Product metafield file

### B. Collection Metafield Size Guide
- **Trigger:** Product tag `view_size_guide` + Collection metafield `collection.metafields.custom.size_chart`
- **Display:** "View size guide" link text
- **Popup:** Section-based popup
- **Image Source:** Collection metafield image

---

## 2. Product Metafield Size Guide

### How it Works

**Trigger Condition:**
- Product must have metafield: `product.metafields.custom.size_guide`
- Metafield type: File (image file)

**Display Location:**
- Appears in the `size_guide_delivery` block on product page
- Located above variant selectors
- Shows icon and "Size guide" text

**Visual Elements:**
- Icon: Hardcoded image URL: `https://cdn.shopify.com/s/files/1/0289/3240/7375/files/size_guide.png?v=1690800752`
- Text: "Size guide"
- Clickable block with class `js_size_guide`

**Code Location:** `sections/product-template.liquid` lines 598-606

**Implementation:**
```liquid
<div class="size_guide_delivery">
  {% if product.metafields.custom.size_guide != blank %}
    <div class="size_guide">
      <div class="single_block js_size_guide">
        <span class="image_icon">
          <img src="https://cdn.shopify.com/s/files/1/0289/3240/7375/files/size_guide.png?v=1690800752">
        </span>
        <span class="guide_text">Size guide</span>
      </div>
    </div>
  {% endif %}
</div>
```

### Popup Display

**Popup Location:** `layout/theme.liquid` lines 1048-1055

**Popup Structure:**
```liquid
<div class="size_guide_popup">
  <div class="size_guide_popup_inner">
    <span class="js_size_close_btn">{% render 'icon-close' %}</span>
    <div class="popup_content">
      <img src="{{ product.metafields.custom.size_guide | file_url }}">
    </div>
  </div>
</div>
```

**Popup Behavior:**
- Hidden by default (`display: none`)
- Shows when `.js_size_guide` is clicked
- Full-screen overlay with semi-transparent background
- Centered popup with max-width: 1000px
- Close button in top-right corner
- Scrollable content area

**JavaScript Handler:**
```javascript
// Open popup
$(document).on('click', '.js_size_guide', function(){
  $('.size_guide_popup').addClass('show');
});

// Close popup
$(document).on('click', '.js_size_close_btn', function(){
  $('.size_guide_popup').removeClass('show');
});
```

**Code Location:** `assets/theme.old.js` lines 8624-8630

**CSS Styling:**
- **File:** `assets/style.css` lines 196-201
- Background overlay: `#0000004d` (semi-transparent black)
- Z-index: `111111` (very high to appear above all content)
- Popup inner: White background, max-width 1000px, centered
- Image: Full width, auto height, responsive

---

## 3. Collection Metafield Size Guide

### How it Works

**Trigger Conditions:**
1. Product must have tag: `view_size_guide`
2. Product's first collection must have metafield: `collection.metafields.custom.size_chart`
3. Both conditions must be met

**Display Location:**
- Appears in `stock_chart` div on product page
- Located below variant selectors
- Shows "View size guide" link text with underline

**Visual Elements:**
- Text: "View size guide"
- Styled as clickable link with border-bottom
- Cursor pointer on hover

**Code Location:** `sections/product-template.liquid` lines 646-663

**Implementation:**
```liquid
{%- if product.tags contains 'view_size_guide' -%}
  <div class="stock_chart">
    {% for collection in product.collections limit: 1 %}
      {% if collection.metafields.custom.size_chart != blank %}
        <div class="product-size-guide">
          <span class="js-size-guide-popup">View size guide</span>
        </div>
      {% endif %}
    {% endfor %}
  </div>
{%- endif -%}
```

### Popup Display

**Section File:** `sections/size-guide.liquid`

**Section Structure:**
```liquid
<div class="size-guide-section">
  <div class="size-guide-popup">
    <div class="popup_close">
      {% include 'icon-close' %}
    </div>
    
    {% for collection in product.collections limit: 1 %}
      {% if collection.metafields.custom.size_chart != blank %}
        <img class="new" src="{{ collection.metafields.custom.size_chart.value | img_url: '2048x2048' }}">
      {% endif %}
    {% endfor %}
  </div>
</div>
```

**Section Inclusion:**
- Included in product template: `templates/product.liquid` line 4
- Rendered on all product pages: `{% section 'size-guide' %}`

**Popup Behavior:**
- Hidden by default (`display: none`)
- Shows when `.js-size-guide-popup` is clicked
- Full-screen overlay with semi-transparent background
- Image displayed at 2048x2048 resolution
- Close button in top-right corner
- Responsive image sizing

**JavaScript Handler:**
```javascript
// Open popup
$(document).on('click', '.js-size-guide-popup', function(){
  $('.size-guide-section').addClass('size-guide-show');
});

// Close popup
$(document).on('click', '.popup_close', function(){
  $('.size-guide-section').removeClass('size-guide-show');
});
```

**Code Location:** `assets/theme.old.js` lines 7919-7924

**CSS Styling:**
- **File:** `assets/theme.scss.liquid` lines 8696-8702
- Background overlay: `#0000005e` (semi-transparent black)
- Z-index: `1111`
- Full viewport coverage (100% width/height)
- Image: Full width/height, object-fit: contain
- Close button: Absolute positioned, top-right

---

## 4. Comparison of Both Systems

| Feature | Product Metafield | Collection Metafield |
|---------|------------------|---------------------|
| **Trigger** | Product metafield exists | Product tag + Collection metafield |
| **Metafield** | `product.metafields.custom.size_guide` | `collection.metafields.custom.size_chart` |
| **Tag Required** | None | `view_size_guide` |
| **Display Text** | "Size guide" | "View size guide" |
| **Icon** | Yes (hardcoded image) | No |
| **Popup Class** | `.size_guide_popup` | `.size-guide-section` |
| **Trigger Class** | `.js_size_guide` | `.js-size-guide-popup` |
| **Image Source** | Product metafield (file) | Collection metafield (image) |
| **Image Filter** | `file_url` | `img_url: '2048x2048'` |
| **Popup Location** | `layout/theme.liquid` | `sections/size-guide.liquid` |
| **Z-index** | 111111 | 1111 |

---

## 5. Setup Instructions

### Setting Up Product Metafield Size Guide

1. **Create Product Metafield:**
   - Go to Shopify Admin → Settings → Custom data → Products
   - Create metafield:
     - Namespace and key: `custom.size_guide`
     - Type: File (for images)
     - Description: "Size guide image for product"

2. **Add Image to Product:**
   - Edit product in Shopify Admin
   - Scroll to "Metafields" section
   - Upload size guide image to `custom.size_guide` field
   - Save product

3. **Result:**
   - Size guide icon and text will automatically appear on product page
   - Clicking it opens the popup with the uploaded image

### Setting Up Collection Metafield Size Guide

1. **Create Collection Metafield:**
   - Go to Shopify Admin → Settings → Custom data → Collections
   - Create metafield:
     - Namespace and key: `custom.size_chart`
     - Type: File reference or Image
     - Description: "Size chart image for collection"

2. **Add Image to Collection:**
   - Edit collection in Shopify Admin
   - Scroll to "Metafields" section
   - Upload size chart image to `custom.size_chart` field
   - Save collection

3. **Add Tag to Products:**
   - Edit products that should show size guide
   - Add tag: `view_size_guide`
   - Save products

4. **Result:**
   - "View size guide" link will appear on products with the tag
   - Products must be in a collection with the size chart metafield
   - Clicking the link opens the popup with collection's size chart

---

## 6. File Locations Reference

| File | Purpose | Key Lines |
|------|---------|-----------|
| `sections/product-template.liquid` | Product metafield size guide display | 598-606 |
| `sections/product-template.liquid` | Collection metafield size guide display | 646-663 |
| `sections/size-guide.liquid` | Collection size guide popup section | 1-26 |
| `layout/theme.liquid` | Product size guide popup HTML | 1048-1055 |
| `templates/product.liquid` | Includes size-guide section | 4 |
| `assets/theme.old.js` | Product size guide JS handlers | 8624-8630 |
| `assets/theme.old.js` | Collection size guide JS handlers | 7919-7924 |
| `assets/style.css` | Product size guide popup styles | 196-201 |
| `assets/theme.scss.liquid` | Collection size guide popup styles | 8696-8702 |

---

## 7. CSS Classes Reference

### Product Metafield Size Guide Classes

| Class | Purpose | Location |
|------|---------|----------|
| `.size_guide_delivery` | Container for size guide and delivery info | Product template |
| `.size_guide` | Size guide wrapper div | Product template |
| `.single_block` | Clickable block container | Product template |
| `.js_size_guide` | Trigger class for opening popup | Product template |
| `.size_guide_popup` | Popup overlay container | Theme layout |
| `.size_guide_popup_inner` | Popup content wrapper | Theme layout |
| `.js_size_close_btn` | Close button trigger | Theme layout |
| `.show` | Class added to show popup | JavaScript |

### Collection Metafield Size Guide Classes

| Class | Purpose | Location |
|------|---------|----------|
| `.stock_chart` | Container for stock/size guide info | Product template |
| `.product-size-guide` | Size guide wrapper div | Product template |
| `.js-size-guide-popup` | Trigger class for opening popup | Product template |
| `.size-guide-section` | Popup overlay container | Size guide section |
| `.size-guide-popup` | Popup content wrapper | Size guide section |
| `.popup_close` | Close button trigger | Size guide section |
| `.size-guide-show` | Class added to show popup | JavaScript |

---

## 8. Styling Details

### Product Metafield Popup Styles

**File:** `assets/style.css`

```css
.size_guide_popup {
  display: none;
  align-items: center;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  background: #0000004d;
  z-index: 111111;
  padding: 20px;
  overflow-Y: scroll;
}

.size_guide_popup.show {
  display: flex !important;
}

.size_guide_popup .size_guide_popup_inner {
  width: 100%;
  max-width: 1000px;
  margin: auto;
  padding: 25px 20px;
  background: #fff;
  position: relative;
}
```

### Collection Metafield Popup Styles

**File:** `assets/theme.scss.liquid`

```css
.size-guide-section {
  background-color: #0000005e;
  position: fixed;
  top: 0;
  width: 100%;
  height: 100%;
  z-index: 1111;
  display: none;
  justify-content: center;
  align-items: center;
}

.size-guide-section.size-guide-show {
  display: flex;
}

.size-guide-section .size-guide-popup img {
  width: 100%;
  height: 100%;
  vertical-align: middle;
  object-fit: contain;
}
```

---

## 9. Mobile Responsiveness

### Product Metafield Popup
- Responsive padding adjustments
- Scrollable content area
- Full-width on mobile devices
- Close button remains accessible

### Collection Metafield Popup
- Media query adjustments at 479px breakpoint
- Height changes to `auto` on mobile
- Position changes to `relative` on mobile
- Close button repositioned for mobile

**Mobile Styles:**
```css
@media screen and (max-width: 479px) {
  .size-guide-section .size-guide-popup {
    height: auto;
    position: relative;
  }
  .size-guide-section .size-guide-popup .popup_close {
    right: 15px;
    top: 15px;
  }
}
```

---

## 10. Additional Notes

### Size Guide Icon
- Product metafield size guide uses a hardcoded icon URL
- Icon location: `https://cdn.shopify.com/s/files/1/0289/3240/7375/files/size_guide.png?v=1690800752`
- Consider moving to assets folder for better control

### Collection Selection
- Collection metafield size guide uses the **first collection** the product belongs to
- Code: `{% for collection in product.collections limit: 1 %}`
- If product is in multiple collections, only the first one's size chart is used

### Image Sizing
- Product metafield: Uses `file_url` filter (original file size)
- Collection metafield: Uses `img_url: '2048x2048'` (resized to max 2048px)

### Popup Z-index
- Product metafield popup: `z-index: 111111` (very high)
- Collection metafield popup: `z-index: 1111` (high)
- Both should appear above most content

### Section Schema
- `sections/size-guide.liquid` has a schema with image picker setting
- Currently not used in the implementation
- Could be used for fallback/default size guide image

---

## 11. Testing Checklist

### Testing Product Metafield Size Guide:
1. Create/select a product
2. Add metafield `custom.size_guide` with an image file
3. View product page
4. Verify "Size guide" icon and text appear
5. Click on size guide
6. Verify popup opens with image
7. Verify close button works
8. Test on mobile device

### Testing Collection Metafield Size Guide:
1. Create/select a collection
2. Add metafield `custom.size_chart` with an image
3. Add product to that collection
4. Add `view_size_guide` tag to product
5. View product page
6. Verify "View size guide" link appears
7. Click on link
8. Verify popup opens with collection's size chart image
9. Verify close button works
10. Test on mobile device

### Testing Both Together:
1. Set up both systems on same product
2. Verify both size guide options appear
3. Test that both popups work independently
4. Verify no conflicts between the two systems

---

## 12. Troubleshooting

### Size Guide Not Appearing

**Product Metafield:**
- Check if `product.metafields.custom.size_guide` has a value
- Verify metafield namespace and key are correct: `custom.size_guide`
- Check browser console for JavaScript errors

**Collection Metafield:**
- Verify product has `view_size_guide` tag
- Check if product is in a collection
- Verify collection has `custom.size_chart` metafield
- Check that metafield has an image value

### Popup Not Opening

- Check browser console for JavaScript errors
- Verify jQuery is loaded
- Check that click handlers are bound correctly
- Verify CSS classes match between HTML and JavaScript

### Image Not Displaying

- Verify metafield has correct file/image uploaded
- Check image URL in browser console
- Verify image permissions/access
- Check for 404 errors in network tab

---

*Last Updated: Based on codebase analysis*
*Documentation Version: 1.0*



