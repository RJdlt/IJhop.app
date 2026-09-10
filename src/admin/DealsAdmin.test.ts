import { describe, expect, it } from 'vitest'
import { linesForStop, pinUitkomst } from './DealsAdmin'
import { LINES, LINE_IDS } from '../lib/schedule'

describe('linesForStop', () => {
  it('geeft precies de lijnen die daar aanleggen', () => {
    for (const stop of new Set(LINE_IDS.flatMap((l) => LINES[l].connects))) {
      for (const lijn of linesForStop(stop)) {
        expect(LINES[lijn].connects).toContain(stop)
      }
    }
  })

  it('slaat een onbekende steiger over in plaats van alles te tonen', () => {
    expect(linesForStop('bestaat-niet')).toEqual([])
  })

  it('vindt voor elke lijn zijn eigen twee steigers terug', () => {
    for (const lijn of LINE_IDS) {
      for (const stop of LINES[lijn].connects) {
        expect(linesForStop(stop)).toContain(lijn)
      }
    }
  })
})

describe('pinUitkomst', () => {
  it('bevestigt met de link die de partner nodig heeft', () => {
    const r = pinUitkomst(null, 'Van der Werf', 'van-der-werf')
    expect(r.ok).toBe(true)
    expect(r.tekst).toContain('/partner/van-der-werf')
  })

  it('vertaalt de meldingen van de database naar gewone taal', () => {
    expect(pinUitkomst('pincode is vier cijfers', 'X', 'x').tekst).toBe(
      'Een pincode is precies vier cijfers.',
    )
    expect(pinUitkomst('kies een minder voor de hand liggende pincode', 'X', 'x').tekst).toContain(
      'Te makkelijk te raden',
    )
    expect(pinUitkomst('partner niet gevonden', 'X', 'x').tekst).toContain('Ververs de pagina')
    expect(pinUitkomst('not authorized', 'X', 'x').tekst).toContain('geen admin')
  })

  it('herkent de melding zoals PostgREST hem inpakt', () => {
    // supabase-js geeft de fout terug met de plpgsql-context eromheen.
    const echt = 'pincode is vier cijfers\nCONTEXT: PL/pgSQL function admin_set_partner_pin(uuid,text)'
    expect(pinUitkomst(echt, 'X', 'x').ok).toBe(false)
    expect(pinUitkomst(echt, 'X', 'x').tekst).toBe('Een pincode is precies vier cijfers.')
  })

  it('wijst op de migratie als de functie niet bestaat', () => {
    const r = pinUitkomst(
      'Could not find the function public.admin_set_partner_pin(p_id, p_pin) in the schema cache',
      'X',
      'x',
    )
    expect(r.tekst).toContain('migratie 0019 en 0021')
  })

  it('laat een onbekende fout gewoon zien in plaats van hem te slikken', () => {
    const r = pinUitkomst('TypeError: Failed to fetch', 'X', 'x')
    expect(r.ok).toBe(false)
    expect(r.tekst).toContain('Failed to fetch')
  })

  it('is nooit stil: er komt altijd tekst uit', () => {
    for (const fout of [null, '', 'iets raars', 'not authorized']) {
      expect(pinUitkomst(fout, 'X', 'x').tekst.length).toBeGreaterThan(0)
    }
  })
})
