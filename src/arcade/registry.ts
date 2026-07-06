import type { GameMeta } from './types'
import { createPontHop } from './games/ponthop/PontHop'
import { createOversteek } from './games/oversteek/Oversteek'
import { CharacterShop } from './games/ponthop/CharacterShop'
import { SkinPicker } from './games/oversteek/SkinPicker'

/**
 * De enige plek waar spellen geregistreerd worden. Een tweede spel toevoegen
 * is: nieuw bestand dat `GameModule` implementeert + één regel hieronder.
 */
export const GAMES: GameMeta[] = [
  {
    id: 'ponthop',
    emoji: '🛥️',
    title: { nl: 'Pont Hop', en: 'Pont Hop' },
    tagline: { nl: 'Steek het IJ over', en: 'Cross the IJ' },
    create: createPontHop,
    MenuPanel: CharacterShop,
  },
  {
    id: 'oversteek',
    emoji: '⛴️',
    title: { nl: 'De Oversteek', en: 'The Crossing' },
    tagline: { nl: 'Sleep, versnel en vervoer passagiers', en: 'Drag, throttle and ferry passengers' },
    create: createOversteek,
    MenuPanel: SkinPicker,
    inputMode: 'continuous',
  },
]

export function getGame(id: string): GameMeta | undefined {
  return GAMES.find((g) => g.id === id)
}
