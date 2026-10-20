// Zork II and Zork III in the side panel and the interface: their map, inventory, treasures,
// documents, lantern, sounds and choices, read from their own symbol table.
import { describe, it, expect } from 'vitest'
import { Game } from '../src/engine/game'
import { World } from '../src/engine/assist/world'
import { allRooms, mapOf, visitedRooms } from '../src/engine/assist/map'
import { inventoryOf, treasuresOf, hasTreasures } from '../src/engine/assist/items'
import { documentsOf } from '../src/engine/assist/documents'
import { hintsFor, hasHints } from '../src/engine/assist/hints'
import { computeAssist } from '../src/engine/assist/assist'
import { hasGuide } from '../src/engine/assist/guide'
import { moodFor, turnCue, type Mood } from '../src/ui/sound/mood'
import { PLACES } from '../src/ui/sound/presets'
import zork2Map from '../src/data/zork2/map.json'
import zork3Map from '../src/data/zork3/map.json'
import zork2Scenes from '../src/data/zork2/scenes.json'
import zork3Scenes from '../src/data/zork3/scenes.json'
import { loadStory } from './helpers/plain'
import { frenchGame } from './helpers/french'
import { playWalkthrough } from './helpers/walkthrough'

const english = (id: 'zork2' | 'zork3' = 'zork2') => {
  const game = new Game({ game: id, story: loadStory(id), lang: 'en', seed: 1234 })
  game.start()
  return game
}
const EN = new URL('./walkthrough/zork2/en.txt', import.meta.url)

