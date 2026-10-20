// Generates candidate images for the scenes, or with --items for the object icons, or with
// --portraits for the character portraits, of Zork I or, with --game zork2, of another game.
//
//   npm run images:generate -- --provider openai --keystones --count 4          (plan + cost only)
//   npm run images:generate -- --provider openai --keystones --count 4 --yes    (really generates)
//   npm run images:generate -- --items --provider openai --keystones --count 3 --yes
//   npm run images:generate -- --portraits --provider openai --keystones --count 3 --yes
//   npm run images:generate -- --game zork2 --provider openai --keystones --count 4 --yes
//
// Selection: --keystones | --ids id1,id2 (or --scenes) | --missing (no approved image yet) | --all
// Options: --count N (candidates each, default 4) · --no-refs (do not send the style
//          references) · --concurrency N (default 2)
// Candidates go to tools/images/out/<id>/ (out-items/ for the icons, out-portraits/ for the
// portraits); choose them with `npm run images:review`. A portrait also gets, as references, the
// approved scenes where its character already appears (its "scenes" in the prompts file).

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PROVIDERS } from './lib/providers'
import { arg, candidates, ensureDir, flag, fullPrompt, kindFromArgs, loadDotEnv, loadPrompts, readManifest, sceneReferences, styleReferences } from './lib/common'

loadDotEnv()
const kind = kindFromArgs()
const items = kind.name === 'items'
const LABEL = { scenes: ['scene', 'Scenes'], items: ['item', 'Items'], portraits: ['portrait', 'Portraits'] }[kind.name]
const prompts = loadPrompts(kind)
const providerName = arg('provider') ?? 'openai'
const make = PROVIDERS[providerName]
if (!make) throw new Error(`Unknown provider ${providerName} (available: ${Object.keys(PROVIDERS).join(', ')})`)
const provider = make()
const count = Number(arg('count') ?? 4)
const concurrency = Number(arg('concurrency') ?? 2)

const picked = arg('ids') ?? arg('scenes')
let ids: string[]
if (flag('keystones')) ids = Object.entries(prompts.entries).filter(([, s]) => s.keystone).map(([id]) => id)
else if (picked) ids = picked.split(',').map((s) => s.trim())
else if (flag('missing')) {
  const done = readManifest(kind)
  ids = Object.keys(prompts.entries).filter((id) => !done.has(id))
} else if (flag('all')) ids = Object.keys(prompts.entries)
else {
  console.log(`Choose ${kind.name}: --keystones | --ids a,b | --missing | --all`)
  process.exit(1)
}
for (const id of ids) if (!prompts.entries[id]) throw new Error(`Unknown ${LABEL[0]} ${id}`)

const refs = flag('no-refs') ? [] : styleReferences(kind).map((f) => readFileSync(f))
// the scenes where a character already appears, for its portrait
const sceneRefs = new Map(ids.map((id) => [id, flag('no-refs') ? [] : sceneReferences(kind, id, prompts).map((f) => readFileSync(f))]))
const shape = kind.name === 'scenes' ? 'wide' : 'square'
const total = ids.length * count
const withScenes = ids.filter((id) => sceneRefs.get(id)!.length).length
console.log(`Game: ${kind.game} · provider: ${provider.name} (${provider.model})`)
console.log(`${LABEL[1]}: ${ids.length} × ${count} candidates = ${total} images, ${refs.length} style reference(s)${kind.name === 'portraits' ? `, ${withScenes} portrait(s) with their scenes as references` : ''}`)
console.log(`Estimated cost: ~${(total * provider.estimatedCost[shape]).toFixed(2)} $ (rough estimate, check the provider's prices)`)
if (!flag('yes')) {
  console.log('\nDry run. Add --yes to generate.')
  process.exit(0)
}

const jobs: { id: string; n: number }[] = []
for (const id of ids) for (let n = 0; n < count; n++) jobs.push({ id, n })
let done = 0
let failed = 0

async function run(job: { id: string; n: number }) {
  const dir = ensureDir(join(kind.out, job.id))
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const own = sceneRefs.get(job.id)!
      const img = await provider.generate({ prompt: fullPrompt(prompts, job.id, kind, own.length > 0), references: [...own, ...refs], shape, transparent: items })
      const file = join(dir, `${Date.now()}-${provider.name}-${job.n}.png`)
      writeFileSync(file, img)
      done++
      console.log(`[${done + failed}/${total}] ${job.id} → ${file}`)
      return
    } catch (e) {
      const status = (e as { status?: number }).status
      const retry = status === 429 || (status !== undefined && status >= 500)
      if (!retry || attempt === 4) {
        failed++
        console.error(`[${done + failed}/${total}] ${job.id} failed: ${(e as Error).message}`)
        return
      }
      await new Promise((r) => setTimeout(r, 2000 * attempt * attempt))
    }
  }
}

const queue = [...jobs]
await Promise.all(
  Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) await run(queue.shift()!)
  }),
)
console.log(`\nDone: ${done} image(s), ${failed} failure(s). Candidates: ${ids.map((id) => `${id}=${candidates(id, kind).length}`).join(', ')}`)
const tab = { scenes: '', items: ' (then the "Objets" tab)', portraits: ' (then the "Portraits" tab)' }[kind.name]
console.log(`Next: npm run images:review${tab}${kind.game === 'zork1' ? '' : ` (game ${kind.game})`}`)
