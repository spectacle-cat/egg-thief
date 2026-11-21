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
//   map properties: title, par_seconds
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
  w = 0;
  h = 0;
  /** Can't be walked through. */
  solid = new Uint8Array(0);
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
  private solid0 = new Uint8Array(0);
  private opaque0 = new Uint8Array(0);

  /** Remember the map as built, so a new run can put the broken rocks and burnt thorns back. */
  seal() { this.solid0 = this.solid.slice(); this.opaque0 = this.opaque.slice(); }
  restore() { this.solid.set(this.solid0); this.opaque.set(this.opaque0); this.fields.clear(); }
  /** A cracked rock or thorn bush is cleared away. */
  clearTile(c: number, r: number) {
    if (!this.inside(c, r)) return;
    const k = r * this.w + c;
    this.solid[k] = 0; this.opaque[k] = 0;
    this.fields.clear();
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
  moveCircle(pos: V2, dx: number, dz: number, radius: number): boolean {
    let hit = false;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (radius * 0.9)));
    for (let s = 0; s < steps; s++) {
      pos.x += dx / steps;
      pos.z += dz / steps;
      for (let pass = 0; pass < 2; pass++) {
        const c0 = Math.floor(pos.x - radius), c1 = Math.floor(pos.x + radius);
        const r0 = Math.floor(pos.z - radius), r1 = Math.floor(pos.z + radius);
        for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
          if (!this.isSolid(c, r)) continue;
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

  /** Steps to a tile from everywhere a walker can stand (kept, since hunters ask for the same few tiles). */
  fieldTo(tc: number, tr: number): Int16Array {
    tc = clamp(tc, 0, this.w - 1); tr = clamp(tr, 0, this.h - 1);
    const key = tr * this.w + tc;
    let field = this.fields.get(key);
    if (field) return field;
    field = new Int16Array(this.w * this.h).fill(-1);
    const queue = new Int32Array(this.w * this.h);
    let head = 0, tail = 0;
    field[key] = 0; queue[tail++] = key;
    while (head < tail) {
      const k = queue[head++];
      const c = k % this.w, r = (k - c) / this.w, d = field[k] + 1;
      if (c > 0 && !this.solid[k - 1] && field[k - 1] < 0) { field[k - 1] = d; queue[tail++] = k - 1; }
      if (c < this.w - 1 && !this.solid[k + 1] && field[k + 1] < 0) { field[k + 1] = d; queue[tail++] = k + 1; }
      if (r > 0 && !this.solid[k - this.w] && field[k - this.w] < 0) { field[k - this.w] = d; queue[tail++] = k - this.w; }
      if (r < this.h - 1 && !this.solid[k + this.w] && field[k + this.w] < 0) { field[k + this.w] = d; queue[tail++] = k + this.w; }
    }
    if (this.fields.size > 64) this.fields.clear();
    this.fields.set(key, field);
    return field;
  }

  /** The next spot to walk to on the way to a target, going round rocks. */
  stepToward(pos: V2, tx: number, tz: number, bodyHalf: number, out: V2): V2 {
    if (this.losWide(pos.x, pos.z, tx, tz, bodyHalf)) { out.x = tx; out.z = tz; return out; }
    const field = this.fieldTo(Math.floor(tx), Math.floor(tz));
    const c = Math.floor(pos.x), r = Math.floor(pos.z);
    let best = -1, bc = c, br = r;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dc && !dr) continue;
      const nc = c + dc, nr = r + dr;
      if (this.isSolid(nc, nr)) continue;
      if (dc && dr && (this.isSolid(c + dc, r) || this.isSolid(c, r + dr))) continue; // no squeezing past corners
      const d = field[nr * this.w + nc];
      if (d < 0) continue;
      const cost = d * 10 + (dc && dr ? 4 : 0);
      if (best < 0 || cost < best) { best = cost; bc = nc; br = nr; }
    }
    out.x = bc + 0.5; out.z = br + 0.5;
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
        const kind = kinds.get(g);
        const c = i % W, r = Math.floor(i / W);
        if (!kind) continue;
        if (kind === 'sand') lv.sand[i] = 1;
        else if (kind === 'scrub') lv.sand[i] = 0;
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
        if (cls === 'zone') {
          lv.zones.push({
            name: o.name || 'Somewhere', mood: String(prop(o.properties, 'mood') ?? 'morning'),
            x0: o.x / tw, z0: o.y / th, x1: (o.x + (o.width ?? 0)) / tw, z1: (o.y + (o.height ?? 0)) / th,
          });
        } else if (cls === 'sentry') {
          lv.sentries.push({
            x: (o.x + (o.width ?? 0) / 2) / tw, z: (o.y + (o.height ?? 0) / 2) / th, name: o.name || 'sentry',
            facing: (Number(prop(o.properties, 'facing') ?? 180) * Math.PI) / 180, sweep: (Number(prop(o.properties, 'sweep') ?? 50) * Math.PI) / 180,
          });
        } else if (cls === 'roadrunner' || cls === 'hawk' || cls === 'owl') {
          const raw = o.polygon ?? o.polyline;
          if (!raw || raw.length < 2) continue;
          const speed = prop(o.properties, 'speed');
          lv.routes.push({
            type: cls, name: o.name || cls, closed: !!o.polygon, phase: Number(prop(o.properties, 'phase') ?? 0),
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
  lv.seal();
  return lv;
}
