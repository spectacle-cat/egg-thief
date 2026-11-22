// A level is a Tiled map (.tmj, JSON). Tiled is the level editor: this file is the only place that knows its format.
//
// What the game reads from a map:
//   tile layers (any number, any names): a tile is known by its image's file name
//     scrub / sand                      the ground under everything
//     boulder                           solid rock
//     boulder_scorpion                  solid rock with a scorpion under it
//     rock_cracked                      solid rock that a Thunder Egg shatters
//     thorns                            a bramble wall: nobody walks through it, everybody sees through it; a Chili Egg burns it
//     tuft_1..4                         cover: the lizard is hidden under it
//     grass                             long grass: cover you can run through
//     cactus_1..3, agave, deadtree      standing scenery, in the way but not blocking sight;  rockspire: blocks both
//     skull, bones                      lying about, just for looks
//     nest_egg_1..3, nest_clutch        a nest with one egg (three colours) or three
//     nest_thunder | nest_ghost | nest_chili | nest_rattle    a nest with a power egg (it grows back after use)
//     nest_gold                         the hidden golden egg
//     beetle                            a snack
//     burrow_start, burrow, burrow_exit where the lizard starts, banks eggs, and leaves
//   object layers:
//     a polygon (a loop) or polyline (there and back) with class roadrunner | hawk | owl: that hunter's route
//       custom properties: speed (tiles a second), phase (0..1, where on the loop it starts)
//     any object with class sentry: a roadrunner that stands guard there
//       custom properties: facing (compass degrees: 0 up the map, 90 right), sweep (degrees it looks each way)
//     a rectangle with class zone: an area, named, with a "mood" property (the light there)
//     a polyline with class log: a fallen log across a stream. Its points are the places it can lodge (the first is
//       where it starts); when the rain comes it floats on to the next. Properties: length (tiles), across ("ew" | "ns")
//     a polyline with class ants: a file of leafcutter ants walks along it, end to end (only to look at)
//     a two-point polyline with class hollow_log: a tunnel from one mouth to the other. Property: spider (true | false)
//   map properties: title, par_seconds, theme (desert | rainforest), dry_seconds and rain_seconds (0: it never rains)
//
// Another place calls its tiles by its own names (theme.ts): a rainforest's buttress is a boulder, its fern a tuft,
// its coati a roadrunner. It also has water, on any tile layer:
//     water      a stream: always there. Nothing walks through it; a lizard in mid-dash skims over one tile of it.
//     flood      a bank: dry ground until it rains, then water
//     ford       shallows: wade across until it rains, then water
// And a map may have an upper deck (a forest's canopy), drawn in a far corner of the same grid:
//     mat                               leaf mat: the ground up there
//     bough_ns | bough_ew               a bough to walk along;  fork_n | _e | _s | _w  a T (named for the way its stem
//                                       points), with a cup for a nest;  tip_n | _e | _s | _w  a dead end
//     gap                               nothing: step off and fall to the floor underneath, unharmed
//     hollow_door, knothole             the way up (on the floor) and the way back down (up top): one of each.
//                                       The canopy lies over the floor so that the knothole is straight above the door
//     giant                             the foot of the hollow tree (solid; the tree itself stands behind the door)
//     beyond                            the ground between the floor and the canopy's corner (nobody goes there)
//   a rectangle with class canopy marks the canopy's corner of the grid; map property floor_width: how many columns
//   (from the left) are the forest floor
import { themeOf, type Theme } from './theme';
import { clamp, type V2 } from './util';

