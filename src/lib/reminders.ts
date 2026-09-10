/**
 * De vertrek-nu-melding.
 *
 * De app zet alleen een rij in de database; het versturen doet de server
 * (api/reminder-check.mjs, elke minuut). Zo komt de melding ook binnen als de
 * app dicht is, en dat is nu juist het punt: je hebt hem nodig terwijl je
 * iets anders doet.
 *
 * Zonder toestemming voor meldingen vragen we die op dit moment. Dit is het
 * beste moment dat er is: iemand vraagt zelf om een seintje.
 */
import { supabase } from './supabase'
import { pushSupported, subscribePush, subscribedLines } from './push'

export interface Herinnering {
  fire_at: string
}

export async function myReminder(): Promise<Herinnering | null> {
  const client = supabase
  if (!client) return null
  try {
    const { data, error } = await client.rpc('my_reminder')
    if (error || !data) return null
    return data as Herinnering
  } catch {
    return null
  }
}

/**
 * Zet de herinnering. Vraagt zo nodig eerst toestemming voor meldingen.
 * Lukt dat niet, dan zetten we hem alsnog in de database: de in-app aftelling
 * werkt dan zolang de app open staat, en zodra iemand later wel toestemming
 * geeft doet de bestaande melding het.
 */
export async function setReminder(fireAtIso: string, title: string, body: string): Promise<boolean> {
  const client = supabase
  if (!client) return false
  // Nog geen abonnement? Vraag het nu. Iemand die om een seintje vraagt is
  // veel eerder geneigd ja te zeggen dan iemand die de app net opent.
  if (pushSupported() && subscribedLines() == null) {
    try {
      await subscribePush([])
    } catch {
      /* geweigerd of mislukt; we gaan alsnog door */
    }
  }
  try {
    const { error } = await client.rpc('set_reminder', {
      p_fire_at: fireAtIso,
      p_title: title,
      p_body: body,
    })
    return !error
  } catch {
    return false
  }
}

export async function cancelReminder(): Promise<boolean> {
  const client = supabase
  if (!client) return false
  try {
    const { error } = await client.rpc('cancel_reminder')
    return !error
  } catch {
    return false
  }
}
