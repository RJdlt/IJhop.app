/**
 * Naam-moderatie voor de publieke ranglijst. Houdt grof, seksistisch en
 * racistisch taalgebruik tegen — ook simpele omzeilingen (leetspeak, spaties,
 * herhalingen). Geen perfecte filter, maar vangt de bekende gevallen.
 *
 * Bewust streng: liever af en toe een onschuldige naam blokkeren dan een
 * kwetsende naam op de lijst.
 */

const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
  '@': 'a',
  $: 's',
  '€': 'e',
}

/** Normaliseert naar pure letters, zodat omzeilingen alsnog matchen. */
function normalize(raw: string): string {
  return (raw ?? '')
    .toLowerCase()
    .replace(/[0134578@$€]/g, (c) => LEET[c] ?? c)
    .replace(/[^a-z]/g, '') // strip spaties/leestekens: "f.u.c.k" -> "fuck"
    .replace(/(.)\1{2,}/g, '$1$1') // "niiigger" -> "niigger"
}

// Genormaliseerde verboden fragmenten (racistisch, seksistisch, seksueel, grof).
const BANNED = [
  // racistisch / haatdragend
  'nigger',
  'nigga',
  'negro',
  'nikker',
  'kanker',
  'kkk',
  'nazi',
  'hitler',
  'holocaust',
  'pedo',
  'rapist',
  'verkracht',
  // seksueel / seksistisch
  'hoer',
  'slet',
  'whore',
  'bitch',
  'cunt',
  'kut',
  'pik',
  'lul',
  'penis',
  'vagina',
  'pussy',
  'dick',
  'cock',
  'neuk',
  'fuck',
  'fuk',
  'fck',
  'sex',
  'seks',
  'porn',
  'dildo',
  'tieten',
  'reet',
  'kontneuk',
  'klootzak',
  // grof
  'shit',
  'tyfus',
  'tering',
  'asshole',
  'bastard',
]

/** True als de naam (na normalisatie) een verboden fragment bevat. */
export function hasProfanity(raw: string): boolean {
  const n = normalize(raw)
  return BANNED.some((bad) => n.includes(bad))
}

/** Geeft een nette weergavenaam terug; leeg of ongepast → 'Speler'. */
export function sanitizeName(raw: string): string {
  const name = (raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 24)
  if (!name) return 'Speler'
  if (hasProfanity(name)) return 'Speler'
  return name
}
