// Builds src/engine/story/<game>/symbols.json: names of routines, objects, attributes,
// properties and globals of the compiled story, recovered by matching the ZIL source with the
// story file.
//
//   npx tsx tools/symbols/build.ts [--game zork2] [--out file.json]

import { writeFileSync } from 'node:fs'
import { loadZil, type ZilObject } from '../zil/load'
import { analyzeStory } from '../../src/engine/zmachine/disasm'
import { decodeZString } from '../../src/engine/zmachine/text'
import { alignRoutines, storyRoutineStrings } from './align'
import { walk, atomName, isForm, zilText, type Node } from '../zil/reader'
import { gamePaths, readStory, toolGame } from '../game'

const gameId = toolGame()
const outArg = process.argv.indexOf('--out')
const outFile = outArg >= 0 ? process.argv[outArg + 1] : gamePaths(gameId).symbols
const mem = readStory(gameId)
const w = (a: number) => (mem[a] << 8) | mem[a + 1]
const abbrevs = w(0x18)
const objTable = w(0x0a)
const analysis = analyzeStory(mem)
const zil = loadZil(gameId)

// ------------------------------------------------------------------ routines
const storyStrings = analysis.routines.map((r) => storyRoutineStrings(mem, r, analysis.strings))
const routineByAddr = alignRoutines(zil.routines, analysis.routines, storyStrings)
const routines: Record<string, number> = {}
for (const [addr, name] of routineByAddr) routines[name] = addr

// ------------------------------------------------------------------ objects
// the <DIRECTIONS ...> declaration of the dungeon file (Zork II and III add CROSS)
const DIRECTIONS = (() => {
  const d = zil.topForms.find((n) => isForm(n, 'DIRECTIONS'))
  return d && d.t === 'form' ? d.items.slice(1).map((x) => atomName(x)!).filter(Boolean) : []
})()
if (!DIRECTIONS.length) throw new Error('no DIRECTIONS declaration in the sources')
const objAddr = (o: number) => objTable + 62 + (o - 1) * 9
const firstPropTable = w(objAddr(1) + 7)
const objectCount = (firstPropTable - objTable - 62) / 9
const zObj = (o: number) => {
  const a = objAddr(o)
  const pt = w(a + 7)
  const name = mem[pt] ? decodeZString(mem, pt + 1, abbrevs).text : ''
  const attrs: number[] = []
  for (let k = 0; k < 32; k++) if (mem[a + (k >> 3)] & (0x80 >> (k & 7))) attrs.push(k)
  const props = new Map<number, number[]>()
  let p = pt + 1 + mem[pt] * 2
  while (mem[p]) {
    const num = mem[p] & 0x1f
    const len = (mem[p] >> 5) + 1
    props.set(num, Array.from(mem.subarray(p + 1, p + 1 + len)))
    p += 1 + len
  }
  return { num: o, name, parent: mem[a + 4], attrs, props }
}
const zObjects = Array.from({ length: objectCount }, (_, i) => zObj(i + 1))

