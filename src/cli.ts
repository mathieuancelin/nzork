// Play Zork in the terminal:  npm run play [-- --en] [-- --seed 1234] [-- --game zork2]
import { readFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { Game } from './engine/game'
import { GAMES, isGameId } from './engine/games'
import { loadFrench } from './engine/i18n/fr'

const args = process.argv.slice(2)
const seedArg = args.indexOf('--seed')
const seed = seedArg >= 0 ? Number(args[seedArg + 1]) : 0
const gameArg = args.indexOf('--game')
const id = gameArg >= 0 ? args[gameArg + 1] : 'zork1'
if (!isGameId(id)) throw new Error(`Unknown game "${id}" (zork1, zork2 or zork3)`)
// a game without a French translation plays in English
const lang = args.includes('--en') || !GAMES[id].french ? 'en' : 'fr'

const story = new Uint8Array(readFileSync(new URL(`./engine/story/${id}/${GAMES[id].file}`, import.meta.url)))
const french = lang === 'fr' ? loadFrench(id) : undefined
const game = new Game({ game: id, story, lang, seed, catalog: french?.catalog, input: french?.input })

const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY })
const show = (text: string) => {
  const s = game.status()
  if (process.stdin.isTTY) process.stdout.write(`\x1b[7m ${s.room} — score ${s.score} — coups ${s.moves} \x1b[0m\n`)
  process.stdout.write(text + '\n> ')
}

show(game.start().text)
rl.on('line', (line) => {
  if (line.trim() === '/annuler' || line.trim() === '/undo') {
    show(game.undo() ? '[Coup annulé]' : '[Rien à annuler]')
    return
  }
  const t = game.send(line)
  if (!process.stdin.isTTY) process.stdout.write(line + '\n')
  if (t.state === 'quit') {
    process.stdout.write(t.text + '\n')
    rl.close()
    return
  }
  show(t.text)
})
