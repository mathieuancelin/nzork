// Which picture goes with which object. The list lives in src/data/items.json, the prompts in
// tools/images/item-prompts.json; generated pictures are published in public/items/ with a
// manifest. Until then, a small pixel glyph stands in for each kind of object.
import items from '../data/items.json'

const byObject = new Map<string, string>()
for (const it of items.items) for (const o of it.objects) byObject.set(o, it.id)

/** Picture of an object (its ZIL name, e.g. "LAMP"). */
export function itemImageId(objName: string): string {
  return byObject.get(objName) ?? objName.toLowerCase()
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
