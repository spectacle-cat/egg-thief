// Paper puppets. A bird here is one flat drawing seen from above. Cut it into strips, hinge the strips, and it can
// turn its head, cock its tail and beat its wings without a single new picture being drawn.
// The strips go to a SpriteBatch made with `tilt: true` (cards that can tip out of flat), or to a plain one for the
// shadow, where the same strips lie flat on the ground.
import type { SpriteBatch } from './gfx';

/** A strip: from `a` to `b` across the picture, 0..1 (down it for a spine, left to right for wings). */
export interface Cut { a: number; b: number }

/** Strips overlap by this much of the picture, so a bent joint shows no gap. (A shadow's don't: there it would show as a darker line.) */
const OVER = 0.012;

export interface Paint { r: number; g: number; b: number; a: number; u0: number; du: number }
export const PLAIN: Paint = { r: 1, g: 1, b: 1, a: 1, u0: 0, du: 1 };

/**
 * Strips down the length of a drawing, the head at the top. Strip `anchor` has its middle at (x, y, z); every other
 * strip hangs off its neighbour. yaw[i] turns strip i (added to heading); pitch[i] lifts its front end.
 * A cocked tail is a tail strip with a negative pitch: its front, at the hinge, is lower than its back.
 * With `flat` the strips stay on the ground and only turn (a shadow).
 */
export function spine(batch: SpriteBatch, cuts: Cut[], anchor: number, x: number, y: number, z: number, w: number, h: number, heading: number,
  yaw: number[], pitch: number[], p: Paint, flat = false) {
  let fx = 0, fy = 0, fz = 0;
  const fwd = (i: number) => {
    const hd = heading + yaw[i], pt = flat ? 0 : pitch[i], c = Math.cos(pt);
    fx = Math.sin(hd) * c; fy = Math.sin(pt); fz = -Math.cos(hd) * c;
  };
  const len = (i: number) => (cuts[i].b - cuts[i].a) * h;
  /** Draw strip i with its middle at (cx, cy, cz); fwd(i) has just been called. */
  const put = (i: number, cx: number, cy: number, cz: number) => {
    const over = flat ? 0 : OVER;
    const a = Math.max(0, cuts[i].a - over), b = Math.min(1, cuts[i].b + over);
    const back = ((a + b) / 2 - (cuts[i].a + cuts[i].b) / 2) * h; // the overlap may be lopsided: how far the card's middle moved tailward
    batch.push(cx - fx * back, cy - fy * back, cz - fz * back, w, (b - a) * h, heading + yaw[i], p.r, p.g, p.b, p.a, p.u0, 1 - b, p.du, b - a, 0, flat ? 0 : pitch[i]);
  };
  fwd(anchor);
  put(anchor, x, y, z);
  const half = len(anchor) / 2, ax = fx, ay = fy, az = fz;
  // Toward the head.
  let jx = x + ax * half, jy = y + ay * half, jz = z + az * half;
  for (let i = anchor - 1; i >= 0; i--) {
    fwd(i);
    const l = len(i);
    put(i, jx + fx * l / 2, jy + fy * l / 2, jz + fz * l / 2);
    jx += fx * l; jy += fy * l; jz += fz * l;
  }
  // Toward the tail.
  jx = x - ax * half; jy = y - ay * half; jz = z - az * half;
  for (let i = anchor + 1; i < cuts.length; i++) {
    fwd(i);
    const l = len(i);
    put(i, jx - fx * l / 2, jy - fy * l / 2, jz - fz * l / 2);
    jx -= fx * l; jy -= fy * l; jz -= fz * l;
  }
}

/**
 * Strips across a drawing: a bird seen from above with its wings out. Strip `body` has its middle at (x, y, z); the
 * strips to its left and right are the wings, each hinged to the one inside it. left[k] and right[k] raise the k-th
 * strip out from the body (radians; negative is a downstroke). `bank` tips the whole bird, right wing up.
 * With `flat` nothing leaves the ground: a raised wing just looks shorter (a shadow).
 */
export function wings(batch: SpriteBatch, cuts: Cut[], body: number, x: number, y: number, z: number, w: number, h: number, heading: number,
  left: number[], right: number[], bank: number, p: Paint, flat = false) {
  const ch = Math.cos(heading), sh = Math.sin(heading);
  const wide = (i: number) => (cuts[i].b - cuts[i].a) * w;
  /** Strip i, its middle at (cx, cy, cz), rolled so its right edge is up by `roll`. */
  const put = (i: number, cx: number, cy: number, cz: number, roll: number) => {
    const over = flat ? 0 : OVER;
    const a = Math.max(0, cuts[i].a - over), b = Math.min(1, cuts[i].b + over);
    const c = Math.cos(roll), s = flat ? 0 : Math.sin(roll);
    const side = ((a + b) / 2 - (cuts[i].a + cuts[i].b) / 2) * w; // how far the card's middle moved to the right
    batch.push(cx + ch * c * side, cy + s * side, cz + sh * c * side, (b - a) * w * (flat ? c : 1), h, heading, p.r, p.g, p.b, p.a, a, 0, b - a, 1, flat ? 0 : roll, 0);
  };
  put(body, x, y, z, bank);
  const cb = Math.cos(bank), sb = flat ? 0 : Math.sin(bank), half = wide(body) / 2;
  // The right wing, outward.
  let jx = x + ch * cb * half, jy = y + sb * half, jz = z + sh * cb * half;
  for (let i = body + 1, k = 0; i < cuts.length; i++, k++) {
    const roll = bank + (right[k] ?? 0), c = Math.cos(roll), s = flat ? 0 : Math.sin(roll), l = wide(i);
    put(i, jx + ch * c * l / 2, jy + s * l / 2, jz + sh * c * l / 2, roll);
    jx += ch * c * l; jy += s * l; jz += sh * c * l;
  }
  // The left wing, outward. Raised by `up`, its left edge is the high one: the card rolls the other way.
  jx = x - ch * cb * half; jy = y - sb * half; jz = z - sh * cb * half;
  for (let i = body - 1, k = 0; i >= 0; i--, k++) {
    const up = (left[k] ?? 0) - bank, c = Math.cos(up), s = flat ? 0 : Math.sin(up), l = wide(i);
    put(i, jx - ch * c * l / 2, jy + s * l / 2, jz - sh * c * l / 2, -up);
    jx -= ch * c * l; jy += s * l; jz -= sh * c * l;
  }
}
