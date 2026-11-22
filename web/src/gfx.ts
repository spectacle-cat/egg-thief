// Drawing. The world is paper cut-outs. There are four ways to draw one (BatchOpts.kind):
//   decal  lies on the ground or on a thing, blended softly (shadows, glows, nests, sight cones). Painted in ORDER,
//          lowest first, and hidden by whatever solid stands between it and the camera.
//   cut    a solid cut-out lying flat at some height (rocks and bushes are stacks of these; the hunters). It hides
//          what is behind it, which is what lets the low camera play with what you can see.
//   up     a solid cut-out standing on its bottom edge, turned to face the camera (cactus, long grass, far mesas).
//   over   blended and never hidden (warnings the player must not miss).
// Far things fade into the dust of the place (shared.uFog).
//
// Colours are kept as the art has them (no linear conversion): flat hand-drawn shapes, blended the way a paint
// program blends them. Textures are premultiplied so soft edges don't pick up a dark fringe.
import * as THREE from 'three';
import type { Level } from './level';

THREE.ColorManagement.enabled = false;

/** Paint order: lower numbers are drawn first (they are lower down in the world). */
export const ORDER = {
  ground: 0, trail: 1, burrow: 2, nest: 3, glow: 4, cone: 5, shadow: 6, egg: 7, scorpion: 8, lizardShadow: 9, lizard: 10,
  runner: 11, boulder: 12, tuft: 13, particles: 14, birdShadowHigh: 15, owl: 16, hawk: 17, mark: 18,
} as const;

/** Values every material reads. */
export const shared = {
  uTime: { value: 0 },
  uWind: { value: new THREE.Vector2(0.05, 0.03) },
  /** The window cut in the leaves between the camera and a hidden lizard: where it is on the screen (pixels), how wide (pixels), 0..1 open. */
  uHole: { value: new THREE.Vector4(0, 0, 0, 0) },
  /** The lizard on the ground (x, z), how hard it pushes long grass aside, and how far from it leaves may be cut. */
  uLizard: { value: new THREE.Vector4(0, 0, 0, 2.6) },
  /** The camera's right-hand side along the ground: standing cut-outs turn to face it. */
  uCamRight: { value: new THREE.Vector2(1, 0) },
  /** Which way standing cut-outs stand: straight up for the low camera, leaning back to face a camera that looks down on them. */
  uCamUp: { value: new THREE.Vector3(0, 1, 0) },
  /** Dust in the distance: colour and how thick (0 none). */
  uFog: { value: new THREE.Vector4(0.86, 0.7, 0.48, 0) },
  /** Where the dust starts and where it is at its thickest (tiles from the camera). */
  uFogRange: { value: new THREE.Vector2(10, 34) },
  /** How far the water has risen: 0 a dry spell, 1 in flood. */
  uFlood: { value: 0 },
  /** How hard it is raining, 0..1. */
  uRain: { value: 0 },
  /** A map in two parts (a forest floor, and its canopy in a far corner of the same grid): where the line between them
   *  runs (x), and which side is shown (-1 the left, 1 the right). Nothing is hidden while the line is far off. */
  uSplit: { value: new THREE.Vector2(1e9, -1) },
};

/** Shader pieces for the dust in the distance. In a vertex shader call FOG_V with the world position in wp. */
export const FOG_PARS_V = /* glsl */ `varying float vFogD;`;
export const FOG_V = /* glsl */ `vFogD = distance(wp, cameraPosition);`;
export const FOG_PARS_F = /* glsl */ `
uniform vec4 uFog;
uniform vec2 uFogRange;
varying float vFogD;
float fogAmt() { return uFog.a * smoothstep(uFogRange.x, uFogRange.y, vFogD); }`;
export const fogUniforms = () => ({ uFog: shared.uFog, uFogRange: shared.uFogRange, uSplit: shared.uSplit });
/** A fine scatter of dots, 0..1: solid cut-outs fade by dropping dots, not by going see-through. */
export const DITHER_F = /* glsl */ `
float dither() { return fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))); }`;

const loader = new THREE.TextureLoader();
let maxAniso = 4;

export function loadTexture(url: string, opts: { repeat?: boolean } = {}): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    loader.load(url, (t) => {
      t.premultiplyAlpha = true;
      t.colorSpace = THREE.NoColorSpace;
      t.anisotropy = maxAniso;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
      if (opts.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.needsUpdate = true;
      resolve(t);
    }, undefined, () => reject(new Error(`Couldn't load ${url}`)));
  });
}

/** For art that may not be drawn yet: a blank stand-in instead of a failed start. */
export async function loadTextureOr(url: string, opts: { repeat?: boolean } = {}): Promise<THREE.Texture> {
  try { return await loadTexture(url, opts); } catch {
    console.warn(`[art] missing ${url.split('/').pop()}: drawing nothing in its place`);
    return canvasTexture(4, 4, () => {});
  }
}

export function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.premultiplyAlpha = true;
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = maxAniso;
  return t;
}

export function makeRenderer(container: HTMLElement): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, depth: true, stencil: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x342b0e, 1);
  renderer.sortObjects = true;
  maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  container.appendChild(renderer.domElement);
  return renderer;
}

// ---------------------------------------------------------------------------------------------------------
// Sprite batches: many flat cut-outs of one texture in a single draw.

