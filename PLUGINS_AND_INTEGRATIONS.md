# Complete List of Plugins, Libraries & Integrations for New Theme Migration

This document contains all third-party plugins, libraries, and integrations found in the live theme that need to be migrated to the new theme.

---

## 📊 **ANALYTICS & TRACKING**

### 1. **Google Tag Manager (GTM)**
- **Location**: `layout/theme.liquid` (lines 5-11, 239-241)
- **ID**: `GTM-KMHSLST5`
- **Implementation**: 
  - Script in `<head>`: GTM initialization
  - Noscript fallback in `<body>`
- **Files to migrate**: Copy GTM code from `layout/theme.liquid`

### 2. **Google Analytics 4 (GA4)**
- **Location**: `layout/theme.liquid` (lines 31-39)
- **Tracking ID**: `G-XX3SHTC5MJ`
- **Implementation**: gtag.js async script
- **Files to migrate**: Copy GA4 code from `layout/theme.liquid`

### 3. **Google Ads Conversion Tracking**
- **Location**: `layout/theme.liquid` (lines 43-51), `layout/swish.theme.liquid` (lines 20-28)
- **Conversion ID**: `AW-428043504`
- **Implementation**: gtag.js async script
- **Files to migrate**: Copy Google Ads code from `layout/theme.liquid`

### 4. **Google Search Console Verification**
- **Location**: `layout/theme.liquid` (line 52)
- **Meta tag**: `hqTAf5L78pkFgVHII6IxwQZ-Rr4vQe0otmA_sc4xkTw`
- **Files to migrate**: Copy meta tag from `layout/theme.liquid`

### 5. **Microsoft Clarity**
- **Location**: `snippets/msclarity.liquid`, `layout/theme.liquid` (line 232)
- **Project ID**: `sg45693za7`
- **Implementation**: Clarity tracking script
- **Files to migrate**: 
  - Copy `snippets/msclarity.liquid`
  - Include `{% render 'msclarity' %}` in new theme layout

### 6. **Hotjar**
- **Location**: `layout/theme.liquid` (lines 81-91), `layout/swish.theme.liquid` (lines 58-67)
- **Site ID**: `2921263`
- **Version**: `6`
- **Files to migrate**: Copy Hotjar tracking code from `layout/theme.liquid`

### 7. **Triple Whale / Triple Pixel**
- **Location**: `layout/theme.liquid` (lines 14-28), multiple layout files
- **Domain**: `izaakazaneilittle.myshopify.com`
- **Versions**: `2.12` and `1.9.0` (duplicate implementations)
- **Endpoints**: 
  - `https://api.config-security.com/`
  - `https://conf.config-security.com/`
  - `https://whale.camera/`
  - `https://triplewhale-pixel.web.app/`
- **Files to migrate**: Copy TriplePixel code from `layout/theme.liquid` (note: appears to be duplicated, may need cleanup)

---

## 📧 **EMAIL MARKETING & FORMS**

### 8. **Klaviyo**
- **Location**: 
  - `sections/footer-signup-form.liquid` (lines 6, 27-28, 187-193)
  - `sections/footer.liquid` (line 907)
  - `snippets/klaviyo-atc-tracking.liquid`
  - `layout/theme.liquid` (line 1056)
  - `config/settings_data.json` (app block reference)
- **Implementation**: 
  - Form embed code in footer section
  - Add to Cart tracking snippet
  - Onsite embed app block
- **Files to migrate**:
  - Copy `snippets/klaviyo-atc-tracking.liquid`
  - Include Klaviyo form settings from `sections/footer-signup-form.liquid`
  - Include `{% render 'klaviyo-atc-tracking' %}` in layout
  - Re-add Klaviyo app from Shopify App Store if needed

### 9. **Flodesk**
- **Location**: `layout/theme.liquid` (lines 185-215, 243-269, 266-269), `sections/footer.liquid`
- **Universal Script**: `https://assets.flodesk.com/universal.js`
- **Form ID**: `616bd19674d564fa09f3f760`
- **Implementation**: 
  - Universal form script in `<head>`
  - Form initialization script
  - Form markup (commented out in theme.liquid, active in footer)
- **Files to migrate**: Copy Flodesk scripts and form code from `layout/theme.liquid` and `sections/footer.liquid`

