// Particles: small flat shapes in the colours of the art (no outlines, like the drawings), all in one draw.
// Most turn to face the camera; "flat" ones lie on the ground (rings, scuffs).
import * as THREE from 'three';
import { ORDER, canvasTexture } from './gfx';
import { rand, pick, TAU } from './util';

const CELL = { dot: 0, puff: 1, leaf: 2, feather: 3, sparkle: 4, shard: 5, ring: 6, glow: 7 } as const;
const COLS = 4, ROWS = 2;

function atlas(): THREE.Texture {
  const S = 64;
  return canvasTexture(S * COLS, S * ROWS, (ctx) => {
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#fff';
    const at = (i: number) => { ctx.setTransform(1, 0, 0, 1, (i % COLS) * S + S / 2, Math.floor(i / COLS) * S + S / 2); };
    at(CELL.dot); ctx.beginPath(); ctx.arc(0, 0, 22, 0, TAU); ctx.fill();
    at(CELL.puff);
    for (const [x, y, r] of [[-8, 4, 15], [9, 6, 13], [0, -8, 16], [12, -6, 9], [-13, -7, 9]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
    at(CELL.leaf); ctx.beginPath(); ctx.moveTo(0, -26); ctx.quadraticCurveTo(15, -6, 0, 26); ctx.quadraticCurveTo(-15, -6, 0, -26); ctx.fill();
    at(CELL.feather);
    ctx.beginPath(); ctx.moveTo(0, -27); ctx.bezierCurveTo(13, -16, 11, 12, 2, 26); ctx.lineTo(-2, 26); ctx.bezierCurveTo(-11, 12, -13, -16, 0, -27); ctx.fill();
    ctx.globalCompositeOperation = 'destination-out'; ctx.lineWidth = 2;
    for (const y of [-6, 6, 16]) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(12, y + 7); ctx.stroke(); }
    ctx.globalCompositeOperation = 'source-over';
    at(CELL.sparkle);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU, r = i % 2 ? 6 : 28; ctx.lineTo(Math.sin(a) * r, -Math.cos(a) * r); }
    ctx.fill();
    at(CELL.shard); ctx.beginPath(); ctx.moveTo(-14, 16); ctx.lineTo(2, -22); ctx.lineTo(17, 12); ctx.closePath(); ctx.fill();
    at(CELL.ring); ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, 25, 0, TAU); ctx.stroke();
    at(CELL.glow);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 30);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(-32, -32, 64, 64);
  });
}

interface Recipe {
  cells: number[]; colors: number[]; count: number;
  speed: [number, number]; up: [number, number]; gravity: number; drag: number;
  life: [number, number]; size: [number, number];
  spin?: number; grow?: number; y?: number; spread?: number; bounce?: number; add?: number; flat?: boolean; sway?: number;
}

const DUST = [0xb9aa78, 0x9c8f5f, 0xcfc28f];
const SAND = [0xfde9a8, 0xf2d488, 0xfff2c8];
const LEAF = [0xf79a2e, 0xe07b1c, 0x56521f, 0x7a7430, 0xfbb65c];
const GOLD = [0xffffff, 0xffe27a, 0xfff3c0, 0xffc62e];

