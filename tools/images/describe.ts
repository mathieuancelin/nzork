// Gathers the original English descriptions of the rooms of each scene, or of the objects
// (to write prompts).
//   npx tsx tools/images/describe.ts          → tools/images/scene-descriptions.json
//   npx tsx tools/images/describe.ts --items  → tools/images/item-descriptions.json
import { readFileSync, writeFileSync } from 'node:fs'
import { loadZil } from '../zil/load'
import { atomName } from '../zil/reader'

const en = JSON.parse(readFileSync(new URL('../catalog/out/catalog.en.json', import.meta.url), 'utf8'))
const scenes = JSON.parse(readFileSync(new URL('../../src/data/scenes.json', import.meta.url), 'utf8')).scenes as { id: string; rooms: string[] }[]
const zil = loadZil()
const strings = Object.values(en.strings as Record<string, { en: string; uses: string[] }>)
const groups = Object.values(en.groups as Record<string, { en: string; routine: string }>)

if (process.argv.includes('--items')) {
  const items = JSON.parse(readFileSync(new URL('../../src/data/items.json', import.meta.url), 'utf8')).items as { id: string; objects: string[] }[]
  const out = items.map((it) => ({
    id: it.id,
    objects: it.objects.map((name) => {
      const o = zil.objects.find((x) => x.name === name)!
      const text = (prop: string) => strings.find((x) => x.uses.includes(`${name}.${prop}`))?.en
      const action = atomName(o.props.get('ACTION')?.[0])
      return {
        object: name,
        name: o.desc,
        firstSeen: text('FDESC'),
        lying: text('LDESC'),
        writing: text('TEXT'),
        routineTexts: action ? groups.filter((g) => g.routine === action).map((g) => g.en).join(' ') : undefined,
      }
    }),
  }))
  writeFileSync(new URL('./item-descriptions.json', import.meta.url), JSON.stringify(out, null, 1) + '\n')
  console.log(out.length, 'items described')
  process.exit(0)
}

const out = scenes.map((s) => ({
  id: s.id,
  rooms: s.rooms.map((r) => {
    const room = zil.objects.find((o) => o.name === r)!
    const action = atomName(room.props.get('ACTION')?.[0])
    const ldesc = strings.find((x) => x.uses.includes(`${r}.LDESC`))?.en
    const look = action
      ? groups
          .filter((g) => g.routine === action)
          .map((g) => g.en)
          .join(' ')
      : undefined
    const objects = zil.objects.filter((o) => o.loc === r && o.kind === 'OBJECT').map((o) => o.desc)
    return { room: r, name: room.desc, description: ldesc, roomRoutineTexts: look, objects }
  }),
}))
writeFileSync(new URL('./scene-descriptions.json', import.meta.url), JSON.stringify(out, null, 1) + '\n')
console.log(out.length, 'scenes,', out.filter((s) => s.rooms.every((r) => !r.description && !r.roomRoutineTexts)).map((s) => s.id).join(' ') || 'all described')
