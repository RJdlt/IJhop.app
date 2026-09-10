import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../i18n/i18n'
import { track } from '../lib/analytics'
import { kortNaam, lookup, suggest } from '../lib/geocode'
import type { Plek } from '../lib/geocode'
import type { Coords } from '../lib/geo'
import { arrivalInstant, clockOf, minutesOf, planRoutes } from '../lib/planner'
import type { PlannerMode, PlanOption, PlanResult } from '../lib/planner'
import {
  coordsVan,
  firstSailingAfter,
  gestoordeLijnen,
  haalReistijden,
  HORIZON_MS,
  sailingsBetween,
  trajectenVoor,
} from '../lib/plannerData'
import { leesPrefs, onthoudPlek, schrijfPrefs } from '../lib/plannerPrefs'
import type { PlannerPrefs, RecentPlek } from '../lib/plannerPrefs'
import { PREFS_DEFAULT } from '../lib/plannerPrefs'
import { fetchDisruptions } from '../lib/disruptions'
import { LINES, STOPS } from '../lib/schedule'
import { cancelReminder, myReminder, setReminder } from '../lib/reminders'
import type { StopId } from '../types'

/**
 * De aankomstplanner: "ik wil om 23:15 op Centraal zijn, ik sta in De Pijp".
 *
 * Zit met opzet in de bestaande kaart "Haal jij de pont nog?" en niet in een
 * eigen scherm. Het is dezelfde vraag, alleen een stap verder: die kaart zegt
 * of je de eerstvolgende pont haalt, deze zegt wanneer je weg moet.
 *
 * Er is geen zoekknop. Zodra de drie velden ingevuld zijn rekent hij, en
 * zolang dat duurt staat er een skelet in plaats van niets.
 */

/** Bestemmingen die we als chip aanbieden: de steigers zelf. */
const BEKENDE_BESTEMMINGEN: StopId[] = [
  'centraalstation',
  'ndsmwerf',
  'buiksloterweg',
  'ijplein',
  'pontsteiger',
  'zamenhofstraat',
  'distelweg',
]

interface Punt {
  naam: string
  coords: Coords
}

