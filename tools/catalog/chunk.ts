// Splits the English catalog into work chunks for translation.
//   npx tsx tools/catalog/chunk.ts   → tools/catalog/work/*.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const en = JSON.parse(readFileSync(new URL('./out/catalog.en.json', import.meta.url), 'utf8'))
const out = new URL('./work/', import.meta.url)
mkdirSync(out, { recursive: true })

type Entry = Record<string, unknown> & { key: string; en: string }
const write = (name: string, entries: Entry[]) => {
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
split('groups', groups, 6)

// strings, except the fragments of combat messages (rewritten as whole sentences)
const meleeParts = new Set<string>()
for (const m of Object.values(en.melee) as { parts: (string | number)[] }[]) for (const p of m.parts) if (typeof p === 'string') meleeParts.add(p)
const strings: Entry[] = Object.entries(en.strings)
  .map(([key, v]) => ({ key, ...(v as object) }) as Entry)
  .filter((e) => (e.uses as string[]).length > 0)
  .filter((e) => !(meleeParts.has(e.en) && (e.uses as string[]).every((u) => u === 'table')))
split('strings', strings, 2)

// combat messages
write(
  'melee',
  Object.entries(en.melee).map(([key, v]) => {
    const { en: text, table } = v as { en: string; table: string }
    return { key, en: text, table }
  }),
)

// objects
write(
  'objects',
  Object.entries(en.objects).map(([key, v]) => ({ key, ...(v as object) }) as Entry),
)
