/**
 * Lichte, privacy-vriendelijke productanalytics. Schrijft events naar Supabase
 * (`analytics_events`), gekoppeld aan de anonieme sessie — geen persoonsgegevens.
 *
 * Eén event = één insert (prima bij lage volumes; later te batchen). Sessieduur
 * leiden we af uit session_start + periodieke heartbeats per `session_id`.
 */
import { supabase, ensureAnonSession } from './supabase'

const SESSION_KEY = 'ijhop:analytics:session'

function sessionId(): string {
  try {
    let s = sessionStorage.getItem(SESSION_KEY)
    if (!s) {
      s = crypto.randomUUID()
      sessionStorage.setItem(SESSION_KEY, s)
    }
    return s
  } catch {
    return 'nosession'
  }
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
  setInterval(() => {
    if (document.visibilityState === 'visible') track('heartbeat')
  }, 60_000)
}
