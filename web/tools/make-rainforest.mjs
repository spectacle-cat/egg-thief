// Writes public/levels/rainforest.tmj: the second level, as a Tiled map (JSON, open it in Tiled 1.10+).
// Like make-level.mjs (the desert), the map is drawn below as grids of letters, one block per area. Re-running
// this overwrites the map, so use the letters or Tiled, not both.
//
//   B buttress root (a wall)       I giant trunk (tall: blocks the view)      K rotten stump: a Thunder Egg smashes it
//   T thorn vines: a Chili Egg burns them (and the fire spreads)
//   C fern (cover: hides a lizard sitting under it)       w elephant ears (cover: hides a lizard even on the run)
//   1 2 3 a nest with one egg      N a clutch of three    G the golden egg (one, hidden)      * a jewel beetle
//   t g c r a power egg's nest: Thunder, Ghost, Chili, Rattle
//   S the burrow the lizard starts in      H a burrow (bank eggs, checkpoint)      F the way out
//   Y heliconia (a viper's perch)  A bromeliad            x glowing fungi (only to look at)
//   ~ stream: deep water. Nobody walks it; a dash skims one tile of it
//   = ford: shallows. Walkable in a dry spell, a stream while it rains
//   . open ground
//   J the foot of the Hollow Giant (three in a row)      D its door, on the tile in front of the middle one
// The canopy has letters of its own (see CANOPY below).
// Open ground touching water is the bank: it is pebbly, and it goes under when it rains (the generator works that
// out, so every stream is one tile wider each side in the rain, as the design says).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

// The start. Roots for walls, ferns to sit under, a first nest, one coati. No water: nothing here changes in the rain.
const HALL = [
  'BBBBBBBBBBBBBBBBBB',
  'BB..C....I....C.BB',
  'B..1....BBB......B',
  'B.C.....B.....C..B',
  'B....C..B..2.....B',
  'BBB.....BB....C...',
  'B.....C.......BB..',
  'B..S.......C..B...',
  'B.....I.........C.',
  'B.C.......*....BBB',
  'B....C..BKKB.....B',
  'BBB.....B..B..C..B',
  'B..t..C.B.NB.....B',
  'B.C.....BBBB..C..B',
  'B....C.......3...B',
  'BBBBB....BBBBBBBBB',
];
// A brook with two fords and one log. The first rain is met here: the fords go under and the log moves along.
const FORDS = [
  'BBBBB....BBBBBBBBB',
  'B...C......C.....B',
  'B.C......*....C..B',
  'B.....C..........B',
  'B..........C......',
  'B.C...............',
  'B~~~=~~~~~~~~=~~~~',
  'B....C.......C...B',
  'B.1.........2....B',
  'B....C..H......C.B',
  'B.C..........C...B',
  'B.......C.....*..B',
  'BBBB..BBBBB..BBBBB',
  'B..C.....B....C..B',
  'B....N...B..g....B',
  'B.C......K....C..B',
  'B....C...B.......B',
  'BBBBBBBBBBBBBBBBBB',
];
// The river: too wide to dash. Two logs are the only ways over, and each rain floats them somewhere else.
const CREEK = [
  'BBBBBBBB~~~BBBBBBBBB',
  'B..C....~~~...C...BB',
  'B....1..~~~.......CB',
  'BB..C...~~~..C.....B',
  'B.......~~~.........',
  '....C...~~~....*....',
  '........~~~.C.......',
  '...C....~~~.....C..B',
  '......*.~~~........B',
  'BB......~~~...2....B',
  'B..C....~~~.C......B',
  'B.....C.~~~~.....C.B',
  'B..3.....~~~.......B',
  'B.C......~~~...C...B',
  'B......C.~~~.......B',
  'B........~~~.......B',
  'BJJJ.....~~~..C..BBB',
  'B.D......~~~.....BBB',
  'B....C.*.~~~.......B',
  'B........~~~..C.....',
  '.....C...~~~........',
  '.........~~~....C...',
  '~~~~=~~~~~~~.......B',
  'B.......~~~~..C....B',
  'B..C....~~~........B',
  'B....N..~~~....1...B',
  'B.C.....~~~.C......B',
  'B.......~~~........B',
  'BB...C..~~~....C..BB',
  'B.......~~~........B',
  'B..r....~~~..C.....B',
  'B....C..~~~........B',
  'B.......~~~....*...B',
  'BBBBBBBB~~~BBBBBBBBB',
];
// Vipers on their flowers and thorn vines to burn through. A Chili Egg at the door; a clutch behind the hedge.
const THICKET = [
  'BBBBBBBBBBBBBBBBBB',
  'B..C....T....C..NB',
  'B.....Y.T..3.....B',
  'BB..C...T.......CB',
  '....c...TTTTTT...B',
  '......C......T.Y.B',
  '...C.........T...B',
  'B.....*...C..TTTTB',
  'B.C..............B',
  'B.......C...C....B',
  'B.1.......Y......B',
  'B....C....TTTTTTTB',
  'B.C.......T......B',
  'B......C..T..N...B',
  'B...Y.....T....C.B',
  'B.C.......T......B',
  'BBBBBBB..BBBBBBBBB',
];
// Dusk. Root walls with hollow logs through them, and a spider at home in one. The way out is under the oldest tree.
const HOLLOW = [
  'BBBBBBB..BBBBBBBBB',
  'B..C.......x..C..B',
  '......C..........B',
  '...x.......C...2.B',
  '....C............B',
  'B........x.....C.B',
  'BBBBBB.BBBBBBB.BBB',
  'B..C......B......B',
  'B.....1...B..x.C.B',
  'B.x..............B',
  'B....C....B...N..B',
  'B.........B.C....B',
  'BBBB.BBBBBBBBBBBBB',
  'B..x...C.....x.I.B',
  'B.C......H.....F.B',
  'B.....x.....C....B',
  'BBBBBBBBBBBBBBBBBB',
];

