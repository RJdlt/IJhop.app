import { describe, expect, it } from 'vitest'
import {
  arrivalInstant,
  clockOf,
  MARGIN_MIN_DEFAULT,
  MAX_OPTIONS,
  minutesOf,
  planRoutes,
} from './planner'
import type { LegTimes, PlannerInput, Sailing } from './planner'

/** Een tijdstip op de Amsterdamse klok, als ms. */
const om = (iso: string) => Date.parse(iso)

const NU = om('2026-09-08T22:00:00+02:00')

/** F7 vaart Pontsteiger -> NDSM, 5 minuten overtocht. */
function vaart(
  line: string,
  from: string,
  to: string,
  vertrek: string,
  duurMin = 5,
  last = false,
): Sailing {
  const departMs = om(vertrek)
  return { line, from, to, departMs, arriveMs: departMs + duurMin * 60_000, last }
}

const legs: LegTimes = {
  // 12 minuten fietsen naar Pontsteiger, 9 naar Centraal.
  toStop: { pontsteiger: 12 * 60, centraalstation: 9 * 60 },
  // en 5 minuten van NDSM naar de bestemming.
  fromStop: { ndsmwerf: 5 * 60 },
  direct: null,
  estimated: false,
}

const basis: PlannerInput = {
  arriveByMs: null,
  nowMs: NU,
  mode: 'fiets',
  marginMin: MARGIN_MIN_DEFAULT,
}

describe('terugrekenen vanaf een aankomsttijd', () => {
  const sailings = [
    vaart('F7', 'pontsteiger', 'ndsmwerf', '2026-09-08T22:55:00+02:00'),
    vaart('F7', 'pontsteiger', 'ndsmwerf', '2026-09-08T23:10:00+02:00'),
  ]

  it('kiest de laatste pont die nog op tijd is', () => {
    // Aan om 23:05 lukt met de pont van 22:55; die van 23:10 komt te laat.
    const r = planRoutes(
      { ...basis, arriveByMs: om('2026-09-08T23:06:00+02:00') },
      sailings,
      legs,
    )
    expect(r.options).toHaveLength(1)
    expect(clockOf(r.options[0].sailing!.departMs)).toBe('22:55')
    expect(clockOf(r.options[0].arriveAtMs)).toBe('23:05')
  })

  it('rekent het uiterste vertrek terug over marge en fietstijd', () => {
    // 22:55 min 2 minuten marge min 12 minuten fietsen = 22:41.
    const r = planRoutes(
      { ...basis, arriveByMs: om('2026-09-08T23:06:00+02:00') },
      sailings,
      legs,
    )
    expect(clockOf(r.options[0].leaveByMs)).toBe('22:41')
  })

  it('zet het laatst mogelijke vertrek bovenaan', () => {
    const r = planRoutes(
      { ...basis, arriveByMs: om('2026-09-08T23:20:00+02:00') },
      sailings,
      legs,
    )
    // Allebei halen het; de pont van 23:10 laat je het langst doorwerken,
    // maar het is dezelfde verbinding dus er blijft één optie over.
    expect(r.options).toHaveLength(1)
    expect(clockOf(r.options[0].sailing!.departMs)).toBe('23:10')
  })

  it('geeft niets terug als je nu al te laat weg zou moeten', () => {
    const r = planRoutes(
      { ...basis, nowMs: om('2026-09-08T22:50:00+02:00'), arriveByMs: om('2026-09-08T23:06:00+02:00') },
      sailings,
      legs,
    )
    expect(r.options).toHaveLength(0)
    expect(r.noFerryTonight).toBe(true)
  })
})

describe('marge bij de steiger', () => {
  const sailings = [vaart('F7', 'pontsteiger', 'ndsmwerf', '2026-09-08T22:55:00+02:00')]

  it('schuift het vertrek naar voren', () => {
    const zonder = planRoutes({ ...basis, marginMin: 0 }, sailings, legs)
    const met = planRoutes({ ...basis, marginMin: 5 }, sailings, legs)
    expect(clockOf(zonder.options[0].leaveByMs)).toBe('22:43')
    expect(clockOf(met.options[0].leaveByMs)).toBe('22:38')
  })

  it('houdt zich aan de grenzen nul tot vijf', () => {
    const negatief = planRoutes({ ...basis, marginMin: -3 }, sailings, legs)
    const teveel = planRoutes({ ...basis, marginMin: 99 }, sailings, legs)
    expect(clockOf(negatief.options[0].leaveByMs)).toBe('22:43')
    expect(clockOf(teveel.options[0].leaveByMs)).toBe('22:38')
  })
})

