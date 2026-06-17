/**
 * Houdt de PWA vers. iOS bewaart een geïnstalleerde PWA hardnekkig in cache;
 * daarom checken we actief op een nieuwe service-worker — bij het openen/terug-
 * keren naar de app en periodiek — en herladen zodra een nieuwe versie de
 * controle overneemt. Zo zie je nieuwe builds vrijwel meteen.
 */
export function setupPwaAutoUpdate() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  // Herlaad één keer zodra een nieuwe service-worker het overneemt.
  let reloaded = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return
    reloaded = true
    window.location.reload()
  })

  navigator.serviceWorker.ready
    .then((reg) => {
      const check = () => {
        reg.update().catch(() => {
          /* offline o.i.d. — volgende keer weer */
        })
      }
      check() // meteen bij start
      // Bij terugkeren naar de app (typisch moment op mobiel).
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
      window.addEventListener('focus', check)
      // En periodiek, voor wie de app lang open laat staan.
      setInterval(check, 15 * 60 * 1000)
    })
    .catch(() => {
      /* geen SW geregistreerd — niets te doen */
    })
}
