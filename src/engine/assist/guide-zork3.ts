// The guide of the "hyper noob" mode for Zork III: it always knows the next good action.
//
// Like Zork I's guide (guide.ts), it reads the game state at every turn rather than replaying a
// script: an ordered list of goals (the man at the cliff, the hooded figure, the old man, the
// lake, the Scenic Vista, the key and the aqueduct, the Royal Puzzle, the time machine, the mirror
// box, the Dungeon), each done when the state says so. The places with rules of their own (the
// lake, the puzzle, the mirror box, the past, the Dungeon) have their own step function.
import { World, DIRECTIONS, DIR_COMMAND, type Direction } from './world'
import { verbStep, takeStep, type GuideStep } from './guide-common'
import { readPuzzle, solve, apply, puzzleKey, type PuzzleMove } from './royal-puzzle'

/** Whether this guide is ready to be offered (it finishes the game alone). */
export const ZORK3_GUIDE = true

type Why = [string, string]

const say = (command: string, why: Why, label?: Why): GuideStep => ({ command, why, label, verb: command })
const go = (dir: Direction, why: Why): GuideStep => ({ command: DIR_COMMAND[dir], why, dir })
const wait = (why: Why) => say('wait', why)

const touched = (w: World, o: string) => w.attr(o, 'TOUCHBIT')
const g = (w: World, name: string) => (w.global(name) << 16) >> 16

/** The room an object is in (through its containers), or '0'. */
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

/** What the Dungeon Master wears and carries: the player must look like him (LOOK-LIKE-DM?). */
const OUTFIT = ['HOOD', 'CLOAK', 'AMULET', 'STAFF', 'RING', 'LORE-BOOK', 'KEY']
const SHADOW_ROOMS = ['SHADOW-1', 'SHADOW-2', 'SHADOW-3', 'SHADOW-4', 'SHADOW-5', 'SHADOW-6', 'SHADOW-7', 'SHADOW-8']
const GUARDED = ['MRG', 'MRGE', 'MRGW']
const SHORES: Record<string, Direction> = { 'LAKE-SHORE': 'NORTH', 'FAR-SHORE': 'WEST', 'SOUTH-SHORE': 'SOUTH' }

// ------------------------------------------------------------------ the state of the quest

const hasAmulet = (w: World) => w.vm.parent(w.obj('AMULET')) !== 0
const hasHood = (w: World) => w.vm.parent(w.obj('HOOD')) !== 0 && !w.within('HOOD', 'SHADOW')
const hasStaff = (w: World) => w.vm.parent(w.obj('STAFF')) !== 0
/** The repellent of Room 8 (it reaches the lake bottom with the player). */
const hasRepellent = (w: World) => touched(w, 'REPELLENT')
/** The torch waits in the Damp Passage, at the end of the aqueduct. */
const torchPlaced = (w: World) => w.loc('TORCH') === 'DAMP-PASSAGE' || touched(w, 'KEY')
const vistaDone = (w: World) => hasRepellent(w) && torchPlaced(w)
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
/** Carried away by the viewing table: it brings the player back in a few turns. */
const away = (w: World) => queued(w, 'I-VIEW-SNAP') > 0

/** The objects the player wears stay dry in the lake: everything else falls to the bottom. */
const worn = (w: World, n: number) => w.attrOf(n, 'WEARBIT')

// ------------------------------------------------------------------ light and paths

function canLight(w: World): boolean {
  return w.carried('LAMP') && w.lampTurnsLeft() > 0
}

/** Rooms the guide never walks into on its own. */
function enterable(w: World, room: string, target: string, dark = false): boolean {
  if (room === target) return dark || w.roomLit(room) || w.carriesLight() || canLight(w) || (room.startsWith('DARK-') && w.flag('SPRAYED?'))
  if (GUARDED.includes(room) || ['CP', 'ON-LAKE', 'IN-LAKE', 'CLIFF-LEDGE', 'ZORK-IV', 'ROOM-8', 'IN-MIRROR'].includes(room)) return false
  // the hooded figure roams the Land of Shadow until it is unmasked
  if (SHADOW_ROOMS.includes(room) && !w.flag('SHADOW-GONE')) return false
  // the grues of the dark places: only with the repellent sprayed
  if (room === 'DARK-1' || room === 'DARK-2') return w.flag('SPRAYED?') || w.carriesLight()
  if (dark) return true
  return w.roomLit(room) || w.carriesLight() || canLight(w)
}

/** The door object of an exit (DEXIT), to open it. */
function doorOf(w: World, room: string, dir: Direction): string | null {
  const vm = w.vm
  const addr = vm.getPropAddr(w.obj(room), w.game.symbols.properties[dir])
  return addr && vm.getPropLen(addr) === 5 ? w.name(vm.mem[addr + 1]) : null
}

interface Edge {
  to: string
  step: GuideStep
}

