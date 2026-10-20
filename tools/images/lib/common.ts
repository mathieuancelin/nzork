// Shared helpers for the image tools. Three kinds of images go through the same pipeline: the
// scenes (480×270 illustrations of the rooms), the items (48×48 icons of the objects, on a
// transparent background) and the portraits (128×128 close-ups of the characters). The tools
// work on the scenes by default, on the items with --items, on the portraits with --portraits,
// and on Zork I by default, on another game with --game zork2.
//
// Zork I's prompts live at the root of tools/images/, the other games' in tools/images/<game>/.
// The images of every game share the candidates, approved and published folders: the ids of
// Zork II and III start with their game ("zork2-dragon-room"). Zork I's keystones are the style
// references of the whole trilogy, with the same 64-color palette; a game's own keystones join
// them (references/<game>/).
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { isGameId, type GameId } from '../../../src/engine/games'

export const ROOT = fileURLToPath(new URL('../../../', import.meta.url))
export const IMAGES = join(ROOT, 'tools/images')

export type KindName = 'scenes' | 'items' | 'portraits'

export interface Kind {
  name: KindName
  game: GameId
  /** Prompts file (absolute path). */
  prompts: string
  /** Raw candidates (git-ignored). */
  out: string
  /** Raw approved images (kept to re-run the post-processing). */
  approved: string
  /** Approved keystones of this game, sent as style references. */
  references: string
  /** Final images used by the game, with their manifest. */
  public: string
}

/** Where a game's prompts and descriptions live (Zork I: tools/images/ itself). */
export const gameDir = (game: GameId) => (game === 'zork1' ? IMAGES : join(IMAGES, game))

export function kinds(game: GameId = 'zork1'): Record<KindName, Kind> {
  const sub = (dir: string) => (game === 'zork1' ? dir : join(dir, game))
  return {
    scenes: {
      name: 'scenes',
      game,
      prompts: join(gameDir(game), 'prompts.json'),
      out: join(IMAGES, 'out'),
      approved: join(IMAGES, 'approved'),
      references: sub(join(IMAGES, 'references')),
      public: join(ROOT, 'public/scenes'),
    },
    items: {
      name: 'items',
      game,
      prompts: join(gameDir(game), 'item-prompts.json'),
      out: join(IMAGES, 'out-items'),
      approved: join(IMAGES, 'approved-items'),
      references: sub(join(IMAGES, 'references-items')),
      public: join(ROOT, 'public/items'),
    },
    portraits: {
      name: 'portraits',
      game,
      prompts: join(gameDir(game), 'portrait-prompts.json'),
      out: join(IMAGES, 'out-portraits'),
      approved: join(IMAGES, 'approved-portraits'),
      references: sub(join(IMAGES, 'references-portraits')),
      public: join(ROOT, 'public/portraits'),
    },
  }
}

export const KINDS = kinds('zork1')

/** The game chosen on the command line (--game zork2), Zork I by default. */
export function gameFromArgs(): GameId {
  const g = arg('game') ?? 'zork1'
  if (!isGameId(g)) throw new Error(`Unknown game "${g}" (zork1, zork2 or zork3)`)
  return g
}

/** The kind chosen on the command line (--items, --portraits, else the scenes), for the chosen game. */
export function kindFromArgs(): Kind {
  return kinds(gameFromArgs())[flag('items') ? 'items' : flag('portraits') ? 'portraits' : 'scenes']
}

const pngs = (dirs: string[]) => dirs.filter((d) => existsSync(d)).flatMap((d) => readdirSync(d).filter((f) => /\.png$/i.test(f)).map((f) => join(d, f)))

/**
 * Style references for a game: Zork I's keystones (the art direction), then the game's own. The
 * portraits fall back on Zork I's keystone scenes until their own keystones are approved.
 */
export function styleReferences(kind: Kind): string[] {
  const refs = pngs([kinds('zork1')[kind.name].references, ...(kind.game === 'zork1' ? [] : [kind.references])])
  return refs.length || kind.name !== 'portraits' ? refs : pngs([KINDS.scenes.references])
}

/** The approved scenes that already show a character (raw images), to keep its looks in its portrait. */
export function sceneReferences(kind: Kind, id: string, prompts: Prompts = loadPrompts(kind)): string[] {
  const scenes = kinds(kind.game).scenes
  return (prompts.entries[id]?.scenes ?? []).map((s) => join(scenes.approved, `${s}.png`)).filter((f) => existsSync(f))
}

export interface PromptEntry {
  prompt: string
  keystone?: boolean
  creatures?: boolean
  /** Portraits: the scenes that show the character, sent as references when they are approved. */
  scenes?: string[]
}

export interface Prompts {
  style: string
  negative: string
  /** Scenes, items or portraits, by id. */
  entries: Record<string, PromptEntry>
}

export function loadPrompts(kind: Kind = KINDS.scenes): Prompts {
  if (!existsSync(kind.prompts)) return { style: '', negative: '', entries: {} }
  const raw = JSON.parse(readFileSync(kind.prompts, 'utf8'))
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

export function fullPrompt(p: Prompts, id: string, kind: Kind = KINDS.scenes, withScenes = false): string {
  const s = p.entries[id]
  if (kind.name === 'items') return `${p.style}\n\nObject: ${s.prompt}\n\nAvoid: ${p.negative}`
  if (kind.name === 'portraits') {
    const looks = withScenes ? '\n\nThe character also appears, smaller, in some of the reference images (a scene of the game): keep exactly the same design, colors and outfit, seen up close.' : ''
    return `${p.style}\n\nCharacter: ${s.prompt}${looks}\n\nAvoid: ${p.negative}`
  }
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
