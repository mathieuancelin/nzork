// Writes a French transcript annotated with catalog keys, for translation review.
//   npx tsx tools/transcript.ts <commands.txt> <out.txt> [--game zork2] [--seed N]
import { readFileSync, writeFileSync } from 'node:fs'
import { argsWithoutGame, newGame, toolGame } from './game'

const [file, out] = argsWithoutGame()
const seedIdx = process.argv.indexOf('--seed')
const seed = seedIdx >= 0 ? Number(process.argv[seedIdx + 1]) : 1234
const game = await newGame(toolGame(), 'fr', seed)
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
