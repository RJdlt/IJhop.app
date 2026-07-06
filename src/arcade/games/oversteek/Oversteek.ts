import type { GameInitOpts, GameModule, GameState, InputAction } from '../../types'
import { createOversteekWorld, resizeOversteekWorld, setPointer, stepOversteek } from './engine'
import type { OversteekWorld } from './engine'
import { renderOversteek, ferryScreenPosition } from './render'
import { Sfx } from '../ponthop/audio'
import { Fx } from '../../fx'
import { getHighScore } from '../../scoreStore'
import { SKINS, skinById, loadSelectedSkin } from './skins'
import { track } from '../../../lib/analytics'

/**
 * De Oversteek — bestuur de GVB-pont heen en weer tussen NDSM en Centraal.
 * Sleep om te sturen, houd vast om te versnellen, laat los om af te remmen.
 * Vervoer passagiers, ontwijk verkeer, bouw een schone-oversteken-streak op.
 * De GameModule koppelt de pure engine aan canvas, RAF, continue aanraak-
 * invoer en audio. Geen profiel-/uitdaging-koppeling: score + game-over.
 */
export function createOversteek(): GameModule {
  let ctx: CanvasRenderingContext2D | null = null
  let opts: GameInitOpts | null = null
  let world: OversteekWorld | null = null
  let state: GameState = 'idle'
  let raf = 0
  let lastT = 0
  let lastScore = 0
  const sfx = new Sfx()
  const fx = new Fx()
  let sessionBest = 0
  let hitStopTimer: ReturnType<typeof setTimeout> | null = null
  let smoothDt = 0.016
  // Korte "slow-mo microbeat" na een near-miss: dt wordt heel even vertraagd.
  let slowUntil = 0
  let wasHeld = false
  let skinId = 'klassiek'

  const ferryScreen = (w: OversteekWorld) => ferryScreenPosition(w)

  const endRun = () => {
    hitStopTimer = null
    if (!world || !opts) return
    const prevBest = getHighScore('oversteek')
    const newlyUnlocked = SKINS.filter((s) => s.unlockScore > prevBest && world!.score >= s.unlockScore)

    const lines = [
      { label: 'Oversteken', value: String(world.legIndex) },
      { label: 'Passagiers', value: String(world.passengersDelivered) },
      { label: 'Beste streak', value: String(world.bestStreak) },
    ]
    if (world.passengersLost > 0) lines.push({ label: 'Weggelopen', value: String(world.passengersLost) })
    for (const s of newlyUnlocked) lines.push({ label: '🎉 Nieuwe skin', value: s.name.nl })

    track('passagiers_afgeleverd', { game: 'oversteek', count: world.passengersDelivered })

    if (world.score > sessionBest) {
      sessionBest = world.score
      setTimeout(() => sfx.record(), 220)
    }
    opts.onGameOver(world.score, lines, {
      streak: world.bestStreak,
      skin: skinId,
      passengers: world.passengersDelivered,
    })
  }

  const frame = (now: number) => {
    if (!world || !ctx || !opts || state !== 'running') return
    const dt = lastT ? (now - lastT) / 1000 : 0
    lastT = now
    if (dt > 0 && dt < 0.1) {
      smoothDt = smoothDt * 0.9 + dt * 0.1
      fx.setScale(smoothDt > 0.021 ? 0.5 : smoothDt > 0.0185 ? 0.75 : 1)
    }

    const wasOver = !world.over
    const wasNear = world.nearMisses
    const wasMinor = world.minorHits
    const wasLeg = world.legIndex
    const wasLost = world.passengersLost

    const effectiveDt = now < slowUntil ? dt * 0.18 : dt
    stepOversteek(world, effectiveDt)
    fx.update(dt)

    if (world.nearMisses > wasNear) {
      slowUntil = now + 130
      const p = ferryScreen(world)
      fx.popText(p.x, p.y - 26, 'Net gemist!', '#8FE9C0', 14)
    }
    if (world.minorHits > wasMinor) {
      const p = ferryScreen(world)
      fx.splash(p.x, p.y)
      sfx.splash()
    }
    if (world.passengersLost > wasLost) {
      const p = ferryScreen(world)
      fx.popText(p.x, p.y - 18, 'Passagier weg 😤', '#FFD24A', 13)
    }
    if (world.legIndex > wasLeg) {
      const p = ferryScreen(world)
      fx.crossingBurst(p.x, p.y)
      fx.popText(p.x, p.y - 24, 'Oversteek! ⛴️', '#8FE9C0', 16)
      sfx.chime()
      // Kleine kans op een meeuw voor sfeer aan het begin van de nieuwe oversteek.
      if (Math.random() < 0.35) sfx.gull()
    }
    if (world.score !== lastScore) {
      lastScore = world.score
      opts.onScoreChange(world.score)
    }

    renderOversteek(ctx, world, skinById(skinId), fx.shakeOffset())
    fx.draw(ctx)

    if (world.over && wasOver) {
      state = 'over'
      cancelAnimationFrame(raf)
      const p = ferryScreen(world)
      fx.splash(p.x, p.y)
      renderOversteek(ctx, world, skinById(skinId), fx.shakeOffset())
      fx.draw(ctx)
      ctx.save()
      ctx.fillStyle = 'rgba(255,255,255,0.45)'
      ctx.fillRect(0, 0, opts.width, opts.height)
      ctx.restore()
      sfx.splash()
      hitStopTimer = setTimeout(endRun, 70)
      return
    }
    raf = requestAnimationFrame(frame)
  }

  const begin = () => {
    if (!opts) return
    skinId = loadSelectedSkin()
    world = createOversteekWorld({ width: opts.width, height: opts.height, seed: (Date.now() & 0xffffffff) >>> 0 })
    lastScore = 0
    lastT = 0
    smoothDt = 0.016
    slowUntil = 0
    wasHeld = false
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
      if (hitStopTimer) {
        clearTimeout(hitStopTimer)
        hitStopTimer = null
      }
    },
    destroy() {
      cancelAnimationFrame(raf)
      if (hitStopTimer) {
        clearTimeout(hitStopTimer)
        hitStopTimer = null
      }
      sfx.close()
      ctx = null
      opts = null
      world = null
    },
    // Dit spel gebruikt continue sleep-besturing (onPointer); discrete
    // swipes/tikken doen niets, maar de methode moet bestaan (interface-eis).
    onInput(_action: InputAction) {
      /* geen discrete besturing in dit spel */
    },
    onPointer(nx: number, held: boolean) {
      if (state !== 'running' || !world) return
      setPointer(world, nx, held)
      if (held && !wasHeld) sfx.engine() // korte motor-opstoot bij het vastpakken
      wasHeld = held
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
      if (world) resizeOversteekWorld(world, wpx, hpx)
    },
    setMuted(muted: boolean) {
      sfx.setMuted(muted)
    },
  }
}
