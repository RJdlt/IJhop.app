/**
 * Lichte, privacy-vriendelijke productanalytics. Schrijft events naar Supabase
 * (`analytics_events`), gekoppeld aan de anonieme sessie — geen persoonsgegevens.
 *
 * Eén event = één insert (prima bij lage volumes; later te batchen). Sessieduur
 * leiden we af uit session_start + periodieke heartbeats per `session_id`.
 */
import { supabase, ensureAnonSession } from './supabase'
import { randomId } from './id'
import { profile, markInstalledReported } from './profile'
import { isStandalone } from './display'

// Blijft hier beschikbaar voor bestaande imports; de implementatie staat in id.ts.
export { randomId }

const SESSION_KEY = 'ijhop:analytics:session'

/**
 * De versie die dit toestel draait, als commit-hash van zeven tekens.
 *
 * Gaat mee in elk event, niet alleen bij het starten. Een PWA die op een oude
 * build blijft hangen verraadt zich dan bij elke hartslag, en niet pas als
 * iemand de app opnieuw opent; juist die toestellen openen hem zelden opnieuw.
 */
export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'onbekend'

/** Heartbeat-cadans en -plafond; samen bepalen ze tot hoever we sessieduur
 *  kunnen meten (30s × 20 = 10 minuten) en hoeveel events dat maximaal kost. */
export const HEARTBEAT_MS = 30_000
export const HEARTBEAT_MAX = 20

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
      props: { ...(props ?? {}), app_version: APP_VERSION },
      path: typeof location !== 'undefined' ? location.pathname + location.hash : null,
    })
  } catch {
    /* stil */
  }
}

let installReported = false

/** Meldt één keer per bezoeker dat IJhop geïnstalleerd is. */
async function reportInstalled(source: 'appinstalled' | 'display-mode'): Promise<void> {
  if (installReported) return
  installReported = true
  const p = await profile()
  if (p.installed_reported) return
  await markInstalledReported()
  await track('installed', { source, variant: p.variant, visit_nr: p.visits })
}

let started = false

/** Start auto-tracking: sessiestart, zichtbaarheid en heartbeats. */
export function startAnalytics(): void {
  if (started || typeof window === 'undefined') return
  started = true

  track('session_start', {
    ref: document.referrer || null,
    lang: navigator.language,
    standalone: isStandalone(),
    w: window.screen?.width ?? null,
    h: window.screen?.height ?? null,
  })

  // Installatie meten. `appinstalled` vuurt alleen op Android en desktop
  // Chrome; iOS kent dat event niet. Van een iPhone krijgen we maar één
  // signaal dat de app op het beginscherm staat, namelijk dat de app in
  // standalone draait. Daarom melden we ook de eerste sessie die zo start.
  window.addEventListener('appinstalled', () => void reportInstalled('appinstalled'))
  if (isStandalone()) void reportInstalled('display-mode')

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
