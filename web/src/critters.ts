// Small life that is there for the pleasure of it: beetles to snack on, butterflies that scatter when you run through
// them, tumbleweeds bowling across the dunes. None of it can hurt a lizard.
import type * as THREE from 'three';
import { ORDER, SpriteBatch } from './gfx';
import type { Level } from './level';
import type { Lizard } from './lizard';
import type { Particles } from './particles';
import type { Sound } from './audio';
import type { Textures, World } from './world';
import { TAU, angleDamp, clamp01, dirX, dirZ, dist, hash2, headingOf, type V2 } from './util';

interface Beetle { home: V2; pos: V2; heading: number; eaten: boolean; t: number; wait: number; tx: number; tz: number; step: number }
interface Butterfly { home: V2; x: number; y: number; z: number; phase: number; scare: number; ax: number; az: number; colour: number }
interface Weed { x: number; z: number; vx: number; vz: number; hop: number; size: number; roll: number }

export class Critters {
  readonly beetlesTotal: number;
  eaten = 0;
  /** A beetle was eaten: where, and how many that makes. */
  onEat: (x: number, z: number, n: number) => void = () => {};
  private beetles: Beetle[];
  private flies: Butterfly[] = [];
  private weeds: Weed[] = [];
  private beetleBatch: SpriteBatch;
  private flyBatch: SpriteBatch;
  private weedBatch: SpriteBatch;
  private flutterCd = 0;
  private tmp: V2 = { x: 0, z: 0 };
  /** The sandy part of the map (where tumbleweeds roll), as a box. */
  private sand = { x0: 0, z0: 0, x1: 0, z1: 0, any: false };

  constructor(scene: THREE.Object3D, private level: Level, tex: Textures) {
    this.beetles = level.beetles.map((b, i) => ({ home: { ...b }, pos: { ...b }, heading: hash2(i, 3) * TAU, eaten: false, t: 0, wait: hash2(i, 5) * 2, tx: b.x, tz: b.z, step: 0 }));
    this.beetlesTotal = this.beetles.length;
    this.beetleBatch = new SpriteBatch(scene, tex.beetle, this.beetles.length * 2 + 2, { order: ORDER.egg, kind: 'cut' });

    // Butterflies live beside cover, on scrub.
    const W = level.w, H = level.h;
    for (let r = 1; r < H - 1 && this.flies.length < 40; r++) for (let c = 1; c < W - 1; c++) {
      if (level.solid[r * W + c] || level.sand[r * W + c] || level.cover[r * W + c]) continue;
      const nearCover = level.isCover(c + 1, r) || level.isCover(c - 1, r) || level.isCover(c, r + 1) || level.isCover(c, r - 1);
      if (!nearCover || hash2(c * 17, r * 23) > 0.22) continue;
      this.flies.push({ home: { x: c + 0.5, z: r + 0.5 }, x: c + 0.5, y: 0.6, z: r + 0.5, phase: hash2(c, r) * 40, scare: 0, ax: 0, az: 0, colour: Math.floor(hash2(r, c) * 3) });
    }
    this.flyBatch = new SpriteBatch(scene, tex.butterfly, this.flies.length + 2, { order: ORDER.owl, kind: 'cut', cut: 0.4 });

    // Tumbleweeds: a handful, wherever there is sand.
    let x0 = W, z0 = H, x1 = 0, z1 = 0;
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (level.sand[r * W + c] && !level.solid[r * W + c]) { x0 = Math.min(x0, c); z0 = Math.min(z0, r); x1 = Math.max(x1, c + 1); z1 = Math.max(z1, r + 1); }
    if (x1 > x0) {
      this.sand = { x0, z0, x1, z1, any: true };
      const n = Math.min(6, Math.max(2, Math.round(((x1 - x0) * (z1 - z0)) / 90)));
      for (let i = 0; i < n; i++) this.weeds.push({ x: x0 + hash2(i, 1) * (x1 - x0), z: z0 + hash2(i, 2) * (z1 - z0), vx: 1.6 + hash2(i, 3) * 1.2, vz: (hash2(i, 4) - 0.5) * 0.8, hop: hash2(i, 5) * 3, size: 0.7 + hash2(i, 6) * 0.35, roll: 0 });
    }
    this.weedBatch = new SpriteBatch(scene, tex.tumbleweed, this.weeds.length + 2, { order: ORDER.tuft, kind: 'up', cut: 0.35 });
  }

