// French grammar helpers for the text templates.
//
// Template placeholders:
//   {0}          raw argument (object name, number, string…)
//   {le:0}       definite article + name: le coffre, la lampe, l'épée, les feuilles
//   {un:0}       indefinite article: un coffre, une lampe, des feuilles
//   {du:0}       partitive / "de + le": du coffre, de la lampe, de l'épée, des feuilles
//   {au:0}       "à + le": au coffre, à la lampe, à l'épée, aux feuilles
//   {de:0}       de coffre, d'épée (after a negation)
//   {ce:0}       ce coffre, cet œuf, cette lampe, ces feuilles
//   {il:0}       il / elle / ils / elles      {lui:0}  le / la / l' / les (object pronoun)
//   {e:0}        agreement suffix: "" / e / s / es
//   {s:0}        "s" when the number argument is not 1
//   {g:0|m|f|mp|fp}  explicit choice by gender / number (mp and fp default to m and f + s)
// A capitalised function name capitalises the result ({Le:0}). The reference can also be
// "+" (the next object printed) or "-" (the last object printed).

export interface FrNoun {
  /** Name without article: "boîte aux lettres". */
  nom: string
  g: 'm' | 'f'
  n?: 's' | 'p'
  /** Forces (true) or prevents (false) elision; by default, elision before a vowel or a mute h. */
  elision?: boolean
  /** Proper names and pronouns take no article. */
  article?: false
}

const VOWEL = /^[aeiouyàâäéèêëîïôöùûüœæh]/i

export function elides(n: FrNoun): boolean {
  if (n.elision !== undefined) return n.elision
  return VOWEL.test(n.nom)
}

const plural = (n: FrNoun) => n.n === 'p'

export function capitalize(s: string): string {
  return s ? s[0].toLocaleUpperCase('fr') + s.slice(1) : s
}

export function withArticle(fn: string, n: FrNoun): string {
  const name = n.nom
  if (n.article === false) {
    if (fn === 'de' || fn === 'du') return (elides(n) ? "d'" : 'de ') + name
    if (fn === 'au') return 'à ' + name
    return name
  }
  const p = plural(n)
  const f = n.g === 'f'
  const el = elides(n)
  switch (fn) {
    case 'le':
      return p ? `les ${name}` : el ? `l'${name}` : f ? `la ${name}` : `le ${name}`
    case 'un':
      return p ? `des ${name}` : f ? `une ${name}` : `un ${name}`
    case 'du':
      return p ? `des ${name}` : el ? `de l'${name}` : f ? `de la ${name}` : `du ${name}`
    case 'au':
      return p ? `aux ${name}` : el ? `à l'${name}` : f ? `à la ${name}` : `au ${name}`
    case 'de':
      return el ? `d'${name}` : `de ${name}`
    case 'ce':
      return p ? `ces ${name}` : f ? `cette ${name}` : el ? `cet ${name}` : `ce ${name}`
    default:
      return name
  }
}

export function pronoun(fn: string, n: FrNoun): string {
  const p = plural(n)
  const f = n.g === 'f'
  if (fn === 'il') return p ? (f ? 'elles' : 'ils') : f ? 'elle' : 'il'
  // The elision of an object pronoun depends on the next word (the verb): it is resolved by
  // `finishText` thanks to the marker.
  if (fn === 'lui') return p ? 'les' : PRONOUN_MARK + (f ? 'la' : 'le')
  return ''
}

export function agreement(n: FrNoun): string {
  return (n.g === 'f' ? 'e' : '') + (plural(n) ? 's' : '')
}

export function choose(n: FrNoun, options: string[]): string {
  const [m, f, mp, fp] = options
  if (plural(n)) return n.g === 'f' ? (fp ?? (f ?? m) + 's') : (mp ?? m + 's')
  return n.g === 'f' ? (f ?? m) : m
}

export const PRONOUN_MARK = '\u0001'
/** Marks a definite article produced by a template, so that only real articles contract. */
export const ARTICLE_MARK = '\u0002'

/** Marks "le X" / "les X" produced for an object (contractible with "de" / "à"). */
export function markArticle(s: string): string {
  return /^les? /.test(s) ? ARTICLE_MARK + s : s
}

/** Final French clean-up of a rendered text. */
export function finishText(s: string): string {
  return s
    .replace(new RegExp(PRONOUN_MARK + "(le|la) (?=[aeiouyhàâäéèêëîïôöùûüœ])", 'gi'), "l'")
    .replace(new RegExp(PRONOUN_MARK, 'g'), '')
    // "de" / "à" + an article of an object: du, des, au, aux (never a pronoun: "à le ligoter")
    .replace(new RegExp(`(?<!\\p{L})(de|à|De|À) ${ARTICLE_MARK}(les?) `, 'gu'), (_m, p: string, a: string) => {
      const lower = p.toLowerCase() === 'de' ? (a === 'le' ? 'du' : 'des') : a === 'le' ? 'au' : 'aux'
      return (p[0] === p[0].toUpperCase() ? lower[0].toUpperCase() + lower.slice(1) : lower) + ' '
    })
    .replace(new RegExp(ARTICLE_MARK, 'g'), '')
}

export const ARTICLE_FNS = new Set(['le', 'un', 'du', 'au', 'de', 'ce'])
export const PRONOUN_FNS = new Set(['il', 'lui'])
