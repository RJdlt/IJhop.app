import { describe, expect, it } from 'vitest'
import {
  applyRunResult,
  buyCharacter,
  CHARACTERS,
  characterById,
  isUnlocked,
  playerLevel,
  runLevel,
  runReward,
  selectCharacter,
  type Profile,
} from './profile'

const base: Profile = { wallet: 0, totalCrossings: 0, bought: [], selected: 'pim' }

describe('beloning', () => {
  it('telt munten plus een bescheiden afstand-bonus', () => {
    expect(runReward({ crossings: 10, coins: 4 })).toBe(9) // 4 + floor(10/2)
  })

  it('schrijft bonus en overstekens bij in de spaarpot', () => {
    const p = applyRunResult(base, { crossings: 10, coins: 4 })
    expect(p.wallet).toBe(9)
    expect(p.totalCrossings).toBe(10)
  })
})

describe('vrijspelen', () => {
  const tourist = characterById('toerist') // mijlpaal: 30 overstekens
  const cyclist = characterById('wielrenner') // shop: 150

  it('gratis poppetje is altijd vrij', () => {
    expect(isUnlocked(base, CHARACTERS[0])).toBe(true)
  })

  it('mijlpaal opent vanzelf bij genoeg overstekens', () => {
    expect(isUnlocked(base, tourist)).toBe(false)
    expect(isUnlocked({ ...base, totalCrossings: 30 }, tourist)).toBe(true)
  })

  it('koopt een shop-poppetje en trekt de prijs af', () => {
    const rich = { ...base, wallet: 200 }
    const after = buyCharacter(rich, 'wielrenner')
    expect(after.wallet).toBe(50) // 200 - 150
    expect(after.bought).toContain('wielrenner')
    expect(after.selected).toBe('wielrenner')
  })

  it('koopt niet zonder genoeg stroopwafels', () => {
    const poor = { ...base, wallet: 50 }
    expect(buyCharacter(poor, 'wielrenner')).toEqual(poor)
  })

  it('selecteert geen vergrendeld poppetje', () => {
    expect(selectCharacter(base, cyclist.id).selected).toBe('pim')
  })
})

describe('levels', () => {
  it('per-run level loopt op met overstekens', () => {
    expect(runLevel(0)).toBe(1)
    expect(runLevel(3)).toBe(2)
    expect(runLevel(9)).toBe(4)
  })

  it('spelerniveau groeit met totaal en is monotoon', () => {
    expect(playerLevel(0)).toBe(1)
    expect(playerLevel(5)).toBe(2)
    expect(playerLevel(1000)).toBeGreaterThan(playerLevel(100))
  })
})
