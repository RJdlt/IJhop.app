import { describe, expect, it } from 'vitest'
import {
  CROSS_BASE,
  COIN_VALUE,
  PLAYER_HALF,
  createWorld,
  laneObjectLefts,
  makeRng,
  platformUnder,
  speedFactor,
  worldHop,
  worldStep,
} from './engine'
import type { Lane, World } from './engine'

const W = 360
const H = 640

function world(): World {
  const w = createWorld({ width: W, height: H, seed: 42 })
  // Zet camera ver weg zodat 'offscreen' niet meespeelt in gerichte tests.
  w.cameraY = -100000
  w.started = false
  w.idleFor = 0
  return w
}

/** Bouwt een baan met één object waarvan de linkerrand op `left` ligt bij t=0
 *  (speed 0, tenzij anders), zodat we botsingen exact kunnen plaatsen. */
function laneWith(kind: Lane['kind'], index: number, left: number, objW: number, extra: Partial<Lane> = {}): Lane {
  const L = 100000
  return {
    index,
    kind,
    dir: 1,
    speed: 0,
    width: objW,
    gap: L,
    L,
    count: 1,
    phase: left + objW, // x = mod(phase,L) - width = left
    coinX: null,
    coinTaken: false,
    ...extra,
  }
}

describe('makeRng', () => {
  it('is deterministisch per seed', () => {
    const a = makeRng(7)
    const b = makeRng(7)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
  it('geeft verschillende reeksen voor andere seeds', () => {
    expect(makeRng(1)()).not.toEqual(makeRng(2)())
  })
})

describe('createWorld', () => {
  it('start op een steiger met de speler gecentreerd', () => {
    const w = createWorld({ width: W, height: H, seed: 1 })
    expect(w.lanes.get(0)?.kind).toBe('pier')
    expect(w.player.row).toBe(0)
    expect(w.player.x).toBeCloseTo(W / 2)
    expect(w.over).toBe(false)
  })
})

describe('moeilijkheid', () => {
  it('speedFactor loopt op en is begrensd', () => {
    expect(speedFactor(0)).toBe(1)
    expect(speedFactor(4)).toBeGreaterThan(speedFactor(0))
    expect(speedFactor(1000)).toBeLessThanOrEqual(2.4)
  })
})

describe('invoer', () => {
  it('hopt vooruit en telt een oversteek + score op een nieuwe steiger', () => {
    const w = world()
    // Vier keer vooruit landt op de eerste finish-steiger (rij 4 bij seed-cadans).
    let guard = 0
    while (w.lanes.get(w.player.row + 1)) {
      worldHop(w, 'up')
      if (w.lanes.get(w.player.row)?.kind === 'pier') break
      if (++guard > 20) break
    }
    expect(w.crossings).toBe(1)
    expect(w.score).toBe(CROSS_BASE)
  })

  it('kan niet onder de startrij terug', () => {
    const w = world()
    w.cameraY = -100000
    worldHop(w, 'down')
    expect(w.player.row).toBe(0)
  })

  it('klemt zijwaarts binnen het veld', () => {
    const w = world()
    for (let i = 0; i < 50; i++) worldHop(w, 'left')
    expect(w.player.x).toBeGreaterThanOrEqual(PLAYER_HALF)
    for (let i = 0; i < 100; i++) worldHop(w, 'right')
    expect(w.player.x).toBeLessThanOrEqual(W - PLAYER_HALF)
  })
})

describe('botsingen & water', () => {
  it('verdrinkt in een waterbaan zonder platform', () => {
    const w = world()
    w.player.row = 5
    w.lanes.set(5, { ...laneWith('water-ferry', 5, 0, 120), count: 0 })
    worldStep(w, 0.02)
    expect(w.over).toBe(true)
    expect(w.cause).toBe('water')
  })

  it('drijft mee op een pont en overleeft', () => {
    const w = world()
    w.player.row = 5
    const px = w.player.x
    w.lanes.set(5, laneWith('water-ferry', 5, px - 60, 120, { dir: 1, speed: 50 }))
    expect(platformUnder(w.lanes.get(5)!, 0, px)).not.toBeNull()
    worldStep(w, 0.04)
    expect(w.over).toBe(false)
    expect(w.player.x).toBeCloseTo(px + 50 * 0.04, 1) // meegedreven
  })

  it('drijft van de pont het water in aan de rand', () => {
    const w = world()
    w.player.row = 5
    w.player.x = 30
    // Breed platform dat de hele linkerzone dekt, beweegt naar links.
    w.lanes.set(5, laneWith('water-ferry', 5, -50, 200, { dir: -1, speed: 200 }))
    for (let i = 0; i < 10 && !w.over; i++) worldStep(w, 0.05)
    expect(w.over).toBe(true)
    expect(w.cause).toBe('drift')
  })

  it('gaat dood bij een rake boot op een gevaarbaan', () => {
    const w = world()
    w.player.row = 5
    w.lanes.set(5, laneWith('road', 5, w.player.x - 20, 40))
    worldStep(w, 0.02)
    expect(w.over).toBe(true)
    expect(w.cause).toBe('boat')
  })

  it('overleeft een gevaarbaan als de boot mist', () => {
    const w = world()
    w.player.row = 5
    w.lanes.set(5, laneWith('road', 5, w.player.x + 200, 40))
    worldStep(w, 0.02)
    expect(w.over).toBe(false)
  })
})

describe('stroopwafels', () => {
  it('pakt een munt op en telt mee in de score', () => {
    const w = world()
    w.player.row = 3
    w.lanes.set(3, { ...laneWith('road', 3, w.player.x + 500, 40), coinX: w.player.x })
    worldStep(w, 0.02)
    expect(w.coins).toBe(1)
    expect(w.score).toBe(w.crossings * CROSS_BASE + COIN_VALUE)
  })
})

describe('idle-nudge', () => {
  it('rukt op en verdrinkt een speler die te lang stilstaat', () => {
    const w = world()
    w.player.row = 10
    w.lanes.set(10, { ...laneWith('pier', 10, 0, 0), kind: 'pier' })
    w.cameraY = w.player.row * 58 - 5 // net onder de speler
    w.started = true
    w.idleFor = 3 // voorbij de grace
    let safe = 0
    while (!w.over && safe++ < 200) worldStep(w, 0.1)
    expect(w.over).toBe(true)
    expect(w.cause).toBe('offscreen')
  })
})

describe('laneObjectLefts', () => {
  it('plaatst objecten binnen de beltlengte', () => {
    const lane = laneWith('road', 1, 100, 60, { count: 3, gap: 200, L: 600 })
    const lefts = laneObjectLefts(lane, 0)
    expect(lefts).toHaveLength(3)
    for (const x of lefts) expect(x).toBeGreaterThanOrEqual(-lane.width)
  })
})
