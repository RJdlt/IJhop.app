/**
 * De aankomstplanner: "ik wil om 23:15 op Centraal zijn, ik sta in De Pijp".
 *
 * `planRoutes` is met opzet puur. Alles wat onzeker is (waar sta je, hoe lang
 * doe je erover, welke pont vaart er) komt als argument binnen, zodat deze
 * functie precies één ding doet: uitrekenen wanneer je uiterlijk weg moet.
 * Dat is ook het enige stuk waar een fout stil kan blijven, en dus het stuk
 * dat tests verdient.
 *
 * Alle tijden zijn absolute milliseconden. De Amsterdamse klok zit in de
 * dienstregeling die de afvaarten aanlevert; hier wordt niet meer met
 * tijdzones gerekend.
 */
import { amsterdamDay, amsterdamInstant } from './time'
import type { LineId, StopId } from '../types'

export type PlannerMode = 'fiets' | 'lopen'

/** Eén afvaart, al omgerekend naar absolute tijd. */
export interface Sailing {
  line: LineId
  from: StopId
  to: StopId
  departMs: number
  arriveMs: number
  /** Laatste afvaart van deze verbinding vandaag. */
  last: boolean
}

/** Reistijden in seconden, van en naar elke steiger. */
export interface LegTimes {
  toStop: Partial<Record<StopId, number>>
  fromStop: Partial<Record<StopId, number>>
  /** Rechtstreeks van vertrekpunt naar bestemming, zonder pont. Null als de
   *  bestemming aan de overkant ligt en dat dus geen optie is. */
  direct: number | null
  /** Kwamen deze tijden van een routeringsdienst, of uit de schatting? */
  estimated: boolean
}

export interface PlannerInput {
  /** Uiterste aankomsttijd in ms, of null voor "zo snel mogelijk vanaf nu". */
  arriveByMs: number | null
  nowMs: number
  mode: PlannerMode
  /** Marge bij de steiger in minuten (aanleggen, fiets erop). */
  marginMin: number
}

export interface PlanOption {
  kind: 'pont' | 'direct'
  /** Wanneer je uiterlijk weg moet. */
  leaveByMs: number
  /** Wanneer je er dan bent. */
  arriveAtMs: number
  /** Reistijd naar de steiger, in seconden. Null bij de directe route. */
  toStopSec?: number
  fromStopSec?: number
  sailing?: Sailing
  /** Verschil met de beste optie, in minuten. Nul voor de beste zelf. */
  deltaMin: number
}

export interface PlanResult {
  options: PlanOption[]
  /** Aankomsttijd gevraagd, maar er vaart vanavond niets meer. */
  noFerryTonight: boolean
  /** Kwamen de reistijden uit een schatting in plaats van een dienst? */
  estimated: boolean
  /** Lijnen die vandaag niet varen en dus zijn overgeslagen. */
  skippedLines: LineId[]
}

/** Hoeveel opties we hoogstens tonen. Meer is geen keuze maar een lijst. */
export const MAX_OPTIONS = 3

export const MARGIN_MIN_DEFAULT = 2
export const MARGIN_MIN_MAX = 5

const MIN = 60_000

/**
 * Rekent de mogelijke routes uit en zet de beste bovenaan.
 *
 * Bij een aankomsttijd rekenen we terug: welke pont haal je nog, en hoe laat
 * moet je daarvoor de deur uit. Bovenaan staat dan het láátste vertrek dat nog
 * op tijd is, want dat is wat iemand wil weten die nu nog even doorwerkt.
 *
 * Zonder aankomsttijd rekenen we vooruit en staat de snelste aankomst bovenaan.
 *
 * Per verbinding houden we één afvaart over. Drie keer dezelfde pont met tien
 * minuten ertussen is geen keuze; drie verschillende routes wel.
 */
