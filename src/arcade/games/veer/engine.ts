/**
 * Vaar de Pont — pure spel-engine (geen canvas, geen DOM).
 *
 * Je stuurt de GVB-pont over het IJ van NDSM richting Centraal Station. De pont
 * vaart vanzelf vooruit; jij stuurt links/rechts om rondvaartboten, watertaxi's,
 * SUP'ers en boeien te ontwijken. Elke volledige overtocht levert bonuspunten en
 * de vaart wordt iets sneller. Deterministisch (seeded), dus los testbaar.
 */

export type BoatKind = 'rondvaart' | 'taxi' | 'sup' | 'buoy'
export interface Boat {
  x: number
  y: number // wereld-y (hoe verder, hoe verderop de vaarroute)
  w: number
  len: number
  kind: BoatKind
  vx: number // horizontale snelheid (kruisend verkeer)
}
export type ItemKind = 'coin' | 'shield'
export interface Item {
  x: number
  y: number // wereld-y
  r: number
  kind: ItemKind
  taken: boolean
}
export interface VeerWorld {
  width: number
  height: number
  t: number
  ferry: { x: number; vx: number }
  scroll: number // afstand gevaren (px)
  speed: number // huidige voorwaartse snelheid (px/s)
  crossings: number
  coins: number // opgepakte stroopwafels
  shield: number // reddingsboei-schilden op voorraad (vangt één aanvaring op)
  score: number
  over: boolean
  started: boolean
  boats: Boat[]
  items: Item[]
  genTo: number
  rng: () => number
}

export const FERRY_HALF = 22
export const FERRY_LEN = 34
export const FERRY_Y = 0.72 // schermfractie waar de pont vaart
export const CROSS_DIST = 900 // px voor één overtocht NDSM -> Centraal
export const COIN_VALUE = 5
const COIN_R = 12
const SHIELD_R = 14
const BASE_SPEED = 130
const MAX_SPEED = 360
const STEER = 240
const DRAG = 3.2

function makeRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function spawn(w: VeerWorld): void {
  const target = w.scroll + w.height * 1.7
  while (w.genTo < target) {
    const gap = Math.max(95, 200 - w.crossings * 7) * (0.7 + w.rng() * 0.7)
    w.genTo += gap
    const r = w.rng()
    let kind: BoatKind, bw: number, len: number, vx: number
    if (r < 0.38) {
      kind = 'rondvaart'
      bw = 74
      len = 30
      vx = (w.rng() < 0.5 ? -1 : 1) * (35 + w.rng() * 40)
    } else if (r < 0.66) {
      kind = 'taxi'
      bw = 34
      len = 22
      vx = (w.rng() < 0.5 ? -1 : 1) * (70 + w.rng() * 55)
    } else if (r < 0.85) {
      kind = 'sup'
      bw = 24
      len = 30
      vx = 0
    } else {
      kind = 'buoy'
      bw = 18
      len = 18
      vx = 0
    }
    const x = bw / 2 + w.rng() * (w.width - bw)
    w.boats.push({ x, y: w.genTo, w: bw, len, kind, vx })

    // Af en toe een stroopwafel in het gat achter de boot (reden om te sturen),
    // en zeldzaam een reddingsboei-schild. Nooit precies op de boot zelf.
    const ir = w.rng()
    if (ir < 0.4) {
      const ix = COIN_R + w.rng() * (w.width - COIN_R * 2)
      w.items.push({ x: ix, y: w.genTo - gap * 0.5, r: COIN_R, kind: 'coin', taken: false })
    } else if (ir < 0.46) {
      const ix = SHIELD_R + w.rng() * (w.width - SHIELD_R * 2)
      w.items.push({ x: ix, y: w.genTo - gap * 0.5, r: SHIELD_R, kind: 'shield', taken: false })
    }
  }
}

