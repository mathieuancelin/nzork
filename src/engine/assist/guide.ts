// The guide of the "hyper noob" mode: it always knows the next good action.
//
// It follows the 350-point solution as an ordered list of goals. Each goal says when it is
// done (a predicate on the game state), where it happens and what to do. At every turn the
// guide takes the first unfinished goal that can be pursued, walks there (shortest path on
// the exits currently open), and acts. Because goals are checked against the state, the guide
// adapts when the player does things in another order, when the thief steals something or
// when a fight goes badly.

import { World, DIRECTIONS, DIR_COMMAND, type Direction } from './world'

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
}

type Pred = (w: World) => boolean

interface Goal {
  id: string
  why: [string, string]
  done: Pred
  ready?: Pred
  /** Objects that must be carried before acting (fetched automatically when reachable). */
  needs?: string[] | ((w: World) => string[])
  at?: string | ((w: World) => string | null)
  act: (w: World) => GuideStep | null
}

/** Games the guide knows how to finish. */
export const hasGuide = (game: string) => game === 'zork1'

// ------------------------------------------------------------------ helpers

const word = (w: World, name: string) => w.word(w.obj(name)) ?? name.toLowerCase()

function verbStep(w: World, verb: string, obj: string | undefined, why: [string, string], prep?: string, obj2?: string): GuideStep {
  let command = verb
  if (obj) command += ' ' + word(w, obj)
  if (prep && obj2) command += ` ${prep} ${word(w, obj2)}`
  return { command, why, verb, obj, prep, obj2 }
}

/** Takes an object, opening its closed container first if needed. */
function takeStep(w: World, obj: string, why: [string, string]): GuideStep {
  const o = w.obj(obj)
  const parent = w.vm.parent(o)
  const container = w.name(parent)
  if (parent && w.attrOf(parent, 'CONTBIT') && !w.attrOf(parent, 'OPENBIT') && !w.attrOf(parent, 'TRANSBIT') && w.word(parent)) {
    return verbStep(w, 'open', container, why)
  }
  return verbStep(w, 'take', obj, why)
}

const take = (obj: string, why: [string, string]) => (w: World) => takeStep(w, obj, why)
const say = (command: string, why: [string, string], verb = command) => (_w?: World): GuideStep => ({ command, why, verb })

const inCase = (w: World, t: string) => w.within(t, 'TROPHY-CASE')
/** The player's wounds (0 = healthy, negative = wounded). */
const health = (w: World) => (w.vm.getProp(w.obj('ADVENTURER'), w.game.symbols.properties.STRENGTH) << 16) >> 16
/** Carried directly while boarding, these puncture the boat. */
const SHARP = ['SCEPTRE', 'KNIFE', 'SWORD', 'RUSTY-KNIFE', 'AXE', 'STILETTO']

/** The best weapon carried. */
const weaponOf = (w: World) => ['SWORD', 'KNIFE', 'RUSTY-KNIFE', 'STILETTO', 'AXE'].find((o) => w.carried(o))
const MINE_REGION = new Set(['GAS-ROOM', 'MINE-1', 'MINE-2', 'MINE-3', 'MINE-4', 'LADDER-TOP', 'LADDER-BOTTOM', 'DEAD-END-5', 'TIMBER-ROOM', 'LOWER-SHAFT', 'MACHINE-ROOM'])
const touched = (w: World, o: string) => w.attr(o, 'TOUCHBIT')
const thiefDead = (w: World) => w.vm.parent(w.obj('THIEF')) === 0
const thiefHas = (w: World, o: string) => w.within(o, 'THIEF')

const TREASURES = [
  'EGG', 'CANARY', 'BAUBLE', 'PAINTING', 'BAR', 'TORCH', 'COFFIN', 'SCEPTRE', 'JADE', 'BRACELET', 'DIAMOND',
  'BAG-OF-COINS', 'SKULL', 'TRUNK', 'TRIDENT', 'EMERALD', 'SCARAB', 'POT-OF-GOLD', 'CHALICE',
]

/** May this treasure go into the case now? */
function depositable(w: World, t: string): boolean {
  if (t === 'EGG') return w.flag('EGG-SOLVE') && !w.within('CANARY', 'EGG') // after the thief opened it and the canary is out
  if (t === 'CANARY') return w.flag('SING-SONG')
  if (t === 'SCEPTRE') return w.flag('RAINBOW-FLAG')
  if (t === 'COFFIN') return touched(w, 'SCEPTRE') // open it and take the sceptre first
  if (t === 'TORCH') return TREASURES.filter((x) => x !== 'TORCH').every((x) => inCase(w, x)) // the torch lights the way: last
  return true
}

const ABOVE_GROUND = new Set([
  'WEST-OF-HOUSE', 'NORTH-OF-HOUSE', 'SOUTH-OF-HOUSE', 'EAST-OF-HOUSE', 'KITCHEN', 'ATTIC', 'LIVING-ROOM', 'FOREST-1', 'FOREST-2',
  'FOREST-3', 'MOUNTAINS', 'PATH', 'UP-A-TREE', 'GRATING-CLEARING', 'CLEARING', 'CANYON-VIEW', 'CLIFF-MIDDLE', 'CANYON-BOTTOM',
  'END-OF-RAINBOW', 'STONE-BARROW',
])

const RIVER = ['RIVER-1', 'RIVER-2', 'RIVER-3', 'RIVER-4', 'RIVER-5']

// ------------------------------------------------------------------ the goals (in solution order)

const deposit = (t: string): Goal => ({
  id: `deposit-${t}`,
  why: ['Les trésors rapportent des points une fois rangés dans la vitrine du salon.', 'Treasures score points once they are in the trophy case.'],
  done: (w) => inCase(w, t),
  ready: (w) => w.carried(t) && depositable(w, t) && w.attr('TROPHY-CASE', 'OPENBIT'),
  at: 'LIVING-ROOM',
  act: (w) => verbStep(w, 'put', t, goalWhyDeposit, 'in', 'TROPHY-CASE'),
})
function collect(t: string): Goal {
  return {
    id: `collect-${t}`,
    why: ['Un trésor traîne ici : ramassez-le pour le ranger dans la vitrine.', 'A treasure lies around: pick it up and store it.'],
    done: (w) => inCase(w, t) || w.carried(t),
    ready: (w) => touched(w, t) && !thiefHas(w, t) && !(t === 'TORCH' && MINE_REGION.has(roomOf(w, t))) && !w.within(t, 'TROPHY-CASE') && roomOf(w, t) !== '0' && !(t === 'CANARY' && !w.flag('EGG-SOLVE')) && !(t === 'SCEPTRE' && w.flag('RAINBOW-FLAG') === false && false),
    at: (w) => roomOf(w, t),
    act: take(t, ['Ce trésor rejoindra la vitrine.', 'This treasure goes into the case.']),
  }
}

const goalWhyDeposit: [string, string] = ['Les trésors rapportent des points une fois rangés dans la vitrine du salon.', 'Treasures score points once they are in the trophy case.']

