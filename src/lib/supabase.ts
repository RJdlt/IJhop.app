import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { durableStorage } from './durableStorage'

/**
 * Normaliseer de project-URL: supabase-js verwacht de basis
 * (https://<ref>.supabase.co), maar de env-var staat soms per ongeluk op het
 * REST-endpoint (…/rest/v1/). Zonder deze opschoning bouwt de client
 * …/rest/v1/rest/v1/… → "Invalid path specified in request URL", waardoor
 * ranglijst, auth én presence stilletjes breken.
 */
function normalizeUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw
  return raw
    .trim()
    .replace(/\/+$/, '') // trailing slashes
    .replace(/\/(rest|auth|realtime|storage)\/v1$/, '') // per ongeluk een API-pad
    .replace(/\/+$/, '')
}

const url = normalizeUrl(import.meta.env.VITE_SUPABASE_URL)
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        // De anonieme sessie bepaalt `user_id` in de analytics. Bewaar 'm
        // daarom niet alleen in localStorage maar ook in IndexedDB, en herstel
        // 'm daaruit zodra localStorage leeg is. Zonder dit maakte de app bij
        // elke gewiste opslag een nieuwe anonieme gebruiker aan, wat het
        // gebruikersaantal opblies en retentie kunstmatig naar nul duwde.
        // Overige auth-standaarden (persistSession, autoRefreshToken,
        // detectSessionInUrl voor de admin-inloglink) blijven ongewijzigd.
        auth: { storage: durableStorage },
      })
    : null

/** Zorgt voor een (anonieme) sessie en geeft het user-id terug, of null. */
export async function ensureAnonSession(): Promise<string | null> {
  const client = supabase
  if (!client) return null
  try {
    const {
      data: { session },
    } = await client.auth.getSession()
    if (session?.user) return session.user.id
    const { data } = await client.auth.signInAnonymously()
    return data.user?.id ?? null
  } catch {
    return null
  }
}

if (!supabase) {
  console.warn(
    'Supabase niet geconfigureerd: VITE_SUPABASE_URL of VITE_SUPABASE_ANON_KEY ontbreekt.'
  )
}
