// Runs the original game in dfrotz and returns a normalised transcript.
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const STORY = fileURLToPath(new URL('../../src/engine/story/zork1.z3', import.meta.url))

/** Whether dfrotz is installed (the comparison tests are skipped otherwise). */
export const HAS_DFROTZ = !spawnSync('dfrotz', ['-v']).error

export function dfrotzTranscript(commands: string[], seed: number): string {
  const input = commands.join('\n') + '\n'
  const raw = execFileSync('dfrotz', ['-m', '-q', '-p', '-w', '1000', '-h', '1000', '-s', String(seed), STORY], {
    input,
    encoding: 'utf8',
  })
  return normalise(raw)
}

/** Removes the status lines and reflows the text so both interpreters can be compared. */
export function normalise(raw: string): string {
  return raw
    .split('\n')
    .filter((l) => !/^>?\s*\S.*\s+Score:\s*-?\d+\s+Moves:\s*\d+\s*$/.test(l))
    .map((l) => l.replace(/^>/, ''))
    .join('\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Collapses all whitespace: dfrotz wraps long lines, we never do. */
export function flatten(text: string): string {
  return normalise(text).replace(/\s+/g, ' ')
}
