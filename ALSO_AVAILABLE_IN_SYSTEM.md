# "Also Available In" Feature Documentation

## Overview
The "Also available in" feature displays a carousel of related products on the product page. When a customer clicks on a product image, they are redirected to that product's page.

---

## Location
**File:** `sections/product-template.liquid`  
**Lines:** 213-240

---

## Conditions for Display

The feature is displayed when the following condition is met:

### Primary Condition
```liquid
{% if product.metafields.custom.product_list != blank %}
```
- The product must have a **custom metafield** named `product_list` that is not empty
- This metafield should contain a list of product references

---

## How It Works

### 1. Metafield Structure
The feature uses Shopify's custom metafields:
- **Namespace:** `custom`
- **Key:** `product_list`
- **Type:** Product list reference (array of products)

### 2. Product Counting
```liquid
{% for meta in product.metafields.custom.product_list.value %}
  {% assign meta_pro = forloop.length %}
{% endfor %}
```
- The code counts the number of products in the metafield
- This count determines whether to show navigation arrows (if more than 3 products)

### 3. HTML Structure
```liquid
<div class="pro_meta">
  <h1 class="pro_title">Also available in</h1>
  {% if meta_pro > 3 %} 
    <div class="img_arrow img_arrow_prev">{% render 'icon-arrow-prev' %}</div>
  {% endif %}
  <div class="product_meta_slider{% if meta_pro > 3 %} product_slider_main{% endif %}">
    {% for meta in product.metafields.custom.product_list.value %}
      {% assign meta_title = meta.title %}
      {% assign meta_img = meta.featured_image %}
      {% assign meta_price = meta.price | money_with_currency %}
      {% assign meta_url = meta.handle %}
      <div class="product_slider">
        <a href="/products/{{ meta_url }}">
          <div class="pro_meta_img">
            <img src="{{ meta_img | img_url: 'master' }}">
          </div>
          <p class="pro_meta_title hide">{{ meta_title }}</p>
          <p class="pro_meta_price hide">{{ meta_price }}</p>
        </a>
      </div>
    {% endfor %}
  </div>
  {% if meta_pro > 3 %}  
    <div class="img_arrow img_arrow_next">{% render 'icon-arrow-next' %}</div>
  {% endif %}
</div>
```

### 4. Product Information Extraction
For each product in the metafield, the following data is extracted:
- **Title:** `meta.title`
- **Featured Image:** `meta.featured_image`
- **Price:** `meta.price` (formatted with currency)
- **Handle:** `meta.handle` (used for the product URL)

### 5. Navigation Links
Each product image is wrapped in an anchor tag:
```liquid
<a href="/products/{{ meta_url }}">
```
- Clicking the image redirects to `/products/{product-handle}`
- Uses the product handle from the metafield

---

## Slider Functionality

### When Slider is Active
The slider is activated when there are **more than 3 products** in the metafield:
- Adds the class `product_slider_main` to the container
- Shows navigation arrows (`.img_arrow_prev` and `.img_arrow_next`)

### JavaScript Implementation
**File:** `assets/theme.old.js` (Lines 8579-8599)

**Desktop (> 767px width):**
```javascript
if($('.product_slider_main').length){
  if ($(window).width() > 767) {
    $('.product_slider_main').slick({
      slidesToShow: 3,
      slidesToScroll: 1,
      prevArrow: $('.img_arrow_prev'),
      nextArrow: $('.img_arrow_next')
    });
  }
}
```

**Mobile (≤ 767px width):**
```javascript
if($('.product_slider_main').length){
  if ($(window).width() < 767) {
    $('.product_slider_main').slick({
      slidesToShow: 3,
      slidesToScroll: 1,
      prevArrow: $('.img_arrow_prev'),
      nextArrow: $('.img_arrow_next')
    });
  }
}
```

**Note:** The slider initialization uses **Slick Slider** library and is wrapped in `$(window).load()` function to ensure DOM is ready.

---

## Styling

### CSS Classes
**File:** `assets/style.css` (Lines 67-75)

```css
.pro_meta {
  position: relative;
  padding-top: 10px;
}

.pro_meta .product_meta_slider {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
  padding: 20px 0;
}

.pro_meta .product_meta_slider.product_slider_main {
  padding: 20px;
}

.pro_meta .product_meta_slider .product_slider {
  width: calc(33.33% - 15px);
  border: 1px solid #eee;
  padding: 5px;
  text-align: center;
  margin: 0 5px;
}

.pro_meta .img_arrow {
  position: absolute;
  top: 50%;
  width: 25px;
  height: 25px;
  cursor: pointer;
}

.pro_meta .img_arrow.img_arrow_prev {
  left: 0;
}

.pro_meta .img_arrow.img_arrow_next {
  right: 0;
}

.pro_meta .pro_title {
  font-size: 20px;
  margin-bottom: 0;
  text-align: start;
  padding-left: 10px;
}
```

