// Data-gedreven: de haltes en lijnen komen uit de dienstregeling (alle GVB-
// pontjes van Amsterdam), dus geen vaste unie meer.
export type StopId = string
export type LineId = string

export interface TimetableStop {
  gtfsId: string
  name: string
  lat: number
  lon: number
}

export interface TimetableLine {
  name: LineId
  connects: StopId[]
  color: string
  durationMin: number
}

/** One scheduled sailing. `m` = minutes since midnight of the service day (may exceed 1440 for after-midnight sailings). */
export interface Departure {
  line: LineId
  from: StopId
  to: StopId
  m: number
  dep: string // wall-clock "HH:MM"
  dur: number // crossing time in minutes
}

export interface Timetable {
  source: string
  generated: string
  note: string
  timezone: string
  stops: Record<StopId, TimetableStop>
  lines: Record<LineId, TimetableLine>
  schedule: Record<string, Departure[]> // '0' (Mon) .. '6' (Sun)
}

/** A departure resolved against the current moment, with a live countdown. */
export interface UpcomingDeparture extends Departure {
  /** Whole seconds until this sailing leaves. */
  secondsUntil: number
}
