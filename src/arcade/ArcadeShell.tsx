import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useI18n } from '../i18n/i18n'
import { GAMES, getGame } from './registry'
import { attachInput } from './input'
import type { InputHandle } from './input'
import { getHighScore, recordScore } from './scoreStore'
import { submitScore } from './leaderboard'
import { Leaderboard } from './Leaderboard'
import { getNickname, setNickname, NICK_MAX } from '../lib/nickname'
import { hasProfanity, sanitizeName } from '../lib/profanity'
import { track } from '../lib/analytics'
import { PrizeEntry } from './PrizeEntry'
import { shouldOfferPrize, markPrizeSeen } from '../lib/prize'
import { SponsorCard } from '../components/SponsorCard'
import { DailyChallenge } from './DailyChallenge'
import { arcadeBg, glass, glassSoft, playPill } from './ui'
import type { GameInitOpts, GameModule, GameOverLine } from './types'

// Eén spel voor nu; de ranglijst draait op dit spel-id.
const BOARD_GAME = GAMES[0]?.id ?? 'ponthop'

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
  /** Niet-blokkerend balkje bovenin tijdens het spelen (bijv. pont-aftelklok). */
  banner?: ReactNode
  /** Kamer van de gekozen overtocht; scores tellen dan ook in die lijst. */
  crossingRoom?: string | null
  /** Korte omschrijving van de overtocht voor de kop (bijv. "F7 → NDSM"). */
  crossingLabel?: string
  /** Aantal spelers dat nu live op deze overtocht zit (presence). */
  crossingPlayers?: number
  /** 'page' = stroomt als normale pagina-inhoud (tab); 'fill' = vult vaste
   *  hoogte met intern scrollend menu (snack-overlay). */
  layout?: 'page' | 'fill'
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
  banner,
  crossingRoom,
  crossingLabel,
  crossingPlayers,
  layout = 'fill',
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
  const [result, setResult] = useState<{
    score: number
    high: number
    isRecord: boolean
    lines: GameOverLine[]
    offerPrize: boolean
  } | null>(null)
  const [nick, setNick] = useState(() => getNickname())
  const nickRef = useRef(nick)
  nickRef.current = nick
  // Laatste overtocht-kamer bij de hand voor het moment van game-over.
  const crossingRef = useRef(crossingRoom)
  crossingRef.current = crossingRoom
  // Bump om de ranglijst direct te verversen nadat onze eigen score binnen is.
  const [boardReload, setBoardReload] = useState(0)
  const [nameError, setNameError] = useState(false)
  const onNickChange = (v: string) => {
    setNick(v)
    if (nameError && !hasProfanity(v)) setNameError(false)
  }
  const saveNick = () => {
    if (hasProfanity(nick)) {
      // Ongepaste naam niet bewaren: melden en terug naar de vorige naam.
      setNameError(true)
      setNick(getNickname())
      return
    }
    setNameError(false)
    const clean = setNickname(nick)
    if (clean) setNick(clean)
  }
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
        onGameOver: (s, lines) => {
          const { high, isRecord } = recordScore(id, s)
          detachInput()
          // Beslis één keer of we de prijs-uitnodiging tonen (stabiel voor dit
          // scherm) en onthoud dat 'ie getoond is, zodat 'ie niet blijft komen.
          const offerPrize = shouldOfferPrize(s)
          if (offerPrize) markPrizeSeen()
          setResult({ score: s, high, isRecord, lines: lines ?? [], offerPrize })
          setScreen('over')
          track('game_over', { game: id, score: s, isRecord })
          // Score insturen (ook getagd met de overtocht) en lijsten verversen.
          submitScore(id, nickRef.current.trim() || getNickname(), s, crossingRef.current).then(
            () => setBoardReload((k) => k + 1),
          )
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
      track('game_start', { game: id })
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

  const nameField = (
    <div className="w-full max-w-xs text-left">
      <label htmlFor="arcade-nick" className="block text-xs font-medium text-white/60">
        {t.arcade.yourName}
      </label>
      <input
        id="arcade-nick"
        value={nick}
        onChange={(e) => onNickChange(e.target.value)}
        onBlur={saveNick}
        maxLength={NICK_MAX}
        placeholder={t.arcade.yourName}
        aria-invalid={nameError}
        className={`mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40 focus:bg-white/15 ${
          nameError ? 'ring-1 ring-red-400' : ''
        }`}
      />
      {nameError && <p className="mt-1 text-[11px] text-red-300">{t.arcade.nameRejected}</p>}
    </div>
  )

  const leaderboard = (
    <Leaderboard gameId={BOARD_GAME} youName={nick.trim()} reloadKey={boardReload} />
  )

  const crossingBoard = crossingRoom ? (
    <Leaderboard
      gameId={BOARD_GAME}
      youName={nick.trim()}
      reloadKey={boardReload}
      room={crossingRoom}
      title={`🚤 ${t.arcade.thisCrossing}${crossingLabel ? ` · ${crossingLabel}` : ''}${
        crossingPlayers && crossingPlayers > 0 ? ` · 👥 ${crossingPlayers}` : ''
      }`}
    />
  ) : null

  const pageMode = layout === 'page'
  // Spelletjes-tab ('page'): menu/over stromen als gewone pagina-inhoud, alleen
  // tijdens het spelen een vast groot speelveld. Snack-overlay ('fill'): vaste
  // hoogte met intern scrollend menu.
  const rootClass = `relative w-full overflow-hidden rounded-3xl bg-brand-dark ${
    pageMode ? (screen === 'playing' ? 'h-[78dvh] min-h-[420px]' : '') : 'h-full'
  }`
  const panelBase = `flex w-full flex-col items-center gap-5 ${arcadeBg} px-6 py-8 text-center text-white`
  const menuClass = pageMode
    ? `relative ${panelBase}`
    : `absolute inset-0 justify-start overflow-y-auto ${panelBase}`
  const overClass = pageMode
    ? `relative flex w-full flex-col items-center gap-4 ${arcadeBg} p-6 text-center text-white`
    : `absolute inset-0 flex flex-col items-center justify-center gap-4 ${arcadeBg} p-6 text-center text-white`

  return (
    <div ref={wrapRef} className={rootClass}>
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full touch-none" />

      {/* Topbalk: in-game HUD (score, geluid, sluiten) */}
      {screen === 'playing' && (
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

      {/* Niet-blokkerend balkje (pont-aftelklok) tijdens het spelen */}
      {screen === 'playing' && banner && (
        <div className="pointer-events-none absolute inset-x-0 top-12 flex justify-center px-3">
          {banner}
        </div>
      )}

      {/* Menu (dekkende achtergrond zodat geen game-frame doorschemert) */}
      {screen === 'menu' && (
        <div className={menuClass}>
          <div className="pt-1">
            <p className="text-3xl font-black tracking-tight text-white drop-shadow-[0_2px_16px_rgba(29,158,117,0.55)]">
              🕹️ {t.arcade.title}
            </p>
            <p className="mt-1 text-sm text-white/55">{t.arcade.pickGame}</p>
          </div>
          {nameField}
          {menuExtra}
          <div className="flex w-full max-w-xs flex-col gap-2.5">
            {GAMES.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => startGame(g.id)}
                aria-label={`${t.arcade.play} ${g.title[lang]}`}
                className={`flex items-center gap-3 ${glass} px-4 py-4 text-left transition hover:bg-white/[0.1] active:scale-[0.99]`}
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10 text-3xl ring-1 ring-white/10">
                  {g.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-extrabold leading-tight">{g.title[lang]}</span>
                  <span className="block truncate text-xs text-white/60">{g.tagline[lang]}</span>
                  <span className="mt-0.5 block text-[11px] text-white/45">
                    {t.arcade.best} {getHighScore(g.id)}
                  </span>
                </span>
                <span className={playPill}>▶ {t.arcade.play}</span>
              </button>
            ))}
          </div>
          <DailyChallenge />
          {GAMES.map((g) => (g.MenuPanel ? <g.MenuPanel key={g.id} /> : null))}
          {crossingBoard}
          {leaderboard}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-medium text-white/70 underline-offset-2 hover:underline"
            >
              {t.arcade.close}
            </button>
          )}
          <p className="text-[10px] text-white/30">v{__BUILD_ID__}</p>
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
        <div className={overClass}>
          <p className="text-3xl">💦</p>
          <p className="text-2xl font-black tracking-tight">{t.arcade.gameOver}</p>
          <p className="-mt-2 text-sm text-white/60">{t.arcade.drownTagline}</p>
          <div className={`${glass} w-full max-w-xs px-6 py-5`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-white/50">{t.arcade.score}</p>
            <p className="bg-gradient-to-b from-white to-emerald-200 bg-clip-text text-7xl font-black tabular-nums text-transparent drop-shadow-[0_4px_20px_rgba(29,158,117,0.5)]">
              {result.score}
            </p>
            <p className="mt-1 text-sm text-white/60">
              {result.isRecord ? `🏆 ${t.arcade.newRecord}` : `${t.arcade.best}: ${result.high}`}
            </p>
          </div>
          {result.lines.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2">
              {result.lines.map((l, i) => (
                <span key={i} className={`${glassSoft} px-3 py-1 text-sm`}>
                  <span className="text-white/60">{l.label} </span>
                  <span className="font-semibold tabular-nums">{l.value}</span>
                </span>
              ))}
            </div>
          )}
          <p className="text-sm text-white/70">
            {t.arcade.addedAs}{' '}
            <span className="font-semibold text-white">{sanitizeName(nick)}</span>
          </p>
          {result.offerPrize && <PrizeEntry gameId="ponthop" score={result.score} />}
          {crossingBoard}
          {leaderboard}
          <div className="flex w-full max-w-xs flex-col gap-2">
            <button
              type="button"
              onClick={() => startGame('ponthop')}
              className="rounded-2xl bg-gradient-to-r from-emerald-400 to-brand px-4 py-3.5 font-extrabold text-white shadow-[0_12px_34px_-8px_rgba(29,158,117,0.85)] transition active:scale-[0.99]"
            >
              🔁 {t.arcade.tryAgain}
            </button>
            <button
              type="button"
              onClick={backToMenu}
              className="rounded-2xl bg-white/[0.06] px-4 py-3 font-semibold ring-1 ring-white/10 backdrop-blur-md transition hover:bg-white/10"
            >
              {t.arcade.menu}
            </button>
          </div>
          <SponsorCard variant="compact" />
        </div>
      )}
    </div>
  )
}
