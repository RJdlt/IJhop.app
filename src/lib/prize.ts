/**
 * Instellingen voor de prijs-inzending. Pas hier alles aan zonder andere code
 * aan te raken: vanaf welk bezoek we uitnodigen, hoe vaak, en de prijs-tekst.
 *
 * Onthoudt lokaal (per browser) of iemand al heeft meegedaan of de uitnodiging
 * heeft gezien, zodat het scherm mensen niet blijft lastigvallen. Vroeger hing
 * dit aan een spelscore; nu de spellen weg zijn, hangt het aan het aantal
 * bezoeken, zodat we een eerste bezoeker niet meteen om zijn e-mail vragen.
 */
export const PRIZE_CONFIG = {
  // Vanaf het hoeveelste bezoek nodigen we uit.
  minVisits: 2,
  // Hoe vaak tonen we de uitnodiging maximaal per gebruiker (browser).
  maxPrompts: 1,
  // Placeholder voor de prijs; later invullen, bijv. 'een diner bij [restaurant]'.
  prize: 'een leuke prijs',
}

const SEEN_KEY = 'ijhop:prize:seen'
const DONE_KEY = 'ijhop:prize:done'
const VISITS_KEY = 'ijhop:visits'

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

/** Telt dit bezoek en geeft het nieuwe totaal terug (1 bij het eerste bezoek). */
export function bumpVisits(): number {
  try {
    const next = (parseInt(localStorage.getItem(VISITS_KEY) || '0', 10) || 0) + 1
    localStorage.setItem(VISITS_KEY, String(next))
    return next
  } catch {
    return 1
  }
}

/** Mag de uitnodiging nu getoond worden? (vaak genoeg terug geweest, nog niet
 *  meegedaan, en nog niet te vaak getoond) */
export function shouldOfferPrize(visits: number): boolean {
  return visits >= PRIZE_CONFIG.minVisits && !prizeDone() && seenCount() < PRIZE_CONFIG.maxPrompts
}
