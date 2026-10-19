// The soundtrack follows the game: one ambience per place, darkness, villains, cues.
import { describe, it, expect } from 'vitest'
import scenes from '../src/data/zork1/scenes.json'
import { AMBIENCES, OVERLAYS, PLACES } from '../src/ui/sound/presets'
import { moodFor, turnCue, type Mood } from '../src/ui/sound/mood'
import { Game } from '../src/engine/game'
import { loadStory } from './helpers/plain'
import { playWalkthrough } from './helpers/walkthrough'

describe('soundtrack data', () => {
  it('gives every scene a known ambience', () => {
    for (const s of scenes.scenes) expect(PLACES, s.id).toContain((s as { ambience?: string }).ambience)
  })

  it('has sensible numbers in every preset', () => {
    for (const [id, p] of Object.entries({ ...AMBIENCES, ...OVERLAYS })) {
      const numbers = JSON.stringify(p).match(/-?\d+(\.\d+)?(e-?\d+)?/g)!.map(Number)
      expect(numbers.every(Number.isFinite), id).toBe(true)
      expect(p.level, id).toBeGreaterThan(0)
      expect(p.level, id).toBeLessThanOrEqual(1)
    }
  })
})

describe('mood of the game', () => {
  it('follows the places, the villains and the end of the full game', () => {
    const run = playWalkthrough(new URL('./walkthrough/zork1/en.txt', import.meta.url), 'en', 1234)
    const game = new Game({ story: loadStory(), lang: 'en', seed: 1234 })
    game.start()
    const seen = new Map<string, Mood>()
    const cues: string[] = []
    let before = moodFor(game)
    let troll: Mood | undefined
    for (const cmd of run.commands) {
      game.send(cmd)
      const after = moodFor(game)
      const over = game.state === 'quit' || game.inputRoutineName() === 'FINISH'
      const cue = turnCue(before, after, over)
      if (cue) cues.push(cue)
      const room = game.status().roomId
      if (!seen.has(room)) seen.set(room, after)
      if (room === 'TROLL-ROOM' && !troll) troll = after
      before = after
      if (over) break
    }
    expect(seen.get('KITCHEN')?.place).toBe('house')
    expect(seen.get('CELLAR')?.place).toBe('cave')
    expect(seen.get('DAM-ROOM')?.place).toBe('water')
    expect(seen.get('NORTH-TEMPLE')?.place).toBe('sacred')
    expect(seen.get('LAND-OF-LIVING-DEAD')?.place).toBe('hades')
    expect(seen.get('MAZE-1')?.place).toBe('maze')
    expect(seen.get('MINE-1')?.place).toBe('mine')
    expect(troll?.danger).toBe(true)
    expect(cues.filter((c) => c === 'score').length).toBeGreaterThan(10)
    expect(cues.at(-1)).toBe('victory')
  })

  it('turns dark without a light, and back when leaving', () => {
    const game = new Game({ story: loadStory(), lang: 'en', seed: 1234 })
    game.start()
    expect(moodFor(game)).toMatchObject({ place: 'surface', dark: false, danger: false })
    for (const cmd of ['north', 'east', 'open window', 'enter', 'west', 'move rug', 'open trap door', 'down']) game.send(cmd)
    expect(game.status().roomId).toBe('CELLAR')
    expect(moodFor(game)).toMatchObject({ place: 'cave', dark: true })
  })
})
