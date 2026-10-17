// Which illustration goes with which room (and state). The scene list lives in
// src/data/scenes.json, the prompts in tools/images/prompts.json; generated images are
// published in public/scenes/ with a manifest.
import scenes from '../data/scenes.json'
import type { Game } from '../engine/game'
import { World } from '../engine/assist/world'

type Condition = { flag?: string; notFlag?: string; objectIn?: [string, string] }

interface SceneDef {
  id: string
  rooms: string[]
  palette?: { sky: string; ground: string }
  variants?: { id: string; when: Condition }[]
}

const byRoom = new Map<string, SceneDef>()
for (const s of (scenes as { scenes: SceneDef[] }).scenes) for (const r of s.rooms) byRoom.set(r, s)

export interface SceneInfo {
  /** Image to show: a state variant if one applies, else the base scene. */
  id: string
  /** Base scene (fallback image when the variant has not been generated). */
  base: string
  sky: string
  ground: string
}

function holds(w: World, c: Condition): boolean {
  if (c.flag && !w.flag(c.flag)) return false
  if (c.notFlag && w.flag(c.notFlag)) return false
  if (c.objectIn && w.loc(c.objectIn[0]) !== c.objectIn[1]) return false
  return true
}

export function sceneFor(game: Game): SceneInfo {
  const roomId = game.status().roomId
  const s = byRoom.get(roomId)
  const base = s?.id ?? roomId.toLowerCase()
  let id = base
  if (s?.variants) {
    const w = new World(game)
    const v = s.variants.find((x) => holds(w, x.when))
    if (v) id = v.id
  }
  return { id, base, sky: s?.palette?.sky ?? '#1b2130', ground: s?.palette?.ground ?? '#2a2016' }
}

import symbols from '../engine/story/symbols.json'

/** Names of all the rooms in the current language (to style room titles in the text). */
export function roomTitles(game: Game): Set<string> {
  const O = symbols.objects as Record<string, number>
  return new Set((scenes as { scenes: SceneDef[] }).scenes.flatMap((s) => s.rooms).map((r) => game.presenter.noun(O[r]).nom))
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
