import { describe, expect, it } from 'vitest'
import {
  createOversteekWorld,
  setPointer,
  stepOversteek,
  legProgress,
  streakMultiplier,
  FERRY_HALF,
  CROSS_DIST,
} from './engine'

const W = 360
const H = 700

const world = () => createOversteekWorld({ width: W, height: H, seed: 7 })

describe('De Oversteek engine', () => {
  it('start gecentreerd, stilstaand en niet begonnen', () => {
    const w = world()
    expect(w.ferry.x).toBeCloseTo(W / 2)
    expect(w.scroll).toBe(0)
    expect(w.speed).toBe(0)
    expect(w.started).toBe(false)
    expect(w.over).toBe(false)
    expect(w.passengers.length).toBeGreaterThanOrEqual(2)
    expect(w.passengers.length).toBeLessThanOrEqual(5)
  })

  it('sturen reageert al binnen één stap, ook vóór de eerste aanraking', () => {
    const w = world()
    const x0 = w.ferry.x
    setPointer(w, 0.85, true)
    stepOversteek(w, 0.05)
    expect(w.ferry.x).toBeGreaterThan(x0)
  })

  it('vaart pas vooruit nadat je hebt vastgehouden', () => {
    const w = world()
    stepOversteek(w, 0.1)
    expect(w.scroll).toBe(0) // nog niet aangeraakt
    setPointer(w, 0.5, true)
    stepOversteek(w, 0.1)
    expect(w.scroll).toBeGreaterThan(0)
  })

  it('remt af zodra je loslaat', () => {
    const w = world()
    setPointer(w, 0.5, true)
    for (let i = 0; i < 20; i++) stepOversteek(w, 0.05)
    const speedHeld = w.speed
    expect(speedHeld).toBeGreaterThan(0)
    setPointer(w, 0.5, false)
    stepOversteek(w, 0.05)
    expect(w.speed).toBeLessThan(speedHeld)
  })

  it('is deterministisch bij dezelfde seed en invoer', () => {
    const a = world()
    const b = world()
    for (let i = 0; i < 60; i++) {
      setPointer(a, i % 2 ? 0.2 : 0.8, true)
      setPointer(b, i % 2 ? 0.2 : 0.8, true)
      stepOversteek(a, 0.05)
      stepOversteek(b, 0.05)
    }
    expect(a.scroll).toBe(b.scroll)
    expect(a.score).toBe(b.score)
    expect(a.streak).toBe(b.streak)
  })

  it('voltooit een oversteek en beloont afgeleverde passagiers', () => {
    const w = world()
    setPointer(w, 0.5, true)
    w.scroll = CROSS_DIST - 5
    w.speed = 200
    w.legStartT = w.t
    const legBefore = w.legIndex
    stepOversteek(w, 0.05)
    expect(w.legIndex).toBe(legBefore + 1)
    expect(w.score).toBeGreaterThan(0)
    expect(w.streak).toBe(1) // schone oversteek, geen botsingen
  })

  it('een zware botsing (binnenvaartschip) beëindigt het spel', () => {
    const w = world()
    setPointer(w, 0.5, true)
    w.obstacles = [
      { x: w.ferry.x, y: 2, w: 100, len: 50, kind: 'binnenvaart', vx: 0, baseX: w.ferry.x, weaveAmp: 0, weaveFreq: 0, weavePhase: 0, heavy: true, hitDone: false, nearDone: false },
    ]
    w.speed = 50
    stepOversteek(w, 0.05)
    expect(w.over).toBe(true)
  })

  it('een lichte botsing geeft een penalty maar geen game over', () => {
    const w = world()
    setPointer(w, 0.5, true)
    w.obstacles = [
      { x: w.ferry.x, y: 2, w: 30, len: 20, kind: 'taxi', vx: 0, baseX: w.ferry.x, weaveAmp: 0, weaveFreq: 0, weavePhase: 0, heavy: false, hitDone: false, nearDone: false },
    ]
    w.speed = 50
    stepOversteek(w, 0.05)
    expect(w.over).toBe(false)
    expect(w.minorHits).toBe(1)
    expect(w.streak).toBe(0)
  })

  it('een ongeduldige passagier zonder geduld kost punten en loopt weg', () => {
    const w = world()
    w.score = 20
    w.passengers = [{ type: 'toerist', mood: 'ongeduldig', patience: 0.01, maxPatience: 10, lost: false }]
    setPointer(w, 0.5, true)
    stepOversteek(w, 0.05)
    expect(w.passengers[0].lost).toBe(true)
    expect(w.passengersLost).toBe(1)
    expect(w.score).toBeLessThan(20)
  })

  it('voortgang binnen de oversteek blijft tussen 0 en 1', () => {
    const w = world()
    setPointer(w, 0.5, true)
    for (let i = 0; i < 80; i++) stepOversteek(w, 0.05)
    const p = legProgress(w)
    expect(p).toBeGreaterThanOrEqual(0)
    expect(p).toBeLessThan(1)
  })

  it('klemt de pont binnen het speelveld', () => {
    const w = world()
    setPointer(w, -5, true) // buiten bereik, moet klemmen op 0
    for (let i = 0; i < 30; i++) stepOversteek(w, 0.05)
    expect(w.ferry.x).toBeGreaterThanOrEqual(FERRY_HALF)
    setPointer(w, 99, true)
    for (let i = 0; i < 30; i++) stepOversteek(w, 0.05)
    expect(w.ferry.x).toBeLessThanOrEqual(W - FERRY_HALF)
  })

  it('streakMultiplier volgt de opgegeven drempels', () => {
    expect(streakMultiplier(0)).toBe(1)
    expect(streakMultiplier(4)).toBe(1)
    expect(streakMultiplier(5)).toBe(2)
    expect(streakMultiplier(9)).toBe(2)
    expect(streakMultiplier(10)).toBe(5)
  })
})
