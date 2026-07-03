/**
 * Community-vertragingsmeldingen: anoniem, één tik, met server-side rem
 * (migratie 0013). De client spiegelt de 20-minuten-cooldown in localStorage
 * zodat de knop meteen de juiste status toont, maar de server is de waarheid.
 */
import { supabase, ensureAnonSession } from './supabase'

const COOLDOWN_MS = 20 * 60 * 1000
const key = (line: string) => `ijhop:delay:${line}`

export interface DelayCount {
  line_id: string
  reports: number
  latest: string
}

/** Mag deze gebruiker (lokaal gezien) nu melden voor deze lijn? */
export function canReport(line: string): boolean {
  try {
    const t = Number(localStorage.getItem(key(line)) ?? 0)
    return Date.now() - t > COOLDOWN_MS
  } catch {
    return true
  }
}

/** Meld een vertraging. Retourneert het actuele aantal meldingen, of null bij falen. */
export async function reportDelay(line: string): Promise<{ ok: boolean; reports: number } | null> {
  if (!supabase) return null
  try {
    await ensureAnonSession()
    const { data, error } = await supabase.rpc('report_delay', { p_line: line })
    if (error) return null
    const r = data as { ok: boolean; reports: number }
    try {
      localStorage.setItem(key(line), String(Date.now()))
    } catch {
      /* faal stil */
    }
    return { ok: r.ok, reports: r.reports }
  } catch {
    return null
  }
}

/** Actuele meldingen per lijn (laatste 20 minuten), anoniem geteld. */
export async function fetchDelayCounts(): Promise<DelayCount[]> {
  if (!supabase) return []
  try {
    const { data, error } = await supabase.rpc('delay_counts')
    if (error || !Array.isArray(data)) return []
    return data as DelayCount[]
  } catch {
    return []
  }
}
