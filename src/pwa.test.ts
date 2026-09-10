import { describe, expect, it } from 'vitest'
import { isStale, MAX_STALE_MS, updateIsWaiting, UPDATE_INTERVAL_MS } from './pwa'

const UUR = 3_600_000

describe('bovengrens op hoe oud een draaiende build mag zijn', () => {
  const nu = Date.parse('2026-09-10T12:00:00Z')

  it('is een etmaal', () => {
    expect(MAX_STALE_MS).toBe(24 * UUR)
  })

  it('vindt een controle van een uur geleden vers genoeg', () => {
    expect(isStale(nu - UUR, nu)).toBe(false)
  })

  it('slaat alarm na 24 uur', () => {
    expect(isStale(nu - 23 * UUR, nu)).toBe(false)
    expect(isStale(nu - 24 * UUR, nu)).toBe(true)
    expect(isStale(nu - 40 * UUR, nu)).toBe(true)
  })

  it('kijkt sowieso als er nog nooit gekeken is', () => {
    expect(isStale(null, nu)).toBe(true)
    expect(isStale(Number.NaN, nu)).toBe(true)
  })

  it('kijkt vaker dan de bovengrens, anders is die grens zinloos', () => {
    expect(UPDATE_INTERVAL_MS).toBeLessThan(MAX_STALE_MS)
  })
})

describe('wanneer tonen we de balk', () => {
  it('toont hem als er een nieuwe worker klaarstaat', () => {
    expect(updateIsWaiting({ waiting: {} }, true)).toBe(true)
  })

  it('zwijgt bij de allereerste installatie', () => {
    // Ook dan staat er even eentje te wachten, maar dat is geen update en
    // een balk zou de bezoeker alleen maar in verwarring brengen.
    expect(updateIsWaiting({ waiting: {} }, false)).toBe(false)
  })

  it('zwijgt als er niets wacht', () => {
    expect(updateIsWaiting({ waiting: null }, true)).toBe(false)
  })
})
