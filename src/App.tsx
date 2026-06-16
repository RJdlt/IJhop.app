import { useMemo, useState } from 'react'
import { Header } from './components/Header'
import { RouteCard } from './components/RouteCard'
import { CatchPanel } from './components/CatchPanel'
import { Footer } from './components/Footer'
import { ArcadeSnack } from './components/ArcadeSnack'
import { TabBar } from './components/TabBar'
import { ArcadeShell } from './arcade/ArcadeShell'
import { useNow } from './hooks/useNow'
import { useAnonSession } from './hooks/useAnonSession'
import { useHashView } from './hooks/useHashView'
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

export default function App() {
  const now = useNow(1000)
  const nowSecondOfWeek = useMemo(() => amsterdamMoment(now).secondOfWeek, [now])

  const { userId } = useAnonSession()
  const [view, navigate] = useHashView()
  const [arcadeOpen, setArcadeOpen] = useState(false)

  const [flipped, setFlipped] = useState<Record<LineId, boolean>>({ F4: false, F7: false })
  const swap = (line: LineId) => setFlipped((f) => ({ ...f, [line]: !f[line] }))

  // Seconden tot de eerstvolgende afvaart in welke richting dan ook.
  const soonestSeconds = useMemo(() => {
    let min = Infinity
    for (const c of CONNECTIONS) {
      const d = nextDepartures({ from: c.from, to: c.to, nowSecondOfWeek, limit: 1 })[0]
      if (d && d.secondsUntil < min) min = d.secondsUntil
    }
    return min
  }, [nowSecondOfWeek])
  const nearDeparture = soonestSeconds < NEAR_DEPARTURE_SECONDS

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
              <ArcadeShell paused={nearDeparture} />
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
              onClose={() => setArcadeOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