const RECIPES = {
  dust: { cells: [CELL.puff], colors: DUST, count: 5, speed: [0.5, 1.6], up: [0.3, 0.9], gravity: -0.3, drag: 3.2, life: [0.35, 0.7], size: [0.24, 0.46], grow: 0.9, spin: 2, y: 0.08, spread: 0.12 },
  sand: { cells: [CELL.puff], colors: SAND, count: 5, speed: [0.5, 1.6], up: [0.3, 0.9], gravity: -0.3, drag: 3.2, life: [0.35, 0.7], size: [0.24, 0.46], grow: 0.9, spin: 2, y: 0.08, spread: 0.12 },
  step: { cells: [CELL.dot, CELL.puff], colors: DUST, count: 1, speed: [0.2, 0.7], up: [0.3, 0.8], gravity: 1.5, drag: 3, life: [0.22, 0.4], size: [0.08, 0.16], grow: 0.6, y: 0.05, spread: 0.06 },
  stepSand: { cells: [CELL.dot, CELL.puff], colors: SAND, count: 1, speed: [0.2, 0.7], up: [0.3, 0.8], gravity: 1.5, drag: 3, life: [0.22, 0.4], size: [0.08, 0.16], grow: 0.6, y: 0.05, spread: 0.06 },
  thud: { cells: [CELL.puff, CELL.dot], colors: DUST, count: 18, speed: [1.5, 4.2], up: [0.8, 2.6], gravity: 2.2, drag: 2.6, life: [0.5, 1.0], size: [0.3, 0.7], grow: 0.8, spin: 3, y: 0.1, spread: 0.3 },
  leaves: { cells: [CELL.leaf], colors: LEAF, count: 6, speed: [0.8, 2.4], up: [1.4, 3.2], gravity: 5.5, drag: 1.8, life: [0.7, 1.2], size: [0.15, 0.28], spin: 8, y: 0.5, spread: 0.3, sway: 5 },
  feathers: { cells: [CELL.feather], colors: [0x3a2a08, 0xf79a2e, 0xfbe8a8, 0x5c4310], count: 7, speed: [0.8, 2.6], up: [1.4, 3.0], gravity: 1.6, drag: 2.4, life: [1.0, 1.7], size: [0.2, 0.36], spin: 3, y: 0.6, spread: 0.3, sway: 5 },
  sparkle: { cells: [CELL.sparkle], colors: GOLD, count: 7, speed: [0.5, 1.8], up: [0.8, 2.4], gravity: -0.4, drag: 2.5, life: [0.4, 0.85], size: [0.16, 0.34], spin: 3, y: 0.4, spread: 0.25, add: 0.85 },
  glint: { cells: [CELL.sparkle], colors: GOLD, count: 1, speed: [0, 0.1], up: [0.1, 0.3], gravity: 0, drag: 1, life: [0.45, 0.7], size: [0.22, 0.36], spin: 2.5, y: 0.35, spread: 0.2, add: 0.9 },
  shell: { cells: [CELL.shard], colors: [0xfde27f, 0xf79a2e, 0xe0600c, 0xfff3c0], count: 8, speed: [1.2, 3.2], up: [2.4, 4.6], gravity: 14, drag: 0.8, life: [0.6, 1.0], size: [0.1, 0.2], spin: 14, y: 0.3, bounce: 0.4 },
  hit: { cells: [CELL.shard, CELL.dot], colors: [0xffffff, 0xffc62e, 0xe0600c], count: 12, speed: [3, 7], up: [1.0, 3.5], gravity: 9, drag: 2.8, life: [0.25, 0.5], size: [0.1, 0.24], spin: 10, y: 0.3, add: 0.6 },
  ring: { cells: [CELL.ring], colors: [0xfff3c0], count: 1, speed: [0, 0], up: [0, 0], gravity: 0, drag: 0, life: [0.4, 0.4], size: [0.5, 0.5], grow: 5, y: 0.04, flat: true, add: 0.5 },
  ringBig: { cells: [CELL.ring], colors: [0xfff3c0], count: 1, speed: [0, 0], up: [0, 0], gravity: 0, drag: 0, life: [0.6, 0.6], size: [0.8, 0.8], grow: 7, y: 0.04, flat: true, add: 0.5 },
  ringRed: { cells: [CELL.ring], colors: [0xff5a36], count: 1, speed: [0, 0], up: [0, 0], gravity: 0, drag: 0, life: [0.45, 0.45], size: [0.5, 0.5], grow: 4, y: 0.04, flat: true, add: 0.6 },
  poof: { cells: [CELL.puff], colors: [0xffffff, 0xfff3c0], count: 8, speed: [0.8, 2.2], up: [0.4, 1.4], gravity: -0.6, drag: 3, life: [0.3, 0.55], size: [0.2, 0.4], grow: 1, spin: 2, y: 0.25, spread: 0.1 },
  confetti: { cells: [CELL.sparkle, CELL.shard, CELL.dot, CELL.leaf], colors: [0xffc62e, 0xf79a2e, 0xe0600c, 0xfde27f, 0x7a7430, 0xffffff], count: 26, speed: [1.5, 5], up: [3, 7], gravity: 7, drag: 1.6, life: [1.0, 1.8], size: [0.14, 0.3], spin: 10, y: 0.4, sway: 4, add: 0.2 },
  streak: { cells: [CELL.dot], colors: [0xffffff, 0xfff3c0], count: 1, speed: [0, 0.2], up: [0, 0.1], gravity: 0, drag: 2, life: [0.16, 0.26], size: [0.1, 0.18], y: 0.12, spread: 0.12, add: 0.7 },
  // --- the power eggs
  shock: { cells: [CELL.ring], colors: [0xffe27a], count: 1, speed: [0, 0], up: [0, 0], gravity: 0, drag: 0, life: [0.5, 0.5], size: [0.8, 0.8], grow: 9, y: 0.05, flat: true, add: 0.7 },
  spark: { cells: [CELL.shard, CELL.sparkle], colors: [0xffffff, 0xffe27a, 0xffc62e], count: 16, speed: [3, 8], up: [2, 5], gravity: 10, drag: 2.4, life: [0.3, 0.6], size: [0.1, 0.22], spin: 12, y: 0.3, add: 0.8 },
  rubble: { cells: [CELL.shard], colors: [0x5a4c18, 0x4a3f14, 0x7a6a2c, 0x8a7a45], count: 14, speed: [1.5, 4.5], up: [2.5, 6], gravity: 15, drag: 0.7, life: [0.8, 1.4], size: [0.14, 0.34], spin: 12, y: 0.5, spread: 0.4, bounce: 0.45 },
  dustBig: { cells: [CELL.puff], colors: DUST, count: 14, speed: [1, 3.4], up: [0.5, 1.8], gravity: -0.4, drag: 2.4, life: [0.7, 1.3], size: [0.5, 0.95], grow: 1, spin: 1.5, y: 0.2, spread: 0.5 },
  wisp: { cells: [CELL.puff, CELL.glow], colors: [0xcfe8ff, 0xffffff, 0x9fd0ff], count: 2, speed: [0.1, 0.5], up: [0.5, 1.3], gravity: -0.5, drag: 1.5, life: [0.5, 0.9], size: [0.16, 0.34], grow: 0.8, y: 0.15, spread: 0.2, add: 0.7, sway: 6 },
  ghostPop: { cells: [CELL.puff, CELL.sparkle], colors: [0xcfe8ff, 0xffffff, 0x9fd0ff], count: 16, speed: [1, 3], up: [0.8, 2.4], gravity: -0.6, drag: 2.6, life: [0.45, 0.8], size: [0.2, 0.4], grow: 1, y: 0.3, spread: 0.2, add: 0.7 },
  flame: { cells: [CELL.leaf, CELL.puff], colors: [0xffe27a, 0xff9a2e, 0xff5a1c, 0xffffff], count: 2, speed: [0.1, 0.6], up: [1.2, 2.6], gravity: -1.5, drag: 1.6, life: [0.25, 0.5], size: [0.16, 0.32], grow: -0.5, spin: 4, y: 0.12, spread: 0.14, add: 0.85 },
  ember: { cells: [CELL.dot], colors: [0xffc62e, 0xff7a1c, 0xfff3c0], count: 3, speed: [0.3, 1.4], up: [1.5, 3.5], gravity: 1.2, drag: 1.2, life: [0.6, 1.1], size: [0.05, 0.1], y: 0.3, spread: 0.3, add: 0.9, sway: 7 },
  smoke: { cells: [CELL.puff], colors: [0x3a3226, 0x5a5040, 0x2a241c], count: 4, speed: [0.2, 0.8], up: [0.8, 1.8], gravity: -0.5, drag: 1.4, life: [0.8, 1.5], size: [0.3, 0.6], grow: 1.2, spin: 1.5, y: 0.4, spread: 0.3 },
  fireRing: { cells: [CELL.ring], colors: [0xff7a1c], count: 1, speed: [0, 0], up: [0, 0], gravity: 0, drag: 0, life: [0.45, 0.45], size: [0.6, 0.6], grow: 6, y: 0.05, flat: true, add: 0.7 },
  noise: { cells: [CELL.ring], colors: [0x7fe3d6], count: 1, speed: [0, 0], up: [0, 0], gravity: 0, drag: 0, life: [0.7, 0.7], size: [0.4, 0.4], grow: 9, y: 0.05, flat: true, add: 0.55 },
  notes: { cells: [CELL.sparkle, CELL.dot], colors: [0x7fe3d6, 0xfde27f, 0xffffff], count: 3, speed: [0.4, 1.2], up: [1.2, 2.4], gravity: 0.5, drag: 1.6, life: [0.5, 0.9], size: [0.1, 0.2], spin: 5, y: 0.3, spread: 0.15, add: 0.6, sway: 8 },
  // --- small pleasures
  crumbs: { cells: [CELL.shard, CELL.dot], colors: [0x1f4a4a, 0x2f7a72, 0xf79a2e, 0x3a2a08], count: 8, speed: [0.8, 2.4], up: [1.5, 3.2], gravity: 12, drag: 1.2, life: [0.4, 0.7], size: [0.06, 0.13], spin: 14, y: 0.15, bounce: 0.3 },
  petals: { cells: [CELL.leaf, CELL.dot], colors: [0xf7b8d0, 0xd9b8f0, 0xfdf0a0, 0xffffff, 0xbfe6c8], count: 10, speed: [0.6, 2.2], up: [1.6, 3.4], gravity: 3.5, drag: 1.8, life: [0.9, 1.6], size: [0.1, 0.2], spin: 7, y: 0.3, spread: 0.3, sway: 5 },
  goldBurst: { cells: [CELL.sparkle, CELL.shard, CELL.dot], colors: GOLD, count: 40, speed: [2, 7], up: [3, 8], gravity: 8, drag: 1.5, life: [0.9, 1.7], size: [0.14, 0.34], spin: 10, y: 0.4, add: 0.8, sway: 3 },
  goldRing: { cells: [CELL.ring], colors: [0xffd84a], count: 1, speed: [0, 0], up: [0, 0], gravity: 0, drag: 0, life: [0.9, 0.9], size: [0.8, 0.8], grow: 12, y: 0.05, flat: true, add: 0.8 },
  zzz: { cells: [CELL.glow], colors: [0xffe27a], count: 1, speed: [0, 0], up: [0.5, 0.8], gravity: 0, drag: 0.5, life: [0.8, 1.2], size: [0.3, 0.4], y: 0.3, add: 1 },
} satisfies Record<string, Recipe>;

