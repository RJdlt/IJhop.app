/**
 * De Oversteek — rendering. Tekent het IJ (met de echte tijd mee), de
 * Amsterdam-skyline als parallax-silhouet, de boten, de GVB-pont met
 * passagiers aan dek, en de voortgangsbalk voor de huidige oversteek.
 */
import { FERRY_HALF, FERRY_LEN, FERRY_Y, legProgress } from './engine'
import type { Obstacle, OversteekWorld, Passenger } from './engine'
import type { FerrySkin } from './skins'

const PASSENGER_EMOJI: Record<Passenger['type'], string> = {
  toerist: '📸',
  forens: '💼',
  fietser: '🚲',
  festivalganger: '🎉',
  bezorger: '📦',
}

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
function lerpHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16)
  const pb = parseInt(b.slice(1), 16)
  const r = Math.round(((pa >> 16) & 255) + (((pb >> 16) & 255) - ((pa >> 16) & 255)) * t)
  const g = Math.round(((pa >> 8) & 255) + (((pb >> 8) & 255) - ((pa >> 8) & 255)) * t)
  const bl = Math.round((pa & 255) + ((pb & 255) - (pa & 255)) * t)
  return `rgb(${r},${g},${bl})`
}
function nightFactor(hour: number): number {
  if (hour < 5 || hour >= 22) return 1
  if (hour < 8) return (8 - hour) / 3
  if (hour >= 19) return Math.min(1, (hour - 19) / 3)
  return 0
}

