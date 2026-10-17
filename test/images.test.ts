// The post-processing must bring any image to the 480×270 grid with at most 64 colors.
import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { pixelize, buildPalette, DEFAULT_PALETTE, WIDTH, HEIGHT } from '../tools/images/lib/pixel'
import scenes from '../src/data/scenes.json'

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
