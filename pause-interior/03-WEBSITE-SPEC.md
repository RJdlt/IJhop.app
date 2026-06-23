# Pause Interior — Website & E-commerce Build Spec

> _Deliverable 03 · v1.0 · June 2026 · English-first_
> Built on [01-BUSINESS-CONCEPT.md](./01-BUSINESS-CONCEPT.md) and
> [02-BRAND-IDENTITY.md](./02-BRAND-IDENTITY.md). This is the blueprint a
> designer/developer (or a Shopify build) follows to ship the store.

---

## 1. What the website is

Not "a shop with products on it." The website is **the home base of the brand** —
the one place we fully control, where discovery turns into trust and trust turns
into a sale. It must do three jobs at once:

1. **Make people feel the pause** (brand/emotional).
2. **Make buying effortless** (conversion).
3. **Be found on Google and shared on Pinterest** (acquisition).

> Design target: a customer should feel calmer **within five seconds** of
> arriving, and be able to buy in **under five clicks**.

---

## 2. Platform recommendation

### Recommendation: **Shopify**

For a founder-led DTC interior brand that needs to launch well and fast, **Shopify** is the right default. Rationale:

| Criterion | Why Shopify wins here |
|---|---|
| Speed to launch | Live in weeks, not months |
| No-code for the founder | She can edit products, prices, content herself |
| Premium themes | Beautiful, fast, mobile-first themes that suit the aesthetic |
| Payments & checkout | Best-in-class, high-trust, low-friction checkout (incl. Shopify Payments, Klarna, Apple/Google Pay) |
| Apps ecosystem | Email (Klaviyo), reviews (Judge.me/Okendo), Pinterest/Meta channels plug in natively |
| International | Multi-currency, multi-language (Shopify Markets) — key for English-first + Sweden |
| Total cost | Lower total cost of ownership than a custom build at this stage |

**When to reconsider:** if there's already a working store on another platform
(⚠️ **CONFIRM** what `pauseinterior.se` runs on today — likely Shopify,
WooCommerce, Wix, or Squarespace). _If a good store already exists, we improve
it, not replace it._ A rebuild is only justified if the current platform blocks
the brand experience or conversion.

> **Tech stack (Shopify path):** Shopify (Online Store 2.0 theme) · Klaviyo
> (email/SMS) · a reviews app · Shopify Markets (currency/language) · Pinterest &
> Meta sales channels · Google Analytics 4 + Search Console. _Headless
> (Hydrogen/Next.js) is deferred until scale justifies the cost._

---

## 3. Information architecture (sitemap)

```
Home
├── Shop
│   ├── All
│   ├── Furniture
│   ├── Lighting
│   ├── Textiles
│   └── Objects & Décor
│   └── [Product pages]
├── Collections / Lookbook        (curated, editorial; "shop the room")
├── Our Story                     (founder + the Pause philosophy)
├── Journal                       (blog: SEO + slow-living content)
│   └── [Article pages]
├── Sustainability / Materials    (the honest, specific proof)
├── Interior Service              (Phase 2: e-design / styling — lead capture)
├── Help
│   ├── Shipping & Delivery
│   ├── Returns
│   ├── Care & Materials
│   └── FAQ / Contact
└── Footer
    ├── Newsletter sign-up
    ├── Social links
    └── Legal (Privacy, Terms, Cookies)
```

> Keep the top nav to **5–6 items max**. A calm brand has a calm menu.
> Recommended top nav: **Shop · Collections · Our Story · Journal · [cart]**.

---

## 4. Page-by-page spec

### 4.1 Homepage (the first exhale)

Sections, top to bottom:

1. **Hero** — one full-width, natural-light lifestyle image; the tagline
   _"Pause. You're home."_; one quiet CTA (_Explore the collection_). No
   carousel, no pop-up on arrival.
2. **Brand promise strip** — one line: _Fewer, better things, made to last. Designed in Sweden._
3. **Featured collection / hero products** — 3–4 pieces, generous spacing.
4. **The philosophy** — a short, evocative paragraph + image linking to _Our Story_.
5. **Shop by category** — Furniture · Lighting · Textiles · Objects (4 calm tiles).
6. **Materials & sustainability** — a short, honest section linking to proof.
7. **Social proof** — reviews / press / UGC, understated.
8. **Journal teaser** — 2–3 latest articles (signals a living brand + SEO links).
9. **Newsletter** — gentle capture: _"Slow letters, now and then."_
10. **Footer** — nav, social, trust badges, legal.

> A **newsletter pop-up** may appear, but **delayed and gentle** (after ~15s or
> exit-intent), on-brand, easy to dismiss. Never on arrival.

### 4.2 Collection / category page

- Calm grid (2 cols mobile, 3–4 desktop), generous gutters.
- Each card: clean studio image (hover → lifestyle), name, price, material tag.
- Light filtering only (material, price, type) — don't over-engineer.
- Short editorial intro paragraph at top (SEO + tone).

### 4.3 Product page (the conversion moment)

The most important commercial page. Layout:

- **Gallery** (left/large): the three shot types (§02-5.2) — hero, studio,
  detail, plus scale/in-room. Zoomable. Optional ambient video.
- **Buy box** (right): name · price · short evocative line · size/finish options
  · quantity · **one clear "Add to your home" button** · delivery estimate ·
  trust line (returns, made-to-last).
- **Story block** (below): the piece's story — _feeling first, then_ material,
  dimensions, maker, care, sustainability. Specific and honest.
- **Trust band:** complimentary delivery threshold · easy returns · secure
  checkout · made-to-last guarantee.