### 10. **Mailchimp**
- **Location**: `layout/theme.liquid` (lines 689-990), `sections/footer.liquid` (lines 830-844)
- **List URL**: `https://littleizaakazanei.us8.list-manage.com/subscribe/post?u=42acb6679e869adfb6e8451d7&id=c868bb0bf0`
- **Implementation**: 
  - Mailchimp embed form
  - Validation script: `//s3.amazonaws.com/downloads.mailchimp.com/js/mc-validate.js`
  - CSS: `//cdn-images.mailchimp.com/embedcode/classic-10_7.css` and `slim-10_7.css`
- **Files to migrate**: Copy Mailchimp form code from `layout/theme.liquid` or `sections/footer.liquid`

---

## 🛍️ **E-COMMERCE & SHOPIFY APPS**

### 11. **Avada SEO Suite**
- **Location**: 
  - `layout/theme.liquid` (lines 53-55, 94-95)
  - `snippets/avada-seo*.liquid` (multiple files)
  - `templates/product.liquid`, `templates/article.liquid`
- **Implementation**: 
  - SEO meta tags and structured data
  - Size chart functionality (currently disabled - `avadaSCStatus = false`)
- **Files to migrate**:
  - Copy all `snippets/avada-seo*.liquid` files
  - Copy `snippets/avada-sc-*.liquid` files (size chart)
  - Include `{% include 'avada-seo' %}` in layout `<head>`
  - Include `{% include 'avada-sc-setting' %}` in layout `<head>`

### 12. **Avada Size Chart**
- **Location**: `snippets/avada-sc-setting.liquid`, `assets/size-chart-data.js`
- **Status**: Disabled in current theme (`avadaSCStatus = false`)
- **Implementation**: Size chart modal and button
- **Files to migrate**: Copy size chart files if planning to use

### 13. **Buddha Mega Menu**
- **Location**: 
  - `snippets/buddha-megamenu*.liquid` (3 files)
  - `layout/theme.liquid` (lines 176-177, 992)
  - `assets/buddha-megamenu.css`, `assets/buddha-megamenu.js`
- **Implementation**: Enhanced mega menu functionality
- **Files to migrate**:
  - Copy `snippets/buddha-megamenu*.liquid` files
  - Copy `assets/buddha-megamenu.css` and `assets/buddha-megamenu.js`
  - Include in layout: `{% include 'buddha-megamenu-before' %}`, `{% include 'buddha-megamenu' %}`, `{% include 'buddha-megamenu-wireframe' %}`
  - Note: Uses Font Awesome 4.6.2 from CDN

### 14. **Globo Menu**
- **Location**: 
  - `snippets/globo.menu.script.liquid`, `snippets/globo.menu.action.liquid`
  - `layout/theme.liquid` (lines 181, 1040)
  - `assets/globo.menu.*` (CSS, JS, data files)
- **Implementation**: Alternative menu system
- **Files to migrate**:
  - Copy all `snippets/globo.menu.*.liquid` files
  - Copy all `assets/globo.menu.*` files
  - Include in layout: `{% include 'globo.menu.script' %}` in `<head>`, `{% include 'globo.menu.action' %}` before `</body>`

### 15. **SCA Quick View Pro (Shopify Color App)**
- **Location**: 
  - `snippets/sca-quick-view*.liquid` (3 files)
  - `layout/theme.liquid` (lines 182, 1039)
  - `assets/sca-quick-view.css`, `assets/sca-qv-scripts-noconfig.js`
- **Implementation**: Quick view popup for products
- **Files to migrate**:
  - Copy all `snippets/sca-quick-view*.liquid` files
  - Copy `assets/sca-quick-view.css` and `assets/sca-qv-scripts-noconfig.js`
  - Include in layout: `{% include 'sca-quick-view-init' %}` in `<head>`, `{% include 'sca-quick-view-template' %}` before `</body>`

### 16. **HulkApps - Badge Master (Trust Badges)**
- **Location**: 
  - `snippets/hulkcode_trustbadge.liquid`
  - `layout/theme.liquid` (line 1040)
