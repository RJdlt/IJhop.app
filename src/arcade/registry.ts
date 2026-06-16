import type { GameMeta } from './types'
import { createPontHop } from './games/ponthop/PontHop'
import { CharacterShop } from './games/ponthop/CharacterShop'

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
]

export function getGame(id: string): GameMeta | undefined {
  return GAMES.find((g) => g.id === id)
}
