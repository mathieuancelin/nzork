// Writes a French transcript annotated with catalog keys, for translation review.
//   npx tsx tools/transcript.ts <commands.txt> <out.txt> [--seed N]
import { readFileSync, writeFileSync } from 'node:fs'
import { Game } from '../src/engine/game'
import { loadFrench } from '../src/engine/i18n/fr'

const [file, out] = process.argv.slice(2)
const seedIdx = process.argv.indexOf('--seed')
const seed = seedIdx >= 0 ? Number(process.argv[seedIdx + 1]) : 1234
const fr = loadFrench()
const game = new Game({ story: new Uint8Array(readFileSync(new URL('../src/engine/story/zork1.z3', import.meta.url))), lang: 'fr', seed, catalog: fr.catalog, input: fr.input })
game.presenter.debugKeys = true
let text = game.start().text + '\n'
for (const line of readFileSync(file, 'utf8').split('\n').map((l) => l.replace(/#.*/, '').trim()).filter(Boolean)) {
  const m = line.match(/^until \/(.+)\/ :: (.+)$/)
  const cmd = m ? m[2] : line
  for (let k = 0; k < 20; k++) {
    const t = game.send(cmd)
    text += `\n> ${cmd}\n${t.text}\n`
    if (!m || new RegExp(m[1], 'i').test(t.text.replace(/⟦[^⟧]*⟧/g, '')) || t.state === 'quit') break
  }
}
writeFileSync(out, text)
console.log(`${out}: ${text.length} chars`)
