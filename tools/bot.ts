// Plays only the guide's suggestions (Zork I): npx tsx tools/bot.ts [seed] [--fr] [--verbose]
import { World } from '../src/engine/assist/world'
import { guideStep } from '../src/engine/assist/guide'
import { newGame } from './game'

const args = process.argv.slice(2)
const seed = Number(args.find((a) => /^\d+$/.test(a)) ?? 1234)
const fr = args.includes('--fr')
const verbose = args.includes('--verbose')
const game = await newGame('zork1', fr ? 'fr' : 'en', seed)
let t = game.start()
const w = new World(game)
let last = ''
let repeat = 0
for (let i = 0; i < 1500; i++) {
  if (t.state === 'quit' || !['PARSER', 'LOUD-ROOM-FCN'].includes(game.inputRoutineName())) break
  const step = guideStep(w)
  if (!step) {
    console.log(`[${i}] guide has nothing to suggest in ${w.here()} (score ${w.score()})`)
    break
  }
  repeat = step.command === last ? repeat + 1 : 0
  last = step.command
  if (repeat > (step.command === "wait" ? 200 : 25)) {
    console.log(`[${i}] stuck repeating "${step.command}" in ${w.here()}:\n${t.text}`)
    break
  }
  const before = w.score()
  t = game.sendCanonical(step.command)
  if (verbose) console.log(`> ${step.command}  [${w.here()} ${w.score()}]\n${t.text}\n`)
  else if (w.score() !== before) console.log(`[${t.status.moves}] ${step.command} → ${w.score()} (${w.here()})`)
}
console.log(`END seed ${seed}: score ${w.score()} moves ${t.status.moves} room ${w.here()} state ${t.state} input ${game.inputRoutineName()}`)
if (/ZORK II|Master Adventurer|Maître aventurier/.test(t.text)) console.log('WON')
