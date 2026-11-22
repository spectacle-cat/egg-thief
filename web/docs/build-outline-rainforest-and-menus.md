# Build outline: the rainforest level, a level select, and a splash and title

Written 21 November 2026 in the concept-art session, for the session that builds `web/`. It says what to build and
how it should play. How to build it is yours to decide; where this outline and the code disagree, the code wins and
Joe should hear about it.

Each line is marked so nobody mistakes a guess for a decision:

- **[agreed]** Joe and Claire said so.
- **[default]** my proposal. Build it this way unless they say otherwise, and keep it easy to change.
- **[open]** undecided. Leave room for it; do not invent it.

## 1. Where things are

| What | Where |
|---|---|
| Concept sheets (Look, World, Creatures for each level) | https://claude.ai/artifact/PoQAFraxiCikwerwypQGSR (private to Joe) |
| Rainforest pictures as PNG | `web/.shots/concepts/rainforest-v2/` (`h01` scene, `t01` the rain, `w01`–`w10` world, `c01`–`c05` creatures, `r01`–`r05` recolours) |
| The drawings as SVG | `web/.shots/concepts/rainforest-v2/svg/` |
| Claire's own sprites recoloured for the rainforest | `web/.shots/concepts/rainforest-v2/recoloured-sprites/` (`fern_1`–`4`, `nest_empty`, `nest_egg_1`–`3`, `nest_clutch`, `nest_gold`, `egg_mint`, `egg_lime`, `egg_pink`, `floor`) |
| Creatures cut out clean: from above, head up, no shadow, transparent | `web/.shots/concepts/rainforest-v2/stand-in-sprites/` |

Everything in `.shots` is ignored by git, so copy what you use into `public/sprites` or `art/`.

All of the rainforest art except the recolours is a stand-in drawn by me. Claire will redraw it. Build so that
replacing a picture file is all it takes.

## 2. The rainforest in one paragraph

A dim, wet forest with a plum floor and teal leaves. The desert is open with a few places to hide; here there is cover
everywhere, so the level's question is how to get across. Streams cut the map into pieces. In a dry spell you walk the
fords, run the fallen logs, or dash over a narrow stream. Every so often it rains: the streams widen, the fords go
under, and the logs float off and lodge somewhere new. **[agreed: rain changing the streams is the twist; logs are
the crossings]**

### Colours [default, shown on the sheets; nobody has objected]

`#1A1030` ink · `#3B2350` plum (the floor) · `#5A3A6E` plum light · `#0C4A50` deep teal · `#1E8C7B` jade ·
`#86DDB9` mint · `#D9F5E6` mist · `#E4F56A` lime (things that glow) · `#F23D7F` pink (flowers and alarms only) ·
`#B01E5B` deep pink · `#FFC62E` gold (rare).

Rules: no green-green, leaves run teal to mint. Pink stays small. Lizzie stays gold and should be the warmest thing on
screen. The fog, sky and colour grade for each area need new moods; the desert's are in `src/gfx.ts` and
`src/audio.ts`.

**[agreed]** The look has to be textured like Claire's desert art, not flat vector shapes. That matters for anything
you draw yourself (water, rain, puddles, moods): chips and bands of grit on the ground, frond line-work for plants,
flecks on creatures.

## 3. The pieces

"Plays like" names the desert piece whose behaviour to reuse.

| Piece | Plays like | What is new | Picture |
|---|---|---|---|
| Forest floor | `scrub` / `sand` | nothing; a re-skin **[agreed: recolour]** | `recoloured-sprites/floor.png` |
| Fern clump ×4 | `tuft_1`–`4` | nothing; a re-skin **[agreed: recolour]** | `recoloured-sprites/fern_*.png` |
| Nest, eggs, clutch | `nest_*`, `egg_*` | nothing; a re-skin **[agreed: recolour]** | `recoloured-sprites/` |
| Golden egg, four power eggs | the same | nothing **[agreed: golden egg is in]** | existing |
| Buttress root | `boulder` | none | `w04` |
| Giant trunk | `rockspire` (blocks sight) | none | `w05` |
| Rotten stump | `rock_cracked` (Thunder) | none | `w06` |
| Thorn vines | `thorns` (Chili, fire spreads) | none | `w07` |
| Elephant ears | `grass` (hidden on the run) | none | `w08` |
| Root burrow | `burrow_start`, `burrow`, `burrow_exit` | ringed with glowing fungi so it reads in the dark | `w10` |
| Stream | new | water. Stops a walk. **[default]** a full dash skims a dry-spell stream and cannot clear a swollen one | `w01` |
| Ford | new | shallows: walkable in a dry spell, a stream while it rains | `w02` |
| Log crossing | new | a bridge over a stream. In the rain it floats to its next resting place | `w03` |
| Hollow log | new | **[default]** a tunnel: in one end unseen, out the other. **[agreed]** something comes out of some of them now and again: the spider | `w09` |

