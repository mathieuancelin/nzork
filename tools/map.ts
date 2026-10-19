// Prints the room map from the ZIL source: npx tsx tools/map.ts [--game zork2]
import { loadZil } from './zil/load'
import { atomName, type Node } from './zil/reader'
import { toolGame } from './game'
const DIRS = ['NORTH', 'EAST', 'WEST', 'SOUTH', 'NE', 'NW', 'SE', 'SW', 'UP', 'DOWN', 'IN', 'OUT', 'LAND', 'CROSS']
const show = (n: Node): string => (n.t === 'atom' ? n.v : n.t === 'str' ? '"msg"' : n.t === 'prefix' ? n.p + show(n.v) : n.t === 'form' ? `<${n.items.map(show).join(' ')}>` : '?')
for (const o of loadZil(toolGame()).objects.filter((x) => x.kind === 'ROOM')) {
  const exits: string[] = []
  for (const d of DIRS) {
    const v = o.props.get(d)
    if (!v) continue
    if (v[0]?.t === 'str') exits.push(`${d}:x`)
    else if (atomName(v[0]) === 'TO') exits.push(`${d}→${atomName(v[1])}${v.length > 2 ? '[' + v.slice(2).map(show).join(' ') + ']' : ''}`)
    else if (atomName(v[0]) === 'PER') exits.push(`${d}→PER ${atomName(v[1])}`)
    else exits.push(`${d}:${v.map(show).join(' ')}`)
  }
  console.log(`${o.name} (${o.desc}): ${exits.join(', ')}`)
}
