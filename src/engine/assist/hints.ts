// Hints in the spirit of Infocom's InvisiClues booklets: questions about the puzzles of the
// places already visited, each with hints from vague to explicit, revealed one at a time.
// A question appears only once its place has been seen, so the list itself spoils nothing.
import type { Game } from '../game'
import { World } from './world'

type Lang2 = [fr: string, en: string]
type Check = (w: World, seen: Set<string>) => boolean

interface Question {
  id: string
  q: Lang2
  hints: Lang2[]
  /** When the question makes sense to the player (a place seen, an object found). */
  shown: Check
  /** When the puzzle is solved. */
  solved: Check
}

const touched = (w: World, o: string) => w.attr(o, 'TOUCHBIT')
const inPlay = (w: World, o: string) => w.vm.parent(w.obj(o)) !== 0
const saw = (...rooms: string[]): Check => (_w, seen) => rooms.some((r) => seen.has(r))

const QUESTIONS: Question[] = [
  {
    id: 'house',
    q: ['Comment entrer dans la maison ?', 'How do I get into the house?'],
    hints: [
      ["La porte d'entrée est condamnée pour de bon. Faites le tour.", 'The front door is boarded for good. Walk around.'],
      ['Derrière la maison, une fenêtre est entrouverte.', 'Behind the house, a window is slightly ajar.'],
      ['OUVRIR LA FENÊTRE, puis ENTRER.', 'OPEN THE WINDOW, then ENTER.'],
    ],
    shown: saw('WEST-OF-HOUSE'),
    solved: saw('KITCHEN'),
  },
  {
    id: 'rug',
    q: ['Le salon cache-t-il quelque chose ?', 'Is something hidden in the living room?'],
    hints: [
      ['Ce tapis est bien lourd pour un simple tapis.', 'That rug is heavy for a mere rug.'],
      ['Essayez de le déplacer.', 'Try moving it.'],
      ['DÉPLACER LE TAPIS : une trappe apparaît. OUVRIR LA TRAPPE.', 'MOVE THE RUG: a trap door appears. OPEN THE TRAP DOOR.'],
    ],
    shown: saw('LIVING-ROOM'),
    solved: (w) => w.flag('RUG-MOVED'),
  },
  {
    id: 'dark',
    q: ['Il fait noir et quelque chose rôde. Que faire ?', 'It is dark and something lurks. What do I do?'],
    hints: [
      ['Le grue ne vit que dans le noir : il craint la lumière.', 'The grue lives only in the dark: it fears light.'],
      ['Il vous faut une source de lumière qui dure.', 'You need a lasting source of light.'],
      ['La lanterne en laiton, dans le salon. ALLUMER LA LANTERNE avant de descendre.', 'The brass lantern, in the living room. TURN ON THE LAMP before going down.'],
    ],
    shown: saw('CELLAR', 'ATTIC'),
    solved: (w) => touched(w, 'LAMP'),
  },
  {
    id: 'tree',
    q: ['Y a-t-il quelque chose dans la forêt ?', 'Is there anything in the forest?'],
    hints: [
      ['Sur le sentier, levez les yeux.', 'On the forest path, look up.'],
      ["Les branches basses d'un arbre invitent à grimper.", 'The low branches of a tree invite climbing.'],
      ['MONTER dans l’arbre : un nid abrite un œuf incrusté de joyaux. Prenez-le avec délicatesse.', 'CLIMB the tree: a nest holds a jewel-encrusted egg. Take it gently.'],
    ],
    shown: saw('PATH'),
    solved: (w) => touched(w, 'EGG'),
  },
  {
    id: 'egg',
    q: ["Comment ouvrir l'œuf ?", 'How do I open the egg?'],
    hints: [
      ["Vous n'avez ni les outils ni l'adresse : le forcer le briserait.", 'You have neither the tools nor the skill: forcing it would break it.'],
      ['Sous terre, quelqu’un d’adroit adore les trésors…', 'Underground, someone deft loves treasures…'],
      ["Laissez le voleur vous le prendre : il l'ouvrira. Vous le récupérerez dans son repaire.", 'Let the thief steal it: he will open it. Get it back in his lair.'],
    ],
    shown: (w) => touched(w, 'EGG'),
    solved: (w) => touched(w, 'CANARY') || touched(w, 'BROKEN-CANARY'),
  },
  {
    id: 'troll',
    q: ['Comment passer le troll ?', 'How do I get past the troll?'],
    hints: [
      ['Le troll ne discute pas : il faudra se battre.', 'The troll does not negotiate: you will have to fight.'],
      ["L'épée elfique accrochée dans le salon fera l'affaire.", 'The elvish sword in the living room will do.'],
      ["ATTAQUER LE TROLL AVEC L'ÉPÉE, autant de fois qu'il le faut. Blessé ? Reposez-vous ailleurs avant d'y retourner.", 'ATTACK THE TROLL WITH THE SWORD, as often as needed. Wounded? Rest elsewhere before going back.'],
    ],
    shown: saw('TROLL-ROOM'),
    solved: (w) => w.flag('TROLL-FLAG'),
  },
  {
    id: 'maze',
    q: ['Je suis perdu dans le labyrinthe.', 'I am lost in the maze.'],
    hints: [
      ['Tous les couloirs se ressemblent : il faut des repères.', 'All the passages look alike: you need landmarks.'],
      ['Posez un objet sans valeur dans chaque salle pour la reconnaître, et suivez votre chemin sur l’onglet Carte.', 'Drop a worthless object in each room to recognize it, and follow your way on the Map tab.'],
      ['Un aventurier y est mort : ses affaires (une bourse, un passe-partout, un couteau rouillé) valent le détour. Une sortie mène vers le cyclope.', 'An adventurer died there: his belongings (a bag of coins, a skeleton key, a rusty knife) are worth the detour. One exit leads to the cyclops.'],
    ],
    shown: (_w, seen) => [...seen].some((r) => r.startsWith('MAZE-')),
    solved: saw('CYCLOPS-ROOM'),
  },
  {
    id: 'cyclops',
    q: ['Comment passer le cyclope ?', 'How do I get past the cyclops?'],
    hints: [
      ["Le combattre serait une très mauvaise idée.", 'Fighting him would be a very bad idea.'],
      ["Il a peur d'un seul nom : celui de l'ennemi de son père.", 'He fears one name only: that of his father’s enemy.'],
      ['Qui a aveuglé Polyphème ? Dites ULYSSE.', 'Who blinded Polyphemus? Say ODYSSEUS.'],
    ],
    shown: saw('CYCLOPS-ROOM'),
    solved: (w) => w.flag('CYCLOPS-FLAG') || w.flag('MAGIC-FLAG'),
  },
  {
    id: 'thief',
    q: ['Le voleur me prend mes trésors !', 'The thief keeps stealing my treasures!'],
    hints: [
      ['Il est redoutable, surtout si vous êtes affaibli.', 'He is formidable, especially when you are weak.'],
      ['Il baisse sa garde quand il admire un trésor.', 'He lowers his guard while admiring a treasure.'],
      ['Dans son repaire, DONNEZ-LUI un trésor, puis frappez, le couteau à la main. Il rendra tout ce qu’il a volé.', 'In his lair, GIVE HIM a treasure, then strike with the knife. He will give back everything he stole.'],
    ],
    shown: saw('TREASURE-ROOM', 'CYCLOPS-ROOM'),
    solved: (w) => !inPlay(w, 'THIEF'),
  },
  {
    id: 'loud',
    q: ['La salle bruyante me rend sourd.', 'The Loud Room is deafening.'],
    hints: [
      ['Vos propres mots vous reviennent, déformés.', 'Your own words come back to you, distorted.'],
      ['Un seul mot, bien choisi, change son acoustique.', 'A single, well-chosen word changes its acoustics.'],
      ['Dites ÉCHO.', 'Say ECHO.'],
    ],
    shown: saw('LOUD-ROOM'),
    solved: (w) => w.flag('LOUD-FLAG') || touched(w, 'BAR'),
  },
  {
    id: 'dome',
    q: ['Comment descendre de la salle du dôme ?', 'How do I get down from the Dome Room?'],
    hints: [
      ['Une rampe longe un vide vertigineux.', 'A railing runs along a dizzying drop.'],
      ['Une corde ferait l’affaire.', 'A rope would do.'],
      ['La corde du grenier : ATTACHER LA CORDE À LA RAMPE, puis DESCENDRE.', 'The rope from the attic: TIE THE ROPE TO THE RAILING, then go DOWN.'],
    ],
    shown: saw('DOME-ROOM'),
    solved: (w) => w.flag('DOME-FLAG'),
  },
  {
    id: 'coffin',
    q: ['Je ne peux pas remonter avec le cercueil.', 'I cannot climb back with the coffin.'],
    hints: [
      ['Le passage est trop étroit pour un objet aussi lourd.', 'The passage is too narrow for something that heavy.'],
      ['Il existe un autre chemin vers la surface… plus spirituel.', 'There is another way to the surface… a more spiritual one.'],
      ["À l'autel du temple, PRIER : vous voilà dans la forêt.", 'At the temple altar, PRAY: you find yourself in the forest.'],
    ],
    shown: (w) => touched(w, 'COFFIN'),
    solved: (w) => w.within('COFFIN', 'TROPHY-CASE'),
  },
  {
    id: 'dam',
    q: ['À quoi sert le barrage ?', 'What can I do at the dam?'],
    hints: [
      ['Le panneau de commande a un boulon et une bulle verte éteinte.', 'The control panel has a bolt and a dark green bubble.'],
      ['Dans la salle de maintenance, des boutons de couleur commandent le barrage.', 'In the Maintenance Room, colored buttons control the dam.'],
      ['Appuyez sur le bouton jaune, puis TOURNER LE BOULON AVEC LA CLÉ À MOLETTE (le bouton rouge allume la lumière, le bleu… évitez).', 'Push the yellow button, then TURN THE BOLT WITH THE WRENCH (the red button turns on the lights, the blue one… avoid it).'],
    ],
    shown: saw('DAM-ROOM'),
    solved: (w) => w.flag('GATES-OPEN') || w.flag('LOW-TIDE'),
  },
  {
    id: 'reservoir',
    q: ['Le réservoir est infranchissable.', 'The reservoir is impassable.'],
    hints: [
      ["Le niveau de l'eau dépend du barrage.", 'The water level depends on the dam.'],
      ['Ouvrez les vannes du barrage, puis patientez.', 'Open the sluice gates of the dam, then wait.'],
      ['Une fois vidé, le lit du réservoir se traverse à pied… et une malle gît dans la boue.', 'Once drained, the reservoir bed can be crossed on foot… and a trunk lies in the mud.'],
    ],
    shown: saw('RESERVOIR-SOUTH', 'RESERVOIR-NORTH'),
    solved: (w) => w.flag('LOW-TIDE'),
  },
  {
    id: 'boat',
    q: ['À quoi sert le tas de plastique ?', 'What is the pile of plastic for?'],
    hints: [
      ['Il a une petite valve.', 'It has a small valve.'],
      ['Vos poumons n’y suffiront pas.', 'Your lungs will not be enough.'],
      ['GONFLER LE TAS DE PLASTIQUE AVEC LA POMPE (la pompe est au nord du réservoir). Posez-le par terre d’abord.', 'INFLATE THE PILE OF PLASTIC WITH THE PUMP (the pump is north of the reservoir). Put it on the ground first.'],
    ],
    shown: (w) => touched(w, 'INFLATABLE-BOAT') || touched(w, 'INFLATED-BOAT'),
    solved: (w) => inPlay(w, 'INFLATED-BOAT') || inPlay(w, 'PUNCTURED-BOAT'),
  },
  {
    id: 'puncture',
    q: ['Mon bateau est crevé !', 'My boat is punctured!'],
    hints: [
      ['Quelque chose de pointu l’a percé.', 'Something sharp punctured it.'],
      ['Dans la salle de maintenance, un tube de substance visqueuse…', 'In the Maintenance Room, a tube of viscous material…'],
      ['RÉPARER LE BATEAU AVEC LA SUBSTANCE. Et ne montez plus à bord avec un objet pointu en main : posez-le dans le bateau.', 'FIX THE BOAT WITH THE GUNK. And never board holding something sharp: put it in the boat instead.'],
    ],
    shown: (w) => inPlay(w, 'PUNCTURED-BOAT'),
    solved: (w) => !inPlay(w, 'PUNCTURED-BOAT'),
  },
  {
    id: 'river',
    q: ['Comment éviter les chutes ?', 'How do I avoid the falls?'],
    hints: [
      ['Le courant est fort, mais on peut accoster.', 'The current is strong, but you can land.'],
      ['Guettez les rives : à l’est, une plage de sable.', 'Watch the banks: to the east, a sandy beach.'],
      ['ACCOSTER dès que la plage est en vue (après la bouée rouge, à prendre au passage).', 'LAND as soon as the beach is in sight (after the red buoy, grab it on the way).'],
    ],
    shown: saw('RIVER-1'),
    solved: saw('SANDY-BEACH'),
  },
  {
    id: 'sand',
    q: ['La grotte sablonneuse cache-t-elle quelque chose ?', 'Does the sandy cave hide anything?'],
    hints: [
      ['Il y a beaucoup de sable.', 'There is a lot of sand.'],
      ['Une pelle traîne sur la plage.', 'A shovel lies on the beach.'],
      ['CREUSER AVEC LA PELLE, plusieurs fois.', 'DIG WITH THE SHOVEL, several times.'],
    ],
    shown: saw('SANDY-CAVE'),
    solved: (w) => touched(w, 'SCARAB'),
  },
  {
    id: 'rainbow',
    q: ["À quoi sert l'arc-en-ciel ?", 'What is the rainbow for?'],
    hints: [
      ["Un arc-en-ciel, ce n'est que de la lumière… en principe.", 'A rainbow is only light… in principle.'],
      ['Un objet égyptien a un pouvoir étrange.', 'An Egyptian object has a strange power.'],
      ['AGITER LE SCEPTRE au pied des chutes : l’arc-en-ciel devient solide, et un pot d’or apparaît.', 'WAVE THE SCEPTRE at the falls: the rainbow becomes solid, and a pot of gold appears.'],
    ],
    shown: saw('ARAGAIN-FALLS', 'END-OF-RAINBOW'),
    solved: (w) => w.flag('RAINBOW-FLAG'),
  },
  {
    id: 'hades',
    q: ["Les esprits m'empêchent d'entrer aux Enfers.", 'The spirits keep me out of Hades.'],
    hints: [
      ["C'est un exorcisme qu'il vous faut.", 'What you need is an exorcism.'],
      ['Cloche, livre et bougies, comme dans les vieux rites.', 'Bell, book and candle, as in the old rites.'],
      ['SONNER LA CLOCHE, ALLUMER LES BOUGIES avec une allumette, puis LIRE LE LIVRE.', 'RING THE BELL, LIGHT THE CANDLES with a match, then READ THE BOOK.'],
    ],
    shown: saw('ENTRANCE-TO-HADES'),
    solved: (w) => w.flag('LLD-FLAG'),
  },
  {
    id: 'bat',
    q: ["La chauve-souris m'emporte ailleurs.", 'The bat keeps carrying me away.'],
    hints: [
      ['Elle déteste une odeur bien particulière.', 'It hates one smell in particular.'],
      ['Les vampires aussi la détestent.', 'Vampires hate it too.'],
      ["Portez la gousse d'ail du sac brun.", 'Carry the clove of garlic from the brown sack.'],
    ],
    shown: saw('BAT-ROOM'),
    solved: (w) => touched(w, 'JADE'),
  },
  {
    id: 'gas',
    q: ['Ça sent le gaz par ici.', 'It smells of gas around here.'],
    hints: [
      ['Une flamme ici serait une très mauvaise idée.', 'A flame here would be a very bad idea.'],
      ['Laissez la torche et les bougies ailleurs.', 'Leave the torch and the candles elsewhere.'],
      ['Entrez avec la lanterne électrique seulement.', 'Go in with the electric lantern only.'],
    ],
    shown: saw('SMELLY-ROOM', 'GAS-ROOM'),
    solved: (w) => touched(w, 'BRACELET'),
  },
  {
    id: 'narrow',
    q: ['Le passage est trop étroit pour moi.', 'The passage is too narrow for me.'],
    hints: [
      ['Vous ne passerez que les mains vides.', 'You will only get through empty-handed.'],
      ['Le panier du puits peut transporter vos affaires.', 'The basket in the shaft can carry your things.'],
      ['Mettez ce dont vous aurez besoin dans le panier (une lumière, le charbon…), descendez-le, puis passez les mains vides.', 'Put what you will need in the basket (a light, the coal…), lower it, then squeeze through empty-handed.'],
    ],
    shown: saw('TIMBER-ROOM'),
    solved: saw('LOWER-SHAFT'),
  },
  {
    id: 'machine',
    q: ['À quoi sert la machine ?', 'What is the machine for?'],
    hints: [
      ['Elle a un couvercle et un interrupteur.', 'It has a lid and a switch.'],
      ['Sous une forte pression, le charbon devient…', 'Under great pressure, coal becomes…'],
      ["Mettez le charbon dedans, fermez le couvercle et actionnez l'interrupteur avec le tournevis.", 'Put the coal inside, close the lid and turn the switch with the screwdriver.'],
    ],
    shown: saw('MACHINE-ROOM'),
    solved: (w) => touched(w, 'DIAMOND'),
  },
  {
    id: 'canary',
    q: ['Le canari mécanique sert-il à quelque chose ?', 'Is the clockwork canary good for anything?'],
    hints: [
      ["C'est un oiseau mécanique : il se remonte.", 'It is a clockwork bird: it can be wound.'],
      ['Un oiseau chante mieux là où vivent les oiseaux.', 'A bird sings best where birds live.'],
      ['REMONTER LE CANARI dans la forêt : un oiseau chanteur laisse tomber un cadeau.', 'WIND THE CANARY in the forest: a songbird drops a gift.'],
    ],
    shown: (w) => touched(w, 'CANARY'),
    solved: (w) => touched(w, 'BAUBLE'),
  },
  {
    id: 'end',
    q: ["J'ai rangé tous les trésors. Et maintenant ?", 'All the treasures are in the case. Now what?'],
    hints: [
      ['Regardez bien dans la vitrine.', 'Look carefully in the trophy case.'],
      ['Une carte ancienne y est apparue.', 'An ancient map has appeared there.'],
      ["Lisez-la : un chemin secret mène au tumulus de pierre, au sud-ouest de la maison. Entrez-y.", 'Read it: a secret path leads to the stone barrow, southwest of the house. Go in.'],
    ],
    shown: (w) => w.flag('WON-FLAG'),
    solved: saw('STONE-BARROW'),
  },
]

export interface HintQuestion {
  id: string
  question: string
  hints: string[]
  solved: boolean
}

/** The questions the player can ask now (places seen), in the language of the game. */
export function hintsFor(game: Game, seen: Set<string>): HintQuestion[] {
  const w = new World(game)
  const fr = game.lang === 'fr'
  return QUESTIONS.filter((q) => q.shown(w, seen)).map((q) => ({
    id: q.id,
    question: q.q[fr ? 0 : 1],
    hints: q.hints.map((h) => h[fr ? 0 : 1]),
    solved: q.solved(w, seen),
  }))
}
