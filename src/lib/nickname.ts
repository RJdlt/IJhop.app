const STORAGE_KEY = 'ijhop:nick'

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
