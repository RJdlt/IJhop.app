import type { GameInitOpts, GameModule, GameState, InputAction } from '../../types'
import { createWorld, resizeWorld, worldHop, worldStep } from './engine'
import type { World } from './engine'
import { render, playerScreen } from './render'
import type { Skin } from './render'
import { Sfx } from './audio'
import { Fx } from './fx'
import {
  applyRunResult,
  CHARACTERS,
  characterById,
  isUnlocked,
  loadProfile,
  runLevel,
  runReward,
  saveProfile,
} from './profile'
import { recordRun as recordChallenge } from './challenge'

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
  let lastCoins = 0
  let lastCrossings = 0
  // Combo: opeenvolgende stroopwafels binnen het venster stapelen op en geven
  // bonus-wafels. Puur belonend; de score-engine blijft ongemoeid.
  let combo = 0
  let lastCoinT = -99
  let comboBonus = 0
  const COMBO_WINDOW = 2.6
  let skin: Skin = { kind: 'pim', capColor: '#F08A24', bodyColor: '#15616D' }
  const sfx = new Sfx()
  const fx = new Fx()

  const frame = (now: number) => {
    if (!world || !ctx || !opts || state !== 'running') return
    const dt = lastT ? (now - lastT) / 1000 : 0
    lastT = now

    const wasSafe = !world.over
    worldStep(world, dt)
    fx.update(dt)

    // Stroopwafel opgepakt: sprankels, combo en zwevende "+3".
    if (world.coins > lastCoins) {
      const p = playerScreen(world)
      combo = world.t - lastCoinT <= COMBO_WINDOW ? combo + 1 : 1
      lastCoinT = world.t
      const bonus = combo - 1
      comboBonus += bonus
      sfx.coin()
      fx.coinBurst(p.x, p.y, combo)
      fx.popText(p.x, p.y - 20, '+3 🧇')
      if (combo >= 2) fx.popText(p.x, p.y - 44, `Combo x${combo}!`, combo >= 4 ? '#FFD24A' : '#8FE9C0', 15)
      lastCoins = world.coins
    }
    // Overtocht gehaald: confetti + juichtekst.
    if (world.crossings > lastCrossings) {
      const p = playerScreen(world)
      fx.crossingBurst(p.x, p.y)
      fx.popText(p.x, p.y - 24, 'Overtocht! 🎉', '#8FE9C0', 16)
      lastCrossings = world.crossings
    }

    if (world.score !== lastScore) {
      lastScore = world.score
      opts.onScoreChange(world.score)
    }

    render(ctx, world, skin, fx.shakeOffset())
    fx.draw(ctx)

    if (world.over && wasSafe) {
      state = 'over'
      sfx.splash()
      {
        const p = playerScreen(world)
        fx.splash(p.x, p.y)
        fx.draw(ctx)
      }
      cancelAnimationFrame(raf)
      // Bonus-stroopwafels (verzamelde munten + afstand) in de spaarpot.
      const run = { crossings: world.crossings, coins: world.coins }
      const reward = runReward(run)
      const before = loadProfile()
      const profile = applyRunResult(before, run)
      // Dagelijkse uitdaging bijwerken; net gehaald = extra stroopwafels.
      const chal = recordChallenge({ coins: world.coins, crossings: world.crossings, score: world.score })
      if (chal.justCompleted && chal.reward > 0) profile.wallet += chal.reward
      // Combo-bonus: extra wafels voor stroopwafels op rij gepakt.
      if (comboBonus > 0) profile.wallet += comboBonus
      saveProfile(profile)
      // Mijlpaal-poppetjes die door deze run zijn vrijgespeeld.
      const unlocked = CHARACTERS.filter((c) => !isUnlocked(before, c) && isUnlocked(profile, c))
      const lines = [
        { label: 'Level', value: String(runLevel(world.crossings)) },
        { label: 'Bonus 🧇', value: `+${reward}` },
        { label: 'Totaal 🧇', value: String(profile.wallet) },
        ...unlocked.map((c) => ({ label: '🎉 Vrijgespeeld', value: `${c.emoji} ${c.name.nl}` })),
      ]
      if (comboBonus > 0) lines.push({ label: '🔥 Combo', value: `+${comboBonus} 🧇` })
      if (chal.justCompleted) lines.push({ label: '🎯 Uitdaging', value: `+${chal.reward} 🧇` })
      opts.onGameOver(world.score, lines)
      return
    }
    raf = requestAnimationFrame(frame)
  }

  const begin = () => {
    if (!opts) return
    // Lees het gekozen poppetje vers in, zodat een shop-keuze meteen meegaat.
    const character = characterById(loadProfile().selected)
    skin = { kind: character.id, capColor: character.capColor, bodyColor: character.bodyColor }
    world = createWorld({ width: opts.width, height: opts.height, seed: (Date.now() & 0xffffffff) >>> 0 })
    lastScore = 0
    lastCoins = 0
    lastCrossings = 0
    combo = 0
    lastCoinT = -99
    comboBonus = 0
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
