import { describe, expect, it } from 'vitest'
import { coordsVan, gestoordeLijnen, sailingsBetween, sameSide, trajectenVoor } from './plannerData'
import { amsterdamInstant } from './time'

const DE_PIJP = { lat: 52.3548, lon: 4.8918 }
const CENTRAAL = { lat: 52.3791, lon: 4.9003 }
const NDSM = coordsVan('ndsmwerf')

describe('sailingsBetween', () => {
  const start = Date.parse(amsterdamInstant('2026-09-08', '22:00:00') as string)

  it('geeft afvaarten met absolute tijden binnen het venster', () => {
    const s = sailingsBetween(start, start + 2 * 3600_000)
    expect(s.length).toBeGreaterThan(0)
    expect(s.every((x) => x.departMs >= start)).toBe(true)
    expect(s.every((x) => x.departMs <= start + 2 * 3600_000)).toBe(true)
  })

  it('levert ze op volgorde van vertrek', () => {
    const s = sailingsBetween(start, start + 3 * 3600_000)
    for (let i = 1; i < s.length; i++) expect(s[i].departMs).toBeGreaterThanOrEqual(s[i - 1].departMs)
  })

  it('laat de overtocht altijd na het vertrek eindigen', () => {
    const s = sailingsBetween(start, start + 2 * 3600_000)
    expect(s.every((x) => x.arriveMs > x.departMs)).toBe(true)
  })

  it('markeert per verbinding één laatste afvaart van de dag', () => {
    const s = sailingsBetween(start, start + 20 * 3600_000)
    const f4 = s.filter((x) => x.line === 'F4' && x.from === 'centraalstation')
    expect(f4.length).toBeGreaterThan(1)
    // Binnen twintig uur zit precies één dagovergang, dus één laatste.
    expect(f4.filter((x) => x.last).length).toBeGreaterThanOrEqual(1)
  })

  it('rekent over de klokwissel heen door', () => {
    // De nacht van 25 oktober 2026: van zomertijd naar wintertijd.
    const nacht = Date.parse('2026-10-25T00:00:00+02:00')
    const s = sailingsBetween(nacht, nacht + 6 * 3600_000)
    expect(s.every((x) => Number.isFinite(x.departMs))).toBe(true)
    for (let i = 1; i < s.length; i++) expect(s[i].departMs).toBeGreaterThanOrEqual(s[i - 1].departMs)
  })

  it('geeft niets terug voor een venster van nul', () => {
    expect(sailingsBetween(start, start - 1000)).toHaveLength(0)
  })
})

describe('sameSide', () => {
  it('ziet De Pijp en Centraal aan dezelfde kant', () => {
    expect(sameSide(DE_PIJP, CENTRAAL)).toBe(true)
  })

  it('ziet De Pijp en NDSM aan verschillende kanten', () => {
    expect(sameSide(DE_PIJP, NDSM)).toBe(false)
  })

  it('is symmetrisch', () => {
    expect(sameSide(NDSM, DE_PIJP)).toBe(sameSide(DE_PIJP, NDSM))
  })
})

describe('trajectenVoor', () => {
  it('vraagt heen naar elke vertreksteiger en terug vanaf elke aankomststeiger', () => {
    const t = trajectenVoor(DE_PIJP, NDSM)
    expect(t.toStops.length).toBeGreaterThan(1)
    expect(t.fromStops.length).toBeGreaterThan(1)
    expect(t.pairs.length).toBe(t.toStops.length + t.fromStops.length)
  })

  it('voegt de directe route toe aan dezelfde kant', () => {
    const t = trajectenVoor(DE_PIJP, CENTRAAL)
    expect(t.direct).toBe(true)
    expect(t.pairs.length).toBe(t.toStops.length + t.fromStops.length + 1)
  })

  it('laat de directe route weg aan de overkant', () => {
    expect(trajectenVoor(DE_PIJP, NDSM).direct).toBe(false)
  })
})

describe('gestoordeLijnen', () => {
  const melding = (stops: string[]) => ({
    id: 'x', header: 'storing', stops, start: null, end: null,
  })

  it('vertaalt geraakte steigers naar lijnen', () => {
    // F4 verbindt Centraal met NDSM; een melding over NDSM raakt dus F4.
    const lijnen = gestoordeLijnen([melding(['ndsmwerf'])])
    expect(lijnen).toContain('F4')
  })

  it('laat lijnen die er niet bij horen met rust', () => {
    const lijnen = gestoordeLijnen([melding(['ndsmwerf'])])
    expect(lijnen).not.toContain('F2')
  })

  it('raakt bij een algemene veermelding alle lijnen', () => {
    // Zonder steigers is het een melding over het hele veer; dan valt er niets
    // te plannen, en dat is beter dan een route voorstellen die niet vaart.
    const lijnen = gestoordeLijnen([melding([])])
    expect(lijnen.length).toBeGreaterThan(5)
  })

  it('valt niet om zonder meldingen', () => {
    expect(gestoordeLijnen(null)).toEqual([])
    expect(gestoordeLijnen([])).toEqual([])
  })
})
