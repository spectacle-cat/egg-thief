// Paper puppets. A flying bird here is one flat drawing seen from above. Cut it into strips across the wings, hinge
// the strips, and it can beat its wings and lean into a turn without a single new picture being drawn.
// The strips go to a SpriteBatch made with `tilt: true` (cards that can tip out of flat), or to a plain one for the
// shadow, where the same strips lie flat on the ground.
// (The roadrunner was tried this way too, cut down its length with a head and tail that turned. It looked like a
// fish, and went back to its four drawings.)
import type { SpriteBatch } from './gfx';

/** A strip: from `a` to `b` across the picture, left to right, 0..1. */
export interface Cut { a: number; b: number }

/** Strips overlap by this much of the picture, so a bent joint shows no gap. (A shadow's don't: there it would show as a darker line.) */
const OVER = 0.012;

export interface Paint { r: number; g: number; b: number; a: number; u0: number; du: number }
export const PLAIN: Paint = { r: 1, g: 1, b: 1, a: 1, u0: 0, du: 1 };

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
