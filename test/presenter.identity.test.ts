// The presenter, fed with the English texts as templates, must reproduce the original output:
// this validates the print-group interception (operands, stack, returns) and the combat hook.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { ZMachine } from '../src/engine/zmachine/vm'
import { Presenter, type Catalog } from '../src/engine/i18n/presenter'
import sym from '../src/engine/story/symbols.json'
import { loadStory, playPlain } from './helpers/plain'
import { TROLL_FIGHT } from './fixtures-cmds'
import { firstDiff } from '../tools/oracle/firstdiff'

const en = JSON.parse(readFileSync(new URL('../tools/catalog/out/catalog.en.json', import.meta.url), 'utf8'))
const map = <T, U>(o: Record<string, T>, f: (v: T) => U) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, f(v)]))
const identity: Catalog = {
  groups: map(en.groups, (v: { en: string }) => v.en),
  strings: map(en.strings, (v: { en: string }) => v.en),
  objects: map(en.objects, (v: { en: string }) => ({ nom: v.en, g: 'm' as const, article: false as const })),
  melee: map(en.melee, (v: { en: string }) => v.en),
}

function playWithPresenter(commands: string[], seed: number): string {
  const vm = new ZMachine(loadStory(), null as never, seed)
  const p = new Presenter(vm, identity, sym)
  p.install()
  let out = ''
  let y = vm.run()
  out += p.take()
  for (const c of commands) {
    if (y.kind !== 'input') break
    vm.provideInput(c)
    y = vm.run()
    out += p.take()
  }
  return out
}

describe('presenter with English templates', () => {
  for (const seed of [1234, 5000, 31337]) {
    it(`reproduces the original output (seed ${seed})`, () => {
      expect(firstDiff(playWithPresenter(TROLL_FIGHT, seed), playPlain(TROLL_FIGHT, seed))).toBeNull()
    })
  }
})
