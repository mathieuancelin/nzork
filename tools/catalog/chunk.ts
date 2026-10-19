// Splits the English catalog into work chunks for translation, leaving out what is already
// translated (in src/engine/i18n/fr/<game>/parts/ and objects.json).
//   npx tsx tools/catalog/chunk.ts [--game zork2] [--groups 6] [--strings 2] [--objects 1]
//   → tools/catalog/<game>/work/*.json
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { gamePaths, toolGame } from '../game'

const paths = gamePaths(toolGame())
const en = JSON.parse(readFileSync(new URL('out/catalog.en.json', paths.catalog), 'utf8'))
const out = new URL('work/', paths.catalog)
mkdirSync(out, { recursive: true })
const count = (name: string, fallback: number) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? Number(process.argv[i + 1]) : fallback
}
const done = new Set<string>()
const partsDir = new URL('parts/', paths.french)
if (existsSync(partsDir)) for (const f of readdirSync(partsDir).filter((x) => x.endsWith('.json'))) for (const k of Object.keys(JSON.parse(readFileSync(new URL(f, partsDir), 'utf8')))) done.add(k)
const objectsFile = new URL('objects.json', paths.french)
if (existsSync(objectsFile)) for (const k of Object.keys(JSON.parse(readFileSync(objectsFile, 'utf8')))) done.add(k)
const todo = (e: Entry) => !done.has(e.key)

type Entry = Record<string, unknown> & { key: string; en: string }
const write = (name: string, entries: Entry[]) => {
  // batches already handed out are never overwritten: new ones take the next free number
  const [, base, n] = name.match(/^(.*?)(?:-(\d+))?$/)!
  for (let k = Number(n ?? 0); existsSync(new URL(`${name}.json`, out)); ) name = `${base}-${++k}`
  writeFileSync(new URL(`${name}.json`, out), JSON.stringify(entries, null, 1) + '\n')
  console.log(name, entries.length, 'entries', entries.reduce((s, e) => s + e.en.length, 0), 'chars')
}

function split(name: string, entries: Entry[], parts: number) {
  const total = entries.reduce((s, e) => s + e.en.length + 40, 0)
  const target = total / parts
  let cur: Entry[] = []
  let size = 0
  let k = 1
  for (const e of entries) {
    cur.push(e)
    size += e.en.length + 40
    if (size >= target && k < parts) {
      write(`${name}-${k++}`, cur)
      cur = []
      size = 0
    }
  }
  if (cur.length) write(`${name}-${k}`, cur)
}

// groups, in address order (≈ source order)
const groups: Entry[] = Object.entries(en.groups)
  .map(([key, v]) => ({ key, ...(v as object) }) as Entry)
  .sort((a, b) => parseInt(a.key.slice(1), 16) - parseInt(b.key.slice(1), 16))
  .filter(todo)
split('groups', groups, count('groups', 6))

// strings, except the fragments of combat messages (rewritten as whole sentences)
const meleeParts = new Set<string>()
for (const m of Object.values(en.melee) as { parts: (string | number)[] }[]) for (const p of m.parts) if (typeof p === 'string') meleeParts.add(p)
const strings: Entry[] = Object.entries(en.strings)
  .map(([key, v]) => ({ key, ...(v as object) }) as Entry)
  .filter((e) => (e.uses as string[]).length > 0)
  .filter((e) => !(meleeParts.has(e.en) && (e.uses as string[]).every((u) => u === 'table')))
  .filter(todo)
split('strings', strings, count('strings', 2))

// combat messages (Zork I only)
const melee = Object.entries(en.melee)
  .map(([key, v]) => {
    const { en: text, table } = v as { en: string; table: string }
    return { key, en: text, table }
  })
  .filter(todo)
if (melee.length) write('melee', melee)

// objects
split(
  'objects',
  Object.entries(en.objects)
    .map(([key, v]) => ({ key, ...(v as object) }) as Entry)
    .filter(todo),
  count('objects', 1),
)
