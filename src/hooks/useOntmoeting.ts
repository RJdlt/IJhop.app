import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { buildSignal, matchSeed, type MeetingSignal } from '../arcade/ontmoeting/signal'

/**
 * Pont Ontmoeting, 1-op-1 matchmaking via Supabase Realtime presence.
 *
 * Iedereen die meedoet op dezelfde overtocht joint hetzelfde presence-kanaal.
 * Uit de gedeelde presence-lijst leiden beide kanten deterministisch hetzelfde
 * paar af (gesorteerde user-ids, per twee). Geen aparte matchmaking-server nodig.
 * Het signaal plus de plek volgt lokaal uit de match-seed, dus dat werkt ook als
 * het bereik daarna wegvalt.
 */
export interface OntmoetingState {
  status: 'idle' | 'waiting' | 'matched'
  count: number
  partner: string | null
  signal: MeetingSignal | null
}

export function useOntmoeting(
  room: string | null,
  userId: string | null,
  nick: string,
  active: boolean,
): OntmoetingState {
  const [members, setMembers] = useState<string[]>([])

  useEffect(() => {
    if (!active) {
      setMembers([])
      return
    }
    const client = supabase
    if (!client || !room || !userId) return
    const channel = client.channel(`ontmoeting:${room}`, {
      config: { presence: { key: userId } },
    })
    channel
      .on('presence', { event: 'sync' }, () => {
        setMembers(Object.keys(channel.presenceState()).sort())
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') channel.track({ nick })
      })
    return () => {
      client.removeChannel(channel)
      setMembers([])
    }
  }, [room, userId, nick, active])

  return useMemo(() => {
    if (!active || !userId) return { status: 'idle', count: 0, partner: null, signal: null }
    const idx = members.indexOf(userId)
    if (members.length < 2 || idx < 0) {
      return { status: 'waiting', count: members.length, partner: null, signal: null }
    }
    // Per twee koppelen op gesorteerde positie.
    const pairStart = idx - (idx % 2)
    const partnerIdx = pairStart === idx ? idx + 1 : pairStart
    const partner = partnerIdx < members.length ? members[partnerIdx] : null
    if (!partner) return { status: 'waiting', count: members.length, partner: null, signal: null }
    const signal = buildSignal(matchSeed(room ?? '', userId, partner))
    return { status: 'matched', count: members.length, partner, signal }
  }, [members, userId, active, room])
}
