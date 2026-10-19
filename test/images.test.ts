// The post-processing must bring any image to the 480×270 grid (or a 48×48 transparent icon)
// with at most 64 colors; the scenes, icons and prompts of the three games must agree.
import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { pixelize, pixelizeItem, buildPalette, DEFAULT_PALETTE, WIDTH, HEIGHT, ITEM_SIZE } from '../tools/images/lib/pixel'
import scenes from '../src/data/zork1/scenes.json'
import items from '../src/data/zork1/items.json'
import itemPrompts from '../tools/images/item-prompts.json'
import scenePrompts1 from '../tools/images/prompts.json'
import symbols1 from '../src/engine/story/zork1/symbols.json'
import scenes2 from '../src/data/zork2/scenes.json'
import items2 from '../src/data/zork2/items.json'
import scenePrompts2 from '../tools/images/zork2/prompts.json'
import itemPrompts2 from '../tools/images/zork2/item-prompts.json'
import symbols2 from '../src/engine/story/zork2/symbols.json'
import scenes3 from '../src/data/zork3/scenes.json'
import items3 from '../src/data/zork3/items.json'
import scenePrompts3 from '../tools/images/zork3/prompts.json'
import itemPrompts3 from '../tools/images/zork3/item-prompts.json'
import symbols3 from '../src/engine/story/zork3/symbols.json'
import { Game, type GameId } from '../src/engine/game'
import { World } from '../src/engine/assist/world'
import { allRooms } from '../src/engine/assist/map'
import { loadStory } from './helpers/plain'

async function synthetic(w = 1536, h = 1024): Promise<Buffer> {
  const buf = Buffer.alloc(w * h * 3)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3
      const sky = y < h * 0.55
      buf[i] = sky ? 60 + y / 8 : 60 + x / 30
      buf[i + 1] = sky ? 90 + y / 10 : 80 + y / 20
      buf[i + 2] = sky ? 160 : 40
    }
  return sharp(buf, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer()
}

