// A Z-machine version 3 interpreter, written for the original ZORK I story file.
// Reference: The Z-Machine Standards Document 1.1.

import { decodeZString, encodeDictWord, zsciiToString } from './text'
import { FrotzRandom, type RngState } from './rng'

export type VmYield =
  | { kind: 'input' }
  | { kind: 'quit' }
  | { kind: 'restart' }

/** Where printed text comes from, so the translation layer can recognise it. */
export type TextSource =
  | { kind: 'inline'; addr: number } // print / print_ret, addr = instruction address
  | { kind: 'paddr'; addr: number } // print_paddr, addr = byte address of the string
  | { kind: 'addr'; addr: number } // print_addr (dictionary words), addr = byte address

export interface OutputSink {
  text(text: string, source: TextSource): void
  object(obj: number): void
  number(n: number): void
  char(zscii: number): void
  newLine(): void
}

export interface Frame {
  returnPc: number
  storeVar: number // -1 = discard the result
  locals: number[]
  stackBase: number
  routine: number
}

export interface ParseEntry {
  dictAddr: number
  length: number
  position: number // index in the text buffer (first letter = 1)
}

export interface Snapshot {
  dynamic: string // base64 of dynamic memory
  stack: number[]
  frames: Frame[]
  pc: number
  pendingRead: { text: number; parse: number } | null
  rng: RngState
}

/** A routine replaced by native code. Returns the routine's result. */
export type RoutineHook = (vm: ZMachine, args: number[]) => number

/**
 * Called when the PC reaches an address registered with `interceptAt`. Returns true if the
 * handler took care of the instructions (and moved the PC itself), false to run them normally.
 */
export type Interceptor = (vm: ZMachine, pc: number) => boolean

const toSigned = (v: number) => (v & 0x8000 ? v - 0x10000 : v)

/** An error the game itself makes, which ends a real interpreter (Frotz's runtime errors). */
export class FatalError extends Error {}

export class ZMachine {
  readonly story: Uint8Array
  mem: Uint8Array
  readonly version: number
  readonly staticBase: number
  readonly highBase: number
  readonly dictionary: number
  readonly objectTable: number
  readonly globals: number
  readonly abbrevs: number
  readonly initialPc: number

  pc = 0
  stack: number[] = []
  frames: Frame[] = []
  rng: FrotzRandom
  out: OutputSink
  pendingRead: { text: number; parse: number } | null = null
  /** Address of the instruction currently executing. */
  instrPc = 0

  routineHooks = new Map<number, RoutineHook>()
  private interceptMap: Uint8Array
  private interceptor: Interceptor | null = null

  // dictionary
  readonly separators: number[]
  private dictEntryLen: number
  private dictCount: number
  private dictStart: number
  private dictIndex = new Map<string, number>()

  constructor(story: Uint8Array, out: OutputSink, seed = 0) {
    this.story = story
    this.mem = story.slice()
    this.version = story[0]
    if (this.version !== 3) throw new Error(`Unsupported Z-machine version ${this.version}`)
    this.highBase = this.word(0x04)
    this.initialPc = this.word(0x06)
    this.dictionary = this.word(0x08)
    this.objectTable = this.word(0x0a)
    this.globals = this.word(0x0c)
    this.staticBase = this.word(0x0e)
    this.abbrevs = this.word(0x18)
    this.out = out
    this.rng = new FrotzRandom(seed)
    this.interceptMap = new Uint8Array(story.length)

    // dictionary
    let p = this.dictionary
    const nsep = this.mem[p++]
    this.separators = Array.from(this.mem.subarray(p, p + nsep))
    p += nsep
    this.dictEntryLen = this.mem[p++]
    this.dictCount = toSigned(this.word(p))
    p += 2
    this.dictStart = p
    for (let i = 0; i < Math.abs(this.dictCount); i++) {
      const a = this.dictStart + i * this.dictEntryLen
      this.dictIndex.set(this.keyAt(a), a)
    }
    this.reset()
  }

  // ---------------------------------------------------------------- memory

  word(addr: number): number {
    return (this.mem[addr] << 8) | this.mem[addr + 1]
  }

  setWord(addr: number, v: number): void {
    this.mem[addr] = (v >> 8) & 0xff
    this.mem[addr + 1] = v & 0xff
  }

