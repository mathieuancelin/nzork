// The presentation layer: turns what the Z-machine prints into text in the chosen language.
//
// In translated mode, every print group (compiled TELL) that has a template in the catalog is
// executed by the presenter instead of the VM: the presenter reads the group's operands (so
// the stack stays balanced), renders the template, then moves the PC past the group.

import type { OutputSink, TextSource, ZMachine } from '../zmachine/vm'
import { zsciiToString } from '../zmachine/text'
import { analyzeStory, findPrintGroups, type PrintGroup } from '../zmachine/disasm'
import { capitalize, withArticle, pronoun, agreement, choose, finishText, markArticle, ARTICLE_FNS, PRONOUN_FNS, type FrNoun } from './grammar'

export interface Catalog {
  /** g<hex address> → template */
  groups: Record<string, string>
  /** s<hex address> → text */
  strings: Record<string, string>
  /** o<object number> → noun */
  objects: Record<string, FrNoun>
  /** m<hex address> → combat message template ({wep} and {def}) */
  melee: Record<string, string>
}

export interface PresenterSymbols {
  routines: Record<string, number>
  globals: Record<string, number>
}

type Arg = { kind: 'o' | 'n' | 'c' | 's' | 'w'; value: number }

const PLACEHOLDER = /\{(?:([A-Za-z]+):)?([0-9]+|\+|-|wep|def)((?:\|[^|}]*)*)\}/g

const groupCache = new WeakMap<Uint8Array, Map<number, PrintGroup>>()

/** Print groups of a story, computed once per story file. */
export function printGroups(story: Uint8Array): Map<number, PrintGroup> {
  let m = groupCache.get(story)
  if (!m) {
    m = new Map(findPrintGroups(story, analyzeStory(story)).map((g) => [g.addr, g]))
    groupCache.set(story, m)
  }
  return m
}

export class Presenter implements OutputSink {
  private buf = ''
  private lastObject = 0
  private pendingArticle: { fn: string; cap: boolean } | null = null
  /** Lets the input layer replace an echoed word (positions in the text buffer). */
  wordEcho: ((position: number, length: number) => string | undefined) | null = null
  /** Gender of the object named by an echoed word (to make a pending article agree). */
  echoNoun: ((position: number, length: number) => { g: 'm' | 'f'; n?: 's' | 'p' } | undefined) | null = null
  /** Prefixes every translated text with its catalog key (translation review). */
  debugKeys = false
  /** Display form of a dictionary word printed by the game (verbs, nouns). */
  dictWord: ((english: string) => string | undefined) | null = null

  constructor(
    private vm: ZMachine,
    private catalog: Catalog | null,
    private symbols: PresenterSymbols,
  ) {}

  install(): void {
    const vm = this.vm
    vm.out = this
    if (!this.catalog) return
    const groups = printGroups(vm.story)
    const translated = [...groups.values()].filter((g) => this.catalog!.groups[key('g', g.addr)] !== undefined)
    vm.setInterceptor((v, pc) => this.runGroup(v, groups.get(pc)!), translated.map((g) => g.addr))
    const remark = this.symbols.routines['REMARK']
    if (remark) vm.routineHooks.set(remark, (v, args) => this.remark(v, args))
    const wordPrint = this.symbols.routines['WORD-PRINT']
    if (wordPrint) vm.routineHooks.set(wordPrint, (_v, args) => this.wordPrint(args))
  }

  take(): string {
    const s = this.catalog ? finishText(this.buf) : this.buf
    this.buf = ''
    return s
  }

  // ------------------------------------------------------------ OutputSink

  text(text: string, source: TextSource): void {
    this.pendingArticle = null
    if (this.catalog && source.kind === 'paddr') {
      const t = this.catalog.strings[key('s', source.addr)]
      if (this.debugKeys) this.buf += `⟦${key('s', source.addr)}⟧`
      if (t !== undefined && t.includes('{')) this.render(t, [])
      else this.buf += t ?? text
      return
    }
    if (source.kind === 'addr' && this.dictWord) {
      this.buf += this.dictWord(text) ?? text
      return
    }
    this.buf += text
  }

  object(obj: number): void {
    if (!obj) return // the original sometimes prints object 0 (V-SWIM): nothing to show
    this.lastObject = obj
    const noun = this.noun(obj)
    if (this.pendingArticle) {
      const { fn, cap } = this.pendingArticle
      this.pendingArticle = null
      const s = withArticle(fn, noun)
      this.buf += cap ? capitalize(s) : markArticle(s)
      return
    }
    this.buf += noun.nom
  }

  number(n: number): void {
    this.pendingArticle = null
    this.buf += String(n)
  }

  char(zscii: number): void {
    this.buf += zsciiToString(zscii)
  }

  newLine(): void {
    this.buf += '\n'
  }

  // ------------------------------------------------------------ helpers

  noun(obj: number): FrNoun {
    const n = this.catalog?.objects['o' + obj]
    return n ?? { nom: this.vm.objName(obj), g: 'm' }
  }

