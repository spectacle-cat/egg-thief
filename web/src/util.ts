// Small maths used everywhere. The ground is the XZ plane: x east, z south, one unit = one tile.

export interface V2 {
  x: number;
  z: number;
}

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Frame-rate independent smoothing: how far to go toward a target this frame. */
export const damp = (a: number, b: number, rate: number, dt: number) => a + (b - a) * (1 - Math.exp(-rate * dt));
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const dist = (ax: number, az: number, bx: number, bz: number) => Math.hypot(ax - bx, az - bz);

/** Headings are compass angles: 0 is north (-z), a quarter turn is east (+x). */
export const headingOf = (dx: number, dz: number) => Math.atan2(dx, -dz);
export const dirX = (heading: number) => Math.sin(heading);
export const dirZ = (heading: number) => -Math.cos(heading);

/** The shortest signed turn from a to b. */
export function angleDiff(a: number, b: number) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
export const angleDamp = (a: number, b: number, rate: number, dt: number) => a + angleDiff(a, b) * (1 - Math.exp(-rate * dt));
/** Turn from a toward b by at most maxStep. */
export function angleToward(a: number, b: number, maxStep: number) {
  const d = angleDiff(a, b);
  return Math.abs(d) <= maxStep ? b : a + Math.sign(d) * maxStep;
}

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t: number) => t * t * t;
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutBack = (t: number) => {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};
export const easeOutElastic = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1);

/** A repeatable 0..1 number for a tile (used to vary scenery the same way every run). */
export function hash2(x: number, y: number) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
export const pick = <T>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

/** Smooth 1D noise for camera shake and idle motion. */
export function noise1(t: number, seed = 0) {
  const i = Math.floor(t);
  const f = t - i;
  const a = hash2(i, seed) * 2 - 1;
  const b = hash2(i + 1, seed) * 2 - 1;
  return a + (b - a) * (f * f * (3 - 2 * f));
}

/** A closed or open path through points, walked at an even speed (Catmull-Rom, sampled once). */
export class Path {
  readonly length: number;
  private xs: number[] = [];
  private zs: number[] = [];
  private step: number;

  constructor(pts: V2[], readonly closed: boolean, smooth: boolean) {
    const n = pts.length;
    const at = (i: number) => (closed ? pts[((i % n) + n) % n] : pts[clamp(i, 0, n - 1)]);
    const fine: V2[] = [];
    const spans = closed ? n : n - 1;
    const per = smooth ? 24 : 1;
    for (let i = 0; i < spans; i++) {
      const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
      for (let k = 0; k < per; k++) {
        const t = k / per;
        if (!smooth) { fine.push({ x: p1.x, z: p1.z }); continue; }
        const t2 = t * t, t3 = t2 * t;
        fine.push({
          x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
          z: 0.5 * (2 * p1.z + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3),
        });
      }
    }
    fine.push(closed ? { ...fine[0] } : { ...pts[n - 1] });
    // Re-sample at even steps so "distance along the path" is simple.
    let total = 0;
    const acc = [0];
    for (let i = 1; i < fine.length; i++) { total += dist(fine[i].x, fine[i].z, fine[i - 1].x, fine[i - 1].z); acc.push(total); }
    this.length = total;
    const count = Math.max(2, Math.ceil(total / 0.1));
    this.step = total / count;
    let j = 0;
    for (let i = 0; i <= count; i++) {
      const d = i * this.step;
      while (j < acc.length - 2 && acc[j + 1] < d) j++;
      const span = acc[j + 1] - acc[j] || 1;
      const t = clamp01((d - acc[j]) / span);
      this.xs.push(lerp(fine[j].x, fine[j + 1].x, t));
      this.zs.push(lerp(fine[j].z, fine[j + 1].z, t));
    }
  }

  at(d: number, out: V2): V2 {
    const L = this.length;
    d = this.closed ? ((d % L) + L) % L : clamp(d, 0, L);
    const f = d / this.step;
    const i = Math.min(this.xs.length - 2, Math.floor(f));
    const t = f - i;
    out.x = lerp(this.xs[i], this.xs[i + 1], t);
    out.z = lerp(this.zs[i], this.zs[i + 1], t);
    return out;
  }

  headingAt(d: number): number {
    const a = this.at(d - 0.15, { x: 0, z: 0 });
    const b = this.at(d + 0.15, { x: 0, z: 0 });
    return headingOf(b.x - a.x, b.z - a.z);
  }

  /** The distance along the path nearest to a point. */
  nearest(x: number, z: number): number {
    let best = 0, bestD = Infinity;
    for (let i = 0; i < this.xs.length; i++) {
      const d = (this.xs[i] - x) ** 2 + (this.zs[i] - z) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    return best * this.step;
  }
}
