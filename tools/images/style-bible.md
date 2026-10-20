# Illustration style bible

Every image of the game must look like it comes from **the same 1990 adventure game**. This
document sets the art direction; `prompts.json` applies its rules scene by scene.

## References

- The **256-color VGA** graphic adventure games of 1989-1992: *Loom*, *The Secret of Monkey
  Island*, *Indiana Jones and the Fate of Atlantis* (LucasArts), *King's Quest V*, *Space
  Quest IV* (Sierra), *Conquests of the Longbow*.
- The 1980s Infocom box covers for the mood (slightly dark fantasy, understated humor).

## Rendering

- **Detailed pixel art**, painted "by hand": flat areas, light dithering, shading in pixel
  gradients, crisp edges. No photographic look, no 3D, no blur.
- Final grid **480 × 270** (16:9), scaled up on screen without smoothing.
- **Shared palette of 64 colors** imposed by the post-processing (see `palette.json`): it is what
  guarantees the visual unity, even when the generator drifts.

## Framing

- **First-person view, at eye level**: what the player sees when entering ("You are in…").
  Medium focal length (35 mm), slight low angle in the large underground halls.
- Three readable planes: a foreground that frames (rock, door jamb, branches), the subject in the
  center, a background that gives depth.
- The **exits** mentioned by the text should be visible when possible (a passage to the north, a
  staircase going down…): the image helps finding one's way.
- **No player character**, no hands. Creatures (troll, cyclops, spirits) only appear in the
  variants made for them.

## Light

- **Above ground**: soft, slightly hazy daylight, cloudy sky, earthy colors.
- **Underground**: deep darkness; the scene is lit by a **warm light coming from the viewer**
  (their lantern), fading towards the edges (natural vignetting), plus the light sources of the
  place itself (torches, magical glows, daylight through an opening).
- Dominant colors by region: house (wood, beige, old wallpaper), forest (muted greens), caves
  (browns, grays, ochre), water (deep blue-greens), temple and Egypt (light stone, gold),
  Hades (dark reds, purples), mine (coal blacks, rust).

## Content

- **Only draw the fixed scenery**: walls, doors, built-in furniture, machines, statues. Objects
  the player can take (treasures, lantern, sword…) **do not appear**: they move during the game
  and the text already describes them. Exceptions: massive, fixed elements (trophy case, rug,
  altar, machine, hanging basket).
- **No text** in the image (no readable inscriptions, no letters, no logos), no frame, no border,
  no interface, no signature.
- Tone: mysterious, wondrous, sometimes unsettling; never gory.

## Shared prompt

> Detailed hand-crafted pixel art scene from an early-1990s VGA point-and-click adventure game
> (LucasArts / Sierra style), 256-color look, limited palette, subtle dithering, painterly pixel
> shading, crisp edges, first-person view at eye level, wide 16:9 composition with a framing
> foreground, atmospheric lighting, no characters, no text, no letters, no UI, no border.

## Negative prompt

> text, letters, words, inscription, watermark, signature, logo, UI, frame, border, photograph,
> photorealistic, 3D render, smooth gradients, blur, bokeh, anime, modern objects, people,
> player character, hands, gore

## Keystone scenes (style calibration)

These 5 scenes are generated first; the best ones are chosen and become the **reference
images** given to the generator for all the others:

1. `west-of-house` — the white house (outside, daytime)
2. `living-room` — the living room (inside, daylight)
3. `troll-room--troll` — the troll room (underground, lantern, creature)
4. `dam` — the dam (large underground space, water)
5. `temple` — the temple (stone, gold, mystery)

## Character portraits

The close-ups of the characters (`portrait-prompts.json`) follow the same rules, framed like the
talking portraits of *Loom*, *King's Quest V* or *Monkey Island 2*:

- **One character in close-up**, head and shoulders, three-quarter view turned toward the
  viewer, the face large and expressive in the upper middle of a **square** frame (128 × 128
  after post-processing, same palette, same dithering as the scenes).
- Lit by the **viewer's lantern**, deep shadows behind; a dark, simple background that only
  hints at the place (the troll's cave, the Wizard's glow, the marble of the Dungeon Master).
- **The same looks as in the scenes**: a character already drawn in an approved scene gets that
  scene as a reference image.
- **States** are separate portraits (the troll knocked out, the cyclops asleep, the dragon
  angry, Cerberus tamed, the hooded figure weakened…), described as "the same … now …".
- The Dungeon Master's three disguises (the old man, the man at the cliff, the hooded figure)
  share **his keen pale grey eyes with a faint silvery glint**, discreet enough to go unnoticed.
- Keystones: `troll` and `thief` (Zork I), `zork2-wizard` and `zork2-dragon`,
  `zork3-dungeon-master`.
