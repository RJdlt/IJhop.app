import { describe, expect, it } from 'vitest'
import {
  dealCardMode,
  dealValidityLabel,
  dealWalkLabel,
  modeShowsPhoto,
  OFFER_MAX_WORDS,
  REDEEMED_STRIP_MS,
  stripStatus,
  validateOffer,
} from './dealCard'
import { amsterdamInstant } from './time'

/** Een moment op de Amsterdamse klok, ongeacht waar de test draait. */
const om = (dag: string, klok: string) => new Date(amsterdamInstant(dag, klok) as string)

describe('dealCardMode', () => {
  // 7 september 2026 is een maandag in de zomertijd.
  const ma = (klok: string) => om('2026-09-07', klok)

  it('houdt de ochtendspits compact', () => {
    expect(dealCardMode(ma('06:00:00'))).toBe('compact')
    expect(dealCardMode(ma('08:15:00'))).toBe('compact')
    expect(dealCardMode(ma('10:29:59'))).toBe('compact')
  })

  it('gaat om 10:30 over op de normale kaart', () => {
    expect(dealCardMode(ma('10:30:00'))).toBe('normaal')
    expect(dealCardMode(ma('13:00:00'))).toBe('normaal')
    expect(dealCardMode(ma('16:29:59'))).toBe('normaal')
  })

  it('toont vanaf 16:30 de volledige kaart', () => {
    expect(dealCardMode(ma('16:30:00'))).toBe('vol')
    expect(dealCardMode(ma('18:45:00'))).toBe('vol')
    expect(dealCardMode(ma('20:59:59'))).toBe('vol')
  })

  it("is 's nachts weer compact", () => {
    expect(dealCardMode(ma('21:00:00'))).toBe('compact')
    expect(dealCardMode(ma('23:30:00'))).toBe('compact')
    expect(dealCardMode(ma('03:00:00'))).toBe('compact')
    expect(dealCardMode(ma('05:59:59'))).toBe('compact')
  })

  it('rekent in Amsterdamse tijd en niet in UTC', () => {
    // 17:00 UTC is hier 19:00 in de zomer: volledige kaart, geen compacte.
    expect(dealCardMode(new Date('2026-09-07T17:00:00Z'))).toBe('vol')
    // En in de winter is 17:00 UTC hier 18:00, dus nog steeds vol.
    expect(dealCardMode(new Date('2026-01-12T17:00:00Z'))).toBe('vol')
    // 06:00 UTC is in de zomer 08:00 hier: compact.
    expect(dealCardMode(new Date('2026-09-07T06:00:00Z'))).toBe('compact')
  })

  it('toont alleen bij de volledige kaart een foto', () => {
    expect(modeShowsPhoto('vol')).toBe(true)
    expect(modeShowsPhoto('normaal')).toBe(false)
    expect(modeShowsPhoto('compact')).toBe(false)
  })
})

describe('validateOffer', () => {
  it('keurt een eindprijs goed', () => {
    expect(validateOffer("Twee pizza's voor 21 euro").ok).toBe(true)
    expect(validateOffer('Koffie en appeltaart 6 euro').ok).toBe(true)
  })

  it('weigert meer dan zes woorden en zegt hoeveel het er zijn', () => {
    const r = validateOffer('Een heel lang aanbod met veel te veel woorden erin')
    expect(r.ok).toBe(false)
    expect(r.reason).toContain(String(OFFER_MAX_WORDS))
    expect(r.reason).toContain('10')
  })

  it('accepteert precies zes woorden', () => {
    expect(validateOffer('een twee drie vier vijf zes').ok).toBe(true)
    expect(validateOffer('een twee drie vier vijf zes zeven').ok).toBe(false)
  })

  it('weigert percentages en legt uit waarom', () => {
    const r = validateOffer('20% op alles')
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/eindprijs/i)
  })

  it('weigert reclamewoorden', () => {
    for (const woord of ['korting', 'gratis', 'aanbieding', 'actie']) {
      const r = validateOffer(`Pizza met ${woord} erbij`)
      expect(r.ok, woord).toBe(false)
      expect(r.reason).toContain(woord)
    }
  })

  it('kijkt niet naar hoofdletters', () => {
    expect(validateOffer('Twee pizzas GRATIS erbij').ok).toBe(false)
  })

  it('weigert een leeg aanbod', () => {
    expect(validateOffer('').ok).toBe(false)
    expect(validateOffer('   ').ok).toBe(false)
  })
})

