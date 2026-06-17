import { createClient, type SupabaseClient } from '@supabase/supabase-js'

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
  url && anonKey ? createClient(url, anonKey) : null

if (!supabase) {
  console.warn(
    'Supabase niet geconfigureerd: VITE_SUPABASE_URL of VITE_SUPABASE_ANON_KEY ontbreekt.'
  )
}