const SPRITE_VERT = /* glsl */ `
attribute vec4 aPR;   // x, y, z, heading (standing cut-outs: how far the top leans sideways)
attribute vec4 aSS;   // width, length (standing: height), sway, phase
attribute vec4 aUv;   // u, v, du, dv (or four numbers for a drawn shape)
attribute vec4 aTint; // r, g, b, a
attribute vec2 aFx;   // rustle, flash
uniform float uTime;
uniform vec2 uWind;
uniform vec2 uCamRight;
uniform vec3 uCamUp;
uniform vec4 uLizard;
uniform vec2 uSplit;
varying vec2 vUv;
varying vec2 vLocal;
varying vec4 vParams;
varying vec4 vTint;
varying vec2 vWorld;
varying float vFlash;
${FOG_PARS_V}
void main() {
#ifdef TILT
  float sw = 0.0; // these cards use the two numbers to tip, not to sway
#else
  float sw = aSS.z;
#endif
  float t = uTime * 1.3 + aSS.w;
  vec2 gust = sw * vec2((sin(t) * 0.6 + sin(t * 2.3 + 1.7) * 0.4) * uWind.x, cos(t * 0.9) * uWind.y) * 20.0;
  vec2 shake = aFx.x * 0.075 * vec2(sin(uTime * 41.0 + aSS.w * 7.0), cos(uTime * 37.0 + aSS.w * 3.0));
#ifdef UP
  float sx = uv.x - 0.5, sy = uv.y;
  float bend = sy * sy;
  vec3 wp = aPR.xyz + uCamUp * (sy * aSS.y);
  wp.xz += uCamRight * (sx * aSS.x + bend * aSS.y * aPR.w);
  wp.xz += (gust * 2.2 + shake * 2.0) * bend;
  if (sw > 0.0) {
    // The lizard pushes through: blades lean away from it and bow down.
    vec2 away = aPR.xz - uLizard.xy;
    float d = length(away);
    float push = (1.0 - smoothstep(0.12, 0.8, d)) * uLizard.z;
    wp.xz += away / max(d, 0.05) * push * 0.42 * bend;
    wp.y -= push * 0.3 * sy * aSS.y;
  }
#else
  float c = cos(aPR.w), s = sin(aPR.w);
  vec2 q = position.xz * aSS.xy;
  float lift = 0.0;
#ifdef TILT
  // A card tipped out of flat: rolled (its right edge up) and pitched (its front, the top of the picture, up).
  lift = q.x * sin(aSS.z) - q.y * sin(aSS.w);
  q *= vec2(cos(aSS.z), cos(aSS.w));
#endif
  vec2 r = vec2(q.x * c - q.y * s, q.x * s + q.y * c);
  vec3 wp = vec3(aPR.x + r.x, aPR.y + lift, aPR.z + r.y);
  wp.xz += gust + shake;
#endif
  vWorld = wp.xz;
  vLocal = uv;
  vParams = aUv;
  vUv = aUv.xy + uv * aUv.zw;
  vTint = aTint;
  vFlash = aFx.y;
  ${FOG_V}
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
  // The other part of a map in two parts is not drawn at all.
  if ((aPR.x - uSplit.x) * uSplit.y < 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;

const SPRITE_FRAG = /* glsl */ `
uniform sampler2D map;
uniform float uBias;
uniform float uHoleOn;
uniform float uCut;
uniform vec4 uHole;
uniform vec4 uLizard;
varying vec2 vUv;
varying vec4 vTint;
varying vec2 vWorld;
varying float vFlash;
${FOG_PARS_F}
${DITHER_F}
void main() {
  vec4 t = texture2D(map, vUv, uBias);
#ifdef CUT
  if (t.a < uCut) discard;
  if (vTint.a < 0.995 && vTint.a <= dither()) discard;
  vec3 rgb = t.rgb / max(t.a, 0.001) * vTint.rgb;
  rgb = mix(rgb, vec3(1.0), vFlash);
  if (uHoleOn > 0.5 && uHole.w > 0.001) {
    // A window cut through the leaves between the camera and the lizard, with a ragged paper edge.
    vec2 q = gl_FragCoord.xy - uHole.xy;
    float edge = uHole.z * uHole.w * (1.0 + 0.09 * sin(atan(q.y, q.x) * 9.0 + vWorld.x * 3.0));
    float d = length(q);
    if (d < edge && distance(vWorld, uLizard.xy) < uLizard.w) discard;
    rgb *= 0.72 + 0.28 * smoothstep(edge, edge * 1.25 + 2.0, d);
  }
  gl_FragColor = vec4(mix(rgb, uFog.rgb, fogAmt()), 1.0);
#else
  vec4 col = vec4(t.rgb * vTint.rgb, t.a) * vTint.a;
  col.rgb = mix(col.rgb, vec3(col.a), vFlash);
#ifdef ADD
  col *= 1.0 - fogAmt();
#else
  col.rgb = mix(col.rgb, uFog.rgb * col.a, fogAmt());
#endif
  gl_FragColor = col;
#endif
}`;

// Shapes drawn by maths instead of a texture, so they stay sharp at any size: aUv = (kind, a, b, c).
//   0 soft disc (a: falloff power)          1 ring (a: thickness, b: dashes, c: turn)
//   2 target (ring, ticks and a dot)         3 arc (a: thickness, b: how much of the circle)
const SHAPE_FRAG = /* glsl */ `
varying vec2 vLocal;
varying vec4 vParams;
varying vec4 vTint;
${FOG_PARS_F}
void main() {
  vec2 q = vLocal * 2.0 - 1.0;
  float r = length(q);
  float ang = atan(q.y, q.x) / 6.2831853 + 0.5;
  float aa = fwidth(r) * 1.5;
  float a = 0.0;
  int kind = int(vParams.x + 0.5);
  if (kind == 0) {
    a = pow(clamp(1.0 - r, 0.0, 1.0), vParams.y);
  } else if (kind == 1) {
    a = smoothstep(1.0 - vParams.y - aa, 1.0 - vParams.y, r) * (1.0 - smoothstep(1.0 - aa, 1.0, r));
    if (vParams.z > 0.5) { float d = fract(ang * vParams.z + vParams.w); a *= smoothstep(0.0, 0.08, d) * (1.0 - smoothstep(0.55, 0.63, d)); }
  } else if (kind == 2) {
    float ring = smoothstep(0.86 - aa, 0.86, r) * (1.0 - smoothstep(1.0 - aa, 1.0, r));
    float gap = smoothstep(0.1, 0.16, abs(fract(ang * 4.0 + vParams.w) - 0.5));
    float tick = (1.0 - smoothstep(0.035, 0.035 + aa, min(abs(q.x), abs(q.y)))) * step(0.5, r) * (1.0 - step(0.86, r));
    float dotc = 1.0 - smoothstep(0.09, 0.09 + aa, r);
    a = max(max(ring * gap, tick), dotc);
  } else {
    a = smoothstep(1.0 - vParams.y - aa, 1.0 - vParams.y, r) * (1.0 - smoothstep(1.0 - aa, 1.0, r));
    a *= step(fract(ang + 0.25), vParams.z);
  }
  gl_FragColor = vec4(vTint.rgb, 1.0) * (a * vTint.a * (1.0 - fogAmt()));
}`;

const quad = (() => {
  const g = new THREE.PlaneGeometry(1, 1);
  g.rotateX(-Math.PI / 2); // lie flat: the top of the picture points north
  return g;
})();

export interface BatchOpts {
  order: number;
  /** How it is drawn (see the top of this file). Default decal. */
  kind?: 'decal' | 'cut' | 'up' | 'over';
  /** For solid cut-outs: how see-through a bit of the picture may be before it is cut away (default 0.5; thin leaves want less). */
  cut?: number;
  /** Blur (mip levels) for soft shadows cut from the same picture. */
  bias?: number;
  additive?: boolean;
  /** Fade round the hidden lizard (the leaves part so you can see it). */
  hole?: boolean;
  /** Drawn shapes (rings, discs, targets) instead of a texture. */
  shapes?: boolean;
  /** Flat cards that can tip: push()'s `sway` rolls one (right edge up) and `phase` pitches it (front up), in radians.
   *  For jointed birds (see puppet.ts). They don't sway in the wind. */
  tilt?: boolean;
}

export class SpriteBatch {
  readonly mesh: THREE.Mesh;
  count = 0;
  private geo = new THREE.InstancedBufferGeometry();
  private pr: Float32Array; private ss: Float32Array; private uv: Float32Array; private tint: Float32Array; private fx: Float32Array;
  private attrs: THREE.InstancedBufferAttribute[];

  constructor(parent: THREE.Object3D, tex: THREE.Texture | null, readonly capacity: number, opts: BatchOpts) {
    this.geo.index = quad.index;
    this.geo.setAttribute('position', quad.getAttribute('position'));
    this.geo.setAttribute('uv', quad.getAttribute('uv'));
    this.pr = new Float32Array(capacity * 4); this.ss = new Float32Array(capacity * 4);
    this.uv = new Float32Array(capacity * 4); this.tint = new Float32Array(capacity * 4); this.fx = new Float32Array(capacity * 2);
    const mk = (name: string, arr: Float32Array, size: number) => {
      const a = new THREE.InstancedBufferAttribute(arr, size);
      a.setUsage(THREE.DynamicDrawUsage);
      this.geo.setAttribute(name, a);
      return a;
    };
    this.attrs = [mk('aPR', this.pr, 4), mk('aSS', this.ss, 4), mk('aUv', this.uv, 4), mk('aTint', this.tint, 4), mk('aFx', this.fx, 2)];
    this.geo.instanceCount = 0;
    const kind = opts.kind ?? 'decal';
    const solid = kind === 'cut' || kind === 'up';
    const defines: Record<string, number> = {};
    if (solid) defines.CUT = 1;
    if (kind === 'up') defines.UP = 1;
    if (opts.additive) defines.ADD = 1;
    if (opts.tilt) defines.TILT = 1;
    const mat = new THREE.ShaderMaterial({
      vertexShader: SPRITE_VERT,
      fragmentShader: opts.shapes ? SHAPE_FRAG : SPRITE_FRAG,
      defines,
      uniforms: {
        map: { value: tex }, uBias: { value: opts.bias ?? 0 }, uHoleOn: { value: opts.hole ? 1 : 0 }, uCut: { value: opts.cut ?? 0.5 },
        uTime: shared.uTime, uWind: shared.uWind, uHole: shared.uHole, uLizard: shared.uLizard, uCamRight: shared.uCamRight, uCamUp: shared.uCamUp, ...fogUniforms(),
      },
      transparent: !solid, depthTest: kind !== 'over', depthWrite: solid, premultipliedAlpha: true, side: kind === 'up' || opts.tilt ? THREE.DoubleSide : THREE.FrontSide,
      blending: solid ? THREE.NoBlending : opts.additive ? THREE.CustomBlending : THREE.NormalBlending,
    });
    if (opts.additive) { mat.blendSrc = THREE.OneFactor; mat.blendDst = THREE.OneFactor; mat.blendEquation = THREE.AddEquation; }
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = opts.order;
    parent.add(this.mesh);
  }

  clear() { this.count = 0; }

  /** Add a cut-out; returns its number. heading: compass angle. uv: the part of the texture (default all of it). */
  push(x: number, y: number, z: number, w: number, h: number, heading = 0, r = 1, g = 1, b = 1, a = 1, u0 = 0, v0 = 0, du = 1, dv = 1, sway = 0, phase = 0): number {
    const i = this.count;
    if (i >= this.capacity) return i - 1;
    this.count++;
    this.write(i, x, y, z, w, h, heading, r, g, b, a, u0, v0, du, dv, sway, phase);
    return i;
  }

  write(i: number, x: number, y: number, z: number, w: number, h: number, heading = 0, r = 1, g = 1, b = 1, a = 1, u0 = 0, v0 = 0, du = 1, dv = 1, sway = 0, phase = 0) {
    const k = i * 4;
    this.pr[k] = x; this.pr[k + 1] = y; this.pr[k + 2] = z; this.pr[k + 3] = heading;
    this.ss[k] = w; this.ss[k + 1] = h; this.ss[k + 2] = sway; this.ss[k + 3] = phase;
    this.uv[k] = u0; this.uv[k + 1] = v0; this.uv[k + 2] = du; this.uv[k + 3] = dv;
    this.tint[k] = r; this.tint[k + 1] = g; this.tint[k + 2] = b; this.tint[k + 3] = a;
  }

  setFx(i: number, rustle: number, flash = 0) { this.fx[i * 2] = rustle; this.fx[i * 2 + 1] = flash; }
  getRustle(i: number) { return this.fx[i * 2]; }
  setAlpha(i: number, a: number) { this.tint[i * 4 + 3] = a; }
  setTint(i: number, r: number, g: number, b: number) { const k = i * 4; this.tint[k] = r; this.tint[k + 1] = g; this.tint[k + 2] = b; }
  /** Move one (standing cut-outs: its foot). */
  setPos(i: number, x: number, y: number, z: number) { const k = i * 4; this.pr[k] = x; this.pr[k + 1] = y; this.pr[k + 2] = z; }
  commitPos() { this.attrs[0].needsUpdate = true; }
  setUv(i: number, u0: number, v0: number, du: number, dv: number) { const k = i * 4; this.uv[k] = u0; this.uv[k + 1] = v0; this.uv[k + 2] = du; this.uv[k + 3] = dv; }

  commit() {
    this.geo.instanceCount = this.count;
    for (const a of this.attrs) a.needsUpdate = true;
  }
  commitFx() { this.attrs[4].needsUpdate = true; this.attrs[3].needsUpdate = true; this.attrs[2].needsUpdate = true; }
  set map(t: THREE.Texture) { (this.mesh.material as THREE.ShaderMaterial).uniforms.map.value = t; }
}

// ---------------------------------------------------------------------------------------------------------
// The ground: the two hand-drawn floor tiles, mixed by a small mask so sand meets scrub along a wandering edge
// instead of a grid line, with a soft shade where rocks sit. Water is painted here too: the mask says where it lies
// in a dry spell and where in flood, and uFlood moves the shoreline between the two.

const GROUND_VERT = /* glsl */ `
varying vec2 vW;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vW = wp.xz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const GROUND_FRAG = /* glsl */ `
uniform sampler2D tScrub;
uniform sampler2D tWater;
uniform float uWaterDrawn;
uniform float uSeamless;
uniform sampler2D tMask;
uniform sampler2D tDeck;
uniform sampler2D tMat;
uniform float uDecks;
uniform vec2 uSplit;
uniform vec2 uMap;
uniform float uTime;
uniform vec4 uFog;
uniform vec2 uFogRange;
uniform vec3 uG2a;
uniform vec3 uG2b;
uniform float uRipples;
uniform float uClouds;
uniform vec3 uWaterA;
uniform vec3 uWaterB;
uniform vec3 uWaterC;
uniform float uFlood;
uniform float uRain;
varying vec2 vW;
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  vec2 p = vW;
  vec2 dx = dFdx(p), dy = dFdy(p);
  // A canopy: leaf mat where the map says so, and nothing at all in the gaps between (the floor far below shows
  // through). The edge of a mat wanders a little either side of the tile's edge, never straight.
  float mat = 0.0;
  if (uDecks > 0.5) {
    if ((p.x - uSplit.x) * uSplit.y < 0.0) discard;
    vec2 dw = (vec2(vnoise(p * 1.9 + 3.0), vnoise(p * 1.9 + 17.0)) - 0.5) * 0.3;
    vec4 dk = texture2D(tDeck, (p + dw) / uMap);
    if (dk.r + (vnoise(p * 5.0) - 0.5) * 0.16 < 0.44) discard;
    mat = step(0.5, dk.g);
  }
  // Each tile of the hand-drawn floor is turned a different way, so the same square never reads as a repeat.
  vec2 cell = floor(p);
  vec2 g = fract(p) - 0.5;
  float h = hash(cell);
  float k = floor(h * 4.0);
  if (k == 1.0) g = vec2(-g.y, g.x); else if (k == 2.0) g = -g; else if (k == 3.0) g = vec2(g.y, -g.x);
  if (fract(h * 7.13) > 0.5) g.x = -g.x;
  vec3 scrub = uSeamless > 0.5 ? textureGrad(tScrub, p * 0.5, dx * 0.5, dy * 0.5).rgb : textureGrad(tScrub, g * 0.985 + 0.5, dx, dy).rgb;
  // Stones, for ground that has them: cut-paper pebbles, each cell of a jittered grid holding one or none.
  vec2 sp = p * 3.3 + (vec2(vnoise(p * 1.3), vnoise(p * 1.3 + 9.0)) - 0.5) * 1.5;
  vec2 sc = floor(sp), sf = fract(sp) - 0.5;
  float sh = hash(sc + 7.7);
  vec2 so = (vec2(hash(sc + 1.3), hash(sc + 4.1)) - 0.5) * 0.4;
  float stone = (1.0 - smoothstep(0.1 + sh * 0.16, 0.125 + sh * 0.16, length((sf - so) * vec2(1.0, 1.0 + hash(sc + 2.9) * 0.7)))) * step(0.5, hash(sc + 9.1));
  // Most stones are only a shade off the ground; a few catch the light (the desert's sand has its own, drawn).
  vec3 stoneCol = mix(mix(uG2a * 1.12, uG2b, step(0.78, hash(sc + 3.3))), uG2b, uRipples) * (0.74 + 0.26 * hash(sc));
  // Sand is the same drawing in sand colours (its pebbles are the bluer bits), under ripples the wind left.
  float pebble = mix(stone, smoothstep(0.212, 0.252, scrub.b), uRipples);
  vec3 sand = mix(mix(scrub * 1.12, uG2a, uRipples), stoneCol, pebble * mix(1.0, 0.85, uRipples));
  float ripple = sin((p.y + vnoise(p * 0.33) * 2.4) * 8.0 + vnoise(p * 1.1) * 1.6);
  sand *= 1.0 - 0.075 * uRipples * smoothstep(0.15, 1.0, ripple);
  sand += 0.03 * uRipples * smoothstep(0.3, 1.0, -ripple);
  vec2 warp = vec2(vnoise(p * 0.7), vnoise(p * 0.7 + 31.7)) - 0.5;
  float m = texture2D(tMask, (p + warp * 1.5) / uMap).r;
  float sandAmt = smoothstep(0.36, 0.64, m + (vnoise(p * 2.7) - 0.5) * 0.34);
  // A darker lip where the sand runs out, like the edge of a drift.
  float lip = smoothstep(0.0, 0.5, sandAmt) * (1.0 - smoothstep(0.5, 1.0, sandAmt));
  vec3 col = mix(scrub, sand, sandAmt);
  col *= 1.0 - lip * 0.16;
  // Up top the ground is a mat of leaves, laid edge to edge, shining a little when it is wet.
  if (mat > 0.5) {
    col = textureGrad(tMat, p * 0.5, dx * 0.5, dy * 0.5).rgb;
    col = mix(col, vec3(0.851, 0.961, 0.902), 0.1 * uRain * smoothstep(0.55, 0.8, vnoise(p * 3.1 + uTime * 0.2)));
  }
  // Big soft patches of light and dark, and the shadows of clouds going over (of the last leaves overhead, up top).
  col *= 0.92 + 0.16 * vnoise(p * 0.21 + 5.0);
  col *= 1.0 - 0.1 * mix(uClouds, 1.6, mat) * (1.0 - smoothstep(0.3, 0.62, vnoise(p * mix(0.085, 0.16, mat) + vec2(uTime * 0.035, uTime * 0.012))));
  // Shade gathered round the rocks.
  float ao = texture2D(tMask, p / uMap).g;
  col *= 1.0 - 0.42 * smoothstep(0.12, 0.9, ao);
  // Water. The shoreline wanders (the mask is read a little off true) and creeps out as the flood rises.
  vec4 wm = texture2D(tMask, (p + warp * 0.55) / uMap);
  float lvl = mix(wm.b, wm.a, uFlood);
  if (lvl > 0.02) {
    lvl += (vnoise(p * 2.3) - 0.5) * 0.2;
    float shallow = smoothstep(0.14, 0.26, lvl);
    float deep = smoothstep(0.5, 0.56, lvl);
    // The bank and the shallows: wet stones under a thin wash of water.
    vec3 bank = mix(col * 0.82, stoneCol, stone * 0.9);
    bank = mix(bank, uWaterB, 0.22 + 0.2 * smoothstep(0.26, 0.5, lvl));
    col = mix(col, bank, shallow);
    // Deep water in two flat tones, with short pale strokes drifting along it and a broken line of foam at its edge.
    float drift = uTime * (0.22 + 0.5 * uFlood);
    float band = vnoise(vec2(p.x * 0.9 + vnoise(p * 0.4) * 1.6, p.y * 0.9) + drift * 0.3);
    vec3 water = mix(uWaterA, mix(uWaterA, uWaterB, 0.7), smoothstep(0.56, 0.62, band));
    vec2 q = vec2(p.x * 1.6 + sin(p.y * 1.3 + drift) * 0.35, p.y * 5.5 + drift * 2.0);
    float stroke = smoothstep(0.8, 0.86, vnoise(q)) * smoothstep(0.35, 0.6, vnoise(p * 1.9 - drift * 0.4));
    water = mix(water, mix(uWaterB, uWaterC, 0.35), stroke * 0.8);
    if (uWaterDrawn > 0.5) {
      // A drawn tile of water, sliding downstream and swaying a little; darker where the current runs deep.
      vec2 wuv = p * 0.5 + vec2(sin(p.y * 0.8 + drift * 1.4) * 0.03, drift * 0.16);
      water = textureGrad(tWater, wuv, dx * 0.5, dy * 0.5).rgb * mix(0.74, 1.0, smoothstep(0.5, 0.62, band));
      water = mix(water, uWaterC, stroke * 0.25);
    }
    float foam = deep * (1.0 - smoothstep(0.6, 0.72, lvl)) * step(0.45, vnoise(p * 6.0 + drift));
    water = mix(water, uWaterC, foam * 0.8);
    // Rain pocks it with rings.
    vec2 rc = floor(p * 1.7), rf = fract(p * 1.7) - 0.5;
    float rt = fract(uTime * 0.9 + hash(rc) * 7.0);
    float ring = smoothstep(0.035, 0.0, abs(length(rf - (vec2(hash(rc + 2.0), hash(rc + 5.0)) - 0.5) * 0.5) - rt * 0.34)) * (1.0 - rt) * uRain;
    water = mix(water, uWaterC, ring * 0.7);
    col = mix(col, water, deep);
  }
  // The ground is one huge sheet, so its distance is worked out here, at each point, not at its far corners.
  float fog = uFog.a * smoothstep(uFogRange.x, uFogRange.y, distance(vec3(p.x, 0.0, p.y), cameraPosition));
  gl_FragColor = vec4(mix(col, uFog.rgb, fog), 1.0);
}`;

