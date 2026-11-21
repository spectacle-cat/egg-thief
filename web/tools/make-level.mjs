// Writes public/levels/desert.tmj: the first big level, as a Tiled map (JSON, open it in Tiled 1.10+).
//
// The map is drawn below the way the old DragonRuby levels were (a grid of letters), in seven blocks so each
// area can be read on its own. Once the .tmj exists, Tiled is the editor: paint tiles, drag the birds' routes.
// Re-running this script overwrites the map, so only run it to start again from the letters.
//
//   B boulder      b boulder with a scorpion under it      I rock spire (tall: blocks the view)
//   K cracked rock: a Thunder Egg smashes it               T thorns: a Chili Egg burns them (and the fire spreads)
//   C tuft (cover: hides a lizard sitting under it)        w long grass (cover: hides a lizard even on the run)
//   1 2 3 a nest with one egg (three egg colours)          N a nest with a clutch of three
//   t g c r a power egg's nest: Thunder, Ghost, Chili, Rattle (it grows back after it is used)
//   G the golden egg (one, hidden)                         * a beetle (a snack)
//   S the burrow the lizard starts in      H a burrow (bank eggs, checkpoint)      F the way out
//   Y y o cactus: saguaro, prickly pear, barrel            A agave    D dead tree    x skull    z bones
//   . open ground
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

// Owls overhead, a clutch in the middle, and something golden walled up in the corner.
const ROOST = [
  'BBBBBBBBBBBBBBBBB',
  'BBB..D..C...B.GBB',
  'BB...C......K..BB',
  'B.1.....N...BBBBB',
  'B..C......z..C..B',
  'B......C.....D..B',
  'BB..C......C..3BB',
  'B.g...x...C.....B',
  'B..C........w.*.B',
  'BBBB...BBBBBBBBBB',
];
// Home. A first nest, a meadow of long grass past the roadrunner, and the first Thunder Egg beside a walled-up clutch.
const FLATS = [
  'B...wwC.....C...B',
  'B..Cwww...1..Y..B',
  'B....www..C....C.',
  'B.*..Cwww......C.',
  'B.C...www*..B...B',
  'B......ww....C..B',
  'BB......2.C.....B',
  'B..S.........C..B',
  'B.......C....*.C.',
  'B..C...t......C..',
  'BBKKBB....C.....B',
  'B....B......C..oB',
  'B.N..B...C.....BB',
  'BBBBBB......C...B',
];
// A Chili Egg at the door, and two thorn hedges to burn through. A guard waits behind the second.
const THICKET = [
  'BBBBBBBBB...BBBBB',
  'B..C..C...c.C...B',
  'B.CC....b..CC.*.B',
  'B....C......C.C..',
  'BTTTTTTBBTTTTTTTB',
  'B..3..CB...C.b..B',
  'B.C....B.C..N...B',
  'B...*..T...CC...B',
  'BB..C..B..C...BBB',
  'BBBBBBBBBBBBBBBBB',
];
// A canyon of rooms. A cracked wall is the short way in; a guard holds the lane east; a clutch is walled up north.
const GULCH = [
  'BBBBBBBBBBBBBBBBBBBBB',
  'B..1.BBBBB*...BBBB3.B',
  'B....BBBBB.BB.KN.B..B',
  'B.BB..b......BBBBB..B',
  'B.BBB...BBBB........B',
  'B.xBBB..BBBB.BBBbBB.B',
  'BB..BB....r..BBBBBB.B',
  'BB..KK..H..I.........',
  'B...BB.......BBBBB...',
  'B.BBBBBBBBBB.BBBBB.BB',
  'B.BBBBBBBBBB..b..*.BB',
  'B.......BBBB.BB.2..BB',
  '..t.....BBBB.BBBBBBBB',
  '....BB..........BBBBB',
  'BBBBBBBB..C..BBBBBBBB',
  'BBBBBBBBB..BBBBBBBBBB',
];
// Open sand under the hawks. A Ghost Egg at the edge to cross it unseen; a clutch ringed with thorns.
const DUNES = [
  'B....C........C..Y..B',
  'B..Y......x.........B',
  '..g...1......C....o.B',
  '...C............z...B',
  'B.........C........C.',
  'B....C...Y.....2.....',
  'B.....*............C.',
  'BB.......H....C......',
  'B...C.............y..',
  'B..........C.....C..B',
  'B.TTT..3......D.....B',
  '..TNT.........C..*..B',
  'B.TTT.....C..........',
  'B...C.....o....1.....',
  'B.......C..........C.',
  'BB..x........C..Y...B',
  'BBB..C...BB.......BBB',
  'BBBBBBBBBBBBBBBBBBBBB',
];
// Owls again, and the way home in the far corner with a guard at its door. Long grass runs up the east side.
const HOLLOW = [
  'BBBBBBBBBBBBBBBBBB',
  'BB....C....BB...FB',
  'B..C......CBB....B',
  'B.....BB...BBB..BB',
  'B.C...B3...C...wwB',
  'B........C.....wwB',
  'BB..C.......BB.wwB',
  '......C.....B1.wwB',
  '...C.....r....wwwB',
  'B.......C....www.B',
  'B..C.BB.......B..B',
  'B....B2..C.......B',
  'B.C.........C..C.B',
  'B..wwwwC.........B',
  'BB.wwww....BB..C.B',
  'B..www..C..B.....B',
  'B..C..........C..B',
  'B.2...C..C..*....B',
  'BB..............BB',
  'BBBBBB...BBBBBBBBB',
];
// Scorpions under the boulders, two roadrunners, and two nests shut in behind thorns.
const BADLANDS = [
  '....B.....C..BBBBB',
  '..C.B.BB.....B..NB',
  '....b..B..C..T...B',
  '.C.....B.....BBBBB',
  '....BB....H......B',
  'BB...B..C..c..b..B',
  'B..C.....BB.C....B',
  'B......1..B..C.2.B',
  '...BB......I..BB.B',
  '..C.B..C..b...TTTB',
  '....*...B...C.T3.B',
  'B..C....BB....TTTB',
  'BB.....C......BBBB',
  'BBBBBBBBBBBBBBBBBB',
];