// Where each block sits (its top-left tile), and the area it becomes: a name for the banner and a mood for the light.
const BLOCKS = [
  { rows: HALL, x: 0, y: 0, name: 'Buttress Hall', mood: 'hall' },
  { rows: FORDS, x: 0, y: 16, name: 'Pebble Fords', mood: 'fords', pebbles: true },
  { rows: CREEK, x: 18, y: 0, name: 'Blackwater Creek', mood: 'creek' },
  { rows: THICKET, x: 38, y: 0, name: 'Heliconia Thicket', mood: 'heliconia' },
  { rows: HOLLOW, x: 38, y: 17, name: 'Firefly Hollow', mood: 'firefly' },
];

// --- The canopy (a proposal, built to try it out: see docs/canopy notes in the README) ------------------------
// A second deck above the creek, reached through the Hollow Giant's door. It is drawn in a far corner of the same
// map (CANOPY_X columns along), and lies over the floor so that its knothole (O) is straight above the door (D):
// whoever steps off a mat or a bough comes down on the floor underneath.
//   m leaf mat      - | a bough (east-west, north-south)      v ^ < > a fork: a T whose stem points that way
//   n s e w a bough's tip, pointing that way (a dead end)     (space) a gap: nothing there
//   O the knothole: the way back down      I a giant's trunk going on up (a wall)      A bromeliad (a viper's perch)
//   C a spray of leaves (cover)      1 2 3 N nests      G the golden egg      * a jewel beetle
// A nest in the cup of a fork, or a bromeliad on a bough, is listed in ON_BOUGHS (the letter is taken by the bough).
const CANOPY = [
  '                                ',
  '                                ',
  '                                ',
  '                                ',
  '                                ',
  '                                ',
  '                                ',
  '                                ',
  '                         mmmm   ',
  '                        mmmCmm  ',
  '                        mmCGmm  ',
  '                        m2mmAm  ',
  '              mmImm      mmmm   ',
  '             mmmCmmm      |     ',
  '   mmmm      mmmmmmm      |     ',
  '  mmCmmm     mmmmm*m------<     ',
  '  mmmmmm-----mmCmmmm      |     ',
  '  mOmmmm-----mmmmmmm      |     ',
  '  mmmmmm      mmmmm       s     ',
  '    |          |                ',
  '    |          |                ',
  '    |          |                ',
  '    >----------^--e             ',
  '    |                           ',
  '    s                           ',
  '                                ',
  '                                ',
  '                                ',
  '                                ',
  '                                ',
  '                                ',
  '                                ',
  '                                ',
  '                                ',
];
// Columns: the forest floor is the first 56; the canopy's corner starts at CANOPY_X; nobody goes in between.
const CANOPY_X = 100;
// Things standing on boughs, in the canopy's own columns and rows: [column, row, what].
const ON_BOUGHS = [
  [4, 22, 'nest_egg_2'], [15, 22, 'nest_egg_3'], [26, 15, 'nest_egg_1'],
  [26, 18, 'bromeliad'],
];
// Vipers up top, each beside a bromeliad (canopy columns and rows).
const CANOPY_VIPERS = [
  { name: 'Fork viper', at: [26, 17], facing: 20, sweep: 45 },
  { name: 'Crown viper', at: [28, 12], facing: 285, sweep: 50 },
];
const CANOPY_ANTS = [
  [[8.2, 16.5], [12.8, 16.4]],
  [[5.2, 22.5], [14.8, 22.4]],
];

