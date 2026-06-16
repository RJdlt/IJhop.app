import { useMemo, useState } from 'react'
import { Header } from './components/Header'
import { RouteCard } from './components/RouteCard'
import { CatchPanel } from './components/CatchPanel'
import { Footer } from './components/Footer'
import { useNow } from './hooks/useNow'
import { useAnonSession } from './hooks/useAnonSession'
import { amsterdamMoment } from './lib/time'
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

export default function App() {
  const now = useNow(1000)
  const nowSecondOfWeek = useMemo(() => amsterdamMoment(now).secondOfWeek, [now])

  const { userId } = useAnonSession()

  const [flipped, setFlipped] = useState<Record<LineId, boolean>>({ F4: false, F7: false })
  const swap = (line: LineId) => setFlipped((f) => ({ ...f, [line]: !f[line] }))

  return (
    <div className="water-bg min-h-full">
      <div className="mx-auto flex min-h-full max-w-md flex-col gap-5 px-4 py-6">
        <Header />

        <main className="flex flex-col gap-4">
          {(Object.keys(DIRECTIONS) as LineId[]).map((line) => {
            const connection = DIRECTIONS[line][flipped[line] ? 1 : 0]
            return (
              <RouteCard
                key={line}
                connection={connection}
                nowSecondOfWeek={nowSecondOfWeek}
                onSwap={() => swap(line)}
              />
            )
          })}

          <CatchPanel nowSecondOfWeek={nowSecondOfWeek} />
        </main>

        <div className="mt-auto">
          <Footer />
        </div>
      </div>
    </div>
  )
}
