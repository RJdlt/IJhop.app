import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/i18n'
import { track } from '../lib/analytics'
import { formatDealCountdown, secondsUntil, SOCIAL_PROOF_MIN } from '../lib/deals'
import type { Deal, NextDeal } from '../lib/deals'
import { STOPS } from '../lib/schedule'

/**
 * De Pontdeal op het klokscherm.
 *
 * Dit is een beloning voor wie toch al staat te wachten, geen advertentie.
 * Daarom staat hij onder de klok en nooit erboven, verschijnt hij zonder
 * pop-up of overlay, en is er per week één aanbod in plaats van een lijst.
 *
 * Maandag tot en met woensdag is er iets te halen. De rest van de week alleen
 * een stille regel dat er maandag weer een deal is: dat bouwt de gewoonte op
 * zonder iets te vragen.
 */

interface DealCardProps {
  deal: Deal | null
  next: NextDeal | null
  redeemedWeek: number
  hasCode: boolean
  onGrab: () => void
  /** Voorvertoning voor een admin: wel tonen, niet meten. */
  preview?: boolean
}

export function DealCard({ deal, next, redeemedWeek, hasCode, onGrab, preview = false }: DealCardProps) {
  const { t, lang } = useI18n()
  const [now, setNow] = useState(() => new Date())

  // De afteller loopt in minuten, niet in seconden: dit is een deal die
  // dagen duurt, geen aftelklok naar een pont.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])

  // In een voorvertoning meten we niets. Een deal die nog niet loopt hoort
  // geen vertoningen te verzamelen, en al helemaal niet die van de admin die
  // hem aan het nakijken is.
  useEffect(() => {
    if (deal && !preview) track('deal_seen', { deal_id: deal.id, stop: deal.stop_id })
  }, [deal, preview])

  if (!deal) {
    if (!next) return null
    return (
      <section className="card animate-riseIn flex items-center gap-3 px-5 py-3.5">
        <PartnerLogo name={next.partner.name} url={next.partner.logo_url} klein />
        <p className="text-sm text-slate-500 dark:text-slate-400">{t.deals.teaser}</p>
      </section>
    )
  }

  const stop = STOPS[deal.stop_id]?.name ?? deal.stop_id
  const seconden = secondsUntil(deal.valid_to, now)

  return (
    <section className="card animate-dealIn px-5 py-4">
      {preview && (
        <p className="mb-3 rounded-xl bg-amber-100 px-3 py-2 text-[11px] font-medium leading-snug text-amber-900 dark:bg-amber-500/15 dark:text-amber-200">
          <strong>{t.deals.previewTitle}</strong> · {t.deals.previewNote}
        </p>
      )}
      <div className="flex items-start gap-3">
        <PartnerLogo name={deal.partner.name} url={deal.partner.logo_url} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t.deals.badge} · {deal.partner.name}
          </p>
          <p className="mt-0.5 text-base font-bold leading-snug text-slate-900 dark:text-white">
            {deal.offer}
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {deal.walk_min != null ? `${deal.walk_min} ${t.deals.walkFrom} ${stop}` : stop}
            <span aria-hidden="true"> · </span>
            <span className="tabular-nums">{formatDealCountdown(seconden, lang)}</span>
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onGrab}
        className="mt-3 w-full rounded-2xl bg-brand-deep px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-dark"
      >
        {hasCode ? t.deals.yourCode : t.deals.grab}
      </button>

      {/* Sociale bevestiging alleen als het aantal iets voorstelt. Onder de
          tien zegt een teller vooral dat niemand het doet. */}
      {redeemedWeek >= SOCIAL_PROOF_MIN && (
        <p className="mt-2 text-center text-[11px] text-slate-500 dark:text-slate-400">
          {redeemedWeek} {t.deals.redeemedThisWeek}
        </p>
      )}
    </section>
  )
}

function PartnerLogo({ name, url, klein = false }: { name: string; url: string | null; klein?: boolean }) {
  const maat = klein ? 'h-8 w-8 text-sm' : 'h-11 w-11 text-lg'
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className={`${maat} shrink-0 rounded-2xl object-cover ring-1 ring-slate-100 dark:ring-white/10`}
      />
    )
  }
  // Geen logo: de eerste letter in de merkkleur leest rustiger dan een gat.
  return (
    <span
      aria-hidden="true"
      className={`${maat} grid shrink-0 place-items-center rounded-2xl bg-brand/10 font-bold text-brand`}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}
