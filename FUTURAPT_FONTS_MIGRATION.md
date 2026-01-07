# FuturaPT Font Family - Migration Documentation

This document contains all FuturaPT font family implementations found in the live theme that need to be migrated to the new theme.

---

## 📁 **FONT FILES IN ASSETS**

### FuturaPT-Book (Available in assets folder):
- ✅ `assets/FuturaPT-Book.eot` (102,572 bytes)
- ✅ `assets/FuturaPT-Book.svg` (500,845 bytes)
- ✅ `assets/FuturaPT-Book.ttf` (102,376 bytes)
- ✅ `assets/FuturaPT-Book.woff` (46,508 bytes)
- ✅ `assets/FuturaPT-Book.woff2` (32,724 bytes)

### FuturaPT-Medium (Available in assets folder):
- ✅ `assets/FuturaPT-Medium.eot` (104,616 bytes)
- ✅ `assets/FuturaPT-Medium.svg` (526,188 bytes)
- ✅ `assets/FuturaPT-Medium.ttf` (104,412 bytes)
- ✅ `assets/FuturaPT-Medium.woff` (47,028 bytes)
- ✅ `assets/FuturaPT-Medium.woff2` (33,160 bytes)

### Additional Fonts (CDN/Linked):
- ⚠️ `FuturaPT-Demi` - Loaded from CDN (not in assets folder)
- ⚠️ `FuturaBT-Medium` - Loaded from CDN (not in assets folder)

---

## 🎨 **@FONT-FACE DECLARATIONS**

### Location: `assets/style.old.css` and `assets/style.css`

```css
/* Futura PT Medium (via CDN - FuturaBT-Medium) */
@font-face {
  font-family: 'Futura PT Mendium';
  src: url('https://cdn.shopify.com/s/files/1/0289/3240/7375/files/FuturaBT-Medium.woff2?v=1667568883') format('woff2'),
      url('https://cdn.shopify.com/s/files/1/0289/3240/7375/files/FuturaBT-Medium.woff?v=1667568883') format('woff'),
      url('https://cdn.shopify.com/s/files/1/0289/3240/7375/files/FuturaBT-Medium.ttf?v=1667568883') format('truetype');
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}

/* Futura PT Book (Local Assets) */
@font-face {
  font-family: 'Futura PT Book';
  src: url('FuturaPT-Book.eot');
  src: url('FuturaPT-Book.eot?#iefix') format('embedded-opentype'),
    url('FuturaPT-Book.woff2') format('woff2'),
    url('FuturaPT-Book.woff') format('woff'),
    url('FuturaPT-Book.ttf') format('truetype'),
    url('FuturaPT-Book.svg#FuturaPT-Book') format('svg');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

/* Futura PT Medium (Local Assets) */
@font-face {
  font-family: 'Futura PT';
  src: url('FuturaPT-Medium.eot');
  src: url('FuturaPT-Medium.eot?#iefix') format('embedded-opentype'),
    url('FuturaPT-Medium.woff2') format('woff2'),
    url('FuturaPT-Medium.woff') format('woff'),
    url('FuturaPT-Medium.ttf') format('truetype'),
    url('FuturaPT-Medium.svg#FuturaPT-Medium') format('svg');
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}

/* FuturaPT-Demi (CDN) */
@font-face {
  font-family: 'FuturaPT-Demi';
  src: url('https://cdn.shopify.com/s/files/1/0289/3240/7375/files/FuturaPT-Demi.woff2?v=1642614538') format('woff2'),
    url('https://cdn.shopify.com/s/files/1/0289/3240/7375/files/FuturaPT-Demi.woff?v=1642614538') format('woff');
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}
```

---

## ⚙️ **THEME SETTINGS CONFIGURATION**

### Location: `config/settings_data.json`

```json
{
  "type_header_font": "futura_n3",
  "type_header_base_size": 20,
  "type_base_font": "futura_n3",
  "type_base_size": 14
}
```

**Note**: `futura_n3` is a Shopify font picker ID. The font picker settings are defined in `config/settings_schema.json` at:
- Line 640: `type_header_font` (font_picker)
- Line 717: `type_base_font` (font_picker)

---

