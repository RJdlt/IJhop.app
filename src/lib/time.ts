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


/** Amsterdamse kalenderdag als YYYY-MM-DD, ook als de telefoon elders staat. */
export function amsterdamDay(d: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Amsterdam',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d)
  } catch {
    return d.toISOString().slice(0, 10)
  }
}


const amsClockFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Amsterdam',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

/** Amsterdamse klokstand als "HH:MM:SS". */
export function amsterdamClock(d: Date): string {
  return amsClockFormatter.format(d).replace(/^24:/, '00:')
}

/**
 * Het moment (UTC) waarop het in Amsterdam `day` om `clock` is.
 *
 * Nederland staat op +01:00 of +02:00, dus we proberen ze allebei en houden
 * degene die terugvertaald klopt. Dat is betrouwbaarder dan zelf uitrekenen
 * wanneer de klok verspringt, en het faalt netjes in het gat van de
 * lentenacht: dan bestaat 02:30 niet en krijg je null.
 */
export function amsterdamInstant(day: string, clock: string): string | null {
  for (const offset of ['+01:00', '+02:00']) {
    const d = new Date(`${day}T${clock}${offset}`)
    if (Number.isNaN(d.getTime())) continue
    if (amsterdamDay(d) === day && amsterdamClock(d) === clock) return d.toISOString()
  }
  return null
}

/**
 * Het venster van een Pontdeal-week: maandag 00:00 tot en met woensdag
 * 23:59:59, Amsterdamse tijd. `monday` is een YYYY-MM-DD.
 */
export function dealWeekWindow(monday: string): { from: string; to: string } | null {
  const wed = new Date(`${monday}T12:00:00Z`)
  if (Number.isNaN(wed.getTime())) return null
  wed.setUTCDate(wed.getUTCDate() + 2)
  const from = amsterdamInstant(monday, '00:00:00')
  const to = amsterdamInstant(wed.toISOString().slice(0, 10), '23:59:59')
  return from && to ? { from, to } : null
}

/** De maandag van de week waarin `d` valt, als Amsterdamse YYYY-MM-DD. */
export function mondayOf(d: Date = new Date()): string {
  const day = amsterdamDay(d)
  const t = new Date(`${day}T12:00:00Z`)
  const dow = (t.getUTCDay() + 6) % 7
  t.setUTCDate(t.getUTCDate() - dow)
  return t.toISOString().slice(0, 10)
}

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
