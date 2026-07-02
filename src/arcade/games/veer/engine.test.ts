import { describe, expect, it } from 'vitest'
import { createVeerWorld, stepVeer, steerVeer, progressFraction } from './engine'

const world = () => createVeerWorld({ width: 360, height: 640, seed: 7 })

describe('Vaar de Pont engine', () => {
  it('start met de pont in het midden en zonder vaart', () => {
    const w = world()
    expect(w.ferry.x).toBeCloseTo(180)
    expect(w.scroll).toBe(0)
    expect(w.over).toBe(false)
  })

  it('vaart pas vooruit nadat je begonnen bent te sturen', () => {
    const w = world()
    stepVeer(w, 0.1)
    expect(w.scroll).toBe(0) // nog niet gestart
    steerVeer(w, 'right')
    stepVeer(w, 0.1)
    expect(w.scroll).toBeGreaterThan(0)
  })

  it('sturen verplaatst de pont zijwaarts', () => {
    const w = world()
    steerVeer(w, 'right')
    const x0 = w.ferry.x
    stepVeer(w, 0.05)
    expect(w.ferry.x).toBeGreaterThan(x0)
  })

  it('is deterministisch bij dezelfde seed en invoer', () => {
    const a = world()
    const b = world()
    for (let i = 0; i < 30; i++) {
      steerVeer(a, i % 2 ? 'left' : 'right')
      steerVeer(b, i % 2 ? 'left' : 'right')
      stepVeer(a, 0.05)
      stepVeer(b, 0.05)
    }
    expect(a.scroll).toBe(b.scroll)
    expect(a.ferry.x).toBe(b.ferry.x)
    expect(a.score).toBe(b.score)
  })

  it('voortgangsfractie blijft tussen 0 en 1', () => {
    const w = world()
    steerVeer(w, 'right')
    for (let i = 0; i < 50; i++) stepVeer(w, 0.05)
    const p = progressFraction(w)
    expect(p).toBeGreaterThanOrEqual(0)
    expect(p).toBeLessThan(1)
  })

  it('pakt een stroopwafel onder de pont op en telt punten', () => {
    const w = world()
    steerVeer(w, 'right')
    w.boats = [] // geen boten die de test in de weg varen
    w.items = [{ x: w.ferry.x, y: w.scroll + 4, r: 12, kind: 'coin', taken: false }]
    const c0 = w.coins
    const s0 = w.score
    for (let i = 0; i < 4; i++) stepVeer(w, 0.02)
    expect(w.coins).toBe(c0 + 1)
    expect(w.score).toBeGreaterThan(s0)
  })

  it('een schild vangt precies een aanvaring op', () => {
    const w = world()
    steerVeer(w, 'right')
    w.boats = [{ x: w.ferry.x, y: w.scroll + 2, w: 40, len: 20, kind: 'taxi', vx: 0 }]
    w.items = []
    w.shield = 1
    for (let i = 0; i < 3; i++) stepVeer(w, 0.02)
    expect(w.over).toBe(false)
    expect(w.shield).toBe(0)
  })
})
