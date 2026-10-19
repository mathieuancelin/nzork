// Zork II's InvisiClues: see hints.ts. In the order of the solution (test/walkthrough/zork2).
import type { Check, Question } from './hints'
import type { World } from './world'

// The helpers of hints.ts, which cannot be imported: hints.ts imports this file, so they are not
// initialized yet when this list is built.
const touched = (w: World, o: string) => w.attr(o, 'TOUCHBIT')
const inPlay = (w: World, o: string) => w.vm.parent(w.obj(o)) !== 0
const saw = (...rooms: string[]): Check => (_w, seen) => rooms.some((r) => seen.has(r))

/** The room an object is in, through its containers and the player; null once out of play. */
function roomOf(w: World, o: string): string | null {
  const rooms = w.obj('ROOMS')
  let n = w.obj(o)
  for (let i = 0; i < 20 && n; i++) {
    const p = w.vm.parent(n)
    if (p === rooms) return w.name(n)
    n = p
  }
  return null
}

/** The rooms of the bank whose money cannot leave by the tellers' rooms (BKLEAVEE). */
const BANK = ['DEPOSITORY', 'OFFICE', 'SMALL-ROOM', 'VAULT']
const outOfBank = (w: World, o: string) => !BANK.includes(roomOf(w, o) ?? '')

/** The demon is in the pentagram: from then on the Wizard's wand is powerless (I-WIZARD). */
const demonSummoned = (w: World) => w.loc('GENIE') === 'PENTAGRAM-ROOM'