export function ArrivalPlanner({ mijnLocatie }: { mijnLocatie: Coords | null }) {
  const { t } = useI18n()
  const [prefs, setPrefs] = useState<PlannerPrefs>(PREFS_DEFAULT)
  const [open, setOpen] = useState(false)
  const [van, setVan] = useState<Punt | null>(null)
  const [naar, setNaar] = useState<Punt | null>(null)
  const [aankomst, setAankomst] = useState('') // "23:15" of leeg voor nu
  const [bezig, setBezig] = useState(false)
  const [plan, setPlan] = useState<PlanResult | null>(null)
  const [herinnering, setHerinnering] = useState<{ fire_at: string } | null>(null)
  const [gemeld, setGemeld] = useState(false)

  useEffect(() => {
    leesPrefs().then((p) => {
      setPrefs(p)
      setOpen(p.open)
    })
    myReminder().then(setHerinnering)
  }, [])

  // "Mijn locatie" is het uitgangspunt zodra die er is en je niets koos.
  useEffect(() => {
    if (!van && mijnLocatie) setVan({ naam: t.planner.myLocation, coords: mijnLocatie })
  }, [mijnLocatie, van, t.planner.myLocation])

  const bewaar = useCallback((p: PlannerPrefs) => {
    setPrefs(p)
    void schrijfPrefs(p)
  }, [])

  const klapOpen = () => {
    const nieuw = !open
    setOpen(nieuw)
    bewaar({ ...prefs, open: nieuw })
    if (nieuw && !gemeld) {
      setGemeld(true)
      track('planner_open')
    }
  }

  /** De gevraagde aankomsttijd als absoluut moment, op de Amsterdamse klok. */
  const aankomstMs = useMemo(() => arrivalInstant(aankomst), [aankomst])

  // Rekenen zodra de velden er zijn. Geen knop: de drie velden zijn de vraag.
  useEffect(() => {
    if (!open || !van || !naar) return
    let levend = true
    setBezig(true)
    const nuMs = Date.now()

    ;(async () => {
      const trajecten = trajectenVoor(van.coords, naar.coords)
      const [{ seconds, estimated }, alerts] = await Promise.all([
        haalReistijden(trajecten.pairs, prefs.mode),
        fetchDisruptions().catch(() => null),
      ])
      if (!levend) return

      const toStop: Partial<Record<StopId, number>> = {}
      const fromStop: Partial<Record<StopId, number>> = {}
      let i = 0
      for (const s of trajecten.toStops) toStop[s] = seconds[i++]
      for (const s of trajecten.fromStops) fromStop[s] = seconds[i++]
      const direct = trajecten.direct ? seconds[i] ?? null : null

      const einde = aankomstMs ?? nuMs + HORIZON_MS
      const sailings = sailingsBetween(nuMs, Math.max(einde, nuMs + 3600_000))
      const gestoord = gestoordeLijnen(alerts?.alerts)

      const r = planRoutes(
        { arriveByMs: aankomstMs, nowMs: nuMs, mode: prefs.mode, marginMin: prefs.marginMin },
        sailings,
        { toStop, fromStop, direct, estimated },
        gestoord,
      )
      setPlan(r)
      setBezig(false)
      track('planner_result', {
        n_opties: r.options.length,
        modus: prefs.mode,
        met_aankomsttijd: aankomstMs != null,
        fallback: estimated,
      })
      if (van.naam !== t.planner.myLocation) {
        bewaar({ ...prefs, recent: onthoudPlek(prefs.recent, { naam: van.naam, coords: van.coords }) })
      }
    })()

    return () => {
      levend = false
    }
    // prefs.recent verandert door het onthouden zelf; dat mag geen herberekening
    // uitlokken, vandaar alleen de velden die de uitkomst bepalen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, van, naar, aankomstMs, prefs.mode, prefs.marginMin])

  const eersteMorgen = useMemo(() => {
    if (!plan?.noFerryTonight) return null
    const s = firstSailingAfter(Date.now())
    return s ? clockOf(s.departMs) : null
  }, [plan])

  const zetHerinnering = async (o: PlanOption) => {
    const at = new Date(o.leaveByMs - 2 * 60_000)
    const waarheen = o.sailing ? (STOPS[o.sailing.from]?.name ?? o.sailing.from) : ''
    const body = o.sailing
      ? `${o.sailing.line} om ${clockOf(o.sailing.departMs)}`
      : t.planner.reminderBodyDirect
    const ok = await setReminder(at.toISOString(), `${t.planner.leaveNow} ${waarheen}`, body)
    if (ok) {
      setHerinnering({ fire_at: at.toISOString() })
      track('planner_reminder_set', { modus: prefs.mode, met_aankomsttijd: aankomstMs != null })
    }
  }

  const stopHerinnering = async () => {
    await cancelReminder()
    setHerinnering(null)
  }

  return (
    <div className="mt-4 border-t border-slate-100 pt-4 dark:border-white/5">
      <button
        type="button"
        onClick={klapOpen}
        aria-expanded={open}
        className="flex min-h-[44px] w-full items-center justify-between gap-2 text-left"
      >
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {t.planner.title}
        </span>
        <span aria-hidden="true" className="text-slate-400">
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-4">
          <PuntVeld
            label={t.planner.fromLabel}
            waarde={van}
            onKies={setVan}
            chips={[
              ...(mijnLocatie ? [{ naam: t.planner.myLocation, coords: mijnLocatie }] : []),
              ...prefs.recent,
            ]}
            plaatshouder={t.planner.fromPlaceholder}
          />

          <PuntVeld
            label={t.planner.toLabel}
            waarde={naar}
            onKies={setNaar}
            chips={BEKENDE_BESTEMMINGEN.map((s) => ({
              naam: STOPS[s]?.name ?? s,
              coords: coordsVan(s),
            }))}
            plaatshouder={t.planner.toPlaceholder}
          />

          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label htmlFor="planner-tijd" className="block text-xs font-semibold text-slate-500">
                {t.planner.whenLabel}
              </label>
              <input
                id="planner-tijd"
                type="time"
                value={aankomst}
                onChange={(e) => setAankomst(e.target.value)}
                className="mt-1 min-h-[44px] rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
              />
              {aankomst !== '' && (
                <button
                  type="button"
                  onClick={() => setAankomst('')}
                  className="mt-1 block text-[11px] text-slate-500 underline-offset-2 hover:underline"
                >
                  {t.planner.clearTime}
                </button>
              )}
            </div>

            <fieldset className="min-w-0">
              <legend className="text-xs font-semibold text-slate-500">{t.planner.modeLabel}</legend>
              <div className="mt-1 flex gap-2">
                {(['fiets', 'lopen'] as PlannerMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => bewaar({ ...prefs, mode: m })}
                    aria-pressed={prefs.mode === m}
                    className={`min-h-[44px] rounded-xl px-4 py-2 text-sm font-medium transition ${
                      prefs.mode === m
                        ? 'bg-brand-deep text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-200'
                    }`}
                  >
                    {m === 'fiets' ? t.planner.bike : t.planner.walk}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          {!van || !naar ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.planner.needFields}</p>
          ) : bezig ? (
            <Skelet />
          ) : plan ? (
            <Uitkomst
              plan={plan}
              eersteMorgen={eersteMorgen}
              herinnering={herinnering}
              onHerinner={zetHerinnering}
              onStop={stopHerinnering}
            />
          ) : null}
        </div>
      )}
    </div>
  )
}

