import { describe, expect, it } from 'vitest'
import { amsterdamDay, nextProfile, variantFor } from './profile'
import type { Profile } from './profile'

describe('variant-toewijzing', () => {
  it('geeft hetzelfde id altijd dezelfde arm', () => {
    const id = '2f1c9a4e-0d5b-4c8a-9f11-6b0f2a7c3d55'
    expect(variantFor(id)).toBe(variantFor(id))
  })

  it('verdeelt ongeveer half om half', () => {
    let a = 0
    for (let i = 0; i < 2000; i++) {
      if (variantFor(`gebruiker-${i}-${(i * 7919) % 104729}`) === 'A') a++
    }
    // Ruime marges: we toetsen dat de hash niet naar één kant hangt.
    expect(a).toBeGreaterThan(800)
    expect(a).toBeLessThan(1200)
  })

  it('kent alleen A en B', () => {
    for (let i = 0; i < 50; i++) expect(['A', 'B']).toContain(variantFor(String(i)))
  })
})

describe('bezoekteller', () => {
  it('begint op 1 en legt de eerste dag vast', () => {
    const p = nextProfile(null, 'gebruiker-1', '2026-09-10')
    expect(p.visits).toBe(1)
    expect(p.first_seen).toBe('2026-09-10')
  })

  it('telt op bij een volgend bezoek en houdt first_seen vast', () => {
    const eerste = nextProfile(null, 'gebruiker-1', '2026-09-10')
    const tweede = nextProfile(eerste, 'gebruiker-1', '2026-09-14')
    expect(tweede.visits).toBe(2)
    expect(tweede.first_seen).toBe('2026-09-10')
  })

  it('houdt cohort en arm vast als het user_id verandert', () => {
    // Gebeurt zodra de anonieme sessie kwijt is maar het profiel niet: dan
    // mag iemand niet stiekem naar de andere arm of naar een nieuw cohort.
    const oud: Profile = { id: 'oud', first_seen: '2026-08-03', visits: 4, variant: 'B' }
    const nieuw = nextProfile(oud, 'nieuw', '2026-09-10')
    expect(nieuw.variant).toBe('B')
    expect(nieuw.first_seen).toBe('2026-08-03')
    expect(nieuw.visits).toBe(5)
    expect(nieuw.id).toBe('nieuw')
  })

  it('repareert een profiel zonder bruikbare arm', () => {
    const kapot = { id: 'x', first_seen: '2026-09-01', visits: 2 } as Profile
    expect(['A', 'B']).toContain(nextProfile(kapot, 'x', '2026-09-10').variant)
  })
})

describe('amsterdamDay', () => {
  it('rekent naar de Amsterdamse kalenderdag', () => {
    // 21:30 UTC in de zomer is hier al de volgende dag (UTC+2).
    expect(amsterdamDay(new Date('2026-07-04T22:30:00Z'))).toBe('2026-07-05')
    expect(amsterdamDay(new Date('2026-07-04T10:00:00Z'))).toBe('2026-07-04')
  })
})