export const ZORK2: Question[] = [
  {
    id: 'lamp',
    q: ['Que faut-il emporter du tumulus ?', 'What should I take from the barrow?'],
    hints: [
      ['Cette lanterne vous rappelle quelque chose…', 'That brass lantern looks strangely familiar…'],
      ['Plus loin, bien des salles sont plongées dans le noir, et les grues rôdent toujours.', 'Further on, many rooms are dark, and grues still lurk there.'],
      ["PRENDRE TOUT, puis ALLUMER LA LANTERNE. Elle ne durera pas éternellement : éteignez-la (ÉTEINDRE LA LANTERNE) là où il fait clair.", 'TAKE ALL, then TURN ON THE LAMP. It will not last forever: turn it off (TURN OFF THE LAMP) where it is light.'],
    ],
    shown: saw('INSIDE-BARROW'),
    solved: (w) => touched(w, 'LAMP'),
  },
  {
    id: 'garden',
    q: ['Que faire dans le jardin ?', 'What is there to do in the garden?'],
    hints: [
      ['Ne vous attardez pas parmi les animaux topiaires : ils bougent quand on ne les regarde pas. Le kiosque est plus accueillant.', 'Do not linger among the topiary animals: they move when you are not looking. The gazebo is friendlier.'],
      ["Sur la table du kiosque, tout servira un jour : de quoi porter de l'eau, de quoi faire du feu, et deux objets bien plats.", 'On the gazebo table, everything will come in handy: something to carry water, something to make fire, and two very flat things.'],
      ["PRENDRE TOUT. Remplissez la théière au gué (REMPLIR LA THÉIÈRE D'EAU) ; le journal et la pochette d'allumettes feront du feu ; le set de table et le coupe-papier délogeront une clé restée dans sa serrure. Le set de table porte aussi les petits objets, qui ne comptent alors que pour un.", 'TAKE ALL. Fill the teapot at the ford (FILL THE TEAPOT WITH WATER); the newspaper and the matchbook will make fire; the place mat and the letter opener will get a key out of its lock. The place mat also carries small things, which then count as one.'],
    ],
    shown: saw('GARDEN-NORTH', 'GAZEBO-ROOM', 'FORMAL-GARDEN', 'TOPIARY-ROOM'),
    solved: (w) => ['TEAPOT', 'PLACE-MAT', 'NEWSPAPER', 'LETTER-OPENER', 'MATCH'].every((o) => touched(w, o)),
  },
  {
    id: 'wizard',
    q: ['Le Sorcier me jette des sorts !', 'The Wizard keeps casting spells on me!'],
    hints: [
      ["Ses sorts sont agaçants, rarement mortels, et aucun ne dure : le plus souvent, il suffit d'attendre qu'il se dissipe (ATTENDRE, ou Z).", 'His spells are annoying, seldom deadly, and none of them lasts: most of the time, waiting for it to wear off is enough (WAIT, or Z).'],
      ['DIAGNOSTIC vous dit si vous êtes ensorcelé. Les sphères de cristal que vous portez le découragent (moins de sorts, et plus courts), et la sphère noire le fait fuir.', 'DIAGNOSE tells you whether you are bewitched. The crystal spheres you carry discourage him (fewer spells, and shorter ones), and the black sphere makes him flee.'],
      ['Pour en finir : invoquez le démon du pentagramme. Dès lors, la baguette du Sorcier est sans pouvoir, et vous pourrez même vous la faire donner.', 'To be rid of him: summon the demon of the pentagram. From then on the Wizard’s wand is powerless, and you can even have it handed to you.'],
    ],
    shown: saw('GREAT-CAVERN'),
    solved: demonSummoned,
  },
  {
    id: 'spells',
    q: ['Que font les sorts du Sorcier ?', 'What do the Wizard’s spells do?'],
    hints: [
      ["Tous commencent par F, et tous s'estompent d'eux-mêmes. Fige (vous êtes paralysé) et Fortifie (une barrière invisible vous retient) : attendez. Flammifuge et Fantasme (vous voyez des choses qui n'existent pas) sont sans danger.", 'They all begin with F, and they all wear off. Freeze (you cannot move) and Fence (an invisible fence holds you in): wait. Fireproof and Fantasize (you see things that are not there) are harmless.'],
      ['Frayeur et Fermente : vous fuyez, ou titubez, au hasard. Faiblesse et Fébrile : vous lâchez ce que vous portez ; ramassez-le ensuite. Filoute : un trésor file dans la vitrine du Sorcier (il compte quand même pour le démon ; plus tard, AGITER LA BAGUETTE VERS LA VITRINE puis DIRE « FILOUTE » le rend).', 'Fear and Ferment: you run, or stagger, at random. Feeble and Fumble: you drop what you carry; pick it up afterwards. Filch: a treasure vanishes into the Wizard’s trophy cabinet (it still counts for the demon; later, WAVE THE WAND AT THE CABINET then SAY "FILCH" gives it back).'],
      ["Les vrais dangers : Féroce (vous attaquez la première créature venue : tenez-vous loin du dragon et du chien), Fauche (vous trébuchez : ni pont, ni escalade, ni nacelle tant qu'il dure) et Flotte (vous lévitez : s'il cesse au-dessus du puits ou du volcan, c'est la chute). Dans le doute, ATTENDRE.", 'The real dangers: Fierce (you attack the first creature around: keep away from the dragon and the dog), Fall (you trip: no bridges, no climbing, no basket while it lasts) and Float (you levitate: if it ends above the well or the volcano, down you go). When in doubt, WAIT.'],
    ],
    shown: saw('GREAT-CAVERN'),
    solved: demonSummoned,
  },
  {
    id: 'riddle',
    q: ["Quelle est la réponse à l'énigme ?", 'What is the answer to the riddle?'],
    hints: [
      ['Haut comme une maison, rond comme un bol… et creux.', 'Tall as a house, round as a cup… and hollow.'],
      ["Les chevaux du roi ne sauraient le tirer du sol, mais on y puise de l'eau. Il y en a un tout près, à l'est.", 'The king’s horses cannot draw it up, but you can draw water from it. There is one close by, to the east.'],
      ['RÉPONDRE « UN PUITS ».', 'ANSWER "A WELL".'],
    ],
    shown: saw('RIDDLE-ROOM'),
    solved: (w) => w.attr('RIDDLE-DOOR', 'OPENBIT'),
  },
  {
    id: 'well',
    q: ['Comment remonter le puits ?', 'How do I get up the well?'],
    hints: [
      ["Lisez les gravures : c'est un puits magique. Et ce seau n'est pas là pour rien.", 'Read the etchings: this is a magic well. And that bucket is not there for nothing.'],
      ["C'est l'eau qui fait monter le seau.", 'Water makes the bucket go up.'],
      ["Remplissez la théière au gué (REMPLIR LA THÉIÈRE D'EAU), MONTER DANS LE SEAU, puis VERSER L'EAU DANS LE SEAU. Pour redescendre, remontez dans le seau et PRENDRE L'EAU.", 'Fill the teapot at the ford (FILL THE TEAPOT WITH WATER), GET IN THE BUCKET, then POUR THE WATER IN THE BUCKET. To go back down, get in the bucket again and TAKE THE WATER.'],
    ],
    shown: saw('WELL-BOTTOM'),
    // the bucket goes back down: having reached the top is what remains
    solved: (w, seen) => w.flag('BUCKET-TOP-FLAG') || seen.has('WELL-TOP'),
  },
  {
    id: 'cakes',
    q: ['À quoi servent les gâteaux du salon de thé ?', 'What are the cakes in the Tea Room for?'],
    hints: [
      ["Le gâteau vert dit « Mange-moi ». Prenez les autres avant d'obéir.", 'The green cake says "Eat Me". Take the others before you obey.'],
      ["Le vert rapetisse, le bleu fait grandir (seulement si vous êtes petit !), le rouge assèche, l'orange explose. Le flacon de la salle du bassin grossit leurs lettres : LIRE LE GÂTEAU ROUGE AVEC LE FLACON. Mais n'ouvrez jamais ce flacon.", 'Green shrinks you, blue makes you grow (only when you are small!), red dries things up, orange explodes. The flask in the Pool Room magnifies their letters: READ THE RED CAKE WITH THE FLASK. But never open that flask.'],
      ['Avec le rouge et le bleu en poche, MANGER LE GÂTEAU VERT. Dans la salle du bassin, JETER LE GÂTEAU ROUGE DANS LA MARE : un paquet de bonbons apparaît. Revenu dans la salle des poteaux, MANGER LE GÂTEAU BLEU.', 'With the red and blue cakes in hand, EAT THE GREEN CAKE. In the Pool Room, THROW THE RED CAKE IN THE POOL: a package of candy appears. Back in the Posts Room, EAT THE BLUE CAKE.'],
    ],
    shown: saw('TEA-ROOM'),
    solved: (w) => touched(w, 'CANDY') && !inPlay(w, 'BLUE-ICING'),
  },
  {
    id: 'carousel',
    q: ["Je ne m'y retrouve pas dans la salle du carrousel.", 'I keep getting lost in the Carousel Room.'],
    hints: [
      ["Ce n'est pas vous : la salle tourne vraiment. Ce bourdonnement vient d'une machine.", 'It is not you: the room really spins. That whirring comes from a machine.'],
      ["Dans la salle de la machine, trois boutons. Y toucher vous électrocuterait… mais pas le robot de la salle basse. Lisez son mode d'emploi, le morceau de papier vert.", 'In the Machine Room, three buttons. Touching them would fry you… but not the robot in the Low Room. Read its instructions, the green piece of paper.'],
      ["ROBOT, VA À L'EST, suivez-le, puis ROBOT, APPUIE SUR LE BOUTON TRIANGULAIRE : le carrousel s'arrête, et une boîte d'acier apparaît dans sa salle (un violon s'y cache). Surtout pas le bouton carré.", 'ROBOT, GO EAST, follow it, then ROBOT, PUSH THE TRIANGULAR BUTTON: the carousel stops, and a steel box appears in its room (a violin is inside). Whatever you do, not the square button.'],
    ],
    shown: saw('CAROUSEL-ROOM'),
    solved: (w) => w.flag('CAROUSEL-FLIP-FLAG'),
  },
  {
    id: 'cage',
    q: ['Une cage me tombe dessus quand je prends la sphère !', 'A cage falls on me when I take the sphere!'],
    hints: [
      ['Seul, vous ne la soulèverez pas, et le gaz ne vous laisse que quelques tours.', 'You cannot lift it alone, and the gas gives you only a few turns.'],
      ['Il vous faut un compagnon fort et obéissant, enfermé avec vous. Ne lui demandez pas de prendre la sphère : il serait pris au piège à votre place.', 'You need a strong and obedient companion, trapped in there with you. Do not ask it to take the sphere: it would be caught instead of you.'],
      ['Amenez le robot dans le placard (ROBOT, VA AU SUD), prenez la sphère, puis ROBOT, SOULÈVE LA CAGE.', 'Bring the robot into the closet (ROBOT, GO SOUTH), take the sphere, then ROBOT, LIFT THE CAGE.'],
    ],
    shown: saw('CAGE-ROOM'),
    solved: (w) => w.flag('CAGE-SOLVE-FLAG'),
  },
  {
    id: 'dragon',
    q: ['Comment passer le dragon ?', 'How do I get past the dragon?'],
    hints: [
      ["L'attaquer serait peine perdue : son cuir est dur comme l'acier. Mais il est curieux, et rancunier.", 'Attacking him is no use: his hide is as tough as steel. But he is curious, and he bears grudges.'],
      ["Fâché juste ce qu'il faut, il vous suit partout. Trop fâché, il vous grille. Menez-le là où il fera le plus de bien.", 'Angry enough, he follows you around. Too angry, he roasts you. Lead him where he will do the most good.'],
      ["BOTTER LE DRAGON deux fois, puis S, S : il vous suit. Dans la salle fraîche, bottez-le encore une fois, puis O : dans la salle de glace, il prend son reflet pour un rival, et son feu fait fondre le glacier.", 'KICK THE DRAGON twice, then S, S: he follows you. In the Cool Room, kick him once more, then W: in the Ice Room he takes his reflection for a rival, and his fire melts the glacier.'],
    ],
    shown: saw('DRAGON-ROOM'),
    solved: (w) => w.flag('ICE-MELTED'),
  },
  {
    id: 'glacier',
    q: ['Comment faire fondre le glacier ?', 'How do I melt the glacier?'],
    hints: [
      ["Il faudrait une chaleur énorme : bien plus qu'une allumette.", 'It would take enormous heat: far more than a match.'],
      ['Quelque chose, dans ces souterrains, crache le feu. Et la glace est un miroir.', 'Something down here breathes fire. And ice is a mirror.'],
      ["Amenez le dragon jusqu'ici (voir la question du dragon) : il défie son reflet et fait fondre la glace. Derrière, dans la salle de lave, un rubis vous attend.", 'Lead the dragon here (see the dragon question): he challenges his reflection and melts the ice. Beyond it, in the Lava Room, a ruby awaits.'],
    ],
    shown: saw('GLACIER-ROOM'),
    solved: (w) => w.flag('ICE-MELTED'),
  },
  {
    id: 'balloon',
    q: ['Comment faire décoller la montgolfière ?', 'How do I get the balloon off the ground?'],
    hints: [
      ["Une montgolfière s'élève grâce à l'air chaud.", 'A hot-air balloon rises on hot air.'],
      ['Le réceptacle de métal, au centre de la nacelle, attend un combustible. Le journal brûle très bien.', 'The metal receptacle in the middle of the basket wants fuel. The newspaper burns nicely.'],
      ["MONTER DANS LA NACELLE, OUVRIR LE RÉCEPTACLE, METTRE LE JOURNAL DANS LE RÉCEPTACLE, ALLUMER UNE ALLUMETTE, puis ALLUMER LE JOURNAL AVEC L'ALLUMETTE. Ne montez jamais plus haut que la large corniche : au-delà, le vent vous emporte.", 'GET IN THE BASKET, OPEN THE RECEPTACLE, PUT THE NEWSPAPER IN THE RECEPTACLE, LIGHT A MATCH, then LIGHT THE NEWSPAPER WITH THE MATCH. Never rise above the wide ledge: beyond it, the wind carries you away.'],
    ],
    shown: saw('VOLCANO-BOTTOM'),
    solved: (w) => w.flag('BLAB-FLAG'),
  },
  {
    id: 'ledges',
    q: ['Comment me poser sur une corniche ?', 'How do I land on a ledge?'],
    hints: [
      ["Lisez l'étiquette tombée dans la nacelle.", 'Read the label that fell into the basket.'],
      ["Près d'une corniche, dites ACCOSTER. Mais la montgolfière ne vous attendra pas : il faut l'amarrer.", 'Near a ledge, say LAND. But the balloon will not wait for you: you must moor it.'],
      ['ACCOSTER, puis ATTACHER LE FIL AU CROCHET avant de SORTIR DE LA NACELLE. Pour repartir, remontez et DÉTACHER LE FIL ; pour redescendre, FERMER LE RÉCEPTACLE.', 'LAND, then TIE THE WIRE TO THE HOOK before you GET OUT OF THE BASKET. To leave, get back in and UNTIE THE WIRE; to go down, CLOSE THE RECEPTACLE.'],
    ],
    shown: saw('VAIR-2', 'VAIR-4'),
    // moored now, or the treasure of a ledge reached
    solved: (w) => w.flag('BTIE-FLAG') || touched(w, 'COIN') || touched(w, 'CROWN'),
  },
  {
    id: 'library',
    q: ['Que faire dans la bibliothèque ?', 'What is there to do in the library?'],
    hints: [
      ["Les livres sont écrits dans une langue inconnue, mais certains valent qu'on les lise… ou qu'on les ouvre.", 'The books are written in an unknown tongue, but some are worth reading… or opening.'],
      ["Le livre blanc explique l'usage d'une baguette magique : retenez-le. Le livre violet, lui, a l'air bien épais.", 'The white book explains how to use a magic wand: remember it. The purple book looks rather thick.'],
      ['OUVRIR LE LIVRE VIOLET : il cache un timbre Flathead, un trésor.', 'OPEN THE PURPLE BOOK: it hides a Flathead stamp, a treasure.'],
    ],
    shown: saw('LIBRARY'),
    solved: (w) => touched(w, 'STAMP'),
  },
  {
    id: 'safe',
    q: ['Comment ouvrir le coffre rouillé ?', 'How do I open the rusty box?'],
    hints: [
      ["Il ne s'ouvrira pas, mais le trou oblong de sa façade a une forme familière.", 'It will not open, but the oblong hole in its front has a familiar shape.'],
      ["La brique de la salle de marbre est un explosif, et la ficelle noire du couloir aux toiles d'araignée une mèche.", 'The brick from the Marble Hall is an explosive, and the black string from the Cobwebby Corridor a fuse.'],
      ["METTRE LA FICELLE DANS LA BRIQUE, METTRE LA BRIQUE DANS LE TROU, ALLUMER UNE ALLUMETTE, ALLUMER LA FICELLE AVEC L'ALLUMETTE, puis sortez au nord. Après l'explosion, revenez vite prendre la couronne (et la carte), puis repartez en montgolfière : la salle, puis la corniche, vont s'effondrer.", 'PUT THE STRING IN THE BRICK, PUT THE BRICK IN THE HOLE, LIGHT A MATCH, LIGHT THE STRING WITH THE MATCH, then step out north. After the explosion, hurry back for the crown (and the card), then leave by balloon: the room, then the ledge, will collapse.'],
    ],
    shown: saw('SAFE-ROOM'),
    solved: (w) => w.flag('SAFE-FLAG') && touched(w, 'CROWN'),
  },
  {
    id: 'princess',
    q: ['Comment réveiller la princesse ?', 'How do I wake the princess?'],
    hints: [
      ['Elle est en transe : un bruit, un geste la tirerait de sa rêverie.', 'She is in a trance: a noise, a gesture would bring her out of it.'],
      ['Le vieux coffre a des gonds bien rouillés.', 'The old chest has very rusty hinges.'],
      ["RÉVEILLER LA PRINCESSE, tout simplement, ou OUVRIR LE COFFRE (plusieurs fois s'il le faut) : son grincement la réveille. Le coffre cache une statuette de dragon en or.", 'WAKE THE PRINCESS, simply, or OPEN THE CHEST (several times if needed): its squeak wakes her. The chest holds a golden dragon statuette.'],
    ],
    shown: saw('DRAGON-LAIR'),
    solved: (w) => w.flag('PRINCESS-AWAKE'),
  },
  {
    id: 'unicorn',
    q: ["La princesse s'en va. Dois-je la suivre ?", 'The princess is leaving. Should I follow her?'],
    hints: [
      ['Oui : elle connaît des chemins que vous ignorez.', 'Yes: she knows ways you do not.'],
      ['SUIVRE LA PRINCESSE, à chaque pas. Elle rentre au jardin, où rôde une licorne.', 'FOLLOW THE PRINCESS, at every step. She is going back to the garden, where a unicorn roams.'],
      ["Suivez-la jusqu'à l'extrémité nord du jardin et attendez-y (ATTENDRE) : la licorne vient à elle, et la princesse vous offre une rose et la délicate clé en or que la licorne portait au cou. Ne la laissez pas partir sans vous.", 'Follow her to the north end of the garden and wait there (WAIT): the unicorn comes to her, and the princess gives you a rose and the delicate gold key the unicorn wore around its neck. Do not let her leave without you.'],
    ],
    shown: (w) => w.flag('PRINCESS-AWAKE'),
    solved: (w) => w.loc('GOLD-KEY') !== 'UNICORN',
  },
  {
    id: 'oak-door',
    q: ['Comment ouvrir la porte en chêne ?', 'How do I open the oak door?'],
    hints: [
      ["Regardez par la fenêtre à barreaux : la clé est restée dans la serrure, de l'autre côté.", 'Look through the barred window: the key was left in the lock, on the other side.'],
      ['Faites-la tomber de la serrure… et rattrapez-la : il y a un jour sous la porte.', 'Push it out of the lock… and catch it: there is a gap under the door.'],
      ['OUVRIR LE COUVERCLE, METTRE LE SET DE TABLE SOUS LA PORTE, METTRE LE COUPE-PAPIER DANS LE TROU DE SERRURE : la clé tombe sur le set. PRENDRE LE SET DE TABLE la ramène de votre côté. DÉVERROUILLER LA PORTE AVEC LA CLÉ EN FER, puis OUVRIR LA PORTE : une sphère bleue vous attend.', 'OPEN THE LID, PUT THE PLACE MAT UNDER THE DOOR, PUT THE LETTER OPENER IN THE KEYHOLE: the key drops onto the mat. TAKE THE MAT to bring it to your side. UNLOCK THE DOOR WITH THE IRON KEY, then OPEN THE DOOR: a blue sphere awaits.'],
    ],
    shown: saw('TINY-ROOM'),
    solved: (w) => w.flag('PUNLOCK-FLAG'),
  },
  {
    id: 'bank',
    q: ['Comment entrer dans la chambre forte de la banque ?', 'How do I get into the bank vault?'],
    hints: [
      ['Lisez la brochure de la banque : le guichetier « semble passer à travers les murs ». Le rideau de lumière, lui, ne mène pas toujours au même endroit.', 'Read the bank brochure: the teller "seems to walk through walls". As for the curtain of light, it does not always lead to the same place.'],
      ['Le rideau vous envoie dans une salle qui dépend de la direction par laquelle vous êtes entré dans la salle des coffres. Et chacune de ces salles a un mur qui ramène à la salle des coffres.', 'Where the curtain sends you depends on the direction you came into the depository from. And each of those rooms has a wall that leads back to the depository.'],
      ['Entrez dans la salle des coffres depuis le bureau du président (N), puis PASSER À TRAVERS LE RIDEAU : la petite salle. PASSER À TRAVERS LE MUR SUD, puis de nouveau À TRAVERS LE RIDEAU : la chambre forte ! Prenez les billets et ressortez vite (À TRAVERS LE MUR NORD) : le rideau ne reste pas ouvert longtemps.', 'Enter the depository from the Chairman’s Office (N), then WALK THROUGH THE CURTAIN: the Small Room. WALK THROUGH THE SOUTH WALL, then THROUGH THE CURTAIN again: the vault! Take the bills and get out fast (THROUGH THE NORTH WALL): the curtain does not stay open long.'],
    ],
    shown: saw('DEPOSITORY'),
    solved: (w) => touched(w, 'BILLS'),
  },
  {
    id: 'bank-exit',
    q: ["Une alarme m'empêche de quitter la banque avec ses trésors.", 'An alarm stops me from leaving the bank with its treasures.'],
    hints: [
      ["Personne ne sort par les guichets avec l'argent de la banque. Le rideau, lui, ne sonne pas.", 'Nobody leaves through the tellers’ rooms with the bank’s money. The curtain does not ring.'],
      ["Le rideau mène à la salle d'observation du côté par où vous êtes entré dans la salle des coffres, et de là, on sort au sud.", 'The curtain leads to the viewing room on the side you came into the depository from, and from there you walk out south.'],
      ["Posez le portrait et les billets dans la salle des coffres, sortez à l'est puis revenez (E, et encore E) : vous voilà « entré par l'est ». Reprenez-les, PASSER À TRAVERS LE RIDEAU, puis S.", 'Drop the portrait and the bills in the depository, go out east and come back (E, then E again): you have now "come in from the east". Pick them up, WALK THROUGH THE CURTAIN, then S.'],
    ],
    shown: (w) => touched(w, 'BILLS') || touched(w, 'PORTRAIT'),
    solved: (w) => outOfBank(w, 'BILLS') && outOfBank(w, 'PORTRAIT'),
  },
  {
    id: 'lizard',
    q: ['Comment franchir la porte gardée par le lézard ?', 'How do I get through the door the lizard guards?'],
    hints: [
      ["Ce lézard ne laisse personne toucher à la porte, et il a l'air affamé.", 'This lizard lets nobody touch the door, and it looks hungry.'],
      ["Il raffole des sauterelles. N'essayez pas la clé avant qu'il dorme : il pourrait vous la prendre.", 'It loves grasshoppers. Do not try the key before it sleeps: it might take it from you.'],
      ["DONNER LES BONBONS AU LÉZARD (ceux de la mare de larmes) : il s'endort. Puis DÉVERROUILLER LA PORTE AVEC LA CLÉ EN OR, et OUVRIR LA PORTE.", 'GIVE THE CANDY TO THE LIZARD (from the pool of tears): it falls asleep. Then UNLOCK THE DOOR WITH THE GOLD KEY, and OPEN THE DOOR.'],
    ],
    shown: saw('GUARDIAN-ROOM'),
    solved: (w) => w.flag('WIZ-DOOR-FLAG'),
  },
  {
    id: 'spheres',
    q: ["À quoi servent les socles de l'établi ?", 'What are the stands on the workbench for?'],
    hints: [
      ['Rubis, saphir, diamant : trois socles, trois couleurs. Vous avez peut-être croisé des sphères de cristal de ces couleurs.', 'Ruby, sapphire, diamond: three stands, three colors. You may have come across crystal spheres of those colors.'],
      ["La rouge est dans le placard miteux, la bleue dans la salle lugubre, la transparente au fond de l'aquarium. Chacune sur le socle de sa couleur.", 'The red one is in the Dingy Closet, the blue one in the Dreary Room, the clear one at the bottom of the aquarium. Each goes on the stand of its color.'],
      ['METTRE LA SPHÈRE ROUGE SUR LE SOCLE DE RUBIS, LA BLEUE SUR LE SOCLE DE SAPHIR, LA TRANSPARENTE SUR LE SOCLE DE DIAMANT : une sphère noire apparaît. Prenez-la, et au sud, METTRE LA SPHÈRE NOIRE DANS LE PENTAGRAMME.', 'PUT THE RED SPHERE ON THE RUBY STAND, THE BLUE ONE ON THE SAPPHIRE STAND, THE CLEAR ONE ON THE DIAMOND STAND: a black sphere appears. Take it, and to the south, PUT THE BLACK SPHERE IN THE PENTAGRAM.'],
    ],
    shown: saw('WORKBENCH-ROOM'),
    solved: demonSummoned,
  },
  {
    id: 'aquarium',
    q: ["Que cache l'aquarium ?", 'What is in the aquarium?'],
    hints: [
      ["Le bébé serpent de mer n'est pas seul au fond de l'aquarium.", 'The baby sea serpent is not alone at the bottom of the aquarium.'],
      ["N'y entrez pas et ne frappez pas la vitre : le serpent vous dévorerait. Mais un objet assez gros, ou une arme, lancé contre elle la briserait.", 'Do not climb in or strike the glass: the serpent would eat you. But something big enough, or a weapon, thrown at it would break it.'],
      ["LANCER LE PORTRAIT SUR L'AQUARIUM (ou l'épée) : hors de l'eau, le serpent meurt, et une sphère de cristal transparente apparaît dans le sable.", 'THROW THE PORTRAIT AT THE AQUARIUM (or the sword): out of the water, the serpent dies, and a clear crystal sphere appears in the sand.'],
    ],
    shown: saw('AQUARIUM-ROOM'),
    solved: (w) => inPlay(w, 'DEAD-SERPENT'),
  },
  {
    id: 'demon',
    q: ['Que veut le démon ?', 'What does the demon want?'],
    hints: [
      ['Il ne travaille pas gratuitement : son syndicat y veille.', 'He does not work for free: his union sees to that.'],
      ['Ses honoraires : dix trésors, tous ceux du donjon hormis les sphères, les bonbons, le collier de chien et la baguette. Ensuite, il exaucera un seul vœu : choisissez bien.', 'His fee: ten treasures, all those of the dungeon except the spheres, the candy, the dog collar and the wand. Then he grants a single wish: choose well.'],
      ["DONNER LES BILLETS AU DÉMON, et de même le portrait, la clé en or, le timbre, le zorkmid, le rubis, la couronne, la statuette, le collier de perles et le violon. Puis DÉMON, DONNE-MOI LA BAGUETTE : c'est elle qu'il vous faut.", 'GIVE THE BILLS TO THE DEMON, and likewise the portrait, the gold key, the stamp, the coin, the ruby, the crown, the statuette, the pearl necklace and the violin. Then DEMON, GIVE ME THE WAND: that is what you need.'],
    ],
    shown: demonSummoned,
    solved: (w) => touched(w, 'WAND') || w.flag('MENHIR-POSITION'),
  },
  {
    id: 'menhir',
    q: ['Comment déplacer le menhir ?', 'How do I move the menhir?'],
    hints: [
      ["Il pèse des tonnes : aucune force humaine n'en viendra à bout. Mais pourquoi ce « F » gravé ?", 'It weighs many tons: no human strength will move it. But why that carved "F"?'],
      ["Les sorts du Sorcier commencent tous par F, et le livre blanc de la bibliothèque explique comment se servir d'une baguette magique.", 'The Wizard’s spells all begin with F, and the white book in the library explains how to use a magic wand.'],
      ['Avec la baguette du Sorcier : AGITER LA BAGUETTE VERS LE MENHIR, puis DIRE « FLOTTE ». Courez prendre le collier de chien gigantesque dans le chenil, au sud-ouest, avant que le menhir ne retombe.', 'With the Wizard’s wand: WAVE THE WAND AT THE MENHIR, then SAY "FLOAT". Hurry into the kennel, southwest, for the gigantic dog collar before the menhir comes back down.'],
    ],
    shown: saw('MENHIR-ROOM'),
    // the menhir comes back down when the spell wears off: the collar is what remains
    solved: (w) => w.flag('MENHIR-POSITION') || touched(w, 'COLLAR'),
  },
  {
    id: 'diamond',
    q: ['Je tourne en rond dans les salles biscornues.', 'I am going around in circles in the oddly-angled rooms.'],
    hints: [
      ['Ces salles forment un losange… comme un terrain de base-ball. Lisez le gourdin, et écoutez le Sorcier quand il vous parle de bases.', 'These rooms form a diamond… a baseball diamond. Read the club, and listen to the Wizard when he taunts you about bases.'],
      ['Les petites fenêtres en losange brillent davantage à chaque pas juste : faites le tour des bases, sans faux pas.', 'The small diamond-shaped windows glow brighter with every right step: run around the bases without a misstep.'],
      ["Dès que vous arrivez dans une salle à fenêtre, allez SE, NE, NO puis SO. Au dernier pas, un grincement : le sol s'est ouvert au pied de l'escalier, dans la salle centrale. Allez-y et descendez (BAS).", 'As soon as you reach a room with a window, go SE, NE, NW, then SW. At the last step, a squeal: the floor has opened at the foot of the stairway, in the central room. Go there and go DOWN.'],
    ],
    shown: (_w, seen) => [...seen].some((r) => r.startsWith('DIAMOND-')),
    solved: (w) => w.flag('DIAMOND-SOLVE'),
  },
  {
    id: 'cerberus',
    q: ['Comment passer le chien à trois têtes ?', 'How do I get past the three-headed dog?'],
    hints: [
      ["Trois têtes, trois fois plus de crocs : ne l'attaquez pas.", 'Three heads, three times the fangs: do not attack it.'],
      ["Au fond, ce n'est qu'un gros chien qui rêve d'un maître. Il lui manque quelque chose autour du cou.", 'Deep down, it is just a big dog longing for a master. It is missing something around its neck.'],
      ['METTRE LE COLLIER SUR LE CHIEN (le collier de chien gigantesque du chenil, derrière le menhir). Et ne le lui retirez jamais.', 'PUT THE COLLAR ON THE DOG (the gigantic dog collar from the kennel, behind the menhir). And never take it off again.'],
    ],
    shown: saw('CERBERUS-ROOM'),
    solved: (w) => w.flag('CERBERUS-LEASHED'),
  },
  {
    id: 'crypt',
    q: ['La crypte semble sans issue.', 'The crypt seems to be a dead end.'],
    hints: [
      ['Regardez bien le mur sud… mais votre lanterne vous éblouit peut-être.', 'Look closely at the south wall… but perhaps your lamp dazzles you.'],
      ['Dans le noir, on voit parfois ce que la lumière cache.', 'In the dark, you sometimes see what the light hides.'],
      ["ÉTEINDRE LA LANTERNE : le contour d'une porte secrète marquée d'un « F » apparaît. ALLUMER LA LANTERNE, OUVRIR LA PORTE SECRÈTE, puis S, la baguette en main : sans elle, les gardiens magiques du palier ne vous épargneront pas.", 'TURN OFF THE LAMP: the outline of a secret door marked "F" appears. TURN ON THE LAMP, OPEN THE SECRET DOOR, then S, with the wand in hand: without it, the magic wardens of the landing will not spare you.'],
    ],
    shown: saw('CRYPT-ROOM'),
    solved: (w) => w.flag('DIM-DOOR-FLAG') || w.flag('WON-FLAG'),
  },
]
