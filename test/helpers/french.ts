import { readFileSync } from 'node:fs'
import { Game } from '../../src/engine/game'
import { loadFrench } from '../../src/engine/i18n/fr'
import { STORY_PATH } from './plain'

export function frenchGame(seed = 1234): Game {
  const story = new Uint8Array(readFileSync(STORY_PATH))
  const fr = loadFrench()
  return new Game({ story, lang: 'fr', seed, catalog: fr.catalog, input: fr.input })
}
