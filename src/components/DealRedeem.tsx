import { useEffect, useMemo } from 'react'
import { useI18n } from '../i18n/i18n'
import { track } from '../lib/analytics'
import { spellOut } from '../lib/dealCode'
import { mapsUrl, redeemUrl } from '../lib/deals'
import type { Deal, MyCode } from '../lib/deals'
import { isIOS } from '../lib/display'
import { qrPath } from '../lib/qr'
import { STOPS } from '../lib/schedule'

/**
 * Het inwisselscherm: jouw code, schermvullend.
 *
 * Vanaf hier is de deal van jou. Dat is de reden dat er "Jouw code" boven
 * staat en dat er bij staat dat hij in de app bewaard is: iets wat je hebt
 * geef je niet makkelijk op, en dat is precies de bedoeling.
 *
 * De code staat er als tekst én als QR. De tekst is er voor de kassa die
 * overtypt en voor een schermlezer (letter voor letter voorgelezen); de QR
 * voor de kassa die scant. Allebei werken ze zonder bereik.
 */

interface DealRedeemProps {
  deal: Deal
  code: MyCode
  onClose: () => void
  /** Voorvertoning voor een admin: wel tonen, niet meten. */
  preview?: boolean
}

export function DealRedeem({ deal, code, onClose, preview = false }: DealRedeemProps) {
  const { t } = useI18n()
  const ios = isIOS()
  const url = useMemo(() => redeemUrl(deal.partner.slug, code.code), [deal.partner.slug, code.code])
  const qr = useMemo(() => qrPath(url), [url])
  const stop = STOPS[deal.stop_id]?.name ?? deal.stop_id
  const ingewisseld = code.redeemed_at != null

  useEffect(() => {
    if (!preview) track('deal_code_shown', { deal_id: deal.id, redeemed: ingewisseld })
  }, [deal.id, ingewisseld, preview])

  // Terug met de escape-toets, en met de terugknop van de telefoon.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${t.deals.yourCode}: ${deal.partner.name}`}
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 dark:bg-slate-950"
    >
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col gap-4 px-4 py-6">
        <header className="flex items-baseline justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {preview ? `${t.deals.previewTitle} · ` : ''}
            {t.deals.badge} · {deal.partner.name}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium text-slate-500 underline-offset-2 hover:underline dark:text-slate-400"
          >
            {t.deals.close}
          </button>
        </header>

        {ingewisseld ? (
          <section className="card flex flex-col items-center gap-1 px-5 py-8 text-center">
            <span className="text-4xl" aria-hidden="true">✓</span>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t.deals.redeemed}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t.deals.redeemedNote}</p>
            <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">
              {t.deals.teaser}
            </p>
          </section>
        ) : (
          <section className="card px-5 py-6 text-center">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {preview ? t.deals.previewCode : `${t.deals.yourCode} · ${t.deals.savedInApp}`}
            </p>

            {/* De code zelf. Groot, met ruimte tussen de tekens, en voor een
                schermlezer letter voor letter. */}
            <p
              className="mt-2 font-mono text-6xl font-bold tracking-[0.15em] text-slate-900 dark:text-white"
              aria-hidden="true"
            >
              {code.code}
            </p>
            <span className="sr-only">{spellOut(code.code)}</span>

            <div className="mt-5 flex justify-center">
              <svg
                viewBox={`0 0 ${qr.size} ${qr.size}`}
                className="h-44 w-44 rounded-xl bg-white p-2 text-slate-900 ring-1 ring-slate-100"
                role="img"
                aria-label={`QR-code voor ${code.code}`}
              >
                <path d={qr.path} fill="currentColor" shapeRendering="crispEdges" />
              </svg>
            </div>

            <p className="mt-5 text-base font-semibold text-slate-900 dark:text-white">{deal.offer}</p>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              {deal.partner.name}
              {deal.walk_min != null ? ` · ${deal.walk_min} ${t.deals.walkFrom} ${stop}` : ''}
            </p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t.deals.validUntil}</p>
          </section>
        )}

        <a
          href={mapsUrl(deal.partner, ios)}
          target="_blank"
          rel="noreferrer"
          onClick={() => !preview && track('deal_route', { deal_id: deal.id })}
          className="rounded-2xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900"
        >
          {t.deals.route}
        </a>

        {preview ? (
          <p className="rounded-xl bg-amber-100 px-3 py-2 text-center text-xs leading-relaxed text-amber-900">
            {t.deals.previewNote} De kassa neemt deze code aan en meldt erbij dat het een testcode is.
          </p>
        ) : (
          <p className="text-center text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {t.deals.howTo}
            <br />
            {t.deals.offlineNote}
          </p>
        )}
      </div>
    </div>
  )
}
