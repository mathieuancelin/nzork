// Zork III's InvisiClues: every question shows up along the full game, and is solved by its end.
import { describe, it, expect } from 'vitest'
import { Game } from '../src/engine/game'
import { hintsFor } from '../src/engine/assist/hints'
import { ZORK3 } from '../src/engine/assist/hints-zork3'
import { allRooms, visitedRooms } from '../src/engine/assist/map'
import { World } from '../src/engine/assist/world'
import { loadStory } from './helpers/plain'
import { frenchGame } from './helpers/french'
import { playWalkthrough } from './helpers/walkthrough'

// the Viking ship passes by chance, and the walkthrough has no use for its vial
const OPTIONAL = ['ship']

describe('hints of Zork III', () => {
  it('asks only about the places seen, in the language of the game', () => {
    const game = frenchGame(1234, 'zork3')
    game.start()
    const qs = hintsFor(game, visitedRooms(game))
    expect(qs.map((q) => q.id)).toEqual(['goal'])
    expect(qs[0].question).toBe('Quel est mon but ? Et que mesure ce « potentiel » ?')
    expect(qs[0].hints).toHaveLength(3)
    expect(qs[0].solved).toBe(false)
  })

  it('shows every question along the full game, and marks the puzzles solved', () => {
    const run = playWalkthrough(new URL('./walkthrough/zork3/en.txt', import.meta.url), 'en', 1234, 'zork3')
    const game = new Game({ game: 'zork3', story: loadStory('zork3'), lang: 'en', seed: 1234 })
    game.start()
    const remembered = new Set<string>()
    const shown = new Set<string>()
    for (const c of run.commands) {
      game.send(c)
      if (game.status().lit) remembered.add(game.status().roomId)
      for (const q of hintsFor(game, visitedRooms(game, remembered))) shown.add(q.id)
    }
    expect([...shown].sort()).toEqual(ZORK3.map((q) => q.id).sort())
    const unsolved = hintsFor(game, visitedRooms(game, remembered)).filter((q) => !q.solved).map((q) => q.id)
    expect(unsolved.filter((id) => !OPTIONAL.includes(id))).toEqual([])
  })

  it('has three hints per question, from vague to explicit, and unique ids', () => {
    expect(ZORK3.length).toBeGreaterThanOrEqual(16)
    expect(new Set(ZORK3.map((q) => q.id)).size).toBe(ZORK3.length)
    for (const q of ZORK3) expect(q.hints, q.id).toHaveLength(3)
  })

  it('names only rooms of the game', () => {
    const game = new Game({ game: 'zork3', story: loadStory('zork3'), lang: 'en', seed: 1234 })
    game.start()
    const w = new World(game)
    const rooms = new Set(allRooms(w))
    // nothing seen yet: every check asks for each of the rooms it names (saw(...), seen.has(...))
    class Asked extends Set<string> {
      names = new Set<string>()
      has(room: string) {
        this.names.add(room)
        return false
      }
    }
    const asked = new Asked()
    for (const q of ZORK3) for (const check of [q.shown, q.solved]) check(w, asked)
    expect(asked.names.size).toBeGreaterThan(15)
    expect([...asked.names].filter((r) => !rooms.has(r))).toEqual([])
  })
})
