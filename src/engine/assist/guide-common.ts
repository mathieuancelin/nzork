// What the guides of the three games share: the step they suggest, and how a command is built
// from the game's own words.
import type { World, Direction } from './world'

export interface GuideStep {
  command: string
  /** What the step achieves, for the "Pourquoi ?" button. */
  why: [string, string]
  /** For the choice label. */
  verb?: string
  obj?: string
  prep?: string
  obj2?: string
  dir?: Direction
  /** Label of the choice when the command is not a plain verb and object ("Régler le cadran sur 776"). */
  label?: [string, string]
}

const word = (w: World, name: string) => w.word(w.obj(name)) ?? name.toLowerCase()

export function verbStep(w: World, verb: string, obj: string | undefined, why: [string, string], prep?: string, obj2?: string): GuideStep {
  let command = verb
  if (obj) command += ' ' + word(w, obj)
  if (prep && obj2) command += ` ${prep} ${word(w, obj2)}`
  return { command, why, verb, obj, prep, obj2 }
}

/** Takes an object, opening its closed container first if needed. */
export function takeStep(w: World, obj: string, why: [string, string]): GuideStep {
  const o = w.obj(obj)
  const parent = w.vm.parent(o)
  const container = w.name(parent)
  if (parent && w.attrOf(parent, 'CONTBIT') && !w.attrOf(parent, 'OPENBIT') && !w.attrOf(parent, 'TRANSBIT') && w.word(parent)) {
    return verbStep(w, 'open', container, why)
  }
  return verbStep(w, 'take', obj, why)
}
