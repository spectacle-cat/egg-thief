// The scenery: the ground, the rocks, the bushes and grass, cactus, nests and burrows. Built once from the level.
//
// The hand-drawn pictures are flat and drawn from straight above, so height is made the way paper models make it:
// a rock is the same drawing stacked many times, darker underneath; a tuft is a mound of its own leaves. Things
// that should tower over a lizard (cactus, long grass, dead trees, far mesas) are side-view drawings standing up.
// From the low camera the stacks and cards hide what is behind them, hunters included.
import * as THREE from 'three';
import { ORDER, SpriteBatch, canvasTexture, deckMask, loadTexture, loadTextureOr, makeGround, shared } from './gfx';
import { POWERS, type Level, type Nest, type PowerKind, type PropKind } from './level';
import type { Theme } from './theme';
import { TAU, damp, hash2, type V2 } from './util';

export interface Textures {
  lizard: THREE.Texture; roadrunner: THREE.Texture; scorpion: THREE.Texture;
  hawkC: THREE.Texture; hawkL: THREE.Texture; hawkR: THREE.Texture; owl: THREE.Texture;
  scrub: THREE.Texture; boulder: THREE.Texture; tufts: THREE.Texture;
  nestEgg: THREE.Texture[]; nestEmpty: THREE.Texture; nestClutch: THREE.Texture; burrow: THREE.Texture; eggs: THREE.Texture[];
  // --- drawn for the low camera
  rockCracked: THREE.Texture; rubblePile: THREE.Texture; rubble: THREE.Texture[]; thorns: THREE.Texture; thornsAsh: THREE.Texture;
  powerEgg: Record<PowerKind, THREE.Texture>; goldEgg: THREE.Texture;
  beetle: THREE.Texture; butterfly: THREE.Texture; tumbleweed: THREE.Texture; skull: THREE.Texture; bones: THREE.Texture;
  pebbles: THREE.Texture; flowers: THREE.Texture; cracks: THREE.Texture; stunStar: THREE.Texture;
  upTuft: THREE.Texture[]; upGrass: THREE.Texture; upFlowers: THREE.Texture; upMesa: THREE.Texture[];
  upProp: Record<Exclude<PropKind, 'skull' | 'bones'>, THREE.Texture>;
  // --- only where there is water and wood (blank elsewhere)
  log: THREE.Texture; hollowLog: THREE.Texture; logMouth: THREE.Texture; water: THREE.Texture | null; ford: THREE.Texture;
  spider: THREE.Texture; spiderLegs: THREE.Texture; coatiTail: THREE.Texture; viperCoil: THREE.Texture; viperHead: THREE.Texture; ant: THREE.Texture;
  // --- only where a map has a canopy (blank, or missing, elsewhere)
  mat: THREE.Texture | null; below: THREE.Texture | null; sprays: THREE.Texture; upSpray: THREE.Texture[];
  bough: THREE.Texture; boughFork: THREE.Texture; boughTip: THREE.Texture; leafClump: THREE.Texture[]; upLiana: THREE.Texture;
  hollowGiant: THREE.Texture; hollowDoor: THREE.Texture; doorGlow: THREE.Texture; knothole: THREE.Texture;
}

const TUFT_W = 280, TUFT_H = 240, TUFT_PAD = 8;

export async function loadTextures(base: string, theme: Theme): Promise<Textures> {
  // A theme's own drawing of a part if it has one, the desert's if not (or if the file is not drawn yet).
  const own = (name: string) => (theme.art[name] ? `${base}sprites/${theme.dir}/${theme.art[name]}.png` : '');
  const s = (name: string, repeat = false) => {
    const plain = () => loadTexture(`${base}sprites/${name}.png`, { repeat });
    return own(name) ? loadTexture(own(name), { repeat }).catch(() => { console.warn(`[art] ${theme.name} has no ${theme.art[name]}: using the desert's ${name}`); return plain(); }) : plain();
  };
  const o = (name: string) => (own(name) ? loadTexture(own(name)).catch(() => loadTextureOr(`${base}sprites/${name}.png`)) : loadTextureOr(`${base}sprites/${name}.png`));
  const extra = (name: string) => (theme.dir ? loadTextureOr(`${base}sprites/${theme.dir}/${name}.png`) : Promise.resolve(canvasTexture(4, 4, () => {})));
  const [log, hollowLog, logMouth, spider, spiderLegs, coatiTail, viperCoil, viperHead, ant] = await Promise.all(
    ['log', 'hollow_log', 'log_mouth', 'spider', 'spider_legs', 'coati_tail', 'viper_coil', 'viper_head', 'ant'].map(extra));
  // A drawn tile of deep water, laid over the streams (a place with no drawing of it has its water painted by rule).
  const ford = await extra('ford');
  const water = theme.dir ? await loadTexture(`${base}sprites/${theme.dir}/water.png`, { repeat: true }).catch(() => null) : null;
  // The canopy's pieces: its leaf mat and the floor far below repeat edge to edge.
  const tiled = (name: string) => (theme.dir ? loadTexture(`${base}sprites/${theme.dir}/${name}.png`, { repeat: true }).catch(() => null) : Promise.resolve(null));
  const [mat, below] = await Promise.all([tiled('canopy_floor'), tiled('floor_below')]);
  const [bough, boughFork, boughTip, upLiana, hollowGiant, hollowDoor, doorGlow, knothole, ...leafy] = await Promise.all(
    ['bough', 'bough_fork', 'bough_tip', 'up_liana', 'up_hollow_giant', 'hollow_door', 'door_glow', 'knothole',
      'leaf_clump_1', 'leaf_clump_2', 'leaf_clump_3', 'up_spray_1', 'up_spray_2', 'spray_1', 'spray_2', 'spray_3', 'spray_4'].map(extra));
  const leafClump = leafy.slice(0, 3), upSpray = leafy.slice(3, 5), sprayImgs = leafy.slice(5);
  const [lizard, roadrunner, scorpion, hawkC, hawkL, hawkR, owl, scrub, boulder, nestEmpty, nestClutch, burrow] = await Promise.all([
    s('lizard'), s('roadrunner'), s('scorpion'), s('hawk_centre'), s('hawk_left'), s('hawk_right'), s('owl'),
    s('scrub', theme.seamless), s('boulder'), s('nest_empty'), s('nest_clutch'), s('burrow'),
  ]);
  const [nestEgg, eggs, tuftImgs] = await Promise.all([
    Promise.all([1, 2, 3].map((i) => s(`nest_egg_${i}`))),
    Promise.all([1, 2, 3].map((i) => s(`egg_${i}`))),
    Promise.all([1, 2, 3, 4].map((i) => s(`tuft_${i}`))),
  ]);
  // The four tufts on one sheet, so every leaf of every tuft is one batch (and the canopy's sprays on another).
  const cw = TUFT_W + TUFT_PAD, ch = TUFT_H + TUFT_PAD;
  const sheet = (imgs: THREE.Texture[]) => {
    const made = canvasTexture(cw * 2, ch * 2, (ctx) => {
      imgs.forEach((t, i) => ctx.drawImage(t.image as CanvasImageSource, (i % 2) * cw + TUFT_PAD / 2, Math.floor(i / 2) * ch + TUFT_PAD / 2, TUFT_W, TUFT_H));
    });
    imgs.forEach((t) => t.dispose());
    return made;
  };
  const tufts = sheet(tuftImgs), sprays = sheet(sprayImgs);

  const [rockCracked, rubblePile, thorns, thornsAsh, goldEgg, beetle, butterfly, tumbleweed, skull, bones, pebbles, flowers, cracks, stunStar, upGrass, upFlowers] = await Promise.all([
    o('rock_cracked'), o('rubble_pile'), o('thorns'), o('thorns_ash'), o('egg_gold'), o('beetle'), o('butterfly'), o('tumbleweed'), o('skull'), o('bones'),
    o('pebbles'), o('flowers'), o('cracks'), o('stun_star'), o('up_grass'), o('up_flowers'),
  ]);
  const [rubble, power, upTuft, upMesa, props] = await Promise.all([
    Promise.all([1, 2, 3].map((i) => o(`rubble_${i}`))),
    Promise.all(POWERS.map((k) => o(`egg_${k}`))),
    Promise.all([1, 2].map((i) => o(`up_tuft_${i}`))),
    Promise.all([1, 2, 3].map((i) => o(`up_mesa_${i}`))),
    Promise.all(['cactus_1', 'cactus_2', 'cactus_3', 'agave', 'deadtree', 'rockspire'].map((k) => o(`up_${k}`))),
  ]);
  const powerEgg = Object.fromEntries(POWERS.map((k, i) => [k, power[i]])) as Record<PowerKind, THREE.Texture>;
  const upProp = { cactus_1: props[0], cactus_2: props[1], cactus_3: props[2], agave: props[3], deadtree: props[4], rockspire: props[5] };
  return {
    lizard, roadrunner, scorpion, hawkC, hawkL, hawkR, owl, scrub, boulder, tufts, nestEgg, nestEmpty, nestClutch, burrow, eggs,
    rockCracked, rubblePile, rubble, thorns, thornsAsh, powerEgg, goldEgg, beetle, butterfly, tumbleweed, skull, bones, pebbles, flowers, cracks, stunStar,
    upTuft, upGrass, upFlowers, upMesa, upProp,
    log, hollowLog, logMouth, spider, spiderLegs, coatiTail, viperCoil, viperHead, ant, water, ford,
    mat, below, sprays, upSpray, bough, boughFork, boughTip, leafClump, upLiana, hollowGiant, hollowDoor, doorGlow, knothole,
  };
}

