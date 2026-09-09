import { describe, expect, it } from 'vitest'
import { filterFerryAlerts } from '../../api/_lib/ferryAlerts.mjs'
import type { FeedEntity } from '../../api/_lib/ferryAlerts.mjs'

// Fixture naar het echte feed-formaat (gtfs.ovapi.nl/nl/alerts.pb, 3 juli 2026):
// int64 als string, NL en EN samengevoegd met " -- ", informed_entity herhaald per halte.
const NOW = 1_784_000_000

const busAlert: FeedEntity = {
  id: 'KV15:GVB:2026-06-30:1092',
  alert: {
    informedEntity: [
      { routeId: '152350', stopId: '3981320' },
      { routeId: '152350', stopId: '3981027' },
    ],
    activePeriod: [{ start: String(NOW - 3600), end: String(NOW + 3600) }],
    headerText: { translation: [{ text: 'Bus 39 rijdt om vanaf halte Pomonastraat. -- Bus 39 runs a diverted route' }] },
  },
}
const ferryStopAlert: FeedEntity = {
  id: 'KV15:GVB:2026-07-03:2001',
  alert: {
    informedEntity: [
      { routeId: '152399', stopId: '3980786' }, // NDSM-werf
      { routeId: '152399', stopId: '3979906' }, // Centraal Station
    ],
    activePeriod: [{ start: String(NOW - 600) }],
    headerText: { translation: [{ text: 'Pont F4 vaart tijdelijk niet. Details: gvb.nl -- Ferry F4 temporarily out of service' }] },
  },
}
const ferryTextAlert: FeedEntity = {
  id: 'KV15:GVB:2026-07-03:2002',
  alert: {
    informedEntity: [{ routeId: '152401' }],
    activePeriod: [],
    headerText: { translation: [{ text: 'Veer naar Zamenhofstraat vaart een aangepaste dienstregeling.' }] },
  },
}
const expiredFerryAlert: FeedEntity = {
  id: 'KV15:GVB:2026-06-01:1500',
  alert: {
    informedEntity: [{ stopId: '3980786' }],
    activePeriod: [{ start: String(NOW - 7200), end: String(NOW - 3600) }],
    headerText: { translation: [{ text: 'Pont vaart niet.' }] },
  },
}
const otherOperator: FeedEntity = {
  id: 'KV15:QBUZZ:2026-07-03:900',
  alert: {
    informedEntity: [{ stopId: '3980786' }],
    headerText: { translation: [{ text: 'Pont vaart niet.' }] },
  },
}

// Naar het echte stakings-alert van 9 september 2026 (KV15:GVB:2026-09-05:1076):
// 1070 informed stops, geen enkele veersteiger, tekst zonder "pont" of "veer",
// NL/EN gescheiden met " --|" en '|' als regeleinde. Dit miste het filter eerst.
const strikeAlert: FeedEntity = {
  id: 'KV15:GVB:2026-09-05:1076',
  alert: {
    informedEntity: Array.from({ length: 80 }, (_, i) => ({ stopId: String(5000000 + i) })),
    activePeriod: [{ start: String(NOW - 3600), end: String(NOW + 3600) }],
    headerText: {
      translation: [
        { text: 'Vandaag landelijke ov-staking.|Meer info: 9292.nl --|Today, nationwide public transport strike.' },
      ],
    },
  },
}
const pluralAlert: FeedEntity = {
  id: 'KV15:GVB:2026-09-05:1090',
  alert: {
    informedEntity: [{ routeId: '152401' }],
    activePeriod: [],
    headerText: { translation: [{ text: 'De ponten varen vandaag een aangepaste dienstregeling.' }] },
  },
}

describe('filterFerryAlerts', () => {
  it('herkent een netwerkbrede staking zonder veersteigers of veer-woorden', () => {
    const r = filterFerryAlerts([strikeAlert], NOW)
    expect(r).toHaveLength(1)
    expect(r[0].stops).toEqual([]) // leeg = alle lijnen geraakt
    // Engelse staart eraf, pipes vervangen door spaties.
    expect(r[0].header).toBe('Vandaag landelijke ov-staking. Meer info: 9292.nl')
  })

  it('herkent ook het trefwoord staking bij een klein aantal haltes', () => {
    const klein: FeedEntity = {
      ...strikeAlert,
      id: 'KV15:GVB:2026-09-05:1099',
      alert: { ...strikeAlert.alert, informedEntity: [{ stopId: '5000001' }] },
    }
    expect(filterFerryAlerts([klein], NOW)).toHaveLength(1)
  })

  it('matcht meervouden als "ponten" in de tekst', () => {
    const r = filterFerryAlerts([pluralAlert], NOW)
    expect(r).toHaveLength(1)
    expect(r[0].stops).toEqual([])
  })

  it('laat een gewoon bus-alert met een handvol haltes nog steeds weg', () => {
    expect(filterFerryAlerts([busAlert], NOW)).toHaveLength(0)
  })

  it('matcht op veersteiger-stop-ids en vertaalt naar stop-sleutels', () => {
    const r = filterFerryAlerts([busAlert, ferryStopAlert], NOW)
    expect(r).toHaveLength(1)
    expect(r[0].stops).toEqual(['centraalstation', 'ndsmwerf'])
    expect(r[0].header).toBe('Pont F4 vaart tijdelijk niet. Details: gvb.nl')
  })

  it('matcht als vangnet op het woord pont/veer in de tekst', () => {
    const r = filterFerryAlerts([ferryTextAlert], NOW)
    expect(r).toHaveLength(1)
    expect(r[0].stops).toEqual([])
  })

  it('laat bus/tram-alerts en verlopen alerts weg', () => {
    const r = filterFerryAlerts([busAlert, expiredFerryAlert], NOW)
    expect(r).toHaveLength(0)
  })

  it('negeert andere vervoerders ook al noemen ze een pont', () => {
    expect(filterFerryAlerts([otherOperator], NOW)).toHaveLength(0)
  })

  it('knipt de Engelse tekst achter " -- " eraf', () => {
    const r = filterFerryAlerts([ferryStopAlert], NOW)
    expect(r[0].header).not.toMatch(/temporarily/)
  })
})
