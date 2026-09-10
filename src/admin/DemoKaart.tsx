import { useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { DealCard } from '../components/DealCard'
import { I18nProvider } from '../i18n/i18n'
import type { Deal } from '../lib/deals'
import { validateOffer } from '../lib/dealCard'
import { dealWeekWindow, mondayOf } from '../lib/time'

/**
 * De demo-kaart voor aan de toonbank.
 *
 * Een zaak zegt sneller ja als hij zichzelf al in de app ziet staan. Dit
 * rendert de échte dealkaart, met hún logo en foto, en zet daar een plaatje
 * van neer dat je kunt laten zien of appen.
 *
 * Twee maten: 1080x1350 voor een bericht of een post, 1080x1920 voor een
 * story. In beide gevallen staat de kaart zelf op ware grootte in het midden
 * van een achtergrond in de app-stijl, want een uitgerekte kaart oogt als een
 * mockup en niet als een app.
 *
 * Alles gebeurt in de browser. Geen externe dienst: het gaat om het logo van
 * een zaak die nog niet getekend heeft.
 */

interface DemoKaartProps {
  partner: { id: string; name: string; slug: string; logo_url: string | null; photo_url: string | null }
  onSluit: () => void
}

const MATEN: { naam: string; w: number; h: number }[] = [
  { naam: 'bericht', w: 1080, h: 1350 },
  { naam: 'story', w: 1080, h: 1920 },
]

export function DemoKaart({ partner, onSluit }: DemoKaartProps) {
  const [aanbod, setAanbod] = useState('')
  const [bezig, setBezig] = useState<string | null>(null)
  const [fout, setFout] = useState<string | null>(null)
  const doek = useRef<HTMLDivElement>(null)

  const check = validateOffer(aanbod)
  // Het eerstvolgende venster dat nog niet voorbij is. Sta je op donderdag bij
  // een zaak, dan hoort er "t/m woensdag" op de kaart en niet "vanaf maandag":
  // je verkoopt de week die eraan komt.
  const venster = (() => {
    const dezeWeek = dealWeekWindow(mondayOf())
    if (dezeWeek && Date.parse(dezeWeek.to) > Date.now()) return dezeWeek
    return dealWeekWindow(mondayOf(new Date(Date.now() + 7 * 86_400_000)))
  })()
  const deal: Deal = {
    id: 'demo',
    offer: aanbod.trim() || 'Twee koffie voor 5 euro',
    stop_id: 'ndsmwerf',
    lines: [],
    walk_min: 3,
    // Het venster van deze week, zodat er "t/m woensdag" onder staat en niet
    // een willekeurige dag.
    valid_from: venster?.from ?? new Date().toISOString(),
    valid_to: venster?.to ?? new Date(Date.now() + 2 * 86_400_000).toISOString(),
    photo_url: partner.photo_url,
    partner: {
      name: partner.name,
      slug: partner.slug,
      logo_url: partner.logo_url,
      address: null,
      lat: null,
      lng: null,
    },
  }

  const download = async (maat: (typeof MATEN)[number]) => {
    if (!doek.current) return
    setBezig(maat.naam)
    setFout(null)
    // Zet het doek even op de hoogte van het doelformaat en centreer de kaart,
    // anders plakt hij bij een story bovenaan met een halve pagina lucht
    // eronder.
    const el = doek.current
    const hoogte = maat.h / (maat.w / 390)
    el.style.minHeight = `${hoogte}px`
    el.style.display = 'flex'
    el.style.flexDirection = 'column'
    el.style.justifyContent = 'center'
    try {
      // De kaart is 390 breed op het scherm en moet 1080 breed het bestand in.
      // width/height zijn de maten op het scherm, canvasWidth/canvasHeight die
      // van het bestand; die laatste twee vastzetten voorkomt dat afronding er
      // 1080x1351 van maakt.
      const schaal = maat.w / 390
      const png = await toPng(doek.current, {
        width: 390,
        height: maat.h / schaal,
        canvasWidth: maat.w,
        canvasHeight: maat.h,
        cacheBust: true,
        backgroundColor: '#eef6fb',
      })
      const a = document.createElement('a')
      a.href = png
      a.download = `pontdeal-${partner.slug}-${maat.w}x${maat.h}.png`
      a.click()
    } catch (err) {
      // Meestal een plaatje dat de browser niet mag inlezen voor een canvas.
      setFout(
        `Renderen lukte niet: ${err instanceof Error ? err.message : String(err)}. Staat het logo wel in de eigen opslag?`,
      )
    }
    el.style.minHeight = ''
    el.style.display = ''
    el.style.flexDirection = ''
    el.style.justifyContent = ''
    setBezig(null)
  }

  // De echte dealkaart leest zijn teksten uit de i18n-context, en het
  // dashboard draait daarbuiten (zie main.tsx). Zonder deze provider valt de
  // kaart om zodra je hem hier opent.
  return (
    <I18nProvider lang="nl">
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 p-4" role="dialog" aria-modal="true">
      <div className="mx-auto w-full max-w-md rounded-3xl bg-white p-5 shadow-xl">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-base font-bold text-slate-900">Demo-kaart voor {partner.name}</h3>
          <button type="button" onClick={onSluit} className="min-h-[44px] text-sm text-slate-500 underline-offset-2 hover:underline">
            Sluiten
          </button>
        </div>

        <label htmlFor="demo-aanbod" className="mt-4 block text-xs font-semibold text-slate-500">
          Aanbod (één regel, eindprijs)
        </label>
        <input
          id="demo-aanbod"
          value={aanbod}
          onChange={(e) => setAanbod(e.target.value)}
          placeholder="Twee pizza's voor 21 euro"
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
        {aanbod.trim() !== '' && !check.ok && (
          <p className="mt-1 text-xs font-medium text-rose-700">{check.reason}</p>
        )}

        {/* Wat hieronder staat is precies wat de bezoeker ziet; hier wordt ook
            het plaatje van gemaakt. */}
        <p className="mt-4 text-xs font-semibold text-slate-500">Zo ziet het eruit in de app</p>
        <div className="mt-2 overflow-hidden rounded-2xl ring-1 ring-slate-200">
          <div ref={doek} className="water-bg" style={{ width: 390 }}>
            <div className="flex flex-col gap-4 px-4 py-8">
              <p className="text-center text-lg font-bold text-slate-900">IJhop</p>
              <DealCard
                deal={deal}
                next={null}
                redeemedWeek={0}
                hasCode={false}
                onGrab={() => {}}
                departStops={['ndsmwerf']}
                arriveStops={[]}
                forceMode="vol"
              />
              <p className="text-center text-[11px] text-slate-500">
                Elke week één Pontdeal voor wie op de pont wacht
              </p>
            </div>
          </div>
        </div>

        {fout && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800">{fout}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          {MATEN.map((m) => (
            <button
              key={m.naam}
              type="button"
              onClick={() => download(m)}
              disabled={bezig != null}
              className="min-h-[44px] flex-1 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {bezig === m.naam ? 'Bezig…' : `PNG ${m.w}×${m.h}`}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Zonder logo of foto valt de kaart terug op de eerste letter van de naam. Upload ze
          hierboven voor een kaart die je durft te laten zien.
        </p>
      </div>
    </div>
    </I18nProvider>
  )
}
