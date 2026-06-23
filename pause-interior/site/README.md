# Pause Interior, website (first build)

A standalone, fast, responsive brand site for Pause Interior, built in the brand
style from the identity guidelines (warm neutral palette, serif headings,
generous white space). English, no build step required.

## Pages

| File | Page |
|---|---|
| `index.html` | Home: hero, collection, philosophy, categories, materials, journal, newsletter |
| `shop.html` | The collection grid |
| `our-story.html` | The brand story and values |
| `journal.html` | Articles index (for SEO and Pinterest over time) |
| `styles.css` | The shared brand stylesheet |

## View it

Just open `index.html` in a browser, or serve the folder:

```bash
cd pause-interior/site
python3 -m http.server 8000   # then open http://localhost:8000
```

## What is real and what is placeholder

- **Real:** the structure, layout, brand styling, copy, navigation, and
  responsive behaviour. This is the actual site skeleton.
- **Placeholder, to be replaced together:**
  - **Photography.** The soft tinted blocks mark where real photos go. Good
    product and room photography is the single biggest next step.
  - **Products and prices.** The pieces (Lull, Stilla, Måne, Ro, and so on) are
    tasteful samples. They will be swapped for the real collection.
  - **The founder story** on `our-story.html`, once written in her words.

## Next steps

1. Replace the placeholders with real photography, products and prices.
2. Connect commerce (recommended: Shopify) so the shop can take orders.
3. Hook up the newsletter form to the email tool (Klaviyo) and add tracking.

This first build is meant to make the brand feel real and give us something
concrete to shape together.
