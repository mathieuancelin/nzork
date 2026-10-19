// Plays a walkthrough file ("until /re/ :: cmd" lines repeat a command until the output matches).
import { readFileSync } from 'node:fs'
import { Game, type GameId, type Status } from '../../src/engine/game'
import { loadFrench } from '../../src/engine/i18n/fr'
import { loadStory } from './plain'

export interface WalkthroughResult {
  /** Commands actually sent (loops expanded). */
  commands: string[]
  transcript: string
  status: Status
  ended: boolean
}

export function playWalkthrough(file: URL, lang: 'en' | 'fr', seed: number, id: GameId = 'zork1'): WalkthroughResult {
  const french = lang === 'fr' ? loadFrench(id) : undefined
  const game = new Game({ game: id, story: loadStory(id), lang, seed, catalog: french?.catalog, input: french?.input })
  const lines = readFileSync(file, 'utf8')
    .split('\n')
    .map((l) => l.replace(/#.*/, '').trim())
    .filter(Boolean)
  const commands: string[] = []
  let t = game.start()
  let transcript = t.text + '\n'
  for (const line of lines) {
    const m = line.match(/^until \/(.+)\/ :: (.+)$/)
    const cmd = m ? m[2] : line
    const until = m ? new RegExp(m[1], 'i') : undefined
    for (let k = 0; k < 20; k++) {
      commands.push(cmd)
      t = game.send(cmd)
      transcript += `> ${cmd}\n${t.text}\n`
      if (!until || until.test(t.text) || t.state === 'quit') break
    }
    if (t.state === 'quit') break
  }
  return { commands, transcript, status: t.status, ended: t.text.includes('ZORK II') || t.text.includes('ZORK II :') }
}
