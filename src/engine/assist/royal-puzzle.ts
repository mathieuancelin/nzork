// The Royal Puzzle of Zork III, as the guide sees it: a 6×6 grid of rooms (CPTABLE), some with
// walls of marble (fixed) or sandstone (they slide when pushed, one ladder among them), the
// player's cell (CPHERE) and the very ancient book. The way out is the hole above cell 1, with
// the good ladder right next to it (cell 2). solve() finds the shortest series of pushes, then
// turns it into moves; it follows the rules of CPEXIT and CPWALL-OBJECT in 3actions.zil.
import type { World, Direction } from './world'

/** 0: empty, 1: marble, -1: sandstone, -2: the good ladder, -3: the bad ladder. Cells 1 to 36. */
export interface Puzzle {
  cells: number[]
  pos: number
  /** The cell where the book lies, 0 once it is carried (or gone from the puzzle). */
  book: number
}

export type PuzzleMove = { kind: 'walk'; dir: Direction } | { kind: 'push'; dir: Direction } | { kind: 'take' } | { kind: 'up' }

const STEP: Partial<Record<Direction, number>> = { NORTH: -6, SOUTH: 6, EAST: 1, WEST: -1, NE: -5, NW: -7, SE: 7, SW: 5 }
const ORTHO: Direction[] = ['NORTH', 'SOUTH', 'EAST', 'WEST']
const ALL: Direction[] = ['NORTH', 'SOUTH', 'EAST', 'WEST', 'NE', 'NW', 'SE', 'SW']

/** ILLCP: a step that would leave the grid. */
function illegal(cell: number, fx: number): boolean {
  if (cell % 6 === 0 && (fx === -5 || fx === 1 || fx === 7)) return true
  if (cell % 6 === 1 && (fx === -7 || fx === -1 || fx === 5)) return true
  if (cell < 7 && fx < -4) return true
  if (cell > 30 && fx > 4) return true
  return false
}

const at = (cells: number[], i: number) => (i >= 0 && i < cells.length ? cells[i] : 1)

/** CPEXIT: where a walk in a direction leads, or 0. */
export function walk(cells: number[], from: number, dir: Direction): number {
  const fx = STEP[dir]!
  const to = from + fx
  if (to > 36 || to < 0 || illegal(from, fx)) return 0
  if (Math.abs(fx) === 1 || Math.abs(fx) === 6) return at(cells, to) === 0 ? to : 0
  // a diagonal needs one of its two sides free (<EQUAL? 0 A B> is true when either is 0)
  if (fx > 0 && at(cells, from + 6) !== 0 && at(cells, from + fx - 6) !== 0) return 0
  if (fx < 0 && at(cells, from - 6) !== 0 && at(cells, from + 6 + fx) !== 0) return 0
  return at(cells, to) === 0 ? to : 0
}

/** CPWALL-OBJECT: the cells after pushing the wall next to `from`, or null when it does not move. */
export function push(cells: number[], from: number, dir: Direction, book: number): number[] | null {
  const fx = STEP[dir]!
  if (illegal(from, fx)) return null
  const next = from + fx
  const wall = at(cells, next)
  if (wall >= 0) return null
  if (illegal(next, fx)) return null
  const beyond = next + fx
  // never block the way out (CPBLOCK-FLAG), never bury the book behind a wall
  if (beyond === 1 || beyond === book || at(cells, beyond) !== 0) return null
  const out = cells.slice()
  out[next] = 0
  out[beyond] = wall
  return out
}

/** Cells reachable on foot, with the last move toward each (breadth first). */
function region(cells: number[], from: number): Map<number, { prev: number; dir: Direction | null }> {
  const seen = new Map<number, { prev: number; dir: Direction | null }>([[from, { prev: 0, dir: null }]])
  const queue = [from]
  while (queue.length) {
    const c = queue.shift()!
    for (const d of ALL) {
      const to = walk(cells, c, d)
      if (to && !seen.has(to)) {
        seen.set(to, { prev: c, dir: d })
        queue.push(to)
      }
    }
  }
  return seen
}

function pathTo(reach: Map<number, { prev: number; dir: Direction | null }>, to: number): Direction[] {
  const dirs: Direction[] = []
  for (let c = to; reach.get(c)!.dir; c = reach.get(c)!.prev) dirs.unshift(reach.get(c)!.dir!)
  return dirs
}

interface Node {
  cells: number[]
  pos: number
  book: number
  parent: Node | null
  /** How this node was reached from its parent: walk to `from`, then push or take the book. */
  from: number
  action: { kind: 'push'; dir: Direction } | { kind: 'take' } | null
}

const keyOf = (n: { cells: number[]; pos: number; book: number }) => `${n.cells.join(',')}|${Math.min(...region(n.cells, n.pos).keys())}|${n.book}`

/** The puzzle when the game starts: the player at the foot of the hole, the book in cell 22. */
const START: Puzzle = { cells: [1, 0, -1, 0, 0, -1, 0, -1, 0, 1, 0, -2, 0, 0, 0, 0, 0, 1, 0, -3, 0, 0, -1, -1, 0, 0, 0, -1, 0, 0, 0, 1, 1, 0, 0, 0, 1], pos: 1, book: 22 }

/** The InvisiClues solution, from the foot of the hole. */
const SOLUTION =
  'push e. s. s. se. push s. n. ne. push s. take. push s. e. ne. push w. sw. nw. ne. push s. sw. push e. ne. push s. nw. n. n. n. push e. sw. s. se. ne. n. push w. nw. push s. push s. w. nw. nw. push s. se. se. se. ne. push w. push w. sw. push n. push n. push n. nw'