// Coatis walk these loops, in tiles. None of them crosses water.
const ROUTES = [
  { type: 'coati', name: 'Hall coati', pts: [[10, 6], [13, 8], [13, 13], [6, 14], [6, 10]] },
  { type: 'coati', name: 'Fords coati', pts: [[3, 27], [11, 27], [15, 24], [6, 24]], phase: 0.3 },
  { type: 'coati', name: 'West bank coati', pts: [[20, 2], [24, 6], [23, 13], [20, 10]] },
  { type: 'coati', name: 'East bank coati', pts: [[32, 3], [35, 8], [34, 15], [31, 12]], phase: 0.5 },
  { type: 'coati', name: 'Low bank coati', pts: [[31, 24], [36, 27], [35, 31], [31, 29]] },
  { type: 'coati', name: 'Thicket coati', pts: [[42, 8], [52, 8], [52, 10], [44, 12]], phase: 0.4 },
  { type: 'coati', name: 'Hollow coati', pts: [[40, 18], [50, 19], [50, 22], [41, 22]] },
  { type: 'coati', name: 'Old tree coati', pts: [[40, 32], [49, 30], [52, 32]], phase: 0.6 },
];
// Vipers: each coiled beside its heliconia. facing in degrees (0 north, 90 east, 180 south, 270 west).
const VIPERS = [
  { name: 'Door viper', at: [45, 2], facing: 190, sweep: 50 },
  { name: 'Lane viper', at: [48, 9], facing: 270, sweep: 55 },
  { name: 'Gate viper', at: [43, 14], facing: 95, sweep: 45 },
];
// Fallen logs: where each one rests, in order (a rain floats it to the next). The middle of the log, in tiles;
// across: which way it lies ('ew' or 'ns'); length in tiles.
const LOGS = [
  { name: 'Brook log', across: 'ns', length: 5, spots: [[8, 22], [15, 22]] },
  { name: 'Upper log', across: 'ew', length: 7, spots: [[27, 6], [28, 14]] },
  { name: 'Lower log', across: 'ew', length: 7, spots: [[27, 27], [27, 31]] },
];
// Hollow logs: from one mouth to the other, in tiles. A spider lives just inside the first mouth of some.
const TUNNELS = [
  { name: 'Root log', from: [52, 21], to: [52, 25], spider: false },
  { name: 'Spider log', from: [46, 26], to: [50, 26], spider: true },
];
// Files of leafcutter ants, only to look at: each walks its line from end to end.
const ANTS = [
  [[25.3, 20.5], [22.6, 19.7], [21.0, 18.6], [20.5, 17.8]], // to the Hollow Giant's door
  [[1.6, 6.3], [7, 6.7], [13.4, 6.2]],
  [[41, 8.3], [47, 8.7], [54.4, 8.2]],
  [[39, 32.4], [46, 32.8], [54.4, 32.3]],
];
const TITLE = 'When It Rains', PAR = 720, DRY = 75, RAIN = 40;

// ---------------------------------------------------------------------------------------------------------

const W = 56, H = 34, TILE = 200;
const grid = Array.from({ length: H }, () => Array(W).fill(null));
const pebbles = Array.from({ length: H }, () => Array(W).fill(false));
for (const b of BLOCKS) {
  const w = b.rows[0].length;
  b.w = w; b.h = b.rows.length;
  b.rows.forEach((row, j) => {
    if (row.length !== w) throw new Error(`${b.name}: row ${j} is ${row.length} wide, not ${w}: "${row}"`);
    [...row].forEach((ch, i) => {
      const x = b.x + i, y = b.y + j;
      if (x >= W || y >= H) throw new Error(`${b.name} runs off the map at ${x},${y}`);
      if (grid[y][x] !== null) throw new Error(`${b.name} overlaps another block at ${x},${y}`);
      grid[y][x] = ch;
      pebbles[y][x] = !!b.pebbles;
    });
  });
}
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (grid[y][x] === null) throw new Error(`no block covers ${x},${y}`);

