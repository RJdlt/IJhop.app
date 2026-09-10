import { useEffect, useMemo, useState } from 'react'
import { Header } from './components/Header'
import { RouteCard } from './components/RouteCard'
import { CatchPanel } from './components/CatchPanel'
import { Footer } from './components/Footer'
import { InstallPrompt } from './components/InstallPrompt'
import { SponsorCard } from './components/SponsorCard'
import { OnboardingFavorites } from './components/OnboardingFavorites'
import { DisruptionBanner } from './components/DisruptionBanner'
import { PrizeEntry } from './components/PrizeEntry'
import { FerryPicker } from './components/FerryPicker'
import { DealCard } from './components/DealCard'
import { DealRedeem } from './components/DealRedeem'
import { TipFriend } from './components/TipFriend'
import type { FerryOption } from './components/FerryPicker'
import { useNow } from './hooks/useNow'
import { useAnonSession } from './hooks/useAnonSession'
import { setupPwaAutoUpdate } from './pwa'
import { startAnalytics, track } from './lib/analytics'
import { useI18n } from './i18n/i18n'
import { amsterdamMoment } from './lib/time'
import { CONNECTIONS, LINES, LINE_IDS, nextDepartures, timetable } from './lib/schedule'
import { NotificationOptIn } from './components/NotificationOptIn'
import { bumpVisits, shouldOfferPrize, markPrizeSeen } from './lib/prize'
import { useDeal } from './hooks/useDeal'
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
const WATCH_KEY = 'ijhop:watch'

const connKey = (c: StopPair) => `${c.line}:${c.from}:${c.to}`

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

  // Op welke afvaart je wacht. Bepaalt met wie je elkaar kunt vinden op de pont.
  const [watchKey, setWatchKey] = useState<string | null>(
    () => (typeof window === 'undefined' ? null : window.localStorage.getItem(WATCH_KEY)),
  )
  const chooseWatch = (key: string | null) => {
    setWatchKey(key)
    track('ferry_pick', { key })
    try {
      if (key) window.localStorage.setItem(WATCH_KEY, key)
      else window.localStorage.removeItem(WATCH_KEY)
    } catch {
      /* faal stil */
    }
  }

  // Live aftelklok per richting, voor de pont-keuze. Heb je favorieten, dan
  // tonen we alleen die richtingen: anders staat er een lijst van twintig
  // knoppen onder je klok en dat leest niet meer.
  const ferryOptions = useMemo<FerryOption[]>(
    () =>
      CONNECTIONS.filter((c) => favLines.length === 0 || favs.has(c.line)).map((c) => ({
        key: connKey(c),
        line: c.line,
        from: c.from,
        to: c.to,
        secondsUntil: nextDepartures({ from: c.from, to: c.to, nowSecondOfWeek, limit: 1 })[0]
          ?.secondsUntil,
      })),
    [nowSecondOfWeek, favs, favLines.length],
  )

  const watched = watchKey ? ferryOptions.find((o) => o.key === watchKey) ?? null : null

  // Pontdeals: welke steigers zijn voor deze bezoeker relevant? De pont waar
  // hij op wacht telt het zwaarst, daarna zijn favoriete lijnen. Zonder dat
  // alles krijgt hij niets te zien in plaats van de deal van een steiger waar
  // hij nooit komt.
  const dealStops = useMemo(() => {
    const stops = new Set<string>()
    if (watched) {
      stops.add(watched.from)
      stops.add(watched.to)
    }
    for (const line of favLines) for (const stop of LINES[line]?.connects ?? []) stops.add(stop)
    return [...stops]
  }, [watched, favLines])

  const {
    deal,
    next: nextDeal,
    redeemedWeek,
    code: dealCode,
    claim,
    preview: dealPreview,
  } = useDeal(dealStops)
  const [redeemOpen, setRedeemOpen] = useState(false)
  const grabDeal = async () => {
    if (!deal) return
    if (!dealPreview) track('deal_claim', { deal_id: deal.id, had_code: dealCode != null })
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
              voor wie toch al wacht. */}
          <DealCard
            deal={deal}
            next={nextDeal}
            redeemedWeek={redeemedWeek}
            hasCode={dealCode != null}
            onGrab={grabDeal}
            preview={dealPreview}
          />
          <TipFriend redeemedAt={dealCode?.redeemed_at ?? null} />

          <FerryPicker options={ferryOptions} value={watchKey} onChange={chooseWatch} />
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
