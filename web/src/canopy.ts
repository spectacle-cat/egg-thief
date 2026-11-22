// The canopy: a second deck above part of the forest floor, reached through the door of one hollow tree.
//
// On the map it is a far corner of the same grid (level.ts), so eggs, the clock and the rain are shared. Up there
// the ground is leaf mat and boughs with nothing between them: the floor shows far below through the gaps, and a
// lizard that steps off lands on the floor underneath, unharmed. The knothole is the door in reverse.
//
// This file draws what only a canopy has (the floor far below, the thickness of the mats, boughs, the leaves along
// every edge, the hollow tree and its door) and moves the lizard between the two decks. Built from the designer's
// style guide as a proposal to try out: see docs/build-outline-rainforest-and-menus.md.
import * as THREE from 'three';
import type { Sound } from './audio';
import { ORDER, SpriteBatch, fogUniforms, shared } from './gfx';
import { DECK, type Level } from './level';
import type { Lizard } from './lizard';
import type { Particles } from './particles';
import { TAU, clamp01, damp, hash2, type V2 } from './util';
import type { Textures, World } from './world';

/** How far down the floor is drawn, and how far under a mat's top its underside shows. The floor is not drawn as
 *  far down as it is meant to be: from the low camera a truly deep floor slides so far that the creek she has just
 *  crossed would never be seen under the boughs that cross it. This deep, it moves at about 0.7 of the mat's speed. */
const DEPTH = 2.2, LIP = 0.22;
/** Seconds: through the door (shut, then open again), and a fall (off the edge, then down onto the floor). */
const DOOR_SHUT = 0.4, DOOR_HOLD = 0.14, DOOR_OPEN = 0.42;
const FALL_SHUT = 0.5, FALL_HOLD = 0.14, FALL_OPEN = 0.5;
/** Which sides a piece of bough leaves its tile by, as drawn (0 north, 1 east, 2 south, 3 west). */
const ARMS = { bough: [0, 2], fork: [3, 1, 2], tip: [2] };
const STEP = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const smooth = (t: number) => { const u = clamp01(t); return u * u * (3 - 2 * u); };

const NOISE = /* glsl */ `
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}`;

