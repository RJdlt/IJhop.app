import { useCallback, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

/** Lichtgewicht realtime-broadcast op één kanaal. Eén payload-type in/uit. */
export function useBroadcast<T>(channelName: string | null, onMessage?: (payload: T) => void) {
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null)
  const cbRef = useRef(onMessage)
  cbRef.current = onMessage

  useEffect(() => {
    const client = supabase
    if (!client || !channelName) return
    const channel = client.channel(channelName, { config: { broadcast: { self: true } } })
    channel
      .on('broadcast', { event: 'msg' }, (m) => cbRef.current?.(m.payload as T))
      .subscribe()
    channelRef.current = channel
    return () => {
      client.removeChannel(channel)
      channelRef.current = null
    }
  }, [channelName])

  const send = useCallback((payload: T) => {
    channelRef.current?.send({ type: 'broadcast', event: 'msg', payload })
  }, [])

  return { send }
}