const GOALS: Goal[] = [
  // --- the house
  { id: 'egg', why: ["Un œuf incrusté de joyaux, dans un nid : c'est un trésor (et il cache un secret).", 'A jewel-encrusted egg in a nest: a treasure (with a secret inside).'], done: (w) => touched(w, 'EGG'), at: 'UP-A-TREE', act: take('EGG', ["L'œuf est un trésor.", 'The egg is a treasure.']) },
  { id: 'window', why: ['La fenêtre entrouverte est le seul moyen d’entrer dans la maison.', 'The ajar window is the only way into the house.'], done: (w) => w.attr('KITCHEN-WINDOW', 'OPENBIT'), at: 'EAST-OF-HOUSE', act: (w) => verbStep(w, 'open', 'KITCHEN-WINDOW', ['Il faut ouvrir la fenêtre pour passer.', 'Open the window to get in.']) },
  { id: 'lamp', why: ['Sous terre, il fait noir : sans lumière, un grue vous dévorera.', 'Underground it is dark: without light, a grue will eat you.'], done: (w) => touched(w, 'LAMP'), at: 'LIVING-ROOM', act: take('LAMP', ['La lanterne est indispensable sous terre.', 'The lamp is essential underground.']) },
  { id: 'sword', why: ["Un troll garde le passage : il faudra une arme.", 'A troll guards the way: you will need a weapon.'], done: (w) => touched(w, 'SWORD'), at: 'LIVING-ROOM', act: take('SWORD', ["L'épée servira contre le troll et le voleur.", 'The sword will deal with the troll and the thief.']) },
  { id: 'case', why: ['La vitrine doit être ouverte pour y ranger les trésors.', 'The case must be open to store treasures.'], done: (w) => w.attr('TROPHY-CASE', 'OPENBIT'), at: 'LIVING-ROOM', act: (w) => verbStep(w, 'open', 'TROPHY-CASE', ['La vitrine doit être ouverte pour y ranger les trésors.', 'The case must be open to store treasures.']) },
  { id: 'rug', why: ['Le tapis cache quelque chose.', 'The rug hides something.'], done: (w) => w.flag('RUG-MOVED'), at: 'LIVING-ROOM', act: (w) => verbStep(w, 'move', 'RUG', ['Le tapis cache une trappe.', 'The rug hides a trap door.']) },
  { id: 'trapdoor', why: ['La trappe mène sous terre, au Grand Empire Souterrain.', 'The trap door leads underground.'], done: (w) => touched(w, 'TRAP-DOOR') || w.attr('TRAP-DOOR', 'OPENBIT'), at: 'LIVING-ROOM', act: (w) => verbStep(w, 'open', 'TRAP-DOOR', ['La trappe mène sous terre.', 'The trap door leads underground.']) },
  { id: 'rope', why: ['Une corde servira plus tard, dans la salle du dôme.', 'A rope will be useful later, in the Dome Room.'], done: (w) => touched(w, 'ROPE'), at: 'ATTIC', act: take('ROPE', ['La corde servira dans la salle du dôme.', 'The rope will be needed in the Dome Room.']) },
  { id: 'knife', why: ['Une arme de plus ne fait pas de mal.', 'One more weapon does not hurt.'], done: (w) => touched(w, 'KNIFE'), at: 'ATTIC', act: take('KNIFE', ['Un couteau peut servir.', 'A knife may be useful.']) },
  // --- the troll
  { id: 'troll-heal', why: ['Blessé, vous risquez de perdre contre le troll : reprenez des forces avant d\u2019y retourner.', 'Wounded, you might lose against the troll: recover first.'], done: (w) => health(w) >= 0 || w.flag('TROLL-FLAG'), ready: (w) => health(w) < 0 && w.here() !== 'TROLL-ROOM', act: say('wait', ['Le temps guérit les blessures.', 'Time heals wounds.']) },
  { id: 'troll', why: ['Le troll bloque tous les passages : il faut le vaincre.', 'The troll blocks every passage: defeat him.'], done: (w) => w.flag('TROLL-FLAG'), ready: (w) => health(w) >= 0 || w.here() === 'TROLL-ROOM', needs: (w) => (weaponOf(w) ? [] : ['SWORD']), at: 'TROLL-ROOM', act: (w) => verbStep(w, 'kill', 'TROLL', ['Le troll bloque tous les passages.', 'The troll blocks every passage.'], 'with', weaponOf(w) ?? 'SWORD') },
  // --- maze and cyclops
  { id: 'coins', why: ['Une bourse pleine de pièces repose dans le labyrinthe : un trésor.', 'A bag of coins lies in the maze: a treasure.'], done: (w) => touched(w, 'BAG-OF-COINS'), at: 'MAZE-5', act: take('BAG-OF-COINS', ['La bourse est un trésor.', 'The bag of coins is a treasure.']) },
  { id: 'cyclops', why: ['Le cyclope a peur d’un seul nom : celui de l’ennemi de son père, Ulysse.', 'The cyclops fears one name: that of his father’s enemy, Odysseus.'], done: (w) => w.flag('MAGIC-FLAG'), at: 'CYCLOPS-ROOM', act: say('odysseus', ['Dire « Ulysse » fait fuir le cyclope (indice : le livre noir).', 'Saying "Odysseus" scares the cyclops away.'], 'odysseus') },
  deposit('BAG-OF-COINS'),
  // --- painting
  { id: 'painting', why: ['La galerie abrite encore un tableau de grande valeur.', 'The gallery still holds a precious painting.'], done: (w) => touched(w, 'PAINTING'), at: 'GALLERY', act: take('PAINTING', ['Le tableau est un trésor.', 'The painting is a treasure.']) },
  deposit('PAINTING'),
  // --- loud room
  { id: 'echo', why: ["La salle bruyante assourdit tout : un mot bien choisi change son acoustique.", 'The Loud Room is deafening: the right word changes its acoustics.'], done: (w) => w.flag('LOUD-FLAG') || touched(w, 'BAR'), ready: (w) => !(w.flag('GATES-OPEN') && !w.flag('LOW-TIDE')), at: 'LOUD-ROOM', act: say('echo', ['Crier « écho » calme la salle bruyante.', 'Shouting "echo" quiets the Loud Room.'], 'echo') },
  { id: 'bar', why: ['Un lingot de platine traîne dans la salle bruyante.', 'A platinum bar lies in the Loud Room.'], done: (w) => touched(w, 'BAR'), ready: (w) => !(w.flag('GATES-OPEN') && !w.flag('LOW-TIDE')), at: 'LOUD-ROOM', act: take('BAR', ['Le lingot est un trésor.', 'The bar is a treasure.']) },
  deposit('BAR'),
  // --- dome, torch, temple, coffin
  { id: 'tie-rope', why: ['La corde attachée à la rampe permet de descendre du dôme.', 'Tied to the railing, the rope lets you climb down from the dome.'], done: (w) => w.flag('DOME-FLAG'), needs: ['ROPE'], at: 'DOME-ROOM', act: (w) => verbStep(w, 'tie', 'ROPE', ['La corde permet de descendre du dôme.', 'The rope lets you climb down.'], 'to', 'RAILING') },
  { id: 'torch', why: ["Une torche d'ivoire : un trésor, et une lumière éternelle.", 'An ivory torch: a treasure, and a light that never dies.'], done: (w) => touched(w, 'TORCH'), at: 'TORCH-ROOM', act: take('TORCH', ['La torche éclaire pour toujours (et vaut des points).', 'The torch lights forever (and scores points).']) },
  { id: 'coffin', why: ['Le cercueil en or de Ramsès II : un trésor (lourd !).', 'The gold coffin of Ramses II: a heavy treasure.'], done: (w) => touched(w, 'COFFIN'), at: 'EGYPT-ROOM', act: take('COFFIN', ['Le cercueil est un trésor.', 'The coffin is a treasure.']) },
  { id: 'pray', why: ["Avec le cercueil, impossible de remonter : mais une prière à l'autel vous ramène à la surface.", 'You cannot climb back with the coffin, but praying at the altar takes you outside.'], done: (w) => !w.carried('COFFIN') || ABOVE_GROUND.has(w.here()), ready: (w) => w.carried('COFFIN'), at: 'SOUTH-TEMPLE', act: say('pray', ["Prier à l'autel ramène à la surface avec le cercueil.", 'Praying at the altar brings you outside with the coffin.'], 'pray') },
  { id: 'coffin-out', why: ['Le sceptre est resté dans le cercueil.', 'The sceptre is still in the coffin.'], done: (w) => !inCase(w, 'COFFIN') || touched(w, 'SCEPTRE'), at: 'LIVING-ROOM', act: take('COFFIN', ['Sortez le cercueil de la vitrine pour l’ouvrir.', 'Take the coffin out of the case to open it.']) },
  { id: 'open-coffin', why: ['Le cercueil contient quelque chose.', 'The coffin contains something.'], done: (w) => w.attr('COFFIN', 'OPENBIT') || touched(w, 'SCEPTRE'), ready: (w) => w.carried('COFFIN'), at: 'LIVING-ROOM', act: (w) => verbStep(w, 'open', 'COFFIN', ['Le cercueil contient un sceptre.', 'The coffin contains a sceptre.']) },
  { id: 'sceptre', why: ['Un sceptre égyptien, caché dans le cercueil.', 'An Egyptian sceptre hidden in the coffin.'], done: (w) => touched(w, 'SCEPTRE'), ready: (w) => w.attr('COFFIN', 'OPENBIT'), at: 'LIVING-ROOM', act: take('SCEPTRE', ['Le sceptre est un trésor, et il a un pouvoir.', 'The sceptre is a treasure with a power.']) },
  deposit('COFFIN'),
  // --- the dam
  { id: 'matches', why: ['Des allumettes serviront plus tard.', 'Matches will be needed later.'], done: (w) => touched(w, 'MATCH'), at: 'DAM-LOBBY', act: take('MATCH', ['Les allumettes serviront aux Enfers.', 'The matches will be needed in Hades.']) },
  { id: 'wrench', why: ['Une clé à molette, pour le boulon du barrage.', 'A wrench, for the dam bolt.'], done: (w) => touched(w, 'WRENCH'), at: 'MAINTENANCE-ROOM', act: take('WRENCH', ['La clé à molette tourne le boulon du barrage.', 'The wrench turns the dam bolt.']) },
  { id: 'screwdriver', why: ['Un tournevis, utile pour une machine.', 'A screwdriver, useful for a machine.'], done: (w) => touched(w, 'SCREWDRIVER'), at: 'MAINTENANCE-ROOM', act: take('SCREWDRIVER', ['Le tournevis servira dans la salle de la machine.', 'The screwdriver will be used in the Machine Room.']) },
  { id: 'yellow', why: ['Le bouton jaune met le panneau de commande du barrage sous tension.', 'The yellow button powers the dam control panel.'], done: (w) => w.flag('GATE-FLAG') || w.flag('GATES-OPEN'), at: 'MAINTENANCE-ROOM', act: (w) => verbStep(w, 'push', 'YELLOW-BUTTON', ['Le bouton jaune active le boulon (la bulle verte s’allume).', 'The yellow button activates the bolt.']) },
  { id: 'bolt', why: ['Ouvrir les vannes vide le réservoir et révèle ses secrets.', 'Opening the sluice gates drains the reservoir.'], done: (w) => w.flag('GATES-OPEN') || w.flag('LOW-TIDE'), needs: ['WRENCH'], at: 'DAM-ROOM', act: (w) => verbStep(w, 'turn', 'BOLT', ['Les vannes ouvertes vident le réservoir.', 'The open gates drain the reservoir.'], 'with', 'WRENCH') },
  { id: 'low-tide', why: ['Il faut attendre que le réservoir se vide.', 'Wait for the reservoir to drain.'], done: (w) => w.flag('LOW-TIDE'), ready: (w) => w.flag('GATES-OPEN'), at: 'RESERVOIR-SOUTH', act: say('wait', ['Le réservoir met un peu de temps à se vider.', 'The reservoir takes a while to drain.'], 'wait') },
  { id: 'trunk', why: ['Une malle pleine de bijoux gît dans la boue du réservoir.', 'A trunk of jewels lies in the reservoir mud.'], done: (w) => touched(w, 'TRUNK'), ready: (w) => w.flag('LOW-TIDE'), at: 'RESERVOIR', act: take('TRUNK', ['La malle est un trésor.', 'The trunk is a treasure.']) },
  { id: 'pump', why: ['Une pompe à air : de quoi gonfler quelque chose.', 'An air pump, to inflate something.'], done: (w) => touched(w, 'PUMP'), ready: (w) => w.flag('LOW-TIDE'), at: 'RESERVOIR-NORTH', act: take('PUMP', ['La pompe gonflera le bateau.', 'The pump will inflate the boat.']) },
  { id: 'trident', why: ['Le trident de cristal de Poséidon : un trésor.', 'Poseidon’s crystal trident: a treasure.'], done: (w) => touched(w, 'TRIDENT'), ready: (w) => w.flag('LOW-TIDE'), at: 'ATLANTIS-ROOM', act: take('TRIDENT', ['Le trident est un trésor.', 'The trident is a treasure.']) },
  deposit('TRUNK'),
  deposit('TRIDENT'),
  // --- the river
  { id: 'get-sceptre', why: ["Le sceptre sera nécessaire au bout de la rivière.", 'The sceptre will be needed at the end of the river.'], done: (w) => w.carried('SCEPTRE') || w.flag('RAINBOW-FLAG') || w.within('SCEPTRE', 'INFLATED-BOAT'), ready: (w) => inCase(w, 'SCEPTRE'), at: 'LIVING-ROOM', act: (w) => verbStep(w, 'take', 'SCEPTRE', ['Le sceptre servira au bout de la rivière.', 'The sceptre will be needed downriver.']) },
  { id: 'repair-boat', why: ['Le bateau est crevé : la substance visqueuse du tube de la salle de maintenance peut le réparer.', 'The boat is punctured: the gunk in the tube from the Maintenance Room can fix it.'], done: (w) => w.vm.parent(w.obj('PUNCTURED-BOAT')) === 0, ready: (w) => w.vm.parent(w.obj('PUNCTURED-BOAT')) !== 0, needs: (w) => (w.carried('PUTTY') ? [] : ['TUBE']), at: (w) => roomOf(w, 'PUNCTURED-BOAT'), act: repairStep },
  { id: 'inflate', why: ['Ce tas de plastique est un bateau dégonflé.', 'This pile of plastic is a deflated boat.'], done: (w) => w.vm.parent(w.obj('INFLATED-BOAT')) !== 0 || touched(w, 'BUOY'), ready: (w) => w.vm.parent(w.obj('PUNCTURED-BOAT')) === 0, needs: ['PUMP'], at: (w) => roomOf(w, 'INFLATABLE-BOAT'), act: (w) => verbStep(w, 'inflate', 'INFLATABLE-BOAT', ['Gonflé, le tas de plastique devient un bateau.', 'Inflated, the plastic becomes a boat.'], 'with', 'PUMP') },
  { id: 'sceptre-in-boat', why: ['Le sceptre est pointu : porté, il crèverait le bateau. Posé dedans, il voyage sans risque.', 'The sharp sceptre would puncture the boat if carried; inside it, it is safe.'], done: (w) => w.within('SCEPTRE', 'INFLATED-BOAT') || w.flag('RAINBOW-FLAG') || touched(w, 'BUOY'), ready: (w) => w.carried('SCEPTRE') && w.vm.parent(w.obj('INFLATED-BOAT')) !== 0, at: 'DAM-BASE', act: (w) => verbStep(w, 'put', 'SCEPTRE', ['Porté, le sceptre crèverait le bateau.', 'Carried, the sceptre would puncture the boat.'], 'in', 'INFLATED-BOAT') },
  { id: 'board', why: ['En bateau, la rivière mène à des trésors.', 'By boat, the river leads to treasures.'], done: (w) => w.inVehicle() === 'INFLATED-BOAT' || touched(w, 'BUOY'), ready: (w) => w.vm.parent(w.obj('INFLATED-BOAT')) !== 0 && (w.within('SCEPTRE', 'INFLATED-BOAT') || w.flag('RAINBOW-FLAG')), at: 'DAM-BASE', act: (w) => {
    const sharp = SHARP.find((o) => w.has(o))
    if (sharp) return verbStep(w, 'drop', sharp, ['Un objet pointu crèverait le bateau : posez-le avant d\u2019embarquer.', 'A sharp object would puncture the boat: drop it first.'])
    return verbStep(w, 'board', 'INFLATED-BOAT', ['Monter dans le bateau pour descendre la rivière.', 'Board the boat to go down the river.'])
  } },
  { id: 'launch', why: ['Le courant vous emportera vers l’aval.', 'The current will carry you downstream.'], done: (w) => RIVER.includes(w.here()) || touched(w, 'BUOY'), ready: (w) => w.inVehicle() === 'INFLATED-BOAT', at: 'DAM-BASE', act: say('launch', ['Lancer le bateau sur la rivière.', 'Launch the boat.'], 'launch') },
  { id: 'drift', why: ['Laissez le courant vous porter jusqu’à la bouée rouge.', 'Let the current carry you to the red buoy.'], done: (w) => touched(w, 'BUOY'), ready: (w) => RIVER.includes(w.here()) && w.here() !== 'RIVER-4' && w.here() !== 'RIVER-5', act: say('wait', ['La bouée flotte un peu plus bas.', 'The buoy floats further down.'], 'wait') },
  { id: 'buoy', why: ['Une bouée rouge flotte ici : elle contient quelque chose.', 'A red buoy floats here, with something inside.'], done: (w) => touched(w, 'BUOY'), ready: (w) => w.here() === 'RIVER-4', act: take('BUOY', ['La bouée cache une émeraude.', 'The buoy hides an emerald.']) },
  { id: 'land', why: ['Accostez sur la rive est avant les chutes !', 'Land on the east bank before the falls!'], done: (w) => !RIVER.includes(w.here()), ready: (w) => RIVER.includes(w.here()) && (w.here() === 'RIVER-4' || w.here() === 'RIVER-5'), act: () => ({ command: 'east', why: ['Accoster sur la rive est avant les chutes.', 'Land on the east bank before the falls.'], dir: 'EAST' }) },
  { id: 'disembark', why: ['Descendez du bateau pour explorer la plage.', 'Get out of the boat to explore the beach.'], done: (w) => w.inVehicle() === null, ready: (w) => w.inVehicle() !== null && !RIVER.includes(w.here()), act: (w) => verbStep(w, 'disembark', 'INFLATED-BOAT', ['Descendre du bateau.', 'Get out of the boat.']) },
  { id: 'retrieve-sceptre', why: ['Reprenez le sceptre laissé dans le bateau.', 'Take back the sceptre left in the boat.'], done: (w) => !w.within('SCEPTRE', 'INFLATED-BOAT'), ready: (w) => w.inVehicle() === null && w.vm.parent(w.obj('INFLATED-BOAT')) === w.obj(w.here()), act: (w) => verbStep(w, 'take', 'SCEPTRE', ['Le sceptre servira aux chutes.', 'The sceptre is needed at the falls.']) },
  { id: 'open-buoy', why: ['La bouée contient quelque chose.', 'The buoy contains something.'], done: (w) => w.attr('BUOY', 'OPENBIT') || touched(w, 'EMERALD'), ready: (w) => w.carried('BUOY') && !RIVER.includes(w.here()), act: (w) => verbStep(w, 'open', 'BUOY', ['La bouée contient une émeraude.', 'The buoy contains an emerald.']) },
  { id: 'emerald', why: ['Une grosse émeraude : un trésor.', 'A large emerald: a treasure.'], done: (w) => touched(w, 'EMERALD'), ready: (w) => w.attr('BUOY', 'OPENBIT') && (w.carried('BUOY') || w.loc('BUOY') === w.here()), act: take('EMERALD', ["L'émeraude est un trésor.", 'The emerald is a treasure.']) },
  { id: 'shovel', why: ['Une pelle : la grotte voisine est pleine de sable.', 'A shovel: the nearby cave is full of sand.'], done: (w) => touched(w, 'SHOVEL'), at: 'SANDY-BEACH', act: take('SHOVEL', ['La pelle permet de creuser dans la grotte.', 'The shovel lets you dig in the cave.']) },
  { id: 'dig', why: ['Quelque chose est enfoui dans le sable.', 'Something is buried in the sand.'], done: (w) => touched(w, 'SCARAB') || !w.attr('SCARAB', 'INVISIBLE'), needs: ['SHOVEL'], at: 'SANDY-CAVE', act: (w) => verbStep(w, 'dig', 'SAND', ['Creuser révèle un scarabée.', 'Digging reveals a scarab.'], 'with', 'SHOVEL') },
  { id: 'scarab', why: ['Un scarabée orné de joyaux : un trésor.', 'A jeweled scarab: a treasure.'], done: (w) => touched(w, 'SCARAB'), at: 'SANDY-CAVE', act: take('SCARAB', ['Le scarabée est un trésor.', 'The scarab is a treasure.']) },
  { id: 'rainbow', why: ['Le sceptre agité devant les chutes rend l’arc-en-ciel solide.', 'Waving the sceptre at the falls makes the rainbow solid.'], done: (w) => w.flag('RAINBOW-FLAG'), needs: ['SCEPTRE'], at: 'ARAGAIN-FALLS', act: (w) => verbStep(w, 'wave', 'SCEPTRE', ['Le sceptre rend l’arc-en-ciel solide.', 'The sceptre makes the rainbow solid.']) },
  { id: 'pot', why: ["Au pied de l'arc-en-ciel, un pot d'or !", 'At the end of the rainbow, a pot of gold!'], done: (w) => touched(w, 'POT-OF-GOLD'), ready: (w) => w.flag('RAINBOW-FLAG'), at: 'END-OF-RAINBOW', act: take('POT-OF-GOLD', ["Le pot d'or est un trésor.", 'The pot of gold is a treasure.']) },
  deposit('EMERALD'),
  deposit('SCARAB'),
  deposit('POT-OF-GOLD'),
  deposit('SCEPTRE'),
  // --- Hades
  { id: 'bell', why: ['La cloche fait partie du rituel pour entrer aux Enfers.', 'The bell is part of the ritual to enter Hades.'], done: (w) => touched(w, 'BELL') || w.flag('LLD-FLAG'), at: 'NORTH-TEMPLE', act: take('BELL', ['La cloche sert au rituel des Enfers.', 'The bell is needed for the Hades ritual.']) },
  { id: 'book', why: ['Le livre noir contient une prière d’exorcisme.', 'The black book holds a prayer of exorcism.'], done: (w) => touched(w, 'BOOK') || w.flag('LLD-FLAG'), at: 'SOUTH-TEMPLE', act: take('BOOK', ['Le livre sert au rituel des Enfers.', 'The book is needed for the Hades ritual.']) },
  { id: 'candles', why: ['Des bougies allumées complètent le rituel.', 'Lit candles complete the ritual.'], done: (w) => touched(w, 'CANDLES') || w.flag('LLD-FLAG'), at: 'SOUTH-TEMPLE', act: take('CANDLES', ['Les bougies servent au rituel des Enfers.', 'The candles are needed for the Hades ritual.']) },
  { id: 'exorcism', needs: (w) => [...(w.flag('XB') ? [] : ['BELL', 'CANDLES']), 'MATCH', 'BOOK'], why: ['Des esprits gardent l’entrée : cloche, bougies et livre les chasseront.', 'Spirits guard the gate: bell, candles and book will banish them.'], done: (w) => w.flag('LLD-FLAG'), at: 'ENTRANCE-TO-HADES', act: exorcismStep },
  { id: 'skull', why: ['Un crâne de cristal repose au Pays des morts.', 'A crystal skull lies in the Land of the Dead.'], done: (w) => touched(w, 'SKULL'), ready: (w) => w.flag('LLD-FLAG'), at: 'LAND-OF-LIVING-DEAD', act: take('SKULL', ['Le crâne est un trésor.', 'The skull is a treasure.']) },
  { id: 'drop-ritual', why: ['La cloche, le livre et les bougies ne servent plus : allégez-vous (une flamme ferait exploser la salle du gaz).', 'The bell, book and candles are no longer needed (a flame would blow up the Gas Room).'], done: (w) => !w.carried('CANDLES') && !w.carried('BOOK') && !(w.carried('MATCH') && w.attr('MATCH', 'ONBIT')), ready: (w) => w.flag('LLD-FLAG'), act: (w) => verbStep(w, 'drop', w.carried('CANDLES') ? 'CANDLES' : w.carried('BOOK') ? 'BOOK' : 'MATCH', ['Ces objets ne servent plus.', 'These are no longer needed.']) },
  deposit('SKULL'),
  // --- the coal mine
  { id: 'garlic', why: ["Une chauve-souris vampire hante la mine : l'ail la tiendra à distance.", 'A vampire bat haunts the mine: garlic keeps it away.'], done: (w) => w.carried('GARLIC') || touched(w, 'JADE'), at: (w) => roomOf(w, 'GARLIC'), act: take('GARLIC', ["L'ail repousse la chauve-souris.", 'Garlic repels the bat.']) },
  { id: 'jade', why: ['Une figurine de jade, dans la salle de la chauve-souris.', 'A jade figurine, in the Bat Room.'], done: (w) => touched(w, 'JADE'), needs: ['GARLIC'], at: 'BAT-ROOM', act: take('JADE', ['La figurine est un trésor.', 'The figurine is a treasure.']) },
  { id: 'basket-torch', needs: (w) => (w.within('SCREWDRIVER', 'RAISED-BASKET') ? ['LAMP'] : ['LAMP', 'SCREWDRIVER']), why: ['Pas de flamme dans la salle du gaz (explosion !) : la torche voyagera par le panier.', 'No flame in the Gas Room (explosion!): the torch travels in the basket.'], done: (w) => touched(w, 'DIAMOND') || w.within('COAL', 'MACHINE') || (w.within('TORCH', 'RAISED-BASKET') && w.within('SCREWDRIVER', 'RAISED-BASKET')), ready: (w) => w.flag('CAGE-TOP') && (w.carried('TORCH') || w.within('TORCH', 'RAISED-BASKET')), at: 'SHAFT-ROOM', act: basketLoad },
  { id: 'bracelet', needs: ['LAMP'], why: ['Un bracelet de saphirs, dans la salle du gaz.', 'A sapphire bracelet, in the Gas Room.'], done: (w) => touched(w, 'BRACELET'), at: 'GAS-ROOM', act: take('BRACELET', ['Le bracelet est un trésor.', 'The bracelet is a treasure.']) },
  { id: 'coal', why: ['Du charbon : sous pression, il pourrait devenir autre chose.', 'Coal: under pressure, it could become something else.'], done: (w) => touched(w, 'COAL') || touched(w, 'DIAMOND'), at: 'DEAD-END-5', act: take('COAL', ['Le charbon deviendra un diamant.', 'The coal will become a diamond.']) },
  { id: 'coal-basket', why: ['Le charbon doit descendre par le panier : le passage vers la machine est trop étroit.', 'The coal goes down in the basket: the way to the machine is too narrow.'], done: (w) => touched(w, 'DIAMOND') || w.within('COAL', 'RAISED-BASKET') || w.within('COAL', 'MACHINE'), ready: (w) => w.carried('COAL') && w.flag('CAGE-TOP'), at: 'SHAFT-ROOM', act: (w) => verbStep(w, 'put', 'COAL', ['Le charbon descendra par le panier.', 'The coal goes down in the basket.'], 'in', 'RAISED-BASKET') },
  { id: 'basket-relight', why: ['Le panier est descendu sans lumière : remontez-le pour y mettre la torche.', 'The basket went down without light: raise it to put the torch in.'], done: (w) => w.flag('CAGE-TOP') || w.roomLit('LOWER-SHAFT') || touched(w, 'DIAMOND'), ready: (w) => !w.flag('CAGE-TOP') && w.within('COAL', 'RAISED-BASKET') && !w.roomLit('LOWER-SHAFT') && w.carried('TORCH'), at: 'SHAFT-ROOM', act: (w) => verbStep(w, 'raise', 'LOWERED-BASKET', ['Remonter le panier pour y mettre la torche.', 'Raise the basket to put the torch in.']) },
  { id: 'lower-basket', why: ['Descendre le panier jusqu\u2019au fond du puits.', 'Lower the basket to the bottom of the shaft.'], done: (w) => touched(w, 'DIAMOND') || !w.flag('CAGE-TOP') || w.within('COAL', 'MACHINE'), ready: (w) => w.within('COAL', 'RAISED-BASKET') && w.flag('CAGE-TOP') && w.within('TORCH', 'RAISED-BASKET'), at: 'SHAFT-ROOM', act: (w) => verbStep(w, 'lower', 'RAISED-BASKET', ['Le panier descend au fond du puits.', 'The basket goes down the shaft.']) },
  { id: 'empty-hands', why: ['Le passage vers la salle des courants d\u2019air est si étroit qu\u2019il faut avoir les mains vides.', 'The passage is so narrow you must be empty-handed.'], done: (w) => touched(w, 'DIAMOND') || w.here() !== 'TIMBER-ROOM' || w.children(w.obj('ADVENTURER')).length === 0, ready: (w) => w.here() === 'TIMBER-ROOM' && !w.flag('CAGE-TOP') && w.roomLit('LOWER-SHAFT'), act: () => ({ command: 'drop all', why: ['Le passage est trop étroit avec des objets.', 'The passage is too narrow with objects.'], verb: 'drop all' }) },
  { id: 'machine-coal', why: ['Le charbon va dans la machine.', 'The coal goes into the machine.'], done: (w) => touched(w, 'DIAMOND') || w.within('COAL', 'MACHINE'), ready: (w) => ((w.within('COAL', 'RAISED-BASKET') && !w.flag('CAGE-TOP')) || w.carried('COAL')) && (w.roomLit('LOWER-SHAFT') || w.carriesLight()), at: (w) => (!w.flag('CAGE-TOP') && ['COAL', 'SCREWDRIVER', 'TORCH'].some((o) => w.within(o, 'RAISED-BASKET')) ? 'LOWER-SHAFT' : 'MACHINE-ROOM'), act: machineStep },
  { id: 'diamond', why: ['La machine transforme le charbon en diamant.', 'The machine turns coal into a diamond.'], done: (w) => touched(w, 'DIAMOND'), ready: (w) => w.within('COAL', 'MACHINE') || w.within('DIAMOND', 'MACHINE'), at: 'MACHINE-ROOM', act: machineStep },
  { id: 'basket-up', why: ['Le diamant, la torche et le tournevis remontent par le panier : le passage est trop étroit.', 'The diamond, torch and screwdriver go up in the basket: the passage is too narrow.'], done: (w) => !['LOWER-SHAFT', 'MACHINE-ROOM'].includes(w.here()) || !['DIAMOND', 'TORCH', 'SCREWDRIVER'].some((o) => w.carried(o)), ready: (w) => touched(w, 'DIAMOND') && ['LOWER-SHAFT', 'MACHINE-ROOM'].includes(w.here()) && !w.flag('CAGE-TOP'), at: 'LOWER-SHAFT', act: (w) => verbStep(w, 'put', ['DIAMOND', 'TORCH', 'SCREWDRIVER'].find((o) => w.carried(o))!, ['Seul le panier peut remonter les objets.', 'Only the basket can carry objects up.'], 'in', 'RAISED-BASKET') },
  { id: 'pick-up-timber', why: ['Reprenez les affaires laissées dans la salle des poutres.', 'Pick up the things left in the Timber Room.'], done: (w) => timberLeftovers(w).length === 0, ready: (w) => timberLeftovers(w).length > 0 && (touched(w, 'DIAMOND') || (w.here() === 'TIMBER-ROOM' && !enterable(w, 'LOWER-SHAFT'))), at: 'TIMBER-ROOM', act: (w) => takeStep(w, timberLeftovers(w)[0], ['Vos affaires vous attendent ici.', 'Your things are waiting here.']) },
  { id: 'raise-basket', why: ['Remontez le panier avec le diamant.', 'Raise the basket with the diamond.'], done: (w) => w.flag('CAGE-TOP') || !w.within('DIAMOND', 'RAISED-BASKET'), ready: (w) => w.within('DIAMOND', 'RAISED-BASKET') && !w.flag('CAGE-TOP'), at: 'SHAFT-ROOM', act: (w) => verbStep(w, 'raise', 'LOWERED-BASKET', ['Le panier remonte le diamant.', 'The basket brings the diamond up.']) },
  { id: 'take-diamond', why: ['Le diamant est dans le panier.', 'The diamond is in the basket.'], done: (w) => !w.within('DIAMOND', 'RAISED-BASKET'), ready: (w) => w.within('DIAMOND', 'RAISED-BASKET') && w.flag('CAGE-TOP'), at: 'SHAFT-ROOM', act: take('DIAMOND', ['Le diamant est un trésor.', 'The diamond is a treasure.']) },
  { id: 'take-torch-basket', why: ['Reprenez la torche.', 'Take the torch back.'], done: (w) => !w.within('TORCH', 'RAISED-BASKET'), ready: (w) => w.within('TORCH', 'RAISED-BASKET') && w.flag('CAGE-TOP') && (touched(w, 'DIAMOND') || !w.within('COAL', 'RAISED-BASKET')) && !['GAS-ROOM'].includes(w.here()), at: 'SHAFT-ROOM', act: take('TORCH', ['La torche éclaire pour toujours.', 'The torch lights forever.']) },
  deposit('JADE'),
  deposit('BRACELET'),
  deposit('DIAMOND'),
  // --- the thief
  { id: 'get-egg', why: ["L'œuf est fermé : seul le voleur, habile de ses mains, saura l'ouvrir.", 'The egg is closed: only the thief can open it.'], done: (w) => w.carried('EGG') || thiefHas(w, 'EGG') || w.flag('EGG-SOLVE') || thiefDead(w), at: (w) => roomOf(w, 'EGG'), act: take('EGG', ["Le voleur saura ouvrir l'œuf.", 'The thief can open the egg.']) },
  { id: 'heal', why: ['Blessé, vous perdriez le combat contre le voleur : reposez-vous d\u2019abord.', 'Wounded, you would lose against the thief: rest first.'], done: (w) => health(w) >= 0 || thiefDead(w), ready: (w) => health(w) < 0 && w.vm.parent(w.obj('THIEF')) !== w.obj(w.here()), act: say('wait', ['Le temps guérit les blessures.', 'Time heals wounds.']) },
  { id: 'thief', why: ['Le voleur garde son repaire et votre butin. Astuce : quand il admire un trésor qu\u2019on vient de lui offrir, il baisse sa garde ; et il craint le couteau.', 'The thief guards his lair and your loot. Tip: while admiring a gift he lowers his guard, and he fears the knife.'], done: thiefDead, ready: (w) => health(w) >= 0 || w.here() === 'TREASURE-ROOM', needs: thiefWeaponNeeds, at: 'TREASURE-ROOM', act: thiefStep },
  { id: 'chalice', why: ['Le calice d\u2019argent du voleur est à vous.', 'The thief\u2019s silver chalice is yours.'], done: (w) => touched(w, 'CHALICE'), ready: thiefDead, at: (w) => roomOf(w, 'CHALICE'), act: take('CHALICE', ['Le calice est un trésor.', 'The chalice is a treasure.']) },
  // --- the canary
  { id: 'canary', why: ["Le canari mécanique sort de l'œuf ouvert.", 'The clockwork canary comes out of the open egg.'], done: (w) => touched(w, 'CANARY'), ready: (w) => w.flag('EGG-SOLVE') && (w.carried('EGG') || w.loc('EGG') === w.here()), at: (w) => roomOf(w, 'EGG'), act: take('CANARY', ['Le canari est un trésor, et il chante.', 'The canary is a treasure, and it sings.']) },
  { id: 'wind', why: ['Remonté en forêt, le canari attire un oiseau chanteur… qui apporte un cadeau.', 'Wound in the forest, the canary attracts a songbird with a gift.'], done: (w) => w.flag('SING-SONG'), needs: ['CANARY'], at: (w) => (['FOREST-1', 'FOREST-2', 'FOREST-3', 'PATH'].includes(w.here()) ? w.here() : 'PATH'), act: (w) => verbStep(w, 'wind', 'CANARY', ['Le canari attire un oiseau chanteur.', 'The canary attracts a songbird.']) },
  { id: 'bauble', why: ["L'oiseau a laissé tomber une babiole en laiton.", 'The songbird dropped a brass bauble.'], done: (w) => touched(w, 'BAUBLE'), ready: (w) => w.flag('SING-SONG'), at: (w) => roomOf(w, 'BAUBLE'), act: take('BAUBLE', ['La babiole est un trésor.', 'The bauble is a treasure.']) },
  // --- treasures lying somewhere (dropped, or left by the thief): pick them up
  ...TREASURES.map(collect),
  // --- every treasure still to store
  ...TREASURES.map(deposit),
  // --- the end
  { id: 'map', why: ['Une carte est apparue dans la vitrine : elle révèle le dernier secret.', 'A map appeared in the case: it reveals the final secret.'], done: (w) => touched(w, 'MAP') || w.here() === 'STONE-BARROW', ready: (w) => w.flag('WON-FLAG'), at: 'LIVING-ROOM', act: take('MAP', ['La carte mène au tumulus de pierre.', 'The map leads to the stone barrow.']) },
  { id: 'barrow', why: ['Le chemin secret mène au tumulus de pierre : entrez-y pour terminer votre quête.', 'The secret path leads to the stone barrow: enter to end your quest.'], done: () => false, ready: (w) => w.flag('WON-FLAG'), at: 'STONE-BARROW', act: say('enter', ['Entrer dans le tumulus termine la partie… en beauté.', 'Entering the barrow ends the game in style.'], 'enter') },
]

