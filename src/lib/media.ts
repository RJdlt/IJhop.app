/**
 * Plaatjes van partners: verkleinen in de browser en naar Supabase Storage.
 *
 * Verkleinen gebeurt vóór het uploaden, niet erna. Een zaak levert een foto
 * van vier megabyte aan en die staat straks op het klokscherm van iemand die
 * op de steiger in de wind staat te wachten; die moet niet eerst een halve
 * minuut op een plaatje wachten. Webp waar de browser het kan, anders jpeg.
 */
import { supabase } from './supabase'

export const BUCKET = 'partner-media'

/** Maximale zijde na verkleinen. Vierkant logo, liggende foto. */
export const LOGO_MAX = 512
export const PHOTO_MAX = 1200

export type MediaSoort = 'logo' | 'foto'

/** Bestandstypen die we aannemen. Svg blijft ongemoeid: dat schaalt zelf. */
const TOEGESTAAN: Record<MediaSoort, string[]> = {
  logo: ['image/png', 'image/svg+xml', 'image/jpeg', 'image/webp'],
  foto: ['image/jpeg', 'image/webp', 'image/png'],
}

export interface MediaFout {
  ok: false
  reason: string
}
export interface MediaGoed {
  ok: true
  url: string
}
export type MediaUitkomst = MediaGoed | MediaFout

/** Keurt het bestand voordat we er werk in steken. */
export function checkBestand(file: { type: string; size: number }, soort: MediaSoort): MediaFout | null {
  if (!TOEGESTAAN[soort].includes(file.type)) {
    return {
      ok: false,
      reason:
        soort === 'logo'
          ? 'Een logo mag png, svg, jpg of webp zijn.'
          : 'Een foto mag jpg, webp of png zijn.',
    }
  }
  // Tien megabyte is ruim; alles daarboven is bijna zeker een misverstand.
  if (file.size > 10 * 1024 * 1024) {
    return { ok: false, reason: 'Dit bestand is groter dan 10 MB. Kies een kleinere versie.' }
  }
  return null
}

/** De maat waarop we uitkomen, met de verhouding intact. */
export function pasMaat(
  breedte: number,
  hoogte: number,
  max: number,
): { w: number; h: number } {
  const grootste = Math.max(breedte, hoogte)
  if (grootste <= max || grootste === 0) return { w: breedte, h: hoogte }
  const factor = max / grootste
  return { w: Math.round(breedte * factor), h: Math.round(hoogte * factor) }
}

/** Ondersteunt deze browser webp bij het wegschrijven van een canvas? */
function kanWebp(): boolean {
  try {
    const c = document.createElement('canvas')
    c.width = 1
    c.height = 1
    return c.toDataURL('image/webp').startsWith('data:image/webp')
  } catch {
    return false
  }
}

/** Verkleint via een canvas. Svg gaat ongemoeid door: dat is al schaalbaar. */
export async function verklein(file: File, max: number): Promise<Blob> {
  if (file.type === 'image/svg+xml') return file
  const bitmap = await createImageBitmap(file)
  const { w, h } = pasMaat(bitmap.width, bitmap.height, max)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()
  const type = kanWebp() ? 'image/webp' : 'image/jpeg'
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85))
  return blob ?? file
}

/** Bestandsnaam in de bak: per partner een map, met een tijdstempel zodat een
 *  nieuwe versie niet achter een oude cache blijft hangen. */
export function opslagPad(partnerSlug: string, soort: MediaSoort, ext: string): string {
  return `${partnerSlug}/${soort}-${Date.now().toString(36)}.${ext}`
}

function extensieVoor(type: string): string {
  if (type === 'image/svg+xml') return 'svg'
  if (type === 'image/webp') return 'webp'
  if (type === 'image/png') return 'png'
  return 'jpg'
}

/** Verkleint en uploadt; geeft de publieke URL terug. */
export async function uploadMedia(
  file: File,
  soort: MediaSoort,
  partnerSlug: string,
): Promise<MediaUitkomst> {
  const fout = checkBestand(file, soort)
  if (fout) return fout
  const client = supabase
  if (!client) return { ok: false, reason: 'Geen verbinding met de database.' }

  let blob: Blob
  try {
    blob = await verklein(file, soort === 'logo' ? LOGO_MAX : PHOTO_MAX)
  } catch {
    return { ok: false, reason: 'Dit plaatje kon ik niet verkleinen. Probeer een andere versie.' }
  }

  const pad = opslagPad(partnerSlug, soort, extensieVoor(blob.type || file.type))
  try {
    const { error } = await client.storage.from(BUCKET).upload(pad, blob, {
      contentType: blob.type || file.type,
      cacheControl: '31536000',
      upsert: false,
    })
    if (error) {
      const melding = error.message.toLowerCase()
      if (melding.includes('bucket') && melding.includes('not found')) {
        return { ok: false, reason: 'De opslagbak bestaat nog niet. Draai migratie 0024.' }
      }
      if (melding.includes('policy') || melding.includes('unauthorized') || melding.includes('403')) {
        return { ok: false, reason: 'Geen rechten om te uploaden. Ben je nog ingelogd als admin?' }
      }
      return { ok: false, reason: `Uploaden lukte niet: ${error.message}` }
    }
    const { data } = client.storage.from(BUCKET).getPublicUrl(pad)
    return { ok: true, url: data.publicUrl }
  } catch (err) {
    return { ok: false, reason: `Uploaden lukte niet: ${err instanceof Error ? err.message : String(err)}` }
  }
}
