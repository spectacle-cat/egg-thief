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

## The screens and the levels

The game opens on a splash ("Media Jousts presents"; a picture at `public/studio-logo.png` takes the place of the
spelled-out name if there is one), then the title, then the level select: a row of postcards, one for each level,
with its best run written underneath. Choosing a postcard shows the level's card (its name and its one new idea);
Go starts it. A player's first run is shown How to play once on the way in. The end card offers Next level, Go again
and Level select. Changing level never reloads the page, so a phone stays full screen and the music keeps going.

The levels are listed in `src/levels.ts`, in the order they are played:

| Level | Its line | Opens |
|---|---|---|
| Africa | The Long Way Home | from the start |
| Rainforest | When It Rains | once the lizard has got home from Africa |
| Back Gardens, British Coast | not built yet | they lie face down as "More maps on the way" |

Two switches at the top of that file change the rules: `LOCKS = false` opens every level from the start, and
`SHOW_COMING = false` leaves the levels that are not built off the level select altogether.

**To add a level:** draw its map into `public/levels`, give it an entry in `LEVELS` (an id, a name, a line, its one
idea, its map, a strip of its colours, and `after:` the level that opens it), then make its postcard: add a line to
`tools/scenarios/postcards.mjs` saying where to stand and which way to look, run it, and shrink the shot into
`public/levels` (the two commands are at the top of that file).

**What is remembered.** The best run of each level is kept in the browser under `eggthief.best.<id>` (more stars
wins, then more medals, then less time), along with the level played last and whether How to play has been shown.
A best run saved before there was a level list is carried over to Africa. A private window remembers only until it
is closed.

## The rainforest

The second level (`?level=rainforest` in the address goes straight to it). A dim, wet forest: there is cover
everywhere, so the question is how to get across. Everything from the desert still applies (roots are the rocks,
ferns the tufts, elephant ears the long grass, rotten stumps the cracked rocks, thorn vines the thorns), and on top
of that:

- **Streams.** Nobody walks through deep water. Cross at a ford (pale pebbles under thin water), along a fallen log,
  or with a dash, which skims one tile of water and no more. Run out of dash over the water and the lizard is washed
  back onto the bank it came from, unharmed, eggs and all.
- **Rain.** It rains on a timetable, so it can be learned: a dry spell, then thunder and the first drops (the logs
  rock), then the rain itself. In the rain every stream is a tile wider on each side, the fords are under water, and
  each log floats off and lodges at its next resting place, where it stays until the next rain. Hunters see less far
  in the rain. A lizard standing on a log when it lifts rides it.
- **Hollow logs.** Walk into one end and come out of the other, unseen on the way.
- **Coatis** walk the beats. Their ringed tails stand up above the ferns, so they can be followed from cover.
- **Eyelash vipers** sit coiled beside a heliconia and never leave it. One that makes you out strikes if you are
  within about three tiles, and otherwise hisses, which brings the nearest coatis to look. A Rattle Egg holds its
  gaze; a Ghost Egg walks past.
- **The bird-eating spider** lives just inside one mouth of some hollow logs: leg tips at the rim are the tell. Now
  and again it creeps out, feels about within a couple of tiles of its door and backs in again. While it is out its
  log is free; going in while it is home is a bite. A Ghost Egg goes straight past it.

### The canopy

Built from the designer's style guide to get a feel for it, and agreed as proposed on 2026-11-22. Its art is still
stand-ins. On the west bank of
Blackwater Creek, where the brook joins it, stands the **Hollow Giant**: the one tree with a glowing split at its foot
and ants walking to it. Step into the door and the lizard comes out of a **knothole** up in the canopy.

- Up there the ground is **leaf mats** (rooms) joined by **boughs** (corridors) with nothing between them. The forest
  floor shows far below through the gaps, the creek included.
