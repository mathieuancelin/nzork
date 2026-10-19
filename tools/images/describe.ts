// Gathers the original English descriptions of the rooms of each scene, or of the objects that
// can be taken (to write prompts), for Zork I or, with --game zork2, another game.
//   npx tsx tools/images/describe.ts [--game zork2]          → <dir>/scene-descriptions.json
//   npx tsx tools/images/describe.ts [--game zork2] --items  → <dir>/item-descriptions.json
// (<dir> is tools/images/ for Zork I, tools/images/<game>/ for the others.) The rooms are grouped
// by the scenes of src/data/<game>/scenes.json; a room without a scene gets its own entry. With
// --items, the objects of src/data/<game>/items.json, then every other object that can be taken.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadZil } from '../zil/load'
import { atomName } from '../zil/reader'
import { gamePaths } from '../game'
import { ensureDir, gameDir, gameFromArgs } from './lib/common'

const game = gameFromArgs()
const paths = gamePaths(game)
const en = JSON.parse(readFileSync(new URL('out/catalog.en.json', paths.catalog), 'utf8'))
const readData = <T>(name: string, fallback: T): T => (existsSync(new URL(name, paths.data)) ? JSON.parse(readFileSync(new URL(name, paths.data), 'utf8')) : fallback)
const zil = loadZil(game)
const strings = Object.values(en.strings as Record<string, { en: string; uses: string[] }>)
const groups = Object.values(en.groups as Record<string, { en: string; routine: string }>)
const out = ensureDir(gameDir(game))
const prefix = game === 'zork1' ? '' : `${game}-`

if (process.argv.includes('--items')) {
  const listed = readData<{ items: { id: string; objects: string[] }[] }>('items.json', { items: [] }).items
  const covered = new Set(listed.flatMap((i) => i.objects))
  // every other object that can be taken gets an entry of its own
  const others = zil.objects.filter((o) => o.kind === 'OBJECT' && o.flags.includes('TAKEBIT') && !covered.has(o.name)).map((o) => ({ id: prefix + o.name.toLowerCase(), objects: [o.name] }))
  const items = [...listed, ...(game === 'zork1' ? [] : others)].map((it) => ({
    id: it.id,
    objects: it.objects.map((name) => {
      const o = zil.objects.find((x) => x.name === name)!
      const text = (prop: string) => strings.find((x) => x.uses.includes(`${name}.${prop}`))?.en
      const action = atomName(o.props.get('ACTION')?.[0])
      return {
        object: name,
        name: o.desc,
        flags: game === 'zork1' ? undefined : o.flags,
        firstSeen: text('FDESC'),
        lying: text('LDESC'),
        writing: text('TEXT'),
        routineTexts: action ? groups.filter((g) => g.routine === action).map((g) => g.en).join(' ') : undefined,
      }
    }),
  }))
  writeFileSync(join(out, 'item-descriptions.json'), JSON.stringify(items, null, 1) + '\n')
  console.log(items.length, 'items described')
  process.exit(0)
}

const scenes = readData<{ scenes: { id: string; rooms: string[] }[] }>('scenes.json', { scenes: [] }).scenes
const inScenes = new Set(scenes.flatMap((s) => s.rooms))
const alone = zil.objects.filter((o) => o.kind === 'ROOM' && !inScenes.has(o.name)).map((o) => ({ id: prefix + o.name.toLowerCase(), rooms: [o.name] }))
const described = [...scenes, ...(game === 'zork1' ? [] : alone)].map((s) => ({
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
writeFileSync(join(out, 'scene-descriptions.json'), JSON.stringify(described, null, 1) + '\n')
console.log(described.length, 'scenes,', described.filter((s) => s.rooms.every((r) => !r.description && !r.roomRoutineTexts)).map((s) => s.id).join(' ') || 'all described')