  private keyAt(addr: number): string {
    return `${this.mem[addr]},${this.mem[addr + 1]},${this.mem[addr + 2]},${this.mem[addr + 3]}`
  }

  reset(): void {
    this.mem = this.story.slice()
    this.stack = []
    this.frames = [{ returnPc: 0, storeVar: -1, locals: [], stackBase: 0, routine: 0 }]
    this.pc = this.initialPc
    this.pendingRead = null
    // interpreter capabilities (flags 1): status line available, no split screen
    this.mem[0x01] &= ~0x10
    // standard revision 1.1
    this.mem[0x32] = 1
    this.mem[0x33] = 1
  }

  // ---------------------------------------------------------------- variables

  readVar(v: number): number {
    if (v === 0) {
      const frame = this.frames[this.frames.length - 1]
      if (this.stack.length <= frame.stackBase) throw new Error(`Stack underflow at ${this.instrPc.toString(16)}`)
      return this.stack.pop()!
    }
    if (v < 16) return this.frames[this.frames.length - 1].locals[v - 1]
    return this.word(this.globals + 2 * (v - 16))
  }

  writeVar(v: number, value: number): void {
    value &= 0xffff
    if (v === 0) this.stack.push(value)
    else if (v < 16) this.frames[this.frames.length - 1].locals[v - 1] = value
    else this.setWord(this.globals + 2 * (v - 16), value)
  }

  /** Indirect variable access: the stack is read/written in place. */
  private peekVar(v: number): number {
    if (v === 0) return this.stack[this.stack.length - 1]
    return this.readVar(v)
  }

  private pokeVar(v: number, value: number): void {
    if (v === 0) this.stack[this.stack.length - 1] = value & 0xffff
    else this.writeVar(v, value)
  }

  global(n: number): number {
    return this.word(this.globals + 2 * n)
  }

  setGlobal(n: number, value: number): void {
    this.setWord(this.globals + 2 * n, value & 0xffff)
  }

  // ---------------------------------------------------------------- objects

  objAddr(obj: number): number {
    return this.objectTable + 62 + (obj - 1) * 9
  }

  parent(obj: number): number {
    return obj ? this.mem[this.objAddr(obj) + 4] : 0
  }

  sibling(obj: number): number {
    return obj ? this.mem[this.objAddr(obj) + 5] : 0
  }

  child(obj: number): number {
    return obj ? this.mem[this.objAddr(obj) + 6] : 0
  }

  hasAttr(obj: number, attr: number): boolean {
    if (!obj) return false
    return (this.mem[this.objAddr(obj) + (attr >> 3)] & (0x80 >> (attr & 7))) !== 0
  }

  setAttr(obj: number, attr: number, on: boolean): void {
    if (!obj) return
    const a = this.objAddr(obj) + (attr >> 3)
    if (on) this.mem[a] |= 0x80 >> (attr & 7)
    else this.mem[a] &= ~(0x80 >> (attr & 7))
  }

  removeObj(obj: number): void {
    const parent = this.parent(obj)
    if (!parent) return
    const oa = this.objAddr(obj)
    const pa = this.objAddr(parent)
    const next = this.mem[oa + 5]
    if (this.mem[pa + 6] === obj) {
      this.mem[pa + 6] = next
    } else {
      let c = this.mem[pa + 6]
      while (c) {
        const ca = this.objAddr(c)
        if (this.mem[ca + 5] === obj) {
          this.mem[ca + 5] = next
          break
        }
        c = this.mem[ca + 5]
      }
    }
    this.mem[oa + 4] = 0
    this.mem[oa + 5] = 0
  }

  insertObj(obj: number, dest: number): void {
    this.removeObj(obj)
    const oa = this.objAddr(obj)
    const da = this.objAddr(dest)
    this.mem[oa + 5] = this.mem[da + 6]
    this.mem[da + 6] = obj
    this.mem[oa + 4] = dest
  }

  propTable(obj: number): number {
    return this.word(this.objAddr(obj) + 7)
  }

  objName(obj: number): string {
    const pt = this.propTable(obj)
    if (this.mem[pt] === 0) return ''
    return decodeZString(this.mem, pt + 1, this.abbrevs).text
  }

  private firstProp(obj: number): number {
    const pt = this.propTable(obj)
    return pt + 1 + this.mem[pt] * 2
  }

