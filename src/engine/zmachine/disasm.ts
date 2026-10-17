// Static analysis of a v3 story file: routines, instructions, branch targets and strings.
// Used to find "print groups" (the compiled form of a ZIL TELL) and every translatable text.

import { decodeZString } from './text'

export interface Instr {
  addr: number
  next: number
  count: '0OP' | '1OP' | '2OP' | 'VAR'
  op: number
  name: string
  /** Operand types: 0 large const, 1 small const, 2 variable. */
  types: number[]
  operands: number[]
  store?: number
  branch?: { onTrue: boolean; target: number | 'rtrue' | 'rfalse' }
  /** Jump target (jump instruction). */
  jump?: number
  text?: string
}

export interface Routine {
  addr: number
  nlocals: number
  instrs: Instr[]
  end: number
}

export interface StoryAnalysis {
  routines: Routine[]
  routineAt: Map<number, Routine>
  /** Strings stored after the code (printed with print_paddr), by byte address. */
  strings: Map<number, string>
  codeStart: number
  codeEnd: number
}

const NAMES: Record<string, string[]> = {
  '2OP': ['?', 'je', 'jl', 'jg', 'dec_chk', 'inc_chk', 'jin', 'test', 'or', 'and', 'test_attr', 'set_attr', 'clear_attr', 'store', 'insert_obj', 'loadw', 'loadb', 'get_prop', 'get_prop_addr', 'get_next_prop', 'add', 'sub', 'mul', 'div', 'mod'],
  '1OP': ['jz', 'get_sibling', 'get_child', 'get_parent', 'get_prop_len', 'inc', 'dec', 'print_addr', '?', 'remove_obj', 'print_obj', 'ret', 'jump', 'print_paddr', 'load', 'not'],
  '0OP': ['rtrue', 'rfalse', 'print', 'print_ret', 'nop', 'save', 'restore', 'restart', 'ret_popped', 'pop', 'quit', 'new_line', 'show_status', 'verify'],
  VAR: ['call', 'storew', 'storeb', 'put_prop', 'sread', 'print_char', 'print_num', 'random', 'push', 'pull', 'split_window', 'set_window', '?', '?', '?', '?', '?', '?', '?', 'output_stream', 'input_stream', 'sound_effect'],
}

const STORE = new Set([
  '2OP:8', '2OP:9', '2OP:15', '2OP:16', '2OP:17', '2OP:18', '2OP:19', '2OP:20', '2OP:21', '2OP:22', '2OP:23', '2OP:24',
  '1OP:1', '1OP:2', '1OP:3', '1OP:4', '1OP:14', '1OP:15',
  'VAR:0', 'VAR:7',
])
const BRANCH = new Set([
  '2OP:1', '2OP:2', '2OP:3', '2OP:4', '2OP:5', '2OP:6', '2OP:7', '2OP:10',
  '1OP:0', '1OP:1', '1OP:2',
  '0OP:5', '0OP:6', '0OP:13',
])
/** Instructions after which execution never falls through. */
const TERMINAL = new Set(['rtrue', 'rfalse', 'print_ret', 'ret', 'ret_popped', 'jump'])

export function decodeInstr(mem: Uint8Array, addr: number, abbrevs: number): Instr {
  let p = addr
  const b = mem[p++]
  let count: Instr['count']
  let op: number
  const types: number[] = []
  if (b < 0x80) {
    count = '2OP'
    op = b & 0x1f
    types.push(b & 0x40 ? 2 : 1, b & 0x20 ? 2 : 1)
  } else if (b < 0xc0) {
    op = b & 0x0f
    const t = (b >> 4) & 3
    if (t === 3) count = '0OP'
    else {
      count = '1OP'
      types.push(t)
    }
  } else {
    op = b & 0x1f
    count = b & 0x20 ? 'VAR' : '2OP'
    const tb = mem[p++]
    for (let s = 6; s >= 0; s -= 2) {
      const t = (tb >> s) & 3
      if (t === 3) break
      types.push(t)
    }
  }
  const operands: number[] = []
  for (const t of types) {
    if (t === 0) {
      operands.push((mem[p] << 8) | mem[p + 1])
      p += 2
    } else {
      operands.push(mem[p++])
    }
  }
  const key = `${count}:${op}`
  const name = NAMES[count][op] ?? '?'
  const instr: Instr = { addr, next: 0, count, op, name, types, operands }
  if (STORE.has(key)) instr.store = mem[p++]
  if (BRANCH.has(key)) {
    const b1 = mem[p++]
    let offset: number
    if (b1 & 0x40) offset = b1 & 0x3f
    else {
      offset = ((b1 & 0x3f) << 8) | mem[p++]
      if (offset & 0x2000) offset -= 0x4000
    }
    instr.branch = {
      onTrue: (b1 & 0x80) !== 0,
      target: offset === 0 ? 'rfalse' : offset === 1 ? 'rtrue' : p + offset - 2,
    }
  }
  if (name === 'jump') {
    const off = operands[0] & 0x8000 ? operands[0] - 0x10000 : operands[0]
    instr.jump = p + off - 2
  }
  if (name === 'print' || name === 'print_ret') {
    const s = decodeZString(mem, p, abbrevs)
    instr.text = s.text
    p = s.end
  }
  instr.next = p
  return instr
}

