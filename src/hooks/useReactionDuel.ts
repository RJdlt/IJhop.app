import { useCallback, useEffect, useRef, useState } from 'react'
import { useBroadcast } from './useBroadcast'

export type DuelPhase = 'idle' | 'countdown' | 'go' | 'done'
export interface DuelResult { userId: string; nick: string; reactionMs: number }
type Msg =
  | { t: 'round'; host: string }
  | { t: 'go' }
  | { t: 'tap'; userId: string; nick: string; reactionMs: number }

export function useReactionDuel(
  channelName: string | null,
  userId: string | null,
  nick: string,
  playerCount: number,
) {
  const [phase, setPhase] = useState<DuelPhase>('idle')
  const [results, setResults] = useState<DuelResult[]>([])
  const goAtRef = useRef<number | null>(null)
  const tappedRef = useRef(false)
  const goTimer = useRef<number | undefined>(undefined)
  const endTimer = useRef<number | undefined>(undefined)
  const sendRef = useRef<(m: Msg) => void>(() => {})

  const clearTimers = () => {
    if (goTimer.current) window.clearTimeout(goTimer.current)
    if (endTimer.current) window.clearTimeout(endTimer.current)
  }

  const { send } = useBroadcast<Msg>(channelName, (m) => {
    if (m.t === 'round') {
      clearTimers()
      tappedRef.current = false
      goAtRef.current = null
      setResults([])
      setPhase('countdown')
      if (m.host === userId) {
        const delay = 2000 + Math.random() * 3000
        goTimer.current = window.setTimeout(() => sendRef.current({ t: 'go' }), delay)
      }
    } else if (m.t === 'go') {
      goAtRef.current = Date.now()
      setPhase('go')
      endTimer.current = window.setTimeout(() => setPhase('done'), 5000)
    } else if (m.t === 'tap') {
      setResults((prev) => {
        if (prev.some((r) => r.userId === m.userId)) return prev
        const next = [...prev, { userId: m.userId, nick: m.nick, reactionMs: m.reactionMs }]
        if (next.length >= playerCount) setPhase('done')
        return next
      })
    }
  })
  sendRef.current = send

  const start = useCallback(() => {
    if (userId) send({ t: 'round', host: userId })
  }, [send, userId])

  const tap = useCallback(() => {
    if (!userId || tappedRef.current) return
    if (phase === 'countdown') {
      tappedRef.current = true
      send({ t: 'tap', userId, nick, reactionMs: -1 })
    } else if (phase === 'go' && goAtRef.current != null) {
      tappedRef.current = true
      send({ t: 'tap', userId, nick, reactionMs: Date.now() - goAtRef.current })
    }
  }, [phase, send, userId, nick])

  useEffect(() => () => clearTimers(), [])

  const ranking = [...results].sort(
    (a, b) => (a.reactionMs < 0 ? Infinity : a.reactionMs) - (b.reactionMs < 0 ? Infinity : b.reactionMs),
  )

  return { phase, ranking, start, tap, reset: () => setPhase('idle') }
}