describe('image post-processing', () => {
  it('produces a 480×270 image limited to the palette', async () => {
    const out = await pixelize(await synthetic(), DEFAULT_PALETTE)
    const { data, info } = await sharp(out).raw().toBuffer({ resolveWithObject: true })
    expect([info.width, info.height]).toEqual([WIDTH, HEIGHT])
    const allowed = new Set(DEFAULT_PALETTE.map((h) => h.toLowerCase()))
    const used = new Set<string>()
    for (let i = 0; i < data.length; i += info.channels) used.add('#' + [data[i], data[i + 1], data[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join(''))
    for (const c of used) expect(allowed.has(c)).toBe(true)
    expect(DEFAULT_PALETTE.length).toBe(64)
  })

  it('builds a palette from reference images', async () => {
    const p = await buildPalette([await synthetic()], 64)
    expect(p.length).toBeGreaterThan(8)
    expect(p.length).toBeLessThanOrEqual(64)
  })

  it('maps every room to exactly one scene', () => {
    const rooms = scenes.scenes.flatMap((s) => s.rooms)
    expect(rooms.length).toBe(110)
    expect(new Set(rooms).size).toBe(110)
  })
})

/** A brass-colored disc on a plain background (magenta, or transparent). */
async function object(background: 'magenta' | 'transparent', size = 1024): Promise<Buffer> {
  const buf = Buffer.alloc(size * size * 4)
  const r = size * 0.3
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const inside = Math.hypot(x - size * 0.55, y - size * 0.45) < r
      if (inside) buf.set([200 - y / 10, 150 - y / 12, 50, 255], i)
      else if (background === 'magenta') buf.set([255, 0, 255, 255], i)
      else buf.set([0, 0, 0, 0], i)
    }
  return sharp(buf, { raw: { width: size, height: size, channels: 4 } }).png().toBuffer()
}

describe('item icon post-processing', () => {
  for (const background of ['magenta', 'transparent'] as const) {
    it(`cuts the object out of a ${background} background into a 48×48 icon`, async () => {
      const out = await pixelizeItem(await object(background), DEFAULT_PALETTE)
      const { data, info } = await sharp(out).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
      expect([info.width, info.height]).toEqual([ITEM_SIZE, ITEM_SIZE])
      const alpha = (x: number, y: number) => data[(y * ITEM_SIZE + x) * 4 + 3]
      expect([alpha(0, 0), alpha(ITEM_SIZE - 1, ITEM_SIZE - 1)]).toEqual([0, 0])
      expect(alpha(ITEM_SIZE >> 1, ITEM_SIZE >> 1)).toBe(255)
      const allowed = new Set(DEFAULT_PALETTE.map((h) => h.toLowerCase()))
      for (let i = 0; i < data.length; i += 4) {
        expect([0, 255]).toContain(data[i + 3])
        if (data[i + 3]) expect(allowed.has('#' + [data[i], data[i + 1], data[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join(''))).toBe(true)
      }
      // no magenta fringe left around the object
      for (let i = 0; i < data.length; i += 4) if (data[i + 3]) expect(data[i] > 200 && data[i + 1] < 60 && data[i + 2] > 200).toBe(false)
    })
  }

  it('has a prompt for every item', () => {
    const ids = items.items.map((i) => i.id).sort()
    expect(Object.keys(itemPrompts.items).sort()).toEqual(ids)
  })
})

describe('the images of each game', () => {
  const GAMES = {
    zork1: { scenes, items, prompts: scenePrompts1, itemPrompts, symbols: symbols1 },
    zork2: { scenes: scenes2, items: items2, prompts: scenePrompts2, itemPrompts: itemPrompts2, symbols: symbols2 },
    zork3: { scenes: scenes3, items: items3, prompts: scenePrompts3, itemPrompts: itemPrompts3, symbols: symbols3 },
  }
  type Data = (typeof GAMES)[keyof typeof GAMES]
  const sceneIds = (d: Data) => d.scenes.scenes.flatMap((s) => [s.id, ...((s as { variants?: { id: string }[] }).variants ?? []).map((v) => v.id)])

  for (const [id, d] of Object.entries(GAMES)) {
    it(`gives every room of ${id} one scene, and every scene and variant a prompt`, () => {
      const game = new Game({ game: id as GameId, story: loadStory(id as GameId), lang: 'en', seed: 1 })
      const rooms = d.scenes.scenes.flatMap((s) => s.rooms)
      expect(new Set(rooms).size).toBe(rooms.length)
      expect([...rooms].sort()).toEqual(allRooms(new World(game)).sort())
      const ids = sceneIds(d)
      expect(new Set(ids).size).toBe(ids.length)
      expect([...ids].sort()).toEqual(Object.keys(d.prompts.scenes).sort())
      if (id !== 'zork1') for (const s of ids) expect(s.startsWith(`${id}-`), s).toBe(true)
    })

    it(`only uses flags and objects of ${id} in the variants and the icons`, () => {
      const { globals, objects } = d.symbols as { globals: Record<string, number>; objects: Record<string, number> }
      for (const s of d.scenes.scenes)
        for (const v of (s as { variants?: { id: string; when: { flag?: string; notFlag?: string; objectIn?: string[] } }[] }).variants ?? []) {
          for (const g of [v.when.flag, v.when.notFlag]) if (g) expect(globals[g], `${v.id}: ${g}`).toBeDefined()
          for (const o of v.when.objectIn ?? []) expect(objects[o], `${v.id}: ${o}`).toBeDefined()
        }
      for (const it of d.items.items) for (const o of it.objects) expect(objects[o], `${it.id}: ${o}`).toBeDefined()
      // an icon is drawn for its own game, or borrowed from Zork I
      const own = Object.keys(d.itemPrompts.items)
      const zork1 = Object.keys(itemPrompts.items)
      for (const it of d.items.items) expect(own.includes(it.id) || zork1.includes(it.id), it.id).toBe(true)
    })
  }
})
