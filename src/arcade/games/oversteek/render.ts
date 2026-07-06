/**
 * De Oversteek — rendering. Isometrische (2:1 axonometrische) projectie op een
 * verder platte, deterministische engine: de pure wereld blijft plat (x = dwars
 * over het IJ, y = afstand vooruit), maar elke positie loopt door `project()`
 * naar een schuinbekeken schermvlak. Vaste schaal + schuintrek, geen perspectief-
 * verdeling: objecten krimpen niet met afstand, alleen hun plek op het scherm
 * kantelt mee met het isometrische rooster. Zie ook engine.ts (ongewijzigd).
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

// ---- Isometrische projectie --------------------------------------------------
// Vaste 2:1-achtige axonometrie: dieper (verder vooruit) schuift omhoog en
// wordt verticaal gecomprimeerd; zijwaarts (over het IJ) schuift horizontaal
// én sleept een klein stukje mee in de verticale richting (de schuintrek die
// het scherm als een gekanteld vlak laat ogen, niet plat van bovenaf).
const ISO_X_SCALE = 0.88
const ISO_DEPTH_SCALE = 0.6
const ISO_SHEAR = 0.34
const HORIZON_Y = 78 // boven deze lijn is lucht/skyline, eronder het water

interface Proj {
  x: number
  y: number
}
/** u = zijwaartse wereldpositie (0..breedte), d = diepte vooruit (wereld-eenheden). */
function project(u: number, d: number, width: number, ferryY: number): Proj {
  const lat = u - width / 2
  return {
    x: width / 2 + lat * ISO_X_SCALE,
    y: ferryY - d * ISO_DEPTH_SCALE + lat * ISO_SHEAR,
  }
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
/** Verdonkert een hex-kleur (0..1): garandeert genoeg contrast voor het
 *  zijvlak, ook bij een skin waarvan hullDark van zichzelf al licht is
 *  (zoals klassiek wit). */
function darken(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const f = 1 - amount
  const r = Math.round(((n >> 16) & 255) * f)
  const g = Math.round(((n >> 8) & 255) * f)
  const b = Math.round((n & 255) * f)
  return `rgb(${r},${g},${b})`
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

// Sky/water-gradiënten zijn duur om elke frame te maken; cache per maat en per
// dag/nacht-fase (verandert traag). Scheelt allocaties bij 60fps.
interface GradCache {
  key: string
  sky: CanvasGradient
  water: CanvasGradient
}
let gradCache: GradCache | null = null
function getGradients(ctx: CanvasRenderingContext2D, width: number, height: number, nf: number): GradCache {
  const bucket = Math.round(nf * 20)
  const key = `${width}x${height}@${bucket}`
  if (!gradCache || gradCache.key !== key) {
    const skyTop = lerpHex('#4FC3E8', '#0B1E33', nf)
    const skyBot = lerpHex('#1AA0D8', '#123049', nf)
    const sky = ctx.createLinearGradient(0, 0, 0, HORIZON_Y)
    sky.addColorStop(0, skyTop)
    sky.addColorStop(1, skyBot)
    const waterTop = lerpHex('#1AA0D8', '#123049', nf)
    const waterBot = lerpHex('#0A5A80', '#040F1C', nf)
    const water = ctx.createLinearGradient(0, HORIZON_Y, 0, height)
    water.addColorStop(0, waterTop)
    water.addColorStop(1, waterBot)
    gradCache = { key, sky, water }
  }
  return gradCache
}

/** Geprojecteerde schermpositie van de pont (voor FX-deeltjes in de GameModule),
 *  zodat sprankels/tekst precies op de isometrisch getekende pont verschijnen. */
export function ferryScreenPosition(w: OversteekWorld): Proj {
  return project(w.ferry.x, 0, w.width, w.height * FERRY_Y)
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
  const grad = getGradients(ctx, width, height, nf)
  ctx.fillStyle = grad.sky
  ctx.fillRect(0, 0, width, HORIZON_Y)
  ctx.fillStyle = grad.water
  ctx.fillRect(0, HORIZON_Y, width, height - HORIZON_Y)

  // Skyline op de horizon: bestemming, met een trage zwaai voor leven.
  const sway = Math.sin(w.t * 0.05) * 10
  drawSkyline(ctx, towardCentraal ? 'centraal' : 'ndsm', width, sway, nf)

  // Golflijnen op hetzelfde isometrische rooster: elke rij ligt op een vaste
  // diepte en schuift mee met de scroll, met dezelfde schuintrek als de boten.
  ctx.strokeStyle = `rgba(255,255,255,${0.12 - nf * 0.04})`
  ctx.lineWidth = 2
  const rowSpacing = 46
  const rowOffset = scroll % rowSpacing
  for (let depth = -rowOffset; depth < height * 1.6; depth += rowSpacing) {
    const rowY = project(width / 2, depth, width, ferryY).y
    if (rowY < HORIZON_Y - 4 || rowY > height + 10) continue
    const stagger = Math.floor(depth / rowSpacing) % 2 ? 35 : 0
    for (let cx = 12; cx < width; cx += 70) {
      const p = project(cx + stagger, depth, width, ferryY)
      if (p.y < HORIZON_Y - 4) continue
      ctx.beginPath()
      ctx.arc(p.x, p.y, 8, Math.PI * 0.15, Math.PI * 0.85)
      ctx.stroke()
    }
  }
  // Levend water: een paar glinsteringen die traag drijven.
  for (let i = 0; i < 3; i++) {
    const gx = ((w.t * 14 + i * (width / 3)) % (width + 30)) - 15
    const gy = HORIZON_Y + 10 + ((i * 137) % (height - HORIZON_Y - 20))
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
    const depth = o.y - scroll
    const p = project(o.x, depth, width, ferryY)
    if (p.y < HORIZON_Y - 40 || p.y > height + 70) continue
    drawObstacle(ctx, o, p)
  }

  drawFerry(ctx, w, project(w.ferry.x, 0, width, ferryY), skin)

  if (shaken) ctx.restore()

  drawProgress(ctx, width, legProgress(w), towardCentraal)
  drawStats(ctx, w)

  if (!w.started) drawStartHint(ctx, width, ferryY)
}

// ---- Skyline -----------------------------------------------------------------

function drawSkyline(ctx: CanvasRenderingContext2D, kind: 'ndsm' | 'centraal', width: number, sway: number, nf: number) {
  const alpha = 0.4 + nf * 0.18
  ctx.fillStyle = `rgba(6,20,32,${alpha.toFixed(3)})`
  const baseY = HORIZON_Y
  if (kind === 'ndsm') {
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
    const tx = width * 0.72 + sway
    ctx.fillRect(tx - 5, baseY - 58, 10, 58)
    ctx.beginPath()
    ctx.ellipse(tx, baseY - 58, 15, 8, 0, 0, Math.PI * 2)
    ctx.fill()
  } else {
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

// ---- Fake-3D bouwstenen (consistent voor pont + alle obstakels) --------------

/** Contactschaduw op het water, altijd op de geprojecteerde positie. */
function drawGroundShadow(ctx: CanvasRenderingContext2D, x: number, y: number, halfW: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  ctx.beginPath()
  ctx.ellipse(x, y + 4, halfW, 5, 0, 0, Math.PI * 2)
  ctx.fill()
}

/** Donker zijvlak dat onder een bovenvlak "hangt": suggereert hoogte/volume. */
function drawSideFace(ctx: CanvasRenderingContext2D, x: number, topY: number, w: number, h: number, color: string, radius = 4) {
  ctx.fillStyle = color
  rr(ctx, x - w / 2, topY, w, h, radius)
  ctx.fill()
}

// ---- Obstakels -----------------------------------------------------------------

function drawObstacle(ctx: CanvasRenderingContext2D, o: Obstacle, p: { x: number; y: number }) {
  const x = p.x
  const sy = p.y
  drawGroundShadow(ctx, x, sy + o.len / 2, o.w / 2)

  if (o.kind === 'rondvaart') {
    const hullH = 8
    drawSideFace(ctx, x, sy + o.len / 2 - 3, o.w * 0.94, hullH, '#B9AE99', 5)
    ctx.fillStyle = '#F3EFE6'
    rr(ctx, x - o.w / 2, sy - o.len / 2, o.w, o.len, 9)
    ctx.fill()
    ctx.fillStyle = 'rgba(90,120,140,0.65)'
    rr(ctx, x - o.w / 2 + 7, sy - 6, o.w - 14, 11, 3)
    ctx.fill()
  } else if (o.kind === 'taxi') {
    const hullH = 6
    drawSideFace(ctx, x, sy + o.len / 2 - 3, o.w * 0.94, hullH, '#9A7A05', 4)
    ctx.fillStyle = '#F4C20D'
    rr(ctx, x - o.w / 2, sy - o.len / 2, o.w, o.len, 7)
    ctx.fill()
    ctx.fillStyle = '#11181C'
    ctx.fillRect(x - o.w / 2 + 5, sy - 3, o.w - 10, 7)
  } else if (o.kind === 'binnenvaart') {
    // Groot, laag en donker, met een fors zijvlak: bewust imposant en
    // duidelijk "zwaar" zodat het gevaar zich meteen aankondigt.
    const hullH = 14
    drawSideFace(ctx, x, sy + o.len / 2 - 4, o.w * 0.96, hullH, '#161C21', 5)
    ctx.fillStyle = '#3A4650'
    rr(ctx, x - o.w / 2, sy - o.len / 2, o.w, o.len, 6)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    for (let i = 0; i < 3; i++) {
      const bx = x - o.w / 2 + 10 + (i * (o.w - 20)) / 2
      rr(ctx, bx, sy - o.len / 2 + 8, (o.w - 20) / 3, o.len - 20, 2)
      ctx.fill()
    }
    ctx.fillStyle = '#22292F'
    rr(ctx, x + o.w / 2 - 20, sy - o.len / 2, 18, o.len, 4)
    ctx.fill()
  } else {
    // drijfhout: log of container, afwisselend voor variatie. Ligt laag in
    // het water, dus maar een heel dun zijvlakje.
    const isContainer = Math.floor(x + o.y) % 2 === 0
    const hullH = 3
    if (isContainer) {
      drawSideFace(ctx, x, sy + o.len / 2 - 2, o.w * 0.9, hullH, '#4A5457', 2)
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
      drawSideFace(ctx, x, sy + o.len / 2 - 5, o.w * 0.85, hullH, '#5C3D22', 2)
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

/** Plat, hoekig en dubbelzijdig: witte romp, donkere bieslijn, klein
 *  middenstuurhuis, open dek met railing. Herkenbaar als GVB-pont, geen
 *  puntige boeg zoals een gewone speedboot. */
function drawFerry(ctx: CanvasRenderingContext2D, w: OversteekWorld, p: { x: number; y: number }, skin: FerrySkin) {
  const x = p.x
  const y = p.y
  const halfW = FERRY_HALF
  const len = FERRY_LEN

  // Kielzog: twee lichte strepen die achter de pont wegwaaien.
  if (w.started) {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'
    ctx.lineWidth = 3
    const o = w.scroll % 22
    for (let i = 0; i < 3; i++) {
      const yy = y + len / 2 + 6 + i * 22 + o
      ctx.globalAlpha = 0.5 - i * 0.15
      ctx.beginPath()
      ctx.moveTo(x - 9, yy)
      ctx.lineTo(x - 15, yy + 13)
      ctx.moveTo(x + 9, yy)
      ctx.lineTo(x + 15, yy + 13)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  drawGroundShadow(ctx, x, y + len / 2, halfW)

  // Zijvlak (hoge, rechte scheepswand): geeft de pont zichtbaar volume. Altijd
  // voldoende donker t.o.v. de romp, ook bij een skin met een lichte hullDark
  // (klassiek wit) — anders valt het dieptesignaal weg.
  const hullH = 11
  drawSideFace(ctx, x, y + len / 2 - 4, halfW * 2 * 0.97, hullH, darken(skin.hullDark, 0.35), 5)

  // Bovenvlak: bewust vlak en hoekig, dezelfde stompe vorm aan beide kanten
  // (geen boeg/achtersteven) — precies zoals een echte GVB-pont vaart.
  ctx.fillStyle = skin.hull
  rr(ctx, x - halfW, y - len / 2, halfW * 2, len, 5)
  ctx.fill()

  // Bieslijn: een donkere/blauwe accentstreep rond de rand van het dek.
  ctx.strokeStyle = skin.hullDark
  ctx.lineWidth = 3
  rr(ctx, x - halfW + 2, y - len / 2 + 2, halfW * 2 - 4, len - 4, 4)
  ctx.stroke()

  // Simpele railing: dunne lijnen langs de twee lange dekranden.
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(x - halfW + 4, y - len / 2 + 8)
  ctx.lineTo(x - halfW + 4, y + len / 2 - 8)
  ctx.moveTo(x + halfW - 4, y - len / 2 + 8)
  ctx.lineTo(x + halfW - 4, y + len / 2 - 8)
  ctx.stroke()

  // Klein middenstuurhuis (niet aan een van de uiteinden, zoals een echte
  // dubbelzijdige pont die niet hoeft te keren).
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  rr(ctx, x - 14, y - 10, 28, 20, 4)
  ctx.fill()
  ctx.fillStyle = skin.deck
  ctx.font = '700 10px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('GVB', x, y + 2)

  // Passagiers aan dek: kleine, herkenbare badges boven het stuurhuis.
  const n = w.passengers.length
  if (n > 0) {
    const spread = Math.min(64, 16 * n)
    w.passengers.forEach((pgr, i) => {
      const px = x - spread / 2 + (spread / (n || 1)) * (i + 0.5)
      const py = y - len / 2 - 16
      if (pgr.lost) return
      const frac = pgr.mood === 'ongeduldig' ? Math.max(0, pgr.patience / pgr.maxPatience) : 1
      const alarmed = pgr.mood === 'ongeduldig' && frac < 0.35
      const ringColor = pgr.mood === 'blij' ? '#8FE9C0' : alarmed ? '#FF6B6B' : '#FFD24A'
      if (pgr.mood === 'ongeduldig') {
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
      ctx.fillText(PASSENGER_EMOJI[pgr.type], px, py + 3)
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
