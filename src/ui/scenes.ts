// Which illustration goes with which room (and state). The scene list of each game lives in
// src/data/<game>/scenes.json, the prompts in tools/images/prompts.json; generated images are
// published in public/scenes/ with a manifest; the scenes of Zork II and III start with their
// game ("zork2-dragon-room"). A scene without an image shows its placeholder.
import zork1 from '../data/zork1/scenes.json'
import zork2 from '../data/zork2/scenes.json'
import zork3 from '../data/zork3/scenes.json'
import type { Game, GameId } from '../engine/game'
import { World } from '../engine/assist/world'
import { allRooms } from '../engine/assist/map'
import type { PlaceId } from './sound/presets'

type Condition = { flag?: string; notFlag?: string; objectIn?: [string, string] }

interface SceneDef {
  id: string
  rooms: string[]
  palette?: { sky: string; ground: string }
  ambience?: string
  variants?: { id: string; when: Condition }[]
}

const SCENES = { zork1, zork2, zork3 } as unknown as Record<GameId, { scenes: SceneDef[] }>
const byRoom = new Map<GameId, Map<string, SceneDef>>()
function sceneDef(game: GameId, room: string): SceneDef | undefined {
  let m = byRoom.get(game)
  if (!m) {
    byRoom.set(game, (m = new Map()))
    for (const s of SCENES[game].scenes) for (const r of s.rooms) m.set(r, s)
  }
  return m.get(room)
}

export interface SceneInfo {
  /** Image to show: a state variant if one applies, else the base scene. */
  id: string
  /** Base scene (fallback image when the variant has not been generated). */
  base: string
  sky: string
  ground: string
  /** What lights the place: daylight (or its own light), the brass lantern, or a flame. */
  light: 'day' | 'lamp' | 'flame'
  /** Strength of the lantern, 1 when new, 0 when burned out (1 for the other lights). */
  strength: number
  /** Ambience of the place, for the little animations. */
  ambience: PlaceId
}

/** Turns of light of a new lantern: the stages of LAMP-TABLE (Zork I 200 + 100 + 70 + 15, Zork II 200 + 300 + 100 + 50, Zork III 300 + 100 + 50). */
const LAMP_LIFE: Record<GameId, number> = { zork1: 385, zork2: 650, zork3: 450 }

function lightOf(w: World, room: string): Pick<SceneInfo, 'light' | 'strength'> {
  if (w.roomLit(room)) return { light: 'day', strength: 1 }
  const on = (o: string) => w.hasObject(o) && w.carried(o) && w.attr(o, 'ONBIT')
  if (on('LAMP')) return { light: 'lamp', strength: Math.min(1, w.lampTurnsLeft() / LAMP_LIFE[w.id]) }
  return { light: 'flame', strength: 1 }
}

function holds(w: World, c: Condition): boolean {
  if (c.flag && !w.flag(c.flag)) return false
  if (c.notFlag && w.flag(c.notFlag)) return false
  if (c.objectIn && w.loc(c.objectIn[0]) !== c.objectIn[1]) return false
  return true
}

/** Without a scene, a room still gets its own (missing) picture, named after the game. */
const fallbackId = (game: GameId, roomId: string) => (game === 'zork1' ? roomId.toLowerCase() : `${game}-${roomId.toLowerCase()}`)

export function sceneFor(game: Game): SceneInfo {
  const roomId = game.status().roomId
  const s = sceneDef(game.id, roomId)
  const base = s?.id ?? fallbackId(game.id, roomId)
  const w = new World(game)
  let id = base
  if (s?.variants) {
    const v = s.variants.find((x) => holds(w, x.when))
    if (v) id = v.id
  }
  return { id, base, sky: s?.palette?.sky ?? '#1b2130', ground: s?.palette?.ground ?? '#2a2016', ...lightOf(w, roomId), ambience: ambienceFor(game.id, roomId) }
}

/** The base scene of a room (its picture, without the state variants). */
export function sceneOfRoom(game: GameId, roomId: string): { id: string; sky: string; ground: string } | undefined {
  const s = sceneDef(game, roomId)
  return s && { id: s.id, sky: s.palette?.sky ?? '#1b2130', ground: s.palette?.ground ?? '#2a2016' }
}

/** The soundtrack's ambience for a room. */
export function ambienceFor(game: GameId, roomId: string): PlaceId {
  return (sceneDef(game, roomId)?.ambience as PlaceId | undefined) ?? 'cave'
}

/** Names of all the rooms in the current language (to style room titles in the text). */
export function roomTitles(game: Game): Set<string> {
  const w = new World(game)
  return new Set(allRooms(w).map((r) => game.presenter.noun(w.obj(r)).nom))
}

let manifest: Promise<Set<string>> | null = null

/** Scenes that have an image (public/scenes/manifest.json, written by the image tools). */
export function sceneManifest(): Promise<Set<string>> {
  if (!manifest) {
    manifest = fetch(`${import.meta.env.BASE_URL}scenes/manifest.json`)
      .then((r) => (r.ok ? r.json() : { scenes: [] }))
      .then((m: { scenes?: string[] }) => new Set(m.scenes ?? []))
      .catch(() => new Set<string>())
  }
  return manifest
}