export type RouteType = 'roadrunner' | 'hawk' | 'owl';
export interface Route { type: RouteType; name: string; pts: V2[]; closed: boolean; speed?: number; phase: number }
export interface Zone { name: string; mood: string; x0: number; z0: number; x1: number; z1: number }
export interface Nest { id: number; x: number; z: number; c: number; r: number; eggs: number[]; clutch: boolean }
export interface Burrow { x: number; z: number; kind: 'start' | 'stash' | 'exit' }
export interface Tuft { c: number; r: number; variant: number }
export interface Boulder { c: number; r: number; scorpion: boolean; cracked: boolean }
export type PowerKind = 'thunder' | 'ghost' | 'chili' | 'rattle';
export const POWERS: PowerKind[] = ['thunder', 'ghost', 'chili', 'rattle'];
export interface PowerNest { id: number; x: number; z: number; kind: PowerKind }
export type PropKind = 'cactus_1' | 'cactus_2' | 'cactus_3' | 'agave' | 'deadtree' | 'rockspire' | 'skull' | 'bones';
export interface Prop { c: number; r: number; kind: PropKind }
export interface Sentry { x: number; z: number; facing: number; sweep: number; name: string }
/** A fallen log that bridges a stream. It lies along the row (ns false) or the column (ns true), centred on a spot. */
export interface LogBridge { name: string; spots: V2[]; len: number; ns: boolean }
/** A hollow log: in at one mouth, out at the other. The tiles between are the log itself. */
export interface Tunnel { name: string; ax: number; az: number; bx: number; bz: number; spider: boolean }
/** A piece of bough lying on a tile: turn is quarter turns clockwise from the way it is drawn (north to south; stem south; tip north). */
export interface Bough { c: number; r: number; piece: 'bough' | 'fork' | 'tip'; turn: number }
/** The canopy's corner of the grid, and how far it is from the floor beneath it (floor = canopy - dx, dz). */
export interface Canopy { x0: number; z0: number; x1: number; z1: number; dx: number; dz: number; door: V2; hole: V2; /** The mats and boughs, with a tile to spare all round. */ box: { x0: number; z0: number; x1: number; z1: number } }
export const DECK = { ground: 0, gap: 1, mat: 2, bough: 3 } as const;
/** Who is moving: a walker stops at water; a lizard may cross a log; a lizard in mid-dash skims over water too. */
export type Mover = 'walker' | 'lizard' | 'skim';
export const WATER = { stream: 1, flood: 2, ford: 3 } as const;
const SOLID_PROPS = new Set(['cactus_1', 'cactus_2', 'cactus_3', 'agave', 'deadtree', 'rockspire']);

interface TiledProp { name: string; value: unknown }
interface TiledObject {
  name?: string; type?: string; class?: string; x: number; y: number; width?: number; height?: number; rotation?: number;
  polygon?: { x: number; y: number }[]; polyline?: { x: number; y: number }[]; properties?: TiledProp[];
}
interface TiledLayer { type: string; name: string; data?: number[]; objects?: TiledObject[]; width?: number; height?: number }
interface TiledTileset { firstgid: number; source?: string; tiles?: { id: number; image?: string }[] }
interface TiledMap {
  width: number; height: number; tilewidth: number; tileheight: number; infinite?: boolean;
  layers: TiledLayer[]; tilesets: TiledTileset[]; properties?: TiledProp[];
}

const FLIP_MASK = 0x1fffffff; // Tiled keeps flip flags in the top bits of a tile number

export class Level {
  title = 'Egg Thief';
  parSeconds = 300;
  theme: Theme = themeOf('desert');
  /** How long a dry spell and a downpour last, in seconds (0: it never rains here). */
  drySeconds = 0;
  rainSeconds = 0;
  w = 0;
  h = 0;
  /** Can't be walked through: rock, standing scenery, and water as it stands now. */
  solid = new Uint8Array(0);
  /** The part of that which is not water (rock, roots, trunks). */
  hard = new Uint8Array(0);
  /** Water on the map: WATER.stream, flood or ford (0: none). */
  water = new Uint8Array(0);
  /** Deep water right now: streams always, banks and fords while it rains. */
  wet = new Uint8Array(0);
  /** A log lies across this tile right now. */
  bridge = new Uint8Array(0);
  flooded = false;
  logs: LogBridge[] = [];
  tunnels: Tunnel[] = [];
  /** Where files of ants walk (only to look at). */
  trails: V2[][] = [];
  /** The upper deck, where a map has one: DECK.ground the ground as ever, gap, mat or bough. */
  deck = new Uint8Array(0);
  boughs: Bough[] = [];
  /** Tiles that are solid with nothing drawn on them (the foot of the hollow tree, the ground beyond the floor). */
  giant: { c: number; r: number }[] = [];
  canopy: Canopy | null = null;
  /** How many columns, from the left, are the floor (the whole map where there is no canopy). */
  floorW = 0;
  /** Floor tiles nobody can walk to even with the water gone: a fall never lands there. */
  sealed = new Uint8Array(0);
  /** Can't be seen through (rock: thorns and cactus are solid but not this). */
  opaque = new Uint8Array(0);
  /** 1 under a tuft, 2 in long grass. */
  cover = new Uint8Array(0);
  sand = new Uint8Array(0);
  /** 1 a cracked rock, 2 thorns: what a power can clear away. */
  barrier = new Uint8Array(0);
  boulders: Boulder[] = [];
  tufts: Tuft[] = [];
  grass: { c: number; r: number }[] = [];
  thorns: { c: number; r: number }[] = [];
  props: Prop[] = [];
  powerNests: PowerNest[] = [];
  gold: V2 | null = null;
  beetles: V2[] = [];
  sentries: Sentry[] = [];
  nests: Nest[] = [];
  burrows: Burrow[] = [];
  routes: Route[] = [];
  zones: Zone[] = [];
  start: V2 = { x: 1.5, z: 1.5 };
  totalEggs = 0;
  private fields = new Map<number, Int16Array>();
  private hard0 = new Uint8Array(0);
  private opaque0 = new Uint8Array(0);

