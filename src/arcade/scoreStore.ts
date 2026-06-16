/**
 * Eén score-store voor alle arcade-spellen. Per spel een record, in een
 * generieke vorm zodat een leaderboard later meerdere spellen tegelijk aankan.
 */

const KEY = 'ijhop.arcade.scores'

export interface GameScore {
  high: number
  plays: number
  /** epoch-ms van de laatste afgeronde poging */
  lastPlayed: number
}

export type ScoreBook = Record<string, GameScore>

function read(): ScoreBook {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as ScoreBook) : {}
  } catch {
    return {}
  }
}

function write(book: ScoreBook): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(book))
  } catch {
    // Privémodus of vol quota: scores zijn niet essentieel, faal stil.
  }
}

export function getHighScore(gameId: string): number {
  return read()[gameId]?.high ?? 0
}

export function getScoreBook(): ScoreBook {
  return read()
}

/** Legt een afgeronde poging vast en meldt of het een nieuw record was. */
export function recordScore(gameId: string, score: number): { high: number; isRecord: boolean } {
  const book = read()
  const prev = book[gameId] ?? { high: 0, plays: 0, lastPlayed: 0 }
  const isRecord = score > prev.high
  book[gameId] = {
    high: Math.max(prev.high, score),
    plays: prev.plays + 1,
    lastPlayed: Date.now(),
  }
  write(book)
  return { high: book[gameId].high, isRecord }
}
