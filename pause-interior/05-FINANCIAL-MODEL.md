# Pause Interior — Financial Model & Unit Economics

> _Deliverable 05 · v1.0 · June 2026 · English-first_
> Built on [01-BUSINESS-CONCEPT.md](./01-BUSINESS-CONCEPT.md) §13. This explains
> the model; the companion file **[`05-financial-model.csv`](./05-financial-model.csv)**
> is the editable spreadsheet (open in Excel / Google Sheets). All numbers are
> **illustrative placeholders** — replace the `⚠️ CONFIRM` inputs with real
> figures and the model becomes live.

---

## 1. The one inequality the whole business depends on

> **LTV > CAC** — the lifetime value of a customer must comfortably exceed the
> cost to acquire one. A healthy DTC brand targets **LTV:CAC ≥ 3:1** at maturity.

If that holds, growth spend is an investment. If it doesn't, growth spend is a
leak. Every other number in this model exists to check and improve this one
relationship.

---

## 2. How the model is built (bottom-up)

We never guess a revenue number top-down. We build it from behaviour:

```
Revenue        = Traffic × Conversion Rate × Average Order Value × Purchase Frequency
Gross Profit   = Revenue × Gross Margin %
Contribution   = Gross Profit − Variable Costs (shipping, payment, fulfilment) − CAC
Operating Profit = Contribution − Fixed Costs (platform, tools, salary, overhead)
```

This makes every lever explicit and improvable (§5).

---

## 3. The inputs to confirm (⚠️ the live numbers)

The model is only as real as these. Fill them in with the founder:

| Input | Symbol | Placeholder | Your number |
|---|---|---|---|
| Average Order Value | AOV | 1,200 kr | ⚠️ |
| Gross margin % | GM | 55% | ⚠️ |
| Site conversion rate | CVR | 2.0% | ⚠️ |
| Purchases per customer / year | Freq | 1.6 | ⚠️ |
| Customer lifespan (years) | Life | 3 | ⚠️ |
| Variable cost per order (ship+pay+pack) | VC | 150 kr | ⚠️ |
| Customer acquisition cost | CAC | 250 kr | ⚠️ |
| Monthly fixed costs (tools, platform, etc.) | FC | 8,000 kr | ⚠️ |
| Current monthly traffic | — | ⚠️ | ⚠️ |
| Current email list size | — | ⚠️ | ⚠️ |

> Currency assumed **SEK (kr)** for a Swedish brand; the model works in any
> currency. ⚠️ **CONFIRM** reporting currency and whether prices include VAT.

---

## 4. Unit economics (the per-customer truth)

Using the placeholders above, per **first order**:

| Line | Calculation | Value |
|---|---|---|
| Revenue (AOV) | — | 1,200 kr |
| Gross profit | 1,200 × 55% | 660 kr |
| − Variable cost | — | −150 kr |
| − CAC | — | −250 kr |
| **Contribution (first order)** | 660 − 150 − 250 | **260 kr** |

**Customer Lifetime Value (LTV):**

```
LTV (gross profit) = AOV × GM% × Freq × Life
                   = 1,200 × 55% × 1.6 × 3
                   ≈ 3,168 kr
```

**LTV : CAC** = 3,168 ÷ 250 ≈ **12.7 : 1** _(with placeholders)_ — comfortably
above the 3:1 floor, which tells us the model has room. **But** these are
assumptions: the real test is filling in true numbers, especially **CAC** (which
rises as you scale past the warm audience) and **Freq/Life** (which only real
data confirms).

> **Payback:** first-order contribution is positive (260 kr), so each customer
> pays back acquisition **on the first order** at these inputs — the healthiest
> possible position. Protect it by keeping CAC low (owned/earned marketing) and
> margin high (no discount spiral).

---

## 5. The five levers (and who pulls them)

