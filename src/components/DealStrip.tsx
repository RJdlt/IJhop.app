import { useI18n } from '../i18n/i18n'
import { dealValidityLabel, stripStatus } from '../lib/dealCard'
import type { Deal, MyCode } from '../lib/deals'
import { PartnerLogo } from './DealCard'

/**
 * De eigendomsstrook: "Jouw Pontdeal · AB37 · t/m woensdag".
 *
 * Vanaf het moment dat je de code hebt is de deal van jou, en dat hoort te
 * zien te zijn zonder ernaar te zoeken. Iets wat je hebt geef je niet
 * makkelijk op; dat is precies de bedoeling.
 *
 * Na inwisselen blijft er nog een dag een bevestiging staan, en daarna
 * verdwijnt de strook vanzelf. Geen kruisje om weg te klikken: hij gaat uit
 * zichzelf weg zodra hij niets meer betekent.
 */
interface DealStripProps {
  deal: Deal | null
  code: MyCode | null
  onOpen: () => void
}

export function DealStrip({ deal, code, onOpen }: DealStripProps) {
  const { t, lang } = useI18n()
  const status = stripStatus(code, deal?.valid_to ?? null, new Date())
  if (status === 'geen' || !code) return null

  if (status === 'ingewisseld') {
    return (
      <section className="card flex items-center gap-3 px-4 py-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-lg text-emerald-800" aria-hidden="true">
          ✓
        </span>
        <p className="min-w-0 flex-1 text-sm text-slate-700 dark:text-slate-200">
          <strong>{t.deals.redeemed}</strong>
          <span className="text-slate-500 dark:text-slate-400"> · {t.deals.teaser}</span>
        </p>
      </section>
    )
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="card flex min-h-[44px] w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white dark:hover:bg-white/10"
    >
      {deal && <PartnerLogo name={deal.partner.name} url={deal.partner.logo_url} klein />}
      <p className="min-w-0 flex-1 text-sm text-slate-700 dark:text-slate-200">
        <strong>{t.deals.yourDeal}</strong>
        <span aria-hidden="true"> · </span>
        <span className="font-mono font-bold tracking-wider text-slate-900 dark:text-white">
          {code.code}
        </span>
        {deal && (
          <span className="text-slate-500 dark:text-slate-400">
            {' '}
            · {dealValidityLabel(deal.valid_to, new Date(), lang, true)}
          </span>
        )}
      </p>
      <span aria-hidden="true" className="shrink-0 text-slate-400">
        ›
      </span>
    </button>
  )
}
