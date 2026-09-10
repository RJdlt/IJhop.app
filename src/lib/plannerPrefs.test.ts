import { describe, expect, it } from 'vitest'
import { MAX_RECENT, onthoudPlek } from './plannerPrefs'

const plek = (naam: string) => ({ naam, coords: { lat: 52.37, lon: 4.89 } })

describe('onthoudPlek', () => {
  it('zet het nieuwste vooraan', () => {
    const r = onthoudPlek([plek('Werk')], plek('De Pijp'))
    expect(r.map((x) => x.naam)).toEqual(['De Pijp', 'Werk'])
  })

  it('houdt er hooguit drie', () => {
    let r = [plek('A'), plek('B'), plek('C')]
    r = onthoudPlek(r, plek('D'))
    expect(r).toHaveLength(MAX_RECENT)
    expect(r.map((x) => x.naam)).toEqual(['D', 'A', 'B'])
  })

  it('schuift een bestaande plek naar voren in plaats van hem te verdubbelen', () => {
    const r = onthoudPlek([plek('A'), plek('B')], plek('B'))
    expect(r.map((x) => x.naam)).toEqual(['B', 'A'])
  })

  it('kijkt daarbij niet naar hoofdletters of spaties', () => {
    const r = onthoudPlek([plek('De Pijp')], plek('  de pijp  '))
    expect(r).toHaveLength(1)
    expect(r[0].naam).toBe('de pijp')
  })

  it('negeert een lege naam', () => {
    const r = onthoudPlek([plek('A')], plek('   '))
    expect(r.map((x) => x.naam)).toEqual(['A'])
  })
})
