/**
 * Pont Hop — pure spel-engine (geen canvas, geen DOM).
 *
 * Alles wat de gameplay bepaalt zit hier en is deterministisch (seeded RNG),
 * zodat het in Node getest kan worden. Rendering leest dezelfde objectposities
 * via `laneObjectLefts` / `platformUnder`, zodat beeld en botsingen niet uiteen
 * kunnen lopen.
 *
 * Banenmodel (Crossy-Road-achtig, vertaald naar het IJ):
 * - 'pier'        : veilige steiger (start + finish elke segment).
 * - 'road'        : kade waar watertaxi's/rondvaartboten langs scheuren — raak = dood.
 * - 'water-ferry' : water; alleen veilig óp een varende pont, drijf mee.
 * - 'water-sup'   : water; smallere, snellere SUP-boards (stand-up paddle).
 */

export type LaneKind = 'pier' | 'road' | 'water-ferry' | 'water-sup'
export type DeathCause = 'water' | 'boat' | 'offscreen' | 'drift'

export interface Lane {
  index: number
  kind: LaneKind
  dir: 1 | -1
  /** px/s, altijd >= 0 (richting zit in `dir`). 0 voor piers. */
  speed: number
  /** breedte van één object (pont/boot/fiets). */
  width: number
  /** afstand tussen opeenvolgende object-linkerranden. */
  gap: number
  /** beltlengte = count * gap (voor naadloos wrappen). */
  L: number
  count: number
  /** vaste begin-offset van de belt. */
  phase: number
  /** px-midden van een stroopwafel op deze rij, of null. */
  coinX: number | null
  coinTaken: boolean
}

export interface Player {
  /** rij-index; hoger = verder richting Centraal. */
  row: number
  /** horizontale positie in px (continu; drijft mee op ponten). */
  x: number
}

export interface World {
  width: number
  height: number
  t: number
  player: Player
  lanes: Map<number, Lane>
  cameraY: number
  score: number
  crossings: number
  coins: number
  over: boolean
  cause: DeathCause | null
  started: boolean
  idleFor: number
  /** rij-index van de verst bereikte (al getelde) finish-steiger. */
  maxPier: number
  rng: () => number
  /** generatie-boekhouding */
  genTo: number
  rowsSincePier: number
  segTarget: number
  /** Korte hop-animatie (1 -> 0) voor een vloeiend stuitertje na elke beweging. */
  hopAnim: number
}

// ---- Afstemming (tunables) -------------------------------------------------

export const ROW_H = 58
export const COL_W = 50
export const PLAYER_HALF = 16
const COIN_R = 13
const CULL_BEHIND = 4
const GEN_AHEAD = 16
export const CROSS_BASE = 10
export const COIN_VALUE = 3
const IDLE_NUDGE = 11 // px/s waarmee de camera oprukt als je beweegt (mild)
const IDLE_GRACE = 4 // s stilstand voordat de nudge inzet
const HIT_FORGIVE = 5 // kleinere hitbox: net-misser met een boot telt niet als raak
const CAMERA_LERP = 7
const PLAYER_ANCHOR = 0.28 // speler zit 28% van onderaf: minder dode ruimte, meer zicht vooruit

// ---- RNG (mulberry32, deterministisch) ------------------------------------

export function makeRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const mod = (n: number, m: number) => ((n % m) + m) % m
const randRange = (rng: () => number, lo: number, hi: number) => lo + rng() * (hi - lo)

function segDanger(crossings: number): number {
  // Begin rustig: korte segmenten met veel veilige steigers, langzaam zwaarder.
  return Math.min(2 + Math.floor(crossings / 3), 6)
}
export function speedFactor(crossings: number): number {
  return Math.min(1 + crossings * 0.05, 2.0)
}

// ---- Baangeneratie ---------------------------------------------------------

