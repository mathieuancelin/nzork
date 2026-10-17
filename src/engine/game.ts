// The game facade used by the UI and the CLI: one playing session of Zork I.

import { ZMachine, type ParseEntry, type Snapshot } from './zmachine/vm'
import { Presenter, type Catalog } from './i18n/presenter'
import symbols from './story/symbols.json'
import { frenchCleanup } from './i18n/cleanup'

export type Lang = 'fr' | 'en'

export interface InputContext {
  /** ZIL name of the routine waiting for input (e.g. "PARSER", "YES?", "FINISH"). */
  routine: string
  /** Address of a word in the game's dictionary (0 if unknown). */
  lookup(word: string): number
  /** Whether an object is reachable from the player's position (used to resolve ambiguous words). */
  inScope(obj: number): boolean
}

export interface TranslatedInput {
  text: string
  parse?: ParseEntry[]
  /** Replaces the echo of a word typed by the player (position/length in the text buffer). */
  echo?: (position: number, length: number) => string | undefined
  /** Gender/number of the object named by an echoed word, so that an article can agree. */
  echoNoun?: (position: number, length: number) => { g: 'm' | 'f'; n?: 's' | 'p' } | undefined
  /** The English words sent to the game (for tests and debugging). */
  english?: string[]
}

export interface InputTranslator {
  translateLine(line: string, ctx: InputContext): TranslatedInput
  /** Display form of an English dictionary word printed by the game. */
  displayWord?(english: string): string | undefined
}

export interface Status {
  /** ZIL name of the current room, e.g. "WEST-OF-HOUSE". */
  roomId: string
  room: string
  score: number
  moves: number
  lit: boolean
}

export type GameState = 'playing' | 'quit'

export interface Turn {
  text: string
  status: Status
  state: GameState
  /** What the game is waiting for. */
  waitingFor: 'command' | 'yesno' | 'other'
}

export interface SaveData {
  version: 1
  lang: Lang
  snapshot: Snapshot
  status: Status
  /** Last lines of text shown, to restore the screen. */
  transcript: string
}

export interface GameOptions {
  story: Uint8Array
  lang: Lang
  catalog?: Catalog
  input?: InputTranslator
  seed?: number
  undoDepth?: number
}

const routineByAddr = new Map(Object.entries(symbols.routines).map(([n, a]) => [a as number, n]))
const objectByNum = new Map(Object.entries(symbols.objects).map(([n, o]) => [o as number, n]))
const G = symbols.globals as Record<string, number>

export class Game {
  readonly vm: ZMachine
  readonly presenter: Presenter
  readonly lang: Lang
  private input?: InputTranslator
  private undoStack: Snapshot[] = []
  private undoDepth: number
  state: GameState = 'playing'

  constructor(opts: GameOptions) {
    this.lang = opts.lang
    this.vm = new ZMachine(opts.story, null as never, opts.seed ?? 0)
    this.presenter = new Presenter(this.vm, opts.lang === 'fr' ? (opts.catalog ?? null) : null, symbols)
    this.presenter.install()
    this.input = opts.lang === 'fr' ? opts.input : undefined
    if (this.input?.displayWord) this.presenter.dictWord = (w) => this.input!.displayWord!(w)
    this.undoDepth = opts.undoDepth ?? 50
  }

  /** Starts the game and returns the opening text. */
  start(): Turn {
    return this.runUntilInput()
  }

  /** Sends a player command. */
  send(line: string): Turn {
    if (this.state !== 'playing' || !this.vm.pendingRead) return this.turn('')
    this.undoStack.push(this.vm.snapshot())
    if (this.undoStack.length > this.undoDepth) this.undoStack.shift()
    const ctx: InputContext = { routine: this.inputRoutine(), lookup: (w) => this.vm.lookupWord(w), inScope: (o) => this.inScope(o) }
    if (this.input) {
      const t = this.input.translateLine(line, ctx)
      this.presenter.wordEcho = t.echo ?? null
      this.presenter.echoNoun = t.echoNoun ?? null
      this.vm.provideInput(t.text, t.parse)
    } else {
      this.vm.provideInput(line)
    }
    return this.runUntilInput()
  }

  /**
   * Sends a command already written with the game's English words (used by the clickable
   * choices): no translation, the French presenter still renders the answer.
   */
  sendCanonical(command: string): Turn {
    if (this.state !== 'playing' || !this.vm.pendingRead) return this.turn('')
    this.undoStack.push(this.vm.snapshot())
    if (this.undoStack.length > this.undoDepth) this.undoStack.shift()
    this.presenter.wordEcho = null
    this.presenter.echoNoun = null
    this.vm.provideInput(command)
    return this.runUntilInput()
  }