// What each letter puts on the "things" layer. The game knows a tile by its image's file name, nothing else.
const THING = {
  B: 'buttress', K: 'stump', T: 'vines', I: 'trunk',
  1: 'nest_egg_1', 2: 'nest_egg_2', 3: 'nest_egg_3', N: 'nest_clutch',
  t: 'nest_thunder', g: 'nest_ghost', c: 'nest_chili', r: 'nest_rattle', G: 'nest_gold', '*': 'beetle',
  S: 'burrow_start', H: 'burrow', F: 'burrow_exit',
  Y: 'heliconia', A: 'bromeliad', x: 'fungi',
  J: 'giant', D: 'hollow_door',
};
// The canopy's letters: what lies on the "ground" layer, and what stands on the "things" layer.
const DECK = { ' ': 'gap', m: 'mat', '-': 'bough_ew', '|': 'bough_ns', v: 'fork_s', '^': 'fork_n', '<': 'fork_w', '>': 'fork_e', n: 'tip_n', s: 'tip_s', e: 'tip_e', w: 'tip_w' };
const UP_THING = { O: 'knothole', I: 'trunk', A: 'bromeliad', 1: 'nest_egg_1', 2: 'nest_egg_2', 3: 'nest_egg_3', N: 'nest_clutch', G: 'nest_gold', '*': 'beetle' };
const WALLS = 'BIYAJ'; // never passable
const NAMES = ['floor', 'pebbles', 'water', 'flood', 'ford', 'fern_1', 'fern_2', 'fern_3', 'fern_4', 'ears', ...new Set([...Object.values(THING), ...Object.values(DECK), 'knothole', 'beyond'])];
const sprites = join(import.meta.dirname, '..', 'public', 'sprites', 'rainforest');
const TILES = NAMES.map((name) => {
  let png;
  try { png = readFileSync(join(sprites, name + '.png')); } catch { throw new Error(`no picture for the tile "${name}": public/sprites/rainforest/${name}.png is missing (bash tools/art-rainforest.sh makes them)`); }
  return [name, png.readUInt32BE(16), png.readUInt32BE(20)];
});
const gid = (name) => TILES.findIndex((t) => t[0] === name) + 1;
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return (h ^ (h >>> 16)) >>> 0; };
const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 'B' : grid[y][x]);
const isWater = (x, y) => '~='.includes(at(x, y));

// The bank: open ground touching water (corners count). It goes under in the rain.
const bank = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => {
  if (grid[y][x] !== '.') return false;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (isWater(x + dx, y + dy)) return true;
  return false;
}));

const ground = [], things = [], cover = [];
let start = null, eggs = 0;
const count = {};
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const ch = grid[y][x];
  if (!'.Cw~='.includes(ch) && !THING[ch]) throw new Error(`unknown letter "${ch}" at ${x},${y}`);
  // Pebbles lie along every bank, a tile or so back from the water.
  let near = false;
  for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) if (isWater(x + dx, y + dy) && hash(x + dx * 3, y + dy * 5) % 4) { near = true; break; }
  ground.push(gid(ch === '~' ? 'water' : ch === '=' ? 'ford' : bank[y][x] ? 'flood' : pebbles[y][x] || near ? 'pebbles' : 'floor'));
  things.push(THING[ch] ? gid(THING[ch]) : 0);
  cover.push(ch === 'C' ? gid('fern_' + (1 + (hash(x, y) % 4))) : ch === 'w' ? gid('ears') : 0);
  count[ch] = (count[ch] ?? 0) + 1;
  if (ch === 'S') start = [x, y];
  if ('123'.includes(ch)) eggs += 1;
  if (ch === 'N') eggs += 3;
}
if (!start) throw new Error('no start burrow (S)');

// --- the canopy's corner of the map: the same three layers, WW columns wide in all -------------------------
const CW = CANOPY[0].length, WW = CANOPY_X + CW;
if (CANOPY.length !== H) throw new Error(`the canopy is ${CANOPY.length} rows, the map ${H}`);
CANOPY.forEach((row, j) => { if (row.length !== CW) throw new Error(`canopy row ${j} is ${row.length} wide, not ${CW}: "${row}"`); });
const upAt = (u, v) => (u < 0 || v < 0 || u >= CW || v >= H ? ' ' : CANOPY[v][u]);
const onBough = new Map(ON_BOUGHS.map(([u, v, what]) => [`${u},${v}`, what]));
const upGround = (u, v) => { const ch = upAt(u, v); return DECK[ch] ?? 'mat'; };
const upThing = (u, v) => onBough.get(`${u},${v}`) ?? UP_THING[upAt(u, v)] ?? null;
const upWalk = (u, v) => upAt(u, v) !== ' ' && !['trunk', 'bromeliad'].includes(upThing(u, v));
let knot = null, door = null, upEggs = 0, upNests = 0, upGold = 0;
for (let v = 0; v < H; v++) for (let u = 0; u < CW; u++) {
  const ch = upAt(u, v);
  if (!DECK[ch] && !UP_THING[ch] && ch !== 'C') throw new Error(`unknown letter "${ch}" in the canopy at ${u},${v}`);
  if (ch === 'O') { if (knot) throw new Error('more than one knothole (O)'); knot = [u, v]; }
  const t = upThing(u, v);
  if (t?.startsWith('nest_egg')) { upEggs += 1; upNests += 1; }
  if (t === 'nest_clutch') { upEggs += 3; upNests += 1; }
  if (t === 'nest_gold') upGold += 1;
}
for (const [u, v, what] of ON_BOUGHS) if (!DECK[upAt(u, v)] || upAt(u, v) === ' ' || upAt(u, v) === 'm') throw new Error(`${what} at ${u},${v} is not on a bough`);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (grid[y][x] === 'D') { if (door) throw new Error('more than one door (D)'); door = [x, y]; }
if (!knot || !door) throw new Error('the canopy needs a door (D) on the floor and a knothole (O) up top');
if (knot[1] !== door[1]) throw new Error(`the knothole is on row ${knot[1]} and the door on row ${door[1]}: the canopy lies straight over the floor, so they share a row`);
for (const dx of [-1, 0, 1]) if (at(door[0] + dx, door[1] - 1) !== 'J') throw new Error('the door (D) wants the foot of the tree (JJJ) on the row behind it');
eggs += upEggs;
if ((count.G ?? 0) + upGold > 1) throw new Error('more than one golden egg (G)');
// Straight below a spot in the canopy.
const SHIFT = CANOPY_X + knot[0] - door[0];
const below = (u, v) => [u + CANOPY_X - SHIFT, v];