export function createVeerWorld(o: { width: number; height: number; seed?: number }): VeerWorld {
  const w: VeerWorld = {
    width: o.width,
    height: o.height,
    t: 0,
    ferry: { x: o.width / 2, vx: 0 },
    scroll: 0,
    speed: BASE_SPEED,
    crossings: 0,
    coins: 0,
    shield: 0,
    score: 0,
    over: false,
    started: false,
    boats: [],
    items: [],
    genTo: 0,
    rng: makeRng(o.seed ?? 1),
  }
  spawn(w)
  return w
}

export function resizeVeer(w: VeerWorld, width: number, height: number): void {
  if (w.width > 0) w.ferry.x = (w.ferry.x / w.width) * width
  w.width = width
  w.height = height
}

export function steerVeer(w: VeerWorld, action: 'left' | 'right' | 'up' | 'down' | 'tap'): void {
  if (w.over) return
  w.started = true
  if (action === 'left') w.ferry.vx = -STEER
  else if (action === 'right') w.ferry.vx = STEER
}

export function stepVeer(w: VeerWorld, dt: number): void {
  if (w.over) return
  const step = Math.min(dt, 0.05)
  w.t += step
  w.speed = Math.min(BASE_SPEED + w.crossings * 16, MAX_SPEED)
  if (w.started) w.scroll += w.speed * step

  // Sturen met momentum (voelt als een boot).
  w.ferry.x += w.ferry.vx * step
  w.ferry.vx -= w.ferry.vx * Math.min(1, DRAG * step)
  const minX = FERRY_HALF
  const maxX = w.width - FERRY_HALF
  if (w.ferry.x < minX) {
    w.ferry.x = minX
    w.ferry.vx = 0
  }
  if (w.ferry.x > maxX) {
    w.ferry.x = maxX
    w.ferry.vx = 0
  }

  const c = Math.floor(w.scroll / CROSS_DIST)
  if (c > w.crossings) w.crossings = c
  w.score = Math.floor(w.scroll / 6) + w.crossings * 40 + w.coins * COIN_VALUE

  // Botsingen met boten. Een schild vangt één aanvaring op: de boot wordt dan
  // "weggeduwd" (verwijderd) en het schild verbruikt, in plaats van game-over.
  const survivors: Boat[] = []
  for (const b of w.boats) {
    if (b.vx) {
      b.x += b.vx * step
      if (b.x < b.w / 2) {
        b.x = b.w / 2
        b.vx = Math.abs(b.vx)
      } else if (b.x > w.width - b.w / 2) {
        b.x = w.width - b.w / 2
        b.vx = -Math.abs(b.vx)
      }
    }
    const dy = Math.abs(b.y - w.scroll)
    const hit = dy < (b.len + FERRY_LEN) / 2 - 4 && Math.abs(b.x - w.ferry.x) < b.w / 2 + FERRY_HALF - 6
    if (hit) {
      if (w.shield > 0) {
        w.shield -= 1
        continue // boot verdwijnt, pont vaart door
      }
      w.over = true
      return
    }
    survivors.push(b)
  }
  w.boats = survivors.filter((b) => b.y > w.scroll - 80)

  // Stroopwafels en schilden oppakken die onder de pont door komen.
  for (const it of w.items) {
    if (it.taken) continue
    if (
      Math.abs(it.y - w.scroll) < it.r + FERRY_LEN / 2 &&
      Math.abs(it.x - w.ferry.x) < it.r + FERRY_HALF
    ) {
      it.taken = true
      if (it.kind === 'coin') w.coins += 1
      else w.shield += 1
    }
  }
  w.items = w.items.filter((it) => !it.taken && it.y > w.scroll - 80)
  w.score = Math.floor(w.scroll / 6) + w.crossings * 40 + w.coins * COIN_VALUE

  spawn(w)
}

/** Voortgang binnen de huidige overtocht (0..1) voor de balk naar Centraal. */
export function progressFraction(w: VeerWorld): number {
  return (w.scroll % CROSS_DIST) / CROSS_DIST
}
