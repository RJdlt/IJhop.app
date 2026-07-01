/**
 * Dagelijkse uitdaging plus speel-streak voor Pont Hop.
 *
 * Elke dag een klein, deterministisch doel (afhankelijk van de datum), met een
 * beloning in stroopwafels. Voortgang en streak worden lokaal bewaard. Zuivere
 * functies (challengeFor, progressFor) zijn los testbaar; de opslag faalt stil.
 */

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return h >>> 0
  }
}
function mulberry32(a: number): () => number {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function rngFromSeed(seed: string): () => number {
  return mulberry32(xmur3(seed)())
}

export type ChallengeKind = 'coins' | 'crossings' | 'score'
export interface DailyChallenge {
  date: string
  kind: ChallengeKind
  target: number
  reward: number
}
export interface RunStats {
  coins: number
  crossings: number
  score: number
}

const KINDS: ChallengeKind[] = ['coins', 'crossings', 'score']

function localDate(d = new Date()): string {
  return d.toLocaleDateString('en-CA') // YYYY-MM-DD in lokale tijd
}

/** De uitdaging voor een datum (deterministisch). */
export function challengeFor(date: string): DailyChallenge {
  const rng = rngFromSeed('chal-' + date)
  const kind = KINDS[Math.floor(rng() * KINDS.length)]
  if (kind === 'coins') return { date, kind, target: 8 + Math.floor(rng() * 13), reward: 20 }
  if (kind === 'crossings') return { date, kind, target: 15 + Math.floor(rng() * 26), reward: 20 }
  return { date, kind, target: 70 + Math.floor(rng() * 80), reward: 30 }
}

/** Voortgang van een uitdaging bij gegeven dag-statistieken. */
export function progressFor(
  ch: DailyChallenge,
  stats: { coins: number; crossings: number; bestScore: number },
): number {
  if (ch.kind === 'coins') return stats.coins
  if (ch.kind === 'crossings') return stats.crossings
  return stats.bestScore
}

interface Prog {
  date: string
  coins: number
  crossings: number
  bestScore: number
  claimed: boolean
}
const PROG_KEY = 'ijhop:challenge'
const STREAK_KEY = 'ijhop:streak'

function loadProg(): Prog {
  const d = localDate()
  try {
    const raw = JSON.parse(localStorage.getItem(PROG_KEY) || 'null') as Prog | null
    if (raw && raw.date === d) return raw
  } catch {
    /* stil */
  }
  return { date: d, coins: 0, crossings: 0, bestScore: 0, claimed: false }
}
function saveProg(p: Prog): void {
  try {
    localStorage.setItem(PROG_KEY, JSON.stringify(p))
  } catch {
    /* stil */
  }
}
function loadStreak(): { lastDate: string; streak: number } {
  try {
    const r = JSON.parse(localStorage.getItem(STREAK_KEY) || 'null') as { lastDate: string; streak: number } | null
    if (r) return r
  } catch {
    /* stil */
  }
  return { lastDate: '', streak: 0 }
}
function bumpStreak(): number {
  const d = localDate()
  const s = loadStreak()
  if (s.lastDate === d) return s.streak
  const yesterday = localDate(new Date(Date.now() - 86_400_000))
  const streak = s.lastDate === yesterday ? s.streak + 1 : 1
  try {
    localStorage.setItem(STREAK_KEY, JSON.stringify({ lastDate: d, streak }))
  } catch {
    /* stil */
  }
  return streak
}

export interface ChallengeState {
  challenge: DailyChallenge
  progress: number
  done: boolean
  streak: number
}

/** Huidige stand voor de UI. */
export function getChallengeState(): ChallengeState {
  const ch = challengeFor(localDate())
  const p = loadProg()
  const progress = progressFor(ch, p)
  return {
    challenge: ch,
    progress: Math.min(progress, ch.target),
    done: progress >= ch.target,
    streak: loadStreak().streak,
  }
}

/** Verwerkt een afgerond potje: werk voortgang plus streak bij. Geeft terug of
 *  de uitdaging nu net gehaald is en de bijbehorende beloning. */
export function recordRun(run: RunStats): { justCompleted: boolean; reward: number } {
  bumpStreak()
  const ch = challengeFor(localDate())
  const p = loadProg()
  p.coins += run.coins
  p.crossings += run.crossings
  p.bestScore = Math.max(p.bestScore, run.score)
  const progress = progressFor(ch, p)
  let justCompleted = false
  let reward = 0
  if (progress >= ch.target && !p.claimed) {
    p.claimed = true
    justCompleted = true
    reward = ch.reward
  }
  saveProg(p)
  return { justCompleted, reward }
}
