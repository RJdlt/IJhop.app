/**
 * Web-push abonnementenbeheer.
 *   GET    -> { enabled, publicKey }  (VAPID public key voor de client)
 *   POST   -> abonnement opslaan/bijwerken { endpoint, keys:{p256dh,auth}, lines[] }
 *   DELETE -> abonnement verwijderen { endpoint }
 *
 * Opslag via de Supabase service-role (RLS-tabellen zonder policies), zodat
 * clients nooit andermans abonnementen kunnen lezen.
 */

interface Req {
  method?: string
  body?: unknown
}
interface Res {
  setHeader(name: string, value: string): void
  status(code: number): { json(body: unknown): void }
}

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '')
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

async function rest(path: string, init: RequestInit): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
}

export default async function handler(req: Req, res: Res) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'GET') {
    const publicKey = process.env.VAPID_PUBLIC_KEY || ''
    res.status(200).json({ enabled: Boolean(publicKey && SERVICE_KEY && SUPABASE_URL), publicKey })
    return
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    res.status(200).json({ ok: false, error: 'push niet geconfigureerd' })
    return
  }

  const body = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {}) as {
    endpoint?: string
    keys?: { p256dh?: string; auth?: string }
    lines?: unknown
  }
  const endpoint = typeof body.endpoint === 'string' ? body.endpoint : ''
  if (!endpoint.startsWith('https://') || endpoint.length > 1000) {
    res.status(400).json({ ok: false, error: 'ongeldig endpoint' })
    return
  }

  if (req.method === 'DELETE') {
    await rest(`push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, { method: 'DELETE' })
    res.status(200).json({ ok: true })
    return
  }

  if (req.method === 'POST') {
    const p256dh = body.keys?.p256dh ?? ''
    const auth = body.keys?.auth ?? ''
    const lines = Array.isArray(body.lines)
      ? body.lines.filter((l): l is string => typeof l === 'string' && /^[A-Z0-9]{1,6}$/.test(l)).slice(0, 12)
      : []
    if (!p256dh || !auth) {
      res.status(400).json({ ok: false, error: 'ongeldige sleutels' })
      return
    }
    const r = await rest('push_subscriptions?on_conflict=endpoint', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ endpoint, p256dh, auth, lines }),
    })
    res.status(200).json({ ok: r.ok })
    return
  }

  res.status(405).json({ ok: false, error: 'method not allowed' })
}
