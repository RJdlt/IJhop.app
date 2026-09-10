import { describe, expect, it } from 'vitest'
import { dismissActive, shouldShow, VARIANT_B_DELAY_MS } from './InstallPrompt'

const DAG = 86_400_000

describe('wanneer tonen we de uitnodiging', () => {
  it('arm A wacht op het tweede bezoek', () => {
    expect(shouldShow('A', 1, 0)).toBe(false)
    expect(shouldShow('A', 1, 10 * 60_000)).toBe(false)
    expect(shouldShow('A', 2, 0)).toBe(true)
  })

  it('arm B vraagt het al bij het eerste bezoek, maar pas na 30 seconden', () => {
    expect(shouldShow('B', 1, 0)).toBe(false)
    expect(shouldShow('B', 1, VARIANT_B_DELAY_MS - 1000)).toBe(false)
    expect(shouldShow('B', 1, VARIANT_B_DELAY_MS)).toBe(true)
  })

  it('arm B wacht niet nog eens bij een tweede bezoek', () => {
    expect(shouldShow('B', 2, 0)).toBe(true)
  })
})

describe('wegklikken werkt 14 dagen', () => {
  const nu = Date.parse('2026-09-10T12:00:00Z')

  it('zwijgt binnen 14 dagen', () => {
    expect(dismissActive(String(nu - 13 * DAG), nu)).toBe(true)
  })

  it('mag het na 14 dagen weer vragen', () => {
    expect(dismissActive(String(nu - 15 * DAG), nu)).toBe(false)
  })

  it('nooit weggeklikt is gewoon tonen', () => {
    expect(dismissActive(null, nu)).toBe(false)
  })

  it('respecteert de oude vlag zonder tijdstip', () => {
    // Voor deze wijziging schreven we hier '1' neer, zonder datum. Wie toen
    // wegklikte krijgt hem niet ineens weer in beeld.
    expect(dismissActive('1', nu)).toBe(true)
  })
})
