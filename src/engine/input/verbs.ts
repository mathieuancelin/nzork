// French verbs and their translation into the English commands understood by the original
// parser (see gsyntax.zil, shared by the three games). Forms are written without accents
// (input is normalised).
import type { GameId } from '../games'

export interface VerbDef {
  /** Accepted forms (infinitive, imperative, present), without accents. */
  forms: string[]
  /** Infinitive, used when the game repeats the verb ("Que voulez-vous prendre ?"). */
  inf: string
  /** English verb used with a direct object (or alone if `alone` is not set). */
  en: string
  /** English command when the verb is used alone. */
  alone?: string
  /** Preposition right after the verb → English verb phrase ("regarder sous" → "look under"). */
  p1?: Record<string, string>
  /** Preposition between the two objects → English preposition. Merged with DEFAULT_P2. */
  p2?: Record<string, string>
  /** English verb when there is a second object (e.g. "poser X dans Y" → "put"). */
  withSecond?: string
  /** English verb depending on the (English) noun of the first object ("monter escalier"). */
  byNoun?: Record<string, string>
  /** The two objects are swapped in English ("nourrir X avec Y" → "give Y to X"). */
  swap?: { en: string; prep: string }
}

/** Regular -er verb: stem "allum" → allumer, allume, allumez, allumes. */
const er = (stem: string) => [`${stem}er`, `${stem}e`, `${stem}ez`, `${stem}es`]

export const DEFAULT_P2: Record<string, string> = {
  dans: 'in',
  "a l'interieur de": 'in',
  "a l'interieur du": 'in',
  en: 'in',
  sur: 'on',
  sous: 'under',
  derriere: 'behind',
  avec: 'with',
  a: 'to',
  au: 'to',
  aux: 'to',
  vers: 'to',
  contre: 'at',
  de: 'from',
  du: 'from',
  des: 'from',
  "d'": 'from',
  'par-dessus': 'over',
  'hors de': 'from',
  'hors du': 'from',
}

const WITH = { avec: 'with' }