function edges(w: World, room: string): Edge[] {
  const out: Edge[] = []
  for (const d of DIRECTIONS) {
    const e = w.exit(room, d)
    if (e.kind === 'open') out.push({ to: e.to, step: go(d, ['', '']) })
    else if (e.kind === 'closed' && e.door) {
      const door = doorOf(w, room, d)
      // (the secret door shows only once the old man has pointed at it)
      if (door && door !== 'DUNGEON-DOOR' && door !== 'BRONZE-DOOR' && !w.attr(door, 'INVISIBLE')) out.push({ to: e.to, step: verbStep(w, 'open', door, ['Une porte fermée barre le chemin : ouvrez-la.', 'A closed door is in the way: open it.']) })
    }
  }
  // the long hallway of the mirror, up to where the wooden box stands
  if (room === 'MREYE' && w.global('MLOC') !== w.obj('MRA')) out.push({ to: 'MRA', step: go('NORTH', ['', '']) })
  if (room === 'MRA') out.push({ to: 'MREYE', step: go('SOUTH', ['', '']) })
  return out
}

/** First step of the shortest path to `target`, or null. */
function route(w: World, target: string, dark = false): GuideStep | null {
  const start = w.here()
  if (start === target) return null
  const prev = new Map<string, { from: string; step: GuideStep }>()
  const queue = [start]
  const seen = new Set([start])
  while (queue.length) {
    const r = queue.shift()!
    for (const e of edges(w, r)) {
      if (seen.has(e.to) || !enterable(w, e.to, target, dark)) continue
      seen.add(e.to)
      prev.set(e.to, { from: r, step: e.step })
      if (e.to === target) {
        let cur = target
        while (prev.get(cur)!.from !== start) cur = prev.get(cur)!.from
        return prev.get(cur)!.step
      }
      queue.push(e.to)
    }
  }
  return null
}

/** Before walking into the dark, light the lamp (or fetch a light). */
function toward(w: World, target: string, why: Why): GuideStep | null {
  if (w.here() !== target && w.inVehicle() === 'TIME-MACHINE') return { command: 'get out of gold machine', why: ['Descendez de la machine pour repartir.', 'Get out of the machine to move on.'], label: ['Descendre de la machine dorée', 'Get out of the gold machine'], verb: 'disembark', obj: 'TIME-MACHINE' }
  const step = route(w, target)
  if (step) {
    if (step.dir) {
      const e = w.exit(w.here(), step.dir)
      const to = e.kind === 'open' ? e.to : null
      if (to && !w.roomLit(to) && !w.carriesLight() && canLight(w) && !(to.startsWith('DARK-') && w.flag('SPRAYED?'))) {
        return verbStep(w, 'turn on', 'LAMP', ['Il fait noir plus loin : allumez la lanterne.', 'It is dark ahead: turn on the lamp.'])
      }
    }
    return { ...step, why: step.why[0] ? step.why : why }
  }
  // only darkness in the way: fetch a light first
  if (route(w, target, true) && !w.carriesLight() && !canLight(w)) {
    for (const light of ['TORCH', 'LAMP']) {
      if (w.carried(light)) continue
      if (light === 'TORCH' && !w.attr('TORCH', 'ONBIT')) continue
      if (light === 'LAMP' && (w.lampTurnsLeft() <= 0 || roomOf(w, 'LAMP') === '0')) continue
      const room = roomOf(w, light)
      if (room === w.here()) return take(w, light, ['Il vous faut une lumière pour aller plus loin.', 'You need a light to go on.'])
      const s = route(w, room)
      if (s) return { ...s, why: ['Il vous faut une lumière pour aller plus loin.', 'You need a light to go on.'] }
    }
  }
  return null
}

/** Takes an object, after dropping something useless when the hands are full (more than 7 things). */
function take(w: World, obj: string, why: Why): GuideStep {
  const carried = w.children(w.obj('ADVENTURER')).map((n) => w.name(n))
  if (carried.length >= 7 && !carried.includes(obj)) {
    const spare = spareItem(w, obj)
    if (spare) return verbStep(w, 'drop', spare, ['Vous portez trop de choses : posez ce qui ne sert plus.', 'You carry too much: drop what you no longer need.'])
  }
  return takeStep(w, obj, why)
}

/** Something carried that the rest of the quest does not need. */
function spareItem(w: World, keep?: string): string | null {
  const torchLit = w.carried('TORCH') && w.attr('TORCH', 'ONBIT')
  const candidates = [
    hasHood(w) ? 'SWORD' : null,
    w.flag('SPRAY-USED?') ? 'REPELLENT' : null,
    torchLit ? 'LAMP' : null,
    'CHEST',
    'WAYBREAD',
    'BROKEN-STAFF',
    'TIMBERS',
  ]
  return candidates.find((o) => o && o !== keep && w.has(o)) ?? null
}

/** Fetches an object wherever it lies. */
function fetch(w: World, obj: string, why: Why): GuideStep | null {
  if (w.carried(obj)) return null
  const room = roomOf(w, obj)
  if (room === '0') return null
  if (room === w.here()) return take(w, obj, why)
  return toward(w, room, why)
}

// ------------------------------------------------------------------ places with rules of their own

