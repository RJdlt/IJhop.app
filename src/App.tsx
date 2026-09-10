import { useEffect, useMemo, useRef, useState } from 'react'
import { Header } from './components/Header'
import { RouteCard } from './components/RouteCard'
import { CatchPanel } from './components/CatchPanel'
import { Footer } from './components/Footer'
import { InstallPrompt } from './components/InstallPrompt'
import { SponsorCard } from './components/SponsorCard'
import { OnboardingFavorites } from './components/OnboardingFavorites'
import { DisruptionBanner } from './components/DisruptionBanner'
import { PrizeEntry } from './components/PrizeEntry'
import { DealCard } from './components/DealCard'
import { DealStrip } from './components/DealStrip'
import { DealTopStrip } from './components/DealTopStrip'
import { DealRedeem } from './components/DealRedeem'
import { TipFriend } from './components/TipFriend'
import { useNow } from './hooks/useNow'
import { useAnonSession } from './hooks/useAnonSession'
import { setupPwaAutoUpdate } from './pwa'
import { startAnalytics, track } from './lib/analytics'
import { useI18n } from './i18n/i18n'
import { amsterdamMoment } from './lib/time'
import { LINES, LINE_IDS, timetable } from './lib/schedule'
import { NotificationOptIn } from './components/NotificationOptIn'
import { bumpVisits, shouldOfferPrize, markPrizeSeen } from './lib/prize'
import { useDeal } from './hooks/useDeal'
import { dealCardMode, modeShowsPhoto } from './lib/dealCard'
import type { StopPair } from './lib/schedule'
import type { LineId } from './types'

// Elke lijn heeft een "kop"-richting (connects[0] -> connects[1]) plus de omgekeerde;
// de wissel-knop flipt ertussen. Data-gedreven uit de dienstregeling.
const DIRECTIONS: Record<LineId, [StopPair, StopPair]> = Object.fromEntries(
  Object.values(LINES).map((l) => {
    const [a, b] = l.connects
    return [l.name, [
      { from: a, to: b, line: l.name },
      { from: b, to: a, line: l.name },
    ]]
  }),
)

const FAV_KEY = 'ijhop:favlines'
const FLIP_KEY = 'ijhop:flipped'