export const VERBS: VerbDef[] = [
  // ---------------------------------------------------------------- taking and leaving
  { inf: 'prendre', en: 'take', forms: ['prendre', 'prends', 'prenez', 'prend', 'pr', ...er('ramass'), 'saisir', 'saisis', 'saisissez', ...er('attrap'), ...er('recuper'), 'cueillir', 'cueille', 'cueillez'], p2: { dans: 'from', sur: 'off', de: 'from', du: 'from', "d'": 'from', sous: 'from' } },
  { inf: 'enlever', en: 'take', forms: [...er('enlev'), 'enleve', ...er('retir'), 'oter', 'ote', 'otez'], p2: { de: 'from', du: 'from', "d'": 'from', dans: 'from', sur: 'off' } },
  { inf: 'poser', en: 'drop', withSecond: 'put', forms: [...er('pos'), ...er('depos'), ...er('lach'), 'laisser', 'laisse', 'laissez', ...er('abandonn')], p2: { dans: 'in', sur: 'on', sous: 'under', derriere: 'behind', en: 'in', a: 'in', au: 'in' } },
  { inf: 'mettre', en: 'put', forms: ['mettre', 'mets', 'mettez', 'met', ...er('plac'), ...er('ins'), 'inserer', 'insere', 'inserez', ...er('rang'), 'introduire', 'introduis', 'introduisez', ...er('fourr')], p2: { dans: 'in', sur: 'on', sous: 'under', derriere: 'behind', en: 'in' } },
  { inf: 'donner', en: 'give', forms: [...er('donn'), 'offrir', 'offre', 'offrez', ...er('tend')], p2: { a: 'to', au: 'to', aux: 'to' } },
  { inf: 'nourrir', en: 'feed', forms: ['nourrir', 'nourris', 'nourrissez'], swap: { en: 'give', prep: 'to' } },
  { inf: 'jeter', en: 'throw', forms: ['jeter', 'jette', 'jetez', 'jettes', ...er('lanc'), 'lancer', ...er('balanc')], p2: { sur: 'at', a: 'at', au: 'at', aux: 'at', contre: 'at', vers: 'at', dans: 'in', en: 'in', 'par-dessus': 'over' }, byNoun: { boat: 'launch' } },
  // ---------------------------------------------------------------- looking
  { inf: 'regarder', en: 'examine', alone: 'look', forms: [...er('regard'), 'r', 'voir', 'vois', 'voyez', ...er('observ'), ...er('contempl')], p1: { sous: 'look under', derriere: 'look behind', dans: 'look in', "a l'interieur de": 'look in', "a l'interieur du": 'look in', par: 'look in', 'a travers': 'look in', en: 'look in', sur: 'look on', autour: 'look', 'autour de': 'look' } },
  { inf: 'examiner', en: 'examine', forms: [...er('examin'), 'x', ...er('inspect'), ...er('scrut'), ...er('etudi'), 'decrire', 'decris', 'decrivez'] },
  { inf: 'lire', en: 'read', forms: ['lire', 'lis', 'lisez', 'lit', ...er('feuillet'), ...er('parcour')], p2: WITH },
  { inf: 'fouiller', en: 'search', forms: [...er('fouill')] },
  { inf: 'chercher', en: 'find', forms: [...er('cherch'), ...er('recherch'), 'trouver', 'trouve', 'trouvez'], p1: { dans: 'search' } },
  { inf: 'compter', en: 'count', forms: [...er('compt')] },
  // ---------------------------------------------------------------- senses
  { inf: 'sentir', en: 'smell', forms: ['sentir', 'sens', 'sentez', ...er('renifl'), ...er('hum')] },
  { inf: 'écouter', en: 'listen to', alone: 'listen', forms: [...er('ecout')] },
  { inf: 'toucher', en: 'touch', forms: [...er('touch'), ...er('caress'), ...er('tat'), ...er('palp')] },
  { inf: 'frotter', en: 'rub', forms: [...er('frott'), ...er('astiqu'), ...er('nettoy'), 'nettoie'], p2: WITH },
  { inf: 'goûter', en: 'taste', forms: [...er('gout')] },
  // ---------------------------------------------------------------- containers, doors
  { inf: 'ouvrir', en: 'open', forms: ['ouvrir', 'ouvre', 'ouvrez', 'ouvres', 'forcer', 'force', 'forcez'], p2: WITH },
  { inf: 'fermer', en: 'close', forms: [...er('ferm'), ...er('referm')], p2: WITH, p1: { 'a cle': 'lock' } },
  { inf: 'verrouiller', en: 'lock', forms: [...er('verrouill'), ...er('cadenass')], p2: WITH },
  { inf: 'déverrouiller', en: 'unlock', forms: [...er('deverrouill')], p2: WITH },
  { inf: 'remplir', en: 'fill', forms: ['remplir', 'remplis', 'remplissez'], p2: { avec: 'with', de: 'with', "d'": 'with' } },
  { inf: 'verser', en: 'pour', forms: [...er('vers'), ...er('vid'), ...er('renvers')], p2: { dans: 'in', sur: 'on', en: 'in' } },
  // ---------------------------------------------------------------- light and fire
  { inf: 'allumer', en: 'light', forms: [...er('allum'), ...er('activ')], p2: WITH },
  { inf: 'éteindre', en: 'extinguish', forms: ['eteindre', 'eteins', 'eteignez', 'eteint', ...er('souffl'), ...er('desactiv')] },
  { inf: 'brûler', en: 'burn', forms: [...er('brul'), ...er('enflamm'), ...er('incendi')], p2: WITH },
  { inf: 'craquer', en: 'strike', forms: [...er('craqu'), ...er('frott')] },
  // ---------------------------------------------------------------- fighting
  { inf: 'attaquer', en: 'attack', forms: [...er('attaqu'), ...er('frapp'), 'combattre', 'combats', 'combattez', ...er('cogn'), ...er('tap'), ...er('agress')], p2: WITH, p1: { a: 'knock on', au: 'knock on', sur: 'attack' } },
  { inf: 'tuer', en: 'kill', forms: [...er('tu'), ...er('assassin'), ...er('massacr'), ...er('achev'), 'acheve', ...er('trucid')], p2: WITH },
  { inf: 'poignarder', en: 'stab', forms: [...er('poignard'), ...er('transperc')], p2: WITH },
  { inf: 'couper', en: 'cut', forms: [...er('coup'), ...er('tranch'), ...er('dechir'), 'decouper', 'decoupe', 'decoupez'], p2: WITH },
  { inf: 'casser', en: 'break', forms: [...er('cass'), 'briser', 'brise', 'brisez', 'detruire', 'detruis', 'detruisez', ...er('defonc'), ...er('fracass'), ...er('ecras')], p2: WITH },
  { inf: 'brandir', en: 'wave', forms: ['brandir', 'brandis', 'brandissez', ...er('agit')], p2: { vers: 'at', sur: 'at', devant: 'at' } },
  { inf: 'secouer', en: 'shake', forms: [...er('secou')] },
  { inf: 'botter', en: 'kick', forms: [...er('bott'), ...er('shoot')] },
  // ---------------------------------------------------------------- eating
  { inf: 'manger', en: 'eat', forms: ['manger', 'mange', 'mangez', 'manges', ...er('devor'), ...er('croqu')] },
  { inf: 'boire', en: 'drink', forms: ['boire', 'bois', 'buvez', 'boit', ...er('aval'), 'siroter', 'sirote'], p1: { dans: 'drink from', a: 'drink from' } },
  // ---------------------------------------------------------------- moving things
  { inf: 'pousser', en: 'push', forms: [...er('pouss')], p2: { vers: 'to', sous: 'under', avec: 'with', a: 'to', au: 'to' } },
  { inf: 'appuyer', en: 'push', forms: ['appuyer', 'appuie', 'appuyez', 'appuies', ...er('enfonc'), 'presser', 'presse', 'pressez'], p1: { sur: 'push' } },
  { inf: 'tirer', en: 'pull', forms: [...er('tir')], p1: { sur: 'pull' } },
  { inf: 'déplacer', en: 'move', forms: [...er('deplac'), ...er('boug'), 'bouger', ...er('roul'), ...er('train')], p2: { vers: 'to', a: 'to' } },
  { inf: 'soulever', en: 'raise', forms: [...er('soulev'), 'souleve', 'lever', 'leve', 'levez', ...er('hiss')] },
  { inf: 'abaisser', en: 'lower', forms: [...er('abaiss'), ...er('baiss')] },
  { inf: 'tourner', en: 'turn', forms: [...er('tourn'), ...er('viss'), ...er('deviss'), ...er('pivot')], p2: { avec: 'with', vers: 'to', a: 'to', sur: 'to' } },
  { inf: 'attacher', en: 'tie', forms: [...er('attach'), ...er('nou'), ...er('fix'), ...er('accroch'), ...er('lier'), 'lie', 'liez'], p2: { a: 'to', au: 'to', aux: 'to', sur: 'to', autour: 'to', 'autour de': 'to', 'autour du': 'to' } },
  { inf: 'détacher', en: 'untie', forms: [...er('detach'), ...er('denou'), ...er('decroch'), 'liberer', 'libere', 'liberez'], p2: { de: 'from', du: 'from', "d'": 'from' } },
  { inf: 'gonfler', en: 'inflate', forms: [...er('gonfl'), ...er('pomp')], p2: WITH },
  { inf: 'dégonfler', en: 'deflate', forms: [...er('degonfl')] },
  { inf: 'réparer', en: 'plug', forms: ['reparer', 'repare', 'reparez', ...er('colmat'), ...er('bouch'), ...er('rafistol')], p2: WITH },
  { inf: 'graisser', en: 'oil', forms: [...er('graiss'), ...er('huil'), ...er('lubrifi')], p2: WITH },
  { inf: 'creuser', en: 'dig', forms: [...er('creus')], p1: { dans: 'dig in' }, p2: WITH },
  { inf: 'sonner', en: 'ring', forms: [...er('sonn'), ...er('carillonn')], p2: WITH },
  { inf: 'remonter', en: 'wind', alone: 'up', forms: [...er('remont')] },
  { inf: 'porter', en: 'wear', forms: [...er('port'), ...er('enfil'), 'revetir', 'revets', 'revetez'] },
  { inf: 'glisser', en: 'slide', forms: [...er('gliss')], p2: { sous: 'under' } },
  { inf: 'jouer', en: 'play', forms: [...er('jou')], p1: { de: 'play', du: 'play', avec: 'play' } },
  // ---------------------------------------------------------------- moving around
  { inf: 'aller', en: 'walk', forms: ['aller', 'va', 'vas', 'allez', 'vais', ...er('march'), 'courir', 'cours', 'courez', ...er('avanc'), ...er('dirig'), 'partir', 'pars', 'partez', 'fuir', 'fuis', 'fuyez', ...er('rend')], p1: { 'a travers': 'walk through', vers: 'walk to', a: 'walk to', au: 'walk to', jusqu: 'walk to', "jusqu'a": 'walk to', dans: 'enter', en: 'enter', sur: 'walk on', autour: 'walk around', 'autour de': 'walk around', 'autour du': 'walk around' } },
  { inf: 'monter', en: 'climb up', alone: 'up', forms: [...er('mont')], p1: { sur: 'climb on', dans: 'board', a: 'climb', au: 'climb', en: 'climb up', par: 'climb up' }, byNoun: { boat: 'board', tree: 'climb' } },
  { inf: 'grimper', en: 'climb', alone: 'climb', forms: [...er('grimp'), ...er('escalad')], p1: { sur: 'climb on', a: 'climb up', au: 'climb up', dans: 'climb up', en: 'climb up' } },
  { inf: 'descendre', en: 'lower', alone: 'down', forms: ['descendre', 'descends', 'descendez', 'descend'], p1: { de: 'disembark', du: 'disembark', "d'": 'disembark', dans: 'climb down', par: 'climb down', a: 'climb down', au: 'climb down', en: 'climb down' }, byNoun: { stairs: 'climb down', ladder: 'climb down', rope: 'climb down', chimney: 'climb down', tree: 'climb down', slide: 'climb down' } },
  { inf: 'entrer', en: 'enter', alone: 'enter', forms: [...er('entr'), ...er('rentr'), 'penetrer', 'penetre', 'penetrez'], p1: { dans: 'enter', en: 'enter', a: 'enter', au: 'enter', par: 'enter' } },
  { inf: 'sortir', en: 'take', alone: 'exit', forms: ['sortir', 'sors', 'sortez', 'sort'], p1: { de: 'exit', du: 'exit', "d'": 'exit', par: 'exit' }, p2: { de: 'from', du: 'from', "d'": 'from', dans: 'from' } },
  { inf: 'embarquer', en: 'board', forms: [...er('embarqu')], p1: { dans: 'board', sur: 'board', a: 'board' } },
  { inf: 'débarquer', en: 'disembark', alone: 'disembark', forms: [...er('debarqu')], p1: { de: 'disembark', du: 'disembark' } },
  { inf: 'traverser', en: 'cross', forms: [...er('travers'), 'franchir', 'franchis', 'franchissez'] },
  { inf: 'passer', en: 'walk through', forms: [...er('pass')], p1: { 'a travers': 'walk through', par: 'walk through', dans: 'walk through' } },
  { inf: 'faire', en: 'make', forms: ['faire', 'fais', 'faites', 'fait'] },
  { inf: 'suivre', en: 'follow', alone: 'follow', forms: ['suivre', 'suis', 'suivez', 'poursuivre', 'poursuis', 'poursuivez', ...er('pist')] },
  { inf: 'nager', en: 'swim', alone: 'swim', forms: ['nager', 'nage', 'nagez', 'nages', 'baigner', 'baigne', 'baignez'], p1: { dans: 'swim in' } },
  { inf: 'sauter', en: 'jump', alone: 'jump', forms: [...er('saut'), 'bondir', 'bondis', 'bondissez', 'plonger', 'plonge', 'plongez'], p1: { 'par-dessus': 'jump over', dans: 'jump in', de: 'jump from', du: 'jump from', "d'": 'jump from', sur: 'jump over', en: 'jump in' } },
  { inf: 'lancer', en: 'launch', forms: [] },
  // ---------------------------------------------------------------- talking
  { inf: 'dire', en: 'say', alone: 'say', forms: ['dire', 'dis', 'dites', 'dit', ...er('prononc'), ...er('cri'), 'hurler', 'hurle', 'hurlez'] },
  { inf: 'répondre', en: 'answer', alone: 'answer', forms: ['repondre', 'reponds', 'repondez'] },
  { inf: 'parler', en: 'talk to', forms: [...er('parl'), ...er('discut')], p1: { a: 'talk to', au: 'talk to', avec: 'talk to' } },
  { inf: 'demander', en: 'ask', forms: [...er('demand'), ...er('interrog')] },
  { inf: 'embrasser', en: 'kiss', forms: [...er('embrass')] },
  { inf: 'réveiller', en: 'wake', forms: [...er('reveill')] },
  { inf: 'saluer', en: 'hello', alone: 'hello', forms: [...er('salu'), 'bonjour', 'salut', 'coucou', 'hello', 'ohe'] },
  { inf: 'prier', en: 'pray', alone: 'pray', forms: ['prier', 'prie', 'priez'] },
  { inf: 'exorciser', en: 'exorcise', forms: [...er('exorcis'), 'bannir', 'bannis', 'bannissez', ...er('chass')] },
  { inf: 'maudire', en: 'curse', alone: 'curse', forms: ['maudire', 'maudis', 'maudissez', ...er('jur'), 'zut', 'merde', 'flute'] },
  { inf: 'attendre', en: 'wait', alone: 'wait', forms: ['attendre', 'attends', 'attendez', 'z', 'patienter', 'patiente', 'patientez'] },
  // ---------------------------------------------------------------- game commands
  { inf: 'inventaire', en: 'inventory', alone: 'inventory', forms: ['inventaire', 'inv', 'i'] },
  { inf: 'score', en: 'score', alone: 'score', forms: ['score', 'points'] },
  { inf: 'diagnostic', en: 'diagnose', alone: 'diagnose', forms: ['diagnostic', 'diagnostiquer', 'sante', 'etat'] },
  { inf: 'détaillé', en: 'verbose', alone: 'verbose', forms: ['detaille', 'detaillee', 'verbeux', 'bavard', 'long'] },
  { inf: 'bref', en: 'brief', alone: 'brief', forms: ['bref', 'breve', 'court'] },
  { inf: 'superbref', en: 'superbrief', alone: 'superbrief', forms: ['superbref', 'superbreve', 'supercourt'] },
  { inf: 'sauvegarder', en: 'save', alone: 'save', forms: [...er('sauvegard'), 'sauver', 'sauve', 'enregistrer', 'enregistre'] },
  { inf: 'charger', en: 'restore', alone: 'restore', forms: ['charger', 'charge', 'chargez', 'restaurer', 'restaure', 'restaurez'] },
  { inf: 'recommencer', en: 'restart', alone: 'restart', forms: ['recommencer', 'recommence', 'recommencez', 'redemarrer', 'redemarre'] },
  { inf: 'quitter', en: 'quit', alone: 'quit', forms: [...er('quitt'), 'q'] },
  { inf: 'version', en: 'version', alone: 'version', forms: ['version'] },
  { inf: 'encore', en: 'again', alone: 'again', forms: ['encore', 'g', 'repeter', 'repete', 'bis'] },
  { inf: 'oups', en: 'oops', alone: 'oops', forms: ['oups', 'oops'] },
  { inf: 'transcription', en: 'script', alone: 'script', forms: ['transcription', 'script'] },
]