export type BurstKind = keyof typeof RECIPES;

const VERT = /* glsl */ `
attribute vec4 aPS;   // x, y, z, size
attribute vec4 aRC;   // spin angle, cell, flat, additive
attribute vec4 aCol;
varying vec2 vUv;
varying vec4 vCol;
varying float vAdd;
void main() {
  float c = cos(aRC.x), s = sin(aRC.x);
  vec2 q = vec2(position.x * c - position.y * s, position.x * s + position.y * c) * aPS.w;
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 wp = aPS.xyz + (aRC.z > 0.5 ? vec3(q.x, 0.0, q.y) : right * q.x + up * q.y);
  float cell = aRC.y;
  vUv = (vec2(mod(cell, ${COLS}.0), ${ROWS - 1}.0 - floor(cell / ${COLS}.0)) + uv) / vec2(${COLS}.0, ${ROWS}.0);
  vCol = aCol;
  vAdd = aRC.w;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;

const FRAG = /* glsl */ `
uniform sampler2D map;
varying vec2 vUv;
varying vec4 vCol;
varying float vAdd;
void main() {
  float a = texture2D(map, vUv).a * vCol.a;
  gl_FragColor = vec4(vCol.rgb * a, a * (1.0 - vAdd));
}`;

export class Particles {
  /** Rock (x, z)? Then low particles stay out of it: a puff drifting into a rock would show between its layers. */
  blocked: ((x: number, z: number) => boolean) | null = null;
  private max = 1500;
  private n = 0;
  // One row per particle: x y z vx vy vz age life size grow rot spin gravity drag bounce sway
  private d = new Float32Array(this.max * 16);
  private meta = new Float32Array(this.max * 8); // cell flat add r g b phase size0
  private ps = new Float32Array(this.max * 4);
  private rc = new Float32Array(this.max * 4);
  private col = new Float32Array(this.max * 4);
  private geo = new THREE.InstancedBufferGeometry();
  private attrs: THREE.InstancedBufferAttribute[] = [];

  constructor(parent: THREE.Object3D) {
    const base = new THREE.PlaneGeometry(1, 1);
    this.geo.index = base.index;
    this.geo.setAttribute('position', base.getAttribute('position'));
    this.geo.setAttribute('uv', base.getAttribute('uv'));
    for (const [name, arr] of [['aPS', this.ps], ['aRC', this.rc], ['aCol', this.col]] as const) {
      const a = new THREE.InstancedBufferAttribute(arr, 4);
      a.setUsage(THREE.DynamicDrawUsage);
      this.geo.setAttribute(name, a);
      this.attrs.push(a);
    }
    const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { map: { value: atlas() } }, transparent: true, depthTest: true, depthWrite: false, premultipliedAlpha: true });
    const mesh = new THREE.Mesh(this.geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = ORDER.particles;
    parent.add(mesh);
  }

  /** A puff of something at a spot. dirX/dirZ lean the burst one way; scale multiplies how many. */
  burst(kind: BurstKind, x: number, z: number, opts: { y?: number; dirX?: number; dirZ?: number; scale?: number; color?: number; size?: number } = {}) {
    const rcp: Recipe = RECIPES[kind];
    const count = Math.max(1, Math.round(rcp.count * (opts.scale ?? 1)));
    for (let i = 0; i < count; i++) {
      if (this.n >= this.max) return;
      const k = this.n++;
      const o = k * 16, m = k * 8;
      const a = Math.random() * TAU;
      const sp = rand(rcp.speed[0], rcp.speed[1]);
      const spread = rcp.spread ?? 0;
      const d = this.d;
      d[o] = x + Math.cos(a) * spread * Math.random();
      d[o + 1] = (opts.y ?? rcp.y ?? 0.2) + Math.random() * 0.05;
      d[o + 2] = z + Math.sin(a) * spread * Math.random();
      d[o + 3] = Math.cos(a) * sp + (opts.dirX ?? 0);
      d[o + 4] = rand(rcp.up[0], rcp.up[1]);
      d[o + 5] = Math.sin(a) * sp + (opts.dirZ ?? 0);
      d[o + 6] = 0;
      d[o + 7] = rand(rcp.life[0], rcp.life[1]);
      d[o + 8] = rand(rcp.size[0], rcp.size[1]) * (opts.size ?? 1);
      d[o + 9] = rcp.grow ?? 0;
      d[o + 10] = Math.random() * TAU;
      d[o + 11] = rand(-1, 1) * (rcp.spin ?? 0);
      d[o + 12] = rcp.gravity;
      d[o + 13] = rcp.drag;
      d[o + 14] = rcp.bounce ?? 0;
      d[o + 15] = rcp.sway ?? 0;
      const c = opts.color ?? pick(rcp.colors);
      const mt = this.meta;
      mt[m] = pick(rcp.cells); mt[m + 1] = rcp.flat ? 1 : 0; mt[m + 2] = rcp.add ?? 0;
      mt[m + 3] = ((c >> 16) & 255) / 255; mt[m + 4] = ((c >> 8) & 255) / 255; mt[m + 5] = (c & 255) / 255;
      mt[m + 6] = Math.random() * TAU;
    }
  }

  update(dt: number) {
    const d = this.d, mt = this.meta;
    let i = 0;
    while (i < this.n) {
      const o = i * 16;
      d[o + 6] += dt;
      if (d[o + 6] >= d[o + 7]) {
        // Dead: move the last one into its place.
        const last = --this.n;
        if (last !== i) { d.copyWithin(o, last * 16, last * 16 + 16); mt.copyWithin(i * 8, last * 8, last * 8 + 8); }
        continue;
      }
      const drag = Math.exp(-d[o + 13] * dt);
      d[o + 3] *= drag; d[o + 5] *= drag;
      d[o + 4] = d[o + 4] * drag - d[o + 12] * dt;
      const sway = d[o + 15];
      if (sway) d[o + 3] += Math.sin(d[o + 6] * sway + mt[i * 8 + 6]) * dt * 2.2;
      const px = d[o], pz = d[o + 2];
      d[o] += d[o + 3] * dt; d[o + 1] += d[o + 4] * dt; d[o + 2] += d[o + 5] * dt;
      if (this.blocked && d[o + 1] < 1.5 && !mt[i * 8 + 1] && this.blocked(d[o], d[o + 2]) && !this.blocked(px, pz)) {
        d[o] = px; d[o + 2] = pz; d[o + 3] *= -0.25; d[o + 5] *= -0.25;
      }
      if (d[o + 1] < 0.03 && !mt[i * 8 + 1]) {
        d[o + 1] = 0.03;
        if (d[o + 14] > 0 && d[o + 4] < -0.5) { d[o + 4] *= -d[o + 14]; d[o + 3] *= 0.6; d[o + 5] *= 0.6; } else { d[o + 4] = 0; d[o + 3] *= 0.8; d[o + 5] *= 0.8; d[o + 11] *= 0.8; }
      }
      d[o + 10] += d[o + 11] * dt;
      i++;
    }
    for (let k = 0; k < this.n; k++) {
      const o = k * 16, m = k * 8, q = k * 4;
      const t = d[o + 6] / d[o + 7];
      const pop = Math.min(1, t * 8);
      this.ps[q] = d[o]; this.ps[q + 1] = d[o + 1]; this.ps[q + 2] = d[o + 2];
      this.ps[q + 3] = d[o + 8] * (1 + d[o + 9] * t) * pop;
      this.rc[q] = d[o + 10]; this.rc[q + 1] = mt[m]; this.rc[q + 2] = mt[m + 1]; this.rc[q + 3] = mt[m + 2];
      this.col[q] = mt[m + 3]; this.col[q + 1] = mt[m + 4]; this.col[q + 2] = mt[m + 5];
      this.col[q + 3] = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
    }
    this.geo.instanceCount = this.n;
    for (const a of this.attrs) a.needsUpdate = true;
  }

  get live() { return this.n; }
}
