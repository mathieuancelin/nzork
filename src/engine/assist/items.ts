// What the player carries and which treasures they found, for the side panel. Read from the
// game state: showing it costs no turn and changes nothing.
import type { Game, GameId } from '../game'
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
  /** unknown: never touched (shown as "?"); found: taken at least once; case: stored where it counts. */
  state: 'unknown' | 'found' | 'case'
}

export interface Treasures {
  slots: TreasureSlot[]
  found: number
  /** Treasures stored where they count (Zork I's trophy case); absent when the game has no such place. */
  inCase?: number
}

interface TreasureList {
  /** The treasures, with the damaged version some of them can turn into. */
  list: [string, string?][]
  /** Where a treasure counts once stored (Zork I: the trophy case). */
  stored?: (w: World, id: string) => boolean
  /** Found even without being touched (Zork II's unicorn hands its key over). */
  found?: (w: World, id: string) => boolean
}

const TREASURES: Record<GameId, TreasureList> = {
  zork1: {
    list: [
      ['EGG', 'BROKEN-EGG'], ['CANARY', 'BROKEN-CANARY'], ['BAUBLE'], ['PAINTING'], ['BAR'], ['TORCH'], ['SCEPTRE'],
      ['POT-OF-GOLD'], ['TRUNK'], ['COFFIN'], ['JADE'], ['SKULL'], ['BAG-OF-COINS'], ['BRACELET'], ['DIAMOND'],
      ['EMERALD'], ['SCARAB'], ['TRIDENT'], ['CHALICE'],
    ],
    stored: (w, id) => w.within(id, 'TROPHY-CASE'),
  },
  // the ten treasures of the demon's fee (TREASURES-MAX in 2actions.zil: every object with a
  // value but the spheres, the candy, the collar and the wand); where they go is the game's
  // secret, so the tracker only counts the ones found
  zork2: {
    list: [['STATUETTE'], ['PORTRAIT'], ['BILLS'], ['CROWN'], ['VIOLIN'], ['PEARL'], ['RUBY'], ['STAMP'], ['COIN'], ['GOLD-KEY']],
    // a treasure scores when it first comes into hand, and its value drops to 0 (SCORE-OBJ)
    found: (w, id) => w.vm.getProp(w.obj(id), w.game.symbols.properties.VALUE) === 0,
  },
  zork3: { list: [] },
}

/** Whether the game has treasures to track. */
export const hasTreasures = (game: GameId) => TREASURES[game].list.length > 0

function nameOf(game: Game, obj: number): string {
  return capitalize(game.presenter.noun(obj).nom)
}

const treasureNames = new Map<GameId, Set<string>>()
function isTreasure(w: World, obj: number): boolean {
  let names = treasureNames.get(w.id)
  if (!names) treasureNames.set(w.id, (names = new Set(TREASURES[w.id].list.flat().filter(Boolean) as string[])))
  return names.has(w.name(obj))
}

function kindOf(w: World, obj: number): ItemKind {
  const has = (a: string) => w.attrOf(obj, a)
  if (isTreasure(w, obj)) return 'treasure'
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

/** The treasures: which ones were found, which ones are stored where they count. */
export function treasuresOf(game: Game): Treasures {
  const w = new World(game)
  const { list, stored, found: given } = TREASURES[game.id]
  const slots = list.map(([main, damaged]): TreasureSlot => {
    // the damaged version replaces the original once it exists
    const id = damaged && inPlay(w, w.obj(damaged)) ? damaged : main
    const obj = w.obj(id)
    // unknown until touched; the game also touches what is inside a treasure put in the case,
    // so a treasure shut away in another one stays unknown too
    const known = (w.attrOf(obj, 'TOUCHBIT') || !!given?.(w, id)) && !hidden(w, obj)
    const state = !known ? 'unknown' : stored?.(w, id) ? 'case' : 'found'
    return { id, obj, name: nameOf(game, obj), state }
  })
  const found = slots.filter((s) => s.state !== 'unknown').length
  return stored ? { slots, found, inCase: slots.filter((s) => s.state === 'case').length } : { slots, found }
}
