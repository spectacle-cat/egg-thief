// Hollow logs. Walk into one end and the lizard goes through unseen and comes out of the other.
// Some of them are somebody's home: a bird-eating spider sits just inside one mouth with the tips of its legs
// showing at the rim (the tell). Now and again it creeps out, feels about a couple of tiles from its log and
// backs in again. While it is out the log is free; while it is home, going in is a mistake.
import * as THREE from 'three';
import { ORDER, SpriteBatch } from './gfx';
import type { Ctx } from './hunters';
import type { Level, Tunnel } from './level';
import type { Textures } from './world';
import { angleToward, clamp01, damp, dirX, dirZ, dist, headingOf, type V2 } from './util';

const CRAWL = 6.5;     // tiles a second through a log
const REACH = 2.2;     // how far from its doorstep a spider goes
type SpiderState = 'home' | 'out' | 'feel' | 'back' | 'stun';

class Spider {
  state: SpiderState = 'home';
  pos: V2;
  heading: number;
  threat = 0;
  /** 0 tucked in .. 1 about to come out: how much the legs at the rim are moving. */
  itch = 0;
  private t = 0;
  private wait: number;
  private target: V2 = { x: 0, z: 0 };
  private ux: number; private uz: number;
  private den: V2;
  private lunging = false;
  private linger = 0;
  private walk = 0;

  constructor(readonly tunnel: Tunnel, private index: number, private level: Level) {
    const len = Math.hypot(tunnel.ax - tunnel.bx, tunnel.az - tunnel.bz) || 1;
    this.ux = (tunnel.ax - tunnel.bx) / len; this.uz = (tunnel.az - tunnel.bz) / len;
    this.den = { x: tunnel.ax - this.ux * 1.05, z: tunnel.az - this.uz * 1.05 };
    this.pos = { ...this.den };
    this.heading = headingOf(this.ux, this.uz);
    this.wait = 5 + ((index * 3.7) % 4);
  }

  get home() { return this.state === 'home'; }
  /** The rim it sits behind, and which way is out. */
  get rimX() { return this.tunnel.ax - this.ux * 0.42; }
  get rimZ() { return this.tunnel.az - this.uz * 0.42; }
  get out() { return headingOf(this.ux, this.uz); }
  get step() { return this.walk; }

  reset() { this.state = 'home'; this.t = 0; this.wait = 5 + ((this.index * 3.7) % 4); this.pos = { ...this.den }; this.heading = this.out; this.itch = 0; this.lunging = false; }
  stun(seconds: number) { this.state = 'stun'; this.t = -seconds; this.lunging = false; }

  /** Somewhere to feel about: ahead of the door, or off to one side of it, as far as there is room. */
  private pick() {
    const base = this.out;
    const order = [0, 0.65, -0.65, 1.2, -1.2].sort(() => Math.random() - 0.5);
    for (const off of order) for (let far = REACH - 0.2; far >= 1; far -= 0.5) {
      const x = this.tunnel.ax + dirX(base + off) * far, z = this.tunnel.az + dirZ(base + off) * far;
      if (this.level.raycast(this.tunnel.ax, this.tunnel.az, x, z) >= 1 && !this.level.isSolid(Math.floor(x), Math.floor(z))) { this.target.x = x; this.target.z = z; return; }
    }
    this.target.x = this.tunnel.ax; this.target.z = this.tunnel.az;
  }

  private move(dt: number, tx: number, tz: number, speed: number, face: boolean) {
    const dx = tx - this.pos.x, dz = tz - this.pos.z, d = Math.hypot(dx, dz);
    if (face && d > 0.05) this.heading = angleToward(this.heading, headingOf(dx, dz), 7 * dt);
    const s = Math.min(d, speed * dt);
    if (d > 1e-4) { this.pos.x += (dx / d) * s; this.pos.z += (dz / d) * s; }
    this.walk += s * 5;
    return d - s < 0.06;
  }