describe('vooruit rekenen vanaf nu', () => {
  it('zet de snelste aankomst bovenaan', () => {
    const sailings = [
      vaart('F7', 'pontsteiger', 'ndsmwerf', '2026-09-08T22:55:00+02:00'),
      // F4 vaart eerder weg maar doet er langer over.
      vaart('F4', 'centraalstation', 'ndsmwerf', '2026-09-08T22:40:00+02:00', 13),
    ]
    const r = planRoutes(basis, sailings, legs)
    expect(r.options[0].sailing!.line).toBe('F4')
    expect(clockOf(r.options[0].arriveAtMs)).toBe('22:58')
    expect(r.options[1].sailing!.line).toBe('F7')
  })

  it('meet het verschil met de beste optie in minuten', () => {
    const sailings = [
      vaart('F7', 'pontsteiger', 'ndsmwerf', '2026-09-08T22:55:00+02:00'),
      vaart('F4', 'centraalstation', 'ndsmwerf', '2026-09-08T22:40:00+02:00', 13),
    ]
    const r = planRoutes(basis, sailings, legs)
    expect(r.options[0].deltaMin).toBe(0)
    // F7 komt om 23:05 aan, F4 om 22:58: zeven minuten later.
    expect(r.options[1].deltaMin).toBe(7)
  })

  it('toont hooguit drie opties', () => {
    const sailings = ['F1', 'F2', 'F3', 'F4', 'F7'].map((l, i) =>
      vaart(l, 'pontsteiger', 'ndsmwerf', `2026-09-08T22:${30 + i * 5}:00+02:00`),
    )
    const r = planRoutes(basis, sailings, legs)
    expect(r.options).toHaveLength(MAX_OPTIONS)
  })
})

describe('laatste pont', () => {
  it('geeft door dat dit de laatste afvaart is', () => {
    const sailings = [vaart('F7', 'pontsteiger', 'ndsmwerf', '2026-09-08T23:50:00+02:00', 5, true)]
    const r = planRoutes(basis, sailings, legs)
    expect(r.options[0].sailing!.last).toBe(true)
  })

  it('meldt dat er vanavond niets meer vaart bij een te late aankomsttijd', () => {
    const sailings = [vaart('F7', 'pontsteiger', 'ndsmwerf', '2026-09-08T23:50:00+02:00', 5, true)]
    const r = planRoutes(
      // Je wilt om 23:30 aankomen, maar de laatste pont gaat pas om 23:50.
      { ...basis, arriveByMs: om('2026-09-08T23:30:00+02:00') },
      sailings,
      legs,
    )
    expect(r.options).toHaveLength(0)
    expect(r.noFerryTonight).toBe(true)
  })

  it('meldt niets als er helemaal geen afvaarten zijn aangeleverd', () => {
    // Geen data is iets anders dan "er vaart niets meer".
    const r = planRoutes({ ...basis, arriveByMs: om('2026-09-08T23:30:00+02:00') }, [], legs)
    expect(r.noFerryTonight).toBe(false)
  })
})

describe('storingen', () => {
  const sailings = [
    vaart('F4', 'centraalstation', 'ndsmwerf', '2026-09-08T22:40:00+02:00', 13),
    vaart('F7', 'pontsteiger', 'ndsmwerf', '2026-09-08T22:55:00+02:00'),
  ]

  it('slaat een lijn met een storing over', () => {
    const r = planRoutes(basis, sailings, legs, ['F4'])
    expect(r.options.every((o) => o.sailing?.line !== 'F4')).toBe(true)
    expect(r.options[0].sailing!.line).toBe('F7')
  })

  it('vertelt welke lijn is overgeslagen', () => {
    const r = planRoutes(basis, sailings, legs, ['F4'])
    expect(r.skippedLines).toEqual(['F4'])
  })

  it('houdt niets over als alles stilligt', () => {
    const r = planRoutes(basis, sailings, legs, ['F4', 'F7'])
    expect(r.options).toHaveLength(0)
    expect(r.skippedLines).toEqual(['F4', 'F7'])
  })
})

describe('de route zonder pont', () => {
  const metDirect: LegTimes = { ...legs, direct: 18 * 60 }

  it('telt mee als de bestemming aan dezelfde kant ligt', () => {
    const r = planRoutes(basis, [], metDirect)
    expect(r.options).toHaveLength(1)
    expect(r.options[0].kind).toBe('direct')
  })

  it('rekent bij een aankomsttijd terug wanneer je weg moet', () => {
    const r = planRoutes(
      { ...basis, arriveByMs: om('2026-09-08T23:00:00+02:00') },
      [],
      metDirect,
    )
    expect(clockOf(r.options[0].leaveByMs)).toBe('22:42')
  })

  it('verliest het van een snellere pont', () => {
    const sailings = [vaart('F4', 'centraalstation', 'ndsmwerf', '2026-09-08T22:40:00+02:00', 13)]
    const r = planRoutes(basis, sailings, metDirect)
    // Pont: aan om 22:58. Rechtstreeks: nu + 18 min = 22:18. Rechtstreeks wint.
    expect(r.options[0].kind).toBe('direct')
    expect(clockOf(r.options[0].arriveAtMs)).toBe('22:18')
  })

  it('telt niet mee aan de overkant', () => {
    const r = planRoutes(basis, [], legs)
    expect(r.options).toHaveLength(0)
  })
})