function makeLane(
  index: number,
  kind: LaneKind,
  crossings: number,
  rng: () => number,
  width: number,
): Lane {
  if (kind === 'pier') {
    return {
      index, kind, dir: 1, speed: 0, width: 0, gap: 0, L: 1, count: 0, phase: 0,
      coinX: null, coinTaken: false,
    }
  }
  const factor = speedFactor(crossings)
  let objW: number
  let speed: number
  let gap: number
  if (kind === 'road') {
    objW = randRange(rng, 64, 92)
    speed = randRange(rng, 58, 92) * factor
    gap = objW + randRange(rng, 200, 320) / Math.sqrt(factor)
  } else if (kind === 'water-ferry') {
    objW = randRange(rng, 130, 175)
    speed = randRange(rng, 36, 64) * factor
    gap = objW + randRange(rng, 55, 95)
  } else {
    objW = randRange(rng, 70, 96)
    speed = randRange(rng, 64, 104) * factor
    gap = objW + randRange(rng, 48, 92)
  }
  const count = Math.ceil((width + objW) / gap) + 1
  const L = count * gap
  const dir: 1 | -1 = rng() < 0.5 ? 1 : -1
  // Stroopwafel alleen op veilige kades (road), nooit middenin het water.
  const coinX = kind === 'road' && rng() < 0.33 ? colCenter(Math.floor(rng() * cols(width)), width) : null
  return { index, kind, dir, speed, width: objW, gap, L, count, phase: rng() * L, coinX, coinTaken: false }
}

function cols(width: number): number {
  return Math.max(1, Math.floor(width / COL_W))
}
function colCenter(col: number, width: number): number {
  const n = cols(width)
  const c = Math.max(0, Math.min(n - 1, col))
  const margin = (width - n * COL_W) / 2
  return margin + c * COL_W + COL_W / 2
}

function chooseDangerKind(rng: () => number): LaneKind {
  const r = rng()
  if (r < 0.4) return 'road'
  if (r < 0.74) return 'water-ferry'
  return 'water-sup'
}

/** Genereert ontbrekende rijen tot en met `upTo`. */
function generateUpTo(w: World, upTo: number): void {
  while (w.genTo <= upTo) {
    const index = w.genTo
    let lane: Lane
    if (index === 0) {
      lane = makeLane(index, 'pier', w.crossings, w.rng, w.width)
      w.rowsSincePier = 0
      w.segTarget = segDanger(w.crossings)
    } else if (w.rowsSincePier >= w.segTarget) {
      lane = makeLane(index, 'pier', w.crossings, w.rng, w.width)
      w.rowsSincePier = 0
      w.segTarget = segDanger(estimateCrossingsAt(index))
    } else {
      lane = makeLane(index, chooseDangerKind(w.rng), estimateCrossingsAt(index), w.rng, w.width)
      w.rowsSincePier++
    }
    w.lanes.set(index, lane)
    w.genTo++
  }
}

/** Grove schatting van het aantal overstekens op rij-index (voor moeilijkheid
 *  vooruit), gebaseerd op de gemiddelde segmentlengte. */
function estimateCrossingsAt(index: number): number {
  return Math.floor(index / 5)
}

// ---- Wereld opzetten -------------------------------------------------------

export interface WorldOpts {
  width: number
  height: number
  seed?: number
}

export function createWorld({ width, height, seed = 1 }: WorldOpts): World {
  const w: World = {
    width,
    height,
    t: 0,
    player: { row: 0, x: width / 2 },
    lanes: new Map(),
    cameraY: 0,
    score: 0,
    crossings: 0,
    coins: 0,
    over: false,
    cause: null,
    started: false,
    idleFor: 0,
    maxPier: 0,
    rng: makeRng(seed),
    genTo: 0,
    rowsSincePier: 0,
    segTarget: 3,
    hopAnim: 0,
  }
  generateUpTo(w, GEN_AHEAD)
  w.cameraY = playerWorldY(w) - height * PLAYER_ANCHOR
  return w
}

export function resizeWorld(w: World, width: number, height: number): void {
  w.width = width
  w.height = height
  w.player.x = Math.max(PLAYER_HALF, Math.min(width - PLAYER_HALF, w.player.x))
}

// ---- Object-posities (gedeeld met de renderer) -----------------------------

/** Linkerranden van alle objecten op een baan op tijdstip t. */
export function laneObjectLefts(lane: Lane, t: number): number[] {
  if (lane.kind === 'pier' || lane.count === 0) return []
  const out: number[] = []
  for (let i = 0; i < lane.count; i++) {
    const raw = lane.phase + i * lane.gap + lane.dir * lane.speed * t
    out.push(mod(raw, lane.L) - lane.width)
  }
  return out
}

/** Geeft de linkerrand van het platform waar `px` op staat, of null. */
export function platformUnder(lane: Lane, t: number, px: number): number | null {
  const edge = 4 // kleine marge: net op de rand telt niet meer
  for (const left of laneObjectLefts(lane, t)) {
    if (px >= left + edge && px <= left + lane.width - edge) return left
  }
  return null
}

