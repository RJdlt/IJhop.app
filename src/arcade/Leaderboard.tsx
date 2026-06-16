import { useCallback, useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n/i18n'
import { subscribeScores, topScores, type Board, type Period } from './leaderboard'

interface LeaderboardProps {
  gameId: string
  /** Naam van de huidige speler, om de eigen rij te markeren. */
  youName?: string
  /** Bump deze waarde om een directe verversing af te dwingen (na een potje). */
  reloadKey?: number
}

const MEDALS = ['🥇', '🥈', '🥉']

export function Leaderboard({ gameId, youName, reloadKey }: LeaderboardProps) {
  const { t } = useI18n()
  const [period, setPeriod] = useState<Period>('all')
  const [board, setBoard] = useState<Board>({ rows: [] })
  const loadId = useRef(0)

  const load = useCallback(async () => {
    const id = ++loadId.current
    const next = await topScores(gameId, period, 10)
    if (id === loadId.current) setBoard(next) // negeer verlate antwoorden
  }, [gameId, period])

  // Laden bij periodewissel en na een afgerond potje.
  useEffect(() => {
    load()
  }, [load, reloadKey])

  // Live: nieuwe scores van wie dan ook verversen de lijst vanzelf.
  useEffect(() => subscribeScores(gameId, load), [gameId, load])

  const youInTop = board.you != null && board.you.rank <= board.rows.length

  return (
    <div className="w-full max-w-xs text-left">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
          🏆 {t.arcade.leaderboard}
        </p>
        <div className="flex gap-1 rounded-full bg-white/10 p-0.5 text-[11px]">
          {(['week', 'all'] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-full px-2 py-0.5 font-medium transition ${
                period === p ? 'bg-white text-brand-dark' : 'text-white/70'
              }`}
            >
              {p === 'week' ? t.arcade.thisWeek : t.arcade.allTime}
            </button>
          ))}
        </div>
      </div>

      {board.rows.length === 0 ? (
        <p className="text-xs text-white/50">{t.arcade.noScoresYet}</p>
      ) : (
        <ol className="flex flex-col gap-1">
          {board.rows.map((r, i) => {
            const mine =
              (board.you?.rank ?? -1) === i + 1 ||
              (youName != null && r.name === youName && board.you?.score === r.score)
            return (
              <li
                key={`${r.name}-${i}`}
                className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm ${
                  mine ? 'bg-amber-400/20 ring-1 ring-amber-400/40' : 'bg-white/5'
                }`}
              >
                <span className="w-5 shrink-0 text-center tabular-nums text-white/60">
                  {MEDALS[i] ?? i + 1}
                </span>
                <span className="flex-1 truncate">
                  {r.name}
                  {mine && (
                    <span className="ml-1.5 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-amber-950">
                      {t.arcade.you}
                    </span>
                  )}
                </span>
                <span className="font-semibold tabular-nums">{r.score}</span>
              </li>
            )
          })}
        </ol>
      )}

      {/* Jouw rang als je buiten de top-10 valt */}
      {board.you && !youInTop && (
        <div className="mt-1.5 flex items-center gap-2 rounded-lg bg-amber-400/20 px-2.5 py-1.5 text-sm ring-1 ring-amber-400/40">
          <span className="w-5 shrink-0 text-center tabular-nums text-white/70">
            {board.you.rank}
          </span>
          <span className="flex-1 truncate">
            {board.you.name}
            <span className="ml-1.5 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-amber-950">
              {t.arcade.you}
            </span>
          </span>
          <span className="font-semibold tabular-nums">{board.you.score}</span>
        </div>
      )}
    </div>
  )
}
