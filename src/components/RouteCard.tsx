import { useMemo } from 'react'
import { useI18n } from '../i18n/i18n'
import { clockCountdown, relativeLabel } from '../lib/format'
import { LINES, STOPS, nextDepartures } from '../lib/schedule'
import type { StopPair } from '../lib/schedule'
import { getNickname } from '../lib/nickname'
import { roomKeyFor, duelChannelFor } from '../lib/rooms'
import { usePresence } from '../hooks/usePresence'
import { SwapIcon } from './icons'
import { ReactionDuel } from './ReactionDuel'

interface RouteCardProps {
  connection: StopPair
  nowSecondOfWeek: number
  userId: string | null
  onSwap: () => void
  favorite?: boolean
  onToggleFav?: () => void
}

export function RouteCard({ connection, nowSecondOfWeek, userId, onSwap, favorite, onToggleFav }: RouteCardProps) {
  const { t, lang } = useI18n()
  const { from, to, line } = connection
  const color = LINES[line].color
  const departures = nextDepartures({ from, to, nowSecondOfWeek, limit: 4 })
  const next = departures[0]

  // Presence per route: wie wacht er mee op deze afvaart?
  const nick = useMemo(() => getNickname(), [])
  const roomKey = roomKeyFor(connection)
  const waiters = usePresence(roomKey, userId, nick)

  return (
    <section className="card animate-riseIn overflow-hidden">
      {/* Header strip */}
      <div className="flex items-center justify-between gap-3 px-5 pt-5">
        <div className="flex items-center gap-2.5">
          <span
            className="pill text-white"
            style={{ backgroundColor: color }}
          >
            {line}
          </span>
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <span>{STOPS[from]?.name ?? from}</span>
            <span className="text-slate-400">→</span>
            <span>{STOPS[to]?.name ?? to}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {onToggleFav && (
            <button
              type="button"
              onClick={onToggleFav}
              aria-pressed={favorite}
              aria-label={t.favorite}
              title={t.favorite}
              className={`grid h-9 w-9 place-items-center rounded-full text-lg transition ${
                favorite ? 'text-amber-400' : 'text-slate-300 hover:text-slate-400 dark:text-slate-600'
              }`}
            >
              {favorite ? '★' : '☆'}
            </button>
          )}
          <button
            type="button"
            onClick={onSwap}
            className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 dark:border-white/10 dark:hover:bg-white/5 dark:hover:text-white"
            aria-label={t.swapDirection}
            title={t.swapDirection}
          >
            <SwapIcon className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>

      {/* Headline next departure */}
      {next ? (
        <div className="px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {next.secondsUntil < 30 ? t.departingNow : t.departsIn}
          </p>
          <div className="mt-0.5 flex items-baseline gap-3">
            <span className="tnum text-5xl font-extrabold tracking-tight" style={{ color }}>
              {clockCountdown(next.secondsUntil)}
            </span>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {t.now} {next.dep} · {next.dur} {t.min} {t.crossing}
            </span>
          </div>
        </div>
      ) : (
        <p className="px-5 py-6 text-sm text-slate-500">{t.noDepartures}</p>
      )}

      {/* Following departures */}
      {departures.length > 1 && (
        <ul className="border-t border-slate-100 dark:border-white/5">
          {departures.slice(1).map((d, i) => (
            <li
              key={`${d.dep}-${i}`}
              className="flex items-center justify-between px-5 py-2.5 text-sm"
            >
              <span className="tnum font-semibold text-slate-700 dark:text-slate-200">{d.dep}</span>
              <span className="tnum text-slate-400">+{relativeLabel(d.secondsUntil, lang)}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Realtime tik-duel: alleen als er minstens twee mensen meewachten */}
      {waiters >= 2 && (
        <div className="border-t border-slate-100 px-5 py-4 dark:border-white/5">
          <p className="mb-2 text-xs font-medium text-slate-400">👥 {waiters} wachten mee</p>
          <ReactionDuel
            channelName={duelChannelFor(roomKey)}
            userId={userId}
            nick={nick}
            playerCount={waiters}
          />
        </div>
      )}
    </section>
  )
}
