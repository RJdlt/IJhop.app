import { SPONSOR } from '../lib/sponsor'

/**
 * Rustige, smaakvolle sponsorpresentatie. Geen banners of pop-ups.
 * - variant "full": kaartje met pay-off (onderaan het hoofdscherm).
 * - variant "compact": één regeltje "powered by" (op het game-over-scherm).
 */
export function SponsorCard({ variant = 'full' }: { variant?: 'full' | 'compact' }) {
  if (variant === 'compact') {
    return (
      <a
        href={SPONSOR.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-white/70 transition hover:text-white"
      >
        <span>mede mogelijk gemaakt door</span>
        <span className="font-semibold" style={{ color: '#9be7c9' }}>
          {SPONSOR.name}
        </span>
      </a>
    )
  }

  return (
    <a
      href={SPONSOR.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-100 transition hover:ring-slate-200 dark:bg-white/5 dark:ring-white/10"
    >
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-lg font-black text-white"
        style={{ backgroundColor: SPONSOR.color }}
        aria-hidden
      >
        €
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-medium uppercase tracking-wide text-slate-400">
          Mede mogelijk gemaakt door
        </span>
        <span className="block truncate text-sm font-bold text-slate-800 dark:text-white">
          {SPONSOR.name}
        </span>
        <span className="block truncate text-xs text-slate-500 dark:text-slate-300">
          {SPONSOR.payoff}
        </span>
      </span>
      <span className="shrink-0 text-slate-300" aria-hidden>
        →
      </span>
    </a>
  )
}
