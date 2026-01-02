# Personalization System Documentation

## Overview
The personalization system is tag-based and allows products to have various customization options. Personalization fields are shown on the product page when specific product tags are present.

---

## How Personalization is Shown

### Main Personalization Section
Personalization options are displayed in a collapsible section titled **"Personalise Me for Free"** on product pages. This section appears when products have the `cust_personalized` tag (case-insensitive).

**Location in code:** `sections/product-template.liquid` (lines 845-1044)

The section has two tabs:
- **"Personalise Me for Free"** - Shows personalization options
- **"Don't Personalise"** - Allows skipping personalization

---

## Which Products Have Personalization

Products with personalization are identified by **product tags**. The main tag is:
- **`cust_personalized`** (case-insensitive) - Enables the main personalization section

---

## Types of Personalizations Available

### 1. **Name/Initials** (`personalized_name`)
- **Tag Required:** `personalized_name` (case-insensitive)
- **Field Type:** Text input
- **Property Name:** `properties[Name]`
- **Max Length:** Dynamically set based on tags:
  - `personalise_5` → 5 characters
  - `personalise_7` → 7 characters
  - `personalise_9` → 9 characters
- **Label:** "Enter the Name or Initials (Free) *"
- **Validation:** Maximum characters, no special characters

### 2. **Text Color** (`personalized_textcolor`)
- **Tag Required:** `personalized_textcolor` (case-insensitive)
- **Field Type:** Radio buttons
- **Property Name:** `properties[Text Color]`
- **Options:** Determined by product tags with format `color_[colorname]`
  - Available colors: grey, pink, white, red, green, blue, orange, yellow, purple, gold, silver, multicolour, black
- **Example Tags:** `color_pink`, `color_blue`, `color_red`, etc.

### 3. **Text Font** (Font Family)
- **Tag Required:** Any tag starting with `font_`
- **Field Type:** Radio buttons
- **Property Name:** `properties[Text Font]`
- **Available Fonts (based on tags):**
  - `font_rockwell-condensed` → "Rockwell Condensed"
  - `font_ariel` → "Ariel round"
  - `font_monotype-corsiva` → "Monotype Corsiva"
  - `font_coronation` → "Coronation"
  - `font_ballantines` → "Ballantines"
  - `font_jester` → "Jester"
  - `font_miss-neally` → "Miss Neally"
  - `font_castle` → "Castle"
  - `font_london` → "London"
  - `font_garamond` → "Garamond"
  - `font_comic-sans` → "Comic Sans"
  - `font_amsterdam` → "Amsterdam"
  - `font_black_jack` → "Black Jack"
  - `font_rochester` → "Rochester"
  - `font_poppins` → "Poppins"

### 4. **Date of Birth** (`personalized_dob`)
- **Tag Required:** `personalized_dob` (case-insensitive)
- **Field Type:** Text input with date pattern
- **Property Name:** `properties[Date of Birth]`
- **Label:** "Date of Birth + AED 10 (optional)"
- **Format:** dd-mm-yyyy
- **Pattern:** `\d{2}-\d{2}-\d{4}`

### 5. **Multiple Names** (Name 1, Name 2, Name 3, Name 4)
- **Tags Required:** `name1`, `name2`, `name3`, `name4` (case-insensitive)
- **Field Type:** Text inputs
- **Property Names:**
  - `properties[Name 1]`
  - `properties[Name 2]`
  - `properties[Name 3]`
  - `properties[Name 4]`
- **Max Length:** 8 characters each
- **Validation:** English or Arabic characters
- **Labels:** "Name 1", "Name 2", "Name 3", "Name 4"

### 6. **School Year**
- **Tag Required:** `school_year` (case-insensitive)
- **Field Type:** Text input
- **Property Name:** `properties[School Year]`
- **Max Length:** 20 characters
- **Label:** "School Year"

### 7. **Text Box** (`personalise_textbox`)
- **Tag Required:** `personalise_textbox` (case-insensitive)
- **Field Type:** Textarea
- **Property Name:** `properties[Personalisation:]`
- **Max Length:** 500 characters
- **Label:** "Enter the names here:"
- **Placeholder:** "(e.g. Sarah,Jane,Robert)"
- **Note:** This appears as a separate block outside the main personalization section

