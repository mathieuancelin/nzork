// A small reader for the ZIL sources (MDL syntax), used by the build tools to recover symbol
// names and the source context of texts. It is not a full MDL reader, only what Zork I uses.

export type Node =
  | { t: 'form'; items: Node[]; line: number; file: string }
  | { t: 'list'; items: Node[]; line: number; file: string }
  | { t: 'str'; v: string; line: number; file: string }
  | { t: 'atom'; v: string; line: number; file: string }
  | { t: 'num'; v: number; line: number; file: string }
  | { t: 'char'; v: string; line: number; file: string }
  | { t: 'prefix'; p: ',' | '.' | "'" | '!' | '%' | '#'; v: Node; line: number; file: string }

const COMMENT: Node = { t: 'atom', v: ';comment', line: 0, file: '' }

const DELIM = new Set(['<', '>', '(', ')', '"', ';', ' ', '\t', '\n', '\r', '\f', '[', ']', '{', '}'])

export function readZil(src: string, file: string): Node[] {
  let i = 0
  let line = 1
  const out: Node[] = []

  const skipWs = () => {
    while (i < src.length) {
      const c = src[i]
      if (c === '\n') {
        line++
        i++
      } else if (c === ' ' || c === '\t' || c === '\r' || c === '\f' || c === '^' && src[i + 1] === 'L') {
        i += c === '^' ? 2 : 1
      } else break
    }
  }

  function readOne(): Node | null {
    skipWs()
    if (i >= src.length) return null
    const c = src[i]
    const ln = line
    if (c === ';') {
      // comment: skip the next form
      i++
      readOne()
      return COMMENT
    }
    if (c === '<' || c === '(' || c === '[') {
      const close = c === '<' ? '>' : c === '(' ? ')' : ']'
      i++
      const items: Node[] = []
      for (;;) {
        skipWs()
        if (i >= src.length) throw new Error(`${file}:${ln}: unterminated ${c}`)
        if (src[i] === close) {
          i++
          break
        }
        if (c === '<' && src[i] === '/' && src[i + 1] === '>') {
          i += 2
          break
        }
        const n = readOne()
        if (n && n !== COMMENT) items.push(n)
      }
      return { t: c === '<' ? 'form' : 'list', items, line: ln, file }
    }
    if (c === '"') {
      i++
      let s = ''
      while (i < src.length && src[i] !== '"') {
        if (src[i] === '\\') {
          i++
          s += src[i]
        } else {
          if (src[i] === '\n') line++
          s += src[i]
        }
        i++
      }
      i++
      return { t: 'str', v: s, line: ln, file }
    }
    if (c === ',' || c === '.' || c === "'" || c === '%') {
      i++
      const v = readOneReal()
      return v ? { t: 'prefix', p: c, v, line: ln, file } : null
    }
    if (c === '!') {
      if (src[i + 1] === '\\') {
        const ch = src[i + 2]
        i += 3
        return { t: 'char', v: ch, line: ln, file }
      }
      i++
      const v = readOneReal()
      return v ? { t: 'prefix', p: '!', v, line: ln, file } : null
    }
    if (c === '#') {
      i++
      const v = readOneReal()
      return v ? { t: 'prefix', p: '#', v, line: ln, file } : null
    }
    if (c === '>' || c === ')' || c === ']') {
      // stray closer (should not happen); skip it
      i++
      return readOne()
    }
    let s = ''
    while (i < src.length && !DELIM.has(src[i])) {
      if (src[i] === '\\') {
        s += src[i + 1]
        i += 2
        continue
      }
      s += src[i++]
    }
    if (/^-?\d+$/.test(s)) return { t: 'num', v: parseInt(s, 10), line: ln, file }
    return { t: 'atom', v: s, line: ln, file }
  }

  /** Reads the next form, skipping comments. */
  function readOneReal(): Node | null {
    for (;;) {
      const n = readOne()
      if (n !== COMMENT) return n
    }
  }

  for (;;) {
    const n = readOneReal()
    if (!n) break
    out.push(n)
  }
  return out
}

export const isForm = (n: Node | undefined, head?: string): n is Extract<Node, { t: 'form' }> =>
  !!n && n.t === 'form' && (head === undefined || (n.items[0]?.t === 'atom' && n.items[0].v === head))

export const atomName = (n: Node | undefined): string | undefined => (n && n.t === 'atom' ? n.v : undefined)

/** Visits every node depth-first. */
export function walk(n: Node, fn: (n: Node) => void): void {
  fn(n)
  if (n.t === 'form' || n.t === 'list') n.items.forEach((c) => walk(c, fn))
  else if (n.t === 'prefix') walk(n.v, fn)
}

/** ZILCH turns line breaks inside strings into spaces and "|" into a newline. */
export function zilText(s: string): string {
  return s.replace(/\r?\n/g, ' ').replace(/\|/g, '\n')
}
