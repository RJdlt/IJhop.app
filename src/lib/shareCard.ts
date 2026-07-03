/**
 * Deelbaar score-kaartje: tekent een vierkante afbeelding (canvas) met score,
 * spel en IJhop-branding en deelt die via de Web Share API. Zonder share-
 * ondersteuning valt het terug op downloaden. Gratis marketing door spelers.
 */

export interface ShareCardOpts {
  score: number
  gameTitle: string
  emoji: string
  /** Bijv. "Record!" of een streak; optioneel regeltje onder de score. */
  subline?: string
}

const W = 1080
const H = 1080

function draw(ctx: CanvasRenderingContext2D, o: ShareCardOpts): void {
  // Achtergrond: dezelfde diepe arcade-gradient als in de app.
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#0c6b52')
  g.addColorStop(0.45, '#063f30')
  g.addColorStop(1, '#02140f')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // Zachte gloed bovenin.
  const glow = ctx.createRadialGradient(W / 2, -100, 80, W / 2, -100, 700)
  glow.addColorStop(0, 'rgba(29,158,117,0.55)')
  glow.addColorStop(1, 'rgba(29,158,117,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  // Golflijnen onderin (waterthema).
  ctx.strokeStyle = 'rgba(255,255,255,0.10)'
  ctx.lineWidth = 5
  for (let row = 0; row < 3; row++) {
    const y = H - 150 + row * 42
    ctx.beginPath()
    for (let x = -20; x < W + 20; x += 90) {
      ctx.arc(x + (row % 2 ? 45 : 0), y, 26, Math.PI * 0.15, Math.PI * 0.85)
    }
    ctx.stroke()
  }

  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.font = '700 44px system-ui, sans-serif'
  ctx.fillText('🕹️ IJHOP ARCADE', W / 2, 130)

  ctx.font = '120px system-ui, sans-serif'
  ctx.fillText(o.emoji, W / 2, 320)

  ctx.fillStyle = '#fff'
  ctx.font = '800 64px system-ui, sans-serif'
  ctx.fillText(o.gameTitle, W / 2, 425)

  // De score, groot en met een zachte groene gloed.
  ctx.save()
  ctx.shadowColor = 'rgba(29,158,117,0.8)'
  ctx.shadowBlur = 60
  ctx.fillStyle = '#EFFFF7'
  ctx.font = '900 300px system-ui, sans-serif'
  ctx.fillText(String(o.score), W / 2, 730)
  ctx.restore()

  ctx.fillStyle = 'rgba(255,255,255,0.65)'
  ctx.font = '600 44px system-ui, sans-serif'
  ctx.fillText(o.subline ?? 'punten', W / 2, 800)

  // Call-to-action / branding.
  ctx.fillStyle = '#7CE8BE'
  ctx.font = '800 52px system-ui, sans-serif'
  ctx.fillText('Speel mee op ijhop.app', W / 2, 950)
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}

/** Deel (of download) het score-kaartje. Retourneert hoe het afliep. */
export async function shareScoreCard(o: ShareCardOpts): Promise<'shared' | 'downloaded' | 'error'> {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) return 'error'
    draw(ctx, o)
    const blob = await toBlob(canvas)
    if (!blob) return 'error'

    const file = new File([blob], 'ijhop-score.png', { type: 'image/png' })
    const shareData = {
      files: [file],
      title: 'IJhop Arcade',
      text: `Ik haalde ${o.score} punten in ${o.gameTitle} op ijhop.app 🛥️`,
    }
    if (typeof navigator.canShare === 'function' && navigator.canShare(shareData)) {
      await navigator.share(shareData)
      return 'shared'
    }
    // Fallback: downloaden.
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'ijhop-score.png'
    a.click()
    URL.revokeObjectURL(url)
    return 'downloaded'
  } catch (e) {
    // Gebruiker die het share-menu sluit is geen fout.
    if (e instanceof DOMException && e.name === 'AbortError') return 'shared'
    return 'error'
  }
}
