/**
 * Online ranglijst voor de arcade, via de bestaande Supabase-client.
 *
 * Diep maar robuust:
 * - inserts worden aan een (anonieme) sessie gekoppeld, zodat we "beste per
 *   speler" kunnen tonen en spam beperken;
 * - de toplijst is te filteren op deze week of aller-tijden;
 * - `subscribeScores` luistert via Realtime zodat nieuwe scores vanzelf
 *   binnenkomen.
 *
 * Degradeert netjes: zonder Supabase/tabel geeft alles een lege uitkomst en
 * blijft het lokale persoonlijke record (scoreStore) de achtervang.
 */
import { supabase } from '../lib/supabase'
import { sanitizeName } from '../lib/profanity'

const TABLE = 'arcade_scores'

export type Period = 'all' | 'week'

export interface ScoreRow {
  name: string
  score: number
  user_id?: string | null
  created_at?: string
}

export interface Board {
  rows: ScoreRow[]
  /** Jouw beste plek in deze lijst, ook als je buiten de top staat. */
  you?: { rank: number; score: number; name: string }
}

/** Zorgt voor een (anonieme) sessie en geeft het user-id terug. */
async function ensureSession(): Promise<string | null> {
  const client = supabase
  if (!client) return null
  const {
    data: { session },
  } = await client.auth.getSession()
  if (session?.user) return session.user.id
  const { data } = await client.auth.signInAnonymously()
  return data.user?.id ?? null
}

/** Stuurt een afgeronde score in. Met `room` telt 'ie ook in die overtocht-lijst
 *  (de globale lijst filtert niet op room, dus één insert volstaat voor beide). */
export async function submitScore(
  gameId: string,
  name: string,
  score: number,
  room?: string | null,
): Promise<void> {
  const client = supabase
  if (!client || score <= 0) return
  try {
    const userId = await ensureSession()
    const row: Record<string, unknown> = {
      game_id: gameId,
      name: sanitizeName(name),
      score: Math.floor(score),
      user_id: userId,
    }
    // `room` alleen meesturen als die er is — zo blijft insturen werken ook als
    // migratie 0002 (de room-kolom) nog niet gedraaid is.
    if (room) row.room = room
    await client.from(TABLE).insert(row)
  } catch (e) {
    console.warn('Score insturen mislukt:', e)
  }
}

function periodSince(period: Period): string | null {
  if (period !== 'week') return null
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString()
}

/** Houdt per speler alleen de hoogste score over en sorteert aflopend. */
export function dedupeByPlayer(rows: ScoreRow[]): ScoreRow[] {
  const bestByUser = new Map<string, ScoreRow>()
  const loose: ScoreRow[] = [] // oude rijen zonder user_id
  for (const r of rows) {
    if (r.user_id) {
      const ex = bestByUser.get(r.user_id)
      if (!ex || r.score > ex.score) bestByUser.set(r.user_id, r)
    } else {
      loose.push(r)
    }
  }
  return [...bestByUser.values(), ...loose].sort((a, b) => b.score - a.score)
}

/** Haalt de toplijst op (beste per speler) plus jouw eigen rang.
 *  Met `room` beperkt tot één overtocht; zonder room is het de globale lijst. */
export async function topScores(
  gameId: string,
  period: Period = 'all',
  limit = 10,
  room?: string | null,
): Promise<Board> {
  const client = supabase
  if (!client) return { rows: [] }
  try {
    let query = client
      .from(TABLE)
      .select('name, score, user_id, created_at')
      .eq('game_id', gameId)
      .order('score', { ascending: false })
      .limit(300)
    if (room) query = query.eq('room', room)
    const since = periodSince(period)
    if (since) query = query.gte('created_at', since)

    const { data, error } = await query
    if (error) throw error

    const ranked = dedupeByPlayer(data ?? [])
    const rows = ranked.slice(0, limit)

    let you: Board['you']
    const {
      data: { session },
    } = await client.auth.getSession()
    const uid = session?.user?.id
    if (uid) {
      const idx = ranked.findIndex((r) => r.user_id === uid)
      if (idx >= 0) you = { rank: idx + 1, score: ranked[idx].score, name: ranked[idx].name }
    }
    return { rows, you }
  } catch (e) {
    console.warn('Ranglijst laden mislukt:', e)
    return { rows: [] }
  }
}

/** Luistert op nieuwe scores voor een spel. Geeft een opzeg-functie terug. */
export function subscribeScores(gameId: string, onChange: () => void): () => void {
  const client = supabase
  if (!client) return () => {}
  const channel = client
    .channel(`scores:${gameId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: TABLE, filter: `game_id=eq.${gameId}` },
      () => onChange(),
    )
    .subscribe()
  return () => {
    client.removeChannel(channel)
  }
}
