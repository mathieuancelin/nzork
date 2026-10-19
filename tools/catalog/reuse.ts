// Reuses the French translation of Zork I for the texts another game shares with it (parser,
// generic verbs, common objects): same English text, same arguments, and the same routine (or
// a complete sentence that has a single translation).
//   npx tsx tools/catalog/reuse.ts --game zork2
//   → src/engine/i18n/fr/<game>/parts/reused.json and the matching entries of objects.json
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { gamePaths, toolGame } from '../game'

const target = toolGame()
if (target === 'zork1') throw new Error('Zork I is the reference: choose another game with --game')
const from = gamePaths('zork1')
const to = gamePaths(target)
const read = (u: URL) => JSON.parse(readFileSync(u, 'utf8'))

const en1 = read(new URL('out/catalog.en.json', from.catalog))
const fr1 = read(new URL('catalog.json', from.french))
const en2 = read(new URL('out/catalog.en.json', to.catalog))

type Group = { en: string; args: string[]; routine: string }
const full = new Map<string, string>()
const byText = new Map<string, Set<string>>()
for (const [k, v] of Object.entries(en1.groups) as [string, Group][]) {
  const fr = fr1.groups[k]
  if (fr === undefined) continue
  full.set(`${v.en}|${v.args.join()}|${v.routine}`, fr)
  const t = `${v.en}|${v.args.join()}`
  if (!byText.has(t)) byText.set(t, new Set())
  byText.get(t)!.add(fr)
}
/** A whole sentence, not a fragment glued to others. */
const sentence = (s: string) => /^[A-Z"]/.test(s) && /[.!?]"?\n$/.test(s) && s.length > 20

const parts: Record<string, string> = {}
for (const [k, v] of Object.entries(en2.groups) as [string, Group][]) {
  const exact = full.get(`${v.en}|${v.args.join()}|${v.routine}`)
  const same = byText.get(`${v.en}|${v.args.join()}`)
  if (exact !== undefined) parts[k] = exact
  else if (same?.size === 1 && sentence(v.en)) parts[k] = [...same][0]
}
const strings1 = new Map<string, string>()
for (const [k, v] of Object.entries(en1.strings) as [string, { en: string }][]) if (fr1.strings[k] !== undefined) strings1.set(v.en, fr1.strings[k])
for (const [k, v] of Object.entries(en2.strings) as [string, { en: string; uses: string[] }][]) {
  if (v.uses.length && strings1.has(v.en)) parts[k] = strings1.get(v.en)!
}
mkdirSync(new URL('parts/', to.french), { recursive: true })
writeFileSync(new URL('parts/reused.json', to.french), JSON.stringify(parts, null, 1) + '\n')

// objects: the same ZIL object with the same short name; French words are kept only when their
// English word is still a synonym or an adjective of the object
type Obj = { en: string; name: string; synonyms: string[]; adjectives: string[] }
type FrObj = { nom: string; g: string; n?: string; mots?: Record<string, string>; adjectifs?: Record<string, string> }
const objects1 = new Map<string, FrObj>()
for (const [k, v] of Object.entries(en1.objects) as [string, Obj][]) if (fr1.objects[k]) objects1.set(`${v.name}|${v.en}`, fr1.objects[k])
const objectsFile = new URL('objects.json', to.french)
const objects: Record<string, FrObj> = existsSync(objectsFile) ? read(objectsFile) : {}
let reusedObjects = 0
for (const [k, v] of Object.entries(en2.objects) as [string, Obj][]) {
  const o = objects1.get(`${v.name}|${v.en}`)
  if (!o || objects[k]) continue
  const keep = (m: Record<string, string> | undefined, words: string[]) => Object.fromEntries(Object.entries(m ?? {}).filter(([, e]) => words.includes(e)))
  objects[k] = { ...o, mots: keep(o.mots, v.synonyms), adjectifs: keep(o.adjectifs, v.adjectives) }
  reusedObjects++
}
const sorted = Object.fromEntries(Object.entries(objects).sort(([a], [b]) => Number(a.slice(1)) - Number(b.slice(1))))
writeFileSync(objectsFile, JSON.stringify(sorted, null, 2) + '\n')
console.log({ groups: Object.keys(parts).filter((k) => k[0] === 'g').length, strings: Object.keys(parts).filter((k) => k[0] === 's').length, objects: reusedObjects })