Dropped from the first sheets, do not build: sun patches and the light-and-shade idea, the heliconia as a tile of its
own (it stays as scenery, and as the viper's perch), the caiman, the sloth, the harpy eagle. **[agreed]**

## 4. Creatures

Draw them from above and move them as jointed paper puppets (`src/puppet.ts`), as you did for the birds: a ringed
tail that sways, spider legs that walk.

| Creature | Plays like | Notes |
|---|---|---|
| Coati **[agreed]** | roadrunner (patrol) | Trots a loop, nose down, ringed tail straight up. The tail should show above ferns so it can be tracked from cover |
| Eyelash viper **[agreed]** | sentry | Coiled on a pink heliconia, head sweeping. Gold on pink |
| Bird-eating spider **[agreed]** | scorpion (trap) | Lives in some hollow logs. Now and again it creeps out, feels about, and backs in. Legs at the rim are the tell. **[default]** it roams a couple of tiles from its log and no further; a Ghost Egg walks past it |
| The bird | hawk or owl | **[open]** No harpy, and no replacement chosen. Leave it out of the first build, but keep the flyer code working for this level so a bird is a drawing and a route away. Two suggestions of mine on the sheet, not agreed: a toucan, a potoo |
| Jewel beetle **[agreed]** | beetle | Refills the dash. Matters more here because a dash is a way over water |
| Leafcutter ants, morpho **[agreed]** | butterfly (ambient) | A file of ants under leaf sails crossing the path; a morpho that drifts toward secrets |

## 5. The rain

A timetable, not dice, so it can be learned and tested. **[default]** numbers, to be tuned by playing:

1. **Dry**, about 75 seconds.
2. **Warning**, about 6 seconds: thunder, the picture dims, the first drops, the logs rock.
3. **Rain**, about 40 seconds: every stream is a tile wider each side, fords are under water, each log has floated to
   its next resting place, puddles and splash rings, hunters see less far.
4. **Easing**, about 6 seconds: the water draws back. Logs stay where they landed until the next rain.

- Each log has two or three resting places, drawn in Tiled, and visits them in order.
- Nobody dies of water. **[default]** Lizzie caught on a ford as it floods is washed onto the bank she came from,
  keeping her eggs. Lizzie standing on a log when it lifts rides it to its next resting place.
- The start area stays out of it, so the first minute teaches roots, ferns and a nest before any water.
- Put the timings in the map's properties, beside `par_seconds`.
- The map checker (`npm run level`) should prove every nest can be reached and the way out needs no power egg, in
  each arrangement of the logs.

## 6. The map

Five areas **[default, from the Look sheet]**, about the size of the desert map (56 × 34) or a little larger:

| Area | What it teaches |
|---|---|
| Buttress Hall | The start. Roots as walls, ferns, a first nest. No water |
| Pebble Fords | Fords, and the first rain |
| Blackwater Creek | Wide water, log crossings that move |
| Heliconia Thicket | Vipers on guard, thorn vines to burn through |
| Firefly Hollow | Dusk. Hollow logs, spiders, glowing fungi. The way out is under the oldest tree |

**The canopy.** Joe passed on Claire's idea to you directly: a hollowed-out tree you go into, and up into a canopy
section. It is not on the sheets. Treat it as a second step once the forest floor plays well. **[default]** if it is
built: branch walkways over a drop, and falling off puts Lizzie back on the floor beneath, unharmed. It is also the
one place with open sky, which would make it the natural home for the bird once one is chosen. How it should look
is written up in `.shots/concepts/rainforest-v2/canopy-style-guide.md`, with pictures and stand-in pieces beside
it. **[agreed]** On 2026-11-22 Joe answered "Yes, as proposed" to "Are you and Claire happy for the canopy to be
built as proposed?". The guide's last section lists what that settles (the golden egg lives up there; the coati
stops at the door; the canopy does not wait for the bird). The art in it is still stand-ins.

**Not in this build [open]:** the Hop Egg (a leap over a root wall or a stream). It is only an idea on the sheet.

## 7. More than one level

Today the game loads one map at start-up (`?level=`, `desert` by default), every texture comes from one folder, and
the best run is kept under the map's title. For a second level:

- **A list of levels** the game reads: for each, an id, its name, its map file, its art set, its moods and tune, a
  picture for the level select, and whether it is ready.
- **Art sets by level**, with the same file names wherever a piece is a re-skin (`tuft_1`, `nest_egg_2`, `scrub`), so
  a re-skin needs no code.
