import type { StopPair } from './schedule'

/**
 * Eén bron van waarheid voor realtime-kanaalnamen per route.
 * Presence (Fase 2) en het tik-duel (Fase 3+4) delen dezelfde basis-roomKey,
 * zodat ze gegarandeerd op hetzelfde "vertrekpunt" aansluiten.
 */
export function roomKeyFor({ line, from, to }: StopPair): string {
  return `route:${line}:${from}:${to}`
}

/** Het duel-kanaal is afgeleid van de presence-roomKey. */
export function duelChannelFor(roomKey: string): string {
  return `${roomKey}:duel`
}
