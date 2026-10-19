// The map of the rooms: their exits (from the room properties, plus the few a routine decides),
// the rooms the player has seen, and a path between them. Nothing here reveals a room that was
// not visited.
import type { Game, GameId } from '../game'
import { World, DIRECTIONS, type Direction } from './world'

export type MapDir = Direction | 'LAND'
export const MAP_DIRS: MapDir[] = [...DIRECTIONS, 'LAND']

type Special = { from: string; dir: MapDir; to: string; open: (w: World) => boolean }

/** Exits a routine decides (PER in the ZIL source): where they lead, when they can be walked. */
const SPECIAL: Record<GameId, Special[]> = {
  zork1: [
    { from: 'LIVING-ROOM', dir: 'DOWN', to: 'CELLAR', open: (w) => w.flag('RUG-MOVED') && w.attr('TRAP-DOOR', 'OPENBIT') },
    { from: 'GRATING-CLEARING', dir: 'DOWN', to: 'GRATING-ROOM', open: (w) => w.attr('GRATE', 'OPENBIT') },
    // only with almost nothing in hand: never used to travel
    { from: 'STUDIO', dir: 'UP', to: 'KITCHEN', open: () => false },
    // one-way slides of the maze
    { from: 'MAZE-2', dir: 'DOWN', to: 'MAZE-4', open: () => true },
    { from: 'MAZE-7', dir: 'DOWN', to: 'DEAD-END-1', open: () => true },
    { from: 'MAZE-9', dir: 'DOWN', to: 'MAZE-11', open: () => true },
    { from: 'MAZE-12', dir: 'DOWN', to: 'MAZE-5', open: () => true },
  ],
  zork2: [
    // the Carousel Room (MAGNET-ROOM-EXIT): while it spins, every exit is a gamble
    { from: 'MAGNET-ROOM', dir: 'EAST', to: 'MACHINE-ROOM', open: (w) => !w.flag('CAROUSEL-FLIP-FLAG') },
    { from: 'MAGNET-ROOM', dir: 'SE', to: 'TEA-ROOM', open: (w) => !w.flag('CAROUSEL-FLIP-FLAG') },
    { from: 'MAGNET-ROOM', dir: 'OUT', to: 'TEA-ROOM', open: (w) => !w.flag('CAROUSEL-FLIP-FLAG') },
    // the bank lets nobody out with its money (BKLEAVEE)
    { from: 'DEPOSITORY', dir: 'EAST', to: 'TELLER-EAST', open: (w) => !w.carried('BILLS') && !w.carried('PORTRAIT') },
    { from: 'DEPOSITORY', dir: 'WEST', to: 'TELLER-WEST', open: (w) => !w.carried('BILLS') && !w.carried('PORTRAIT') },
  ],
  zork3: [
    // into the Royal Puzzle: no way back up until it is solved, so never used to travel
    { from: 'CP-ANTE', dir: 'DOWN', to: 'CP', open: () => false },
    // the long hallway of the mirror (MRGO): the wooden box blocks the hallway where it stands,
    // and the Guardians crush whoever walks past them
    { from: 'MREYE', dir: 'NORTH', to: 'MRA', open: (w) => w.global('MLOC') !== w.obj('MRA') },
    { from: 'MRA', dir: 'NORTH', to: 'MRB', open: (w) => w.global('MLOC') !== w.obj('MRB') },
    { from: 'MRB', dir: 'NORTH', to: 'MRC', open: (w) => w.global('MLOC') !== w.obj('MRC') },
    { from: 'MRC', dir: 'NORTH', to: 'MRG', open: () => false },
    { from: 'MRG', dir: 'NORTH', to: 'MRD', open: () => false },
    { from: 'FRONT-DOOR', dir: 'SOUTH', to: 'MRD', open: (w) => w.global('MLOC') !== w.obj('MRD') },
    { from: 'MRD', dir: 'SOUTH', to: 'MRG', open: () => false },
    { from: 'MRG', dir: 'SOUTH', to: 'MRC', open: () => false },
    { from: 'MRC', dir: 'SOUTH', to: 'MRB', open: (w) => w.global('MLOC') !== w.obj('MRB') },
    { from: 'MRB', dir: 'SOUTH', to: 'MRA', open: (w) => w.global('MLOC') !== w.obj('MRA') },
  ],
}

