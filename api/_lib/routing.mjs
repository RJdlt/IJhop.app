/**
 * Reistijden per fiets en te voet, achter onze eigen API.
 *
 * Waarom OpenRouteService en niet Mapbox: ORS heeft een gratis laag zonder
 * creditcard (2.000 verzoeken per dag), profielen `cycling-regular` en
 * `foot-walking`, en het draait op OpenStreetMap. Amsterdam is de best in
 * kaart gebrachte fietsstad ter wereld, dus juist voor fietsen is OSM hier
 * beter dan wat dan ook. Mapbox rekent per verzoek zodra je boven de gratis
 * laag komt en wil een creditcard; voor een hobbyproject is dat een risico op
 * een rekening in plaats van een foutmelding.
 *
 * De prijs van die keuze is de daglimiet. Daarom drie dingen:
 *
 *  1. Een cache van zeven dagen per (van, naar, modus). De steigerparen zijn
 *     eindig, dus na een paar dagen komt bijna alles uit de cache.
 *  2. Coördinaten worden afgerond op ongeveer elf meter voordat ze de sleutel
 *     in gaan. Twee mensen op dezelfde hoek delen dan één antwoord.
 *  3. Een teller per dag, zodat het dashboard laat zien hoe vol de emmer zit
 *     voordat hij op een woensdagavond leeg is.
 *
 * De sleutel staat als ORS_API_KEY in de omgeving van Vercel en komt nooit in
 * de app-bundel terecht.
 */

const ORS_URL = 'https://api.openrouteservice.org/v2/directions'

/** ORS-profiel per vervoerwijze. */
export const PROFILES = {
  fiets: 'cycling-regular',
  lopen: 'foot-walking',
}

/** Gemiddelde snelheden voor de schatting zonder dienst (m/s). */
export const FALLBACK_SPEED = {
  fiets: 15000 / 3600,
  lopen: 5000 / 3600,
}

/** Omweg-factor: over straat fiets je verder dan hemelsbreed. */
export const DETOUR = 1.3

/** Hoe lang een antwoord bruikbaar blijft. */
export const CACHE_DAYS = 7

/**
 * Afronden op vier decimalen, ongeveer elf meter. Fijner heeft geen zin (een
 * gps-fix is zelden preciezer) en grover zou het verschil tussen twee kanten
 * van een gracht wegpoetsen.
 */
export function roundCoord(n) {
  return Math.round(Number(n) * 1e4) / 1e4
}

/** Sleutel waaronder een reistijd in de cache staat. */
export function cacheKey(from, to, mode) {
  return [
    mode,
    roundCoord(from.lat),
    roundCoord(from.lon),
    roundCoord(to.lat),
    roundCoord(to.lon),
  ].join(':')
}

/** Hemelsbrede afstand in meters. */
export function haversine(a, b) {
  const R = 6371000
  const rad = (d) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** De schatting die we gebruiken als er geen dienst beschikbaar is. */
export function estimateSeconds(from, to, mode) {
  const meters = haversine(from, to) * DETOUR
  return Math.round(meters / (FALLBACK_SPEED[mode] ?? FALLBACK_SPEED.lopen))
}

/**
 * Lost een lijstje trajecten op: eerst uit de cache, de rest bij de dienst,
 * en wat dan nog mist met de schatting.
 *
 * Alle buitenwereld zit in `deps`, zodat dit te testen is zonder netwerk en
 * zonder database.
 *
 * Geeft per traject `{ seconds, source }` terug, waarbij source een van
 * 'cache', 'ors' of 'estimate' is. De aanroeper toont "geschat" zodra er
 * ergens 'estimate' in staat: liever eerlijk onzeker dan stellig fout.
 */
export async function resolveRoutes(pairs, mode, deps) {
  const { getCached, putCached, fetchOrs, budgetLeft = Infinity } = deps
  const uitkomst = new Array(pairs.length)
  const missers = []

  const sleutels = pairs.map((p) => cacheKey(p.from, p.to, mode))
  const gevonden = await getCached(sleutels)

  for (let i = 0; i < pairs.length; i++) {
    const hit = gevonden?.[sleutels[i]]
    if (hit != null) {
      uitkomst[i] = { seconds: hit, source: 'cache' }
    } else {
      missers.push(i)
    }
  }

  if (missers.length > 0) {
    // Nooit meer opvragen dan er vandaag nog in de emmer zit. Wat daarboven
    // valt wordt geschat; een schatting is beter dan een lege planner.
    const teVragen = missers.slice(0, Math.max(0, budgetLeft))
    let verse = []
    if (teVragen.length > 0 && typeof fetchOrs === 'function') {
      try {
        verse = await fetchOrs(
          teVragen.map((i) => pairs[i]),
          mode,
        )
      } catch {
        verse = []
      }
    }
    const nieuw = {}
    for (let k = 0; k < teVragen.length; k++) {
      const i = teVragen[k]
      const sec = verse[k]
      if (typeof sec === 'number' && Number.isFinite(sec)) {
        uitkomst[i] = { seconds: Math.round(sec), source: 'ors' }
        nieuw[sleutels[i]] = Math.round(sec)
      }
    }
    if (Object.keys(nieuw).length > 0 && typeof putCached === 'function') {
      try {
        await putCached(nieuw)
      } catch {
        /* de cache vullen mag nooit het antwoord tegenhouden */
      }
    }
    for (const i of missers) {
      if (!uitkomst[i]) {
        uitkomst[i] = { seconds: estimateSeconds(pairs[i].from, pairs[i].to, mode), source: 'estimate' }
      }
    }
  }

  return uitkomst
}

/** Telt hoe de verzoeken uitpakten, voor het dashboard. */
export function tally(results) {
  const t = { hits: 0, ors: 0, estimates: 0 }
  for (const r of results) {
    if (r.source === 'cache') t.hits++
    else if (r.source === 'ors') t.ors++
    else t.estimates++
  }
  return t
}

/**
 * Vraagt ORS naar de reistijd van elk traject.
 *
 * Bewust één verzoek per traject en niet de matrix-API: de matrix telt bij ORS
 * zwaarder mee in de limiet en wij vragen om hooguit een handvol trajecten per
 * planning. Faalt er eentje, dan blijft de rest overeind.
 */
export function makeOrsFetcher(apiKey, fetchImpl = fetch) {
  return async function fetchOrs(pairs, mode) {
    const profiel = PROFILES[mode] ?? PROFILES.lopen
    return Promise.all(
      pairs.map(async (p) => {
        try {
          const r = await fetchImpl(`${ORS_URL}/${profiel}`, {
            method: 'POST',
            headers: {
              Authorization: apiKey,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({
              coordinates: [
                [p.from.lon, p.from.lat],
                [p.to.lon, p.to.lat],
              ],
              units: 'm',
            }),
            signal: AbortSignal.timeout(8000),
          })
          if (!r.ok) return null
          const j = await r.json()
          const sec = j?.routes?.[0]?.summary?.duration
          return typeof sec === 'number' ? sec : null
        } catch {
          return null
        }
      }),
    )
  }
}
