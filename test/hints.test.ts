// InvisiClues: only questions about places seen, solved as the puzzles are.
import { describe, it, expect } from 'vitest'
import { Game } from '../src/engine/game'
import { hintsFor } from '../src/engine/assist/hints'
import { visitedRooms } from '../src/engine/assist/map'
import { loadStory } from './helpers/plain'
import { frenchGame } from './helpers/french'
import { playWalkthrough } from './helpers/walkthrough'

describe('hints', () => {
  it('asks only about the places seen, in the language of the game', () => {
    const game = frenchGame()
    game.start()
    const qs = hintsFor(game, visitedRooms(game))
    expect(qs.map((q) => q.id)).toEqual(['house'])
    expect(qs[0].question).toBe('Comment entrer dans la maison ?')
    expect(qs[0].hints).toHaveLength(3)
    expect(qs[0].solved).toBe(false)
  })

  it('marks the puzzles solved along the full game', () => {
    const run = playWalkthrough(new URL('./walkthrough/zork1/en.txt', import.meta.url), 'en', 1234)
    const game = new Game({ story: loadStory(), lang: 'en', seed: 1234 })
    game.start()
    const remembered = new Set<string>()
    for (const c of run.commands) {
      game.send(c)
      if (game.status().lit) remembered.add(game.status().roomId)
    }
    const qs = hintsFor(game, visitedRooms(game, remembered))
    const unsolved = qs.filter((q) => !q.solved).map((q) => q.id)
    expect(qs.length).toBeGreaterThan(20)
    // the walkthrough never punctures the boat, so that question never shows
    expect(unsolved).toEqual([])
  })
})
