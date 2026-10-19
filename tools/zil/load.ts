// Loads the ZIL sources of a game in compilation order (the INSERT-FILE list of zork<n>.zil),
// resolving the compile-time conditionals for its ZORK-NUMBER (and a production build, where
// PREDGEN is assigned).

import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { readZil, isForm, atomName, walk, zilText, type Node } from './reader'
import { GAMES, type GameId } from '../../src/engine/games'

// the historical sources are git submodules (github.com/historicalsource/zork1, zork2, zork3)
const sourceDir = (id: GameId) => new URL(`../../vendor/${id}/`, import.meta.url)
const ORDER: Record<GameId, string[]> = {
  zork1: ['gmacros', 'gsyntax', '1dungeon', 'gglobals', 'gclock', 'gmain', 'gparser', 'gverbs', '1actions'],
  zork2: ['gmacros', 'gsyntax', '2dungeon', 'gglobals', 'gclock', 'gmain', 'gparser', 'gverbs', '2actions'],
  zork3: ['gsyntax', 'gmacros', 'gclock', 'gmain', 'gparser', '3dungeon', 'gglobals', 'gverbs', '3actions'],
}

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

/** ZORK-NUMBER of the game being loaded. */
let zorkNumber = 1

function cteTest(n: Node): boolean {
  if (n.t === 'atom') return n.v === 'T' || n.v === 'ELSE'
  if (isForm(n, '==?') || isForm(n, 'N==?')) {
    const a = n.items[1]
    const b = n.items[2]
    const isZn = a.t === 'prefix' && atomName(a.v) === 'ZORK-NUMBER'
    if (isZn && b.t === 'num') return isForm(n, '==?') ? b.v === zorkNumber : b.v !== zorkNumber
  }
  const head = n.t === 'form' ? atomName(n.items[0]) : undefined
  if (n.t === 'form' && head === 'OR') return n.items.slice(1).some(cteTest)
  if (n.t === 'form' && head === 'AND') return n.items.slice(1).every(cteTest)
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

export function loadZil(id: GameId = 'zork1'): ZilProgram {
  const dir = sourceDir(id)
  if (!existsSync(new URL(`${id}.zil`, dir))) {
    throw new Error(`ZIL sources not found in ${fileURLToPath(dir)}: run "git submodule update --init"`)
  }
  zorkNumber = GAMES[id].number
  const topForms: Node[] = []
  for (const f of ORDER[id]) {
    const src = readFileSync(new URL(`${f}.zil`, dir), 'latin1')
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
