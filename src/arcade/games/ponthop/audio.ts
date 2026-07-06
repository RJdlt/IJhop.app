/**
 * Minimale WebAudio-geluidjes (hop/plons/munt). Geen assets nodig; alles
 * gesynthetiseerd. Standaard uit — speelt alleen als de speler dempen uitzet.
 */
export class Sfx {
  private ctx: AudioContext | null = null
  private muted = true

  setMuted(muted: boolean): void {
    this.muted = muted
  }

  private ac(): AudioContext | null {
    if (this.muted) return null
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      this.ctx = new Ctor()
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  private blip(freq: number, dur: number, type: OscillatorType, gain = 0.06): void {
    const ac = this.ac()
    if (!ac) return
    const osc = ac.createOscillator()
    const g = ac.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, ac.currentTime)
    g.gain.setValueAtTime(gain, ac.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur)
    osc.connect(g).connect(ac.destination)
    osc.start()
    osc.stop(ac.currentTime + dur)
  }

  hop(): void {
    this.blip(420, 0.09, 'square', 0.04)
    this.buzz(10)
  }

  coin(): void {
    this.blip(880, 0.08, 'triangle', 0.05)
    setTimeout(() => this.blip(1180, 0.08, 'triangle', 0.05), 60)
  }

  splash(): void {
    this.blip(180, 0.32, 'sawtooth', 0.05)
    this.buzz(30)
  }

  /** Kort vrolijk deuntje bij een nieuw record (drie stijgende tonen). */
  record(): void {
    this.blip(660, 0.1, 'triangle', 0.05)
    setTimeout(() => this.blip(880, 0.1, 'triangle', 0.05), 90)
    setTimeout(() => this.blip(1320, 0.16, 'triangle', 0.05), 190)
    this.buzz([12, 40, 12])
  }

  /** Korte motor-"opstoot" zodra je vasthoudt om te versnellen. */
  engine(): void {
    this.blip(90, 0.12, 'sawtooth', 0.035)
  }

  /** Losse meeuwenkreet voor sfeer (bijv. bij het begin van een oversteek). */
  gull(): void {
    const ac = this.ac()
    if (!ac) return
    const osc = ac.createOscillator()
    const g = ac.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(1400, ac.currentTime)
    osc.frequency.linearRampToValueAtTime(900, ac.currentTime + 0.18)
    g.gain.setValueAtTime(0.03, ac.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.2)
    osc.connect(g).connect(ac.destination)
    osc.start()
    osc.stop(ac.currentTime + 0.2)
  }

  /** Vrolijke chime bij een geslaagde, schone oversteek. */
  chime(): void {
    this.blip(760, 0.1, 'triangle', 0.05)
    setTimeout(() => this.blip(1010, 0.12, 'triangle', 0.05), 70)
    this.buzz(14)
  }

  /** Lichte trilling op ondersteunde toestellen; volgt dezelfde mute-instelling. */
  private buzz(pattern: number | number[]): void {
    if (this.muted) return
    try {
      navigator.vibrate?.(pattern)
    } catch {
      /* niet ondersteund: negeren */
    }
  }

  close(): void {
    void this.ctx?.close()
    this.ctx = null
  }
}
