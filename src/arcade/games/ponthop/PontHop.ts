import type { GameInitOpts, GameModule, GameState, InputAction } from '../../types'

/**
 * Pont Hop — Fase 1: bewuste placeholder. Tekent een welkomstframe met
 * Kapitein Pim en reageert zichtbaar op input, zodat de shell-koppeling
 * (input, score-callback, game-over) aantoonbaar werkt. De echte gameplay
 * (lanes, ponten, botsingen) komt in Fase 2+.
 */

const WATER = '#1D9E75' // brand-groen, jouw water-kleur
const CAP = '#F08A24' // oranje pet van Kapitein Pim
const STEP = 44

export function createPontHop(): GameModule {
  let ctx: CanvasRenderingContext2D | null = null
  let opts: GameInitOpts | null = null
  let state: GameState = 'idle'
  let raf = 0

  let score = 0
  let x = 0
  let y = 0
  let lastAction: InputAction | null = null
  let hops = 0

  const loop = () => {
    draw()
    raf = requestAnimationFrame(loop)
  }

  function draw() {
    if (!ctx || !opts) return
    const { width: w, height: h } = opts

    // Water-achtergrond met een subtiele horizon.
    ctx.fillStyle = WATER
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    ctx.fillRect(0, 0, w, h * 0.34)

    // Titel
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(255,255,255,0.95)'
    ctx.font = '700 26px system-ui, sans-serif'
    ctx.fillText('Pont Hop', w / 2, h * 0.16)
    ctx.font = '500 14px system-ui, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.fillText('Kapitein Pim — Fase 1 placeholder', w / 2, h * 0.16 + 24)
    ctx.fillText('Swipe / pijltjes / tik', w / 2, h * 0.16 + 46)

    // Kapitein Pim (placeholder: rond hoofd met oranje pet)
    const r = 18
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fillStyle = '#FFE0B8'
    ctx.fill()
    // pet
    ctx.fillStyle = CAP
    ctx.beginPath()
    ctx.arc(x, y - 4, r, Math.PI, 0)
    ctx.fill()
    ctx.fillRect(x - r - 4, y - 4, (r + 4) * 2, 5)

    // HUD onderin: laatste actie + hops
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.font = '500 13px system-ui, sans-serif'
    ctx.fillText(
      `laatste: ${lastAction ?? '—'}   ·   hops: ${hops}`,
      w / 2,
      h - 18,
    )
  }

  function reset() {
    if (!opts) return
    score = 0
    hops = 0
    lastAction = null
    x = opts.width / 2
    y = opts.height * 0.68
  }

  return {
    init(_canvas, context, o) {
      ctx = context
      opts = o
      reset()
      state = 'idle'
    },
    start() {
      reset()
      state = 'running'
      opts?.onScoreChange(0)
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(loop)
    },
    pause() {
      if (state !== 'running') return
      state = 'paused'
      cancelAnimationFrame(raf)
    },
    resume() {
      if (state !== 'paused') return
      state = 'running'
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(loop)
    },
    stop() {
      state = 'idle'
      cancelAnimationFrame(raf)
    },
    destroy() {
      cancelAnimationFrame(raf)
      ctx = null
      opts = null
    },
    onInput(action) {
      if (state !== 'running' || !opts) return
      lastAction = action
      hops++
      if (action === 'up' || action === 'tap') {
        y -= STEP
        score++
        opts.onScoreChange(score)
      } else if (action === 'down') {
        y += STEP
      } else if (action === 'left') {
        x -= STEP
      } else if (action === 'right') {
        x += STEP
      }

      // Randen: zijwaarts botsen we tegen de rand; te ver naar onderen = "water"
      // (placeholder voor de echte game-over-conditie van Fase 4).
      x = Math.max(24, Math.min(opts.width - 24, x))
      if (y < 24) y = 24
      if (y > opts.height - 6) {
        state = 'over'
        cancelAnimationFrame(raf)
        opts.onGameOver(score)
      }
    },
    getScore() {
      return score
    },
    getState() {
      return state
    },
    resize(w, h, dpr) {
      if (!opts) return
      opts.width = w
      opts.height = h
      opts.dpr = dpr
      // Houd Pim binnen het nieuwe veld.
      x = Math.max(24, Math.min(w - 24, x))
      y = Math.max(24, Math.min(h - 6, y))
    },
  }
}