describe('Zork II', () => {
  it('starts inside the barrow, with its own symbols', () => {
    const game = english()
    expect(game.status()).toMatchObject({ roomId: 'INSIDE-BARROW', score: 0, moves: 0 })
    expect(game.info.maxScore).toBe(400)
  })

  it('never loads a save of another game', () => {
    const save = english().save('')
    expect(save.game).toBe('zork2')
    const zork1 = new Game({ story: loadStory(), lang: 'en', seed: 1 })
    expect(() => zork1.load(save)).toThrow(/Zork II/)
    const zork2 = english()
    expect(zork2.load(save).roomId).toBe('INSIDE-BARROW')
  })

  it('places every room of Zork II and Zork III on its own cell of the map', () => {
    for (const [id, data] of [['zork2', zork2Map], ['zork3', zork3Map]] as const) {
      const rooms = allRooms(new World(english(id)))
      const grid = data.rooms as Record<string, number[]>
      for (const r of rooms) expect(grid[r], r).toBeDefined()
      expect(new Set(Object.values(grid).map((p) => p.join(','))).size).toBe(Object.keys(grid).length)
    }
  })

  it('draws the map as the rooms are seen, the Carousel and the bank included', () => {
    const game = english()
    expect(mapOf(game, visitedRooms(game))).toMatchObject({ rooms: ['INSIDE-BARROW'], links: [], stubs: [{ room: 'INSIDE-BARROW', dir: 'SOUTH' }] })
    const run = playWalkthrough(EN, 'en', 1234, 'zork2')
    const end = new Game({ game: 'zork2', story: loadStory('zork2'), lang: 'en', seed: 1234 })
    end.start()
    for (const c of run.commands) end.send(c)
    const map = mapOf(end, visitedRooms(end))
    expect(map.rooms).toEqual(expect.arrayContaining(['CAROUSEL-ROOM', 'MACHINE-ROOM', 'DEPOSITORY', 'VAULT', 'CRYPT-ROOM']))
    expect(map.links).toContainEqual(expect.arrayContaining(['MAGNET-ROOM', 'MACHINE-ROOM']))
    expect(map.links.length).toBeGreaterThan(60)
  })

  it('lists the inventory in French', () => {
    const game = frenchGame(1234, 'zork2')
    game.start()
    game.send('prends tout')
    expect(inventoryOf(game).map((i) => [i.name, i.kind])).toEqual([
      ['Lanterne', 'light'],
      ['Épée elfique', 'weapon'],
    ])
  })

  it('tracks the ten treasures of the demon, without saying where they go', () => {
    const game = english()
    expect(hasTreasures('zork2')).toBe(true)
    const start = treasuresOf(game)
    expect(start.slots).toHaveLength(10)
    expect(start).toMatchObject({ found: 0 })
    expect(start.inCase).toBeUndefined()
    const run = playWalkthrough(EN, 'en', 1234, 'zork2')
    const end = new Game({ game: 'zork2', story: loadStory('zork2'), lang: 'en', seed: 1234 })
    end.start()
    for (const c of run.commands) end.send(c)
    expect(treasuresOf(end).found).toBe(10)
  })

  it('collects its documents, read in French', () => {
    const game = frenchGame(1234, 'zork2')
    game.start()
    expect(documentsOf(game, visitedRooms(game)).filter((d) => d.found)).toEqual([])
    for (const c of ['prends tout', 's', 's', 's', 'so', 's', 'se', 'entre', 'prends le journal']) game.send(c)
    const found = documentsOf(game, visitedRooms(game)).filter((d) => d.found)
    expect(found.map((d) => d.id)).toEqual(['NEWSPAPER'])
    expect(found[0].name).toBe('Journal')
    expect(found[0].text).not.toMatch(/\b(the|and|of)\b/)
  })

  it('has hints, and a guide: the Easy mode circles the next step', () => {
    const game = english()
    expect(hasHints('zork2')).toBe(true)
    expect(hasGuide('zork2')).toBe(true)
    expect(hintsFor(game, visitedRooms(game)).map((q) => q.id)).toEqual(['lamp'])
    const assist = computeAssist(game, true)
    expect(assist.hint).not.toBeNull()
    expect(assist.choices.map((c) => c.command)).toEqual(expect.arrayContaining(['south', 'take elvish sword', 'take brass lamp', 'look']))
  })

  it('counts down the 650 turns of its lantern', () => {
    const game = english()
    const w = new World(game)
    expect(w.lampTurnsLeft()).toBe(650)
    game.send('take lamp')
    game.send('turn on lamp')
    game.send('wait')
    expect(w.lampTurnsLeft()).toBeLessThan(650)
  })

  it('plays the ambience of each place, the danger of the dragon and the victory', () => {
    for (const s of zork2Scenes.scenes) expect(PLACES, s.id).toContain(s.ambience)
    const run = playWalkthrough(EN, 'en', 1234, 'zork2')
    const game = english()
    const seen = new Map<string, Mood>()
    const cues: string[] = []
    let before = moodFor(game)
    let dragon = false
    for (const cmd of run.commands) {
      game.send(cmd)
      const after = moodFor(game)
      const over = game.state === 'quit' || game.inputRoutineName() === 'FINISH'
      const cue = turnCue(before, after, over)
      if (cue) cues.push(cue)
      const room = game.status().roomId
      if (!seen.has(room)) seen.set(room, after)
      if (room === 'DRAGON-ROOM' && after.danger) dragon = true
      before = after
      if (over) break
    }
    expect(seen.get('FORMAL-GARDEN')?.place).toBe('garden')
    expect(seen.get('TEA-ROOM')?.place).toBe('house')
    expect(seen.get('DIAMOND-5')?.place).toBe('maze')
    expect(seen.get('CRYPT-ROOM')?.place).toBe('sacred')
    expect(seen.get('VOLCANO-BOTTOM')?.place).toBe('fire')
    expect(seen.get('WIZARDS-WORKSHOP')?.place).toBe('magic')
    expect(seen.get('DEPOSITORY')?.place).toBe('museum')
    expect(dragon).toBe(true)
    expect(cues.at(-1)).toBe('victory')
  })
})

