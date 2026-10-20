// The guide of the "hyper noob" mode for Zork II: it always knows the next good action.
//
// Like Zork I's guide (guide.ts), it reads the game state at every turn instead of replaying the
// walkthrough: an ordered list of goals (the gazebo, the riddle, the cakes of the Tea Room, the
// robot and the carousel, the dragon, the balloon of the volcano, the princess, the Dreary Room,
// the bank, the Wizard's workshop, the demon, the menhir, the diamond maze, the crypt), each done
// when the state says so. At every turn the guide takes the first goal that can be pursued,
// fetches the objects it needs, walks there (cheapest path on the exits open now, lamp lit) and
// acts. The places with rules of their own have their own step function: the bucket of the well,
// the cakes, the robot, the dragon, the balloon, the princess, the bank, the diamond maze.
//
// The Wizard of Frobozz casts random spells (frozen, floating, fenced in, drunk, clumsy...): the
// guide waits until the spell wears off, does not touch a treasure while "Filch" would steal it,
// and picks up what a spell made the player drop. The Wizard only steals what the player holds:
// the treasures wait in the Carousel Room until the demon asks for them. More than seven things in
// hand and taking may fail: the place mat serves as a tray (what lies on it counts as one).

import { World, DIRECTIONS, DIR_COMMAND, type Direction } from './world'
import { Labeler } from './labels'
import type { GuideStep } from './guide-common'

/** Whether this guide is ready to be offered (it finishes the game alone). */
export const ZORK2_GUIDE = true

type Why = [string, string]
type Pred = (w: World) => boolean

interface Goal {
  id: string
  why: Why
  done: Pred
  ready?: Pred
  /** Objects that must be carried before acting (fetched automatically when reachable). */
  needs?: string[] | ((w: World) => string[])
  /** Where it happens (null: here). */
  at?: string | ((w: World) => string | null)
  act: (w: World) => GuideStep | null
}

// ------------------------------------------------------------------ commands and labels

/** Words of the commands, where the game's own are ambiguous ("crystal sphere" names four spheres). */
const WORDS: Record<string, string> = {
  'PALANTIR-1': 'red sphere', 'PALANTIR-2': 'blue sphere', 'PALANTIR-3': 'clear sphere', 'PALANTIR-4': 'black sphere',
  'STAND-1': 'ruby stand', 'STAND-2': 'sapphire stand', 'STAND-3': 'diamond stand',
  NEWSPAPER: 'newspaper', GENIE: 'demon', 'BRAIDED-WIRE': 'wire', 'HOOK-1': 'hook', 'HOOK-2': 'hook', SLOT: 'hole', FUSE: 'string',
  MENHIR: 'menhir', WAND: 'wand', CERBERUS: 'dog', 'DIM-DOOR': 'secret door', 'CRYPT-DOOR': 'door', PDOOR: 'door', 'WIZ-DOOR': 'door',
  'LID-1': 'lid', DRAGON: 'dragon', STATUETTE: 'statuette', 'DOOR-KEEPER': 'lizard', SSWL: 'south wall', SNWL: 'north wall',
}
const word = (w: World, o: string) => WORDS[o] ?? w.word(w.obj(o)) ?? o.toLowerCase()

/** "verb obj [prep obj2]" with the words above; the choice label comes from the verb unless `label` is given. */
function act(w: World, verb: string, obj: string | undefined, why: Why, prep?: string, obj2?: string, label?: Why): GuideStep {
  let command = verb
  if (obj) command += ' ' + word(w, obj)
  if (prep && obj2) command += ` ${prep} ${word(w, obj2)}`
  return { command, why, verb, obj, prep, obj2, ...(label ? { label } : {}) }
}
const say = (command: string, why: Why, label?: Why): GuideStep => ({ command, why, verb: command, ...(label ? { label } : {}) })
const go = (dir: Direction, why: Why = ['', '']): GuideStep => ({ command: DIR_COMMAND[dir], why, dir })
const wait = (why: Why) => say('wait', why)

/** A label with the names the player reads: {0} is the first object with its article, {au:0} in French "au …". */
function label(w: World, fr: string, en: string, ...objs: string[]): Why {
  const L = new Labeler(w.game)
  const fill = (s: string) => s.replace(/\{(?:(\w+):)?(\d)\}/g, (_m, fn: string | undefined, i: string) => L.thing(w.obj(objs[Number(i)]), fn ?? 'le'))
  return [fill(fr), fill(en)]
}

/** Takes an object, opening its closed container first. */
function take(w: World, o: string, why: Why): GuideStep {
  const parent = w.vm.parent(w.obj(o))
  // what lies in the bucket can only be reached from inside it
  if (parent === w.obj('BUCKET') && w.inVehicle() !== 'BUCKET') return act(w, 'board', 'BUCKET', why)
  if (parent && parent !== w.obj('ADVENTURER') && w.attrOf(parent, 'CONTBIT') && !w.attrOf(parent, 'OPENBIT') && !w.attrOf(parent, 'TRANSBIT') && w.word(parent)) {
    return act(w, 'open', w.name(parent), why)
  }
  return act(w, 'take', o, why)
}

const putOnMat = (w: World, o: string, why: Why) => act(w, 'put', o, why, 'on', 'PLACE-MAT')

// ------------------------------------------------------------------ the state of the game

const g = (w: World, name: string) => (w.global(name) << 16) >> 16
const inPlay = (w: World, o: string) => w.vm.parent(w.obj(o)) !== 0
/** A treasure's points are scored the first time it is taken (its VALUE drops to 0). */
const scored = (w: World, o: string) => w.vm.getProp(w.obj(o), w.game.symbols.properties.VALUE) === 0
/** Taken once, or out of reach for good (stolen into the Wizard's cabinet, given away). */
const got = (w: World, o: string) => scored(w, o) || w.within(o, 'WIZARD-CASE') || !inPlay(w, o)

/** The room an object is in (through its containers, the player, a vehicle), or '0'. */
function roomOf(w: World, name: string): string {
  let o = w.obj(name)
  const rooms = w.obj('ROOMS')
  for (let i = 0; i < 20 && o; i++) {
    const p = w.vm.parent(o)
    if (p === rooms) return w.name(o)
    o = p
  }
  return '0'
}

/** Turns before an interrupt of the game fires (0 when it is not queued), from the clock table. */
function queued(w: World, routine: string): number {
  const vm = w.vm
  const table = w.global('C-TABLE')
  const r = w.game.symbols.routines[routine]
  for (let off = w.global('C-INTS'); off < 180; off += 6) {
    if (vm.word(table + off) && vm.unpack(vm.word(table + off + 4)) === r) return (vm.word(table + off + 2) << 16) >> 16
  }
  return 0
}

// the Wizard's spells (SPELL? in 2actions.zil)
const FEEBLE = 1, FUMBLE = 2, FILCH = 4, FREEZE = 5, FALL = 6, FERMENT = 7, FIERCE = 8, FLOAT = 9, FIREPROOF = 10, FENCE = 11, FANTASIZE = 12
const spell = (w: World) => w.global('SPELL?')

const TEA = new Set(['TEA-ROOM', 'MAGNET-ROOM', 'MACHINE-ROOM', 'CAGE-ROOM', 'IN-CAGE', 'WELL-TOP', 'POSTS-ROOM', 'POOL-ROOM'])
const SMALL = ['POSTS-ROOM', 'POOL-ROOM']
const AIR: Record<string, number> = { 'VAIR-1': 1, 'VAIR-2': 2, 'VAIR-3': 3, 'VAIR-4': 4 }
const VOLCANO = new Set(['VOLCANO-BOTTOM', 'VAIR-1', 'VAIR-2', 'VAIR-3', 'VAIR-4', 'LEDGE-1', 'LEDGE-2', 'LIBRARY', 'SAFE-ROOM'])
const BANK = new Set(['DEPOSITORY', 'OFFICE', 'SMALL-ROOM', 'VAULT', 'TELLER-EAST', 'TELLER-WEST', 'VIEWING-EAST', 'VIEWING-WEST'])
const DIAMONDS = ['DIAMOND-1', 'DIAMOND-2', 'DIAMOND-3', 'DIAMOND-4', 'DIAMOND-5', 'DIAMOND-6', 'DIAMOND-7', 'DIAMOND-8', 'DIAMOND-9']
/** Where a dropped object could be lost: in the air, on a ledge that collapses, in the bank, behind a menhir... */
const NO_DROP = new Set([...VOLCANO, ...TEA, ...DIAMONDS, 'VAULT', 'SMALL-ROOM', 'KENNEL', 'IN-CAGE', 'TINY-ROOM', 'DREARY-ROOM'])

/** The ten treasures the demon asks for (TREASURES-MAX). */
const FEE = ['BILLS', 'PORTRAIT', 'GOLD-KEY', 'STAMP', 'COIN', 'RUBY', 'CROWN', 'STATUETTE', 'PEARL', 'VIOLIN']
const SPHERES = ['PALANTIR-1', 'PALANTIR-2', 'PALANTIR-3', 'PALANTIR-4']

const candyDone = (w: World) => got(w, 'CANDY') || w.flag('GUARDIAN-FED')
/** The tasks up the well: the candy of the pool, the carousel stopped by the robot, the red sphere. */
const teaDone = (w: World) => candyDone(w) && w.flag('CAROUSEL-FLIP-FLAG') && w.flag('CAGE-SOLVE-FLAG') && !TEA.has(roomOf(w, 'PALANTIR-1'))
const fuseLit = (w: World) => queued(w, 'I-FUSE') > 0
const aquariumBroken = (w: World) => !inPlay(w, 'SERPENT')
const wizDoorOpen = (w: World) => w.attr('WIZ-DOOR', 'OPENBIT')
/** The demon stands in the pentagram (he stays there, invisible, once he has left). */
const summoned = (w: World) => w.vm.parent(w.obj('GENIE')) === w.obj('PENTAGRAM-ROOM')
const blackOut = (w: World) => inPlay(w, 'STAND-4')
/** The coin and the stamp wait on the narrow ledge, the crown on the wide one. */
/** The ledges of the volcano (and their rooms): leaving them, there is no coming back for what lies there. */
const LEDGES = ['LEDGE-1', 'LIBRARY', 'LEDGE-2', 'SAFE-ROOM']
const needL1 = (w: World) => !got(w, 'COIN') || !got(w, 'STAMP')
const needL2 = (w: World) => !got(w, 'CROWN') && !w.attr('SAFE-ROOM', 'RMUNGBIT') && !w.attr('LEDGE-2', 'RMUNGBIT')
const balloonLeft = (w: World) => inPlay(w, 'BALLOON')
/** No time to spare: in the air, after the fuse, in the vault, behind the princess. */
const hurry = (w: World) => {
  const here = w.here()
  return !!AIR[here] || w.inVehicle() !== null || following(w) || fuseLit(w) || (w.flag('SAFE-FLAG') && needL2(w) && (here === 'SAFE-ROOM' || here === 'LEDGE-2')) || here === 'VAULT' || here === 'SMALL-ROOM' || here === 'IN-CAGE'
}
const bankDone = (w: World) => ['PORTRAIT', 'BILLS'].every((t) => got(w, t) && !BANK.has(roomOf(w, t)))
const following = (w: World) => w.flag('PRINCESS-AWAKE') && inPlay(w, 'PRINCESS') && !got(w, 'GOLD-KEY')