export function planRoutes(
  input: PlannerInput,
  sailings: Sailing[],
  legs: LegTimes,
  disruptedLines: LineId[] = [],
): PlanResult {
  const { arriveByMs, nowMs, marginMin } = input
  const marge = Math.max(0, Math.min(MARGIN_MIN_MAX, marginMin)) * MIN
  const geblokkeerd = new Set(disruptedLines)
  const overgeslagen = new Set<LineId>()

  const kandidaten: PlanOption[] = []

  for (const s of sailings) {
    if (geblokkeerd.has(s.line)) {
      overgeslagen.add(s.line)
      continue
    }
    const heen = legs.toStop[s.from]
    const terug = legs.fromStop[s.to]
    if (heen == null || terug == null) continue

    const leaveByMs = s.departMs - marge - heen * 1000
    const arriveAtMs = s.arriveMs + terug * 1000

    // Je kunt niet in het verleden vertrekken.
    if (leaveByMs < nowMs) continue
    if (arriveByMs != null && arriveAtMs > arriveByMs) continue

    kandidaten.push({
      kind: 'pont',
      leaveByMs,
      arriveAtMs,
      toStopSec: heen,
      fromStopSec: terug,
      sailing: s,
      deltaMin: 0,
    })
  }

  // Per verbinding de beste afvaart. Bij een aankomsttijd is dat de laatste
  // die nog kan; anders die je het snelst op je bestemming brengt.
  const perVerbinding = new Map<string, PlanOption>()
  for (const o of kandidaten) {
    const sleutel = `${o.sailing!.line}:${o.sailing!.from}:${o.sailing!.to}`
    const huidig = perVerbinding.get(sleutel)
    if (!huidig) {
      perVerbinding.set(sleutel, o)
      continue
    }
    const beter =
      arriveByMs != null ? o.leaveByMs > huidig.leaveByMs : o.arriveAtMs < huidig.arriveAtMs
    if (beter) perVerbinding.set(sleutel, o)
  }

  const opties = [...perVerbinding.values()]

  // De route zonder pont, als de bestemming aan dezelfde kant ligt.
  if (legs.direct != null) {
    const duur = legs.direct * 1000
    const leaveByMs = arriveByMs != null ? arriveByMs - duur : nowMs
    if (leaveByMs >= nowMs) {
      opties.push({ kind: 'direct', leaveByMs, arriveAtMs: leaveByMs + duur, deltaMin: 0 })
    }
  }

  opties.sort((a, b) =>
    arriveByMs != null ? b.leaveByMs - a.leaveByMs : a.arriveAtMs - b.arriveAtMs,
  )

  const top = opties.slice(0, MAX_OPTIONS)
  const beste = top[0]
  if (beste) {
    for (const o of top) {
      // Bij een aankomsttijd meet het verschil hoeveel eerder je weg moet;
      // zonder aankomsttijd hoeveel later je aankomt. In beide gevallen is
      // meer slechter, dus het getal is nooit negatief.
      const verschil =
        arriveByMs != null ? beste.leaveByMs - o.leaveByMs : o.arriveAtMs - beste.arriveAtMs
      o.deltaMin = Math.max(0, Math.round(verschil / MIN))
    }
  }

  return {
    options: top,
    noFerryTonight:
      arriveByMs != null && top.every((o) => o.kind !== 'pont') && sailings.length > 0,
    estimated: legs.estimated,
    skippedLines: [...overgeslagen],
  }
}

/** "22:41" op de Amsterdamse klok. */
export function clockOf(ms: number): string {
  return new Intl.DateTimeFormat('nl-NL', {
    timeZone: 'Europe/Amsterdam',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(ms))
}

/** Minuten, naar boven afgerond; nul wordt 1 want "0 min fietsen" leest raar. */
export function minutesOf(seconds: number): number {
  return Math.max(1, Math.round(seconds / 60))
}

/**
 * "23:15" op de Amsterdamse klok, omgerekend naar een absoluut moment.
 *
 * Bewust niet via `new Date().setHours()`: dat rekent in de tijdzone van het
 * toestel. Iemand met zijn telefoon op Londen of op UTC (en dat komt vaker
 * voor dan je denkt, bijvoorbeeld in een browser zonder tijdzone) zou dan een
 * uur ernaast plannen, precies bij de laatste pont.
 *
 * Ligt de tijd vandaag al achter ons, dan bedoelt iemand morgen.
 */
export function arrivalInstant(klok: string, now: Date = new Date()): number | null {
  if (!/^\d{1,2}:\d{2}$/.test(klok)) return null
  const [u, m] = klok.split(':').map(Number)
  if (u > 23 || m > 59) return null
  const hhmmss = `${String(u).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`

  const vandaag = amsterdamDay(now)
  const vanavond = amsterdamInstant(vandaag, hhmmss)
  if (vanavond != null && Date.parse(vanavond) > now.getTime()) return Date.parse(vanavond)

  // Morgen, op de Amsterdamse kalender.
  const t = new Date(`${vandaag}T12:00:00Z`)
  t.setUTCDate(t.getUTCDate() + 1)
  const morgen = amsterdamInstant(t.toISOString().slice(0, 10), hhmmss)
  return morgen == null ? null : Date.parse(morgen)
}
