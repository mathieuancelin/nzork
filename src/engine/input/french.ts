// French command analysis: turns "prends la lanterne en laiton puis va au nord" into the
// English words of the game's dictionary ("take brass lantern . north"), and fills the parse
// buffer directly so that every English word points at the French words it comes from. When
// the game repeats a word typed by the player, it shows the French text.

import type { InputContext, InputTranslator, TranslatedInput } from '../game'
import type { GameId } from '../games'
import type { ParseEntry } from '../zmachine/vm'
import { VERBS, DEFAULT_P2, DIRECTIONS, ARTICLES, WORDS, PRONOUNS, MAGIC, PREP_DISPLAY, GAME_WORDS, type VerbDef } from './verbs'

export interface FrObjectWords {
  nom?: string
  g?: 'm' | 'f'
  n?: 's' | 'p'
  mots?: Record<string, string>
  adjectifs?: Record<string, string>
}

export interface FrenchContext extends InputContext {
  lookup(word: string): number
  inScope(obj: number): boolean
}

interface Token {
  raw: string
  norm: string
  start: number
  end: number
  /** A pronoun attached to the verb ("prends-la"). */
  clitic?: boolean
}

interface Out {
  en: string
  pos: number
  len: number
  echo?: string
  /** Gender and number of the object named by a noun phrase (for articles in echoes). */
  noun?: { g: 'm' | 'f'; n?: 's' | 'p' }
}

type Kind = 'noun' | 'adj' | 'word' | 'dir' | 'magic'
interface Match {
  kind: Kind
  candidates: { en: string; obj: number }[]
  start: number
  end: number // token index (exclusive)
}

