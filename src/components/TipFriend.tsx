import { useState } from 'react'
import { useI18n } from '../i18n/i18n'
import { track } from '../lib/analytics'
import { markTipSeen, shouldOfferTip, tipSeen } from '../lib/deals'

/**
 * Eén klein knopje, de dag nadat iemand een Pontdeal inwisselde, en daarna
 * nooit meer. Op het moment zelf staat hij aan een kassa; dan iets vragen is
 * de deal verzieken. De dag erna is de herinnering nog goed en de vraag klein.
 */
export function TipFriend({ redeemedAt }: { redeemedAt: string | null }) {
  const { t } = useI18n()
  const [weg, setWeg] = useState(false)
  const [seen] = useState(() => tipSeen())

  if (weg || !shouldOfferTip(redeemedAt, seen)) return null

  const deel = async () => {
    markTipSeen()
    setWeg(true)
    track('deal_tip_share')
    const url = typeof location !== 'undefined' ? location.origin : 'https://ijhop.app'
    try {
      if (navigator.share) {
        await navigator.share({ title: 'IJhop', text: t.deals.tipShare, url })
      } else {
        await navigator.clipboard?.writeText(url)
      }
    } catch {
      /* geannuleerd of niet ondersteund; het knopje is toch al weg */
    }
  }

  return (
    <button
      type="button"
      onClick={deel}
      className="self-start rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm ring-1 ring-slate-100 transition hover:bg-slate-50 dark:bg-white/5 dark:text-slate-300 dark:ring-white/10"
    >
      {t.deals.tipFriend}
    </button>
  )
}