function tuftUv(variant: number): [number, number, number, number] {
  const i = variant - 1, cw = TUFT_W + TUFT_PAD, ch = TUFT_H + TUFT_PAD;
  const x0 = (i % 2) * cw + TUFT_PAD / 2, y0 = Math.floor(i / 2) * ch + TUFT_PAD / 2;
  return [x0 / (cw * 2), 1 - (y0 + TUFT_H) / (ch * 2), TUFT_W / (cw * 2), TUFT_H / (ch * 2)];
}

interface RockLayer { x: number; y: number; z: number; w: number; rot: number; tint: number; warm: number; rock: number; k: number; n: number }
interface Rock { x: number; z: number; size: number; height: number; near: boolean; scorpion: number; cracked: number }

/** How far the rocks go on beyond the edge of the map (the low camera sees a long way). */
const RING = 16;
/** Where shadows fall: away from a sun in the north-west. */
const SUN_X = 0.78, SUN_Z = 0.63, SUN_HEADING = Math.atan2(SUN_X, -SUN_Z);
const TUFT_LAYERS = [
  { y: 0.1, scale: 1.04, tint: 0.6, sway: 0.2 },
  { y: 0.26, scale: 1.0, tint: 0.72, sway: 0.5 },
  { y: 0.42, scale: 0.92, tint: 0.84, sway: 0.8 },
  { y: 0.58, scale: 0.8, tint: 0.94, sway: 1.1 },
  { y: 0.72, scale: 0.62, tint: 1.0, sway: 1.4 },
];
const THORN_LAYERS = [
  { y: 0.08, scale: 1.1, tint: 0.55 }, { y: 0.24, scale: 1.06, tint: 0.7 }, { y: 0.4, scale: 1.0, tint: 0.85 }, { y: 0.56, scale: 0.9, tint: 1.0 },
];
/** A fallen log is a few sheets of bark, each narrower than the one below: round enough from the low camera. */
const LOG_LAYERS = [
  { y: 0.06, wide: 1.0, tint: 0.5 }, { y: 0.17, wide: 0.92, tint: 0.68 }, { y: 0.27, wide: 0.78, tint: 0.86 }, { y: 0.34, wide: 0.6, tint: 1.0 },
];
/** Standing scenery: width and height in tiles. */
const PROP_SIZE: Record<string, [number, number]> = {
  cactus_1: [1.25, 2.5], cactus_2: [1.3, 1.62], cactus_3: [0.9, 1.05], agave: [1.3, 1.02], deadtree: [2.2, 2.95], rockspire: [1.7, 2.8],
};