// --- the checker ---------------------------------------------------------------------------------------
// Can the lizard get everywhere it needs to, in a dry spell, wherever the logs have got to? Flood out from the
// start. Deep water stops it unless a log lies there or it is one tile wide (a dash skims that). A hollow log is
// a wall with a way through. A wall of stumps or vines opens once the egg that opens it has been reached.
const body = new Set(), doors = new Map();
for (const t of TUNNELS) {
  const [ax, ay] = t.from, [bx, by] = t.to, n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
  if (ax !== bx && ay !== by) throw new Error(`${t.name}: a hollow log lies along a row or a column`);
  for (let i = 1; i < n; i++) body.add(`${ax + ((bx - ax) * i) / n},${ay + ((by - ay) * i) / n}`);
  doors.set(`${ax},${ay}`, [bx, by]); doors.set(`${bx},${by}`, [ax, ay]);
}
const spanOf = (log, k) => {
  const [cx, cy] = log.spots[k % log.spots.length], half = (log.length - 1) / 2, tiles = [];
  for (let i = -Math.floor(half); i <= Math.ceil(half); i++) tiles.push(log.across === 'ns' ? [cx, cy + i] : [cx + i, cy]);
  return tiles;
};
function flood(opens, k) {
  const bridged = new Set(LOGS.flatMap((l) => spanOf(l, k).map(([x, y]) => `${x},${y}`)));
  const deep = (x, y) => at(x, y) === '~' && !bridged.has(`${x},${y}`);
  const pass = (x, y) => { const ch = at(x, y); return !WALLS.includes(ch) && !body.has(`${x},${y}`) && !deep(x, y) && (ch !== 'K' || opens.includes('K')) && (ch !== 'T' || opens.includes('T')); };
  const seen = Array.from({ length: H }, () => Array(W).fill(false));
  const todo = [start];
  seen[start[1]][start[0]] = true;
  const visit = (x, y) => { if (x >= 0 && y >= 0 && x < W && y < H && !seen[y][x] && pass(x, y)) { seen[y][x] = true; todo.push([x, y]); } };
  while (todo.length) {
    const [x, y] = todo.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      visit(x + dx, y + dy);
      if (deep(x + dx, y + dy)) visit(x + dx * 2, y + dy * 2); // a dash over one tile of water
    }
    const door = doors.get(`${x},${y}`);
    if (door) visit(...door);
  }
  return seen;
}
const arrangements = Math.max(1, ...LOGS.map((l) => l.spots.length)); // every log has one or two or three places; this many rains shows them all
const problems = [], gated = [];
let lastSeen = null;
for (let k = 0; k < Math.max(arrangements, 6); k++) {
  const free = flood('', k);
  let opens = '', seen = free;
  for (;;) {
    let more = opens;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (seen[y][x]) {
      if (grid[y][x] === 't' && !more.includes('K')) more += 'K';
      if (grid[y][x] === 'c' && !more.includes('T')) more += 'T';
    }
    if (more === opens) break;
    opens = more; seen = flood(opens, k);
  }
  const onlyThunder = flood('K', k), onlyChili = flood('T', k);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ch = grid[y][x];
    if (!'123NGtgcrSHF*'.includes(ch)) continue;
    if (!seen[y][x]) problems.push(`rain ${k}: the ${THING[ch]} at ${x},${y} cannot be reached`);
    else if (ch === 'F' && !free[y][x]) problems.push(`rain ${k}: the way out at ${x},${y} needs a power egg`);
    else if (k === 0 && !free[y][x] && '123NG'.includes(ch)) gated.push(`${THING[ch]} at ${x},${y}: ${onlyThunder[y][x] ? 'Thunder' : onlyChili[y][x] ? 'Chili' : 'Thunder + Chili'}`);
  }
  for (const r of ROUTES) for (const [x, y] of r.pts) if (!seen[y]?.[x] || 'KT'.includes(at(x, y))) problems.push(`rain ${k}: ${r.name}: its point ${x},${y} is in a wall or cut off`);
  lastSeen = seen;
}
// Things that must stay dry, and logs that must reach from dry ground to dry ground even in the rain.
const wetInRain = (x, y) => isWater(x, y) || !!bank[y]?.[x];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const ch = grid[y][x];
  if (!'123NGtgcrSHF'.includes(ch)) continue;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (isWater(x + dx, y + dy)) problems.push(`the ${THING[ch]} at ${x},${y} is at the water's edge: move it a tile back`);
}
for (const r of ROUTES) for (const [x, y] of r.pts) if (wetInRain(x, y)) problems.push(`${r.name}: its point ${x},${y} goes under in the rain`);
for (const v of VIPERS) {
  const [x, y] = v.at;
  if (at(x, y) !== '.' || wetInRain(x, y)) problems.push(`${v.name}: its post ${x},${y} is not open, dry ground`);
  if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(x + dx, y + dy) === 'Y')) problems.push(`${v.name}: no heliconia (Y) beside its post ${x},${y}`);
}
for (const l of LOGS) l.spots.forEach((_, k) => {
  const tiles = spanOf(l, k), ends = [tiles[0], tiles[tiles.length - 1]];
  for (const [x, y] of tiles) if (WALLS.includes(at(x, y)) || 'KT'.includes(at(x, y))) problems.push(`${l.name}: resting place ${k + 1} lies on a ${THING[at(x, y)]} at ${x},${y}`);
  for (const [x, y] of ends) if (wetInRain(x, y)) problems.push(`${l.name}: resting place ${k + 1} does not reach dry ground at ${x},${y} when it rains`);
  if (!tiles.some(([x, y]) => at(x, y) === '~')) problems.push(`${l.name}: resting place ${k + 1} is not over a stream`);
});
for (const t of TUNNELS) for (const [x, y] of [t.from, t.to]) if (at(x, y) !== '.' || wetInRain(x, y)) problems.push(`${t.name}: its mouth ${x},${y} is not open, dry ground`);
for (const key of body) { const [x, y] = key.split(',').map(Number); if (!'.B'.includes(at(x, y))) problems.push(`a hollow log lies on a ${THING[at(x, y)] ?? at(x, y)} at ${x},${y}`); }