- **Stepping off** an edge is not a death: the lizard comes down on the floor underneath, unharmed, eggs and all.
  Fall from the east end of the boughs and that is the east bank, which makes the canopy the dry way over the creek
  when the rain is up. A dash carries over a gap as it does over water, if it is long enough.
- The **knothole** is the door in reverse. Coatis cannot follow through either, so the door is a way out of a chase.
- Nests sit in the cups of the bough forks. The **golden egg** is at the far end, with a viper on a bromeliad
  beside it and sprays of leaves to hide under. Nothing rises in the rain up there.

On the map the canopy is a far corner of the same grid (the columns from 100 on in `rainforest.tmj`), placed so that
the knothole is straight above the door: that is how the game knows what is under each spot. `src/canopy.ts` draws
what only a canopy has and moves the lizard between the two; while she is on one deck the other is not drawn.

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

Map properties: `title`, `par_seconds` (the time to beat for the Speedy medal), `theme` (`desert` if left out, or
`rainforest`: whose drawings and colours the map wears, see `src/theme.ts`), and for a map with rain `dry_seconds` and
`rain_seconds` (how long each lasts; leave them out and it never rains).

A themed map names its tiles in its own words and the game reads them as the parts they play. In
`public/levels/rainforest.tmj`: `floor` and `pebbles` on the ground layer, with `water` (a stream), `ford` and `flood`
(bank that goes under when it rains); `buttress`, `trunk`, `stump`, `vines`, `heliconia`, `bromeliad`, `fungi` and the
same nests, beetles and burrows on `things`; `fern_1` to `fern_4` and `ears` on `cover`. Its extra objects:

| Class | Shape | Properties |
|---|---|---|
| `coati` | polygon or polyline | as `roadrunner` |
| `viper` | point | as `sentry` |
| `log` | polyline: the middle of the log at each resting place, in the order it visits them | `across` (`ew` or `ns`: which way it lies), `length` in tiles |
| `hollow_log` | a two-point polyline, mouth to mouth along a row or a column | `spider` (true if one lives inside the first mouth) |
| `ants` | polyline | none: a file of leafcutter ants walks it end to end, only to look at |
| `canopy` | rectangle | none: marks the canopy's corner of the map (see below) |

A map with a canopy has, on the ground layer in that corner, `mat` (leaf mat), `gap` (nothing: step off and fall),
`bough_ns` and `bough_ew`, `fork_n` `_e` `_s` `_w` (a T, named for the way its stem points; its cup takes a nest) and
`tip_n` `_e` `_s` `_w` (a dead end, named for the way it points); on `things`, one `knothole` up top and one
`hollow_door` on the floor with three `giant` tiles (the foot of the tree) on the row behind it, and `beyond` on the
ground nobody reaches between the floor and the canopy. The map property `floor_width` says how many columns, from
the left, are the floor. Leave the canopy's outermost columns and rows as `gap`.

`npm run level` writes both maps afresh from the grids of letters in `tools/make-level.mjs` (the desert) and
`tools/make-rainforest.mjs`. It overwrites edits made in Tiled, so use one or the other. It also checks each map:
every nest must be reachable once the power eggs that open its walls are, and the way out must need no power egg at
all. For the rainforest that has to hold wherever the logs have floated to, and every log must reach from dry ground
to dry ground even in the rain. Up top, every mat and bough must join up, no gap may be a single tile across, and the
knothole must sit on the same row as the door. `node tools/make-rainforest.mjs --print` shows the map as letters,
banks marked, and the canopy after it.

## Art

The originals come straight from `../sprites`. The newer pieces (power eggs, cracked rock, thorns, cacti, long grass,
mesas, beetle, medals and so on) are SVG drawings in `art/`, in the same flat cut-paper style.

The flying birds move without any new drawings: the owl and the hawk are each one picture from above, cut into strips
and hinged like a paper puppet (`src/puppet.ts`), so they beat their wings and lean into turns. Where the scissors go
is at the top of `src/hunters.ts`. The roadrunner is not a puppet: it runs through its four drawn frames.