/** Whether an object still serves (otherwise it can be dropped). */
function useful(w: World, o: string): boolean {
  switch (o) {
    case 'LAMP':
      return !w.attr('LAMP', 'RMUNGBIT')
    case 'NEWSPAPER':
      return !w.flag('BLAB-FLAG')
    case 'MATCH':
      return !w.flag('BLAB-FLAG') || (inPlay(w, 'FUSE') && !fuseLit(w) && !w.flag('SAFE-FLAG'))
    case 'PLACE-MAT':
      return true
    case 'TEAPOT':
      return !teaDone(w) || TEA.has(w.here())
    case 'LETTER-OPENER':
      return !w.flag('PUNLOCK-FLAG') && !got(w, 'PALANTIR-2')
    case 'KEY':
      return !w.attr('PDOOR', 'OPENBIT') && !got(w, 'PALANTIR-2')
    case 'BRICK':
      return !w.flag('SAFE-FLAG') && needL2(w)
    case 'FUSE':
      return !w.within('FUSE', 'BRICK') && needL2(w)
    case 'RED-ICING':
    case 'BLUE-ICING':
      return !candyDone(w) || SMALL.includes(w.here())
    case 'CANDY':
      return !w.flag('GUARDIAN-FED')
    case 'WAND':
    case 'COLLAR':
      return true
    default:
      return FEE.includes(o) || SPHERES.includes(o)
  }
}

/** Treasures the player carries that can wait in the Carousel Room (the portrait and the gold key still serve). */
function stashable(w: World): string[] {
  if (summoned(w)) return []
  return FEE.filter((t) => w.carried(t) && !(t === 'PORTRAIT' && !aquariumBroken(w)) && !(t === 'GOLD-KEY' && !wizDoorOpen(w)))
}

/** Room left in the player's load before the bank, where the portrait and the bills weigh 35. */
function bankRoom(w: World): boolean {
  const need = ['PORTRAIT', 'BILLS'].filter((t) => !got(w, t)).reduce((n, t) => n + weight(w, w.obj(t)), 0)
  return w.global('LOAD-ALLOWED') - weight(w, w.obj('ADVENTURER')) >= need
}

/** What can break the aquarium: something big (more than 10) or a weapon. */
function smasher(w: World): string | null {
  for (const o of ['PORTRAIT', 'IRON-BOX', 'SWORD', 'CHEST']) {
    if (w.carried(o)) return o
    const room = roomOf(w, o)
    if (room !== '0' && !w.within(o, 'WIZARD-CASE') && !(o === 'PORTRAIT' && !got(w, o)) && (room === w.here() || route(w, room))) return o
  }
  return null
}

// ------------------------------------------------------------------ why

const WHY = {
  lamp: ['Sous terre, il fait noir : la lanterne est indispensable.', 'It is dark underground: the lamp is essential.'] as Why,
  dark: ['Il fait noir : allumez la lanterne, sinon un grue vous dévorera.', 'It is dark: turn on the lamp, or a grue will eat you.'] as Why,
  spell: ['Un sort du Sorcier vous entrave : attendez qu’il se dissipe.', 'A spell of the Wizard hampers you: wait until it wears off.'] as Why,
  filch: ['Le sort « Filoute » volerait ce trésor : attendez qu’il se dissipe.', 'The "Filch" spell would steal this treasure: wait until it wears off.'] as Why,
  dead: ['Vous êtes mort… mais la brume, vers l’ouest, offre une seconde chance.', 'You are dead, but the mist to the west offers a second chance.'] as Why,
  lost: ['Ramassez ce qui vous est tombé des mains.', 'Pick up what fell from your hands.'] as Why,
  tray: ['Plus de sept objets en main et vous lâcheriez tout : le set de table sert de plateau.', 'More than seven things in hand and you would drop them: the place mat is a tray.'] as Why,
  drop: ['Vous portez trop de choses : posez ce qui ne sert plus.', 'You carry too much: drop what no longer serves.'] as Why,
  weak: ['Trop faible pour porter tout cela : attendez de reprendre des forces.', 'Too weak to carry all this: wait to get your strength back.'] as Why,
  out: ['Descendez d’abord.', 'Get out first.'] as Why,
  filched: ['Le sort « Filoute » du Sorcier vole ce qu’on tient en main : posé sur le set de table, ce trésor est à l’abri.', 'The Wizard’s "Filch" spell steals what you hold in hand: on the place mat, this treasure is safe.'] as Why,
}

// ------------------------------------------------------------------ the goals (in solution order)

const treasure = (id: string, t: string, why: Why, ready?: Pred): Goal => ({ id, why, done: (w) => got(w, t), ready, at: (w) => roomOf(w, t), act: (w) => take(w, t, why) })
/** The tools of the gazebo table, kept while they serve. */
const tool = (o: string, why: Why): Goal => ({
  id: `tool-${o}`,
  why,
  done: (w) => w.carried(o) || !useful(w, o) || !inPlay(w, o) || w.within(o, 'RECEPTACLE') || (o === 'PLACE-MAT' && w.flag('MUD-FLAG')) || (o === 'LETTER-OPENER' && w.within(o, 'KEYHOLE-1')),
  at: (w) => roomOf(w, o),
  act: (w) => take(w, o, why),
})