  /** Remember the map as built, so a new run can put the broken rocks and burnt thorns back. */
  seal() { this.hard0 = this.hard.slice(); this.opaque0 = this.opaque.slice(); }
  restore() { this.hard.set(this.hard0); this.opaque.set(this.opaque0); this.setFlood(false); }
  /** A cracked rock or thorn bush is cleared away. */
  clearTile(c: number, r: number) {
    if (!this.inside(c, r)) return;
    const k = r * this.w + c;
    this.hard[k] = 0; this.solid[k] = this.wet[k] | (this.deck[k] === DECK.gap ? 1 : 0); this.opaque[k] = 0;
    this.fields.clear();
  }

  /** The water rises (banks and fords go under) or falls back to its streams. */
  setFlood(on: boolean) {
    this.flooded = on;
    for (let k = 0; k < this.water.length; k++) {
      const w = this.water[k];
      this.wet[k] = w === WATER.stream || (on && w > 0) ? 1 : 0;
      this.solid[k] = this.hard[k] | this.wet[k] | (this.deck[k] === DECK.gap ? 1 : 0);
    }
    this.fields.clear();
  }

  /** Is this spot up in the canopy's corner of the map? */
  upTop(x: number) { return this.canopy !== null && x >= this.canopy.x0; }
  /** Where the canopy ends and the floor begins, for things that show only one of them (far to the right where there is no canopy). */
  get splitX() { return this.canopy ? this.canopy.x0 - 3 : 1e9; }
  /** The part of the map this spot is on, for a small map of it: the floor, or the canopy's mats and boughs. */
  part(x: number) {
    const c = this.canopy;
    return c && x >= c.x0 ? c.box : { x0: 0, z0: 0, x1: this.floorW, z1: this.h };
  }

  /** Is there nothing under this spot (a gap in the canopy)? Not until it is a little way out: the leaves at the edge hold. */
  overGap(x: number, z: number, in_ = 0.14) {
    if (!this.canopy) return false;
    const gap = (px: number, pz: number) => { const c = Math.floor(px), r = Math.floor(pz); return this.inside(c, r) && this.deck[r * this.w + c] === DECK.gap; };
    return gap(x - in_, z - in_) && gap(x + in_, z - in_) && gap(x - in_, z + in_) && gap(x + in_, z + in_);
  }

  /** Where something that falls from this spot in the canopy comes down: the nearest open, dry floor to straight below. */
  landing(x: number, z: number, out: V2): V2 {
    const cn = this.canopy;
    out.x = this.start.x; out.z = this.start.z;
    if (!cn) return out;
    const fx = clamp(x - cn.dx, 0.5, this.floorW - 0.5), fz = clamp(z - cn.dz, 0.5, this.h - 0.5);
    let best = Infinity;
    const c0 = Math.floor(fx), r0 = Math.floor(fz);
    for (let reach = 0; reach < 14 && best === Infinity; reach += 2) {
      for (let r = r0 - reach - 1; r <= r0 + reach + 1; r++) for (let c = c0 - reach - 1; c <= c0 + reach + 1; c++) {
        if (c < 0 || r < 0 || c >= this.floorW || r >= this.h) continue;
        const k = r * this.w + c;
        if (this.hard[k] || this.water[k] || this.deck[k] || this.sealed[k]) continue;
        const d = Math.hypot(c + 0.5 - fx, r + 0.5 - fz);
        if (d < best) { best = d; out.x = c + 0.5; out.z = r + 0.5; }
      }
    }
    return out;
  }

  /** Where the logs lie now (each centred on x, z): those tiles can be crossed by a lizard. */
  setBridges(spans: { x: number; z: number; len: number; ns: boolean }[]) {
    this.bridge.fill(0);
    for (const s of spans) {
      const c0 = Math.floor(s.x), r0 = Math.floor(s.z), half = (s.len - 1) / 2;
      for (let i = -Math.floor(half); i <= Math.ceil(half); i++) {
        const c = s.ns ? c0 : c0 + i, r = s.ns ? r0 + i : r0;
        if (this.inside(c, r)) this.bridge[r * this.w + c] = 1;
      }
    }
  }

  /** Is this spot open water (nothing to stand on)? */
  inWater(x: number, z: number) {
    const c = Math.floor(x), r = Math.floor(z);
    if (!this.inside(c, r)) return false;
    const k = r * this.w + c;
    return this.wet[k] === 1 && this.bridge[k] === 0;
  }

  /** Can this mover not enter the tile? */
  blocks(c: number, r: number, who: Mover) {
    if (!this.inside(c, r)) return true;
    const k = r * this.w + c;
    if (who === 'walker') return this.solid[k] === 1;
    return this.hard[k] === 1 || (who === 'lizard' && this.wet[k] === 1 && this.bridge[k] === 0);
  }
  /** 1 a cracked rock, 2 thorns, 0 neither (or already cleared). */
  barrierAt(c: number, r: number) { return this.inside(c, r) && this.solid[r * this.w + c] ? this.barrier[r * this.w + c] : 0; }

