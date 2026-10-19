// Plays a list of commands and prints the transcript with the score after each command.
//   npx tsx tools/play.ts <commands.txt> [--game zork2] [--fr] [--seed N] [--quiet]
import { readFileSync } from 'node:fs'
import { argsWithoutGame, newGame, toolGame } from './game'

const args = argsWithoutGame()
const seedIdx = args.indexOf('--seed')
const file = args.find((a, i) => !a.startsWith('--') && i !== seedIdx + 1)!
const fr = args.includes('--fr')
const quiet = args.includes('--quiet')
const seed = seedIdx >= 0 ? Number(args[seedIdx + 1]) : 1234
const game = await newGame(toolGame(), fr ? 'fr' : 'en', seed)
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
