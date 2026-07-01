import { useState } from 'react'
import { useI18n } from '../i18n/i18n'
import { useGeolocation } from '../hooks/useGeolocation'
import { formatDistance, pierDistances, travelSeconds, type TravelMode } from '../lib/geo'
import { CONNECTIONS, firstCatchable, LINES } from '../lib/schedule'
import { relativeLabel } from '../lib/format'
import { CheckIcon, LocationIcon } from './icons'

const MODE_KEY = 'ijhop:travelmode'
const MODES: TravelMode[] = ['lopen', 'fiets', 'scooter']
const MODE_EMOJI: Record<TravelMode, string> = { lopen: '🚶', fiets: '🚲', scooter: '🛵' }

interface CatchPanelProps {
  nowSecondOfWeek: number
}

export function CatchPanel({ nowSecondOfWeek }: CatchPanelProps) {
  const { t, lang } = useI18n()
  const geo = useGeolocation()
  const [mode, setMode] = useState<TravelMode>(() => {
    try {
      const m = localStorage.getItem(MODE_KEY) as TravelMode | null
      return m && MODES.includes(m) ? m : 'lopen'
    } catch {
      return 'lopen'
    }
  })
  const chooseMode = (m: TravelMode) => {
    setMode(m)
    try {
      localStorage.setItem(MODE_KEY, m)
    } catch {
      /* faal stil */
    }
  }

  const nearest = geo.coords ? pierDistances(geo.coords)[0] : null
  const outbound = nearest ? CONNECTIONS.filter((c) => c.from === nearest.stop) : []
  const travel = nearest ? travelSeconds(nearest.meters, mode) : 0
  const modeLabel = { lopen: t.modeWalk, fiets: t.modeBike, scooter: t.modeScooter }

  return (
    <section className="card animate-riseIn p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{t.catchTitle}</h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{t.catchSubtitle}</p>
        </div>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-f7/10 text-f7">
          <LocationIcon className="h-5 w-5" />
        </span>
      </div>

      {geo.status !== 'ready' && (
        <button
          type="button"
          onClick={geo.request}
          disabled={geo.status === 'locating'}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
        >
          <LocationIcon className="h-4.5 w-4.5" />
          {geo.status === 'locating' ? t.locating : t.useLocation}
        </button>
      )}

      {geo.status === 'denied' && (
        <p className="mt-3 text-sm text-f4">{t.locationDenied}</p>
      )}
      {geo.status === 'unavailable' && (
        <p className="mt-3 text-sm text-f4">{t.locationUnavailable}</p>
      )}

      {nearest && (
        <div className="mt-4 space-y-4">
          {/* Hoe ga je naar de pont? Bepaalt de reistijd-schatting. */}
          <div>
            <p className="mb-1.5 text-xs uppercase tracking-wide text-slate-400">{t.travelBy}</p>
            <div className="flex gap-1.5 rounded-2xl bg-slate-100 p-1 dark:bg-white/5">
              {MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => chooseMode(m)}
                  aria-pressed={mode === m}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-sm font-semibold transition ${
                    mode === m
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-white/15 dark:text-white'
                      : 'text-slate-500 dark:text-slate-300'
                  }`}
                >
                  <span>{MODE_EMOJI[m]}</span>
                  {modeLabel[m]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 dark:bg-white/5">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">{t.nearestPier}</p>
              <p className="font-bold">{t.stopNames[nearest.stop]}</p>
            </div>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300">
              <span>{MODE_EMOJI[mode]}</span>
              {Math.max(1, Math.round(travel / 60))} {t.min}
              <span className="text-slate-400">· {formatDistance(nearest.meters)}</span>
            </div>
          </div>

          <ul className="space-y-2.5">
            {outbound.map((c) => {
              const dep = firstCatchable(c.from, c.to, nowSecondOfWeek, travel)
              const color = LINES[c.line].color
              const leaveIn = dep ? dep.secondsUntil - travel : 0
              const mustLeaveNow = leaveIn <= 60
              return (
                <li
                  key={`${c.from}-${c.to}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 px-4 py-3 dark:border-white/5"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="pill text-white" style={{ backgroundColor: color }}>
                      {c.line}
                    </span>
                    <span className="text-sm font-semibold">{t.stopNames[c.to]}</span>
                  </div>
                  {dep ? (
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-1.5 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        <CheckIcon className="h-4 w-4" />
                        {t.canMake} · {dep.dep}
                      </div>
                      <p className="tnum text-xs text-slate-400">
                        {mustLeaveNow ? t.leaveNow : `${t.leaveIn} ${relativeLabel(leaveIn, lang)}`}
                      </p>
                    </div>
                  ) : (
                    <span className="text-sm font-semibold text-f4">{t.cannotMake}</span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