// Candidate ZIL objects for each story object: same short name.
const zilByDesc = new Map<string, ZilObject[]>()
for (const o of zil.objects) {
  const d = o.desc ?? ''
  if (!zilByDesc.has(d)) zilByDesc.set(d, [])
  zilByDesc.get(d)!.push(o)
}
const objects: Record<string, number> = {}
const objName = new Map<number, string>()
// First pass: unique names.
for (const z of zObjects) {
  const c = zilByDesc.get(z.name) ?? []
  if (c.length === 1) {
    objects[c[0].name] = z.num
    objName.set(z.num, c[0].name)
  }
}
// Second pass: disambiguate same-named objects by their parent and children.
const zilChildren = new Map<string, Set<string>>()
for (const o of zil.objects) {
  if (!o.loc) continue
  if (!zilChildren.has(o.loc)) zilChildren.set(o.loc, new Set())
  zilChildren.get(o.loc)!.add(o.name)
}
const zChildren = (num: number) => zObjects.filter((x) => x.parent === num).map((x) => x.num)
for (let pass = 0; pass < 12; pass++) {
  for (const z of zObjects) {
    if (objName.has(z.num)) continue
    const used = new Set(Object.keys(objects))
    const c = (zilByDesc.get(z.name) ?? []).filter((o) => !used.has(o.name))
    if (!c.length) continue
    const scored = c.map((o) => {
      let score = 0
      const parentName = objName.get(z.parent)
      if (z.parent === 0 && !o.loc) score += 2
      if (parentName && o.loc === parentName) score += 2
      const kids = zilChildren.get(o.name) ?? new Set()
      for (const k of zChildren(z.num)) {
        const kn = objName.get(k)
        if (kn && kids.has(kn)) score += 1
      }
      // objects of the same name (Zork III's two wooden doors): the number of adjectives is
      // the length of the ADJECTIVE property (one byte each); 2 and 4 are left aside, as they
      // could as well be a word or two
      const adjectives = (o.props.get('ADJECTIVE') ?? []).length
      if (o.kind !== 'ROOM' && adjectives && adjectives !== 2 && adjectives !== 4) {
        score += [...z.props.values()].some((v) => v.length === adjectives) ? 1 : -1
      }
      // rooms: compare the exits (direction property → destination room)
      if (o.kind === 'ROOM') {
        DIRECTIONS.forEach((d, i) => {
          const v = o.props.get(d)
          const zv = z.props.get(31 - i)
          if (!v || !zv) {
            if (!!v !== !!zv) score -= 1
            return
          }
          if (atomName(v[0]) === 'TO') {
            const dest = atomName(v[1])
            const destNum = dest ? objects[dest] : undefined
            if (destNum !== undefined) score += zv[0] === destNum ? 3 : -3
          }
        })
      }
      // rooms with the same name and the same exits (Zork III's two "Narrow Room"): the exits
      // of the other rooms that lead to them tell them apart
      if (o.kind === 'ROOM') {
        for (const src of zil.objects) {
          if (src.kind !== 'ROOM' || objects[src.name] === undefined) continue
          DIRECTIONS.forEach((d, i) => {
            const v = src.props.get(d)
            if (!v || atomName(v[0]) !== 'TO' || atomName(v[1]) !== o.name) return
            const zv = zObjects[objects[src.name] - 1].props.get(31 - i)
            if (zv) score += zv[0] === z.num ? 3 : -3
          })
        }
      }
      return { o, score }
    })
    scored.sort((a, b) => b.score - a.score)
    const unique = scored.length === 1 || scored[0].score > scored[1].score
    if (unique || pass === 11) {
      objects[scored[0].o.name] = z.num
      objName.set(z.num, scored[0].o.name)
    }
  }
}

// ------------------------------------------------------------------ attributes
// For each flag, the set of objects that have it in the source; for each attribute, the set
// of story objects that have it initially. Equal sets give the attribute number.
const flagSets = new Map<string, Set<string>>()
for (const o of zil.objects) for (const f of o.flags) {
  if (!flagSets.has(f)) flagSets.set(f, new Set())
  flagSets.get(f)!.add(o.name)
}
const attrSets = new Map<number, Set<string>>()
for (const z of zObjects) for (const k of z.attrs) {
  if (!attrSets.has(k)) attrSets.set(k, new Set())
  const n = objName.get(z.num)
  if (n) attrSets.get(k)!.add(n)
}
const attributes: Record<string, number> = {}
const sameSet = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x))
for (const [flag, set] of flagSets) {
  const ks = [...attrSets].filter(([, s]) => sameSet(s, set)).map(([k]) => k)
  if (ks.length === 1) attributes[flag] = ks[0]
}
// Flags never set initially (or ambiguous): match FSET/FCLEAR/FSET? forms in aligned routines
// with the attribute instructions, in order.
const ATTR_OPS: Record<string, string> = { FSET: 'set_attr', FCLEAR: 'clear_attr', 'FSET?': 'test_attr' }
const votes = new Map<string, Map<number, number>>()
for (const r of analysis.routines) {
  const name = routineByAddr.get(r.addr)
  const zr = zil.routines.find((x) => x.name === name)
  if (!zr) continue
  for (const op of Object.keys(ATTR_OPS)) {
    const flags: string[] = []
    walk(zr.node, (n) => {
      if (isForm(n, op)) {
        const f = n.items[2]
        if (f?.t === 'prefix' && f.p === ',') flags.push(atomName(f.v) ?? '')
      }
    })
    const attrs = r.instrs.filter((i) => i.name === ATTR_OPS[op] && i.types[1] === 1).map((i) => i.operands[1])
    if (flags.length !== attrs.length) continue
    flags.forEach((f, k) => {
      if (!votes.has(f)) votes.set(f, new Map())
      const m = votes.get(f)!
      m.set(attrs[k], (m.get(attrs[k]) ?? 0) + 1)
    })
  }
}
for (const [flag, m] of votes) {
  if (attributes[flag] !== undefined) continue
  const best = [...m].sort((a, b) => b[1] - a[1])[0]
  if (best) attributes[flag] = best[0]
}

