import { describe, expect, it } from 'vitest'
import {
  parseFerryKey,
  ferryRouteLabel,
  aggregateByLine,
  safeLabel,
  deviceLabel,
  propSummary,
  isoWeekOf,
  weekLabel,
  findMeasurementGap,
  formatGapRange,
} from './Admin'

/** Bouwt een dagreeks; dagen in `zero` krijgen 0 events (meetgat). */
function dailyRange(from: string, days: number, zero: [number, number] | null = null) {
  const start = new Date(`${from}T00:00:00Z`)
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(start)
    d.setUTCDate(d.getUTCDate() + i)
    const inGap = zero !== null && i >= zero[0] && i <= zero[1]
    return {
      day: d.toISOString().slice(0, 10),
      users: inGap ? 0 : 3,
      sessions: inGap ? 0 : 4,
      events: inGap ? 0 : 20,
    }
  })
}

// De ferry_pick-sleutel is "lijn:van:naar" (zie connKey in App.tsx).
describe('parseFerryKey', () => {
  it('splitst lijn, van en naar', () => {
    expect(parseFerryKey('F4:centraalstation:ndsmwerf')).toEqual({
      line: 'F4',
      from: 'centraalstation',
      to: 'ndsmwerf',
    })
  })
  it('geeft null bij een onherkenbare sleutel', () => {
    expect(parseFerryKey('rommel')).toBeNull()
    expect(parseFerryKey('')).toBeNull()
  })
  // Regressie: een gewiste pont-keuze (FerryPicker "geen keuze", of nogmaals
  // op de actieve keuze tikken) stuurt track('ferry_pick', { key: null }).
  // Die rij komt als props->>'key' = SQL NULL terug uit analytics_dashboard,
  // dus value is hier echt null, niet slechts een lege string. Dit crashte
  // eerder de hele admin-pagina via key.split(':') zonder guard.
  it('crasht niet op een null- of undefined-sleutel', () => {
    expect(parseFerryKey(null)).toBeNull()
    expect(parseFerryKey(undefined)).toBeNull()
  })
  it('crasht niet op een sleutel met een verkeerd aantal segmenten', () => {
    expect(parseFerryKey('F4')).toBeNull()
    expect(parseFerryKey('F4:centraalstation')).toBeNull()
    expect(parseFerryKey('F4:centraalstation:ndsmwerf:extra')).toBeNull()
    expect(parseFerryKey(':::')).toBeNull()
  })
})

describe('ferryRouteLabel', () => {
  it('vertaalt stop-sleutels naar leesbare namen', () => {
    expect(ferryRouteLabel('F4:centraalstation:ndsmwerf')).toBe('F4 · Centraal Station → NDSM-werf')
  })
  it('valt terug op de ruwe sleutel als die niet te parsen is', () => {
    expect(ferryRouteLabel('onzin')).toBe('onzin')
  })
  it('valt terug op "Onbekend" bij null, undefined of een lege sleutel', () => {
    expect(ferryRouteLabel(null)).toBe('Onbekend')
    expect(ferryRouteLabel(undefined)).toBe('Onbekend')
    expect(ferryRouteLabel('')).toBe('Onbekend')
  })
})

describe('aggregateByLine', () => {
  it('voegt beide richtingen van dezelfde lijn samen', () => {
    const rows = [
      { value: 'F4:centraalstation:ndsmwerf', users: 10, events: 20 },
      { value: 'F4:ndsmwerf:centraalstation', users: 6, events: 9 },
      { value: 'F7:ndsmwerf:pontsteiger', users: 3, events: 5 },
    ]
    const out = aggregateByLine(rows)
    expect(out).toEqual([
      { label: 'F4', value: 16, title: '29 keer gekozen (beide richtingen)', color: expect.any(String) },
      { label: 'F7', value: 3, title: '5 keer gekozen (beide richtingen)', color: expect.any(String) },
    ])
  })
  it('sorteert aflopend op gebruikers en geeft een lege lijst bij geen rijen', () => {
    expect(aggregateByLine([])).toEqual([])
    const out = aggregateByLine([
      { value: 'F1:a:b', users: 2, events: 2 },
      { value: 'F9:a:b', users: 9, events: 9 },
    ])
    expect(out.map((r) => r.label)).toEqual(['F9', 'F1'])
  })

  // Regressie voor de crash uit productie: een gewiste pont-keuze levert een
  // rij met value: null op (zie parseFerryKey hierboven). Dit mag nooit meer
  // het hele dashboard laten crashen, en moet nette groepering geven.
  it('bundelt null-, lege en misvormde sleutels onder "Onbekend" zonder te crashen', () => {
    const rows = [
      { value: null, users: 4, events: 6 },
      { value: '', users: 1, events: 1 },
      { value: 'F4', users: 2, events: 2 }, // verkeerd aantal segmenten
      { value: 'F4:centraalstation:ndsmwerf', users: 5, events: 8 },
    ]
    expect(() => aggregateByLine(rows)).not.toThrow()
    const out = aggregateByLine(rows)
    const onbekend = out.find((r) => r.label === 'Onbekend')
    const f4 = out.find((r) => r.label === 'F4')
    expect(onbekend?.value).toBe(7) // 4 (null) + 1 (leeg) + 2 (verkeerd aantal segmenten)
    expect(f4?.value).toBe(5)
  })
})

