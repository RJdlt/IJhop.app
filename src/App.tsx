import { useEffect, useMemo, useState } from 'react'
import { Header } from './components/Header'
import { RouteCard } from './components/RouteCard'
import { CatchPanel } from './components/CatchPanel'
import { Footer } from './components/Footer'
import { ArcadeSnack } from './components/ArcadeSnack'
import { TabBar } from './components/TabBar'
import { InstallPrompt } from './components/InstallPrompt'
import { SponsorCard } from './components/SponsorCard'
import { OntmoetingCard } from './components/OntmoetingCard'
import { OnboardingFavorites } from './components/OnboardingFavorites'
import { FerryPicker } from './components/FerryPicker'
import type { FerryOption } from './components/FerryPicker'
import { ArcadeShell } from './arcade/ArcadeShell'
import { useNow } from './hooks/useNow'
import { useAnonSession } from './hooks/useAnonSession'
import { usePresence } from './hooks/usePresence'
import { useHashView } from './hooks/useHashView'
import { getNickname } from './lib/nickname'
import { setupPwaAutoUpdate } from './pwa'
import { startAnalytics, track } from './lib/analytics'
import { useI18n } from './i18n/i18n'
import { amsterdamMoment } from './lib/time'
import { clockCountdown } from './lib/format'
import { CONNECTIONS, LINES, LINE_IDS, STOPS, nextDepartures } from './lib/schedule'
import type { StopPair } from './lib/schedule'
import type { LineId } from './types'

// Elke lijn heeft een "kop"-richting (connects[0] -> connects[1]) plus de omgekeerde;
// de wissel-knop flipt ertussen. Data-gedreven uit de dienstregeling.
const DIRECTIONS: Record<LineId, [StopPair, StopPair]> = Object.fromEntries(
  Object.values(LINES).map((l) => {
    const [a, b] = l.connects
    return [l.name, [
      { from: a, to: b, line: l.name },
      { from: b, to: a, line: l.name },
    ]]
  }),
)

const FAV_KEY = 'ijhop:favlines'

// Onder deze grens toont het spel een opvallender (maar niet-blokkerend) tikje.
const SOON_SECONDS = 60
// Boven deze grens is het aftelbalkje nog niet relevant.
const BANNER_SECONDS = 300
// De overtocht-ranglijst wordt actief vanaf zo lang vóór vertrek (instappen)…
const CROSSING_PRE_SECONDS = 300
// …en blijft het de ~overtochtsduur lopen (de "13 minuten dat je erop staat").
const CROSSING_RIDE_MS = 13 * 60 * 1000
const WATCH_KEY = 'ijhop.arcade.watch'

const connKey = (c: StopPair) => `${c.line}:${c.from}:${c.to}`

