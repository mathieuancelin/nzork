// Runs the original story file with a plain-text output, as a reference transcript.
import { readFileSync } from 'node:fs'
import { ZMachine, zsciiToString, type OutputSink } from '../../src/engine/zmachine/vm'
import { GAMES, type GameId } from '../../src/engine/games'

export const storyPath = (game: GameId = 'zork1') => new URL(`../../src/engine/story/${game}/${GAMES[game].file}`, import.meta.url)

export function loadStory(game: GameId = 'zork1'): Uint8Array {
  return new Uint8Array(readFileSync(storyPath(game)))
}

export class PlainSink implements OutputSink {
  buf = ''
  text(t: string) {
    this.buf += t
  }
  object(obj: number) {
    this.buf += this.vm?.objName(obj) ?? `#${obj}`
  }
  number(n: number) {
    this.buf += String(n)
  }
  char(c: number) {
    this.buf += zsciiToString(c)
  }
  newLine() {
    this.buf += '\n'
  }
  vm?: ZMachine
  take(): string {
    const s = this.buf
    this.buf = ''
    return s
  }
}

/** Plays `commands` and returns the full transcript, dfrotz style (commands are not echoed). */
export function playPlain(commands: string[], seed: number, game: GameId = 'zork1'): string {
  const sink = new PlainSink()
  const vm = new ZMachine(loadStory(game), sink, seed)
  sink.vm = vm
  let transcript = ''
  let y = vm.run()
  transcript += sink.take()
  for (const cmd of commands) {
    if (y.kind !== 'input') break
    vm.provideInput(cmd)
    y = vm.run()
    transcript += sink.take()
  }
  return transcript
}
