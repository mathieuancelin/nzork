// Places the rooms of a game on a grid for the in-game map, from their exits (north up, east
// right):
//   npx tsx tools/map/layout.ts [--game zork2] [--png out.png]   → src/data/<game>/map.json
// A breadth-first placement from the first room, then simulated annealing that moves and swaps
// rooms so that exits point the right way and passages cross as little as possible. Rooms can
// be pinned by hand (PINS) where the geography of Zork is not a flat grid.
import { mkdirSync, writeFileSync } from 'node:fs'
import { World } from '../../src/engine/assist/world'
import { allRooms, exitsOf, type MapDir } from '../../src/engine/assist/map'
import { gamePaths, newGame, toolGame } from '../game'
import type { GameId } from '../../src/engine/games'

const gameId = toolGame()
const game = await newGame(gameId, 'en', 1)
game.start()
const w = new World(game)
/** Where the game starts: the first room placed. */
const START = w.here()

const VEC: Record<MapDir, [number, number] | null> = {
  NORTH: [0, -1], SOUTH: [0, 1], EAST: [1, 0], WEST: [-1, 0],
  NE: [1, -1], NW: [-1, -1], SE: [1, 1], SW: [-1, 1],
  UP: [0, -1], DOWN: [0, 1], IN: null, OUT: null, LAND: [1, 0],
}
const PRIORITY: MapDir[] = ['NORTH', 'SOUTH', 'EAST', 'WEST', 'NE', 'NW', 'SE', 'SW', 'UP', 'DOWN', 'LAND', 'IN', 'OUT']

/** Rooms placed by hand, relative to the first room (x right, y down). */
const PINS: Record<string, [number, number]> = {}

/**
 * Ways between rooms that no exit describes (an object or a routine takes the player there):
 * they only place the rooms next to each other, the map never draws them.
 */
const EXTRA: Record<GameId, { from: string; to: string; dir: MapDir }[]> = {
  zork1: [],
  zork2: [
    // the bucket of the well
    { from: 'WELL-TOP', to: 'WELL-BOTTOM', dir: 'DOWN' },
    // eating the cake in the Tea Room: the posts are the legs of the table
    { from: 'TEA-ROOM', to: 'POSTS-ROOM', dir: 'EAST' },
    // the balloon, up the volcano
    { from: 'VOLCANO-BOTTOM', to: 'VAIR-1', dir: 'UP' },
    { from: 'VAIR-1', to: 'VAIR-2', dir: 'UP' },
    { from: 'VAIR-2', to: 'VAIR-3', dir: 'UP' },
    { from: 'VAIR-3', to: 'VAIR-4', dir: 'UP' },
    { from: 'VOLCANO-VIEW', to: 'VAIR-3', dir: 'WEST' },
    // the walls of the bank, walked through behind the curtain of light (SCOL-ROOMS)
    { from: 'DEPOSITORY', to: 'SMALL-ROOM', dir: 'NORTH' },
    { from: 'DEPOSITORY', to: 'VAULT', dir: 'SOUTH' },
    // the robot's cage
    { from: 'CAGE-ROOM', to: 'IN-CAGE', dir: 'IN' },
    // where a dead adventurer wakes up
    { from: 'INSIDE-BARROW', to: 'DEAD-PALANTIR-1', dir: 'NORTH' },
  ],
  zork3: [],
}

const rooms = allRooms(w)
const edges: { from: string; to: string; dir: MapDir }[] = []
for (const r of rooms) for (const e of exitsOf(w, r)) if (e.to !== r && rooms.includes(e.to)) edges.push({ from: r, to: e.to, dir: e.dir })
edges.push(...EXTRA[gameId])

const pos = new Map<string, [number, number]>()
const taken = new Map<string, string>()
const key = (x: number, y: number) => `${x},${y}`
function place(room: string, x: number, y: number) {
  pos.set(room, [x, y])
  taken.set(key(x, y), room)
}
/** Nearest free cell to (x, y), searched in growing rings. */
function free(x: number, y: number): [number, number] {
  for (let r = 0; r < 30; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
        if (!taken.has(key(x + dx, y + dy))) return [x + dx, y + dy]
      }
  throw new Error('grid full')
}