/** Eén invoerveld met chips en autocomplete. */
function PuntVeld({
  label,
  waarde,
  onKies,
  chips,
  plaatshouder,
}: {
  label: string
  waarde: Punt | null
  onKies: (p: Punt) => void
  chips: RecentPlek[]
  plaatshouder: string
}) {
  const [tekst, setTekst] = useState('')
  const [opties, setOpties] = useState<Plek[]>([])
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    window.clearTimeout(timer.current)
    if (tekst.trim().length < 3) {
      setOpties([])
      return
    }
    const ctrl = new AbortController()
    // Wachten tot iemand uitgetypt is: elke toetsaanslag opvragen is onnodig
    // druk op een dienst die we gratis gebruiken.
    timer.current = window.setTimeout(() => {
      suggest(tekst, ctrl.signal).then(setOpties)
    }, 250)
    return () => {
      window.clearTimeout(timer.current)
      ctrl.abort()
    }
  }, [tekst])

  const kies = async (p: Plek) => {
    const c = await lookup(p.id)
    if (!c) return
    onKies({ naam: kortNaam(p.naam), coords: c })
    setTekst('')
    setOpties([])
  }

  return (
    <div>
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      {waarde && (
        <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">{waarde.naam}</p>
      )}
      <div className="mt-1 flex flex-wrap gap-2">
        {chips.map((c) => (
          <button
            key={c.naam}
            type="button"
            onClick={() => onKies({ naam: c.naam, coords: c.coords })}
            className={`min-h-[44px] rounded-full px-3 py-2 text-xs font-medium transition ${
              waarde?.naam === c.naam
                ? 'bg-brand-deep text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-200'
            }`}
          >
            {c.naam}
          </button>
        ))}
      </div>
      <input
        value={tekst}
        onChange={(e) => setTekst(e.target.value)}
        placeholder={plaatshouder}
        aria-label={label}
        className="mt-2 min-h-[44px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
      />
      {opties.length > 0 && (
        <ul className="mt-1 overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
          {opties.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => kies(o)}
                className="block min-h-[44px] w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-white/5"
              >
                {o.naam}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Skelet() {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100 dark:bg-white/5" />
      ))}
    </div>
  )
}

