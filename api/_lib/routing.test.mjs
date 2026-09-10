import { describe, expect, it, vi } from 'vitest'
import {
  cacheKey,
  DETOUR,
  estimateSeconds,
  resolveRoutes,
  roundCoord,
  tally,
} from './routing.mjs'

const A = { lat: 52.3800, lon: 4.9000 }
const B = { lat: 52.4010, lon: 4.8930 }

describe('cachesleutel', () => {
  it('rondt af op ongeveer elf meter', () => {
    expect(roundCoord(52.380012)).toBe(52.38)
    expect(roundCoord(52.3800499)).toBe(52.38)
    expect(roundCoord(52.38007)).toBe(52.3801)
  })

  it('geeft twee mensen op dezelfde hoek dezelfde sleutel', () => {
    const bijna = { lat: A.lat + 0.00002, lon: A.lon - 0.00003 }
    expect(cacheKey(bijna, B, 'fiets')).toBe(cacheKey(A, B, 'fiets'))
  })

  it('houdt twee kanten van een gracht uit elkaar', () => {
    const overkant = { lat: A.lat + 0.0006, lon: A.lon }
    expect(cacheKey(overkant, B, 'fiets')).not.toBe(cacheKey(A, B, 'fiets'))
  })

  it('scheidt fiets en lopen', () => {
    expect(cacheKey(A, B, 'fiets')).not.toBe(cacheKey(A, B, 'lopen'))
  })

  it('is niet omkeerbaar: heen is niet terug', () => {
    expect(cacheKey(A, B, 'fiets')).not.toBe(cacheKey(B, A, 'fiets'))
  })
})

describe('schatting zonder dienst', () => {
  it('rekent met een omweg-factor en de juiste snelheid', () => {
    const fiets = estimateSeconds(A, B, 'fiets')
    const lopen = estimateSeconds(A, B, 'lopen')
    expect(fiets).toBeGreaterThan(0)
    // Lopen is drie keer zo traag als fietsen (5 tegen 15 km/u).
    expect(lopen / fiets).toBeCloseTo(3, 1)
  })

  it('gebruikt de omweg-factor en niet de hemelsbrede afstand', () => {
    const recht = estimateSeconds({ lat: 52.38, lon: 4.9 }, { lat: 52.38, lon: 4.9 }, 'fiets')
    expect(recht).toBe(0)
    expect(DETOUR).toBeGreaterThan(1)
  })
})

/** Bouwt de afhankelijkheden na, zonder netwerk of database. */
function nep({ cache = {}, orsAntwoord = [], budgetLeft = Infinity } = {}) {
  const opgeslagen = {}
  const fetchOrs = vi.fn(async (pairs) => orsAntwoord.slice(0, pairs.length))
  return {
    opgeslagen,
    fetchOrs,
    deps: {
      getCached: async (keys) => Object.fromEntries(keys.filter((k) => k in cache).map((k) => [k, cache[k]])),
      putCached: async (nieuw) => Object.assign(opgeslagen, nieuw),
      fetchOrs,
      budgetLeft,
    },
  }
}

describe('resolveRoutes', () => {
  const pairs = [{ from: A, to: B }, { from: B, to: A }]

  it('haalt alles uit de cache als het er staat', async () => {
    const cache = { [cacheKey(A, B, 'fiets')]: 600, [cacheKey(B, A, 'fiets')]: 700 }
    const { deps, fetchOrs } = nep({ cache })
    const r = await resolveRoutes(pairs, 'fiets', deps)
    expect(r.map((x) => x.seconds)).toEqual([600, 700])
    expect(r.every((x) => x.source === 'cache')).toBe(true)
    expect(fetchOrs).not.toHaveBeenCalled()
  })

  it('vraagt alleen de missers op bij de dienst', async () => {
    const cache = { [cacheKey(A, B, 'fiets')]: 600 }
    const { deps, fetchOrs, opgeslagen } = nep({ cache, orsAntwoord: [742.4] })
    const r = await resolveRoutes(pairs, 'fiets', deps)
    expect(fetchOrs).toHaveBeenCalledTimes(1)
    expect(fetchOrs.mock.calls[0][0]).toHaveLength(1)
    expect(r[0]).toEqual({ seconds: 600, source: 'cache' })
    expect(r[1]).toEqual({ seconds: 742, source: 'ors' })
    // En wat opgehaald is gaat de cache in, zodat morgen niemand het opnieuw vraagt.
    expect(opgeslagen).toEqual({ [cacheKey(B, A, 'fiets')]: 742 })
  })

  it('schat wat de dienst niet kon beantwoorden', async () => {
    const { deps } = nep({ orsAntwoord: [null, null] })
    const r = await resolveRoutes(pairs, 'fiets', deps)
    expect(r.every((x) => x.source === 'estimate')).toBe(true)
    expect(r.every((x) => x.seconds > 0)).toBe(true)
  })

  it('schat ook als de dienst helemaal omvalt', async () => {
    const deps = {
      getCached: async () => ({}),
      putCached: async () => {},
      fetchOrs: async () => {
        throw new Error('503')
      },
    }
    const r = await resolveRoutes(pairs, 'lopen', deps)
    expect(r.every((x) => x.source === 'estimate')).toBe(true)
  })

  it('blijft binnen het dagbudget en schat de rest', async () => {
    // Nog één verzoek over vandaag, maar twee missers.
    const { deps, fetchOrs } = nep({ orsAntwoord: [600, 700], budgetLeft: 1 })
    const r = await resolveRoutes(pairs, 'fiets', deps)
    expect(fetchOrs.mock.calls[0][0]).toHaveLength(1)
    expect(r[0].source).toBe('ors')
    expect(r[1].source).toBe('estimate')
  })

  it('vraagt niets als de emmer leeg is', async () => {
    const { deps, fetchOrs } = nep({ budgetLeft: 0 })
    const r = await resolveRoutes(pairs, 'fiets', deps)
    expect(fetchOrs).not.toHaveBeenCalled()
    expect(r.every((x) => x.source === 'estimate')).toBe(true)
  })

  it('laat een kapotte cache het antwoord niet tegenhouden', async () => {
    const deps = {
      getCached: async () => ({}),
      putCached: async () => {
        throw new Error('database plat')
      },
      fetchOrs: async () => [600, 700],
    }
    const r = await resolveRoutes(pairs, 'fiets', deps)
    expect(r.map((x) => x.seconds)).toEqual([600, 700])
  })
})

describe('tally', () => {
  it('telt hits, verse verzoeken en schattingen', () => {
    expect(
      tally([
        { source: 'cache' }, { source: 'cache' }, { source: 'ors' }, { source: 'estimate' },
      ]),
    ).toEqual({ hits: 2, ors: 1, estimates: 1 })
  })
})
