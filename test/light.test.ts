// The lantern's batteries, read from the game's clock table (for the halo of the scenes).
import { describe, it, expect } from 'vitest'
import { Game } from '../src/engine/game'
import { World } from '../src/engine/assist/world'
import { loadStory } from './helpers/plain'

describe('lantern', () => {
  it('counts down its 385 turns of light, stage by stage', () => {
    const game = new Game({ story: loadStory(), lang: 'en', seed: 1234 })
    game.start()
    const w = new World(game)
    expect(w.lampTurnsLeft()).toBe(385)
    for (const c of ['north', 'east', 'open window', 'enter', 'west', 'take lamp', 'turn on lamp']) game.send(c)
    const stages: number[] = []
    for (let i = 0; i < 200 && w.lampTurnsLeft() > 0; i++) {
      const text = game.send('wait').text
      if (/dimmer|nearly out/.test(text)) stages.push(w.lampTurnsLeft())
    }
    expect(stages).toEqual([185, 85, 15])
    expect(w.lampTurnsLeft()).toBe(0)
  })
})
