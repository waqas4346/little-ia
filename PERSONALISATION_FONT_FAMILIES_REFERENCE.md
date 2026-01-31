# Personalisation font families – reference for reuse

Use these names exactly (including quotes in CSS) so they match the loaded fonts.

---

## 1. Font family names (for `font-family`)

Copy-paste list:

```
'Rockwell Condensed'
'Ariel round'
'Monotype Corsiva'
'Coronation'
'Ballantines'
'Jester'
'Miss Neally'
'Castle'
'London'
'Garamond'
'Comic Sans'
'Amsterdam'
'Black Jack'
'Rochester'
'Poppins'
```

**CSS comma-separated (e.g. for a font stack):**

```css
font-family: 'Rockwell Condensed', 'Ariel round', 'Monotype Corsiva', 'Coronation', 'Ballantines', 'Jester', 'Miss Neally', 'Castle', 'London', 'Garamond', 'Comic Sans', 'Amsterdam', 'Black Jack', 'Rochester', 'Poppins', sans-serif;
```

**JavaScript array:**

```js
const personalisationFontFamilies = [
  'Rockwell Condensed',
  'Ariel round',
  'Monotype Corsiva',
  'Coronation',
  'Ballantines',
  'Jester',
  'Miss Neally',
  'Castle',
  'London',
  'Garamond',
  'Comic Sans',
  'Amsterdam',
  'Black Jack',
  'Rochester',
  'Poppins'
];
```

---

## 2. Full @font-face definitions (CSS)

Paste this block into your CSS/SCSS so the fonts load wherever you use them:

```css
/* Personalisation fonts – @font-face definitions */
@font-face {
  font-family: 'Ariel round';
  src: url('https://cdn.shopify.com/s/files/1/0289/3240/7375/files/Arial_Rounded_MT_Regular.ttf?v=1694170587') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Amsterdam';
  src: url('https://cdn.shopify.com/s/files/1/0289/3240/7375/files/Amsterdam_Personal_Use.ttf?v=1697087181') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Rockwell Condensed';
  src: url('https://cdn.shopify.com/s/files/1/0289/3240/7375/files/Rockwell-CondensedBold.ttf?v=1679642109') format('truetype');
  font-weight: bold;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Black Jack';
  src: url('https://cdn.shopify.com/s/files/1/0289/3240/7375/files/BLACKJAR.TTF?v=1706075815') format('truetype');
  font-weight: bold;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Monotype Corsiva';
  src: url('https://cdn.shopify.com/s/files/1/0289/3240/7375/files/MonotypeCorsiva.ttf?v=1679642407') format('truetype');
  font-weight: normal;
  font-style: italic;
  font-display: swap;
}

@font-face {
  font-family: 'Coronation';
  src: url('https://cdn.shopify.com/s/files/1/0289/3240/7375/files/cotswfte.ttf?v=1679642120') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Ballantines';
  src: url('https://cdn.shopify.com/s/files/1/0289/3240/7375/files/Ballantines-Regular.ttf?v=1679642513') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Jester';
  src: url('https://cdn.shopify.com/s/files/1/0289/3240/7375/files/JesterRegular.ttf?v=1679642627') format('truetype');
  font-weight: 100;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Miss Neally';
  src: url('https://cdn.shopify.com/s/files/1/0289/3240/7375/files/MissNeally.ttf?v=1679642725') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Castle';
  src: url('https://cdn.shopify.com/s/files/1/0289/3240/7375/files/Castle-Bold.ttf?v=1679642789') format('truetype');
  font-weight: bold;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'London';
  src: url('https://cdn.shopify.com/s/files/1/0289/3240/7375/files/LondonBetween.ttf?v=1679642818') format('truetype');
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Garamond';
  src: url('https://cdn.shopify.com/s/files/1/0289/3240/7375/files/Garamond.ttf?v=1679642887') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Comic Sans';
  src: url('https://cdn.shopify.com/s/files/1/0289/3240/7375/files/ComicSansMS.ttf?v=1679642965') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Rochester';
  src: url('https://cdn.shopify.com/s/files/1/0289/3240/7375/files/Rochester.ttf?v=1748588110') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Poppins';
  src: url('https://cdn.shopify.com/s/files/1/0289/3240/7375/files/Poppins-Regular.ttf?v=1748590747') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
```

---

## 3. Quick reference table

| Font family           | File (Shopify CDN)              |
|-----------------------|----------------------------------|
| Rockwell Condensed    | Rockwell-CondensedBold.ttf      |
| Ariel round           | Arial_Rounded_MT_Regular.ttf    |
| Monotype Corsiva      | MonotypeCorsiva.ttf             |
| Coronation            | cotswfte.ttf                    |
| Ballantines           | Ballantines-Regular.ttf         |
| Jester                | JesterRegular.ttf               |
| Miss Neally           | MissNeally.ttf                  |
| Castle                | Castle-Bold.ttf                 |
| London                | LondonBetween.ttf               |
| Garamond              | Garamond.ttf                    |
| Comic Sans            | ComicSansMS.ttf                 |
| Amsterdam             | Amsterdam_Personal_Use.ttf     |
| Black Jack            | BLACKJAR.TTF                    |
| Rochester             | Rochester.ttf                   |
| Poppins               | Poppins-Regular.ttf             |

Source: `assets/theme.scss.liquid` and `sections/product-template.liquid`.
