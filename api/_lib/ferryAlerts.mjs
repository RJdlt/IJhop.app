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

/** Pak de NL-tekst: voorkeur voor language 'nl', anders de eerste. KV15 plakt
 *  NL en EN aan elkaar met " -- " of " --|" en gebruikt '|' als regeleinde;
 *  knip het Engelse deel eraf en maak van de pipes gewone spaties. */
function nlText(t) {
  const list = (t && t.translation) || []
  const nl = list.find((x) => x.language === 'nl') ?? list[0]
  const raw = ((nl && nl.text) || '').trim()
  return raw.split(/\s--(?:\s|\|)/)[0].replace(/\|/g, ' ').replace(/\s+/g, ' ').trim()
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

// Ook de meervouden: een stakingsbericht zegt eerder "ponten"/"veren" dan "pont".
const FERRY_WORD = /\b(pont|ponten|veerpont|veerponten|veer|veren)\b/i
// Netwerkbrede berichten (staking, algehele uitval) noemen de veren vaak niet
// en taggen alleen bus/tram/metro-haltes; herken ze aan het trefwoord of aan
// de breedte: een GVB-alert dat zoveel haltes tegelijk raakt is netwerkbreed.
const NETWORK_WORD = /\b(staking|stakingen|geen vervoer|gehele netwerk)\b/i
const NETWORK_STOP_THRESHOLD = 60

/** Filter het volledige feed naar actieve GVB-veeralerts (max 5, nieuwste eerst). */
export function filterFerryAlerts(entities, nowSec) {
  const out = []
  for (const e of entities) {
    if (!e.id.includes(':GVB:') || !e.alert) continue
    if (!isActive(e.alert.activePeriod, nowSec)) continue

    const stopKeys = new Set()
    const allStops = new Set()
    for (const ie of e.alert.informedEntity ?? []) {
      if (ie.stopId == null) continue
      const sid = String(ie.stopId)
      allStops.add(sid)
      const key = FERRY_STOP_IDS[sid]
      if (key) stopKeys.add(key)
    }
    const header = nlText(e.alert.headerText)
    const body = nlText(e.alert.descriptionText)
    const textMatch = FERRY_WORD.test(header) || FERRY_WORD.test(body)
    // Netwerkbreed (bijv. landelijke ov-staking, 9 sept 2026: 1070 haltes,
    // nul veersteigers, geen "pont" in de tekst): telt als algemene melding
    // die alle lijnen raakt (stops blijft dan leeg = alle lijnen).
    const networkWide =
      NETWORK_WORD.test(header) || NETWORK_WORD.test(body) || allStops.size >= NETWORK_STOP_THRESHOLD
    // Zonder veersteiger-match, veer-woord of netwerkbreed signaal: overslaan.
    // Bij netwerkbreed blijft stops leeg, en leeg betekent verderop "alle
    // veerlijnen" voor zowel de banner als de pushmeldingen.
    if (stopKeys.size === 0 && !textMatch && !networkWide) continue
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
