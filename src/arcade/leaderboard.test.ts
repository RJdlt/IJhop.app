import { describe, expect, it } from 'vitest'
import { dedupeByPlayer, type ScoreRow } from './leaderboard'

describe('dedupeByPlayer', () => {
  it('houdt per speler de hoogste score en sorteert aflopend', () => {
    const rows: ScoreRow[] = [
      { name: 'Pim', score: 30, user_id: 'a' },
      { name: 'Pim', score: 80, user_id: 'a' },
      { name: 'Sven', score: 50, user_id: 'b' },
    ]
    const out = dedupeByPlayer(rows)
    expect(out.map((r) => r.score)).toEqual([80, 50])
    expect(out[0].user_id).toBe('a')
  })

  it('behoudt oude rijen zonder user_id afzonderlijk', () => {
    const rows: ScoreRow[] = [
      { name: 'A', score: 10, user_id: null },
      { name: 'B', score: 20 },
    ]
    const out = dedupeByPlayer(rows)
    expect(out).toHaveLength(2)
    expect(out[0].score).toBe(20)
  })
})
