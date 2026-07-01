import { useI18n } from '../i18n/i18n'
import { getHighScore } from '../arcade/scoreStore'
import { getChallengeState } from '../arcade/games/ponthop/challenge'

interface ArcadeSnackProps {
  onOpen: () => void
}

/**
 * Premium "speel terwijl je wacht"-portaal op het countdown-scherm. Een donkere
 * glow-kaart die opvalt op het lichte scherm, met je record en de uitdaging van
 * vandaag. Opent de arcade als overlay zonder de countdown eronder te raken.
 */
export function ArcadeSnack({ onOpen }: ArcadeSnackProps) {
  const { t } = useI18n()
  const best = getHighScore('ponthop')
  const { challenge: ch, progress, done } = getChallengeState()
  const chLabel =
    ch.kind === 'coins'
      ? `${progress}/${ch.target} 🧇`
      : ch.kind === 'crossings'
        ? `${progress}/${ch.target}×`
        : `${progress}/${ch.target} pt`

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t.arcade.playWhileWaiting}
      className="animate-riseIn relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0c6b52] to-[#04241c] p-4 text-left text-white shadow-lg ring-1 ring-white/10 transition active:scale-[0.99]"
    >
      <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-emerald-400/20 blur-2xl" />
      <div className="relative flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10 text-2xl ring-1 ring-white/10">
          🕹️
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-extrabold leading-tight">{t.arcade.playWhileWaiting}</span>
          <span className="block truncate text-xs text-white/60">Pont Hop · IJhop Arcade</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-emerald-400 to-brand px-3.5 py-2 text-sm font-extrabold text-white shadow-[0_10px_30px_-8px_rgba(29,158,117,0.85)]">
          ▶ {t.arcade.play}
        </span>
      </div>
      <div className="relative mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-white/10 px-2.5 py-1 font-semibold">
          🏆 {t.arcade.best} {best}
        </span>
        <span className="rounded-full bg-white/10 px-2.5 py-1 font-semibold">
          🎯 {done ? '✓' : chLabel}
        </span>
      </div>
    </button>
  )
}