/** Words that are complete commands on their own (or magic words). */
export const MAGIC: Record<string, string> = {
  echo: 'echo',
  ulysse: 'odysseus',
  odysseus: 'odysseus',
  ulysses: 'odysseus',
  xyzzy: 'xyzzy',
  plugh: 'plugh',
  frobozz: 'frobozz',
  zork: 'zork',
}

export const DIRECTIONS: Record<string, string> = {
  nord: 'north',
  n: 'north',
  sud: 'south',
  s: 'south',
  est: 'east',
  e: 'east',
  ouest: 'west',
  o: 'west',
  'nord-est': 'ne',
  ne: 'ne',
  'nord-ouest': 'nw',
  no: 'nw',
  'sud-est': 'se',
  se: 'se',
  'sud-ouest': 'sw',
  so: 'sw',
  haut: 'up',
  h: 'up',
  'en haut': 'up',
  bas: 'down',
  b: 'down',
  // English shortcuts, for players used to the original
  d: 'down',
  u: 'up',
  w: 'west',
  'en bas': 'down',
  // landing the boat (the LAND direction of the river rooms)
  accoster: 'land',
  accoste: 'land',
  accostez: 'land',
  // the balloon of Zork II
  atterrir: 'land',
  atterris: 'land',
  atterrissez: 'land',
  dedans: 'in',
  "a l'interieur": 'in',
  dehors: 'out',
  "a l'exterieur": 'out',
}