// Up top: everything is reached from the knothole along mats and boughs (the rain changes nothing there), the door
// must be reachable without a power egg, and whoever steps off must come down somewhere they can walk away from.
{
  const seenUp = Array.from({ length: H }, () => Array(CW).fill(false));
  const todo = [knot];
  seenUp[knot[1]][knot[0]] = true;
  while (todo.length) {
    const [u, v] = todo.pop();
    for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = u + du, b = v + dv;
      if (a >= 0 && b >= 0 && a < CW && b < H && !seenUp[b][a] && upWalk(a, b)) { seenUp[b][a] = true; todo.push([a, b]); }
    }
  }
  if (!flood('', 0)[door[1]][door[0]]) problems.push('the door of the hollow tree cannot be reached without a power egg');
  const reach = flood('', 0);
  for (let v = 0; v < H; v++) for (let u = 0; u < CW; u++) {
    const t = upThing(u, v);
    if (t && /^nest_|^beetle$/.test(t) && !seenUp[v][u]) problems.push(`canopy: the ${t} at ${u},${v} cannot be reached`);
    if (upWalk(u, v) && !seenUp[v][u]) problems.push(`canopy: the ${upGround(u, v)} at ${u},${v} joins nothing`);
    // The map's edge repeats for ever beyond it, so the canopy's own edge has to be all gap.
    if (upAt(u, v) !== ' ' && (u === 0 || v === 0 || u === CW - 1 || v === H - 1)) problems.push(`canopy: ${u},${v} is on the very edge of the map: leave a gap there`);
    // A gap less than two tiles across reads as dirt on the floor, not as a drop.
    if (upAt(u, v) === ' ' && ((upAt(u - 1, v) !== ' ' && upAt(u + 1, v) !== ' ') || (upAt(u, v - 1) !== ' ' && upAt(u, v + 1) !== ' '))) problems.push(`canopy: the gap at ${u},${v} is only one tile across`);
    if (upAt(u, v) !== ' ') {
      const [fx, fy] = below(u, v);
      if (fx < 0 || fx >= W) problems.push(`canopy: ${u},${v} is not over the forest floor`);
    }
  }
  for (const v of CANOPY_VIPERS) {
    const [u, w] = v.at;
    if (!upWalk(u, w) || upThing(u, w)) problems.push(`${v.name}: its post ${u},${w} is not open mat or bough`);
    if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([du, dv]) => upThing(u + du, w + dv) === 'bromeliad')) problems.push(`${v.name}: no bromeliad beside its post ${u},${w}`);
  }
  // Where a fall lands: the nearest open, dry ground to straight below. Say so if that is somewhere shut in.
  let shut = 0;
  for (let v = 0; v < H; v++) for (let u = 0; u < CW; u++) {
    if (upAt(u, v) !== ' ' || ![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([du, dv]) => upAt(u + du, v + dv) !== ' ')) continue;
    const [fx, fy] = below(u, v);
    let best = Infinity, land = null;
    for (let y = fy - 6; y <= fy + 6; y++) for (let x = fx - 6; x <= fx + 6; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H || !'.Cw*x'.includes(grid[y][x]) || bank[y][x]) continue;
      const d = Math.hypot(x - fx, y - fy);
      if (d < best) { best = d; land = [x, y]; }
    }
    if (!land) problems.push(`canopy: nowhere to land under ${u},${v}`);
    else if (!reach[land[1]][land[0]] && !flood('KT', 0)[land[1]][land[0]]) shut++;
  }
  if (shut) console.log(`canopy: ${shut} edges drop into places shut off from the start (the game moves those landings to open ground)`);
}

