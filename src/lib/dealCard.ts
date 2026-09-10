/**
 * De regels achter de Pontdeal-kaart: hoe groot hij mag zijn, wat er in het
 * aanbod mag staan, en welke tekst eronder komt.
 *
 * Alles hier is puur en zonder React, zodat het te toetsen is zonder browser.
 */
import { amsterdamMoment } from './time'

// ---- Hoe groot mag de kaart zijn -------------------------------------------

export type DealCardMode = 'compact' | 'normaal' | 'vol'

/**
 * De kaart past zich aan het dagdeel aan.
 *
 * 's Ochtends staat iemand op de steiger naar zijn werk en kijkt hij naar één
 * ding: haal ik die pont. Dan hoort er geen foto van een pizza onder te
 * staan. 's Avonds is de haast eraf en is een goede foto juist wat de deal
 * overtuigend maakt. Daartussenin het midden.
 *
 * Amsterdamse tijd, ook als de telefoon in een andere tijdzone staat.
 */
export function dealCardMode(date: Date = new Date()): DealCardMode {
  const { hour, minute } = amsterdamMoment(date)
  const min = hour * 60 + minute
  if (min >= 6 * 60 && min < 10 * 60 + 30) return 'compact' // spits naar het werk
  if (min >= 10 * 60 + 30 && min < 16 * 60 + 30) return 'normaal'
  if (min >= 16 * 60 + 30 && min < 21 * 60) return 'vol' // avond, tijd om te kiezen
  return 'compact' // nacht
}

/** Toont deze modus een foto? Alleen de volledige kaart doet dat. */
export function modeShowsPhoto(mode: DealCardMode): boolean {
  return mode === 'vol'
}

// ---- Wat mag er in het aanbod staan ----------------------------------------

export const OFFER_MAX_WORDS = 6

export interface OfferCheck {
  ok: boolean
  reason?: string
}

/**
 * Het aanbod moet een eindprijs zijn, geen reclametaal.
 *
 * "20% korting" laat iemand rekenen op een steiger in de wind; "Twee pizza's
 * voor 21 euro" niet. En woorden als gratis en korting maken van een beloning
 * een advertentie, precies wat deze kaart niet mag worden.
 */
export function validateOffer(raw: string): OfferCheck {
  const tekst = (raw ?? '').trim()
  if (tekst === '') return { ok: false, reason: 'Vul het aanbod in.' }

  const woorden = tekst.split(/\s+/).filter(Boolean)
  if (woorden.length > OFFER_MAX_WORDS) {
    return {
      ok: false,
      reason: `Hooguit ${OFFER_MAX_WORDS} woorden; dit zijn er ${woorden.length}. Op een steiger leest niemand een zin.`,
    }
  }
  if (tekst.includes('%')) {
    return {
      ok: false,
      reason: 'Geen percentages. Noem de eindprijs, dan hoeft niemand te rekenen.',
    }
  }
  const laag = tekst.toLowerCase()
  for (const woord of ['korting', 'gratis', 'aanbieding', 'actie']) {
    if (laag.includes(woord)) {
      return {
        ok: false,
        reason: `Laat "${woord}" weg. Dat maakt er reclame van; een Pontdeal is een beloning voor wie staat te wachten.`,
      }
    }
  }
  return { ok: true }
}

// ---- Waar staat de zaak ----------------------------------------------------

/**
 * "3 min lopen vanaf de steiger", of "aan de overkant · 3 min lopen".
 *
 * Welke van de twee hangt af van waar je staat. Ligt de zaak bij een steiger
 * waar je zelf vertrekt, dan loop je er zo heen. Ligt hij bij de steiger waar
 * je aankomt, dan moet je eerst het IJ over, en dat hoort de kaart te zeggen
 * voordat iemand denkt dat het om de hoek is.
 *
 * Staat de steiger aan beide kanten in je lijstje (twee favoriete lijnen die
 * daar samenkomen), dan wint de eigen kant: dat is het gunstigste en het is
 * waar.
 */
export function dealWalkLabel(
  dealStop: string,
  vertrekStops: string[],
  aankomstStops: string[],
  walkMin: number | null | undefined,
  lang: 'nl' | 'en' = 'nl',
): string {
  const minuten = walkMin != null && walkMin > 0 ? walkMin : null
  const eigenKant = vertrekStops.includes(dealStop)
  const overkant = !eigenKant && aankomstStops.includes(dealStop)

  if (lang === 'en') {
    if (minuten == null) return overkant ? 'across the water' : 'at the ferry stop'
    return overkant
      ? `across the water · ${minuten} min walk`
      : `${minuten} min walk from the ferry stop`
  }
  if (minuten == null) return overkant ? 'aan de overkant' : 'bij de steiger'
  return overkant
    ? `aan de overkant · ${minuten} min lopen`
    : `${minuten} min lopen vanaf de steiger`
}

// ---- Tot wanneer loopt hij -------------------------------------------------

const DAGEN_NL = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag']
const DAGEN_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/**
 * "t/m woensdag" zolang er nog dagen zijn, "nog vandaag" in de laatste
 * vierentwintig uur, en buiten het venster "vanaf maandag".
 *
 * Bewust geen aftellende klok in uren en minuten: die hoort bij de pont, niet
 * bij een deal die dagen loopt. Nep-urgentie is precies wat deze kaart niet
 * doet.
 */
export function dealValidityLabel(
  validTo: string,
  now: Date = new Date(),
  lang: 'nl' | 'en' = 'nl',
  live = true,
): string {
  if (!live) return lang === 'en' ? 'from Monday' : 'vanaf maandag'
  const eind = Date.parse(validTo)
  if (!Number.isFinite(eind)) return ''
  const resterend = eind - now.getTime()
  if (resterend <= 0) return lang === 'en' ? 'from Monday' : 'vanaf maandag'
  if (resterend <= 24 * 3600_000) return lang === 'en' ? 'today only' : 'nog vandaag'
  const dag = amsterdamMoment(new Date(eind)).weekday
  return lang === 'en' ? `through ${DAGEN_EN[dag]}` : `t/m ${DAGEN_NL[dag]}`
}

// ---- De eigendomsstrook ----------------------------------------------------

export type StripStatus = 'geen' | 'gepakt' | 'ingewisseld'

/** Hoe lang de "Ingewisseld"-strook blijft staan na afloop. */
export const REDEEMED_STRIP_MS = 24 * 3600_000

/**
 * Wat er boven de kaart hoort te staan.
 *
 * Zodra je de code hebt is de deal van jou, en dat mag je zien zonder ernaar
 * te zoeken. Na inwisselen blijft de strook nog een dag staan als bevestiging
 * dat het gelukt is, en verdwijnt dan vanzelf.
 */
export function stripStatus(
  code: { code: string; redeemed_at: string | null } | null,
  validTo: string | null,
  now: Date = new Date(),
): StripStatus {
  if (!code) return 'geen'
  if (code.redeemed_at) {
    const t = Date.parse(code.redeemed_at)
    if (!Number.isFinite(t)) return 'geen'
    return now.getTime() - t <= REDEEMED_STRIP_MS ? 'ingewisseld' : 'geen'
  }
  if (!validTo) return 'geen'
  const eind = Date.parse(validTo)
  if (!Number.isFinite(eind) || now.getTime() > eind) return 'geen'
  return 'gepakt'
}
