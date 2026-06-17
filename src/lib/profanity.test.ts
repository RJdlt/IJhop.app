import { describe, expect, it } from 'vitest'
import { hasProfanity, sanitizeName } from './profanity'

describe('sanitizeName', () => {
  it('trimt en normaliseert spaties', () => {
    expect(sanitizeName('  Kapitein   Pim  ')).toBe('Kapitein Pim')
  })

  it('maximeert de lengte op 24', () => {
    expect(sanitizeName('x'.repeat(40)).length).toBe(24)
  })

  it('valt terug op "Speler" bij leeg', () => {
    expect(sanitizeName('   ')).toBe('Speler')
  })

  it('vervangt ongepaste namen door "Speler"', () => {
    expect(sanitizeName('fuck jij')).toBe('Speler')
  })
})

describe('hasProfanity', () => {
  it('herkent een scheldwoord', () => {
    expect(hasProfanity('vuile shit')).toBe(true)
    expect(hasProfanity('Vrolijke Reiger')).toBe(false)
  })

  it('vangt omzeilingen (leetspeak, spaties, herhalingen)', () => {
    expect(hasProfanity('n1gger')).toBe(true)
    expect(hasProfanity('f u c k')).toBe(true)
    expect(hasProfanity('SHII7')).toBe(false) // geen valide woord, mag door
    expect(hasProfanity('Dappere Schipper')).toBe(false)
  })
})