  update(dt: number, ctx: Ctx, lizardInHere: boolean) {
    const liz = ctx.lizard, t = this.tunnel;
    this.t += dt;
    this.threat = 0;
    const dLiz = dist(this.pos.x, this.pos.z, liz.pos.x, liz.pos.z);
    const dDoor = dist(t.ax, t.az, liz.pos.x, liz.pos.z);
    const seen = liz.alive && !liz.inside && liz.ghost < 0.5;
    if (dDoor < 5) ctx.hint('spider');
    switch (this.state) {
      case 'home': {
        this.wait -= dt;
        // Something scuffling about on the doorstep brings it out sooner.
        this.linger = seen && dDoor < 1.5 ? this.linger + dt : 0;
        if (this.linger > 1.1) this.wait = Math.min(this.wait, 0.6);
        this.itch = damp(this.itch, this.wait < 1.4 ? 1 : 0.15 + 0.2 * Math.max(0, Math.sin(ctx.time * 0.9 + this.index * 2)), 6, dt);
        if (this.wait <= 0 && !lizardInHere) {
          this.state = 'out'; this.t = 0; this.pick(); this.lunging = false;
          if (dDoor < 9) ctx.sound.play('spiderOut');
        }
        break;
      }
      case 'out':
      case 'feel': {
        this.threat = dLiz < 4 ? 0.45 : 0;
        // Anything that moves within reach, it goes for; but never far from its own door.
        const inReach = seen && dLiz < 1.8 && dDoor < REACH + 0.2;
        if (inReach) { this.lunging = true; this.state = 'out'; this.target.x = liz.pos.x; this.target.z = liz.pos.z; this.threat = 1; ctx.mark('!', this.pos.x, 0.9, this.pos.z); }
        else if (this.lunging) { this.lunging = false; this.state = 'feel'; this.t = 0.8; }
        if (this.state === 'out') {
          if (this.move(dt, this.target.x, this.target.z, this.lunging ? 3.6 : 1.5, true) && !this.lunging) { this.state = 'feel'; this.t = 0; }
        } else {
          this.heading += Math.sin(this.t * 3.1) * 1.3 * dt;
          this.walk += dt * 3;
          if (this.t > 2.0) { this.state = 'back'; this.t = 0; }
        }
        break;
      }
      case 'back': {
        // Backing in: it keeps facing the way it came.
        this.threat = dLiz < 3 ? 0.3 : 0;
        const door = dist(this.pos.x, this.pos.z, t.ax, t.az) > 0.12 && dist(this.pos.x, this.pos.z, this.den.x, this.den.z) > 1.1;
        this.heading = angleToward(this.heading, door ? headingOf(this.pos.x - t.ax, this.pos.z - t.az) : this.out, 5 * dt);
        if (this.move(dt, door ? t.ax : this.den.x, door ? t.az : this.den.z, 1.9, false) && !door) {
          this.state = 'home'; this.t = 0; this.wait = 7 + Math.random() * 4; this.heading = this.out;
          if (dDoor < 9) ctx.sound.play('spiderIn');
          if (lizardInHere) ctx.catchLizard('spider', this.pos.x, this.pos.z);
        }
        break;
      }
      case 'stun':
        this.heading += Math.sin(this.t * 9) * 1.2 * dt;
        if (this.t > 0) { this.state = 'back'; this.t = 0; }
        break;
    }
    if (this.state !== 'home' && this.state !== 'stun' && liz.alive && !liz.inside && dLiz < 0.62) {
      const got = ctx.catchLizard('spider', this.pos.x, this.pos.z);
      if (got === 'burnt') { this.stun(3); ctx.fx.burst('poof', this.pos.x, this.pos.z); }
      else if (got !== 'none') { this.state = 'back'; this.t = 0; this.lunging = false; }
    }
  }
}

export class Tunnels {
  /** 0 calm .. 1 a spider is on you. */
  danger = 0;
  private spiders: Spider[] = [];
  private body: SpriteBatch; private legs: SpriteBatch;
  private crawl: { t: Tunnel; from: 0 | 1; u: number } | null = null;
  private cool = 0;

  constructor(scene: THREE.Object3D, private level: Level, tex: Textures) {
    level.tunnels.forEach((t, i) => { if (t.spider) this.spiders.push(new Spider(t, i, level)); });
    this.body = new SpriteBatch(scene, tex.spider, this.spiders.length * 2 + 1, { order: ORDER.scorpion, kind: 'cut' });
    this.legs = new SpriteBatch(scene, tex.spiderLegs, this.spiders.length + 1, { order: ORDER.scorpion, kind: 'cut' });
  }

  get crawling() { return !!this.crawl; }
  /** For tests: what each spider is doing. */
  spiderStates() { return this.spiders.map((s) => ({ state: s.state, x: +s.pos.x.toFixed(2), z: +s.pos.z.toFixed(2) })); }

  reset() { this.spiders.forEach((s) => s.reset()); this.crawl = null; this.cool = 0; }

  stunNear(x: number, z: number, radius: number, seconds: number): number {
    let n = 0;
    for (const s of this.spiders) if (!s.home && dist(s.pos.x, s.pos.z, x, z) < radius) { s.stun(seconds); n++; }
    return n;
  }

