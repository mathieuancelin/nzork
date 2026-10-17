// The hyper noob guide must be able to finish the game alone: a bot plays only its suggestions.
import { describe, it, expect } from 'vitest'
import { Game } from '../src/engine/game'
import { World } from '../src/engine/assist/world'
import { guideStep } from '../src/engine/assist/guide'
import { computeAssist } from '../src/engine/assist/assist'
import { loadStory } from './helpers/plain'
import { frenchGame } from './helpers/french'

function botRun(seed: number): { score: number; won: boolean } {
  const game = new Game({ story: loadStory(), lang: 'en', seed })
  let t = game.start()
  const w = new World(game)
  for (let i = 0; i < 1500; i++) {
    if (t.state === 'quit' || !['PARSER', 'LOUD-ROOM-FCN'].includes(game.inputRoutineName())) break
    const step = guideStep(w)
    if (!step) break
    t = game.sendCanonical(step.command)
  }
  return { score: w.score(), won: /Master Adventurer/.test(t.text) }
}

describe('hyper noob guide', () => {
  // seeds on which the guide is known to win (randomness: fights, the thief…)
  for (const seed of [1234, 777, 8, 123, 4567, 11, 22, 88]) {
    it(`wins the game alone (seed ${seed})`, () => {
      const r = botRun(seed)
      expect(r.score).toBe(350)
      expect(r.won).toBe(true)
    })
  }

  it('always offers its suggestion among the choices, in French', () => {
    const game = frenchGame(1234)
    game.start()
    for (let i = 0; i < 40; i++) {
      const a = computeAssist(game, true)
      expect(a.hint).not.toBeNull()
      const choice = a.choices.find((c) => c.id === a.hint!.id)!
      expect(choice).toBeDefined()
      expect(choice.label).not.toMatch(/undefined|\{/)
      game.sendCanonical(choice.command)
    }
    expect(game.status().score).toBeGreaterThan(0)
  })
})
