import { describe, expect, it } from 'vitest'
import { buildSignal, matchSeed } from './signal'

describe('buildSignal', () => {
  it('is deterministisch: zelfde seed geeft zelfde signaal', () => {
    expect(buildSignal('overtocht-1|a|b')).toEqual(buildSignal('overtocht-1|a|b'))
  })

  it('levert geldige velden', () => {
    const s = buildSignal('seed-x')
    expect(s.color.hex).toMatch(/^#[0-9A-F]{6}$/i)
    expect(s.color.name.length).toBeGreaterThan(0)
    expect(s.symbol.length).toBeGreaterThan(0)
    expect(s.codeword.length).toBeGreaterThan(0)
    expect(s.meetingPoint).toContain('bij')
  })

  it('verschilt over verschillende seeds (niet allemaal hetzelfde)', () => {
    const set = new Set(Array.from({ length: 12 }, (_, i) => JSON.stringify(buildSignal(`s${i}`))))
    expect(set.size).toBeGreaterThan(1)
  })
})

describe('matchSeed', () => {
  it('is onafhankelijk van de volgorde van de twee mensen', () => {
    expect(matchSeed('room', 'aaa', 'bbb')).toBe(matchSeed('room', 'bbb', 'aaa'))
  })

  it('geeft beide mensen daardoor hetzelfde signaal', () => {
    const seedA = matchSeed('F7@123', 'u1', 'u2')
    const seedB = matchSeed('F7@123', 'u2', 'u1')
    expect(buildSignal(seedA)).toEqual(buildSignal(seedB))
  })
})
