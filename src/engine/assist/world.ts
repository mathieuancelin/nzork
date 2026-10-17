// Read-only view of the game state, by ZIL names, for the choices and the guide.
import type { Game } from '../game'
import symbols from '../story/symbols.json'

const O = symbols.objects as Record<string, number>
const A = symbols.attributes as Record<string, number>
const P = symbols.properties as Record<string, number>
const G = symbols.globals as Record<string, number>
const nameOf = new Map(Object.entries(O).map(([n, v]) => [v, n]))

export const DIRECTIONS = ['NORTH', 'EAST', 'WEST', 'SOUTH', 'NE', 'NW', 'SE', 'SW', 'UP', 'DOWN', 'IN', 'OUT'] as const
export type Direction = (typeof DIRECTIONS)[number]
export const DIR_COMMAND: Record<Direction, string> = {
  NORTH: 'north', EAST: 'east', WEST: 'west', SOUTH: 'south', NE: 'ne', NW: 'nw', SE: 'se', SW: 'sw', UP: 'up', DOWN: 'down', IN: 'in', OUT: 'out',
}

export type Exit =
  | { kind: 'open'; to: string }
  | { kind: 'closed'; to: string } // conditional exit currently blocked
  | { kind: 'function' } // computed by a routine (trap door, chimney, maze diodes…)
  | { kind: 'none' }

export class World {
  constructor(readonly game: Game) {}

  get vm() {
    return this.game.vm
  }

  obj(name: string): number {
    const n = O[name]
    if (n === undefined) throw new Error(`Unknown object ${name}`)
    return n
  }

  name(num: number): string {
    return nameOf.get(num) ?? String(num)
  }

  here(): string {
    return this.name(this.vm.global(G.HERE))
  }

  global(name: string): number {
    const g = G[name]
    if (g === undefined) throw new Error(`Unknown global ${name}`)
    return this.vm.global(g)
  }

  flag(name: string): boolean {
    return this.global(name) !== 0
  }

  score(): number {
    return (this.global('SCORE') << 16) >> 16
  }

  loc(name: string): string {
    return this.name(this.vm.parent(this.obj(name)))
  }

  has(name: string): boolean {
    return this.vm.parent(this.obj(name)) === this.vm.global(G.WINNER)
  }

  /** True when the object is (directly or not) inside `container`. */
  within(name: string, container: string): boolean {
    const c = this.obj(container)
    let o = this.obj(name)
    for (let i = 0; i < 20 && o; i++) {
      o = this.vm.parent(o)
      if (o === c) return true
    }
    return false
  }

  /** Carried, possibly inside a carried container. */
  carried(name: string): boolean {
    return this.within(name, 'ADVENTURER')
  }

  attr(name: string, flag: string): boolean {
    return this.vm.hasAttr(this.obj(name), A[flag])
  }

  attrOf(num: number, flag: string): boolean {
    return this.vm.hasAttr(num, A[flag])
  }

  children(num: number): number[] {
    const out: number[] = []
    for (let c = this.vm.child(num); c; c = this.vm.sibling(c)) out.push(c)
    return out
  }

  /** Whether the current room is lit (the game's LIT global). */
  lit(): boolean {
    return this.flag('LIT')
  }

  /** Whether the player carries a light source that is on. */
  carriesLight(): boolean {
    const winner = this.vm.global(G.WINNER)
    const stack = this.children(winner)
    while (stack.length) {
      const o = stack.pop()!
      if (this.attrOf(o, 'ONBIT') && (this.attrOf(o, 'LIGHTBIT') || this.attrOf(o, 'FLAMEBIT'))) return true
      if (this.attrOf(o, 'OPENBIT') || this.attrOf(o, 'TRANSBIT')) stack.push(...this.children(o))
    }
    return false
  }

  /** Room lit independently of what the player carries: daylight, or a light source lying there. */
  roomLit(room: string): boolean {
    if (this.attr(room, 'ONBIT')) return true
    const winner = this.vm.global(G.WINNER)
    const stack = this.children(this.obj(room)).filter((c) => c !== winner)
    while (stack.length) {
      const o = stack.pop()!
      if (this.attrOf(o, 'ONBIT') && (this.attrOf(o, 'LIGHTBIT') || this.attrOf(o, 'FLAMEBIT'))) return true
      if (this.attrOf(o, 'OPENBIT') || this.attrOf(o, 'TRANSBIT') || this.attrOf(o, 'SURFACEBIT')) stack.push(...this.children(o))
    }
    return false
  }

  /** Objects the player can see: in the room (and open containers), carried. */
  visible(): number[] {
    const here = this.vm.global(G.HERE)
    const winner = this.vm.global(G.WINNER)
    const out: number[] = []
    const visit = (o: number, depth: number) => {
      for (const c of this.children(o)) {
        if (c === winner) continue
        if (this.attrOf(c, 'INVISIBLE')) continue
        out.push(c)
        if (depth < 3 && (this.attrOf(c, 'OPENBIT') || this.attrOf(c, 'TRANSBIT') || this.attrOf(c, 'SURFACEBIT'))) visit(c, depth + 1)
      }
    }
    if (this.lit()) visit(here, 0)
    visit(winner, 0)
    // the vehicle the player is in
    const loc = this.vm.parent(winner)
    if (loc !== here) visit(loc, 0)
    return [...new Set(out)]
  }

  /** Local "scenery" objects of the room (GLOBAL property). */
  localGlobals(): number[] {
    const here = this.vm.global(G.HERE)
    const addr = this.vm.getPropAddr(here, P.GLOBAL)
    const len = this.vm.getPropLen(addr)
    const out: number[] = []
    for (let i = 0; i < len; i++) out.push(this.vm.mem[addr + i])
    return out
  }

  /** Exit of a room in a direction, decoded from the property (see V-WALK in gverbs.zil). */
  exit(room: string, dir: Direction): Exit {
    const vm = this.vm
    const addr = vm.getPropAddr(this.obj(room), P[dir])
    if (!addr) return { kind: 'none' }
    const size = vm.getPropLen(addr)
    const to = () => this.name(vm.mem[addr])
    switch (size) {
      case 1: // UEXIT
        return { kind: 'open', to: to() }
      case 2: // NEXIT: a message
        return { kind: 'none' }
      case 3: // FEXIT: a routine decides
        return { kind: 'function' }
      case 4: // CEXIT: global flag
        return vm.global(vm.mem[addr + 1] - 16) ? { kind: 'open', to: to() } : { kind: 'closed', to: to() }
      case 5: // DEXIT: door
        return vm.hasAttr(vm.mem[addr + 1], A.OPENBIT) ? { kind: 'open', to: to() } : { kind: 'closed', to: to() }
    }
    return { kind: 'none' }
  }

  /** In a vehicle (the boat)? */
  inVehicle(): string | null {
    const winner = this.vm.global(G.WINNER)
    const loc = this.vm.parent(winner)
    return loc !== this.vm.global(G.HERE) ? this.name(loc) : null
  }
}
