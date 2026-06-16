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

  it('maskeert grof taalgebruik maar houdt de naam bruikbaar', () => {
    const out = sanitizeName('fuck jij')
    expect(out).not.toContain('fuck')
    expect(out.toLowerCase()).toContain('jij')
  })
})

describe('hasProfanity', () => {
  it('herkent een scheldwoord', () => {
    expect(hasProfanity('vuile shit')).toBe(true)
    expect(hasProfanity('Vrolijke Reiger')).toBe(false)
  })
})
