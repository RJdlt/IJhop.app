import type { StopId } from '../types'
import { STOPS } from './schedule'

/** Comfortable average walking speed in metres per second (~5 km/h). */
export const WALK_SPEED_MPS = 1.35

export interface Coords {
  lat: number
  lon: number
}

/** Great-circle distance in metres between two coordinates. */
export function haversine(a: Coords, b: Coords): number {
  const R = 6371000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export interface PierDistance {
  stop: StopId
  meters: number
  walkSeconds: number
}

/** Walking distance + time from a position to every pier, nearest first. */
export function pierDistances(from: Coords): PierDistance[] {
  return (Object.keys(STOPS) as StopId[])
    .map((stop) => {
      const meters = haversine(from, { lat: STOPS[stop].lat, lon: STOPS[stop].lon })
      return { stop, meters, walkSeconds: Math.round(meters / WALK_SPEED_MPS) }
    })
    .sort((a, b) => a.meters - b.meters)
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`
  return `${(meters / 1000).toFixed(1)} km`
}