/** Objects the player left in the Timber Room before squeezing through the passage. */
function timberLeftovers(w: World): string[] {
  return w
    .children(w.obj('TIMBER-ROOM'))
    .filter((n) => w.attrOf(n, 'TAKEBIT') && w.attrOf(n, 'TOUCHBIT') && w.name(n) !== 'TIMBERS')
    .map((n) => w.name(n))
    .sort((a, b) => (a === 'LAMP' ? -1 : b === 'LAMP' ? 1 : 0))
}

/** The knife is the thief's weak spot; when it cannot be reached, any weapon will do. */
function thiefWeaponNeeds(w: World): string[] {
  if (w.carried('KNIFE')) return []
  const room = roomOf(w, 'KNIFE')
  if (!thiefHas(w, 'KNIFE') && room !== '0' && reachable(w, room)) return ['KNIFE']
  if (weaponOf(w)) return []
  const swordRoom = roomOf(w, 'SWORD')
  return swordRoom !== '0' && reachable(w, swordRoom) ? ['SWORD'] : []
}

/** Against the thief: offer a treasure (he lowers his guard to admire it), then strike with the knife. */
function thiefStep(w: World): GuideStep {
  const here = w.obj(w.here())
  if (w.vm.parent(w.obj('THIEF')) !== here) return say('wait', ['Le voleur va accourir pour défendre son repaire.', 'The thief will rush to defend his lair.'])()
  const weapon = w.carried('KNIFE') ? 'KNIFE' : (weaponOf(w) ?? 'SWORD')
  if (!w.flag('THIEF-ENGROSSED') && w.attrOf(w.obj('THIEF'), 'FIGHTBIT') === false || !w.flag('THIEF-ENGROSSED')) {
    const gift = giftForThief(w)
    if (gift) return verbStep(w, 'give', gift, ["Offrez-lui un trésor : il baissera sa garde pour l'admirer (et s'il a l'œuf en mourant, l'œuf sera ouvert).", 'Offer him a treasure: he lowers his guard to admire it.'], 'to', 'THIEF')
  }
  return verbStep(w, 'kill', 'THIEF', ['Frappez pendant qu\u2019il admire son trésor : le couteau est son point faible.', 'Strike while he admires the treasure: the knife is his weak spot.'], 'with', weapon)
}

