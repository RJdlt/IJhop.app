import { describe, expect, it } from 'vitest'
import { amsterdamClock, amsterdamDay, amsterdamInstant, dealWeekWindow, mondayOf } from './time'

describe('amsterdamInstant', () => {
  it('rekent wintertijd om (+01:00)', () => {
    expect(amsterdamInstant('2026-01-12', '00:00:00')).toBe('2026-01-11T23:00:00.000Z')
  })

  it('rekent zomertijd om (+02:00)', () => {
    expect(amsterdamInstant('2026-07-06', '00:00:00')).toBe('2026-07-05T22:00:00.000Z')
  })

  it('is heen en terug consistent', () => {
    const iso = amsterdamInstant('2026-10-24', '23:59:59')
    expect(iso).not.toBeNull()
    const d = new Date(iso as string)
    expect(amsterdamDay(d)).toBe('2026-10-24')
    expect(amsterdamClock(d)).toBe('23:59:59')
  })

  it('geeft null voor een uur dat niet bestaat', () => {
    // In de nacht van 28 op 29 maart 2026 springt de klok van 02:00 naar 03:00.
    expect(amsterdamInstant('2026-03-29', '02:30:00')).toBeNull()
  })
})

describe('dealWeekWindow', () => {
  it('loopt van maandag 00:00 tot en met woensdag 23:59:59', () => {
    const w = dealWeekWindow('2026-09-07')
    expect(w).not.toBeNull()
    const van = new Date(w!.from)
    const tot = new Date(w!.to)
    expect(amsterdamDay(van)).toBe('2026-09-07')
    expect(amsterdamClock(van)).toBe('00:00:00')
    expect(amsterdamDay(tot)).toBe('2026-09-09')
    expect(amsterdamClock(tot)).toBe('23:59:59')
  })

  it('houdt de klokwissel eind oktober heel', () => {
    // Maandag 26 oktober 2026 valt na de overgang naar wintertijd.
    const w = dealWeekWindow('2026-10-26')
    expect(amsterdamClock(new Date(w!.from))).toBe('00:00:00')
    expect(amsterdamClock(new Date(w!.to))).toBe('23:59:59')
  })

  it('duurt bijna drie dagen', () => {
    const w = dealWeekWindow('2026-09-07')!
    const uren = (Date.parse(w.to) - Date.parse(w.from)) / 3_600_000
    expect(uren).toBeGreaterThan(71)
    expect(uren).toBeLessThan(72)
  })
})

describe('mondayOf', () => {
  it('geeft de maandag van deze week', () => {
    expect(mondayOf(new Date('2026-09-10T08:00:00Z'))).toBe('2026-09-07')
    expect(mondayOf(new Date('2026-09-07T08:00:00Z'))).toBe('2026-09-07')
    expect(mondayOf(new Date('2026-09-13T22:30:00Z'))).toBe('2026-09-14')
  })
})