## 🔗 **EXTERNAL CDN LINKS**

### 1. Flodesk FuturaPT CSS
- **Location**: `layout/theme.liquid` (line 273), `layout/theme-ai-product-theme.liquid` (line 221), `layout/swish.theme.liquid` (line 241)
- **URL**: `https://assets.flodesk.com/futurapt.css`
- **Usage**: Imported via `@import` in style blocks (inside commented Flodesk form code)

### 2. FuturaBT-Medium (CDN)
- **URL**: `https://cdn.shopify.com/s/files/1/0289/3240/7375/files/FuturaBT-Medium.woff2?v=1667568883`
- **Alternative formats**: `.woff`, `.ttf`
- **Font Family Name**: `'Futura PT Mendium'` (note the typo/spelling)

### 3. FuturaPT-Demi (CDN)
- **URL**: `https://cdn.shopify.com/s/files/1/0289/3240/7375/files/FuturaPT-Demi.woff2?v=1642614538`
- **Alternative format**: `.woff`
- **Font Family Name**: `'FuturaPT-Demi'`

---

## 📝 **FONT USAGE IN CSS**

### Common Font Family Names Used:
1. `'Futura PT Book'` - Most commonly used
2. `'Futura PT'` - Used for Medium weight
3. `'Futura PT Mendium'` - Typo spelling (used for CDN version)
4. `'FuturaPT-Demi'` - Demi weight variant
5. `'Futura'` or `Futura, sans-serif` - Generic fallback

### Examples of Usage:
- Headers and headings
- Body text
- Product titles and descriptions
- Navigation menus
- Buttons and CTAs
- Price displays
- Cart items

---

## 📋 **MIGRATION CHECKLIST**

### Files to Copy to New Theme:
- [ ] `assets/FuturaPT-Book.eot`
- [ ] `assets/FuturaPT-Book.svg`
- [ ] `assets/FuturaPT-Book.ttf`
- [ ] `assets/FuturaPT-Book.woff`
- [ ] `assets/FuturaPT-Book.woff2`
- [ ] `assets/FuturaPT-Medium.eot`
- [ ] `assets/FuturaPT-Medium.svg`
- [ ] `assets/FuturaPT-Medium.ttf`
- [ ] `assets/FuturaPT-Medium.woff`
- [ ] `assets/FuturaPT-Medium.woff2`

### Settings to Update:
- [ ] Copy `type_header_font: "futura_n3"` setting
- [ ] Copy `type_base_font: "futura_n3"` setting
- [ ] Update font picker settings in `settings_schema.json` if needed

### Code to Add:
- [ ] Add all @font-face declarations to new theme CSS
- [ ] Update font paths to use `{{ 'filename.woff2' | asset_url }}` format
- [ ] Test all font weights (Book, Medium, Demi) load correctly

---

## 🎯 **IMPLEMENTATION DETAILS**

### Font Weights:
- **Futura PT Book**: `font-weight: normal` (400) - Used for body text
- **Futura PT Medium**: `font-weight: 500` - Used for headings and emphasis
- **FuturaPT-Demi**: `font-weight: 500` - Used for stronger emphasis

### Font Display:
- All fonts use `font-display: swap` for better performance

### Fallback Fonts:
- Many CSS rules use `Futura, sans-serif` as fallback

---

## 📄 **FILES CONTAINING FONT REFERENCES**

### Stylesheets:
- `assets/style.css` - Main stylesheet (compressed)
- `assets/style.old.css` - Uncompressed version with @font-face declarations
- `assets/theme.scss.liquid` - SCSS source file

### Layout Files:
- `layout/theme.liquid` - Flodesk FuturaPT CSS import (line 273)
- `layout/theme-ai-product-theme.liquid` - Flodesk FuturaPT CSS import (line 221)
- `layout/swish.theme.liquid` - Flodesk FuturaPT CSS import (line 241)

### Sections:
- `sections/custom-html.liquid` - Uses `'FuturaPT-Demi'`

### Configuration:
- `config/settings_data.json` - Font picker settings (lines 28, 30)
- `config/settings_schema.json` - Font picker definitions (lines 640, 717)

---