function giftForThief(w: World): string | null {
  if (w.carried('EGG') && !w.flag('EGG-SOLVE')) return 'EGG'
  const carried = w.children(w.obj('ADVENTURER')).map((n) => w.name(n))
  const other = carried.find((o) => TREASURES.includes(o) && o !== 'TORCH')
  if (other) return other
  if (carried.includes('TORCH') && w.carried('LAMP') && w.attr('LAMP', 'ONBIT')) return 'TORCH'
  return null
}

function repairStep(w: World): GuideStep | null {
  const why: [string, string] = ['La substance visqueuse du tube répare le bateau crevé.', 'The gunk from the tube repairs the punctured boat.']
  if (!w.carried('PUTTY')) {
    if (!w.attr('TUBE', 'OPENBIT')) return verbStep(w, 'open', 'TUBE', why)
    return { command: 'squeeze tube', why, verb: 'squeeze', obj: 'TUBE' }
  }
  return verbStep(w, 'put', 'PUTTY', why, 'on', 'PUNCTURED-BOAT')
}

function exorcismStep(w: World): GuideStep | null {
  const why: [string, string] = ['Cloche, bougies allumées, puis la prière du livre.', 'Bell, lit candles, then the prayer from the book.']
  if (!w.flag('XB')) {
    if (!w.carried('BELL')) return null
    return verbStep(w, 'ring', 'BELL', why)
  }
  if (!w.flag('XC')) {
    if (!w.carried('CANDLES')) return verbStep(w, 'take', 'CANDLES', why)
    if (!w.attr('MATCH', 'ONBIT')) return { command: 'light match', why, verb: 'light', obj: 'MATCH' }
    return verbStep(w, 'light', 'CANDLES', why, 'with', 'MATCH')
  }
  if (!w.carried('BOOK')) return verbStep(w, 'take', 'BOOK', why)
  return verbStep(w, 'read', 'BOOK', why)
}