/** The hooded figure: fight it with the sword until it is defenseless, then take its hood. */
function shadowStep(w: World): GuideStep | null {
  if (w.loc('SHADOW') !== w.here() || w.flag('SHADOW-GONE')) return null
  const s = g(w, 'S-STRENGTH')
  if (s === 1) return verbStep(w, 'take', 'HOOD', ['La silhouette est sans défense : ôtez-lui son capuchon (ne la tuez pas).', 'The figure is defenseless: take off its hood (do not kill it).'])
  if (g(w, 'P-STRENGTH') <= 3) {
    // badly wounded: step away and let the wounds heal (the figure heals too)
    const blocked = g(w, 'BLOCKED-DIR')
    for (const d of DIRECTIONS) {
      const e = w.exit(w.here(), d)
      if (e.kind === 'open' && !SHADOW_ROOMS.includes(e.to) && w.game.symbols.properties[d] !== blocked) return go(d, ['Gravement blessé : reculez pour reprendre des forces.', 'Badly wounded: step back and recover.'])
    }
  }
  if (!w.carried('SWORD')) return wait(['Votre épée va revenir dans votre main.', 'Your sword will come back to your hand.'])
  return verbStep(w, 'attack', 'SHADOW', ["Frappez la silhouette jusqu'à ce qu'elle soit sans défense, mais sans l'achever.", 'Strike the figure until it is defenseless, but do not finish it off.'], 'with', 'SWORD')
}

/** Where to swim: the west shore for the Scenic Vista, the south shore for the key, else back north. */
function lakeTarget(w: World): Direction {
  if (!vistaDone(w)) return 'WEST'
  if (!touched(w, 'KEY') && repellentAtHand(w)) return 'SOUTH'
  return 'NORTH'
}

/** The repellent is carried, lies at the bottom of the lake, or was already sprayed. */
const repellentAtHand = (w: World) => w.carried('REPELLENT') || w.loc('REPELLENT') === 'IN-LAKE' || w.flag('SPRAYED?')

function lakeStep(w: World): GuideStep {
  const here = w.here()
  const target = lakeTarget(w)
  const needRepellent = target === 'SOUTH' && !w.carried('REPELLENT') && !w.flag('SPRAY-USED?') && w.loc('REPELLENT') === 'IN-LAKE'
  if (here === 'IN-LAKE') {
    if (!hasAmulet(w) && w.loc('SHINY-OBJECT') === 'IN-LAKE') return verbStep(w, 'take', 'SHINY-OBJECT', ['Quelque chose brille dans le sable : attrapez-le (il faut parfois plusieurs essais).', 'Something shines in the sand: grab it (it may take a few tries).'])
    if (needRepellent) return verbStep(w, 'take', 'REPELLENT', ['Le répulsif est tombé au fond : reprenez-le.', 'The repellent fell to the bottom: take it back.'])
    return go('UP', ['Remontez à la surface pour respirer.', 'Swim up to breathe.'])
  }
  // on the lake: the cold kills after a few turns, and a roc hunts above
  if (g(w, 'LAKE-TIME') < 5 && (!hasAmulet(w) || needRepellent)) return go('DOWN', ['Plongez : le fond du lac cache quelque chose.', 'Dive: the lake bottom hides something.'])
  return go(target, ['Nagez vers la rive avant que le froid ne vous gagne.', 'Swim to the shore before the cold gets you.'])
}

/** Crosses the lake from a shore: only what is worn stays dry. */
function intoLake(w: World): GuideStep {
  if (w.here() === 'LAKE-SHORE') {
    // the repellent goes along: it will be picked up at the bottom
    const dry = w.children(w.obj('ADVENTURER')).find((n) => !worn(w, n) && !(w.name(n) === 'REPELLENT' && !touched(w, 'KEY')))
    if (dry) return verbStep(w, 'drop', w.name(dry), ["Dans le lac, tout ce qu'on ne porte pas tombe au fond (et les lumières s'éteignent pour de bon) : laissez vos affaires sur la rive.", 'In the lake, everything not worn sinks (and lights die for good): leave your things on the shore.'])
  }
  return { command: 'jump in lake', why: ['Il faut traverser le lac à la nage.', 'The lake must be crossed by swimming.'], label: ['Sauter dans le lac', 'Jump in the lake'], verb: 'jump' }
}

/** The Royal Puzzle: the shortest way out with the book (see royal-puzzle.ts). The plan is kept,
 * with the state expected before each move, so that it is only searched again when the player
 * strays from it. */
let puzzlePlan: Map<string, PuzzleMove> | null = null
function puzzleStep(w: World): GuideStep | null {
  const p = readPuzzle(w)
  let m = puzzlePlan?.get(puzzleKey(p))
  if (!m) {
    const moves = solve(p)
    if (!moves) return null
    puzzlePlan = new Map()
    let state = p
    for (const move of moves) {
      puzzlePlan.set(puzzleKey(state), move)
      state = apply(state, move)
    }
    m = moves[0]
  }
  const why: Why = ['Les murs de grès glissent quand on les pousse : il faut ressortir par le trou, avec l’échelle juste à côté, et le livre en main.', 'Sandstone walls slide when pushed: get out through the hole, with the ladder right beside it, and the book in hand.']
  if (m.kind === 'walk') return go(m.dir, why)
  if (m.kind === 'take') return verbStep(w, 'take', 'LORE-BOOK', ['Un vieux livre repose dans cette niche.', 'An old book lies in this niche.'])
  if (m.kind === 'up') return go('UP', ["L'échelle mène hors du casse-tête.", 'The ladder leads out of the puzzle.'])
  const wall = { NORTH: 'CPNWL', SOUTH: 'CPSWL', EAST: 'CPEWL', WEST: 'CPWWL' }[m.dir as 'NORTH']
  return { ...verbStep(w, 'push', wall, why), verb: 'shove' }
}

