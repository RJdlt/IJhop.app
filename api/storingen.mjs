/**
 * Serverless proxy voor GVB-veerstoringen. Haalt het landelijke GTFS-Realtime
 * alerts-feed (NDOV/OVapi) op, filtert op onze veersteigers en antwoordt met
 * compacte JSON. Edge-cache 120 s. Faalt de bron, dan een leeg antwoord met
 * degraded-vlag: de app verzint geen storing.
 *
 * Plain ESM-JavaScript met createRequire voor de CommonJS protobuf-library:
 * de TS-variant crashte op Vercel (ESM-runtime door "type":"module").
 * Bronkeuze en regels: docs/besluit-storingsbron.md
 */
import { createRequire } from 'node:module'
import { filterFerryAlerts } from './_lib/ferryAlerts.mjs'

const require = createRequire(import.meta.url)
const FEED_URL = 'https://gtfs.ovapi.nl/nl/alerts.pb'

export default async function handler(_req, res) {
  try {
    const { transit_realtime } = require('gtfs-realtime-bindings')
    const r = await fetch(FEED_URL, { signal: AbortSignal.timeout(12_000) })
    if (!r.ok) throw new Error(`upstream ${r.status}`)
    const buf = new Uint8Array(await r.arrayBuffer())
    const feed = transit_realtime.FeedMessage.decode(buf)
    const plain = transit_realtime.FeedMessage.toObject(feed, { longs: String, enums: String })
    const alerts = filterFerryAlerts(plain.entity ?? [], Math.floor(Date.now() / 1000))
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600')
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.status(200).json({ updated: new Date().toISOString(), alerts })
  } catch (e) {
    // Kort cachen en de fout benoemen: zichtbaar falen in plaats van een 500.
    res.setHeader('Cache-Control', 's-maxage=60')
    res.status(200).json({
      updated: new Date().toISOString(),
      alerts: [],
      degraded: true,
      error: e instanceof Error ? e.message : String(e),
    })
  }
}