function boatHits(lane: Lane, t: number, px: number): boolean {
  const r = PLAYER_HALF - HIT_FORGIVE
  for (const left of laneObjectLefts(lane, t)) {
    if (px + r > left && px - r < left + lane.width) return true
  }
  return false
}

// ---- Camera ----------------------------------------------------------------

export function playerWorldY(w: World): number {
  return w.player.row * ROW_H
}

// ---- Invoer ----------------------------------------------------------------

export type HopAction = 'up' | 'down' | 'left' | 'right' | 'tap'

export function worldHop(w: World, action: HopAction): void {
  if (w.over) return
  w.started = true
  w.idleFor = 0
  w.hopAnim = 1 // start een kort stuitertje

  if (action === 'up' || action === 'tap') {
    w.player.row += 1
    generateUpTo(w, w.player.row + GEN_AHEAD)
    settleAfterHop(w)
  } else if (action === 'down') {
    // Terug mag, maar niet onder de onderkant van het beeld.
    const minRow = Math.ceil(w.cameraY / ROW_H)
    if (w.player.row - 1 >= Math.max(0, minRow)) {
      w.player.row -= 1
      settleAfterHop(w)
    }
  } else if (action === 'left') {
    w.player.x = Math.max(PLAYER_HALF, w.player.x - COL_W)
  } else if (action === 'right') {
    w.player.x = Math.min(w.width - PLAYER_HALF, w.player.x + COL_W)
  }
}

/** Na een vooruit/achteruit-hop: tel oversteek bij een nieuwe finish-steiger.
 *  Cull-veilig: we onthouden de verst getelde steiger i.p.v. opnieuw te tellen. */
function settleAfterHop(w: World): void {
  const lane = w.lanes.get(w.player.row)
  if (lane && lane.kind === 'pier' && w.player.row > w.maxPier) {
    w.maxPier = w.player.row
    w.crossings += 1
    w.score = w.crossings * CROSS_BASE + w.coins * COIN_VALUE
  }
}

// ---- Stap (per frame) ------------------------------------------------------

export function worldStep(w: World, dt: number): void {
  if (w.over) return
  // Voorkom enorme sprongen na tab-switch.
  const step = Math.min(dt, 0.05)
  w.t += step
  if (w.hopAnim > 0) w.hopAnim = Math.max(0, w.hopAnim - step / 0.13)

  const lane = w.lanes.get(w.player.row)

  // 1. Meedrijven op een pont/fiets.
  if (lane && (lane.kind === 'water-ferry' || lane.kind === 'water-sup')) {
    const left = platformUnder(lane, w.t, w.player.x)
    if (left !== null) {
      w.player.x += lane.dir * lane.speed * step
      if (w.player.x < PLAYER_HALF || w.player.x > w.width - PLAYER_HALF) {
        return die(w, 'drift') // van de pont het water in gedreven
      }
    } else {
      return die(w, 'water') // geen platform onder je
    }
  }

  // 2. Geraakt door een boot op een gevaar-baan.
  if (lane && lane.kind === 'road' && boatHits(lane, w.t, w.player.x)) {
    return die(w, 'boat')
  }

  // 3. Stroopwafel oppakken.
  if (lane && lane.coinX !== null && !lane.coinTaken) {
    if (Math.abs(w.player.x - lane.coinX) < PLAYER_HALF + COIN_R) {
      lane.coinTaken = true
      w.coins++
      w.score = w.crossings * CROSS_BASE + w.coins * COIN_VALUE
    }
  }

  // 4. Camera volgt de speler; idle-nudge rukt mild op zodra je bent gestart.
  const target = playerWorldY(w) - w.height * PLAYER_ANCHOR
  if (target > w.cameraY) {
    w.cameraY += Math.min(target - w.cameraY, (target - w.cameraY) * CAMERA_LERP * step + 0.001)
  }
  if (w.started) {
    w.idleFor += step
    if (w.idleFor > IDLE_GRACE) w.cameraY += IDLE_NUDGE * step
  }

  // 5. Te ver achterop = kopje onder (de milde "adelaar").
  if (playerWorldY(w) < w.cameraY) {
    return die(w, 'offscreen')
  }

  // 6. Genereer vooruit, ruim achter op.
  generateUpTo(w, w.player.row + GEN_AHEAD)
  cull(w)
}

function cull(w: World): void {
  const minKeep = w.player.row - CULL_BEHIND
  for (const key of w.lanes.keys()) {
    if (key < minKeep) w.lanes.delete(key)
  }
}

function die(w: World, cause: DeathCause): void {
  w.over = true
  w.cause = cause
}