const DIR: Record<string, Direction> = { n: 'NORTH', s: 'SOUTH', e: 'EAST', w: 'WEST', ne: 'NE', nw: 'NW', se: 'SE', sw: 'SW' }

/** The positions the solution goes through (after each push or take), by key. */
let solution: Map<string, Node> | null = null
function solutionNodes(): Map<string, Node> {
  if (solution) return solution
  solution = new Map()
  let n: Node = { ...START, parent: null, from: START.pos, action: null }
  solution.set(keyOf(n), n)
  for (const word of SOLUTION.split('. ')) {
    if (word === 'take') n = { cells: n.cells, pos: n.pos, book: 0, parent: n, from: n.pos, action: { kind: 'take' } }
    else if (word.startsWith('push ')) {
      const d = DIR[word.slice(5)]
      const cells = push(n.cells, n.pos, d, n.book)!
      n = { cells, pos: n.pos + STEP[d]!, book: n.book, parent: n, from: n.pos, action: { kind: 'push', dir: d } }
    } else {
      // a walk: same node, the player just stands elsewhere in the same region
      n = { ...n, pos: walk(n.cells, n.pos, DIR[word]) }
      continue
    }
    solution.set(keyOf(n), n)
  }
  return solution
}

/** The moves out of the puzzle with the book, or null (no way, or too far to search). */
export function solve(p: Puzzle, limit = 100000): PuzzleMove[] | null {
  const known = solutionNodes()
  const start: Node = { cells: p.cells, pos: p.pos, book: p.book, parent: null, from: p.pos, action: null }
  const seen = new Set([keyOf(p)])
  const queue = [start]
  for (let i = 0; i < queue.length && seen.size < limit; i++) {
    const n = queue[i]
    const reach = region(n.cells, n.pos)
    if (n.book === 0 && reach.has(1) && n.cells[2] === -2) return movesOf(p, chainOf(n), [])
    // back on the path of the InvisiClues solution: follow it from there
    const on = known.get(keyOf(n))
    if (on) return movesOf(p, chainOf(n), restOf(on))
    if (n.book && reach.has(n.book)) {
      const child: Node = { cells: n.cells, pos: n.book, book: 0, parent: n, from: n.book, action: { kind: 'take' } }
      if (!seen.has(keyOf(child))) {
        seen.add(keyOf(child))
        queue.push(child)
      }
      continue
    }
    for (const c of reach.keys()) {
      for (const d of ORTHO) {
        const cells = push(n.cells, c, d, n.book)
        if (!cells) continue
        const child: Node = { cells, pos: c + STEP[d]!, book: n.book, parent: n, from: c, action: { kind: 'push', dir: d } }
        const k = keyOf(child)
        if (seen.has(k)) continue
        seen.add(k)
        queue.push(child)
      }
    }
  }
  return null
}

const chainOf = (end: Node) => {
  const chain: Node[] = []
  for (let n: Node | null = end; n; n = n.parent) chain.unshift(n)
  return chain
}

/** The nodes of the known solution after `from`. */
function restOf(from: Node): Node[] {
  const all = [...solutionNodes().values()]
  return all.slice(all.indexOf(from) + 1)
}

/** Walks and pushes along a chain of nodes (the first is where the player stands), then out. */
function movesOf(p: Puzzle, chain: Node[], rest: Node[]): PuzzleMove[] {
  const moves: PuzzleMove[] = []
  let cells = p.cells
  let pos = p.pos
  for (const n of [...chain.slice(1), ...rest]) {
    for (const dir of pathTo(region(cells, pos), n.from)) moves.push({ kind: 'walk', dir })
    moves.push(n.action!.kind === 'take' ? { kind: 'take' } : { kind: 'push', dir: (n.action as { dir: Direction }).dir })
    cells = n.cells
    pos = n.pos
  }
  for (const dir of pathTo(region(cells, pos), 1)) moves.push({ kind: 'walk', dir })
  moves.push({ kind: 'up' })
  return moves
}

/** The state after a move (to follow a plan without solving the puzzle again at every turn). */
export function apply(p: Puzzle, m: PuzzleMove): Puzzle {
  if (m.kind === 'walk') return { ...p, pos: walk(p.cells, p.pos, m.dir) }
  if (m.kind === 'take') return { ...p, book: 0 }
  if (m.kind === 'push') return { cells: push(p.cells, p.pos, m.dir, p.book) ?? p.cells, pos: p.pos + STEP[m.dir]!, book: p.book }
  return p
}

export const puzzleKey = (p: Puzzle) => `${p.cells.join(',')}|${p.pos}|${p.book}`

/** The puzzle as it stands in the game. */
export function readPuzzle(w: World): Puzzle {
  const vm = w.vm
  const table = w.global('CPTABLE')
  const cells = Array.from({ length: 37 }, (_, i) => (vm.word(table + 2 * i) << 16) >> 16)
  const pos = w.global('CPHERE')
  let book = 0
  if (!w.carried('LORE-BOOK')) {
    if (w.loc('LORE-BOOK') === 'CP') book = pos
    else {
      // objects left in the other cells wait in CPOBJS: a count, then the objects (8 words a cell)
      const objs = w.global('CPOBJS')
      const target = w.obj('LORE-BOOK')
      for (let cell = 1; cell <= 36 && !book; cell++) {
        const top = objs + 2 * 8 * (cell - 1)
        const count = vm.word(top)
        for (let i = 1; i <= count && i < 8; i++) if (vm.word(top + 2 * i) === target) book = cell
      }
    }
  }
  return { cells, pos, book }
}