/** Inside the mirror box: turn it north, roll it to the Dungeon Entrance, turn it south, open the pine panel. */
function mirrorStep(w: World): GuideStep {
  const mdir = g(w, 'MDIR')
  const pole = g(w, 'POLEUP-FLAG')
  const mloc = w.name(w.global('MLOC'))
  const why: Why = ['La boîte pivote (perche levée) et glisse dans la rigole (perche baissée) : menez-la vers le nord, au-delà des Gardiens, jusqu’à l’entrée du Donjon.', 'The box turns (pole raised) and slides along the channel (pole lowered): take it north, past the Guardians, to the Dungeon Entrance.']
  const rotate = (want: number): GuideStep => {
    if (pole === 0) return verbStep(w, 'raise', 'SHORT-POLE', why)
    const clockwise = (want - mdir + 360) % 360 <= 180
    return { ...verbStep(w, 'push', clockwise ? 'RED-PANEL' : 'BLACK-PANEL', why), verb: 'shove' }
  }
  if (mloc !== 'MRD') {
    if (mdir !== 0) return rotate(0)
    // the Guardians strike at a raised pole, or at an open panel
    if (pole !== 0) return verbStep(w, 'lower', 'SHORT-POLE', why)
    if (mloc === 'MRC' && (w.flag('MIRROR-OPEN-FLAG') || w.flag('WOOD-OPEN-FLAG'))) return wait(['Attendez que le miroir se referme : les Gardiens ne doivent rien voir.', 'Wait for the mirror to close: the Guardians must see nothing.'])
    return { ...verbStep(w, 'push', 'MAHOGANY-PANEL', why), verb: 'shove' }
  }
  if (mdir !== 180) return rotate(180)
  if (!w.flag('WOOD-OPEN-FLAG')) return { ...verbStep(w, 'push', 'PINE-PANEL', ['Le panneau de pin s’ouvre sur l’entrée du Donjon.', 'The pine panel opens onto the Dungeon Entrance.']), verb: 'shove' }
  return go('NORTH', ['Sortez de la boîte, devant la porte du Donjon.', 'Leave the box, in front of the Dungeon door.'])
}

/** 776, at the time of the Royal Museum's construction: the ring, hidden under the seat. */
function pastStep(w: World): GuideStep | null {
  const here = w.here()
  const why: Why = ["En 776, l'anneau est encore sur son piédestal, sans cage : prenez-le et cachez-le sous le siège de la machine pour le rapporter.", 'In 776 the ring still lies on its pedestal, uncaged: take it and hide it under the seat of the machine to bring it back.']
  if (w.flag('GUARDS-PRESENT')) return wait(['Des gardes sont derrière la porte : attendez qu’ils s’en aillent.', 'Guards are behind the door: wait until they leave.'])
  const ringFree = !w.flag('RING-CONCEALED') && !w.carried('RING')
  if (ringFree && w.loc('RING') === 'PEDESTAL') {
    if (here === 'OLD-JEWEL-ROOM') return verbStep(w, 'take', 'RING', why)
    return toward(w, 'OLD-JEWEL-ROOM', why)
  }
  if (w.inVehicle() === 'TIME-MACHINE') {
    if (w.carried('RING')) return { ...verbStep(w, 'put', 'RING', why, 'under', 'TM-SEAT'), command: 'put ring under seat' }
    if (g(w, 'TM-YEAR') !== 948) return { command: 'turn dial to 948', why: ['Réglez le cadran sur 948, le présent.', 'Set the dial to 948, the present.'], label: ['Régler le cadran sur 948', 'Set the dial to 948'], verb: 'turn', obj: 'TM-DIAL' }
    return verbStep(w, 'push', 'TM-BUTTON', ['Le bouton ramène au présent.', 'The button brings you back to the present.'])
  }
  if (here === 'OLD-TECH-MUSEUM') return { command: 'get in gold machine', why, label: ['Monter dans la machine dorée', 'Get in the gold machine'], verb: 'board', obj: 'TIME-MACHINE' }
  return toward(w, 'OLD-TECH-MUSEUM', why)
}

