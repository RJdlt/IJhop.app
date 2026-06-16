/**
 * Pont Hop — rendering. Leest de wereld (engine.ts) en tekent 'm op het canvas.
 * Gebruikt exact dezelfde objectposities als de botsingslogica, zodat beeld en
 * spel niet uiteenlopen.
 */
import {
  ROW_H,
  PLAYER_HALF,
  laneObjectLefts,
  platformUnder,
  playerWorldY,
} from './engine'
import type { Lane, World } from './engine'

// Brand- en lijnkleuren (hergebruikt uit de app).
const F4_RED = '#E2231A'
const F7_BLUE = '#009DE0'
const WATER = '#1486B8'
const WATER_DK = '#0E6E9B'
const QUAY = '#566069'
const PIER = '#E4B27E'
const PIER_EDGE = '#C8915A'
const BIKE = '#C98A3B'
const BUS_BLUE = '#0B5FA5'
const COIN = '#D98A1E'
const COIN_DK = '#A8650F'

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.arcTo(x + w, y, x + w, y + h, rad)
  ctx.arcTo(x + w, y + h, x, y + h, rad)
  ctx.arcTo(x, y + h, x, y, rad)
  ctx.arcTo(x, y, x + w, y, rad)
  ctx.closePath()
}

export interface Skin {
  capColor: string
  bodyColor: string
}

const DEFAULT_SKIN: Skin = { capColor: '#F08A24', bodyColor: '#15616D' }

/** Verdonkert een hex-kleur (0..1) — voor de "gevaar"-tint van het lijf. */
function darken(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const f = 1 - amount
  const r = Math.round(((n >> 16) & 255) * f)
  const g = Math.round(((n >> 8) & 255) * f)
  const b = Math.round((n & 255) * f)
  return `rgb(${r},${g},${b})`
}

export function render(
  ctx: CanvasRenderingContext2D,
  w: World,
  skin: Skin = DEFAULT_SKIN,
): void {
  const { width, height, cameraY, t } = w
  // worldY -> schermY (hoger in de wereld = hoger in beeld)
  const sy = (worldY: number) => height - (worldY - cameraY)

  ctx.clearRect(0, 0, width, height)

  const firstRow = Math.floor(cameraY / ROW_H) - 1
  const lastRow = Math.ceil((cameraY + height) / ROW_H) + 1

  for (let r = firstRow; r <= lastRow; r++) {
    const lane = w.lanes.get(r)
    if (!lane) continue
    const bandTop = sy(r * ROW_H + ROW_H / 2)
    drawLaneBackground(ctx, lane, width, bandTop)
  }
  for (let r = firstRow; r <= lastRow; r++) {
    const lane = w.lanes.get(r)
    if (!lane) continue
    const bandTop = sy(r * ROW_H + ROW_H / 2)
    drawLaneObjects(ctx, lane, t, width, bandTop)
    if (lane.coinX !== null && !lane.coinTaken) drawCoin(ctx, lane.coinX, bandTop + ROW_H / 2)
  }

  drawPlayer(ctx, w.player.x, sy(playerWorldY(w)), onSafeGround(w), skin)

  if (w.started && w.idleFor > 2.5 && !w.over) drawIdleHint(ctx, width, height)
}

function onSafeGround(w: World): boolean {
  const lane = w.lanes.get(w.player.row)
  if (!lane) return true
  if (lane.kind === 'pier' || lane.kind === 'road') return true
  return platformUnder(lane, w.t, w.player.x) !== null
}

