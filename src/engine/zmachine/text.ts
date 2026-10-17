// Z-machine v3 text: decoding of Z-strings and encoding of dictionary words.

const A0 = 'abcdefghijklmnopqrstuvwxyz'
const A1 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const A2 = ' \n0123456789.,!?_#\'"/\\-:()' // index 0 is the ZSCII escape slot (zchar 6)

export interface DecodedString {
  text: string
  /** Address of the first byte after the string. */
  end: number
}

/** Decodes the Z-string at byte address `addr`. */
export function decodeZString(mem: Uint8Array, addr: number, abbrevTable: number, inAbbrev = false): DecodedString {
  const zchars: number[] = []
  let p = addr
  for (;;) {
    const w = (mem[p] << 8) | mem[p + 1]
    p += 2
    zchars.push((w >> 10) & 0x1f, (w >> 5) & 0x1f, w & 0x1f)
    if (w & 0x8000) break
  }
  let out = ''
  let alphabet = 0
  for (let i = 0; i < zchars.length; i++) {
    const z = zchars[i]
    if (z === 0) {
      out += ' '
      alphabet = 0
    } else if (z >= 1 && z <= 3) {
      if (inAbbrev) throw new Error('nested abbreviation')
      const next = zchars[++i]
      if (next === undefined) break
      const index = 32 * (z - 1) + next
      const wordAddr = (mem[abbrevTable + index * 2] << 8) | mem[abbrevTable + index * 2 + 1]
      out += decodeZString(mem, wordAddr * 2, abbrevTable, true).text
      alphabet = 0
    } else if (z === 4) {
      alphabet = 1
    } else if (z === 5) {
      alphabet = 2
    } else {
      if (alphabet === 2 && z === 6) {
        const hi = zchars[++i]
        const lo = zchars[++i]
        if (hi === undefined || lo === undefined) break
        out += zsciiToString((hi << 5) | lo)
      } else if (alphabet === 0) {
        out += A0[z - 6]
      } else if (alphabet === 1) {
        out += A1[z - 6]
      } else {
        out += A2[z - 6]
      }
      alphabet = 0
    }
  }
  return { text: out, end: p }
}

export function zsciiToString(code: number): string {
  if (code === 13) return '\n'
  if (code >= 32 && code <= 126) return String.fromCharCode(code)
  return ''
}

/** Encodes a word as the 4-byte (6 z-char) v3 dictionary key. */
export function encodeDictWord(word: string): number[] {
  const z: number[] = []
  for (const ch of word.toLowerCase()) {
    if (z.length >= 6) break
    const a0 = A0.indexOf(ch)
    if (a0 >= 0) {
      z.push(a0 + 6)
      continue
    }
    const a2 = A2.indexOf(ch)
    if (a2 > 0) {
      z.push(5, a2 + 6)
      continue
    }
    const code = ch.charCodeAt(0)
    z.push(5, 6, (code >> 5) & 0x1f, code & 0x1f)
  }
  while (z.length < 6) z.push(5)
  z.length = 6
  const w1 = (z[0] << 10) | (z[1] << 5) | z[2]
  const w2 = 0x8000 | (z[3] << 10) | (z[4] << 5) | z[5]
  return [w1 >> 8, w1 & 0xff, w2 >> 8, w2 & 0xff]
}
