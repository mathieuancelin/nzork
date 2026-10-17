// Post-processing: every image is brought to the same 480×270 grid and the same 64-color
// palette. This is what makes all scenes look like they come from the same game.
import sharp from 'sharp'
import * as iq from 'image-q'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { IMAGES } from './common'

export const WIDTH = 480
export const HEIGHT = 270

/** Default "Zork" palette (used until a palette is built from the approved keystone scenes). */
export const DEFAULT_PALETTE = [
  // neutrals
  '#000000', '#0e0b08', '#1c1712', '#2b241c', '#3d342a', '#554a3d', '#74685a', '#9a8f80', '#bfb6a6', '#ddd5c4', '#f2ecdf', '#ffffff',
  // wood and earth
  '#2a1a10', '#3e2715', '#57361c', '#714726', '#8c5a31', '#a8713f', '#c48c55', '#dcab73',
  // amber and gold
  '#5a3a0a', '#85560f', '#b07a19', '#d6a02a', '#f0c24a', '#fbe08a',
  // reds
  '#2a0a0a', '#4f1210', '#7a1d16', '#a32b1e', '#c9452e', '#e6735a',
  // greens
  '#0d1a0e', '#172b16', '#22401f', '#2f5729', '#3f6f33', '#568a40', '#74a650', '#9cc46a',
  // water
  '#0a1a20', '#11303a', '#1a4a56', '#276674', '#3b8592', '#63a9b2',
  // sky
  '#121a33', '#1e2c52', '#2e4475', '#44619a', '#6585bb', '#93acd6',
  // magic
  '#1c1026', '#2e1a3d', '#462659', '#5f3577', '#7c4c94', '#a476bb',
  // skin and glows
  '#6b4a3a', '#9c6d55', '#d39f80', '#c8e86a', '#9fe8e0', '#d55aa8',
]

export function loadPalette(): string[] {
  const f = join(IMAGES, 'palette.json')
  if (existsSync(f)) return (JSON.parse(readFileSync(f, 'utf8')) as { colors: string[] }).colors
  return DEFAULT_PALETTE
}

function toPalette(hex: string[]): iq.utils.Palette {
  const p = new iq.utils.Palette()
  for (const h of hex) {
    const n = parseInt(h.slice(1), 16)
    p.add(iq.utils.Point.createByRGBA((n >> 16) & 255, (n >> 8) & 255, n & 255, 255))
  }
  return p
}

export type Dither = 'nearest' | 'atkinson' | 'floyd-steinberg' | 'sierra-lite'

/** Crops to 16:9, resizes to the pixel grid and maps every pixel to the palette. */
export async function pixelize(input: Buffer, palette: string[], dither: Dither = 'atkinson'): Promise<Buffer> {
  const { data, info } = await sharp(input)
    .resize(WIDTH, HEIGHT, { fit: 'cover', position: 'centre', kernel: 'lanczos3' })
    .removeAlpha()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const points = iq.utils.PointContainer.fromUint8Array(new Uint8Array(data), info.width, info.height)
  const out = iq.applyPaletteSync(points, toPalette(palette), {
    imageQuantization: dither === 'nearest' ? 'nearest' : dither,
    colorDistanceFormula: 'euclidean-bt709',
  })
  return sharp(Buffer.from(out.toUint8Array()), { raw: { width: info.width, height: info.height, channels: 4 } })
    .removeAlpha()
    .png({ palette: true, colours: 64, compressionLevel: 9, effort: 10 })
    .toBuffer()
}

/** Builds a 64-color palette from a set of images (the approved keystone scenes). */
export async function buildPalette(images: Buffer[], colors = 64): Promise<string[]> {
  const containers: iq.utils.PointContainer[] = []
  for (const img of images) {
    const { data, info } = await sharp(img).resize(WIDTH, HEIGHT, { fit: 'cover' }).removeAlpha().ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    containers.push(iq.utils.PointContainer.fromUint8Array(new Uint8Array(data), info.width, info.height))
  }
  const palette = iq.buildPaletteSync(containers, { colors, paletteQuantization: 'wuquant', colorDistanceFormula: 'euclidean-bt709' })
  return palette
    .getPointContainer()
    .getPointArray()
    .map((p) => '#' + [p.r, p.g, p.b].map((v) => v.toString(16).padStart(2, '0')).join(''))
}