/** Articles and determiners dropped from noun phrases. */
export const ARTICLES = new Set([
  'le', 'la', 'les', "l'", 'l', 'd', 'un', 'une', 'des', 'du', 'de', "d'", 'ce', 'cet', 'cette', 'ces',
  'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses', 'votre', 'vos', 'notre', 'nos', 'leur', 'leurs',
  'quelques', 'certains', 'certaines',
])

/** Other words with a fixed English translation inside noun phrases. */
export const WORDS: Record<string, string> = {
  tout: 'all',
  tous: 'all',
  toute: 'all',
  toutes: 'all',
  sauf: 'except',
  excepte: 'except',
  hormis: 'except',
  et: 'and',
  moi: 'me',
  'moi-meme': 'me',
  oui: 'yes',
  non: 'no',
}

/** Pronouns standing for the last object ("prends-le", "ouvre-la"). */
export const PRONOUNS = new Set(['le', 'la', 'les', "l'", 'lui', 'leur', 'y', 'en'])

/** Display of English prepositions printed by the game (e.g. "Que voulez-vous mettre … dans ?"). */
export const PREP_DISPLAY: Record<string, string> = {
  in: 'dans',
  into: 'dans',
  inside: 'dans',
  on: 'sur',
  onto: 'sur',
  with: 'avec',
  using: 'avec',
  to: 'à',
  under: 'sous',
  behind: 'derrière',
  from: 'de',
  at: 'sur',
  out: 'hors de',
  off: 'de',
  over: 'par-dessus',
  across: 'à travers',
  through: 'à travers',
  for: 'pour',
  about: 'à propos de',
  around: 'autour de',
  up: 'en haut',
  down: 'en bas',
}

