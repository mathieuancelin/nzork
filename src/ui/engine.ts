// Loads the games in the browser: the story file and, for the French version, the catalog of
// the game, fetched on demand (a game that is not played is never downloaded).
import zork1Story from '../engine/story/zork1/zork1.z3?url'
import zork2Story from '../engine/story/zork2/zork2.z3?url'
import zork3Story from '../engine/story/zork3/zork3.z3?url'
import { Game, type Lang } from '../engine/game'
import { GAMES, type GameId } from '../engine/games'
import type { Catalog } from '../engine/i18n/presenter'
import { frenchFrom } from '../engine/i18n/french'

const STORIES: Record<GameId, string> = { zork1: zork1Story, zork2: zork2Story, zork3: zork3Story }
const CATALOGS: Partial<Record<GameId, () => Promise<{ default: unknown }>>> = {
  zork1: () => import('../engine/i18n/fr/zork1/catalog.json'),
  zork2: () => import('../engine/i18n/fr/zork2/catalog.json'),
  zork3: () => import('../engine/i18n/fr/zork3/catalog.json'),
}

export interface GameData {
  id: GameId
  story: Uint8Array
  /** The French catalog, when the game is translated. */
  catalog?: Catalog
}

const loaded = new Map<GameId, Promise<GameData>>()

export function loadGameData(id: GameId): Promise<GameData> {
  let p = loaded.get(id)
  if (!p) {
    p = (async () => {
      const [story, catalog] = await Promise.all([
        fetch(STORIES[id]).then(async (r) => new Uint8Array(await r.arrayBuffer())),
        GAMES[id].french ? CATALOGS[id]?.().then((m) => m.default as Catalog) : undefined,
      ])
      return { id, story, catalog }
    })()
    // a failed download can be tried again
    p.catch(() => loaded.delete(id))
    loaded.set(id, p)
  }
  return p
}

/** A game in the chosen language; a game without a French translation plays in English. */
export function createGame(data: GameData, lang: Lang, seed = 0): Game {
  const french = lang === 'fr' && data.catalog ? frenchFrom(data.catalog, data.id) : undefined
  return new Game({ game: data.id, story: data.story, lang: french ? 'fr' : 'en', seed, catalog: french?.catalog, input: french?.input })
}