/** Where a canopy's deck is: red, something to stand on that the ground itself draws (the floor, a leaf mat: a bough
 *  is its own picture); green, a leaf mat. Kept, since the canopy's own layers read the same picture. */
export function deckMask(level: Level): THREE.DataTexture {
  const { w, h } = level;
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const d = level.deck[i];
    data[i * 4] = d === 0 || d === 2 ? 255 : 0;
    data[i * 4 + 1] = d === 2 ? 255 : 0;
    data[i * 4 + 2] = d === 2 || d === 3 ? 255 : 0;
    data[i * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

export function makeGround(parent: THREE.Object3D, level: Level, scrub: THREE.Texture, margin: number, water: THREE.Texture | null = null, leafMat: THREE.Texture | null = null, deck: THREE.Texture | null = null) {
  const { w, h } = level;
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    // Red: the second ground. Green: something solid stands here. Blue: water in a dry spell (a ford is thin water).
    // Alpha: water in flood.
    const wt = level.water[i];
    data[i * 4] = level.sand[i] ? 255 : 0;
    data[i * 4 + 1] = level.hard[i] ? 255 : 0;
    data[i * 4 + 2] = wt === 1 ? 255 : wt === 3 ? 96 : 0;
    data[i * 4 + 3] = wt ? 255 : 0;
  }
  const mask = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  mask.magFilter = mask.minFilter = THREE.LinearFilter;
  mask.needsUpdate = true;
  scrub.wrapS = scrub.wrapT = THREE.ClampToEdgeWrapping;
  const geo = new THREE.PlaneGeometry(w + margin * 2, h + margin * 2);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    vertexShader: GROUND_VERT, fragmentShader: GROUND_FRAG,
    uniforms: {
      tScrub: { value: scrub }, tWater: { value: water ?? scrub }, uWaterDrawn: { value: water ? 1 : 0 }, uSeamless: { value: level.theme.seamless ? 1 : 0 }, tMask: { value: mask }, uMap: { value: new THREE.Vector2(w, h) }, uTime: shared.uTime, ...fogUniforms(),
      tDeck: { value: deck ?? mask }, tMat: { value: leafMat ?? scrub }, uDecks: { value: deck && leafMat ? 1 : 0 },
      uG2a: { value: new THREE.Vector3(...level.theme.ground2[0]) }, uG2b: { value: new THREE.Vector3(...level.theme.ground2[1]) },
      uRipples: { value: level.theme.ripples ? 1 : 0 }, uClouds: { value: level.theme.clouds },
      uWaterA: { value: new THREE.Vector3(...level.theme.water[0]) }, uWaterB: { value: new THREE.Vector3(...level.theme.water[1]) },
      uWaterC: { value: new THREE.Vector3(...level.theme.water[2]) }, uFlood: shared.uFlood, uRain: shared.uRain,
    },
    depthTest: false, depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(w / 2, 0, h / 2);
  mesh.renderOrder = -10; // first of all: everything else stands on it
  mesh.frustumCulled = false;
  parent.add(mesh);
  return mesh;
}

// ---------------------------------------------------------------------------------------------------------
// The finishing pass: the scene is drawn to a texture, then one full-screen shader smooths edges and sets the mood
// (the light of each area, the edge darkening, grain, heat shimmer, the red pulse of being hunted, the iris wipe).

export interface Mood {
  sat: number;
  mul: [number, number, number];
  shadow: [number, number, number];
  high: [number, number, number];
  vig: [number, number, number];
  vigAmt: number;
  heat: number;
  wind: number;
  /** The dust far things fade into from the low camera. */
  fog: [number, number, number];
}

export const MOODS: Record<string, Mood> = {
  morning: { sat: 1.06, mul: [1.04, 1.0, 0.94], shadow: [0.02, 0.01, 0.03], high: [0.05, 0.035, 0.0], vig: [0.62, 0.5, 0.42], vigAmt: 0.42, heat: 0.0, wind: 1, fog: [0.86, 0.74, 0.52] },
  noon: { sat: 1.0, mul: [1.07, 1.04, 0.97], shadow: [0.03, 0.02, 0.0], high: [0.06, 0.05, 0.02], vig: [0.8, 0.62, 0.42], vigAmt: 0.34, heat: 1.0, wind: 0.6, fog: [0.95, 0.83, 0.58] },
  canyon: { sat: 1.08, mul: [1.07, 0.95, 0.86], shadow: [0.05, 0.0, 0.04], high: [0.07, 0.03, 0.0], vig: [0.56, 0.38, 0.36], vigAmt: 0.48, heat: 0.25, wind: 0.4, fog: [0.8, 0.52, 0.36] },
  thicket: { sat: 1.12, mul: [0.95, 1.03, 0.88], shadow: [0.0, 0.03, 0.02], high: [0.05, 0.05, 0.0], vig: [0.42, 0.5, 0.36], vigAmt: 0.5, heat: 0.0, wind: 1.5, fog: [0.62, 0.66, 0.42] },
  dusk: { sat: 0.96, mul: [0.92, 0.88, 1.08], shadow: [0.05, 0.04, 0.13], high: [0.1, 0.05, 0.03], vig: [0.44, 0.4, 0.66], vigAmt: 0.5, heat: 0.0, wind: 1.2, fog: [0.52, 0.46, 0.62] },
  sunset: { sat: 1.14, mul: [1.12, 0.88, 0.78], shadow: [0.07, 0.0, 0.07], high: [0.1, 0.05, 0.0], vig: [0.55, 0.26, 0.3], vigAmt: 0.56, heat: 0.35, wind: 0.8, fog: [0.9, 0.52, 0.36] },
  // --- the rainforest: dim under the leaves, the distance a pale green mist
  hall: { sat: 1.06, mul: [0.98, 1.0, 1.03], shadow: [0.03, 0.0, 0.06], high: [0.0, 0.04, 0.03], vig: [0.1, 0.06, 0.19], vigAmt: 0.5, heat: 0.0, wind: 0.5, fog: [0.4, 0.72, 0.66] },
  fords: { sat: 1.08, mul: [1.0, 1.03, 1.02], shadow: [0.02, 0.0, 0.05], high: [0.02, 0.05, 0.03], vig: [0.1, 0.1, 0.22], vigAmt: 0.44, heat: 0.0, wind: 0.8, fog: [0.52, 0.82, 0.74] },
  creek: { sat: 1.08, mul: [0.95, 1.02, 1.04], shadow: [0.02, 0.01, 0.07], high: [0.0, 0.05, 0.04], vig: [0.05, 0.14, 0.2], vigAmt: 0.5, heat: 0.0, wind: 0.9, fog: [0.3, 0.62, 0.62] },
  heliconia: { sat: 1.12, mul: [1.04, 0.98, 1.02], shadow: [0.05, 0.0, 0.06], high: [0.05, 0.02, 0.03], vig: [0.2, 0.05, 0.2], vigAmt: 0.5, heat: 0.0, wind: 0.6, fog: [0.5, 0.66, 0.68] },
  // Up in the leaves: bright, open, and the distance a pale mist (the style guide's numbers).
  canopy: { sat: 1.1, mul: [1.0, 1.05, 1.0], shadow: [0.0, 0.03, 0.04], high: [0.05, 0.07, 0.03], vig: [0.05, 0.29, 0.31], vigAmt: 0.3, heat: 0.0, wind: 1.4, fog: [0.75, 0.92, 0.85] },
  firefly: { sat: 1.0, mul: [0.66, 0.74, 0.98], shadow: [0.03, 0.02, 0.13], high: [0.08, 0.1, 0.0], vig: [0.05, 0.03, 0.14], vigAmt: 0.68, heat: 0.0, wind: 0.4, fog: [0.1, 0.17, 0.28] },
};

const POST_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const POST_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tScene;
uniform vec2 uRes;
uniform float uTime;
uniform float uSat;
uniform float uRain;
uniform vec3 uMul;
uniform vec3 uShadow;
uniform vec3 uHigh;
uniform vec3 uVigCol;
uniform float uVig;
uniform float uGrain;
uniform float uHeat;
uniform float uDanger;
uniform float uHidden;
uniform float uFlash;
uniform float uAberr;
uniform float uDesat;
uniform vec4 uHaze;
uniform vec3 uIris;
uniform float uTilt;
uniform float uGhost;
uniform float uFire;
uniform vec2 uFocus;
varying vec2 vUv;

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
float hash(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
vec3 tap(vec2 uv) { return texture2D(tScene, uv).rgb; }

// Out of focus by px pixels. The picture's smaller copies (its mip levels) do most of the work and nine taps round it
// off, so a wide blur costs the same as a narrow one.
vec3 soft(vec2 uv, float px) {
  float lod = max(0.0, log2(px * 0.55));
  vec2 o = px * 0.7 / uRes, d = o * 0.707;
  vec3 s = texture2D(tScene, uv, lod).rgb * 2.0;
  s += texture2D(tScene, uv + vec2(o.x, 0.0), lod).rgb + texture2D(tScene, uv - vec2(o.x, 0.0), lod).rgb;
  s += texture2D(tScene, uv + vec2(0.0, o.y), lod).rgb + texture2D(tScene, uv - vec2(0.0, o.y), lod).rgb;
  s += texture2D(tScene, uv + d, lod).rgb + texture2D(tScene, uv - d, lod).rgb;
  s += texture2D(tScene, uv + vec2(d.x, -d.y), lod).rgb + texture2D(tScene, uv + vec2(-d.x, d.y), lod).rgb;
  return s / 10.0;
}

// Edge smoothing (FXAA, the short form): only strong edges are touched, so flat art stays crisp.
vec3 fxaa(vec2 uv) {
  vec2 px = 1.0 / uRes;
  vec3 nw = tap(uv + vec2(-1.0, -1.0) * px), ne = tap(uv + vec2(1.0, -1.0) * px);
  vec3 sw = tap(uv + vec2(-1.0, 1.0) * px), se = tap(uv + vec2(1.0, 1.0) * px);
  vec3 m = tap(uv);
  float lNW = luma(nw), lNE = luma(ne), lSW = luma(sw), lSE = luma(se), lM = luma(m);
  float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
  float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
  if (lMax - lMin < max(0.05, lMax * 0.125)) return m;
  vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), (lNW + lSW) - (lNE + lSE));
  float reduce = max((lNW + lNE + lSW + lSE) * (0.25 / 8.0), 1.0 / 128.0);
  dir = clamp(dir / (min(abs(dir.x), abs(dir.y)) + reduce), vec2(-8.0), vec2(8.0)) * px;
  vec3 a = 0.5 * (tap(uv + dir * (1.0 / 3.0 - 0.5)) + tap(uv + dir * (2.0 / 3.0 - 0.5)));
  vec3 b = a * 0.5 + 0.25 * (tap(uv - dir * 0.5) + tap(uv + dir * 0.5));
  float lB = luma(b);
  return (lB < lMin || lB > lMax) ? a : b;
}

