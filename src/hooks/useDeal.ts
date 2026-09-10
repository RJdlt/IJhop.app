import { useCallback, useEffect, useState } from 'react'
import { claimCode, fetchPontdeal, isLive, readCode } from '../lib/deals'
import type { MyCode, Pontdeal } from '../lib/deals'

/**
 * Haalt de Pontdeal op voor de steigers waar deze bezoeker op wacht.
 *
 * Eén keer per keer dat de app opent. De deal verandert per week, niet per
 * minuut, dus er is geen reden om hier te blijven pollen; dat zou de klok
 * alleen maar in de weg zitten.
 */
export function useDeal(stops: string[]) {
  const [data, setData] = useState<Pontdeal | null>(null)
  const [code, setCode] = useState<MyCode | null>(null)
  const [claiming, setClaiming] = useState(false)
  const sleutel = stops.join(',')

  useEffect(() => {
    let alive = true
    fetchPontdeal(sleutel ? sleutel.split(',') : []).then(async (res) => {
      if (!alive || !res) return
      setData(res)
      // Wat de server weet gaat voor; anders wat er lokaal bewaard staat,
      // want zonder bereik moet de code er ook zijn.
      if (res.deal) setCode(res.my_code ?? (await readCode(res.deal.id)))
    })
    return () => {
      alive = false
    }
  }, [sleutel])

  const claim = useCallback(async () => {
    if (!data?.deal || claiming) return null
    setClaiming(true)
    const res = await claimCode(data.deal.id)
    setClaiming(false)
    if (res) setCode(res)
    return res
  }, [data, claiming])

  const deal = data?.deal && isLive(data.deal) ? data.deal : null

  return {
    deal,
    next: data?.next ?? null,
    redeemedWeek: data?.redeemed_week ?? 0,
    code,
    claiming,
    claim,
  }
}
