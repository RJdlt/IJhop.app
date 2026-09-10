/**
 * PWA-versiebeheer zonder verrassingen.
 *
 * Twee dingen moeten tegelijk waar zijn: een nieuwe versie moet binnen één
 * sessie gevonden worden, en de app mag nooit uit zichzelf herladen. Iemand
 * die naar de aftelklok staat te kijken wil niet dat het scherm midden in een
 * telling wit wordt.
 *
 * Daarom staat de service worker op 'prompt' (zie vite.config.ts): de nieuwe
 * worker installeert zichzelf en blijft dan wachten. Wij zoeken hem op bij het
 * openen, bij terugkeer naar de voorgrond en periodiek, tonen een balkje, en
 * pas als de bezoeker daarop tikt zetten we hem aan en herladen we één keer.
 *
 * Waarom actief zoeken en niet afwachten: iOS houdt een geïnstalleerde PWA
 * hardnekkig vast. Zonder eigen `update()`-aanroep kan een toestel dagen op
 * een oude build blijven staan.
 */

/** Hoe vaak we op de achtergrond kijken of er iets nieuws is. */
export const UPDATE_INTERVAL_MS = 15 * 60 * 1000

/**
 * Bovengrens op hoe oud de draaiende build mag zijn zonder dat we minstens
 * één keer gekeken hebben. Achtergrondtabbladen krijgen hun timers geknepen,
 * dus het interval alleen is geen garantie; deze controle bij het eerste
 * teken van leven wel.
 */
export const MAX_STALE_MS = 24 * 60 * 60 * 1000

const LAST_CHECK_KEY = 'ijhop:pwa:lastcheck'

/** Is er sinds de laatste geslaagde controle meer dan een dag verstreken? */
export function isStale(lastCheck: number | null, now: number, maxAge = MAX_STALE_MS): boolean {
  if (lastCheck == null || !Number.isFinite(lastCheck)) return true
  return now - lastCheck >= maxAge
}

/**
 * Wachten er nieuwe bestanden op de bezoeker?
 *
 * Alleen als er al een worker de baas was: bij de allereerste installatie
 * "wacht" er ook eentje, maar dat is geen update en daar hoort geen balkje
 * bij. Los van de browser-API's zodat het te testen is.
 */
export function updateIsWaiting(
  reg: { waiting: unknown | null; installing?: { state?: string } | null },
  hadController: boolean,
): boolean {
  if (!hadController) return false
  return reg.waiting != null
}

function markChecked(): void {
  try {
    localStorage.setItem(LAST_CHECK_KEY, String(Date.now()))
  } catch {
    /* stil */
  }
}

function lastChecked(): number | null {
  try {
    const raw = localStorage.getItem(LAST_CHECK_KEY)
    return raw ? Number(raw) : null
  } catch {
    return null
  }
}

/**
 * Zoekt naar een nieuwe versie en meldt hem.
 *
 * `onUpdate` krijgt de functie mee die de nieuwe versie aanzet. Aanroepen doet
 * twee dingen: de wachtende worker mag het overnemen, en zodra dat gebeurd is
 * herlaadt de pagina één keer.
 */
export function setupPwaAutoUpdate(onUpdate: (apply: () => void) => void): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  // Stond er al een actieve worker bij het laden? Dan is een wachtende worker
  // een échte update en niet de allereerste installatie.
  const hadController = !!navigator.serviceWorker.controller

  // Precies één herlaad, en alleen na een tik van de bezoeker.
  let herladen = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!herladen) return
    herladen = false
    window.location.reload()
  })

  navigator.serviceWorker.ready
    .then((reg) => {
      const apply = () => {
        const wachtend = reg.waiting
        if (!wachtend) {
          // Niets aan het wachten (bijvoorbeeld al overgenomen): gewoon
          // herladen, dan heeft de bezoeker alsnog wat hij vroeg.
          window.location.reload()
          return
        }
        herladen = true
        wachtend.postMessage({ type: 'SKIP_WAITING' })
      }

      const meld = () => onUpdate(apply)

      const check = () =>
        reg
          .update()
          .then(() => markChecked())
          .catch(() => {})

      if (updateIsWaiting(reg, hadController)) meld()

      reg.addEventListener('updatefound', () => {
        const next = reg.installing
        if (!next) return
        next.addEventListener('statechange', () => {
          // 'installed' met een actieve controller = klaar en wachtend.
          if (next.state === 'installed' && navigator.serviceWorker.controller) meld()
        })
      })

      check() // meteen bij het openen
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
      window.addEventListener('focus', check)
      setInterval(check, UPDATE_INTERVAL_MS)

      // Vangnet voor een tabblad dat dagen open staat met geknepen timers.
      if (isStale(lastChecked(), Date.now())) check()
    })
    .catch(() => {})
}
