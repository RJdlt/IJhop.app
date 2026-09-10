/**
 * De brug tussen de dienstregeling en de pure planner.
 *
 * Hier wordt de wekelijkse ring van afvaarten omgezet naar absolute tijden, en
 * worden de reistijden bij onze eigen API opgehaald. `planRoutes` zelf blijft
 * puur; alles wat met tijdzones, netwerk en storingen te maken heeft staat hier.
 */
import { CONNECTIONS, nextDepartures, STOPS } from './schedule'
import { affectedLines } from './disruptions'
import type { Disruption } from './disruptions'
import { amsterdamMoment } from './time'
import type { Coords } from './geo'
import { haversine, travelSeconds } from './geo'
import type { PlannerMode, Sailing } from './planner'
import type { LineId, StopId } from '../types'

/** Hoe ver vooruit we afvaarten ophalen. Twaalf uur is ruim voor "ik wil er
 *  vanavond om elf uur zijn" en houdt de lijst klein. */
export const HORIZON_MS = 12 * 3600_000

/**
 * Alle afvaarten tussen twee momenten, als absolute tijden.
 *
 * De dienstregeling is een weekring in Amsterdamse tijd; `nextDepartures`
 * geeft seconden tot vertrek vanaf een moment in die ring. Door dat bij het
 * startmoment op te tellen komen we op absolute milliseconden uit, en dan
 * hoeft er verderop nergens meer met tijdzones gerekend te worden. Ook rond
 * de klokwissel klopt dat: de ring verschuift mee, het absolute moment niet.
 */
export function sailingsBetween(fromMs: number, toMs: number): Sailing[] {
  const start = amsterdamMoment(new Date(fromMs)).secondOfWeek
  const uit: Sailing[] = []

  for (const c of CONNECTIONS) {
    const lijst = nextDepartures({
      from: c.from,
      to: c.to,
      nowSecondOfWeek: start,
      limit: 60,
    })
    const vanDezeVerbinding: Sailing[] = []
    for (const d of lijst) {
      const departMs = fromMs + d.secondsUntil * 1000
      if (departMs > toMs) break
      vanDezeVerbinding.push({
        line: c.line,
        from: c.from,
        to: c.to,
        departMs,
        arriveMs: departMs + d.dur * 60_000,
        last: false,
      })
    }
    // De laatste van de dag: de afvaart waarna de Amsterdamse datum verspringt.
    for (let i = 0; i < vanDezeVerbinding.length; i++) {
      const nu = amsterdamDag(vanDezeVerbinding[i].departMs)
      const volgende = vanDezeVerbinding[i + 1]
      if (!volgende || amsterdamDag(volgende.departMs) !== nu) {
        vanDezeVerbinding[i].last = true
      }
    }
    uit.push(...vanDezeVerbinding)
  }
  return uit.sort((a, b) => a.departMs - b.departMs)
}

function amsterdamDag(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms))
}

/** De eerstvolgende afvaart na een moment, voor "eerste morgen 06:30". */
export function firstSailingAfter(fromMs: number): Sailing | null {
  const lijst = sailingsBetween(fromMs, fromMs + 36 * 3600_000)
  return lijst[0] ?? null
}

/** Ligt deze steiger aan dezelfde kant van het IJ als dat punt? Bepaalt of de
 *  route zonder pont een optie is. Ruwe maat: de dichtstbijzijnde steiger van
 *  het punt ligt op dezelfde oever als de bestemming. */
export function sameSide(a: Coords, b: Coords): boolean {
  // Het IJ loopt hier oost-west; noord en zuid liggen dus uit elkaar in
  // breedtegraad. 52.385 ligt tussen de zuidelijke en noordelijke steigers.
  const GRENS = 52.385
  return a.lat < GRENS === b.lat < GRENS
}

export interface Traject {
  from: Coords
  to: Coords
}

/** De trajecten die een planning nodig heeft: naar elke steiger die vertrekt,
 *  vanaf elke steiger waar je aankomt, plus de directe route. */
export function trajectenVoor(from: Coords, to: Coords): {
  pairs: Traject[]
  toStops: StopId[]
  fromStops: StopId[]
  direct: boolean
} {
  const vertrekStops = [...new Set(CONNECTIONS.map((c) => c.from))]
  const aankomstStops = [...new Set(CONNECTIONS.map((c) => c.to))]
  const direct = sameSide(from, to)

  const pairs: Traject[] = []
  for (const s of vertrekStops) pairs.push({ from, to: coordsVan(s) })
  for (const s of aankomstStops) pairs.push({ from: coordsVan(s), to })
  if (direct) pairs.push({ from, to })

  return { pairs, toStops: vertrekStops, fromStops: aankomstStops, direct }
}

export function coordsVan(stop: StopId): Coords {
  const s = STOPS[stop]
  return { lat: s?.lat ?? 0, lon: s?.lon ?? 0 }
}

/** Schatting zonder dienst, zodat de planner altijd iets laat zien. */
export function schat(from: Coords, to: Coords, mode: PlannerMode): number {
  return travelSeconds(haversine(from, to) * 1.3, mode === 'fiets' ? 'fiets' : 'lopen')
}

/**
 * Haalt de reistijden op bij onze eigen API. Faalt dat, dan schatten we hier,
 * met dezelfde formule als de server: liever een planner die eerlijk "geschat"
 * zegt dan een lege kaart.
 */
export async function haalReistijden(
  pairs: Traject[],
  mode: PlannerMode,
): Promise<{ seconds: number[]; estimated: boolean }> {
  try {
    const r = await fetch('/api/routing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, pairs }),
      signal: AbortSignal.timeout(9000),
    })
    if (r.ok) {
      const j = await r.json()
      if (j?.ok && Array.isArray(j.seconds) && j.seconds.length === pairs.length) {
        return { seconds: j.seconds, estimated: Boolean(j.estimated) }
      }
    }
  } catch {
    /* val terug op de schatting */
  }
  return { seconds: pairs.map((p) => schat(p.from, p.to, mode)), estimated: true }
}

/**
 * Welke lijnen laten we uit de planning, op grond van de storingsmeldingen?
 *
 * Een melding noemt steigers, niet lijnen; `affectedLines` vertaalt dat. Een
 * algemene veermelding zonder steigers raakt alle lijnen, en dan valt er niets
 * te plannen: dat is beter dan een route voorstellen die niet vaart.
 */
export function gestoordeLijnen(alerts: Disruption[] | null | undefined): LineId[] {
  if (!alerts || alerts.length === 0) return []
  const uit = new Set<LineId>()
  for (const a of alerts) for (const l of affectedLines(a)) uit.add(l)
  return [...uit]
}