export default function App() {
  const { t } = useI18n()
  const now = useNow(1000)
  const nowSecondOfWeek = useMemo(() => amsterdamMoment(now).secondOfWeek, [now])

  const { userId } = useAnonSession()

  // Nieuwe versie beschikbaar? Toon een verversen-knop i.p.v. vanzelf herladen.
  // Nieuwe versie beschikbaar? Toon een balkje. We herladen nooit uit
  // onszelf: `applyUpdate` draait pas als de bezoeker erop tikt.
  const [applyUpdate, setApplyUpdate] = useState<(() => void) | null>(null)
  useEffect(() => {
    setupPwaAutoUpdate((apply) => setApplyUpdate(() => apply))
  }, [])

  // Offline-indicator: de klok werkt gewoon door (dienstregeling zit in de app),
  // maar we zeggen eerlijk dat live storingsinfo nu niet ververst.
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  useEffect(() => startAnalytics(), [])

  // Hoe vaak deze browser de app al opende; bepaalt of we de prijs-uitnodiging
  // tonen (niet meteen bij het allereerste bezoek).
  const [visits] = useState(() => bumpVisits())

  // Richting per lijn (heen/terug), onthouden per browser: wie 's ochtends
  // altijd de kant van Centraal op kijkt, ziet die richting ook na herstart.
  const [flipped, setFlipped] = useState<Record<LineId, boolean>>(() => {
    const base = Object.fromEntries(LINE_IDS.map((l) => [l, false]))
    try {
      const saved = JSON.parse(localStorage.getItem(FLIP_KEY) || '{}') as Record<string, boolean>
      for (const k of Object.keys(saved)) if (k in base) base[k] = saved[k] === true
    } catch {
      /* faal stil */
    }
    return base
  })
  const swap = (line: LineId) =>
    setFlipped((f) => {
      const next = { ...f, [line]: !f[line] }
      try {
        localStorage.setItem(FLIP_KEY, JSON.stringify(next))
      } catch {
        /* faal stil */
      }
      return next
    })

  // Favoriete pontjes (staan bovenaan). Onthouden per browser.
  const [favs, setFavs] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]') as string[])
    } catch {
      return new Set()
    }
  })
  const toggleFav = (line: string) =>
    setFavs((prev) => {
      const next = new Set(prev)
      if (next.has(line)) next.delete(line)
      else next.add(line)
      try {
        localStorage.setItem(FAV_KEY, JSON.stringify([...next]))
      } catch {
        /* faal stil */
      }
      return next
    })
  const favLines = useMemo(() => LINE_IDS.filter((l) => favs.has(l)), [favs])
  const otherLines = useMemo(() => LINE_IDS.filter((l) => !favs.has(l)), [favs])
  const [showOthers, setShowOthers] = useState(false)

  // Eenmalige favorieten-vraag bij de eerste keer, voor een schoon hoofdscherm.
  const [onboarded, setOnboarded] = useState(() => {
    try {
      return localStorage.getItem('ijhop:onboarded') === '1'
    } catch {
      return true
    }
  })
  const finishOnboarding = () => {
    setOnboarded(true)
    try {
      localStorage.setItem('ijhop:onboarded', '1')
    } catch {
      /* faal stil */
    }
  }

  // Welke steigers tellen voor de Pontdeal?
  //
  // Sinds de pont-kiezer weg is bepalen je favorieten dat, en richting telt
  // mee. De lijnen op je scherm staan in een richting: waar je vertrekt en
  // waar je aankomt. Een deal bij de aankomstkant is er eentje waar je zo
  // staat; een deal bij de vertrekkant is er eentje om de hoek. Allebei
  // bruikbaar, maar de kaart moet het verschil zeggen, dus we houden de twee
  // lijstjes apart.
  //
  // Zonder favorieten pakken we de eerst getoonde lijn: dat is wat de
  // bezoeker bovenaan ziet staan.
  const { departStops, arriveStops } = useMemo(() => {
    const zichtbaar = favLines.length > 0 ? favLines : LINE_IDS.slice(0, 1)
    const vertrek = new Set<string>()
    const aankomst = new Set<string>()
    for (const line of zichtbaar) {
      const richting = DIRECTIONS[line]?.[flipped[line] ? 1 : 0]
      if (!richting) continue
      vertrek.add(richting.from)
      aankomst.add(richting.to)
    }
    return { departStops: [...vertrek], arriveStops: [...aankomst] }
  }, [favLines, flipped])

  const dealStops = useMemo(
    () => [...new Set([...arriveStops, ...departStops])],
    [arriveStops, departStops],
  )

  const {
    deal,
    next: nextDeal,
    redeemedWeek,
    code: dealCode,
    claim,
    preview: dealPreview,
  } = useDeal(dealStops)
  const [redeemOpen, setRedeemOpen] = useState(false)
  // De bovenstrook springt hierheen als je hem aantikt zonder code.
  const dealKaartRef = useRef<HTMLDivElement>(null)
  const naarDealKaart = () => {
    const el = dealKaartRef.current
    if (!el) return
    const rustig = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: rustig ? 'auto' : 'smooth', block: 'center' })
  }
  const grabDeal = async () => {
    if (!deal) return
    if (!dealPreview) {
      track('deal_claim', {
        deal_id: deal.id,
        had_code: dealCode != null,
        card_mode: dealCardMode(),
        has_photo: modeShowsPhoto(dealCardMode()) && !!deal.photo_url,
      })
    }
    const res = dealCode ?? (await claim())
    if (res) setRedeemOpen(true)
  }

  // Eenmalige, rustige uitnodiging voor de prijzenactie. Niet bij het eerste
  // bezoek: pas als iemand de app vaker opent is de vraag gepast.
  const [offerPrize] = useState(() => {
    const show = shouldOfferPrize(visits)
    if (show) markPrizeSeen()
    return show
  })

  const renderRoute = (line: string) => (
    <RouteCard
      key={line}
      connection={DIRECTIONS[line][flipped[line] ? 1 : 0]}
      nowSecondOfWeek={nowSecondOfWeek}
      userId={userId}
      onSwap={() => swap(line)}
      favorite={favs.has(line)}
      onToggleFav={() => toggleFav(line)}
    />
  )

  return (
    <div className="water-bg flex min-h-full flex-col">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6">
        <Header />

        {/* Boven de klok is de duurste plek van het scherm. Deze strook staat
            er alleen 's avonds op een dealdag, en één keer wegklikken houdt
            hem de hele week weg. */}
        <DealTopStrip
          deal={deal}
          code={dealCode}
          departStops={departStops}
          arriveStops={arriveStops}
          onOpenCode={() => setRedeemOpen(true)}
          onScrollToCard={naarDealKaart}
          preview={dealPreview}
        />

        <main className="flex flex-col gap-4">
          {/* Offline: klok blijft werken op de ingebouwde dienstregeling. */}
          {!online && (
            <p className="animate-riseIn self-center rounded-full bg-slate-200/80 px-3.5 py-1.5 text-xs font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">
              📡 {t.offlineNote} ({timetable.generated})
            </p>
          )}
          {/* Alleen zichtbaar bij een echte storing of 2+ meldingen; laadt
              parallel en houdt de aftelklok nooit op. */}
          <DisruptionBanner favLines={favLines} />
          {(favLines.length > 0 ? favLines : LINE_IDS).map(renderRoute)}
          {favLines.length > 0 && otherLines.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowOthers((s) => !s)}
                className="self-start rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm ring-1 ring-slate-100 transition hover:bg-slate-50 dark:bg-white/5 dark:text-slate-300 dark:ring-white/10"
              >
                {showOthers ? '▲' : '▼'} {t.otherFerries} ({otherLines.length})
              </button>
              {showOthers && otherLines.map(renderRoute)}
            </>
          )}

          {/* Direct onder de klok: daar is net bewezen waar de app voor is. */}
          <InstallPrompt />

          {/* De deal staat onder de klok, nooit erboven: hij is een beloning
              voor wie toch al wacht. Heb je hem gepakt, dan neemt de strook
              zijn plaats in; dan is de kaart zelf niet meer nodig. */}
          <div ref={dealKaartRef}>
          {dealCode ? (
            <DealStrip deal={deal} code={dealCode} onOpen={() => setRedeemOpen(true)} />
          ) : (
            <DealCard
              deal={deal}
              next={nextDeal}
              redeemedWeek={redeemedWeek}
              hasCode={false}
              onGrab={grabDeal}
              departStops={departStops}
              arriveStops={arriveStops}
              preview={dealPreview}
            />
          )}
          </div>
          <TipFriend redeemedAt={dealCode?.redeemed_at ?? null} />

          <CatchPanel nowSecondOfWeek={nowSecondOfWeek} />
          <NotificationOptIn favLines={favLines} />
          {offerPrize && <PrizeEntry />}
          <SponsorCard />
        </main>

        <div className="mt-auto">
          <Footer />
        </div>
      </div>

      {redeemOpen && deal && dealCode && (
        <DealRedeem
          deal={deal}
          code={dealCode}
          onClose={() => setRedeemOpen(false)}
          preview={dealPreview}
        />
      )}

      {!onboarded && (
        <OnboardingFavorites favs={favs} onToggle={toggleFav} onDone={finishOnboarding} />
      )}

      {/* Klein balkje onderaan, niet in de weg van de klok. Eén tik zet de
          nieuwe versie aan en herlaadt; tot die tik gebeurt er niets. */}
      {applyUpdate && (
        <div
          role="status"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-black/5 bg-white/95 px-4 py-2.5 backdrop-blur dark:border-white/10 dark:bg-slate-900/95"
          style={{ paddingBottom: 'calc(0.625rem + env(safe-area-inset-bottom))' }}
        >
          <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {t.updateAvailable}
            </span>
            <button
              type="button"
              onClick={applyUpdate}
              className="shrink-0 rounded-full bg-brand-deep px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
            >
              {t.refreshNow}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
