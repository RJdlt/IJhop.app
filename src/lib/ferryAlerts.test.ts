import { describe, expect, it } from 'vitest'
import {
  alertLines,
  filterFerryAlerts,
  isNetworkWide,
  mentionsOtherMode,
  resolveLines,
} from '../../api/_lib/ferryAlerts.mjs'
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


/**
 * De melding die op 11 september 2026 onterecht als veerstoring naar alle
 * abonnees ging. Een omleiding van tram 25: geen veersteiger getagd, geen
 * veer-woord in de tekst, maar wel 64 haltes. De oude regel zag dat
 * halte-aantal aan voor "netwerkbreed" en stuurde hem daarom naar iedereen,
 * ook naar iemand met alleen F4 en F9.
 *
 * De tekst is de KV15-vorm die GVB voor elke omleiding gebruikt; het alert
 * zelf stond niet meer in de feed toen we het nakeken.
 */
const tram25Alert: FeedEntity = {
  id: 'KV15:GVB:2026-09-11:1042',
  alert: {
    informedEntity: Array.from({ length: 64 }, (_, i) => ({
      routeId: '152345',
      stopId: String(3990000 + i),
    })),
    activePeriod: [{ start: String(NOW - 1800), end: String(NOW + 7200) }],
    headerText: {
      translation: [
        { text: 'Tram 25 rijdt om vanaf halte Station Zuid. Details: gvb.nl --|Tram 25 runs a diverted route' },
      ],
    },
  },
}

/** Dezelfde omleiding, maar dan met een veersteiger erbij getagd. Dan gaat het
 *  de abonnees van díé lijn wél aan. */
const tram25MetSteiger: FeedEntity = {
  ...tram25Alert,
  id: 'KV15:GVB:2026-09-11:1043',
  alert: {
    ...(tram25Alert.alert ?? {}),
    informedEntity: [...(tram25Alert.alert?.informedEntity ?? []), { stopId: '3980786' }],
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

describe('regressie: de tram-25-melding van 11 september', () => {
  it('gaat niet meer door het filter, ondanks 64 haltes', () => {
    expect(filterFerryAlerts([tram25Alert], NOW)).toHaveLength(0)
  })

  it('en de staking blijft wel netwerkbreed', () => {
    // De twee naast elkaar door hetzelfde filter: eentje eruit, eentje erin.
    const r = filterFerryAlerts([tram25Alert, strikeAlert], NOW)
    expect(r).toHaveLength(1)
    expect(r[0].id).toBe(strikeAlert.id)
    expect(r[0].networkWide).toBe(true)
    expect(alertLines(r[0])).toHaveLength(10)
  })

  it('laat hem wél door zodra er een veersteiger bij getagd is', () => {
    const r = filterFerryAlerts([tram25MetSteiger], NOW)
    expect(r).toHaveLength(1)
    expect(r[0].stops).toEqual(['ndsmwerf'])
    // En dan raakt hij alleen de lijnen van die steiger, niet alles.
    expect(alertLines(r[0]).sort()).toEqual(['F4', 'F7'])
  })

  it('zou een abonnee met alleen F4 en F9 niet meer bereiken', () => {
    // Dit is precies de klacht: iemand met F4 en F9 kreeg een tram-melding.
    const abonnee = ['F4', 'F9']
    const alerts = filterFerryAlerts([tram25Alert], NOW)
    const raakt = alerts.filter((a) => alertLines(a).some((l) => abonnee.includes(l)))
    expect(raakt).toHaveLength(0)
  })
})

describe('netwerkbreed gaat op woorden, niet op halte-aantal', () => {
  it('herkent staking, landelijk, geen vervoer en alle lijnen', () => {
    expect(isNetworkWide('Vandaag landelijke ov-staking', '')).toBe(true)
    expect(isNetworkWide('Er is een staking', '')).toBe(true)
    expect(isNetworkWide('Vandaag geen vervoer in Amsterdam', '')).toBe(true)
    expect(isNetworkWide('Alle lijnen rijden niet', '')).toBe(true)
  })

  it('is niet netwerkbreed zonder trefwoord, hoe breed ook', () => {
    expect(isNetworkWide('Tram 25 rijdt om vanaf halte Station Zuid', '')).toBe(false)
    expect(isNetworkWide('Werkzaamheden in de hele stad', '')).toBe(false)
  })

  it('vervalt zodra er een concrete lijn genoemd wordt', () => {
    // "Staking" plus een lijnnummer gaat over die lijn, niet over het netwerk.
    expect(isNetworkWide('Door de staking rijdt tram 25 niet', '')).toBe(false)
    expect(isNetworkWide('Staking: bus 39 rijdt niet', '')).toBe(false)
  })

  it('blijft netwerkbreed bij vervoerwijzen zonder nummer', () => {
    // Een stakingsbericht noemt vaak "geen trams en bussen" zonder lijnnummers.
    expect(isNetworkWide('Landelijke staking: geen trams, bussen en metro', '')).toBe(true)
  })
})

describe('mentionsOtherMode', () => {
  it('herkent bus-, tram- en metrolijnen met een nummer', () => {
    expect(mentionsOtherMode('Tram 25 rijdt om')).toBe(true)
    expect(mentionsOtherMode('Bus 39 rijdt om')).toBe(true)
    expect(mentionsOtherMode('Bus N91 en N93 stoppen hier niet')).toBe(true)
    expect(mentionsOtherMode('Metro 52 rijdt niet')).toBe(true)
    expect(mentionsOtherMode('tram lijn 4 rijdt om')).toBe(true)
  })

  it('slaat niet aan op vervoerwijzen zonder nummer', () => {
    expect(mentionsOtherMode('geen trams en bussen vandaag')).toBe(false)
    expect(mentionsOtherMode('Er rijden geen metros')).toBe(false)
  })

  it('slaat niet aan op een veerlijn', () => {
    expect(mentionsOtherMode('Pont F4 vaart niet')).toBe(false)
  })
})

describe('resolveLines', () => {
  it('gebruikt de getagde steigers als die er zijn', () => {
    expect(resolveLines(['ndsmwerf'], 'wat dan ook', false).sort()).toEqual(['F4', 'F7'])
  })

  it('valt terug op een veerlijnnummer in de tekst', () => {
    expect(resolveLines([], 'Pont F9 vaart niet', false)).toEqual(['F9'])
  })

  it('geeft alle lijnen bij een netwerkbreed bericht', () => {
    expect(resolveLines([], 'Landelijke staking', true)).toHaveLength(10)
  })

  it('negeert een lijnnummer dat niet bestaat', () => {
    expect(resolveLines([], 'Pont F99 vaart niet', false)).toHaveLength(10)
  })
})
