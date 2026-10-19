# Zork in your browser — design notes

> Play **Zork I: The Great Underground Empire** in French, in the browser, with retro
> illustrations, multiple-choice modes for newcomers and 10 save slots. A fan tribute: the
> original game runs untouched, and everything this project adds is presentation.

## 1. What the original sources contain

`vendor/zork1/` is a git submodule pointing to the historical Infocom repository
([historicalsource/zork1](https://github.com/historicalsource/zork1), **MIT** license,
Microsoft 2025):

| File | Role | Lines |
|---|---|---|
| `1dungeon.zil` | The world: **110 rooms**, **120 objects** (descriptions, exits, flags) | 2,660 |
| `1actions.zil` | Specific behaviors: troll, thief, cyclops, dam, river, combat… (186 routines) | 4,177 |
| `gverbs.zil` | Generic verbs: take, open, attack, move… (189 routines) | 2,216 |
| `gparser.zil` / `gsyntax.zil` | The English parser and the command grammar | 1,968 |
| `gmain.zil` / `gclock.zil` / `gglobals.zil` / `gmacros.zil` | Main loop, clock (daemons and interrupts), globals | 835 |
| `COMPILED/zork1.z3` | The original compiled game (Release 119, serial 880429) | — |

Volume of text: **~1,900 unique strings, ~115,000 characters** to translate.
`dfrotz` serves as an **oracle** to compare our version with the original.

The game itself only needs the compiled story file, kept with its license in
`src/engine/story/`. The submodule is read by the tools (symbol table, catalog extraction, map,
scene descriptions).

## 2. Architecture choices

### Options considered

1. **Emulate the original `.z3` and translate on the fly.** Perfect fidelity, but the text is
   assembled from pieces (`"The " + object + " is closed."`): agreeing in gender (« la boîte est
   fermée ») looks impossible without fragile hacks. The parser only accepts English words, and
   the choice modes and the guide would have to read the virtual machine's memory.
2. **Translate the ZIL and recompile it (ZILF, .NET) into a `.z5`.** Real French, but the parser
   must be rewritten in ZIL, and the modern features (choices, guide, images, rich saves) remain
   hard to reach from inside the VM. Slow iterations.
3. **Port the game to TypeScript by hand, routine by routine.** Full control, but rewriting
   10,000 lines of logic by hand multiplies the risk of subtle errors (return values of `COND`,
   order of the daemons…).
4. **Run the original ZIL in a TypeScript interpreter.** More faithful than option 3, but the ZIL
   parser works directly on the bytes of the Z-machine (buffers, dictionary, syntax tables): the
   whole memory would have to be emulated, which amounts to writing a compiler.
5. **✅ A Z-machine in TypeScript that runs the original `zork1.z3`, with a French presentation
   layer plugged into it.** The game is *exactly* the original. French comes in at three points:
   - **on output**: each group of print instructions in the bytecode (the equivalent of a
     `TELL`, for example `"The " D ,PRSO " is closed."`) is recognized by disassembly and
     replaced by a French template with agreement (`"{Le:0} est fermé{e:0}."`);
   - **on input**: the French sentence is analyzed by our code, which fills the machine's parse
     buffer directly with English dictionary words. The positions point to the French words, so
     the messages that repeat a word ("I don't know the word…") quote it in French;
   - **by override**: a few routines (combat messages, echo of the player's words) are replaced
     by TypeScript code where French word order requires it.

**Decision: option 5.** It is validated: the VM reproduces `dfrotz` **word for word, fights and
randomness included** (the Frotz random number generator is reimplemented). Bonus: saving or
undoing means copying ~11 KB of memory, and the guide can **simulate** a command on a copy of the
state to check what it produces before suggesting it.

The option 1 objection turned out to have an answer: the print groups are numerous (951) but
finite, and the article of an inserted object is known when the template is rendered, so gender
agreement works without touching the game.

### Stack

- **Strict TypeScript** everywhere, **Vite + React 19** for the UI, **Vitest** for the tests.
- **Pure engine** (`src/engine`), with no React dependency: it also runs on the command line
  (`npm run play`), which makes it possible to play and test in the terminal.
- **zustand** for the UI state, one plain CSS file for the retro look (no CSS framework).
- **No backend**: a static site (GitHub Pages, Netlify, Cloudflare Pages), saves in the browser,
  and an offline PWA (service worker in production builds).
- Tooling scripts (images, catalog, oracle) in TypeScript, run with `tsx`.

### Layout

```
zork-in-your-browser/
├── vendor/zork1/          # original ZIL sources (git submodule)
├── specs.md
├── docs/                  # README screenshot
├── src/
│   ├── engine/
│   │   ├── zmachine/      # Z-machine v3, text, Frotz RNG, disassembler
│   │   ├── story/         # zork1.z3 + its license + symbol table
│   │   ├── i18n/          # presenter, French grammar, clean-up, fr/ catalog and object names
│   │   ├── input/         # French command parser → parse buffer
│   │   ├── assist/        # world model, choice generator, guide (hyper noob mode)
│   │   └── game.ts        # facade: game, saves, undo, state for the UI
│   ├── data/scenes.json   # rooms → scenes and state variants
│   ├── ui/                # React app
│   └── cli.ts             # play in the terminal
├── tools/
│   ├── zil/               # ZIL reader (loads vendor/zork1)
│   ├── symbols/           # aligns the ZIL sources with the story file → symbols.json
│   ├── catalog/           # extraction, translation batches, merge, validation
│   ├── oracle/            # drives dfrotz for the differential tests
│   ├── images/            # style bible, prompts, generation, post-processing, review page
│   └── bot.ts             # plays only the guide's suggestions
├── public/scenes/         # published illustrations + manifest
└── test/
```

## 3. The engine

- A complete **Z-machine version 3** (instructions, objects, properties, dictionary, lexical
  analysis) that runs the original `zork1.z3` file (Release 119).
- **Randomness**: the Frotz generator, seeded, included in the state. A game replays
  identically, and the tests compare it word for word with `dfrotz -s`.
- **State = dynamic memory + stack**: ~11 KB, serialized to JSON. It is the basis of saves, undo
  and the guide's simulations.
- **Symbol table** (`story/symbols.json`): mapping between the machine's numbers and the names of
  the ZIL source (objects `MAILBOX`, attributes `TAKEBIT`, globals `TROLL-FLAG`, routines
  `WORD-PRINT`…). It is computed by a tool that aligns the source with the compiled file (rooms
  with the same name are told apart by their exits), and it is used by the guide, the choices and
  the overrides.
- **Structured output**: the `game.ts` facade produces events (text, room title, score, death,
  victory) that the UI formats.

## 4. French

### Texts

- Each print group of the bytecode (the equivalent of a `TELL`) and each data string (long
  descriptions, random messages…) becomes a catalog entry. The English catalog is extracted
  automatically from `zork1.z3`, with the matching ZIL passage as context; the French catalog is
  translated and checked by `tools/catalog/validate.ts` (placeholders, line breaks, missing keys).
- A **small grammar** handles the objects inserted into sentences. Each object has a name, a
  gender, a number and the French words that designate it (`objects.json`):

  ```json
  "o230": { "nom": "petite boîte aux lettres", "g": "f", "mots": { "boîte aux lettres": "MAILBOX" } }
  ```

  ```
  "{Le:0} est fermé{e:0}."       → « La boîte aux lettres est fermée. »
  "Il y a {un:0} ici."           → « Il y a une épée ici. »
  "Vous prenez {le:0}."          → « Vous prenez l'œuf. »   (automatic elision)
  ```

  Functions: `le/la/l'/les`, `un/une/des`, `du/de la/de l'`, `au/à la/aux`, `ce/cette/ces`,
  `il/elle/ils/elles`, `lui`, agreement (`é/ée/és/ées`) and free gender forms (`{g:0|…}`).
  Contractions (« de le » → « du ») only apply to real articles, never to pronouns.
- **Tone**: formal *vous* (the tradition of French interactive fiction), keeping Infocom's dry
  humor; puns are adapted rather than translated word for word.
- **Translation guide**: [src/engine/i18n/fr/GUIDE-TRADUCTION.md](src/engine/i18n/fr/GUIDE-TRADUCTION.md)
  (in French) keeps the ~1,900 strings consistent: proper names, places, key objects,
  typography. The grue stays **« un grue »**, masculine, as a creature's name (« Vous risquez
  fort d'être dévoré par un grue. »).

### French parser

The original parser stays in charge (disambiguation, "What do you want to open?", `all`,
`all but…`, `again`). Our French analyzer translates the sentence into English dictionary words
before handing it over, and handles what is specific to French:

- imperative **and** infinitive: `prends la lampe`, `prendre lampe`, `ouvre-la`;
- articles and elisions ignored: `l'épée`, `d'eau`, `les feuilles`;
- optional accents: `epee` = `épée`; adjectives before or after the noun
  (`la lampe en laiton`, `le couteau ensorcelé`);
- prepositions: `dans`, `sur`, `avec`, `à`, `sous`, `de`;
- shortcuts: `n s e o ne no se so`, `h`/`monter`, `b`/`descendre`, `i` (inventory), `r` (look),
  `x` (examine), `z` (wait), `g` (again);
- several commands: `prends la lampe puis va au nord`.

The English version stays playable (language setting): it is used by the tests and by purists.

## 5. The three game modes

| Mode | Input | Help |
|---|---|---|
| **Classic** | Text field (history with ↑/↓) | None |
| **Noob** | Multiple choices, free typing still available | None |
| **Hyper noob** | Multiple choices | The right answer is **circled in a dedicated color** (gold), with a foldable "Why?" |

The mode can be changed at any time, including in the middle of a game.

### Choice generator (noob modes)

The choices are **computed at every turn from the real state**, not written by hand room by room:

1. **Moves**: the exits of the room (blocked exits show their original message if tried).
2. **Visible objects and inventory**: verbs that apply according to the flags (`take` if
   `TAKEBIT`, `open`/`close` for containers, `read` if `READBIT`, `light` if `LIGHTBIT`, `eat`,
   `drink`, `examine`, `drop`, `put X in Y`…).
3. **Special actions** from the action routines: tie the rope to the railing, wave the sceptre,
   say "Odysseus", pray, ring the bell, push the yellow button, inflate the boat with the pump…
   A curated list built from the ZIL and the walkthrough.
4. **Meta**: look, inventory, wait.

Each candidate is checked by simulation on a copy of the state before being offered. The choices
are grouped (moves, actions, a foldable "Examine…") so that the panel never shows 30 buttons in a
row. **Guarantee**: the right action is always in the list, otherwise noob mode could become
impossible to finish.

### The guide (hyper noob mode)

A **goal-based** hint engine rather than a fixed list of commands, because the game is random
(thief, fights):

- about forty ordered goals taken from the 350-point solution ("have the lamp", "trap door open",
  "troll defeated", "dam open", "19 treasures in the trophy case"…), each with a `done(state)`
  predicate;
- for the current goal: shortest path (breadth-first search over the room exits read from the
  VM memory, taking light, doors, the troll and the load into account), then the command to run;
- re-evaluation at every turn: if the thief steals a treasure or a fight goes wrong, the guide
  adapts (retreat and heal, attack again, give the thief a treasure and come back with the
  knife, recover the item…).

**Key automated test:** a bot that plays *only* the circled answer must finish the game. It
currently wins 24 games out of 30 seeds and ends 3 more between 330 and 340 points; the failures
are the lamp running out after the thief takes the torch, and deaths in combat. In the browser,
undo gets the player out of these.

### Side panel

The panel next to the text has up to three tabs, and can be hidden from the status bar:

- **Actions** (noob modes): the choices above.
- **Inventory**: what the player carries, read from the game state (no turn spent), with the
  visible contents of open or transparent containers, an icon per object and a glow on a lit
  light source. In the noob modes, clicking an object lists the choices about it (each choice
  knows its object); in hyper noob mode the object holding the circled answer is circled too.
- **Treasures**: 19 slots and a counter ("7 / 19 in the trophy case"). A treasure stays a "?"
  until the player has touched it (TOUCHBIT) and as long as it is shut inside a closed, opaque
  container: the game touches what is inside a treasure put in the case, and the canary in the
  closed egg must not give itself away. Damaged versions (broken egg, broken canary) take the
  slot once they are in play. The tracker never says where a treasure is, and can be turned off
  in the settings.
- **Map**: the rooms seen, placed on a grid computed once by `tools/map/layout.ts` (breadth-first
  placement from the exits, then simulated annealing against misfitting directions and crossing
  passages) into `src/data/map.json`. Each room shows a thumbnail of its scene; passages link
  visited rooms; dashes show the visible exits not taken yet (doors included, hidden passages
  such as the way to the barrow left out). The game clears the visit mark of maze rooms on
  purpose, so the interface also remembers the rooms seen, in the saves. Resting the pointer
  on a room (or touching it) shows its picture; a room can be walked to after a confirmation,
  one move at a time, through visited rooms and open exits only, stopping at anything
  unexpected (a villain, darkness without light, a blocked way).

### Hints (InvisiClues)

About 25 questions (`src/engine/assist/hints.ts`), each with three hints from vague to
explicit, in French and English. A question shows once its place has been seen (or its object
found), and moves to "solved" with the puzzle; hints are revealed one at a time, with a faint
"invisible ink" look. Available from the menu in every mode.

### Documents (feelies)

The eleven texts written in the game (leaflet, owner's manual, dam guidebook, matchbook, gunk
tube, boat label, engravings, prayer, black book, ancient map, the gothic door) join a
collection once found, read from the story file in the language of the game, each on its own
paper (cream leaflet, blue booklet, tan cloth label, parchment, stone…), printable.

### Storyteller

The browser's speech synthesis reads each new answer aloud in the language of the game, in
sentences short enough for every engine, with the best local voice unless the player picks
another, at an adjustable rate. A new command interrupts it; the soundtrack steps back while it
speaks. Off by default.

## 6. Saves

- **10 slots** + **1 autosave** (at every room change).
- Each slot shows: an editable name, the date, the place, the score and the number of moves.
- Storage in `localStorage` (a snapshot weighs ~20–40 KB), with **export/import** of a
  `.zork.json` file to move to another browser or device.
- The game commands `sauvegarder`, `charger` and `recommencer` open the slots screen.
- **Undo the last move**: absent from the original, **on by default**, can be turned off in the
  settings.

## 7. Images

### Art direction

Zork I (1980) had no images. The period references are the Infocom box covers (1980s fantasy
painting) and the graphic adventure games of 1987 to 1992 (Sierra in EGA/VGA, LucasArts: *Loom*,
*Monkey Island*, *Indiana Jones and the Fate of Atlantis*).

**Choice: detailed "VGA 1990" pixel art.**

- A **480 × 270** grid (16:9), scaled up with nearest neighbor (`image-rendering: pixelated`).
- A **shared fixed palette of 64 colors**, light dithering.
- Why rather than realistic: pixel art fits the retro spirit of the game, and above all the
  **post-processing** (reduction to the grid + imposed palette) **guarantees the consistency**
  of all images, even when the model drifts from one image to the next. It also hides the
  typical flaws of AI images. Realistic images would need much more sorting to stay consistent.
- Dark rooms: a black screen drawn in CSS, with two eyes that light up if you linger (the grue).
  No AI needed.

### Scene inventory

110 rooms, but many look alike by design:

- maze (15 rooms + 4 dead ends) → a couple of images;
- forests, coal mine, river → a few images each;
- the rest of the game → distinct places.

Total: **82 scenes** plus **11 state variants** (reservoir full / drained, trap door open,
troll present, solid rainbow, cyclops room with the cyclops, dam open…), that is **93 final
images**, all generated and published in `public/scenes/`.

### Pipeline (`tools/images/`)

1. **`style-bible.md`**: the art direction in words (palette, light, framing "eye-level view,
   slight low angle", no character in the foreground, no text in the image), plus a shared
   style prompt and a negative prompt.
2. **`src/data/scenes.json`** and **`prompts.json`**: one entry per scene, with the rooms it
   covers, its state variants and a prompt (in English, models understand it better) written
   from the original descriptions gathered by `describe.ts`.
3. **`generate.ts`**: batch generation through an **interchangeable provider interface**:
   **OpenAI** (`gpt-image-1`, with reference images through the edits endpoint) and
   **OpenRouter** (Gemini image models). Several candidates per scene, cost estimate before
   anything is spent, retry on error.
4. **Style consistency**: 5 keystone scenes are generated first (white house, living room,
   troll room, dam, temple) and chosen by hand; they become the **style references** sent with every
   later generation.
5. **`postprocess.ts`**: 16:9 crop → reduction to 480 × 270 → quantization on the fixed palette
   (`sharp` + `image-q`) → optimized PNG. `--palette` computes the shared palette from the
   approved keystones.
6. **Review page** (`npm run images:review`, a small local server): shows the candidates of each
   scene, raw and post-processed, to approve or reject them in one click. A scene folds once its
   image is chosen.

The game stays fully playable without images: a placeholder (gradient and place name) is shown
while a scene is missing, and images can be turned off in the settings.

### Object icons

The 60 objects that can be taken get **48×48 icons**, shown pixel for pixel in the side panel:

- the same pipeline with `--items`: prompts in `tools/images/item-prompts.json` (written from
  the original descriptions, `describe.ts --items`), `src/data/items.json` mapping the objects
  to their icon, the "Objets" tab of the review page, `public/items/` and its manifest;
- 4 keystone objects (lantern, sword, egg, sack) become the style references of the others;
- square images on a transparent background (OpenAI), or on plain magenta that the
  post-processing removes (flood fill from the edges, then the anti-aliasing fringe);
- post-processing: trim, center in a square with a small margin, reduce to 48×48, map to the
  shared 64-color palette without dithering, pixels either opaque or transparent;
- until an icon is approved, a 12×12 pixel glyph of the object's kind (treasure, light,
  weapon, paper, food, container, tool, thing) stands in, scaled ×4.

### Cost

~90 images × 3–4 candidates ≈ 350 generations. Depending on the model, from ~0.003 USD to
~0.05 USD per image, that is **between ~2 and ~20 USD in total** (up to ~60 USD with the most
expensive models). The 60 icons add about 180 generations, ~7 USD. **Images are not the
expensive part.**

## 8. What about 3D?

**Feasible, not recommended.** Fixed-camera 3D in the point & click style would mean modeling and
lighting ~70 consistent environments: weeks of work, while the images cost a few dollars. AI 3D
generators produce isolated objects, not sets that are consistent with each other.

The modern compromise kept as a possible bonus: **2.5D**, each image cut into layers with an
automatically generated depth map, a light parallax that follows the mouse, and a few animations
(torch flame, water, dust). Later, **clickable hotspots** on the images could be added (clicking
the mailbox offers its actions): the point & click spirit without the 3D.

## 9. Fidelity and tests

- **Differential tests**: `tools/oracle` drives `dfrotz` on the original `zork1.z3` and compares
  its transcripts with our engine in English, word for word: the opening, the troll fight on
  several seeds, and the full walkthrough, fights and thief included.
- **Presenter identity**: rendering the English catalog through the template system must give
  back exactly the original output, which proves that the interception of print groups loses
  nothing.
- **Full solution**: the 350-point game replayed automatically, in English and with French
  commands (same path, no English text on screen).
- **Hyper noob bot**: finishes the game on several seeds (see §5), and its suggestion is always
  among the offered choices.
- **Unit tests** for the French parser (elisions, accents, pronouns, shortcuts), the French
  clean-up (contractions, punctuation) and the image post-processing.
- Caveat: the ZIL source is a snapshot taken when Infocom shut down and may differ slightly from
  the compiled Release 119. The engine runs the compiled file, so it reproduces Release 119,
  parser quirks included.

## 10. Interface

- At the top, the original status line (place · score · moves); below it, the scene image
  (16:9), then the game text; the choice panel on the side (below on phones).
- Retro but readable fonts: *VT323* for the interface and *IBM Plex Mono* for the text, with an
  adjustable size.
- Settings: game mode, language (fr/en), font size, images, typewriter effect, CRT effect
  (scanlines), undo.
- Dark theme (it is a cave…), layout adapted to phones, keyboard shortcuts, full screen button.
- Light on the scenes: underground, a halo shows what the lantern lights. Its reach follows the
  batteries, read from the game's clock table (385 turns: 200, then 100, 70 and 15 after each
  warning), and it flickers below 12 %; a torch or candles give a warm, unsteady light. Dust
  motes drift in caves, mines, the house and the temples; water ripples by the river and the
  dam. Turned off for players who ask for reduced motion.

### Soundtrack

- **Generated live** with the Web Audio API, no audio files: detuned drones through moving
  filters, filtered noise (wind, water, rumble), a generated reverb, and short sounds at random
  moments (drops, creaks, bells, whispers, pebbles, metal, birds, breath).
- **Eight ambiences** chosen per scene (`ambience` in `scenes.json`): surface, house, caves,
  mine, water, sacred places, Hades, maze. Two overlays follow the state rather than the place:
  **darkness** (beating sub-drone, high tension, heartbeat, the grue breathing) and **danger**
  (tremolo cluster and war drum while the troll, the thief or the cyclops is in the room).
  A dead adventurer wandering as a spirit hears Hades.
- **Cues**: a chime when the score goes up, a descending growl on death, a chord on victory.
- **Mix**: each ambience is balanced to about −23 LUFS (measured offline), then the player's
  volume (0.6 by default, on a perceptual curve) brings it well under the text. Crossfades of
  3.5 s; the sound starts on the first click or key (browser rule) and pauses when the tab is
  hidden.
- **Sound lab** (`/sound-lab.html`, development only): every ambience with sliders, level
  measurement and balancing, export of the tuned values.

## 11. Status (2026-10-17)

| # | Phase | Status |
|---|---|---|
| 0 | **Foundation** | ✅ Vite + React + TypeScript + Vitest |
| 1 | **Faithful engine** | ✅ Z-machine v3 + Frotz random number generator. The full solution (350/350, ~380 moves, fights included) is **identical to `dfrotz` word for word** |
| 2 | **French** | ✅ 951 print groups, 255 strings, 96 combat messages and 250 object names translated; French parser; the full solution plays with French commands without a single English word on screen |
| 3 | **Web UI and saves** | ✅ Game screen, status line, 10 slots + autosave, export/import, undo (Ctrl+Z), settings, title screen, CRT effect, typewriter |
| 4 | **Noob and hyper noob modes** | ✅ Choices generated from the state (checked by simulation), goal-based guide: **the bot that plays only the circled answer wins 24 games out of 30 and ends 3 more between 330 and 340 points** |
| 5 | **Images** | ✅ Style bible, 82 scenes + 11 state variants, 93 prompts, OpenAI / OpenRouter generation with cost estimate, 480×270 post-processing with a 64-color palette, review page. **All 93 images generated and chosen** |
| 6 | **Deployment** | ✅ GitHub Pages workflow (tests with `dfrotz`, build, deploy), offline PWA |
| 7 | **Soundtrack** | ✅ Procedural Web Audio ambiences per place, darkness and danger overlays, cues, sound lab |
| 8 | **Side panel** | ✅ Tabs for actions, map, inventory and treasure tracker; object icons generated |
| 9 | **Atmosphere and extras** | ✅ Lantern halo and scene animations, map with walking, InvisiClues hints, documents (feelies), storyteller |
| 10 | **Next** | Zork II and Zork III (same engine, new translation, images and guide); 2.5D parallax, clickable hotspots |

## 12. Decisions

1. **Architecture**: the original story file in a TypeScript Z-machine, with a French
   presentation layer (§2).
2. **Art direction**: detailed VGA pixel art (§7).
3. **Image providers**: OpenAI and OpenRouter, both supported.
4. **Undo the last move**: on by default.
5. **The grue**: « un grue », masculine.
6. **Original sources**: a git submodule (`vendor/zork1`), not a copy; the compiled story file
   is kept in the repository with its license, so the game builds without the submodule.
7. **Treasure tracker**: spoiler-free (unknown treasures are "?", no locations), optional.
