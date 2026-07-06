/**
 * De Oversteek — pure spel-engine (geen canvas, geen DOM).
 *
 * Je bestuurt de GVB-pont heen en weer tussen NDSM en Centraal. Sleep om te
 * sturen; vasthouden versnelt, loslaten remt af. Doel: zoveel mogelijk
 * passagiers veilig oversteken, verkeer ontwijken en een schone-oversteken-
 * streak opbouwen voor een scoremultiplier. Endless arcade, net als Pont Hop:
 * één doorlopende sessie, oplopende moeilijkheid, game-over bij een zware
 * botsing. Deterministisch (seeded), dus los testbaar.
 */

export type PassengerType = 'toerist' | 'forens' | 'fietser' | 'festivalganger' | 'bezorger'
export type PassengerMood = 'blij' | 'ongeduldig'

export interface Passenger {
  type: PassengerType
  mood: PassengerMood
  /** Resterend geduld in seconden; Infinity voor 'blij' (loopt nooit weg). */
  patience: number
  maxPatience: number
  /** Al weggelopen tijdens de oversteek: telt niet meer mee bij aankomst. */
  lost: boolean
}

export type ObstacleKind = 'rondvaart' | 'taxi' | 'binnenvaart' | 'drijfhout'
export interface Obstacle {
  x: number
  y: number // wereld-y (afstand vóór de pont)
  w: number
  len: number
  kind: ObstacleKind
  vx: number
  /** Alleen voor 'rondvaart': slingert sinusvormig om `baseX`. */
  baseX: number
  weaveAmp: number
  weaveFreq: number
  weavePhase: number
  /** Grote boot: frontale raak is game over (in plaats van een penalty). */
  heavy: boolean
  hitDone: boolean
  nearDone: boolean
}

export interface OversteekWorld {
  width: number
  height: number
  t: number
  ferry: { x: number }
  /** Genormaliseerde (0..1) doelpositie van de vinger; ferry volgt dit vloeiend. */
  pointerX: number
  held: boolean
  started: boolean
  speed: number
  scroll: number
  /** Totale afstand deze run (blijft oplopen over alle oversteken heen; stuurt de moeilijkheidsgraad). */
  totalDistance: number
  /** Index van de huidige oversteek (0 = eerste, nog bezig). */
  legIndex: number
  legStartT: number
  hitsThisLeg: number
  streak: number
  bestStreak: number
  score: number
  passengersDelivered: number
  passengersLost: number
  nearMisses: number
  minorHits: number
  over: boolean
  passengers: Passenger[]
  obstacles: Obstacle[]
  genTo: number
  rng: () => number
}

// ---- Afstemming (tunables) -------------------------------------------------

export const FERRY_HALF = 24
export const FERRY_LEN = 40
export const FERRY_Y = 0.74 // schermfractie waar de pont vaart
export const CROSS_DIST = 850 // px voor één oversteek

const STEER_RATE = 11 // hoe snel de pont het sleep-doel volgt
const ACCEL = 210 // px/s² zolang je vasthoudt
const DECEL = 260 // px/s² zodra je loslaat
const BASE_MAX_SPEED = 150
const MAX_SPEED_CAP = 340
const HIT_FORGIVE = 6 // kleinere hitbox dan het zichtbare silhouet: eerlijker
const NEAR_MARGIN = 16 // extra marge rond een botsing die als "net gemist" telt

const PASSENGER_TYPES: PassengerType[] = ['toerist', 'forens', 'fietser', 'festivalganger', 'bezorger']
const IMPATIENT_CHANCE = 0.42
const PATIENCE_BASE = 13
const PATIENCE_VAR = 6
const BASE_POINTS = 8
const HAPPY_BONUS = 5
const IMPATIENT_PENALTY = 6
const CROSS_BASE_SCORE = 10
const NEAR_MISS_BONUS = 2
const SPEED_BONUS_CAP = 20

// ---- RNG (mulberry32, deterministisch) ------------------------------------

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

// ---- Moeilijkheidscurve -----------------------------------------------------

/** 0..1, loopt op over de eerste ~6000px afgelegde afstand, blijft dan druk. */
function difficultyT(totalDistance: number): number {
  return Math.min(1, totalDistance / 6000)
}
function maxSpeed(totalDistance: number): number {
  return Math.min(MAX_SPEED_CAP, BASE_MAX_SPEED + totalDistance * 0.02)
}

/** Combo-multiplier op basis van de streak vóór de zojuist voltooide oversteek. */
export function streakMultiplier(streak: number): number {
  if (streak >= 10) return 5
  if (streak >= 5) return 2
  return 1
}

// ---- Passagiers --------------------------------------------------------------

