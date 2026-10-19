// Extracts every translatable text of the story file, with its ZIL context:
//   - print groups (compiled TELLs), keyed g<hex address>
//   - data strings (descriptions, random messages...), keyed s<hex address>
//   - object short names, keyed o<object number>
//   - combat messages (REMARK tables), keyed m<hex table address>
//
//   npx tsx tools/catalog/extract.ts [--game zork2]   → tools/catalog/<game>/out/catalog.en.json

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { analyzeStory, findPrintGroups } from '../../src/engine/zmachine/disasm'
import { decodeZString } from '../../src/engine/zmachine/text'
import type { GameSymbols } from '../../src/engine/symbols'
import { loadZil } from '../zil/load'
import { walk, isForm, atomName, zilText, type Node } from '../zil/reader'
import { gamePaths, readStory, toolGame } from '../game'

const gameId = toolGame()
const paths = gamePaths(gameId)
const sym = JSON.parse(readFileSync(paths.symbols, 'utf8')) as GameSymbols
const mem = readStory(gameId)
const w = (a: number) => (mem[a] << 8) | mem[a + 1]
const abbrevs = w(0x18)
const analysis = analyzeStory(mem)
const groups = findPrintGroups(mem, analysis)
const zil = loadZil(gameId)
const routineName = new Map(Object.entries(sym.routines).map(([n, a]) => [a as number, n]))
const objectName = new Map(Object.entries(sym.objects).map(([n, o]) => [o as number, n]))
const hex = (n: number) => n.toString(16)
const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

// ------------------------------------------------------------------ ZIL source printer
function print(n: Node): string {
  switch (n.t) {
    case 'form':
      return `<${n.items.map(print).join(' ')}>`
    case 'list':
      return `(${n.items.map(print).join(' ')})`
    case 'str':
      return JSON.stringify(zilText(n.v))
    case 'atom':
      return n.v
    case 'num':
      return String(n.v)
    case 'char':
      return `!\\${n.v}`
    case 'prefix':
      return n.p + print(n.v)
  }
}

/** Finds the TELL forms of a routine whose literal texts contain `pieces`. */
function findTell(routine: string, pieces: string[]): string | undefined {
  const r = zil.routines.find((x) => x.name === routine)
  if (!r) return undefined
  let best: { score: number; text: string } | undefined
  walk(r.node, (n) => {
    if (!isForm(n, 'TELL')) return
    const lits = n.items.filter((x) => x.t === 'str').map((x) => norm(zilText((x as { v: string }).v)))
    const score = pieces.filter((p) => lits.includes(norm(p))).length
    if (score > 0 && (!best || score > best.score)) best = { score, text: print(n) }
  })
  return best?.text
}

// ------------------------------------------------------------------ groups
interface GroupEntry {
  en: string
  args: string[]
  routine: string
  zil?: string
}
const groupEntries: Record<string, GroupEntry> = {}
for (const g of groups) {
  const routine = routineName.get(g.routine) ?? hex(g.routine)
  const pieces = g.instrs.filter((i) => i.text).map((i) => i.text!)
  groupEntries[`g${hex(g.addr)}`] = { en: g.en, args: g.args, routine, zil: findTell(routine, pieces) }
}

// ------------------------------------------------------------------ strings and their uses
const uses = new Map<number, Set<string>>()
const addUse = (addr: number, u: string) => {
  if (!analysis.strings.has(addr)) return
  if (!uses.has(addr)) uses.set(addr, new Set())
  uses.get(addr)!.add(u)
}
// object properties
const objTable = w(0x0a)
const props = sym.properties as Record<string, number>
const propName = new Map(Object.entries(props).map(([n, k]) => [k, n]))
for (const [name, num] of Object.entries(sym.objects)) {
  const pt = w(objTable + 62 + ((num as number) - 1) * 9 + 7)
  let p = pt + 1 + mem[pt] * 2
  while (mem[p]) {
    const k = mem[p] & 0x1f
    const len = (mem[p] >> 5) + 1
    if (len === 2) addUse(w(p + 1) * 2, `${name}.${propName.get(k) ?? k}`)
    p += 1 + len
  }
}
// constants in code
for (const r of analysis.routines) {
  const rn = routineName.get(r.addr) ?? hex(r.addr)
  for (const i of r.instrs) i.operands.forEach((v, k) => i.types[k] === 0 && addUse(v * 2, `routine ${rn}`))
}
// words in tables (everything before the code); Zork II and III do not align their tables on
// even addresses, so every byte offset is tried
for (let a = 0x40; a < analysis.codeStart; a++) addUse(w(a) * 2, 'table')

// ZIL location of a string literal
const zilStringLoc = new Map<string, string>()
for (const r of zil.routines) walk(r.node, (n) => n.t === 'str' && zilStringLoc.set(norm(zilText(n.v)), `${r.name} (${n.file}.zil:${n.line})`))
for (const o of zil.objects) for (const [p, vals] of o.props) for (const v of vals) if (v.t === 'str') zilStringLoc.set(norm(zilText(v.v)), `${o.name}.${p} (${o.file}.zil:${v.line})`)
for (const f of zil.topForms) walk(f, (n) => n.t === 'str' && !zilStringLoc.has(norm(zilText(n.v))) && zilStringLoc.set(norm(zilText(n.v)), `${n.file}.zil:${n.line}`))

