/**
 * Pontdeals: ophalen wat er nu loopt, en je eigen code bewaren.
 *
 * De klok blijft de held. Deze module weet daarom vooral wanneer hij zijn
 * mond moet houden: buiten het venster (maandag tot en met woensdag) is er
 * hooguit een rustige teaser, en bij een steiger waar je nooit staat helemaal
 * niets.
 *
 * De code van de gebruiker gaat door `durableStorage`, dus naar localStorage
 * en IndexedDB tegelijk. Aan de kassa is er vaak geen bereik, en een code die
 * je alleen met internet kunt laten zien is geen code.
 */
import { supabase } from './supabase'
import { durableStorage } from './durableStorage'
import { makeDealCode } from './dealCode'
import { amsterdamDay } from './time'

export interface DealPartner {
  name: string
  slug: string
  logo_url: string | null
  address: string | null
  lat: number | null
  lng: number | null
}

export interface Deal {
  id: string
  offer: string
  stop_id: string
  lines: string[]
  walk_min: number | null
  valid_from: string
  valid_to: string
  partner: DealPartner
}

export interface NextDeal {
  valid_from: string
  stop_id: string
  partner: { name: string; logo_url: string | null }
}

export interface MyCode {
  code: string
  redeemed_at: string | null
}

export interface Pontdeal {
  deal: Deal | null
  next: NextDeal | null
  redeemed_week: number
  my_code: MyCode | null
}

/** Vanaf hoeveel inwisselingen we het aantal laten zien. Daaronder is het geen
 *  sociale bevestiging maar een leeg podium. */
export const SOCIAL_PROOF_MIN = 10

const CACHE_KEY = 'ijhop:deal:huidig'
const TIP_KEY = 'ijhop:deal:tip'
const codeKey = (dealId: string) => `ijhop:deal:code:${dealId}`

// ---- Tijd -------------------------------------------------------------------

/** Seconden tot een tijdstip; nooit negatief. */
export function secondsUntil(iso: string, now: Date = new Date()): number {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return 0
  return Math.max(0, Math.round((t - now.getTime()) / 1000))
}

/** Loopt deze deal op dit moment? De database bepaalt hetzelfde, maar de app
 *  moet het ook weten om een gecachete deal niet te lang te tonen. */
export function isLive(deal: Pick<Deal, 'valid_from' | 'valid_to'>, now: Date = new Date()): boolean {
  const van = Date.parse(deal.valid_from)
  const tot = Date.parse(deal.valid_to)
  if (!Number.isFinite(van) || !Number.isFinite(tot)) return false
  return now.getTime() >= van && now.getTime() <= tot
}

/**
 * De afteller in woorden. Boven de dag tellen we in dagen, want "nog 2 dagen"
 * zegt meer dan 51:07:22, en in het laatste uur wordt het minuten. Nooit
 * opgeklopt: dit is echte tijd tot woensdag 23:59.
 */
export function formatDealCountdown(seconds: number, lang: 'nl' | 'en' = 'nl'): string {
  const s = Math.max(0, Math.floor(seconds))
  const dagen = Math.floor(s / 86400)
  const uren = Math.floor((s % 86400) / 3600)
  const minuten = Math.floor((s % 3600) / 60)
  if (lang === 'en') {
    if (dagen >= 1) return dagen === 1 ? '1 day left' : `${dagen} days left`
    if (uren >= 1) return uren === 1 ? '1 hour left' : `${uren} hours left`
    if (minuten >= 1) return `${minuten} min left`
    return 'ends now'
  }
  if (dagen >= 1) return dagen === 1 ? 'nog 1 dag' : `nog ${dagen} dagen`
  if (uren >= 1) return uren === 1 ? 'nog 1 uur' : `nog ${uren} uur`
  if (minuten >= 1) return `nog ${minuten} min`
  return 'loopt af'
}

// ---- Ophalen ----------------------------------------------------------------

