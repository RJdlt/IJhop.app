import { useReactionDuel } from '../hooks/useReactionDuel'

export function ReactionDuel({
  channelName, userId, nick, playerCount,
}: { channelName: string | null; userId: string | null; nick: string; playerCount: number }) {
  const { phase, ranking, start, tap, reset } = useReactionDuel(channelName, userId, nick, playerCount)
  const btn = 'w-full rounded-2xl px-4 py-3 text-sm font-semibold transition'

  if (phase === 'idle')
    return <button onClick={start} className={`${btn} bg-brand/10 text-brand hover:bg-brand/20`}>🎮 Speel een tik-duel</button>
  if (phase === 'countdown')
    return <button onClick={tap} className={`${btn} bg-slate-100 text-slate-500 dark:bg-white/5`}>Maak je klaar… (niet te vroeg!)</button>
  if (phase === 'go')
    return <button onClick={tap} className={`${btn} animate-pulse bg-brand text-white text-lg`}>TIK NU!</button>
  return (
    <div className="rounded-2xl bg-slate-100 p-3 dark:bg-white/5">
      <ol className="space-y-1 text-sm">
        {ranking.map((r, i) => (
          <li key={r.userId} className="flex justify-between">
            <span>{i === 0 && r.reactionMs >= 0 ? '🏆 ' : ''}{r.nick}</span>
            <span className="tabular-nums">{r.reactionMs < 0 ? 'te vroeg ❌' : `${r.reactionMs} ms`}</span>
          </li>
        ))}
      </ol>
      <button onClick={() => { reset(); start() }} className={`${btn} mt-2 bg-brand/10 text-brand`}>Nog een keer</button>
    </div>
  )
}
