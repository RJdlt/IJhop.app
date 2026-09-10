/** Draait de app als geïnstalleerde app (beginscherm) in plaats van in een
 *  browsertabblad? iOS Safari kent `display-mode` niet en gebruikt een eigen
 *  vlag, dus we kijken naar allebei. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return (
      window.matchMedia?.('(display-mode: standalone)').matches === true ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    )
  } catch {
    return false
  }
}

/** iPhone of iPad? Daar bestaat geen install-prompt en moet het handmatig. */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return (
    /iphone|ipad|ipod/i.test(ua) ||
    // iPadOS 13+ doet zich voor als macOS, maar heeft touch.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}
