/**
 * Adressen zoeken, via de PDOK Locatieserver.
 *
 * Waarom niet de geocoder van OpenRouteService: die telt mee in dezelfde
 * daglimiet als de reistijden, en juist het typen van een adres levert veel
 * verzoeken op (elke toetsaanslag). PDOK is van de Nederlandse overheid, kent
 * geen sleutel en geen daglimiet die wij gaan halen, en heeft de beste
 * Nederlandse adresdekking die er is. Voor "De Pijp" of "Javastraat 12"
 * hoeven we dus niet aan onze eigen emmer te komen.
 *
 * We beperken tot Amsterdam en omstreken; deze app plant geen ritten naar
 * Maastricht.
 */
import type { Coords } from './geo'

const SUGGEST = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/suggest'
const LOOKUP = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/lookup'

export interface Plek {
  id: string
  naam: string
  coords?: Coords
}

/** Middelpunt van Amsterdam; resultaten worden hierop gesorteerd. */
const AMSTERDAM = { lat: 52.3728, lon: 4.8936 }

/**
 * Suggesties bij wat iemand typt. Faalt stil met een lege lijst: een
 * autocomplete die een foutmelding geeft is erger dan eentje die niets zegt.
 */
export async function suggest(vraag: string, signal?: AbortSignal): Promise<Plek[]> {
  const q = vraag.trim()
  if (q.length < 3) return []
  try {
    const url =
      `${SUGGEST}?q=${encodeURIComponent(q)}` +
      `&fq=${encodeURIComponent('type:(adres OR weg OR woonplaats OR gemeente)')}` +
      `&lat=${AMSTERDAM.lat}&lon=${AMSTERDAM.lon}&rows=6`
    const r = await fetch(url, { signal })
    if (!r.ok) return []
    const j = await r.json()
    const docs = j?.response?.docs ?? []
    return docs.map((d: { id: string; weergavenaam: string }) => ({
      id: d.id,
      naam: d.weergavenaam,
    }))
  } catch {
    return []
  }
}

/** Haalt de coördinaten bij een suggestie op. */
export async function lookup(id: string): Promise<Coords | null> {
  try {
    const r = await fetch(`${LOOKUP}?id=${encodeURIComponent(id)}&fl=centroide_ll`)
    if (!r.ok) return null
    const j = await r.json()
    const punt: string | undefined = j?.response?.docs?.[0]?.centroide_ll
    return parsePoint(punt)
  } catch {
    return null
  }
}

/** "POINT(4.8936 52.3728)" naar coördinaten. Lon staat eerst in WKT. */
export function parsePoint(wkt: string | undefined | null): Coords | null {
  if (!wkt) return null
  const m = /POINT\(\s*([\d.+-]+)\s+([\d.+-]+)\s*\)/i.exec(wkt)
  if (!m) return null
  const lon = Number(m[1])
  const lat = Number(m[2])
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  return { lat, lon }
}

/** Korte naam voor een chip: alleen het eerste deel voor de komma. */
export function kortNaam(naam: string): string {
  return naam.split(',')[0].trim().slice(0, 28)
}
