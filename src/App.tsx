import { useMemo, useState } from 'react'
import { Header } from './components/Header'
import { RouteCard } from './components/RouteCard'
import { CatchPanel } from './components/CatchPanel'
import { Footer } from './components/Footer'
import { ArcadeSnack } from './components/ArcadeSnack'
import { TabBar } from './components/TabBar'
import { InstallPrompt } from './components/InstallPrompt'
import { FerryPicker } from './components/FerryPicker'
import type { FerryOption } from './components/FerryPicker'
import { ArcadeShell } from './arcade/ArcadeShell'
import { useNow } from './hooks/useNow'
import { useAnonSession } from './hooks/useAnonSession'
import { useHashView } from './hooks/useHashView'
import { useI18n } from './i18n/i18n'
import { amsterdamMoment } from './lib/time'
import { clockCountdown } from './lib/format'
import { CONNECTIONS, nextDepartures } from './lib/schedule'
import type { StopPair } from './lib/schedule'
import type { LineId } from './types'

// Each line starts on its "headline" direction; the swap button flips it.
const DIRECTIONS: Record<LineId, [StopPair, StopPair]> = {
  F4: [
    { from: 'ndsm', to: 'centraal', line: 'F4' },
    { from: 'centraal', to: 'ndsm', line: 'F4' },
  ],
  F7: [
    { from: 'ndsm', to: 'pontsteiger', line: 'F7' },
    { from: 'pontsteiger', to: 'ndsm', line: 'F7' },
  ],
}

// Onder deze grens toont het spel een opvallender (maar niet-blokkerend) tikje.
const SOON_SECONDS = 60
// Boven deze grens is het aftelbalkje nog niet relevant.
const BANNER_SECONDS = 300
const WATCH_KEY = 'ijhop.arcade.watch'

const connKey = (c: StopPair) => `${c.line}:${c.from}:${c.to}`

export default function App() {
  const { t } = useI18n()
  const now = useNow(1000)
  const nowSecondOfWeek = useMemo(() => amsterdamMoment(now).secondOfWeek, [now])

  const { userId } = useAnonSession()
  const [view, navigate] = useHashView()
  const [arcadeOpen, setArcadeOpen] = useState(false)

  const [flipped, setFlipped] = useState<Record<LineId, boolean>>({ F4: false, F7: false })
  const swap = (line: LineId) => setFlipped((f) => ({ ...f, [line]: !f[line] }))

  // Welke pont de speler bewust afwacht (null = alleen spelen, nooit pauzeren).
  const [watchKey, setWatchKey] = useState<string | null>(
    () => (typeof window === 'undefined' ? null : window.localStorage.getItem(WATCH_KEY)),
  )
  const chooseWatch = (key: string | null) => {
    setWatchKey(key)
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
        🚤 {watched.line} → {t.stopNames[watched.to]} · {clockCountdown(watchedSecs)}
        {watchedSecs < SOON_SECONDS ? ` — ${t.arcade.ferryLeaves}` : ''}
      </span>
    ) : null

  // Kamer van de gekozen overtocht: lijn+richting + het vertrekmoment, zodat
  // iedereen die dezelfde afvaart kiest in dezelfde overtocht-ranglijst valt.
  // (Som blijft stabiel: nu loopt op, secondsUntil telt even hard af.)
  const crossingRoom =
    watched && watchedSecs != null
      ? `${watched.key}@${Math.floor(nowSecondOfWeek + watchedSecs)}`
      : null
  const crossingLabel = watched ? `${watched.line} → ${t.stopNames[watched.to]}` : undefined

  const ferryPicker = (
    <FerryPicker options={ferryOptions} value={watchKey} onChange={chooseWatch} />
  )

  return (
    <div className="water-bg flex min-h-full flex-col">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6">
        <Header />

        {view === 'ferries' ? (
          <main className="flex flex-col gap-4">
            {(Object.keys(DIRECTIONS) as LineId[]).map((line) => {
              const connection = DIRECTIONS[line][flipped[line] ? 1 : 0]
              return (
                <RouteCard
                  key={line}
                  connection={connection}
                  nowSecondOfWeek={nowSecondOfWeek}
                  userId={userId}
                  onSwap={() => swap(line)}
                />
              )
            })}

            <ArcadeSnack onOpen={() => setArcadeOpen(true)} />
            <CatchPanel nowSecondOfWeek={nowSecondOfWeek} />
            <InstallPrompt />
          </main>
        ) : (
          <main className="flex flex-1 flex-col">
            {/* Concrete dvh-hoogte i.p.v. een height:100%-keten, die iOS Safari
                niet betrouwbaar doorrekent — zo wordt het speelveld groot. */}
            <div className="h-[78dvh] min-h-[420px] w-full">
              <ArcadeShell
                menuExtra={ferryPicker}
                banner={ferryBanner}
                crossingRoom={crossingRoom}
                crossingLabel={crossingLabel}
              />
            </div>
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
              onClose={() => setArcadeOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