/** What one game adds to the common verbs and words. */
export interface GameWords {
  verbs?: VerbDef[]
  magic?: Record<string, string>
  /** What is said is put between quotes, as the game expects (say "float"). */
  quoteSay?: boolean
}

export const GAME_WORDS: Record<GameId, GameWords> = {
  zork1: {},
  zork2: {
    quoteSay: true,
    // the Wizard's spells (see the glossary of GUIDE-TRADUCTION.md), said with the wand:
    // "dire flotte" = "say float"
    magic: {
      faiblesse: 'feeble',
      febrile: 'fumble',
      frayeur: 'fear',
      filoute: 'filch',
      fige: 'freeze',
      fauche: 'fall',
      fermente: 'ferment',
      feroce: 'fierce',
      flotte: 'float',
      flammifuge: 'fireproof',
      fortifie: 'fence',
      fantasme: 'fantasize',
      fluorescence: 'fluoresce',
      fondant: 'fudge',
      friture: 'fry',
      // the English names still work, as in the original
      feeble: 'feeble',
      fumble: 'fumble',
      fear: 'fear',
      filch: 'filch',
      freeze: 'freeze',
      fall: 'fall',
      ferment: 'ferment',
      fierce: 'fierce',
      float: 'float',
      fireproof: 'fireproof',
      fence: 'fence',
      fantasize: 'fantasize',
      fluoresce: 'fluoresce',
      fudge: 'fudge',
      fry: 'fry',
    },
  },
  zork3: {},
}
