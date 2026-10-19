import { Game, type GameId } from '../../src/engine/game'
import { loadFrench } from '../../src/engine/i18n/fr'
import { loadStory } from './plain'

export function frenchGame(seed = 1234, game: GameId = 'zork1'): Game {
  const fr = loadFrench(game)
  return new Game({ game, story: loadStory(game), lang: 'fr', seed, catalog: fr.catalog, input: fr.input })
}