describe('ontbrekende reistijden', () => {
  it('slaat een steiger over waarvoor we geen reistijd hebben', () => {
    const sailings = [vaart('F3', 'buiksloterweg', 'centraalstation', '2026-09-08T22:30:00+02:00')]
    const r = planRoutes(basis, sailings, legs)
    expect(r.options).toHaveLength(0)
  })
})

describe('schatting doorgeven', () => {
  it('geeft door dat de reistijden geschat zijn', () => {
    const sailings = [vaart('F7', 'pontsteiger', 'ndsmwerf', '2026-09-08T22:55:00+02:00')]
    expect(planRoutes(basis, sailings, { ...legs, estimated: true }).estimated).toBe(true)
    expect(planRoutes(basis, sailings, legs).estimated).toBe(false)
  })
})

describe('klok en minuten', () => {
  it('toont Amsterdamse tijd, ook bij een UTC-tijdstempel', () => {
    expect(clockOf(Date.parse('2026-09-08T20:41:00Z'))).toBe('22:41')
    // In de winter is het verschil een uur.
    expect(clockOf(Date.parse('2026-01-12T20:41:00Z'))).toBe('21:41')
  })

  it('rondt reistijd af op hele minuten en nooit op nul', () => {
    expect(minutesOf(12 * 60)).toBe(12)
    expect(minutesOf(100)).toBe(2)
    expect(minutesOf(20)).toBe(1)
    expect(minutesOf(0)).toBe(1)
  })
})

describe('de klokwissel', () => {
  it('rekent over de nacht waarin de klok verspringt gewoon door', () => {
    // In de nacht van 25 oktober 2026 gaat de klok van 03:00 naar 02:00.
    // Absolute tijden lopen door; alleen de weergave verspringt.
    const vertrek = om('2026-10-25T02:30:00+02:00') // zomertijd, vlak voor de wissel
    const s: Sailing = {
      line: 'F4', from: 'pontsteiger', to: 'ndsmwerf',
      departMs: vertrek, arriveMs: vertrek + 5 * 60_000, last: true,
    }
    const r = planRoutes(
      { ...basis, nowMs: vertrek - 30 * 60_000, arriveByMs: null },
      [s],
      legs,
    )
    expect(r.options).toHaveLength(1)
    // 2,5 uur later op de klok is 02:35 in de zomertijd; na de wissel leest
    // hetzelfde moment als 02:35. De som klopt hoe dan ook in ms.
    expect(r.options[0].arriveAtMs - r.options[0].sailing!.departMs).toBe(10 * 60_000)
  })
})

describe('arrivalInstant', () => {
  it('leest de tijd op de Amsterdamse klok, niet die van het toestel', () => {
    // Een browser zonder tijdzone staat op UTC. "23:15" betekent dan nog
    // steeds 23:15 in Amsterdam, en dat is 21:15 UTC in de zomer.
    const nu = new Date('2026-09-08T17:47:00Z') // 19:47 in Amsterdam
    const ms = arrivalInstant('23:15', nu)
    expect(ms).not.toBeNull()
    expect(clockOf(ms as number)).toBe('23:15')
    expect(new Date(ms as number).toISOString()).toBe('2026-09-08T21:15:00.000Z')
  })

  it('pakt morgen als de tijd vandaag al voorbij is', () => {
    const nu = new Date('2026-09-08T21:00:00Z') // 23:00 in Amsterdam
    const ms = arrivalInstant('07:30', nu) as number
    expect(clockOf(ms)).toBe('07:30')
    expect(new Date(ms).toISOString().slice(0, 10)).toBe('2026-09-09')
  })

  it('werkt ook in de wintertijd', () => {
    const nu = new Date('2026-01-12T10:00:00Z') // 11:00 in Amsterdam
    const ms = arrivalInstant('23:15', nu) as number
    expect(clockOf(ms)).toBe('23:15')
    expect(new Date(ms).toISOString()).toBe('2026-01-12T22:15:00.000Z')
  })

  it('weigert onzin', () => {
    expect(arrivalInstant('')).toBeNull()
    expect(arrivalInstant('kaas')).toBeNull()
    expect(arrivalInstant('25:00')).toBeNull()
    expect(arrivalInstant('12:75')).toBeNull()
  })

  it('neemt ook een tijd van één cijfer aan', () => {
    const ms = arrivalInstant('7:05', new Date('2026-09-08T01:00:00Z')) as number
    expect(clockOf(ms)).toBe('07:05')
  })
})
