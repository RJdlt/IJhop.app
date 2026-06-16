import type { Lang } from '../i18n/strings'

/**
 * De arcade-laag is bewust spel-agnostisch. Eén `GameModule` implementeert een
 * spel volledig binnen deze interface; de shell kent alleen deze contract-vorm.
 * Een tweede spel toevoegen = nieuw bestand dat dit implementeert + één regel in
 * `registry.ts`.
 */

/** Abstracte invoer. De input-laag vertaalt swipes/toetsen hiernaartoe; spellen
 *  kennen geen swipe- of toetsencode. */
export type InputAction = 'up' | 'down' | 'left' | 'right' | 'tap'

export type GameState = 'idle' | 'running' | 'paused' | 'over'

/** Alles wat een spel bij `init` meekrijgt: tekenvlak-maten (in CSS-pixels) en
 *  de twee callbacks waarmee het naar de shell terugpraat. */
export interface GameInitOpts {
  /** Breedte van het tekenvlak in CSS-pixels (ctx is al voor DPR geschaald). */
  width: number
  /** Hoogte van het tekenvlak in CSS-pixels. */
  height: number
  /** Device-pixel-ratio waarmee het canvas is opgeschaald. */
  dpr: number
  /** Roep aan zodra de score wijzigt. */
  onScoreChange: (score: number) => void
  /** Roep aan bij game-over met de eindscore. */
  onGameOver: (score: number) => void
}

export interface GameModule {
  /** Eénmalige koppeling aan canvas + 2d-context + opties. */
  init(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, opts: GameInitOpts): void
  start(): void
  pause(): void
  resume(): void
  stop(): void
  /** Maak alle resources vrij (timers, RAF). Na destroy is het spel onbruikbaar. */
  destroy(): void
  onInput(action: InputAction): void
  getScore(): number
  getState(): GameState
  /** Het tekenvlak is van maat veranderd (rotatie, resize). Maten in CSS-pixels. */
  resize(width: number, height: number, dpr: number): void
  /** Optioneel: reageer op de mute-toggle van de shell (geluid aan/uit). */
  setMuted?(muted: boolean): void
}

/** Registratie-metadata per spel — voedt het menu en (later) een leaderboard. */
export interface GameMeta {
  id: string
  emoji: string
  title: Record<Lang, string>
  tagline: Record<Lang, string>
  /** Fabriek: levert telkens een verse, geïsoleerde spelinstantie. */
  create: () => GameModule
}
