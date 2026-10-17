// Aligns the routines of the ZIL source with the routines of the compiled story file, using the
// strings each routine contains. Both lists follow the compilation order, so a sequence
// alignment (Needleman-Wunsch) with a string-overlap score recovers the correspondence.

import type { ZilRoutine } from '../zil/load'
import type { Routine } from '../../src/engine/zmachine/disasm'
import { decodeZString } from '../../src/engine/zmachine/text'

const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

export function storyRoutineStrings(mem: Uint8Array, r: Routine, strings: Map<number, string>): string[] {
  const abbrevs = (mem[0x18] << 8) | mem[0x19]
  const out: string[] = []
  for (const i of r.instrs) {
    if (i.text !== undefined) out.push(i.text)
    // constant operands that are packed addresses of strings in the string area
    i.operands.forEach((v, k) => {
      if (i.types[k] === 0 && strings.has(v * 2)) out.push(strings.get(v * 2)!)
    })
    if (i.name === 'print_paddr' && i.types[0] === 0 && !strings.has(i.operands[0] * 2)) {
      out.push(decodeZString(mem, i.operands[0] * 2, abbrevs).text)
    }
  }
  return out
}

export function alignRoutines(zil: ZilRoutine[], story: Routine[], storyStrings: string[][]): Map<number, string> {
  const zs = zil.map((r) => new Set(r.strings.map(norm).filter((s) => s.length > 1)))
  const ss = storyStrings.map((l) => new Set(l.map(norm).filter((s) => s.length > 1)))
  const n = zil.length
  const m = story.length
  const score = (i: number, j: number) => {
    const a = zs[i]
    const b = ss[j]
    if (a.size === 0 && b.size === 0) return 1
    if (a.size === 0 || b.size === 0) return -1
    let common = 0
    for (const x of a) if (b.has(x)) common++
    return common === 0 ? -3 : 2 + (4 * common) / Math.max(a.size, b.size)
  }
  const GAP = -2
  const dp: Float64Array[] = Array.from({ length: n + 1 }, () => new Float64Array(m + 1))
  const bt: Uint8Array[] = Array.from({ length: n + 1 }, () => new Uint8Array(m + 1))
  for (let i = 1; i <= n; i++) {
    dp[i][0] = i * GAP
    bt[i][0] = 1
  }
  for (let j = 1; j <= m; j++) {
    dp[0][j] = j * GAP
    bt[0][j] = 2
  }
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const diag = dp[i - 1][j - 1] + score(i - 1, j - 1)
      const up = dp[i - 1][j] + GAP
      const left = dp[i][j - 1] + GAP
      if (diag >= up && diag >= left) {
        dp[i][j] = diag
        bt[i][j] = 0
      } else if (up >= left) {
        dp[i][j] = up
        bt[i][j] = 1
      } else {
        dp[i][j] = left
        bt[i][j] = 2
      }
    }
  }
  const result = new Map<number, string>()
  let i = n
  let j = m
  while (i > 0 && j > 0) {
    if (bt[i][j] === 0) {
      result.set(story[j - 1].addr, zil[i - 1].name)
      i--
      j--
    } else if (bt[i][j] === 1) i--
    else j--
  }
  return result
}