  inside(c: number, r: number) { return c >= 0 && r >= 0 && c < this.w && r < this.h; }
  isSolid(c: number, r: number) { return !this.inside(c, r) || this.solid[r * this.w + c] === 1; }
  isOpaque(c: number, r: number) { return !this.inside(c, r) || this.opaque[r * this.w + c] === 1; }
  isCover(c: number, r: number) { return this.inside(c, r) && this.cover[r * this.w + c] > 0; }
  isSand(c: number, r: number) { return this.inside(c, r) && this.sand[r * this.w + c] === 1; }

  /** Is this spot hidden? In long grass anywhere on the tile; under a tuft near enough to the middle that the leaves cover a lizard. */
  coverAt(x: number, z: number, reach = 0.62): boolean {
    const c0 = Math.floor(x), r0 = Math.floor(z);
    if (this.inside(c0, r0) && this.cover[r0 * this.w + c0] === 2) return true;
    for (let r = r0 - 1; r <= r0 + 1; r++) for (let c = c0 - 1; c <= c0 + 1; c++) {
      if (this.inside(c, r) && this.cover[r * this.w + c] === 1 && Math.hypot(x - (c + 0.5), z - (r + 0.5)) < reach) return true;
    }
    return false;
  }

  zoneAt(x: number, z: number): Zone | null {
    for (const zone of this.zones) if (x >= zone.x0 && x < zone.x1 && z >= zone.z0 && z < zone.z1) return zone;
    return null;
  }