function basketLoad(w: World): GuideStep | null {
  const why: [string, string] = ['Pas de flamme dans la salle du gaz : la torche et le tournevis voyagent par le panier.', 'No flame in the Gas Room: the torch and screwdriver travel in the basket.']
  if (w.carried('LAMP') && !w.attr('LAMP', 'ONBIT')) return verbStep(w, 'turn on', 'LAMP', why)
  if (w.carried('TORCH')) return verbStep(w, 'put', 'TORCH', why, 'in', 'RAISED-BASKET')
  if (w.carried('SCREWDRIVER')) return verbStep(w, 'put', 'SCREWDRIVER', why, 'in', 'RAISED-BASKET')
  return null
}

function machineStep(w: World): GuideStep | null {
  const why: [string, string] = ['La machine, actionnée au tournevis, transforme le charbon en diamant.', 'The machine, started with the screwdriver, turns coal into a diamond.']
  // get what is in the basket first
  if (w.here() === 'LOWER-SHAFT') {
    for (const o of ['COAL', 'SCREWDRIVER', 'TORCH']) if (w.within(o, 'RAISED-BASKET')) return verbStep(w, 'take', o, why)
    return null
  }
  if (w.within('DIAMOND', 'MACHINE')) return w.attr('MACHINE', 'OPENBIT') ? verbStep(w, 'take', 'DIAMOND', why) : verbStep(w, 'open', 'MACHINE', why)
  if (w.within('COAL', 'MACHINE')) {
    if (w.attr('MACHINE', 'OPENBIT')) return verbStep(w, 'close', 'MACHINE', why)
    if (!w.carried('SCREWDRIVER')) return null
    return verbStep(w, 'turn', 'MACHINE-SWITCH', why, 'with', 'SCREWDRIVER')
  }
  if (w.carried('COAL')) return w.attr('MACHINE', 'OPENBIT') ? verbStep(w, 'put', 'COAL', why, 'in', 'MACHINE') : verbStep(w, 'open', 'MACHINE', why)
  return null
}

