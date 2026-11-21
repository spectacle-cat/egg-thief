// The things that eat lizards. Each keeps the original game's idea and gains a tell, so being caught is always
// something the player could have read:
//   roadrunner  walks a beat with a cone of sight that rocks cut off; notices, then runs you down
//   scorpion    waits under a boulder that shifts now and then; rattles, then lunges at whoever steps beside it
//   owl         glides a fixed loop low over the ground; never look up, just don't be under it
//   hawk        circles high; anything in the open beneath it gets a screech and then a dive
import * as THREE from 'three';
import type { CameraRig } from './camera';
import { ORDER, SpriteBatch, shared } from './gfx';
import type { Level, Route, Sentry } from './level';
import type { Lizard, TailDecoy } from './lizard';
import type { Particles } from './particles';
import type { Sound } from './audio';
import type { Textures, World } from './world';
import { type Cut, type Paint, wings } from './puppet';
import { DEG, Path, TAU, angleDiff, angleToward, clamp, clamp01, damp, dirX, dirZ, dist, easeInCubic, easeOutCubic, hash2, headingOf, lerp, type V2 } from './util';

export interface Ctx {
  level: Level; lizard: Lizard; fx: Particles; sound: Sound; rig: CameraRig; world: World; decoy: TailDecoy;
  time: number;
  /** A Rattle Egg making its racket: walkers that hear it go and see. */
  lure: { x: number; z: number; active: boolean };
  /** Something got the lizard: 'tail' if it escaped by dropping its tail, 'dead', 'burnt' if it was too hot to bite, or 'none' (it can't be hurt just now). */
  catchLizard(by: string, x: number, z: number): 'tail' | 'dead' | 'none' | 'burnt';
  /** A "!" or "?" over a hunter this frame. */
  mark(kind: '!' | '?', x: number, y: number, z: number): void;
  hint(id: string): void;
  /** For the score: 'alarm' a hunter has seen the lizard and is after it; 'miss' something lunged and just missed. */
  note(what: 'alarm' | 'miss'): void;
}

const tmp: V2 = { x: 0, z: 0 };
const SUN_X = 0.2, SUN_Z = 0.16; // how far a shadow falls from under a thing, per tile of height

// Where the scissors go (see puppet.ts). Each flying bird is one drawing from above, cut into hinged strips so its
// wings can beat. (The roadrunner is not cut up: it runs in its own four drawings. Hinged, it looked like a fish.)
/** Across the owl and the hawk: left wing tip, left wing, body, right wing, right wing tip. */
const OWL_CUTS: Cut[] = [{ a: 0, b: 0.2 }, { a: 0.2, b: 0.385 }, { a: 0.385, b: 0.615 }, { a: 0.615, b: 0.8 }, { a: 0.8, b: 1 }];
const HAWK_CUTS: Cut[] = [{ a: 0, b: 0.22 }, { a: 0.22, b: 0.41 }, { a: 0.41, b: 0.59 }, { a: 0.59, b: 0.78 }, { a: 0.78, b: 1 }];
const paint: Paint = { r: 1, g: 1, b: 1, a: 1, u0: 0, du: 1 };
const setPaint = (tone: number, alpha: number, u0 = 0, du = 1) => { paint.r = paint.g = paint.b = tone; paint.a = alpha; paint.u0 = u0; paint.du = du; return paint; };
const wingL = [0, 0], wingR = [0, 0];

// ---------------------------------------------------------------------------------------------------------