export interface RoomExit {
  dir: MapDir
  to: string
  /** Can be walked right now (an open door, a solved puzzle). */
  open: boolean
  /** Can be seen even when closed: a door (a hidden passage cannot). */
  visible: boolean
}

export function exitsOf(w: World, room: string): RoomExit[] {
  const out: RoomExit[] = []
  for (const dir of MAP_DIRS) {
    const e = w.exit(room, dir as Direction)
    if (e.kind === 'open') out.push({ dir, to: e.to, open: true, visible: true })
    else if (e.kind === 'closed') out.push({ dir, to: e.to, open: false, visible: !!e.door })
    else if (e.kind === 'function') {
      const s = SPECIAL[w.id].find((x) => x.from === room && x.dir === dir)
      if (s) {
        const open = s.open(w)
        out.push({ dir, to: s.to, open, visible: open })
      }
    }
  }
  return out
}

/** Every room of the game. */
export function allRooms(w: World): string[] {
  return w.children(w.obj('ROOMS')).map((r) => w.name(r))
}

/** Rooms seen: marked by the game, plus the ones the interface remembers (the game forgets the maze). */
export function visitedRooms(game: Game, remembered: Iterable<string> = []): Set<string> {
  const w = new World(game)
  const seen = new Set(remembered)
  for (const r of allRooms(w)) if (w.attr(r, 'TOUCHBIT')) seen.add(r)
  return seen
}

export interface MapState {
  here: string
  rooms: string[]
  /** Names of the visited rooms, in the language of the game. */
  names: Record<string, string>
  /** Passages between two visited rooms (each pair once). */
  links: [string, string][]
  /** Exits of visited rooms toward rooms not seen yet (one per destination, hidden passages left out). */
  stubs: { room: string; dir: MapDir }[]
}

export function mapOf(game: Game, visited: Set<string>): MapState {
  const w = new World(game)
  const links = new Map<string, [string, string]>()
  const stubs: MapState['stubs'] = []
  for (const room of visited) {
    const toward = new Set<string>()
    for (const e of exitsOf(w, room)) {
      if (e.to === room) continue
      if (visited.has(e.to)) {
        const key = [room, e.to].sort().join('|')
        if (!links.has(key)) links.set(key, [room, e.to])
      } else if (e.visible && !toward.has(e.to)) {
        toward.add(e.to)
        stubs.push({ room, dir: e.dir })
      }
    }
  }
  const names = Object.fromEntries([...visited].map((r) => [r, game.presenter.noun(w.obj(r)).nom]))
  return { here: w.here(), rooms: [...visited], names, links: [...links.values()], stubs }
}

/** Shortest walk to a visited room, through visited rooms and exits open right now. */
export function pathTo(game: Game, visited: Set<string>, target: string): { dir: Direction; to: string }[] | null {
  const w = new World(game)
  const from = w.here()
  if (from === target) return []
  const prev = new Map<string, { room: string; dir: Direction }>()
  const queue = [from]
  const seen = new Set([from])
  while (queue.length) {
    const room = queue.shift()!
    for (const e of exitsOf(w, room)) {
      if (!e.open || e.dir === 'LAND' || seen.has(e.to) || !visited.has(e.to)) continue
      seen.add(e.to)
      prev.set(e.to, { room, dir: e.dir })
      if (e.to === target) {
        const steps: { dir: Direction; to: string }[] = []
        for (let r = target; r !== from; r = prev.get(r)!.room) steps.unshift({ dir: prev.get(r)!.dir, to: r })
        return steps
      }
      queue.push(e.to)
    }
  }
  return null
}