- **Implementation**: Payment badges and trust icons
- **Files to migrate**:
  - Copy `snippets/hulkcode_trustbadge.liquid`
  - Include `{% include 'hulkcode_trustbadge' %}` before `</body>`

### 17. **HulkApps - Product Options & Variants**
- **Location**: 
  - `snippets/hulk_po_vd.liquid`
  - `layout/theme.liquid` (line 231)
  - Multiple cart templates with `data-hulkapps-*` attributes
- **Implementation**: Product options and variant handling
- **Files to migrate**:
  - Copy `snippets/hulk_po_vd.liquid`
  - Include `{% include 'hulk_po_vd' %}` in `<head>`
  - Re-add HulkApps from Shopify App Store if needed

### 18. **Booster Currency Converter**
- **Location**: 
  - `snippets/booster-currency.liquid`
  - `layout/theme.liquid` (line 230)
- **Script**: `currency.boosterapps.com/preview_curr.js`
- **Files to migrate**:
  - Copy `snippets/booster-currency.liquid`
  - Include `{% capture cur %}{% include "booster-currency" %}{% endcapture %}{% unless cur contains "Liquid error" %}{{ cur }}{% endunless %}` in layout
  - Re-add Booster app from Shopify App Store if needed

### 19. **Smile.io (Loyalty & Rewards)**
- **Location**: 
  - `snippets/smile-initializer.liquid`
  - `layout/theme.liquid` (line 1042)
- **Implementation**: Customer loyalty program integration
- **Files to migrate**:
  - Copy `snippets/smile-initializer.liquid`
  - Include `{% include 'smile-initializer' %}` before `</body>`
  - Re-add Smile.io app from Shopify App Store if needed

### 20. **Linked Options (Product Variant Linking)**
- **Location**: 
  - `snippets/linked-options.liquid`
  - `layout/theme.liquid` (line 1044)
- **Implementation**: Custom script for linking product variant options
- **Files to migrate**:
  - Copy `snippets/linked-options.liquid`
  - Include `{% render 'linked-options' %}` on product pages (conditionally)

### 21. **AppHero Cart (Cart Drawer)**
- **Location**: 
  - `snippets/aph_cart.liquid`
  - `layout/theme.liquid` (line 1040)
- **Script**: `https://cart.apphero.co/app.php?shop=izaakazaneilittle.myshopify.com`
- **Files to migrate**:
  - Copy `snippets/aph_cart.liquid`
  - Include `{% include "aph_cart" %}` before `</body>`

### 22. **Product Pinch Zoom**
- **Location**: 
  - `snippets/product_pinch_zoom.liquid`
  - `layout/theme.liquid` (line 1040)
- **Implementation**: Product image zoom functionality
- **Files to migrate**:
  - Copy `snippets/product_pinch_zoom.liquid`
  - Include `{% include 'product_pinch_zoom' %}` before `</body>`
  - Note: References `hub_zoom_magnifier_gallery_js.json` asset

---

## 📱 **SOCIAL MEDIA & MARKETING**

### 23. **Facebook Pixel (Meta Pixel)**
- **Location**: 
  - `layout/theme.liquid` (lines 220-229)
  - `templates/product.liquid` (lines 78-81)
  - `templates/cart.liquid` (lines 12-14, 40)
- **Pixel ID**: `259904318915558`
- **Events**: PageView, ViewContent (product), AddToCart (cart)
- **Implementation**: Facebook Events API (fbevents.js)
- **Files to migrate**: 
  - Copy Facebook Pixel code from `layout/theme.liquid` `<head>`
  - Add ViewContent event tracking on product pages
  - Add AddToCart event tracking on cart page

---

## 📚 **JAVASCRIPT LIBRARIES (CDN)**

### 24. **Font Awesome**
- **Location**: 
  - `layout/theme.liquid` (line 1034)
  - `snippets/buddha-megamenu.liquid` (line 2)
- **Versions**: 
  - Font Awesome 5.8.1 (main theme)
  - Font Awesome 4.6.2 (Buddha menu)
- **CDN**: 
  - `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.8.1/css/all.min.css`
  - `https://maxcdn.bootstrapcdn.com/font-awesome/4.6.2/css/font-awesome.min.css`
- **Files to migrate**: Add Font Awesome links in layout `<head>`

