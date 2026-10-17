// Labels of the clickable choices, in French or English.
import type { Game } from '../game'
import { capitalize, withArticle } from '../i18n/grammar'
import type { Direction } from './world'

const DIR_FR: Record<Direction, string> = {
  NORTH: 'Nord', SOUTH: 'Sud', EAST: 'Est', WEST: 'Ouest', NE: 'Nord-est', NW: 'Nord-ouest', SE: 'Sud-est', SW: 'Sud-ouest',
  UP: 'Monter', DOWN: 'Descendre', IN: 'Entrer', OUT: 'Sortir',
}
const DIR_EN: Record<Direction, string> = {
  NORTH: 'North', SOUTH: 'South', EAST: 'East', WEST: 'West', NE: 'Northeast', NW: 'Northwest', SE: 'Southeast', SW: 'Southwest',
  UP: 'Up', DOWN: 'Down', IN: 'In', OUT: 'Out',
}

/** French infinitive and English imperative of the canonical verbs. */
export const VERB_LABELS: Record<string, [string, string]> = {
  take: ['Prendre', 'Take'],
  drop: ['Poser', 'Drop'],
  open: ['Ouvrir', 'Open'],
  close: ['Fermer', 'Close'],
  read: ['Lire', 'Read'],
  light: ['Allumer', 'Light'],
  'turn on': ['Allumer', 'Turn on'],
  'turn off': ['Éteindre', 'Turn off'],
  extinguish: ['Éteindre', 'Extinguish'],
  eat: ['Manger', 'Eat'],
  drink: ['Boire', 'Drink'],
  examine: ['Examiner', 'Examine'],
  attack: ['Attaquer', 'Attack'],
  kill: ['Tuer', 'Kill'],
  put: ['Mettre', 'Put'],
  give: ['Donner', 'Give'],
  tie: ['Attacher', 'Tie'],
  move: ['Déplacer', 'Move'],
  push: ['Appuyer sur', 'Push'],
  turn: ['Tourner', 'Turn'],
  inflate: ['Gonfler', 'Inflate'],
  board: ['Monter dans', 'Board'],
  launch: ['Mettre à l’eau', 'Launch'],
  disembark: ['Débarquer de', 'Get out of'],
  dig: ['Creuser', 'Dig'],
  wave: ['Agiter', 'Wave'],
  ring: ['Sonner', 'Ring'],
  rub: ['Frotter', 'Rub'],
  lower: ['Descendre', 'Lower'],
  raise: ['Hisser', 'Raise'],
  wind: ['Remonter', 'Wind'],
  climb: ['Grimper à', 'Climb'],
  'look in': ['Regarder dans', 'Look in'],
  search: ['Fouiller', 'Search'],
  wear: ['Mettre', 'Wear'],
}

const PREP_FR: Record<string, string> = { in: 'dans', on: 'sur', with: 'avec', to: 'à', at: 'sur', under: 'sous' }

export class Labeler {
  constructor(private game: Game) {}

  get fr(): boolean {
    return this.game.lang === 'fr'
  }

  dir(d: Direction): string {
    return (this.fr ? DIR_FR : DIR_EN)[d]
  }

  /** "la lanterne en laiton" / "the brass lantern" */
  thing(obj: number, fn = 'le'): string {
    const n = this.game.presenter.noun(obj)
    if (this.fr) return withArticle(fn, n)
    return n.article === false ? n.nom : `the ${n.nom}`
  }

  /** Label of "verb obj [prep obj2]". */
  action(verb: string, obj?: number, prep?: string, obj2?: number): string {
    const [vfr, ven] = VERB_LABELS[verb] ?? [capitalize(verb), capitalize(verb)]
    if (this.fr) {
      let s = vfr
      if (obj) s += ' ' + this.thing(obj)
      if (prep && obj2) {
        const p = PREP_FR[prep] ?? prep
        s += ' ' + (p === 'à' ? this.thing(obj2, 'au') : `${p} ${this.thing(obj2)}`)
      }
      return s.replace(/ de le /g, ' du ').replace(/ de les /g, ' des ')
    }
    let s = ven
    if (obj) s += ' ' + this.thing(obj)
    if (prep && obj2) s += ` ${prep} ${this.thing(obj2)}`
    return s
  }

  text(fr: string, en: string): string {
    return this.fr ? fr : en
  }
}