  /** Runs a canonical command on a copy of the state, without changing the game. */
  simulateCanonical(command: string): { text: string; status: Status; snapshot: Snapshot } {
    const before = this.vm.snapshot()
    const undo = this.undoStack
    this.undoStack = []
    const t = this.sendCanonical(command)
    const snapshot = this.vm.snapshot()
    this.vm.restore(before)
    this.undoStack = undo
    this.state = 'playing'
    return { text: t.text, status: t.status, snapshot }
  }

  canUndo(): boolean {
    return this.undoStack.length > 0
  }

  /** Goes back to the state before the last command. */
  undo(): Status | null {
    const s = this.undoStack.pop()
    if (!s) return null
    this.vm.restore(s)
    this.state = 'playing'
    return this.status()
  }

  status(): Status {
    const vm = this.vm
    const here = vm.global(G.HERE)
    return {
      roomId: objectByNum.get(here) ?? String(here),
      room: here ? this.presenter.noun(here).nom : '',
      score: (vm.global(G.SCORE) << 16) >> 16,
      moves: vm.global(G.MOVES),
      lit: vm.global(G.LIT) !== 0,
    }
  }

  save(transcript: string): SaveData {
    return { version: 1, lang: this.lang, snapshot: this.vm.snapshot(), status: this.status(), transcript }
  }

  load(data: SaveData): Status {
    this.vm.restore(data.snapshot)
    this.undoStack = []
    this.state = 'playing'
    return this.status()
  }

  /** The English words a command translates to (debugging). */
  explain(line: string): string[] | undefined {
    if (!this.input) return undefined
    const ctx: InputContext = { routine: this.inputRoutine(), lookup: (w) => this.vm.lookupWord(w), inScope: (o) => this.inScope(o) }
    return this.input.translateLine(line, ctx).english
  }

  /** Simulates a command on a copy of the state and returns its output, without changing the game. */
  simulate(line: string): { text: string; status: Status } {
    const before = this.vm.snapshot()
    const undo = this.undoStack
    this.undoStack = []
    const t = this.send(line)
    this.vm.restore(before)
    this.undoStack = undo
    this.state = 'playing'
    return { text: t.text, status: t.status }
  }

  /** Whether an object is in the current room (possibly in a container), carried, or global. */
  inScope(obj: number): boolean {
    const vm = this.vm
    const here = vm.global(G.HERE)
    const winner = vm.global(G.WINNER)
    const O = symbols.objects as Record<string, number>
    let o = obj
    for (let guard = 0; o && guard < 20; guard++) {
      const p = vm.parent(o)
      if (p === here || p === winner || o === here) return true
      if (p === O['GLOBAL-OBJECTS']) return true
      if (p === O['LOCAL-GLOBALS']) {
        const addr = vm.getPropAddr(here, symbols.properties.GLOBAL)
        const len = vm.getPropLen(addr)
        for (let i = 0; i < len; i++) if (vm.mem[addr + i] === o) return true
        return false
      }
      o = p
    }
    return false
  }

  // ------------------------------------------------------------ internals

  private inputRoutine(): string {
    const f = this.vm.frames[this.vm.frames.length - 1]
    return routineByAddr.get(f.routine) ?? ''
  }

  /** ZIL name of the routine waiting for input ("" when the game is over). */
  inputRoutineName(): string {
    return this.vm.pendingRead ? this.inputRoutine() : ''
  }

  private runUntilInput(): Turn {
    let text = ''
    for (;;) {
      const y = this.vm.run()
      text += this.presenter.take()
      if (y.kind === 'input') break
      if (y.kind === 'restart') {
        this.vm.reset()
        this.undoStack = []
        continue
      }
      this.state = 'quit'
      break
    }
    return this.turn(text)
  }

  private turn(text: string): Turn {
    const routine = this.vm.pendingRead ? this.inputRoutine() : ''
    let out = text.replace(/\n?>\s*$/, '').replace(/^\n+/, '')
    if (this.lang === 'fr') out = frenchCleanup(out)
    return {
      // the game prints its own ">" prompt before reading a command
      text: out,
      status: this.status(),
      state: this.state,
      waitingFor: routine === 'PARSER' || routine === 'LOUD-ROOM-FCN' ? 'command' : routine === 'YES?' ? 'yesno' : 'other',
    }
  }
}
