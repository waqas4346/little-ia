# Color Personalization SVG Icons List

This document lists all SVG icon files used for font color personalization in the product template.

## Color Icons Used in Personalization

The following color icons are referenced in `sections/product-template.liquid` (lines 864-877):

| Color | SVG File Path | Status | Notes |
|-------|---------------|--------|-------|
| **Grey** | `snippets/icon-grey.liquid` | ✅ Exists | Used in personalization |
| **Pink** | `snippets/icon-pink.liquid` | ✅ Exists | Used in personalization |
| **White** | `snippets/icon-white.liquid` | ✅ Exists | Used in personalization (appears twice in code) |
| **Red** | `snippets/icon-red.liquid` | ✅ Exists | Used in personalization |
| **Green** | `snippets/icon-green.liquid` | ✅ Exists | Used in personalization |
| **Blue** | `snippets/icon-blue.liquid` | ✅ Exists | Used in personalization |
| **Orange** | `snippets/icon-orange.liquid` | ✅ Exists | Used in personalization |
| **Yellow** | `snippets/icon-yellow.liquid` | ✅ Exists | Used in personalization |
| **Purple** | `snippets/icon-purple.liquid` | ✅ Exists | Used in personalization |
| **Gold** | `snippets/icon-gold.liquid` | ✅ Exists | Used in personalization |
| **Silver** | `snippets/icon-silver.liquid` | ✅ Exists | Used in personalization |
| **Multicolour** | `snippets/icon-multicolour.liquid` | ✅ Exists | Used in personalization |
| **Black** | `snippets/icon-black.liquid` | ✅ Exists | Used in personalization |

## SVG Structure

All color icons follow the same structure:
- **Dimensions**: 70x70 viewBox
- **Format**: SVG wrapper with embedded base64-encoded PNG image
- **Location**: All files are in `snippets/` directory
- **Naming Convention**: `icon-{colorname}.liquid`

## CSS Styling

Additional CSS fills are applied in `assets/theme.scss.liquid` (lines 9584-9594):
- Each color has specific fill styling
- Example: `label[for="textcolor_blue"] svg g { fill: blue; }`

## Usage in Code

**File**: `sections/product-template.liquid`  
**Lines**: 854-886  
**Condition**: Only displays when product has `personalized_textcolor` tag and corresponding `color_*` tags

## Complete File List

### Color Icons (13 total)
1. `snippets/icon-black.liquid`
2. `snippets/icon-blue.liquid`
3. `snippets/icon-gold.liquid`
4. `snippets/icon-green.liquid`
5. `snippets/icon-grey.liquid`
6. `snippets/icon-multicolour.liquid`
7. `snippets/icon-orange.liquid`
8. `snippets/icon-pink.liquid`
9. `snippets/icon-purple.liquid`
10. `snippets/icon-red.liquid`
11. `snippets/icon-silver.liquid`
12. `snippets/icon-white.liquid`
13. `snippets/icon-yellow.liquid`

### Related Icon (Not Used in Color Selection)
- `snippets/icon-textcolor.liquid` - Generic text color icon (commented out in code)

## Notes

- Each SVG contains unique base64-encoded PNG image data
- All SVGs share the same wrapper structure
- White color appears twice in the conditional logic (lines 866 and 876) - this is redundant
- Icons are rendered at 30x30px in the UI (as per CSS line 9583)

## Product Tag Mapping

To enable a color option, add the corresponding product tag:
- `color_grey` → Shows grey icon
- `color_pink` → Shows pink icon
- `color_white` → Shows white icon
- `color_red` → Shows red icon
- `color_green` → Shows green icon
- `color_blue` → Shows blue icon
- `color_orange` → Shows orange icon
- `color_yellow` → Shows yellow icon
- `color_purple` → Shows purple icon
- `color_gold` → Shows gold icon
- `color_silver` → Shows silver icon
- `color_multicolour` → Shows multicolour icon
- `color_black` → Shows black icon

---

**Last Updated**: January 24, 2026  
**Generated from**: Codebase analysis of `sections/product-template.liquid` and `snippets/` directory