### Responsive Styles
**Mobile styles** (from `style.css` lines 135-155):
```css
@media (max-width: 767px) {
  .pro_meta .img_arrow {
    width: 20px;
    height: 20px;
  }
  .pro_meta {
    padding-left: 20px;
  }
  .pro_meta .pro_title {
    font-size: 15px;
  }
  .pro_meta .product_meta_slider {
    padding: 10px 0;
  }
}
```

---

## Required Dependencies

1. **Slick Slider Library**
   - Files: `assets/slick.js` and `assets/slick.css`
   - Used for carousel functionality

2. **Icon Snippets**
   - `snippets/icon-arrow-prev.liquid` - Previous arrow icon
   - `snippets/icon-arrow-next.liquid` - Next arrow icon

3. **jQuery**
   - Required for Slick slider initialization

---

## Setup Instructions

### Step 1: Create Metafield Definition
In Shopify Admin:
1. Go to **Settings** → **Custom data** → **Products**
2. Create a new metafield with:
   - **Name:** `product_list`
   - **Namespace and key:** `custom.product_list`
   - **Type:** `Product reference` (or `Product list`)
   - **Description:** List of related products to show in "Also available in" section

### Step 2: Add Products to Metafield
For each product where you want to show related products:
1. Go to the product in Shopify Admin
2. Scroll to the **Metafields** section
3. Find `custom.product_list`
4. Select the products you want to display
5. Save the product

### Step 3: Verify JavaScript
Ensure the slider initialization code exists in your theme's JavaScript file. If using `assets/theme.js`, you may need to copy the slider initialization from `assets/theme.old.js`:

```javascript
$(window).load(function() {
  if($('.product_slider_main').length){
    if ($(window).width() > 767) {
      $('.product_slider_main').slick({
        slidesToShow: 3,
        slidesToScroll: 1,
        prevArrow: $('.img_arrow_prev'),
        nextArrow: $('.img_arrow_next')
      });
    }
  }

  if($('.product_slider_main').length){
    if ($(window).width() < 767) {
      $('.product_slider_main').slick({
        slidesToShow: 3,
        slidesToScroll: 1,
        prevArrow: $('.img_arrow_prev'),
        nextArrow: $('.img_arrow_next')
      });
    }
  }
});
```

---

## Behavior Summary

| Condition | Behavior |
|-----------|----------|
| Metafield is empty/blank | Section is **NOT displayed** |
| 1-3 products | Products displayed in a **flex grid** (no slider) |
| More than 3 products | Products displayed in a **Slick slider** with navigation arrows |
| Click on product image | Redirects to that product's page (`/products/{handle}`) |

---

## Troubleshooting

### Issue: Slider not working
**Possible causes:**
1. Slick slider library not loaded
2. JavaScript initialization code missing from `theme.js`
3. jQuery not loaded before Slick
4. Slider initialization running before DOM is ready

**Solution:**
- Check browser console for JavaScript errors
- Verify Slick slider files are loaded
- Ensure slider initialization is wrapped in `$(window).load()` or `$(document).ready()`

### Issue: Section not showing
**Possible causes:**
1. Metafield not created or configured correctly
2. Metafield is empty for the product
3. Metafield key mismatch (should be `custom.product_list`)

**Solution:**
- Verify metafield exists in Shopify Admin
- Check that products are added to the metafield
- Confirm metafield namespace and key match the code

### Issue: Images not displaying
**Possible causes:**
1. Products in metafield don't have featured images
2. Image URL generation issue

**Solution:**
- Ensure all products have featured images
- Check that `meta.featured_image` is not null

---

## Code Reference

### Template File
- `sections/product-template.liquid` (Lines 213-240)

### JavaScript Files
- `assets/theme.old.js` (Lines 8579-8599) - Slider initialization
- Note: Check if similar code exists in `assets/theme.js`

### CSS Files
- `assets/style.css` (Lines 67-75) - Main styles
- `assets/theme.scss.liquid` - May contain additional styles

### Snippet Files
- `snippets/icon-arrow-prev.liquid` - Previous arrow icon
- `snippets/icon-arrow-next.liquid` - Next arrow icon

---

## Future Enhancements

Potential improvements to consider:
1. Add product title and price display (currently hidden with `.hide` class)
2. Add loading state for images
3. Add lazy loading for product images
4. Improve mobile responsiveness
5. Add touch/swipe support for mobile
6. Add keyboard navigation support
7. Display "Sold Out" badge for unavailable products
8. Add product quick view on hover/click
9. Track analytics events on product clicks

---

## Last Updated
Documentation created based on codebase analysis.
