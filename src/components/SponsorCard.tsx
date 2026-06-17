import { useState } from 'react'
import { SPONSOR } from '../lib/sponsor'

/**
 * Rustige, verzorgde sponsorpresentatie in IJhop-stijl. Geen banners of pop-ups.
 * - variant "full": logo-tegel + label + merknaam + pay-off + cta (hoofdscherm).
 * - variant "compact": label + logo-tegel + merknaam, klein (game-over).
 * Het echte logo komt uit /public; valt netjes terug op een VL-tegel als het
 * bestand (nog) ontbreekt.
 */
function LogoTile({ size }: { size: number }) {
  const [failed, setFailed] = useState(false)
  const dim = { width: size, height: size }
  if (failed) {
    return (
      <span
        className="grid shrink-0 place-items-center rounded-xl text-sm font-black ring-1 ring-black/5"
        style={{ ...dim, backgroundColor: '#0F1E33' }}
        aria-hidden
      >
        <span>
          <span style={{ color: '#F5F2EA' }}>V</span>
          <span style={{ color: SPONSOR.color }}>L</span>
        </span>
      </span>
    )
  }
  return (
    <img
      src={SPONSOR.logo}
      alt={`${SPONSOR.name} logo`}
      onError={() => setFailed(true)}
      style={dim}
      className="shrink-0 rounded-xl object-contain ring-1 ring-black/5"
    />
  )
}

export function SponsorCard({ variant = 'full' }: { variant?: 'full' | 'compact' }) {
  if (variant === 'compact') {
    return (
      <a
        href={SPONSOR.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-xl px-1.5 py-1 transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        <span className="text-[10px] font-medium uppercase tracking-wider text-white/55">
          {SPONSOR.label}
        </span>
        <LogoTile size={24} />
        <span className="text-xs font-semibold text-white/90">{SPONSOR.name}</span>
      </a>
    )
  }

  return (
    <a
      href={SPONSOR.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand dark:bg-white/5 dark:ring-white/10"
    >
      <LogoTile size={52} />
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          {SPONSOR.label}
        </span>
        <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">
          {SPONSOR.name}
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-slate-500 dark:text-slate-300">
          {SPONSOR.payoff}
        </span>
        <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand">
          {SPONSOR.cta}
          <span className="transition-transform group-hover:translate-x-0.5" aria-hidden>
            →
          </span>
        </span>
      </span>
    </a>
  )
}