/**
 * Wat er nu te halen valt voor deze steigers. Faalt stil en geeft dan de
 * laatst bekende deal uit de opslag terug: onderweg zonder bereik hoort de
 * kaart niet zomaar te verdwijnen.
 */
export async function fetchPontdeal(stops: string[]): Promise<Pontdeal | null> {
  const client = supabase
  if (client) {
    try {
      const { data, error } = await client.rpc('pontdeal', { p_stops: stops.length ? stops : null })
      if (!error && data) {
        const res = data as Pontdeal
        await cacheDeal(res)
        return res
      }
    } catch {
      /* stil: val terug op de cache */
    }
  }
  return readCachedDeal()
}

async function cacheDeal(res: Pontdeal): Promise<void> {
  try {
    await durableStorage.setItem(CACHE_KEY, JSON.stringify(res))
  } catch {
    /* stil */
  }
}

async function readCachedDeal(): Promise<Pontdeal | null> {
  try {
    const raw = await durableStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as Pontdeal) : null
  } catch {
    return null
  }
}

/**
 * Pak je deal. Stelt zelf een code voor; de database beslist en geeft de
 * uiteindelijke code terug. Daarna staat hij lokaal, ook zonder bereik.
 */
export async function claimCode(dealId: string): Promise<MyCode | null> {
  const bewaard = await readCode(dealId)
  const client = supabase
  if (!client) return bewaard
  try {
    const { data, error } = await client.rpc('claim_deal_code', {
      p_deal: dealId,
      p_code: makeDealCode(),
    })
    if (error || !data) return bewaard
    const res = data as { code: string; redeemed_at: string | null }
    const mijn: MyCode = { code: res.code, redeemed_at: res.redeemed_at }
    await storeCode(dealId, mijn)
    return mijn
  } catch {
    return bewaard
  }
}

export async function readCode(dealId: string): Promise<MyCode | null> {
  try {
    const raw = await durableStorage.getItem(codeKey(dealId))
    return raw ? (JSON.parse(raw) as MyCode) : null
  } catch {
    return null
  }
}

export async function storeCode(dealId: string, code: MyCode): Promise<void> {
  try {
    await durableStorage.setItem(codeKey(dealId), JSON.stringify(code))
  } catch {
    /* stil */
  }
}

/** De pagina die de partner scant. Bevat de code, zodat het kassascherm hem
 *  meteen ingevuld heeft. */
export function redeemUrl(partnerSlug: string, code: string): string {
  const basis = typeof location !== 'undefined' ? location.origin : 'https://ijhop.app'
  return `${basis}/partner/${partnerSlug}?code=${encodeURIComponent(code)}`
}

/** Kaartlink naar de partner. Apple Maps op iOS, Google Maps elders. */
export function mapsUrl(p: DealPartner, ios: boolean): string {
  const q = p.lat != null && p.lng != null ? `${p.lat},${p.lng}` : `${p.name} ${p.address ?? 'Amsterdam'}`
  return ios
    ? `https://maps.apple.com/?q=${encodeURIComponent(q)}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}

// ---- Tip een vriend ---------------------------------------------------------

/**
 * Pas de dag ná het inwisselen vragen we of iemand de app doorgeeft, en één
 * keer. Op het moment zelf staat hij aan een kassa met een pizza in zijn hand:
 * dat is geen moment om iets te vragen. De volgende dag is de herinnering nog
 * warm en de vraag niet in de weg.
 */
export function shouldOfferTip(
  redeemedAt: string | null,
  alreadySeen: boolean,
  now: Date = new Date(),
): boolean {
  if (!redeemedAt || alreadySeen) return false
  const t = Date.parse(redeemedAt)
  if (!Number.isFinite(t)) return false
  return amsterdamDay(now) > amsterdamDay(new Date(t))
}

export function tipSeen(): boolean {
  try {
    return localStorage.getItem(TIP_KEY) === '1'
  } catch {
    return false
  }
}

export function markTipSeen(): void {
  try {
    localStorage.setItem(TIP_KEY, '1')
  } catch {
    /* stil */
  }
}
