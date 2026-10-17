// Shared helpers for the image tools. Two kinds of images go through the same pipeline: the
// scenes (480×270 illustrations of the rooms) and the items (48×48 icons of the objects, on a
// transparent background). The tools work on the scenes by default, on the items with --items.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

export const ROOT = fileURLToPath(new URL('../../../', import.meta.url))
export const IMAGES = join(ROOT, 'tools/images')

export type KindName = 'scenes' | 'items'

export interface Kind {
  name: KindName
  /** Prompts file in tools/images/. */
  prompts: string
  /** Raw candidates (git-ignored). */
  out: string
  /** Raw approved images (kept to re-run the post-processing). */
  approved: string
  /** Approved keystones, sent as style references. */
  references: string
  /** Final images used by the game, with their manifest. */
  public: string
}

export const KINDS: Record<KindName, Kind> = {
  scenes: {
    name: 'scenes',
    prompts: 'prompts.json',
    out: join(IMAGES, 'out'),
    approved: join(IMAGES, 'approved'),
    references: join(IMAGES, 'references'),
    public: join(ROOT, 'public/scenes'),
  },
  items: {
    name: 'items',
    prompts: 'item-prompts.json',
    out: join(IMAGES, 'out-items'),
    approved: join(IMAGES, 'approved-items'),
    references: join(IMAGES, 'references-items'),
    public: join(ROOT, 'public/items'),
  },
}

/** The kind chosen on the command line (--items, else the scenes). */
export function kindFromArgs(): Kind {
  return KINDS[flag('items') ? 'items' : 'scenes']
}

export interface PromptEntry {
  prompt: string
  keystone?: boolean
  creatures?: boolean
}

export interface Prompts {
  style: string
  negative: string
  /** Scenes or items, by id. */
  entries: Record<string, PromptEntry>
}

export function loadPrompts(kind: Kind = KINDS.scenes): Prompts {
  const raw = JSON.parse(readFileSync(join(IMAGES, kind.prompts), 'utf8'))
  return { style: raw.style, negative: raw.negative, entries: raw[kind.name] }
}

/** Loads KEY=VALUE lines from .env at the project root (without overriding the environment). */
export function loadDotEnv(): void {
  const file = join(ROOT, '.env')
  if (!existsSync(file)) return
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

export function fullPrompt(p: Prompts, id: string, kind: Kind = KINDS.scenes): string {
  const s = p.entries[id]
  if (kind.name === 'items') return `${p.style}\n\nObject: ${s.prompt}\n\nAvoid: ${p.negative}`
  // scenes that show a creature must not forbid characters
  const style = s.creatures ? p.style.replace(/,?\s*no characters/i, '') : p.style
  const negative = s.creatures ? p.negative.replace(/,?\s*people/i, '').replace(/,?\s*player character/i, '') : p.negative
  return `${style}\n\nScene: ${s.prompt}\n\nAvoid: ${negative}`
}

export function ensureDir(d: string): string {
  mkdirSync(d, { recursive: true })
  return d
}

export function candidates(id: string, kind: Kind = KINDS.scenes): string[] {
  const dir = join(kind.out, id)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
    .sort()
    .map((f) => join(dir, f))
}

export function readManifest(kind: Kind = KINDS.scenes): Set<string> {
  const f = join(kind.public, 'manifest.json')
  if (!existsSync(f)) return new Set()
  return new Set((JSON.parse(readFileSync(f, 'utf8')) as Record<string, string[]>)[kind.name] ?? [])
}

export function writeManifest(ids: Set<string>, kind: Kind = KINDS.scenes): void {
  ensureDir(kind.public)
  writeFileSync(join(kind.public, 'manifest.json'), JSON.stringify({ [kind.name]: [...ids].sort() }, null, 1) + '\n')
}

export function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

export const flag = (name: string) => process.argv.includes(`--${name}`)
