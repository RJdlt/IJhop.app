import type { GameInitOpts, GameModule, GameState, InputAction } from '../../types'
import { createWorld, resizeWorld, worldHop, worldStep } from './engine'
import type { World } from './engine'
import { render } from './render'
import { Sfx } from './audio'

/**
 * Pont Hop — Kapitein Pim steekt het IJ over: hop van steiger naar steiger,
 * drijf mee op de ponten (F4/F7), ontwijk watertaxi's en pak stroopwafels.
 * De GameModule koppelt de pure engine aan canvas, RAF, input en audio.
 */
export function createPontHop(): GameModule {
  let ctx: CanvasRenderingContext2D | null = null
  let opts: GameInitOpts | null = null
  let world: World | null = null
  let state: GameState = 'idle'
  let raf = 0
  let lastT = 0
  let lastScore = 0
  const sfx = new Sfx()

  const frame = (now: number) => {
    if (!world || !ctx || !opts || state !== 'running') return
    const dt = lastT ? (now - lastT) / 1000 : 0
    lastT = now

    const wasSafe = !world.over
    worldStep(world, dt)

    if (world.score !== lastScore) {
      if (world.score > lastScore) sfx.coin()
      lastScore = world.score
      opts.onScoreChange(world.score)
    }

    render(ctx, world)

    if (world.over && wasSafe) {
      state = 'over'
      sfx.splash()
      cancelAnimationFrame(raf)
      opts.onGameOver(world.score)
      return
    }
    raf = requestAnimationFrame(frame)
  }

  const begin = () => {
    if (!opts) return
    world = createWorld({ width: opts.width, height: opts.height, seed: (Date.now() & 0xffffffff) >>> 0 })
    lastScore = 0
    lastT = 0
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
      worldHop(world, action)
      if (action !== 'down') sfx.hop()
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
      if (world) resizeWorld(world, wpx, hpx)
    },
    setMuted(muted: boolean) {
      sfx.setMuted(muted)
    },
  }
}
