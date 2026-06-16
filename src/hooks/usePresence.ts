import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Lichtgewicht presence: telt hoeveel mensen er op hetzelfde kanaal "meewachten".
 * Eén tracker per userId; geeft het aantal online deelnemers terug.
 */
export function usePresence(channelName: string | null, userId: string | null, nick: string) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const client = supabase
    if (!client || !channelName || !userId) return

    const channel = client.channel(channelName, {
      config: { presence: { key: userId } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        setCount(Object.keys(channel.presenceState()).length)
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.track({ nick })
        }
      })

    return () => {
      client.removeChannel(channel)
      setCount(0)
    }
  }, [channelName, userId, nick])

  return count
}
