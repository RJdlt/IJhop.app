/**
 * Wat de planner onthoudt: je laatste vertrekpunten, hoe je naar de steiger
 * gaat, en of de kaart uitgeklapt hoort te staan.
 *
 * Via durableStorage, dus localStorage én IndexedDB. Wie de app op zijn
 * beginscherm heeft staan wil zijn drie vaste vertrekpunten niet elke week
 * opnieuw intypen.
 */
import { durableStorage } from './durableStorage'
import type { Coords } from './geo'
import type { PlannerMode } from './planner'

const KEY = 'ijhop:planner'

/** Hoeveel vertrekpunten we onthouden. Drie chips passen op een regel. */
export const MAX_RECENT = 3

export interface RecentPlek {
  naam: string
  coords: Coords
}

export interface PlannerPrefs {
  recent: RecentPlek[]
  mode: PlannerMode
  open: boolean
  marginMin: number
}

export const PREFS_DEFAULT: PlannerPrefs = {
  recent: [],
  mode: 'fiets',
  open: false,
  marginMin: 2,
}

/**
 * Puur: het nieuwe lijstje na een gebruikt vertrekpunt. Meest recent vooraan,
 * geen dubbele namen, hooguit drie. Los van de opslag zodat het te testen is.
 */
export function onthoudPlek(recent: RecentPlek[], plek: RecentPlek): RecentPlek[] {
  const naam = plek.naam.trim()
  if (!naam) return recent
  const zonder = recent.filter((r) => r.naam.trim().toLowerCase() !== naam.toLowerCase())
  return [{ ...plek, naam }, ...zonder].slice(0, MAX_RECENT)
}

export async function leesPrefs(): Promise<PlannerPrefs> {
  try {
    const raw = await durableStorage.getItem(KEY)
    if (!raw) return PREFS_DEFAULT
    const p = JSON.parse(raw) as Partial<PlannerPrefs>
    return {
      recent: Array.isArray(p.recent) ? p.recent.slice(0, MAX_RECENT) : [],
      mode: p.mode === 'lopen' ? 'lopen' : 'fiets',
      open: p.open === true,
      marginMin: typeof p.marginMin === 'number' ? Math.max(0, Math.min(5, p.marginMin)) : 2,
    }
  } catch {
    return PREFS_DEFAULT
  }
}

export async function schrijfPrefs(p: PlannerPrefs): Promise<void> {
  try {
    await durableStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    /* stil */
  }
}