// 1. breadth-first placement
for (const [r, p] of Object.entries(PINS)) place(r, p[0], p[1])
if (!pos.has(START)) place(START, 0, 0)
const queue = [...pos.keys()]
while (queue.length || pos.size < rooms.length) {
  if (!queue.length) {
    // an island: next to any placed neighbor, or apart
    const r = rooms.find((x) => !pos.has(x))!
    const link = edges.find((e) => (e.from === r && pos.has(e.to)) || (e.to === r && pos.has(e.from)))
    const anchor = link ? pos.get(link.from === r ? link.to : link.from)! : [0, 12]
    place(r, ...free(anchor[0] + 1, anchor[1] + 1))
    queue.push(r)
    continue
  }
  const room = queue.shift()!
  const [x, y] = pos.get(room)!
  const out = edges.filter((e) => e.from === room).sort((a, b) => PRIORITY.indexOf(a.dir) - PRIORITY.indexOf(b.dir))
  for (const e of out) {
    if (pos.has(e.to)) continue
    const v = VEC[e.dir] ?? [1, 1]
    place(e.to, ...free(x + v[0], y + v[1]))
    queue.push(e.to)
  }
}

// 2. simulated annealing: rooms move to free cells or swap places; the energy counts how badly
// each exit fits its direction (cardinal exits weigh most, up and down least) and the crossings
const WEIGHT: Record<MapDir, number> = { NORTH: 1, SOUTH: 1, EAST: 1, WEST: 1, NE: 0.7, NW: 0.7, SE: 0.7, SW: 0.7, UP: 0.25, DOWN: 0.25, IN: 0, OUT: 0, LAND: 0.3 }
const CROSS = 4
/** Passages longer than a few cells are hard to follow. */
const LONG = 0.6
const geo = edges.filter((e) => VEC[e.dir] && WEIGHT[e.dir] > 0)
const pairs = new Map<string, { a: string; b: string }>()
for (const e of edges) pairs.set([e.from, e.to].sort().join('|'), { a: e.from, b: e.to })
const segments = [...pairs.values()]
const byRoom = new Map<string, typeof segments>()
for (const sgm of segments) for (const r of [sgm.a, sgm.b]) byRoom.set(r, [...(byRoom.get(r) ?? []), sgm])

function fit(room: string): number {
  let c = 0
  for (const sgm of byRoom.get(room) ?? []) {
    const a = pos.get(sgm.a)!
    const b = pos.get(sgm.b)!
    c += LONG * Math.max(0, Math.hypot(a[0] - b[0], a[1] - b[1]) - 1.5) ** 2
  }
  for (const e of geo) {
    if (e.from !== room && e.to !== room) continue
    const v = VEC[e.dir]!
    const a = pos.get(e.from)!
    const b = pos.get(e.to)!
    c += WEIGHT[e.dir] * ((b[0] - a[0] - v[0]) ** 2 + (b[1] - a[1] - v[1]) ** 2)
  }
  return c
}
const orient = (p: number[], q: number[], r: number[]) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]))
function crosses(s1: { a: string; b: string }, s2: { a: string; b: string }): boolean {
  if (s1.a === s2.a || s1.a === s2.b || s1.b === s2.a || s1.b === s2.b) return false
  const p1 = pos.get(s1.a)!, p2 = pos.get(s1.b)!, p3 = pos.get(s2.a)!, p4 = pos.get(s2.b)!
  return orient(p1, p2, p3) * orient(p1, p2, p4) < 0 && orient(p3, p4, p1) * orient(p3, p4, p2) < 0
}
function crossings(room: string): number {
  let n = 0
  for (const s1 of byRoom.get(room) ?? []) for (const s2 of segments) if (crosses(s1, s2)) n++
  return n
}
const local = (rooms_: string[]) => rooms_.reduce((sum, r) => sum + fit(r) + CROSS * crossings(r), 0)