/** The ring of 776: the time machine, pushed to the Jewel Room, then set to the year it was built. */
function ringStep(w: World): GuideStep | null {
  const why: Why = ["L'anneau du Musée est en cage depuis 777. La machine dorée remonte le temps : dans la salle des joyaux, réglée sur 776, elle vous dépose avant la cage.", 'The museum ring has been caged since 777. The gold machine travels in time: set to 776 in the Jewel Room, it lands you before the cage.']
  const inside = w.inVehicle() === 'TIME-MACHINE'
  if (w.flag('RING-CONCEALED')) {
    if (inside) return verbStep(w, 'look under', 'TM-SEAT', ["L'anneau est caché sous le siège.", 'The ring is hidden under the seat.'])
    if (w.here() === roomOf(w, 'TIME-MACHINE')) return { command: 'get in gold machine', why, label: ['Monter dans la machine dorée', 'Get in the gold machine'], verb: 'board', obj: 'TIME-MACHINE' }
    return toward(w, roomOf(w, 'TIME-MACHINE'), why)
  }
  const at = roomOf(w, 'TIME-MACHINE')
  if (inside) {
    if (at !== 'JEWEL-ROOM') return { command: 'get out of gold machine', why, label: ['Descendre de la machine dorée', 'Get out of the gold machine'], verb: 'disembark', obj: 'TIME-MACHINE' }
    if (g(w, 'TM-YEAR') !== 776) return { command: 'turn dial to 776', why, label: ['Régler le cadran sur 776', 'Set the dial to 776'], verb: 'turn', obj: 'TM-DIAL' }
    return verbStep(w, 'push', 'TM-BUTTON', why)
  }
  const pushTo = (dir: Direction): GuideStep => ({ command: `push gold machine ${DIR_COMMAND[dir]}`, why, label: dir === 'SOUTH' ? ['Pousser la machine dorée vers le sud', 'Push the gold machine south'] : ["Pousser la machine dorée vers l'est", 'Push the gold machine east'], verb: 'push', obj: 'TIME-MACHINE' })
  if (w.here() !== at) return toward(w, at, why)
  if (at === 'TECH-MUSEUM') return w.attr('WOODEN-DOOR', 'OPENBIT') ? pushTo('SOUTH') : verbStep(w, 'open', 'WOODEN-DOOR', why)
  if (at === 'MUSEUM-ENTRANCE') return w.attr('JEWEL-DOOR', 'OPENBIT') ? pushTo('EAST') : verbStep(w, 'open', 'JEWEL-DOOR', why)
  if (at === 'JEWEL-ROOM') return { command: 'get in gold machine', why, label: ['Monter dans la machine dorée', 'Get in the gold machine'], verb: 'board', obj: 'TIME-MACHINE' }
  return null
}

/** The Dungeon: put cell 4 in place, step in, and let the Dungeon Master turn the cells. */
function dungeonStep(w: World): GuideStep | null {
  const here = w.here()
  const dmAtParapet = w.loc('DUNGEON-MASTER') === 'PARAPET'
  const why: Why = ['La cellule 4 a une porte de bronze : entrez-y, et faites tourner les cellules par le Maître du donjon, resté au parapet.', 'Cell 4 has a bronze door: step in, and have the Dungeon Master, at the parapet, turn the cells.']
  if (here === 'GOOD-CELL') {
    if (w.flag('BRONZE-DOOR-LOCKED')) return verbStep(w, 'unlock', 'BRONZE-DOOR', ['La clé étrange épouse toutes les serrures.', 'The strange key fits any lock.'], 'with', 'KEY')
    if (!w.attr('BRONZE-DOOR', 'OPENBIT')) return verbStep(w, 'open', 'BRONZE-DOOR', why)
    return go('SOUTH', ['Au-delà de la porte de bronze vous attend la fin de la quête.', 'Beyond the bronze door lies the end of the quest.'])
  }
  if (g(w, 'LCELL') !== 4) {
    if (here !== 'PARAPET') return toward(w, 'PARAPET', why)
    if (g(w, 'PNUMB') !== 4) return { command: 'turn dial to 4', why, label: ['Tourner le cadran sur 4', 'Turn the dial to 4'], verb: 'turn', obj: 'SUNDIAL' }
    return verbStep(w, 'push', 'DIAL-BUTTON', why)
  }
  if (here === 'CELL') {
    if (!dmAtParapet) return go('NORTH', why)
    if (g(w, 'PNUMB') === 4) return { command: 'master, turn dial to 1', why, label: ['Maître, tournez le cadran sur 1', 'Master, turn the dial to 1'], verb: 'turn' }
    return { command: 'master, push button', why, label: ['Maître, appuyez sur le bouton', 'Master, push the button'], verb: 'push' }
  }
  if (here !== 'NORTH-CORRIDOR') return toward(w, 'NORTH-CORRIDOR', why)
  if (!w.attr('CELL-DOOR', 'OPENBIT')) return verbStep(w, 'open', 'CELL-DOOR', why)
  if (!dmAtParapet) return { command: 'master, go north', why, label: ['Maître, allez au nord', 'Master, go north'], verb: 'walk' }
  return go('SOUTH', why)
}

// ------------------------------------------------------------------ the goals (in solution order)

interface Goal {
  id: string
  done: (w: World) => boolean
  /** Not before this (the goal is skipped until then). */
  ready?: (w: World) => boolean
  act: (w: World) => GuideStep | null
}

