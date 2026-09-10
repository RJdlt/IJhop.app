/**
 * Het bezoekersprofiel: sinds wanneer iemand IJhop gebruikt, het hoeveelste
 * bezoek dit is, en in welke arm van de installatie-proef hij zit.
 *
 * Waarom dit niet in gewone localStorage staat: precies deze drie dingen zijn
 * waardeloos zodra ze per bezoek opnieuw beginnen. Ze gaan daarom door
 * `durableStorage`, dus naar localStorage én IndexedDB, met herstel uit
 * IndexedDB zodra localStorage leeg blijkt. Zie durableStorage.ts voor wat dat
 * wel en niet opvangt.
 */
import { durableStorage } from './durableStorage'
import { ensureAnonSession } from './supabase'
import { randomId } from './id'

export type Variant = 'A' | 'B'

export interface Profile {
  /** Het anonieme Supabase-user_id, of een lokaal reserve-id als Supabase uit staat. */
  id: string
  /** Amsterdamse kalenderdag van het eerste bezoek, als YYYY-MM-DD. */
  first_seen: string
  /** Het hoeveelste bezoek dit is; 1 bij het allereerste. */
  visits: number
  variant: Variant
  /** Of we het `installed`-event al ingestuurd hebben (hoeft maar één keer). */
  installed_reported?: boolean
}

const KEY = 'ijhop:profile'
const COUNTED_KEY = 'ijhop:profile:counted'

/**
 * Deterministische 50/50-verdeling uit het id (FNV-1a). Hetzelfde id levert
 * altijd dezelfde variant op, dus ook als het profiel ooit kwijtraakt komt
 * iemand niet in de andere arm terecht.
 */
export function variantFor(id: string): Variant {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) % 2 === 0 ? 'A' : 'B'
}

/** Amsterdamse kalenderdag als YYYY-MM-DD, ook als de telefoon elders staat. */
export function amsterdamDay(d: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Amsterdam',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d)
  } catch {
    return d.toISOString().slice(0, 10)
  }
}

/**
 * Puur: hoe het profiel eruitziet na dit bezoek.
 *
 * Een bestaand profiel houdt zijn `first_seen` en zijn variant vast, ook als
 * het id ondertussen veranderde (nieuwe anonieme sessie na gewiste opslag).
 * Anders zou iemand halverwege de proef van arm wisselen en zou zijn cohort
 * naar vandaag verspringen.
 */
export function nextProfile(prev: Profile | null, id: string, today: string): Profile {
  if (!prev) return { id, first_seen: today, visits: 1, variant: variantFor(id) }
  return {
    ...prev,
    id,
    first_seen: prev.first_seen || today,
    visits: (prev.visits || 0) + 1,
    variant: prev.variant === 'A' || prev.variant === 'B' ? prev.variant : variantFor(id),
  }
}

function parse(raw: string | null): Profile | null {
  if (!raw) return null
  try {
    const p = JSON.parse(raw) as Profile
    return p && typeof p.id === 'string' ? p : null
  } catch {
    return null
  }
}

async function read(): Promise<Profile | null> {
  try {
    return parse(await durableStorage.getItem(KEY))
  } catch {
    return null
  }
}

async function write(p: Profile): Promise<void> {
  try {
    await durableStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    /* stil: opslag mag de app nooit breken */
  }
}

/** Is dit bezoek al geteld in deze tab? Zonder sessionStorage tellen we
 *  hooguit één keer per pagina-instantie, want de module blijft in het
 *  geheugen staan. */
function alreadyCounted(): boolean {
  try {
    return sessionStorage.getItem(COUNTED_KEY) === '1'
  } catch {
    return false
  }
}
function markCounted(): void {
  try {
    sessionStorage.setItem(COUNTED_KEY, '1')
  } catch {
    /* stil */
  }
}

let pending: Promise<Profile> | null = null

/**
 * Het profiel voor dit bezoek. Telt het bezoek één keer mee, hoe vaak je deze
 * functie ook aanroept: alle aanroepers delen dezelfde belofte.
 */
export function profile(): Promise<Profile> {
  if (!pending) pending = load()
  return pending
}

async function load(): Promise<Profile> {
  const prev = await read()
  let id: string | null = null
  try {
    id = await ensureAnonSession()
  } catch {
    /* Supabase uit of onbereikbaar: val terug op wat we lokaal hebben */
  }
  const useId = id ?? prev?.id ?? randomId()
  if (alreadyCounted() && prev) return prev
  const next = nextProfile(prev, useId, amsterdamDay())
  markCounted()
  await write(next)
  return next
}

/** Onthoudt dat het `installed`-event verstuurd is. */
export async function markInstalledReported(): Promise<void> {
  const p = await profile()
  if (p.installed_reported) return
  p.installed_reported = true
  await write(p)
}

/** Alleen voor tests: vergeet het gedeelde profiel tussen gevallen. */
export function resetProfileForTests(): void {
  pending = null
}
