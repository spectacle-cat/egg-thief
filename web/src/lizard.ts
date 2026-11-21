// The lizard. The hand-drawn picture is laid along a spine of points that follow the head like a towed rope, so the
// body bends through turns and the tail swings out behind; a wave runs down it while it runs. The tail can be
// dropped (a lizard's one free escape) and grows back as a short whole tail that lengthens.
import * as THREE from 'three';
import { DITHER_F, FOG_PARS_F, FOG_PARS_V, FOG_V, ORDER, fogUniforms } from './gfx';
import type { Level } from './level';
import { TAU, angleDamp, angleDiff, clamp, clamp01, damp, dirX, dirZ, headingOf, type V2 } from './util';

const N = 18;                 // points along the spine
const LENGTH = 1.18;          // tiles, nose to tail tip
const BODY = 0.48;            // share of the picture that is head and body (the rest is tail)
const HALF_W = 0.37;          // half the width of the strip of picture used (legs included)
const U0 = 0.18, U1 = 0.82;   // that strip, across one frame
export const RADIUS = 0.2;
const RUN = 4.7;
const DASH_SPEED = 12.5;
const DASH_TIME = 0.16;
const DASH_COOLDOWN = 0.68;
const STEP = 0.08;            // spacing of the remembered path (the eggs follow it)
const HISTORY = 640;

