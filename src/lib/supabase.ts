import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null

if (!supabase) {
  console.warn(
    'Supabase niet geconfigureerd: VITE_SUPABASE_URL of VITE_SUPABASE_ANON_KEY ontbreekt.'
  )
}