// Overige plekken die dezelfde soort aanname maakten (een prop-waarde uit
// vrije JSONB is een goedgevormde string) zijn met dezelfde helper gefixt.
describe('safeLabel', () => {
  it('geeft de waarde terug als het een niet-lege string is', () => {
    expect(safeLabel('arcade')).toBe('arcade')
  })
  it('valt terug op "Onbekend" bij null, undefined of een lege string', () => {
    expect(safeLabel(null)).toBe('Onbekend')
    expect(safeLabel(undefined)).toBe('Onbekend')
    expect(safeLabel('')).toBe('Onbekend')
  })
  it('accepteert een eigen fallback-tekst', () => {
    expect(safeLabel(null, 'Overig')).toBe('Overig')
  })
})

describe('deviceLabel', () => {
  it('vertaalt de bekende waardes', () => {
    expect(deviceLabel('true')).toBe('PWA (geïnstalleerd)')
    expect(deviceLabel('false')).toBe('Browser')
  })
  it('crasht niet en valt terug op "Onbekend" bij null', () => {
    expect(deviceLabel(null)).toBe('Onbekend')
  })
})

describe('propSummary', () => {
  it('pakt het eerste bekende, niet-null veld', () => {
    expect(propSummary({ score: 42 })).toBe('score 42')
    expect(propSummary({ view: 'arcade' })).toBe('arcade')
  })
  it('slaat een letterlijk null veld over in plaats van "null" te tonen', () => {
    // Exact het geval dat de crash veroorzaakte: key is aanwezig maar null.
    expect(propSummary({ key: null })).toBe('')
    expect(propSummary({ key: null, id: 'toerist' })).toBe('toerist')
  })
  it('geeft een lege string zonder props', () => {
    expect(propSummary(null)).toBe('')
    expect(propSummary({})).toBe('')
  })
})

// ---- Weekgrafiek en meetgat-detectie ----------------------------------------

describe('isoWeekOf', () => {
  it('rekent een gewone week correct uit', () => {
    // Maandag 3 augustus 2026 valt in ISO-week 32.
    expect(isoWeekOf('2026-08-03')).toEqual({ year: 2026, week: 32 })
  })

  it('houdt de jaargrens aan zoals ISO-8601 voorschrijft', () => {
    // 1 januari 2026 is een donderdag, dus week 1 van 2026.
    expect(isoWeekOf('2026-01-01')).toEqual({ year: 2026, week: 1 })
    // De maandag ervóór (29 dec 2025) hoort bij diezelfde week 1 van 2026.
    expect(isoWeekOf('2025-12-29')).toEqual({ year: 2026, week: 1 })
    // 31 december 2024 (dinsdag) hoort nog bij week 1 van 2025.
    expect(isoWeekOf('2024-12-31')).toEqual({ year: 2025, week: 1 })
    // 28 december valt altijd in de laatste week van zijn eigen jaar.
    expect(isoWeekOf('2026-12-28')).toEqual({ year: 2026, week: 53 })
  })

  it('geeft een veilige uitkomst bij onzin', () => {
    expect(isoWeekOf('geen-datum')).toEqual({ year: 0, week: 0 })
  })
})

describe('weekLabel', () => {
  it('labelt als "wk N"', () => {
    expect(weekLabel('2026-08-03')).toBe('wk 32')
    expect(weekLabel('2025-12-29')).toBe('wk 1')
  })
  it('valt terug bij een onbruikbare datum', () => {
    expect(weekLabel('')).toBe('—')
  })
})

describe('findMeasurementGap', () => {
  it('vindt een aaneengesloten gat van 7+ dagen', () => {
    // 30 dagen vanaf 1 augustus, met dag 3 t/m 20 leeg (18 dagen).
    const daily = dailyRange('2026-08-01', 30, [3, 20])
    const gap = findMeasurementGap(daily)
    expect(gap).toEqual({ from: '2026-08-04', to: '2026-08-21', days: 18 })
  })

  it('negeert korte stille periodes onder de drempel', () => {
    const daily = dailyRange('2026-08-01', 30, [5, 8]) // 4 dagen stil
    expect(findMeasurementGap(daily)).toBeNull()
  })

  it('vindt niets in een volledig gevulde reeks', () => {
    expect(findMeasurementGap(dailyRange('2026-08-01', 30))).toBeNull()
  })

  it('herkent een gat dat tot het einde van het venster doorloopt', () => {
    const daily = dailyRange('2026-08-01', 20, [10, 19])
    expect(findMeasurementGap(daily)).toEqual({ from: '2026-08-11', to: '2026-08-20', days: 10 })
  })

  it('kiest het langste gat als er meerdere zijn', () => {
    const daily = [
      ...dailyRange('2026-08-01', 10, [0, 7]), // 8 dagen leeg
      ...dailyRange('2026-08-11', 20, [0, 14]), // 15 dagen leeg
    ]
    expect(findMeasurementGap(daily)?.days).toBe(15)
  })

  it('doet niets bij een lege reeks', () => {
    expect(findMeasurementGap([])).toBeNull()
  })
})

describe('formatGapRange', () => {
  it('schrijft de periode kort in het Nederlands', () => {
    expect(formatGapRange({ from: '2026-08-04', to: '2026-09-10', days: 38 })).toBe('4 aug – 10 sep')
  })
})