// Where each block sits (its top-left tile), and the area it becomes: a name for the banner and a mood for the light.
const BLOCKS = [
  { rows: ROOST, x: 0, y: 0, name: 'Owl Roost', mood: 'dusk' },
  { rows: FLATS, x: 0, y: 10, name: 'Burrow Flats', mood: 'morning' },
  { rows: THICKET, x: 0, y: 24, name: 'Thorn Thicket', mood: 'thicket' },
  { rows: GULCH, x: 17, y: 0, name: 'Boulder Gulch', mood: 'canyon' },
  { rows: DUNES, x: 17, y: 16, name: 'Hawk Dunes', mood: 'noon', sand: true },
  { rows: HOLLOW, x: 38, y: 0, name: 'Owl Hollow', mood: 'dusk' },
  { rows: BADLANDS, x: 38, y: 20, name: 'Scorpion Badlands', mood: 'sunset' },
];

// The hunters' routes, in tiles (the centre of tile 6,16 is "6,16"). Closed loops unless open: true.
const ROUTES = [
  { type: 'roadrunner', name: 'Flats runner', pts: [[11, 12], [14, 12], [14, 18], [11, 18]] },
  { type: 'roadrunner', name: 'Thicket runner', pts: [[2, 25], [14, 25], [13, 27], [2, 27]] },
  { type: 'roadrunner', name: 'Hollow runner', pts: [[42, 9], [50, 9], [50, 13], [42, 13]] },
  { type: 'roadrunner', name: 'Badlands runner west', pts: [[40, 26], [46, 26], [47, 28], [43, 29]] },
  { type: 'roadrunner', name: 'Badlands runner east', pts: [[49, 24], [54, 24], [54, 27], [49, 27]] },
  { type: 'owl', name: 'Roost owl', pts: [[3, 3.5], [8, 3], [13, 3.5], [14, 5.5], [12, 7.5], [8, 7.8], [4, 7.5], [2, 5.5]] },
  { type: 'owl', name: 'Roost owl, second', phase: 0.5, pts: [[3, 3.5], [8, 3], [13, 3.5], [14, 5.5], [12, 7.5], [8, 7.8], [4, 7.5], [2, 5.5]] },
  { type: 'owl', name: 'Hollow owl, long', pts: [[41, 2], [46, 3], [51, 6], [52, 11], [49, 16], [44, 17], [40, 13], [39, 7]] },
  { type: 'owl', name: 'Hollow owl, diamond', pts: [[45, 5], [40, 9], [45, 14], [50, 9]] },
  { type: 'hawk', name: 'Dunes hawk', pts: [[20, 19], [27, 17.5], [34, 19], [36, 24], [34, 30], [27, 31.5], [20, 30], [18, 24]] },
  { type: 'hawk', name: 'Dunes hawk, south', phase: 0.4, pts: [[29, 26], [27, 29], [29, 31.5], [34, 31], [36, 28], [33, 25]] },
];

