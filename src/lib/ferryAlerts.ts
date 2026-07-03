/**
 * Pure filterlogica voor GTFS-Realtime service alerts (NDOV/OVapi): haal uit
 * het landelijke feed de GVB-berichten die onze veersteigers raken. Draait
 * server-side in /api/storingen en wordt hier los getest. Geen protobuf-kennis:
 * werkt op het platte object dat de decoder oplevert (int64 als string).
 *
 * Zie docs/besluit-storingsbron.md voor het bronnenonderzoek en de regels.
 */

/** GTFS-stop-id -> onze stop-sleutel, voor alle veersteigers (uit timetable.json). */
export const FERRY_STOP_IDS: Record<string, string> = {
  '3979906': 'centraalstation',
  '3979702': 'sporenburg',
  '3980300': 'ijplein',
  '3980786': 'ndsmwerf',
  '3979837': 'zamenhofstraat',
  '3980046': 'pontsteiger',
  '3980694': 'zeeburgereiland',
  '3980896': 'buiksloterweg',
  '3981381': 'azartplein',
  '3980087': 'distelweg',
}

interface Translation { text?: string | null; language?: string | null }
export interface FeedEntity {
  id: string
  alert?: {
    informedEntity?: { routeId?: string | null; stopId?: string | null }[] | null
    activePeriod?: { start?: string | number | null; end?: string | number | null }[] | null
    headerText?: { translation?: Translation[] | null } | null
    descriptionText?: { translation?: Translation[] | null } | null
  } | null
}

export interface FerryAlert {
  id: string
  /** NL-koptekst (deel voor de " -- "-scheiding van het feed). */
  header: string
  /** Geraakte veersteigers (onze stop-sleutels); leeg bij een tekst-match. */
  stops: string[]
  /** Unix-seconden, of null als de periode open is. */
  start: number | null
  end: number | null
}

const num = (v: string | number | null | undefined): number | null => {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Pak de NL-tekst: voorkeur voor language 'nl', anders de eerste; knip het
 *  Engelse deel achter " -- " eraf. */
function nlText(t?: { translation?: Translation[] | null } | null): string {
  const list = t?.translation ?? []
  const nl = list.find((x) => x.language === 'nl') ?? list[0]
  const raw = (nl?.text ?? '').trim()
  return raw.split(' -- ')[0].trim()
}

/** Overlapt een van de periodes met nu (of start binnen 30 min)? Geen periode = actief. */
function isActive(periods: { start?: string | number | null; end?: string | number | null }[] | null | undefined, nowSec: number): boolean {
  if (!periods || periods.length === 0) return true
  return periods.some((p) => {
    const s = num(p.start)
    const e = num(p.end)
    if (s !== null && s > nowSec + 30 * 60) return false
    if (e !== null && e < nowSec) return false
    return true
  })
}

const FERRY_WORD = /\b(pont|veer|veerpont)\b/i

/** Filter het volledige feed naar actieve GVB-veeralerts (max 5, nieuwste eerst). */
export function filterFerryAlerts(entities: FeedEntity[], nowSec: number): FerryAlert[] {
  const out: FerryAlert[] = []
  for (const e of entities) {
    if (!e.id.includes(':GVB:') || !e.alert) continue
    if (!isActive(e.alert.activePeriod, nowSec)) continue

    const stopKeys = new Set<string>()
    for (const ie of e.alert.informedEntity ?? []) {
      const key = ie.stopId != null ? FERRY_STOP_IDS[String(ie.stopId)] : undefined
      if (key) stopKeys.add(key)
    }
    const header = nlText(e.alert.headerText)
    const textMatch = FERRY_WORD.test(header) || FERRY_WORD.test(nlText(e.alert.descriptionText))
    if (stopKeys.size === 0 && !textMatch) continue
    if (!header) continue

    const periods = e.alert.activePeriod ?? []
    out.push({
      id: e.id,
      header,
      stops: [...stopKeys].sort(),
      start: periods.length ? num(periods[0].start) : null,
      end: periods.length ? num(periods[0].end) : null,
    })
  }
  out.sort((a, b) => (b.start ?? 0) - (a.start ?? 0))
  return out.slice(0, 5)
}
