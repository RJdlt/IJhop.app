import { describe, expect, it } from 'vitest'
import { splitLinks } from './DisruptionBanner'

// Teksten naar het echte KV15-formaat, zoals ze na de NL-opschoning in de
// storingsbanner belanden (zie api/_lib/ferryAlerts.mjs nlText).
describe('splitLinks', () => {
  it('maakt een kale domeinnaam klikbaar (het stakings-alert van 9 september)', () => {
    const segs = splitLinks('Vandaag landelijke ov-staking. Meer info: 9292.nl')
    expect(segs).toEqual([
      { text: 'Vandaag landelijke ov-staking. Meer info: ' },
      { text: '9292.nl', href: 'https://9292.nl' },
    ])
  })

  it('ondersteunt www en een pad', () => {
    const segs = splitLinks('Kijk op www.ret.nl/staking voor meer.')
    expect(segs[1]).toEqual({ text: 'www.ret.nl/staking', href: 'https://www.ret.nl/staking' })
    expect(segs[2]).toEqual({ text: ' voor meer.' })
  })

  it('laat een punt aan het einde van de zin buiten de link', () => {
    const segs = splitLinks('Details: gvb.nl.')
    expect(segs[1]).toEqual({ text: 'gvb.nl', href: 'https://gvb.nl' })
    expect(segs[2]).toEqual({ text: '.' })
  })

  it('linkt niet op een ontbrekende spatie na een punt (KV15-slordigheid)', () => {
    // "staking.Meer" mag nooit https://staking.meer worden: "meer" is geen TLD.
    const segs = splitLinks('Vandaag staking.Meer info volgt')
    expect(segs).toEqual([{ text: 'Vandaag staking.Meer info volgt' }])
  })

  it('geeft tekst zonder links als één segment terug', () => {
    expect(splitLinks('Pont F4 vaart tijdelijk niet')).toEqual([{ text: 'Pont F4 vaart tijdelijk niet' }])
  })

  it('behoudt een al volledige https-url', () => {
    const segs = splitLinks('Zie https://gvb.nl/storingen nu')
    expect(segs[1]).toEqual({ text: 'https://gvb.nl/storingen', href: 'https://gvb.nl/storingen' })
  })
})
