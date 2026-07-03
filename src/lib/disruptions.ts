/**
 * Client voor officiele veerstoringen via onze eigen /api/storingen
 * (serverless proxy op het NDOV/OVapi GTFS-Realtime alerts-feed).
 * Laadt altijd parallel aan de aftelklok en faalt stil: geen banner is
 * beter dan een blokkerend hoofdscherm.
 */
import { LINES, LINE_IDS } from './schedule'
import type { LineId } from '../types'

export interface Disruption {
  id: string
  header: string
  /** Geraakte veersteigers (stop-sleutels); leeg = algemene veermelding. */
  stops: string[]
  start: number | null
  end: number | null
}
export interface DisruptionFeed {
  updated: string
  alerts: Disruption[]
  degraded?: boolean
}

export async function fetchDisruptions(): Promise<DisruptionFeed | null> {
  try {
    const r = await fetch('/api/storingen', { signal: AbortSignal.timeout(8000) })
    if (!r.ok) return null
    return (await r.json()) as DisruptionFeed
  } catch {
    return null
  }
}

/** Welke lijnen raakt deze melding? Een lijn is geraakt als een van haar twee
 *  steigers genoemd wordt. Lege stops-lijst = algemeen: alle lijnen relevant. */
export function affectedLines(d: Disruption): LineId[] {
  if (d.stops.length === 0) return [...LINE_IDS]
  const hit = new Set(d.stops)
  return LINE_IDS.filter((id) => LINES[id].connects.some((s) => hit.has(s)))
}