const GOALS: Goal[] = [
  // back from the Posts Room, where the green cake made the player tiny
  { id: 'grow', why: ['Le gâteau bleu vous rendra votre taille.', 'The blue cake will restore your size.'], done: (w) => !SMALL.includes(w.here()), ready: candyDone, act: growStep },
  {
    id: 'princess',
    why: ['Réveillée, la princesse rentre au kiosque, où une licorne lui apportera une clé en or : allez l’y attendre.', 'Awake, the princess walks to the gazebo, where a unicorn brings her a gold key: wait for her there.'],
    done: (w) => got(w, 'GOLD-KEY') || !inPlay(w, 'PRINCESS'),
    ready: (w) => w.flag('PRINCESS-AWAKE'),
    act: princessStep,
  },
  { id: 'lamp', why: WHY.lamp, done: (w) => w.carried('LAMP') || w.attr('LAMP', 'RMUNGBIT'), at: (w) => roomOf(w, 'LAMP'), act: (w) => take(w, 'LAMP', WHY.lamp) },
  tool('TEAPOT', ['La théière servira à porter de l’eau.', 'The teapot will carry water.']),
  tool('NEWSPAPER', ['Le journal fera un bon combustible.', 'The newspaper will make good fuel.']),
  tool('MATCH', ['Des allumettes : il faudra allumer quelque chose.', 'Matches: something will need lighting.']),
  tool('PLACE-MAT', ['Le set de table servira de plateau, et plus encore.', 'The place mat will serve as a tray, and more.']),
  tool('LETTER-OPENER', ['Un coupe-papier fin et solide : de quoi pousser quelque chose.', 'A thin, sturdy letter opener: something to push with.']),
  {
    id: 'fill',
    why: ['Remplissez la théière : l’eau fera monter le seau du puits.', 'Fill the teapot: water makes the bucket of the well rise.'],
    done: (w) => teaDone(w) || TEA.has(w.here()) || w.within('WATER', 'TEAPOT') || w.loc('WATER') === 'BUCKET' || w.loc('BUCKET') === 'WELL-TOP',
    needs: ['TEAPOT'],
    at: 'SHALLOW-FORD',
    act: (w) => {
      const why: Why = ['De l’eau dans la théière fera monter le seau du puits.', 'Water in the teapot makes the bucket rise.']
      if (!w.has('TEAPOT')) return take(w, 'TEAPOT', why)
      return act(w, 'fill', 'TEAPOT', why, 'with', 'GLOBAL-WATER', label(w, 'Remplir {0} d’eau', 'Fill {0} with water', 'TEAPOT'))
    },
  },
  { id: 'brick', why: ['Cette brique a des propriétés étonnantes.', 'This brick has surprising properties.'], done: (w) => w.carried('BRICK') || !useful(w, 'BRICK') || !inPlay(w, 'BRICK') || w.within('BRICK', 'SLOT'), at: (w) => roomOf(w, 'BRICK'), act: (w) => take(w, 'BRICK', ['La brique servira plus tard.', 'The brick will serve later.']) },
  {
    id: 'riddle',
    why: ['Grand comme une maison, rond comme une tasse… c’est un puits.', 'Tall as a house, round as a cup: a well.'],
    done: (w) => w.attr('RIDDLE-DOOR', 'OPENBIT'),
    at: 'RIDDLE-ROOM',
    act: () => say('answer "a well"', ['La réponse à l’énigme ouvre la porte de pierre.', 'The answer to the riddle opens the stone door.'], ['Répondre « un puits »', 'Answer "a well"']),
  },
  treasure('pearl', 'PEARL', ['Un collier de perles : un trésor.', 'A pearl necklace: a treasure.'], (w) => w.attr('RIDDLE-DOOR', 'OPENBIT')),
  // up the well: the Tea Room and its cakes
  { id: 'candy', why: ['Le gâteau vert fait rapetisser, le rouge évapore, le bleu fait grandir.', 'The green cake shrinks you, the red one evaporates, the blue one enlarges.'], done: candyDone, at: (w) => (SMALL.includes(w.here()) ? w.here() : 'TEA-ROOM'), act: candyStep },
  // the robot: it stops the carousel, and lifts the cage of the red sphere
  {
    id: 'carousel',
    why: ['Le robot peut appuyer sur les boutons sans danger : il arrêtera le carrousel.', 'The robot can push the buttons safely: it will stop the carousel.'],
    done: (w) => w.flag('CAROUSEL-FLIP-FLAG'),
    ready: (w) => inPlay(w, 'ROBOT'),
    at: (w) => roomOf(w, 'ROBOT'),
    act: (w) => {
      const why: Why = ['Le bouton triangulaire arrête le carrousel (le carré et le rond sont dangereux).', 'The triangular button stops the carousel (the square and round ones are dangerous).']
      if (w.loc('ROBOT') === 'MACHINE-ROOM') return say('robot, push triangular button', why, label(w, 'Dire au robot d’appuyer sur {0}', 'Tell the robot to push {0}', 'TRIANGULAR-BUTTON'))
      return robotGo(w, 'MACHINE-ROOM', why)
    },
  },
  {
    id: 'red-sphere',
    why: ['La sphère rouge est piégée : avec le robot à vos côtés, la cage n’est pas un problème.', 'The red sphere is trapped: with the robot at your side, the cage is no problem.'],
    done: (w) => got(w, 'PALANTIR-1') && w.flag('CAGE-SOLVE-FLAG') && (w.carried('PALANTIR-1') || !TEA.has(roomOf(w, 'PALANTIR-1'))),
    ready: (w) => w.flag('CAROUSEL-FLIP-FLAG') && (inPlay(w, 'ROBOT') || w.flag('CAGE-SOLVE-FLAG')),
    at: (w) => (w.flag('CAGE-SOLVE-FLAG') ? roomOf(w, 'PALANTIR-1') : w.loc('ROBOT') === 'CAGE-ROOM' ? 'CAGE-ROOM' : roomOf(w, 'ROBOT')),
    act: (w) => {
      const why: Why = ['Le robot soulèvera la cage qui tombera sur vous.', 'The robot will lift the cage that falls on you.']
      if (w.flag('CAGE-SOLVE-FLAG') || w.loc('ROBOT') === 'CAGE-ROOM') return take(w, 'PALANTIR-1', why)
      return robotGo(w, 'CAGE-ROOM', why)
    },
  },
  treasure('violin', 'VIOLIN', ['Le carrousel arrêté, une boîte d’acier est apparue.', 'With the carousel stopped, a steel box appeared.'], (w) => !w.attr('IRON-BOX', 'INVISIBLE')),
  // the treasures wait in the Carousel Room, where the Wizard cannot steal them
  {
    id: 'stash',
    why: ['Les trésors attendront au carrousel, à l’abri du sort « Filoute » du Sorcier.', 'The treasures will wait in the Carousel Room, safe from the Wizard’s "Filch" spell.'],
    done: (w) => stashable(w).length === 0,
    ready: (w) => w.flag('CAROUSEL-FLIP-FLAG') && !following(w) && (w.here() === 'CAROUSEL-ROOM' || stashable(w).filter((t) => w.has(t)).length >= 2 || stashable(w).length >= 5 || (!bankDone(w) && !bankRoom(w) && !BANK.has(w.here()))),
    at: 'CAROUSEL-ROOM',
    act: (w) => act(w, 'drop', stashable(w)[0], ['Ce trésor attendra ici le moment de payer le démon.', 'This treasure waits here until the demon is paid.']),
  },
  {
    id: 'fuse',
    why: ['Cette ficelle noire est une mèche : sa place est dans la brique.', 'This black string is a fuse: it belongs in the brick.'],
    done: (w) => !useful(w, 'FUSE') || !inPlay(w, 'FUSE'),
    needs: ['BRICK'],
    at: (w) => (w.carried('FUSE') ? null : roomOf(w, 'FUSE')),
    act: (w) => (w.carried('FUSE') ? act(w, 'put', 'FUSE', ['La brique et sa mèche font une bombe.', 'The brick and its fuse make a bomb.'], 'in', 'BRICK') : take(w, 'FUSE', ['La ficelle noire est une mèche.', 'The black string is a fuse.'])),
  },
  {
    id: 'dragon',
    why: ['Le dragon garde son antre : attirez-le jusqu’au glacier, sans trop l’énerver.', 'The dragon guards his lair: lure him to the glacier without angering him too much.'],
    done: (w) => w.flag('ICE-MELTED'),
    at: (w) => roomOf(w, 'DRAGON'),
    act: dragonStep,
  },
  treasure('ruby', 'RUBY', ['Le glacier fondu a ouvert le chemin d’un rubis.', 'The melted glacier opened the way to a ruby.'], (w) => w.flag('ICE-MELTED')),
  {
    id: 'volcano',
    why: ['La montgolfière mène aux corniches du volcan.', 'The balloon reaches the ledges of the volcano.'],
    done: (w) => (!balloonLeft(w) || (!needL1(w) && !needL2(w))) && w.inVehicle() !== 'BALLOON' && !VOLCANO.has(w.here()),
    // (the balloon waits at the bottom, unless it left without the player)
    ready: (w) => w.flag('ICE-MELTED') && (w.loc('BALLOON') === 'VOLCANO-BOTTOM' || VOLCANO.has(w.here())),
    needs: (w) => (VOLCANO.has(w.here()) ? [] : [...(w.flag('BLAB-FLAG') ? [] : ['NEWSPAPER', 'MATCH']), ...(needL2(w) && !w.flag('SAFE-FLAG') ? ['BRICK', 'MATCH'] : [])]),
    act: balloonStep,
  },
  {
    ...treasure('statuette', 'STATUETTE', ['Le coffre du dragon contient une statuette en or.', 'The dragon’s chest holds a gold statuette.'], (w) => w.flag('ICE-MELTED')),
    // opening the chest wakes the princess, who will not wait: not under a spell
    act: (w) => (!w.flag('PRINCESS-AWAKE') && spell(w) ? wait(['La princesse va se réveiller et partir : mieux vaut être libre de vos mouvements.', 'The princess will wake up and leave: better be free to move.']) : take(w, 'STATUETTE', ['Le coffre du dragon contient une statuette en or.', 'The dragon’s chest holds a gold statuette.'])),
  },
  {
    id: 'blue-sphere',
    why: ['La clé est de l’autre côté de la porte : poussez-la sur le set de table glissé dessous.', 'The key is on the other side of the door: push it onto the place mat slid under it.'],
    done: (w) => got(w, 'PALANTIR-2'),
    needs: (w) => {
      const keyOut = w.loc('KEY') !== 'KEYHOLE-2' || w.global('MATOBJ') !== 0
      return [...(keyOut || w.flag('MUD-FLAG') ? [] : ['PLACE-MAT']), ...(keyOut || w.within('LETTER-OPENER', 'KEYHOLE-1') ? [] : ['LETTER-OPENER'])]
    },
    at: (w) => (w.attr('PDOOR', 'OPENBIT') ? roomOf(w, 'PALANTIR-2') : 'TINY-ROOM'),
    act: tinyStep,
  },
  {
    id: 'bank',
    why: ['Nul ne sort de la banque avec son argent par les guichets : le rideau de lumière mène ailleurs.', 'Nobody leaves the bank with its money through the tellers: the curtain of light leads elsewhere.'],
    done: bankDone,
    act: bankStep,
  },
  // the Wizard's workshop
  {
    id: 'lizard',
    why: ['Le lézard gardien a faim : les bonbons l’endormiront.', 'The lizard guardian is hungry: the candy will put it to sleep.'],
    done: (w) => w.flag('GUARDIAN-FED'),
    needs: ['CANDY'],
    at: 'GUARDIAN-ROOM',
    act: (w) => act(w, 'give', 'CANDY', ['Repu, le lézard s’endort.', 'Full, the lizard falls asleep.'], 'to', 'DOOR-KEEPER'),
  },
  {
    id: 'unlock',
    why: ['La clé en or ouvre la porte du Sorcier.', 'The gold key opens the Wizard’s door.'],
    done: (w) => w.flag('WIZ-DOOR-FLAG') || wizDoorOpen(w),
    ready: (w) => w.flag('GUARDIAN-FED'),
    needs: ['GOLD-KEY'],
    at: 'GUARDIAN-ROOM',
    act: (w) => act(w, 'unlock', 'WIZ-DOOR', ['La clé en or ouvre la porte du Sorcier.', 'The gold key opens the Wizard’s door.'], 'with', 'GOLD-KEY', label(w, 'Déverrouiller {0} avec {1}', 'Unlock {0} with {1}', 'WIZ-DOOR', 'GOLD-KEY')),
  },
  { id: 'wiz-door', why: ['La porte du Sorcier est déverrouillée.', 'The Wizard’s door is unlocked.'], done: wizDoorOpen, ready: (w) => w.flag('WIZ-DOOR-FLAG'), at: 'GUARDIAN-ROOM', act: (w) => act(w, 'open', 'WIZ-DOOR', ['La porte du Sorcier est déverrouillée.', 'The Wizard’s door is unlocked.']) },
  stand('red-stand', 'PALANTIR-1', 'STAND-1'),
  stand('blue-stand', 'PALANTIR-2', 'STAND-2'),
  {
    id: 'aquarium',
    why: ['Un objet lourd brisera l’aquarium : la troisième sphère est au fond.', 'Something heavy will break the aquarium: the third sphere lies at the bottom.'],
    done: aquariumBroken,
    ready: (w) => smasher(w) !== null,
    needs: (w) => {
      const o = smasher(w)
      return o ? [o] : []
    },
    at: 'AQUARIUM-ROOM',
    act: (w) => {
      const o = smasher(w)!
      return act(w, 'throw', o, ['Un objet lourd brisera la vitre de l’aquarium.', 'Something heavy will break the glass of the aquarium.'], 'at', 'AQUARIUM', label(w, 'Lancer {0} sur {1}', 'Throw {0} at {1}', o, 'AQUARIUM'))
    },
  },
  treasure('clear-sphere', 'PALANTIR-3', ['Une sphère de cristal transparente gît dans l’aquarium brisé.', 'A clear crystal sphere lies in the broken aquarium.'], aquariumBroken),
  { ...stand('clear-stand', 'PALANTIR-3', 'STAND-3'), done: blackOut },
  treasure('black-sphere', 'PALANTIR-4', ['Les trois sphères en ont fait naître une quatrième, noire.', 'The three spheres gave birth to a fourth, black one.'], blackOut),
  {
    id: 'pentagram',
    why: ['La sphère noire posée dans le pentagramme invoquera un démon.', 'The black sphere placed in the pentagram summons a demon.'],
    done: summoned,
    needs: ['PALANTIR-4'],
    at: 'PENTAGRAM-ROOM',
    act: (w) => act(w, 'put', 'PALANTIR-4', ['La sphère noire invoque le démon.', 'The black sphere summons the demon.'], 'in', 'PENTAGRAM'),
  },
  { id: 'fee', why: ['Le démon veut dix trésors pour vous servir.', 'The demon wants ten treasures to serve you.'], done: (w) => w.flag('GENIE-READY?'), ready: summoned, act: feeStep },
  {
    id: 'wand',
    why: ['Le démon payé peut prendre sa baguette au Sorcier.', 'The demon, once paid, can take the wand from the Wizard.'],
    done: (w) => w.carried('WAND'),
    ready: (w) => w.flag('GENIE-READY?') || w.loc('WAND') !== 'WIZARD',
    at: (w) => (w.loc('WAND') === 'WIZARD' ? 'PENTAGRAM-ROOM' : roomOf(w, 'WAND')),
    act: (w) => {
      const why: Why = ['La baguette du Sorcier est la clé de la fin.', 'The Wizard’s wand is the key to the end.']
      if (w.loc('WAND') === 'WIZARD') return say('demon, give me the wand', why, label(w, 'Demander {au:0} de vous donner {1}', 'Ask {0} to give you {1}', 'GENIE', 'WAND'))
      return take(w, 'WAND', why)
    },
  },
  // the menhir, the kennel and the diamond maze
  {
    id: 'menhir',
    why: ['Le menhir marqué d’un F bloque un passage : la baguette et le mot « flotte » le soulèveront.', 'The menhir marked F blocks a passage: the wand and the word "float" lift it.'],
    done: (w) => g(w, 'MENHIR-POSITION') !== 0 || got(w, 'COLLAR'),
    needs: ['WAND'],
    at: 'MENHIR-ROOM',
    act: (w) => {
      const why: Why = ['La baguette pointée, « flotte » soulève le menhir.', 'With the wand pointed, "float" lifts the menhir.']
      if (w.global('WAND-ON')) return say('say "float"', why, ['Dire « flotte »', 'Say "float"'])
      // a wand still recharging could explode
      if (w.global('SPELL-USED') || w.global('SPELL-VICTIM')) return wait(['La baguette se recharge.', 'The wand is recharging.'])
      return act(w, 'wave', 'WAND', why, 'at', 'MENHIR')
    },
  },
  treasure('collar', 'COLLAR', ['Un collier de chien gigantesque, pour un chien gigantesque.', 'A gigantic dog collar, for a gigantic dog.'], (w) => g(w, 'MENHIR-POSITION') !== 0),
  {
    id: 'maze',
    why: ['Le labyrinthe de diamant a un chemin connu : depuis un coin, sud-est, nord-est, nord-ouest puis sud-ouest.', 'The diamond maze has a known path: from a corner, southeast, northeast, northwest, then southwest.'],
    done: (w) => w.flag('DIAMOND-SOLVE'),
    needs: ['COLLAR'],
    at: (w) => (DIAMONDS.includes(w.here()) ? w.here() : 'DIAMOND-5'),
    act: mazeStep,
  },
  {
    id: 'cerberus',
    why: ['Avec un collier, Cerbère devient un brave toutou.', 'With a collar on, Cerberus becomes a good dog.'],
    done: (w) => w.flag('CERBERUS-LEASHED'),
    needs: ['COLLAR'],
    at: 'CERBERUS-ROOM',
    act: (w) => act(w, 'put', 'COLLAR', ['Avec un collier, Cerbère devient un brave toutou.', 'With a collar on, Cerberus becomes a good dog.'], 'on', 'CERBERUS'),
  },
  { id: 'crypt-door', why: ['La crypte est au sud.', 'The crypt lies south.'], done: (w) => w.attr('CRYPT-DOOR', 'OPENBIT'), ready: (w) => w.flag('CERBERUS-LEASHED'), at: 'CRYPT-ANTEROOM', act: (w) => act(w, 'open', 'CRYPT-DOOR', ['La crypte est au sud.', 'The crypt lies south.']) },
  {
    id: 'secret-door',
    why: ['Dans le noir, le contour d’une porte secrète apparaît.', 'In the dark, the outline of a secret door appears.'],
    done: (w) => w.flag('DIM-DOOR-FLAG'),
    ready: (w) => w.attr('CRYPT-DOOR', 'OPENBIT'),
    needs: ['LAMP'],
    at: 'CRYPT-ROOM',
    act: (w) => {
      const why: Why = ['Dans le noir, le contour d’une porte secrète apparaît.', 'In the dark, the outline of a secret door appears.']
      if (w.attr('DIM-DOOR', 'INVISIBLE')) return act(w, w.attr('LAMP', 'ONBIT') ? 'turn off' : 'turn on', 'LAMP', why)
      return act(w, 'open', 'DIM-DOOR', ['La porte secrète marquée d’un F.', 'The secret door marked F.'])
    },
  },
  { id: 'zork3', why: ['Avec la baguette, les gardiens magiques vous laisseront passer.', 'With the wand, the magic wardens let you pass.'], done: () => false, ready: (w) => w.flag('DIM-DOOR-FLAG'), needs: ['WAND'], at: 'CRYPT-ROOM', act: () => go('SOUTH', ['Avec la baguette, les gardiens magiques vous laisseront passer.', 'With the wand, the magic wardens let you pass.']) },
]

