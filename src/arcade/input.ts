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

/**
 * Continue aanraak-besturing (slepen), voor spellen met `inputMode:
 * 'continuous'` (bijv. een boot besturen) in plaats van discrete swipes.
 * Gebruikt de Pointer Events API zodat muis (desktop-testen), pen en touch
 * allemaal hetzelfde pad volgen. `onPointer(nx, held)` krijgt de x-positie
 * genormaliseerd (0..1) binnen het element, en of er nu aangeraakt wordt.
 */
export function attachPointer(target: HTMLElement, onPointer: (nx: number, held: boolean) => void): InputHandle {
  let lastNx = 0.5
  let held = false

  const nxFrom = (clientX: number): number => {
    const rect = target.getBoundingClientRect()
    if (rect.width <= 0) return lastNx
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  }

  const onDown = (e: PointerEvent) => {
    held = true
    lastNx = nxFrom(e.clientX)
    onPointer(lastNx, true)
  }
  const onMove = (e: PointerEvent) => {
    if (!held) return
    e.preventDefault()
    lastNx = nxFrom(e.clientX)
    onPointer(lastNx, true)
  }
  const onUp = () => {
    if (!held) return
    held = false
    onPointer(lastNx, false)
  }
  const onKeyDown = (e: KeyboardEvent) => {
    // Pijltjes voor desktop-testen: kleine stapjes op de laatst bekende x.
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    lastNx = Math.max(0, Math.min(1, lastNx + (e.key === 'ArrowLeft' ? -0.06 : 0.06)))
    held = true
    onPointer(lastNx, true)
  }

  target.addEventListener('pointerdown', onDown)
  target.addEventListener('pointermove', onMove, { passive: false })
  target.addEventListener('pointerup', onUp)
  target.addEventListener('pointercancel', onUp)
  target.addEventListener('pointerleave', onUp)
  window.addEventListener('keydown', onKeyDown)

  return {
    detach() {
      target.removeEventListener('pointerdown', onDown)
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      target.removeEventListener('pointercancel', onUp)
      target.removeEventListener('pointerleave', onUp)
      window.removeEventListener('keydown', onKeyDown)
    },
  }
}
