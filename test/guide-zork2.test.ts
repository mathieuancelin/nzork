// The hyper noob guide of Zork II must finish the game alone: a bot plays only its suggestions.
import { describe, it, expect } from 'vitest'
import { Game } from '../src/engine/game'
import { World } from '../src/engine/assist/world'
import { guideStep, hasGuide } from '../src/engine/assist/guide'
import { computeAssist } from '../src/engine/assist/assist'
import { loadStory } from './helpers/plain'
import { frenchGame } from './helpers/french'

function botRun(seed: number): { score: number; room: string; transcript: string } {
  const game = new Game({ game: 'zork2', story: loadStory('zork2'), lang: 'en', seed })
  let t = game.start()
  const w = new World(game)
  let transcript = ''
  for (let i = 0; i < 1500; i++) {
    if (t.state === 'quit' || game.inputRoutineName() !== 'PARSER') break
    const step = guideStep(w)
    if (!step) break
    t = game.sendCanonical(step.command)
    transcript += t.text + '\n'
  }
  return { score: w.score(), room: w.here(), transcript }
}

describe('hyper noob guide of Zork II', () => {
  it('is offered', () => expect(hasGuide('zork2')).toBe(true))

  // the guide copes with the Wizard's spells: it finishes 56 of the first 60 seeds, 46 of them
  // with the 400 points (the others lost a treasure to the Wizard's cabinet, or a death); the
  // four left are lost by chance in the original game too (the crown buried under the collapsed
  // Dusty Room, the lamp dead after 700 turns)
  for (const seed of [1234, 1, 2, 20, 22]) {
    it(`wins the game alone with the 400 points (seed ${seed})`, () => {
      const r = botRun(seed)
      expect(r.score).toBe(400)
      expect(r.room).toBe('ZORK3')
    })
  }

  it('goes on after a fatal error of the original game (a spell in the balloon), and wins', () => {
    const r = botRun(9)
    expect(r.transcript).toContain('The original game just hit a fatal error ("Store out of dynamic memory"')
    expect(r.score).toBe(400)
    expect(r.room).toBe('ZORK3')
  })

  it('always offers its suggestion among the choices, in French', () => {
    const game = frenchGame(1234, 'zork2')
    game.start()
    for (let i = 0; i < 120; i++) {
      const a = computeAssist(game, true)
      expect(a.hint).not.toBeNull()
      const choice = a.choices.find((c) => c.id === a.hint!.id)!
      expect(choice).toBeDefined()
      expect(choice.label).not.toMatch(/undefined|\{|^(Wake|Look|Knock|Unlock|Push|Say|Get|Jump|Kick|Tell|Ask|Land|Untie|Board)\b/)
      game.sendCanonical(choice.command)
    }
    expect(game.status().score).toBeGreaterThan(40)
  })
})
