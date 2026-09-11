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
export const FERRY_WORD = /\b(pont|ponten|veerpont|veerponten|veer|veren|veerdienst|veerdiensten)\b/i

/**
 * Netwerkbrede berichten: een staking of algehele uitval raakt ook de veren,
 * ook als het bericht ze niet noemt.
 *
 * Hier stond eerder ook een drempel op het aantal haltes: een GVB-alert dat
 * meer dan zestig haltes raakte gold als netwerkbreed. Dat was fout. Een
 * omleiding van één tramlijn raakt makkelijk zestig haltes, en zo'n bericht
 * werd dan als algemene veerstoring naar álle abonnees gestuurd. Zie de
 * tram-25-melding in de tests. Breedte zegt niets over de vervoerwijze; alleen
 * de woorden doen dat.
 */
export const NETWORK_WORD =
  /\b(staking|stakingen|landelijk|landelijke|geen vervoer|alle lijnen|gehele netwerk|heel het netwerk)\b/i

/**
 * Noemt dit bericht een concrete bus-, tram- of metrolijn?
 *
 * GVB schrijft de vervoerwijze altijd voluit met het nummer erachter: "Tram 25
 * rijdt om", "Bus N91 en N93 stoppen hier niet", "Metro 52". Het nummer is het
 * verschil dat telt: "geen trams en bussen" in een stakingsbericht noemt geen
 * lijn en blijft dus netwerkbreed.
 */
export const OTHER_MODE_WORD =
  /\b(bus|bussen|tram|trams|metro|nachtbus|nachtlijn)\s*(?:lijn\s*)?(?:[0-9]|N[0-9])/i

export function mentionsOtherMode(text) {
  return OTHER_MODE_WORD.test(text || '')
}

/**
 * Gaat dit bericht over de veren? Een veersteiger in de tags, een veer-woord in
 * de tekst, of een veerlijnnummer (F4, F20).
 */
export const FERRY_LINE_WORD = /\bF[0-9]{1,2}\b/

export function mentionsFerry(text) {
  return FERRY_WORD.test(text || '') || FERRY_LINE_WORD.test(text || '')
}

/**
 * Is dit een netwerkbreed bericht?
 *
 * Trefwoord én geen concrete bus-, tram- of metrolijn. Een bericht dat een
 * lijnnummer noemt gaat over die lijn, hoe groot de woorden eromheen ook zijn.
 */
export function isNetworkWide(header, body) {
  const tekst = `${header || ''} ${body || ''}`
  if (!NETWORK_WORD.test(tekst)) return false
  return !mentionsOtherMode(tekst)
}

/** Filter het volledige feed naar actieve GVB-veeralerts (max 5, nieuwste eerst). */
export function filterFerryAlerts(entities, nowSec) {
  const out = []
  for (const e of entities) {
    if (!e.id.includes(':GVB:') || !e.alert) continue
    if (!isActive(e.alert.activePeriod, nowSec)) continue

    const stopKeys = new Set()
    for (const ie of e.alert.informedEntity ?? []) {
      if (ie.stopId == null) continue
      const key = FERRY_STOP_IDS[String(ie.stopId)]
      if (key) stopKeys.add(key)
    }
    const header = nlText(e.alert.headerText)
    const body = nlText(e.alert.descriptionText)
    const tekst = `${header} ${body}`
    const textMatch = mentionsFerry(tekst)

    // Harde grens: noemt het bericht een bus-, tram- of metrolijn en staat er
    // nergens een veerlijn, veersteiger of veer-woord in, dan gaat het niet
    // over de veren. Ongeacht hoeveel haltes het raakt. Dit is de regel die de
    // tram-25-melding tegenhoudt.
    if (mentionsOtherMode(tekst) && !textMatch && stopKeys.size === 0) continue

    // Netwerkbreed (landelijke ov-staking): telt als algemene melding die alle
    // lijnen raakt; stops blijft dan leeg, en leeg betekent verderop "alle
    // veerlijnen" voor zowel de banner als de pushmeldingen.
    const networkWide = isNetworkWide(header, body)

    if (stopKeys.size === 0 && !textMatch && !networkWide) continue
    if (!header) continue

    const periods = e.alert.activePeriod ?? []
    out.push({
      id: e.id,
      header,
      stops: [...stopKeys].sort(),
      // Expliciet meegeven of dit een netwerkbreed bericht is, zodat de
      // push-checker niet hoeft te raden wat een lege stops-lijst betekent.
      networkWide,
      // De lijnen meteen meegeven: de push-checker en het dashboard hoeven dan
      // niet zelf te raden wat een lege stops-lijst betekent.
      lines: resolveLines([...stopKeys], tekst, networkWide),
      start: periods.length ? num(periods[0].start) : null,
      end: periods.length ? num(periods[0].end) : null,
    })
  }
  out.sort((a, b) => (b.start ?? 0) - (a.start ?? 0))
  return out.slice(0, 5)
}

/** Veerlijnnummers die letterlijk in de tekst staan ("Pont F4 vaart niet"). */
export function linesFromText(text) {
  const all = Object.keys(FERRY_LINES)
  const gevonden = new Set()
  for (const m of String(text || '').matchAll(/\bF([0-9]{1,2})\b/g)) {
    const naam = `F${m[1]}`
    if (all.includes(naam)) gevonden.add(naam)
  }
  return [...gevonden]
}

/**
 * Welke veerlijnen raakt dit bericht?
 *
 * In volgorde van hoe zeker we zijn:
 *  1. Getagde veersteigers. Dat is het hardste signaal dat er is.
 *  2. Een veerlijnnummer in de tekst, als er geen steigers getagd zijn.
 *  3. Netwerkbreed: dan raakt het alles.
 *  4. Een veerbericht zonder verdere aanwijzing: dan alle lijnen, want een
 *     veerstoring waarvan we de lijn niet kennen willen we liever te breed dan
 *     helemaal niet melden.
 *
 * Het verschil met vroeger zit in stap 4: die gold toen ook voor berichten die
 * helemaal niet over de veren gingen, omdat "geen steigers getagd" als
 * "algemene veermelding" werd gelezen. Wat daar nooit meer komt is nu al in
 * filterFerryAlerts weggefilterd.
 */
export function resolveLines(stops, text, networkWide) {
  const all = Object.keys(FERRY_LINES)
  if (stops && stops.length > 0) {
    const hit = new Set(stops)
    return all.filter((line) => FERRY_LINES[line].some((s) => hit.has(s)))
  }
  const uitTekst = linesFromText(text)
  if (uitTekst.length > 0) return uitTekst
  return all
}

/** Welke lijnen raakt een alert? Gebruikt `lines` als die er staat. */
export function alertLines(alert) {
  if (Array.isArray(alert.lines) && alert.lines.length > 0) return alert.lines
  return resolveLines(alert.stops ?? [], alert.header ?? '', alert.networkWide === true)
}