export class World {
  private fords: SpriteBatch | null = null;
  private fordShown = -1;
  private ants: SpriteBatch | null = null;
  private antPaths: { pts: V2[]; len: number }[] = [];
  private fireflies: { x: number; z: number; phase: number; rate: number }[] = [];
  readonly scorpionRocks: SpriteBatch;
  /** Soft round shadows and glows, refilled every frame by whoever needs one. */
  readonly blobs: SpriteBatch;
  readonly glow: SpriteBatch;
  /** Rings and targets the player must not miss: never hidden. */
  readonly marks: SpriteBatch;
  /** Rings that lie on the ground (hidden by rocks in front of them). */
  readonly rings: SpriteBatch;
  readonly eggs: SpriteBatch[];
  /** Eggs in the air (hopping into a burrow, flying home to a nest). */
  readonly eggsAir: SpriteBatch[];
  readonly powerEggs: Record<PowerKind, SpriteBatch>;
  readonly goldEgg: SpriteBatch;
  private boulders: SpriteBatch;
  private cracked: SpriteBatch;
  private rubble: SpriteBatch;
  private thorns: SpriteBatch;
  private ash: SpriteBatch;
  /** Tufts in two sets of drawings: the floor's ferns, and the canopy's sprays. */
  private tuftSets: { leaves: SpriteBatch; cards: SpriteBatch[] }[] = [];
  /** The ground's own picture of where water lies, and (where there is a canopy) of where its deck is. */
  readonly groundMask: THREE.Texture;
  readonly deckTex: THREE.Texture | null;
  private shadows: SpriteBatch;
  private nestBatches: SpriteBatch[];
  private nestEmpty: SpriteBatch;
  private nestClutch: SpriteBatch;
  private burrows: SpriteBatch;
  private nestSlot = new Map<number, { batch: SpriteBatch; index: number; empty: number }>();
  private tuftSlot = new Map<number, { set: number; layers: number[]; cards: [number, number][] }>();
  private rustling = new Map<number, number>();
  private scorpLayers = new Map<number, RockLayer[]>();
  private crackSlot = new Map<number, { layers: number[]; shadow: number; rubble: number }>();
  private thornSlot = new Map<number, { layers: number[]; ash: number }>();
  private burning = new Map<number, number>();
  private burrowPulse: number[] = [];
  private logs: SpriteBatch | null = null;
  private logShadows: SpriteBatch | null = null;

  constructor(scene: THREE.Object3D, readonly level: Level, tex: Textures) {
    this.deckTex = level.canopy && tex.mat ? deckMask(level) : null;
    const ground = makeGround(scene, level, tex.scrub, RING + 30, tex.water, tex.mat, this.deckTex);
    this.groundMask = (ground.material as THREE.ShaderMaterial).uniforms.tMask.value as THREE.Texture;
    // FW: the floor's share of the map (all of it, unless a canopy has the far corner).
    const W = level.w, H = level.h, FW = level.floorW;
    const free = (c: number, r: number) => level.inside(c, r) && !level.solid[r * W + c];

    // --- burrows and nests lie on the ground
    this.burrows = new SpriteBatch(scene, tex.burrow, level.burrows.length + 1, { order: ORDER.burrow });
    level.burrows.forEach((b, i) => { this.burrows.push(b.x, 0.012, b.z, 1.9, 1.9, hash2(i, 7) * TAU); this.burrowPulse.push(0); });
    this.burrows.commit();
    const nestCount = level.nests.length + level.powerNests.length + 2;
    this.nestBatches = tex.nestEgg.map((t) => new SpriteBatch(scene, t, nestCount, { order: ORDER.nest }));
    this.nestClutch = new SpriteBatch(scene, tex.nestClutch, nestCount, { order: ORDER.nest });
    this.nestEmpty = new SpriteBatch(scene, tex.nestEmpty, nestCount, { order: ORDER.nest });
    for (const n of level.nests) {
      const rot = (hash2(n.c, n.r) - 0.5) * 0.9;
      const batch = n.clutch ? this.nestClutch : this.nestBatches[n.eggs[0] - 1];
      const size = n.clutch ? 2.3 : 2;
      const index = batch.push(n.x, 0.02, n.z, size, size, rot);
      const empty = this.nestEmpty.push(n.x, 0.02, n.z, size, size, rot, 1, 1, 1, 0);
      this.nestSlot.set(n.id, { batch, index, empty });
    }
    // Power eggs and the golden egg sit in a nest of their own; the egg itself is drawn by the game.
    for (const n of level.powerNests) this.nestEmpty.push(n.x, 0.02, n.z, 2.1, 2.1, hash2(n.x, n.z) * TAU);
    if (level.gold) this.nestEmpty.push(level.gold.x, 0.02, level.gold.z, 2.2, 2.2, 0.4);
    [...this.nestBatches, this.nestClutch, this.nestEmpty].forEach((b) => b.commit());

    this.glow = new SpriteBatch(scene, null, 224, { order: ORDER.glow, shapes: true, additive: true });
    // Fords: stepping stones drawn over the shallow water. They sink out of sight as the flood rises.
    const fordTiles: number[] = [];
    level.water.forEach((kind, i) => { if (kind === 3) fordTiles.push(i); });
    if (fordTiles.length) {
      this.fords = new SpriteBatch(scene, tex.ford, fordTiles.length + 1, { order: ORDER.trail });
      for (const i of fordTiles) this.fords.push((i % level.w) + 0.5, 0.012, Math.floor(i / level.w) + 0.5, 1, 1, 0);
      this.fords.commit();
    }
    // Leafcutter ants in single file along the trails drawn on the map.
    this.antPaths = level.trails.map((pts) => ({ pts, len: pts.reduce((sum, p, i) => (i ? sum + Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z) : 0), 0) }));
    const antCount = this.antPaths.reduce((sum, p) => sum + Math.ceil(p.len / 0.55), 0);
    if (antCount) this.ants = new SpriteBatch(scene, tex.ant, antCount + 1, { order: ORDER.egg, kind: 'cut' });
    // Fireflies, wherever it is dusk in a forest: a few dozen to an area, each with a home spot and a blink of its own.
    for (const zone of level.zones) if (zone.mood === 'firefly') for (let i = 0, n = 0; i < 400 && n < 34; i++) {
      const x = zone.x0 + hash2(i, 3) * (zone.x1 - zone.x0), z = zone.z0 + hash2(i, 11) * (zone.z1 - zone.z0);
      if (level.isSolid(Math.floor(x), Math.floor(z))) continue;
      this.fireflies.push({ x, z, phase: hash2(i, 5) * TAU, rate: 0.9 + hash2(i, 9) * 1.3 }); n++;
    }
    this.blobs = new SpriteBatch(scene, null, 256, { order: ORDER.shadow, shapes: true });
    this.rings = new SpriteBatch(scene, null, 64, { order: ORDER.cone + 0.5, shapes: true });
    this.marks = new SpriteBatch(scene, null, 64, { order: ORDER.mark, shapes: true, kind: 'over' });
    this.eggs = tex.eggs.map((t) => new SpriteBatch(scene, t, 48, { order: ORDER.egg, kind: 'cut' }));
    this.eggsAir = tex.eggs.map((t) => new SpriteBatch(scene, t, 48, { order: ORDER.egg, kind: 'cut' }));
    // Power eggs and the golden egg stand up, so they catch the eye from the low camera.
    this.powerEggs = Object.fromEntries(POWERS.map((k) => [k, new SpriteBatch(scene, tex.powerEgg[k], 16, { order: ORDER.egg, kind: 'up' })])) as Record<PowerKind, SpriteBatch>;
    this.goldEgg = new SpriteBatch(scene, tex.goldEgg, 4, { order: ORDER.egg, kind: 'up' });

