import { useMemo, useState } from 'react'
import { Header } from './components/Header'
import { RouteCard } from './components/RouteCard'
import { CatchPanel } from './components/CatchPanel'
import { Footer } from './components/Footer'
import { ArcadeSnack } from './components/ArcadeSnack'
import { TabBar } from './components/TabBar'
import { FerryPicker } from './components/FerryPicker'
import type { FerryOption } from './components/FerryPicker'
import { ArcadeShell } from './arcade/ArcadeShell'
import { useNow } from './hooks/useNow'
import { useAnonSession } from './hooks/useAnonSession'
import { useHashView } from './hooks/useHashView'
import { useI18n } from './i18n/i18n'
import { amsterdamMoment } from './lib/time'
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

// Onder deze grens pauzeert de arcade: eerst je echte pont halen.
const NEAR_DEPARTURE_SECONDS = 60
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

  // Alleen de gekozen pont pauzeert het spel.
  const watched = watchKey ? ferryOptions.find((o) => o.key === watchKey) ?? null : null
  const nearDeparture =
    watched?.secondsUntil != null && watched.secondsUntil < NEAR_DEPARTURE_SECONDS
  const pauseReason = watched
    ? `${watched.line} → ${t.stopNames[watched.to]} ${t.arcade.ferryLeaves}`
    : undefined

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
          </main>
        ) : (
          <main className="flex flex-1 flex-col">
            {/* Concrete dvh-hoogte i.p.v. een height:100%-keten, die iOS Safari
                niet betrouwbaar doorrekent — zo wordt het speelveld groot. */}
            <div className="h-[78dvh] min-h-[420px] w-full">
              <ArcadeShell
                paused={nearDeparture}
                pauseReason={pauseReason}
                menuExtra={ferryPicker}
                onDismissPause={() => chooseWatch(null)}
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
              paused={!arcadeOpen || nearDeparture}
              pauseReason={pauseReason}
              menuExtra={ferryPicker}
              onDismissPause={() => chooseWatch(null)}
              onClose={() => setArcadeOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
