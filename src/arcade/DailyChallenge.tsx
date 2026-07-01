import { getChallengeState } from './games/ponthop/challenge'

/**
 * Kaartje in het arcade-menu met de dagelijkse uitdaging plus streak. Leest de
 * stand uit localStorage bij het tonen; werkt zich bij zodra je terug in het
 * menu komt na een potje.
 */
export function DailyChallenge() {
  const { challenge: ch, progress, done, streak } = getChallengeState()
  const desc =
    ch.kind === 'coins'
      ? `Pak ${ch.target} stroopwafels`
      : ch.kind === 'crossings'
        ? `Steek ${ch.target} keer over`
        : `Haal ${ch.target} punten in één potje`
  const pct = Math.min(100, Math.round((progress / ch.target) * 100))

  return (
    <div className="w-full max-w-xs text-left">
      <div className="rounded-2xl bg-white/10 p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
            🎯 Uitdaging van vandaag
          </p>
          {streak > 1 && (
            <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[11px] font-bold text-amber-200">
              🔥 {streak} dagen
            </span>
          )}
        </div>
        <p className="mt-1 text-sm font-semibold text-white">{desc}</p>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full ${done ? 'bg-emerald-400' : 'bg-amber-400'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px] text-white/60">
          <span className="tabular-nums">
            {progress}/{ch.target}
          </span>
          <span>{done ? '✓ Gehaald' : `Beloning: 🧇 ${ch.reward}`}</span>
        </div>
      </div>
    </div>
  )
}