- **Change level without reloading the page.** A reload drops full screen on a phone and silences the sound until the
  next tap.
- **Records per level**, keyed by the level's id, not its title. Carry over the desert's existing best run.
- The desert map is titled "The Long Way Home" in its file; the sheets call the level "Africa". **[open]** which name
  the player sees.

## 8. Splash, title and level select

The order of screens **[default]**:

**Splash → Title → Level select → Level card → Play → End card**

A mock of the title and the level select is on the concept canvas, on the board "Splash, title and level select"
beside the overview. It is a sketch of the layout, not a finished design.

### Splash

- Two seconds, skippable: "Media Jousts presents" on plain dark, then into the title.
- It doubles as the one tap or key press a browser needs before it will play sound, and it tells the game whether the
  player is on keys, a pad or a touch screen before any hint is drawn.
- **The logo.** There is no logo picture in the project. `metadata/icon.png` is DragonRuby's own dragon, not ours.
  What exists is the EGG THIEF paper-letter logo built in `src/hud.ts`, and the app icon of Lizzie with an egg
  (`public/icon-512.png`). **[agreed]** the paper letters are the logo (Joe, 2026-11-21: "Yes, use it"). **[default]**
  leave a slot on the splash for a studio logo picture, used if a file is there. **[open]** whether Joe has a Media
  Jousts logo to drop in.

### Title

- Keep what is there: the paper-letter logo with Lizzie along the top, the creed line, the live level behind it.
- One main action, **Play**, which opens the level select. Smaller: How to play, Sound, Full screen (touch).
- Move the five how-to cards off the title: onto a How to play card, and shown once before a player's first run.
- Take the camera choice off the title. **[agreed]** the chase camera is settled.
- Behind the title, show the level played last (the desert the first time).

### Level select

- One paper postcard per level, in a row on a dark table, in the style of the how-to cards: the level's picture,
  its name in Caroni, one line about it, a strip of its colours, and the player's record (stars, best time, eggs
  home, the golden egg if found).
- The chosen card lifts and straightens; the others sit a little crooked. Choosing a card shows that level, live and
  dimmed, behind the table.
- **[default]** Africa is open. The rainforest opens once the player has got home from Africa one time, with any
  score. A locked card shows its picture dimmed with one line saying how to open it. `?unlock=1` opens everything
  for testing.
- **[default]** Back Gardens and British Coast appear as two face-down "more maps on the way" cards. One flag in the
  list of levels hides them. **[open]** whether Joe wants them shown at all.
- Keys: left and right to choose, Space or Enter to play, Esc back. Pad: d-pad or left stick, ✕ to play, ○ back.
  Touch: tap a card to choose it, tap again or tap Play to start; the row scrolls sideways on a phone with the chosen
  card in the middle. Everything must fit a phone on its side (844 × 390).

### Level card, end card, pause

- After choosing: a short card with the level's name, its one new idea in a sentence ("When it rains, the crossings
  move"), the time to beat and the player's best. Then play.
- End card: add **Next level** when there is one and it is open, and **Level select**.
- Pause card: add **Level select**.

## 9. A suggested order

1. The list of levels, art sets, changing level in place, records per level. Proof: a "rainforest" that is the desert
   map wearing the recoloured floor, ferns, nests and eggs.
2. Splash, title changes, level select, level card, the end and pause additions.
3. Water: stream, ford, log crossing, then the rain timetable.
4. Creatures: coati, viper, spider and its hollow log. Beetle, ants and morpho as re-skins.
5. The real map, its moods and tune, the checker, and scenarios for it.
6. Later: the canopy; the bird, once chosen.

## 10. What done looks like

- Both levels can be finished by the bot (`tools/scenarios/bot.mjs`) from the level select, without a page reload
  between them.
- A scenario plays through a whole rain: ford crossed dry, ford shut in the rain, a log in each resting place,
  Lizzie washed back unharmed.
- A scenario shows the spider's tell, its walk out and back, and a Ghost Egg passing it.
- The `pad` and `touch` scenarios reach every level and every button on the new screens, and every new card fits the
  phone and tablet sizes those scenarios already use.
- The desert plays exactly as before, and its best run is still there.

## 11. Questions for Joe and Claire

1. The bird: which one? (The canopy does not wait for it: see the canopy paragraph in section 6.)
2. Should the rainforest be locked until Africa has been finished once, or open from the start?
3. Show Back Gardens and British Coast as "on the way" cards, or hide them until they exist?
4. "Africa" or "The Long Way Home" on the level card?
5. Is there a Media Jousts logo for the splash?
6. Riding a log when the rain lifts it: fun, or confusing?