// Guards: roadrunners that stand at a post and sweep their gaze. facing in degrees (0 north, 90 east, 180 south,
// 270 west); sweep is how far the gaze swings to each side.
const SENTRIES = [
  { name: 'Gulch guard', at: [33, 7], facing: 270, sweep: 16 },
  { name: 'Thicket guard', at: [9, 31], facing: 0, sweep: 35 },
  { name: 'Gate guard', at: [52, 4], facing: 180, sweep: 40 },
];

// ---------------------------------------------------------------------------------------------------------

const W = 56, H = 34, TILE = 200;
const grid = Array.from({ length: H }, () => Array(W).fill(null));
const sand = Array.from({ length: H }, () => Array(W).fill(false));
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
      sand[y][x] = !!b.sand;
    });
  });
}
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (grid[y][x] === null) throw new Error(`no block covers ${x},${y}`);

// What each letter puts on the "things" layer. The game knows a tile by its image's file name, nothing else.
const THING = {
  B: 'boulder', b: 'boulder_scorpion', K: 'rock_cracked', T: 'thorns', I: 'rockspire',
  1: 'nest_egg_1', 2: 'nest_egg_2', 3: 'nest_egg_3', N: 'nest_clutch',
  t: 'nest_thunder', g: 'nest_ghost', c: 'nest_chili', r: 'nest_rattle', G: 'nest_gold', '*': 'beetle',
  S: 'burrow_start', H: 'burrow', F: 'burrow_exit',
  Y: 'cactus_1', y: 'cactus_2', o: 'cactus_3', A: 'agave', D: 'deadtree', x: 'skull', z: 'bones',
};
const POWER_OF = { t: 'thunder', g: 'ghost', c: 'chili', r: 'rattle' };
const WALLS = 'BbIYyoAD'; // never passable
const NAMES = ['scrub', 'sand', 'tuft_1', 'tuft_2', 'tuft_3', 'tuft_4', 'grass', ...new Set(Object.values(THING))];
const sprites = join(import.meta.dirname, '..', 'public', 'sprites');
const TILES = NAMES.map((name) => {
  let png;
  try { png = readFileSync(join(sprites, name + '.png')); } catch { throw new Error(`no picture for the tile "${name}": public/sprites/${name}.png is missing (npm run assets makes them)`); }
  return [name, png.readUInt32BE(16), png.readUInt32BE(20)];
});
const gid = (name) => TILES.findIndex((t) => t[0] === name) + 1;
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return (h ^ (h >>> 16)) >>> 0; };

