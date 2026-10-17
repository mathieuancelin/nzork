// Re-runs the pixel post-processing of every approved image (after a palette change):
//   npm run images:postprocess [-- --dither atkinson|floyd-steinberg|sierra-lite|nearest]
// And builds the shared palette from the approved keystone scenes:
//   npm run images:palette
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { APPROVED, IMAGES, PUBLIC, REFERENCES, arg, ensureDir, flag, readManifest, writeManifest } from './lib/common'
import { buildPalette, loadPalette, pixelize, type Dither } from './lib/pixel'

if (flag('palette')) {
  const files = existsSync(REFERENCES) ? readdirSync(REFERENCES).filter((f) => /\.png$/i.test(f)) : []
  if (!files.length) throw new Error('No reference images yet: approve the keystone scenes first (npm run images:review).')
  const colors = await buildPalette(files.map((f) => readFileSync(join(REFERENCES, f))))
  writeFileSync(join(IMAGES, 'palette.json'), JSON.stringify({ colors }, null, 1) + '\n')
  console.log(`Palette of ${colors.length} colors built from ${files.length} keystone image(s) → tools/images/palette.json`)
  process.exit(0)
}

const palette = loadPalette()
const dither = (arg('dither') ?? 'atkinson') as Dither
const files = existsSync(APPROVED) ? readdirSync(APPROVED).filter((f) => /\.png$/i.test(f)) : []
const manifest = readManifest()
ensureDir(PUBLIC)
for (const f of files) {
  const id = f.replace(/\.png$/i, '')
  writeFileSync(join(PUBLIC, `${id}.png`), await pixelize(readFileSync(join(APPROVED, f)), palette, dither))
  manifest.add(id)
  console.log(`${id} ✓`)
}
writeManifest(manifest)
console.log(`${files.length} image(s) processed with ${palette.length} colors (${dither}).`)