// ------------------------------------------------------------------ properties
// Same idea: the set of objects defining a property in the source vs in the story.
const propSets = new Map<string, Set<string>>()
const SPECIAL = new Set(['IN', 'LOC', 'DESC', 'FLAGS'])
for (const o of zil.objects) for (const [p] of o.props) {
  if (SPECIAL.has(p)) continue
  if (!propSets.has(p)) propSets.set(p, new Set())
  propSets.get(p)!.add(o.name)
}
const zPropSets = new Map<number, Set<string>>()
for (const z of zObjects) for (const [k] of z.props) {
  if (!zPropSets.has(k)) zPropSets.set(k, new Set())
  const n = objName.get(z.num)
  if (n) zPropSets.get(k)!.add(n)
}
const properties: Record<string, number> = {}
const jac = (a: Set<string>, b: Set<string>) => {
  let c = 0
  for (const x of a) if (b.has(x)) c++
  return c / (a.size + b.size - c || 1)
}
{
  const pp: { p: string; k: number; s: number }[] = []
  for (const [p, set] of propSets) for (const [k, zs] of zPropSets) pp.push({ p, k, s: jac(set, zs) })
  pp.sort((a, b) => b.s - a.s)
  const taken = new Set<number>()
  for (const { p, k, s } of pp) {
    if (s < 0.5 || properties[p] !== undefined || taken.has(k)) continue
    properties[p] = k
    taken.add(k)
  }
}

// Directions are numbered downwards from 31 in the order of the DIRECTIONS declaration.
DIRECTIONS.forEach((d, i) => {
  if (properties[d] !== undefined && properties[d] !== 31 - i) throw new Error(`direction ${d} mismatch`)
  properties[d] = 31 - i
})

// ------------------------------------------------------------------ globals
// For each story global, the set of routines that use it; for each ZIL global, the set of
// routines that mention it. The best Jaccard match wins.
const zGlobalUse = new Map<number, Set<string>>()
for (const r of analysis.routines) {
  const name = routineByAddr.get(r.addr)
  if (!name) continue
  const add = (v: number) => {
    if (v < 16) return
    if (!zGlobalUse.has(v - 16)) zGlobalUse.set(v - 16, new Set())
    zGlobalUse.get(v - 16)!.add(name)
  }
  for (const i of r.instrs) {
    i.types.forEach((t, k) => {
      if (t === 2) add(i.operands[k])
    })
    // indirect variable operands (store, inc, dec, inc_chk, dec_chk, load, pull)
    if (['store', 'inc', 'dec', 'inc_chk', 'dec_chk', 'load', 'pull'].includes(i.name) && i.types[0] === 1) add(i.operands[0])
    if (i.store !== undefined) add(i.store)
  }
}
const gNames = new Set(zil.globals.map((g) => g.name))
const zilGlobalUse = new Map<string, Set<string>>()
for (const r of zil.routines) {
  walk(r.node, (n) => {
    let name: string | undefined
    if (n.t === 'prefix' && n.p === ',') name = atomName(n.v)
    if (isForm(n, 'SETG')) name = atomName(n.items[1])
    // macros that expand to global references
    const MACRO_GLOBALS: Record<string, string> = { 'VERB?': 'PRSA', 'PRSO?': 'PRSO', 'PRSI?': 'PRSI', 'ROOM?': 'HERE' }
    if (n.t === 'form' && MACRO_GLOBALS[atomName(n.items[0]) ?? '']) name = MACRO_GLOBALS[atomName(n.items[0])!]
    if (name && gNames.has(name)) {
      if (!zilGlobalUse.has(name)) zilGlobalUse.set(name, new Set())
      zilGlobalUse.get(name)!.add(r.name)
    }
  })
}
const globals: Record<string, number> = {}
const jaccard = (a: Set<string>, b: Set<string>) => {
  let c = 0
  for (const x of a) if (b.has(x)) c++
  return c / (a.size + b.size - c || 1)
}
const pairs: { g: string; k: number; s: number }[] = []
for (const [g, use] of zilGlobalUse) for (const [k, zuse] of zGlobalUse) {
  const s = jaccard(use, zuse)
  if (s > 0.3) pairs.push({ g, k, s })
}
pairs.sort((a, b) => b.s - a.s)
const takenK = new Set<number>()
for (const { g, k } of pairs) {
  if (globals[g] !== undefined || takenK.has(k)) continue
  globals[g] = k
  takenK.add(k)
}