  private runGroup(vm: ZMachine, g: PrintGroup): boolean {
    const tpl = this.catalog!.groups[key('g', g.addr)]
    if (this.debugKeys) this.buf += `⟦${key('g', g.addr)}⟧`
    const args: Arg[] = []
    for (const i of g.instrs) {
      if (i.name === 'print' || i.name === 'print_ret' || i.name === 'new_line') continue
      const value = i.types[0] === 2 ? vm.readVar(i.operands[0]) : i.operands[0]
      // constant strings and characters are part of the template text
      if ((i.name === 'print_paddr' || i.name === 'print_char') && i.types[0] !== 2) continue
      const kind = i.name === 'print_obj' ? 'o' : i.name === 'print_num' ? 'n' : i.name === 'print_char' ? 'c' : i.name === 'print_paddr' ? 's' : 'w'
      args.push({ kind, value: kind === 's' ? value * 2 : value })
    }
    this.render(tpl, args)
    vm.pc = g.end
    if (g.returns) vm.ret(1)
    return true
  }

  /** Renders a template into the output buffer. */
  render(tpl: string, args: Arg[], named: Record<string, Arg> = {}): void {
    let last = 0
    for (const m of tpl.matchAll(PLACEHOLDER)) {
      this.buf += tpl.slice(last, m.index)
      last = m.index! + m[0].length
      const [, fnRaw, ref, opts] = m
      const fn = fnRaw?.toLowerCase()
      const cap = !!fnRaw && fnRaw[0] !== fnRaw[0].toLowerCase()
      if (ref === '+') {
        if (fn) this.pendingArticle = { fn, cap }
        continue
      }
      let arg: Arg | undefined
      if (ref === '-') arg = { kind: 'o', value: this.lastObject }
      else if (ref in named) arg = named[ref]
      else arg = args[Number(ref)]
      if (!arg) continue
      this.buf += this.placeholder(fn, cap, arg, opts ? opts.slice(1).split('|') : [])
    }
    this.buf += tpl.slice(last)
  }

  private placeholder(fn: string | undefined, cap: boolean, arg: Arg, opts: string[]): string {
    let s: string
    switch (arg.kind) {
      case 'o': {
        if (arg.value) this.lastObject = arg.value
        const noun = this.noun(arg.value)
        if (!fn) s = noun.nom
        else if (ARTICLE_FNS.has(fn)) s = fn === 'le' && !cap ? markArticle(withArticle(fn, noun)) : withArticle(fn, noun)
        else if (PRONOUN_FNS.has(fn)) s = pronoun(fn, noun)
        else if (fn === 'e') s = agreement(noun)
        else if (fn === 'g') s = choose(noun, opts)
        else s = noun.nom
        break
      }
      case 'n':
        s = fn === 's' ? (Math.abs(arg.value) >= 2 ? 's' : '') : String(arg.value)
        break
      case 'c':
        s = zsciiToString(arg.value)
        break
      case 's': {
        const t = this.catalog?.strings[key('s', arg.value)]
        if (t !== undefined && t.includes('{')) {
          this.render(t, [])
          s = ''
        } else s = t ?? this.vm.decodeAt(arg.value).text
        break
      }
      case 'w': {
        const en = this.vm.dictWordAt(arg.value)
        s = this.dictWord?.(en) ?? en
        break
      }
    }
    return cap ? capitalize(s) : s
  }

  /** REMARK (message table, defender, weapon): combat messages as whole sentences. */
  private remark(vm: ZMachine, [table, def, wep]: number[]): number {
    const tpl = this.catalog?.melee[key('m', table)]
    if (this.debugKeys) this.buf += `⟦${key('m', table)}⟧`
    if (tpl) {
      this.render(tpl, [], { def: { kind: 'o', value: def }, wep: { kind: 'o', value: wep } })
    } else {
      // original behaviour
      const len = vm.word(table)
      for (let k = 1; k <= len; k++) {
        const v = vm.word(table + 2 * k)
        if (v === F_WEP) this.object(wep)
        else if (v === F_DEF) this.object(def)
        else this.text(vm.decodeAt(v * 2).text, { kind: 'paddr', addr: v * 2 })
      }
    }
    this.newLine()
    return 1
  }

  /** WORD-PRINT (count, position): echoes a word typed by the player. */
  private wordPrint([count, position]: number[]): number {
    const replaced = this.wordEcho?.(position, count)
    if (replaced !== undefined) {
      const pending = this.pendingArticle
      this.pendingArticle = null
      if (pending && replaced) {
        const info = this.echoNoun?.(position, count)
        const s = info ? withArticle(pending.fn, { nom: replaced, g: info.g, n: info.n }) : replaced
        this.buf += pending.cap ? capitalize(s) : markArticle(s)
      } else this.buf += replaced
      return 1
    }
    const tb = this.vm.global(this.symbols.globals['P-INBUF'])
    for (let i = 0; i < count; i++) this.buf += zsciiToString(this.vm.mem[tb + position + i])
    return 1
  }
}

export const key = (prefix: string, n: number) => prefix + n.toString(16)

// Markers used in the combat message tables (constants F-WEP and F-DEF in 1actions.zil).
const F_WEP = 0
const F_DEF = 1
