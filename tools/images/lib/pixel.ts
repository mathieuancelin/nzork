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

/** Crops to 16:9 (or to the given grid), resizes to the pixel grid and maps every pixel to the palette. */
export async function pixelize(input: Buffer, palette: string[], dither: Dither = 'atkinson', width = WIDTH, height = HEIGHT): Promise<Buffer> {
  const { data, info } = await sharp(input)
    .resize(width, height, { fit: 'cover', position: 'centre', kernel: 'lanczos3' })
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

// ------------------------------------------------------------------ item icons

/** Side of the item icons, in pixels (shown 1:1 in the game). */
export const ITEM_SIZE = 48

const dist = (d: Uint8Array | Uint8ClampedArray, i: number, c: number[]) => Math.hypot(d[i] - c[0], d[i + 1] - c[1], d[i + 2] - c[2])

/**
 * Makes the background transparent, unless the image already has one: the background is the
 * color of the corners, removed by flood fill from the edges, then the fringe the object's
 * anti-aliasing leaves against it is eaten away.
 */
export function removeBackground(px: Uint8Array, w: number, h: number, tolerance = 60): void {
  const corners = [0, w - 1, (h - 1) * w, h * w - 1]
  if (corners.every((p) => px[p * 4 + 3] < 16)) return
  const bg = [0, 1, 2].map((c) => corners.reduce((sum, p) => sum + px[p * 4 + c], 0) / 4)
  const seen = new Uint8Array(w * h)
  const queue = new Int32Array(w * h)
  let head = 0
  let tail = 0
  const push = (p: number) => {
    if (seen[p] || dist(px, p * 4, bg) > tolerance) return
    seen[p] = 1
    queue[tail++] = p
  }
  for (let x = 0; x < w; x++) {
    push(x)
    push((h - 1) * w + x)
  }
  for (let y = 0; y < h; y++) {
    push(y * w)
    push(y * w + w - 1)
  }
  while (head < tail) {
    const p = queue[head++]
    const x = p % w
    if (x > 0) push(p - 1)
    if (x < w - 1) push(p + 1)
    if (p >= w) push(p - w)
    if (p < (h - 1) * w) push(p + w)
  }
  for (let p = 0; p < w * h; p++) if (seen[p]) px[p * 4 + 3] = 0
  // fringe: opaque pixels next to the background that are still close to its color
  for (let pass = 0; pass < 2; pass++) {
    const fringe: number[] = []
    for (let p = 0; p < w * h; p++) {
      if (px[p * 4 + 3] === 0 || dist(px, p * 4, bg) > tolerance * 1.8) continue
      const x = p % w
      const near = (x > 0 && px[(p - 1) * 4 + 3] === 0) || (x < w - 1 && px[(p + 1) * 4 + 3] === 0) || (p >= w && px[(p - w) * 4 + 3] === 0) || (p < (h - 1) * w && px[(p + w) * 4 + 3] === 0)
      if (near) fringe.push(p)
    }
    for (const p of fringe) px[p * 4 + 3] = 0
  }
}

/** Icon of an object: background removed, trimmed, fitted in a square, mapped to the palette, transparent around. */
export async function pixelizeItem(input: Buffer, palette: string[], dither: Dither = 'nearest'): Promise<Buffer> {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: w, height: h } = info
  const px = new Uint8Array(data)
  removeBackground(px, w, h)
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (px[(y * w + x) * 4 + 3] >= 128) {
        x0 = Math.min(x0, x)
        x1 = Math.max(x1, x)
        y0 = Math.min(y0, y)
        y1 = Math.max(y1, y)
      }
  if (x1 < 0) throw new Error('Nothing left once the background is removed')
  // a small margin around the object, centered in a square
  const bw = x1 - x0 + 1
  const bh = y1 - y0 + 1
  const side = Math.ceil(Math.max(bw, bh) * 1.08)
  const padX = side - bw
  const padY = side - bh
  // two pipelines: sharp would otherwise resize before extending
  const square = await sharp(Buffer.from(px), { raw: { width: w, height: h, channels: 4 } })
    .extract({ left: x0, top: y0, width: bw, height: bh })
    .extend({ left: padX >> 1, right: padX - (padX >> 1), top: padY >> 1, bottom: padY - (padY >> 1), background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .raw()
    .toBuffer()
  const { data: small } = await sharp(square, { raw: { width: side, height: side, channels: 4 } })
    .resize(ITEM_SIZE, ITEM_SIZE, { kernel: 'lanczos3' })
    .raw()
    .toBuffer({ resolveWithObject: true })
  // pixels are either opaque or transparent; colors are quantized on their own
  const rgba = new Uint8Array(small)
  const opaque = new Uint8Array(ITEM_SIZE * ITEM_SIZE)
  for (let p = 0; p < opaque.length; p++) {
    opaque[p] = rgba[p * 4 + 3] >= 110 ? 1 : 0
    rgba[p * 4 + 3] = 255
  }
  const points = iq.utils.PointContainer.fromUint8Array(rgba, ITEM_SIZE, ITEM_SIZE)
  const out = iq
    .applyPaletteSync(points, toPalette(palette), { imageQuantization: dither === 'nearest' ? 'nearest' : dither, colorDistanceFormula: 'euclidean-bt709' })
    .toUint8Array()
  for (let p = 0; p < opaque.length; p++) out[p * 4 + 3] = opaque[p] ? 255 : 0
  return sharp(Buffer.from(out), { raw: { width: ITEM_SIZE, height: ITEM_SIZE, channels: 4 } })
    .png({ palette: true, colours: 64, compressionLevel: 9, effort: 10 })
    .toBuffer()
}

// ------------------------------------------------------------------ character portraits

/** Side of a character portrait: a square close-up, at about the pixel density of the scenes. */
export const PORTRAIT_SIZE = 128

/** Portrait of a character: cropped to a square, resized to the grid, mapped to the palette. */
export const pixelizePortrait = (input: Buffer, palette: string[], dither: Dither = 'atkinson') => pixelize(input, palette, dither, PORTRAIT_SIZE, PORTRAIT_SIZE)
