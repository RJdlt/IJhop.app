import { describe, expect, it } from 'vitest'
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  CONFUSING,
  isValidDealCode,
  makeDealCode,
  normalizeDealCode,
  spellOut,
} from './dealCode'

describe('code-generatie', () => {
  it('is altijd vier tekens', () => {
    for (let i = 0; i < 200; i++) expect(makeDealCode()).toHaveLength(CODE_LENGTH)
  })

  it('gebruikt nooit een verwarrend teken', () => {
    for (let i = 0; i < 2000; i++) {
      for (const ch of makeDealCode()) expect(CONFUSING).not.toContain(ch)
    }
  })

  it('houdt 0, O, 1, I, L, 5 en S buiten het alfabet', () => {
    for (const ch of CONFUSING) expect(CODE_ALPHABET).not.toContain(ch)
  })

  it('put uit het hele alfabet en niet uit een hoekje ervan', () => {
    const gezien = new Set<string>()
    for (let i = 0; i < 5000; i++) for (const ch of makeDealCode()) gezien.add(ch)
    expect(gezien.size).toBe(CODE_ALPHABET.length)
  })

  it('botst zelden: tienduizend codes leveren bijna evenveel unieke op', () => {
    const set = new Set<string>()
    for (let i = 0; i < 10_000; i++) set.add(makeDealCode())
    // 29^4 = 707.281 mogelijkheden; bij 10.000 trekkingen horen er een stuk
    // of zeventig dubbel te zitten. De database heeft het laatste woord, dit
    // toetst alleen dat de generator niet in een handvol codes blijft hangen.
    expect(set.size).toBeGreaterThan(9800)
  })

  it('is voorspelbaar met een vaste toevalsbron', () => {
    const vast = () => 0
    expect(makeDealCode(vast)).toBe(CODE_ALPHABET[0].repeat(CODE_LENGTH))
    const laatste = () => 0.999999
    expect(makeDealCode(laatste)).toBe(CODE_ALPHABET[CODE_ALPHABET.length - 1].repeat(CODE_LENGTH))
  })
})

describe('code lezen wat er getypt wordt', () => {
  it('trekt hoofdletters en tekens recht', () => {
    expect(normalizeDealCode(' ab-37 ')).toBe('AB37')
    expect(normalizeDealCode('a b 3 7')).toBe('AB37')
  })

  it('keurt goede codes goed en de rest af', () => {
    expect(isValidDealCode('AB37')).toBe(true)
    expect(isValidDealCode('ab37')).toBe(true)
    expect(isValidDealCode('AB3')).toBe(false)
    expect(isValidDealCode('AB370')).toBe(false)
    expect(isValidDealCode('AB0O')).toBe(false)
    expect(isValidDealCode('')).toBe(false)
  })
})

describe('toegankelijkheid', () => {
  it('spelt de code uit voor een schermlezer', () => {
    expect(spellOut('AB37')).toBe('A, B, 3, 7')
    expect(spellOut('ab-37')).toBe('A, B, 3, 7')
  })
})
