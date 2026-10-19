// The game a tool works on: --game zork2 (or GAME=zork2), Zork I by default, and where its
// files live.
import { readFileSync } from 'node:fs'
import { GAMES, isGameId, type GameId } from '../src/engine/games'

export function toolGame(argv = process.argv.slice(2)): GameId {
  const i = argv.indexOf('--game')
  const id = i >= 0 ? argv[i + 1] : (process.env.GAME ?? 'zork1')
  if (!isGameId(id)) throw new Error(`Unknown game "${id}" (zork1, zork2 or zork3)`)
  return id
}

/** Arguments without --game and its value. */
export function argsWithoutGame(argv = process.argv.slice(2)): string[] {
  const i = argv.indexOf('--game')
  return i >= 0 ? [...argv.slice(0, i), ...argv.slice(i + 2)] : argv
}

const ROOT = new URL('../', import.meta.url)

export function gamePaths(id: GameId) {
  return {
    story: new URL(`src/engine/story/${id}/${GAMES[id].file}`, ROOT),
    symbols: new URL(`src/engine/story/${id}/symbols.json`, ROOT),
    /** Historical sources (git submodule). */
    vendor: new URL(`vendor/${id}/`, ROOT),
    /** English catalog (out/), translation batches (work/), review transcripts. */
    catalog: new URL(`tools/catalog/${id}/`, ROOT),
    /** French catalog: parts/, objects.json, catalog.json. */
    french: new URL(`src/engine/i18n/fr/${id}/`, ROOT),
    /** Map layout, scenes, item icons. */
    data: new URL(`src/data/${id}/`, ROOT),
  }
}

export function readStory(id: GameId): Uint8Array {
  return new Uint8Array(readFileSync(gamePaths(id).story))
}

/** A game ready to play, in English or in French. */
export async function newGame(id: GameId, lang: 'en' | 'fr', seed: number) {
  const { Game } = await import('../src/engine/game')
  const french = lang === 'fr' ? (await import('../src/engine/i18n/fr')).loadFrench(id) : undefined
  return new Game({ game: id, story: readStory(id), lang, seed, catalog: french?.catalog, input: french?.input })
}