The rainforest's drawings are in `public/sprites/rainforest`, built by `tools/art-rainforest.sh` from three sources:
Claire's own floor, ferns, nests and eggs recoloured; her desert pieces recoloured for the parts that are re-skins
(roots, stumps, vines, burrows); and stand-ins for everything new (coati, viper, spider, logs, trunks, the far
forest). To replace any picture, put a PNG or SVG of the same name in `art/rainforest/` and run the script: nothing
else needs to change.

```bash
npm run assets
```

rebuilds every PNG in `public/sprites` (needs ImageMagick and `rsvg-convert`).

## Testing without playing

Add to the address: `?level=rainforest` (straight to that level's card, earned or not; with `?skip=1`, straight
into it; the id of a level in `src/levels.ts`, or the name of any map in `public/levels`), `?unlock=1` (every level
open for this visit), `?splash=0` (no splash, or how many seconds of it), `?skip=1` (no menus: straight into play,
in Africa unless `?level` says otherwise), `?view=top` (an overhead camera for a picture of a whole map; players never get it, and `et.setView(1)` goes back to the chase camera), `?at=27,24` (start at a tile), `?power=ghost`,
`?eggs=5`, `?safe=1` (nothing can catch you), `?bot=1` (a stand-in player runs the level), `?mute=1`, `?post=0`,
`?res=1.5` (pixels per point).

`node tools/drive.mjs tools/scenarios/<name>.mjs` plays a scripted run in headless Chromium (software rendering) with
the dev server running, checks what happened and saves screenshots to `.shots/`:

- `bot` proves the maps can be finished: a stand-in player gets home from Africa with every egg, the golden egg
  and every kind of wall opened, finds the rainforest unlocked, goes on to it from the end card and gets home from
  there too, and each level keeps its own record. `BOT_STRICT=1` in front of the command asks for every egg in the
  rainforest as well.
- `powers` uses each power egg where it matters.
- `sneak` checks the hiding: long grass past a guard, a rattle pulling a guard off its post, a ghost walking by.
- `screens` goes through the splash, the title, How to play, the level select (a locked level, the cards face down,
  a level opened), the card before a level, the chase camera (and checks there is no way to change it), the end
  card, and going from one level to the next without the page reloading or anything left behind in memory.
- `pad` plays with a made-up DualSense: every button, the layouts a browser may report, the hints.
- `touch` plays as a phone, a smaller phone, a phone held upright and a tablet, with made-up fingers: the stick, the
  buttons, two thumbs at once, every card fitting the screen. A scenario step `{ device: { size: [844, 390], scale: 2 } }`
  turns the browser into that device; `tdown`, `tmove`, `tup` and `tap` are its fingers. (Any step may carry
  `if: 'expression'`: it is only taken when the page says yes.)
- `birds` takes strips of pictures of each bird moving, from close beside it.
- `rain` plays a whole rain in the rainforest: a ford walked dry and shut in the rain, a dash over the brook, every
  log in each resting place, a lizard washed back with its eggs, and one riding a log. `et.weather.skip()` moves the
  timetable on to its next part.
- `spider` goes through a hollow log, watches the spider out and back, gets bitten at its door and walks past it as
  a ghost.
- `forest` takes pictures of each area of the rainforest, dry and in the rain.
- `canopy` goes in at the Hollow Giant's door and out of the knothole, along a bough, off each end of it (down onto
  each bank of the creek), back down the knothole, and takes pictures up top.
- `postcards` takes the pictures for the level select's postcards.
- `look` and `tour` take pictures around the map; `hud` and `audio` exercise the screens and the sounds; `perf`
  counts draw calls.

In the browser console the game is `et`: `et.debug()`, `et.teleport(x, z)`, `et.give('thunder')`, `et.fast(seconds)`.
