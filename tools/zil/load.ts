// Loads the Zork I ZIL sources in compilation order, resolving the compile-time conditionals
// for ZORK-NUMBER = 1 (and a production build, where PREDGEN is assigned).

import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { readZil, isForm, atomName, walk, zilText, type Node } from './reader'

// the historical sources are a git submodule (github.com/historicalsource/zork1)
const SOURCE_DIR = new URL('../../vendor/zork1/', import.meta.url)
const ORDER = ['gmacros', 'gsyntax', '1dungeon', 'gglobals', 'gclock', 'gmain', 'gparser', 'gverbs', '1actions']

export interface ZilRoutine {
  name: string
  file: string
  line: number
  node: Extract<Node, { t: 'form' }>
  /** String literals printed or used by the routine, in source order (normalised). */
  strings: string[]
}

export interface ZilObject {
  name: string
  kind: 'OBJECT' | 'ROOM'
  file: string
  line: number
  props: Map<string, Node[]>
  flags: string[]
  loc?: string
  desc?: string
}

export interface ZilProgram {
  routines: ZilRoutine[]
  objects: ZilObject[]
  globals: { name: string; init: Node | undefined; line: number; file: string }[]
  constants: Map<string, Node | undefined>
  topForms: Node[]
}

function cteTest(n: Node): boolean {
  if (n.t === 'atom') return n.v === 'T' || n.v === 'ELSE'
  if (isForm(n, '==?') || isForm(n, 'N==?')) {
    const a = n.items[1]
    const b = n.items[2]
    const isZn = a.t === 'prefix' && atomName(a.v) === 'ZORK-NUMBER'
    if (isZn && b.t === 'num') return isForm(n, '==?') ? b.v === 1 : b.v !== 1
  }
  if (isForm(n, 'GASSIGNED?')) return ['PREDGEN', 'ZILCH'].includes(atomName(n.items[1]) ?? '')
  return false
}

const unquote = (n: Node): Node => (n.t === 'prefix' && n.p === "'" ? n.v : n)

/** Evaluates a compile-time COND and returns the selected forms (unquoted). */
function selectCond(cond: Extract<Node, { t: 'form' }>): Node[] {
  for (const clause of cond.items.slice(1)) {
    if (clause.t !== 'list') continue
    if (cteTest(clause.items[0])) return clause.items.slice(1).map(unquote)
  }
  return []
}

/** Replaces %<COND ...> occurrences inside code with their selected branch. */
export function expandCte(n: Node): Node[] {
  if (n.t === 'prefix' && n.p === '%' && isForm(n.v, 'COND')) {
    return selectCond(n.v).flatMap(expandCte)
  }
  if (n.t === 'form' || n.t === 'list') {
    return [{ ...n, items: n.items.flatMap(expandCte) }]
  }
  if (n.t === 'prefix') {
    const inner = expandCte(n.v)
    return inner.length === 1 ? [{ ...n, v: inner[0] }] : inner
  }
  return [n]
}

function topLevel(nodes: Node[], out: Node[]): void {
  for (const n of nodes) {
    if (n.t === 'prefix' && n.p === '%' && isForm(n.v, 'COND')) topLevel(selectCond(n.v), out)
    else if (isForm(n, 'COND')) topLevel(selectCond(n), out)
    else if (isForm(n, 'PROG')) topLevel((n as Extract<Node, { t: 'form' }>).items.slice(2), out)
    else out.push(n)
  }
}

export function loadZil(): ZilProgram {
  if (!existsSync(new URL('zork1.zil', SOURCE_DIR))) {
    throw new Error(`ZIL sources not found in ${fileURLToPath(SOURCE_DIR)}: run "git submodule update --init"`)
  }
  const topForms: Node[] = []
  for (const f of ORDER) {
    const src = readFileSync(new URL(`${f}.zil`, SOURCE_DIR), 'latin1')
    topLevel(readZil(src, f), topForms)
  }
  const routines: ZilRoutine[] = []
  const objects: ZilObject[] = []
  const globals: ZilProgram['globals'] = []
  const constants = new Map<string, Node | undefined>()
  for (const raw of topForms) {
    const [n] = expandCte(raw)
    if (!n || n.t !== 'form') continue
    const head = atomName(n.items[0])
    if (head === 'ROUTINE') {
      const strings: string[] = []
      walk(n, (c) => {
        if (c.t === 'str') strings.push(zilText(c.v))
      })
      routines.push({ name: atomName(n.items[1])!, file: n.file, line: n.line, node: n, strings })
    } else if (head === 'OBJECT' || head === 'ROOM') {
      const props = new Map<string, Node[]>()
      let flags: string[] = []
      let loc: string | undefined
      let desc: string | undefined
      for (const p of n.items.slice(2)) {
        if (p.t !== 'list') continue
        const pn = atomName(p.items[0])
        if (!pn) continue
        props.set(pn, p.items.slice(1))
        if (pn === 'FLAGS') flags = p.items.slice(1).map((x) => atomName(x)!).filter(Boolean)
        if ((pn === 'IN' || pn === 'LOC') && p.items.length === 2) loc = atomName(p.items[1])
        if (pn === 'DESC' && p.items[1]?.t === 'str') desc = zilText(p.items[1].v)
      }
      objects.push({ name: atomName(n.items[1])!, kind: head, file: n.file, line: n.line, props, flags, loc, desc })
    } else if (head === 'GLOBAL') {
      globals.push({ name: atomName(n.items[1])!, init: n.items[2], line: n.line, file: n.file })
    } else if (head === 'CONSTANT') {
      constants.set(atomName(n.items[1])!, n.items[2])
    }
  }
  return { routines, objects, globals, constants, topForms }
}
