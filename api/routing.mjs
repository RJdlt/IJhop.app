/**
 * Reistijden voor de aankomstplanner.
 *
 * De app stuurt een lijstje trajecten en krijgt seconden terug. De sleutel van
 * OpenRouteService blijft hier; hij staat als ORS_API_KEY in de omgeving van
 * Vercel en komt nooit in de app-bundel.
 *
 * Cache en dagteller lopen via Supabase met de service-role-sleutel, dezelfde
 * die push.ts en push-check.mjs al gebruiken. Zie api/_lib/routing.mjs voor de
 * afweging tussen ORS en Mapbox.
 */
import { makeOrsFetcher, resolveRoutes, tally } from './_lib/routing.mjs'

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '')
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const ORS_KEY = process.env.ORS_API_KEY || ''

/** Hoeveel trajecten we per aanroep aannemen. Een planning vraagt er hooguit
 *  een stuk of dertig; alles daarboven is geen planner meer. */
const MAX_PAIRS = 40

async function rest(path, init = {}) {
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

async function rpc(naam, body) {
  const r = await rest(`rpc/${naam}`, { method: 'POST', body: JSON.stringify(body ?? {}) })
  if (!r.ok) throw new Error(`${naam} ${r.status}`)
  const tekst = await r.text()
  return tekst ? JSON.parse(tekst) : null
}

function geldigPunt(p) {
  return (
    p &&
    typeof p.lat === 'number' &&
    typeof p.lon === 'number' &&
    p.lat > 50 &&
    p.lat < 54 &&
    p.lon > 3 &&
    p.lon < 8
  )
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'alleen POST' })
    return
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {}
    const mode = body.mode === 'fiets' ? 'fiets' : 'lopen'
    const pairs = Array.isArray(body.pairs) ? body.pairs.slice(0, MAX_PAIRS) : []

    // Alleen punten in en rond Amsterdam. Dit endpoint is geen open
    // routeringsdienst voor de rest van de wereld.
    if (pairs.length === 0 || !pairs.every((p) => geldigPunt(p?.from) && geldigPunt(p?.to))) {
      res.status(400).json({ ok: false, error: 'ongeldige trajecten' })
      return
    }

    const heeftDb = Boolean(SUPABASE_URL && SERVICE_KEY)

    let budgetLeft = 0
    if (ORS_KEY && heeftDb) {
      try {
        budgetLeft = Number(await rpc('routing_budget_left', { p_limit: 2000 })) || 0
      } catch {
        // Teller onbereikbaar: dan liever voorzichtig een klein aantal doen
        // dan blind de limiet opmaken.
        budgetLeft = 20
      }
    } else if (ORS_KEY) {
      budgetLeft = 20
    }

    const results = await resolveRoutes(pairs, mode, {
      budgetLeft,
      getCached: async (keys) => {
        if (!heeftDb) return {}
        const lijst = keys.map((k) => `"${k.replace(/"/g, '')}"`).join(',')
        const r = await rest(
          `routing_cache?select=cache_key,seconds&cache_key=in.(${encodeURIComponent(lijst)})&created_at=gte.${
            new Date(Date.now() - 7 * 86400_000).toISOString()
          }`,
        )
        if (!r.ok) return {}
        const rows = await r.json()
        return Object.fromEntries(rows.map((x) => [x.cache_key, x.seconds]))
      },
      putCached: async (nieuw) => {
        if (!heeftDb) return
        const rows = Object.entries(nieuw).map(([cache_key, seconds]) => ({ cache_key, seconds }))
        await rest('routing_cache?on_conflict=cache_key', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates' },
          body: JSON.stringify(rows),
        })
      },
      fetchOrs: ORS_KEY ? makeOrsFetcher(ORS_KEY) : undefined,
    })

    const t = tally(results)
    if (heeftDb) {
      // Tellen mag nooit het antwoord ophouden.
      rpc('routing_tally', { p_hits: t.hits, p_ors: t.ors, p_estimates: t.estimates }).catch(() => {})
      // Af en toe de oude rijen opruimen; geen cron nodig voor een tabel die
      // toch al klein blijft.
      if (Math.random() < 0.02) rpc('routing_cache_sweep').catch(() => {})
    }

    res.status(200).json({
      ok: true,
      mode,
      seconds: results.map((r) => r.seconds),
      // De app toont "geschat" zodra hier iets in staat.
      estimated: results.some((r) => r.source === 'estimate'),
      source: results.map((r) => r.source),
    })
  } catch (e) {
    res.status(200).json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
}
