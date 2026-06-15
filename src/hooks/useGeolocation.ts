import { useCallback, useState } from 'react'
import type { Coords } from '../lib/geo'

export type GeoStatus = 'idle' | 'locating' | 'ready' | 'denied' | 'unavailable'

export interface GeoState {
  status: GeoStatus
  coords: Coords | null
  request: () => void
}

export function useGeolocation(): GeoState {
  const [status, setStatus] = useState<GeoStatus>('idle')
  const [coords, setCoords] = useState<Coords | null>(null)

  const request = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setStatus('unavailable')
      return
    }
    setStatus('locating')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude })
        setStatus('ready')
      },
      (err) => {
        setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    )
  }, [])

  return { status, coords, request }
}
