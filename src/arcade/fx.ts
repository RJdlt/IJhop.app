/**
 * Gedeelde "juice"-laag voor de arcade: deeltjes, zwevende tekst en schermschud.
 * Puur visueel en volledig los van de deterministische engines (draait alleen in
 * de browser via de GameModule), dus hier mag Math.random. Alle coördinaten zijn
 * schermcoördinaten. Gebruikt door zowel Pont Hop als Vaar de Pont.
 */

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  size: number
  color: string
  gravity: number
}

interface FloatText {
  x: number
  y: number
  vy: number
  life: number
  max: number
  text: string
  color: string
  size: number
}

export class Fx {
  private parts: Particle[] = []
  private texts: FloatText[] = []
  private shake = 0
  // Eenvoudige, deterministisch-genoeg pseudo-jitter voor de schud-offset.
  private tphase = 0

  /** Stroopwafel opgepakt: gouden sprankels + zwevende "+score", combo kleurt op. */
  coinBurst(x: number, y: number, combo: number): void {
    const n = 8 + Math.min(combo, 6) * 2
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const sp = 40 + Math.random() * 120
      this.parts.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 40,
        life: 0.5 + Math.random() * 0.3,
        max: 0.8,
        size: 2 + Math.random() * 2.5,
        color: combo >= 3 ? '#FFD24A' : '#F2B24A',
        gravity: 320,
      })
    }
    this.addShake(2.5)
  }

  /** Zwevende tekst (bijv. "+3 🧇" of "Combo x3!"). */
  popText(x: number, y: number, text: string, color = '#FFE9A8', size = 18): void {
    this.texts.push({ x, y, vy: -46, life: 1, max: 1, text, color, size })
  }

  /** Overtocht gehaald: groene confetti-sprankels omhoog. */
  crossingBurst(x: number, y: number): void {
    const colors = ['#3FD68C', '#FFD24A', '#7FE1FF', '#FF9EC4']
    for (let i = 0; i < 22; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.5
      const sp = 120 + Math.random() * 200
      this.parts.push({
        x: x + (Math.random() - 0.5) * 40,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.7 + Math.random() * 0.5,
        max: 1.2,
        size: 2.5 + Math.random() * 3,
        color: colors[i % colors.length],
        gravity: 380,
      })
    }
    this.addShake(3)
  }

  /** Kopje onder: plons van blauwwitte druppels + stevige schud. */
  splash(x: number, y: number): void {
    for (let i = 0; i < 26; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2
      const sp = 60 + Math.random() * 220
      this.parts.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 40,
        life: 0.6 + Math.random() * 0.5,
        max: 1.1,
        size: 2 + Math.random() * 3,
        color: Math.random() < 0.5 ? '#CFEFFB' : '#7FC7EC',
        gravity: 520,
      })
    }
    this.addShake(9)
  }

  addShake(amount: number): void {
    this.shake = Math.min(14, Math.max(this.shake, amount))
  }

  update(dt: number): void {
    const d = Math.min(dt, 0.05)
    this.tphase += d
    this.shake = Math.max(0, this.shake - d * 26)
    for (const p of this.parts) {
      p.life -= d
      p.vy += p.gravity * d
      p.x += p.vx * d
      p.y += p.vy * d
    }
    this.parts = this.parts.filter((p) => p.life > 0)
    for (const tx of this.texts) {
      tx.life -= d * 1.1
      tx.y += tx.vy * d
      tx.vy += 26 * d // beetje afremmen
    }
    this.texts = this.texts.filter((t) => t.life > 0)
  }

  /** Schud-offset (px). Vervalt vanzelf; nul als er niets speelt. */
  shakeOffset(): { x: number; y: number } {
    if (this.shake <= 0) return { x: 0, y: 0 }
    const s = this.shake
    return {
      x: Math.sin(this.tphase * 91) * s,
      y: Math.cos(this.tphase * 73) * s * 0.8,
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.parts) {
      const a = Math.max(0, Math.min(1, p.life / p.max))
      ctx.globalAlpha = a
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    ctx.textAlign = 'center'
    for (const tx of this.texts) {
      const a = Math.max(0, Math.min(1, tx.life / tx.max))
      ctx.globalAlpha = a
      ctx.font = `800 ${tx.size}px system-ui, sans-serif`
      ctx.lineWidth = 3
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'
      ctx.strokeText(tx.text, tx.x, tx.y)
      ctx.fillStyle = tx.color
      ctx.fillText(tx.text, tx.x, tx.y)
    }
    ctx.globalAlpha = 1
  }

  clear(): void {
    this.parts = []
    this.texts = []
    this.shake = 0
  }
}
