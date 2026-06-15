/**
 * All schedule maths happen in Europe/Amsterdam wall-clock time, regardless of
 * the device timezone. We derive the current Amsterdam weekday + time-of-day
 * from the real instant via Intl, so the app is correct for a traveller whose
 * phone is set to another timezone too.
 */

const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
}

export const MINUTES_PER_WEEK = 7 * 24 * 60
export const SECONDS_PER_WEEK = MINUTES_PER_WEEK * 60

export interface AmsterdamMoment {
  /** 0 = Monday … 6 = Sunday */
  weekday: number
  hour: number
  minute: number
  second: number
  /** Seconds elapsed since Monday 00:00:00 Amsterdam time. */
  secondOfWeek: number
}

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Amsterdam',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

export function amsterdamMoment(now: Date = new Date()): AmsterdamMoment {
  const parts = partsFormatter.formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''

  const weekday = WEEKDAY_INDEX[get('weekday')] ?? 0
  // Intl can emit "24" for midnight in the hour-cycle; normalise to 0.
  let hour = parseInt(get('hour'), 10)
  if (hour === 24) hour = 0
  const minute = parseInt(get('minute'), 10)
  const second = parseInt(get('second'), 10)

  const secondOfWeek = ((weekday * 24 + hour) * 60 + minute) * 60 + second

  return { weekday, hour, minute, second, secondOfWeek }
}

/** Format a wall-clock "HH:MM" string for display, honouring the chosen locale's habits (24h). */
export function formatClock(hhmm: string): string {
  return hhmm
}

/** Human countdown: "4:05" under an hour, otherwise "1u 12" style is handled in the component. */
export function formatCountdown(totalSeconds: number): { minutes: number; seconds: number } {
  const safe = Math.max(0, totalSeconds)
  return { minutes: Math.floor(safe / 60), seconds: safe % 60 }
}