function stand(id: string, sphere: string, st: string): Goal {
  const why: Why = ['Chaque sphère a son socle sur l’établi du Sorcier.', 'Each sphere has its stand on the Wizard’s workbench.']
  return { id, why, done: (w) => w.within(sphere, st) || blackOut(w), needs: (w) => (w.within(sphere, st) ? [] : [sphere]), at: 'WORKBENCH-ROOM', act: (w) => act(w, 'put', sphere, why, 'on', st) }
}

// ------------------------------------------------------------------ places with rules of their own

/** The Tea Room: the green cake shrinks you into the Posts Room, the red one dries the pool, the blue one enlarges. */
function candyStep(w: World): GuideStep | null {
  const here = w.here()
  const why: Why = ['Le gâteau vert fait rapetisser, le rouge évapore, le bleu fait grandir.', 'The green cake shrinks you, the red one evaporates, the blue one enlarges.']
  if (here === 'TEA-ROOM') {
    if (!inPlay(w, 'EAT-ME-CAKE')) return null
    if (!w.carried('RED-ICING')) return take(w, 'RED-ICING', ['Le gâteau rouge (« Évapore ») asséchera la mare.', 'The red cake ("Evaporate") will dry the pool.'])
    if (!w.carried('BLUE-ICING')) return take(w, 'BLUE-ICING', ['Le gâteau bleu (« Grandis ») vous rendra votre taille.', 'The blue cake ("Enlarge") will restore your size.'])
    return act(w, 'eat', 'EAT-ME-CAKE', ['« Mange-moi » : tout petit, vous passerez entre les poteaux.', '"Eat me": tiny, you will pass between the posts.'])
  }
  if (here === 'POSTS-ROOM') return go('EAST', why)
  if (here === 'POOL-ROOM') {
    if (w.attr('CANDY', 'INVISIBLE')) {
      if (!w.carried('RED-ICING')) return null
      return act(w, 'throw', 'RED-ICING', ['Le gâteau rouge évapore la mare : des bonbons sont au fond.', 'The red cake evaporates the pool: candy lies at the bottom.'], 'in', 'POOL', label(w, 'Jeter {0} dans {1}', 'Throw {0} into {1}', 'RED-ICING', 'POOL'))
    }
    return take(w, 'CANDY', ['Un paquet de bonbons rares : un trésor (et un régal pour certains).', 'A package of rare candy: a treasure (and a treat for some).'])
  }
  return null
}

function growStep(w: World): GuideStep | null {
  const why: Why = ['Le gâteau bleu vous rendra votre taille.', 'The blue cake will restore your size.']
  // (a spell of the Wizard may have made you drop it: pick it up wherever it lies)
  const at = w.loc('BLUE-ICING')
  if (w.here() === 'POOL-ROOM') return at === 'POOL-ROOM' ? take(w, 'BLUE-ICING', why) : go('WEST', why)
  if (w.carried('BLUE-ICING')) return act(w, 'eat', 'BLUE-ICING', why)
  if (at === w.here()) return take(w, 'BLUE-ICING', why)
  if (at === 'POOL-ROOM') return go('EAST', why)
  return null
}

const DIR_FR: Partial<Record<Direction, string>> = { NORTH: 'au nord', SOUTH: 'au sud', EAST: 'à l’est', WEST: 'à l’ouest', NW: 'au nord-ouest', SE: 'au sud-est' }
const DIR_EN: Partial<Record<Direction, string>> = { NORTH: 'north', SOUTH: 'south', EAST: 'east', WEST: 'west', NW: 'northwest', SE: 'southeast' }

/** Sends the robot one room toward `target` (the player must be with it to give orders). */
function robotGo(w: World, target: string, why: Why): GuideStep | null {
  const r = w.loc('ROBOT')
  const ways: Record<string, Record<string, Direction>> = {
    'TEA-ROOM': { 'MACHINE-ROOM': 'NW', 'CAGE-ROOM': 'NW' },
    'MAGNET-ROOM': { 'MACHINE-ROOM': 'EAST', 'CAGE-ROOM': 'EAST' },
    'MACHINE-ROOM': { 'CAGE-ROOM': 'SOUTH' },
    'CAGE-ROOM': { 'MACHINE-ROOM': 'NORTH' },
  }
  const d = ways[r]?.[target]
  if (!d) return null
  return say(`robot, go ${DIR_COMMAND[d]}`, why, label(w, `Dire {au:0} d’aller ${DIR_FR[d]}`, `Tell {0} to go ${DIR_EN[d]}`, 'ROBOT'))
}

