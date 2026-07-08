import { describe, expect, it } from 'vitest'
import { parseFerryKey, ferryRouteLabel, aggregateByLine, safeLabel, deviceLabel, propSummary } from './Admin'

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