function decodeRoutine(mem: Uint8Array, addr: number, abbrevs: number): Routine | null {
  const nlocals = mem[addr]
  if (nlocals > 15) return null
  let p = addr + 1 + nlocals * 2
  const instrs: Instr[] = []
  let maxTarget = p
  for (let guard = 0; guard < 20000; guard++) {
    const ins = decodeInstr(mem, p, abbrevs)
    if (ins.name === '?') return null
    instrs.push(ins)
    const targets: number[] = []
    if (ins.branch && typeof ins.branch.target === 'number') targets.push(ins.branch.target)
    if (ins.jump !== undefined) targets.push(ins.jump)
    for (const t of targets) if (t > maxTarget) maxTarget = t
    p = ins.next
    if (TERMINAL.has(ins.name) && p > maxTarget) {
      return { addr, nlocals, instrs, end: p }
    }
  }
  return null
}

export function analyzeStory(mem: Uint8Array): StoryAnalysis {
  const abbrevs = (mem[0x18] << 8) | mem[0x19]
  const initialPc = (mem[0x06] << 8) | mem[0x07]
  const fileLen = ((mem[0x1a] << 8) | mem[0x1b]) * 2
  const routines: Routine[] = []
  const routineAt = new Map<number, Routine>()

  // 1. Discover routines through the call graph, starting from the main routine.
  const known = new Set<number>()
  const queue = [initialPc - 1]
  while (queue.length) {
    const addr = queue.pop()!
    if (known.has(addr)) continue
    const r = decodeRoutine(mem, addr, abbrevs)
    if (!r) continue
    known.add(addr)
    for (const i of r.instrs) {
      if (i.name === 'call' && i.types[0] === 0 && i.operands[0] !== 0) queue.push(i.operands[0] * 2)
    }
  }
  // 2. Routines are contiguous: sweep from the lowest one to also catch routines that are
  //    only referenced from data (action properties, interrupts, tables).
  let p = Math.min(...known)
  let codeEnd = p
  const start = p
  while (p < fileLen) {
    const r = decodeRoutine(mem, p, abbrevs)
    if (!r) break
    routines.push(r)
    routineAt.set(r.addr, r)
    p = r.end
    if (p & 1) p++
    codeEnd = p
  }
  for (const k of known) {
    if (!routineAt.has(k)) throw new Error(`Routine ${k.toString(16)} missed by the sweep (swept ${start.toString(16)}-${codeEnd.toString(16)})`)
  }

  // Everything after the code is the string area.
  const strings = new Map<number, string>()
  let s = codeEnd
  while (s < fileLen - 1) {
    try {
      const d = decodeZString(mem, s, abbrevs)
      strings.set(s, d.text)
      s = d.end
      if (s & 1) s++
    } catch {
      break
    }
  }
  return { routines, routineAt, strings, codeStart: start, codeEnd }
}

const PRINTISH = new Set(['print', 'print_ret', 'new_line', 'print_obj', 'print_paddr', 'print_num', 'print_char', 'print_addr'])

export interface PrintGroup {
  addr: number
  end: number
  routine: number
  instrs: Instr[]
  /** English template, e.g. "The {0} burns and is consumed.\n" */
  en: string
  /** Kinds of the dynamic arguments, in order: o = object, n = number, c = char, s = string, w = word. */
  args: string[]
  /** True when the group ends with print_ret (returns true from the routine). */
  returns: boolean
}

/** All branch / jump targets of a routine. */
function targetsOf(r: Routine): Set<number> {
  const t = new Set<number>()
  for (const i of r.instrs) {
    if (i.branch && typeof i.branch.target === 'number') t.add(i.branch.target)
    if (i.jump !== undefined) t.add(i.jump)
  }
  return t
}

export function findPrintGroups(mem: Uint8Array, analysis: StoryAnalysis): PrintGroup[] {
  const abbrevs = (mem[0x18] << 8) | mem[0x19]
  const groups: PrintGroup[] = []
  for (const r of analysis.routines) {
    const targets = targetsOf(r)
    let cur: Instr[] = []
    const flush = () => {
      if (cur.length && cur.some((i) => i.name === 'print' || i.name === 'print_ret' || (i.name === 'print_paddr' && i.types[0] === 0))) {
        let en = ''
        const args: string[] = []
        for (const i of cur) {
          switch (i.name) {
            case 'print':
            case 'print_ret':
              en += i.text
              if (i.name === 'print_ret') en += '\n'
              break
            case 'new_line':
              en += '\n'
              break
            case 'print_paddr':
              if (i.types[0] === 0) en += decodeZString(mem, i.operands[0] * 2, abbrevs).text
              else {
                en += `{${args.length}}`
                args.push('s')
              }
              break
            case 'print_obj':
              en += `{${args.length}}`
              args.push('o')
              break
            case 'print_num':
              en += `{${args.length}}`
              args.push('n')
              break
            case 'print_char':
              if (i.types[0] !== 2) en += String.fromCharCode(i.operands[0])
              else {
                en += `{${args.length}}`
                args.push('c')
              }
              break
            case 'print_addr':
              en += `{${args.length}}`
              args.push('w')
              break
          }
        }
        const last = cur[cur.length - 1]
        groups.push({ addr: cur[0].addr, end: last.next, routine: r.addr, instrs: cur, en, args, returns: last.name === 'print_ret' })
      }
      cur = []
    }
    for (const i of r.instrs) {
      if (!PRINTISH.has(i.name)) {
        flush()
        continue
      }
      if (cur.length && targets.has(i.addr)) flush()
      // print_char with a constant operand inside text is fine; a group never spans a branch target.
      cur.push(i)
      if (i.name === 'print_ret') flush()
    }
    flush()
  }
  return groups
}