export default function App() {
  const { t } = useI18n()
  const now = useNow(1000)
  const nowSecondOfWeek = useMemo(() => amsterdamMoment(now).secondOfWeek, [now])

  const { userId } = useAnonSession()
  const [view, navigate] = useHashView()
  const [arcadeOpen, setArcadeOpen] = useState(false)

  // Nieuwe versie beschikbaar? Toon een verversen-knop i.p.v. vanzelf herladen.
  const [updateReady, setUpdateReady] = useState(false)
  useEffect(() => setupPwaAutoUpdate(() => setUpdateReady(true)), [])

  // Analytics: sessiestart + welke tab je bekijkt.
  useEffect(() => startAnalytics(), [])
  useEffect(() => {
    track('tab_view', { view })
  }, [view])

  const [flipped, setFlipped] = useState<Record<LineId, boolean>>(() =>
    Object.fromEntries(LINE_IDS.map((l) => [l, false])),
  )
  const swap = (line: LineId) => setFlipped((f) => ({ ...f, [line]: !f[line] }))

  // Favoriete pontjes (staan bovenaan). Onthouden per browser.
  const [favs, setFavs] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]') as string[])
    } catch {
      return new Set()
    }
  })
  const toggleFav = (line: string) =>
    setFavs((prev) => {
      const next = new Set(prev)
      if (next.has(line)) next.delete(line)
      else next.add(line)
      try {
        localStorage.setItem(FAV_KEY, JSON.stringify([...next]))
      } catch {
        /* faal stil */
      }
      return next
    })
  const favLines = useMemo(() => LINE_IDS.filter((l) => favs.has(l)), [favs])
  const otherLines = useMemo(() => LINE_IDS.filter((l) => !favs.has(l)), [favs])
  const [showOthers, setShowOthers] = useState(false)

  // Eenmalige favorieten-vraag bij de eerste keer, voor een schoon hoofdscherm.
  const [onboarded, setOnboarded] = useState(() => {
    try {
      return localStorage.getItem('ijhop:onboarded') === '1'
    } catch {
      return true
    }
  })
  const finishOnboarding = () => {
    setOnboarded(true)
    try {
      localStorage.setItem('ijhop:onboarded', '1')
    } catch {
      /* faal stil */
    }
  }

  // Welke pont de speler bewust afwacht (null = alleen spelen, nooit pauzeren).
  const [watchKey, setWatchKey] = useState<string | null>(
    () => (typeof window === 'undefined' ? null : window.localStorage.getItem(WATCH_KEY)),
  )
  const chooseWatch = (key: string | null) => {
    setWatchKey(key)
    track('ferry_pick', { key })
    try {
      if (key) window.localStorage.setItem(WATCH_KEY, key)
      else window.localStorage.removeItem(WATCH_KEY)
    } catch {
      /* faal stil */
    }
  }

  // Live aftelklok per richting, voor de pont-keuze.
  const ferryOptions = useMemo<FerryOption[]>(
    () =>
      CONNECTIONS.map((c) => ({
        key: connKey(c),
        line: c.line,
        from: c.from,
        to: c.to,
        secondsUntil: nextDepartures({ from: c.from, to: c.to, nowSecondOfWeek, limit: 1 })[0]
          ?.secondsUntil,
      })),
    [nowSecondOfWeek],
  )

  // De gekozen pont onderbreekt het spel niet meer: enkel een rustig
  // aftelbalkje bovenin, dat opvalt als de pont bijna gaat.
  const watched = watchKey ? ferryOptions.find((o) => o.key === watchKey) ?? null : null
  const watchedSecs = watched?.secondsUntil
  const ferryBanner =
    watched && watchedSecs != null && watchedSecs < BANNER_SECONDS ? (
      <span
        className={`pointer-events-none rounded-full px-3 py-1 text-xs font-semibold tabular-nums shadow-lg backdrop-blur ${
          watchedSecs < SOON_SECONDS ? 'bg-amber-400 text-amber-950' : 'bg-black/40 text-white'
        }`}
      >
        🚤 {watched.line} → {STOPS[watched.to]?.name ?? watched.to} · {clockCountdown(watchedSecs)}
        {watchedSecs < SOON_SECONDS ? ` — ${t.arcade.ferryLeaves}` : ''}
      </span>
    ) : null

  // De overtocht-ranglijst is alleen actief rond de afvaart die je pakt: vanaf
  // het instappen (≤ CROSSING_PRE_SECONDS vóór vertrek) tot ~de overtochtsduur
  // erna. De gekozen overtocht wordt "vastgepind" zodra je in dat venster komt,
  // en blijft staan terwijl de aftelklok al naar de vólgende afvaart springt —
  // precies "de minuten dat je erop staat".
  const [activeCrossing, setActiveCrossing] = useState<{
    room: string
    label: string
    untilMs: number
  } | null>(null)

  useEffect(() => {
    const nowMs = now.getTime()
    if (activeCrossing && nowMs > activeCrossing.untilMs) {
      setActiveCrossing(null)
      return
    }
    if (!activeCrossing && watched && watchedSecs != null && watchedSecs <= CROSSING_PRE_SECONDS) {
      // Som = geplande vertrek-seconde (zelfde geheel getal voor iedereen).
      const departSow = Math.floor(nowSecondOfWeek + watchedSecs)
      setActiveCrossing({
        room: `${watched.key}@${departSow}`,
        label: `${watched.line} → ${STOPS[watched.to]?.name ?? watched.to}`,
        untilMs: nowMs + watchedSecs * 1000 + CROSSING_RIDE_MS,
      })
    }
  }, [now, watched, watchedSecs, activeCrossing, nowSecondOfWeek, t])

  const crossingRoom = activeCrossing?.room ?? null
  const crossingLabel = activeCrossing?.label

  // Pont Ontmoeting: overtocht-kamer zodra je een pont kiest (lijn + vertrekmoment),
  // zodat twee mensen op dezelfde afvaart elkaar kunnen vinden.
  const ontmoetingRoom =
    watched && watchedSecs != null
      ? `${watched.key}@${Math.floor(nowSecondOfWeek + watchedSecs)}`
      : null

  // Live spelers-teller op deze overtocht (presence), terwijl de arcade open is.
  const presenceNick = useMemo(() => getNickname(), [])
  const crossingPlayers = usePresence(
    crossingRoom && (view === 'arcade' || arcadeOpen) ? `arcade:${crossingRoom}` : null,
    userId,
    presenceNick,
  )

  const ferryPicker = (
    <FerryPicker options={ferryOptions} value={watchKey} onChange={chooseWatch} />
  )

  const renderRoute = (line: string) => (
    <RouteCard
      key={line}
      connection={DIRECTIONS[line][flipped[line] ? 1 : 0]}
      nowSecondOfWeek={nowSecondOfWeek}
      userId={userId}
      onSwap={() => swap(line)}
      favorite={favs.has(line)}
      onToggleFav={() => toggleFav(line)}
    />
  )

  return (
    <div className="water-bg flex min-h-full flex-col">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6">
        <Header />

        {view === 'ferries' ? (
          <main className="flex flex-col gap-4">
            {(favLines.length > 0 ? favLines : LINE_IDS).map(renderRoute)}
            {favLines.length > 0 && otherLines.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setShowOthers((s) => !s)}
                  className="self-start rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm ring-1 ring-slate-100 transition hover:bg-slate-50 dark:bg-white/5 dark:text-slate-300 dark:ring-white/10"
                >
                  {showOthers ? '▲' : '▼'} {t.otherFerries} ({otherLines.length})
                </button>
                {showOthers && otherLines.map(renderRoute)}
              </>
            )}

            {ontmoetingRoom && <OntmoetingCard room={ontmoetingRoom} userId={userId} />}
            <ArcadeSnack
              onOpen={() => {
                track('snack_open')
                setArcadeOpen(true)
              }}
            />
            <CatchPanel nowSecondOfWeek={nowSecondOfWeek} />
            <InstallPrompt />
            <SponsorCard />
          </main>
        ) : (
          <main className="flex flex-1 flex-col">
            {/* 'page': het menu stroomt als gewone pagina-inhoud (de pagina
                scrollt, geen vakje-scroll). Alleen tijdens spelen een vast veld. */}
            <ArcadeShell
              layout="page"
              menuExtra={ferryPicker}
              banner={ferryBanner}
              crossingRoom={crossingRoom}
              crossingLabel={crossingLabel}
              crossingPlayers={crossingPlayers}
            />
          </main>
        )}

        {view === 'ferries' && (
          <div className="mt-auto">
            <Footer />
          </div>
        )}

        <TabBar view={view} onNavigate={navigate} />
      </div>

      {/* Snack-overlay: dezelfde game boven de countdown. De ArcadeShell blijft
          gemount terwijl we op het ponten-scherm zijn, zodat sluiten pauzeert
          (niet weggooit) en de countdown eronder onaangeroerd blijft. */}
      {view === 'ferries' && (
        <div
          className={`fixed inset-0 z-30 bg-brand-dark/95 p-3 backdrop-blur transition-opacity duration-200 ${
            arcadeOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
          aria-hidden={!arcadeOpen}
        >
          <div className="mx-auto h-full max-w-md pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
            <ArcadeShell
              paused={!arcadeOpen}
              menuExtra={ferryPicker}
              banner={ferryBanner}
              crossingRoom={crossingRoom}
              crossingLabel={crossingLabel}
              crossingPlayers={crossingPlayers}
              onClose={() => setArcadeOpen(false)}
            />
          </div>
        </div>
      )}

      {!onboarded && (
        <OnboardingFavorites favs={favs} onToggle={toggleFav} onDone={finishOnboarding} />
      )}

      {/* Niet-storende update-melding: één tik en je zit op de nieuwste versie. */}
      {updateReady && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center px-4">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-xl ring-1 ring-black/10"
          >
            ⟳ {t.updateAvailable} · {t.refreshNow}
          </button>
        </div>
      )}
    </div>
  )
}
