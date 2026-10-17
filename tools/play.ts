// Plays a list of commands and prints the transcript with the score after each command.
//   npx tsx tools/play.ts <commands.txt> [--fr] [--seed N] [--quiet]
import { readFileSync } from 'node:fs'
import { Game } from '../src/engine/game'
import { loadFrench } from '../src/engine/i18n/fr'

const args = process.argv.slice(2)
const file = args.find((a) => !a.startsWith('--') && !/^\d+$/.test(a))!
const fr = args.includes('--fr')
const quiet = args.includes('--quiet')
const seedIdx = args.indexOf('--seed')
const seed = seedIdx >= 0 ? Number(args[seedIdx + 1]) : 1234
const story = new Uint8Array(readFileSync(new URL('../src/engine/story/zork1.z3', import.meta.url)))
const french = fr ? loadFrench() : undefined
const game = new Game({ story, lang: fr ? 'fr' : 'en', seed, catalog: french?.catalog, input: french?.input })
const commands = readFileSync(file, 'utf8')
  .split('\n')
  .map((l) => l.replace(/#.*/, '').trim())
  .filter(Boolean)

let t = game.start()
if (!quiet) console.log(t.text)
let last = 0
// "until /pattern/ :: command" repeats the command (at most 15 times) until the output matches
const expanded: { cmd: string; until?: RegExp }[] = commands.map((c) => {
  const m = c.match(/^until \/(.+)\/ :: (.+)$/)
  return m ? { cmd: m[2], until: new RegExp(m[1], 'i') } : { cmd: c }
})
for (const { cmd: c, until } of expanded) {
  t = game.send(c)
  for (let k = 0; until && !until.test(t.text) && k < 15 && t.state !== 'quit'; k++) {
    if (!quiet) console.log(`\n> ${c} (again)\n${t.text}`)
    t = game.send(c)
  }
  const s = t.status
  if (quiet) {
    if (s.score !== last) console.log(`[${s.moves}] ${c}  →  score ${s.score} (${s.roomId})`)
  } else {
    console.log(`\n> ${c}    [${s.roomId} | score ${s.score} | moves ${s.moves}]\n${t.text}`)
  }
  last = s.score
  if (t.state === 'quit') break
}
console.log(`\nFINAL: score ${t.status.score}, moves ${t.status.moves}, room ${t.status.roomId}`)
