/**
 * Lichte naam-opschoning voor de publieke ranglijst: trimt, normaliseert
 * spaties, maximeert de lengte en maskeert een korte lijst grof taalgebruik.
 * Geen volledige moderatie — een fatsoensfilter dat de ergste dingen tegenhoudt.
 */

const BANNED = [
  'kut',
  'kanker',
  'tering',
  'tyfus',
  'hoer',
  'lul',
  'klootzak',
  'neuk',
  'fuck',
  'shit',
  'bitch',
  'cunt',
  'nigger',
  'nazi',
  'dick',
  'asshole',
]

const MAX = 24

function mask(word: string): string {
  return word[0] + '•'.repeat(Math.max(1, word.length - 1))
}

/** Geeft een nette weergavenaam terug; leeg/ongeldig → 'Speler'. */
export function sanitizeName(raw: string): string {
  let name = (raw ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX)
  for (const bad of BANNED) {
    const re = new RegExp(bad, 'gi')
    name = name.replace(re, (m) => mask(m))
  }
  name = name.trim()
  return name || 'Speler'
}

/** True als de naam (na opschoning) gemaskeerde delen bevat. */
export function hasProfanity(raw: string): boolean {
  return BANNED.some((bad) => new RegExp(bad, 'i').test(raw ?? ''))
}
