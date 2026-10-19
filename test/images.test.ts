// The post-processing must bring any image to the 480×270 grid (or a 48×48 transparent icon)
// with at most 64 colors.
import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { pixelize, pixelizeItem, buildPalette, DEFAULT_PALETTE, WIDTH, HEIGHT, ITEM_SIZE } from '../tools/images/lib/pixel'
import scenes from '../src/data/zork1/scenes.json'
import items from '../src/data/zork1/items.json'
import itemPrompts from '../tools/images/item-prompts.json'

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