// ------------------------------------------------------------------ navigation

const VILLAINS = ['TROLL', 'THIEF']
/** The thief's lair is only entered on purpose, to fight him. */
let allowLair = false

/** Is the room safe to enter with what the player carries? */
function enterable(w: World, room: string, ignoreDark = false, ignoreBat = false): boolean {
  if (w.flag('DEAD')) return room !== 'LOWER-SHAFT'
  if (room === 'BAT-ROOM' && !w.carried('GARLIC') && !ignoreBat) return false
  if (room === 'GAS-ROOM' && (w.carried('TORCH') || (w.carried('CANDLES') && w.attr('CANDLES', 'ONBIT')) || (w.carried('MATCH') && w.attr('MATCH', 'ONBIT')))) return false
  if (room === 'LOUD-ROOM' && w.flag('GATES-OPEN') && !w.flag('LOW-TIDE')) return false
  if (room === 'TREASURE-ROOM' && (!w.flag('CYCLOPS-FLAG') || (!thiefDead(w) && !allowLair))) return false
  if (ignoreDark) return true
  if (room === 'LOWER-SHAFT' || room === 'MACHINE-ROOM') return w.roomLit('LOWER-SHAFT') || w.roomLit(room) || w.carriesLight()
  if (!w.roomLit(room) && !w.carriesLight() && !canLight(w)) return false
  return true
}