  /** Returns the address of the size byte of property `prop`, or 0. */
  private findProp(obj: number, prop: number): number {
    let p = this.firstProp(obj)
    for (;;) {
      const size = this.mem[p]
      if (size === 0) return 0
      const num = size & 0x1f
      if (num === prop) return p
      if (num < prop) return 0
      p += 1 + (size >> 5) + 1
    }
  }

  getProp(obj: number, prop: number): number {
    const p = this.findProp(obj, prop)
    if (!p) return this.word(this.objectTable + 2 * (prop - 1))
    const len = (this.mem[p] >> 5) + 1
    return len === 1 ? this.mem[p + 1] : this.word(p + 1)
  }

  getPropAddr(obj: number, prop: number): number {
    const p = this.findProp(obj, prop)
    return p ? p + 1 : 0
  }

  getPropLen(addr: number): number {
    if (!addr) return 0
    return (this.mem[addr - 1] >> 5) + 1
  }

  private getNextProp(obj: number, prop: number): number {
    let p: number
    if (prop === 0) {
      p = this.firstProp(obj)
    } else {
      p = this.findProp(obj, prop)
      if (!p) throw new Error(`get_next_prop: no property ${prop} on object ${obj}`)
      p += 1 + (this.mem[p] >> 5) + 1
    }
    return this.mem[p] & 0x1f
  }

  putProp(obj: number, prop: number, value: number): void {
    const p = this.findProp(obj, prop)
    if (!p) throw new Error(`put_prop: no property ${prop} on object ${obj}`)
    if ((this.mem[p] >> 5) === 0) this.mem[p + 1] = value & 0xff
    else this.setWord(p + 1, value)
  }

  // ---------------------------------------------------------------- text helpers

  decodeAt(addr: number): { text: string; end: number } {
    return decodeZString(this.mem, addr, this.abbrevs)
  }

  unpack(paddr: number): number {
    return paddr * 2
  }

  // ---------------------------------------------------------------- dictionary & input

  lookupWord(word: string): number {
    return this.dictIndex.get(encodeDictWord(word).join(',')) ?? 0
  }

  dictWordAt(addr: number): string {
    return this.decodeAt(addr).text
  }

  /** All dictionary entries (address and text). */
  dictionaryEntries(): { addr: number; word: string }[] {
    const res: { addr: number; word: string }[] = []
    for (let i = 0; i < Math.abs(this.dictCount); i++) {
      const addr = this.dictStart + i * this.dictEntryLen
      res.push({ addr, word: this.dictWordAt(addr) })
    }
    return res
  }

  /** Standard v3 lexical analysis of `text` (already lower-case). */
  tokenize(text: string): ParseEntry[] {
    const entries: ParseEntry[] = []
    let i = 0
    while (i < text.length) {
      const c = text.charCodeAt(i)
      if (c === 32) {
        i++
        continue
      }
      if (this.separators.includes(c)) {
        entries.push({ dictAddr: this.lookupWord(text[i]), length: 1, position: i + 1 })
        i++
        continue
      }
      let j = i
      while (j < text.length && text.charCodeAt(j) !== 32 && !this.separators.includes(text.charCodeAt(j))) j++
      entries.push({ dictAddr: this.lookupWord(text.slice(i, j)), length: j - i, position: i + 1 })
      i = j
    }
    return entries
  }

