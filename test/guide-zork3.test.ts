// The hyper noob guide of Zork III must finish the game alone: a bot plays only its suggestions.
import { describe, it, expect } from 'vitest'
import { Game } from '../src/engine/game'
import { World } from '../src/engine/assist/world'
import { guideStep, hasGuide } from '../src/engine/assist/guide'
import { computeAssist } from '../src/engine/assist/assist'
import { readPuzzle, solve, push } from '../src/engine/assist/royal-puzzle'
import { loadStory } from './helpers/plain'
import { frenchGame } from './helpers/french'

function botRun(seed: number): { score: number; won: boolean; moves: number } {
  const game = new Game({ game: 'zork3', story: loadStory('zork3'), lang: 'en', seed })
  let t = game.start()
  const w = new World(game)
  for (let i = 0; i < 1500; i++) {
    if (t.state === 'quit' || game.inputRoutineName() !== 'PARSER') break
    const step = guideStep(w)
    if (!step) break
    t = game.sendCanonical(step.command)
  }
  return { score: w.score(), won: /Your potential is 7 of a possible 7/.test(t.text), moves: t.status.moves }
}

describe('hyper noob guide of Zork III', () => {
  it('is offered', () => expect(hasGuide('zork3')).toBe(true))

  // the guide copes with chance (the fight, the man, the old man, the lake, the earthquake):
  // it wins every one of the first 60 seeds; a few of them are replayed here
  for (const seed of [1234, 1, 4, 14, 21, 23, 30]) {
    it(`wins the game alone (seed ${seed})`, () => {
      const r = botRun(seed)
      expect(r.score).toBe(7)
      expect(r.won).toBe(true)
    })
  }

  it('solves the Royal Puzzle from its start, and from wherever the player got lost', () => {
    const game = new Game({ game: 'zork3', story: loadStory('zork3'), lang: 'en', seed: 1 })
    game.start()
    const w = new World(game)
    const start = readPuzzle(w)
    expect(start).toMatchObject({ pos: 1, book: 22 })
    const moves = solve(start)!
    expect(moves.at(-1)).toEqual({ kind: 'up' })
    expect(moves.filter((m) => m.kind === 'take')).toHaveLength(1)
    // a first push off the known path: the solver finds another way out
    const lost = solve({ cells: push(start.cells, 1, 'SOUTH', 22)!, pos: 7, book: 22 })
    expect(lost).not.toBeNull()
    expect(lost!.at(-1)).toEqual({ kind: 'up' })
  })

  it('always offers its suggestion among the choices, in French', () => {
    const game = frenchGame(1234, 'zork3')
    game.start()
    for (let i = 0; i < 120; i++) {
      const a = computeAssist(game, true)
      expect(a.hint).not.toBeNull()
      const choice = a.choices.find((c) => c.id === a.hint!.id)!
      expect(choice).toBeDefined()
      expect(choice.label).not.toMatch(/undefined|\{|^(Wake|Look|Knock|Unlock|Push|Say|Get|Jump)\b/)
      game.sendCanonical(choice.command)
    }
    expect(game.status().score).toBeGreaterThan(3)
  })
})