/** Angered (not too much: past 6, he burns you), the dragon follows you; the glacier will be his end. */
function dragonStep(w: World): GuideStep | null {
  if (w.loc('DRAGON') !== w.here()) return null
  // a spell during the chase could be fatal ("Fierce" would attack him, "Freeze" leaves him bored): start free of any
  if (!queued(w, 'I-DRAGON') && spell(w) && ![FIREPROOF, FANTASIZE].includes(spell(w))) return wait(WHY.spell)
  const why: Why = ['En colère, le dragon vous suit ; devant le glacier, il croira voir un rival.', 'Angry, the dragon follows you; at the glacier, he will see a rival.']
  if (g(w, 'DRAGON-ANGER') <= 0) return say('kick dragon', ['Un coup de pied l’agace juste assez pour qu’il vous suive (pas plus !).', 'A kick annoys him just enough to follow you (no more!).'], label(w, 'Donner un coup de pied {au:0}', 'Kick {0}', 'DRAGON'))
  // he will follow no further than these rooms
  const s = route(w, 'GLACIER-ROOM', new Set(['CAROUSEL-ROOM', 'TINY-ROOM', 'RAVINE-LEDGE', 'FRESCO-ROOM']))
  return s ? { ...s, why } : null
}

/**
 * The balloon of the volcano: the burning newspaper lifts it, a closed receptacle brings it down,
 * it moves every three turns. Land at the narrow ledge (coin, stamp in the library), then at the
 * wide one (crown in the safe, opened by the brick), and tie it each time or it leaves alone.
 */
function balloonStep(w: World): GuideStep | null {
  const here = w.here()
  const inBalloon = w.inVehicle() === 'BALLOON'
  const l1 = needL1(w)
  const l2 = needL2(w)
  const open = w.attr('RECEPTACLE', 'OPENBIT')
  const burning = w.global('BINF-FLAG') !== 0
  const why: Why = ['La montgolfière monte quand le réceptacle est ouvert, et redescend quand il est fermé.', 'The balloon rises with the receptacle open, and goes down with it closed.']
  const openRec = () => act(w, 'open', 'RECEPTACLE', ['Réceptacle ouvert, l’air chaud fait monter le ballon.', 'With the receptacle open, hot air lifts the balloon.'])
  const closeRec = () => act(w, 'close', 'RECEPTACLE', ['Réceptacle fermé, le ballon redescend (sinon il sortirait du volcan).', 'With the receptacle closed, the balloon goes down (or it would fly out of the volcano).'])
  // floating (the Wizard's "Float") above the void: the spell ends with a fall, unless the
  // balloon brings the player down to the bottom of the volcano before
  if (spell(w) === FLOAT && w.attr(here, 'NONLANDBIT') && here !== 'VOLCANO-BOTTOM') {
    const fall: Why = ['Le sort « Flotte » finira par une chute : redescendez au fond du volcan avant.', 'The "Float" spell will end with a fall: get down to the bottom of the volcano first.']
    if (!inBalloon) return w.loc('BALLOON') === here ? act(w, 'board', 'BALLOON', fall) : wait(fall)
    if (open) return act(w, 'close', 'RECEPTACLE', fall)
    if (w.global('BTIE-FLAG')) return act(w, 'untie', 'BRAIDED-WIRE', fall, undefined, undefined, label(w, 'Détacher {0}', 'Untie {0}', 'BRAIDED-WIRE'))
    return wait(fall)
  }
  const land = () => say('land', ['Posez-vous sur la corniche avant que le ballon ne reparte.', 'Land on the ledge before the balloon moves on.'], ['Atterrir sur la corniche', 'Land on the ledge'])
  // a spell that forbids walking forbids landing too: then better go down than out of the volcano
  const canLand = ![FENCE, FREEZE].includes(spell(w))
  if (inBalloon && AIR[here]) {
    if (here === 'VAIR-2' && l1 && canLand) return land()
    if (here === 'VAIR-4' && l2 && canLand) return land()
    const level = AIR[here]
    const up = canLand && ((l2 && level < 4) || (l1 && level < 2))
    if (up && burning && !open) return openRec()
    if (!up && open) return closeRec()
    return wait(['Le ballon se déplace tous les trois tours.', 'The balloon moves every three turns.'])
  }
  if (inBalloon && (here === 'LEDGE-1' || here === 'LEDGE-2')) {
    const job = here === 'LEDGE-1' ? l1 : l2
    if (!w.global('BTIE-FLAG')) {
      if (job) return act(w, 'tie', 'BRAIDED-WIRE', ['Attachez le ballon, sinon il repart sans vous.', 'Tie the balloon, or it leaves without you.'], 'to', here === 'LEDGE-1' ? 'HOOK-1' : 'HOOK-2')
      return wait(['Détaché, le ballon va quitter la corniche.', 'Untied, the balloon is about to leave the ledge.'])
    }
    if (job) return act(w, 'disembark', 'BALLOON', ['Descendez explorer la corniche.', 'Get out to explore the ledge.'])
    const up = here === 'LEDGE-1' && l2
    if (up && burning && !open) return openRec()
    if (!up && open) return closeRec()
    return act(w, 'untie', 'BRAIDED-WIRE', why, undefined, undefined, label(w, 'Détacher {0}', 'Untie {0}', 'BRAIDED-WIRE'))
  }
  if (inBalloon && here === 'VOLCANO-BOTTOM') {
    if (!l1 && !l2) return act(w, 'disembark', 'BALLOON', ['Le volcan n’a plus de secrets.', 'The volcano has no more secrets.'])
    if (burning) return open ? wait(['Le ballon va s’élever.', 'The balloon is about to rise.']) : openRec()
    const fire: Why = ['Le journal brûlant gonflera le ballon d’air chaud.', 'The burning newspaper fills the balloon with hot air.']
    if (!open) return act(w, 'open', 'RECEPTACLE', fire)
    if (!w.within('NEWSPAPER', 'RECEPTACLE')) return w.carried('NEWSPAPER') ? act(w, 'put', 'NEWSPAPER', fire, 'in', 'RECEPTACLE') : null
    // the flight leaves no time to spare: not under a spell
    if (spell(w) && !w.attr('MATCH', 'ONBIT')) return wait(['Mieux vaut décoller libre de tout sort.', 'Better take off free of any spell.'])
    return lightWith(w, 'NEWSPAPER', fire)
  }
  if (inBalloon) return null
  switch (here) {
    case 'LEDGE-1':
      if (!got(w, 'COIN') && w.loc('COIN') === here) return take(w, 'COIN', ['Un zorkmid inestimable traîne sur la corniche.', 'A priceless zorkmid lies on the ledge.'])
      if (!got(w, 'STAMP') && roomOf(w, 'STAMP') === 'LIBRARY') return go('SOUTH', ['La bibliothèque cache un trésor.', 'The library hides a treasure.'])
      return boardBalloon(w)
    case 'LIBRARY':
      if (!got(w, 'STAMP') && roomOf(w, 'STAMP') === 'LIBRARY') {
        const why2: Why = ['Le livre violet cache un timbre rare.', 'The purple book hides a rare stamp.']
        return w.within('STAMP', 'PURPLE-BOOK') && !w.attr('PURPLE-BOOK', 'OPENBIT') ? act(w, 'open', 'PURPLE-BOOK', why2) : take(w, 'STAMP', why2)
      }
      return go('NORTH', ['Retour au ballon.', 'Back to the balloon.'])
    case 'LEDGE-2':
      if (l2) {
        // after the explosion, the room collapses five turns later: in and out quickly
        if (w.flag('SAFE-FLAG')) {
          // three turns to get the crown before the room collapses; a spell that keeps the player
          // from walking out must wear off first (if too late: the crown is lost, the ledge collapses soon)
          const left = queued(w, 'I-SAFE')
          const stuck = [FREEZE, FENCE, FLOAT].includes(spell(w))
          if (left >= 3 && !stuck) return go('SOUTH', ['L’explosion a ouvert le coffre : vite, la couronne, avant que la salle ne s’effondre !', 'The explosion opened the box: quick, the crown, before the room collapses!'])
          if (left >= 3) return wait(WHY.spell)
          return boardBalloon(w)
        }
        if (fuseLit(w)) return wait(['La mèche brûle : attendez l’explosion à l’abri.', 'The fuse is burning: wait for the explosion out here.'])
        return go('SOUTH', ['Un coffre rouillé, percé d’un trou à la taille d’une brique…', 'A rusty box, with a hole the size of a brick...'])
      }
      return boardBalloon(w)
    case 'SAFE-ROOM':
      return safeStep(w)
    case 'VOLCANO-BOTTOM':
      if ((l1 || l2) && w.loc('BALLOON') === here) return act(w, 'board', 'BALLOON', ['La montgolfière mène aux corniches du volcan.', 'The balloon reaches the ledges of the volcano.'])
      return null
  }
  return route(w, 'VOLCANO-BOTTOM')
}

/** Back into the balloon tied to the ledge; without it, only the gnome shows the way out (for a treasure). */
function boardBalloon(w: World): GuideStep | null {
  const here = w.here()
  if (w.loc('BALLOON') === here) return act(w, 'board', 'BALLOON', ['Retour dans la nacelle.', 'Back into the basket.'])
  if (w.flag('GNOME-DOOR-FLAG')) return go('WEST', ['Le gnome a ouvert un passage vers le bas.', 'The gnome opened a way down.'])
  if (w.loc('GNOME') === here) {
    const t = FEE.find((x) => w.carried(x)) ?? ['PALANTIR-1', 'PALANTIR-2', 'COLLAR'].find((x) => w.carried(x))
    if (t) return act(w, 'give', t, ['Le gnome montre le chemin contre un trésor.', 'The gnome shows the way out for a treasure.'], 'to', 'GNOME')
  }
  return wait(['Sans ballon, il faut attendre de l’aide.', 'Without the balloon, wait for help.'])
}

