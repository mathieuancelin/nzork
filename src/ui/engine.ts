// Loads the game engine in the browser.
import storyUrl from '../engine/story/zork1.z3?url'
import { Game, type Lang } from '../engine/game'
import { loadFrench } from '../engine/i18n/fr'

let story: Uint8Array | null = null

export async function loadStory(): Promise<Uint8Array> {
  if (!story) {
    const res = await fetch(storyUrl)
    story = new Uint8Array(await res.arrayBuffer())
  }
  return story
}

export function createGame(storyData: Uint8Array, lang: Lang, seed = 0): Game {
  const french = lang === 'fr' ? loadFrench() : undefined
  return new Game({ story: storyData, lang, seed, catalog: french?.catalog, input: french?.input })
}
