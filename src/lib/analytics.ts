/**
 * Lichte, privacy-vriendelijke productanalytics. Schrijft events naar Supabase
 * (`analytics_events`), gekoppeld aan de anonieme sessie — geen persoonsgegevens.
 *
 * Eén event = één insert (prima bij lage volumes; later te batchen). Sessieduur
 * leiden we af uit session_start + periodieke heartbeats per `session_id`.
 */
import { supabase, ensureAnonSession } from './supabase'

const SESSION_KEY = 'ijhop:analytics:session'

/** Heartbeat-cadans en -plafond; samen bepalen ze tot hoever we sessieduur
 *  kunnen meten (30s × 20 = 10 minuten) en hoeveel events dat maximaal kost. */
export const HEARTBEAT_MS = 30_000
export const HEARTBEAT_MAX = 20

/** Willekeurig id, ook als crypto.randomUUID ontbreekt (oudere Safari, niet-
 *  beveiligde context). Faalt nooit, want hierop hangt de sessie-telling. */
export function randomId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    /* val door naar de eenvoudige variant */
  }
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

// Reserve-sessie-id in het geheugen, per pagina-instantie.
let memorySessionId: string | null = null

/** Sessie-id per tab. Zonder sessionStorage (privémodus, geblokkeerde opslag)
 *  krijgt elk bezoek een eigen id in het geheugen. Voorheen kregen al die
 *  bezoeken de letterlijke string 'nosession', waardoor honderden losse
 *  bezoeken in het dashboard samenklonterden tot één sessie: precies waarom
 *  er minder sessies dan gebruikers geteld werden. */
export function sessionId(): string {
  try {
    let s = sessionStorage.getItem(SESSION_KEY)
    if (!s) {
      s = randomId()
      sessionStorage.setItem(SESSION_KEY, s)
    }
    return s
  } catch {
    if (!memorySessionId) memorySessionId = randomId()
    return memorySessionId
  }
}

/** Alleen voor tests: vergeet de geheugen-reserve tussen gevallen. */
export function resetMemorySessionForTests(): void {
  memorySessionId = null
}

/** Stuurt één event in. Faalt stil (analytics mag nooit de app breken). */
export async function track(name: string, props?: Record<string, unknown>): Promise<void> {
  const client = supabase
  if (!client) return
  try {
    const userId = await ensureAnonSession()
    if (!userId) return
    await client.from('analytics_events').insert({
      user_id: userId,
      session_id: sessionId(),
      name,
      props: props ?? null,
      path: typeof location !== 'undefined' ? location.pathname + location.hash : null,
    })
  } catch {
    /* stil */
  }
}

let started = false

/** Start auto-tracking: sessiestart, zichtbaarheid en heartbeats. */
export function startAnalytics(): void {
  if (started || typeof window === 'undefined') return
  started = true

  track('session_start', {
    ref: document.referrer || null,
    lang: navigator.language,
    standalone:
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true,
    w: window.screen?.width ?? null,
    h: window.screen?.height ?? null,
  })

  document.addEventListener('visibilitychange', () => {
    track(document.visibilityState === 'visible' ? 'app_visible' : 'app_hidden')
  })

  // Heartbeat houdt de sessieduur bij zolang de app zichtbaar is.
  //
  // Elke 30 seconden in plaats van 60: bij 60s viel iedereen die korter dan
  // een minuut keek buiten de meting, want dan is `session_start` het enige
  // tijdstip dat we hebben. Met 30s vangen we die bezoeken wél.
  //
  // En begrensd op 10 minuten per sessie: daarvoor tikte een tab die de hele
  // dag openstond eindeloos door (~1440 events per dag per tab). Voor "hoe
  // lang kijkt iemand naar de klok" is alles boven 10 minuten toch geen
  // bruikbaar signaal meer, dus daar stopt de meting.
  let beats = 0
  const timer = setInterval(() => {
    if (document.visibilityState !== 'visible') return
    if (++beats > HEARTBEAT_MAX) {
      clearInterval(timer)
      return
    }
    track('heartbeat')
  }, HEARTBEAT_MS)
}