const GOALS: Goal[] = [
  { id: 'lamp', done: (w) => touched(w, 'LAMP'), act: (w) => fetch(w, 'LAMP', ['Votre vieille lanterne vous éclairera dans le noir.', 'Your old lantern will light the dark.']) },
  // the lake, the Scenic Vista, the key and the aqueduct first: the earthquake breaks the
  // aqueduct after 70 to 140 turns
  {
    id: 'amulet',
    done: hasAmulet,
    act: (w) => {
      const why: Why = ['Quelque chose brille au fond du lac.', 'Something shines at the bottom of the lake.']
      if (SHORES[w.here()]) return intoLake(w)
      return toward(w, 'LAKE-SHORE', why)
    },
  },
  {
    id: 'vista',
    done: vistaDone,
    act: (w) => {
      const here = w.here()
      const why: Why = ['La table du Panorama transporte, quand on la frotte, vers le lieu que montre l’indicateur (I à IV) : la salle 8 cache un répulsif à grue, et le passage humide attend une lumière.', 'Rubbing the Scenic Vista table takes you to the place the indicator shows (I to IV): Room 8 hides a grue repellent, and the Damp Passage needs a light.']
      if (here === 'ROOM-8') return w.loc('REPELLENT') === 'ROOM-8' ? verbStep(w, 'take', 'REPELLENT', why) : wait(['La table vous ramènera bientôt.', 'The table will soon bring you back.'])
      if (away(w) && here !== 'DAMP-PASSAGE') return wait(['La table vous ramènera bientôt.', 'The table will soon bring you back.'])
      if (here === 'DAMP-PASSAGE' && hasRepellent(w) && w.carried('TORCH')) return verbStep(w, 'drop', 'TORCH', ['Laissez la torche ici : vous en aurez besoin en sortant de l’aqueduc.', 'Leave the torch here: you will need it when you leave the aqueduct.'])
      if (here === 'DAMP-PASSAGE' && hasRepellent(w)) return wait(['La table vous ramènera bientôt.', 'The table will soon bring you back.'])
      if (here === 'VIEW-ROOM') {
        if (!w.carried('TORCH') && w.loc('TORCH') === 'VIEW-ROOM') return take(w, 'TORCH', why)
        const view = g(w, 'ACTIVE-VIEW')
        if (!hasRepellent(w)) return view === 2 ? verbStep(w, 'rub', 'VIEWING-TABLE', why) : wait(['Attendez que l’indicateur affiche « II ».', 'Wait for the indicator to read "II".'])
        return view === 3 ? verbStep(w, 'rub', 'VIEWING-TABLE', why) : wait(['Attendez que l’indicateur affiche « III ».', 'Wait for the indicator to read "III".'])
      }
      if (here === 'FAR-SHORE') return go('SOUTH', why)
      if (SHORES[here]) return intoLake(w)
      return toward(w, 'LAKE-SHORE', why)
    },
  },
  {
    id: 'key',
    done: (w) => touched(w, 'KEY'),
    act: (w) => {
      const here = w.here()
      const why: Why = ['Au sud du lac, des passages obscurs pleins de grues mènent à une clé : le répulsif vous protégera quelques tours.', 'South of the lake, dark passages full of grues lead to a key: the repellent will protect you for a few turns.']
      if (here === 'KEY-ROOM') return verbStep(w, 'take', 'KEY', why)
      if (away(w)) return wait(['La table vous ramènera bientôt au Panorama.', 'The table will soon bring you back to the Scenic Vista.'])
      // the repellent was lost on the way (a death scatters what you carry): fetch it first
      if (!repellentAtHand(w) && !w.flag('SPRAY-USED?') && roomOf(w, 'REPELLENT') !== '0' && here !== 'SOUTH-SHORE') return fetch(w, 'REPELLENT', why)
      if (here === 'SOUTH-SHORE' && !w.flag('SPRAYED?') && w.carried('REPELLENT')) return { ...verbStep(w, 'spray', 'REPELLENT', why, 'on', 'ME'), command: 'spray repellent on me', label: ['Vaporiser le répulsif sur vous', 'Spray the repellent on yourself'] }
      if (here === 'SOUTH-SHORE' || here.startsWith('DARK-')) return toward(w, 'KEY-ROOM', why)
      if (here === 'VIEW-ROOM') return go('NORTH', why)
      if (SHORES[here]) return intoLake(w)
      return toward(w, 'LAKE-SHORE', why)
    },
  },
  { id: 'cover', done: (w) => w.flag('COVER-MOVED'), ready: (w) => w.here() === 'KEY-ROOM', act: (w) => verbStep(w, 'move', 'COVER', ["Sous la plaque d'égout, un trou mène à l'aqueduc, la seule sortie.", 'Under the manhole cover, a hole leads to the aqueduct, the only way out.']) },
  { id: 'torch', done: (w) => w.carried('TORCH') || !w.attr('TORCH', 'ONBIT') || roomOf(w, 'TORCH') === '0' || w.loc('TORCH') === 'MREYE', ready: (w) => touched(w, 'KEY'), act: (w) => fetch(w, 'TORCH', ['La torche ne s’éteint jamais : reprenez-la.', 'The torch never goes out: take it back.']) },
  { id: 'bread', done: (w) => w.carried('WAYBREAD') || w.flag('OLD-MAN-GONE') || roomOf(w, 'WAYBREAD') === '0', act: (w) => fetch(w, 'WAYBREAD', ["Du pain frais, près de la falaise : quelqu'un en aura besoin.", 'Fresh bread near the cliff: someone will need it.']) },
  {
    id: 'staff',
    done: (w) => hasStaff(w) || w.flag('MAN-GONE'),
    act: (w) => {
      const why: Why = ["Un homme apparaît au sommet de la falaise : attachez le coffre à la corde, faites-lui confiance, et il vous remontera.", 'A man appears at the top of the cliff: tie the chest to the rope, trust him, and he will pull you up.']
      if (w.here() !== 'CLIFF-LEDGE') return toward(w, 'CLIFF-LEDGE', why)
      const chestHere = w.loc('CHEST') === 'CLIFF-LEDGE' || w.carried('CHEST')
      if (chestHere && !w.flag('CHEST-TIED') && w.flag('ROPE-FLAG')) return verbStep(w, 'tie', 'GLOBAL-ROPE', why, 'to', 'CHEST')
      if (w.flag('MAN-FLAG') && w.within('CHEST', 'MAN') && w.flag('ROPE-FLAG')) return verbStep(w, 'take', 'GLOBAL-ROPE', ['La corde est à votre portée : agrippez-la, l’homme vous hisse.', 'The rope is within reach: grab it, the man pulls you up.'])
      return wait(why)
    },
  },
  {
    id: 'hood',
    done: (w) => hasHood(w) || w.flag('SHADOW-GONE'),
    act: (w) => {
      const why: Why = ["Une silhouette encapuchonnée hante le Pays de l'Ombre : il faudra l'affronter.", 'A hooded figure haunts the Land of Shadow: you will have to face it.']
      // wounded by the figure: heal before going back (the wounds close little by little)
      if (!SHADOW_ROOMS.includes(w.here()) && g(w, 'P-STRENGTH') < 5 && w.loc('SHADOW') !== w.here()) return wait(['Blessé, reprenez des forces avant de retourner affronter la silhouette.', 'Wounded, recover before facing the figure again.'])
      if (!SHADOW_ROOMS.includes(w.here())) return route(w, 'SHADOW-8') ? toward(w, 'SHADOW-8', why) : toward(w, 'SHADOW-2', why)
      if (!w.lit() && canLight(w)) return verbStep(w, 'turn on', 'LAMP', why)
      // it shows itself only to someone with a light, and only when it is strong enough
      return g(w, 'S-STRENGTH') > 3 ? say('look', why, ['Regarder autour', 'Look around']) : wait(['La silhouette reprend des forces : attendez.', 'The figure is healing: wait.'])
    },
  },
  { id: 'cloak', done: (w) => w.carried('CLOAK') || (touched(w, 'CLOAK') && w.vm.parent(w.obj('CLOAK')) !== 0) || w.within('CLOAK', 'SHADOW'), act: (w) => fetch(w, 'CLOAK', ['La silhouette a laissé sa cape : prenez-la.', 'The figure left its cloak: take it.']) },
  {
    id: 'old-man',
    done: (w) => w.flag('OLD-MAN-GONE'),
    ready: (w) => w.carried('WAYBREAD'),
    act: (w) => {
      const why: Why = ['Un vieil homme affaibli dort parfois dans la salle des gravures : réveillez-le et donnez-lui le pain.', 'A weak old man sometimes sleeps in the Engravings Room: wake him and give him the bread.']
      const here = w.here()
      if (here === 'MSTAIRS' && w.loc('OLD-MAN') === 'MSTAIRS') {
        if (!w.flag('OLD-MAN-AWAKE')) return verbStep(w, 'wake', 'OLD-MAN', why)
        return verbStep(w, 'give', 'WAYBREAD', why, 'to', 'OLD-MAN')
      }
      // he appears only now and then, as you come in: go out and come back
      if (here === 'MSTAIRS') return go('SE', ['Le vieil homme n’est pas là : ressortez et revenez.', 'The old man is not here: go out and come back.'])
      if (here === 'DEAD-END') return go('NW', why)
      return toward(w, 'MSTAIRS', why)
    },
  },
  { id: 'secret-door', done: (w) => w.attr('SECRET-DOOR', 'OPENBIT'), ready: (w) => w.flag('OLD-MAN-GONE'), act: (w) => (w.here() === 'MSTAIRS' ? verbStep(w, 'open', 'SECRET-DOOR', ['Le vieil homme a montré une porte secrète.', 'The old man showed a secret door.']) : toward(w, 'MSTAIRS', ['Le vieil homme a montré une porte secrète.', 'The old man showed a secret door.'])) },
  {
    id: 'cleft',
    done: (w) => w.flag('CLEFT-FLAG'),
    act: (w) => (w.here() === 'MUSEUM-ANTE' ? wait(['Un tremblement de terre va ouvrir une faille près de la grande porte de fer.', 'An earthquake will open a cleft next to the great iron door.']) : toward(w, 'MUSEUM-ANTE', ['La grande porte de fer est rouillée : il faudra attendre qu’autre chose s’ouvre.', 'The great iron door is rusted shut: something else will have to open.'])),
  },
  {
    id: 'book',
    done: (w) => touched(w, 'LORE-BOOK'),
    act: (w) => (w.here() === 'CP-ANTE' ? go('DOWN', ['Le Casse-tête royal cache un livre ancien.', 'The Royal Puzzle hides an ancient book.']) : toward(w, 'CP-ANTE', ['Le Casse-tête royal cache un livre ancien.', 'The Royal Puzzle hides an ancient book.'])),
  },
  { id: 'ring', done: (w) => touched(w, 'RING') && !w.flag('RING-CONCEALED') && w.vm.parent(w.obj('RING')) !== 0 && w.flag('RING-STOLEN'), act: ringStep },
  ...OUTFIT.map(
    (o): Goal => ({
      id: `outfit-${o}`,
      done: (w) => w.has(o),
      act: (w) => fetch(w, o, ['Le Maître du donjon porte capuchon, cape, amulette et anneau, un bâton, un livre et une clé : réunissez-les.', 'The Dungeon Master wears a hood, a cloak, an amulet and a ring, with a staff, a book and a key: gather them.']),
    }),
  ),
  {
    id: 'dungeon',
    done: (w) => w.flag('IN-DUNGEON'),
    act: (w) => {
      const here = w.here()
      const why: Why = ['La porte du Donjon ne s’ouvre que pour qui ressemble au Maître du donjon.', 'The Dungeon door opens only for someone who looks like the Dungeon Master.']
      if (here === 'FRONT-DOOR') return verbStep(w, 'knock on', 'DUNGEON-DOOR', why)
      // once the Dungeon Entrance is known, the words of the Dungeon Master lead back there
      if (here === 'MSTAIRS' && touched(w, 'FRONT-DOOR')) return { command: 'say "frotz ozmoo"', why: ['Les mots du Maître du donjon ramènent à l’entrée du Donjon.', 'The words of the Dungeon Master lead back to the Dungeon Entrance.'], label: ['Dire « frotz ozmoo »', 'Say "frotz ozmoo"'], verb: 'say' }
      if (touched(w, 'FRONT-DOOR')) return toward(w, 'MSTAIRS', why)
      return mirrorEntry(w)
    },
  },
]