/** The brick with its fuse goes into the hole of the rusty box; light it and get out before it blows up. */
function safeStep(w: World): GuideStep | null {
  if (w.flag('SAFE-FLAG')) {
    if (!got(w, 'CROWN') && w.within('CROWN', 'SAFE')) return take(w, 'CROWN', ['Une couronne tape-à-l’œil : vite, avant l’effondrement !', 'A gaudy crown: quick, before the collapse!'])
    return go('NORTH', ['La salle va s’effondrer : sortez !', 'The room is about to collapse: get out!'])
  }
  if (fuseLit(w)) return go('NORTH', ['La mèche brûle : sortez vite !', 'The fuse is burning: get out fast!'])
  const why: Why = ['La brique est une bombe : sa mèche allumée, elle fera sauter le coffre.', 'The brick is a bomb: with its fuse lit, it will blow the box open.']
  if (!w.within('BRICK', 'SLOT')) return w.carried('BRICK') ? act(w, 'put', 'BRICK', why, 'in', 'SLOT') : null
  // light it only when the Wizard cannot freeze you before you are out (two turns)
  if (spell(w) || (!w.attr('MATCH', 'ONBIT') && queued(w, 'I-WIZARD') < 3) || queued(w, 'I-WIZARD') < 2) return wait(['Mieux vaut que le Sorcier ne vous surprenne pas la mèche allumée.', 'Better not be surprised by the Wizard with the fuse lit.'])
  return lightWith(w, 'FUSE', why)
}

/** Lights something with a match held in hand (one match burns two turns). */
function lightWith(w: World, o: string, why: Why): GuideStep | null {
  if (!w.carried('MATCH')) return null
  if (!w.has('MATCH')) return take(w, 'MATCH', why)
  if (!w.attr('MATCH', 'ONBIT')) return act(w, 'light', 'MATCH', why)
  return act(w, 'light', o, why, 'with', 'MATCH')
}

/**
 * Woken up, the princess walks to the gazebo (one room every turn or two), where a unicorn brings
 * her a gold key six turns later: the player must be in the gazebo or at the north end of the garden
 * then. Rather than following her (a spell on the way and she is lost), go straight there and wait.
 */
function princessStep(w: World): GuideStep | null {
  const here = w.here()
  const pr = w.loc('PRINCESS')
  if (here === 'DRAGON-LAIR' && pr === here && !got(w, 'STATUETTE')) return take(w, 'STATUETTE', ['Le coffre du dragon contient une statuette en or.', 'The dragon’s chest holds a gold statuette.'])
  // under "Fierce", the player would attack her (and the Wizard would fry him): keep out of her
  // way (the Dark Tunnel is not on it) until she sits in the gazebo
  const target = spell(w) === FIERCE && pr !== 'GAZEBO-ROOM' ? 'DARK-TUNNEL' : 'GARDEN-NORTH'
  if (here === target || (target === 'GARDEN-NORTH' && here === 'GAZEBO-ROOM')) return wait(['La princesse arrive au kiosque : attendez la licorne.', 'The princess is coming to the gazebo: wait for the unicorn.'])
  const s = route(w, target, new Set(target === 'DARK-TUNNEL' ? [pr] : []))
  return s ? { ...s, why: ['Elle se rend au kiosque : allez l’y attendre.', 'She is heading for the gazebo: wait for her there.'] } : null
}

/** Turns left before the unicorn comes (roughly, while the princess still walks: a room every turn or two). */
function unicornIn(w: World): number {
  const q = queued(w, 'I-UNICORN')
  return q > 0 ? q : 6 + 9 - g(w, 'PRCOUNT')
}

/** The Tiny Room: the key is in the keyhole, on the other side of the locked door. */
function tinyStep(w: World): GuideStep | null {
  const here = w.here()
  const why: Why = ['La clé est de l’autre côté de la porte : poussez-la sur le set de table glissé dessous.', 'The key is on the other side of the door: push it onto the place mat slid under it.']
  if (here === 'DREARY-ROOM') return take(w, 'PALANTIR-2', ['Une sphère de cristal bleue : un trésor.', 'A blue crystal sphere: a treasure.'])
  if (here !== 'TINY-ROOM') return null
  if (w.flag('PUNLOCK-FLAG')) return act(w, 'open', 'PDOOR', why)
  if (w.carried('KEY')) {
    if (w.children(w.obj('KEYHOLE-1')).length) return take(w, w.name(w.children(w.obj('KEYHOLE-1'))[0]), ['Le trou de serrure doit être libre.', 'The keyhole must be free.'])
    return act(w, 'unlock', 'PDOOR', why, 'with', 'KEY', label(w, 'Déverrouiller {0} avec {1}', 'Unlock {0} with {1}', 'PDOOR', 'KEY'))
  }
  if (w.loc('KEY') === here) return take(w, 'KEY', why)
  // the key fell on the mat: pulling the mat back brings it
  if (w.global('MATOBJ')) return act(w, 'take', 'PLACE-MAT', ['Tirez le set de table : la clé est dessus.', 'Pull the place mat back: the key is on it.'])
  if (w.loc('KEY') !== 'KEYHOLE-2') return null
  if (!w.attr('LID-1', 'OPENBIT')) return act(w, 'open', 'LID-1', why)
  if (!w.flag('MUD-FLAG')) {
    if (!w.has('LETTER-OPENER') && w.carried('LETTER-OPENER')) return take(w, 'LETTER-OPENER', why)
    return act(w, 'put', 'PLACE-MAT', why, 'under', 'PDOOR')
  }
  if (!w.carried('LETTER-OPENER')) return null
  return act(w, 'put', 'LETTER-OPENER', why, 'in', 'KEYHOLE-1')
}

/**
 * The Bank of Zork. The curtain of light leads to the room matching the way the player came into
 * the depository (from the east teller: the east viewing room; from the office: the small room),
 * and the walls of those rooms lead back. Through the small room to the vault, then leave the
 * money in the depository, come back from a teller, and leave through the curtain with it.
 */
function bankStep(w: World): GuideStep | null {
  const here = w.here()
  const why: Why = ['Nul ne sort de la banque avec son argent par les guichets : le rideau de lumière mène ailleurs.', 'Nobody leaves the bank with its money through the tellers: the curtain of light leads elsewhere.']
  const scol = w.name(w.global('SCOL-ROOM'))
  const curtain = () => say('walk through curtain', why, label(w, 'Traverser {0}', 'Walk through {0}', 'CURTAIN'))
  const wall = (o: string) => say(`walk through ${word(w, o)}`, why, label(w, 'Traverser {0}', 'Walk through {0}', o))
  const inVault = w.loc('BILLS') === 'VAULT'
  const loot = ['PORTRAIT', 'BILLS'].filter((t) => w.loc(t) === 'DEPOSITORY')
  switch (here) {
    case 'VAULT':
      return w.loc('BILLS') === 'VAULT' && weight(w, w.obj('BILLS')) + weight(w, w.obj('ADVENTURER')) <= w.global('LOAD-ALLOWED') ? take(w, 'BILLS', ['Une liasse de billets en zorkmids : un trésor.', 'A stack of zorkmid bills: a treasure.']) : wall('SNWL')
    case 'SMALL-ROOM':
      return wall('SSWL')
    case 'OFFICE':
      return w.loc('PORTRAIT') === 'OFFICE' ? take(w, 'PORTRAIT', ['Le portrait de J. Pierpont Flathead : un trésor.', 'The portrait of J. Pierpont Flathead: a treasure.']) : go('NORTH', why)
    case 'DEPOSITORY':
      if (inVault) {
        if (scol === 'VAULT' || scol === 'SMALL-ROOM') return spell(w) ? wait(WHY.spell) : curtain()
        return go('SOUTH', why)
      }
      if (scol === 'VIEWING-EAST' || scol === 'VIEWING-WEST') return loot.length ? take(w, loot[0], why) : curtain()
      for (const t of ['BILLS', 'PORTRAIT']) if (w.carried(t)) return act(w, 'drop', t, ['Posez l’argent : on ne passe pas les guichets avec.', 'Leave the money: nobody passes the tellers with it.'])
      return go('EAST', why)
    case 'TELLER-EAST':
      if (loot.length || inVault) return go('EAST', why)
      break
    case 'TELLER-WEST':
      if (loot.length || inVault) return go('WEST', why)
      break
  }
  if (inVault || loot.length || ['PORTRAIT', 'BILLS'].some((t) => !got(w, t))) {
    const s = route(w, 'DEPOSITORY')
    return s ? { ...s, why } : null
  }
  // out of the bank with both
  const s = route(w, 'BANK-ENTRANCE')
  return s ? { ...s, why } : null
}

/** The demon's fee: give him the treasures you hold, fetch the ones waiting elsewhere. */
function feeStep(w: World): GuideStep | null {
  const here = w.here()
  const why: Why = ['Le démon veut dix trésors pour vous servir.', 'The demon wants ten treasures to serve you.']
  const left = FEE.filter((t) => inPlay(w, t) && !w.within(t, 'WIZARD-CASE'))
  const held = left.filter((t) => w.carried(t))
  if (here === 'PENTAGRAM-ROOM' && held.length) return act(w, 'give', held[0], why, 'to', 'GENIE')
  // what the hands can still carry (else, give first what is carried)
  const lying = left.filter((t) => !w.carried(t) && canCarry(w, t))
  const near = lying.find((t) => roomOf(w, t) === here)
  if (near) return take(w, near, why)
  for (const t of lying) {
    const s = route(w, roomOf(w, t))
    if (s) return { ...s, why }
  }
  const s = route(w, 'PENTAGRAM-ROOM')
  return s ? { ...s, why } : null
}

/** The diamond maze: from a corner room, southeast, northeast, northwest, then southwest (DIDIRS). */
function mazeStep(w: World): GuideStep | null {
  const here = w.here()
  const why: Why = ['Le labyrinthe de diamant a un chemin connu : depuis un coin, sud-est, nord-est, nord-ouest puis sud-ouest.', 'The diamond maze has a known path: from a corner, southeast, northeast, northwest, then southwest.']
  const count = g(w, 'DIAMOND-COUNT')
  if (['DIAMOND-2', 'DIAMOND-4', 'DIAMOND-6', 'DIAMOND-8'].includes(here) && count >= 1 && count <= 4) return go((['SE', 'NE', 'NW', 'SW'] as Direction[])[count - 1], why)
  // anywhere else, any way but up leads (by chance) to a corner
  const d = here === 'DIAMOND-5' ? 'NORTH' : DIRECTIONS.find((x) => x !== 'UP' && w.exit(here, x).kind === 'open')
  return d ? go(d, why) : null
}

// ------------------------------------------------------------------ navigation

const canLight = (w: World) => w.carried('LAMP') && !w.attr('LAMP', 'RMUNGBIT')