const n = (letters) => [...letters].reduce((sum, ch) => sum + (count[ch] ?? 0), 0);
console.log(`${W} x ${H} tiles of floor (the map is ${WW} wide with the canopy's corner), ${n('123N') + upNests} nests with ${eggs} eggs (${upNests} of them, with ${upEggs}, up top), ${n('tgcr')} power nests, ${n('*')} beetles, ${n('~')} tiles of stream, ${n('=')} fords, ${bank.flat().filter(Boolean).length} of bank`);
console.log(`${ROUTES.length} coatis, ${VIPERS.length + CANOPY_VIPERS.length} vipers (${CANOPY_VIPERS.length} up top), ${LOGS.length} logs, ${TUNNELS.length} hollow logs (${TUNNELS.filter((t) => t.spider).length} with a spider)`);
if (gated.length) console.log('behind a wall:\n  ' + gated.join('\n  '));
if (process.argv.includes('--print')) for (let y = 0; y < H; y++) console.log(grid[y].map((ch, x) => (bank[y][x] ? ',' : !lastSeen[y][x] && ch === '.' ? '?' : ch)).join(''));
if (process.argv.includes('--print')) { console.log('\nthe canopy:'); for (let v = 0; v < H; v++) console.log(CANOPY[v].replace(/ /g, '·')); }
if (problems.length) { console.error([...new Set(problems)].join('\n')); process.exit(1); }

