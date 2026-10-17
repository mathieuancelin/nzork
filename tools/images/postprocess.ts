// Re-runs the pixel post-processing of every approved image (after a palette change):
//   npm run images:postprocess [-- --items] [-- --dither atkinson|floyd-steinberg|sierra-lite|nearest]
// And builds the shared palette from the approved keystone scenes:
//   npm run images:palette
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { IMAGES, KINDS, arg, ensureDir, flag, kindFromArgs, readManifest, writeManifest } from './lib/common'
import { buildPalette, loadPalette, pixelize, pixelizeItem, type Dither } from './lib/pixel'

if (flag('palette')) {
  const refs = KINDS.scenes.references
  const files = existsSync(refs) ? readdirSync(refs).filter((f) => /\.png$/i.test(f)) : []
  if (!files.length) throw new Error('No reference images yet: approve the keystone scenes first (npm run images:review).')
  const colors = await buildPalette(files.map((f) => readFileSync(join(refs, f))))
  writeFileSync(join(IMAGES, 'palette.json'), JSON.stringify({ colors }, null, 1) + '\n')
  console.log(`Palette of ${colors.length} colors built from ${files.length} keystone image(s) → tools/images/palette.json`)
  process.exit(0)
}

const kind = kindFromArgs()
const palette = loadPalette()
const dither = (arg('dither') ?? (kind.name === 'items' ? 'nearest' : 'atkinson')) as Dither
const convert = kind.name === 'items' ? pixelizeItem : pixelize
const files = existsSync(kind.approved) ? readdirSync(kind.approved).filter((f) => /\.png$/i.test(f)) : []
const manifest = readManifest(kind)
ensureDir(kind.public)
for (const f of files) {
  const id = f.replace(/\.png$/i, '')
  writeFileSync(join(kind.public, `${id}.png`), await convert(readFileSync(join(kind.approved, f)), palette, dither))
  manifest.add(id)
  console.log(`${id} ✓`)
}
writeManifest(manifest, kind)
console.log(`${files.length} image(s) processed with ${palette.length} colors (${dither}).`)
