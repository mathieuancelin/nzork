// The side panel's inventory and treasure tracker, read from the game state.
import { describe, it, expect } from 'vitest'
import { Game } from '../src/engine/game'
import { inventoryOf, treasuresOf } from '../src/engine/assist/items'
import { computeAssist } from '../src/engine/assist/assist'
import items from '../src/data/items.json'
import symbols from '../src/engine/story/symbols.json'
import { loadStory } from './helpers/plain'
import { frenchGame } from './helpers/french'
import { playWalkthrough } from './helpers/walkthrough'

const play = (game: Game, cmds: string[]) => cmds.forEach((c) => game.send(c))

describe('inventory', () => {
  it('lists what is carried, with the contents of open containers', () => {
    const game = new Game({ story: loadStory(), lang: 'en', seed: 1234 })
    game.start()
    expect(inventoryOf(game)).toEqual([])
    play(game, ['north', 'east', 'open window', 'enter', 'take sack', 'open sack', 'west', 'take lamp', 'turn on lamp'])
    const inv = inventoryOf(game)
    const lamp = inv.find((i) => i.id === 'LAMP')!
    expect(lamp).toMatchObject({ kind: 'light', lit: true })
    const sack = inv.find((i) => i.id === 'SANDWICH-BAG')!
    expect(sack.kind).toBe('container')
    expect(sack.contents.map((i) => i.id).sort()).toEqual(['GARLIC', 'LUNCH'])
  })

  it('names the objects in French', () => {
    const game = frenchGame()
    game.start()
    play(game, ['ouvre la boîte aux lettres', 'prends le prospectus'])
    expect(inventoryOf(game).map((i) => i.name)).toEqual(['Prospectus'])
  })

  it('links the choices to their object, to show them on the inventory', () => {
    const game = new Game({ story: loadStory(), lang: 'en', seed: 1234 })
    game.start()
    play(game, ['open mailbox', 'take leaflet'])
    const leaflet = inventoryOf(game)[0]
    const actions = computeAssist(game, false).choices.filter((c) => c.obj === leaflet.obj)
    expect(actions.map((c) => c.command)).toEqual(expect.arrayContaining(['read advertisement', 'drop advertisement']))
  })

  it('has a picture entry for every object that can be taken', () => {
    const mapped = new Set(items.items.flatMap((i) => i.objects))
    const objects = Object.keys(symbols.objects)
    for (const o of mapped) expect(objects, o).toContain(o)
    expect(mapped.size).toBe(60)
  })
})

describe('treasure tracker', () => {
  it('starts with 19 unknown treasures', () => {
    const game = new Game({ story: loadStory(), lang: 'en', seed: 1234 })
    game.start()
    const t = treasuresOf(game)
    expect(t.slots).toHaveLength(19)
    expect(t.slots.every((s) => s.state === 'unknown')).toBe(true)
    expect([t.found, t.inCase]).toEqual([0, 0])
  })

  it('does not reveal a treasure hidden inside another one', () => {
    const game = new Game({ story: loadStory(), lang: 'en', seed: 1234 })
    game.start()
    play(game, ['north', 'north', 'up', 'take egg', 'down', 'south', 'east', 'open window', 'enter', 'west', 'open case', 'put egg in case'])
    const t = treasuresOf(game)
    expect(t.slots.find((s) => s.id === 'EGG')?.state).toBe('case')
    expect(t.slots.find((s) => s.id === 'CANARY')?.state).toBe('unknown')
  })

  it('ends with all of them in the trophy case', () => {
    const run = playWalkthrough(new URL('./walkthrough/en.txt', import.meta.url), 'en', 1234)
    const game = new Game({ story: loadStory(), lang: 'en', seed: 1234 })
    game.start()
    let sawFound = false
    for (const cmd of run.commands) {
      game.send(cmd)
      const t = treasuresOf(game)
      if (t.slots.some((s) => s.state === 'found')) sawFound = true
    }
    const t = treasuresOf(game)
    expect(sawFound).toBe(true)
    expect([t.found, t.inCase]).toEqual([19, 19])
  })
})
