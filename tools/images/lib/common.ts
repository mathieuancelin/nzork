// Shared helpers for the image tools.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

export const ROOT = fileURLToPath(new URL('../../../', import.meta.url))
export const IMAGES = join(ROOT, 'tools/images')
export const OUT = join(IMAGES, 'out') // raw candidates (git-ignored)
export const APPROVED = join(IMAGES, 'approved') // raw approved images (kept to re-run the post-processing)
export const REFERENCES = join(IMAGES, 'references') // approved keystones, sent as style references
export const PUBLIC = join(ROOT, 'public/scenes') // final images used by the game

export interface Prompts {
  style: string
  negative: string
  scenes: Record<string, { prompt: string; keystone?: boolean; creatures?: boolean }>
}

export function loadPrompts(): Prompts {
  return JSON.parse(readFileSync(join(IMAGES, 'prompts.json'), 'utf8'))
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

export function fullPrompt(p: Prompts, id: string): string {
  const s = p.scenes[id]
  // scenes that show a creature must not forbid characters
  const style = s.creatures ? p.style.replace(/,?\s*no characters/i, '') : p.style
  const negative = s.creatures ? p.negative.replace(/,?\s*people/i, '').replace(/,?\s*player character/i, '') : p.negative
  return `${style}\n\nScene: ${s.prompt}\n\nAvoid: ${negative}`
}

export function ensureDir(d: string): string {
  mkdirSync(d, { recursive: true })
  return d
}

export function candidates(id: string): string[] {
  const dir = join(OUT, id)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
    .sort()
    .map((f) => join(dir, f))
}

export function readManifest(): Set<string> {
  const f = join(PUBLIC, 'manifest.json')
  if (!existsSync(f)) return new Set()
  return new Set((JSON.parse(readFileSync(f, 'utf8')) as { scenes?: string[] }).scenes ?? [])
}

export function writeManifest(ids: Set<string>): void {
  ensureDir(PUBLIC)
  writeFileSync(join(PUBLIC, 'manifest.json'), JSON.stringify({ scenes: [...ids].sort() }, null, 1) + '\n')
}

export function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

export const flag = (name: string) => process.argv.includes(`--${name}`)
