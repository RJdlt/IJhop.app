/**
 * PWA-versiebeheer zonder verrassingen.
 *
 * iOS bewaart een geïnstalleerde PWA hardnekkig in cache. We checken actief op
 * een nieuwe service-worker (bij openen/terugkeren + periodiek). Zodra er een
 * nieuwe versie klaarstaat melden we dat via `onUpdate`, zodat de UI een
 * "verversen"-knop kan tonen. We herladen NOOIT vanzelf (dat gaf een blanco
 * scherm midden in een potje) — de speler bepaalt het moment.
 */
export function setupPwaAutoUpdate(onUpdate: () => void) {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  // Stond er al een actieve worker bij het laden? Dan is een latere wissel een
  // échte update (en niet de allereerste installatie).
  const hadController = !!navigator.serviceWorker.controller
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) onUpdate()
  })

  navigator.serviceWorker.ready
    .then((reg) => {
      const check = () => reg.update().catch(() => {})

      // Een al wachtende worker = update klaar.
      if (reg.waiting && hadController) onUpdate()

      reg.addEventListener('updatefound', () => {
        const next = reg.installing
        if (!next) return
        next.addEventListener('statechange', () => {
          if (next.state === 'installed' && navigator.serviceWorker.controller) onUpdate()
        })
      })

      check() // meteen op de achtergrond
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
      window.addEventListener('focus', check)
      setInterval(check, 15 * 60 * 1000)
    })
    .catch(() => {})
}
