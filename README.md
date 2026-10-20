# Zork in the browser

**A fan tribute to the Zork trilogy (Infocom, 1980–1982), playable in French in the browser,
with the sights and sounds the originals never had.** Zork I: The Great Underground Empire,
Zork II: The Wizard of Frobozz and Zork III: The Dungeon Master are fully translated.

![West of House, in Easy mode: the pixel-art scene, the French text and the suggested action circled in gold](docs/screenshot.jpg)

You are standing in an open field west of a white house… and this time you can see it, and
hear the wind in the trees.

**[Play it online](https://mathieuancelin.github.io/zork-in-the-browser/)**

Zork in the browser does not remake Zork. It runs the **original 1980s story files**, untouched, and wraps
them in what a modern browser can offer: a complete French translation, pixel-art illustrations
in the spirit of the VGA adventure games, an eerie soundtrack composed live as you play, help
modes for newcomers, and save slots. Every puzzle, every grue and every one of the 350 points
(400 in Zork II, 7 points of "potential" in Zork III) is exactly where Infocom left them.

## The three games

Pick a game on the welcome screen, or at any time from the menu (or the game's name in the
status bar). Each game keeps its own game in progress, its ten save slots and its hints.

| Game | Story file | In French | What the interface adds |
|---|---|---|---|
| **Zork I: The Great Underground Empire** (1980) | Release 119 | yes | everything below: illustrations, icons, the guide of the Easy mode, hints, map, treasures, documents |
| **Zork II: The Wizard of Frobozz** (1981) | Release 63 | yes | everything below: illustrations, icons, the guide, hints, map, the ten treasures of the demon, thirteen documents |
| **Zork III: The Dungeon Master** (1982) | Release 25 | yes | everything below: illustrations, icons, the guide, hints, map, the seven pieces of the Dungeon Master's outfit as treasures, four documents |

> **Unofficial fan project.** Zork in the browser is a non-commercial tribute, made out of love for the
> game. It is not affiliated with, endorsed by or sponsored by Infocom, Activision or
> Microsoft. ZORK is a registered trademark of its owner. See [Credits and licenses](#credits-and-licenses).

## What it adds

- **The real games.** The original story files (`zork1.z3` Release 119, `zork2.z3` Release 63,
  `zork3.z3` Release 25) run in a Z-machine written in TypeScript. It reproduces the reference
  interpreter `dfrotz` word for word, fights and randomness included: the tests replay the full
  walkthroughs of the three games against it (350 points in Zork I, 400 in Zork II, the 7 points
  of Zork III).
- **Fully in French.** Every text of the trilogy is translated, with proper gender and number
  agreement (« la boîte est fermée », « l'épée »), and a French parser understands commands
  such as `prends la lanterne`, `ouvre-la` or `mets l'épée dans la vitrine puis va au nord`.
  The Wizard of Frobozz casts his spells in French too, and you can cast them back
  (`agite la baguette vers le menhir`, then `dis « flotte »`), and the Dungeon Master takes his
  orders in French (`maître, tourne le cadran sur 1`). The original English is one setting away.
- **Illustrations.** Pixel-art scenes cover every room of the trilogy (93 in Zork I, 104 in Zork
  II, 90 in Zork III), drawn on a 480×270 grid with a shared 64-color palette, including state
  variants (the troll in his room, the drained reservoir, the dragon in his lair, the hooded
  figure in the Land of Shadow…). Dark rooms stay dark, except for two eyes that light up
  if you linger. Underground, the scene is lit by your lantern: its halo narrows as the
  batteries run down and flickers when they are nearly dead, a torch gives a warm, unsteady
  light, and dust drifts or water ripples on top.
- **A soundtrack that gets under your skin.** Go down the trap door and the wind gives way to a
  deep drone and water dripping somewhere in the dark. Let your lantern die and a heartbeat
  rises while something breathes close by. Walk into the troll's room and a war drum starts. The
  music follows the game: one ambience per kind of place (forest, house, caves, mine, river and
  dam, temples, Hades, the maze, and in the sequels the gardens, the volcano, the ocean, the icy
  lake, the Land of Shadow, the museum, the Wizard's magic, the dungeon), darkness and danger on
  top of it, and short cues for points,
  death and victory. It is generated live by the browser, never loops, and stays low under the
  text. Headphones recommended.
- **Three ways to play.**

  | Mode | How you play |
  |---|---|
  | Classic (« Classique ») | Type your commands, as in 1980. |
  | Normal | Click on actions computed from the game state at every turn (moves, objects, special actions). Typing is still available. |
  | Easy (« Facile ») | Same choices, and the right one is circled in gold, with a "Why?" that explains it. A goal-based guide adapts to chance: the thief and the fights of Zork I, the Wizard's spells in Zork II, the hooded figure and the Royal Puzzle (solved from wherever you got lost) in Zork III. |

  You can switch modes at any time, even in the middle of a game. The side panel is hidden in
  Classic and shown in the other modes (its button still shows or hides it).
- **Inventory and treasures at a glance.** A side panel shows what you carry, with a pixel-art
  icon for each object and the contents of open containers; in the Normal and Easy modes, click
  an object to see what you can do with it. The treasure tracker has 19 slots in Zork I that
  reveal themselves as you find the treasures and turn gold once they are in the trophy case, 10
  in Zork II, the treasures that will pay a certain fee, and 7 in Zork III, which has no
  treasures but an outfit to gather. It never tells you where to look, and can be turned off.
- **A map that draws itself.** Every room you have seen appears with a thumbnail of its
  illustration, linked to its neighbors, with short dashes for the exits you have not taken.
  Rest the pointer on a room (or touch it) to see its picture again; pick one and the game
  walks you there, one step at a time, after a confirmation. It opens large above everything
  when you need the whole picture. The maze finally becomes bearable.
- **Hints, the InvisiClues way** (twenty to thirty questions in each game). Infocom's hint booklets were printed in invisible ink: you
  revealed one answer at a time with a special marker. Here, questions about the places you
  have seen offer three hints each, from vague to explicit, revealed one by one.
- **Documents to collect.** Infocom boxes came with "feelies". The documents of the game (the
  leaflet, the dam guidebook, the boat label, the black book, the engravings… and in Zork II the
  newspaper, the balloon label, the robot's instructions, the white book of magic, the Wizard's
  degree…, in Zork III the warning of the Royal Puzzle, the Royal Seal and the very ancient
  book) join a collection as you find them, each on its own kind of paper, ready to read again
  or print.
- **A storyteller.** If you like, the browser reads the game's answers aloud, in French or
  English, while the music steps back.
- **Saves and undo.** 10 save slots plus an autosave for each game, export and import of a save
  file (every game in one file), and **undo** (Ctrl+Z), on by default.
- **Retro touches, modern comfort.** Optional CRT scanlines and typewriter effect, adjustable
  font size, a layout that works on phones, and an installable app (PWA) that plays offline.

## Play

Requirements: Node.js 24 or later.

```bash
git clone --recurse-submodules https://github.com/mathieuancelin/zork-in-the-browser.git
```

```bash
npm install
```

```bash
npm run dev
```

Then open the address shown (http://localhost:5173). You can also play in the terminal:

```bash
npm run play
```

(`npm run play -- --en` plays the original English version, `npm run play -- --game zork2` plays
Zork II.)

The submodules ([vendor/zork1, zork2 and zork3](#the-original-sources)) are only needed by the
development tools: playing, testing and building work without them.

### Useful commands

| Command | Meaning |
|---|---|
| `n`, `s`, `e`, `o`, `ne`, `no`, `se`, `so`, `monter` (`h`), `descendre` (`b`) | move (`o` is west, *ouest*) |
| `i` / `r` / `x objet` / `z` | inventory / look / examine / wait |
| `prends tout`, `prends tout sauf l'épée` | take all, take all but the sword |
| `sauvegarder`, `charger`, `annuler` (Ctrl+Z), `recommencer`, `aide` | save, restore, undo, restart, help: handled by the interface |

## Deploy on GitHub Pages

The workflow [.github/workflows/pages.yml](.github/workflows/pages.yml) runs the type check, the
tests (including the comparison with `dfrotz`, installed in CI) and the build on every push and
pull request. A push to `main` then publishes the site.

To do once on GitHub: **Settings > Pages > Build and deployment > Source: "GitHub Actions"**.
The game is then online at `https://<user>.github.io/<repository>/` (paths are relative, so no
repository name needs to be configured).

## Tests

```bash
npm test
```

They check, among other things, that the full games (350 points in Zork I, 400 in Zork II, 7 in
Zork III) are identical to `dfrotz` word for word, that they can also be played with French commands without a
single English word on screen, and that the guide of the Easy mode finishes each game on its own
(on many seeds, the randomness of the fights and of the Wizard's spells included). The
comparison tests need `dfrotz` (from the `frotz` package) and are skipped when it is missing.
The walkthroughs are in [test/walkthrough/](test/walkthrough), one folder per game.

The guide can also be watched playing alone:

```bash
npm run bot -- 1234 --fr --verbose
```

(`--game zork2` or `--game zork3` for the other games.)

## Illustrations

The images of the trilogy in [public/scenes/](public/scenes) and [public/items/](public/items) were generated with AI image models from the
prompts of this repository, then reduced to the pixel grid and palette by a post-processing
step. The whole pipeline is included, to regenerate a scene or the full set with your own API
key. The art direction is described in [tools/images/style-bible.md](tools/images/style-bible.md)
and the prompts are in [tools/images/prompts.json](tools/images/prompts.json).

Zork II and Zork III have their scenes ([src/data/zork2/scenes.json](src/data/zork2/scenes.json),
[src/data/zork3/scenes.json](src/data/zork3/scenes.json): 104 and 90 images with their state
variants) and their icons (46 and 19, the others borrowed from Zork I), with their prompts in
[tools/images/zork2/](tools/images/zork2) and [tools/images/zork3/](tools/images/zork3). Every command below takes `--game zork2` or `--game zork3` (Zork I
by default). Their ids start with the game (`zork2-dragon-room`), so the three games share the
folders of candidates and published images; Zork I's approved keystones are the style
references of the whole trilogy, joined by each game's own keystones.

1. Put your key in a `.env` file at the root (it is ignored by git):

   ```
   OPENAI_API_KEY=sk-...
   # or
   OPENROUTER_API_KEY=sk-or-...
   ```

2. Generate the **5 keystone scenes** (4 candidates each). Without `--yes`, the command only
   prints the plan and the estimated cost:

   ```bash
   npm run images:generate -- --provider openai --keystones --count 4
   ```

   ```bash
   npm run images:generate -- --provider openai --keystones --count 4 --yes
   ```

3. Pick the best ones in the review page (http://localhost:5180). Each candidate is shown raw
   and after post-processing (480×270, 64-color palette). The page has a tab for each game, with
   the number of images already chosen, and one for its scenes and one for its objects.

   ```bash
   npm run images:review
   ```

4. Compute the shared palette from the approved keystones, then publish them again with it:

   ```bash
   npm run images:palette
   ```

   ```bash
   npm run images:postprocess
   ```

5. Generate every other scene: the approved keystones are sent as **style references** with each
   request.

   ```bash
   npm run images:generate -- --provider openai --missing --count 3 --yes
   ```

   Then go back to step 3 to choose. The game shows an image as soon as it is published in
   `public/scenes/`; until then, a colored placeholder stands in for the scene.

For Zork II, the same steps start with its own keystones (the topiary, the dragon, the Wizard's
workroom, the bank's depository, the balloon at the bottom of the volcano):

```bash
npm run images:generate -- --game zork2 --provider openai --keystones --count 4
```

```bash
npm run images:generate -- --game zork2 --provider openai --keystones --count 4 --yes
```

```bash
npm run images:generate -- --game zork2 --provider openai --missing --count 3 --yes
```

and the same for Zork III with `--game zork3` (the cliff in the sunlight, the Jewel Room, the
Guardians of Zork, the hooded figure, the Flathead Ocean). Choose them at
http://localhost:5180/?game=zork2 (or `zork3`).

Providers: `openai` (model `gpt-image-1` by default, `ZORK_OPENAI_MODEL` to change it,
`ZORK_OPENAI_QUALITY` for the quality) and `openrouter` (model `google/gemini-2.5-flash-image` by
default, `ZORK_OPENROUTER_MODEL`). Expect a few cents per image, around 10 to 30 USD for the full
set with several candidates per scene (check current prices with the provider).

### Object icons

The 60 objects you can take get 48×48 icons on a transparent background, with the same palette
as the scenes. Their prompts are in [tools/images/item-prompts.json](tools/images/item-prompts.json)
(written from the original descriptions, gathered by `npx tsx tools/images/describe.ts --items`),
and [src/data/zork1/items.json](src/data/zork1/items.json) maps the game's objects to their icon
(Zork II and Zork III have their own in [src/data/zork2/items.json](src/data/zork2/items.json) and
[src/data/zork3/items.json](src/data/zork3/items.json), and borrow the lantern, the sword and a
few others from Zork I). The steps are the same, with `--items` (and `--game`):

```bash
npm run images:generate -- --items --provider openai --keystones --count 3 --yes
```

Choose them in the "Objets" tab of the review page (`npm run images:review`, then
http://localhost:5180/?kind=items): the 4 keystone objects (lantern, sword, egg, sack) become the
style references of the others.

```bash
npm run images:generate -- --items --provider openai --missing --count 3 --yes
```

```bash
npm run images:generate -- --game zork3 --items --provider openai --keystones --count 3 --yes
```

OpenAI draws the icons on a transparent background; other models draw them on a plain magenta
background, which the post-processing removes. After a palette change,
`npm run images:postprocess -- --items` publishes them again. Until an icon exists, a small pixel
glyph of the object's kind stands in for it. Count about 7 USD for 3 candidates of each object.

## Soundtrack

There is not a single audio file in the game. Everything you hear is synthesized on the fly with
the Web Audio API: detuned oscillators drifting through slow filters, filtered noise for the
wind, the water and the rumbles, a generated cave reverb, and short sounds played at random
moments (drops, creaking wood, far bells, whispers, rolling pebbles, metal, birds, breathing,
waves, crackling fire, glassy chimes).
Each ambience crossfades into the next as you move, and the mood reacts to what happens: no
light, a villain in the room, a treasure in the case, a death. The whole thing weighs a few
kilobytes.

The ambiences are data in [src/ui/sound/presets.ts](src/ui/sound/presets.ts); each scene of
[src/data/zork1/scenes.json](src/data/zork1/scenes.json) names its ambience (and each room of
Zork II in [src/data/zork2/scenes.json](src/data/zork2/scenes.json): the gardens, the river and
the well, the Wizard's magic, the volcano, the Bank of Zork, the machinery, the crypt, the
afterlife, the maze; and of Zork III: the sunlit cliff, the icy lake and the ocean, the Land of
Shadow, the museum, the Royal Puzzle, the Dungeon and its flaming pit). To tune them by ear, run
`npm run dev` and open `/sound-lab.html`: it plays each ambience with sliders for its settings,
measures the levels, balances them, and copies the result back as JSON.

## The original sources

[vendor/zork1](vendor/zork1), [vendor/zork2](vendor/zork2) and [vendor/zork3](vendor/zork3) are
git submodules pointing to [historicalsource/zork1](https://github.com/historicalsource/zork1),
[zork2](https://github.com/historicalsource/zork2) and [zork3](https://github.com/historicalsource/zork3),
the ZIL source code of the trilogy released by Microsoft under the MIT license. The game does not
need them at runtime (it runs the compiled story files kept in
[src/engine/story/](src/engine/story), one folder per game), but the tools read them to rebuild
the symbol tables, extract the text catalogs, print the maps and describe the scenes for the image
prompts. Every tool takes `--game zork2` (Zork I by default).

If you cloned without `--recurse-submodules`:

```bash
git submodule update --init
```

## Architecture

| Folder | Role |
|---|---|
| `src/engine/zmachine/` | Z-machine v3, Frotz random number generator, disassembler |
| `src/engine/games.ts` | the three games: story file, release, score, sources, translation |
| `src/engine/story/<game>/` | the story file, its license and its symbol table (ZIL names of objects, attributes, globals, routines) |
| `src/engine/i18n/` | text rendering: templates, French grammar, catalogs in `fr/<game>/catalog.json` |
| `src/engine/input/` | French command parser |
| `src/engine/assist/` | clickable choices, the guides of the Easy mode (`guide.ts`, `guide-zork2.ts`, `guide-zork3.ts` with the Royal Puzzle solver), inventory, treasures, map, hints, documents |
| `src/data/<game>/` | map layout, scenes and ambiences, item icons |
| `src/ui/` | the React application |
| `tools/` | symbols, catalog extraction, reuse and merge, `dfrotz` oracle, images, map layout, bot |
| `vendor/zork1/`, `zork2/`, `zork3/` | the original ZIL sources (git submodules) |

The design notes are in [specs.md](specs.md). The translation follows
[src/engine/i18n/fr/GUIDE-TRADUCTION.md](src/engine/i18n/fr/GUIDE-TRADUCTION.md) (in French),
with a glossary for each game.

### Translating a game

```bash
npm run symbols -- --game zork3
```

```bash
npm run catalog:extract -- --game zork3
```

```bash
npx tsx tools/catalog/reuse.ts --game zork3
```

```bash
npx tsx tools/catalog/chunk.ts --game zork3 --groups 5 --strings 2 --objects 2
```

The first commands build the symbol table and the English catalog; `reuse.ts` copies the
translation of every text the game shares with Zork I or Zork II (about 40 % of Zork II and of
Zork III); `chunk.ts` cuts
what is left into batches (`tools/catalog/<game>/work/`). Each batch is translated into
`src/engine/i18n/fr/<game>/parts/` (objects into `objects.json`), checked and merged:

```bash
GAME=zork3 npm run catalog:merge
```

## Credits and licenses

- **Zork I** (1980), **Zork II** (1981) and **Zork III** (1982) were written by Marc Blank, Dave
  Lebling, Bruce Daniels and Tim Anderson, and published by Infocom. Their source code and
  compiled story files were released by Microsoft under the MIT license in 2025: see the
  licenses in [src/engine/story/](src/engine/story) and the [vendor/](vendor) submodules.
- **ZORK** is a registered trademark of its owner. This project uses the name only to refer to
  the game it pays tribute to.
- **Zork in the browser** (the Z-machine, the French translation, the interface, the tools and the
  illustrations) is released under the [MIT license](LICENSE).
- Fonts: [VT323](https://fonts.google.com/specimen/VT323) and
  [IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono), served by Google Fonts.
- Thanks to the [Frotz](https://davidgriffith.gitlab.io/frotz/) team, whose interpreter is the
  reference the engine is tested against.