export const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[’`´]/g, "'")
    .toLowerCase()

const TOKEN_RE = /[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*['’]?|[,.;:!?"«»“”]/gu
/** French and typographic quotes are the game's quote mark. */
const QUOTES = new Set(['"', '«', '»', '“', '”'])

function rawTokens(line: string): Token[] {
  const out: Token[] = []
  for (const m of line.matchAll(TOKEN_RE)) {
    out.push({ raw: m[0], norm: QUOTES.has(m[0]) ? '"' : normalize(m[0]), start: m.index!, end: m.index! + m[0].length })
  }
  return out
}

const keyOf = (s: string) =>
  rawTokens(s)
    .map((t) => t.norm)
    .join(' ')

export class FrenchInput implements InputTranslator {
  private phrases = new Map<string, { kind: Kind; en: string; obj: number }[]>()
  private maxPhrase = 1
  private verbForms = new Map<string, VerbDef>()
  private preps = new Set<string>()
  private maxPrep = 1
  private display = new Map<string, string>()

  /** The game wants what is said between quotes (Zork II: the spells, the riddle). */
  private quoteSay: boolean

  constructor(
    private objects: Record<string, FrObjectWords>,
    game: GameId = 'zork1',
  ) {
    const extra = GAME_WORDS[game]
    this.quoteSay = !!extra.quoteSay
    // the game's own verbs come first: they may give a common French verb another meaning
    const verbs = [...(extra.verbs ?? []), ...VERBS]
    const add = (phrase: string, kind: Kind, en: string, obj = 0) => {
      const k = keyOf(phrase)
      if (!k) return
      if (!this.phrases.has(k)) this.phrases.set(k, [])
      const list = this.phrases.get(k)!
      if (!list.some((x) => x.kind === kind && x.en === en && x.obj === obj)) list.push({ kind, en: en.toLowerCase(), obj })
      this.maxPhrase = Math.max(this.maxPhrase, k.split(' ').length)
    }
    for (const [key, o] of Object.entries(objects)) {
      const obj = Number(key.slice(1))
      for (const [fr, en] of Object.entries(o.mots ?? {})) add(fr, 'noun', en, obj)
      for (const [fr, en] of Object.entries(o.adjectifs ?? {})) add(fr, 'adj', en, obj)
    }
    for (const [fr, en] of Object.entries(DIRECTIONS)) add(fr, 'dir', en)
    for (const [fr, en] of Object.entries(WORDS)) add(fr, 'word', en)
    for (const [fr, en] of Object.entries({ ...MAGIC, ...extra.magic })) add(fr, 'magic', en)
    for (const v of verbs) for (const f of v.forms) if (!this.verbForms.has(f)) this.verbForms.set(f, v)
    for (const p of [...Object.keys(DEFAULT_P2), ...verbs.flatMap((v) => [...Object.keys(v.p1 ?? {}), ...Object.keys(v.p2 ?? {})])]) {
      const k = keyOf(p)
      this.preps.add(k)
      this.maxPrep = Math.max(this.maxPrep, k.split(' ').length)
    }
    // display of English dictionary words (they are truncated to 6 letters in the story file)
    const show = (en: string, fr: string) => {
      const k = en.toLowerCase().slice(0, 6)
      if (!this.display.has(k)) this.display.set(k, fr)
    }
    for (const v of verbs) show(v.en.split(' ')[0], v.inf)
    for (const [en, fr] of Object.entries(PREP_DISPLAY)) show(en, fr)
    for (const o of Object.values(objects)) {
      for (const [fr, en] of Object.entries(o.mots ?? {})) show(en, fr)
      for (const [fr, en] of Object.entries(o.adjectifs ?? {})) show(en, fr)
    }
  }

  displayWord(english: string): string | undefined {
    return this.display.get(english.toLowerCase().slice(0, 6))
  }

  // ------------------------------------------------------------ tokenisation

  /** Splits hyphenated words unless the whole word is known ("nord-est", "arc-en-ciel"). */
  private tokens(line: string): Token[] {
    const out: Token[] = []
    for (const t of rawTokens(line)) {
      if (!t.norm.includes('-') || this.phrases.has(t.norm) || this.verbForms.has(t.norm) || this.preps.has(t.norm)) {
        out.push(t)
        continue
      }
      let pos = t.start
      t.raw.split('-').forEach((part, i) => {
        if (part) {
          const norm = normalize(part)
          out.push({ raw: part, norm, start: pos, end: pos + part.length, clitic: i > 0 && PRONOUNS.has(norm) })
        }
        pos += part.length + 1
      })
    }
    return out
  }

  // ------------------------------------------------------------ translation

  translate(line: string, ctx: InputContext): TranslatedInput {
    const c = ctx as FrenchContext
    const tokens = this.tokens(line)
    const out: Out[] = []

    if (ctx.routine === 'YES?') {
      const first = tokens[0]?.norm ?? ''
      const yes = first.startsWith('o') || first === 'y' || first === 'yes'
      return this.finish(line, [{ en: yes ? 'yes' : 'no', pos: first ? tokens[0].start + 1 : 1, len: first.length }], c)
    }
    if (ctx.routine === 'FINISH') {
      const map: Record<string, string> = { recommencer: 'restart', recommence: 'restart', charger: 'restore', charge: 'restore', restaurer: 'restore', quitter: 'quit', quitte: 'quit', q: 'quit' }
      const first = tokens[0]
      if (first && map[first.norm]) return this.finish(line, [{ en: map[first.norm], pos: first.start + 1, len: first.raw.length }], c)
    }

    // split into clauses
    let clause: Token[] = []
    const flush = (sep?: Token) => {
      if (clause.length) {
        if (out.length) out.push({ en: '.', pos: sep ? sep.start + 1 : clause[0].start + 1, len: 0 })
        out.push(...this.clause(clause, c))
      }
      clause = []
    }
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i]
      if (t.norm === '.' || t.norm === ';' || t.norm === 'puis' || t.norm === 'ensuite') {
        flush(t)
        continue
      }
      if (t.norm === '!' || t.norm === '?' || t.norm === ':') continue
      // quotes matter to the games that read what is said (they are kept for the English parser)
      if (t.norm === '"' && !this.quoteSay) continue
      // "et" followed by a verb starts a new clause
      if (t.norm === 'et' && clause.length && this.isVerbAt(tokens, i + 1)) {
        flush(t)
        continue
      }
      clause.push(t)
    }
    flush()
    return this.finish(line, out, c)
  }

  private isVerbAt(tokens: Token[], i: number): boolean {
    const t = tokens[i]
    if (!t) return false
    if (t.norm === 'puis') return true
    return this.verbForms.has(t.norm) && !this.phrases.get(t.norm)?.some((p) => p.kind === 'noun')
  }

  private finish(line: string, out: Out[], ctx: FrenchContext): TranslatedInput {
    const parse: ParseEntry[] = out.map((o) => ({ dictAddr: ctx.lookup(o.en), length: o.len, position: o.pos }))
    const echoes = new Map<string, string>()
    const nouns = new Map<string, { g: 'm' | 'f'; n?: 's' | 'p' }>()
    for (const o of out) {
      if (o.echo !== undefined) echoes.set(`${o.pos}:${o.len}`, o.echo)
      if (o.noun) nouns.set(`${o.pos}:${o.len}`, o.noun)
    }
    return {
      text: line.toLowerCase(),
      parse,
      echo: (position, length) => echoes.get(`${position}:${length}`),
      echoNoun: (position, length) => nouns.get(`${position}:${length}`),
      english: out.map((o) => o.en),
    }
  }

  private clause(tokens: Token[], ctx: FrenchContext): Out[] {
    let t = tokens
    // "je prends…", "vous ouvrez…", "veuillez ouvrir…"
    if (t.length > 1 && ['je', "j'", 'tu', 'nous', 'vous', 'on', 'veuillez'].includes(t[0].norm) && this.verbForms.has(t[1].norm)) t = t.slice(1)
    if (!t.length) return []

    // talking to someone: "troll, donne-moi la hache"
    const comma = t.findIndex((x) => x.norm === ',')
    if (comma > 0 && this.isVerbAt(t, comma + 1)) {
      const who = this.nounPhrase(t.slice(0, comma), ctx)
      return [...who, { en: ',', pos: t[comma].start + 1, len: 1 }, ...this.clause(t.slice(comma + 1), ctx)]
    }

    // "mets le bateau à l'eau" = launch the boat
    const whole = t.map((x) => x.norm).join(' ')
    // "donne un coup de pied au dragon" = kick the dragon
    const kick = whole.match(/^(donner|donne|donnez|flanquer|flanque|flanquez) un coup de pied (a|au|aux|dans|sur) /)
    if (kick) {
      const n = kick[0].trim().split(' ').length
      return [{ en: 'kick', pos: t[0].start + 1, len: t[0].raw.length, echo: 'donner un coup de pied à' }, ...this.nounPhrase(t.slice(n), ctx)]
    }
    const launch = whole.match(/^(mettre|mets|mettez)( (le|ce) (bateau|canot))? a l' ?eau$/)
    if (launch) return [{ en: 'launch', pos: t[0].start + 1, len: t[0].raw.length, echo: 'mettre à l\u2019eau' }]

    // a direction alone ("nord" may also be an adjective, of a wall or a door)
    const dir = this.matchAt(t, 0, 'dir')
    if (dir && dir.kind === 'dir' && dir.end === t.length) return [this.out(dir, t, ctx)]

    // "où est la lampe ?"
    if (t[0].norm === 'ou' && t[1] && ['est', 'sont', 'se', 'trouve'].includes(t[1].norm)) {
      const rest = t.slice(t[1].norm === 'se' ? 3 : 2)
      return [{ en: 'find', pos: t[0].start + 1, len: t[0].raw.length, echo: 'trouver' }, ...this.nounPhrase(rest, ctx)]
    }

    // pronoun before the verb: "le prendre"
    let pronounBefore: Token | undefined
    if (t.length > 1 && ['le', 'la', 'les', "l'"].includes(t[0].norm) && this.verbForms.has(t[1].norm)) {
      pronounBefore = t[0]
      t = t.slice(1)
    }

    const verb = this.verbForms.get(t[0].norm)
    if (!verb || this.phrases.get(t[0].norm)?.some((p) => p.kind === 'magic')) {
      // no verb: an answer to a question ("la boîte") or a magic word
      return this.nounPhrase(t, ctx)
    }
    const vTok = t[0]
    let rest = t.slice(1)

    // clitic pronoun: "prends-la"; "donne-moi la baguette" = give the wand to me
    let pronoun: Token | undefined = pronounBefore
    let toMe: Token | undefined
    while (rest.length && rest[0].clitic) {
      if (rest[0].norm !== 'moi') pronoun = rest[0]
      else toMe = rest[0]
      rest = rest.slice(1)
    }

    // movement: "va au nord", "aller vers l'est"
    if (verb.en === 'walk' || verb.alone === 'up' || verb.alone === 'down' || verb.alone === 'enter' || verb.alone === 'exit') {
      const skip = rest.findIndex((x) => !['vers', 'au', 'a', "l'", 'le', 'la', 'en', 'direction', 'de', 'du', 'par', 'droit'].includes(x.norm))
      if (skip >= 0) {
        const m = this.matchAt(rest, skip, 'dir')
        if (m && m.kind === 'dir' && m.end === rest.length) return [this.out(m, rest, ctx)]
      }
    }

    // preposition right after the verb ("regarder sous", "monter dans")
    let phrase: string | undefined
    let p1Tok: Token | undefined
    if (verb.p1 && rest.length) {
      for (let n = Math.min(this.maxPrep, rest.length); n >= 1; n--) {
        const k = rest.slice(0, n).map((x) => x.norm).join(' ')
        if (verb.p1[k] !== undefined) {
          phrase = verb.p1[k]
          p1Tok = rest[0]
          rest = rest.slice(n)
          break
        }
      }
    }

    // split the rest into first object, preposition, second object
    const p2map = { ...DEFAULT_P2, ...(verb.p2 ?? {}) }
    let np1: Token[] = rest
    let np2: Token[] = []
    let prepEn: string | undefined
    let prepTok: Token | undefined
    {
      let i = 0
      let content = false
      while (i < rest.length) {
        const m = this.matchAt(rest, i)
        if (m && m.kind !== 'word') {
          content = true
          i = m.end
          continue
        }
        if (content || pronoun) {
          let found = false
          for (let n = Math.min(this.maxPrep, rest.length - i); n >= 1; n--) {
            const k = rest.slice(i, i + n).map((x) => x.norm).join(' ')
            if (p2map[k] !== undefined) {
              // "lanterne en laiton", "boîte de bois": a preposition followed by an adjective
              // belongs to the noun phrase
              const after = this.matchAt(rest, i + n)
              if (['en', 'de', "d'", 'a', 'au', 'aux'].includes(k) && after?.kind === 'adj') break
              np1 = rest.slice(0, i)
              np2 = rest.slice(i + n)
              prepEn = p2map[k]
              prepTok = rest[i]
              found = true
              break
            }
          }
          if (found) break
        }
        if (m) {
          if (m.kind === 'word' && m.candidates[0].en !== 'and') content = true
          i = m.end
        } else {
          if (!ARTICLES.has(rest[i].norm)) content = true
          i++
        }
      }
    }

    // what is said goes between quotes ("dis flotte" = say "float")
    if (this.quoteSay && (verb.en === 'say' || verb.en === 'answer') && rest.length && !rest.some((x) => x.norm === '"')) {
      const q = (at: number): Out => ({ en: '"', pos: at, len: 0, echo: '' })
      return [...this.verbOut(verb.alone ?? verb.en, vTok, verb), q(rest[0].start + 1), ...this.nounPhrase(rest, ctx), q(rest[rest.length - 1].end + 1)]
    }
    const first = this.nounPhrase(np1, ctx)
    if (pronoun && !first.length) first.push({ en: 'it', pos: pronoun.start + 1, len: pronoun.raw.length, echo: pronoun.raw })
    const second = this.nounPhrase(np2, ctx)
    if (toMe && !second.length && verb.en === 'give') {
      second.push({ en: 'me', pos: toMe.start + 1, len: toMe.raw.length, echo: toMe.raw })
      prepEn = 'to'
      prepTok = toMe
    }

    const head = first.find((o) => o.echo !== undefined && o.echo !== '')?.en
    let en: string
    if (verb.swap && second.length) {
      const v = this.verbOut(verb.swap.en, vTok, verb)
      return [...v, ...second, { en: verb.swap.prep, pos: prepTok ? prepTok.start + 1 : vTok.start + 1, len: 0 }, ...first]
    }
    if (phrase !== undefined) en = phrase
    else if (second.length && verb.withSecond) en = verb.withSecond
    else if (head && verb.byNoun?.[head]) en = verb.byNoun[head]
    else if (!first.length && verb.alone) en = verb.alone
    else en = verb.en

    const words = this.verbOut(en, vTok, verb, p1Tok)
    const res = [...words, ...first]
    if (second.length) {
      res.push({ en: prepEn ?? 'with', pos: prepTok ? prepTok.start + 1 : vTok.start + 1, len: 0, echo: '' })
      res.push(...second)
    }
    return res
  }

  /** English verb phrase: the first word stands for the French verb (echoed as the infinitive). */
  private verbOut(en: string, vTok: Token, verb: VerbDef, p1Tok?: Token): Out[] {
    return en.split(' ').map((w, i) =>
      i === 0
        ? { en: w, pos: vTok.start + 1, len: vTok.raw.length, echo: verb.inf }
        : { en: w, pos: (p1Tok ?? vTok).start + 1, len: 0, echo: '' },
    )
  }

  /** Longest lexicon phrase starting at token i (of the `prefer`red kind when it can be one). */
  private matchAt(t: Token[], i: number, prefer?: Kind): Match | undefined {
    for (let n = Math.min(this.maxPhrase, t.length - i); n >= 1; n--) {
      const k = t.slice(i, i + n).map((x) => x.norm).join(' ')
      const list = this.phrases.get(k)
      if (!list) continue
      // prefer nouns, then adjectives, then other words
      for (const kind of [...(prefer ? [prefer] : []), 'noun', 'adj', 'dir', 'magic', 'word'] as Kind[]) {
        const c = list.filter((x) => x.kind === kind)
        if (c.length) return { kind, candidates: c, start: i, end: i + n }
      }
    }
    return undefined
  }

  /** Chooses the English word of a match, preferring objects that are present. */
  private pick(m: Match, ctx: FrenchContext): string {
    if (m.candidates.length === 1) return m.candidates[0].en
    const here = m.candidates.filter((c) => c.obj && ctx.inScope(c.obj))
    const pool = here.length ? here : m.candidates
    const count = new Map<string, number>()
    for (const c of pool) count.set(c.en, (count.get(c.en) ?? 0) + 1)
    return [...count].sort((a, b) => b[1] - a[1])[0][0]
  }

  private out(m: Match, t: Token[], ctx: FrenchContext): Out {
    const start = t[m.start].start
    const end = t[m.end - 1].end
    return { en: this.pick(m, ctx), pos: start + 1, len: end - start }
  }

  /**
   * Translates a noun phrase. In each group (separated by "et", "," or "sauf") adjectives come
   * first, then the noun, as the English parser expects. The first English word of a group
   * stands for the whole French group when the game repeats it.
   */
  private nounPhrase(t: Token[], ctx: FrenchContext): Out[] {
    const res: Out[] = []
    let group: { m?: Match; tok?: Token }[] = []
    const flushGroup = () => {
      if (!group.length) return
      type Item = { en: string; kind: Kind | 'raw'; start: number; end: number; raw: string; m?: Match }
      const items = group.map((g): Item => {
        if (g.m) return { en: this.pick(g.m, ctx), kind: g.m.kind, start: t[g.m.start].start, end: t[g.m.end - 1].end, raw: '', m: g.m }
        return { en: g.tok!.norm, kind: 'raw', start: g.tok!.start, end: g.tok!.end, raw: g.tok!.raw }
      })
      const headMatch = items.find((x) => x.kind === 'noun')?.m
      const headObj = headMatch ? (headMatch.candidates.find((c) => c.obj && ctx.inScope(c.obj)) ?? headMatch.candidates[0]).obj : 0
      const headInfo = headObj ? this.objects['o' + headObj] : undefined
      const noun = headInfo?.g ? { g: headInfo.g, n: headInfo.n } : undefined
      // a compound name keeps its distinguishing words: "porte secrète" = secret door
      if (headMatch && headInfo && headMatch.end - headMatch.start > 1) {
        const words = new Set(t.slice(headMatch.start, headMatch.end).map((x) => x.norm))
        for (const [fr, en] of Object.entries(headInfo.adjectifs ?? {})) {
          const k = keyOf(fr)
          if (words.has(k) && !items.some((x) => x.kind === 'adj' && x.en === en.toLowerCase())) {
            items.push({ en: en.toLowerCase(), kind: 'adj', start: t[headMatch.start].start, end: t[headMatch.start].start, raw: '' })
          }
        }
      }
      const order = (k: string) => (k === 'word' ? 0 : k === 'adj' ? 1 : k === 'noun' ? 2 : 3)
      const sorted = [...items].sort((a, b) => order(a.kind) - order(b.kind))
      const start = Math.min(...items.map((x) => x.start))
      const end = Math.max(...items.map((x) => x.end))
      sorted.forEach((x, i) => {
        if (i === 0) res.push({ en: x.en, pos: start + 1, len: end - start, echo: this.lastLine.slice(start, end), noun })
        else res.push({ en: x.en, pos: x.start + 1, len: 0, echo: '' })
      })
      group = []
    }
    let i = 0
    while (i < t.length) {
      const tok = t[i]
      if (tok.norm === ',' || tok.norm === '"') {
        flushGroup()
        res.push({ en: tok.norm, pos: tok.start + 1, len: 1, echo: tok.raw })
        i++
        continue
      }
      const m = this.matchAt(t, i)
      if (m && m.kind === 'word' && ['and', 'except'].includes(m.candidates[0].en)) {
        flushGroup()
        res.push({ en: m.candidates[0].en, pos: tok.start + 1, len: tok.raw.length, echo: tok.raw })
        i = m.end
        continue
      }
      if (m) {
        group.push({ m })
        i = m.end
        continue
      }
      if (ARTICLES.has(tok.norm) || PRONOUNS.has(tok.norm) || ['a', 'au', 'aux', 'en', 'de'].includes(tok.norm)) {
        i++
        continue
      }
      group.push({ tok })
      i++
    }
    flushGroup()
    return res
  }

  /** The current line (original case and accents), for echoes. */
  private lastLine = ''

  /** Entry point used by Game: keeps the original line for echoes. */
  translateLine(line: string, ctx: InputContext): TranslatedInput {
    this.lastLine = line
    return this.translate(line, ctx)
  }
}