/** Rooms the guide never walks into: deadly, one-way, or reached only by their own rules. */
const NEVER = new Set(['IN-AQUARIUM', 'IN-CAGE', 'VAULT', 'SMALL-ROOM', 'DEAD-PALANTIR-1', 'DEAD-PALANTIR-2', 'DEAD-PALANTIR-3', 'DEAD-PALANTIR-4'])

function enterable(w: World, room: string, target: string): boolean {
  if (NEVER.has(room)) return false
  if (room === 'ZORK3') return room === target && w.carried('WAND')
  if (w.attr(room, 'RMUNGBIT')) return false
  // with the carousel stopped and the magnet whirring, the Low Room electrocutes
  if (room === 'MAGNET-ROOM' && w.flag('CAROUSEL-FLIP-FLAG') && w.flag('CAROUSEL-ZOOM-FLAG')) return false
  return w.roomLit(room) || w.carriesLight() || canLight(w)
}

interface Edge {
  to: string
  step: GuideStep
  cost: number
}

function edges(w: World, room: string): Edge[] {
  const out: Edge[] = []
  // the diamond maze turns every move but up into a gamble until it is solved
  if (DIAMONDS.includes(room) && !w.flag('DIAMOND-SOLVE')) return room === 'DIAMOND-5' ? [{ to: 'STAIRWAY-TOP', step: go('UP'), cost: 1 }] : []
  // the spinning carousel sends the player anywhere: a way among others, but a costly one
  const spinning = room === 'CAROUSEL-ROOM' && !w.flag('CAROUSEL-FLIP-FLAG')
  for (const d of DIRECTIONS) {
    const e = w.exit(room, d)
    if (e.kind === 'open') out.push({ to: e.to, step: go(d), cost: spinning ? 4 : e.to === 'TOPIARY-ROOM' ? 2 : 1 })
  }
  // the Low Room (MAGNET-ROOM-EXIT): once the carousel is stopped, east or southeast is a toss-up
  if (room === 'MAGNET-ROOM') {
    const flip = w.flag('CAROUSEL-FLIP-FLAG')
    out.push({ to: 'MACHINE-ROOM', step: go('EAST'), cost: flip ? 2 : 1 }, { to: 'TEA-ROOM', step: go('SE'), cost: flip ? 2 : 1 })
  }
  // the bank lets nobody out through the tellers with its money (BKLEAVEE)
  if (room === 'DEPOSITORY' && !w.carried('BILLS') && !w.carried('PORTRAIT')) {
    out.push({ to: 'TELLER-EAST', step: go('EAST'), cost: 1 }, { to: 'TELLER-WEST', step: go('WEST'), cost: 1 })
  }
  // the bucket of the well: water makes it rise, taking the water back brings it down
  if (room === 'WELL-BOTTOM') {
    const s = bucketUp(w)
    if (s) out.push({ to: 'WELL-TOP', step: s, cost: 3 })
  }
  if (room === 'WELL-TOP') {
    const s = bucketDown(w)
    if (s) out.push({ to: 'WELL-BOTTOM', step: s, cost: 3 })
  }
  return out
}

function bucketUp(w: World): GuideStep | null {
  const why: Why = ['Versez de l’eau dans le seau : il remontera le puits.', 'Pour water into the bucket: it will rise up the well.']
  if (w.loc('BUCKET') !== 'WELL-BOTTOM') return null
  const inBucket = w.inVehicle() === 'BUCKET'
  if (w.loc('WATER') !== 'BUCKET' && !(w.has('TEAPOT') && w.within('WATER', 'TEAPOT'))) return null
  if (!inBucket) return act(w, 'board', 'BUCKET', why)
  if (w.loc('WATER') === 'BUCKET') return wait(why)
  return act(w, 'pour', 'WATER', why, 'in', 'BUCKET', label(w, 'Verser l’eau dans {0}', 'Pour the water into {0}', 'BUCKET'))
}

function bucketDown(w: World): GuideStep | null {
  const why: Why = ['Reprenez l’eau du seau dans la théière : il redescendra.', 'Take the water back into the teapot: the bucket will go down.']
  if (w.loc('BUCKET') !== 'WELL-TOP') return null
  const water = w.loc('WATER') === 'BUCKET'
  if (water && !(w.has('TEAPOT') && w.children(w.obj('TEAPOT')).length === 0)) return null
  if (w.inVehicle() !== 'BUCKET') return act(w, 'board', 'BUCKET', why)
  if (water) return act(w, 'take', 'WATER', why)
  return wait(why)
}

/** First step of the cheapest path from the current room to `target`, or null. */
function route(w: World, target: string, avoid?: Set<string>): GuideStep | null {
  const start = w.here()
  if (start === target) return null
  const dist = new Map<string, number>([[start, 0]])
  const first = new Map<string, GuideStep>()
  const done = new Set<string>()
  for (;;) {
    let best: string | null = null
    let bd = Infinity
    for (const [r, d] of dist) if (!done.has(r) && d < bd) [best, bd] = [r, d]
    if (best === null) return null
    if (best === target) return first.get(target)!
    done.add(best)
    for (const e of edges(w, best)) {
      if (done.has(e.to) || avoid?.has(e.to) || !enterable(w, e.to, target)) continue
      const nd = bd + e.cost
      if (nd < (dist.get(e.to) ?? Infinity)) {
        dist.set(e.to, nd)
        first.set(e.to, best === start ? e.step : first.get(best)!)
      }
    }
  }
}

/** Cost of the cheapest path to `target` (about the number of moves), or null. */
function routeCost(w: World, target: string): number | null {
  const start = w.here()
  const dist = new Map<string, number>([[start, 0]])
  const done = new Set<string>()
  for (;;) {
    let best: string | null = null
    let bd = Infinity
    for (const [r, d] of dist) if (!done.has(r) && d < bd) [best, bd] = [r, d]
    if (best === null) return null
    if (best === target) return bd
    done.add(best)
    for (const e of edges(w, best)) if (!done.has(e.to) && enterable(w, e.to, target) && bd + e.cost < (dist.get(e.to) ?? Infinity)) dist.set(e.to, bd + e.cost)
  }
}

/** Room reached by walking in a direction (null if unknown). */
function destination(w: World, room: string, dir: Direction): string | null {
  const e = w.exit(room, dir)
  if (e.kind === 'open' || e.kind === 'closed') return e.to
  return null
}

/** Before walking into the dark, turn on the lamp. */
function withLight(w: World, step: GuideStep): GuideStep {
  if (step.dir && !w.carriesLight() && canLight(w)) {
    const to = destination(w, w.here(), step.dir)
    if (!to || !w.roomLit(to)) return act(w, 'turn on', 'LAMP', ['Il fait noir plus loin : allumez la lanterne.', 'It is dark ahead: turn on the lamp.'])
  }
  return step
}

// ------------------------------------------------------------------ load management

function weight(w: World, obj: number): number {
  let total = w.vm.getProp(obj, w.game.symbols.properties.SIZE)
  for (const c of w.children(obj)) total += weight(w, c)
  return total
}

/** Things in hand, as the game counts them for fumbling (CCOUNT: what lies on the mat is not counted). */
const handCount = (w: World) => w.children(w.obj('ADVENTURER')).filter((n) => !w.attrOf(n, 'WEARBIT')).length
const held = (w: World) => w.children(w.obj('ADVENTURER')).map((n) => w.name(n))

/** Whether an object fits on the place mat (capacity 20). */
function fitsMat(w: World, o: string): boolean {
  if (!w.carried('PLACE-MAT') || o === 'PLACE-MAT' || w.within(o, 'PLACE-MAT')) return false
  // the spheres stay in hand (the Wizard casts less at whoever holds them), the bank's money too
  if (SPHERES.includes(o) || o === 'BILLS' || o === 'PORTRAIT' || o === 'TEAPOT' || o === 'LAMP' || o === 'BRICK') return false
  const mat = w.obj('PLACE-MAT')
  return weight(w, mat) - w.vm.getProp(mat, w.game.symbols.properties.SIZE) + weight(w, w.obj(o)) <= w.vm.getProp(mat, w.game.symbols.properties.CAPACITY)
}

/** What can be dropped here to make room: what no longer serves, else a treasure that can wait (not where it would be lost). */
function dropCandidate(w: World, keep: string): string | null {
  const mine = held(w).filter((o) => o !== keep)
  const junk = mine.find((o) => !useful(w, o) && o !== 'PLACE-MAT')
  if (junk) return junk
  if (NO_DROP.has(w.here()) || w.inVehicle()) return null
  return stashable(w).find((o) => o !== keep) ?? null
}

/** Whether the player can take one more thing without dropping something (weight, and fumbling past seven). */
function canCarry(w: World, o: string): boolean {
  if (weight(w, w.obj(o)) + weight(w, w.obj('ADVENTURER')) > w.global('LOAD-ALLOWED')) return false
  return handCount(w) <= w.global('FUMBLE-NUMBER') || held(w).some((x) => fitsMat(w, x))
}

/** Before taking: more than seven things in hand and it may slip (FUMBLE-NUMBER); too heavy and it fails. */
function withLoad(w: World, step: GuideStep): GuideStep {
  if (step.verb !== 'take' || !step.obj || step.obj === 'WATER') return step
  const o = step.obj
  if (handCount(w) > w.global('FUMBLE-NUMBER')) {
    const d = dropCandidate(w, o)
    if (d) return act(w, 'drop', d, WHY.drop)
    const m = held(w).find((x) => x !== o && fitsMat(w, x) && w.vm.getProp(w.obj(x), w.game.symbols.properties.SIZE) <= 10)
    if (m) return putOnMat(w, m, WHY.tray)
  }
  if (!w.carried(o) && weight(w, w.obj(o)) + weight(w, w.obj('ADVENTURER')) > w.global('LOAD-ALLOWED')) {
    const d = dropCandidate(w, o)
    if (d) return act(w, 'drop', d, WHY.drop)
    if (w.global('LOAD-ALLOWED') < w.global('LOAD-MAX')) return wait(WHY.weak)
  }
  return step
}

// ------------------------------------------------------------------ the Wizard's spells