### 25. **Moment.js**
- **Location**: `layout/theme.liquid` (line 1036)
- **Version**: `2.24.0`
- **CDN**: `https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.24.0/moment.min.js`
- **Usage**: Date/time formatting (used with datetimepicker)
- **Files to migrate**: Add Moment.js script in layout

### 26. **Bootstrap DateTimePicker**
- **Location**: `layout/theme.liquid` (lines 1035, 1037)
- **Version**: `4.17.47`
- **CDN**: 
  - CSS: `https://cdnjs.cloudflare.com/ajax/libs/bootstrap-datetimepicker/4.17.47/css/bootstrap-datetimepicker.min.css`
  - JS: `https://cdnjs.cloudflare.com/ajax/libs/eonasdan-bootstrap-datetimepicker/4.17.47/js/bootstrap-datetimepicker.min.js`
- **Dependencies**: jQuery, Moment.js
- **Files to migrate**: Add Bootstrap DateTimePicker CSS and JS in layout

### 27. **jQuery Libraries (Local Assets)**
- **Location**: Multiple asset files
- **Libraries**: 
  - Fancybox (`assets/fancybox.js`, `assets/fancybox.css`)
  - Slick Carousel (`assets/slick.js`, `assets/slick.css`)
  - Flexslider (`assets/jquery.flexslider.min.js`, `assets/flexslider.min.css`)
  - Swiper (`assets/swiper-bundle.min.js`, `assets/swiper-bundle.min.css`)
  - Sticky Kit (`assets/jquery_sticky-kit.min.js`)
  - Lazysizes (`assets/lazysizes.js`)
- **Files to migrate**: Copy all these asset files and ensure they're loaded in the new theme

---

## ⚠️ **ADDITIONAL NOTES**

### Content for Header (Shopify Apps)
- **Location**: `layout/theme.liquid` (line 179)
- **Implementation**: `{{ content_for_header }}`
- **Note**: This automatically includes scripts from installed Shopify apps. Ensure this is included in the new theme layout.

### Duplicate Implementations
The following appear to be duplicated and may need cleanup:
- **Triple Pixel**: Two versions (2.12 and 1.9.0) - may need consolidation
- **Flodesk**: Multiple script inclusions - verify if all are needed
- **Mailchimp & Flodesk**: Both email services appear to be active - verify which one is primary

### Apps That May Need Re-installation
Some Shopify apps inject code via `content_for_header`. You may need to:
1. Install the app in the new theme
2. Configure app settings
3. Verify app blocks/sections are properly set up

Apps that likely need re-installation:
- Klaviyo (has app blocks in settings)
- Avada SEO Suite (Shopify app)
- Avada Size Chart (Shopify app)
- HulkApps suite (multiple apps)
- Booster Currency (Shopify app)
- Smile.io (Shopify app)
- SCA Quick View (Shopify app)

---

## 📋 **MIGRATION CHECKLIST**

### Priority 1 (Analytics & Tracking)
- [ ] Google Tag Manager
- [ ] Google Analytics 4
- [ ] Google Ads Conversion
- [ ] Microsoft Clarity
- [ ] Hotjar
- [ ] Triple Whale/Triple Pixel
- [ ] Facebook Pixel

### Priority 2 (Email Marketing)
- [ ] Klaviyo
- [ ] Flodesk OR Mailchimp (verify which is primary)
- [ ] Newsletter form integration

### Priority 3 (Shopify Apps)
- [ ] Avada SEO Suite
- [ ] Buddha Mega Menu OR Globo Menu (verify which is active)
- [ ] SCA Quick View
- [ ] HulkApps (Badge Master, Product Options)
- [ ] Booster Currency
- [ ] Smile.io
- [ ] Linked Options
- [ ] AppHero Cart
- [ ] Product Pinch Zoom

### Priority 4 (Libraries & Assets)
- [ ] Font Awesome
- [ ] Moment.js
- [ ] Bootstrap DateTimePicker
- [ ] jQuery libraries (Fancybox, Slick, Flexslider, Swiper, etc.)
- [ ] Lazysizes

---

**Generated**: Based on analysis of live theme codebase  
**Theme Files Analyzed**: `layout/theme.liquid`, `layout/swish.theme.liquid`, snippets, sections, templates, assets

