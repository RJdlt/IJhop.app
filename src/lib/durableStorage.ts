/**
 * Duurzame opslag voor de Supabase-auth-sessie.
 *
 * Waarom dit bestaat: `user_id` in de analytics is het anonieme Supabase-
 * auth-id, en dat id leeft in de auth-sessie. supabase-js bewaart die sessie
 * standaard in localStorage. Is die opslag leeg (gewist, geblokkeerd, of een
 * ander opslagvak zoals de geïnstalleerde PWA naast Safari), dan maakt
 * `ensureAnonSession()` een gloednieuwe anonieme gebruiker aan. Elk zo'n
 * moment telt in het dashboard als een nieuw persoon, wat het aantal
 * gebruikers opblaast en retentie richting nul duwt.
 *
 * Deze adapter schrijft de sessie naar localStorage én naar IndexedDB, en
 * herstelt hem uit IndexedDB zodra localStorage leeg blijkt. Dat vangt
 * gewiste of gevulde localStorage op.
 *
 * Wat het NIET oplost: Safari's ITP wist na zeven dagen zonder bezoek álle
 * script-schrijfbare opslag van een site tegelijk, dus ook IndexedDB. Voor
 * die situatie helpt alleen de app aan het beginscherm toevoegen; een
 * geïnstalleerde PWA valt buiten die opruiming. Zie docs/besluit-pwa-grenzen.md.
 */

/** Minimale opslagvorm die supabase-js accepteert (sync of async). */
export interface SupportedStorage {
  getItem(key: string): string | null | Promise<string | null>
  setItem(key: string, value: string): void | Promise<void>
  removeItem(key: string): void | Promise<void>
}

export interface SyncKV {
  get(key: string): string | null
  set(key: string, value: string): void
  remove(key: string): void
}
export interface AsyncKV {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
}

/**
 * Bouwt de adapter uit een snelle (localStorage) en een reserve-opslag
 * (IndexedDB). Los van de browser-API's zodat dit testbaar is.
 *
 * - lezen: eerst snel, anders reserve; wat uit de reserve komt wordt meteen
 *   teruggezet in de snelle opslag, zodat het id daarna gewoon blijft staan.
 * - schrijven en wissen: altijd allebei, zodat ze niet uit elkaar lopen.
 * Beide kanten falen stil: opslag mag de app nooit breken.
 */
export function makeDurableStorage(fast: SyncKV, backup: AsyncKV): SupportedStorage {
  return {
    async getItem(key) {
      let local: string | null = null
      try {
        local = fast.get(key)
      } catch {
        /* geen localStorage: val terug op de reserve */
      }
      if (local != null) return local
      let restored: string | null = null
      try {
        restored = await backup.get(key)
      } catch {
        return null
      }
      if (restored != null) {
        try {
          fast.set(key, restored)
        } catch {
          /* alleen de reserve werkt; ook prima */
        }
      }
      return restored
    },
    async setItem(key, value) {
      try {
        fast.set(key, value)
      } catch {
        /* stil */
      }
      try {
        await backup.set(key, value)
      } catch {
        /* stil */
      }
    },
    async removeItem(key) {
      try {
        fast.remove(key)
      } catch {
        /* stil */
      }
      try {
        await backup.remove(key)
      } catch {
        /* stil */
      }
    },
  }
}

// ---- Browser-implementaties --------------------------------------------------

const localKV: SyncKV = {
  get: (k) => window.localStorage.getItem(k),
  set: (k, v) => window.localStorage.setItem(k, v),
  remove: (k) => window.localStorage.removeItem(k),
}

const DB_NAME = 'ijhop-auth'
const STORE = 'kv'

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null)
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) return resolve(null)
        try {
          const store = db.transaction(STORE, mode).objectStore(STORE)
          const req = run(store)
          req.onsuccess = () => resolve((req.result as T) ?? null)
          req.onerror = () => resolve(null)
        } catch {
          resolve(null)
        }
      }),
  )
}

const idbKV: AsyncKV = {
  get: (k) => tx<string>('readonly', (s) => s.get(k)),
  set: async (k, v) => {
    await tx('readwrite', (s) => s.put(v, k))
  },
  remove: async (k) => {
    await tx('readwrite', (s) => s.delete(k))
  },
}

/** De adapter die de Supabase-client gebruikt (browser). */
export const durableStorage: SupportedStorage = makeDurableStorage(localKV, idbKV)
