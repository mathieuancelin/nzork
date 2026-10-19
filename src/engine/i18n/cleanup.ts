// Final touches on French text assembled from fragments.

const QUESTION = /^Que voulez-vous (.+?) (dans|sur|avec|à|sous|derrière|de|par-dessus|pour|autour de|à travers) ?\?$/gm

/** A line of the Royal Puzzle map of Zork III ("      +MM    GG+"), drawn in a fixed font. */
const DRAWING = /\+[A-Z?. ]{8}\+/

export function frenchCleanup(text: string): string {
  // the drawings keep their spaces and their "??"
  const lines = text.split('\n')
  if (lines.some((l) => DRAWING.test(l))) return lines.map((l) => (DRAWING.test(l) ? l : frenchCleanup(l))).join('\n')
  return (
    text
      // "Que voulez-vous mettre la lanterne dans ?" → "Dans quoi voulez-vous mettre la lanterne ?"
      .replace(QUESTION, (_m, what: string, prep: string) => `${prep[0].toUpperCase()}${prep.slice(1)} quoi voulez-vous ${what} ?`)
      // elision created by joining fragments ("de épée" → "d'épée")
      .replace(/(?<!\p{L})(de|que|ne) ([aeiouyàâéèêîôû])/giu, (_m, w: string, v: string) => `${w[0]}'${v}`)
      // English serial comma in lists: "un X, un Y, et un Z", "le X, le Y, ou le Z"
      .replace(/, et (un|une|des) /g, ' et $1 ')
      .replace(/, ou (le|la|les|l')/g, ' ou $1')
      // French spacing before ? ! ; (single characters printed by the game), once per run of signs
      .replace(/([^\s(«\n?!;])([?!;]+)(?=[\s)»]|$)/gm, '$1 $2')
      // spaces: never two in a row inside a line, none before a comma or a full stop (the
      // indentation of a line stays: "  .. = votre position")
      .replace(/(\S) {2,}/g, '$1 ')
      .replace(/(\S) +([,.])/g, '$1$2')
  )
}