  /**
   * Answers a pending `sread`. `parse` lets a caller supply its own lexical analysis
   * (used by the French front-end); positions refer to `text`.
   */
  provideInput(line: string, parse?: ParseEntry[]): void {
    if (!this.pendingRead) throw new Error('No input requested')
    const { text: tb, parse: pb } = this.pendingRead
    const max = this.mem[tb]
    let text = ''
    for (const ch of line.toLowerCase()) {
      const code = ch.charCodeAt(0)
      if (code >= 32 && code <= 126) text += ch
      else if (code > 126) text += ch // kept for positions; never matches the dictionary
      if (text.length >= max) break
    }
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i)
      this.mem[tb + 1 + i] = code <= 126 ? code : 63 // '?' for non ASCII
    }
    this.mem[tb + 1 + text.length] = 0
    const entries = (parse ?? this.tokenize(text)).slice(0, this.mem[pb])
    this.mem[pb + 1] = entries.length
    entries.forEach((e, k) => {
      const a = pb + 2 + k * 4
      this.setWord(a, e.dictAddr)
      this.mem[a + 2] = e.length
      this.mem[a + 3] = e.position
    })
    this.pendingRead = null
  }

  // ---------------------------------------------------------------- interception

  setInterceptor(fn: Interceptor | null, addresses: Iterable<number>): void {
    this.interceptor = fn
    this.interceptMap.fill(0)
    for (const a of addresses) this.interceptMap[a] = 1
  }

  // ---------------------------------------------------------------- calls

  callRoutine(paddr: number, args: number[], storeVar: number): void {
    if (paddr === 0) {
      if (storeVar >= 0) this.writeVar(storeVar, 0)
      return
    }
    const addr = this.unpack(paddr)
    const hook = this.routineHooks.get(addr)
    if (hook) {
      const r = hook(this, args)
      if (storeVar >= 0) this.writeVar(storeVar, r)
      return
    }
    const nlocals = this.mem[addr]
    const locals: number[] = []
    for (let i = 0; i < nlocals; i++) locals.push(this.word(addr + 1 + 2 * i))
    for (let i = 0; i < args.length && i < nlocals; i++) locals[i] = args[i] & 0xffff
    this.frames.push({ returnPc: this.pc, storeVar, locals, stackBase: this.stack.length, routine: addr })
    this.pc = addr + 1 + 2 * nlocals
  }

  ret(value: number): void {
    const frame = this.frames.pop()!
    this.stack.length = frame.stackBase
    this.pc = frame.returnPc
    if (frame.storeVar >= 0) this.writeVar(frame.storeVar, value)
  }

  private branch(cond: boolean): void {
    const b1 = this.mem[this.pc++]
    let offset: number
    if (b1 & 0x40) {
      offset = b1 & 0x3f
    } else {
      offset = ((b1 & 0x3f) << 8) | this.mem[this.pc++]
      if (offset & 0x2000) offset -= 0x4000
    }
    if (cond === ((b1 & 0x80) !== 0)) {
      if (offset === 0) this.ret(0)
      else if (offset === 1) this.ret(1)
      else this.pc += offset - 2
    }
  }

  private storeResult(value: number): void {
    this.writeVar(this.mem[this.pc++], value)
  }

  // ---------------------------------------------------------------- snapshots

  snapshot(): Snapshot {
    return {
      dynamic: toBase64(this.mem.subarray(0, this.staticBase)),
      stack: this.stack.slice(),
      frames: this.frames.map((f) => ({ ...f, locals: f.locals.slice() })),
      pc: this.pc,
      pendingRead: this.pendingRead ? { ...this.pendingRead } : null,
      rng: { ...this.rng.state },
    }
  }

  restore(s: Snapshot): void {
    this.mem = this.story.slice()
    this.mem.set(fromBase64(s.dynamic), 0)
    this.stack = s.stack.slice()
    this.frames = s.frames.map((f) => ({ ...f, locals: f.locals.slice() }))
    this.pc = s.pc
    this.pendingRead = s.pendingRead ? { ...s.pendingRead } : null
    this.rng.state = { ...s.rng }
  }

  // ---------------------------------------------------------------- execution

  /** Runs until the game needs input, quits or restarts. */
  run(maxSteps = 5_000_000): VmYield {
    if (this.pendingRead) return { kind: 'input' }
    for (let steps = 0; steps < maxSteps; steps++) {
      if (this.interceptMap[this.pc] && this.interceptor && this.interceptor(this, this.pc)) continue
      const y = this.step()
      if (y) return y
    }
    throw new Error('Too many steps without input')
  }

  /** Reads the operands of the instruction at the PC. Exposed for the translation layer. */
  decodeOperands(): { op: number; form: 'long' | 'short' | 'var'; count: '0OP' | '1OP' | '2OP' | 'VAR'; types: number[] } {
    const b = this.mem[this.pc++]
    const types: number[] = []
    if (b < 0x80) {
      types.push(b & 0x40 ? 2 : 1, b & 0x20 ? 2 : 1)
      return { op: b & 0x1f, form: 'long', count: '2OP', types }
    }
    if (b < 0xc0) {
      const t = (b >> 4) & 3
      if (t === 3) return { op: b & 0x0f, form: 'short', count: '0OP', types }
      types.push(t)
      return { op: b & 0x0f, form: 'short', count: '1OP', types }
    }
    const tb = this.mem[this.pc++]
    for (let s = 6; s >= 0; s -= 2) {
      const t = (tb >> s) & 3
      if (t === 3) break
      types.push(t)
    }
    return { op: b & 0x1f, form: 'var', count: b & 0x20 ? 'VAR' : '2OP', types }
  }

  /** Reads operand values (consumes bytes and pops the stack for variable 0). */
  readOperands(types: number[]): number[] {
    const vals: number[] = []
    for (const t of types) {
      if (t === 0) {
        vals.push(this.word(this.pc))
        this.pc += 2
      } else if (t === 1) {
        vals.push(this.mem[this.pc++])
      } else {
        vals.push(this.readVar(this.mem[this.pc++]))
      }
    }
    return vals
  }

  private print(text: string, source: TextSource): void {
    this.out.text(text, source)
  }

  step(): VmYield | null {
    this.instrPc = this.pc
    const { op, count, types } = this.decodeOperands()

    // Indirect-variable opcodes read their first operand as a variable number.
    if (count === '2OP' && (op === 4 || op === 5 || op === 13)) {
      const ops = this.readOperands(types)
      const v = ops[0]
      if (op === 13) {
        this.pokeVar(v, ops[1])
        return null
      }
      const cur = toSigned(this.peekVar(v))
      const nv = op === 4 ? cur - 1 : cur + 1
      this.pokeVar(v, nv)
      this.branch(op === 4 ? nv < toSigned(ops[1]) : nv > toSigned(ops[1]))
      return null
    }
    if (count === '1OP' && (op === 5 || op === 6 || op === 14)) {
      const [v] = this.readOperands(types)
      if (op === 14) {
        this.storeResult(this.peekVar(v))
      } else {
        this.pokeVar(v, toSigned(this.peekVar(v)) + (op === 5 ? 1 : -1))
      }
      return null
    }
    if (count === 'VAR' && op === 9) {
      const [v] = this.readOperands(types)
      const value = this.stack.pop()!
      this.pokeVar(v, value)
      return null
    }

    const a = this.readOperands(types)

    if (count === '2OP') {
      const [x, y] = a
      switch (op) {
        case 1: // je
          this.branch(a.slice(1).some((v) => v === x))
          return null
        case 2: // jl
          this.branch(toSigned(x) < toSigned(y))
          return null
        case 3: // jg
          this.branch(toSigned(x) > toSigned(y))
          return null
        case 6: // jin
          this.branch(this.parent(x) === y)
          return null
        case 7: // test
          this.branch((x & y) === y)
          return null
        case 8: // or
          this.storeResult(x | y)
          return null
        case 9: // and
          this.storeResult(x & y)
          return null
        case 10: // test_attr
          this.branch(this.hasAttr(x, y))
          return null
        case 11: // set_attr
          this.setAttr(x, y, true)
          return null
        case 12: // clear_attr
          this.setAttr(x, y, false)
          return null
        case 14: // insert_obj
          this.insertObj(x, y)
          return null
        case 15: // loadw
          this.storeResult(this.word((x + 2 * y) & 0xffff))
          return null
        case 16: // loadb
          this.storeResult(this.mem[(x + y) & 0xffff])
          return null
        case 17: // get_prop
          this.storeResult(this.getProp(x, y))
          return null
        case 18: // get_prop_addr
          this.storeResult(this.getPropAddr(x, y))
          return null
        case 19: // get_next_prop
          this.storeResult(this.getNextProp(x, y))
          return null
        case 20:
          this.storeResult(toSigned(x) + toSigned(y))
          return null
        case 21:
          this.storeResult(toSigned(x) - toSigned(y))
          return null
        case 22:
          this.storeResult(Math.imul(toSigned(x), toSigned(y)))
          return null
        case 23:
          if (toSigned(y) === 0) throw new Error('Division by zero')
          this.storeResult(Math.trunc(toSigned(x) / toSigned(y)))
          return null
        case 24:
          if (toSigned(y) === 0) throw new Error('Division by zero')
          this.storeResult(toSigned(x) % toSigned(y))
          return null
      }
      throw new Error(`Unknown 2OP ${op} at ${this.instrPc.toString(16)}`)
    }

    if (count === '1OP') {
      const x = a[0]
      switch (op) {
        case 0: // jz
          this.branch(x === 0)
          return null
        case 1: {
          // get_sibling
          const s = this.sibling(x)
          this.storeResult(s)
          this.branch(s !== 0)
          return null
        }
        case 2: {
          // get_child
          const c = this.child(x)
          this.storeResult(c)
          this.branch(c !== 0)
          return null
        }
        case 3:
          this.storeResult(this.parent(x))
          return null
        case 4:
          this.storeResult(this.getPropLen(x))
          return null
        case 7: // print_addr
          this.print(this.decodeAt(x).text, { kind: 'addr', addr: x })
          return null
        case 9:
          this.removeObj(x)
          return null
        case 10: // print_obj
          this.out.object(x)
          return null
        case 11:
          this.ret(x)
          return null
        case 12: // jump
          this.pc += toSigned(x) - 2
          return null
        case 13: {
          // print_paddr
          const addr = this.unpack(x)
          this.print(this.decodeAt(addr).text, { kind: 'paddr', addr })
          return null
        }
        case 15: // not
          this.storeResult(~x & 0xffff)
          return null
      }
      throw new Error(`Unknown 1OP ${op} at ${this.instrPc.toString(16)}`)
    }

    if (count === '0OP') {
      switch (op) {
        case 0:
          this.ret(1)
          return null
        case 1:
          this.ret(0)
          return null
        case 2: {
          // print
          const s = this.decodeAt(this.pc)
          const at = this.instrPc
          this.pc = s.end
          this.print(s.text, { kind: 'inline', addr: at })
          return null
        }
        case 3: {
          // print_ret
          const s = this.decodeAt(this.pc)
          const at = this.instrPc
          this.pc = s.end
          this.print(s.text, { kind: 'inline', addr: at })
          this.out.newLine()
          this.ret(1)
          return null
        }
        case 4:
          return null
        case 5: // save: handled by the host outside the VM
          this.branch(false)
          return null
        case 6: // restore
          this.branch(false)
          return null
        case 7:
          return { kind: 'restart' }
        case 8:
          this.ret(this.stack.pop()!)
          return null
        case 9:
          this.stack.pop()
          return null
        case 10:
          return { kind: 'quit' }
        case 11:
          this.out.newLine()
          return null
        case 12: // show_status
          return null
        case 13: // verify
          this.branch(true)
          return null
      }
      throw new Error(`Unknown 0OP ${op} at ${this.instrPc.toString(16)}`)
    }

    // VAR
    switch (op) {
      case 0: {
        const storeVar = this.mem[this.pc++]
        this.callRoutine(a[0], a.slice(1), storeVar)
        return null
      }
      case 1: {
        const addr = (a[0] + 2 * a[1]) & 0xffff
        // Zork II can do it (a spell of the Wizard in the balloon): Frotz stops with this error
        if (addr + 1 >= this.staticBase) throw new FatalError('Store out of dynamic memory')
        this.setWord(addr, a[2])
        return null
      }
      case 2: {
        const addr = (a[0] + a[1]) & 0xffff
        if (addr >= this.staticBase) throw new FatalError('Store out of dynamic memory')
        this.mem[addr] = a[2] & 0xff
        return null
      }
      case 3:
        this.putProp(a[0], a[1], a[2])
        return null
      case 4: // sread
        this.pendingRead = { text: a[0], parse: a[1] }
        return { kind: 'input' }
      case 5:
        this.out.char(a[0])
        return null
      case 6:
        this.out.number(toSigned(a[0]))
        return null
      case 7: {
        const r = toSigned(a[0])
        if (r <= 0) {
          this.rng.seed(-r)
          this.storeResult(0)
        } else {
          this.storeResult(this.rng.next(r))
        }
        return null
      }
      case 8:
        this.stack.push(a[0])
        return null
      case 10: // split_window
      case 11: // set_window
      case 19: // output_stream
      case 20: // input_stream
      case 21: // sound_effect
        return null
    }
    throw new Error(`Unknown VAR ${op} at ${this.instrPc.toString(16)}`)
  }
}

export { zsciiToString }

function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}

function fromBase64(b64: string): Uint8Array {
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}
