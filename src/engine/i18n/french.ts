// The French layer of a game, built from its catalog: the catalog for the presenter, and the
// parser that reads French commands with the game's own words.
import type { Catalog } from './presenter'
import type { InputTranslator } from '../game'
import type { GameId } from '../games'
import { FrenchInput } from '../input/french'

export function frenchFrom(catalog: Catalog, game: GameId = 'zork1'): { catalog: Catalog; input: InputTranslator } {
  return { catalog, input: new FrenchInput(catalog.objects as never, game) }
}
