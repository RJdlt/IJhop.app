import type { GameInitOpts, GameModule, GameState, InputAction } from '../../types'
import { createVeerWorld, resizeVeer, steerVeer, stepVeer, progressFraction, FERRY_Y } from './engine'
import type { VeerWorld } from './engine'
import { renderVeer } from './render'
import { Sfx } from '../ponthop/audio'
import { Fx } from '../../fx'
import { loadProfile, saveProfile } from '../ponthop/profile'

/**
 * Vaar de Pont — stuur de GVB-pont van NDSM naar Centraal over het IJ. Veeg
 * links/rechts om rondvaartboten, watertaxi's, SUP'ers en boeien te ontwijken.
 * Elke overtocht levert bonuspunten en de vaart wordt sneller. De GameModule
 * koppelt de pure engine aan canvas, RAF, input en geluid; geen profiel- of
 * uitdaging-koppeling, alleen score en game-over.
 */
export function createVeer(): GameModule {
  let ctx: CanvasRenderingContext2D | null = null
  let opts: GameInitOpts | null = null
  let world: VeerWorld | null = null
  let state: GameState = 'idle'
  let raf = 0
  let lastT = 0
  let lastScore = 0
  let lastCrossings = 0
  let lastCoins = 0
  let lastShield = 0
  const sfx = new Sfx()
  const fx = new Fx()

  /** Schermpositie van de pont (voor deeltjes-effecten). */
  const ferryScreen = (w: VeerWorld) => ({ x: w.ferry.x, y: w.height * FERRY_Y })

  const frame = (now: number) => {
    if (!world || !ctx || !opts || state !== 'running') return
    const dt = lastT ? (now - lastT) / 1000 : 0
    lastT = now

    const wasSafe = !world.over
    stepVeer(world, dt)
    fx.update(dt)

    const p = ferryScreen(world)
    // Stroopwafel opgepakt.
    if (world.coins > lastCoins) {
      sfx.coin()
      fx.coinBurst(p.x, p.y, 1)
      fx.popText(p.x, p.y - 20, '+5 🧇')
      lastCoins = world.coins
    }
    // Schild opgepakt.
    if (world.shield > lastShield) {
      fx.coinBurst(p.x, p.y, 3)
      fx.popText(p.x, p.y - 24, 'Schild! 🛟', '#8FD8FF', 15)
      lastShield = world.shield
    }
    // Schild verbruikt bij een aanvaring: klap + tekst, maar geen game-over.
    if (world.shield < lastShield) {
      sfx.splash()
      fx.splash(p.x, p.y)
      fx.popText(p.x, p.y - 20, 'Schild op! 🛟', '#FFD24A', 15)
      lastShield = world.shield
    }
    // Overtocht gehaald: confetti + juichtekst.
    if (world.crossings > lastCrossings) {
      sfx.coin()
      fx.crossingBurst(p.x, p.y)
      fx.popText(p.x, p.y - 26, 'Centraal! 🎉', '#8FE9C0', 16)
      lastCrossings = world.crossings
    }
    if (world.score !== lastScore) {
      lastScore = world.score
      opts.onScoreChange(world.score)
    }

    renderVeer(ctx, world, fx.shakeOffset())
    fx.draw(ctx)

    if (world.over && wasSafe) {
      state = 'over'
      sfx.splash()
      fx.splash(p.x, p.y)
      fx.draw(ctx)
      cancelAnimationFrame(raf)
      // Verzamelde stroopwafels in de gedeelde spaarpot (zelfde wallet als Pont Hop).
      if (world.coins > 0) {
        const profile = loadProfile()
        profile.wallet += world.coins
        saveProfile(profile)
      }
      const frac = progressFraction(world)
      const lines = [
        { label: 'Overtochten', value: String(world.crossings) },
        { label: 'Wafels 🧇', value: `+${world.coins}` },
        { label: 'Deze reis', value: `${Math.round(frac * 100)}% naar Centraal` },
      ]
      opts.onGameOver(world.score, lines)
      return
    }
    raf = requestAnimationFrame(frame)
  }

  const begin = () => {
    if (!opts) return
    world = createVeerWorld({ width: opts.width, height: opts.height, seed: (Date.now() & 0xffffffff) >>> 0 })
    lastScore = 0
    lastCrossings = 0
    lastCoins = 0
    lastShield = 0
    lastT = 0
    fx.clear()
    opts.onScoreChange(0)
    state = 'running'
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(frame)
  }

  return {
    init(_canvas, context, o) {
      ctx = context
      opts = o
      state = 'idle'
    },
    start() {
      begin()
    },
    pause() {
      if (state !== 'running') return
      state = 'paused'
      cancelAnimationFrame(raf)
    },
    resume() {
      if (state !== 'paused') return
      state = 'running'
      lastT = 0
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(frame)
    },
    stop() {
      state = 'idle'
      cancelAnimationFrame(raf)
    },
    destroy() {
      cancelAnimationFrame(raf)
      sfx.close()
      ctx = null
      opts = null
      world = null
    },
    onInput(action: InputAction) {
      if (state !== 'running' || !world) return
      // Alleen links/rechts sturen; tik/omhoog/omlaag negeren we bewust.
      if (action === 'left' || action === 'right') {
        steerVeer(world, action)
        sfx.hop()
      }
    },
    getScore() {
      return world?.score ?? 0
    },
    getState() {
      return state
    },
    resize(wpx, hpx, dpr) {
      if (opts) {
        opts.width = wpx
        opts.height = hpx
        opts.dpr = dpr
      }
      if (world) resizeVeer(world, wpx, hpx)
    },
    setMuted(muted: boolean) {
      sfx.setMuted(muted)
    },
  }
}
