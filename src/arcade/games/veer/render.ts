/**
 * Vaar de Pont — rendering. Tekent het IJ (mee met de echte tijd), de boten, de
 * GVB-pont met kielzog, en de voortgangsbalk naar Centraal.
 */
import { FERRY_HALF, FERRY_LEN, FERRY_Y, progressFraction } from './engine'
import type { Boat, Item, VeerWorld } from './engine'

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

export function renderVeer(
  ctx: CanvasRenderingContext2D,
  w: VeerWorld,
  shake?: { x: number; y: number },
): void {
  const { width, height, scroll } = w
  const ferryY = height * FERRY_Y
  const d = new Date()
  const nf = nightFactor(d.getHours() + d.getMinutes() / 60)

  ctx.clearRect(0, 0, width, height)
  const top = lerpHex('#1AA0D8', '#123049', nf)
  const bot = lerpHex('#0E6E9B', '#06182B', nf)
  const wg = ctx.createLinearGradient(0, 0, 0, height)
  wg.addColorStop(0, top)
  wg.addColorStop(1, bot)
  ctx.fillStyle = wg
  ctx.fillRect(0, 0, width, height)

  // Golflijnen die met de vaart mee naar beneden schuiven (gevoel van snelheid).
  ctx.strokeStyle = `rgba(255,255,255,${0.10 - nf * 0.04})`
  ctx.lineWidth = 2
  const off = scroll % 40
  for (let y = -40 + off; y < height; y += 40) {
    for (let x = 12; x < width; x += 70) {
      ctx.beginPath()
      ctx.arc(x + (Math.floor(y / 40) % 2 ? 35 : 0), y, 8, Math.PI * 0.15, Math.PI * 0.85)
      ctx.stroke()
    }
  }

  // Bewegende laag (boten, items, pont) schudt mee bij een klap; de water-basis
  // en de HUD blijven staan zodat er geen lege randen ontstaan.
  const shaken = shake && (shake.x !== 0 || shake.y !== 0)
  if (shaken) {
    ctx.save()
    ctx.translate(shake!.x, shake!.y)
  }

  // Boten.
  for (const b of w.boats) {
    const sy = ferryY - (b.y - scroll)
    if (sy < -60 || sy > height + 60) continue
    drawBoat(ctx, b, sy)
  }

  // Stroopwafels en schilden om op te pikken.
  for (const it of w.items) {
    if (it.taken) continue
    const sy = ferryY - (it.y - scroll)
    if (sy < -40 || sy > height + 40) continue
    drawItem(ctx, it, sy)
  }

  // De pont met kielzog (plus schild-aura als er een schild actief is).
  drawFerry(ctx, w.ferry.x, ferryY, w.started ? scroll : 0, w.shield > 0)

  if (shaken) ctx.restore()

  // Voortgangsbalk naar Centraal + tellers.
  drawProgress(ctx, width, progressFraction(w))
  drawStats(ctx, w.coins, w.shield)

  // Startuitleg zolang je nog niet gestuurd hebt (de pont ligt dan stil).
  if (!w.started) drawStartHint(ctx, width, ferryY)
}