interface StringEntry {
  en: string
  uses: string[]
  zil?: string
}
const stringEntries: Record<string, StringEntry> = {}
for (const [addr, text] of analysis.strings) {
  stringEntries[`s${hex(addr)}`] = { en: text, uses: [...(uses.get(addr) ?? [])], zil: zilStringLoc.get(norm(text)) }
}

// ------------------------------------------------------------------ objects
interface ObjectEntry {
  en: string
  name: string
  synonyms: string[]
  adjectives: string[]
  flags: string[]
  room: boolean
}
const objectEntries: Record<string, ObjectEntry> = {}
for (const [num, name] of [...objectName].sort((a, b) => a[0] - b[0])) {
  const pt = w(objTable + 62 + (num - 1) * 9 + 7)
  const en = mem[pt] ? decodeZString(mem, pt + 1, abbrevs).text : ''
  const zo = zil.objects.find((o) => o.name === name)
  const words = (p: string) => (zo?.props.get(p) ?? []).map((x) => atomName(x) ?? '').filter(Boolean)
  objectEntries[`o${num}`] = { en, name, synonyms: words('SYNONYM'), adjectives: words('ADJECTIVE'), flags: zo?.flags ?? [], room: zo?.kind === 'ROOM' }
}

// ------------------------------------------------------------------ combat messages (REMARK tables)
// HERO-MELEE and the villains' melee tables: TABLE of LTABLE (by result) of LTABLE (message parts).
// Parts are string packed addresses, or the markers F-WEP / F-DEF.
const constants = new Map<string, number>()
for (const [k, v] of zil.constants) if (v?.t === 'num') constants.set(k, v.v)
const F_WEP = constants.get('F-WEP') ?? 0
const F_DEF = constants.get('F-DEF') ?? 1
interface MeleeEntry {
  en: string
  parts: (string | number)[]
  table: string
}
const meleeEntries: Record<string, MeleeEntry> = {}
function addMeleeTable(name: string, addr: number, results: number) {
  for (let r = 0; r < results; r++) {
    const lt = w(addr + 2 * r)
    const n = w(lt)
    for (let k = 1; k <= n; k++) {
      const msg = w(lt + 2 * k)
      const len = w(msg)
      const parts: (string | number)[] = []
      let en = ''
      for (let j = 1; j <= len; j++) {
        const v = w(msg + 2 * j)
        if (v === F_WEP) {
          parts.push(F_WEP)
          en += '{wep}'
        } else if (v === F_DEF) {
          parts.push(F_DEF)
          en += '{def}'
        } else {
          const t = decodeZString(mem, v * 2, abbrevs).text
          parts.push(t)
          en += t
        }
      }
      meleeEntries[`m${hex(msg)}`] = { en, parts, table: `${name}[${r}]` }
    }
  }
}
const g = (n: string) => w(w(0x0c) + 2 * (sym.globals as Record<string, number>)[n])
// number of result rows: count LTABLEs in the ZIL definition
function meleeRows(name: string): number {
  const def = zil.globals.find((x) => x.name === name)
  const t = def?.init
  return t && isForm(t, 'TABLE') ? t.items.filter((x) => isForm(x, 'LTABLE')).length : 0
}
// only Zork I has the combat system with message tables (the fights of Zork II and III are
// written in the action routines)
if (sym.globals['HERO-MELEE'] !== undefined) addMeleeTable('HERO-MELEE', g('HERO-MELEE'), meleeRows('HERO-MELEE'))
// villain tables are referenced from VILLAINS: each entry is a table <villain weapon prob melee...>
if (sym.globals['VILLAINS'] !== undefined) {
  const villains = g('VILLAINS')
  const n = w(villains)
  const names = ['TROLL-MELEE', 'THIEF-MELEE', 'CYCLOPS-MELEE']
  for (let k = 1; k <= n; k++) {
    const vt = w(villains + 2 * k)
    const villain = objectName.get(w(vt))
    const melee = w(vt + 2 * 4)
    const tname = names.find((x) => x.startsWith(villain?.split('-')[0] ?? '?')) ?? `MELEE-${villain}`
    addMeleeTable(tname, melee, meleeRows(tname))
  }
}

// ------------------------------------------------------------------ write
const out = { groups: groupEntries, strings: stringEntries, objects: objectEntries, melee: meleeEntries }
mkdirSync(new URL('out/', paths.catalog), { recursive: true })
writeFileSync(new URL('out/catalog.en.json', paths.catalog), JSON.stringify(out, null, 1) + '\n')
console.log({
  groups: Object.keys(groupEntries).length,
  groupsWithZil: Object.values(groupEntries).filter((x) => x.zil).length,
  strings: Object.keys(stringEntries).length,
  stringsUnused: Object.values(stringEntries).filter((x) => !x.uses.length).length,
  objects: Object.keys(objectEntries).length,
  melee: Object.keys(meleeEntries).length,
  chars: [...Object.values(groupEntries), ...Object.values(stringEntries), ...Object.values(meleeEntries)].reduce((s, x) => s + x.en.length, 0),
})
