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
  }

  coin(): void {
    this.blip(880, 0.08, 'triangle', 0.05)
    setTimeout(() => this.blip(1180, 0.08, 'triangle', 0.05), 60)
  }

  splash(): void {
    this.blip(180, 0.32, 'sawtooth', 0.05)
  }

  close(): void {
    void this.ctx?.close()
    this.ctx = null
  }
}
