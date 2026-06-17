/**
 * Instellingen voor de prijs-inzending. Pas hier alles aan zonder andere code
 * aan te raken: vanaf welke score, hoe vaak we het tonen, en de prijs-tekst.
 *
 * Onthoudt lokaal (per browser) of iemand al heeft meegedaan of de uitnodiging
 * heeft gezien, zodat het scherm mensen niet blijft lastigvallen.
 */
export const PRIZE_CONFIG = {
  // Vanaf welke score nodigen we uit.
  minScore: 20,
  // Hoe vaak tonen we de uitnodiging maximaal per gebruiker (browser).
  maxPrompts: 1,
  // Placeholder voor de prijs; later invullen, bijv. 'een diner bij [restaurant]'.
  prize: 'een leuke prijs',
}

const SEEN_KEY = 'ijhop:prize:seen'
const DONE_KEY = 'ijhop:prize:done'

export function prizeDone(): boolean {
  try {
    return localStorage.getItem(DONE_KEY) === '1'
  } catch {
    return false
  }
}
export function setPrizeDone(): void {
  try {
    localStorage.setItem(DONE_KEY, '1')
  } catch {
    /* stil */
  }
}
function seenCount(): number {
  try {
    return parseInt(localStorage.getItem(SEEN_KEY) || '0', 10) || 0
  } catch {
    return 0
  }
}
export function markPrizeSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, String(seenCount() + 1))
  } catch {
    /* stil */
  }
}

/** Mag de uitnodiging nu getoond worden? (score hoog genoeg, nog niet meegedaan,
 *  en nog niet te vaak getoond) */
export function shouldOfferPrize(score: number): boolean {
  return score >= PRIZE_CONFIG.minScore && !prizeDone() && seenCount() < PRIZE_CONFIG.maxPrompts
}
