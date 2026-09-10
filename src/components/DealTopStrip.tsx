import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/i18n'
import { track } from '../lib/analytics'
import { dealCardMode, dealWalkLabel, topStripVisible } from '../lib/dealCard'
import type { Deal, MyCode } from '../lib/deals'

/**
 * De strook boven de klok.
 *
 * Eén regel, hooguit 44 pixels hoog, en alleen 's avonds tussen half vijf en
 * negen op een dag dat er een deal loopt. Boven de klok is de duurste plek
 * van het scherm: daar hoort niets te staan dat er niet echt toe doet, en
 * zeker niet als iemand naar zijn werk moet.
 *
 * Wie de code al heeft ziet hier zijn code en gaat met één tik naar het
 * scherm dat hij aan de kassa laat zien. De rest springt naar de kaart
 * verderop, want de beslissing hoort daar en niet hier.
 *
 * Wegklikken geldt voor de hele dealweek. Eén keer nee is genoeg.
 */

const DISMISS_KEY = 'ijhop:deal:strip'

interface DealTopStripProps {
  deal: Deal | null
  code: MyCode | null
  departStops: string[]
  arriveStops: string[]
  /** De code tonen (als die er is), anders naar de kaart springen. */
  onOpenCode: () => void
  onScrollToCard: () => void
  preview?: boolean
}

function gelezenDismiss(): string | null {
  try {
    return localStorage.getItem(DISMISS_KEY)
  } catch {
    return null
  }
}

export function DealTopStrip({
  deal,
  code,
  departStops,
  arriveStops,
  onOpenCode,
  onScrollToCard,
  preview = false,
}: DealTopStripProps) {
  const { t, lang } = useI18n()
  const [weggeklikt, setWeggeklikt] = useState<string | null>(() => gelezenDismiss())
  const [now, setNow] = useState(() => new Date())
  const [gemeld, setGemeld] = useState(false)

  // Elke minuut kijken of het venster open of dicht gaat. Vaker hoeft niet:
  // deze strook verschijnt op de minuut, niet op de seconde.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const zichtbaar = topStripVisible(deal, now, weggeklikt, preview)
  const mode = dealCardMode(now)

  useEffect(() => {
    if (!zichtbaar || gemeld || !deal || preview) return
    setGemeld(true)
    track('deal_strip_seen', { deal_id: deal.id, card_mode: mode, has_code: code != null })
  }, [zichtbaar, gemeld, deal, preview, mode, code])

  if (!zichtbaar || !deal) return null

  const heeftCode = code != null
  const waar = dealWalkLabel(deal.stop_id, departStops, arriveStops, deal.walk_min, lang)

  const tik = () => {
    if (!preview) {
      track('deal_strip_tap', { deal_id: deal.id, card_mode: mode, has_code: heeftCode })
    }
    if (heeftCode) onOpenCode()
    else onScrollToCard()
  }

  const wegklikken = () => {
    setWeggeklikt(deal.valid_from)
    try {
      localStorage.setItem(DISMISS_KEY, deal.valid_from)
    } catch {
      /* stil */
    }
  }

  return (
    <div className="animate-fadeIn flex h-11 items-stretch gap-1">
      <button
        type="button"
        onClick={tik}
        className="card flex min-w-0 flex-1 items-center gap-2 px-3 py-0 text-left"
      >
        {deal.partner.logo_url ? (
          <img
            src={deal.partner.logo_url}
            alt={deal.partner.name}
            loading="lazy"
            decoding="async"
            className="h-7 w-7 shrink-0 rounded-lg bg-white object-contain ring-1 ring-slate-100 dark:ring-white/10"
          />
        ) : (
          <span
            aria-hidden="true"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand/10 text-xs font-bold text-brand"
          >
            {deal.partner.name.slice(0, 1).toUpperCase()}
          </span>
        )}

        <span className="min-w-0 flex-1 truncate text-xs leading-tight">
          {heeftCode ? (
            <>
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {t.deals.yourDeal}
              </span>
              <span aria-hidden="true" className="text-slate-400"> · </span>
              <span className="font-mono font-bold tracking-wider text-slate-900 dark:text-white">
                {code.code}
              </span>
            </>
          ) : (
            <>
              <span className="font-semibold text-slate-800 dark:text-slate-100">{deal.offer}</span>
              <span aria-hidden="true" className="text-slate-400"> · </span>
              <span className="text-slate-500 dark:text-slate-400">{waar}</span>
            </>
          )}
        </span>

        <span aria-hidden="true" className="shrink-0 text-slate-400">
          ›
        </span>
      </button>

      <button
        type="button"
        onClick={wegklikken}
        aria-label={t.deals.stripDismiss}
        title={t.deals.stripDismiss}
        className="card grid w-11 shrink-0 place-items-center px-0 py-0 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
      >
        <span aria-hidden="true" className="text-sm">
          ✕
        </span>
      </button>
    </div>
  )
}