  reset() {
    this.eaten = 0;
    for (const b of this.beetles) { b.eaten = false; b.pos.x = b.home.x; b.pos.z = b.home.z; }
  }

  update(dt: number, time: number, liz: Lizard, fx: Particles, sound: Sound, world: World, playing: boolean) {
    const lv = this.level;
    // --- beetles: potter about near home, scuttle off when a lizard comes, get eaten anyway
    this.beetleBatch.clear();
    for (const b of this.beetles) {
      if (b.eaten) continue;
      const d = dist(b.pos.x, b.pos.z, liz.pos.x, liz.pos.z);
      if (playing && liz.alive && d < 0.44) {
        b.eaten = true; this.eaten++;
        this.onEat(b.pos.x, b.pos.z, this.eaten);
        continue;
      }
      let speed = 0;
      if (dt > 0) {
        const scared = playing && liz.alive && d < 2.1 && dist(b.pos.x, b.pos.z, b.home.x, b.home.z) < 1.5;
        if (scared) {
          b.heading = angleDamp(b.heading, headingOf(b.pos.x - liz.pos.x, b.pos.z - liz.pos.z), 9, dt);
          speed = 1.7;
        } else {
          b.wait -= dt;
          if (b.wait <= 0) { b.wait = 1.2 + Math.random() * 2.4; const a = Math.random() * TAU, r = Math.random() * 0.7; b.tx = b.home.x + Math.sin(a) * r; b.tz = b.home.z + Math.cos(a) * r; }
          if (dist(b.pos.x, b.pos.z, b.tx, b.tz) > 0.08) { b.heading = angleDamp(b.heading, headingOf(b.tx - b.pos.x, b.tz - b.pos.z), 6, dt); speed = 0.55; }
        }
        if (speed) { lv.moveCircle(b.pos, dirX(b.heading) * speed * dt, dirZ(b.heading) * speed * dt, 0.13); b.step += speed * dt * 9; }
      }
      const frame = Math.floor(b.step) & 1;
      world.blobs.push(b.pos.x + 0.03, 0.015, b.pos.z + 0.03, 0.34, 0.34, 0, 0, 0, 0, 0.3, 0, 1.5, 0, 0);
      this.beetleBatch.push(b.pos.x, 0.045, b.pos.z, 0.36, 0.36, b.heading, 0.5, 0.5, 0.5, 1, frame * 0.5, 0, 0.5, 1);
      this.beetleBatch.push(b.pos.x, 0.075, b.pos.z, 0.36, 0.36, b.heading, 1, 1, 1, 1, frame * 0.5, 0, 0.5, 1);
    }
    this.beetleBatch.commit();

    // --- butterflies: a slow wander round home, up and away when startled
    this.flutterCd = Math.max(0, this.flutterCd - dt);
    this.flyBatch.clear();
    for (const f of this.flies) {
      const d = dist(f.x, f.z, liz.pos.x, liz.pos.z);
      if (playing && liz.alive && liz.speed > 2 && d < 1.3 && f.scare <= 0) {
        f.scare = 2.6;
        const a = headingOf(f.x - liz.pos.x, f.z - liz.pos.z) + (Math.random() - 0.5);
        f.ax = dirX(a); f.az = dirZ(a);
        if (this.flutterCd <= 0) { sound.play('flutter'); this.flutterCd = 0.35; }
      }
      f.phase += dt;
      const t = f.phase;
      let tx = f.home.x + Math.sin(t * 0.7) * 0.9 + Math.sin(t * 1.9) * 0.3, tz = f.home.z + Math.cos(t * 0.53) * 0.9, ty = 0.55 + Math.sin(t * 2.3) * 0.16;
      if (f.scare > 0) {
        f.scare -= dt;
        const k = clamp01(f.scare / 2.6), out = Math.sin(k * Math.PI);
        tx += f.ax * 3.2 * out; tz += f.az * 3.2 * out; ty += 1.4 * out;
      }
      const hx = tx - f.x, hz = tz - f.z;
      const e = 1 - Math.exp(-(f.scare > 0 ? 6 : 2.5) * dt);
      f.x += hx * e; f.z += hz * e; f.y += (ty - f.y) * e;
      const frame = Math.floor(t * (f.scare > 0 ? 16 : 9)) & 1;
      const tint = f.colour === 0 ? [1, 1, 1] : f.colour === 1 ? [1, 0.86, 0.6] : [0.82, 0.92, 1];
      world.blobs.push(f.x + f.y * 0.2, 0.015, f.z + f.y * 0.16, 0.22, 0.22, 0, 0, 0, 0, 0.16, 0, 1.5, 0, 0);
      this.flyBatch.push(f.x, f.y, f.z, 0.3, 0.3, headingOf(hx, hz) + Math.sin(t * 5) * 0.3, tint[0], tint[1], tint[2], 1, frame * 0.5, 0, 0.5, 1);
    }
    this.flyBatch.commit();

    // --- tumbleweeds: blown across the sand, bouncing off what they meet, hopping as they go
    this.weedBatch.clear();
    const s = this.sand;
    for (const w of this.weeds) {
      if (dt > 0) {
        w.vx += (2.1 - w.vx) * dt * 0.5; // the wind keeps pushing them east
        w.vz += Math.sin(time * 0.3 + w.size * 9) * dt * 0.4;
        const px = w.x, pz = w.z;
        this.tmp.x = w.x; this.tmp.z = w.z;
        if (lv.moveCircle(this.tmp, w.vx * dt, w.vz * dt, 0.3)) {
          // Hit something: glance off it.
          if (Math.abs(this.tmp.x - px) < Math.abs(w.vx * dt) * 0.5) w.vx *= -0.6;
          if (Math.abs(this.tmp.z - pz) < Math.abs(w.vz * dt) * 0.5) w.vz = -w.vz + (Math.random() - 0.5);
          if (dist(w.x, w.z, liz.pos.x, liz.pos.z) < 9) { fx.burst('stepSand', w.x, w.z, { scale: 3 }); sound.play('tumble'); }
        }
        w.x = this.tmp.x; w.z = this.tmp.z;
        w.hop += dt * (2.2 + Math.abs(w.vx));
        w.roll += Math.hypot(w.vx, w.vz) * dt;
        if (w.x > s.x1 + 2 || w.z < s.z0 - 2 || w.z > s.z1 + 2 || !lv.isSand(Math.floor(w.x), Math.floor(w.z)) && w.x > s.x0 + 2 && Math.random() < dt * 0.6) {
          // Off the far side: another comes in on the wind.
          w.x = s.x0 + 0.5; w.z = s.z0 + 1 + Math.random() * (s.z1 - s.z0 - 2); w.vx = 1.6 + Math.random() * 1.2; w.vz = (Math.random() - 0.5) * 0.8;
          for (let tries = 0; tries < 12 && lv.isSolid(Math.floor(w.x), Math.floor(w.z)); tries++) { w.x += 1; w.z = s.z0 + 1 + Math.random() * (s.z1 - s.z0 - 2); }
        }
        // A lizard running into one sends it flying.
        const d = dist(w.x, w.z, liz.pos.x, liz.pos.z);
        if (playing && liz.alive && d < 0.6 && liz.speed > 2) { w.vx += liz.vel.x * 0.5; w.vz += liz.vel.z * 0.5; w.hop = 0; fx.burst('stepSand', w.x, w.z, { scale: 4 }); sound.play('tumble'); }
      }
      const y = Math.abs(Math.sin(w.hop)) * 0.28;
      world.blobs.push(w.x + 0.1, 0.015, w.z + 0.08, w.size * (0.9 - y * 0.6), w.size * (0.9 - y * 0.6), 0, 0, 0, 0, 0.26, 0, 1.5, 0, 0);
      // It rolls: the picture flips and leans in turn, which the eye reads as tumbling.
      const q = Math.floor(w.roll * 1.6) & 3;
      this.weedBatch.push(w.x, y, w.z, w.size, w.size, Math.sin(w.roll * 3) * 0.12, 1, 1, 1, 1, q & 1 ? 1 : 0, q & 2 ? 1 : 0, q & 1 ? -1 : 1, q & 2 ? -1 : 1);
    }
    this.weedBatch.commit();
  }
}