// --- the map -------------------------------------------------------------------------------------------
let nextObject = 1;
const px = (t) => (t + 0.5) * TILE;
const obj = (name, type, x, y, more) => ({ id: nextObject++, name, type, x, y, width: 0, height: 0, rotation: 0, visible: true, ...more });
const line = (pts) => pts.map(([x, y]) => ({ x: (x - pts[0][0]) * TILE, y: (y - pts[0][1]) * TILE }));
const routeObjects = ROUTES.map((r) => {
  const props = [];
  if (r.phase) props.push({ name: 'phase', type: 'float', value: r.phase });
  if (r.speed) props.push({ name: 'speed', type: 'float', value: r.speed });
  return obj(r.name, r.type, px(r.pts[0][0]), px(r.pts[0][1]), { [r.open ? 'polyline' : 'polygon']: line(r.pts), ...(props.length ? { properties: props } : {}) });
});
const viperObjects = [...VIPERS, ...CANOPY_VIPERS.map((v) => ({ ...v, at: [v.at[0] + CANOPY_X, v.at[1]] }))].map((v) => obj(v.name, 'viper', px(v.at[0]), px(v.at[1]), {
  point: true, properties: [{ name: 'facing', type: 'float', value: v.facing }, { name: 'sweep', type: 'float', value: v.sweep }],
}));
const logObjects = LOGS.map((l) => obj(l.name, 'log', px(l.spots[0][0]), px(l.spots[0][1]), {
  polyline: line(l.spots), properties: [{ name: 'across', type: 'string', value: l.across }, { name: 'length', type: 'int', value: l.length }],
}));
const tunnelObjects = TUNNELS.map((t) => obj(t.name, 'hollow_log', px(t.from[0]), px(t.from[1]), {
  polyline: line([t.from, t.to]), properties: [{ name: 'spider', type: 'bool', value: !!t.spider }],
}));
const antObjects = [...ANTS, ...CANOPY_ANTS.map((pts) => pts.map(([x, y]) => [x + CANOPY_X, y]))].map((pts, i) => obj('Ants ' + (i + 1), 'ants', pts[0][0] * TILE, pts[0][1] * TILE, { polyline: pts.map(([x, y]) => ({ x: (x - pts[0][0]) * TILE, y: (y - pts[0][1]) * TILE })) }));
const zoneObjects = BLOCKS.map((b) => obj(b.name, 'zone', b.x * TILE, b.y * TILE, { width: b.w * TILE, height: b.h * TILE, properties: [{ name: 'mood', type: 'string', value: b.mood }] }));
zoneObjects.push(obj('The Canopy', 'zone', CANOPY_X * TILE, 0, { width: CW * TILE, height: H * TILE, properties: [{ name: 'mood', type: 'string', value: 'canopy' }] }));
const canopyObjects = [obj('The canopy', 'canopy', CANOPY_X * TILE, 0, { width: CW * TILE, height: H * TILE })];
// The three layers, the whole map wide: the floor, then ground nobody walks on, then the canopy's corner.
const wide = (floor, between, up) => {
  const out = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) out.push(floor[y * W + x]);
    for (let x = W; x < CANOPY_X; x++) out.push(between);
    for (let u = 0; u < CW; u++) out.push(up(u, y));
  }
  return out;
};
const groundAll = wide(ground, gid('floor'), (u, v) => gid(upGround(u, v)));
const thingsAll = wide(things, gid('beyond'), (u, v) => (upThing(u, v) ? gid(upThing(u, v)) : 0));
const coverAll = wide(cover, 0, (u, v) => (upAt(u, v) === 'C' ? gid('fern_' + (1 + (hash(u, v) % 4))) : 0));

const tileLayer = (id, name, data) => ({ id, name, type: 'tilelayer', data, width: WW, height: H, x: 0, y: 0, opacity: 1, visible: true });
const objectLayer = (id, name, objects, color) => ({ id, name, type: 'objectgroup', draworder: 'topdown', objects, color, x: 0, y: 0, opacity: 1, visible: true });
const map = {
  type: 'map', version: '1.10', tiledversion: '1.11.2', orientation: 'orthogonal', renderorder: 'right-down',
  compressionlevel: -1, infinite: false, width: WW, height: H, tilewidth: TILE, tileheight: TILE,
  nextlayerid: 11, nextobjectid: nextObject,
  properties: [
    { name: 'dry_seconds', type: 'int', value: DRY },
    { name: 'floor_width', type: 'int', value: W },
    { name: 'par_seconds', type: 'int', value: PAR },
    { name: 'rain_seconds', type: 'int', value: RAIN },
    { name: 'theme', type: 'string', value: 'rainforest' },
    { name: 'title', type: 'string', value: TITLE },
  ],
  layers: [
    tileLayer(1, 'ground', groundAll),
    tileLayer(2, 'things', thingsAll),
    tileLayer(3, 'cover', coverAll),
    objectLayer(4, 'routes', routeObjects, '#ff7a1a'),
    objectLayer(5, 'vipers', viperObjects, '#e0303a'),
    objectLayer(6, 'logs', logObjects, '#c9a36a'),
    objectLayer(7, 'hollow logs', tunnelObjects, '#7a5a3a'),
    objectLayer(8, 'zones', zoneObjects, '#3aa0ff'),
    objectLayer(9, 'ants', antObjects, '#86ddb9'),
    objectLayer(10, 'canopy', canopyObjects, '#d9f5e6'),
  ],
  tilesets: [{
    firstgid: 1, name: 'rainforest', columns: 0, margin: 0, spacing: 0, tilecount: TILES.length,
    tilewidth: Math.max(...TILES.map((t) => t[1])), tileheight: Math.max(...TILES.map((t) => t[2])),
    grid: { orientation: 'orthogonal', width: 1, height: 1 },
    tiles: TILES.map(([name, w, h], id) => ({ id, image: `../sprites/rainforest/${name}.png`, imagewidth: w, imageheight: h })),
  }],
};
const out = join(import.meta.dirname, '..', 'public', 'levels', 'rainforest.tmj');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(map));
console.log('wrote', out);