const CONE_RAYS = 36;
const CONE_VERT = /* glsl */ `
attribute float aT;
varying float vT;
void main() { vT = aT; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`;
const CONE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
uniform float uTime;
varying float vT;
void main() {
  float a = (1.0 - vT * vT) * uAlpha;
  a *= 0.78 + 0.22 * sin(vT * 30.0 - uTime * 6.0);
  gl_FragColor = vec4(uColor * a, a);
}`;

type RunnerState = 'patrol' | 'suspect' | 'chase' | 'search' | 'look' | 'return' | 'peck' | 'gloat' | 'stun' | 'flee';

class Roadrunner {
  pos: V2;
  heading = 0;
  state: RunnerState = 'patrol';
  meter = 0;
  private wp = 0;
  private stateT = 0;
  private unseen = 0;
  private lastSeen: V2 = { x: 0, z: 0 };
  private anim = 0;
  private speedNow = 0;
  private lookBase = 0;
  private cone: THREE.Mesh;
  private conePos: Float32Array;
  private coneT: Float32Array;
  private coneMat: THREE.ShaderMaterial;
  private wasInTuft = -1;
  private seed: number;
  /** What it is pecking at: the dropped tail, or a Rattle Egg. */
  private bait: 'tail' | 'lure' = 'tail';
  private stunFor = 0;

  /** post: a sentry stands there and sweeps its gaze instead of walking a beat. */
  constructor(scene: THREE.Object3D, private route: Route, index: number, private post: Sentry | null = null) {
    this.seed = index * 7.3;
    this.pos = { ...route.pts[0] };
    this.wp = 1 % route.pts.length;
    this.heading = headingOf(route.pts[this.wp].x - this.pos.x, route.pts[this.wp].z - this.pos.z);
    const geo = new THREE.BufferGeometry();
    this.conePos = new Float32Array((CONE_RAYS + 2) * 3);
    this.coneT = new Float32Array(CONE_RAYS + 2);
    const idx: number[] = [];
    for (let i = 0; i < CONE_RAYS; i++) idx.push(0, i + 1, i + 2);
    geo.setIndex(idx);
    geo.setAttribute('position', new THREE.BufferAttribute(this.conePos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aT', new THREE.BufferAttribute(this.coneT, 1).setUsage(THREE.DynamicDrawUsage));
    this.coneMat = new THREE.ShaderMaterial({
      vertexShader: CONE_VERT, fragmentShader: CONE_FRAG,
      uniforms: { uColor: { value: new THREE.Vector3(1, 0.95, 0.7) }, uAlpha: { value: 0.3 }, uTime: shared.uTime },
      transparent: true, depthTest: true, depthWrite: false, premultipliedAlpha: true, side: THREE.DoubleSide,
    });
    this.cone = new THREE.Mesh(geo, this.coneMat);
    this.cone.frustumCulled = false;
    this.cone.renderOrder = ORDER.cone;
    scene.add(this.cone);
    if (post) this.heading = post.facing;
  }

  get dazed() { return this.state === 'stun'; }
  /** Knocked silly by a Thunder Egg. */
  stun(seconds: number) { if (this.state !== 'gloat') { this.stunFor = seconds; this.go('stun'); } }

  get threat() { return this.state === 'chase' ? 1 : this.state === 'search' ? 0.55 : this.state === 'suspect' ? 0.25 + this.meter * 0.35 : 0; }

  reset() {
    this.pos = { ...this.route.pts[0] };
    this.wp = 1 % this.route.pts.length;
    this.state = 'patrol'; this.meter = 0; this.stateT = 0;
    this.heading = this.post ? this.post.facing : headingOf(this.route.pts[this.wp].x - this.pos.x, this.route.pts[this.wp].z - this.pos.z);
  }

  private range() { return this.state === 'chase' ? 8.5 : this.post ? 7.2 : 5.4; }
  private halfAngle() { return (this.state === 'chase' ? 62 : this.post ? 27 : 33) * DEG; }
  private eyeX() { return this.pos.x + dirX(this.heading) * 0.55; }
  private eyeZ() { return this.pos.z + dirZ(this.heading) * 0.55; }

  private sees(ctx: Ctx): boolean {
    const liz = ctx.lizard;
    if (!liz.exposed || this.state === 'stun' || this.state === 'flee') return false;
    const dx = liz.pos.x - this.eyeX(), dz = liz.pos.z - this.eyeZ();
    const d = Math.hypot(dx, dz);
    if (d > this.range()) return false;
    // Close enough to hear, whichever way it is looking, once it is already after you.
    const near = this.state === 'chase' && d < 2.6;
    if (!near && Math.abs(angleDiff(this.lookHeading(ctx.time), headingOf(dx, dz))) > this.halfAngle()) return false;
    return ctx.level.los(this.eyeX(), this.eyeZ(), liz.pos.x, liz.pos.z);
  }

  /** Where the eyes point: on patrol the head sweeps a little from side to side. */
  private lookHeading(time: number) {
    return !this.post && (this.state === 'patrol' || this.state === 'return') ? this.heading + Math.sin(time * 1.4 + this.seed) * 0.22 : this.heading;
  }

  private walk(dt: number, tx: number, tz: number, speed: number, turn: number, ctx: Ctx) {
    ctx.level.stepToward(this.pos, tx, tz, 0.3, tmp);
    const want = headingOf(tmp.x - this.pos.x, tmp.z - this.pos.z);
    this.heading = angleToward(this.heading, want, turn * dt);
    const v = speed * clamp(Math.cos(angleDiff(this.heading, want)), 0.12, 1);
    ctx.level.moveCircle(this.pos, dirX(this.heading) * v * dt, dirZ(this.heading) * v * dt, 0.28);
    this.speedNow = v;
    this.anim += v * dt * 1.5;
    // Push through tufts noisily.
    const c = Math.floor(this.pos.x), r = Math.floor(this.pos.z), key = r * ctx.level.w + c;
    if (ctx.level.isCover(c, r) && key !== this.wasInTuft) { ctx.world.rustle(c, r, 0.7); this.wasInTuft = key; } else if (!ctx.level.isCover(c, r)) this.wasInTuft = -1;
  }

  private go(state: RunnerState) { this.state = state; this.stateT = 0; }

  update(dt: number, ctx: Ctx) {
    const liz = ctx.lizard;
    this.stateT += dt;
    this.speedNow = 0;
    const seeing = this.sees(ctx);
    const dLiz = dist(this.pos.x, this.pos.z, liz.pos.x, liz.pos.z);
    if (seeing) { this.lastSeen.x = liz.pos.x; this.lastSeen.z = liz.pos.z; this.unseen = 0; } else this.unseen += dt;

    // A Rattle Egg within earshot: nothing is more interesting.
    const lure = ctx.lure;
    if (lure.active && !(this.state === 'peck' && this.bait === 'lure') && this.state !== 'gloat' && this.state !== 'stun' && this.state !== 'flee'
      && dist(this.pos.x, this.pos.z, lure.x, lure.z) < 11) {
      this.bait = 'lure'; this.go('peck');
      ctx.sound.play('lure');
      ctx.fx.burst('ring', this.pos.x, this.pos.z);
    }

    switch (this.state) {
      case 'patrol': case 'return': {
        const target = this.route.pts[this.wp];
        if (this.post && dist(this.pos.x, this.pos.z, target.x, target.z) < 0.35) {
          // On guard: standing still, the gaze sweeping slowly from side to side.
          this.state = 'patrol';
          this.heading = angleToward(this.heading, this.post.facing + Math.sin(ctx.time * 0.62 + this.seed) * this.post.sweep, 2.4 * dt);
        } else {
          this.walk(dt, target.x, target.z, this.state === 'return' ? 3.0 : (this.route.speed ?? 2.3), 3.2, ctx);
          if (!this.post && dist(this.pos.x, this.pos.z, target.x, target.z) < 0.35) {
            this.state = 'patrol';
            this.wp = this.route.closed ? (this.wp + 1) % this.route.pts.length : this.wp + 1 >= this.route.pts.length ? 0 : this.wp + 1;
          }
        }
        if (seeing) {
          this.meter += dt * (1.5 + 3.0 * (1 - dLiz / this.range()));
          if (this.meter > 0.22) { this.go('suspect'); ctx.sound.play('suspect'); }
        } else this.meter = Math.max(0, this.meter - dt * 0.8);
        break;
      }
      case 'suspect': {
        this.heading = angleToward(this.heading, headingOf(this.lastSeen.x - this.pos.x, this.lastSeen.z - this.pos.z), 4.5 * dt);
        if (seeing) this.meter += dt * (1.5 + 3.0 * (1 - dLiz / this.range())); else this.meter -= dt * 0.55;
        ctx.mark('?', this.pos.x, 1.3, this.pos.z);
        if (this.meter >= 1) {
          this.go('chase');
          ctx.note('alarm');
          ctx.sound.play('spotted'); ctx.sound.play('runner');
          ctx.rig.zoomPunch(0.5);
          ctx.fx.burst('ringRed', this.pos.x, this.pos.z);
        } else if (this.meter <= 0) { this.meter = 0; this.go('patrol'); }
        break;
      }
      case 'chase': {
        this.meter = 1;
        ctx.mark('!', this.pos.x, 1.3, this.pos.z);
        this.walk(dt, this.lastSeen.x, this.lastSeen.z, 5.5, 5.2, ctx);
        if (Math.random() < dt * 9) ctx.fx.burst(ctx.level.isSand(Math.floor(this.pos.x), Math.floor(this.pos.z)) ? 'stepSand' : 'step', this.pos.x - dirX(this.heading) * 0.5, this.pos.z - dirZ(this.heading) * 0.5);
        if (this.unseen > 1.0) { this.go('search'); ctx.sound.play('lost'); }
        break;
      }
      case 'search': {
        // It goes to where it last saw the lizard. If the lizard is still sitting there, leaves or no leaves, it has it.
        ctx.mark('?', this.pos.x, 1.3, this.pos.z);
        this.walk(dt, this.lastSeen.x, this.lastSeen.z, 4.0, 4.5, ctx);
        if (seeing) { this.go('chase'); ctx.sound.play('spotted'); }
        else if (dist(this.pos.x, this.pos.z, this.lastSeen.x, this.lastSeen.z) < 0.5 || this.stateT > 4) { this.go('look'); this.lookBase = this.heading; }
        break;
      }
      case 'look': {
        ctx.mark('?', this.pos.x, 1.3, this.pos.z);
        this.heading = this.lookBase + Math.sin(this.stateT * 2.6) * 1.1;
        if (seeing) { this.go('chase'); ctx.sound.play('spotted'); }
        else if (this.stateT > 2.4) { this.meter = 0; this.go('return'); this.wp = this.nearestWaypoint(); }
        break;
      }
      case 'peck': {
        // Busy with the tail that was left behind, or with a Rattle Egg.
        const b = this.bait === 'lure' ? lure : ctx.decoy;
        const d = dist(this.pos.x, this.pos.z, b.x, b.z);
        if (d > 0.8) { this.walk(dt, b.x, b.z, this.bait === 'lure' ? 4.4 : 3.5, 5, ctx); if (this.bait === 'lure') ctx.mark('?', this.pos.x, 1.3, this.pos.z); }
        else {
          this.heading = angleToward(this.heading, headingOf(b.x - this.pos.x, b.z - this.pos.z), 6 * dt);
          this.anim += dt * 9;
          if (Math.floor(this.stateT * 5) !== Math.floor((this.stateT - dt) * 5)) ctx.sound.play('peck');
        }
        if ((this.bait === 'tail' && this.stateT > 3.2) || !b.active) { this.meter = 0; this.go('look'); this.lookBase = this.heading; }
        break;
      }
      case 'stun':
        // Seeing stars.
        this.heading += Math.sin(this.stateT * 9) * 1.4 * dt;
        if (this.stateT > this.stunFor) { this.meter = 0; this.go('look'); this.lookBase = this.heading; }
        break;
      case 'flee': {
        // Singed: it wants nothing more to do with that lizard.
        const ax = this.pos.x - liz.pos.x, az = this.pos.z - liz.pos.z, al = Math.hypot(ax, az) || 1;
        this.walk(dt, this.pos.x + (ax / al) * 4, this.pos.z + (az / al) * 4, 6.2, 7, ctx);
        if (Math.random() < dt * 14) ctx.fx.burst('step', this.pos.x, this.pos.z);
        if (this.stateT > 2.4) { this.meter = 0; this.go('return'); this.wp = this.nearestWaypoint(); }
        break;
      }
      case 'gloat': break;
    }

    // Caught? Running you down counts under leaves too; on its beat it only catches what it can see.
    if (liz.alive && this.state !== 'peck' && this.state !== 'gloat' && this.state !== 'stun' && this.state !== 'flee') {
      const hunting = this.state === 'chase' || this.state === 'search';
      const dNose = dist(this.eyeX(), this.eyeZ(), liz.pos.x, liz.pos.z);
      if ((hunting && (dNose < 0.5 || dLiz < 0.45)) || (!hunting && liz.exposed && dNose < 0.42)) {
        const got = ctx.catchLizard('roadrunner', this.pos.x, this.pos.z);
        if (got === 'tail') { this.bait = 'tail'; this.go('peck'); }
        else if (got === 'dead') { this.go('gloat'); ctx.fx.burst('feathers', this.pos.x, this.pos.z); }
        else if (got === 'burnt') { this.go('flee'); ctx.fx.burst('feathers', this.pos.x, this.pos.z); }
      }
    }
    if (dLiz < 7) ctx.hint('runner');
  }

  private nearestWaypoint() {
    let best = 0, bd = Infinity;
    this.route.pts.forEach((p, i) => { const d = dist(p.x, p.z, this.pos.x, this.pos.z); if (d < bd) { bd = d; best = i; } });
    return best;
  }

  draw(ctx: Ctx, body: SpriteBatch, shadow: SpriteBatch) {
    const frame = Math.floor(this.anim) & 3;
    const peck = this.state === 'peck' ? Math.abs(Math.sin(this.stateT * 15)) * 0.16 : 0;
    const x = this.pos.x + dirX(this.heading) * peck, z = this.pos.z + dirZ(this.heading) * peck;
    const wob = this.state === 'stun' ? Math.sin(this.stateT * 13) * 0.12 : 0;
    shadow.push(x + 0.12, 0.03, z + 0.1, 1.05, 2.05, this.heading, 0, 0, 0, 0.3, frame * 0.25, 0, 0.25, 1);
    // Three sheets of card, the lower ones darker: a bird with some body to it.
    for (let k = 0; k < 3; k++) {
      const t = k === 2 ? 1 : 0.42 + k * 0.2;
      body.push(x, 0.26 + k * 0.045, z, 1.0, 2.0, this.heading + wob, t, t, t, 1, frame * 0.25, 0, 0.25, 1);
    }

    // The cone of sight, cut off by rocks.
    const range = this.range(), half = this.halfAngle();
    const look = this.lookHeading(ctx.time);
    const ex = this.eyeX(), ez = this.eyeZ();
    const p = this.conePos, t = this.coneT;
    p[0] = ex; p[1] = 0.03; p[2] = ez; t[0] = 0;
    for (let i = 0; i <= CONE_RAYS; i++) {
      const a = look - half + (i / CONE_RAYS) * half * 2;
      const tx = ex + dirX(a) * range, tz = ez + dirZ(a) * range;
      const f = ctx.level.raycast(ex, ez, tx, tz);
      const o = (i + 1) * 3;
      p[o] = ex + (tx - ex) * f; p[o + 1] = 0.03; p[o + 2] = ez + (tz - ez) * f;
      t[i + 1] = f;
    }
    const geo = this.cone.geometry;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aT.needsUpdate = true;
    const col = this.coneMat.uniforms.uColor.value as THREE.Vector3;
    const hot = this.state === 'chase' ? 1 : this.state === 'search' || this.state === 'look' ? 0.6 : this.meter;
    col.set(1, lerp(0.95, 0.25, hot), lerp(0.7, 0.15, hot));
    const show = this.state === 'peck' || this.state === 'gloat' || this.state === 'stun' || this.state === 'flee' ? 0 : 1;
    this.coneMat.uniforms.uAlpha.value = damp(this.coneMat.uniforms.uAlpha.value, show * (0.24 + hot * 0.2), 10, 1 / 60);
  }
}

// ---------------------------------------------------------------------------------------------------------

type ScorpState = 'hide' | 'warn' | 'lunge' | 'hold' | 'retract' | 'rest';
const DIRS: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];

class Scorpion {
  readonly key: number;
  private x: number; private z: number;
  private state: ScorpState = 'hide';
  private t = 0;
  private dx = 0; private dz = -1;
  private out = 0;
  private wiggle = 0;
  private nextWiggle: number;
  private open: [number, number][];
  private missed = false;
  threat = 0;

  constructor(private c: number, private r: number, level: Level) {
    this.key = r * level.w + c;
    this.x = c + 0.5; this.z = r + 0.5;
    this.open = DIRS.filter(([dx, dz]) => !level.isSolid(c + dx, r + dz));
    this.nextWiggle = 1 + hash2(c, r) * 3;
  }

  reset() { this.state = 'hide'; this.t = 0; this.out = 0; }

  get x0() { return this.x; }
  get z0() { return this.z; }
  /** Rattled by a Thunder Egg: it keeps its claws in for a while. */
  stun(seconds: number) { this.state = 'rest'; this.t = -seconds; this.out = 0; }

  update(dt: number, ctx: Ctx) {
    const liz = ctx.lizard;
    this.t += dt;
    this.threat = 0;
    const near = dist(this.x, this.z, liz.pos.x, liz.pos.z);
    if (near < 4) ctx.hint('scorpion');
    switch (this.state) {
      case 'hide': {
        // The tell: every few seconds the rock shifts and claws show at its edge.
        this.nextWiggle -= dt;
        if (this.nextWiggle <= 0) {
          this.nextWiggle = 2.6 + Math.random() * 1.8;
          this.wiggle = 0.7;
          const d = this.open[Math.floor(Math.random() * this.open.length)];
          if (d) { this.dx = d[0]; this.dz = d[1]; }
          if (near < 7) ctx.fx.burst('step', this.x + this.dx * 0.5, this.z + this.dz * 0.5, { scale: 3 });
        }
        this.wiggle = Math.max(0, this.wiggle - dt);
        this.out = damp(this.out, this.wiggle > 0.15 ? 0.2 : 0, 10, dt);
        if (!liz.alive) break;
        for (const [dx, dz] of this.open) {
          const tc = this.c + dx, tr = this.r + dz;
          if (liz.pos.x > tc + 0.04 && liz.pos.x < tc + 0.96 && liz.pos.z > tr + 0.04 && liz.pos.z < tr + 0.96) {
            this.dx = dx; this.dz = dz; this.state = 'warn'; this.t = 0;
            ctx.sound.play('rattle');
            break;
          }
        }
        break;
      }
      case 'warn':
        this.threat = 0.7;
        this.out = damp(this.out, 0.28, 14, dt);
        if (this.t > 0.34) { this.state = 'lunge'; this.t = 0; ctx.sound.play('snap'); ctx.fx.burst('dust', this.x + this.dx * 0.5, this.z + this.dz * 0.5, { dirX: this.dx * 2, dirZ: this.dz * 2 }); }
        break;
      case 'lunge':
        this.threat = 1;
        this.out = lerp(0.28, 1, easeOutCubic(clamp01(this.t / 0.09)));
        if (this.t > 0.09) { this.state = 'hold'; this.t = 0; ctx.rig.kick(this.dx * 0.06, this.dz * 0.06); this.missed = true; }
        break;
      case 'hold':
        this.threat = 1;
        this.out = 1;
        if (this.t > 0.3) { this.state = 'retract'; this.t = 0; if (this.missed && liz.alive && near < 1.7) ctx.note('miss'); }
        break;
      case 'retract':
        this.out = 1 - easeInCubic(clamp01(this.t / 0.4));
        if (this.t > 0.4) { this.state = 'rest'; this.t = 0; this.out = 0; }
        break;
      case 'rest':
        if (this.t > 0.55) { this.state = 'hide'; this.t = 0; }
        break;
    }
    if ((this.state === 'lunge' || this.state === 'hold') && liz.alive) {
      const sx = this.x + this.dx * (this.out * 0.95 + 0.12), sz = this.z + this.dz * (this.out * 0.95 + 0.12);
      if (dist(sx, sz, liz.pos.x, liz.pos.z) < 0.46) {
        const got = ctx.catchLizard('scorpion', sx, sz);
        this.missed = false;
        if (got === 'burnt') { this.state = 'rest'; this.t = -3; this.out = 0; ctx.fx.burst('poof', sx, sz); }
        else if (got !== 'none') { this.state = 'retract'; this.t = 0; }
      }
    }
  }

  /** How the rock above it should move this frame. */
  rock(time: number): { ox: number; oz: number; scale: number } | null {
    if (this.state === 'warn') return { ox: Math.sin(time * 70) * 0.09, oz: Math.cos(time * 63) * 0.09, scale: 1.05 };
    if (this.state === 'lunge' || this.state === 'hold') return { ox: -this.dx * 0.1, oz: -this.dz * 0.1, scale: 1.06 };
    if (this.wiggle > 0) return { ox: Math.sin(time * 34) * 0.05 * this.wiggle, oz: Math.cos(time * 29) * 0.05 * this.wiggle, scale: 1 + 0.02 * this.wiggle };
    return null;
  }

  draw(ctx: Ctx, body: SpriteBatch, marks: SpriteBatch) {
    if (this.out > 0.02) {
      const frame = Math.floor(ctx.time * 12) & 3;
      const x = this.x + this.dx * this.out * 0.95, z = this.z + this.dz * this.out * 0.95;
      ctx.world.blobs.push(x + 0.04, 0.02, z + 0.04, 0.8, 0.8, 0, 0, 0, 0, 0.3 * this.out, 0, 1.4, 0, 0);
      body.push(x, 0.07, z, 0.8, 0.8, headingOf(this.dx, this.dz), 0.5, 0.5, 0.5, 1, frame * 0.25, 0, 0.25, 1);
      body.push(x, 0.11, z, 0.8, 0.8, headingOf(this.dx, this.dz), 1, 1, 1, 1, frame * 0.25, 0, 0.25, 1);
    }
    if (this.state === 'warn') {
      // The tile it is about to strike.
      const a = clamp01(this.t / 0.34);
      marks.push(this.x + this.dx, 0.04, this.z + this.dz, 0.9 + (1 - a) * 0.5, 0.9 + (1 - a) * 0.5, 0, 1, 0.25, 0.15, 0.55 + 0.4 * a, 2, 0, 0, ctx.time * 0.6);
    }
  }
}

// ---------------------------------------------------------------------------------------------------------

class Owl {
  pos: V2 = { x: 0, z: 0 };
  heading = 0;
  private path: Path;
  private s: number;
  private speed: number;
  private cooldown = 0;
  private wasNear = false;
  /** How fast it is turning, for the bank. */
  private turn = 0;
  /** Where it is in its round of beats and glide. */
  private beat: number;
  threat = 0;

  constructor(route: Route) {
    this.path = new Path(route.pts, route.closed, true);
    this.s = route.phase * this.path.length;
    this.speed = route.speed ?? 4.1;
    this.path.at(this.s, this.pos);
    this.heading = this.path.headingAt(this.s);
    this.beat = route.phase * 7.3 + route.pts[0].x * 0.37;
  }

  reset() { this.cooldown = 1.5; }

  update(dt: number, ctx: Ctx) {
    const liz = ctx.lizard;
    const before = this.heading;
    this.s += this.speed * dt;
    this.path.at(this.s, this.pos);
    this.heading = this.path.headingAt(this.s);
    this.turn = damp(this.turn, angleDiff(before, this.heading) / dt, 5, dt);
    this.beat += dt * 0.36;
    this.cooldown = Math.max(0, this.cooldown - dt);
    const d = dist(this.pos.x, this.pos.z, liz.pos.x, liz.pos.z);
    this.threat = liz.exposed ? clamp01(1 - d / 4) * 0.6 : 0;
    const near = d < 4.5;
    if (near && !this.wasNear) { ctx.sound.play('swoop'); ctx.hint('owl'); }
    this.wasNear = near;
    if (this.cooldown <= 0 && liz.exposed && d < 0.74) {
      const got = ctx.catchLizard('owl', this.pos.x, this.pos.z);
      if (got !== 'none') { this.cooldown = got === 'burnt' ? 4 : 2; ctx.fx.burst('feathers', this.pos.x, this.pos.z, { y: 1.2 }); }
    }
    if (Math.random() < dt * 0.05 && d < 14) ctx.sound.play('hoot');
  }

  draw(ctx: Ctx, body: SpriteBatch, shadow: SpriteBatch) {
    // Four slow beats, then a glide on set wings: an owl in no hurry. The tips follow the wing late, and each
    // upstroke lets the body sink a little.
    const round = this.beat % 1, on = round < 0.6 ? round / 0.6 : 0;
    const power = Math.min(1, Math.sin(on * Math.PI) * 1.8);
    const a = on * TAU * 4;
    const wing = 0.13 + Math.sin(a) * 0.5 * power;
    const tip = wing + 0.06 + Math.sin(a - 0.9) * 0.36 * power;
    const bank = clamp(-this.turn * 0.3, -0.45, 0.45); // it leans into its turns
    const alt = 1.75 + Math.sin(ctx.time * 1.6 + this.s) * 0.1 - Math.sin(a) * 0.06 * power;
    wingL[0] = wingR[0] = wing; wingL[1] = wingR[1] = tip;
    wings(shadow, OWL_CUTS, 2, this.pos.x + alt * SUN_X, 0.03, this.pos.z + alt * SUN_Z, 2.2, 0.85, this.heading, wingL, wingR, bank, setPaint(0, 0.3), true);
    // The ground it covers: don't be standing in this as it passes.
    ctx.world.rings.push(this.pos.x, 0.035, this.pos.z, 1.5, 1.5, 0, 0.9, 0.85, 1.0, 0.36, 1, 0.07, 10, -ctx.time * 0.25);
    ctx.world.glow.push(this.pos.x, 0.03, this.pos.z, 2.6, 2.6, 0, 0.5, 0.45, 0.8, 0.1, 0, 1.6, 0, 0);
    wings(body, OWL_CUTS, 2, this.pos.x, alt - 0.05, this.pos.z, 2.2, 0.85, this.heading, wingL, wingR, bank, setPaint(0.5, 1));
    wings(body, OWL_CUTS, 2, this.pos.x, alt, this.pos.z, 2.2, 0.85, this.heading, wingL, wingR, bank, setPaint(1, 1));
  }
}

// ---------------------------------------------------------------------------------------------------------

type HawkState = 'cruise' | 'lock' | 'dive' | 'ground' | 'climb';
const HAWK_ALT = 5;
const GAZE = 2.5;

class Hawk {
  pos: V2 = { x: 0, z: 0 };
  heading = 0;
  private alt = HAWK_ALT;
  private path: Path;
  private s: number;
  private speed: number;
  private state: HawkState = 'cruise';
  private t = 0;
  private gaze = 0;
  private cooldown = 0;
  private target: V2 = { x: 0, z: 0 };
  private from: V2 = { x: 0, z: 0 };
  private fromAlt = HAWK_ALT;
  private turn = 0;
  // The wings, eased from one way of holding them to the next: how high, how bent at the tip, how hard they beat.
  private wingUp = 0.16;
  private wingBend = 0.12;
  private wingBeat = 0;
  private wingA = 0;
  threat = 0;

  constructor(route: Route) {
    this.path = new Path(route.pts, route.closed, true);
    this.s = route.phase * this.path.length;
    this.speed = route.speed ?? 3.3;
    this.path.at(this.s, this.pos);
    this.heading = this.path.headingAt(this.s);
  }

  reset() {
    if (this.state !== 'cruise') { this.state = 'climb'; this.t = 0; this.from.x = this.pos.x; this.from.z = this.pos.z; this.fromAlt = this.alt; }
    this.gaze = 0; this.cooldown = 2.5;
  }

  update(dt: number, ctx: Ctx) {
    const liz = ctx.lizard;
    this.t += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    const before = this.heading;
    this.threat = 0;
    switch (this.state) {
      case 'cruise': {
        this.s += this.speed * dt;
        this.path.at(this.s, this.pos);
        this.heading = this.path.headingAt(this.s);
        this.alt = damp(this.alt, HAWK_ALT, 2, dt);
        const d = dist(this.pos.x, this.pos.z, liz.pos.x, liz.pos.z);
        if (d < 9) ctx.hint('hawk');
        if (this.cooldown <= 0 && liz.exposed && d < GAZE) this.gaze += dt; else this.gaze = Math.max(0, this.gaze - dt * 0.8);
        this.threat = clamp01(this.gaze / 0.5) * 0.5;
        if (this.gaze > 0.5) {
          this.state = 'lock'; this.t = 0; this.gaze = 0;
          ctx.note('alarm');
          this.target.x = liz.pos.x; this.target.z = liz.pos.z;
          ctx.sound.play('screech');
          ctx.rig.zoomPunch(0.4);
        }
        break;
      }
      case 'lock': {
        // It has seen you: the target follows for a moment (unless you get under leaves), then it commits.
        this.threat = 1;
        if (liz.exposed) { this.target.x = damp(this.target.x, liz.pos.x, 14, dt); this.target.z = damp(this.target.z, liz.pos.z, 14, dt); }
        const back = 2.6;
        const ax = this.target.x - dirX(this.heading) * back, az = this.target.z - dirZ(this.heading) * back;
        this.heading = angleToward(this.heading, headingOf(this.target.x - this.pos.x, this.target.z - this.pos.z), 3.4 * dt);
        this.pos.x = damp(this.pos.x, ax, 2.4, dt); this.pos.z = damp(this.pos.z, az, 2.4, dt);
        this.alt = damp(this.alt, HAWK_ALT - 0.8, 3, dt);
        ctx.mark('!', this.pos.x, this.alt + 0.8, this.pos.z);
        if (this.t > 0.72) {
          this.state = 'dive'; this.t = 0;
          this.from.x = this.pos.x; this.from.z = this.pos.z; this.fromAlt = this.alt;
          ctx.sound.play('dive');
        }
        break;
      }
      case 'dive': {
        this.threat = 1;
        const k = easeInCubic(clamp01(this.t / 0.4));
        this.pos.x = lerp(this.from.x, this.target.x, k); this.pos.z = lerp(this.from.z, this.target.z, k);
        this.alt = lerp(this.fromAlt, 0.3, k);
        this.heading = headingOf(this.target.x - this.from.x, this.target.z - this.from.z);
        if (this.t >= 0.4) {
          this.state = 'ground'; this.t = 0;
          const sandy = ctx.level.isSand(Math.floor(this.target.x), Math.floor(this.target.z));
          ctx.fx.burst(sandy ? 'sand' : 'thud', this.target.x, this.target.z, { scale: sandy ? 4 : 1, size: 1.4 });
          ctx.fx.burst('ringBig', this.target.x, this.target.z);
          ctx.fx.burst('feathers', this.target.x, this.target.z, { scale: 0.6 });
          ctx.sound.play('thud');
          ctx.rig.shake(0.5);
          const c = Math.floor(liz.pos.x), r = Math.floor(liz.pos.z);
          if (liz.hidden && dist(this.target.x, this.target.z, liz.pos.x, liz.pos.z) < 2) { ctx.world.rustle(liz.coverC, liz.coverR, 1); ctx.fx.burst('leaves', c + 0.5, r + 0.5, { scale: 1.6 }); }
          const dHit = dist(this.target.x, this.target.z, liz.pos.x, liz.pos.z);
          if (liz.exposed && dHit < 0.85) ctx.catchLizard('hawk', this.target.x, this.target.z);
          else if (liz.alive && dHit < 2.2) ctx.note('miss');
        }
        break;
      }
      case 'ground':
        // Missed (or got only a tail): it sits a moment, wings out, before hauling itself back up.
        this.alt = 0.3;
        if (this.t > 0.85) { this.state = 'climb'; this.t = 0; this.from.x = this.pos.x; this.from.z = this.pos.z; this.fromAlt = this.alt; }
        break;
      case 'climb': {
        this.s += this.speed * dt;
        this.path.at(this.s, tmp);
        const k = clamp01(this.t / 1.7);
        const e = easeOutCubic(k);
        this.pos.x = lerp(this.from.x, tmp.x, e); this.pos.z = lerp(this.from.z, tmp.z, e);
        this.alt = lerp(this.fromAlt, HAWK_ALT, e);
        this.heading = angleToward(this.heading, headingOf(tmp.x - this.pos.x, tmp.z - this.pos.z), 5 * dt);
        if (k >= 1) { this.state = 'cruise'; this.cooldown = 2.2; }
        break;
      }
    }
    this.turn = damp(this.turn, dt > 0 ? angleDiff(before, this.heading) / dt : 0, 6, dt);
    // Soaring: a shallow V, hardly moving. Stooping: folded. Sitting on its catch or climbing away: beating hard.
    const st = this.state;
    const up = st === 'dive' ? 0.75 : st === 'ground' ? 0.3 : st === 'lock' ? 0.3 : 0.16;
    const bend = st === 'dive' ? 0.5 : 0.12;
    const beat = st === 'ground' ? 0.42 : st === 'climb' ? 0.5 : 0.045;
    this.wingUp = damp(this.wingUp, up, 7, dt); this.wingBend = damp(this.wingBend, bend, 7, dt); this.wingBeat = damp(this.wingBeat, beat, 6, dt);
    this.wingA += dt * (st === 'ground' ? 20 : st === 'climb' ? 13 : 2.1);
  }

  draw(ctx: Ctx, bodies: SpriteBatch[], shadows: SpriteBatch[]) {
    // Which drawing: wings level, or one of the banking ones when it wheels round.
    const bank = this.state === 'lock' || Math.abs(this.turn) > 1.1 ? (this.turn < 0 ? 1 : 2) : 0;
    const w = bank ? 2.13 : 3.0, h = bank ? 2.38 : 1.48;
    const head = bank === 1 ? this.heading + Math.PI / 2 : bank === 2 ? this.heading - Math.PI / 2 : this.heading;
    const sx = this.pos.x + this.alt * SUN_X, sz = this.pos.z + this.alt * SUN_Z;
    const shade = lerp(0.42, 0.2, clamp01(this.alt / HAWK_ALT));
    if (bank) {
      // Wheeling round: the drawing of it banked, as it is.
      shadows[bank].push(sx, 0.03, sz, w, h, head, 0, 0, 0, shade);
      bodies[bank].push(this.pos.x, this.alt - 0.06, this.pos.z, w, h, head, 0.5, 0.5, 0.5);
      bodies[bank].push(this.pos.x, this.alt, this.pos.z, w, h, head);
    } else {
      const wing = this.wingUp + Math.sin(this.wingA) * this.wingBeat;
      const tip = wing + this.wingBend + Math.sin(this.wingA - 0.9) * this.wingBeat * 0.8;
      const lean = clamp(-this.turn * 0.25, -0.4, 0.4);
      wingL[0] = wingR[0] = wing; wingL[1] = wingR[1] = tip;
      wings(shadows[0], HAWK_CUTS, 2, sx, 0.03, sz, w, h, head, wingL, wingR, lean, setPaint(0, shade), true);
      wings(bodies[0], HAWK_CUTS, 2, this.pos.x, this.alt - 0.06, this.pos.z, w, h, head, wingL, wingR, lean, setPaint(0.5, 1));
      wings(bodies[0], HAWK_CUTS, 2, this.pos.x, this.alt, this.pos.z, w, h, head, wingL, wingR, lean, setPaint(1, 1));
    }

    const marks = ctx.world.marks;
    if (this.state === 'cruise' && this.cooldown <= 0) {
      // What it can see: stay out of the ring, or under leaves.
      const hot = clamp01(this.gaze / 0.5);
      ctx.world.rings.push(this.pos.x, 0.035, this.pos.z, GAZE * 2, GAZE * 2, 0, 1, lerp(0.92, 0.3, hot), lerp(0.75, 0.15, hot), 0.3 + hot * 0.5, 1, 0.035, 22, ctx.time * 0.1);
      ctx.world.glow.push(this.pos.x, 0.03, this.pos.z, GAZE * 2, GAZE * 2, 0, 1, lerp(0.9, 0.3, hot), lerp(0.6, 0.1, hot), 0.05 + hot * 0.12, 0, 0.8, 0, 0);
    } else if (this.state === 'lock' || this.state === 'dive') {
      const k = this.state === 'lock' ? clamp01(this.t / 0.72) : 1;
      const size = lerp(3.4, 1.7, k);
      marks.push(this.target.x, 0.04, this.target.z, size, size, 0, 1, 0.2, 0.12, 0.9, 2, 0, 0, ctx.time * 0.8);
      marks.push(this.target.x, 0.04, this.target.z, size * 1.25, size * 1.25, 0, 0.2, 0.03, 0.0, 0.5, 1, 0.05, 0, 0);
    }
  }
}

// ---------------------------------------------------------------------------------------------------------

export class Hunters {
  private runners: Roadrunner[] = [];
  private scorpions: Scorpion[] = [];
  private owls: Owl[] = [];
  private hawks: Hawk[] = [];
  private runnerBody: SpriteBatch; private runnerShadow: SpriteBatch;
  private scorpBody: SpriteBatch;
  private owlBody: SpriteBatch; private owlShadow: SpriteBatch;
  private hawkBody: SpriteBatch[]; private hawkShadow: SpriteBatch[];
  private stars: SpriteBatch;
  private rockMoves = new Map<number, { ox: number; oz: number; scale: number }>();
  private rocksMoved = false;
  /** 0 calm .. 1 something is on you (for the music and the red edges). */
  danger = 0;

  constructor(scene: THREE.Object3D, level: Level, tex: Textures) {
    let i = 0;
    for (const route of level.routes) {
      if (route.type === 'roadrunner') this.runners.push(new Roadrunner(scene, route, i++));
      else if (route.type === 'owl') this.owls.push(new Owl(route));
      else this.hawks.push(new Hawk(route));
    }
    for (const post of level.sentries) {
      this.runners.push(new Roadrunner(scene, { type: 'roadrunner', name: post.name, pts: [{ x: post.x, z: post.z }], closed: true, phase: 0 }, i++, post));
    }
    for (const b of level.boulders) if (b.scorpion) this.scorpions.push(new Scorpion(b.c, b.r, level));
    this.runnerShadow = new SpriteBatch(scene, tex.roadrunner, this.runners.length + 1, { order: ORDER.shadow, bias: 2 });
    this.runnerBody = new SpriteBatch(scene, tex.roadrunner, this.runners.length * 3 + 1, { order: ORDER.runner, kind: 'cut' });
    this.scorpBody = new SpriteBatch(scene, tex.scorpion, this.scorpions.length * 2 + 1, { order: ORDER.scorpion, kind: 'cut' });
    // The owl and the hawks are puppets of five strips each (see puppet.ts), in two sheets of card.
    this.owlShadow = new SpriteBatch(scene, tex.owl, this.owls.length * 5 + 1, { order: ORDER.birdShadowHigh, bias: 2.2 });
    this.owlBody = new SpriteBatch(scene, tex.owl, this.owls.length * 10 + 1, { order: ORDER.owl, kind: 'cut', tilt: true });
    const hawkTex = [tex.hawkC, tex.hawkL, tex.hawkR];
    this.hawkShadow = hawkTex.map((t) => new SpriteBatch(scene, t, this.hawks.length * 5 + 1, { order: ORDER.birdShadowHigh, bias: 2.6 }));
    this.hawkBody = hawkTex.map((t, k) => new SpriteBatch(scene, t, this.hawks.length * 10 + 1, { order: ORDER.hawk, kind: 'cut', tilt: k === 0 }));
    this.stars = new SpriteBatch(scene, tex.stunStar, this.runners.length * 3 + 1, { order: ORDER.mark, kind: 'up' });
  }

  /** A Thunder Egg went off: walkers and scorpions close by are knocked silly. Returns how many. */
  stunNear(x: number, z: number, radius: number, seconds: number): number {
    let n = 0;
    for (const r of this.runners) if (dist(r.pos.x, r.pos.z, x, z) < radius) { r.stun(seconds); n++; }
    for (const s of this.scorpions) if (dist(s.x0, s.z0, x, z) < radius) { s.stun(seconds); n++; }
    return n;
  }

  reset() {
    this.runners.forEach((r) => r.reset());
    this.scorpions.forEach((s) => s.reset());
    this.owls.forEach((o) => o.reset());
    this.hawks.forEach((h) => h.reset());
  }

  /** Move everything (dt may be 0 while the game is frozen: they still get drawn). */
  update(dt: number, ctx: Ctx) {
    const all = [this.runnerShadow, this.runnerBody, this.scorpBody, this.owlShadow, this.owlBody, ...this.hawkShadow, ...this.hawkBody, this.stars];
    all.forEach((b) => b.clear());
    let danger = 0;
    for (const r of this.runners) {
      if (dt > 0) r.update(dt, ctx);
      r.draw(ctx, this.runnerBody, this.runnerShadow);
      danger = Math.max(danger, r.threat);
      // Stars going round its head.
      if (r.dazed) for (let k = 0; k < 3; k++) {
        const a = ctx.time * 5 + (k / 3) * TAU;
        this.stars.push(r.pos.x + Math.sin(a) * 0.42, 0.75 + Math.sin(a * 2) * 0.06, r.pos.z + Math.cos(a) * 0.42, 0.26, 0.26);
      }
    }
    this.rockMoves.clear();
    for (const s of this.scorpions) {
      if (dt > 0) s.update(dt, ctx);
      s.draw(ctx, this.scorpBody, ctx.world.marks);
      const m = s.rock(ctx.time);
      if (m) this.rockMoves.set(s.key, m);
      danger = Math.max(danger, s.threat);
    }
    if (this.rockMoves.size || this.rocksMoved) ctx.world.moveScorpionRocks(this.rockMoves);
    this.rocksMoved = this.rockMoves.size > 0;
    for (const o of this.owls) { if (dt > 0) o.update(dt, ctx); o.draw(ctx, this.owlBody, this.owlShadow); danger = Math.max(danger, o.threat); }
    for (const h of this.hawks) { if (dt > 0) h.update(dt, ctx); h.draw(ctx, this.hawkBody, this.hawkShadow); danger = Math.max(danger, h.threat); }
    all.forEach((b) => b.commit());
    this.danger = danger;
  }

  /** For the little map: where the walkers are. */
  runnerPositions(): { x: number; z: number; hot: boolean }[] {
    return this.runners.map((r) => ({ x: r.pos.x, z: r.pos.z, hot: r.state === 'chase' }));
  }
  birdPositions(): { x: number; z: number; hawk: boolean }[] {
    return [...this.owls.map((o) => ({ x: o.pos.x, z: o.pos.z, hawk: false })), ...this.hawks.map((h) => ({ x: h.pos.x, z: h.pos.z, hawk: true }))];
  }
}

export const HUNTER = { TAU };