export function renderOversteek(
  ctx: CanvasRenderingContext2D,
  w: OversteekWorld,
  skin: FerrySkin,
  shake?: { x: number; y: number },
): void {
  const { width, height, scroll } = w
  const ferryY = height * FERRY_Y
  const d = new Date()
  const nf = nightFactor(d.getHours() + d.getMinutes() / 60)
  // Even -> op weg naar Centraal (skyline vooruit); oneven -> terug naar NDSM.
  const towardCentraal = w.legIndex % 2 === 0

  ctx.clearRect(0, 0, width, height)
  const top = lerpHex('#1AA0D8', '#123049', nf)
  const bot = lerpHex('#0E6E9B', '#06182B', nf)
  const wg = ctx.createLinearGradient(0, 0, 0, height)
  wg.addColorStop(0, top)
  wg.addColorStop(1, bot)
  ctx.fillStyle = wg
  ctx.fillRect(0, 0, width, height)

  // Skyline-parallax: bestemming vaag bovenin, met een trage zwaai voor leven.
  const sway = Math.sin(w.t * 0.05) * 10
  drawSkyline(ctx, towardCentraal ? 'centraal' : 'ndsm', width, sway, nf)

  // Golflijnen die met de vaart mee schuiven (gevoel van snelheid).
  ctx.strokeStyle = `rgba(255,255,255,${0.1 - nf * 0.04})`
  ctx.lineWidth = 2
  const off = scroll % 40
  for (let y = 60 - 40 + off; y < height; y += 40) {
    for (let x = 12; x < width; x += 70) {
      ctx.beginPath()
      ctx.arc(x + (Math.floor(y / 40) % 2 ? 35 : 0), y, 8, Math.PI * 0.15, Math.PI * 0.85)
      ctx.stroke()
    }
  }
  // Levend water: een paar glinsteringen die traag drijven.
  for (let i = 0; i < 3; i++) {
    const gx = ((w.t * 14 + i * (width / 3)) % (width + 30)) - 15
    const gy = 70 + ((i * 137) % (height - 140))
    const tw = 0.5 + 0.5 * Math.sin(w.t * 2.1 + i * 2)
    ctx.fillStyle = `rgba(255,255,255,${(0.05 + tw * 0.1).toFixed(3)})`
    ctx.beginPath()
    ctx.ellipse(gx, gy, 7, 1.8, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  const shaken = shake && (shake.x !== 0 || shake.y !== 0)
  if (shaken) {
    ctx.save()
    ctx.translate(shake!.x, shake!.y)
  }

  for (const o of w.obstacles) {
    const sy = ferryY - (o.y - scroll)
    if (sy < -70 || sy > height + 70) continue
    drawObstacle(ctx, o, sy)
  }

  drawFerry(ctx, w, ferryY, skin)

  if (shaken) ctx.restore()

  drawProgress(ctx, width, legProgress(w), towardCentraal)
  drawStats(ctx, w)

  if (!w.started) drawStartHint(ctx, width, ferryY)
}

// ---- Skyline -----------------------------------------------------------------

function drawSkyline(ctx: CanvasRenderingContext2D, kind: 'ndsm' | 'centraal', width: number, sway: number, nf: number) {
  const alpha = 0.32 + nf * 0.18
  ctx.fillStyle = `rgba(6,20,32,${alpha.toFixed(3)})`
  const baseY = 54
  if (kind === 'ndsm') {
    // Twee kranen.
    for (let i = 0; i < 2; i++) {
      const cx = width * (0.22 + i * 0.4) + sway
      ctx.fillRect(cx - 3, baseY - 46, 6, 46)
      ctx.fillRect(cx - 30, baseY - 46, 60, 6)
      ctx.beginPath()
      ctx.moveTo(cx - 3, baseY - 40)
      ctx.lineTo(cx - 28, baseY - 42)
      ctx.moveTo(cx + 3, baseY - 40)
      ctx.lineTo(cx + 28, baseY - 42)
      ctx.strokeStyle = ctx.fillStyle
      ctx.lineWidth = 2
      ctx.stroke()
    }
    // A'DAM Toren: mast + rond uitkijkplatform.
    const tx = width * 0.72 + sway
    ctx.fillRect(tx - 5, baseY - 58, 10, 58)
    ctx.beginPath()
    ctx.ellipse(tx, baseY - 58, 15, 8, 0, 0, Math.PI * 2)
    ctx.fill()
  } else {
    // Rij gevels met puntdaken.
    const n = 6
    for (let i = 0; i < n; i++) {
      const gx = (width / n) * i + sway * 0.6
      const gw = width / n - 4
      const gh = 20 + (i % 3) * 6
      ctx.fillRect(gx, baseY - gh, gw, gh)
      ctx.beginPath()
      ctx.moveTo(gx, baseY - gh)
      ctx.lineTo(gx + gw / 2, baseY - gh - 10)
      ctx.lineTo(gx + gw, baseY - gh)
      ctx.closePath()
      ctx.fill()
    }
    // Centraal-torentje in het midden.
    const tx = width * 0.5 + sway
    ctx.fillRect(tx - 8, baseY - 50, 16, 50)
    ctx.beginPath()
    ctx.moveTo(tx - 9, baseY - 50)
    ctx.lineTo(tx, baseY - 64)
    ctx.lineTo(tx + 9, baseY - 50)
    ctx.closePath()
    ctx.fill()
  }
}

// ---- Obstakels -----------------------------------------------------------------

function drawObstacle(ctx: CanvasRenderingContext2D, o: Obstacle, sy: number) {
  const x = o.x
  ctx.fillStyle = 'rgba(0,0,0,0.16)'
  ctx.beginPath()
  ctx.ellipse(x, sy + o.len / 2 - 2, o.w / 2, 5, 0, 0, Math.PI * 2)
  ctx.fill()

  if (o.kind === 'rondvaart') {
    ctx.fillStyle = '#F3EFE6'
    rr(ctx, x - o.w / 2, sy - o.len / 2, o.w, o.len, 9)
    ctx.fill()
    ctx.fillStyle = 'rgba(90,120,140,0.65)'
    rr(ctx, x - o.w / 2 + 7, sy - 6, o.w - 14, 11, 3)
    ctx.fill()
  } else if (o.kind === 'taxi') {
    ctx.fillStyle = '#F4C20D'
    rr(ctx, x - o.w / 2, sy - o.len / 2, o.w, o.len, 7)
    ctx.fill()
    ctx.fillStyle = '#11181C'
    ctx.fillRect(x - o.w / 2 + 5, sy - 3, o.w - 10, 7)
  } else if (o.kind === 'binnenvaart') {
    // Groot, laag en donker: bewust imposant zodat het gevaar herkenbaar is.
    ctx.fillStyle = '#3A4650'
    rr(ctx, x - o.w / 2, sy - o.len / 2, o.w, o.len, 6)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    for (let i = 0; i < 3; i++) {
      const bx = x - o.w / 2 + 10 + i * (o.w - 20) / 2
      rr(ctx, bx, sy - o.len / 2 + 8, (o.w - 20) / 3, o.len - 20, 2)
      ctx.fill()
    }
    ctx.fillStyle = '#22292F'
    rr(ctx, x + o.w / 2 - 20, sy - o.len / 2, 18, o.len, 4)
    ctx.fill()
  } else {
    // drijfhout: log of container, afwisselend voor variatie.
    const isContainer = Math.floor(x + o.y) % 2 === 0
    if (isContainer) {
      ctx.fillStyle = '#7A8B8F'
      rr(ctx, x - o.w / 2, sy - o.len / 2, o.w, o.len, 3)
      ctx.fill()
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'
      ctx.lineWidth = 1.5
      for (let i = 1; i < 3; i++) {
        ctx.beginPath()
        ctx.moveTo(x - o.w / 2, sy - o.len / 2 + (o.len / 3) * i)
        ctx.lineTo(x + o.w / 2, sy - o.len / 2 + (o.len / 3) * i)
        ctx.stroke()
      }
    } else {
      ctx.fillStyle = '#8A5A34'
      ctx.beginPath()
      ctx.ellipse(x, sy, o.w / 2, o.len / 2, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.ellipse(x, sy, o.w / 2 - 3, o.len / 2 - 3, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
}

// ---- Pont + passagiers ---------------------------------------------------------

function drawFerry(ctx: CanvasRenderingContext2D, w: OversteekWorld, y: number, skin: FerrySkin) {
  const x = w.ferry.x

  // Kielzog: twee lichte strepen die naar beneden bewegen, sneller bij hogere vaart.
  if (w.started) {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'
    ctx.lineWidth = 3
    const o = w.scroll % 22
    for (let i = 0; i < 3; i++) {
      const yy = y + FERRY_LEN / 2 + 6 + i * 22 + o
      ctx.globalAlpha = 0.5 - i * 0.15
      ctx.beginPath()
      ctx.moveTo(x - 8, yy)
      ctx.lineTo(x - 14, yy + 13)
      ctx.moveTo(x + 8, yy)
      ctx.lineTo(x + 14, yy + 13)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  // Schaduw.
  ctx.fillStyle = 'rgba(0,0,0,0.2)'
  ctx.beginPath()
  ctx.ellipse(x, y + FERRY_LEN / 2, FERRY_HALF, 6, 0, 0, Math.PI * 2)
  ctx.fill()

  // Romp, neus naar boven.
  ctx.fillStyle = skin.hull
  ctx.beginPath()
  ctx.moveTo(x, y - FERRY_LEN / 2 - 7)
  ctx.lineTo(x + FERRY_HALF, y - FERRY_LEN / 2 + 7)
  ctx.lineTo(x + FERRY_HALF, y + FERRY_LEN / 2)
  ctx.lineTo(x - FERRY_HALF, y + FERRY_LEN / 2)
  ctx.lineTo(x - FERRY_HALF, y - FERRY_LEN / 2 + 7)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = skin.hullDark
  ctx.lineWidth = 2
  ctx.stroke()

  // Dek/cabine.
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  rr(ctx, x - 14, y - 6, 28, 20, 4)
  ctx.fill()
  ctx.fillStyle = skin.deck
  ctx.font = '700 10px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('GVB', x, y + 6)

  // Passagiers aan dek: kleine, herkenbare badges boven de cabine.
  const n = w.passengers.length
  if (n > 0) {
    const spread = Math.min(64, 16 * n)
    w.passengers.forEach((p, i) => {
      const px = x - spread / 2 + (spread / (n || 1)) * (i + 0.5)
      const py = y - FERRY_LEN / 2 - 14
      if (p.lost) return
      const frac = p.mood === 'ongeduldig' ? Math.max(0, p.patience / p.maxPatience) : 1
      const alarmed = p.mood === 'ongeduldig' && frac < 0.35
      const ringColor = p.mood === 'blij' ? '#8FE9C0' : alarmed ? '#FF6B6B' : '#FFD24A'
      if (p.mood === 'ongeduldig') {
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'
        ctx.lineWidth = 2.4
        ctx.beginPath()
        ctx.arc(px, py, 9, 0, Math.PI * 2)
        ctx.stroke()
        ctx.strokeStyle = ringColor
        ctx.beginPath()
        ctx.arc(px, py, 9, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2)
        ctx.stroke()
      }
      ctx.fillStyle = 'rgba(10,20,25,0.55)'
      ctx.beginPath()
      ctx.arc(px, py, 7, 0, Math.PI * 2)
      ctx.fill()
      ctx.font = '9px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(PASSENGER_EMOJI[p.type], px, py + 3)
    })
  }
}

// ---- HUD -------------------------------------------------------------------

function drawProgress(ctx: CanvasRenderingContext2D, width: number, frac: number, towardCentraal: boolean) {
  const pad = 16
  const y = 14
  const w = width - pad * 2
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  rr(ctx, pad, y, w, 8, 4)
  ctx.fill()
  ctx.fillStyle = '#1D9E75'
  rr(ctx, pad, y, Math.max(6, w * frac), 8, 4)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.font = '600 11px system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(towardCentraal ? 'NDSM' : 'Centraal', pad, y + 22)
  ctx.textAlign = 'right'
  ctx.fillText(towardCentraal ? 'Centraal 🏙️' : 'NDSM ⚓', width - pad, y + 22)
}

function drawStats(ctx: CanvasRenderingContext2D, w: OversteekWorld) {
  const mult = w.streak >= 10 ? 5 : w.streak >= 5 ? 2 : 1
  if (mult <= 1) return
  ctx.font = '700 13px system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(255,209,74,0.9)'
  rr(ctx, 12, 44, 74, 24, 12)
  ctx.fill()
  ctx.fillStyle = '#2A1B00'
  ctx.fillText(`🔥 x${mult}`, 22, 61)
}

function drawStartHint(ctx: CanvasRenderingContext2D, width: number, ferryY: number) {
  const cx = width / 2
  const y = ferryY - 74
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  const bw = 240
  rr(ctx, cx - bw / 2, y - 22, bw, 44, 22)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.font = '700 13px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('Houd vast en sleep om te sturen', cx, y + 5)
}