  private through(dt: number, ctx: Ctx, playing: boolean) {
    const liz = ctx.lizard;
    this.cool = Math.max(0, this.cool - dt);
    const c = this.crawl;
    if (c) {
      const t = c.t;
      const x0 = c.from ? t.bx : t.ax, z0 = c.from ? t.bz : t.az, x1 = c.from ? t.ax : t.bx, z1 = c.from ? t.az : t.bz;
      c.u += (dt * CRAWL) / (Math.hypot(x1 - x0, z1 - z0) || 1);
      const u = clamp01(c.u);
      liz.pos.x = x0 + (x1 - x0) * u; liz.pos.z = z0 + (z1 - z0) * u;
      liz.heading = headingOf(x1 - x0, z1 - z0);
      if (u >= 1 || !liz.alive) {
        this.crawl = null; this.cool = 0.7;
        liz.inside = false; liz.frozen = false;
        if (liz.alive) {
          liz.place(x1, z1, liz.heading);
          ctx.fx.burst('step', x1, z1, { scale: 3 });
          ctx.sound.play('rustle');
        }
      }
      return;
    }
    if (!playing || !liz.alive || liz.frozen || liz.dashing || this.cool > 0) return;
    // Going in is pushing at the mouth, not arriving at speed: a lizard stopped against the log gets in too.
    const sp = Math.hypot(liz.push.x, liz.push.z);
    if (sp < 0.3) return;
    for (const t of this.level.tunnels) for (const from of [0, 1] as const) {
      const mx = from ? t.bx : t.ax, mz = from ? t.bz : t.az, ox = from ? t.ax : t.bx, oz = from ? t.az : t.bz;
      const len = Math.hypot(ox - mx, oz - mz) || 1, dx = (ox - mx) / len, dz = (oz - mz) / len;
      if (dist(liz.pos.x, liz.pos.z, mx + dx * 0.3, mz + dz * 0.3) > 0.42 || (liz.push.x * dx + liz.push.z * dz) / sp < 0.45) continue;
      // Somebody home? Then it is a bite, not a short cut (a ghost goes straight past; a lizard on fire sends it packing).
      const spider = this.spiders.find((s) => s.tunnel === t && s.home);
      if (spider) {
        const got = ctx.catchLizard('spider', spider.rimX, spider.rimZ);
        if (got === 'tail' || got === 'dead') { this.cool = 1.2; ctx.sound.play('spiderOut'); return; }
        if (got === 'burnt') spider.stun(3);
      }
      this.crawl = { t, from, u: 0.3 / len };
      liz.inside = true; liz.frozen = true;
      ctx.sound.play('tunnel');
      ctx.fx.burst('step', mx, mz, { scale: 3 });
      ctx.hint('tunnel');
      return;
    }
  }

  /** Move the spiders and whoever is in a log (dt may be 0: they are still drawn). */
  update(dt: number, ctx: Ctx, playing: boolean) {
    if (dt > 0) this.through(dt, ctx, playing);
    this.body.clear(); this.legs.clear();
    let danger = 0;
    for (const s of this.spiders) {
      if (dt > 0) s.update(dt, ctx, this.crawl?.t === s.tunnel);
      danger = Math.max(danger, s.threat);
      if (s.home) {
        // The tell: legs over the rim of its door, shifting; busier just before it comes out. The drawing lies on
        // the mouth of the log exactly (same size, same place), feet pointing out.
        const tw = Math.sin(ctx.time * (5 + s.itch * 16) + s.tunnel.ax) * 0.04 * (0.4 + s.itch);
        const mx = s.tunnel.ax - dirX(s.out) * (0.52 - s.itch * 0.1), mz = s.tunnel.az - dirZ(s.out) * (0.52 - s.itch * 0.1);
        this.legs.push(mx, 0.075, mz, 0.9 + tw, 0.9 + s.itch * 0.08, s.out + Math.PI + tw, 1, 1, 1, 1);
        continue;
      }
      // A rigid body that rocks from foot to foot (the legs are part of the drawing until they are drawn apart).
      const rock = Math.sin(s.step) * 0.07;
      ctx.world.blobs.push(s.pos.x + 0.05, 0.02, s.pos.z + 0.05, 1.3, 1.3, 0, 0, 0, 0, 0.32, 0, 1.4, 0, 0);
      this.body.push(s.pos.x, 0.1, s.pos.z, 1.3, 1.3, s.heading + rock, 0.5, 0.5, 0.5, 1);
      this.body.push(s.pos.x, 0.16 + Math.abs(Math.sin(s.step)) * 0.02, s.pos.z, 1.3, 1.3, s.heading + rock, 1, 1, 1, 1);
    }
    this.body.commit(); this.legs.commit();
    this.danger = danger;
  }
}
