import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/i18n'
import { track } from '../lib/analytics'
import { SOCIAL_PROOF_MIN } from '../lib/deals'
import type { Deal, NextDeal } from '../lib/deals'
import { dealCardMode, dealValidityLabel, dealWalkLabel, modeShowsPhoto } from '../lib/dealCard'
import type { DealCardMode } from '../lib/dealCard'

/**
 * De Pontdeal op het klokscherm.
 *
 * Dit is een beloning voor wie toch al staat te wachten, geen advertentie.
 * Daarom staat hij onder de klok en nooit erboven, verschijnt hij zonder
 * pop-up of overlay, en is er per week één aanbod in plaats van een lijst.
 *
 * De kaart past zich aan het dagdeel aan (zie dealCardMode): 's ochtends
 * alleen het hoognodige, 's avonds met foto. Wie haast heeft krijgt geen
 * pizza in beeld geduwd.
 */

interface DealCardProps {
  deal: Deal | null
  next: NextDeal | null
  redeemedWeek: number
  hasCode: boolean
  onGrab: () => void
  /** Steigers waar de bezoeker vertrekt, en waar hij aankomt. Samen bepalen
   *  ze of de zaak aan zijn eigen kant ligt of aan de overkant. */
  departStops?: string[]
  arriveStops?: string[]
  /** Voorvertoning voor een admin: wel tonen, niet meten. */
  preview?: boolean
  /** Vaste stand, voor de demo-kaart en voor tests. */
  forceMode?: DealCardMode
}

export function DealCard({
  deal,
  next,
  redeemedWeek,
  hasCode,
  onGrab,
  departStops = [],
  arriveStops = [],
  preview = false,
  forceMode,
}: DealCardProps) {
  const { t, lang } = useI18n()
  const [now, setNow] = useState(() => new Date())

  // Elke minuut: genoeg om rond 10:30 en 16:30 van vorm te wisselen en om
  // "t/m woensdag" op tijd "nog vandaag" te laten worden. Dit is een deal die
  // dagen loopt, geen aftelklok naar een pont.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const mode = forceMode ?? dealCardMode(now)
  const foto = deal?.photo_url ?? null
  const toonFoto = modeShowsPhoto(mode) && !!foto

  useEffect(() => {
    if (deal && !preview) {
      track('deal_seen', {
        deal_id: deal.id,
        stop: deal.stop_id,
        card_mode: mode,
        has_photo: toonFoto,
      })
    }
    // Alleen bij een andere deal of een andere kaartvorm opnieuw melden; niet
    // elke minuut als de klok tikt.
  }, [deal, preview, mode, toonFoto])

  if (!deal) {
    if (!next) return null
    return (
      <section className="card animate-riseIn flex items-center gap-3 px-5 py-3.5">
        <PartnerLogo name={next.partner.name} url={next.partner.logo_url} klein />
        <p className="text-sm text-slate-500 dark:text-slate-400">{t.deals.teaser}</p>
      </section>
    )
  }

  const waar = dealWalkLabel(deal.stop_id, departStops, arriveStops, deal.walk_min, lang)
  const geldig = dealValidityLabel(deal.valid_to, now, lang, true)
  const knop = (
    <button
      type="button"
      onClick={onGrab}
      className="w-full rounded-2xl bg-brand-deep px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-dark"
    >
      {hasCode ? t.deals.yourDeal : t.deals.grab}
    </button>
  )

  const previewBalk = preview && (
    <p className="mb-3 rounded-xl bg-amber-100 px-3 py-2 text-[11px] font-medium leading-snug text-amber-900 dark:bg-amber-500/15 dark:text-amber-200">
      <strong>{t.deals.previewTitle}</strong> · {t.deals.previewNote}
    </p>
  )

  // ---- Compact: ochtendspits en nacht. Eén regel, één knop. ----
  if (mode === 'compact') {
    return (
      <section className="card animate-dealIn px-5 py-3.5" data-mode="compact">
        {previewBalk}
        <div className="flex items-center gap-3">
          <PartnerLogo name={deal.partner.name} url={deal.partner.logo_url} klein />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{deal.offer}</p>
            <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
              {deal.partner.name} · {waar}
            </p>
          </div>
        </div>
        <div className="mt-2.5">{knop}</div>
        <SocialProof aantal={redeemedWeek} tekst={t.deals.redeemedThisWeek} />
      </section>
    )
  }

  // ---- Normaal en vol ----
  return (
    <section className="card animate-dealIn overflow-hidden" data-mode={mode}>
      {toonFoto && (
        <img
          src={foto as string}
          alt={`${deal.offer}, bij ${deal.partner.name}`}
          loading="lazy"
          decoding="async"
          className="aspect-video w-full object-cover"
        />
      )}
      <div className="px-5 py-4">
        {previewBalk}
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
              {waar}
              {geldig && (
                <>
                  <span aria-hidden="true"> · </span>
                  {geldig}
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mt-3">{knop}</div>
        <SocialProof aantal={redeemedWeek} tekst={t.deals.redeemedThisWeek} />
      </div>
    </section>
  )
}

/**
 * Sociale bevestiging, maar alleen bij een aantal dat iets voorstelt. Onder de
 * tien zegt een teller vooral dat niemand het doet, en dat is het tegendeel
 * van wat hij moet doen.
 */
function SocialProof({ aantal, tekst }: { aantal: number; tekst: string }) {
  if (aantal < SOCIAL_PROOF_MIN) return null
  return (
    <p className="mt-2 text-center text-[11px] text-slate-500 dark:text-slate-400">
      {tekst.replace('{n}', String(aantal))}
    </p>
  )
}

export function PartnerLogo({
  name,
  url,
  klein = false,
}: {
  name: string
  url: string | null
  klein?: boolean
}) {
  const maat = klein ? 'h-9 w-9 text-sm' : 'h-11 w-11 text-lg'
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        loading="lazy"
        decoding="async"
        className={`${maat} shrink-0 rounded-2xl bg-white object-contain ring-1 ring-slate-100 dark:ring-white/10`}
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