/** From the Button Room: break the beam, push the button, and step into the opened mirror. */
function mirrorEntry(w: World): GuideStep | null {
  const here = w.here()
  const why: Why = ['Le rayon rouge coupé, le bouton ouvre le miroir : la boîte de bois est le seul passage devant les Gardiens.', 'With the red beam broken, the button opens the mirror: the wooden box is the only way past the Guardians.']
  const beamBroken = w.children(w.obj('MREYE')).some((n) => !['ADVENTURER', 'BEAM'].includes(w.name(n)))
  if (!beamBroken) {
    if (here !== 'MREYE') return toward(w, 'MREYE', why)
    const spare = spareItem(w) ?? ['SWORD', 'LAMP', 'REPELLENT', 'TORCH'].find((o) => w.has(o))
    return spare ? verbStep(w, 'drop', spare, ['Un objet posé au sol coupe le rayon rouge.', 'Something on the floor breaks the red beam.']) : null
  }
  if (!w.flag('MIRROR-OPEN-FLAG')) return here === 'MR-ANTE' ? verbStep(w, 'push', 'RED-BUTTON', why) : toward(w, 'MR-ANTE', why)
  if (here === 'MRA') return go('NORTH', why)
  return toward(w, 'MRA', why)
}

// ------------------------------------------------------------------ main

