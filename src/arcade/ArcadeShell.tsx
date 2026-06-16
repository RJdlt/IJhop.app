import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useI18n } from '../i18n/i18n'
import { GAMES, getGame } from './registry'
import { attachInput } from './input'
import type { InputHandle } from './input'
import { getHighScore, recordScore } from './scoreStore'
import type { GameInitOpts, GameModule } from './types'

type Screen = 'menu' | 'playing' | 'over'

interface ArcadeShellProps {
  /** Forceer pauze van buitenaf (pont vertrekt zo, of overlay gesloten). */
  paused?: boolean
  /** Korte uitleg waarom er gepauzeerd is. */
  pauseReason?: string
  /** Aanwezig in overlay-modus: toont een sluitknop. */
  onClose?: () => void
  /** Extra inhoud op het menu (bijv. de pont-keuze). Houdt de shell generiek. */
  menuExtra?: ReactNode
  /** Toont in de pauze-sluier een knop om de pauze te negeren. */
  onDismissPause?: () => void
  dismissLabel?: string
}

const MUTE_KEY = 'ijhop.arcade.muted'
const DPR_CAP = 2 // retina is mooi genoeg; hoger kost fps zonder winst

export function ArcadeShell({
  paused = false,
  pauseReason,
  onClose,
  menuExtra,
  onDismissPause,
  dismissLabel,
}: ArcadeShellProps) {
  const { t, lang } = useI18n()

  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const moduleRef = useRef<GameModule | null>(null)
  const inputRef = useRef<InputHandle | null>(null)
  const optsRef = useRef<GameInitOpts | null>(null)

  const [screen, setScreen] = useState<Screen>('menu')
  const [score, setScore] = useState(0)
  const [result, setResult] = useState<{ score: number; high: number; isRecord: boolean } | null>(
    null,
  )
  const [muted, setMuted] = useState(
    // Geluid staat standaard uit; alleen 'aan' als de speler dat ooit koos.
    () => typeof window === 'undefined' || window.localStorage.getItem(MUTE_KEY) !== '0',
  )

  /** Zet het canvas op de huidige containermaat met DPR-scaling. */
  const sizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return null
    const w = wrap.clientWidth
    const h = wrap.clientHeight
    if (w === 0 || h === 0) return null // verborgen container: niets te doen
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP)
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0) // spellen tekenen in CSS-pixels
    if (optsRef.current) {
      optsRef.current.width = w
      optsRef.current.height = h
      optsRef.current.dpr = dpr
      moduleRef.current?.resize(w, h, dpr)
    }
    return { ctx, w, h, dpr }
  }, [])

  const detachInput = useCallback(() => {
    inputRef.current?.detach()
    inputRef.current = null
  }, [])

  const attachInputNow = useCallback(() => {
    if (inputRef.current || !canvasRef.current) return
    const mod = moduleRef.current
    if (!mod) return
    inputRef.current = attachInput(canvasRef.current, (a) => mod.onInput(a))
  }, [])

  /** Wis het tekenvlak, zodat geen oud game-frame achter het menu blijft staan. */
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.restore()
  }, [])

  const teardownGame = useCallback(() => {
    detachInput()
    moduleRef.current?.stop()
    moduleRef.current?.destroy()
    moduleRef.current = null
    optsRef.current = null
    clearCanvas()
  }, [detachInput, clearCanvas])

  const startGame = useCallback(
    (id: string) => {
      const meta = getGame(id)
      const canvas = canvasRef.current
      if (!meta || !canvas) return
      teardownGame()
      const sized = sizeCanvas()
      if (!sized) return

      const opts: GameInitOpts = {
        width: sized.w,
        height: sized.h,
        dpr: sized.dpr,
        onScoreChange: (s) => setScore(s),
        onGameOver: (s) => {
          const { high, isRecord } = recordScore(id, s)
          detachInput()
          setResult({ score: s, high, isRecord })
          setScreen('over')
        },
      }
      optsRef.current = opts

      const mod = meta.create()
      moduleRef.current = mod
      mod.init(canvas, sized.ctx, opts)
      mod.setMuted?.(muted)
      setScore(0)
      setResult(null)
      mod.start()
      attachInputNow()
      setScreen('playing')
    },
    [teardownGame, sizeCanvas, detachInput, attachInputNow, muted],
  )

  const backToMenu = useCallback(() => {
    teardownGame()
    setScreen('menu')
  }, [teardownGame])

  // Houd het canvas mee-resizen met de container.
  useEffect(() => {
    sizeCanvas()
    const ro = new ResizeObserver(() => sizeCanvas())
    const wrap = wrapRef.current
    if (wrap) ro.observe(wrap)
    return () => ro.disconnect()
  }, [sizeCanvas])

  // Externe pauze: stop de loop én de input zolang we gepauzeerd zijn.
  useEffect(() => {
    if (screen !== 'playing') return
    const mod = moduleRef.current
    if (!mod) return
    if (paused) {
      mod.pause()
      detachInput()
    } else {
      mod.resume()
      attachInputNow()
    }
  }, [paused, screen, detachInput, attachInputNow])

  // Ruim alles netjes op bij unmount (geen lekken bij herstart).
  useEffect(() => () => teardownGame(), [teardownGame])

  const toggleMute = () =>
    setMuted((m) => {
      const next = !m
      try {
        window.localStorage.setItem(MUTE_KEY, next ? '1' : '0')
      } catch {
        /* faal stil */
      }
      moduleRef.current?.setMuted?.(next)
      return next
    })

  const showPauseVeil = screen === 'playing' && paused

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden rounded-3xl bg-brand-dark">
      <canvas ref={canvasRef} className="block h-full w-full touch-none" />

      {/* Topbalk: altijd zichtbaar tijdens spelen */}
      {screen !== 'menu' && (
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-3">
          <span className="pointer-events-auto rounded-full bg-black/30 px-3 py-1 text-sm font-semibold tabular-nums text-white backdrop-blur">
            {t.arcade.score}: {score}
          </span>
          <div className="pointer-events-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? t.arcade.unmute : t.arcade.mute}
              className="grid h-8 w-8 place-items-center rounded-full bg-black/30 text-white backdrop-blur"
            >
              {muted ? '🔇' : '🔊'}
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label={t.arcade.close}
                className="grid h-8 w-8 place-items-center rounded-full bg-black/30 text-white backdrop-blur"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* Menu (dekkende achtergrond zodat geen game-frame doorschemert) */}
      {screen === 'menu' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 overflow-y-auto bg-brand-dark p-6 text-center text-white">
          <div>
            <p className="text-2xl font-bold">{t.arcade.title}</p>
            <p className="mt-1 text-sm text-white/70">{t.arcade.pickGame}</p>
          </div>
          {menuExtra}
          <div className="flex w-full max-w-xs flex-col gap-2.5">
            {GAMES.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => startGame(g.id)}
                className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 text-left transition hover:bg-white/20"
              >
                <span className="text-2xl">{g.emoji}</span>
                <span className="flex-1">
                  <span className="block font-semibold">{g.title[lang]}</span>
                  <span className="block text-xs text-white/70">{g.tagline[lang]}</span>
                </span>
                <span className="text-xs text-white/70">
                  {t.arcade.best} {getHighScore(g.id)}
                </span>
              </button>
            ))}
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-medium text-white/70 underline-offset-2 hover:underline"
            >
              {t.arcade.close}
            </button>
          )}
        </div>
      )}

      {/* Pauze-sluier */}
      {showPauseVeil && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-brand-dark/85 p-6 text-center text-white backdrop-blur-sm">
          <p className="text-lg font-bold">⏸️ {t.arcade.paused}</p>
          <p className="max-w-xs text-sm text-white/80">{pauseReason ?? t.arcade.pausedDeparture}</p>
          {onDismissPause && (
            <button
              type="button"
              onClick={onDismissPause}
              className="mt-1 rounded-2xl bg-white/15 px-4 py-2 text-sm font-semibold transition hover:bg-white/25"
            >
              {dismissLabel ?? t.arcade.playAnyway}
            </button>
          )}
        </div>
      )}

      {/* Game-over */}
      {screen === 'over' && result && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-brand-dark/85 p-6 text-center text-white backdrop-blur-sm">
          <p className="text-3xl">💦</p>
          <p className="text-xl font-bold">{t.arcade.drownTagline}</p>
          <div>
            <p className="text-sm text-white/70">{t.arcade.score}</p>
            <p className="text-4xl font-extrabold tabular-nums">{result.score}</p>
            <p className="mt-1 text-sm text-white/70">
              {result.isRecord ? `🏆 ${t.arcade.newRecord}` : `${t.arcade.best}: ${result.high}`}
            </p>
          </div>
          <div className="flex w-full max-w-xs flex-col gap-2">
            <button
              type="button"
              onClick={() => startGame('ponthop')}
              className="rounded-2xl bg-white px-4 py-3 font-semibold text-brand-dark transition hover:bg-white/90"
            >
              🔁 {t.arcade.restart}
            </button>
            <button
              type="button"
              onClick={backToMenu}
              className="rounded-2xl bg-white/10 px-4 py-3 font-semibold transition hover:bg-white/20"
            >
              {t.arcade.menu}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
