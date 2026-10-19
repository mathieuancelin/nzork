// Zork III's InvisiClues: see hints.ts. The questions follow the solution, from the Endless Stair
// to the Treasury of Zork, and Infocom's booklet (vendor/zork3/invisicluesiii.mss).
import type { Check, Question } from './hints'
import type { World } from './world'

// hints.ts imports this file, so its own helpers are not initialized yet when this module runs:
// the few needed are defined here.
const saw = (...rooms: string[]): Check => (_w, seen) => rooms.some((r) => seen.has(r))
const touched = (w: World, o: string) => w.attr(o, 'TOUCHBIT')
const inPlay = (w: World, o: string) => w.vm.parent(w.obj(o)) !== 0

/** A square of the Royal Puzzle (CPTABLE): 0 free, 1 marble, -1 sandstone, -2 and -3 the ladders. */
const puzzleSquare = (w: World, n: number) => (w.vm.word(w.global('CPTABLE') + 2 * n) << 16) >> 16

export const ZORK3: Question[] = [
  {
    id: 'goal',
    q: ['Quel est mon but ? Et que mesure ce « potentiel » ?', 'What is my goal? And what does this "potential" measure?'],
    hints: [
      ['Explorez. Votre but s’éclaircira au bout du chemin, quand vous rencontrerez celui qui vous attend.', 'Explore. Your purpose will become clearer at the end of the road, when you meet the one who is waiting for you.'],
      ['Le potentiel n’est pas un score : vous gagnez un point (sur 7) quand vous vous engagez sur une voie prometteuse, pas quand vous résolvez une énigme. Il signale ce qui compte.', 'Potential is not a score: you earn a point (out of 7) when you start down a promising path, not when you solve a puzzle. It points at what matters.'],
      ['Vous devez devenir le Maître du donjon. Les 7 points : une rencontre, puis un combat, avec la silhouette encapuchonnée, une corniche, un plongeon, une table magique, un mur qui glisse, et un voyage dans le temps.', 'You must become the Dungeon Master. The 7 points: meeting the hooded figure, then fighting it, a ledge, a plunge, a magic table, a sliding wall, and a trip through time.'],
    ],
    shown: saw('ZORK2-STAIR'),
    solved: (w) => w.flag('IN-DUNGEON'),
  },
  {
    id: 'sword',
    q: ["Comment retirer l'épée du grand rocher ?", 'How do I pull the sword out of the great rock?'],
    hints: [
      ['« Pour qui vous prenez-vous ? Le roi Arthur ? » Elle est profondément enfoncée : inutile de forcer.', '"Who do you think you are? Arthur?" It is deeply embedded: no use forcing it.'],
      ['Soyez patient : vous l’aurez le jour où vous en aurez vraiment besoin.', 'Be patient: you will get it when the need for it arises.'],
      ['Elle jaillira d’elle-même dans votre main quand un adversaire armé vous barrera la route, au-delà du vieux mur de pierre. D’ici là, laissez-la où elle est.', 'It will leap into your hand by itself when an armed opponent blocks your way, beyond the old stone wall. Until then, leave it where it is.'],
    ],
    shown: saw('JUNCTION'),
    solved: (w) => !w.flag('SWORD-IN-STONE?'),
  },
  {
    id: 'ledge',
    q: ['Je suis coincé sur la corniche avec un coffre fermé à clé.', 'I am stuck on the ledge with a locked chest.'],
    hints: [
      ['Restez là et attendez : quelqu’un va se montrer en haut de la falaise.', 'Stay there and wait: someone will show up at the top of the cliff.'],
      ['Cet homme a tout d’un farceur, mais il a la seule clé du coffre. Il faut lui faire confiance, et être patient.', 'The man looks like a practical joker, but he has the only key to the chest. You will have to trust him, and be patient.'],
      ['ATTACHER LA CORDE AU COFFRE : il le hisse et s’en va. ATTENDRE sans quitter la corniche, jusqu’à ce que la corde redescende, puis PRENDRE LA CORDE : il vous remonte et vous donne un bâton de bois.', 'TIE THE ROPE TO THE CHEST: he hauls it up and leaves. WAIT without leaving the ledge until the rope drops again, then TAKE THE ROPE: he pulls you up and hands you a wooden staff.'],
    ],
    shown: saw('CLIFF-LEDGE'),
    solved: (w) => inPlay(w, 'STAFF') || inPlay(w, 'BROKEN-STAFF'),
  },
  {
    id: 'figure',
    q: ['Que faire de la silhouette encapuchonnée ?', 'What do I do about the hooded figure?'],
    hints: [
      ['Elle vous barre la route, une épée comme la vôtre à la main : il faudra la combattre. Votre potentiel, lui, apprécie.', 'It blocks your way, a sword like yours in hand: you will have to fight it. Your potential likes that.'],
      ['Ne cherchez pas à la tuer. Assez affaiblie, elle devient « grièvement blessée et sans défense ». Que cache donc son capuchon ?', 'Do not try to kill it. Weakened enough, it becomes "badly hurt and defenseless". What is hidden under that hood?'],
      ["ATTAQUER LA SILHOUETTE AVEC L'ÉPÉE, et cessez de frapper dès qu’elle est grièvement blessée et sans défense : PRENDRE LE CAPUCHON, puis la cape qu’elle laisse. Si vous l’achevez, capuchon et cape disparaissent avec elle.", 'ATTACK THE FIGURE WITH THE SWORD, and stop striking as soon as it is badly hurt and defenseless: TAKE THE HOOD, then the cloak it leaves behind. If you finish it off, hood and cloak vanish with it.'],
    ],
    shown: (w) => w.flag('SHADOW-POINT-1'),
    solved: (w) => w.loc('HOOD') !== 'SHADOW',
  },
  {
    id: 'ship',
    q: ["Y a-t-il quelque chose à voir au bord de l'océan ?", 'Is there anything to see by the ocean?'],
    hints: [
      ['Descendez sur la plage et attardez-vous : un spectacle rare s’y produit parfois.', 'Go down to the beach and linger: a rare sight sometimes appears there.'],
      ['Un vieux drakkar longe parfois la côte, un marin viking à la proue. Voilà trois âges qu’il attend deux mots… et trois jeux que vous les dites pour rien !', 'An old Viking ship sometimes sails along the shore, a sailor at the prow. He has waited three ages for two words… and you have been saying them for nothing for three games!'],
      ['Pendant que le drakkar passe (il ne passe qu’une fois), dites SALUT, MARIN : il vous lance une fiole. OUVRIR LA FIOLE puis BOIRE LE LIQUIDE vous rend invisible quelques tours. Tout cela est facultatif.', 'While the ship goes by (it only passes once), say HELLO, SAILOR: he throws you a vial. OPEN THE VIAL, then DRINK THE LIQUID to become invisible for a few turns. All of this is optional.'],
    ],
    shown: saw('SHADOW-6', 'SHADOW-8', 'FLATHEAD-OCEAN'),
    solved: (w) => inPlay(w, 'VIAL'),
  },
  {
    id: 'old-man',
    q: ['La salle des gravures cache-t-elle quelque chose ?', 'Is something hidden in the Engravings Room?'],
    hints: [
      ['Les runes montrent des flammes, des statues de pierre et un vieil homme. Repassez par ici : on n’y est pas toujours seul.', 'The runes show flames, stone statues and an old man. Come back here: you are not always alone.'],
      ['Un vieil homme y dort parfois, mais il n’apparaît qu’au moment où vous entrez. Seule une bonne secousse le réveille. Il a l’air faible et fatigué : aidez-le.', 'An old man sometimes sleeps here, but he only appears as you come in. Only shaking him will wake him. He looks weak and tired: help him.'],
      ['RÉVEILLER LE VIEIL HOMME, puis vite DONNER LE PAIN AU VIEIL HOMME (le pain de route traîne sous les arbres, à l’ouest) : il montre une porte secrète. OUVRIR LA PORTE. Surtout, ne l’attaquez pas.', 'WAKE THE OLD MAN, then quickly GIVE THE BREAD TO THE OLD MAN (the waybread lies under the trees, out west): he points out a secret door. OPEN THE DOOR. Above all, do not attack him.'],
    ],
    shown: saw('MSTAIRS'),
    solved: (w) => w.attr('SECRET-DOOR', 'OPENBIT'),
  },
  {
    id: 'lake',
    q: ['Comment traverser le lac ?', 'How do I cross the lake?'],
    hints: [
      ['« Allez vous jeter dans le lac ! » Sérieusement.', '"Go jump in a lake!" Seriously.'],
      ['L’eau est glacée : tout ce qui ne se porte pas vous échappe et coule, et la lanterne comme la torche y meurent pour de bon. Le froid ne vous laisse que quelques tours.', 'The water is icy: everything that cannot be worn slips away and sinks, and the lamp and the torch die in it for good. The cold gives you only a few turns.'],
      ['Laissez sur la rive ce qui craint l’eau (POSER LA LANTERNE, l’épée, le bâton…), SAUTER DANS LE LAC, puis nagez vers l’OUEST ou le SUD jusqu’à une autre rive. Ce qui se porte (capuchon, cape, amulette, anneau) reste sur vous.', 'Leave on the shore whatever fears water (DROP THE LAMP, the sword, the staff…), JUMP IN THE LAKE, then swim WEST or SOUTH to another shore. What can be worn (hood, cloak, amulet, ring) stays on you.'],
    ],
    shown: saw('LAKE-SHORE'),
    solved: (w) => w.flag('LAKE-POINT'),
  },
  {
    id: 'amulet',
    q: ['Y a-t-il quelque chose au fond du lac ?', 'Is there anything at the bottom of the lake?'],
    hints: [
      ['Avez-vous déjà essayé de plonger jusqu’au fond ?', 'Have you ever tried diving to the bottom?'],
      ['Un objet brillant y luit par instants dans le sable. Il glisse entre les doigts une fois sur deux : insistez. Vous ne tenez que quelques tours sans respirer.', 'A shiny object glints now and then in the sand. It slips from your grasp half the time: keep trying. You can only hold your breath for a few turns.'],
      ["Sur le lac, DESCENDRE, puis PRENDRE L'OBJET BRILLANT jusqu’à le tenir : c’est une amulette en or. À bout de souffle, vous remontez : replongez, mais gagnez une rive avant que le froid ne vous achève.", 'On the lake, go DOWN, then TAKE THE SHINY OBJECT until you hold it: it is a golden amulet. Out of breath, you surface: dive again, but reach a shore before the cold finishes you.'],
    ],
    shown: saw('ON-LAKE'),
    solved: (w) => inPlay(w, 'AMULET'),
  },
  {
    id: 'vista',
    q: ['À quoi sert la table du Panorama ?', 'What is the "Scenic Vista" table for?'],
    hints: [
      ['Examinez-la, et surveillez l’indicateur au-dessus : il change tous les quatre tours, de I à IV, puis recommence.', 'Examine it, and watch the indicator above it: it changes every four turns, from I to IV, then starts over.'],
      ['Touchez-la, frottez-la : elle vous emmène quelques tours dans le lieu qu’elle montre, puis vous ramène. Le IV montre un autel sanglant : n’y allez pas !', 'Touch it, rub it: it takes you for a few turns to the place it shows, then brings you back. IV shows a bloody altar: do not go there!'],
      ['Quand l’indicateur affiche II, FROTTER LA TABLE : dans la Salle 8, PRENDRE LA BOMBE (le répulsif contre les grues) avant d’être ramené. Sur III, la table mène au Passage humide : y POSER LA TORCHE la fait passer au sec de l’autre côté du lac, pour plus tard.', 'When the indicator shows II, RUB THE TABLE: in Room 8, TAKE THE CAN (the grue repellent) before you are brought back. On III, the table leads to the Damp Passage: DROP THE TORCH there and it crosses the lake dry, for later.'],
    ],
    shown: saw('VIEW-ROOM'),
    solved: (w) => touched(w, 'REPELLENT'),
  },
  {
    id: 'dark',
    q: ['Comment emprunter le passage obscur au sud de la Rive sud ?', 'How do I take the dark passage south of the Southern Shore?'],
    hints: [
      ['Aucune lumière ne traverse le lac : lanterne et torche s’y éteignent pour de bon. Et sans lumière, les grues rôdent.', 'No light survives the lake: lamp and torch go out in it for good. And without light, grues lurk.'],
      ['Les grues ne craignent pas que la lumière. Avez-vous vu une bombe aérosol quelque part ? Lisez son étiquette.', 'Grues fear more than light. Have you seen a spray can somewhere? Read its label.'],
      ['Il vous faut le répulsif contre les grues, qu’on obtient de l’autre côté du lac, à l’ouest. En sautant dans le lac, la bombe coule : plongez pour la reprendre. Sur la Rive sud, VAPORISER LE RÉPULSIF SUR MOI, puis vite : S, S, E. L’effet dure peu, et la bombe ne sert qu’une fois.', 'You need the grue repellent, found across the lake, to the west. When you jump in the lake the can sinks: dive to get it back. On the Southern Shore, SPRAY THE REPELLENT ON ME, then quickly: S, S, E. It does not last, and the can only works once.'],
    ],
    shown: saw('SOUTH-SHORE'),
    solved: (w) => touched(w, 'KEY'),
  },
  {
    id: 'cover',
    q: ["Y a-t-il quelque chose sous la plaque d'égout ?", 'Is there anything under the manhole cover?'],
    hints: [
      ['Elle est bien trop lourde pour être emportée…', 'It is far too heavy to carry…'],
      ['…mais rien ne vous empêche de la faire glisser de côté.', '…but nothing stops you from sliding it aside.'],
      ["PRENDRE LA CLÉ, puis DÉPLACER LA PLAQUE D'ÉGOUT et DESCENDRE. C’est le chemin du retour : le répulsif ne sert qu’une fois.", 'TAKE THE KEY, then MOVE THE COVER and go DOWN. That is the way back: the repellent only works once.'],
    ],
    shown: saw('KEY-ROOM'),
    solved: (w) => w.flag('COVER-MOVED'),
  },
  {
    id: 'aqueduct',
    q: ["Où mène l'aqueduc ?", 'Where does the aqueduct lead?'],
    hints: [
      ['Vers le nord, très haut au-dessus d’un gouffre. Il est ancien : ses arches montrent des signes d’usure.', 'North, high above a chasm. It is old: its arches show signs of decay.'],
      ['Tôt ou tard (entre le 70e et le 140e tour), un tremblement de terre secouera tout le donjon. Une arche n’y résistera pas.', 'Sooner or later (between turns 70 and 140), an earthquake will shake the whole dungeon. One arch will not survive it.'],
      ['Traversez avant le séisme : N, N, puis N encore, et la rigole vous dépose au Passage humide. Si l’arche s’est déjà effondrée, il n’y a plus d’issue : reprenez une partie sauvegardée.', 'Cross before the earthquake: N, N, then N again, and the channel drops you into the Damp Passage. If the arch has already collapsed, there is no way out: restore a saved game.'],
    ],
    shown: saw('AQ-1'),
    solved: saw('AQ-3'),
  },
  {
    id: 'cleft',
    q: ['Comment passer la grande porte de fer ?', 'How do I get past the great iron door?'],
    hints: [
      ['Elle est bloquée par la rouille : aucun outil n’en viendra à bout.', 'It is rusted shut: no tool will get it open.'],
      ['Le donjon tout entier va trembler, tôt ou tard. Et les secousses ouvrent parfois des passages…', 'The whole dungeon will shake, sooner or later. And tremors sometimes open passages…'],
      ['Après le tremblement de terre, une faille s’ouvre à côté de la porte de fer : allez à l’EST. S’il n’a pas encore eu lieu, ATTENDRE : il survient entre le 70e et le 140e tour.', 'After the earthquake, a cleft opens next to the iron door: go EAST. If it has not happened yet, WAIT: it comes between turns 70 and 140.'],
    ],
    shown: saw('MUSEUM-ANTE'),
    solved: (w) => w.flag('CLEFT-FLAG') || !w.flag('AQ-FLAG'),
  },
  {
    id: 'puzzle',
    q: ['Je suis enfermé dans une petite salle aux murs de marbre et de grès.', 'I am trapped in a small room with marble and sandstone walls.'],
    hints: [
      ['Il y a une sortie.', 'There is a way out.'],
      ['Le grès est une roche bien légère.', 'Sandstone is a very light rock.'],
      ['POUSSER LE MUR EST : un mur de grès glisse quand rien ne le bloque derrière, et vous le suivez. Les murs se poussent, ils ne se tirent jamais.', 'PUSH THE EAST WALL: a sandstone wall slides when nothing blocks it behind, and you follow it. Walls can only be pushed, never pulled.'],
    ],
    shown: saw('CP'),
    solved: (w) => w.flag('CPPUSH-FLAG'),
  },
  {
    id: 'royal-puzzle',
    q: ['Comment sortir du Casse-tête royal ?', 'How do I get out of the Royal Puzzle?'],
    hints: [
      ['Il y a des sorties. Dressez un plan (des pions pour les murs aident) et poussez le moins de murs possible. Et ramassez le livre qui traîne dans ce dédale.', 'There are ways out. Draw a map (tokens for the walls help) and push as few walls as possible. And pick up the book lying somewhere in this maze.'],
      ['Souvenez-vous du trou par lequel vous êtes entré : une des échelles peut être amenée juste dessous. La fente près de la porte d’acier est une autre sortie, mais elle confisque le livre, dont vous aurez besoin.', 'Remember the hole you came in through: one of the ladders can be moved right under it. The slot by the steel door is another way out, but it confiscates the book, which you will need.'],
      ['La suite officielle, depuis l’entrée et le casse-tête intact (si vous avez poussé d’autres murs, reprenez une partie sauvegardée) : B. POUSSER LE MUR EST. S. S. SE. POUSSER LE MUR SUD. N. NE. POUSSER LE MUR SUD. PRENDRE LE LIVRE. POUSSER LE MUR SUD. E. NE. POUSSER LE MUR OUEST. SO. NO. NE. POUSSER LE MUR SUD. SO. POUSSER LE MUR EST. NE. POUSSER LE MUR SUD. NO. N. N. N. POUSSER LE MUR EST. SO. S. SE. NE. N. POUSSER LE MUR OUEST. NO. POUSSER LE MUR SUD. ENCORE. O. NO. NO. POUSSER LE MUR SUD. SE. SE. SE. NE. POUSSER LE MUR OUEST. ENCORE. SO. POUSSER LE MUR NORD. ENCORE. ENCORE. NO. MONTER.', 'The official sequence, from the entrance with the puzzle untouched (if you have pushed other walls, restore a saved game): D. PUSH EAST WALL. S. S. SE. PUSH SOUTH WALL. N. NE. PUSH SOUTH WALL. TAKE BOOK. PUSH SOUTH WALL. E. NE. PUSH WEST WALL. SW. NW. NE. PUSH SOUTH WALL. SW. PUSH EAST WALL. NE. PUSH SOUTH WALL. NW. N. N. N. PUSH EAST WALL. SW. S. SE. NE. N. PUSH WEST WALL. NW. PUSH SOUTH WALL. AGAIN. W. NW. NW. PUSH SOUTH WALL. SE. SE. SE. NE. PUSH WEST WALL. AGAIN. SW. PUSH NORTH WALL. AGAIN. AGAIN. NW. UP.'],
    ],
    shown: (w) => w.flag('CPPUSH-FLAG'),
    // out with the book: the ladder stands under the hole (CPEXIT), or was climbed
    solved: (w) => touched(w, 'LORE-BOOK') && (puzzleSquare(w, 2) === -2 || w.flag('CPSOLVE-FLAG')),
  },
  {
    id: 'time-machine',
    q: ['À quoi sert la machine dorée ?', 'What is the gold machine for?'],
    hints: [
      ['Elle a un siège, un cadran à trois chiffres et un bouton. Asseyez-vous dedans avant d’appuyer.', 'It has a seat, a three-digit dial and a button. Sit in it before pushing.'],
      ['C’est une machine à remonter le temps : elle envoie qui est assis à l’année du cadran, au même endroit, mais seul, sans rien de ce qu’il porte. Nous sommes en 948, et le retour se fait de lui-même au bout de 40 tours.', 'It is a time machine: it sends whoever sits in it to the year on the dial, at the same spot, but alone, without anything carried. The present is 948, and you snap back by yourself after 40 turns.'],
      ['D’après la plaque des joyaux, le musée fut inauguré en 777. MONTER DANS LA MACHINE DORÉE, RÉGLER LE CADRAN SUR 776, puis APPUYER SUR LE BOUTON. Seul 776 est sûr : plus tôt, la roche vous engloutit ; juste après, les gardes vous attendent. Et jamais depuis l’entrée du musée.', 'According to the plaque of the jewels, the museum was dedicated in 777. GET IN THE GOLD MACHINE, TURN THE DIAL TO 776, then PUSH THE BUTTON. Only 776 is safe: earlier, the rock swallows you; just after, the guards are waiting. And never from the museum entrance.'],
    ],
    shown: saw('TECH-MUSEUM'),
    solved: (w) => w.flag('TM-POINT'),
  },
  {
    id: 'jewels',
    q: ['Comment prendre les joyaux de la Couronne ?', 'How do I take the Crown Jewels?'],
    hints: [
      ['La cage les protégera jusqu’à la fin des temps. Mais il fut un temps où elle n’existait pas…', 'The cage will protect them until the end of time. But there was a time when it did not exist…'],
      ['Poussez la machine dorée jusqu’ici (vers le sud, puis vers l’est par la porte de pierre ; ni escalier ni faille, elle s’abîmerait) et partez pour 776 ; attendez que les gardes s’éloignent. Rien ne voyage avec vous : il faut une cachette qui tienne près de deux siècles… dans la machine.', 'Push the gold machine here (south, then east through the stone door; no stairs and no cleft, it would break) and go to 776; wait for the guards to march away. Nothing travels with you: you need a hiding place that will last almost two centuries… in the machine.'],
      ["En 776, PRENDRE L'ANNEAU, et lui seul (le sceptre et le couteau restent), OUVRIR LA PORTE, O, OUVRIR LA PORTE EN BOIS, N : la machine est là. MONTER DANS LA MACHINE DORÉE, METTRE L'ANNEAU SOUS LE SIÈGE, RÉGLER LE CADRAN SUR 948, APPUYER SUR LE BOUTON, puis REGARDER SOUS LE SIÈGE.", 'In 776, TAKE THE RING, and only the ring (the sceptre and the knife stay), OPEN THE DOOR, W, OPEN THE WOODEN DOOR, N: the machine is there. GET IN THE GOLD MACHINE, PUT THE RING UNDER THE SEAT, TURN THE DIAL TO 948, PUSH THE BUTTON, then LOOK UNDER THE SEAT.'],
    ],
    shown: saw('JEWEL-ROOM'),
    solved: (w) => w.flag('RING-STOLEN') && !w.flag('RING-CONCEALED'),
  },
  {
    id: 'beam',
    q: ['À quoi servent le rayon rouge et le bouton ?', 'What are the red beam and the button for?'],
    hints: [
      ['Le rayon court à un pouce du sol. Sauter par-dessus ou l’attraper ne mène à rien.', 'The beam runs an inch above the floor. Jumping over it or grabbing it leads nowhere.'],
      ['Seul, le bouton ne fait que « clic ». Il faut d’abord couper le rayon… pas avec la main : durablement.', 'On its own, the button just goes "click". First the beam must be broken… not with your hand: for good.'],
      ['Dans la Salle du rayon, POSER LA TORCHE (ou n’importe quoi) en travers du rayon, puis, au sud, APPUYER SUR LE BOUTON : le miroir au bout du couloir s’ouvre comme une porte. Vite, N, N, N : il se referme au bout de quelques tours.', 'In the Beam Room, DROP THE TORCH (or anything) across the beam, then, to the south, PUSH THE BUTTON: the mirror at the end of the hallway opens like a door. Quick, N, N, N: it closes again after a few turns.'],
    ],
    shown: saw('MREYE'),
    solved: (w) => w.flag('MIRROR-OPENED'),
  },
  {
    id: 'box',
    q: ['Comment manœuvrer la boîte derrière le miroir ?', 'How do I steer the box behind the mirror?'],
    hints: [
      ['La perche courte la tient en place. Levée, elle laisse la boîte pivoter sur la longue perche : les panneaux rouge et jaune la font tourner dans le sens des aiguilles d’une montre, le noir et le blanc dans l’autre sens. La flèche de la barre en T indique où regarde le panneau d’acajou.', 'The short pole holds it in place. Raised, it lets the box pivot on the long pole: the red and yellow panels turn it clockwise, the black and white ones counterclockwise. The arrow on the T-bar shows where the mahogany panel faces.'],
      ['Tournée vers le nord ou le sud, la boîte glisse le long de la rigole quand on pousse le panneau d’acajou. Au nord veillent les Gardiens de Zork : perche abaissée dans la rigole (sinon la boîte tangue), aucun panneau ouvert, miroirs intacts, et ils ne verront que leur reflet. Le panneau de pin s’ouvre pour sortir, mais jamais sous leurs yeux.', 'Facing north or south, the box slides along the channel when you push the mahogany panel. To the north stand the Guardians of Zork: pole lowered into the channel (or the box wobbles), no panel open, mirrors intact, and they will only see their own reflection. The pine panel opens to get out, but never in their sight.'],
      ["LEVER LA PERCHE COURTE, POUSSER LE PANNEAU ROUGE deux fois (la flèche indique le nord), ABAISSER LA PERCHE COURTE, POUSSER LE PANNEAU D'ACAJOU trois fois. Puis LEVER LA PERCHE COURTE, POUSSER LE PANNEAU ROUGE quatre fois (la flèche indique le sud), POUSSER LE PANNEAU DE PIN et sortir au N.", 'RAISE THE SHORT POLE, PUSH THE RED PANEL twice (the arrow points north), LOWER THE SHORT POLE, PUSH THE MAHOGANY PANEL three times. Then RAISE THE SHORT POLE, PUSH THE RED PANEL four times (the arrow points south), PUSH THE PINE PANEL and walk out N.'],
    ],
    shown: saw('IN-MIRROR'),
    // the box at the north end of the hallway, past the Guardians (or the player past them, invisible)
    solved: (w, seen) => w.global('MLOC') === w.obj('MRD') || seen.has('FRONT-DOOR'),
  },
  {
    id: 'door',
    q: ['Comment ouvrir la grande porte en bois au bout du couloir ?', 'How do I open the large wooden door at the end of the hallway?'],
    hints: [
      ['Vous ne pouvez pas l’ouvrir vous-même. Avez-vous essayé de frapper ?', 'You cannot open it yourself. Have you tried knocking?'],
      ['Le vieil homme qui répond est le Maître du donjon. Vous l’avez déjà croisé sous d’autres traits, et il attend quelqu’un qui lui ressemble. Avez-vous remarqué comment il est vêtu ?', 'The old man who answers is the Dungeon Master. You have met him before under other guises, and he is waiting for someone who looks like him. Have you noticed how he is dressed?'],
      ['Il porte capuchon et cape, une amulette et un anneau, un livre sous le bras, un bâton de bois, et une clé à la ceinture. Ayez les sept en main (capuchon, cape, amulette en or, anneau d’or, clé étrange, bâton de bois, livre très ancien), puis FRAPPER À LA PORTE.', 'He wears a hood and cloak, an amulet and a ring, carries a book under his arm, leans on a wooden staff, and has a key at his belt. Carry all seven (hood, cloak, golden amulet, golden ring, strange key, wooden staff, very ancient book), then KNOCK ON THE DOOR.'],
    ],
    shown: saw('FRONT-DOOR'),
    solved: (w) => w.flag('IN-DUNGEON'),
  },
  {
    id: 'dial',
    q: ['À quoi servent le cadran solaire et le gros bouton du parapet ?', 'What are the sundial and the large button on the parapet for?'],
    hints: [
      ['Le cadran a huit positions. Réglez-le, appuyez sur le bouton, et regardez la cellule en face : a-t-elle changé ?', 'The dial has eight settings. Set it, push the button, and look at the cell across: has it changed?'],
      ['Lisez donc le livre très ancien, ici : huit cellules entourent la fosse, une seule a une porte de bronze. Le bouton amène devant la porte la cellule choisie, et renvoie l’autre à sa place.', 'Read the very ancient book, here: eight cells surround the pit, only one has a bronze door. The button brings the chosen cell in front of the door, and sends the other back to its place.'],
      ['TOURNER LE CADRAN SUR 4, puis APPUYER SUR LE BOUTON : la cellule 4, avec sa porte de bronze, vient se placer face au couloir.', 'TURN THE DIAL TO 4, then PUSH THE BUTTON: cell 4, with its bronze door, comes into place across the corridor.'],
    ],
    shown: saw('PARAPET'),
    // cell 4 in front of the corridor, or already carried back to its place with the player
    solved: (w, seen) => w.global('LCELL') === 4 || seen.has('GOOD-CELL') || !w.flag('BRONZE-DOOR-LOCKED'),
  },
  {
    id: 'bronze',
    q: ['Comment ouvrir la porte de bronze ?', 'How do I open the bronze door?'],
    hints: [
      ['Avez-vous essayé la clé ? C’est la première serrure où elle entre.', 'Have you tried the key? It is the first lock it fits.'],
      ['La clé épouse la serrure mais refuse de tourner : il faut être dans la cellule 4, et que cette cellule ait regagné sa place habituelle. Le Maître du donjon, lui, obéit à vos ordres.', 'The key molds itself to the lock but will not turn: you must be in cell 4, with that cell back in its usual place. The Dungeon Master, for his part, obeys your commands.'],
      ['La cellule 4 en place, OUVRIR LA PORTE DE LA CELLULE, puis MAÎTRE, VA AU NORD (il gagne le parapet) et entrez dans la cellule : S. Puis MAÎTRE, TOURNE LE CADRAN SUR 1 et MAÎTRE, APPUIE SUR LE BOUTON : la cellule vous emporte. Enfin DÉVERROUILLER LA PORTE DE BRONZE AVEC LA CLÉ, OUVRIR LA PORTE DE BRONZE, et S.', 'With cell 4 in place, OPEN THE CELL DOOR, then TELL MASTER "GO NORTH" (he goes to the parapet) and step into the cell: S. Then TELL MASTER "TURN DIAL TO 1" and TELL MASTER "PUSH BUTTON": the cell carries you away. Finally UNLOCK THE BRONZE DOOR WITH THE KEY, OPEN THE BRONZE DOOR, and S.'],
    ],
    // the bronze door is seen from cell 4, or from the cell it opens
    shown: (w, seen) => seen.has('GOOD-CELL') || !w.flag('BRONZE-DOOR-LOCKED') || (seen.has('CELL') && w.global('LCELL') === 4),
    solved: (w) => !w.flag('BRONZE-DOOR-LOCKED'),
  },
]
