// What the player carries and which treasures they found, for the side panel. Read from the
// game state: showing it costs no turn and changes nothing.
import type { Game } from '../game'
import { capitalize } from '../i18n/grammar'
import { World } from './world'

export type ItemKind = 'treasure' | 'light' | 'weapon' | 'paper' | 'food' | 'container' | 'tool' | 'thing'

export interface Item {
  obj: number
  /** ZIL name, e.g. "LAMP". */
  id: string
  name: string
  kind: ItemKind
  /** A light source that is on. */
  lit: boolean
  /** What can be seen inside (open or transparent containers). */
  contents: Item[]
}

export interface TreasureSlot {
  /** ZIL name of the treasure, or of its damaged version when that one is in play. */
  id: string
  obj: number
  name: string
  /** unknown: never touched (shown as "?"); found: taken at least once; case: in the trophy case. */
  state: 'unknown' | 'found' | 'case'
}

export interface Treasures {
  slots: TreasureSlot[]
  found: number
  inCase: number
}

/** The 19 treasures, with the damaged version some of them can turn into. */
const TREASURES: [string, string?][] = [
  ['EGG', 'BROKEN-EGG'], ['CANARY', 'BROKEN-CANARY'], ['BAUBLE'], ['PAINTING'], ['BAR'], ['TORCH'], ['SCEPTRE'],
  ['POT-OF-GOLD'], ['TRUNK'], ['COFFIN'], ['JADE'], ['SKULL'], ['BAG-OF-COINS'], ['BRACELET'], ['DIAMOND'],
  ['EMERALD'], ['SCARAB'], ['TRIDENT'], ['CHALICE'],
]
const TREASURE_NAMES = new Set(TREASURES.flat().filter(Boolean) as string[])

function nameOf(game: Game, obj: number): string {
  return capitalize(game.presenter.noun(obj).nom)
}

function kindOf(w: World, obj: number): ItemKind {
  const has = (a: string) => w.attrOf(obj, a)
  if (TREASURE_NAMES.has(w.name(obj))) return 'treasure'
  if (has('LIGHTBIT') || has('FLAMEBIT')) return 'light'
  if (has('WEAPONBIT')) return 'weapon'
  if (has('READBIT')) return 'paper'
  if (has('FOODBIT') || has('DRINKBIT')) return 'food'
  if (has('CONTBIT')) return 'container'
  if (has('TOOLBIT')) return 'tool'
  return 'thing'
}

function item(game: Game, w: World, obj: number): Item {
  const open = w.attrOf(obj, 'OPENBIT') || w.attrOf(obj, 'TRANSBIT') || w.attrOf(obj, 'SURFACEBIT')
  return {
    obj,
    id: w.name(obj),
    name: nameOf(game, obj),
    kind: kindOf(w, obj),
    lit: w.attrOf(obj, 'ONBIT') && (w.attrOf(obj, 'LIGHTBIT') || w.attrOf(obj, 'FLAMEBIT')),
    contents: open ? visibleChildren(w, obj).map((c) => item(game, w, c)) : [],
  }
}

function visibleChildren(w: World, obj: number): number[] {
  return w.children(obj).filter((c) => !w.attrOf(c, 'INVISIBLE'))
}

/** What the player carries, containers with their visible contents. */
export function inventoryOf(game: Game): Item[] {
  const w = new World(game)
  return visibleChildren(w, w.obj('ADVENTURER')).map((o) => item(game, w, o))
}

/** In the world: its chain of containers leads to a room (not to an object kept aside). */
function inPlay(w: World, obj: number): boolean {
  const rooms = w.obj('ROOMS')
  for (let o = obj, i = 0; o && i < 20; i++) {
    o = w.vm.parent(o)
    if (o === rooms) return true
  }
  return false
}

/** Shut away: inside a closed, opaque container (the canary in the egg). */
function hidden(w: World, obj: number): boolean {
  const rooms = w.obj('ROOMS')
  for (let o = w.vm.parent(obj), i = 0; o && o !== rooms && i < 20; o = w.vm.parent(o), i++) {
    if (w.attrOf(o, 'CONTBIT') && !w.attrOf(o, 'OPENBIT') && !w.attrOf(o, 'TRANSBIT')) return true
  }
  return false
}

/** The treasures: which ones were found, which ones are in the trophy case. */
export function treasuresOf(game: Game): Treasures {
  const w = new World(game)
  const slots = TREASURES.map(([main, damaged]): TreasureSlot => {
    // the damaged version replaces the original once it exists
    const id = damaged && inPlay(w, w.obj(damaged)) ? damaged : main
    const obj = w.obj(id)
    // unknown until touched; the game also touches what is inside a treasure put in the case,
    // so a treasure shut away in another one stays unknown too
    const state = !w.attrOf(obj, 'TOUCHBIT') || hidden(w, obj) ? 'unknown' : w.within(id, 'TROPHY-CASE') ? 'case' : 'found'
    return { id, obj, name: nameOf(game, obj), state }
  })
  return { slots, found: slots.filter((s) => s.state !== 'unknown').length, inCase: slots.filter((s) => s.state === 'case').length }
}
