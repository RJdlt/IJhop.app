/**
 * De Oversteek — pontskins (puur cosmetisch). Ontgrendeld via score-mijlpalen
 * (de bestaande per-spel high score in scoreStore), geen gameplay-voordeel.
 */
import type { Lang } from '../../../i18n/strings'

export interface FerrySkin {
  id: string
  name: Record<Lang, string>
  hull: string
  hullDark: string
  deck: string
  unlockScore: number
}

export const SKINS: FerrySkin[] = [
  { id: 'klassiek', name: { nl: 'Klassiek wit', en: 'Classic white' }, hull: '#F4F6F5', hullDark: '#C7CDCF', deck: '#0B5FA5', unlockScore: 0 },
  { id: 'blauw', name: { nl: 'Elektrisch blauw', en: 'Electric blue' }, hull: '#0B5FA5', hullDark: '#073E6E', deck: '#8FE9FF', unlockScore: 45 },
  { id: 'goud', name: { nl: 'Gouden editie', en: 'Golden edition' }, hull: '#D4AF37', hullDark: '#8A6D1E', deck: '#FFF3C4', unlockScore: 130 },
]

export function skinById(id: string): FerrySkin {
  return SKINS.find((s) => s.id === id) ?? SKINS[0]
}

export function isSkinUnlocked(skin: FerrySkin, bestScore: number): boolean {
  return bestScore >= skin.unlockScore
}

const KEY = 'ijhop.arcade.oversteek.skin'

export function loadSelectedSkin(): string {
  try {
    return localStorage.getItem(KEY) ?? 'klassiek'
  } catch {
    return 'klassiek'
  }
}

export function saveSelectedSkin(id: string): void {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    /* faal stil */
  }
}
