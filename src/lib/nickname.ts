const STORAGE_KEY = 'ijhop:nick'
const CHOSEN_KEY = 'ijhop:nick:set'

export const NICK_MAX = 24

/** True zodra de speler zelf bewust een naam heeft ingevuld. */
export function isNicknameChosen(): boolean {
  try {
    return localStorage.getItem(CHOSEN_KEY) === '1'
  } catch {
    return false
  }
}

/** Bewaart een door de speler gekozen naam (getrimd, gemaximeerd). */
export function setNickname(name: string): string {
  const clean = name.trim().slice(0, NICK_MAX)
  try {
    if (clean) {
      localStorage.setItem(STORAGE_KEY, clean)
      localStorage.setItem(CHOSEN_KEY, '1')
    }
  } catch {
    // localStorage niet beschikbaar — naam geldt dan alleen deze sessie.
  }
  return clean
}

// Vaste lijst van vriendelijke bijnamen; eenmaal gekozen blijft hij bewaard.
const NICKS = [
  'Snelle Meeuw',
  'Dappere Schipper',
  'Vrolijke Reiger',
  'Stille Otter',
  'Wakkere Visdief',
  'Blije Bever',
  'Gladde Paling',
  'Kekke Kraai',
  'Flitsende Fuut',
  'Nuchtere Nijlgans',
]

/** Geeft een vaste willekeurige bijnaam terug, bewaard in localStorage. */
export function getNickname(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return saved
  } catch {
    // localStorage niet beschikbaar (private mode e.d.) — val terug op een verse keuze.
  }

  const nick = NICKS[Math.floor(Math.random() * NICKS.length)]

  try {
    localStorage.setItem(STORAGE_KEY, nick)
  } catch {
    // Niet kunnen bewaren is geen ramp; we geven de bijnaam alsnog terug.
  }

  return nick
}
