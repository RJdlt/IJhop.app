import { beforeEach, describe, expect, it } from 'vitest'
import { bumpVisits, markPrizeSeen, PRIZE_CONFIG, setPrizeDone, shouldOfferPrize } from './prize'

// Eenvoudige localStorage-stub: de tests draaien zonder browser.
function fakeStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage
}

beforeEach(() => {
  globalThis.localStorage = fakeStorage()
})

describe('bezoeken tellen', () => {
  it('begint bij 1 en telt op', () => {
    expect(bumpVisits()).toBe(1)
    expect(bumpVisits()).toBe(2)
    expect(bumpVisits()).toBe(3)
  })

  it('geeft 1 terug als opslag geblokkeerd is', () => {
    globalThis.localStorage = {
      getItem() {
        throw new Error('geblokkeerd')
      },
      setItem() {
        throw new Error('geblokkeerd')
      },
    } as unknown as Storage
    expect(bumpVisits()).toBe(1)
  })
})

describe('prijs-uitnodiging', () => {
  it('slaat het eerste bezoek over', () => {
    expect(shouldOfferPrize(1)).toBe(false)
    expect(shouldOfferPrize(PRIZE_CONFIG.minVisits)).toBe(true)
  })

  it('toont hooguit zo vaak als maxPrompts', () => {
    for (let i = 0; i < PRIZE_CONFIG.maxPrompts; i++) markPrizeSeen()
    expect(shouldOfferPrize(5)).toBe(false)
  })

  it('vraagt niet nog eens wie al meedeed', () => {
    setPrizeDone()
    expect(shouldOfferPrize(9)).toBe(false)
  })
})