  /**
   * Move a circle, sliding along rocks. Changes pos; returns true if it touched one.
   * Long moves are cut into short steps so a dash can't tunnel through a corner.
   */
  moveCircle(pos: V2, dx: number, dz: number, radius: number, who: Mover = 'walker'): boolean {
    let hit = false;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (radius * 0.9)));
    for (let s = 0; s < steps; s++) {
      pos.x += dx / steps;
      pos.z += dz / steps;
      for (let pass = 0; pass < 2; pass++) {
        const c0 = Math.floor(pos.x - radius), c1 = Math.floor(pos.x + radius);
        const r0 = Math.floor(pos.z - radius), r1 = Math.floor(pos.z + radius);
        for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
          if (!this.blocks(c, r, who)) continue;
          const nx = clamp(pos.x, c, c + 1), nz = clamp(pos.z, r, r + 1);
          let ox = pos.x - nx, oz = pos.z - nz;
          const d = Math.hypot(ox, oz);
          if (d >= radius) continue;
          hit = true;
          if (d < 1e-6) {
            // The centre is inside the rock: push out by the nearest side.
            const l = pos.x - c, rr = c + 1 - pos.x, t = pos.z - r, b = r + 1 - pos.z;
            const m = Math.min(l, rr, t, b);
            if (m === l) pos.x = c - radius; else if (m === rr) pos.x = c + 1 + radius; else if (m === t) pos.z = r - radius; else pos.z = r + 1 + radius;
          } else {
            ox /= d; oz /= d;
            pos.x = nx + ox * radius;
            pos.z = nz + oz * radius;
          }
        }
      }
    }
    return hit;
  }

  /** How far a ray gets before a rock, as a share (0..1) of the way from a to b. A line of sight unless walk: then anything solid stops it. */
  raycast(ax: number, az: number, bx: number, bz: number, walk = false): number {
    const dx = bx - ax, dz = bz - az;
    let c = Math.floor(ax), r = Math.floor(az);
    const grid = walk ? this.solid : this.opaque, W = this.w, H = this.h;
    const blocked = (cc: number, rr: number) => cc < 0 || rr < 0 || cc >= W || rr >= H || grid[rr * W + cc] === 1;
    if (blocked(c, r)) return 0;
    const sc = dx > 0 ? 1 : -1, sr = dz > 0 ? 1 : -1;
    const tdx = dx !== 0 ? Math.abs(1 / dx) : Infinity, tdz = dz !== 0 ? Math.abs(1 / dz) : Infinity;
    let tx = dx !== 0 ? (dx > 0 ? c + 1 - ax : ax - c) * tdx : Infinity;
    let tz = dz !== 0 ? (dz > 0 ? r + 1 - az : az - r) * tdz : Infinity;
    for (let i = 0; i < 256; i++) {
      const t = Math.min(tx, tz);
      if (t >= 1) return 1;
      if (tx < tz) { c += sc; tx += tdx; } else { r += sr; tz += tdz; }
      if (blocked(c, r)) return t;
    }
    return 1;
  }

  /** Can one see the other? */
  los(ax: number, az: number, bx: number, bz: number) { return this.raycast(ax, az, bx, bz) >= 1; }

  /** A clear walk for something with a body (two rays, one each side). */
  losWide(ax: number, az: number, bx: number, bz: number, half: number): boolean {
    const dx = bx - ax, dz = bz - az;
    const len = Math.hypot(dx, dz) || 1;
    const nx = (-dz / len) * half, nz = (dx / len) * half;
    return this.raycast(ax + nx, az + nz, bx + nx, bz + nz, true) >= 1 && this.raycast(ax - nx, az - nz, bx - nx, bz - nz, true) >= 1;
  }

  /** Can this kind of walker never stand on tile k? (Path-finding: a lizard counts a lodged log as ground.) */
  private shut(k: number, who: Mover) { return who === 'walker' ? this.solid[k] === 1 : this.hard[k] === 1 || (this.wet[k] === 1 && !this.bridge[k]) || this.deck[k] === DECK.gap; }

  /** The other end of the hollow tree, if this tile is its door or its knothole (-1: neither). */
  private otherDoor(k: number): number {
    const cn = this.canopy;
    if (!cn) return -1;
    const a = Math.floor(cn.door.z) * this.w + Math.floor(cn.door.x), b = Math.floor(cn.hole.z) * this.w + Math.floor(cn.hole.x);
    return k === a ? b : k === b ? a : -1;
  }

  /** The far mouth of a hollow log whose near mouth is this tile (-1: none). One with a spider in it does not count as a way through. */
  private farMouth(k: number): number {
    for (const t of this.tunnels) {
      if (t.spider) continue;
      const a = Math.floor(t.az) * this.w + Math.floor(t.ax), b = Math.floor(t.bz) * this.w + Math.floor(t.bx);
      if (k === a) return b;
      if (k === b) return a;
    }
    return -1;
  }

  /** Steps to a tile from everywhere a walker can stand (kept, since hunters ask for the same few tiles).
   *  who 'lizard': logs are ground and a hollow log is a way through (for the stand-in player). */
  fieldTo(tc: number, tr: number, who: Mover = 'walker'): Int16Array {
    tc = clamp(tc, 0, this.w - 1); tr = clamp(tr, 0, this.h - 1);
    const key = tr * this.w + tc, slot = who === 'walker' ? key : key + this.w * this.h;
    let field = this.fields.get(slot);
    if (field) return field;
    field = new Int16Array(this.w * this.h).fill(-1);
    const queue = new Int32Array(this.w * this.h);
    let head = 0, tail = 0;
    field[key] = 0; queue[tail++] = key;
    while (head < tail) {
      const k = queue[head++];
      const c = k % this.w, r = (k - c) / this.w, d = field[k] + 1;
      if (c > 0 && !this.shut(k - 1, who) && field[k - 1] < 0) { field[k - 1] = d; queue[tail++] = k - 1; }
      if (c < this.w - 1 && !this.shut(k + 1, who) && field[k + 1] < 0) { field[k + 1] = d; queue[tail++] = k + 1; }
      if (r > 0 && !this.shut(k - this.w, who) && field[k - this.w] < 0) { field[k - this.w] = d; queue[tail++] = k - this.w; }
      if (r < this.h - 1 && !this.shut(k + this.w, who) && field[k + this.w] < 0) { field[k + this.w] = d; queue[tail++] = k + this.w; }
      if (who !== 'walker') {
        const far = this.farMouth(k); if (far >= 0 && field[far] < 0) { field[far] = d; queue[tail++] = far; }
        const up = this.otherDoor(k); if (up >= 0 && field[up] < 0) { field[up] = d; queue[tail++] = up; }
      }
    }
    if (this.fields.size > 64) this.fields.clear();
    this.fields.set(slot, field);
    return field;
  }

  /** The next spot to walk to on the way to a target, going round rocks. */
  stepToward(pos: V2, tx: number, tz: number, bodyHalf: number, out: V2, who: Mover = 'walker'): V2 {
    if (this.losWide(pos.x, pos.z, tx, tz, bodyHalf)) { out.x = tx; out.z = tz; return out; }
    const field = this.fieldTo(Math.floor(tx), Math.floor(tz), who);
    const c = Math.floor(pos.x), r = Math.floor(pos.z);
    const no = (nc: number, nr: number) => !this.inside(nc, nr) || this.shut(nr * this.w + nc, who);
    let best = -1, bc = c, br = r;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dc && !dr) continue;
      const nc = c + dc, nr = r + dr;
      if (no(nc, nr)) continue;
      if (dc && dr && (no(c + dc, r) || no(c, r + dr))) continue; // no squeezing past corners
      const d = field[nr * this.w + nc];
      if (d < 0) continue;
      const cost = d * 10 + (dc && dr ? 4 : 0);
      if (best < 0 || cost < best) { best = cost; bc = nc; br = nr; }
    }
    out.x = bc + 0.5; out.z = br + 0.5;
    // Through a hollow log, if that is the short way: walk into its mouth.
    if (who !== 'walker' && this.inside(c, r)) {
      const here = r * this.w + c, far = this.farMouth(here);
      if (far >= 0 && field[far] >= 0 && field[far] * 10 < (best < 0 ? Infinity : best)) {
        const fc = far % this.w, fr = (far - fc) / this.w;
        out.x = c + 0.5 + Math.sign(fc - c) * 0.9; out.z = r + 0.5 + Math.sign(fr - r) * 0.9;
      }
      // Up or down the hollow tree: stand in the middle of its door.
      const up = this.otherDoor(here);
      if (up >= 0 && field[up] >= 0 && field[up] * 10 < (best < 0 ? Infinity : best)) { out.x = c + 0.5; out.z = r + 0.5; }
    }
    return out;
  }
}

