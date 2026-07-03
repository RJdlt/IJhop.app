/**
 * Serverless proxy voor GVB-veerstoringen. Haalt het landelijke GTFS-Realtime
 * alerts-feed (NDOV/OVapi) op, filtert op onze veersteigers en antwoordt met
 * compacte JSON. Edge-cache 120 s zodat de bron hooguit ~30x per uur wordt
 * geraakt. Faalt de bron, dan een leeg antwoord: de app verzint geen storing.
 * Bronkeuze en regels: docs/besluit-storingsbron.md
 */
import GtfsRealtimeBindings from 'gtfs-realtime-bindings'
import { filterFerryAlerts } from '../src/lib/ferryAlerts'
import type { FeedEntity } from '../src/lib/ferryAlerts'

const FEED_URL = 'https://gtfs.ovapi.nl/nl/alerts.pb'

interface Res {
  setHeader(name: string, value: string): void
  status(code: number): { json(body: unknown): void }
}

export default async function handler(_req: unknown, res: Res) {
  try {
    const r = await fetch(FEED_URL, { signal: AbortSignal.timeout(12_000) })
    if (!r.ok) throw new Error(`upstream ${r.status}`)
    const buf = new Uint8Array(await r.arrayBuffer())
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(buf)
    const plain = GtfsRealtimeBindings.transit_realtime.FeedMessage.toObject(feed, {
      longs: String,
      enums: String,
    }) as { entity?: FeedEntity[] }
    const alerts = filterFerryAlerts(plain.entity ?? [], Math.floor(Date.now() / 1000))
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600')
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.status(200).json({ updated: new Date().toISOString(), alerts })
  } catch {
    // Kort cachen zodat een haperende bron niet elke bezoeker raakt.
    res.setHeader('Cache-Control', 's-maxage=60')
    res.status(200).json({ updated: new Date().toISOString(), alerts: [], degraded: true })
  }
}
