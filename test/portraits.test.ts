// The portraits of the characters: their data, prompts and post-processing must agree, and the
// game must bring each character on stage (in the right state) at the right time.
import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { pixelizePortrait, DEFAULT_PALETTE, PORTRAIT_SIZE } from '../tools/images/lib/pixel'
import prompts1 from '../tools/images/portrait-prompts.json'
import prompts2 from '../tools/images/zork2/portrait-prompts.json'
import prompts3 from '../tools/images/zork3/portrait-prompts.json'
import scenePrompts1 from '../tools/images/prompts.json'
import scenePrompts2 from '../tools/images/zork2/prompts.json'
import scenePrompts3 from '../tools/images/zork3/prompts.json'
import symbols1 from '../src/engine/story/zork1/symbols.json'
import symbols2 from '../src/engine/story/zork2/symbols.json'
import symbols3 from '../src/engine/story/zork3/symbols.json'
import { PORTRAITS, portraitsFor, type PortraitCondition } from '../src/ui/portraits'
import { Game, type GameId } from '../src/engine/game'
import { World } from '../src/engine/assist/world'
import { loadStory } from './helpers/plain'

const GAMES = {
  zork1: { prompts: prompts1, scenes: scenePrompts1, symbols: symbols1 },
  zork2: { prompts: prompts2, scenes: scenePrompts2, symbols: symbols2 },
  zork3: { prompts: prompts3, scenes: scenePrompts3, symbols: symbols3 },
}

describe('the portraits of each game', () => {
  for (const [id, d] of Object.entries(GAMES) as [GameId, (typeof GAMES)[keyof typeof GAMES]][]) {
    const defs = PORTRAITS[id].portraits
    const ids = defs.flatMap((p) => [p.id, ...(p.variants ?? []).map((v) => v.id)])
    const entries = d.prompts.portraits as Record<string, { prompt: string; keystone?: boolean; scenes?: string[] }>

    it(`gives every portrait and state of ${id} a prompt`, () => {
      expect(new Set(ids).size).toBe(ids.length)
      expect([...ids].sort()).toEqual(Object.keys(entries).sort())
      if (id !== 'zork1') for (const p of ids) expect(p.startsWith(`${id}-`), p).toBe(true)
      for (const p of defs) expect(p.name.every((n) => n.length > 0), p.id).toBe(true)
      expect(Object.values(entries).some((e) => e.keystone)).toBe(true)
    })

    it(`only refers to rooms, objects, flags and scenes of ${id}`, () => {
      const { globals, objects, properties } = d.symbols as Record<'globals' | 'objects' | 'properties', Record<string, number>>
      const check = (owner: string, c: PortraitCondition) => {
        for (const o of [c.present, c.near, ...(c.rooms ?? []), ...(c.objectIn ?? []), c.prop?.[0]]) if (o) expect(objects[o], `${owner}: ${o}`).toBeDefined()
        for (const g of [c.flag, c.notFlag, c.global?.[0]].flat()) if (g) expect(globals[g], `${owner}: ${g}`).toBeDefined()
        if (c.prop) expect(properties[c.prop[1]], `${owner}: ${c.prop[1]}`).toBeDefined()
      }
      for (const p of defs) {
        expect(p.when.length, p.id).toBeGreaterThan(0)
        for (const c of p.when) check(p.id, c)
        for (const v of p.variants ?? []) check(v.id, v.when)
      }
      // the scenes sent as references to keep the characters' looks
      const scenes = Object.keys(d.scenes.scenes)
      for (const [p, e] of Object.entries(entries)) for (const s of e.scenes ?? []) expect(scenes, `${p}: ${s}`).toContain(s)
    })
  }
})

