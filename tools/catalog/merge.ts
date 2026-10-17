// Merges the French translation files into src/engine/i18n/fr/catalog.json.
//   npx tsx tools/catalog/merge.ts
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'

const dir = new URL('../../src/engine/i18n/fr/', import.meta.url)
const parts = new URL('parts/', dir)
const catalog = { groups: {} as Record<string, string>, strings: {} as Record<string, string>, melee: {} as Record<string, string>, objects: {} as Record<string, unknown> }
for (const f of readdirSync(parts).filter((x) => x.endsWith('.json')).sort()) {
  const data = JSON.parse(readFileSync(new URL(f, parts), 'utf8')) as Record<string, string>
  for (const [k, v] of Object.entries(data)) {
    const target = k[0] === 'g' ? catalog.groups : k[0] === 's' ? catalog.strings : k[0] === 'm' ? catalog.melee : null
    if (!target) throw new Error(`${f}: unexpected key ${k}`)
    target[k] = v
  }
}
const objectsFile = new URL('objects.json', dir)
if (existsSync(objectsFile)) catalog.objects = JSON.parse(readFileSync(objectsFile, 'utf8'))
writeFileSync(new URL('catalog.json', dir), JSON.stringify(catalog, null, 1) + '\n')
console.log({ groups: Object.keys(catalog.groups).length, strings: Object.keys(catalog.strings).length, melee: Object.keys(catalog.melee).length, objects: Object.keys(catalog.objects).length })
