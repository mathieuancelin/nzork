// Which picture goes with which object. The list of each game lives in src/data/<game>/items.json,
// the prompts in tools/images/item-prompts.json; generated pictures are published in
// public/items/ with a manifest. Until then, a small pixel glyph stands in for each kind of
// object. Zork II reuses the pictures of the objects it shares with Zork I (the brass lantern,
// the elvish sword, the matchbook).
import zork1 from '../data/zork1/items.json'
import zork2 from '../data/zork2/items.json'
import type { GameId } from '../engine/games'

const ITEMS: Record<GameId, { items: { id: string; objects: string[] }[] }> = { zork1, zork2, zork3: { items: [] } }
const byObject = new Map<GameId, Map<string, string>>()

/** Picture of an object (its ZIL name, e.g. "LAMP"). */
export function itemImageId(objName: string, game: GameId = 'zork1'): string {
  let m = byObject.get(game)
  if (!m) {
    byObject.set(game, (m = new Map()))
    for (const it of ITEMS[game].items) for (const o of it.objects) m.set(o, it.id)
  }
  return m.get(objName) ?? (game === 'zork1' ? objName.toLowerCase() : `${game}/${objName.toLowerCase()}`)
}

let manifest: Promise<Set<string>> | null = null

/** Objects that have a picture (public/items/manifest.json, written by the image tools). */
export function itemManifest(): Promise<Set<string>> {
  if (!manifest) {
    manifest = fetch(`${import.meta.env.BASE_URL}items/manifest.json`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((m: { items?: string[] }) => new Set(m.items ?? []))
      .catch(() => new Set<string>())
  }
  return manifest
}
