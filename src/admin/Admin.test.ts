import { describe, expect, it } from 'vitest'
import {
  claimRate,
  cohortCells,
  dealFunnel,
  returnLift,
  versionSplit,
  cohortShade,
  installRate,
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
  classifyNewReturning,
  returningLine,
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

// ---- Nieuw vs terugkerend ----------------------------------------------------
// Deze functie spiegelt wat de RPC server-side doet (migratie 0016) en legt de
// definitie vast: nieuw = eerste week ooit is deze week, terugkerend = eerder.

describe('classifyNewReturning', () => {
  const weeks = ['2026-08-03', '2026-08-10', '2026-08-17']

  it('telt een gebruiker als nieuw in de week van zijn eerste event', () => {
    const rows = classifyNewReturning(
      [{ user: 'a', week: '2026-08-10' }],
      { a: '2026-08-10' },
      weeks,
    )
    expect(rows).toEqual([
      { week_start: '2026-08-03', nieuw: 0, terugkerend: 0 },
      { week_start: '2026-08-10', nieuw: 1, terugkerend: 0 },
      { week_start: '2026-08-17', nieuw: 0, terugkerend: 0 },
    ])
  })

  it('telt een gebruiker met een eerste event vóór het venster als terugkerend', () => {
    // Kern van de definitie: het eerste event ligt buiten (vóór) het venster,
    // dus deze gebruiker is niet nieuw, ook al zien we hem hier voor het eerst.
    const rows = classifyNewReturning(
      [{ user: 'a', week: '2026-08-03' }],
      { a: '2026-06-01' },
      weeks,
    )
    expect(rows[0]).toEqual({ week_start: '2026-08-03', nieuw: 0, terugkerend: 1 })
  })

  it('laat dezelfde gebruiker in een latere week terugkerend worden', () => {
    const rows = classifyNewReturning(
      [
        { user: 'a', week: '2026-08-03' },
        { user: 'a', week: '2026-08-17' },
      ],
      { a: '2026-08-03' },
      weeks,
    )
    expect(rows[0].nieuw).toBe(1)
    expect(rows[2].terugkerend).toBe(1)
  })

  it('telt een gebruiker hooguit één keer per week', () => {
    const rows = classifyNewReturning(
      [
        { user: 'a', week: '2026-08-10' },
        { user: 'a', week: '2026-08-10' },
        { user: 'a', week: '2026-08-10' },
      ],
      { a: '2026-08-10' },
      weeks,
    )
    expect(rows[1]).toEqual({ week_start: '2026-08-10', nieuw: 1, terugkerend: 0 })
  })

  it('werkt over de jaargrens heen', () => {
    // 29 dec 2025 is de maandag van ISO-week 1 van 2026; 5 jan 2026 is week 2.
    const jaarWeken = ['2025-12-29', '2026-01-05']
    const rows = classifyNewReturning(
      [
        { user: 'oud', week: '2026-01-05' },
        { user: 'nieuw', week: '2026-01-05' },
      ],
      { oud: '2025-12-29', nieuw: '2026-01-05' },
      jaarWeken,
    )
    expect(rows[1]).toEqual({ week_start: '2026-01-05', nieuw: 1, terugkerend: 1 })
  })

  it('negeert activiteit buiten het venster en houdt lege weken op nul', () => {
    const rows = classifyNewReturning(
      [{ user: 'a', week: '2026-07-27' }],
      { a: '2026-07-27' },
      weeks,
    )
    expect(rows.every((r) => r.nieuw === 0 && r.terugkerend === 0)).toBe(true)
    expect(rows).toHaveLength(3)
  })

  it('valt terug op "nieuw" als de eerste week onbekend is', () => {
    const rows = classifyNewReturning([{ user: 'x', week: '2026-08-03' }], {}, weeks)
    expect(rows[0]).toEqual({ week_start: '2026-08-03', nieuw: 1, terugkerend: 0 })
  })
})

describe('returningLine', () => {
  it('schrijft percentage en aantallen uit', () => {
    expect(returningLine(24, 63)).toBe('38% van de gebruikers kwam terug (24 van 63)')
  })
  it('deelt niet door nul', () => {
    expect(returningLine(0, 0)).toBe('0% van de gebruikers kwam terug (0 van 0)')
  })
})

describe('cohortCells', () => {
  it('rekent per week het aandeel van het cohort uit', () => {
    const cells = cohortCells({ week_start: '2026-08-03', size: 50, weeks: [20, 12, 5, 4] })
    expect(cells.map((c) => c?.pct)).toEqual([40, 24, 10, 8])
    expect(cells[0]?.users).toBe(20)
  })

  it('laat een week die nog niet voorbij is leeg', () => {
    const cells = cohortCells({ week_start: '2026-09-07', size: 30, weeks: [9, null, null, null] })
    expect(cells[0]?.pct).toBe(30)
    expect(cells[1]).toBeNull()
    expect(cells[3]).toBeNull()
  })

  it('leest nul actieve gebruikers als 0% en niet als leeg', () => {
    const cells = cohortCells({ week_start: '2026-07-06', size: 40, weeks: [0, 0, 1, 0] })
    expect(cells[0]).toEqual({ users: 0, pct: 0 })
    expect(cells[2]?.pct).toBe(3)
  })

  it('deelt niet door nul bij een leeg cohort', () => {
    const cells = cohortCells({ week_start: '2026-07-06', size: 0, weeks: [0, 0, 0, 0] })
    expect(cells.every((c) => c?.pct === 0)).toBe(true)
  })

  it('vult aan tot vier weken als de RPC er minder teruggaf', () => {
    expect(cohortCells({ week_start: '2026-09-07', size: 10, weeks: [3] })).toHaveLength(4)
  })
})

describe('installRate', () => {
  it('meet installaties als aandeel van wie de uitnodiging zag', () => {
    expect(installRate({ variant: 'A', shown: 200, dismissed: 60, ios_help: 90, installed: 30 })).toBe(15)
  })

  it('geeft 0 zonder vertoningen, in plaats van te delen door nul', () => {
    expect(installRate({ variant: 'B', shown: 0, dismissed: 0, ios_help: 0, installed: 0 })).toBe(0)
  })
})

describe('cohortShade', () => {
  it('wordt voller naarmate de retentie hoger is', () => {
    expect(cohortShade(0)).toContain('slate')
    expect(cohortShade(5)).not.toBe(cohortShade(0))
    expect(cohortShade(50)).toContain('bg-brand')
  })
})

describe('dealFunnel', () => {
  const rij = {
    deal_id: 'd1', offer: 'Pizza margherita 9 euro in plaats van 14', partner: 'Van der Werf',
    stop_id: 'ndsm', valid_from: '2026-09-07T00:00:00Z', valid_to: '2026-09-09T21:59:59Z',
    seen: 200, claimed: 60, shown: 55, codes: 60, redeemed: 30,
  }

  it('zet elke stap af tegen wie de kaart zag', () => {
    expect(dealFunnel(rij).map((s) => s.pct)).toEqual([100, 30, 28, 15])
  })

  it('houdt de vier stappen in volgorde', () => {
    expect(dealFunnel(rij).map((s) => s.label)).toEqual([
      'Kaart gezien', 'Pak je deal', 'Code getoond', 'Ingewisseld',
    ])
  })

  it('deelt niet door nul bij een deal die niemand zag', () => {
    const leeg = { ...rij, seen: 0, claimed: 0, shown: 0, codes: 0, redeemed: 0 }
    expect(dealFunnel(leeg).every((s) => s.pct === 0)).toBe(true)
  })
})

describe('returnLift', () => {
  it('rekent beide groepen om naar procenten', () => {
    const r = returnLift({ with_deal: 100, with_deal_returned: 45, without_deal: 200, without_deal_returned: 25 })
    expect(r.met).toBe(45)
    expect(r.zonder).toBe(13)
    expect(r.lift).toBe(32)
  })

  it('houdt zijn mond bij een te kleine groep', () => {
    const r = returnLift({ with_deal: 4, with_deal_returned: 3, without_deal: 300, without_deal_returned: 30 })
    expect(r.met).toBe(75)
    expect(r.lift).toBeNull()
  })

  it('valt niet om zonder data', () => {
    expect(returnLift(undefined)).toEqual({ met: 0, zonder: 0, lift: null })
  })
})

describe('versionSplit', () => {
  const rij = (version: string, users: number, dagenGeleden: number) => ({
    version,
    users,
    sessions: users,
    first_seen: new Date(Date.parse('2026-09-10T12:00:00Z') - dagenGeleden * 86_400_000).toISOString(),
    last_seen: '2026-09-10T12:00:00Z',
  })

  it('kiest de versie met de recentste eerste melding als de huidige', () => {
    const r = versionSplit([rij('oud', 30, 20), rij('nieuw', 70, 1), rij('midden', 10, 8)])
    expect(r.current).toBe('nieuw')
  })

  it('telt hoeveel gebruikers achterlopen', () => {
    const r = versionSplit([rij('nieuw', 70, 1), rij('oud', 30, 20)])
    expect(r.currentUsers).toBe(70)
    expect(r.oldUsers).toBe(30)
    expect(r.pctOld).toBe(30)
  })

  it('zet de grootste groep bovenaan en markeert de huidige', () => {
    const r = versionSplit([rij('nieuw', 10, 1), rij('oud', 90, 20)])
    expect(r.rows[0].version).toBe('oud')
    expect(r.rows.find((x) => x.current)?.version).toBe('nieuw')
  })

  it('meldt nul achterstand als iedereen bij is', () => {
    const r = versionSplit([rij('nieuw', 100, 1)])
    expect(r.pctOld).toBe(0)
    expect(r.oldUsers).toBe(0)
  })

  it('valt niet om zonder data', () => {
    expect(versionSplit(undefined).current).toBeNull()
    expect(versionSplit([]).pctOld).toBe(0)
  })

  it('kiest ook iets zinnigs als een tijdstempel onzin is', () => {
    const kapot = { version: 'kapot', users: 5, sessions: 5, first_seen: '', last_seen: '' }
    const r = versionSplit([kapot, rij('nieuw', 10, 1)])
    expect(r.current).toBe('nieuw')
    expect(r.oldUsers).toBe(5)
  })
})

describe('claimRate', () => {
  it('zet claims af tegen wie de kaart zag', () => {
    expect(claimRate({ value: 'vol', seen: 200, claimed: 50 })).toBe(25)
  })

  it('zwijgt onder de twintig vertoningen', () => {
    // Bij kleine aantallen is een verschil van vijf procentpunt ruis.
    expect(claimRate({ value: 'vol', seen: 19, claimed: 10 })).toBeNull()
    expect(claimRate({ value: 'vol', seen: 20, claimed: 10 })).toBe(50)
  })

  it('deelt niet door nul', () => {
    expect(claimRate({ value: 'vol', seen: 0, claimed: 0 })).toBeNull()
  })
})
