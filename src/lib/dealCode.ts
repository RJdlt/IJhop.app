/**
 * De code die je aan de kassa laat zien.
 *
 * Vier tekens, want dat typt een medewerker in één keer goed over zonder naar
 * je scherm te turen. Het alfabet mist met opzet 0, O, 1, I, L, 5 en S: die
 * worden aan een kassa stelselmatig verwisseld, en een deal die afketst op een
 * verkeerd getypte letter is erger dan een deal die niet bestaat.
 *
 * De database heeft dezelfde reeks staan (0019_pontdeals.sql). De app stelt
 * een code voor, de database beslist: botst het voorstel met een bestaande
 * code, dan verzint zij er zelf een. Zo blijft de unieke sleutel in de tabel
 * de waarheid, en is de generator hier gewoon te testen.
 */

export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRTUVWXYZ2346789'
export const CODE_LENGTH = 4

/** Verwarrende tekens: nooit in een code, wel te herkennen in wat iemand typt. */
export const CONFUSING = '0O1IL5S'

/**
 * Nieuwe code. `rand` is injecteerbaar zodat een test hem kan vastzetten;
 * in de app is dat crypto, met Math.random als reserve.
 */
export function makeDealCode(rand: () => number = defaultRandom): string {
  let out = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    const idx = Math.min(CODE_ALPHABET.length - 1, Math.floor(rand() * CODE_ALPHABET.length))
    out += CODE_ALPHABET[idx]
  }
  return out
}

function defaultRandom(): number {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const buf = new Uint32Array(1)
      crypto.getRandomValues(buf)
      return buf[0] / 2 ** 32
    }
  } catch {
    /* val door naar Math.random */
  }
  return Math.random()
}

/** Maakt van wat iemand intypt een vergelijkbare code: hoofdletters, zonder
 *  streepjes of spaties. */
export function normalizeDealCode(raw: string): string {
  return (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function isValidDealCode(code: string): boolean {
  const c = normalizeDealCode(code)
  if (c.length !== CODE_LENGTH) return false
  return [...c].every((ch) => CODE_ALPHABET.includes(ch))
}

/**
 * De code voor een schermlezer, teken voor teken. "AB37" wordt "A, B, 3, 7",
 * anders leest VoiceOver er een woord van en hoort de gebruiker niets
 * bruikbaars.
 */
export function spellOut(code: string): string {
  return normalizeDealCode(code).split('').join(', ')
}