function canLight(w: World): boolean {
  return w.carried('LAMP') && !w.attr('LAMP', 'RMUNGBIT')
}

interface Edge {
  to: string
  step: GuideStep
}

function edges(w: World, room: string, noMirror = false): Edge[] {
  const out: Edge[] = []
  for (const d of DIRECTIONS) {
    const e = w.exit(room, d)
    if (e.kind === 'open') out.push({ to: e.to, step: { command: DIR_COMMAND[d], why: ['', ''], dir: d } })
  }
  // computed exits that matter
  if (room === 'LIVING-ROOM') {
    out.push({ to: 'CELLAR', step: w.attr('TRAP-DOOR', 'OPENBIT') ? { command: 'down', why: ['', ''], dir: 'DOWN' } : verbStep(w, 'open', 'TRAP-DOOR', ['La trappe mène sous terre.', 'The trap door leads underground.']) })
  }
  // the narrow passage of the Timber Room only lets empty-handed adventurers through
  const empty = w.children(w.obj('ADVENTURER')).length === 0
  if (room === 'TIMBER-ROOM' && w.roomLit('LOWER-SHAFT')) out.push({ to: 'LOWER-SHAFT', step: empty ? { command: 'west', why: ['', ''], dir: 'WEST' } : { command: 'drop all', why: ['Le passage est si étroit qu\u2019il faut avoir les mains vides.', 'The passage is so narrow you must be empty-handed.'], verb: 'drop all' } })
  if (room === 'LOWER-SHAFT' && empty) out.push({ to: 'TIMBER-ROOM', step: { command: 'east', why: ['', ''], dir: 'EAST' } })
  // rubbing the mirror swaps the whole contents of the two Mirror Rooms (the player included):
  // useless to fetch an object lying in the other room
  if (noMirror) return out
  if (room === 'MIRROR-ROOM-1') out.push({ to: 'MIRROR-ROOM-2', step: verbStep(w, 'rub', 'MIRROR-1', ['Frotter le miroir transporte dans l’autre salle du miroir.', 'Rubbing the mirror moves you to the other Mirror Room.']) })
  if (room === 'MIRROR-ROOM-2') out.push({ to: 'MIRROR-ROOM-1', step: verbStep(w, 'rub', 'MIRROR-2', ['Frotter le miroir transporte dans l’autre salle du miroir.', 'Rubbing the mirror moves you to the other Mirror Room.']) })
  return out
}

