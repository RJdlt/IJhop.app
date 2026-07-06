import { describe, expect, it } from 'vitest'
import { parseFerryKey, ferryRouteLabel, aggregateByLine } from './Admin'

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
})

describe('ferryRouteLabel', () => {
  it('vertaalt stop-sleutels naar leesbare namen', () => {
    expect(ferryRouteLabel('F4:centraalstation:ndsmwerf')).toBe('F4 · Centraal Station → NDSM-werf')
  })
  it('valt terug op de ruwe sleutel als die niet te parsen is', () => {
    expect(ferryRouteLabel('onzin')).toBe('onzin')
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
})