function boardPassengers(rng: () => number): Passenger[] {
  const n = 2 + Math.floor(rng() * 4) // 2..5
  const out: Passenger[] = []
  for (let i = 0; i < n; i++) {
    const type = PASSENGER_TYPES[Math.floor(rng() * PASSENGER_TYPES.length)]
    const impatient = rng() < IMPATIENT_CHANCE
    const maxPatience = impatient ? PATIENCE_BASE + rng() * PATIENCE_VAR : Infinity
    out.push({ type, mood: impatient ? 'ongeduldig' : 'blij', patience: maxPatience, maxPatience, lost: false })
  }
  return out
}

// ---- Obstakels ---------------------------------------------------------------

function pickKind(rng: () => number, dt: number): ObstacleKind {
  const r = rng()
  const heavyW = 0.06 + dt * 0.16
  const taxiW = 0.2 + dt * 0.15
  const driftW = 0.22 - dt * 0.1
  if (r < heavyW) return 'binnenvaart'
  if (r < heavyW + taxiW) return 'taxi'
  if (r < heavyW + taxiW + driftW) return 'drijfhout'
  return 'rondvaart'
}

function makeObstacle(w: OversteekWorld, y: number, dt: number): Obstacle {
  const kind = pickKind(w.rng, dt)
  const speedFactor = 1 + dt * 0.6
  if (kind === 'rondvaart') {
    const bw = 64 + w.rng() * 20
    const baseX = bw / 2 + w.rng() * (w.width - bw)
    return {
      x: baseX, y, w: bw, len: 32, kind, vx: 0, heavy: false,
      baseX, weaveAmp: 40 + w.rng() * 50, weaveFreq: 0.5 + w.rng() * 0.5, weavePhase: w.rng() * Math.PI * 2,
      hitDone: false, nearDone: false,
    }
  }
  if (kind === 'taxi') {
    const bw = 28 + w.rng() * 10
    const x = bw / 2 + w.rng() * (w.width - bw)
    const vx = (w.rng() < 0.5 ? -1 : 1) * (90 + w.rng() * 70) * speedFactor
    return {
      x, y, w: bw, len: 20, kind, vx, heavy: false,
      baseX: x, weaveAmp: 0, weaveFreq: 0, weavePhase: 0, hitDone: false, nearDone: false,
    }
  }
  if (kind === 'binnenvaart') {
    const bw = 100 + w.rng() * 40
    const x = bw / 2 + w.rng() * (w.width - bw)
    return {
      x, y, w: bw, len: 52, kind, vx: 0, heavy: true,
      baseX: x, weaveAmp: 0, weaveFreq: 0, weavePhase: 0, hitDone: false, nearDone: false,
    }
  }
  // drijfhout
  const bw = 18 + w.rng() * 8
  const x = bw / 2 + w.rng() * (w.width - bw)
  const vx = (w.rng() < 0.5 ? -1 : 1) * (18 + w.rng() * 22)
  return {
    x, y, w: bw, len: 20, kind, vx, heavy: false,
    baseX: x, weaveAmp: 0, weaveFreq: 0, weavePhase: 0, hitDone: false, nearDone: false,
  }
}

function spawnObstacles(w: OversteekWorld): void {
  const target = w.scroll + w.height * 1.8
  while (w.genTo < target) {
    const dt = difficultyT(w.totalDistance)
    // Onboarding: de eerste oversteek is bewust rustiger (ruimere gaten).
    const introEase = w.legIndex === 0 ? 1.7 : 1
    const gap = Math.max(140, 340 - dt * 190) * introEase * (0.75 + w.rng() * 0.5)
    w.genTo += gap
    w.obstacles.push(makeObstacle(w, w.genTo, dt))
  }
}

// ---- Wereld opzetten -----------------------------------------------------------

export interface WorldOpts {
  width: number
  height: number
  seed?: number
}

export function createOversteekWorld({ width, height, seed = 1 }: WorldOpts): OversteekWorld {
  const w: OversteekWorld = {
    width, height, t: 0,
    ferry: { x: width / 2 },
    pointerX: 0.5, held: false, started: false,
    speed: 0, scroll: 0, totalDistance: 0,
    legIndex: 0, legStartT: 0, hitsThisLeg: 0,
    streak: 0, bestStreak: 0, score: 0,
    passengersDelivered: 0, passengersLost: 0, nearMisses: 0, minorHits: 0,
    over: false,
    passengers: [], obstacles: [], genTo: 0,
    rng: makeRng(seed),
  }
  w.passengers = boardPassengers(w.rng)
  spawnObstacles(w)
  return w
}