describe('portrait post-processing', () => {
  it('produces a square portrait limited to the palette', async () => {
    const w = 1024
    const buf = Buffer.alloc(w * w * 3)
    for (let i = 0; i < buf.length; i += 3) buf.set([(i / 3) % 256, 120, 200 - ((i / 3 / w) % 200)], i)
    const out = await pixelizePortrait(await sharp(buf, { raw: { width: w, height: w, channels: 3 } }).png().toBuffer(), DEFAULT_PALETTE)
    const { data, info } = await sharp(out).raw().toBuffer({ resolveWithObject: true })
    expect([info.width, info.height]).toEqual([PORTRAIT_SIZE, PORTRAIT_SIZE])
    const allowed = new Set(DEFAULT_PALETTE.map((h) => h.toLowerCase()))
    for (let i = 0; i < data.length; i += info.channels) expect(allowed.has('#' + [data[i], data[i + 1], data[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join(''))).toBe(true)
  })
})

describe('characters on stage', () => {
  const play = (game: Game, cmds: string[]) => cmds.map((c) => game.send(c).text).join('\n')
  const shown = (game: Game) => portraitsFor(game).map((p) => p.id)

  it('shows the troll in his room, knocked out once beaten, and nobody in the dark', () => {
    const game = new Game({ story: loadStory(), lang: 'en', seed: 1234 })
    game.start()
    play(game, ['north', 'east', 'open window', 'enter', 'west', 'take lamp', 'take sword', 'move rug', 'open trap door', 'down'])
    // the cellar, before the lantern is lit
    expect(shown(game)).toEqual([])
    play(game, ['turn on lamp', 'north'])
    expect(game.status().roomId).toBe('TROLL-ROOM')
    expect(shown(game)).toEqual(['troll'])
    const w = new World(game)
    let knockedOut = false
    for (let i = 0; i < 40 && w.loc('TROLL') === 'TROLL-ROOM' && !knockedOut; i++) {
      play(game, ['kill troll with sword'])
      if (w.loc('TROLL') === 'TROLL-ROOM' && w.prop('TROLL', 'STRENGTH') < 0) {
        knockedOut = true
        expect(portraitsFor(game)[0]).toMatchObject({ id: 'troll--unconscious', base: 'troll' })
      }
    }
    expect(knockedOut).toBe(true)
    play(game, ['south'])
    expect(shown(game)).toEqual([])
  })

  /** Puts the player somewhere else, as if they had walked there (for the events left to chance). */
  function teleport(game: Game, room: string) {
    const { objects, globals } = game.symbols
    game.vm.removeObj(objects.ADVENTURER)
    game.vm.insertObj(objects.ADVENTURER, objects[room])
    game.vm.setGlobal(globals.HERE, objects[room])
    game.vm.setGlobal(globals.LIT, 1)
  }

  it('shows the old Viking sailor while his ship passes along the shore', () => {
    const game = new Game({ game: 'zork3', story: loadStory('zork3'), lang: 'en', seed: 1 })
    game.start()
    teleport(game, 'FLATHEAD-OCEAN')
    expect(shown(game)).toEqual([])
    let text = ''
    for (let i = 0; i < 100 && !/Viking ship/.test(text); i++) text = play(game, ['wait'])
    expect(shown(game)).toEqual(['zork3-viking'])
    for (let i = 0; i < 5 && !/out of sight/.test(text); i++) text = play(game, ['wait'])
    expect(text).toMatch(/out of sight/)
    expect(shown(game)).toEqual([])
  })

  it('shows Lord Flathead while his voice is heard in the museum of 776', () => {
    const game = new Game({ game: 'zork3', story: loadStory('zork3'), lang: 'en', seed: 1 })
    game.start()
    teleport(game, 'OLD-TECH-MUSEUM')
    let text = ''
    for (let i = 0; i < 200 && !/Flood Control Dam #3/.test(text); i++) {
      expect(shown(game)).toEqual([])
      text = play(game, ['wait'])
    }
    expect(text).toMatch(/Flood Control Dam #3/)
    expect(shown(game)).toEqual(['zork3-flathead'])
  })
})