## 🔧 **MIGRATION STEPS FOR NEW THEME**

### Step 1: Copy Font Files
```bash
# Copy all FuturaPT font files from assets folder to new theme
cp assets/FuturaPT-*.eot assets/FuturaPT-*.svg assets/FuturaPT-*.ttf assets/FuturaPT-*.woff assets/FuturaPT-*.woff2 [new-theme]/assets/
```

### Step 2: Add @font-face Declarations
Create a new snippet file `snippets/futurapt-fonts.liquid` with all @font-face declarations using asset_url filters:

```liquid
<style>
@font-face {
  font-family: 'Futura PT Book';
  src: url('{{ 'FuturaPT-Book.eot' | asset_url }}');
  src: url('{{ 'FuturaPT-Book.eot?#iefix' | asset_url }}') format('embedded-opentype'),
    url('{{ 'FuturaPT-Book.woff2' | asset_url }}') format('woff2'),
    url('{{ 'FuturaPT-Book.woff' | asset_url }}') format('woff'),
    url('{{ 'FuturaPT-Book.ttf' | asset_url }}') format('truetype'),
    url('{{ 'FuturaPT-Book.svg#FuturaPT-Book' | asset_url }}') format('svg');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Futura PT';
  src: url('{{ 'FuturaPT-Medium.eot' | asset_url }}');
  src: url('{{ 'FuturaPT-Medium.eot?#iefix' | asset_url }}') format('embedded-opentype'),
    url('{{ 'FuturaPT-Medium.woff2' | asset_url }}') format('woff2'),
    url('{{ 'FuturaPT-Medium.woff' | asset_url }}') format('woff'),
    url('{{ 'FuturaPT-Medium.ttf' | asset_url }}') format('truetype'),
    url('{{ 'FuturaPT-Medium.svg#FuturaPT-Medium' | asset_url }}') format('svg');
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}

/* Optional: Add CDN fonts if needed */
@font-face {
  font-family: 'Futura PT Mendium';
  src: url('https://cdn.shopify.com/s/files/1/0289/3240/7375/files/FuturaBT-Medium.woff2?v=1667568883') format('woff2'),
      url('https://cdn.shopify.com/s/files/1/0289/3240/7375/files/FuturaBT-Medium.woff?v=1667568883') format('woff'),
      url('https://cdn.shopify.com/s/files/1/0289/3240/7375/files/FuturaBT-Medium.ttf?v=1667568883') format('truetype');
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'FuturaPT-Demi';
  src: url('https://cdn.shopify.com/s/files/1/0289/3240/7375/files/FuturaPT-Demi.woff2?v=1642614538') format('woff2'),
    url('https://cdn.shopify.com/s/files/1/0289/3240/7375/files/FuturaPT-Demi.woff?v=1642614538') format('woff');
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}
</style>
```

### Step 3: Include in Layout
Add to `layout/theme.liquid` in the `<head>` section:

```liquid
{% render 'futurapt-fonts' %}
```

### Step 4: Update Theme Settings
In `config/settings_data.json`, set:
```json
{
  "type_header_font": "futura_n3",
  "type_base_font": "futura_n3"
}
```

### Step 5: Verify Font Picker
Ensure `futura_n3` is available in the new theme's font picker settings, or update to use the custom font families directly.

---

## ✅ **SUMMARY**

**Total Font Files to Copy**: 10 files (5 formats × 2 variants)
- ✅ FuturaPT-Book (5 formats: eot, svg, ttf, woff, woff2)
- ✅ FuturaPT-Medium (5 formats: eot, svg, ttf, woff, woff2)

**Additional Fonts (CDN)**: 2 fonts
- ⚠️ FuturaPT-Demi (via CDN)
- ⚠️ FuturaBT-Medium (via CDN - alternate spelling)

**Settings to Update**: 2 settings
- `type_header_font: "futura_n3"`
- `type_base_font: "futura_n3"`

**External Dependencies**: 1
- Flodesk FuturaPT CSS (via CDN - optional, used in Flodesk forms)

---

**Generated**: Based on analysis of live theme branch  
**Branch**: `live-theme`  
**Files Analyzed**: `assets/`, `layout/`, `config/`, `sections/`