    // --- rocks
    const rocks: Rock[] = [];
    const used = new Uint8Array(W * H);
    const special = new Map<number, 'scorpion' | 'cracked'>();
    for (const b of level.boulders) if (b.scorpion || b.cracked) special.set(b.r * W + b.c, b.scorpion ? 'scorpion' : 'cracked');
    const isRock = new Uint8Array(W * H);
    for (const b of level.boulders) isRock[b.r * W + b.c] = 1;
    const rockAt = (c: number, r: number) => !level.inside(c, r) || c >= FW || isRock[r * W + c] === 1;
    const plain = (c: number, r: number) => level.inside(c, r) && isRock[r * W + c] === 1 && !used[r * W + c] && !special.has(r * W + c);
    // Rock deep inside a mass of rock stands taller: masses become mesas, loners stay boulders.
    const depth = (c: number, r: number) => {
      let d = 0;
      for (let k = 1; k <= 3; k++) { if (rockAt(c - k, r) && rockAt(c + k, r) && rockAt(c, r - k) && rockAt(c, r + k)) d = k; else break; }
      return d;
    };
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      const k = r * W + c;
      if (!isRock[k] || used[k]) continue;
      const kind = special.get(k);
      if (kind) { used[k] = 1; rocks.push({ x: c + 0.5, z: r + 0.5, size: 1.04, height: kind === 'cracked' ? 0.78 : 0.6, near: true, scorpion: kind === 'scorpion' ? k : -1, cracked: kind === 'cracked' ? k : -1 }); continue; }
      const tall = depth(c, r);
      // Now and then four rocks in a square become one big one: masses look like outcrops, not a wall of tiles.
      if (hash2(c, r) < 0.6 && plain(c + 1, r) && plain(c, r + 1) && plain(c + 1, r + 1)) {
        used[k] = used[k + 1] = used[k + W] = used[k + W + 1] = 1;
        rocks.push({ x: c + 1, z: r + 1, size: 2.02 + hash2(r, c) * 0.12, height: 0.72 + hash2(c, r + 3) * 0.34 + tall * 0.4, near: true, scorpion: -1, cracked: -1 });
      } else {
        used[k] = 1;
        rocks.push({ x: c + 0.5, z: r + 0.5, size: 1.02 + hash2(r, c) * 0.1, height: 0.44 + hash2(c, r + 3) * 0.3 + tall * 0.4, near: true, scorpion: -1, cracked: -1 });
      }
    }
    for (let gz = -RING; gz < H + RING; gz += 2) for (let gx = -RING; gx < FW + RING; gx += 2) {
      if (!(gx + 2 <= 0 || gx >= FW || gz + 2 <= 0 || gz >= H)) continue;
      const edge = Math.max(-gx - 2, gx - FW, -gz - 2, gz - H); // tiles beyond the map
      rocks.push({
        x: gx + 1 + (hash2(gx, gz) - 0.5) * 0.7, z: gz + 1 + (hash2(gz, gx) - 0.5) * 0.7, size: 2.3 + hash2(gx + 9, gz) * 0.9,
        height: 1.3 + Math.min(edge, 8) * 0.22 + hash2(gx, gz + 5) * 0.8, near: edge < 9, scorpion: -1, cracked: -1,
      });
    }
    const layers: RockLayer[] = [];
    rocks.forEach((rock, id) => {
      const stepY = rock.near ? 0.105 : 0.4;
      const n = Math.max(2, Math.round(rock.height / stepY) + 1);
      const rot = Math.floor(hash2(id, 3) * 4) * (Math.PI / 2) + (hash2(id, 5) - 0.5) * 0.16;
      const warm = hash2(id, 11);
      const taper = 0.13 + Math.min(0.2, rock.height * 0.09);
      for (let k = 0; k < n; k++) {
        const f = k / (n - 1);
        // Beds of stone: each a little out of line with the one below, some paler, some redder.
        const bed = hash2(Math.floor(k / 2) + id * 0.37, 17);
        const tint = (0.44 + 0.56 * Math.pow(f, 1.3)) * (k === n - 1 ? 1 : 0.9 + bed * 0.16);
        const slip = k === n - 1 ? 0 : (hash2(id, k) - 0.5) * 0.05 * rock.size;
        layers.push({ x: rock.x + slip, y: 0.04 + f * rock.height, z: rock.z - slip, w: rock.size * (1.07 - taper * f) * (1 + (bed - 0.5) * 0.04), rot, tint, warm: warm + (bed - 0.5) * 0.9, rock: rock.scorpion >= 0 ? rock.scorpion : rock.cracked >= 0 ? -2 - rock.cracked : -1, k, n });
      }
    });
    this.shadows = new SpriteBatch(scene, tex.boulder, rocks.length + 4, { order: ORDER.shadow, bias: 2.2 });
    const shadowOf = new Map<number, number>();
    for (const rock of rocks) {
      if (!rock.near) continue;
      const reach = 0.1 + rock.height * 0.2;
      const i = this.shadows.push(rock.x + SUN_X * reach, 0.01, rock.z + SUN_Z * reach, rock.size * 1.14, rock.size * 1.14, 0, 0, 0, 0, 0.34);
      if (rock.cracked >= 0) shadowOf.set(rock.cracked, i);
    }
    this.shadows.commit();
    // Highest beds first: they are drawn first, so the graphics card can skip the hidden parts of the beds below.
    const plainLayers = layers.filter((l) => l.rock === -1).sort((p, q) => q.y - p.y);
    this.boulders = new SpriteBatch(scene, tex.boulder, plainLayers.length + 4, { order: ORDER.boulder, kind: 'cut' });
    for (const l of plainLayers) this.pushRock(this.boulders, l, 0, 0, 1);
    this.boulders.commit();
    const scorpLayers = layers.filter((l) => l.rock >= 0);
    this.scorpionRocks = new SpriteBatch(scene, tex.boulder, scorpLayers.length + 4, { order: ORDER.boulder, kind: 'cut' });
    for (const l of scorpLayers) {
      this.pushRock(this.scorpionRocks, l, 0, 0, 1);
      const list = this.scorpLayers.get(l.rock) ?? [];
      list.push(l);
      this.scorpLayers.set(l.rock, list);
    }
    this.scorpionRocks.commit();
    // Cracked rocks: each remembers its layers so a Thunder Egg can take it away and leave rubble.
    const crackLayers = layers.filter((l) => l.rock <= -2);
    this.cracked = new SpriteBatch(scene, tex.rockCracked, crackLayers.length + 4, { order: ORDER.boulder, kind: 'cut' });
    this.rubble = new SpriteBatch(scene, tex.rubblePile, level.boulders.length + 4, { order: ORDER.nest });
    for (const l of crackLayers) {
      const key = -2 - l.rock;
      let slot = this.crackSlot.get(key);
      if (!slot) {
        slot = { layers: [], shadow: shadowOf.get(key) ?? -1, rubble: this.rubble.push(l.x, 0.015, l.z, 1.25, 1.25, hash2(key, 2) * TAU, 1, 1, 1, 0) };
        this.crackSlot.set(key, slot);
      }
      slot.layers.push(this.pushRock(this.cracked, l, 0, 0, 1));
    }
    this.cracked.commit(); this.rubble.commit();

    // --- thorns: a low tangle, four layers deep
    this.thorns = new SpriteBatch(scene, tex.thorns, level.thorns.length * THORN_LAYERS.length + 4, { order: ORDER.tuft, kind: 'cut', cut: 0.4 });
    this.ash = new SpriteBatch(scene, tex.thornsAsh, level.thorns.length + 4, { order: ORDER.nest });
    for (const t of level.thorns) {
      const key = t.r * W + t.c;
      const slot = { layers: [] as number[], ash: this.ash.push(t.c + 0.5, 0.014, t.r + 0.5, 1.2, 1.2, hash2(t.c, t.r) * TAU, 1, 1, 1, 0) };
      THORN_LAYERS.forEach((layer, k) => {
        const rot = Math.floor(hash2(t.c + k, t.r) * 4) * (Math.PI / 2);
        slot.layers.push(this.thorns.push(t.c + 0.5, layer.y, t.r + 0.5, 1.16 * layer.scale, 1.16 * layer.scale, rot, layer.tint, layer.tint, layer.tint, 1, 0, 0, 1, 1, 0.012 * k, hash2(t.c, t.r) * TAU));
      });
      this.thornSlot.set(key, slot);
      this.blobShadow(t.c + 0.5, t.r + 0.5, 1.5, 0.3);
    }
    this.thorns.commit(); this.ash.commit();

    // --- tufts: a mound of leaves with a couple of standing sprays, which hide a lizard from above and from behind
    // (The floor's are ferns; up in a canopy the same tiles are sprays of leaves.)
    [{ sheet: tex.tufts, up: tex.upTuft, high: false }, { sheet: tex.sprays, up: tex.upSpray, high: true }].forEach((art, set) => {
      const list = level.tufts.filter((t) => (level.deck[t.r * W + t.c] > 0) === art.high);
      if (!list.length) { this.tuftSets.push({ leaves: this.shadows, cards: [] }); return; }
      const tuftShadows = new SpriteBatch(scene, art.sheet, list.length + 4, { order: ORDER.shadow, bias: 2.4 });
      const leaves = new SpriteBatch(scene, art.sheet, list.length * TUFT_LAYERS.length + 4, { order: ORDER.tuft, kind: 'cut', cut: 0.42, hole: true });
      const cardBatches = art.up.map((t) => new SpriteBatch(scene, t, list.length * 2 + 4, { order: ORDER.tuft, kind: 'up', cut: 0.42, hole: true }));
      this.tuftSets.push({ leaves, cards: cardBatches });
      for (const t of list) {
        const [u, v, du, dv] = tuftUv(t.variant);
        const key = t.r * W + t.c;
        const slot = { set, layers: [] as number[], cards: [] as [number, number][] };
        tuftShadows.push(t.c + 0.5 + SUN_X * 0.22, 0.012, t.r + 0.5 + SUN_Z * 0.22, 1.5, 1.3, hash2(t.c, t.r) * TAU, 0, 0, 0, 0.3, u, v, du, dv);
        const grow = 0.94 + hash2(t.r, t.c) * 0.16;
        TUFT_LAYERS.forEach((layer, k) => {
          const rot = hash2(t.c, t.r) * TAU + k * 0.7;
          const size = grow * layer.scale;
          slot.layers.push(leaves.push(t.c + 0.5, layer.y * grow, t.r + 0.5, 1.4 * size, 1.2 * size, rot, layer.tint, layer.tint, layer.tint, 1, u, v, du, dv, layer.sway * 0.04, hash2(t.c * 3, t.r * 5) * TAU));
        });
        for (let k = 0; k < 2; k++) {
          const b = (t.variant + k) % cardBatches.length;
          const ox = (hash2(t.c + k * 7, t.r) - 0.5) * 0.5, oz = (hash2(t.r, t.c + k * 7) - 0.5) * 0.5;
          const h = (0.95 + hash2(t.c, t.r + k) * 0.3) * grow;
          slot.cards.push([b, cardBatches[b].push(t.c + 0.5 + ox, 0.02, t.r + 0.5 + oz, 1.25 * h, 1.12 * h, (hash2(k, key) - 0.5) * 0.16, 0.9, 0.9, 0.9, 1, 0, 0, 1, 1, 0.022, hash2(t.c * 3 + k, t.r * 5) * TAU)]);
        }
        this.tuftSlot.set(key, slot);
      }
      tuftShadows.commit(); leaves.commit(); cardBatches.forEach((b) => b.commit());
    });

    // --- long grass: fields of standing blades the lizard pushes through
    const blades = 7;
    const grass = new SpriteBatch(scene, tex.upGrass, level.grass.length * blades + 2400, { order: ORDER.tuft, kind: 'up', cut: 0.4 });
    const isGrass = (c: number, r: number) => level.inside(c, r) && level.cover[r * W + c] === 2;
    for (const g of level.grass) {
      this.blobShadow(g.c + 0.5, g.r + 0.5, 1.7, 0.26);
      for (let k = 0; k < blades; k++) {
        // Spread to the edge of the field, but not over the edge onto open ground.
        let x = g.c + hash2(g.c * 7 + k, g.r * 3), z = g.r + hash2(g.r * 5 + k, g.c * 11);
        if (!isGrass(Math.floor(x - 0.2), g.r)) x = Math.max(x, g.c + 0.22);
        if (!isGrass(Math.floor(x + 0.2), g.r)) x = Math.min(x, g.c + 0.78);
        if (!isGrass(g.c, Math.floor(z - 0.2))) z = Math.max(z, g.r + 0.22);
        if (!isGrass(g.c, Math.floor(z + 0.2))) z = Math.min(z, g.r + 0.78);
        const h = 0.78 + hash2(g.c + k, g.r * 9 + k) * 0.5;
        const shade = 0.82 + hash2(k, g.c + g.r) * 0.18;
        grass.push(x, 0, z, 0.56 * h, 1.08 * h, (hash2(k * 3, g.c - g.r) - 0.5) * 0.3, shade, shade, shade * 0.96, 1, Math.floor(hash2(g.c * 13 + k, g.r) * 4) / 4, 0, 0.25, 1, 0.03, hash2(x, z) * TAU);
      }
    }

    // --- standing scenery from the map, each with the shadow of its own shape lying on the ground
    const upKinds = Object.keys(tex.upProp) as (keyof typeof tex.upProp)[];
    for (const kind of upKinds) {
      const list = level.props.filter((p) => p.kind === kind);
      if (!list.length) continue;
      const [pw, ph] = level.theme.propSize[kind] ?? PROP_SIZE[kind];
      const cast = new SpriteBatch(scene, tex.upProp[kind], list.length + 1, { order: ORDER.shadow, bias: 1.4 });
      const body = new SpriteBatch(scene, tex.upProp[kind], list.length + 1, { order: ORDER.tuft, kind: 'up' });
      for (const p of list) {
        const s = 0.9 + hash2(p.c * 5, p.r * 3) * 0.25;
        const x = p.c + 0.5, z = p.r + 0.5, len = ph * s * 0.72;
        cast.push(x + SUN_X * len * 0.5, 0.012, z + SUN_Z * len * 0.5, pw * s, len, SUN_HEADING, 0, 0, 0, 0.3);
        body.push(x, 0, z, pw * s, ph * s, 0, 1, 1, 1, 1, hash2(p.c, p.r) > 0.5 ? 1 : 0, 0, hash2(p.c, p.r) > 0.5 ? -1 : 1, 1, kind === 'rockspire' ? 0 : 0.004, hash2(x, z) * TAU);
      }
      cast.commit(); body.commit();
    }
    // --- fallen logs: the bridges (which the rain moves, so they are redrawn by setLog) and the hollow ones
    if (level.logs.length) {
      this.logShadows = new SpriteBatch(scene, tex.log, level.logs.length + 1, { order: ORDER.shadow, bias: 2 });
      this.logs = new SpriteBatch(scene, tex.log, level.logs.length * LOG_LAYERS.length + 1, { order: ORDER.boulder, kind: 'cut' });
      level.logs.forEach((l, i) => this.setLog(i, l.spots[0].x, l.spots[0].z, 0, 0));
    }
    if (level.tunnels.length) {
      const hollow = new SpriteBatch(scene, tex.hollowLog, level.tunnels.length * 5 + 1, { order: ORDER.boulder, kind: 'cut' });
      const mouths = new SpriteBatch(scene, tex.logMouth, level.tunnels.length * 2 + 1, { order: ORDER.boulder, kind: 'cut' });
      for (const t of level.tunnels) {
        const dx = t.bx - t.ax, dz = t.bz - t.az, len = Math.hypot(dx, dz);
        const mx = (t.ax + t.bx) / 2, mz = (t.az + t.bz) / 2, heading = Math.atan2(dx, -dz) + Math.PI / 2;
        this.blobShadow(mx + SUN_X * 0.2, mz + SUN_Z * 0.2, len * 0.9, 0.3);
        // Fatter and taller than a bridge: the sheets go up to lizard-hiding height.
        for (let k = 0; k < 5; k++) {
          const f = k / 4, tint = 0.5 + 0.5 * f;
          hollow.push(mx, 0.06 + f * 0.62, mz, len - 0.72, 1.2 * (1 - 0.3 * f * f), heading, tint, tint, tint, 1);
        }
        // The dark way in, lying on the ground just inside each end.
        for (const [x, z] of [[t.ax, t.az], [t.bx, t.bz]]) {
          const ix = x + ((mx - x) / (len / 2)) * 0.52, iz = z + ((mz - z) / (len / 2)) * 0.52;
          mouths.push(ix, 0.05, iz, 0.9, 0.9, heading, 1, 1, 1, 1);
        }
      }
      hollow.commit(); mouths.commit();
    }

    const flat = (t: THREE.Texture, kind: PropKind, size: number) => {
      const list = level.props.filter((p) => p.kind === kind);
      if (!list.length) return;
      const b = new SpriteBatch(scene, t, list.length + 1, { order: ORDER.nest });
      for (const p of list) b.push(p.c + 0.5, 0.018, p.r + 0.5, size, size, hash2(p.c, p.r) * TAU);
      b.commit();
    };
    flat(tex.skull, 'skull', 1.25);
    flat(tex.bones, 'bones', 1.2);

    // --- small things nobody placed: pebbles, cracks in the mud, flowers, sprigs of dry grass
    const busy = new Uint8Array(W * H);
    for (const n of level.nests) busy[n.r * W + n.c] = 1;
    for (const b of level.burrows) busy[Math.floor(b.z) * W + Math.floor(b.x)] = 1;
    for (const n of level.powerNests) busy[Math.floor(n.z) * W + Math.floor(n.x)] = 1;
    const pebbles = new SpriteBatch(scene, tex.pebbles, 900, { order: ORDER.trail });
    const cracks = new SpriteBatch(scene, tex.cracks, 260, { order: ORDER.trail });
    const flowers = new SpriteBatch(scene, tex.flowers, 420, { order: ORDER.trail + 0.2 });
    const upFlowers = new SpriteBatch(scene, tex.upFlowers, 420, { order: ORDER.tuft, kind: 'up', cut: 0.4 });
    // (Up in a canopy the litter is leaves: a small spray lying here and there on the mats, nothing on the boughs.)
    const litter = new SpriteBatch(scene, tex.sprays, 400, { order: ORDER.trail });
    if (level.canopy) busy[Math.floor(level.canopy.door.z) * W + Math.floor(level.canopy.door.x)] = busy[Math.floor(level.canopy.hole.z) * W + Math.floor(level.canopy.hole.x)] = 1;
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      const k = r * W + c;
      if (!free(c, r) || busy[k]) continue;
      if (level.deck[k]) {
        if (level.deck[k] === 2 && !level.cover[k] && hash2(c * 3 + 1, r * 7 + 2) < 0.3 && litter.count < 396) {
          const [u, v, du, dv] = tuftUv(1 + Math.floor(hash2(c, r * 5) * 4)), size = 0.62 + hash2(c * 9, r) * 0.3;
          litter.push(c + 0.25 + hash2(c, r * 3) * 0.5, 0.008, r + 0.25 + hash2(c * 5, r) * 0.5, 1.17 * size, size, hash2(c, r) * TAU, 0.86, 0.86, 0.86, 0.9, u, v, du, dv);
        }
        continue;
      }
      const h = hash2(c * 3 + 1, r * 7 + 2), sandy = level.sand[k] === 1;
      const x = c + 0.2 + hash2(c, r * 3) * 0.6, z = r + 0.2 + hash2(c * 5, r) * 0.6;
      if (h < 0.2) pebbles.push(x, 0.008, z, 0.62, 0.62, h * 40, 1, 1, 1, sandy ? 0.75 : 0.9, Math.floor(h * 10) % 2 * 0.5, Math.floor(h * 20) % 2 * 0.5, 0.5, 0.5);
      else if (h < 0.26 && !sandy && !level.cover[k]) cracks.push(x, 0.006, z, 1.5, 1.5, h * 60, 1, 1, 1, 0.3);
      // Flowers gather near cover and at the foot of rocks; dry sprigs grow anywhere on scrub.
      const nearCover = level.isCover(c + 1, r) || level.isCover(c - 1, r) || level.isCover(c, r + 1) || level.isCover(c, r - 1);
      const nearRock = level.isSolid(c + 1, r) || level.isSolid(c - 1, r) || level.isSolid(c, r + 1) || level.isSolid(c, r - 1);
      const f = hash2(c * 11, r * 13);
      if (!sandy && f < (nearCover ? 0.34 : nearRock ? 0.16 : 0.035)) {
        const colour = Math.floor(hash2(Math.floor(c / 5), Math.floor(r / 5)) * 4);
        for (let n = 0; n < 3; n++) {
          const fx = c + 0.15 + hash2(c + n, r * 17) * 0.7, fz = r + 0.15 + hash2(c * 19, r + n) * 0.7;
          if (n === 0) flowers.push(fx, 0.01, fz, 0.5, 0.5, f * 30, 1, 1, 1, 1, (colour % 2) * 0.5, Math.floor(colour / 2) * 0.5, 0.5, 0.5);
          else upFlowers.push(fx, 0, fz, 0.2, 0.36 + hash2(n, k) * 0.14, (hash2(k, n) - 0.5) * 0.3, 1, 1, 1, 1, colour / 4, 0, 0.25, 1, 0.03, hash2(fx, fz) * TAU);
        }
      }
      if (!level.cover[k] && hash2(c * 23, r * 29) < (sandy ? 0.05 : 0.22)) {
        const n = 1 + Math.floor(hash2(c, r * 31) * 2);
        for (let i = 0; i < n; i++) {
          const gx = c + hash2(c * 37 + i, r), gz = r + hash2(c, r * 41 + i);
          const hgt = 0.26 + hash2(gx, gz) * 0.22;
          grass.push(gx, 0, gz, 0.5 * hgt, hgt, (hash2(i, k) - 0.5) * 0.4, 0.86, 0.84, 0.72, 1, Math.floor(hash2(k, i) * 4) / 4, 0, 0.25, 1, 0.03, hash2(gx, gz) * TAU);
        }
      }
    }
    [pebbles, cracks, flowers, upFlowers, grass, litter].forEach((b) => b.commit());

    // --- far mesas, standing in the dust beyond the rocks
    tex.upMesa.forEach((t, i) => {
      const img = t.image as { width: number; height: number };
      const aspect = img.width / Math.max(1, img.height);
      const b = new SpriteBatch(scene, t, 16, { order: ORDER.boulder, kind: 'up' });
      for (let k = 0; k < 9; k++) {
        const a = ((k + i / 3) / 9) * TAU + hash2(i, k) * 0.3;
        const reach = RING + 12 + hash2(k, i) * 10;
        const h = 9 + hash2(i * 3, k * 5) * 7;
        b.push(FW / 2 + Math.sin(a) * (FW * 0.5 + reach), 0, H / 2 - Math.cos(a) * (H * 0.5 + reach), h * aspect, h, 0, 0.92, 0.92, 0.92, 1);
      }
      b.commit();
    });
    this.blobStatic?.commit();
  }

  /** A soft round shadow that never moves (under a thorn bush, a patch of grass). */
  private blobStatic: SpriteBatch | null = null;
  private blobShadow(x: number, z: number, size: number, alpha: number) {
    // Made on first use (the scene is the parent of every other batch).
    if (!this.blobStatic) this.blobStatic = new SpriteBatch(this.burrows.mesh.parent!, null, 1200, { order: ORDER.trail + 0.5, shapes: true });
    this.blobStatic.push(x, 0.009, z, size, size, 0, 0, 0, 0, alpha, 0, 1.6, 0, 0);
  }

  private pushRock(batch: SpriteBatch, l: RockLayer, ox: number, oz: number, scale: number) {
    const lean = l.n > 1 ? l.k / (l.n - 1) : 0;
    const r = l.tint * (0.97 + l.warm * 0.08), g = l.tint * (0.96 + l.warm * 0.05), b = l.tint * (0.94 - l.warm * 0.04);
    return batch.push(l.x + ox * lean, l.y, l.z + oz * lean, l.w * scale, l.w * scale, l.rot, r, g, b, 1);
  }

  /** Shake and lift the rock over a scorpion (ox, oz: how far the top slides; scale: how much it swells). */
  moveScorpionRocks(offsets: Map<number, { ox: number; oz: number; scale: number }>) {
    this.scorpionRocks.clear();
    for (const [rock, list] of this.scorpLayers) {
      const o = offsets.get(rock);
      for (const l of list) this.pushRock(this.scorpionRocks, l, o?.ox ?? 0, o?.oz ?? 0, o?.scale ?? 1);
    }
    this.scorpionRocks.commit();
  }

  /** Put a bridge log where it is now: lodged (lift 0), or afloat and turning a little as it drifts. */
  setLog(i: number, x: number, z: number, lift: number, turn: number) {
    if (!this.logs || !this.logShadows) return;
    // The drawing lies east to west; a log across a north-south gap is turned a quarter.
    const l = this.level.logs[i], n = LOG_LAYERS.length, heading = (l.ns ? Math.PI / 2 : 0) + turn;
    this.logShadows.write(i, x + SUN_X * 0.14, 0.02, z + SUN_Z * 0.14, l.len + 0.6, 1.0, heading, 0, 0, 0, 0.36);
    LOG_LAYERS.forEach((layer, k) => {
      this.logs!.write(i * n + k, x, layer.y + lift * 0.05, z, l.len + 0.5, 0.86 * layer.wide, heading, layer.tint, layer.tint, layer.tint, 1);
    });
    this.logs.count = Math.max(this.logs.count, (i + 1) * n);
    this.logShadows.count = Math.max(this.logShadows.count, i + 1);
    this.logs.commit(); this.logShadows.commit();
  }

  /** A cracked rock is smashed: it goes, rubble stays. */
  breakRock(c: number, r: number) {
    const slot = this.crackSlot.get(r * this.level.w + c);
    if (!slot) return;
    for (const i of slot.layers) this.cracked.setAlpha(i, 0);
    this.rubble.setAlpha(slot.rubble, 1);
    if (slot.shadow >= 0) this.shadows.setAlpha(slot.shadow, 0);
    this.cracked.commitFx(); this.rubble.commitFx(); this.shadows.commitFx();
  }

  /** A thorn bush catches fire: it crumbles away over a moment and leaves ash. */
  burnThorns(c: number, r: number) {
    const key = r * this.level.w + c;
    if (this.thornSlot.has(key) && !this.burning.has(key)) this.burning.set(key, 1);
  }

  /** A new run: the broken rocks and burnt thorns are back. */
  resetBarriers() {
    for (const slot of this.crackSlot.values()) {
      for (const i of slot.layers) this.cracked.setAlpha(i, 1);
      this.rubble.setAlpha(slot.rubble, 0);
      if (slot.shadow >= 0) this.shadows.setAlpha(slot.shadow, 0.34);
    }
    this.burning.clear();
    for (const slot of this.thornSlot.values()) {
      slot.layers.forEach((i, k) => { this.thorns.setAlpha(i, 1); const t = THORN_LAYERS[k].tint; this.thorns.setTint(i, t, t, t); });
      this.ash.setAlpha(slot.ash, 0);
    }
    this.cracked.commitFx(); this.rubble.commitFx(); this.shadows.commitFx(); this.thorns.commitFx(); this.ash.commitFx();
  }

  /** Shake the tuft on a tile (something pushed through it). */
  rustle(c: number, r: number, amount: number) {
    const key = r * this.level.w + c;
    if (!this.tuftSlot.has(key)) return;
    this.rustling.set(key, Math.max(this.rustling.get(key) ?? 0, amount));
  }

  setNest(nest: Nest, hasEggs: boolean) {
    const slot = this.nestSlot.get(nest.id);
    if (!slot) return;
    slot.batch.setAlpha(slot.index, hasEggs ? 1 : 0);
    this.nestEmpty.setAlpha(slot.empty, hasEggs ? 0 : 1);
    slot.batch.commitFx();
    this.nestEmpty.commitFx();
  }

  pulseBurrow(i: number) { this.burrowPulse[i] = 1; }

  update(dt: number) {
    if (this.rustling.size) {
      for (const [key, amount] of this.rustling) {
        const next = amount - dt * 2.6;
        const slot = this.tuftSlot.get(key)!;
        const art = this.tuftSets[slot.set];
        slot.layers.forEach((i, k) => art.leaves.setFx(i, Math.max(0, next) * (0.5 + k * 0.3)));
        for (const [b, i] of slot.cards) art.cards[b].setFx(i, Math.max(0, next) * 0.8);
        if (next <= 0) this.rustling.delete(key); else this.rustling.set(key, next);
      }
      for (const art of this.tuftSets) if (art.cards.length) { art.leaves.commitFx(); art.cards.forEach((b) => b.commitFx()); }
    }
    if (this.burning.size) {
      for (const [key, left] of this.burning) {
        const next = left - dt * 1.7;
        const slot = this.thornSlot.get(key)!;
        // Charring from the top down, then gone.
        slot.layers.forEach((i, k) => {
          const a = Math.max(0, Math.min(1, next * 1.6 - (THORN_LAYERS.length - 1 - k) * 0.12));
          const t = THORN_LAYERS[k].tint * (0.25 + 0.75 * a);
          this.thorns.setAlpha(i, a);
          this.thorns.setTint(i, t + (1 - a) * 0.5, t * (0.6 + 0.4 * a), t * a);
        });
        this.ash.setAlpha(slot.ash, Math.min(1, (1 - next) * 1.4));
        if (next <= 0) this.burning.delete(key); else this.burning.set(key, next);
      }
      this.thorns.commitFx(); this.ash.commitFx();
    }
    let pulsing = false;
    this.level.burrows.forEach((b, i) => {
      if (this.burrowPulse[i] <= 0.001) return;
      pulsing = true;
      this.burrowPulse[i] = damp(this.burrowPulse[i], 0, 7, dt);
      const s = 1.9 * (1 + this.burrowPulse[i] * 0.16);
      this.burrows.write(i, b.x, 0.012, b.z, s, s, hash2(i, 7) * TAU);
    });
    if (pulsing) this.burrows.commit();
    const t = shared.uTime.value;
    if (this.fords && Math.abs(shared.uFlood.value - this.fordShown) > 0.01) {
      this.fordShown = shared.uFlood.value;
      for (let i = 0; i < this.fords.count; i++) this.fords.setAlpha(i, 1 - this.fordShown);
      this.fords.commitFx();
    }
    if (this.ants) {
      this.ants.clear();
      for (const path of this.antPaths) for (let i = 0, n = Math.ceil(path.len / 0.55); i < n; i++) {
        // Each ant is a set way along the file, which moves on; at the far end it is gone and another starts.
        let d = (t * 0.55 + i * 0.55) % path.len, k = 1;
        for (; k < path.pts.length - 1; k++) { const seg = Math.hypot(path.pts[k].x - path.pts[k - 1].x, path.pts[k].z - path.pts[k - 1].z); if (d <= seg) break; d -= seg; }
        const a = path.pts[k - 1], b = path.pts[k], seg = Math.hypot(b.x - a.x, b.z - a.z) || 1, u = Math.min(1, d / seg);
        const wig = Math.sin(t * 9 + i * 1.7) * 0.03;
        this.ants.push(a.x + (b.x - a.x) * u + ((b.z - a.z) / seg) * wig, 0.05, a.z + (b.z - a.z) * u - ((b.x - a.x) / seg) * wig, 0.34, 0.34, Math.atan2(b.x - a.x, -(b.z - a.z)) + wig * 3);
      }
      this.ants.commit();
    }
    for (const f of this.fireflies) {
      const blink = Math.max(0, Math.sin(t * f.rate + f.phase));
      if (blink < 0.05) continue;
      const x = f.x + Math.sin(t * 0.31 + f.phase) * 1.3 + Math.sin(t * 0.83 + f.phase * 2) * 0.4, z = f.z + Math.cos(t * 0.27 + f.phase * 1.7) * 1.3;
      this.glow.push(x, 0.05, z, 0.42, 0.42, 0, 0.89, 0.96, 0.42, blink * blink * 0.55, 0, 1.3, 0, 0);
      this.glow.push(x, 0.04, z, 1.6, 1.6, 0, 0.89, 0.96, 0.42, blink * blink * 0.08, 0, 1.3, 0, 0);
    }
  }

  /** The leaves part between the camera and the hidden lizard: where it is on the screen (0..1), how open (0..1). */
  setHole(sx: number, sy: number, amount: number, buffer: THREE.Vector2) {
    shared.uHole.value.set(sx * buffer.x, (1 - sy) * buffer.y, buffer.y * 0.085, amount);
  }
}
