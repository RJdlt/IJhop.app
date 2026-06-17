/**
 * Houdt de PWA vers zonder ooit midden in een potje te herladen.
 *
 * iOS bewaart een geïnstalleerde PWA hardnekkig in cache. We checken daarom
 * actief op een nieuwe service-worker (bij openen/terugkeren + periodiek), zodat
 * de nieuwe versie alvast op de achtergrond wordt opgehaald. Door autoUpdate
 * (skipWaiting + clientsClaim) neemt die nieuwe worker de controle over en wordt
 * 'ie toegepast bij de volgende keer dat de app opnieuw opent — NIET met een
 * geforceerde reload tijdens het spelen (dat gaf een blanco scherm).
 */
export function setupPwaAutoUpdate() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  navigator.serviceWorker.ready
    .then((reg) => {
      const check = () => {
        reg.update().catch(() => {
          /* offline o.i.d. — volgende keer weer */
        })
      }
      check() // meteen bij start, op de achtergrond
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
      window.addEventListener('focus', check)
      setInterval(check, 15 * 60 * 1000)
    })
    .catch(() => {
      /* geen SW geregistreerd — niets te doen */
    })
}
