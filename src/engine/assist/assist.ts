// Clickable choices for the "noob" modes, and the guide's suggestion for "hyper noob".
import type { Game } from '../game'
import symbols from '../story/symbols.json'
import { World, DIRECTIONS, DIR_COMMAND } from './world'
import { Labeler } from './labels'
import { guideStep, type GuideStep } from './guide'

const WORDS = symbols.words as Record<string, string>

export type ChoiceGroup = 'move' | 'action' | 'object' | 'inventory' | 'examine' | 'meta'

export interface Choice {
  id: string
  label: string
  /** Canonical (English) command sent to the game. */
  command: string
  group: ChoiceGroup
}

export interface Assist {
  choices: Choice[]
  /** The guide's suggestion (always one of the choices). */
  hint: { id: string; why: string } | null
}

const SKIP = new Set(['ADVENTURER', 'ME', 'IT', 'NOT-HERE-OBJECT', 'PSEUDO-OBJECT', 'INTNUM', 'GLOBAL-OBJECTS', 'LOCAL-GLOBALS', 'ROOMS'])

export function computeAssist(game: Game, withHint: boolean): Assist {
  const w = new World(game)
  const L = new Labeler(game)
  const choices: Choice[] = []
  const seen = new Set<string>()
  const add = (c: Omit<Choice, 'id'>) => {
    if (seen.has(c.command)) return
    seen.add(c.command)
    choices.push({ ...c, id: c.command })
  }
  const word = (n: number) => WORDS[String(n)]

  // --- moves: exits that really lead somewhere (checked by simulation)
  const here = game.status().roomId
  const vehicle = w.inVehicle()
  for (const d of DIRECTIONS) {
    const e = w.exit(here, d)
    if (e.kind !== 'open' && e.kind !== 'function') continue
    const sim = game.simulateCanonical(DIR_COMMAND[d])
    if (sim.status.roomId !== here) add({ label: L.dir(d), command: DIR_COMMAND[d], group: 'move' })
  }
  if (vehicle) add({ label: L.action('disembark', w.obj(vehicle)), command: `disembark ${word(w.obj(vehicle)) ?? 'boat'}`, group: 'move' })

  // --- objects
  const visible = w.visible().filter((n) => !SKIP.has(w.name(n)) && !w.attrOf(n, 'INVISIBLE') && word(n))
  const winner = w.obj('ADVENTURER')
  const weapon = w.children(winner).find((n) => w.attrOf(n, 'WEAPONBIT'))
  for (const n of visible) {
    const held = w.within(w.name(n), 'ADVENTURER')
    const group: ChoiceGroup = held ? 'inventory' : 'object'
    const cmd = (v: string) => `${v} ${word(n)}`
    if (w.attrOf(n, 'ACTORBIT')) {
      if (weapon) add({ label: L.action('attack', n, 'with', weapon), command: `attack ${word(n)} with ${word(weapon)}`, group: 'action' })
      continue
    }
    if (!held && w.attrOf(n, 'TAKEBIT')) add({ label: L.action('take', n), command: cmd('take'), group })
    if ((w.attrOf(n, 'CONTBIT') || w.attrOf(n, 'DOORBIT')) && !w.attrOf(n, 'SURFACEBIT')) {
      if (w.attrOf(n, 'OPENBIT')) {
        if (w.attrOf(n, 'DOORBIT')) add({ label: L.action('close', n), command: cmd('close'), group })
      } else add({ label: L.action('open', n), command: cmd('open'), group })
    }
    if (w.attrOf(n, 'READBIT')) add({ label: L.action('read', n), command: cmd('read'), group })
    if (w.attrOf(n, 'LIGHTBIT') && held) add({ label: L.action(w.attrOf(n, 'ONBIT') ? 'turn off' : 'turn on', n), command: cmd(w.attrOf(n, 'ONBIT') ? 'turn off' : 'turn on'), group })
    if (w.attrOf(n, 'FOODBIT')) add({ label: L.action('eat', n), command: cmd('eat'), group })
    if (w.attrOf(n, 'DRINKBIT')) add({ label: L.action('drink', n), command: cmd('drink'), group })
    if (held && w.vm.parent(n) === winner) add({ label: L.action('drop', n), command: cmd('drop'), group: 'inventory' })
    add({ label: L.action('examine', n), command: cmd('examine'), group: 'examine' })
  }

  // --- meta
  add({ label: L.text('Regarder autour', 'Look around'), command: 'look', group: 'meta' })
  add({ label: L.text('Inventaire', 'Inventory'), command: 'inventory', group: 'meta' })
  add({ label: L.text('Attendre', 'Wait'), command: 'wait', group: 'meta' })

  // --- the guide (its suggestion is always among the choices)
  let hint: Assist['hint'] = null
  const step = guideStep(w)
  if (step) {
    const id = step.command
    if (!seen.has(id)) add({ label: stepLabel(step, w, L), command: step.command, group: step.dir ? 'move' : 'action' })
    if (withHint) hint = { id, why: L.fr ? step.why[0] : step.why[1] }
  }
  return { choices, hint }
}

function stepLabel(step: GuideStep, w: World, L: Labeler): string {
  if (step.dir) return L.dir(step.dir)
  const special: Record<string, [string, string]> = {
    odysseus: ['Dire « Ulysse »', 'Say "Odysseus"'],
    echo: ['Crier « Écho »', 'Shout "Echo"'],
    pray: ['Prier', 'Pray'],
    wait: ['Attendre', 'Wait'],
    launch: ['Mettre le bateau à l’eau', 'Launch the boat'],
    enter: ['Entrer', 'Enter'],
    'drop all': ['Tout poser', 'Drop everything'],
    'light match': ['Craquer une allumette', 'Light a match'],
  }
  if (special[step.command]) return L.text(...special[step.command])
  const o = step.obj ? w.obj(step.obj) : undefined
  const o2 = step.obj2 ? w.obj(step.obj2) : undefined
  return L.action(step.verb ?? step.command, o, step.prep, o2)
}