export function zork3Step(w: World): GuideStep | null {
  const here = w.here()
  if (here === 'NIRVANA') return null
  // YEAR-PRESENT is 948 (a constant of 3actions.zil)
  if (w.global('YEAR') !== 948) return pastStep(w)
  if (here === 'CP') return puzzleStep(w)
  if (here === 'IN-MIRROR') return mirrorStep(w)
  if (here === 'ON-LAKE' || here === 'IN-LAKE') return lakeStep(w)
  const fight = shadowStep(w)
  if (fight) return fight
  if (w.flag('IN-DUNGEON')) return dungeonStep(w)
  if (!w.lit() && !w.carriesLight() && canLight(w)) return verbStep(w, 'turn on', 'LAMP', ['Il fait noir : allumez la lanterne, sinon un grue vous dévorera.', 'It is dark: turn on the lamp, or a grue will eat you.'])
  for (const goal of GOALS) {
    if (goal.done(w) || (goal.ready && !goal.ready(w))) continue
    const step = goal.act(w)
    if (step) return step
  }
  return null
}

/** Why each pending goal is or is not pursued (debugging). */
export function explainZork3(w: World): string[] {
  return GOALS.filter((goal) => !goal.done(w)).map((goal) => `${goal.id} ready=${goal.ready ? goal.ready(w) : true} → ${goal.act(w)?.command ?? 'nothing'}`)
}