const ground = [], things = [], cover = [];
let start = null, eggs = 0;
const count = {};
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const ch = grid[y][x];
  if (ch !== '.' && ch !== 'C' && ch !== 'w' && !THING[ch]) throw new Error(`unknown letter "${ch}" at ${x},${y}`);
  ground.push(gid(sand[y][x] ? 'sand' : 'scrub'));
  things.push(THING[ch] ? gid(THING[ch]) : 0);
  cover.push(ch === 'C' ? gid('tuft_' + (1 + (hash(x, y) % 4))) : ch === 'w' ? gid('grass') : 0);
  count[ch] = (count[ch] ?? 0) + 1;
  if (ch === 'S') start = [x, y];
  if ('123'.includes(ch)) eggs += 1;
  if (ch === 'N') eggs += 3;
}
if (!start) throw new Error('no start burrow (S)');
if ((count.G ?? 0) > 1) throw new Error('more than one golden egg (G)');

// Can the lizard get everywhere it needs to? Flood out from the start; a wall of cracked rock or thorns opens
// once the egg that opens it has been reached, and so on until nothing more opens.
const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 'B' : grid[y][x]);
function flood(opens) {
  const seen = Array.from({ length: H }, () => Array(W).fill(false));
  const queue = [start];
  seen[start[1]][start[0]] = true;
  while (queue.length) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, ch = at(nx, ny);
      if (WALLS.includes(ch) || (ch === 'K' && !opens.includes('K')) || (ch === 'T' && !opens.includes('T'))) continue;
      if (!seen[ny][nx]) { seen[ny][nx] = true; queue.push([nx, ny]); }
    }
  }
  return seen;
}
const free = flood('');
let opens = '', seen = free;
for (;;) {
  let next = opens;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!seen[y][x]) continue;
    if (grid[y][x] === 't' && !next.includes('K')) next += 'K';
    if (grid[y][x] === 'c' && !next.includes('T')) next += 'T';
  }
  if (next === opens) break;
  opens = next; seen = flood(opens);
}
const onlyThunder = flood('K'), onlyChili = flood('T');
const gate = (x, y) => (free[y][x] ? '' : onlyThunder[y][x] ? 'Thunder' : onlyChili[y][x] ? 'Chili' : 'Thunder + Chili');

const problems = [], gated = [];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const ch = grid[y][x];
  if (!'123NHFGtgcr*'.includes(ch)) continue;
  if (!seen[y][x]) problems.push(`"${ch}" at ${x},${y} can't be reached, even with the power eggs`);
  else if (gate(x, y) && ch !== '*') gated.push(`${THING[ch]} at ${x},${y}: ${gate(x, y)}`);
  if (ch === 'F' && !free[y][x]) problems.push(`the way out at ${x},${y} needs a power egg: a lizard must always be able to go home`);
}
for (const r of ROUTES) if (r.type === 'roadrunner') for (const [x, y] of r.pts) {
  if (!free[y]?.[x]) problems.push(`${r.name}: waypoint ${x},${y} is in a rock or cut off`);
}
for (const s of SENTRIES) if (!seen[s.at[1]]?.[s.at[0]] || 'KT'.includes(at(...s.at))) problems.push(`${s.name}: its post ${s.at} is in a rock or cut off`);

console.log('     ' + Array.from({ length: W }, (_, i) => (i % 10 === 0 ? i / 10 : ' ')).join(''));
console.log('     ' + Array.from({ length: W }, (_, i) => i % 10).join(''));
for (let y = 0; y < H; y++) {
  console.log(String(y).padStart(3) + '  ' + grid[y].map((ch, x) => {
    if (SENTRIES.some((s) => s.at[0] === x && s.at[1] === y)) return '!';
    return ch === '.' ? (seen[y][x] ? (free[y][x] ? (sand[y][x] ? ',' : '.') : '_') : '?') : ch;
  }).join(''));
}
const cut = grid.flat().filter((ch, i) => ch === '.' && !seen[Math.floor(i / W)][i % W]).length;
const n = (letters) => [...letters].reduce((sum, ch) => sum + (count[ch] ?? 0), 0);
console.log(`${W}x${H} tiles, ${eggs} eggs in ${n('123N')} nests, ${n('tgcr')} power eggs, ${n('*')} beetles, ${n('b')} scorpions, ${ROUTES.length} routes, ${SENTRIES.length} guards (!), ${n('K')} cracked rocks, ${n('T')} thorns`
  + (cut ? `, ${cut} open tiles nobody can reach (shown as ?)` : ''));
