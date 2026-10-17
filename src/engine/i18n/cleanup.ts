// Final touches on French text assembled from fragments.

const QUESTION = /^Que voulez-vous (.+?) (dans|sur|avec|à|sous|derrière|de|par-dessus|pour|autour de|à travers) ?\?$/gm

export function frenchCleanup(text: string): string {
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
      // spaces: never two in a row inside a line, none before a comma or a full stop
      .replace(/(\S) {2,}/g, '$1 ')
      .replace(/ +([,.])/g, '$1')
  )
}
