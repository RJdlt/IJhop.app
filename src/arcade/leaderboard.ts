/**
 * Online ranglijst voor de arcade, via de bestaande Supabase-client.
 *
 * Degradeert netjes: zonder Supabase-config of bij een ontbrekende tabel
 * geeft `topScores` simpelweg een lege lijst en doet `submitScore` niets.
 * De lokale `scoreStore` blijft het persoonlijke record bewaren als offline
 * achtervang.
 */
import { supabase } from '../lib/supabase'

const TABLE = 'arcade_scores'

export interface ScoreRow {
  name: string
  score: number
  created_at?: string
}

/** Stuurt een afgeronde score in. Stil falen mag: scores zijn niet kritiek. */
export async function submitScore(gameId: string, name: string, score: number): Promise<void> {
  const client = supabase
  if (!client || score <= 0) return
  try {
    // Zorg dat we (anoniem) ingelogd zijn, zodat user_id ingevuld kan worden.
    const {
      data: { session },
    } = await client.auth.getSession()
    let userId = session?.user?.id ?? null
    if (!userId) {
      const { data } = await client.auth.signInAnonymously()
      userId = data.user?.id ?? null
    }
    await client.from(TABLE).insert({
      game_id: gameId,
      name: name.trim().slice(0, 24) || 'Anoniem',
      score: Math.floor(score),
      user_id: userId,
    })
  } catch (e) {
    console.warn('Score insturen mislukt:', e)
  }
}

/** Haalt de hoogste scores voor een spel op (aflopend). */
export async function topScores(gameId: string, limit = 10): Promise<ScoreRow[]> {
  const client = supabase
  if (!client) return []
  try {
    const { data, error } = await client
      .from(TABLE)
      .select('name, score, created_at')
      .eq('game_id', gameId)
      .order('score', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data ?? []
  } catch (e) {
    console.warn('Ranglijst laden mislukt:', e)
    return []
  }
}
