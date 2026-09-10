import { useCallback, useEffect, useState } from 'react'
import {
  claimCode,
  claimPreviewCode,
  fetchPontdeal,
  fetchPreviewDeal,
  isLive,
  previewDealId,
  readCode,
} from '../lib/deals'
import type { MyCode, Pontdeal } from '../lib/deals'

/**
 * Haalt de Pontdeal op voor de steigers waar deze bezoeker op wacht.
 *
 * Eén keer per keer dat de app opent. De deal verandert per week, niet per
 * minuut, dus er is geen reden om hier te blijven pollen; dat zou de klok
 * alleen maar in de weg zitten.
 *
 * Staat er `?preview=deal:<id>` in de URL, dan vragen we eerst de
 * voorvertoning. Die krijgt alleen een ingelogde admin: de database beslist,
 * niet deze code. Lukt het niet, dan valt de app terug op de gewone deal en
 * merkt de bezoeker nergens aan dat er iets geprobeerd is.
 */
export function useDeal(stops: string[]) {
  const [data, setData] = useState<Pontdeal | null>(null)
  const [code, setCode] = useState<MyCode | null>(null)
  const [claiming, setClaiming] = useState(false)
  const sleutel = stops.join(',')
  const previewId = typeof window === 'undefined' ? null : previewDealId(window.location.search)

  useEffect(() => {
    let alive = true

    const laden = async () => {
      if (previewId) {
        const voorvertoning = await fetchPreviewDeal(previewId)
        if (!alive) return
        if (voorvertoning) {
          setData(voorvertoning)
          setCode(voorvertoning.my_code ?? null)
          return
        }
        // Geen admin, of de deal bestaat niet: doe alsof er niets gevraagd is.
      }
      const res = await fetchPontdeal(sleutel ? sleutel.split(',') : [])
      if (!alive || !res) return
      setData(res)
      // Wat de server weet gaat voor; anders wat er lokaal bewaard staat,
      // want zonder bereik moet de code er ook zijn.
      if (res.deal) setCode(res.my_code ?? (await readCode(res.deal.id)))
    }

    void laden()
    return () => {
      alive = false
    }
  }, [sleutel, previewId])

  const preview = data?.preview === true

  const claim = useCallback(async () => {
    if (!data?.deal || claiming) return null
    setClaiming(true)
    const res = preview ? await claimPreviewCode(data.deal.id) : await claimCode(data.deal.id)
    setClaiming(false)
    if (res) setCode(res)
    return res
  }, [data, claiming, preview])

  // In preview negeren we het venster: je bekijkt hem juist buiten de week.
  const deal = data?.deal && (preview || isLive(data.deal)) ? data.deal : null

  return {
    deal,
    next: data?.next ?? null,
    redeemedWeek: data?.redeemed_week ?? 0,
    code,
    claiming,
    claim,
    preview,
  }
}
