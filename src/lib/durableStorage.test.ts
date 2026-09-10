import { describe, expect, it } from 'vitest'
import { makeDurableStorage } from './durableStorage'
import type { AsyncKV, SyncKV } from './durableStorage'

function fakes() {
  const localData = new Map<string, string>()
  const backupData = new Map<string, string>()
  const fast: SyncKV = {
    get: (k) => localData.get(k) ?? null,
    set: (k, v) => void localData.set(k, v),
    remove: (k) => void localData.delete(k),
  }
  const backup: AsyncKV = {
    get: async (k) => backupData.get(k) ?? null,
    set: async (k, v) => void backupData.set(k, v),
    remove: async (k) => void backupData.delete(k),
  }
  return { localData, backupData, storage: makeDurableStorage(fast, backup) }
}

const KEY = 'sb-vrwdpuxobslyjntqhqup-auth-token'

describe('makeDurableStorage', () => {
  it('schrijft naar beide opslagplekken', async () => {
    const { localData, backupData, storage } = fakes()
    await storage.setItem(KEY, 'sessie-1')
    expect(localData.get(KEY)).toBe('sessie-1')
    expect(backupData.get(KEY)).toBe('sessie-1')
  })

  it('leest bij voorkeur uit de snelle opslag', async () => {
    const { localData, backupData, storage } = fakes()
    localData.set(KEY, 'vers')
    backupData.set(KEY, 'oud')
    expect(await storage.getItem(KEY)).toBe('vers')
  })

  // De kern: dit is precies het geval dat eerder een nieuwe anonieme
  // gebruiker (en dus een nieuw user_id) opleverde.
  it('herstelt de sessie uit de reserve als localStorage gewist is', async () => {
    const { localData, backupData, storage } = fakes()
    backupData.set(KEY, 'sessie-1')
    expect(await storage.getItem(KEY)).toBe('sessie-1')
    // En zet 'm meteen terug, zodat het daarna weer gewoon snel gaat.
    expect(localData.get(KEY)).toBe('sessie-1')
  })

  it('geeft null als geen van beide de sleutel kent', async () => {
    const { storage } = fakes()
    expect(await storage.getItem('onbekend')).toBeNull()
  })

  it('wist de sleutel op beide plekken', async () => {
    const { localData, backupData, storage } = fakes()
    await storage.setItem(KEY, 'sessie-1')
    await storage.removeItem(KEY)
    expect(localData.has(KEY)).toBe(false)
    expect(backupData.has(KEY)).toBe(false)
  })

  it('blijft werken als localStorage helemaal weigert (privémodus)', async () => {
    const backupData = new Map<string, string>()
    const weigerend: SyncKV = {
      get: () => {
        throw new Error('geblokkeerd')
      },
      set: () => {
        throw new Error('geblokkeerd')
      },
      remove: () => {
        throw new Error('geblokkeerd')
      },
    }
    const backup: AsyncKV = {
      get: async (k) => backupData.get(k) ?? null,
      set: async (k, v) => void backupData.set(k, v),
      remove: async (k) => void backupData.delete(k),
    }
    const storage = makeDurableStorage(weigerend, backup)
    await storage.setItem(KEY, 'sessie-1')
    expect(backupData.get(KEY)).toBe('sessie-1')
    expect(await storage.getItem(KEY)).toBe('sessie-1')
  })

  it('valt terug op null als ook de reserve stukgaat', async () => {
    const stuk: AsyncKV = {
      get: async () => {
        throw new Error('kapot')
      },
      set: async () => {
        throw new Error('kapot')
      },
      remove: async () => {
        throw new Error('kapot')
      },
    }
    const localData = new Map<string, string>()
    const fast: SyncKV = {
      get: (k) => localData.get(k) ?? null,
      set: (k, v) => void localData.set(k, v),
      remove: (k) => void localData.delete(k),
    }
    const storage = makeDurableStorage(fast, stuk)
    await expect(storage.setItem(KEY, 'x')).resolves.toBeUndefined()
    expect(localData.get(KEY)).toBe('x')
    localData.clear()
    expect(await storage.getItem(KEY)).toBeNull()
  })
})