void main() {
  vec2 uv = vUv;
  float aspect = uRes.x / uRes.y;
  // Heat: the air wobbles, more toward the far side of the view.
  float hz = uHeat * (0.35 + 0.65 * uv.y);
  uv.x += sin(uv.y * 84.0 + uTime * 3.3) * 0.0011 * hz;
  uv.y += sin(uv.x * 61.0 - uTime * 2.6) * 0.0008 * hz;

  vec2 fromMid = uv - 0.5;
  vec3 c = fxaa(uv);
  // What the player can't see well goes out of focus, never dark: the far and near edges of the low view (a model
  // world), the rim of the picture, and, with the lizard under leaves, everything away from its hiding place.
  vec2 q = fromMid * vec2(aspect, 1.0);
  float r = length(q);
  float rf = length((vUv - uFocus) * vec2(aspect, 1.0));
  float blur = uTilt * (2.6 * (smoothstep(0.66, 1.0, vUv.y) + 0.6 * smoothstep(0.12, 0.0, vUv.y)) + 2.4 * smoothstep(0.55, 1.05, r))
    + uHidden * 8.0 * smoothstep(0.17, 0.74, rf);
  blur *= uRes.y / 720.0;
  if (blur > 0.35) c = mix(c, soft(uv, blur), smoothstep(0.35, 1.4, blur));
  if (uAberr > 0.001) {
    vec2 off = fromMid * uAberr * 0.02;
    c.r = tap(uv + off).r;
    c.b = tap(uv - off).b;
  }
  float l = luma(c);
  c = mix(vec3(l), c, uSat) * uMul + uShadow * (1.0 - l) + uHigh * l;
  // Rain: the picture dims and cools, and short pale strokes of it slant down across everything, three sheets deep.
  if (uRain > 0.01) {
    c *= 1.0 - 0.22 * uRain;
    c = mix(c, c * vec3(0.84, 0.98, 1.07), uRain * 0.6);
    float fall = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      vec2 ruv = vec2(vUv.x * uRes.x / uRes.y + vUv.y * 0.16, vUv.y) * vec2(30.0 + fi * 24.0, 2.6 + fi * 1.5);
      ruv.y += uTime * (4.6 + fi * 1.9) + hash(vec2(floor(ruv.x), fi)) * 9.0;
      vec2 rf = fract(ruv);
      float on = step(1.0 - 0.3 * uRain, hash(floor(ruv) + fi * 17.0));
      fall += on * smoothstep(0.14, 0.02, abs(rf.x - 0.5)) * smoothstep(0.0, 0.25, rf.y) * smoothstep(1.0, 0.55, rf.y) * (1.0 - fi * 0.25);
    }
    c += vec3(0.62, 0.9, 0.84) * fall * 0.2 * uRain;
  }

  // Far haze for the low camera: distance fades into warm dust.
  c = mix(c, uHaze.rgb, uHaze.a * smoothstep(0.52, 1.0, vUv.y));

  // The rim takes a little of the area's colour. It used to go properly dark; the blur above does that job now.
  c = mix(c, c * uVigCol, smoothstep(0.42, 1.02, r) * uVig * 0.45);
  // Hidden under leaves: a breath of green, no more.
  c = mix(c, c * vec3(0.88, 0.99, 0.86), smoothstep(0.17, 0.74, rf) * uHidden);
  // A ghost: the colour drains to moonlight. On fire: the edges burn.
  c = mix(c, vec3(luma(c)) * vec3(0.7, 0.9, 1.12) + vec3(0.02, 0.05, 0.1), uGhost * (0.45 + 0.3 * smoothstep(0.15, 0.8, r)));
  c = mix(c, c * vec3(1.28, 0.84, 0.5) + vec3(0.13, 0.04, 0.0), smoothstep(0.42, 1.02, r) * uFire * (0.8 + 0.2 * sin(uTime * 23.0)));
  // Hunted: the edges beat red.
  float beat = 0.6 + 0.4 * sin(uTime * 10.0);
  c = mix(c, c * vec3(1.22, 0.6, 0.5) + vec3(0.08, 0.0, 0.0), smoothstep(0.5, 1.05, r) * uDanger * beat * 0.85);

  c = mix(c, vec3(luma(c)) * vec3(1.05, 0.98, 0.9), uDesat);
  c += (hash(gl_FragCoord.xy + fract(uTime) * 137.0) - 0.5) * uGrain;
  c = mix(c, vec3(1.0, 0.97, 0.86), uFlash);

  // Iris: a circle that closes on the lizard and opens again.
  float d = length((vUv - uIris.xy) * vec2(aspect, 1.0));
  c *= 1.0 - smoothstep(uIris.z - 0.012, uIris.z, d);
  gl_FragColor = vec4(c, 1.0);
}`;

export class Post {
  private target: THREE.WebGLRenderTarget;
  private scene = new THREE.Scene();
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  readonly u: Record<string, THREE.IUniform>;
  /** The picture's size in pixels. */
  readonly size = new THREE.Vector2();
  enabled = true;

  constructor(private renderer: THREE.WebGLRenderer) {
    renderer.getDrawingBufferSize(this.size);
    this.target = this.makeTarget();
    this.u = {
      tScene: { value: this.target.texture }, uRes: { value: this.size.clone() }, uTime: shared.uTime, uRain: shared.uRain,
      uSat: { value: 1 }, uMul: { value: new THREE.Vector3(1, 1, 1) }, uShadow: { value: new THREE.Vector3() }, uHigh: { value: new THREE.Vector3() },
      uVigCol: { value: new THREE.Vector3(0.5, 0.4, 0.4) }, uVig: { value: 0.4 }, uGrain: { value: 0.035 }, uHeat: { value: 0 },
      uDanger: { value: 0 }, uHidden: { value: 0 }, uFlash: { value: 0 }, uAberr: { value: 0 }, uDesat: { value: 0 },
      uHaze: { value: new THREE.Vector4(0.86, 0.66, 0.42, 0) }, uIris: { value: new THREE.Vector3(0.5, 0.5, 3) },
      uTilt: { value: 0 }, uGhost: { value: 0 }, uFire: { value: 0 }, uFocus: { value: new THREE.Vector2(0.5, 0.5) },
    };
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    const mesh = new THREE.Mesh(tri, new THREE.ShaderMaterial({ vertexShader: POST_VERT, fragmentShader: POST_FRAG, uniforms: this.u, depthTest: false, depthWrite: false }));
    mesh.frustumCulled = false;
    this.scene.add(mesh);
  }

  private makeTarget() {
    const t = new THREE.WebGLRenderTarget(Math.max(1, this.size.x), Math.max(1, this.size.y), { depthBuffer: true, stencilBuffer: false, generateMipmaps: true });
    // Smaller copies of every frame, for the out-of-focus parts of the picture.
    t.texture.minFilter = THREE.LinearMipmapLinearFilter;
    t.texture.magFilter = THREE.LinearFilter;
    t.texture.colorSpace = THREE.NoColorSpace;
    return t;
  }

  resize() {
    this.renderer.getDrawingBufferSize(this.size);
    this.target.setSize(Math.max(1, this.size.x), Math.max(1, this.size.y));
    (this.u.uRes.value as THREE.Vector2).copy(this.size);
  }

  render(scene: THREE.Scene, camera: THREE.Camera) {
    if (!this.enabled) { this.renderer.setRenderTarget(null); this.renderer.render(scene, camera); return; }
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.cam);
  }
}
