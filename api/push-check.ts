/**
 * Periodieke storingscontrole (aangeroepen door pg_cron, elke 5 minuten):
 * haalt de actuele veeralerts op en stuurt elke NIEUWE storing één keer als
 * pushmelding naar abonnees met een geraakte favoriete lijn. Beveiligd met
 * een secret; dedupliceert via de push_sent-tabel. Nooit marketing.
 */
import webpush from 'web-push'
import GtfsRealtimeBindings from 'gtfs-realtime-bindings'
import { filterFerryAlerts } from '../src/lib/ferryAlerts'
import type { FeedEntity, FerryAlert } from '../src/lib/ferryAlerts'
import timetable from '../src/data/timetable.json'

const FEED_URL = 'https://gtfs.ovapi.nl/nl/alerts.pb'
const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '')
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

interface Req { query?: Record<string, string | string[]> ; url?: string }
interface Res {
  setHeader(name: string, value: string): void
  status(code: number): { json(body: unknown): void }
}
interface Sub { endpoint: string; p256dh: string; auth: string; lines: string[] }

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
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

/** Welke lijnen raakt een alert? Lege stops = algemene veermelding = alle lijnen. */
function affectedLines(a: FerryAlert): string[] {
  const lines = Object.values(timetable.lines) as { name: string; connects: string[] }[]
  if (a.stops.length === 0) return lines.map((l) => l.name)
  const hit = new Set(a.stops)
  return lines.filter((l) => l.connects.some((s) => hit.has(s))).map((l) => l.name)
}

export default async function handler(req: Req, res: Res) {
  res.setHeader('Cache-Control', 'no-store')
  const secret = typeof req.query?.secret === 'string' ? req.query.secret : ''
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    res.status(401).json({ ok: false })
    return
  }
  if (!SUPABASE_URL || !SERVICE_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_PUBLIC_KEY) {
    res.status(200).json({ ok: false, error: 'push niet geconfigureerd' })
    return
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:robertjandelaat@gmail.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )

  // 1. Actuele veeralerts.
  const r = await fetch(FEED_URL, { signal: AbortSignal.timeout(12_000) })
  if (!r.ok) {
    res.status(200).json({ ok: false, error: `upstream ${r.status}` })
    return
  }
  const buf = new Uint8Array(await r.arrayBuffer())
  const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(buf)
  const plain = GtfsRealtimeBindings.transit_realtime.FeedMessage.toObject(feed, { longs: String }) as {
    entity?: FeedEntity[]
  }
  const alerts = filterFerryAlerts(plain.entity ?? [], Math.floor(Date.now() / 1000))
  if (alerts.length === 0) {
    res.status(200).json({ ok: true, alerts: 0, sent: 0 })
    return
  }

  // 2. Alleen storingen die we nog niet gemeld hebben.
  const sentResp = await rest(`push_sent?select=alert_id&alert_id=in.(${alerts.map((a) => `"${a.id}"`).join(',')})`)
  const sentIds = new Set(((await sentResp.json()) as { alert_id: string }[]).map((x) => x.alert_id))
  const fresh = alerts.filter((a) => !sentIds.has(a.id))
  if (fresh.length === 0) {
    res.status(200).json({ ok: true, alerts: alerts.length, sent: 0 })
    return
  }

  // 3. Abonnees laden en per storing de geraakte lijnen matchen.
  const subsResp = await rest('push_subscriptions?select=endpoint,p256dh,auth,lines')
  const subs = ((await subsResp.json()) as Sub[]) ?? []
  let sent = 0
  const dead: string[] = []
  for (const alert of fresh) {
    const lines = affectedLines(alert)
    const payload = JSON.stringify({
      title: `Storing op pont ${lines.length <= 3 ? lines.join(', ') : 'GVB'}`,
      body: alert.header,
      tag: alert.id,
      url: '/',
    })
    for (const sub of subs) {
      if (!sub.lines.some((l) => lines.includes(l))) continue
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        )
        sent++
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode ?? 0
        if (code === 404 || code === 410) dead.push(sub.endpoint) // abonnement bestaat niet meer
      }
    }
    await rest('push_sent', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify({ alert_id: alert.id }),
    })
  }
  // 4. Dode abonnementen opruimen.
  for (const endpoint of new Set(dead)) {
    await rest(`push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, { method: 'DELETE' })
  }
  res.status(200).json({ ok: true, alerts: alerts.length, fresh: fresh.length, sent, cleaned: dead.length })
}
