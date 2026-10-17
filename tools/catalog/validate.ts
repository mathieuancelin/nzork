// Checks French translation files against the English catalog.
//   npx tsx tools/catalog/validate.ts src/engine/i18n/fr/parts/groups-1.json [...]
// With no argument, checks every file of src/engine/i18n/fr/parts/ and objects.json.
import { readFileSync, readdirSync, existsSync } from 'node:fs'

const en = JSON.parse(readFileSync(new URL('./out/catalog.en.json', import.meta.url), 'utf8'))
const partsDir = new URL('../../src/engine/i18n/fr/parts/', import.meta.url)
const objectsFile = new URL('../../src/engine/i18n/fr/objects.json', import.meta.url)

const OBJ_FNS = new Set(['le', 'un', 'du', 'au', 'de', 'ce', 'il', 'lui', 'e', 'g'])
const PLACEHOLDER = /\{(?:([A-Za-z]+):)?([^}|:]*)((?:\|[^|}]*)*)\}/g
const lead = (s: string) => s.match(/^\n*/)![0].length
const trail = (s: string) => s.match(/\n*$/)![0].length

let errors = 0
const err = (file: string, key: string, msg: string) => {
  errors++
  console.log(`${file} ${key}: ${msg}`)
}

function checkText(file: string, key: string, fr: unknown) {
  if (typeof fr !== 'string') return err(file, key, 'not a string')
  const kind = key[0]
  const src = kind === 'g' ? en.groups[key] : kind === 's' ? en.strings[key] : kind === 'm' ? en.melee[key] : undefined
  if (!src) return err(file, key, 'unknown key')
  const english: string = src.en
  if (lead(fr) !== lead(english) || trail(fr) !== trail(english)) err(file, key, `newlines differ (start ${lead(english)}→${lead(fr)}, end ${trail(english)}→${trail(fr)})`)
  if (fr.trim() === '' && english.trim() !== '') err(file, key, 'empty translation')
  const args: string[] = src.args ?? []
  const used = new Set<string>()
  for (const m of fr.matchAll(PLACEHOLDER)) {
    const [whole, fnRaw, ref] = m
    const fn = fnRaw?.toLowerCase()
    if (kind === 'm') {
      if (!['wep', 'def', '-', '+'].includes(ref)) err(file, key, `bad reference ${whole}`)
      if (fn && !OBJ_FNS.has(fn)) err(file, key, `bad function ${whole}`)
      used.add(ref)
      continue
    }
    if (ref === '+' || ref === '-') {
      if (fn && !OBJ_FNS.has(fn)) err(file, key, `bad function ${whole}`)
      continue
    }
    const idx = Number(ref)
    if (!/^\d+$/.test(ref) || idx >= args.length) {
      err(file, key, `bad reference ${whole} (args: ${args.join(',') || 'none'})`)
      continue
    }
    used.add(ref)
    const a = args[idx]
    if (fn) {
      if (a === 'o' && !OBJ_FNS.has(fn)) err(file, key, `function ${fn} not valid for an object in ${whole}`)
      if (a === 'n' && fn !== 's') err(file, key, `function ${fn} not valid for a number in ${whole}`)
      if (a !== 'o' && a !== 'n') err(file, key, `no function allowed on ${a} in ${whole}`)
    }
  }
  if (kind !== 'm') {
    args.forEach((a, i) => {
      if (!used.has(String(i))) err(file, key, `argument {${i}} (${a}) is never used`)
    })
  } else {
    for (const r of ['wep', 'def']) if (english.includes(`{${r}}`) && !used.has(r)) err(file, key, `{${r}} is never used`)
  }
}

function checkPart(path: URL | string, name: string) {
  const data = JSON.parse(readFileSync(path, 'utf8'))
  for (const [key, fr] of Object.entries(data)) checkText(name, key, fr)
  return Object.keys(data).length
}

function checkObjects() {
  if (!existsSync(objectsFile)) return 0
  const data = JSON.parse(readFileSync(objectsFile, 'utf8'))
  for (const [key, o] of Object.entries(data) as [string, Record<string, unknown>][]) {
    if (!en.objects[key]) err('objects', key, 'unknown key')
    if (typeof o.nom !== 'string') err('objects', key, 'missing nom')
    if (o.g !== 'm' && o.g !== 'f') err('objects', key, 'g must be m or f')
    if (o.n !== undefined && o.n !== 's' && o.n !== 'p') err('objects', key, 'n must be s or p')
  }
  const missing = Object.keys(en.objects).filter((k) => !data[k])
  if (missing.length) err('objects', '-', `missing ${missing.length} objects: ${missing.slice(0, 10).join(' ')}`)
  return Object.keys(data).length
}

/** Keys of the English catalog that have no translation at all (whole-catalog check only). */
function checkMissing() {
  const done = new Set<string>()
  if (existsSync(partsDir)) for (const f of readdirSync(partsDir).filter((x) => x.endsWith('.json'))) for (const k of Object.keys(JSON.parse(readFileSync(new URL(f, partsDir), 'utf8')))) done.add(k)
  // strings only used as fragments of combat messages are replaced by whole sentences (m… keys)
  const meleeParts = new Set<string>()
  for (const m of Object.values(en.melee) as { parts: (string | number)[] }[]) for (const p of m.parts) if (typeof p === 'string') meleeParts.add(p)
  const missing: string[] = []
  for (const k of Object.keys(en.groups)) if (!done.has(k)) missing.push(k)
  for (const k of Object.keys(en.melee)) if (!done.has(k)) missing.push(k)
  for (const [k, v] of Object.entries(en.strings) as [string, { en: string; uses: string[] }][]) {
    if (done.has(k) || !v.uses.length) continue
    if (meleeParts.has(v.en) && v.uses.every((u) => u === 'table')) continue
    missing.push(k)
  }
  if (missing.length) err('catalog', '-', `${missing.length} untranslated key(s): ${missing.slice(0, 15).join(' ')}`)
}

const files = process.argv.slice(2)
let count = 0
if (files.length) {
  for (const f of files) count += f.endsWith('objects.json') ? checkObjects() : checkPart(f, f.split('/').pop()!)
} else {
  if (existsSync(partsDir)) for (const f of readdirSync(partsDir).filter((x) => x.endsWith('.json'))) count += checkPart(new URL(f, partsDir), f)
  count += checkObjects()
  checkMissing()
}
console.log(errors ? `${errors} error(s) in ${count} entries` : `OK: ${count} entries`)
process.exit(errors ? 1 : 0)
