# Egg Thief (web)

Egg Thief rebuilt in three.js: the same hand-drawn lizard, eggs and hunters, on a map many screens wide, seen from a low
camera that follows the lizard. The DragonRuby original lives in the folder above; this version only reads its art.

## Run it

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5183. `npm run build` writes a static site to `dist/`.

## Play

| | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Run | WASD or arrows | left stick or d-pad | drag the left thumb, anywhere on the left |
| Dash | Space | ✕ / A (also □, R2) | the DASH button |
| Use the power egg | E (or F, or right click) | △ / Y (also ○, R1, L2) | tap the egg |
| Turn the camera | Z and X (or , and .) | right stick | drag on the right |
| Switch camera | C, or 1 2 3 | Create / View, or click a stick | |
| Pause, restart, mute | Esc, R (when paused), M | Options or the touchpad; L1 (when paused); ○ backs out | the pause button; the rest is on its card |

A PS5 DualSense works over USB or Bluetooth: press any button once so the browser sees it, and the on-screen hints
switch to its shapes (an Xbox pad gets letters). It shakes in Chrome and Edge. Browsers only start sound after a click
or a key press, so click the page once before playing with the pad alone.

**Phones and tablets.** On a touch screen the game shows a thumb-stick (it appears wherever the left thumb comes
down, and its base follows a thumb that strays), a DASH button, the power egg as a button of its own, and a pause
button; the hints talk of tapping. A phone is played on its side: held upright it asks to be turned. A keyboard or a
pad attached to a tablet takes over as soon as it is used, and a touch takes over again.

To try it on a phone or tablet on the same Wi-Fi:

```bash
npm run phone
```

and open the Network address it prints. It serves on port 8765, not the usual 5183: a laptop's firewall has to let
the Wi-Fi in on whichever port is used, and this one's already does on 8765. If the phone just waits and never loads,
the firewall is the first thing to check. Added to the home screen (Share, then Add to Home Screen on an iPhone or
iPad; the browser's menu on Android) it opens full screen like an app, with its own icon. In Android's browser, and
an iPad's, there is also a Full screen button on the title and the pause card. An iPhone's silent switch silences the
game too.

A phone draws fewer pixels than its screen has, and lowers them further if it cannot keep up; `?res=2` in the address
fixes the number of pixels per point instead.

Steal eggs from nests and carry them to a burrow. Get eaten and the eggs you carry go back to their nests. The first
bite only costs your tail (it grows back; a burrow mends it at once). When you have what you came for, hold dash on the
way out in the far corner to go home.

**Hiding.** Sit under a tuft and nothing can see you. Long grass hides you even on the run. Rocks block every hunter's
view, and yours: when the lizard is behind something you see its outline in stripes.

**Power eggs.** One can be carried at a time. Its nest grows another a few seconds after you use it.

| Egg | What it does | What it opens |
|---|---|---|
| Thunder | A ground-pound: walkers nearby see stars for a few seconds | Smashes cracked rocks |
| Chili | A few seconds of fire: faster, and too hot to bite | Burns thorns, and the fire spreads along a hedge |
| Ghost | A few seconds unseen and uncatchable | Gets you past guards, owls and hawks |
| Rattle | Thrown ahead; every walker in earshot goes to look | Pulls a guard off its post |

**Extras.** Beetles refill your dash. One golden egg is walled up somewhere. Robbing nests in quick succession counts up
a streak. Emptying an area earns a stamp. The end screen gives up to three stars and seven medals, and remembers your
best run.

## The level is a Tiled map

`public/levels/desert.tmj` opens in [Tiled](https://www.mapeditor.org) (1.10 or later). Paint on the three tile layers
and drag the routes; save, and reload the game. The game knows a tile only by its picture's file name:

| Layer | Tiles |
|---|---|
| `ground` | `scrub`, `sand` |
| `things` | `boulder`, `boulder_scorpion`, `rockspire`, `rock_cracked`, `thorns`, `nest_egg_1` `2` `3`, `nest_clutch`, `nest_thunder`, `nest_ghost`, `nest_chili`, `nest_rattle`, `nest_gold`, `beetle`, `burrow_start`, `burrow`, `burrow_exit`, `cactus_1` `2` `3`, `agave`, `deadtree`, `skull`, `bones` |
| `cover` | `tuft_1` to `tuft_4`, `grass` |

Objects (set the class in Tiled):

| Class | Shape | Properties |
|---|---|---|
| `roadrunner`, `owl`, `hawk` | polygon (a loop) or polyline | `speed`, `phase` (0 to 1: where on the loop it starts) |
| `sentry` | point | `facing` in degrees (0 north, 90 east), `sweep` (how far the gaze swings each side) |
| `zone` | rectangle | `mood`: `morning`, `noon`, `canyon`, `thicket`, `dusk` or `sunset`; the name is shown on entering |

Map properties: `title`, `par_seconds` (the time to beat for the Speedy medal).

`npm run level` writes the map afresh from the grid of letters in `tools/make-level.mjs`. It overwrites edits made in
Tiled, so use one or the other. It also checks the map: every nest must be reachable once the power eggs that open its
walls are, and the way out must need no power egg at all.

## Art

The originals come straight from `../sprites`. The newer pieces (power eggs, cracked rock, thorns, cacti, long grass,
mesas, beetle, medals and so on) are SVG drawings in `art/`, in the same flat cut-paper style.

The birds move without any new drawings: each is its one picture from above, cut into strips and hinged like a paper
puppet (`src/puppet.ts`). The roadrunner turns its head to look, runs with its head down and cocks its tail; the owl
and the hawk beat their wings and lean into turns. Where the scissors go is at the top of `src/hunters.ts`.

```bash
npm run assets
```

rebuilds every PNG in `public/sprites` (needs ImageMagick and `rsvg-convert`).

## Testing without playing

Add to the address: `?skip=1` (no title), `?view=top|tilt|chase`, `?at=27,24` (start at a tile), `?power=ghost`,
`?eggs=5`, `?safe=1` (nothing can catch you), `?bot=1` (a stand-in player runs the level), `?mute=1`, `?post=0`,
`?res=1.5` (pixels per point).

`node tools/drive.mjs tools/scenarios/<name>.mjs` plays a scripted run in headless Chromium (software rendering) with
the dev server running, checks what happened and saves screenshots to `.shots/`:

- `bot` proves the map can be finished: every egg home, the golden egg found, every kind of wall opened.
- `powers` uses each power egg where it matters.
- `sneak` checks the hiding: long grass past a guard, a rattle pulling a guard off its post, a ghost walking by.
- `screens` goes through the title, the three camera views and the end card.
- `pad` plays with a made-up DualSense: every button, the layouts a browser may report, the hints.
- `touch` plays as a phone, a smaller phone, a phone held upright and a tablet, with made-up fingers: the stick, the
  buttons, two thumbs at once, every card fitting the screen. A scenario step `{ device: { size: [844, 390], scale: 2 } }`
  turns the browser into that device; `tdown`, `tmove`, `tup` and `tap` are its fingers.
- `birds` takes strips of pictures of each bird moving, from close beside it.
- `look` and `tour` take pictures around the map; `hud` and `audio` exercise the screens and the sounds; `perf`
  counts draw calls.

In the browser console the game is `et`: `et.debug()`, `et.teleport(x, z)`, `et.give('thunder')`, `et.fast(seconds)`.
