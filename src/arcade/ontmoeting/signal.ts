/**
 * Pont Ontmoeting: het gedeelde herkenningssignaal plus de vaste ontmoetingsplek.
 *
 * Deterministisch uit een seed (bijv. overtocht-kamer plus match-id), zodat beide
 * gematchte mensen exact hetzelfde zien. Bewust offline-bestendig: je berekent dit
 * lokaal zodra je de seed hebt, dus het werkt ook als het bereik op het IJ wegvalt.
 *
 * Geen UI of netwerk hier; dit is het hart dat we los kunnen testen.
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
function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)]
}

// Felle, goed herkenbare kleuren om je scherm mee omhoog te houden.
const COLORS = [
  { name: 'Oranje', hex: '#F08A24' },
  { name: 'Groen', hex: '#1D9E75' },
  { name: 'Blauw', hex: '#009DE0' },
  { name: 'Rood', hex: '#E2231A' },
  { name: 'Paars', hex: '#7C3AED' },
  { name: 'Geel', hex: '#F4C20D' },
] as const

const SYMBOLS = ['⚓', '🐦', '🧇', '⛴️', '🌊', '🦆', '🎩', '🧭'] as const

// Luchtige codewoorden, IJ- en Amsterdam-thema.
const CODEWORDS = ['reiger', 'stroopwafel', 'pontje', 'noorderlicht', 'meeuw', 'kompas', 'haring', 'sluis'] as const

// Vaste, herkenbare plekken aan boord. Later eventueel per lijn/richting via config.
const MEETING_POINTS = [
  'bij de linker prullenbak',
  'bij de reddingsboei',
  'achterop, bij de vlag',
  'bij het stuurhuis',
] as const

export interface MeetingSignal {
  /** Kleur die je scherm aanneemt en die je omhoog houdt. */
  color: { name: string; hex: string }
  /** Symbool/emoji bij de kleur. */
  symbol: string
  /** Kort codewoord dat je tegen elkaar zegt om zeker te weten dat je matcht. */
  codeword: string
  /** Vaste plek aan boord waar je elkaar treft. */
  meetingPoint: string
}

/** Bouwt het gedeelde signaal plus de ontmoetingsplek uit een seed. */
export function buildSignal(seed: string): MeetingSignal {
  const rng = rngFromSeed(seed)
  return {
    color: { ...pick(COLORS, rng) },
    symbol: pick(SYMBOLS, rng),
    codeword: pick(CODEWORDS, rng),
    meetingPoint: pick(MEETING_POINTS, rng),
  }
}

/** Stabiele seed voor een match: dezelfde voor beide mensen, ongeacht volgorde. */
export function matchSeed(overtochtRoom: string, userA: string, userB: string): string {
  const [a, b] = [userA, userB].sort()
  return `${overtochtRoom}|${a}|${b}`
}