// moves stay inside the area of the first placement: a room reached only through an object
// (Zork II's balloon, bucket, cake) would drift away. Zork I, whose rooms are all connected,
// keeps its unbounded layout (src/data/zork1/map.json is reproduced as it is).
const BOUNDED = gameId !== 'zork1'
const bounds = (() => {
  const xs = [...pos.values()].map((p) => p[0])
  const ys = [...pos.values()].map((p) => p[1])
  return { x0: Math.min(...xs) - 1, x1: Math.max(...xs) + 1, y0: Math.min(...ys) - 1, y1: Math.max(...ys) + 1 }
})()
const inBounds = (x: number, y: number) => !BOUNDED || x >= bounds.x0 && x <= bounds.x1 && y >= bounds.y0 && y <= bounds.y1

let seed = Number(process.env.SEED ?? 1)
const random = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
const movable = rooms.filter((r) => !PINS[r])
const STEPS = Number(process.env.STEPS ?? 250000)
for (let step = 0; step < STEPS; step++) {
  const temp = 4 * (1 - step / STEPS) + 0.01
  const room = movable[Math.floor(random() * movable.length)]
  const [x, y] = pos.get(room)!
  if (random() < 0.5) {
    const other = movable[Math.floor(random() * movable.length)]
    if (other === room) continue
    const [ox, oy] = pos.get(other)!
    const before = local([room, other])
    place(room, ox, oy)
    place(other, x, y)
    const delta = local([room, other]) - before
    if (delta > 0 && random() > Math.exp(-delta / temp)) {
      place(room, x, y)
      place(other, ox, oy)
    }
  } else {
    const nx = x + Math.floor(random() * 7) - 3
    const ny = y + Math.floor(random() * 7) - 3
    if (taken.has(key(nx, ny)) || !inBounds(nx, ny)) continue
    const before = local([room])
    taken.delete(key(x, y))
    place(room, nx, ny)
    const delta = local([room]) - before
    if (delta > 0 && random() > Math.exp(-delta / temp)) {
      taken.delete(key(nx, ny))
      place(room, x, y)
    }
  }
}
function cost(room: string): number {
  return fit(room)
}

// 3. normalize and save
const xs = [...pos.values()].map((p) => p[0])
const ys = [...pos.values()].map((p) => p[1])
const minX = Math.min(...xs)
const minY = Math.min(...ys)
const out: Record<string, [number, number]> = {}
for (const r of [...rooms].sort()) {
  const [x, y] = pos.get(r)!
  out[r] = [x - minX, y - minY]
}
const size = [Math.max(...xs) - minX + 1, Math.max(...ys) - minY + 1]
const outArg = process.argv.indexOf('--out')
mkdirSync(gamePaths(gameId).data, { recursive: true })
writeFileSync(outArg > 0 ? process.argv[outArg + 1] : new URL('map.json', gamePaths(gameId).data), JSON.stringify({ size, rooms: out }, null, 1) + '\n')
const total = rooms.reduce((sum, r) => sum + cost(r), 0) / 2
const crossed = rooms.reduce((sum, r) => sum + crossings(r), 0) / 2
console.log(`${rooms.length} rooms on a ${size[0]}×${size[1]} grid, misfit ${total.toFixed(0)}, ${crossed} crossings`)

// optional preview
const pngIndex = process.argv.indexOf('--png')
if (pngIndex > 0) {
  const sharp = (await import('sharp')).default
  const C = 40
  const lines = edges
    .filter((e) => VEC[e.dir])
    .map((e) => {
      const a = out[e.from]
      const b = out[e.to]
      return `<line x1="${a[0] * C + 20}" y1="${a[1] * C + 20}" x2="${b[0] * C + 20}" y2="${b[1] * C + 20}" stroke="#777" stroke-width="1.5"/>`
    })
  const nodes = Object.entries(out).map(
    ([r, [x, y]]) => `<rect x="${x * C + 6}" y="${y * C + 12}" width="28" height="16" fill="#e3a83c"/><text x="${x * C + 20}" y="${y * C + 23}" font-size="6" text-anchor="middle" font-family="sans-serif">${r.slice(0, 12)}</text>`,
  )
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size[0] * C + 40}" height="${size[1] * C + 40}"><rect width="100%" height="100%" fill="#111"/>${lines.join('')}${nodes.join('')}</svg>`
  await sharp(Buffer.from(svg)).png().toFile(process.argv[pngIndex + 1])
  console.log('preview →', process.argv[pngIndex + 1])
}
