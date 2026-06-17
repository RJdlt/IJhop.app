/**
 * Pont Hop — meta-progressie (pure, testbaar).
 *
 * - Stroopwafels zijn de munt: verzameld in een run + een afstand-bonus, samen
 *   gespaard in een portemonnee (`wallet`).
 * - Poppetjes (characters) spelen vrij via een mijlpaal (gratis bij genoeg
 *   overstekens) óf via de shop (kosten stroopwafels).
 * - Twee niveaus: per-run "Level" (oploopt tijdens spelen) en een persistent
 *   spelerniveau dat over alle runs groeit.
 */
import type { Lang } from '../../../i18n/strings'

export type UnlockRule =
  | { type: 'free' }
  | { type: 'milestone'; crossings: number }
  | { type: 'shop'; cost: number }

export interface Character {
  id: string
  name: Record<Lang, string>
  emoji: string
  /** Kleuren waarmee de sprite in het spel getekend wordt. */
  capColor: string
  bodyColor: string
  unlock: UnlockRule
}

export const CHARACTERS: Character[] = [
  {
    id: 'pim',
    name: { nl: 'Kapitein Pim', en: 'Captain Pim' },
    emoji: '🧑‍✈️',
    capColor: '#F08A24',
    bodyColor: '#15616D',
    unlock: { type: 'free' },
  },
  {
    id: 'toerist',
    name: { nl: 'Toerist', en: 'Tourist' },
    emoji: '📸',
    capColor: '#E2231A',
    bodyColor: '#F4C20D',
    unlock: { type: 'milestone', crossings: 30 },
  },
  {
    id: 'conducteur',
    name: { nl: 'GVB-conducteur', en: 'GVB conductor' },
    emoji: '🎫',
    capColor: '#0B5FA5',
    bodyColor: '#062F52',
    unlock: { type: 'milestone', crossings: 80 },
  },
  {
    id: 'wielrenner',
    name: { nl: 'Wielrenner', en: 'Cyclist' },
    emoji: '🚴',
    capColor: '#111827',
    bodyColor: '#F4C20D',
    unlock: { type: 'shop', cost: 150 },
  },
  {
    id: 'koning',
    name: { nl: 'Koningsdag', en: "King's Day" },
    emoji: '👑',
    capColor: '#FF7A00',
    bodyColor: '#FF9E1B',
    unlock: { type: 'shop', cost: 450 },
  },
  {
    id: 'kat',
    name: { nl: 'Pontkat', en: 'Ferry cat' },
    emoji: '🐈',
    capColor: '#6B7280',
    bodyColor: '#4B5563',
    unlock: { type: 'shop', cost: 1000 },
  },
]

export function characterById(id: string): Character {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0]
}

export interface Profile {
  wallet: number
  totalCrossings: number
  /** In de shop gekochte poppetjes (mijlpalen worden afgeleid, niet opgeslagen). */
  bought: string[]
  selected: string
}

const KEY = 'ijhop.arcade.ponthop.profile'

const DEFAULT: Profile = { wallet: 0, totalCrossings: 0, bought: [], selected: 'pim' }

function clean(p: Partial<Profile>): Profile {
  return {
    wallet: Math.max(0, Math.floor(p.wallet ?? 0)),
    totalCrossings: Math.max(0, Math.floor(p.totalCrossings ?? 0)),
    bought: Array.isArray(p.bought) ? p.bought.filter((id) => typeof id === 'string') : [],
    selected: typeof p.selected === 'string' ? p.selected : 'pim',
  }
}

export function loadProfile(): Profile {
  if (typeof window === 'undefined') return { ...DEFAULT }
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? clean(JSON.parse(raw) as Partial<Profile>) : { ...DEFAULT }
  } catch {
    return { ...DEFAULT }
  }
}

export function saveProfile(p: Profile): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    /* faal stil */
  }
}

// ---- Vrijspelen ------------------------------------------------------------

export function isUnlocked(p: Profile, c: Character): boolean {
  switch (c.unlock.type) {
    case 'free':
      return true
    case 'milestone':
      return p.totalCrossings >= c.unlock.crossings
    case 'shop':
      return p.bought.includes(c.id)
  }
}

export function canAfford(p: Profile, c: Character): boolean {
  return c.unlock.type === 'shop' && p.wallet >= c.unlock.cost
}

/** Koopt een shop-poppetje (indien betaalbaar) en selecteert het meteen. */
export function buyCharacter(p: Profile, id: string): Profile {
  const c = characterById(id)
  if (c.unlock.type !== 'shop' || p.bought.includes(id) || p.wallet < c.unlock.cost) return p
  return { ...p, wallet: p.wallet - c.unlock.cost, bought: [...p.bought, id], selected: id }
}

/** Selecteert een poppetje als het vrijgespeeld is. */
export function selectCharacter(p: Profile, id: string): Profile {
  const c = characterById(id)
  if (!isUnlocked(p, c)) return p
  return { ...p, selected: id }
}

// ---- Beloning na een run ---------------------------------------------------

export interface RunResult {
  crossings: number
  coins: number
}

/** Stroopwafels die een run oplevert: verzamelde munten + een bescheiden
 *  afstand-bonus. Bewust karig — poppetjes moeten een uitdaging zijn. */
export function runReward({ crossings, coins }: RunResult): number {
  return coins + Math.floor(crossings / 2)
}

/** Verwerkt het einde van een run: bonus in de portemonnee, overstekens bij het
 *  totaal. Mijlpaal-poppetjes komen daarmee vanzelf beschikbaar. */
export function applyRunResult(p: Profile, run: RunResult): Profile {
  return {
    ...p,
    wallet: p.wallet + runReward(run),
    totalCrossings: p.totalCrossings + run.crossings,
  }
}

// ---- Levels ----------------------------------------------------------------

/** Per-run level dat tijdens het spelen oploopt (op basis van overstekens). */
export function runLevel(crossings: number): number {
  return Math.floor(crossings / 3) + 1
}

/** Persistent spelerniveau op basis van totaal aantal overstekens ooit. */
export function playerLevel(totalCrossings: number): number {
  return Math.floor(Math.sqrt(totalCrossings / 5)) + 1
}

/** Voortgang binnen het huidige persistente niveau (voor een balkje). */
export function levelProgress(totalCrossings: number): {
  level: number
  intoLevel: number
  span: number
} {
  const level = playerLevel(totalCrossings)
  const need = (n: number) => 5 * (n - 1) * (n - 1) // inverse van playerLevel
  const lo = need(level)
  const hi = need(level + 1)
  return { level, intoLevel: totalCrossings - lo, span: Math.max(1, hi - lo) }
}
