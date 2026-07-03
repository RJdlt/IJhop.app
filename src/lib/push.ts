/**
 * Client voor storings-pushmeldingen. Opt-in en alleen op gebruikersinitiatief:
 * de permissievraag komt pas ná een tik op de uitlegkaart. Abonnement is
 * gekoppeld aan de favoriete lijnen; wijzigen favorieten = abonnement bijwerken.
 */

const STATE_KEY = 'ijhop:push:lines'

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/** Voor welke lijnen zijn we (volgens deze browser) geabonneerd? Null = niet. */
export function subscribedLines(): string[] | null {
  try {
    const raw = localStorage.getItem(STATE_KEY)
    return raw ? (JSON.parse(raw) as string[]) : null
  } catch {
    return null
  }
}

function remember(lines: string[] | null) {
  try {
    if (lines) localStorage.setItem(STATE_KEY, JSON.stringify(lines))
    else localStorage.removeItem(STATE_KEY)
  } catch {
    /* faal stil */
  }
}

function b64ToUint8(base64: string): Uint8Array {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const b = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b)
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

/** Is push server-side geconfigureerd? Zo ja, geef de VAPID public key. */
export async function pushConfig(): Promise<{ enabled: boolean; publicKey: string } | null> {
  try {
    const r = await fetch('/api/push', { signal: AbortSignal.timeout(6000) })
    if (!r.ok) return null
    return (await r.json()) as { enabled: boolean; publicKey: string }
  } catch {
    return null
  }
}

/** Abonneer op storingsmeldingen voor deze lijnen. Vraagt permissie. */
export async function subscribePush(lines: string[]): Promise<'ok' | 'denied' | 'error'> {
  try {
    const cfg = await pushConfig()
    if (!cfg?.enabled) return 'error'
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return 'denied'
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: b64ToUint8(cfg.publicKey).buffer as ArrayBuffer,
    })
    const json = sub.toJSON()
    const r = await fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint, keys: json.keys, lines }),
    })
    if (!r.ok) return 'error'
    remember(lines)
    return 'ok'
  } catch {
    return 'error'
  }
}

/** Zeg het abonnement op (lokaal en op de server). */
export async function unsubscribePush(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await fetch('/api/push', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => undefined)
      await sub.unsubscribe()
    }
  } catch {
    /* faal stil */
  } finally {
    remember(null)
  }
}
