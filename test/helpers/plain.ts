// Runs the original story file with a plain-text output, as a reference transcript.
import { readFileSync } from 'node:fs'
import { ZMachine, zsciiToString, type OutputSink } from '../../src/engine/zmachine/vm'

export const STORY_PATH = new URL('../../src/engine/story/zork1.z3', import.meta.url)

export function loadStory(): Uint8Array {
  return new Uint8Array(readFileSync(STORY_PATH))
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
export function playPlain(commands: string[], seed: number): string {
  const sink = new PlainSink()
  const vm = new ZMachine(loadStory(), sink, seed)
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