function drawLaneBackground(ctx: CanvasRenderingContext2D, lane: Lane, width: number, top: number) {
  if (lane.kind === 'pier') {
    ctx.fillStyle = PIER
    ctx.fillRect(0, top, width, ROW_H)
    ctx.fillStyle = PIER_EDGE
    ctx.fillRect(0, top, width, 4)
    ctx.fillRect(0, top + ROW_H - 4, width, 4)
    // planken
    ctx.strokeStyle = 'rgba(0,0,0,0.08)'
    ctx.lineWidth = 2
    for (let x = 24; x < width; x += 48) {
      ctx.beginPath()
      ctx.moveTo(x, top + 4)
      ctx.lineTo(x, top + ROW_H - 4)
      ctx.stroke()
    }
  } else if (lane.kind === 'road') {
    ctx.fillStyle = QUAY
    ctx.fillRect(0, top, width, ROW_H)
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    ctx.lineWidth = 3
    ctx.setLineDash([18, 16])
    ctx.beginPath()
    ctx.moveTo(0, top + ROW_H / 2)
    ctx.lineTo(width, top + ROW_H / 2)
    ctx.stroke()
    ctx.setLineDash([])
  } else {
    ctx.fillStyle = WATER
    ctx.fillRect(0, top, width, ROW_H)
    ctx.strokeStyle = WATER_DK
    ctx.lineWidth = 2
    for (let x = 0; x < width; x += 34) {
      ctx.beginPath()
      ctx.arc(x + (lane.index % 2 ? 17 : 0), top + ROW_H * 0.32, 7, Math.PI * 0.15, Math.PI * 0.85)
      ctx.stroke()
    }
  }
}

function drawLaneObjects(
  ctx: CanvasRenderingContext2D,
  lane: Lane,
  t: number,
  width: number,
  top: number,
) {
  if (lane.kind === 'pier') return
  const lefts = laneObjectLefts(lane, t)
  for (const left of lefts) {
    if (left > width || left + lane.width < 0) continue
    if (lane.kind === 'water-ferry') drawFerry(ctx, left, top, lane.width, lane.index)
    else if (lane.kind === 'water-sup') drawSup(ctx, left, top, lane.width)
    else drawBus(ctx, left, top, lane.width, lane.dir)
  }
}

function drawFerry(ctx: CanvasRenderingContext2D, x: number, top: number, w: number, index: number) {
  const color = index % 2 === 0 ? F4_RED : F7_BLUE
  const pad = 6
  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  rr(ctx, x + pad, top + pad + 3, w - pad * 2, ROW_H - pad * 2, 12)
  ctx.fill()
  ctx.fillStyle = color
  rr(ctx, x + pad, top + pad, w - pad * 2, ROW_H - pad * 2, 12)
  ctx.fill()
  // dek + cabine
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  rr(ctx, x + w / 2 - 16, top + ROW_H / 2 - 12, 32, 24, 5)
  ctx.fill()
  ctx.fillStyle = color
  ctx.font = '700 11px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(index % 2 === 0 ? 'F4' : 'F7', x + w / 2, top + ROW_H / 2 + 4)
}

// Drijvend SUP-board (stand-up paddleboard) — smal, lichthouten dek.
function drawSup(ctx: CanvasRenderingContext2D, x: number, top: number, w: number) {
  const cy = top + ROW_H / 2
  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  ctx.beginPath()
  ctx.ellipse(x + w / 2, cy + 5, w / 2 - 4, 9, 0, 0, Math.PI * 2)
  ctx.fill()
  // board: spits aan beide kanten
  ctx.fillStyle = BIKE
  ctx.beginPath()
  ctx.ellipse(x + w / 2, cy, w / 2 - 2, 11, 0, 0, Math.PI * 2)
  ctx.fill()
  // houtnerf + streep
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x + 10, cy)
  ctx.lineTo(x + w - 10, cy)
  ctx.stroke()
  // handvat / grip
  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  ctx.beginPath()
  ctx.arc(x + w / 2, cy, 4, 0, Math.PI * 2)
  ctx.fill()
}