const VERT = /* glsl */ `
uniform float uFrame;
uniform vec3 uOffset;
varying vec2 vUv;
${FOG_PARS_V}
void main() {
  vUv = vec2(uv.x + uFrame * 0.5, uv.y);
  vec3 wp = position + uOffset;
  ${FOG_V}
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;
const FRAG = /* glsl */ `
uniform sampler2D map;
uniform vec4 uTint;
uniform float uFlash;
uniform float uBias;
varying vec2 vUv;
${FOG_PARS_F}
${DITHER_F}
void main() {
  vec4 t = texture2D(map, vUv, uBias);
#ifdef CUT
  if (t.a < 0.5) discard;
  if (uTint.a < 0.995 && uTint.a <= dither()) discard;
  vec3 rgb = mix(t.rgb / max(t.a, 0.001) * uTint.rgb, vec3(1.0), uFlash);
  gl_FragColor = vec4(mix(rgb, uFog.rgb, fogAmt()), 1.0);
#elif defined(XRAY)
  // Behind a rock or under leaves: its shape shows through in stripes, so the player never loses it.
  if (t.a < 0.5) discard;
  float stripe = step(0.5, fract((gl_FragCoord.x + gl_FragCoord.y) * 0.2));
  gl_FragColor = vec4(uTint.rgb, 1.0) * (uTint.a * (0.5 + 0.5 * stripe));
#else
  vec4 c = vec4(t.rgb * uTint.rgb, t.a) * uTint.a;
  c.rgb = mix(c.rgb, uFog.rgb * c.a, fogAmt());
  gl_FragColor = c;
#endif
}`;

/** kind: 'cut' the solid body, 'decal' its soft shadow, 'xray' its shape seen through whatever is in front. */
function ribbonMaterial(tex: THREE.Texture, kind: 'cut' | 'decal' | 'xray' = 'cut') {
  return new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG,
    defines: kind === 'cut' ? { CUT: 1 } : kind === 'xray' ? { XRAY: 1 } : {},
    uniforms: { map: { value: tex }, uFrame: { value: 0 }, uOffset: { value: new THREE.Vector3() }, uTint: { value: new THREE.Vector4(1, 1, 1, 1) }, uFlash: { value: 0 }, uBias: { value: 0 }, ...fogUniforms() },
    transparent: kind !== 'cut', depthTest: true, depthWrite: kind === 'cut', depthFunc: kind === 'xray' ? THREE.GreaterDepth : THREE.LessEqualDepth,
    premultipliedAlpha: true, side: THREE.DoubleSide, blending: kind === 'cut' ? THREE.NoBlending : THREE.NormalBlending,
  });
}

/** A strip of the picture along a row of points (n points, two vertices each). */
class Ribbon {
  readonly geo = new THREE.BufferGeometry();
  readonly pos: Float32Array;
  readonly uv: Float32Array;
  constructor(readonly n: number) {
    this.pos = new Float32Array(n * 6);
    this.uv = new Float32Array(n * 4);
    const idx: number[] = [];
    for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    this.geo.setIndex(idx);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2).setUsage(THREE.DynamicDrawUsage));
  }
  /** pts: x,z pairs from the head end. v: the picture's v at each point. */
  build(pts: Float32Array, v: Float32Array, halfW: number, y: number) {
    const n = this.n;
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
      let fx = pts[a * 2] - pts[b * 2], fz = pts[a * 2 + 1] - pts[b * 2 + 1];
      const len = Math.hypot(fx, fz) || 1;
      fx /= len; fz /= len;
      const rx = -fz * halfW, rz = fx * halfW; // the lizard's right-hand side
      const o = i * 6;
      this.pos[o] = pts[i * 2] - rx; this.pos[o + 1] = y; this.pos[o + 2] = pts[i * 2 + 1] - rz;
      this.pos[o + 3] = pts[i * 2] + rx; this.pos[o + 4] = y; this.pos[o + 5] = pts[i * 2 + 1] + rz;
      const u = i * 4;
      this.uv[u] = U0 * 0.5; this.uv[u + 1] = v[i];
      this.uv[u + 2] = U1 * 0.5; this.uv[u + 3] = v[i];
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.uv.needsUpdate = true;
  }
}

export interface LizardEvents { dashed: boolean; stepped: boolean; enteredCover: boolean; leftCover: boolean; bumped: boolean }

export class Lizard {
  pos: V2 = { x: 0, z: 0 };
  vel: V2 = { x: 0, z: 0 };
  heading = 0;
  speed = 0;
  alive = true;
  hidden = false;
  hiddenAmt = 0;
  /** The tile of the tuft it is under (for rustling it). */
  coverC = -1; coverR = -1;
  hasTail = true;
  /** How much tail there is: 1 whole, about 0.15 a stub. */
  tailLen = 1;
  regrow = 0;
  invuln = 0;
  boost = 0;
  dashT = 0;
  dashCd = 0;
  /** Set by the game to stop it (cut-scenes, the way out). */
  frozen = false;
  /** Death tumble: turns and shrinks. */
  tumble = 0;
  scale = 1;
  flash = 0;
  private dashX = 0; private dashZ = 0;
  private gait = 0;
  private stepAcc = 0;
  private idle = 0;
  private pts = new Float32Array(N * 2);
  private draw = new Float32Array(N * 2);
  private vs = new Float32Array(N);
  private hist = new Float32Array(HISTORY * 2);
  private histHead = 0;
  private histAcc = 0;
  private body = new Ribbon(N);
  private mat: THREE.ShaderMaterial;
  private underMat: THREE.ShaderMaterial;
  private xrayMat: THREE.ShaderMaterial;
  private shadowMat: THREE.ShaderMaterial;
  /** 0..1: a Ghost Egg has it (pale, half there). */
  ghost = 0;
  /** 0..1: a Chili Egg has it (burning). */
  fire = 0;
  /** How much faster than usual it runs (a Chili Egg). */
  speedMul = 1;
  /** Push-ups and sunbathing when left alone (set by the game: 0 none, else how high it is lifted). */
  lift = 0;
  readonly events: LizardEvents = { dashed: false, stepped: false, enteredCover: false, leftCover: false, bumped: false };

  constructor(parent: THREE.Object3D, tex: THREE.Texture) {
    this.mat = ribbonMaterial(tex);
    // A second, darker copy just under the first: the cut-out has an edge, like card.
    this.underMat = ribbonMaterial(tex);
    this.underMat.uniforms.uOffset.value.set(0, -0.03, 0);
    this.xrayMat = ribbonMaterial(tex, 'xray');
    this.shadowMat = ribbonMaterial(tex, 'decal');
    this.shadowMat.uniforms.uTint.value.set(0, 0, 0, 0.34);
    this.shadowMat.uniforms.uBias.value = 1.6;
    this.shadowMat.uniforms.uOffset.value.set(0.07, -0.055, 0.06);
    const shadow = new THREE.Mesh(this.body.geo, this.shadowMat);
    shadow.renderOrder = ORDER.lizardShadow;
    const under = new THREE.Mesh(this.body.geo, this.underMat);
    const mesh = new THREE.Mesh(this.body.geo, this.mat);
    const xray = new THREE.Mesh(this.body.geo, this.xrayMat);
    xray.renderOrder = ORDER.mark - 1;
    for (const m of [shadow, under, mesh, xray]) { m.frustumCulled = false; parent.add(m); }
  }

  get dashing() { return this.dashT > 0; }
  get dashReady() { return this.dashCd <= 0; }
  /** Can a hunter see it? */
  get exposed() { return this.alive && !this.hidden && !this.frozen && this.ghost < 0.5; }
  /** How long it has been standing still. */
  get idleTime() { return this.idle; }
  get physicalLength() { return LENGTH * (BODY + (1 - BODY) * this.tailLen); }

  place(x: number, z: number, heading: number) {
    this.pos.x = x; this.pos.z = z; this.heading = heading;
    this.vel.x = this.vel.z = 0; this.speed = 0;
    this.dashT = 0; this.tumble = 0; this.scale = 1;
    this.straighten();
    this.render(0);
    for (let i = 0; i < HISTORY; i++) { this.hist[i * 2] = x - dirX(heading) * i * STEP * 0.2; this.hist[i * 2 + 1] = z - dirZ(heading) * i * STEP * 0.2; }
    this.histHead = 0; this.histAcc = 0;
    this.hidden = false; this.coverC = this.coverR = -1;
  }

  private straighten() {
    const seg = this.physicalLength / (N - 1);
    const hx = this.pos.x + dirX(this.heading) * 0.26, hz = this.pos.z + dirZ(this.heading) * 0.26;
    for (let i = 0; i < N; i++) { this.pts[i * 2] = hx - dirX(this.heading) * seg * i; this.pts[i * 2 + 1] = hz - dirZ(this.heading) * seg * i; }
  }

  /** moveX/moveZ: where the player is pushing, already turned to the world (length up to 1). */
  update(dt: number, moveX: number, moveZ: number, wantDash: boolean, level: Level) {
    const ev = this.events;
    ev.dashed = ev.stepped = ev.enteredCover = ev.leftCover = ev.bumped = false;
    this.invuln = Math.max(0, this.invuln - dt);
    this.boost = Math.max(0, this.boost - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.flash = damp(this.flash, 0, 9, dt);

    if (!this.alive) {
      // Tumbling: the original game's death spin.
      this.tumble += dt;
      const t = clamp01(this.tumble / 1.0);
      this.heading += (1 - t) * (1 - t) * 26 * dt;
      this.scale = 1 - 0.55 * t * t;
      this.vel.x = damp(this.vel.x, 0, 6, dt); this.vel.z = damp(this.vel.z, 0, 6, dt);
      this.straighten();
      this.render(0);
      return;
    }

    if (!this.hasTail || this.tailLen < 1) {
      this.regrow -= dt;
      if (this.regrow <= 0) { this.hasTail = true; this.tailLen = Math.min(1, this.tailLen + dt * 0.55); }
    }

    let mag = Math.hypot(moveX, moveZ);
    if (this.frozen) { moveX = moveZ = 0; mag = 0; wantDash = false; }
    if (wantDash && this.dashCd <= 0) {
      const dx = mag > 0.2 ? moveX / mag : dirX(this.heading), dz = mag > 0.2 ? moveZ / mag : dirZ(this.heading);
      this.dashX = dx; this.dashZ = dz;
      this.dashT = DASH_TIME; this.dashCd = DASH_COOLDOWN;
      ev.dashed = true;
    }
    const top = RUN * (this.boost > 0 ? 1.32 : 1) * this.speedMul;
    if (this.dashT > 0) {
      this.dashT -= dt;
      this.vel.x = this.dashX * DASH_SPEED; this.vel.z = this.dashZ * DASH_SPEED;
      if (this.dashT <= 0) { this.vel.x = this.dashX * top * 1.15; this.vel.z = this.dashZ * top * 1.15; }
    } else {
      const rate = mag > 0.05 ? 20 : 15;
      this.vel.x = damp(this.vel.x, moveX * top, rate, dt);
      this.vel.z = damp(this.vel.z, moveZ * top, rate, dt);
    }

    const bx = this.pos.x, bz = this.pos.z;
    ev.bumped = level.moveCircle(this.pos, this.vel.x * dt, this.vel.z * dt, RADIUS);
    const mx = this.pos.x - bx, mz = this.pos.z - bz;
    const moved = Math.hypot(mx, mz);
    this.speed = dt > 0 ? moved / dt : 0;
    if (ev.bumped && dt > 0) { this.vel.x = mx / dt; this.vel.z = mz / dt; }
    if (this.speed > 0.4) this.heading = angleDamp(this.heading, headingOf(mx, mz), this.dashT > 0 ? 40 : 16, dt);

    this.gait += moved * 9.5;
    this.stepAcc += moved;
    if (this.stepAcc > 0.36) { this.stepAcc = 0; ev.stepped = true; }
    this.idle = this.speed < 0.2 ? this.idle + dt : 0;

    // Remember the path, for the eggs that follow.
    this.histAcc += moved;
    while (this.histAcc >= STEP) {
      this.histAcc -= STEP;
      this.histHead = (this.histHead + HISTORY - 1) % HISTORY;
      this.hist[this.histHead * 2] = this.pos.x; this.hist[this.histHead * 2 + 1] = this.pos.z;
    }

    const was = this.hidden;
    this.hidden = level.coverAt(this.pos.x, this.pos.z);
    if (this.hidden) {
      // Which tuft: the nearest one's tile.
      let best = 9;
      const c0 = Math.floor(this.pos.x), r0 = Math.floor(this.pos.z);
      for (let r = r0 - 1; r <= r0 + 1; r++) for (let c = c0 - 1; c <= c0 + 1; c++) {
        if (!level.isCover(c, r)) continue;
        const d = Math.hypot(this.pos.x - c - 0.5, this.pos.z - r - 0.5);
        if (d < best) { best = d; this.coverC = c; this.coverR = r; }
      }
    }
    ev.enteredCover = this.hidden && !was;
    ev.leftCover = !this.hidden && was;
    this.hiddenAmt = damp(this.hiddenAmt, this.hidden ? 1 : 0, 9, dt);

    // Shrinking into a burrow it goes in stiff; otherwise the body follows the head.
    if (this.frozen && this.scale !== 1) this.straighten(); else this.followSpine(dt);
    this.render(dt);
  }

  private followSpine(dt: number) {
    const p = this.pts;
    const stretch = this.dashT > 0 ? 1.16 : 1;
    const seg = (this.physicalLength / (N - 1)) * stretch;
    p[0] = this.pos.x + dirX(this.heading) * 0.26;
    p[1] = this.pos.z + dirZ(this.heading) * 0.26;
    let prev = this.heading + Math.PI; // direction from each point to the next, as a heading
    for (let i = 1; i < N; i++) {
      let dx = p[i * 2] - p[i * 2 - 2], dz = p[i * 2 + 1] - p[i * 2 - 1];
      if (Math.abs(dx) + Math.abs(dz) < 1e-6) { dx = -dirX(this.heading); dz = -dirZ(this.heading); }
      let a = headingOf(dx, dz);
      // The body is stiffer than the tail: limit how sharply each joint may bend.
      const s = i / (N - 1);
      const maxBend = (s < 0.3 ? 0.16 : s < 0.5 ? 0.24 : 0.42) * (this.dashT > 0 ? 0.5 : 1);
      const bend = angleDiff(prev, a);
      if (Math.abs(bend) > maxBend) a = prev + Math.sign(bend) * maxBend;
      // At rest the tail eases a little straighter.
      if (this.idle > 0.3) a = angleDamp(a, prev, 0.5, dt);
      p[i * 2] = p[i * 2 - 2] + dirX(a) * seg;
      p[i * 2 + 1] = p[i * 2 - 1] + dirZ(a) * seg;
      prev = a;
    }
  }

  private render(dt: number) {
    const p = this.pts, d = this.draw;
    const run = clamp01(this.speed / RUN);
    const amp = 0.02 + 0.075 * run + (this.dashT > 0 ? 0.03 : 0);
    // Idle life: a slow tail flick now and then.
    const flick = this.idle > 1.5 ? Math.sin(this.idle * 2.2) * 0.05 * clamp01((this.idle - 1.5) * 2) : 0;
    const total = this.physicalLength;
    for (let i = 0; i < N; i++) {
      const a = Math.max(0, i - 1), b = Math.min(N - 1, i + 1);
      let fx = p[a * 2] - p[b * 2], fz = p[a * 2 + 1] - p[b * 2 + 1];
      const len = Math.hypot(fx, fz) || 1;
      fx /= len; fz /= len;
      const s = i / (N - 1);
      const w = (amp * (0.12 + Math.pow(s, 1.25)) * (s < 0.08 ? -0.6 : 1)) * Math.sin(this.gait - s * 8.5) + flick * s * s * Math.sin(this.idle * 5 - s * 4);
      let x = p[i * 2] - fz * w, z = p[i * 2 + 1] + fx * w;
      if (this.scale !== 1) { x = this.pos.x + (x - this.pos.x) * this.scale; z = this.pos.z + (z - this.pos.z) * this.scale; }
      d[i * 2] = x; d[i * 2 + 1] = z;
      // Where along the picture this point is: the body as drawn, the tail squeezed into however long it is now.
      const dist = s * total;
      const sPic = dist <= BODY * LENGTH ? dist / LENGTH : BODY + ((dist - BODY * LENGTH) / Math.max(1e-4, (1 - BODY) * this.tailLen * LENGTH)) * (1 - BODY);
      this.vs[i] = 1 - clamp(sPic, 0, 1);
    }
    this.body.build(d, this.vs, HALF_W * this.scale * (this.dashT > 0 ? 0.92 : 1), 0.075 + this.lift);
    const u = this.mat.uniforms;
    const frame = this.speed > 0.3 ? Math.floor(this.gait / Math.PI) & 1 : 0;
    for (const m of [this.mat, this.underMat, this.xrayMat, this.shadowMat]) m.uniforms.uFrame.value = frame;
    // Blink while it can't be hurt; darker and cooler under leaves; pale as a ghost; red hot on a chili.
    const blink = this.invuln > 0 && this.alive ? 0.6 + 0.4 * Math.sin(this.invuln * 38) : 1;
    const h = this.hiddenAmt, g = this.ghost, f = this.fire * (0.75 + 0.25 * Math.sin(this.gait * 3.1));
    const r = (1 - 0.3 * h) * (1 - 0.45 * g) + 0.25 * f, gr = (1 - 0.18 * h) * (1 - 0.1 * g) * (1 - 0.3 * f), b = (1 - 0.3 * h) * (1 + 0.6 * g) * (1 - 0.6 * f);
    const solid = blink * (1 - 0.62 * g);
    (u.uTint.value as THREE.Vector4).set(r, gr, b, solid);
    (this.underMat.uniforms.uTint.value as THREE.Vector4).set(r * 0.55, gr * 0.5, b * 0.45, solid);
    (this.xrayMat.uniforms.uTint.value as THREE.Vector4).set(1 - 0.4 * g, 0.84, 0.3 + 0.7 * g, this.alive ? 0.6 : 0);
    u.uFlash.value = this.flash;
    this.shadowMat.uniforms.uTint.value.w = 0.34 * (1 - h * 0.8) * (1 - 0.6 * g);
    void dt;
  }

  /** A point on the path behind the lizard (for the eggs). */
  trail(distBehind: number, out: V2): V2 {
    const f = distBehind / STEP;
    const i = Math.min(HISTORY - 2, Math.floor(f));
    const t = f - i;
    const a = (this.histHead + i) % HISTORY, b = (this.histHead + i + 1) % HISTORY;
    out.x = this.hist[a * 2] + (this.hist[b * 2] - this.hist[a * 2]) * t;
    out.z = this.hist[a * 2 + 1] + (this.hist[b * 2 + 1] - this.hist[a * 2 + 1]) * t;
    return out;
  }

  /** Points of the tail, from its root, for the tail that is left behind. */
  tailPoints(): V2[] {
    const out: V2[] = [];
    for (let i = Math.floor(N * BODY); i < N; i++) out.push({ x: this.pts[i * 2], z: this.pts[i * 2 + 1] });
    return out;
  }

  dropTail() {
    this.hasTail = false;
    this.tailLen = 0.14;
    this.regrow = 14;
    this.invuln = 1.6;
    this.boost = 1.8;
    this.flash = 1;
  }

  regrowNow() { this.hasTail = true; this.regrow = 0; }

  nose(out: V2): V2 { out.x = this.pts[0]; out.z = this.pts[1]; return out; }
}

/** The tail that was dropped: it lies there and thrashes, and whatever was hunting goes for it. */
export class TailDecoy {
  x = 0; z = 0;
  life = 0;
  private ribbon = new Ribbon(9);
  private mat: THREE.ShaderMaterial;
  private mesh: THREE.Mesh;
  private base: V2[] = [];
  private pts = new Float32Array(18);
  private vs = new Float32Array(9);

  constructor(parent: THREE.Object3D, tex: THREE.Texture) {
    this.mat = ribbonMaterial(tex);
    this.mesh = new THREE.Mesh(this.ribbon.geo, this.mat);
    this.mesh.renderOrder = ORDER.lizard; this.mesh.frustumCulled = false; this.mesh.visible = false;
    parent.add(this.mesh);
    for (let i = 0; i < 9; i++) this.vs[i] = (1 - BODY) * (1 - i / 8);
  }

  get active() { return this.life > 0; }

  drop(points: V2[]) {
    this.base = [];
    for (let i = 0; i < 9; i++) {
      const f = (i / 8) * (points.length - 1);
      const a = Math.floor(f), b = Math.min(points.length - 1, a + 1), t = f - a;
      this.base.push({ x: points[a].x + (points[b].x - points[a].x) * t, z: points[a].z + (points[b].z - points[a].z) * t });
    }
    this.x = this.base[4].x; this.z = this.base[4].z;
    this.life = 3.4;
    this.mesh.visible = true;
  }

  update(dt: number, time: number) {
    if (this.life <= 0) return;
    this.life -= dt;
    if (this.life <= 0) { this.mesh.visible = false; return; }
    const wild = clamp01(this.life / 3.4);
    for (let i = 0; i < 9; i++) {
      const a = Math.max(0, i - 1), b = Math.min(8, i + 1);
      let fx = this.base[a].x - this.base[b].x, fz = this.base[a].z - this.base[b].z;
      const len = Math.hypot(fx, fz) || 1;
      fx /= len; fz /= len;
      const w = Math.sin(time * 34 - i * 1.1) * 0.13 * wild * (0.4 + i / 8) + Math.sin(time * 13 + i) * 0.04 * wild;
      this.pts[i * 2] = this.base[i].x - fz * w;
      this.pts[i * 2 + 1] = this.base[i].z + fx * w;
    }
    this.ribbon.build(this.pts, this.vs, HALF_W, 0.06);
    (this.mat.uniforms.uTint.value as THREE.Vector4).w = clamp01(this.life / 0.5);
  }

  clear() { this.life = 0; this.mesh.visible = false; }
}

export const LIZARD = { RUN, DASH_COOLDOWN, LENGTH, TAU };