function prop(list: TiledProp[] | undefined, name: string): unknown {
  return list?.find((p) => p.name === name)?.value;
}

function baseName(path: string) {
  return path.replace(/\\/g, '/').split('/').pop()!.replace(/\.[a-z0-9]+$/i, '').toLowerCase();
}

export async function loadLevel(url: string): Promise<Level> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Couldn't load the level ${url} (${res.status})`);
  const map = (await res.json()) as TiledMap;
  if (map.infinite) throw new Error('This map is "infinite". In Tiled: Map > Map Properties > untick Infinite.');

  // Tile number -> what it is (from its image's name). External tilesets (.tsj) are fetched from beside the map.
  const kinds = new Map<number, string>();
  for (const set of map.tilesets) {
    let tiles = set.tiles;
    if (!tiles && set.source) {
      if (/\.tsx$/i.test(set.source)) throw new Error(`The tileset ${set.source} is XML. Export it from Tiled as JSON (.tsj), or embed it in the map.`);
      const r = await fetch(new URL(set.source, new URL(url, location.href)).href);
      if (!r.ok) throw new Error(`Couldn't load the tileset ${set.source}`);
      tiles = ((await r.json()) as TiledTileset).tiles;
    }
    for (const t of tiles ?? []) if (t.image) kinds.set(set.firstgid + t.id, baseName(t.image));
  }

  const lv = new Level();
  const W = (lv.w = map.width), H = (lv.h = map.height);
  lv.theme = themeOf(prop(map.properties, 'theme') as string | undefined);
  lv.drySeconds = Number(prop(map.properties, 'dry_seconds') ?? 0);
  lv.rainSeconds = Number(prop(map.properties, 'rain_seconds') ?? 0);
  const alias = lv.theme.tiles;
  lv.floorW = clamp(Number(prop(map.properties, 'floor_width') ?? W), 1, W);
  lv.deck = new Uint8Array(W * H);
  let door: V2 | null = null, hole: V2 | null = null;
  const TURNS: Record<string, number> = { n: 0, e: 1, s: 2, w: 3 };
  lv.water = new Uint8Array(W * H);
  lv.wet = new Uint8Array(W * H);
  lv.bridge = new Uint8Array(W * H);
  lv.solid = new Uint8Array(W * H);
  lv.opaque = new Uint8Array(W * H);
  lv.cover = new Uint8Array(W * H);
  lv.sand = new Uint8Array(W * H);
  lv.barrier = new Uint8Array(W * H);
  lv.title = String(prop(map.properties, 'title') ?? lv.title);
  lv.parSeconds = Number(prop(map.properties, 'par_seconds') ?? lv.parSeconds);
  const unknown = new Set<string>();

  for (const layer of map.layers) {
    if (layer.type === 'tilelayer') {
      if (!Array.isArray(layer.data)) throw new Error(`Layer "${layer.name}" is compressed. In Tiled: Map Properties > Tile Layer Format > CSV.`);
      for (let i = 0; i < W * H; i++) {
        const g = layer.data[i] & FLIP_MASK;
        if (!g) continue;
        const named = kinds.get(g);
        const c = i % W, r = Math.floor(i / W);
        if (!named) continue;
        const kind = alias[named] ?? named;
        if (kind === 'sand') lv.sand[i] = 1;
        else if (kind === 'scrub') lv.sand[i] = 0;
        else if (kind === 'water' || kind === 'flood' || kind === 'ford') lv.water[i] = WATER[kind === 'water' ? 'stream' : kind];
        else if (kind === 'mat') lv.deck[i] = DECK.mat;
        else if (kind === 'gap') lv.deck[i] = DECK.gap;
        else if (kind === 'bough_ns' || kind === 'bough_ew') { lv.deck[i] = DECK.bough; lv.boughs.push({ c, r, piece: 'bough', turn: kind === 'bough_ew' ? 1 : 0 }); }
        else if (/^fork_[nesw]$/.test(kind)) { lv.deck[i] = DECK.bough; lv.boughs.push({ c, r, piece: 'fork', turn: (TURNS[kind[5]] + 2) % 4 }); }
        else if (/^tip_[nesw]$/.test(kind)) { lv.deck[i] = DECK.bough; lv.boughs.push({ c, r, piece: 'tip', turn: TURNS[kind[4]] }); }
        else if (kind === 'hollow_door') door = { x: c + 0.5, z: r + 0.5 };
        else if (kind === 'knothole') hole = { x: c + 0.5, z: r + 0.5 };
        else if (kind === 'giant' || kind === 'beyond') { lv.solid[i] = 1; lv.opaque[i] = 1; if (kind === 'giant') lv.giant.push({ c, r }); }
        else if (kind === 'boulder' || kind === 'boulder_scorpion' || kind === 'rock_cracked') {
          lv.solid[i] = 1; lv.opaque[i] = 1;
          if (kind === 'rock_cracked') lv.barrier[i] = 1;
          lv.boulders.push({ c, r, scorpion: kind === 'boulder_scorpion', cracked: kind === 'rock_cracked' });
        } else if (kind === 'thorns') {
          lv.solid[i] = 1; lv.barrier[i] = 2;
          lv.thorns.push({ c, r });
        } else if (kind.startsWith('tuft')) {
          lv.cover[i] = 1;
          lv.tufts.push({ c, r, variant: clamp(parseInt(kind.slice(5), 10) || 1, 1, 4) });
        } else if (kind === 'grass') {
          lv.cover[i] = 2;
          lv.grass.push({ c, r });
        } else if (SOLID_PROPS.has(kind) || kind === 'skull' || kind === 'bones') {
          if (SOLID_PROPS.has(kind)) lv.solid[i] = 1;
          if (kind === 'rockspire') lv.opaque[i] = 1;
          lv.props.push({ c, r, kind: kind as PropKind });
        } else if (kind === 'nest_gold') lv.gold = { x: c + 0.5, z: r + 0.5 };
        else if (kind === 'beetle') lv.beetles.push({ x: c + 0.5, z: r + 0.5 });
        else if (kind.startsWith('nest_') && (POWERS as string[]).includes(kind.slice(5))) {
          lv.powerNests.push({ id: lv.powerNests.length, x: c + 0.5, z: r + 0.5, kind: kind.slice(5) as PowerKind });
        } else if (kind.startsWith('nest_egg')) {
          const type = clamp(parseInt(kind.slice(9), 10) || 1, 1, 3);
          lv.nests.push({ id: lv.nests.length, x: c + 0.5, z: r + 0.5, c, r, eggs: [type], clutch: false });
        } else if (kind === 'nest_clutch') {
          lv.nests.push({ id: lv.nests.length, x: c + 0.5, z: r + 0.5, c, r, eggs: [1, 3, 2], clutch: true });
        } else if (kind === 'burrow_start') {
          lv.burrows.push({ x: c + 0.5, z: r + 0.5, kind: 'start' });
          lv.start = { x: c + 0.5, z: r + 0.5 };
        } else if (kind === 'burrow') lv.burrows.push({ x: c + 0.5, z: r + 0.5, kind: 'stash' });
        else if (kind === 'burrow_exit') lv.burrows.push({ x: c + 0.5, z: r + 0.5, kind: 'exit' });
        else unknown.add(kind);
      }
    } else if (layer.type === 'objectgroup') {
      for (const o of layer.objects ?? []) {
        const cls = (o.type || o.class || '').toLowerCase();
        const tw = map.tilewidth, th = map.tileheight;
        if (cls === 'canopy') {
          lv.canopy = { x0: o.x / tw, z0: o.y / th, x1: (o.x + (o.width ?? 0)) / tw, z1: (o.y + (o.height ?? 0)) / th, dx: 0, dz: 0, door: { x: 0, z: 0 }, hole: { x: 0, z: 0 }, box: { x0: 0, z0: 0, x1: 0, z1: 0 } };
        } else if (cls === 'zone') {
          lv.zones.push({
            name: o.name || 'Somewhere', mood: String(prop(o.properties, 'mood') ?? 'morning'),
            x0: o.x / tw, z0: o.y / th, x1: (o.x + (o.width ?? 0)) / tw, z1: (o.y + (o.height ?? 0)) / th,
          });
        } else if (cls === 'log' && o.polyline?.length) {
          lv.logs.push({
            name: o.name || 'log', len: Number(prop(o.properties, 'length') ?? 3), ns: String(prop(o.properties, 'across') ?? 'ew') === 'ns',
            spots: o.polyline.map((p) => ({ x: (o.x + p.x) / tw, z: (o.y + p.y) / th })),
          });
        } else if (cls === 'hollow_log' && o.polyline && o.polyline.length >= 2) {
          const a = o.polyline[0], b = o.polyline[o.polyline.length - 1];
          lv.tunnels.push({
            name: o.name || 'hollow log', spider: prop(o.properties, 'spider') === true,
            ax: (o.x + a.x) / tw, az: (o.y + a.y) / th, bx: (o.x + b.x) / tw, bz: (o.y + b.y) / th,
          });
        } else if (cls === 'ants' && o.polyline && o.polyline.length >= 2) {
          lv.trails.push(o.polyline.map((p) => ({ x: (o.x + p.x) / tw, z: (o.y + p.y) / th })));
        } else if (cls === 'sentry' || cls === 'viper') {
          lv.sentries.push({
            x: (o.x + (o.width ?? 0) / 2) / tw, z: (o.y + (o.height ?? 0) / 2) / th, name: o.name || 'sentry',
            facing: (Number(prop(o.properties, 'facing') ?? 180) * Math.PI) / 180, sweep: (Number(prop(o.properties, 'sweep') ?? 50) * Math.PI) / 180,
          });
        } else if (cls === 'roadrunner' || cls === 'coati' || cls === 'hawk' || cls === 'owl') {
          const raw = o.polygon ?? o.polyline;
          if (!raw || raw.length < 2) continue;
          const speed = prop(o.properties, 'speed');
          lv.routes.push({
            type: cls === 'coati' ? 'roadrunner' : cls, name: o.name || cls, closed: !!o.polygon, phase: Number(prop(o.properties, 'phase') ?? 0),
            speed: speed === undefined ? undefined : Number(speed),
            pts: raw.map((p) => ({ x: (o.x + p.x) / tw, z: (o.y + p.y) / th })),
          });
        }
      }
    }
  }
  if (unknown.size) console.warn('[level] tiles the game does not know:', [...unknown].join(', '));
  if (!lv.burrows.some((b) => b.kind === 'start')) console.warn('[level] no burrow_start tile: starting in the corner');
  lv.totalEggs = lv.nests.reduce((n, nest) => n + nest.eggs.length, 0);
  // A hollow log is solid between its mouths, and nobody sees through it.
  for (const t of lv.tunnels) {
    const n = Math.round(Math.max(Math.abs(t.bx - t.ax), Math.abs(t.bz - t.az)));
    for (let i = 1; i < n; i++) {
      const c = Math.floor(t.ax + ((t.bx - t.ax) * i) / n), r = Math.floor(t.az + ((t.bz - t.az) * i) / n);
      if (lv.inside(c, r)) { lv.solid[r * W + c] = 1; lv.opaque[r * W + c] = 1; }
    }
  }
  // A canopy needs its corner of the map marked, a door below and a knothole above; without all three there is none.
  if (lv.canopy && door && hole) {
    const cn = lv.canopy, b = { x0: W, z0: H, x1: 0, z1: 0 };
    cn.door = door; cn.hole = hole; cn.dx = hole.x - door.x; cn.dz = hole.z - door.z;
    for (let i = 0; i < W * H; i++) if (lv.deck[i] >= DECK.mat) { const c = i % W, r = Math.floor(i / W); b.x0 = Math.min(b.x0, c); b.x1 = Math.max(b.x1, c + 1); b.z0 = Math.min(b.z0, r); b.z1 = Math.max(b.z1, r + 1); }
    cn.box = { x0: Math.max(cn.x0, b.x0 - 1), z0: Math.max(0, b.z0 - 1), x1: Math.min(W, b.x1 + 1), z1: Math.min(H, b.z1 + 1) };
  }
  else {
    if (lv.canopy || door || hole) console.warn('[level] a canopy needs a canopy rectangle, a hollow_door and a knothole: it has been left out');
    lv.canopy = null; lv.floorW = W; lv.deck.fill(0); lv.boughs = [];
  }
  lv.hard = lv.solid.slice();
  // Floor nobody could walk to even with every stream dry: behind vines, inside a ring of roots.
  lv.sealed = new Uint8Array(W * H).fill(1);
  {
    const todo = [Math.floor(lv.start.z) * W + Math.floor(lv.start.x)];
    lv.sealed[todo[0]] = 0;
    while (todo.length) {
      const k = todo.pop()!, c = k % W;
      for (const n of [c > 0 ? k - 1 : -1, c < W - 1 ? k + 1 : -1, k - W, k + W]) {
        if (n < 0 || n >= W * H || !lv.sealed[n] || lv.hard[n] || lv.deck[n]) continue;
        lv.sealed[n] = 0; todo.push(n);
      }
    }
  }
  lv.setBridges(lv.logs.map((l) => ({ ...l.spots[0], len: l.len, ns: l.ns })));
  lv.seal();
  lv.setFlood(false);
  return lv;
}
