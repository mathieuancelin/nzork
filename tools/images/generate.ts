// Generates candidate images for the scenes.
//
//   npm run images:generate -- --provider openai --keystones --count 4          (plan + cost only)
//   npm run images:generate -- --provider openai --keystones --count 4 --yes    (really generates)
//
// Scene selection: --keystones | --scenes id1,id2 | --missing (no approved image yet) | --all
// Options: --count N (candidates per scene, default 4) · --no-refs (do not send the style
//          references) · --concurrency N (default 2)
// Candidates go to tools/images/out/<scene>/; choose them with `npm run images:review`.

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { readdirSync, existsSync } from 'node:fs'
import { PROVIDERS } from './lib/providers'
import { OUT, REFERENCES, arg, candidates, ensureDir, flag, fullPrompt, loadDotEnv, loadPrompts, readManifest } from './lib/common'

loadDotEnv()
const prompts = loadPrompts()
const providerName = arg('provider') ?? 'openai'
const make = PROVIDERS[providerName]
if (!make) throw new Error(`Unknown provider ${providerName} (available: ${Object.keys(PROVIDERS).join(', ')})`)
const provider = make()
const count = Number(arg('count') ?? 4)
const concurrency = Number(arg('concurrency') ?? 2)

let ids: string[]
if (flag('keystones')) ids = Object.entries(prompts.scenes).filter(([, s]) => s.keystone).map(([id]) => id)
else if (arg('scenes')) ids = arg('scenes')!.split(',').map((s) => s.trim())
else if (flag('missing')) {
  const done = readManifest()
  ids = Object.keys(prompts.scenes).filter((id) => !done.has(id))
} else if (flag('all')) ids = Object.keys(prompts.scenes)
else {
  console.log('Choose scenes: --keystones | --scenes a,b | --missing | --all')
  process.exit(1)
}
for (const id of ids) if (!prompts.scenes[id]) throw new Error(`Unknown scene ${id}`)

const refs = flag('no-refs') || !existsSync(REFERENCES) ? [] : readdirSync(REFERENCES).filter((f) => /\.png$/i.test(f)).map((f) => readFileSync(join(REFERENCES, f)))
const total = ids.length * count
console.log(`Provider: ${provider.name} (${provider.model})`)
console.log(`Scenes: ${ids.length} × ${count} candidates = ${total} images, ${refs.length} style reference(s)`)
console.log(`Estimated cost: ~${(total * provider.estimatedCost).toFixed(2)} $ (rough estimate, check the provider's prices)`)
if (!flag('yes')) {
  console.log('\nDry run. Add --yes to generate.')
  process.exit(0)
}

const jobs: { id: string; n: number }[] = []
for (const id of ids) for (let n = 0; n < count; n++) jobs.push({ id, n })
let done = 0
let failed = 0

async function run(job: { id: string; n: number }) {
  const dir = ensureDir(join(OUT, job.id))
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const img = await provider.generate({ prompt: fullPrompt(prompts, job.id), references: refs })
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
console.log(`\nDone: ${done} image(s), ${failed} failure(s). Candidates per scene: ${ids.map((id) => `${id}=${candidates(id).length}`).join(', ')}`)
console.log('Next: npm run images:review')