### 8. **Optional Fields** (`optional_fields`)
- **Tag Required:** `optional_fields` (case-insensitive)
- **Fields Included:**
  - **Date of Birth:** `properties[Personalise Date of Birth]` (date picker)
  - **Time of Birth:** `properties[Time]` (time input, format: HH:MM AM/PM)
  - **Weight:** `properties[Weight]` (text input, in kg)
- **All fields are optional**

### 9. **Custom Message** (`create_20`)
- **Tag Required:** `create_20`
- **Field Type:** Textarea
- **Property Name:** `properties[Message]`
- **Max Length:** 50 characters
- **Label:** "Enter the text here:"

### 10. **COY Tag Products** (`COY`)
- **Tag Required:** `COY`
- **Fields:**
  - **Text Color:** Radio buttons (`properties[Text Color]`)
    - Options: White, Pink, Blue, Red
  - **Custom Text:** Text input (`properties[Custom Text]`)
    - Max Length: 30 characters
    - No special characters allowed
- **Special Feature:** Has custom validation requiring both color and text

### 11. **Own Mug Products** (`own_mug`)
- **Tag Required:** `own_mug`
- **Fields:**
  - **Inside Text:** `properties[Inside Text]` (max 25 characters) *
  - **Outside Text:** `properties[Outside Text]` (max 15 characters) *
- **Both fields are required**

### 12. **Gift Message** (`gift_message`)
- **Tag Required:** `gift_message`
- **Field Type:** Text input
- **Property Name:** `properties[Gift Message]`
- **Max Length:** 300 characters
- **Label:** "Enter a gift message *"

---

## Where Personalized Values are Saved

### Storage Method
Personalized values are saved as **Line Item Properties** in Shopify. When a product is added to cart, all form fields with `name="properties[...]"` are automatically captured by Shopify and stored with the cart line item.

### Storage Locations

1. **Cart:** Values are stored as properties on each cart line item
   - **File:** `sections/cart-template.liquid` (lines 104-123)
   - Properties are displayed in the cart using: `item.properties`
   - Properties are shown as: `Property Name: Property Value`

2. **Order:** When an order is placed, line item properties are automatically transferred to the order and stored permanently

3. **Order Management:** Properties appear in:
   - Shopify Admin → Orders → Order Details
   - Order confirmation emails
   - Order printouts/invoices
   - Fulfillment details

### Property Format
All personalization fields use the format:
```html
<input name="properties[Property Name]" ...>
```

Shopify automatically captures these and stores them as key-value pairs:
- **Key:** Property Name (e.g., "Name", "Text Color", "Date of Birth")
- **Value:** User input (e.g., "Sarah", "Pink", "01-01-2020")

### Example Properties Saved
- `properties[Name]` = "Sarah"
- `properties[Text Color]` = "Pink"
- `properties[Text Font]` = "Rockwell Condensed"
- `properties[Date of Birth]` = "01-01-2020"
- `properties[Name 1]` = "John"
- `properties[Name 2]` = "Jane"
- `properties[School Year]` = "2024"
- `properties[Personalisation:]` = "Sarah,Jane,Robert"
- etc.

---

## Summary of Product Tags

### Main Tags (Enable Personalization)
- `cust_personalized` - Main personalization section
- `personalized_name` - Name/Initials field
- `personalized_textcolor` - Text color selector
- `personalized_dob` - Date of Birth field
- `personalise_textbox` - Text box field
- `optional_fields` - Optional DOB, Time, Weight fields

### Character Limit Tags
- `personalise_5` - 5 character limit
- `personalise_7` - 7 character limit
- `personalise_9` - 9 character limit

### Color Tags (for text color)
- `color_[colorname]` - e.g., `color_pink`, `color_blue`, `color_red`

### Font Tags
- `font_[fontname]` - e.g., `font_rockwell-condensed`, `font_ariel`

### Additional Field Tags
- `name1`, `name2`, `name3`, `name4` - Multiple name fields
- `school_year` - School year field
- `create_20` - Custom message field
- `COY` - Special COY product personalization
- `own_mug` - Own mug product fields
- `gift_message` - Gift message field

---

## Code Location Reference

- **Main Template:** `sections/product-template.liquid`
  - Lines 808-836: Tag detection and variable assignment
  - Lines 845-1044: Main personalization section HTML
  - Lines 1056-1061: Text box field (outside main section)
  
- **Cart Display:** `sections/cart-template.liquid`
  - Lines 104-123: Displaying properties in cart

- **Product Card:** `snippets/product-card-grid.liquid`
  - Lines 12-16: Personalization detection for product cards