console.log('behind a wall (ground shown as _):\n  ' + (gated.join('\n  ') || 'nothing'));
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }

let nextObject = 1;
const px = (t) => (t + 0.5) * TILE;
const routeObjects = ROUTES.map((r) => {
  const [x0, y0] = r.pts[0];
  const points = r.pts.map(([x, y]) => ({ x: (x - x0) * TILE, y: (y - y0) * TILE }));
  const props = [];
  if (r.phase) props.push({ name: 'phase', type: 'float', value: r.phase });
  if (r.speed) props.push({ name: 'speed', type: 'float', value: r.speed });
  return {
    id: nextObject++, name: r.name, type: r.type, x: px(x0), y: px(y0), width: 0, height: 0, rotation: 0, visible: true,
    [r.open ? 'polyline' : 'polygon']: points, ...(props.length ? { properties: props } : {}),
  };
});
const sentryObjects = SENTRIES.map((s) => ({
  id: nextObject++, name: s.name, type: 'sentry', x: px(s.at[0]), y: px(s.at[1]), width: 0, height: 0, rotation: 0, visible: true, point: true,
  properties: [{ name: 'facing', type: 'float', value: s.facing }, { name: 'sweep', type: 'float', value: s.sweep }],
}));
const zoneObjects = BLOCKS.map((b) => ({
  id: nextObject++, name: b.name, type: 'zone', x: b.x * TILE, y: b.y * TILE, width: b.w * TILE, height: b.h * TILE, rotation: 0, visible: true,
  properties: [{ name: 'mood', type: 'string', value: b.mood }],
}));

const tileLayer = (id, name, data) => ({ id, name, type: 'tilelayer', data, width: W, height: H, x: 0, y: 0, opacity: 1, visible: true });
const objectLayer = (id, name, objects, color) => ({ id, name, type: 'objectgroup', draworder: 'topdown', objects, color, x: 0, y: 0, opacity: 1, visible: true });
const map = {
  type: 'map', version: '1.10', tiledversion: '1.11.2', orientation: 'orthogonal', renderorder: 'right-down',
  compressionlevel: -1, infinite: false, width: W, height: H, tilewidth: TILE, tileheight: TILE,
  nextlayerid: 7, nextobjectid: nextObject,
  properties: [
    { name: 'title', type: 'string', value: 'The Long Way Home' },
    { name: 'par_seconds', type: 'int', value: 600 },
  ],
  layers: [
    tileLayer(1, 'ground', ground),
    tileLayer(2, 'things', things),
    tileLayer(3, 'cover', cover),
    objectLayer(4, 'routes', routeObjects, '#ff7a1a'),
    objectLayer(5, 'sentries', sentryObjects, '#e0303a'),
    objectLayer(6, 'zones', zoneObjects, '#3aa0ff'),
  ],
  tilesets: [{
    firstgid: 1, name: 'desert', columns: 0, margin: 0, spacing: 0, tilecount: TILES.length,
    tilewidth: Math.max(...TILES.map((t) => t[1])), tileheight: Math.max(...TILES.map((t) => t[2])),
    grid: { orientation: 'orthogonal', width: 1, height: 1 },
    tiles: TILES.map(([name, w, h], id) => ({ id, image: `../sprites/${name}.png`, imagewidth: w, imageheight: h })),
  }],
};
const out = join(import.meta.dirname, '..', 'public', 'levels', 'desert.tmj');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(map));
console.log('wrote', out);
