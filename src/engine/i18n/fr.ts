// French resources of each game, imported statically: for the command line and the tests. The
// browser loads the catalogs on demand (src/ui/engine.ts).
import type { Catalog } from './presenter'
import type { InputTranslator } from '../game'
import type { GameId } from '../games'
import { frenchFrom } from './french'
import zork1 from './fr/zork1/catalog.json'
import zork2 from './fr/zork2/catalog.json'
import zork3 from './fr/zork3/catalog.json'

const CATALOGS: Partial<Record<GameId, Catalog>> = {
  zork1: zork1 as unknown as Catalog,
  zork2: zork2 as unknown as Catalog,
  zork3: zork3 as unknown as Catalog,
}

export { frenchFrom }

export function loadFrench(game: GameId = 'zork1'): { catalog: Catalog; input: InputTranslator } {
  const catalog = CATALOGS[game]
  if (!catalog) throw new Error(`No French translation for ${game}`)
  return frenchFrom(catalog, game)
}
