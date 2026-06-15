import rawTimetable from '../data/timetable.json'
import type { Departure, LineId, StopId, Timetable, UpcomingDeparture } from '../types'
import { SECONDS_PER_WEEK } from './time'

export const timetable = rawTimetable as unknown as Timetable

export const STOPS = timetable.stops
export const LINES = timetable.lines

export type StopPair = { from: StopId; to: StopId; line: LineId }

/** The four directed connections this app covers. */
export const CONNECTIONS: StopPair[] = [
  { from: 'ndsm', to: 'centraal', line: 'F4' },
  { from: 'centraal', to: 'ndsm', line: 'F4' },
  { from: 'ndsm', to: 'pontsteiger', line: 'F7' },
  { from: 'pontsteiger', to: 'ndsm', line: 'F7' },
]

/** A scheduled sailing placed on the absolute week ring (second-of-week it departs). */
interface RingDeparture extends Departure {
  secondOfWeek: number
}

function buildRing(): RingDeparture[] {
  const ring: RingDeparture[] = []
  for (let weekday = 0; weekday < 7; weekday++) {
    const day = timetable.schedule[String(weekday)] ?? []
    for (const d of day) {
      // `m` may exceed 1440 (after-midnight sailing) → it naturally rolls into
      // the next weekday, and Sunday-night rolls back to Monday via the modulo.
      const secondOfWeek = (((weekday * 1440 + d.m) * 60) % SECONDS_PER_WEEK + SECONDS_PER_WEEK) % SECONDS_PER_WEEK
      ring.push({ ...d, secondOfWeek })
    }
  }
  ring.sort((a, b) => a.secondOfWeek - b.secondOfWeek)
  return ring
}

const RING = buildRing()

export interface NextDeparturesQuery {
  from: StopId
  to: StopId
  nowSecondOfWeek: number
  /** How many upcoming sailings to return. */
  limit?: number
}

/**
 * Returns the next sailings for a directed connection, wrapping across the end
 * of the week. Each result carries a live `secondsUntil` countdown.
 */
export function nextDepartures({
  from,
  to,
  nowSecondOfWeek,
  limit = 4,
}: NextDeparturesQuery): UpcomingDeparture[] {
  const matches = RING.filter((d) => d.from === from && d.to === to)
  const upcoming: UpcomingDeparture[] = matches.map((d) => {
    const secondsUntil = (d.secondOfWeek - nowSecondOfWeek + SECONDS_PER_WEEK) % SECONDS_PER_WEEK
    return { line: d.line, from: d.from, to: d.to, m: d.m, dep: d.dep, dur: d.dur, secondsUntil }
  })
  upcoming.sort((a, b) => a.secondsUntil - b.secondsUntil)
  return upcoming.slice(0, limit)
}

/** First sailing from a stop you can still reach given how many seconds you need to get there. */
export function firstCatchable(
  from: StopId,
  to: StopId,
  nowSecondOfWeek: number,
  travelSeconds: number,
): UpcomingDeparture | null {
  const candidates = nextDepartures({ from, to, nowSecondOfWeek, limit: 8 })
  return candidates.find((d) => d.secondsUntil >= travelSeconds) ?? null
}

export function stopName(id: StopId): string {
  return STOPS[id].name
}