| Lever | Move it with | Owner |
|---|---|---|
| ↑ **Traffic** | SEO, Pinterest, social, PR, ads (04) | Marketing |
| ↑ **Conversion** | Website UX, photography, trust (02, 03) | Web/Brand |
| ↑ **AOV** | Bundles, product ladder, free-ship threshold | Merch/Marketing |
| ↑ **Frequency/LTV** | Email, retention, membership (04) | CRM |
| ↓ **CAC** | Owned audience, word-of-mouth, organic content | Marketing |

> A 10% gain on each lever compounds multiplicatively on revenue. The marketing
> playbook (04) is designed to push **all five** at once.

---

## 6. Revenue scenarios (illustrative)

A simple monthly view at three traffic levels, holding placeholder CVR (2.0%) and
AOV (1,200 kr):

| Scenario | Monthly sessions | Orders (2% CVR) | Revenue | Gross profit (55%) |
|---|---|---|---|---|
| **Conservative** | 3,000 | 60 | 72,000 kr | 39,600 kr |
| **Base** | 8,000 | 160 | 192,000 kr | 105,600 kr |
| **Stretch** | 20,000 | 400 | 480,000 kr | 264,000 kr |

Then: **Operating profit = Gross profit − variable costs − marketing/CAC − fixed
costs.** The CSV computes this for your real inputs.

> These are **shape illustrations**, not forecasts. Build the real version in the
> CSV once §3 inputs are confirmed, and grow traffic assumptions month-by-month
> from the actual starting point.

---

## 7. The Phase-1 financial goal

For the first 12 months we optimise for **proof, not scale**:

1. **Positive contribution margin per order** (already true at placeholders —
   keep it true as CAC rises).
2. **LTV:CAC ≥ 3:1** on real data.
3. **Email list growth** (the asset that lowers future CAC).
4. **Repeat-purchase rate climbing** (proof of product love → LTV).

Hitting these means the engine works and can be scaled with confidence. Chasing
raw revenue before these are true just scales a leak.

---

## 8. Costs to plan for (so nothing surprises us)

| Type | Examples |
|---|---|
| **One-off setup** | Photography/video shoot, website build, brand assets |
| **Variable (per order)** | Shipping, payment fees (~1.5–3%), packaging, returns |
| **Fixed monthly** | Shopify, Klaviyo, reviews app, domain, any salary/contractor |
| **Marketing** | Ad spend (only when profitable), influencer gifting, PR |
| **Inventory / COGS** | ⚠️ **CONFIRM** — the biggest variable; drives gross margin |

> ⚠️ **Furniture logistics warning:** shipping, breakage, and returns on large
> items can quietly destroy margin. Model them explicitly; lead the range with
> higher-margin smaller goods (textiles, objects, lighting) to keep blended
> economics healthy.

---

## 9. How to use the CSV

1. Open **[`05-financial-model.csv`](./05-financial-model.csv)** in Google Sheets
   or Excel.
2. Replace every value in the **"Your number"** column (the ⚠️ inputs).
3. The **Outputs** and **Scenarios** sections show LTV, CAC ratio, contribution,
   and monthly profit. _(In the CSV these are written as plain values with the
   formula shown; in Sheets, convert the formula column to live formulas to make
   it interactive.)_
4. Revisit monthly with **real** data from Shopify + Klaviyo + GA4. The model
   gets more accurate every month.

---

## Appendix — Financial open questions for the founder (⚠️)

1. Reporting **currency** and whether prices include **VAT**.
2. **COGS / gross margin** per category (the single most important number).
3. Current **AOV**, **conversion rate**, **traffic**, **email list** (if any).
4. **Sourcing model** (own-made vs. curated) — drives margin and inventory risk.
5. **Shipping/returns** costs, especially for furniture.
6. **Budget** available for setup (photography, build) and monthly marketing.
7. **Time/team** available — determines realistic growth pace.
8. Any **current revenue** to use as the baseline for forecasts.