/** What a spell forbids: frozen, nothing; floating, fenced in or drunk, no walking; "Fall", no stairs. */
function underSpell(w: World, step: GuideStep): GuideStep {
  const s = spell(w)
  if (!s || step.command === 'wait') return step
  const moving = !!step.dir || step.command === 'land'
  const taking = step.verb === 'take' || (step.verb === 'put' && !!step.obj && !w.carried(step.obj))
  const here = w.here()
  if (s === FREEZE) return wait(WHY.spell)
  // floating: no walking, nothing to pick up from the ground
  if (s === FLOAT && (moving || (step.verb === 'take' && !!step.obj && w.loc(step.obj) === here))) return wait(WHY.spell)
  if (s === FENCE && moving) return wait(WHY.spell)
  // drunk: every step goes astray (not in the balloon); for the princess, a random walk beats
  // waiting if the spell would last past the unicorn
  if (s === FERMENT && moving && !w.inVehicle() && !(following(w) && queued(w, 'I-WIZARD') + (routeCost(w, 'GARDEN-NORTH') ?? 9) >= unicornIn(w))) return wait(WHY.spell)
  // fierce: the player attacks whoever is there (the princess, the dog, the dragon: deadly)
  if (s === FIERCE && step.dir) {
    const to = destination(w, here, step.dir)
    if (to && w.children(w.obj(to)).some((n) => w.attrOf(n, 'ACTORBIT') && !w.attrOf(n, 'INVISIBLE') && w.name(n) !== 'ROBOT')) return wait(WHY.spell)
  }
  // "Fantasize" garbles the description of the next rooms (PICK-ONE on a table of another shape)
  if (s === FANTASIZE && moving && !w.inVehicle() && !BANK.has(here) && !VOLCANO.has(here)) return wait(WHY.spell)
  // tripping near a drop (a bridge, a ledge, stairs) can be fatal
  if (s === FALL && ((moving && w.vm.getPropAddr(w.obj(here), w.game.symbols.properties.DOWN)) || step.verb === 'board')) return wait(WHY.spell)
  // (the crown is taken all the same: stolen, it still counts for the demon; left, it is lost)
  if (s === FILCH && taking && step.obj && filchable(w, step.obj) && here !== 'SAFE-ROOM') return wait(WHY.filch)
  // clumsy: past three things in hand, taking fails (drop or set something down first)
  if (s === FUMBLE && step.verb === 'take' && handCount(w) > w.global('FUMBLE-NUMBER')) {
    const s2 = withLoad(w, step)
    return s2 !== step ? s2 : wait(WHY.spell)
  }
  if (s === FEEBLE && taking) return withLoad(w, step)
  return step
}

/** What the "Filch" spell steals when touched (RIPOFF): any treasure but the three spheres, the gold key and the candy. */
function filchable(w: World, o: string): boolean {
  if (['PALANTIR-1', 'PALANTIR-2', 'PALANTIR-3', 'GOLD-KEY', 'CANDY'].includes(o)) return false
  return w.vm.getPropAddr(w.obj(o), w.game.symbols.properties.VALUE) !== 0
}

// ------------------------------------------------------------------ main

/** Useful objects lying at the player's feet (dropped by a spell, a fumble, a death). */
function lostHere(w: World): string | null {
  const here = w.here()
  if (BANK.has(here) || here === 'TINY-ROOM' || here === 'DREARY-ROOM' || SMALL.includes(here)) return null
  // up in the volcano, time is short: what fell in the basket waits for the bottom
  if (AIR[here] || (VOLCANO.has(here) && here !== 'VOLCANO-BOTTOM' && w.inVehicle()) || (here === 'LEDGE-2' && (w.flag('SAFE-FLAG') || fuseLit(w)))) return null
  // on the floor, or in the basket (or the bucket) standing here
  const places = [w.obj(here), ...['BALLOON', 'BUCKET'].filter((v) => w.loc(v) === here || w.inVehicle() === v).map((v) => w.obj(v))]
  for (const p of places) {
    for (const n of w.children(p)) {
      const o = w.name(n)
      // (only what the player already held: TOUCHBIT)
      if (!w.attrOf(n, 'TAKEBIT') || !w.attrOf(n, 'TOUCHBIT') || w.attrOf(n, 'NONLANDBIT') || w.attrOf(n, 'INVISIBLE') || n === w.obj('ADVENTURER')) continue
      if (!useful(w, o) || (FEE.includes(o) && here === 'CAROUSEL-ROOM' && !summoned(w))) continue
      // the guide's own rules handle these
      if (['WATER', 'BALLOON', 'BUCKET', 'RED-ICING', 'BLUE-ICING'].includes(o) || (o === 'PALANTIR-1' && !w.flag('CAGE-SOLVE-FLAG')) || (o === 'PLACE-MAT' && w.flag('MUD-FLAG'))) continue
      // (too heavy to take back for now: on the ledges of the volcano, it is waited for anyway)
      if (o === 'LAMP' || w.carried(o) || (!canCarry(w, o) && !LEDGES.includes(here))) continue
      return o
    }
  }
  return null
}

function needsOf(g: Goal, w: World): string[] {
  return typeof g.needs === 'function' ? g.needs(w) : (g.needs ?? [])
}

function plan(w: World): GuideStep | null {
  const here = w.here()

  // dead: the mist leads west, toward a second chance
  if (w.flag('DEAD')) return here.startsWith('DEAD-PALANTIR') ? go('WEST', WHY.dead) : wait(WHY.dead)
  // caught under the cage with the robot: it lifts it
  if (here === 'IN-CAGE') return say('robot, lift cage', ['Le robot est assez fort pour soulever la cage.', 'The robot is strong enough to lift the cage.'], label(w, 'Dire {au:0} de soulever {1}', 'Tell {0} to lift {1}', 'ROBOT', 'CAGE'))

  // light
  if (!w.lit() && !w.carriesLight() && canLight(w)) return act(w, 'turn on', 'LAMP', WHY.dark)
  // floating at the top of the well: the spell ends with a fall, unless the bucket brings you down
  if (spell(w) === FLOAT && here === 'WELL-TOP') {
    const s = bucketDown(w)
    if (s) return { ...s, why: ['Le sort « Flotte » finira par une chute : redescendez avec le seau.', 'The "Float" spell will end with a fall: go down in the bucket.'] }
  }

  // hands full: drop what no longer serves
  if (handCount(w) > w.global('FUMBLE-NUMBER')) {
    const junk = held(w).find((o) => !useful(w, o) && o !== 'PLACE-MAT')
    if (junk) return act(w, 'drop', junk, WHY.drop)
  }
  // the Wizard's "Filch" steals only what the player holds in hand: small treasures ride on the mat
  if (!hurry(w) && !(here === 'CAROUSEL-ROOM' && stashable(w).length)) {
    const t = held(w).find((o) => FEE.includes(o) && filchable(w, o) && fitsMat(w, o))
    if (t) return putOnMat(w, t, WHY.filched)
  }
  // pick up what fell (not while the balloon flies or the princess walks: no time for that)
  const lost = hurry(w) ? null : lostHere(w)
  if (lost) {
    const s = withLoad(w, take(w, lost, WHY.lost))
    // too weak to take it back ("Feeble"): on the ledges of the volcano, where there is no coming
    // back for it, wait for the spell to wear off rather than leave it behind
    if (s.command !== 'wait' || LEDGES.includes(here)) return s
  }

  // places where time runs out: their own rules come first (up in the volcano, inside the bank)
  if ((VOLCANO.has(here) && here !== 'VOLCANO-BOTTOM') || w.inVehicle() === 'BALLOON') {
    const s = balloonStep(w)
    if (s) return withLoad(w, s)
  }
  if (here === 'VAULT' || here === 'SMALL-ROOM') {
    const s = bankStep(w)
    if (s) return s
  }

  for (const goal of GOALS) {
    if (goal.done(w) || (goal.ready && !goal.ready(w))) continue
    let blocked = false
    for (const n of needsOf(goal, w)) {
      if (w.carried(n)) continue
      const room = roomOf(w, n)
      // out of reach: in the Wizard's cabinet, or in his hands
      if (room === '0' || w.within(n, 'WIZARD-CASE') || w.within(n, 'WIZARD')) {
        blocked = true
        break
      }
      if (room === here) return withLoad(w, { ...take(w, n, goal.why), why: goal.why })
      const s = route(w, room)
      if (s) return withLight(w, { ...s, why: s.why[0] ? s.why : goal.why })
      blocked = true
      break
    }
    if (blocked) continue
    const at = typeof goal.at === 'function' ? goal.at(w) : goal.at
    if (at && at !== '0' && at !== here) {
      const s = route(w, at)
      if (s) return withLight(w, { ...s, why: s.why[0] ? s.why : goal.why })
      continue
    }
    const s = goal.act(w)
    if (!s) continue
    return withLight(w, withLoad(w, { ...s, why: s.why[0] ? s.why : goal.why }))
  }
  return null
}

/** Why each pending goal is or is not pursued (debugging). */
export function explainZork2(w: World): string[] {
  return GOALS.filter((g) => !g.done(w)).map((g) => {
    const ready = g.ready ? g.ready(w) : true
    const at = typeof g.at === 'function' ? g.at(w) : g.at
    const needs = needsOf(g, w).map((n) => `${n}:${w.carried(n) ? 'ok' : roomOf(w, n)}`).join(',')
    const r = at && at !== w.here() ? (route(w, at)?.command ?? 'NO ROUTE') : 'here'
    return `${g.id} ready=${ready} at=${at} route=${r} needs=${needs}`
  })
}

export function zork2Step(w: World): GuideStep | null {
  let step = plan(w)
  if (!step) return null
  // in the bucket (or the balloon on the ground), get out before walking
  const v = w.inVehicle()
  if (v && step.dir && !AIR[w.here()]) step = act(w, 'disembark', v, WHY.out)
  // save the lamp: it lasts 650 turns, and a game with a few mishaps is longer than that; off
  // wherever there is light, here and where the next step leads
  const here = w.here()
  if (w.carried('LAMP') && w.attr('LAMP', 'ONBIT') && w.roomLit(here) && step.verb !== 'turn on') {
    const to = step.dir ? destination(w, here, step.dir) : here
    if (to && w.roomLit(to)) step = act(w, 'turn off', 'LAMP', ['Il fait clair ici : éteignez la lanterne pour économiser sa pile.', 'There is light here: turn off the lamp to save its battery.'])
  }
  return underSpell(w, step)
}