describe('dealWalkLabel', () => {
  it('zegt hoeveel minuten lopen vanaf je eigen steiger', () => {
    expect(dealWalkLabel('ndsmwerf', ['ndsmwerf'], ['centraalstation'], 3)).toBe(
      '3 min lopen vanaf de steiger',
    )
  })

  it('waarschuwt als de zaak aan de overkant ligt', () => {
    expect(dealWalkLabel('ndsmwerf', ['centraalstation'], ['ndsmwerf'], 3)).toBe(
      'aan de overkant · 3 min lopen',
    )
  })

  it('kiest de eigen kant als de steiger aan allebei de kanten voorkomt', () => {
    // Twee favoriete lijnen die op NDSM samenkomen: je staat er zelf, dus
    // "aan de overkant" zou onwaar zijn.
    expect(dealWalkLabel('ndsmwerf', ['ndsmwerf'], ['ndsmwerf'], 4)).toBe(
      '4 min lopen vanaf de steiger',
    )
  })

  it('laat de minuten weg als ze ontbreken', () => {
    expect(dealWalkLabel('ndsmwerf', ['ndsmwerf'], [], null)).toBe('bij de steiger')
    expect(dealWalkLabel('ndsmwerf', [], ['ndsmwerf'], 0)).toBe('aan de overkant')
  })

  it('spreekt ook Engels', () => {
    expect(dealWalkLabel('x', ['x'], [], 3, 'en')).toBe('3 min walk from the ferry stop')
    expect(dealWalkLabel('x', [], ['x'], 3, 'en')).toBe('across the water · 3 min walk')
  })
})

describe('dealValidityLabel', () => {
  const eind = amsterdamInstant('2026-09-09', '23:59:59') as string // woensdag

  it('noemt de laatste dag zolang er nog dagen zijn', () => {
    expect(dealValidityLabel(eind, om('2026-09-07', '09:00:00'))).toBe('t/m woensdag')
  })

  it('zegt "nog vandaag" in de laatste 24 uur', () => {
    // Het venster eindigt woensdag om 23:59:59, dus de laatste 24 uur valt
    // samen met woensdag zelf. Dinsdagavond is nog bijna 28 uur te gaan.
    expect(dealValidityLabel(eind, om('2026-09-09', '00:30:00'))).toBe('nog vandaag')
    expect(dealValidityLabel(eind, om('2026-09-09', '08:00:00'))).toBe('nog vandaag')
    expect(dealValidityLabel(eind, om('2026-09-08', '20:00:00'))).toBe('t/m woensdag')
  })

  it('wijst naar maandag zodra het venster dicht is', () => {
    expect(dealValidityLabel(eind, om('2026-09-11', '09:00:00'))).toBe('vanaf maandag')
    expect(dealValidityLabel(eind, om('2026-09-07', '09:00:00'), 'nl', false)).toBe('vanaf maandag')
  })

  it('telt geen uren en minuten af', () => {
    // Nep-urgentie hoort niet bij een deal die dagen loopt.
    expect(dealValidityLabel(eind, om('2026-09-07', '09:00:00'))).not.toMatch(/\d\d:\d\d/)
  })

  it('spreekt ook Engels', () => {
    expect(dealValidityLabel(eind, om('2026-09-07', '09:00:00'), 'en')).toBe('through Wednesday')
    expect(dealValidityLabel(eind, om('2026-09-09', '08:00:00'), 'en')).toBe('today only')
  })
})

describe('stripStatus', () => {
  const eind = amsterdamInstant('2026-09-09', '23:59:59') as string
  const nu = om('2026-09-08', '12:00:00')

  it('toont niets zonder code', () => {
    expect(stripStatus(null, eind, nu)).toBe('geen')
  })

  it('toont de strook zodra je de code hebt', () => {
    expect(stripStatus({ code: 'AB37', redeemed_at: null }, eind, nu)).toBe('gepakt')
  })

  it('verdwijnt als de deal verlopen is', () => {
    expect(stripStatus({ code: 'AB37', redeemed_at: null }, eind, om('2026-09-12', '12:00:00'))).toBe('geen')
  })

  it('blijft na inwisselen nog een dag staan', () => {
    const ingewisseld = { code: 'AB37', redeemed_at: nu.toISOString() }
    expect(stripStatus(ingewisseld, eind, nu)).toBe('ingewisseld')
    expect(stripStatus(ingewisseld, eind, new Date(nu.getTime() + REDEEMED_STRIP_MS - 1000))).toBe('ingewisseld')
    expect(stripStatus(ingewisseld, eind, new Date(nu.getTime() + REDEEMED_STRIP_MS + 1000))).toBe('geen')
  })

  it('laat een ingewisselde code de deal-einddatum overleven', () => {
    // Woensdagavond ingewisseld: donderdag hoort de bevestiging er nog te staan.
    const wo = om('2026-09-09', '20:00:00')
    expect(stripStatus({ code: 'AB37', redeemed_at: wo.toISOString() }, eind, om('2026-09-10', '09:00:00'))).toBe('ingewisseld')
  })

  it('valt niet om op onzin-tijdstempels', () => {
    expect(stripStatus({ code: 'AB37', redeemed_at: 'kaas' }, eind, nu)).toBe('geen')
    expect(stripStatus({ code: 'AB37', redeemed_at: null }, 'kaas', nu)).toBe('geen')
  })
})