export function resizeOversteekWorld(w: OversteekWorld, width: number, height: number): void {
  if (w.width > 0) w.ferry.x = (w.ferry.x / w.width) * width
  w.width = width
  w.height = height
}

/** Sleep-besturing: `nx` is 0..1 binnen het tekenvlak, `held` of er nu wordt aangeraakt. */
export function setPointer(w: OversteekWorld, nx: number, held: boolean): void {
  if (w.over) return
  w.pointerX = Math.max(0, Math.min(1, nx))
  w.held = held
  if (held) w.started = true
}

function completeLeg(w: OversteekWorld): void {
  const multiplier = streakMultiplier(w.streak)
  let legPoints = CROSS_BASE_SCORE

  const idealTime = CROSS_DIST / (maxSpeed(w.totalDistance) * 0.82)
  const actualTime = w.t - w.legStartT
  legPoints += Math.max(0, Math.min(SPEED_BONUS_CAP, Math.round((idealTime - actualTime) * 4)))

  let delivered = 0
  for (const p of w.passengers) {
    if (p.lost) continue
    legPoints += p.mood === 'blij' ? BASE_POINTS + HAPPY_BONUS : BASE_POINTS
    delivered++
  }
  w.passengersDelivered += delivered
  w.score = Math.max(0, w.score + Math.round(legPoints * multiplier))

  if (w.hitsThisLeg === 0) w.streak++
  else w.streak = 0
  w.bestStreak = Math.max(w.bestStreak, w.streak)

  w.hitsThisLeg = 0
  w.legIndex++
  w.legStartT = w.t
  w.passengers = boardPassengers(w.rng)
}

export function stepOversteek(w: OversteekWorld, dt: number): void {
  if (w.over) return
  const step = Math.min(dt, 0.05)
  w.t += step

  // Sturen reageert altijd meteen (ook vóór de eerste aanraking).
  const targetX = w.pointerX * w.width
  w.ferry.x += (targetX - w.ferry.x) * Math.min(1, STEER_RATE * step)
  w.ferry.x = Math.max(FERRY_HALF, Math.min(w.width - FERRY_HALF, w.ferry.x))

  if (!w.started) return

  // Snelheid: vasthouden versnelt, loslaten remt af.
  if (w.held) w.speed = Math.min(maxSpeed(w.totalDistance), w.speed + ACCEL * step)
  else w.speed = Math.max(0, w.speed - DECEL * step)
  w.scroll += w.speed * step
  w.totalDistance += w.speed * step

  // Ongeduldige passagiers lopen weg als hun geduld op is.
  for (const p of w.passengers) {
    if (p.mood === 'ongeduldig' && !p.lost) {
      p.patience -= step
      if (p.patience <= 0) {
        p.lost = true
        w.passengersLost++
        w.score = Math.max(0, w.score - IMPATIENT_PENALTY)
      }
    }
  }

  // Obstakels bewegen (per soort een vast, herkenbaar patroon) + botsingen.
  for (const o of w.obstacles) {
    if (o.kind === 'rondvaart') {
      o.x = o.baseX + Math.sin(w.t * o.weaveFreq + o.weavePhase) * o.weaveAmp
    } else if (o.vx !== 0) {
      o.x += o.vx * step
      const half = o.w / 2
      if (o.x < half) {
        o.x = half
        o.vx = Math.abs(o.vx)
      } else if (o.x > w.width - half) {
        o.x = w.width - half
        o.vx = -Math.abs(o.vx)
      }
    }
    const dy = Math.abs(o.y - w.scroll)
    const closeY = dy < (o.len + FERRY_LEN) / 2 - 4
    if (!closeY) continue
    const dx = Math.abs(o.x - w.ferry.x)
    const hitDx = o.w / 2 + FERRY_HALF - HIT_FORGIVE
    if (!o.hitDone && dx < hitDx) {
      o.hitDone = true
      if (o.heavy) {
        w.over = true
        return
      }
      w.minorHits++
      w.hitsThisLeg++
      w.streak = 0
      w.speed = Math.min(w.speed, maxSpeed(w.totalDistance) * 0.35)
    } else if (!o.nearDone && dx < hitDx + NEAR_MARGIN) {
      o.nearDone = true
      w.nearMisses++
      w.score += NEAR_MISS_BONUS
    }
  }
  w.obstacles = w.obstacles.filter((o) => o.y > w.scroll - 100)

  const legNo = Math.floor(w.scroll / CROSS_DIST)
  if (legNo > w.legIndex) completeLeg(w)

  spawnObstacles(w)
}

/** Voortgang binnen de huidige oversteek (0..1), voor de voortgangsbalk. */
export function legProgress(w: OversteekWorld): number {
  return (w.scroll % CROSS_DIST) / CROSS_DIST
}
