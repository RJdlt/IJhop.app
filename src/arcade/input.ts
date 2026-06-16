import type { InputAction } from './types'

/**
 * Centrale input-laag. Vertaalt touch-swipes en toetsen naar abstracte
 * {up,down,left,right,tap}-acties en stuurt ze naar de actieve game. Spellen
 * bevatten zelf géén swipe- of toetsencode.
 */

export interface InputHandle {
  detach(): void
}

type Dispatch = (action: InputAction) => void

// Onder TAP_MAX px beweging = tik (vooruit); zijwaarts vegen vraagt minstens
// SWIPE_MIN px, zodat een kleine vingerbeweging niet meteen registreert.
const TAP_MAX = 12
const SWIPE_MIN = 38
// Negeer acties die sneller dan dit op elkaar komen (per ongeluk dubbel-vuren).
const MIN_GAP_MS = 90

const KEY_MAP: Record<string, InputAction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ' ': 'tap',
  Spacebar: 'tap', // oudere browsers
}

/** Koppelt input aan een element. `detach()` verwijdert alle listeners. */
export function attachInput(target: HTMLElement, rawDispatch: Dispatch): InputHandle {
  let sx = 0
  let sy = 0
  let tracking = false
  let lastAt = 0

  // Coalesceer te snel opeenvolgende acties; voorkomt onbedoeld dubbel-hoppen.
  const dispatch: Dispatch = (action) => {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    if (now - lastAt < MIN_GAP_MS) return
    lastAt = now
    rawDispatch(action)
  }

  const onTouchStart = (e: TouchEvent) => {
    const t = e.changedTouches[0]
    sx = t.clientX
    sy = t.clientY
    tracking = true
  }

  // Voorkom dat de pagina meescrollt terwijl er over het speelveld geveegd wordt.
  const onTouchMove = (e: TouchEvent) => {
    if (tracking) e.preventDefault()
  }

  const onTouchEnd = (e: TouchEvent) => {
    if (!tracking) return
    tracking = false
    const t = e.changedTouches[0]
    const dx = t.clientX - sx
    const dy = t.clientY - sy
    const adx = Math.abs(dx)
    const ady = Math.abs(dy)

    if (adx < TAP_MAX && ady < TAP_MAX) {
      dispatch('tap')
      return
    }
    if (Math.max(adx, ady) < SWIPE_MIN) return
    if (adx > ady) dispatch(dx > 0 ? 'right' : 'left')
    else dispatch(dy > 0 ? 'down' : 'up')
  }

  const onKeyDown = (e: KeyboardEvent) => {
    const action = KEY_MAP[e.key]
    if (!action) return
    e.preventDefault()
    dispatch(action)
  }

  target.addEventListener('touchstart', onTouchStart, { passive: true })
  target.addEventListener('touchmove', onTouchMove, { passive: false })
  target.addEventListener('touchend', onTouchEnd, { passive: true })
  window.addEventListener('keydown', onKeyDown)

  return {
    detach() {
      target.removeEventListener('touchstart', onTouchStart)
      target.removeEventListener('touchmove', onTouchMove)
      target.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('keydown', onKeyDown)
    },
  }
}
