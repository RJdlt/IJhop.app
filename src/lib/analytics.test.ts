import { afterEach, describe, expect, it, vi } from 'vitest'
import { randomId, sessionId, resetMemorySessionForTests, HEARTBEAT_MAX, HEARTBEAT_MS } from './analytics'

/** Zet een nep-sessionStorage neer; `null` betekent: opslag weigert dienst. */
function withSessionStorage(store: Map<string, string> | null) {
  const impl = store
    ? {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      }
    : {
        getItem: () => {
          throw new Error('geblokkeerd')
        },
        setItem: () => {
          throw new Error('geblokkeerd')
        },
      }
  vi.stubGlobal('sessionStorage', impl)
}

afterEach(() => {
  vi.unstubAllGlobals()
  resetMemorySessionForTests()
})

describe('randomId', () => {
  it('geeft telkens een ander id', () => {
    expect(randomId()).not.toBe(randomId())
  })

  it('werkt ook zonder crypto.randomUUID (oudere Safari)', () => {
    vi.stubGlobal('crypto', {})
    const id = randomId()
    expect(id).toMatch(/^s-/)
    expect(id.length).toBeGreaterThan(8)
  })
})

describe('sessionId', () => {
  it('houdt hetzelfde id binnen een tab vast', () => {
    withSessionStorage(new Map())
    const first = sessionId()
    expect(sessionId()).toBe(first)
  })

  it('hergebruikt een id dat al in sessionStorage staat', () => {
    withSessionStorage(new Map([['ijhop:analytics:session', 'bestaand-id']]))
    expect(sessionId()).toBe('bestaand-id')
  })

  // Regressie: hier viel de code terug op de letterlijke string 'nosession',
  // waardoor alle bezoeken zonder sessionStorage in het dashboard als één
  // sessie werden geteld. Zo kwamen er minder sessies dan gebruikers uit.
  it('geeft zonder sessionStorage een eigen id in plaats van "nosession"', () => {
    withSessionStorage(null)
    const id = sessionId()
    expect(id).not.toBe('nosession')
    expect(id.length).toBeGreaterThan(8)
  })

  it('houdt dat reserve-id stabiel binnen dezelfde pagina-instantie', () => {
    withSessionStorage(null)
    expect(sessionId()).toBe(sessionId())
  })

  it('geeft een nieuw reserve-id voor een volgend bezoek', () => {
    withSessionStorage(null)
    const eerste = sessionId()
    resetMemorySessionForTests() // nieuwe pagina-instantie
    expect(sessionId()).not.toBe(eerste)
  })
})

describe('heartbeat-instellingen', () => {
  it('meet tot tien minuten per sessie', () => {
    // 30s x 20 = 10 minuten: fijn genoeg voor korte bezoeken, en begrensd
    // zodat een openstaande tab niet eindeloos events blijft sturen.
    expect(HEARTBEAT_MS).toBe(30_000)
    expect(HEARTBEAT_MAX).toBe(20)
    expect((HEARTBEAT_MS * HEARTBEAT_MAX) / 60_000).toBe(10)
  })
})
