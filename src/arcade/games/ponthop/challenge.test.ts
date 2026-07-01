import { describe, expect, it } from 'vitest'
import { challengeFor, progressFor } from './challenge'

describe('challengeFor', () => {
  it('is deterministisch per datum', () => {
    expect(challengeFor('2026-07-01')).toEqual(challengeFor('2026-07-01'))
  })

  it('geeft een geldig doel en beloning', () => {
    for (const d of ['2026-07-01', '2026-07-02', '2026-12-25']) {
      const c = challengeFor(d)
      expect(['coins', 'crossings', 'score']).toContain(c.kind)
      expect(c.target).toBeGreaterThan(0)
      expect(c.reward).toBeGreaterThan(0)
    }
  })
})

describe('progressFor', () => {
  it('kiest het juiste getal per soort', () => {
    const stats = { coins: 5, crossings: 12, bestScore: 90 }
    expect(progressFor({ date: 'x', kind: 'coins', target: 10, reward: 20 }, stats)).toBe(5)
    expect(progressFor({ date: 'x', kind: 'crossings', target: 10, reward: 20 }, stats)).toBe(12)
    expect(progressFor({ date: 'x', kind: 'score', target: 10, reward: 20 }, stats)).toBe(90)
  })
})
