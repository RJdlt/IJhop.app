import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useAnonSession() {
  const [userId, setUserId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true

    async function init() {
      if (!supabase) {
        if (active) setReady(true)
        return
      }

      const { data: { session } } = await supabase.auth.getSession()

      if (session?.user) {
        if (active) {
          setUserId(session.user.id)
          setReady(true)
        }
        return
      }

      const { data, error } = await supabase.auth.signInAnonymously()
      if (active) {
        if (error) {
          console.error('Anonieme sessie mislukt:', error.message)
        } else {
          setUserId(data.user?.id ?? null)
        }
        setReady(true)
      }
    }

    init()

    return () => {
      active = false
    }
  }, [])

  return { userId, ready }
}