/** First step of the shortest path from the current room to `target`, or null. */
function route(w: World, target: string, ignoreDark = false, ignoreBat = false, noMirror = target.startsWith('MIRROR-ROOM')): GuideStep | null {
  const start = w.here()
  if (start === target) return null
  const prev = new Map<string, { from: string; step: GuideStep }>()
  const queue = [start]
  const seen = new Set([start])
  while (queue.length) {
    const r = queue.shift()!
    for (const e of edges(w, r, noMirror)) {
      if (seen.has(e.to)) continue
      if (!enterable(w, e.to, ignoreDark, ignoreBat)) continue
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

function reachable(w: World, target: string): boolean {
  return w.here() === target || route(w, target) !== null
}

// ------------------------------------------------------------------ load management

function weight(w: World, obj: number): number {
  let total = w.vm.getProp(obj, w.game.symbols.properties.SIZE)
  for (const c of w.children(obj)) total += weight(w, c)
  return total
}

const DROP_PRIORITY = [
  'TIMBERS', 'BOAT-LABEL', 'SHOVEL', 'PUMP', 'WRENCH', 'KEYS', 'MAP', 'ADVERTISEMENT', 'BOTTLE', 'SANDWICH-BAG', 'BELL', 'HOT-BELL',
  'BOOK', 'CANDLES', 'MATCH', 'GUIDE', 'TUBE', 'RUSTY-KNIFE', 'STILETTO', 'AXE', 'GARLIC', 'SCREWDRIVER', 'ROPE', 'SWORD', 'KNIFE', 'EGG', 'LAMP',
]

/** What can be dropped to make room, given the items needed soon. */
function dropCandidate(w: World, keep: Set<string>): string | null {
  const carried = w.children(w.obj('ADVENTURER')).map((n) => w.name(n))
  if (carried.includes('BUOY') && touched(w, 'EMERALD') && !keep.has('BUOY')) return 'BUOY'
  for (const o of DROP_PRIORITY) if (carried.includes(o) && !keep.has(o)) return o
  // a treasure that cannot be stored yet
  for (const o of carried) if (!keep.has(o) && TREASURES.includes(o) && o !== 'TORCH') return o
  return null
}

// ------------------------------------------------------------------ main

/** The guide's next step, or null when it has nothing to suggest (it only knows Zork I). */
export function guideStep(w: World): GuideStep | null {
  if (!hasGuide(w.id)) return null
  const step = plan(w)
  // save the lamp's battery when the torch (or daylight) is enough for the next step
  const here = w.here()
  const lampOn = w.carried('LAMP') && w.attr('LAMP', 'ONBIT')
  if (lampOn && step && !(step.verb === 'turn on') && here !== 'SHAFT-ROOM') {
    const torchLight = w.carried('TORCH') && w.attr('TORCH', 'ONBIT') && !(step.verb === 'put' && step.obj === 'TORCH')
    const daylight = w.roomLit(here) && ABOVE_GROUND.has(here)
    let destLit = true
    if (step.dir) {
      const to = destination(w, here, step.dir)
      destLit = !to || w.roomLit(to)
    }
    if (torchLight || (daylight && destLit)) {
      return verbStep(w, 'turn off', 'LAMP', ['La torche (ou le jour) suffit : économisez la pile de la lanterne.', 'The torch (or daylight) is enough: save the lamp battery.'])
    }
  }
  return step
}

function plan(w: World): GuideStep | null {
  const here = w.here()

  // dead: a wandering spirit must pray at the altar to come back to life
  if (w.flag('DEAD')) {
    const why: [string, string] = ["Vous êtes mort… mais une prière à l'autel du temple peut vous ramener à la vie.", 'You are dead, but a prayer at the temple altar can bring you back.']
    if (here === 'SOUTH-TEMPLE') return say('pray', why)()
    const s = route(w, 'SOUTH-TEMPLE')
    return s ? { ...s, why } : null
  }

  // fights first: strike, or flee when badly wounded by the thief
  for (const v of VILLAINS) {
    const villain = w.obj(v)
    if (w.vm.parent(villain) === w.obj(here) && w.attrOf(villain, 'FIGHTBIT')) {
      if ((v === 'THIEF' && health(w) <= -1) || (v === 'TROLL' && health(w) <= -2)) {
        const exit = DIRECTIONS.find((d) => w.exit(here, d).kind === 'open')
        if (exit) return { command: DIR_COMMAND[exit], why: ['Gravement blessé : battez en retraite pour reprendre des forces.', 'Badly wounded: retreat and recover.'], dir: exit }
      }
      if (v === 'THIEF' && thiefDead(w) === false && (w.carried('KNIFE') || weaponOf(w))) return thiefStep(w)
      const weapon = weaponOf(w)
      if (weapon) return verbStep(w, 'kill', v, ['Le combat est engagé : frappez !', 'The fight is on: strike!'], 'with', weapon)
    }
  }

  // light
  if (!w.lit() && !w.carriesLight() && canLight(w)) return verbStep(w, 'turn on', 'LAMP', ['Il fait noir : allumez la lanterne, sinon un grue vous dévorera.', 'It is dark: turn on the lamp, or a grue will eat you.'])

  // store treasures whenever we are in the living room
  if (here === 'LIVING-ROOM' && w.attr('TROPHY-CASE', 'OPENBIT')) {
    for (const t of TREASURES) if (w.carried(t) && depositable(w, t)) return verbStep(w, 'put', t, goalWhyDeposit, 'in', 'TROPHY-CASE')
  }

  const pending = GOALS.filter((g) => !g.done(w))
  for (let i = 0; i < pending.length; i++) {
    const g = pending[i]
    allowLair = g.id === 'thief' || g.id === 'give-egg'
    if (g.ready && !g.ready(w)) continue
    // items needed
    let blocked = false
    for (const n of needsOf(g, w)) {
      if (w.carried(n)) continue
      const loc = w.loc(n)
      if (loc === 'THIEF' || w.within(n, 'THIEF') || loc === '0' || !reachable(w, roomOf(w, n))) {
        blocked = true
        break
      }
      const s = fetchStep(w, n, pending.slice(i))
      if (s) return s
      blocked = true
      break
    }
    if (blocked) continue
    const at = typeof g.at === 'function' ? g.at(w) : g.at
    if (at && at !== '0' && at !== here) {
      const step = route(w, at)
      if (!step) {
        // only darkness (or the bat) in the way? fetch a light source (or garlic) first
        if (route(w, at, true, true)) {
          if (!route(w, at, false, true)) {
            const light = lightSource(w)
            if (light) {
              const s = fetchStep(w, light, pending.slice(i))
              if (s) return s
            }
          } else if (!w.carried('GARLIC') && !thiefHas(w, 'GARLIC') && roomOf(w, 'GARLIC') !== '0') {
            const s = fetchStep(w, 'GARLIC', pending.slice(i))
            if (s) return s
          }
        }
        continue
      }
      return withLight(w, step, g)
    }
    const step = g.act(w)
    if (!step) continue
    return withLoad(w, step, pending.slice(i), g)
  }
  allowLair = false
  return null
}

/** Why each pending goal is or is not pursued (debugging). */
export function explainGuide(w: World): string[] {
  return GOALS.filter((g) => !g.done(w)).map((g) => {
    const ready = g.ready ? g.ready(w) : true
    const at = typeof g.at === 'function' ? g.at(w) : g.at
    const needs = needsOf(g, w).map((n) => `${n}:${w.carried(n) ? 'ok' : roomOf(w, n)}`).join(',')
    const r = at && at !== w.here() ? (route(w, at)?.command ?? 'NO ROUTE') : 'here'
    return `${g.id} ready=${ready} at=${at} route=${r} needs=${needs}`
  })
}

/** A light source the player could fetch: the torch if available, else a working lamp. */
function lightSource(w: World): string | null {
  for (const o of ['TORCH', 'LAMP']) {
    if (w.carried(o)) continue
    if (o === 'TORCH' && inCase(w, 'TORCH')) continue
    if (o === 'LAMP' && w.attr('LAMP', 'RMUNGBIT')) continue
    if (thiefHas(w, o)) continue
    const room = roomOf(w, o)
    if (room !== '0' && reachable(w, room)) return o
  }
  return null
}

function needsOf(g: Goal, w: World): string[] {
  return typeof g.needs === 'function' ? g.needs(w) : (g.needs ?? [])
}

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

function fetchStep(w: World, name: string, upcoming: Goal[]): GuideStep | null {
  const room = roomOf(w, name)
  if (room === '0') return null
  if (room !== w.here()) {
    const s = route(w, room)
    return s ? withLight(w, s, upcoming[0]) : null
  }
  return withLoad(w, takeStep(w, name, upcoming[0].why), upcoming, upcoming[0])
}

/** Room reached by walking in a direction (null if unknown). */
function destination(w: World, room: string, dir: Direction): string | null {
  const e = w.exit(room, dir)
  if (e.kind === 'open' || e.kind === 'closed') return e.to
  if (room === 'LIVING-ROOM' && dir === 'DOWN') return 'CELLAR'
  return null
}

/** Before walking into the dark, turn on the lamp. */
function withLight(w: World, step: GuideStep, g: Goal): GuideStep {
  if (step.dir) {
    const to = destination(w, w.here(), step.dir)
    if (to && !w.roomLit(to) && !w.carriesLight() && canLight(w)) {
      return verbStep(w, 'turn on', 'LAMP', ['Il fait noir plus loin : allumez la lanterne.', 'It is dark ahead: turn on the lamp.'])
    }
  }
  return { ...step, why: step.why[0] ? step.why : g.why }
}

function withLoad(w: World, step: GuideStep, upcoming: Goal[], g: Goal): GuideStep {
  if (step.verb === 'take' && step.obj) {
    const winner = w.obj('ADVENTURER')
    const tooHeavy = weight(w, winner) + weight(w, w.obj(step.obj)) > w.global('LOAD-ALLOWED')
    const tooMany = w.children(winner).length >= 7
    if (tooHeavy || tooMany) {
      // the torch and the lamp are always kept: the thief may steal one of them
      const keep = new Set<string>([step.obj, 'TORCH', 'LAMP'])
      for (const u of upcoming.slice(0, 25)) for (const n of needsOf(u, w)) keep.add(n)
      let d = dropCandidate(w, keep)
      if (!d && w.carried('LAMP') && w.carried('TORCH') && step.obj !== 'LAMP') d = 'LAMP'
      if (d) return verbStep(w, 'drop', d, ['Vous portez trop de choses : posez ce qui ne sert plus.', 'You carry too much: drop what you no longer need.'])
      if (tooHeavy) return say('wait', ['Blessé, vous ne pouvez pas porter autant : reprenez des forces.', 'Wounded, you cannot carry as much: rest a little.'])()
    }
  }
  return { ...step, why: step.why[0] ? step.why : g.why }
}