function drawItem(ctx: CanvasRenderingContext2D, it: Item, sy: number) {
  const x = it.x
  if (it.kind === 'coin') {
    // stroopwafel met warme glans
    const g = ctx.createRadialGradient(x - 3, sy - 3, 2, x, sy, it.r)
    g.addColorStop(0, '#F2B24A')
    g.addColorStop(1, '#D98A1E')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, sy, it.r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#A8650F'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.strokeStyle = 'rgba(120,70,10,0.35)'
    ctx.lineWidth = 1
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath()
      ctx.moveTo(x - it.r + 3, sy + i * 4)
      ctx.lineTo(x + it.r - 3, sy + i * 4)
      ctx.moveTo(x + i * 4, sy - it.r + 3)
      ctx.lineTo(x + i * 4, sy + it.r - 3)
      ctx.stroke()
    }
  } else {
    // reddingsboei (schild): rood-wit met ring
    ctx.fillStyle = '#E2231A'
    ctx.beginPath()
    ctx.arc(x, sy, it.r, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(x, sy, it.r * 0.55, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#E2231A'
    ctx.beginPath()
    ctx.arc(x, sy, it.r * 0.32, 0, Math.PI * 2)
    ctx.fill()
    // vier witte streepjes op de ring
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 3
    for (let a = 0; a < 4; a++) {
      const ang = (a * Math.PI) / 2 + Math.PI / 4
      ctx.beginPath()
      ctx.moveTo(x + Math.cos(ang) * it.r * 0.55, sy + Math.sin(ang) * it.r * 0.55)
      ctx.lineTo(x + Math.cos(ang) * it.r, sy + Math.sin(ang) * it.r)
      ctx.stroke()
    }
  }
}

function drawStats(ctx: CanvasRenderingContext2D, coins: number, shield: number) {
  ctx.font = '700 13px system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  rr(ctx, 12, 44, shield > 0 ? 128 : 74, 24, 12)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.fillText(`🧇 ${coins}`, 22, 61)
  if (shield > 0) ctx.fillText(`🛟 ${shield}`, 80, 61)
}

function drawStartHint(ctx: CanvasRenderingContext2D, width: number, ferryY: number) {
  const cx = width / 2
  const y = ferryY - 70
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  const bw = 214
  rr(ctx, cx - bw / 2, y - 22, bw, 44, 22)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.font = '700 14px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('Veeg om te sturen', cx, y + 5)
  // pijltjes links/rechts
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.font = '700 16px system-ui, sans-serif'
  ctx.fillText('◀', cx - bw / 2 + 16, y + 6)
  ctx.fillText('▶', cx + bw / 2 - 16, y + 6)
}

function drawBoat(ctx: CanvasRenderingContext2D, b: Boat, sy: number) {
  const x = b.x
  // schaduw/kielzog-schijnsel
  ctx.fillStyle = 'rgba(0,0,0,0.15)'
  ctx.beginPath()
  ctx.ellipse(x, sy + b.len / 2, b.w / 2, 5, 0, 0, Math.PI * 2)
  ctx.fill()
  if (b.kind === 'rondvaart') {
    ctx.fillStyle = '#F3EFE6'
    rr(ctx, x - b.w / 2, sy - b.len / 2, b.w, b.len, 9)
    ctx.fill()
    ctx.fillStyle = 'rgba(90,120,140,0.6)'
    rr(ctx, x - b.w / 2 + 6, sy - 5, b.w - 12, 10, 3)
    ctx.fill()
  } else if (b.kind === 'taxi') {
    ctx.fillStyle = '#F4C20D'
    rr(ctx, x - b.w / 2, sy - b.len / 2, b.w, b.len, 7)
    ctx.fill()
    ctx.fillStyle = '#11181C'
    ctx.fillRect(x - 6, sy - 3, 12, 6)
  } else if (b.kind === 'sup') {
    ctx.fillStyle = '#C98A3B'
    ctx.beginPath()
    ctx.ellipse(x, sy, b.w / 2, b.len / 2, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#15616D'
    ctx.beginPath()
    ctx.arc(x, sy, 4, 0, Math.PI * 2)
    ctx.fill()
  } else {
    // boei
    ctx.fillStyle = '#E2231A'
    ctx.beginPath()
    ctx.arc(x, sy, b.w / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.fillRect(x - b.w / 2, sy - 2, b.w, 4)
  }
}

function drawFerry(ctx: CanvasRenderingContext2D, x: number, y: number, scroll: number, shielded: boolean) {
  // Schild-aura: een zachte blauwe ring rond de pont zolang er een schild is.
  if (shielded) {
    const pulse = 0.5 + 0.35 * Math.sin(scroll / 14)
    ctx.strokeStyle = `rgba(127,199,236,${(0.45 + pulse * 0.4).toFixed(3)})`
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.ellipse(x, y, FERRY_HALF + 10, FERRY_LEN / 2 + 12, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  // kielzog: twee lichte strepen die naar beneden bewegen
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'
  ctx.lineWidth = 3
  const o = scroll % 22
  for (let i = 0; i < 3; i++) {
    const yy = y + FERRY_LEN / 2 + 6 + i * 22 + o
    ctx.globalAlpha = 0.5 - i * 0.15
    ctx.beginPath()
    ctx.moveTo(x - 7, yy)
    ctx.lineTo(x - 12, yy + 12)
    ctx.moveTo(x + 7, yy)
    ctx.lineTo(x + 12, yy + 12)
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  // schaduw
  ctx.fillStyle = 'rgba(0,0,0,0.2)'
  ctx.beginPath()
  ctx.ellipse(x, y + FERRY_LEN / 2, FERRY_HALF, 6, 0, 0, Math.PI * 2)
  ctx.fill()
  // romp (GVB-blauw), neus naar boven
  ctx.fillStyle = '#009DE0'
  ctx.beginPath()
  ctx.moveTo(x, y - FERRY_LEN / 2 - 6)
  ctx.lineTo(x + FERRY_HALF, y - FERRY_LEN / 2 + 6)
  ctx.lineTo(x + FERRY_HALF, y + FERRY_LEN / 2)
  ctx.lineTo(x - FERRY_HALF, y + FERRY_LEN / 2)
  ctx.lineTo(x - FERRY_HALF, y - FERRY_LEN / 2 + 6)
  ctx.closePath()
  ctx.fill()
  // dek/cabine
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  rr(ctx, x - 12, y - 8, 24, 18, 4)
  ctx.fill()
  ctx.fillStyle = '#009DE0'
  ctx.font = '700 10px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('GVB', x, y + 4)
}

function drawProgress(ctx: CanvasRenderingContext2D, width: number, frac: number) {
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
  ctx.fillText('NDSM', pad, y + 22)
  ctx.textAlign = 'right'
  ctx.fillText('Centraal 🏙️', width - pad, y + 22)
}