// ------------------------------------------------------------------ actions
// PERFORM reads PREACTIONS then ACTIONS with loadw on globals holding the table addresses.
const actions: Record<string, number> = {}
{
  const perform = analysis.routineAt.get(routines.PERFORM)!
  const globalsBase = w(0x0c)
  const tables = perform.instrs
    .filter((i) => i.name === 'loadw' && i.types[0] === 2 && i.operands[0] >= 16)
    .map((i) => w(globalsBase + 2 * (i.operands[0] - 16)))
  const actionsTable = tables[tables.length - 1]
  const byAddr = new Map(Object.entries(routines).map(([n, a]) => [a, n]))
  for (let k = 0; k < 256; k++) {
    const paddr = w(actionsTable + 2 * k)
    const name = byAddr.get(paddr * 2)
    if (!name) break
    const verb = name.replace(/^V-/, '')
    if (actions[verb] === undefined) actions[verb] = k
  }
}

// ------------------------------------------------------------------ words naming each object
// noun = first synonym; an adjective is added when another object shares the noun.
const words: Record<string, string> = {}
{
  const nounCount = new Map<string, number>()
  for (const o of zil.objects) {
    const syn = (o.props.get('SYNONYM') ?? []).map((x) => atomName(x)).filter(Boolean) as string[]
    for (const n of syn) nounCount.set(n, (nounCount.get(n) ?? 0) + 1)
  }
  for (const o of zil.objects) {
    const num = objects[o.name]
    const syn = (o.props.get('SYNONYM') ?? []).map((x) => atomName(x)).filter(Boolean) as string[]
    const adj = (o.props.get('ADJECTIVE') ?? []).map((x) => atomName(x)).filter(Boolean) as string[]
    if (!syn.length || num === undefined) continue
    // the first synonym, with an adjective when another object shares it
    const first = syn[0]
    const phrase = nounCount.get(first) === 1 ? first : adj.length ? `${adj[0]} ${first}` : (syn.find((n) => nounCount.get(n) === 1) ?? first)
    words[String(num)] = phrase.toLowerCase()
  }
}

// ------------------------------------------------------------------ report & write
const report = {
  objects: `${Object.keys(objects).length}/${objectCount}`,
  attributes: `${Object.keys(attributes).length}/${flagSets.size} flags`,
  properties: `${Object.keys(properties).length}/${propSets.size}`,
  globals: `${Object.keys(globals).length}/${zil.globals.length} (story uses ${zGlobalUse.size})`,
  routines: `${Object.keys(routines).length}/${analysis.routines.length}`,
  actions: Object.keys(actions).length,
}
console.log(report)
const parentMismatch = zObjects.filter((z) => {
  const n = objName.get(z.num)
  const o = zil.objects.find((x) => x.name === n)
  const zp = z.parent ? objName.get(z.parent) : undefined
  return o && (o.loc ?? undefined) !== zp && !(o.loc === 'ROOMS' && zp === 'ROOMS')
})
if (parentMismatch.length) console.log('parent mismatches:', parentMismatch.map((z) => `${z.num}:${objName.get(z.num)} in ${objName.get(z.parent)}`).join(', '))
// every "TO X" exit of the source must point to the right room in the story file
{
  let bad = 0
  for (const o of zil.objects.filter((x) => x.kind === 'ROOM')) {
    const z = zObjects[objects[o.name] - 1]
    DIRECTIONS.forEach((d, i) => {
      const v = o.props.get(d)
      if (!v || atomName(v[0]) !== 'TO') return
      const zv = z.props.get(31 - i)
      if (!zv || zv[0] !== objects[atomName(v[1])!]) {
        bad++
        console.log(`exit mismatch: ${o.name} ${d} → ${atomName(v[1])}`)
      }
    })
  }
  console.log(bad ? `${bad} exit mismatches` : 'all room exits consistent')
}
const unmatchedObjects = zObjects.filter((z) => !objName.has(z.num)).map((z) => `${z.num}:${z.name}`)
if (unmatchedObjects.length) console.log('unmatched objects:', unmatchedObjects.join(', '))
const missingFlags = [...flagSets.keys(), ...votes.keys()].filter((f) => attributes[f] === undefined)
if (missingFlags.length) console.log('unmatched flags:', [...new Set(missingFlags)].join(' '))
console.log('unmatched globals:', zil.globals.map((g) => g.name).filter((g) => globals[g] === undefined).join(' '))
console.log('unmatched props:', [...propSets.keys()].filter((p) => properties[p] === undefined).join(' '))

const sortObj = <T>(o: Record<string, T>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)))
writeFileSync(
  outFile,
  JSON.stringify(
    {
      routines: sortObj(routines),
      objects: sortObj(objects),
      attributes: sortObj(attributes),
      properties: sortObj(properties),
      globals: sortObj(globals),
      actions: sortObj(actions),
      words,
    },
    null,
    1,
  ) + '\n',
)

// keep unused imports meaningful for future use
void zilText
void (null as unknown as Node)