function Uitkomst({
  plan,
  eersteMorgen,
  herinnering,
  onHerinner,
  onStop,
}: {
  plan: PlanResult
  eersteMorgen: string | null
  herinnering: { fire_at: string } | null
  onHerinner: (o: PlanOption) => void
  onStop: () => void
}) {
  const { t } = useI18n()

  if (plan.options.length === 0) {
    return (
      <div className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-700 dark:bg-white/5 dark:text-slate-200">
        {plan.noFerryTonight ? (
          <>
            <p className="font-medium">{t.planner.noFerryTonight}</p>
            {eersteMorgen && (
              <p className="mt-0.5 text-slate-600 dark:text-slate-300">
                {t.planner.firstTomorrow} {eersteMorgen}
              </p>
            )}
            <p className="mt-1 text-xs text-slate-500">{t.planner.metroHint}</p>
          </>
        ) : (
          <p>{t.planner.noOptions}</p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {plan.estimated && (
        <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          {t.planner.estimated}
        </p>
      )}
      {plan.skippedLines.length > 0 && (
        <p className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] font-medium text-rose-800 dark:bg-rose-500/10 dark:text-rose-200">
          {plan.skippedLines.join(', ')} {t.planner.disrupted}
        </p>
      )}

      {plan.options.map((o, i) => (
        <OptieRegel
          key={i}
          o={o}
          eerste={i === 0}
          herinnering={herinnering}
          onHerinner={onHerinner}
          onStop={onStop}
        />
      ))}
    </div>
  )
}

function OptieRegel({
  o,
  eerste,
  herinnering,
  onHerinner,
  onStop,
}: {
  o: PlanOption
  eerste: boolean
  herinnering: { fire_at: string } | null
  onHerinner: (o: PlanOption) => void
  onStop: () => void
}) {
  const { t } = useI18n()
  const gezet = herinnering != null && Math.abs(Date.parse(herinnering.fire_at) - (o.leaveByMs - 120_000)) < 60_000

  return (
    <div
      className={`rounded-xl px-3 py-2.5 ring-1 ${
        eerste ? 'bg-white ring-brand/30 dark:bg-white/10' : 'bg-slate-50 ring-transparent dark:bg-white/5'
      }`}
    >
      <p className="text-sm font-semibold text-slate-900 dark:text-white">
        {t.planner.leaveBy} {clockOf(o.leaveByMs)}
        {o.sailing?.last && (
          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
            {t.planner.lastFerry}
          </span>
        )}
      </p>
      <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
        {o.kind === 'pont' && o.sailing ? (
          <>
            {t.planner.viaStop
              .replace('{min}', String(minutesOf(o.toStopSec ?? 0)))
              .replace('{stop}', STOPS[o.sailing.from]?.name ?? o.sailing.from)}
            {' · '}
            <span style={{ color: LINES[o.sailing.line]?.color }} className="font-semibold">
              {o.sailing.line}
            </span>{' '}
            {clockOf(o.sailing.departMs)} → {STOPS[o.sailing.to]?.name ?? o.sailing.to}{' '}
            {clockOf(o.sailing.arriveMs)}
            {' · '}
            {t.planner.thenMin.replace('{min}', String(minutesOf(o.fromStopSec ?? 0)))}
            {' · '}
            {t.planner.arriveAt} {clockOf(o.arriveAtMs)}
          </>
        ) : (
          <>
            {t.planner.noFerryRoute} · {t.planner.arriveAt} {clockOf(o.arriveAtMs)}
          </>
        )}
      </p>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          {o.deltaMin === 0 ? t.planner.best : `+${o.deltaMin} min`}
        </span>
        <button
          type="button"
          onClick={() => (gezet ? onStop() : onHerinner(o))}
          className={`min-h-[44px] rounded-xl px-3 py-2 text-xs font-semibold transition ${
            gezet
              ? 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-200'
              : 'bg-brand-deep text-white hover:bg-brand-dark'
          }`}
        >
          {gezet ? t.planner.reminderOff : t.planner.reminder}
        </button>
      </div>
    </div>
  )
}