// GVB-bus op de kade (gevaar) — duidelijk een bus met ramen en wielen.
function drawBus(ctx: CanvasRenderingContext2D, x: number, top: number, w: number, dir: 1 | -1) {
  const bodyTop = top + 8
  const bodyH = ROW_H - 22
  // wielen
  ctx.fillStyle = '#11181C'
  const wy = bodyTop + bodyH
  ctx.beginPath()
  ctx.arc(x + w * 0.24, wy, 6, 0, Math.PI * 2)
  ctx.arc(x + w * 0.76, wy, 6, 0, Math.PI * 2)
  ctx.fill()
  // carrosserie (GVB-blauw)
  ctx.fillStyle = BUS_BLUE
  rr(ctx, x + 2, bodyTop, w - 4, bodyH, 9)
  ctx.fill()
  // voorruit aan de rijrichting-kant
  ctx.fillStyle = '#BFE7F7'
  const front = dir === 1 ? x + w - 16 : x + 6
  rr(ctx, front, bodyTop + 5, 10, bodyH - 14, 3)
  ctx.fill()
  // rij zijramen
  ctx.fillStyle = '#CFEFFB'
  const winY = bodyTop + 6
  const winH = Math.max(7, bodyH * 0.34)
  const startX = dir === 1 ? x + 8 : x + 18
  for (let wx = startX; wx < x + w - 22; wx += 16) {
    rr(ctx, wx, winY, 10, winH, 2)
    ctx.fill()
  }
  // gele accentstreep
  ctx.fillStyle = '#F4C20D'
  ctx.fillRect(x + 4, bodyTop + bodyH - 8, w - 8, 4)
  // koplamp
  ctx.fillStyle = '#FFE08A'
  ctx.beginPath()
  ctx.arc(dir === 1 ? x + w - 6 : x + 6, bodyTop + bodyH - 4, 2.4, 0, Math.PI * 2)
  ctx.fill()
}

function drawCoin(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.fillStyle = COIN
  ctx.beginPath()
  ctx.arc(cx, cy, 12, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = COIN_DK
  ctx.lineWidth = 2
  ctx.stroke()
  // stroopwafel-ruitjes
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'
  ctx.lineWidth = 1
  for (let i = -2; i <= 2; i += 2) {
    ctx.beginPath()
    ctx.moveTo(cx - 8, cy + i * 3)
    ctx.lineTo(cx + 8, cy + i * 3)
    ctx.stroke()
  }
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  safe: boolean,
  skin: Skin,
) {
  // schaduw
  ctx.fillStyle = 'rgba(0,0,0,0.2)'
  ctx.beginPath()
  ctx.ellipse(x, y + PLAYER_HALF - 2, PLAYER_HALF, 6, 0, 0, Math.PI * 2)
  ctx.fill()
  // lijf (gevaar = donkerder)
  ctx.fillStyle = safe ? skin.bodyColor : darken(skin.bodyColor, 0.4)
  rr(ctx, x - 12, y - 2, 24, 18, 6)
  ctx.fill()
  // hoofd
  ctx.fillStyle = '#FFE0B8'
  ctx.beginPath()
  ctx.arc(x, y - 6, PLAYER_HALF, 0, Math.PI * 2)
  ctx.fill()
  // pet in de kleur van het gekozen poppetje
  ctx.fillStyle = skin.capColor
  ctx.beginPath()
  ctx.arc(x, y - 9, PLAYER_HALF, Math.PI, 0)
  ctx.fill()
  ctx.fillRect(x - PLAYER_HALF - 3, y - 9, (PLAYER_HALF + 3) * 2, 4)
  // oogjes
  ctx.fillStyle = '#1B2A33'
  ctx.beginPath()
  ctx.arc(x - 5, y - 4, 1.8, 0, Math.PI * 2)
  ctx.arc(x + 5, y - 4, 1.8, 0, Math.PI * 2)
  ctx.fill()
}

function drawIdleHint(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const a = 0.35 + 0.25 * Math.sin(Date.now() / 250)
  ctx.fillStyle = `rgba(255,255,255,${a})`
  ctx.font = '600 14px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('▲ hop door!', width / 2, height - 16)
}
