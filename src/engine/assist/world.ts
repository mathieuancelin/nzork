// Read-only view of the game state, by ZIL names, for the choices and the guide.
import type { Game, GameId } from '../game'
import { indexOf } from '../symbols'

export const DIRECTIONS = ['NORTH', 'EAST', 'WEST', 'SOUTH', 'NE', 'NW', 'SE', 'SW', 'UP', 'DOWN', 'IN', 'OUT'] as const
export type Direction = (typeof DIRECTIONS)[number]
export const DIR_COMMAND: Record<Direction, string> = {
  NORTH: 'north', EAST: 'east', WEST: 'west', SOUTH: 'south', NE: 'ne', NW: 'nw', SE: 'se', SW: 'sw', UP: 'up', DOWN: 'down', IN: 'in', OUT: 'out',
}

export type Exit =
  | { kind: 'open'; to: string }
  | { kind: 'closed'; to: string; door?: boolean } // conditional exit currently blocked (a closed door, or a passage not open yet)
  | { kind: 'function' } // computed by a routine (trap door, chimney, maze diodes…)
  | { kind: 'none' }

export class World {
  private O: Record<string, number>
  private A: Record<string, number>
  private P: Record<string, number>
  private G: Record<string, number>
  private nameOf: Map<number, string>

  constructor(readonly game: Game) {
    const s = game.symbols
    this.O = s.objects
    this.A = s.attributes
    this.P = s.properties
    this.G = s.globals
    this.nameOf = indexOf(s).objectName
  }

  get vm() {
    return this.game.vm
  }

  /** Zork I, II or III. */
  get id(): GameId {
    return this.game.id
  }

  obj(name: string): number {
    const n = this.O[name]
    if (n === undefined) throw new Error(`Unknown object ${name}`)
    return n
  }

  /** Whether the game has an object of that name. */
  hasObject(name: string): boolean {
    return this.O[name] !== undefined
  }

  name(num: number): string {
    return this.nameOf.get(num) ?? String(num)
  }

  here(): string {
    return this.name(this.vm.global(this.G.HERE))
  }

  global(name: string): number {
    const g = this.G[name]
    if (g === undefined) throw new Error(`Unknown global ${name}`)
    return this.vm.global(g)
  }

  /** Whether the game has a global of that name. */
  hasGlobal(name: string): boolean {
    return this.G[name] !== undefined
  }

  /** The English words naming an object, for the canonical commands ("brass lantern"). */
  word(num: number): string | undefined {
    return this.game.symbols.words[String(num)]
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
    return this.vm.parent(this.obj(name)) === this.vm.global(this.G.WINNER)
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
    return this.attrOf(this.obj(name), flag)
  }

  attrOf(num: number, flag: string): boolean {
    const a = this.A[flag]
    // a flag the game does not use (FIGHTBIT in Zork II) is never set
    return a !== undefined && this.vm.hasAttr(num, a)
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
    const winner = this.vm.global(this.G.WINNER)
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
    const winner = this.vm.global(this.G.WINNER)
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
    const here = this.vm.global(this.G.HERE)
    const winner = this.vm.global(this.G.WINNER)
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
    const here = this.vm.global(this.G.HERE)
    const addr = this.vm.getPropAddr(here, this.P.GLOBAL)
    const len = this.vm.getPropLen(addr)
    const out: number[] = []
    for (let i = 0; i < len; i++) out.push(this.vm.mem[addr + i])
    return out
  }

  /** Exit of a room in a direction, decoded from the property (see V-WALK in gverbs.zil). */
  exit(room: string, dir: Direction): Exit {
    const vm = this.vm
    const addr = vm.getPropAddr(this.obj(room), this.P[dir])
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
        return vm.hasAttr(vm.mem[addr + 1], this.A.OPENBIT) ? { kind: 'open', to: to() } : { kind: 'closed', to: to(), door: true }
    }
    return { kind: 'none' }
  }

  /**
   * Turns of light left in the brass lantern: the countdown of its interrupt in the clock table
   * (C-TABLE, entries of [enabled, tick, routine]) plus the stages still to come in LAMP-TABLE.
   * In Zork I, 385 when new, 0 when burned out.
   */
  lampTurnsLeft(): number {
    const vm = this.vm
    if (this.attr('LAMP', 'RMUNGBIT')) return 0
    const table = this.global('C-TABLE')
    const routine = this.game.symbols.routines['I-LANTERN']
    let tick = 0
    for (let off = this.global('C-INTS'); off < 180; off += 6) {
      if (vm.unpack(vm.word(table + off + 4)) === routine) tick = vm.word(table + off + 2)
    }
    let stages = 0
    for (let p = this.global('LAMP-TABLE'), i = 0; i < 8; p += 4, i++) {
      const v = vm.word(p)
      stages += v
      if (!v) break
    }
    return tick + stages
  }

  /** In a vehicle (the boat)? */
  inVehicle(): string | null {
    const winner = this.vm.global(this.G.WINNER)
    const loc = this.vm.parent(winner)
    return loc !== this.vm.global(this.G.HERE) ? this.name(loc) : null
  }
}
