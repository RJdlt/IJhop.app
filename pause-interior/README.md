# Pause Interior — Brand & Business Build

> Building **[Pause Interior](https://pauseinterior.se)** — a Swedish interior
> brand — into a professional, online-first business, the way
> [Vastelasten.app](https://vastelasten.app) was built. English-first.

This folder holds the strategy and build documents for Pause Interior. We start
with the foundation — the business concept — and layer the brand, website, and
marketing on top of it.

## Documents — the complete brand & business kit

| # | Document | Status |
|---|---|---|
| 01 | [Business Concept](./01-BUSINESS-CONCEPT.md) — vision, market, customer, positioning, model, marketing engine, roadmap | ✅ v1.0 |
| 02 | [Brand Identity & Voice](./02-BRAND-IDENTITY.md) — essence, voice/tone, colour, type, photography, applications | ✅ v1.0 |
| 03 | [Website & E-commerce Spec](./03-WEBSITE-SPEC.md) — platform, sitemap, page-by-page, CRO, SEO, launch checklist | ✅ v1.0 |
| 04 | [Marketing Playbook](./04-MARKETING-PLAYBOOK.md) — content engine, channels, email flows + copy, 90-day calendar | ✅ v1.0 |
| 05 | [Financial Model](./05-FINANCIAL-MODEL.md) + [spreadsheet](./05-financial-model.csv) — unit economics, LTV:CAC, scenarios | ✅ v1.0 |

> All five build on each other and on the same brand idea. They are
> ready-to-use, with founder inputs flagged `⚠️ CONFIRM` throughout.

### Share-ready business plan (PDF / Word)

A single, polished **business plan** that synthesises all five documents — and
adds a section on **how Robert-Jan helps build it** for the founder — is
available to share:

- 📄 **[Pause-Interior-Business-Plan.pdf](./Pause-Interior-Business-Plan.pdf)**
- 📝 **[Pause-Interior-Business-Plan.docx](./Pause-Interior-Business-Plan.docx)** (editable Word)
- 🧩 [Pause-Interior-Business-Plan.html](./Pause-Interior-Business-Plan.html) (source; regenerate the PDF/Word from this)

> Regenerate after edits: `python3 -c "from weasyprint import HTML; HTML('Pause-Interior-Business-Plan.html').write_pdf('Pause-Interior-Business-Plan.pdf')"`
> and `python3 -c "from htmldocx import HtmlToDocx; from docx import Document; d=Document(); HtmlToDocx().add_html_to_document(open('Pause-Interior-Business-Plan.html').read(), d); d.save('Pause-Interior-Business-Plan.docx')"`

## How this is meant to be used

1. The founder reads **[01-BUSINESS-CONCEPT.md](./01-BUSINESS-CONCEPT.md)** and
   answers the open questions in **Appendix A** (the `⚠️ CONFIRM` items) — these
   recur across all five documents.
2. Those answers turn the strategy from a strong template into _her_ specific,
   numbers-real plan.
3. Execution order follows the roadmap in 01-§15: lock concept → brand (02) →
   build site (03) → run the 90-day marketing plan (04) → track against the
   model (05).

## A note on sourcing

The live site (`pauseinterior.se`) could not be fetched from the build
environment (its network policy blocks the domain), so the exact current
catalogue, prices, and assets are flagged `⚠️ CONFIRM` rather than assumed.
Everything else is grounded in the brand's consistent public positioning:
_Swedish interior · natural materials · timeless design · sustainable
production · the feeling of coming home — a pause._

## Principle

> **Pause Interior does not sell furniture. It sells the feeling of a calmer
> home — fewer, better things, told beautifully.**
