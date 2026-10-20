// Portraits of the characters: a close-up of the troll, the Wizard or the Dungeon Master shows
// next to the scene while they are there. Each game lists its characters in
// src/data/<game>/portraits.json, with the conditions that bring them on stage and their state
// variants (the troll knocked out, the dragon angry…); the prompts live in
// tools/images[/<game>]/portrait-prompts.json and the images, once generated and chosen, in
// public/portraits/ with a manifest. A portrait without an image is simply not shown.
import zork1 from '../data/zork1/portraits.json'
import zork2 from '../data/zork2/portraits.json'
import zork3 from '../data/zork3/portraits.json'
import type { Game, GameId } from '../engine/game'
import { World } from '../engine/assist/world'

type Cmp = '<' | '<=' | '=' | '>=' | '>' | '!='

/** Every field given must hold. */
export interface PortraitCondition {
  /** The character can be seen: in the lit room (or an open container there), or scenery of the room. */
  present?: string
  /** The player is in one of these rooms. */
  rooms?: string[]
  flag?: string | string[]
  notFlag?: string | string[]
  objectIn?: [string, string]
  /** The object is carried by the player or lies in the room (the bat's garlic). */
  near?: string
  global?: [string, Cmp, number]
  /** A numeric property of an object (a villain's STRENGTH, negative while he is knocked out). */
  prop?: [string, string, Cmp, number]
}

export interface PortraitDef {
  id: string
  /** French and English names, under the frame. */
  name: [string, string]
  /** The character is on stage when one of these holds. */
  when: PortraitCondition[]
  /** States drawn on their own: the first one that holds wins. */
  variants?: { id: string; when: PortraitCondition }[]
}

export interface PortraitInfo {
  /** Image to show: a state variant if one applies, else the base portrait. */
  id: string
  /** Base portrait (fallback image when the variant has not been generated). */
  base: string
  name: [string, string]
}

export const PORTRAITS = { zork1, zork2, zork3 } as unknown as Record<GameId, { portraits: PortraitDef[] }>

const list = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v])

function compare(a: number, op: Cmp, b: number): boolean {
  switch (op) {
    case '<':
      return a < b
    case '<=':
      return a <= b
    case '=':
      return a === b
    case '>=':
      return a >= b
    case '>':
      return a > b
    case '!=':
      return a !== b
  }
}

/** What the player sees this turn, computed once for all the conditions. */
interface Stage {
  w: World
  here: string
  seen: Set<string>
}

function holds(s: Stage, c: PortraitCondition): boolean {
  const { w } = s
  if (c.present && !s.seen.has(c.present)) return false
  if (c.rooms && !c.rooms.includes(s.here)) return false
  if (list(c.flag).some((f) => !w.flag(f))) return false
  if (list(c.notFlag).some((f) => w.flag(f))) return false
  if (c.objectIn && w.loc(c.objectIn[0]) !== c.objectIn[1]) return false
  if (c.near && !w.has(c.near) && w.loc(c.near) !== s.here) return false
  if (c.global && !compare((w.global(c.global[0]) << 16) >> 16, c.global[1], c.global[2])) return false
  if (c.prop && !compare(w.prop(c.prop[0], c.prop[1]), c.prop[2], c.prop[3])) return false
  return true
}

/** The characters on stage, in the order of the game's list (none in the dark). */
export function portraitsFor(game: Game): PortraitInfo[] {
  const w = new World(game)
  if (!w.lit()) return []
  const stage: Stage = { w, here: w.here(), seen: new Set([...w.visible(), ...w.localGlobals()].map((o) => w.name(o))) }
  const out: PortraitInfo[] = []
  for (const p of PORTRAITS[game.id].portraits) {
    if (!p.when.some((c) => holds(stage, c))) continue
    const v = p.variants?.find((x) => holds(stage, x.when))
    out.push({ id: v?.id ?? p.id, base: p.id, name: p.name })
  }
  return out
}

let manifest: Promise<Set<string>> | null = null

/** Portraits that have an image (public/portraits/manifest.json, written by the image tools). */
export function portraitManifest(): Promise<Set<string>> {
  if (!manifest) {
    manifest = fetch(`${import.meta.env.BASE_URL}portraits/manifest.json`)
      .then((r) => (r.ok ? r.json() : { portraits: [] }))
      .then((m: { portraits?: string[] }) => new Set(m.portraits ?? []))
      .catch(() => new Set<string>())
  }
  return manifest
}
