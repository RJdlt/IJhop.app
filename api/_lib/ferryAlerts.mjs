/**
 * Pure filterlogica voor GTFS-Realtime service alerts (NDOV/OVapi): haal uit
 * het landelijke feed de GVB-berichten die onze veersteigers raken.
 *
 * Bewust plain ESM-JavaScript: dit draait in de Vercel-functies (die met
 * "type":"module" als ESM laden) en wordt door vitest los getest. Types staan
 * in ferryAlerts.d.mts. Regels: docs/besluit-storingsbron.md
 */

/** GTFS-stop-id -> onze stop-sleutel, voor alle zestien veersteigers. */
export const FERRY_STOP_IDS = {
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
  '3980516': 'hempontplein',
  '3981141': 'zaandam',
  '3980233': 'assendelft',
  '3980920': 'spaarndam',
  '3981182': 'velsennoord',
  '3981106': 'velsenzuid',
}

/** Lijn -> steigers (compact duplicaat van timetable.json, alleen wat de
 *  push-checker nodig heeft; bijwerken samen met FERRY_STOP_IDS). */
export const FERRY_LINES = {
  F1: ['zamenhofstraat', 'azartplein'],
  F2: ['ijplein', 'centraalstation'],
  F3: ['buiksloterweg', 'centraalstation'],
  F4: ['centraalstation', 'ndsmwerf'],
  F6: ['distelweg', 'pontsteiger'],
  F7: ['ndsmwerf', 'pontsteiger'],
  F9: ['sporenburg', 'zeeburgereiland'],
  F20: ['hempontplein', 'zaandam'],
  F21: ['assendelft', 'spaarndam'],
  F22: ['velsenzuid', 'velsennoord'],
}

const num = (v) => {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Pak de NL-tekst: voorkeur voor language 'nl', anders de eerste; knip het
 *  Engelse deel achter " -- " eraf. */
function nlText(t) {
  const list = (t && t.translation) || []
  const nl = list.find((x) => x.language === 'nl') ?? list[0]
  const raw = ((nl && nl.text) || '').trim()
  return raw.split(' -- ')[0].trim()
}

/** Overlapt een periode met nu (of start binnen 30 min)? Geen periode = actief. */
function isActive(periods, nowSec) {
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
export function filterFerryAlerts(entities, nowSec) {
  const out = []
  for (const e of entities) {
    if (!e.id.includes(':GVB:') || !e.alert) continue
    if (!isActive(e.alert.activePeriod, nowSec)) continue

    const stopKeys = new Set()
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

/** Welke lijnen raakt een alert? Lege stops = algemene veermelding = alle lijnen. */
export function alertLines(alert) {
  const all = Object.keys(FERRY_LINES)
  if (!alert.stops || alert.stops.length === 0) return all
  const hit = new Set(alert.stops)
  return all.filter((line) => FERRY_LINES[line].some((s) => hit.has(s)))
}