const PLANE_VERT = /* glsl */ `
varying vec2 vW;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vW = wp.xz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

// The forest floor seen from high above: the floor drawing, dim and out of focus, with the streams as soft ribbons
// where the map below has them, fading into the mist with distance.
const BELOW_FRAG = /* glsl */ `
uniform sampler2D tBelow;
uniform sampler2D tMask;
uniform vec2 uMap;
uniform vec2 uShift;
uniform float uFlood;
uniform float uDepth;
uniform vec4 uFog;
varying vec2 vW;
${NOISE}
float wet(vec2 f) { vec4 m = texture2D(tMask, f / uMap); return mix(m.b, m.a, uFlood); }
void main() {
  vec2 p = vW;
  // Two layers of the same soft drawing, one turned and a different size, so no band of it repeats in step.
  vec3 col = mix(texture2D(tBelow, p * 0.5).rgb, texture2D(tBelow, vec2(p.y, -p.x) * 0.37 + 0.31).rgb, smoothstep(0.3, 0.7, vnoise(p * 0.23)));
  col *= 0.9 + 0.2 * vnoise(p * 0.11 + 7.0);
  vec2 f = p - uShift;
  float w = 0.25 * (wet(f + vec2(0.6, 0.0)) + wet(f - vec2(0.6, 0.0)) + wet(f + vec2(0.0, 0.6)) + wet(f - vec2(0.0, 0.6)));
  col = mix(col, vec3(0.114, 0.29, 0.333), smoothstep(0.25, 0.7, w) * 0.85);
  col = mix(col, vec3(0.525, 0.867, 0.725), 0.06);
  float d = distance(vec3(p.x, -uDepth, p.y), cameraPosition);
  gl_FragColor = vec4(mix(col, uFog.rgb, 0.1 + 0.88 * smoothstep(9.0, 44.0, d)), 1.0);
}`;

// The underside of the mats: the same outline as the ground draws (the same wandering edge), in one dark colour,
// a little lower. From the low camera it is the dark lip on the near edge of every mat.
const LIP_FRAG = /* glsl */ `
uniform sampler2D tDeck;
uniform vec2 uMap;
uniform vec4 uFog;
uniform vec2 uFogRange;
varying vec2 vW;
${NOISE}
void main() {
  vec2 p = vW;
  vec2 dw = (vec2(vnoise(p * 1.9 + 3.0), vnoise(p * 1.9 + 17.0)) - 0.5) * 0.3;
  vec4 dk = texture2D(tDeck, (p + dw) / uMap);
  if (dk.r + (vnoise(p * 5.0) - 0.5) * 0.16 < 0.44) discard;
  float fog = uFog.a * smoothstep(uFogRange.x, uFogRange.y, distance(vec3(p.x, 0.0, p.y), cameraPosition));
  gl_FragColor = vec4(mix(vec3(0.031, 0.184, 0.227), uFog.rgb, fog), 1.0);
}`;

export class Canopy {
  /** Is the lizard up top? */
  up = false;
  /** The wipe as it changes deck: 0 open, 1 shut. */
  wipe = 0;
  /** Added to how high the lizard is drawn (dropping in from above after a fall). */
  lift = 0;
  /** True for the one frame in which the lizard has been put somewhere else: the camera must jump, not fly. */
  moved = false;
  /** What happened this frame, for the game to say something about: 'up', 'down', 'fell', 'landed' or ''. */
  event: '' | 'up' | 'down' | 'fell' | 'landed' = '';
  private mode: '' | 'up' | 'down' | 'fall' = '';
  private t = 0;
  private done = false;
  private armed = true;
  private to: V2 = { x: 0, z: 0 };
  private below: THREE.Mesh | null = null;
  private lip: THREE.Mesh | null = null;
  private glowCard: SpriteBatch | null = null;
  private sparks: { x: number; z: number; phase: number; rate: number }[] = [];

  constructor(scene: THREE.Object3D, private level: Level, tex: Textures, private world: World) {
    const cn = level.canopy;
    // (The line between the two parts is shared by every drawing: a level without a canopy must take it away.)
    shared.uSplit.value.set(level.splitX, -1);
    if (!cn) return;
    const W = level.w, H = level.h;
    const deck = (c: number, r: number) => (level.inside(c, r) ? level.deck[r * W + c] : DECK.gap);

    // --- the floor far below, and the underside of the mats
    const plane = (size: number, y: number, order: number, mat: THREE.ShaderMaterial) => {
      const geo = new THREE.PlaneGeometry(size, size);
      geo.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set((cn.x0 + cn.x1) / 2, y, (cn.z0 + cn.z1) / 2);
      mesh.renderOrder = order; mesh.frustumCulled = false;
      scene.add(mesh);
      return mesh;
    };
    if (tex.below) {
      this.below = plane(420, -DEPTH, -12, new THREE.ShaderMaterial({
        vertexShader: PLANE_VERT, fragmentShader: BELOW_FRAG, depthTest: false, depthWrite: false,
        uniforms: {
          tBelow: { value: tex.below }, tMask: { value: world.groundMask }, uMap: { value: new THREE.Vector2(W, H) }, uShift: { value: new THREE.Vector2(cn.dx, cn.dz) },
          uFlood: shared.uFlood, uDepth: { value: DEPTH }, uFog: shared.uFog,
        },
      }));
    }
    if (world.deckTex) {
      this.lip = plane(Math.max(cn.x1 - cn.x0, cn.z1 - cn.z0) + 4, -LIP, -11, new THREE.ShaderMaterial({
        vertexShader: PLANE_VERT, fragmentShader: LIP_FRAG, depthTest: false, depthWrite: false,
        uniforms: { tDeck: { value: world.deckTex }, uMap: { value: new THREE.Vector2(W, H) }, ...fogUniforms() },
      }));
    }

    // --- boughs: each piece lies on its tile, its dark underside a little lower; where one meets a mat a short
    // length of bark runs on over the mat's edge, so the wandering edge never leaves a slit between them
    const n = level.boughs.length;
    const under = new SpriteBatch(scene, tex.bough, n + 1, { order: 0.3 });
    const pieces = { bough: new SpriteBatch(scene, tex.bough, n * 4 + 1, { order: 0.4 }), fork: new SpriteBatch(scene, tex.boughFork, n + 1, { order: 0.42 }), tip: new SpriteBatch(scene, tex.boughTip, n + 1, { order: 0.42 }) };
    for (const b of level.boughs) {
      const x = b.c + 0.5, z = b.r + 0.5, heading = (b.turn * Math.PI) / 2;
      const arms = ARMS[b.piece].map((a) => (a + b.turn) % 4);
      const onMat = arms.map((a) => deck(b.c + STEP[a][0], b.r + STEP[a][1]) === DECK.mat);
      for (let i = 0; i < arms.length; i++) if (onMat[i]) {
        const [sx, sz] = STEP[arms[i]];
        pieces.bough.push(x + sx * 0.62, 0.004, z + sz * 0.62, 1, 0.5, (arms[i] * Math.PI) / 2, 1, 1, 1, 1, 0, 0.25, 1, 0.5);
      }
      if (b.piece === 'bough') {
        // The underside stops short of a mat (seen from the low camera it would lie across the mat's top).
        const a = onMat[0] ? 0.42 : 0, c = onMat[1] ? 0.42 : 0, [sx, sz] = STEP[arms[0]];
        under.push(x - sx * (a - c) * 0.5, -LIP, z - sz * (a - c) * 0.5, 0.96, 1.04 - a - c, heading, 0.2, 0.4, 0.46, 1);
      } else if (!onMat.some(Boolean)) under.push(x, -LIP, z, 1, 1, 0, 0.2, 0.4, 0.46, 1, 0.3, 0.3, 0.4, 0.4);
      pieces[b.piece].push(x, 0.006, z, 1.02, 1.02, heading);
    }
    under.commit(); Object.values(pieces).forEach((p) => p.commit());

    // --- the leaves along every edge of a mat: never a straight line. Two clumps to a tile's edge, each half over
    // the gap, one at every corner that sticks out, and a thinner scatter a tile further in.
    const edges: [number, number, number][] = [];
    for (let r = Math.floor(cn.z0); r < cn.z1; r++) for (let c = Math.floor(cn.x0); c < cn.x1; c++) {
      if (deck(c, r) !== DECK.mat) continue;
      const open = STEP.map(([sx, sz]) => deck(c + sx, r + sz) === DECK.gap);
      open.forEach((gap, side) => {
        if (!gap) return;
        const [sx, sz] = STEP[side];
        for (let i = 0; i < 2; i++) {
          const along = (i ? 0.26 : -0.26) + (hash2(c * 7 + i, r * 3 + side) - 0.5) * 0.22, outward = 0.5 + (hash2(c + side, r * 11 + i) - 0.3) * 0.2;
          edges.push([c + 0.5 + sx * outward - sz * along, r + 0.5 + sz * outward + sx * along, 1]);
        }
        if (hash2(c * 13 + side, r * 17) < 0.5) edges.push([c + 0.5 - sx * 0.3 - sz * (hash2(c, r + side) - 0.5), r + 0.5 - sz * 0.3 + sx * (hash2(r, c + side) - 0.5), 0.78]);
        if (open[(side + 1) % 4]) { const [tx, tz] = STEP[(side + 1) % 4]; edges.push([c + 0.5 + (sx + tx) * 0.36, r + 0.5 + (sz + tz) * 0.36, 1.12]); }
      });
    }
    const clumpsUnder = tex.leafClump.map((t) => new SpriteBatch(scene, t, edges.length + 1, { order: 0.5 }));
    const clumps = tex.leafClump.map((t) => new SpriteBatch(scene, t, edges.length + 1, { order: 0.6 }));
    edges.forEach(([x, z, scale], i) => {
      const k = Math.floor(hash2(i, 9) * clumps.length) % clumps.length, size = (0.98 + hash2(i, 4) * 0.3) * scale, turn = hash2(i, 6) * TAU;
      const shade = 0.86 + hash2(i, 8) * 0.14;
      if (scale >= 1) clumpsUnder[k].push(x, -LIP * 0.8, z, size, size, turn, 0.16, 0.36, 0.42, 1);
      clumps[k].push(x, 0.01 + (i % 5) * 0.002, z, size, size, turn, shade, shade, shade, 1);
    });
    [...clumpsUnder, ...clumps].forEach((b) => b.commit());
    // Lianas hanging at the mat's edge here and there.
    const lianas = new SpriteBatch(scene, tex.upLiana, 40, { order: ORDER.tuft, kind: 'up', cut: 0.4 });
    edges.forEach(([x, z, scale], i) => {
      if (scale < 1.1 || hash2(i, 21) > 0.22 || lianas.count >= 38) return;
      const h = 2.2 + hash2(i, 23) * 1.1;
      lianas.push(x, -0.5, z, h * 0.5, h, (hash2(i, 25) - 0.5) * 0.12, 0.92, 0.92, 0.92, 1, 0, 0, 1, 1, 0.012, hash2(i, 27) * TAU);
    });
    lianas.commit();

    // --- the hollow tree on the floor: the door lies on its tile, the tree stands behind it, light spills out in front
    const flat = (t: THREE.Texture, x: number, z: number, size: number, order: number, alpha = 1) => {
      const b = new SpriteBatch(scene, t, 2, { order });
      b.push(x, 0.014, z, size, size, 0, 1, 1, 1, alpha);
      b.commit();
      return b;
    };
    const d = cn.door, k = cn.hole;
    this.glowCard = new SpriteBatch(scene, tex.doorGlow, 3, { order: ORDER.burrow + 0.2 });
    flat(tex.hollowDoor, d.x, d.z - 0.12, 1.25, ORDER.burrow);
    const tree = new SpriteBatch(scene, tex.hollowGiant, 2, { order: ORDER.tuft, kind: 'up' });
    tree.push(d.x, 0, d.z - 0.62, 3.1, 6.2, 0);
    tree.commit();
    const cast = new SpriteBatch(scene, tex.hollowGiant, 2, { order: ORDER.shadow, bias: 1.4 });
    cast.push(d.x + 0.78 * 2.1, 0.012, d.z - 0.62 + 0.63 * 2.1, 3.1, 4.4, Math.atan2(0.78, -0.63), 0, 0, 0, 0.3);
    cast.commit();
    // --- and the knothole up top, in the leaves beside the same trunk
    flat(tex.knothole, k.x, k.z, 1.45, ORDER.burrow);
    // Fireflies rising beside the trunk, and a few over the knothole.
    for (let i = 0; i < 9; i++) this.sparks.push({ x: (i < 6 ? d.x : k.x) + (hash2(i, 31) - 0.5) * 3.4, z: (i < 6 ? d.z - 0.2 : k.z) + (hash2(i, 33) - 0.5) * 1.6, phase: hash2(i, 35) * TAU, rate: 0.7 + hash2(i, 37) * 0.9 });
    this.reset();
  }

  reset() {
    this.mode = ''; this.t = 0; this.wipe = 0; this.lift = 0; this.armed = true; this.moved = false; this.event = '';
    this.show(this.level.upTop(this.level.start.x));
  }

  /** Draw the floor, or the canopy: never both. */
  private show(up: boolean) {
    this.up = up;
    shared.uSplit.value.set(this.level.splitX, up ? 1 : -1);
    if (this.below) this.below.visible = up;
    if (this.lip) this.lip.visible = up;
  }

  update(dt: number, playing: boolean, liz: Lizard, fx: Particles, sound: Sound) {
    const lv = this.level, cn = lv.canopy;
    this.moved = false; this.event = '';
    if (!cn) return;
    this.show(lv.upTop(liz.pos.x));
    const now = shared.uTime.value;
    // The light in the doorway breathes; fireflies drift up beside the trunk.
    if (this.glowCard) {
      this.glowCard.clear();
      const pulse = 0.8 + 0.2 * Math.sin(now * 1.7);
      this.glowCard.push(cn.door.x, 0.016, cn.door.z + 0.75, 2.1, 2.1, 0, 1, 1, 1, 0.82 * pulse);
      this.glowCard.push(cn.hole.x, 0.012, cn.hole.z, 2.3, 2.3, 0, 1, 1, 1, 0.5 * pulse);
      this.glowCard.commit();
    }
    for (const f of this.sparks) {
      const rise = (now * 0.22 * f.rate + f.phase) % 1, blink = Math.max(0, Math.sin(now * f.rate * 2 + f.phase)) * Math.sin(rise * Math.PI);
      if (blink < 0.05) continue;
      const x = f.x + Math.sin(now * 0.4 + f.phase) * 0.3, z = f.z - rise * 0.5;
      this.world.glow.push(x, 0.2 + rise * 3.2, z, 0.34, 0.34, 0, 0.89, 0.96, 0.42, blink * 0.6, 0, 1.3, 0, 0);
      this.world.glow.push(x, 0.2 + rise * 3.2, z, 1.3, 1.3, 0, 0.89, 0.96, 0.42, blink * 0.08, 0, 1.3, 0, 0);
    }

    if (!this.mode) {
      this.wipe = Math.max(0, this.wipe - dt * 3);
      this.lift = 0;
      if (!playing || !liz.alive || dt <= 0) return;
      const dDoor = Math.hypot(liz.pos.x - cn.door.x, liz.pos.z - cn.door.z), dHole = Math.hypot(liz.pos.x - cn.hole.x, liz.pos.z - cn.hole.z);
      if (!this.armed) { if (dDoor > 0.95 && dHole > 0.95) this.armed = true; }
      else if (!liz.frozen && !liz.inside && (dDoor < 0.42 || dHole < 0.42)) {
        // Through the door: up if it is the one on the floor, down if it is the knothole.
        this.mode = dDoor < 0.42 ? 'up' : 'down';
        this.to = this.mode === 'up' ? cn.hole : cn.door;
        this.t = 0; this.done = false; liz.frozen = true;
        sound.play('tunnel');
        return;
      }
      if (liz.events.fell && !liz.frozen) {
        this.mode = 'fall'; this.t = 0; this.done = false; liz.frozen = true;
        this.event = 'fell';
        sound.play('dash');
      }
      return;
    }

    this.t += dt;
    const t = this.t;
    if (this.mode === 'fall') {
      if (!this.done) {
        // Off the edge: smaller and smaller, turning, as the wipe closes on it.
        liz.scale = Math.max(0.16, 1 - 0.84 * smooth(t / FALL_SHUT));
        liz.heading += dt * 7;
        this.lift = -0.3 * smooth(t / FALL_SHUT);
        this.wipe = smooth((t - 0.16) / (FALL_SHUT - 0.16));
        if (t >= FALL_SHUT) {
          const at = lv.landing(liz.pos.x, liz.pos.z, { x: 0, z: 0 });
          liz.place(at.x, at.z, liz.heading);
          this.done = true; this.moved = true; this.lift = 3.2;
          this.show(false);
        }
        return;
      }
      // Down onto the floor underneath: it drops in from above and lands in a puff of leaves.
      const u = t - FALL_SHUT - FALL_HOLD;
      this.wipe = 1 - smooth(u / FALL_OPEN);
      const was = this.lift;
      this.lift = u < 0 ? 3.2 : Math.max(0, 3.2 - 26 * u * u);
      if (was > 0 && this.lift === 0) {
        this.event = 'landed';
        fx.burst('poof', liz.pos.x, liz.pos.z); fx.burst('ring', liz.pos.x, liz.pos.z);
        sound.play('thud');
        liz.invuln = Math.max(liz.invuln, 1.2);
        liz.frozen = false;
      }
      if (u >= FALL_OPEN && this.lift === 0) { this.mode = ''; this.wipe = 0; liz.frozen = false; }
      return;
    }

    // --- through the door, either way
    if (!this.done) {
      const from = this.mode === 'up' ? cn.door : cn.hole;
      liz.pos.x = damp(liz.pos.x, from.x, 10, dt); liz.pos.z = damp(liz.pos.z, from.z, 10, dt);
      liz.scale = Math.max(0.3, 1 - 0.7 * smooth(t / DOOR_SHUT));
      this.wipe = smooth((t - 0.06) / (DOOR_SHUT - 0.06));
      if (t >= DOOR_SHUT) {
        // Out of the knothole facing the leaves; out of the door facing away from the tree.
        liz.place(this.to.x, this.to.z, this.mode === 'up' ? Math.PI / 2 : Math.PI);
        liz.scale = 0.3;
        this.done = true; this.moved = true; this.armed = false;
        this.event = this.mode;
        this.show(this.mode === 'up');
        fx.burst('sparkle', this.to.x, this.to.z, { scale: 0.5 });
      }
      return;
    }
    const u = t - DOOR_SHUT - DOOR_HOLD;
    this.wipe = 1 - smooth(u / DOOR_OPEN);
    liz.scale = Math.min(1, 0.3 + 0.7 * smooth((u + 0.1) / DOOR_OPEN));
    if (u >= DOOR_OPEN) { this.mode = ''; this.wipe = 0; liz.scale = 1; liz.frozen = false; liz.invuln = Math.max(liz.invuln, 0.6); }
  }
}