describe('Zork III', () => {
  const EN3 = new URL('./walkthrough/zork3/en.txt', import.meta.url)
  const played = () => {
    const run = playWalkthrough(EN3, 'en', 1234, 'zork3')
    const game = english('zork3')
    for (const c of run.commands) game.send(c)
    return game
  }

  it('plays in French, and lists its inventory', () => {
    const game = frenchGame(1234, 'zork3')
    game.start()
    expect(game.status().roomId).toBe('ZORK2-STAIR')
    for (const c of ['prends la lanterne', 'allume la lanterne', 's']) game.send(c)
    expect(inventoryOf(game).map((i) => [i.name, i.kind, i.lit])).toEqual([['Lanterne', 'light', true]])
    expect(game.info.maxScore).toBe(7)
  })

  it('tracks the outfit of the Dungeon Master as its treasures, and collects its documents, read in French', () => {
    expect(hasTreasures('zork3')).toBe(true)
    const run = playWalkthrough(new URL('./walkthrough/zork3/fr.txt', import.meta.url), 'fr', 1234, 'zork3')
    const game = frenchGame(1234, 'zork3')
    game.start()
    expect(treasuresOf(game)).toMatchObject({ found: 0 })
    expect(treasuresOf(game).slots).toHaveLength(7)
    for (const c of run.commands) game.send(c)
    expect(treasuresOf(game).found).toBe(7)
    expect(treasuresOf(game).slots.map((t) => t.name)).toEqual(['Capuchon', 'Cape', 'Amulette en or', 'Bâton de bois', 'Livre très ancien', "Anneau d'or", 'Clé étrange'])
    const found = documentsOf(game, visitedRooms(game)).filter((d) => d.found)
    expect(found.map((d) => d.id)).toEqual(['REPELLENT', 'ROYAL-SEAL', 'LORE-BOOK'])
    for (const d of found) expect(d.text, d.id).not.toMatch(/(?<!\p{L})(the|and|of|is)(?!\p{L})/u)
  })

  it('draws the hallway of the mirror, without leading the player past the Guardians', () => {
    const game = played()
    const map = mapOf(game, visitedRooms(game))
    expect(map.rooms).toEqual(expect.arrayContaining(['MREYE', 'MRA', 'FRONT-DOOR', 'NIRVANA']))
    expect(map.links).toContainEqual(expect.arrayContaining(['MREYE', 'MRA']))
    for (const r of allRooms(new World(game))) expect((zork3Map.rooms as Record<string, number[]>)[r], r).toBeDefined()
  })

  it('plays the ambience of each place, the danger of the hooded figure and the victory', () => {
    for (const s of zork3Scenes.scenes) expect(PLACES, s.id).toContain(s.ambience)
    const run = playWalkthrough(EN3, 'en', 1234, 'zork3')
    const game = english('zork3')
    const seen = new Map<string, Mood>()
    const cues: string[] = []
    let before = moodFor(game)
    let shadow = false
    for (const cmd of run.commands) {
      game.send(cmd)
      const after = moodFor(game)
      const over = game.state === 'quit' || game.inputRoutineName() === 'FINISH'
      const cue = turnCue(before, after, over)
      if (cue) cues.push(cue)
      const room = game.status().roomId
      if (!seen.has(room)) seen.set(room, after)
      if (room.startsWith('SHADOW') && after.danger) shadow = true
      before = after
      if (over) break
    }
    expect(seen.get('CLIFF')?.place).toBe('surface')
    expect(seen.get('LAKE-SHORE')?.place).toBe('lake')
    expect(seen.get('MUSEUM-ENTRANCE')?.place).toBe('museum')
    expect(seen.get('SHADOW-8')?.place).toBe('shadow')
    expect(seen.get('VIEW-ROOM')?.place).toBe('magic')
    expect(seen.get('NORTH-CORRIDOR')?.place).toBe('dungeon')
    expect(seen.get('PARAPET')?.place).toBe('fire')
    expect(shadow).toBe(true)
    expect(cues.filter((c) => c === 'score')).toHaveLength(7)
    expect(cues.at(-1)).toBe('victory')
  })

  it('has hints, and a guide: hyper noob circles the next step', () => {
    const game = english('zork3')
    expect(hasHints('zork3')).toBe(true)
    expect(hasGuide('zork3')).toBe(true)
    const assist = computeAssist(game, true)
    expect(assist.hint?.id).toBe('take brass lamp')
    expect(assist.choices.map((c) => c.command)).toEqual(expect.arrayContaining(['take brass lamp', 'south']))
  })
})