- **Reviews.**
- **"Pairs well with"** — 2–3 complementary pieces (raises AOV, on-brand
  curation, not aggressive upsell).

> Conversion principles: one primary CTA, no clutter, visible trust signals,
> honest delivery/returns info **before** checkout, fast image loading.

### 4.4 Our Story (the brand's heart)

The founder's story, told properly (⚠️ **CONFIRM** the real story). Why Pause
began, what "pause" means to her, the values, "Designed in Sweden", a portrait.
This page converts browsers into believers — invest in it.

### 4.5 Journal (the SEO + content engine)

Blog index + article template optimised for reading and search: big imagery,
generous type, clear headings, internal links to products and other articles,
share buttons (esp. Pinterest), newsletter capture at the end. _(Content plan
lives in 04-MARKETING-PLAYBOOK.)_

### 4.6 Sustainability / Materials

The honest, specific proof behind the value (§01-2). Where materials come from,
why they last, packaging, what we're still improving. Specific > vague. This page
defends the premium and pre-empts greenwashing doubt.

### 4.7 Help / Shipping / Returns / FAQ

Clear, warm, reassuring. Reducing pre-purchase anxiety is conversion work.
⚠️ **CONFIRM** real shipping zones, costs, lead times, and returns policy.

---

## 5. Conversion-rate optimisation (CRO) baseline

Build these in from day one:

- **Mobile-first** — most interior browsing is mobile; design there first.
- **Speed** — compress/lazy-load images, fast theme. Slow = lost sales and worse
  SEO. Target Largest Contentful Paint < 2.5s.
- **One primary CTA per screen** — never compete for the click.
- **Trust signals everywhere** — reviews, secure-checkout, returns, real human
  contact, "Designed in Sweden".
- **Frictionless checkout** — guest checkout, express wallets, minimal fields,
  Klarna/instalments for higher-ticket furniture.
- **Honest logistics up front** — surprise shipping cost at checkout is the #1
  abandonment cause. Show it early.
- **Abandoned-cart recovery** — via Klaviyo (see 04).
- **Email capture** — lead magnet (a styling guide / welcome offer) to turn
  traffic into an owned audience.

> **Measure:** site conversion rate, add-to-cart rate, checkout completion, AOV.
> Improving these is cheaper than buying more traffic.

---

## 6. SEO foundation (so content compounds)

- **Technical:** clean URLs, fast, mobile, HTTPS, XML sitemap, structured data
  (Product, Article, Organization, Breadcrumb), submitted to Google Search
  Console.
- **On-page:** unique title + meta description per page; one H1; descriptive
  alt text on every image (also accessibility); internal linking
  journal↔products.
- **Content:** the Journal targets real buyer searches — _"how to make a small
  room feel calm", "natural materials for a calm home", "Scandinavian styling
  guide"_ (full plan in 04).
- **International:** `hreflang` if/when Swedish + English versions coexist; decide
  English-first default per the founder's direction. ⚠️ **CONFIRM** whether the
  current site is Swedish, and whether to run EN + SV or EN-only.

---

## 7. Tracking & analytics (decide before launch, not after)

| Tool | Purpose |
|---|---|
| **Google Analytics 4** | Traffic, behaviour, conversions |
| **Google Search Console** | SEO health, queries, indexing |
| **Klaviyo** | Email/SMS, flows, list growth, revenue attribution |
| **Meta Pixel / Pinterest Tag** | Retargeting + ad measurement |
| **Shopify Analytics** | Sales, AOV, repeat rate, product performance |
| **(Optional) Hotjar/Clarity** | Session recordings to find UX friction |

> Define the **5 weekly numbers** (01-§14): email sign-ups, sessions, conversion
> rate, revenue, repeat-purchase rate. Make sure each is tracked **before**
> launch.

---

## 8. Legal & compliance (EU/Sweden)

⚠️ **CONFIRM with the founder / an advisor** — but build for:

- **GDPR**: cookie consent banner, privacy policy, lawful email opt-in.
- **EU consumer law**: clear pricing incl. VAT, 14-day right of withdrawal,
  terms & conditions, company details in footer.
- **Cookie consent** wired to analytics/marketing tags.
- **Accessibility**: good contrast (the soft palette still needs to pass), alt
  text, keyboard navigation, semantic structure.

---

## 9. Pre-launch checklist

- [ ] Confirm current platform & whether we improve vs. rebuild
- [ ] Core-collection photography shot and edited (§02-5)
- [ ] All products: 3 shot types, story copy, dimensions, materials, care
- [ ] Homepage, Our Story, Sustainability, Help pages written (brand voice)
- [ ] Shipping, returns, FAQ filled with **real** policy
- [ ] Klaviyo connected; welcome + cart-abandon flows live (see 04)
- [ ] Lead magnet + newsletter capture live
- [ ] Reviews app installed (even with seed reviews from early customers)
- [ ] GA4 + Search Console + Pixel/Tag installed and tested
- [ ] Mobile + speed tested (LCP < 2.5s); checkout tested end-to-end
- [ ] GDPR/cookie/legal pages live
- [ ] Soft-launch to a warm circle before public launch

---

## Appendix — Build phasing

- **MVP (launch):** Home · Shop · Product · Our Story · Help · Journal (a few
  articles) · newsletter + core email flows. _Ship this._
- **Phase 2:** Interior Service page (lead capture) · richer Journal · UGC
  gallery · Pinterest-rich content.
- **Phase 3:** Membership / "Pause Circle" area · trade/B2B portal ·
  multi-currency expansion · headless if scale demands it.

> **Principle:** launch the MVP that is _excellent_, not the everything that is
> _average_. The store should feel finished and calm on day one, even if small.
