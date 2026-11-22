// The game itself: what the lizard is doing, the eggs it has, the power eggs and what they do, what happens when
// it is caught, and the frame loop that moves everything and draws it.
//
// A Game is one level. Changing level makes a new one and throws the old one away (`dispose`); what must last the
// whole visit (the picture's canvas, the sound, the HUD, the keys and pads) belongs to the Shell it is handed.
import * as THREE from 'three';
import type { Sound } from './audio';
import { CameraRig } from './camera';
import { Critters } from './critters';
import { MOODS, shared, type Mood, type Post } from './gfx';
import type { Hud, Medal } from './hud';
import { Hunters, type Ctx } from './hunters';
import type { Input } from './input';
import { POWERS, type Burrow, type Level, type Nest, type PowerKind, type PowerNest, type Zone } from './level';
import { bestOf, betterRun, isOpen, nextAfter, saveBest, type BestRun, type LevelInfo } from './levels';
import { Lizard, TailDecoy } from './lizard';
import { Particles } from './particles';
import { Canopy } from './canopy';
import { Tunnels } from './tunnels';
import { Weather } from './weather';
import { World, type Textures } from './world';
import { TAU, clamp, clamp01, damp, dirX, dirZ, dist, easeInOut, headingOf, lerp, type V2 } from './util';

type State = 'title' | 'play' | 'dying' | 'leaving' | 'won';

interface Carried { type: number; nest: number; x: number; z: number; pop: number; roll: number }
interface Flyer { type: number; x0: number; z0: number; x1: number; z1: number; t: number; dur: number; h: number; done: () => void }

const HINTS: Record<string, string> = {
  move: '<kbd>WASD</kbd> arrows or the stick: run',
  dash: '<kbd>SPACE</kbd> to dash',
  nest: 'Eggs! Run over a nest to steal them',
  carry: 'Take them to a burrow. Get eaten and they go back to the nest.',
  runner: 'Stay out of its sight, or get under a tuft',
  hidden: 'Under the leaves nothing can see you',
  grass: 'Long grass hides you, even on the run',
  tail: 'You dropped your tail! It grows back; a burrow mends it at once.',
  scorpion: 'A boulder that shifts has a scorpion under it',
  water: 'Too wide to swim. Walk the pebbles, run a log, or <kbd>SPACE</kbd> dash over a narrow stream.',
  rain: 'Thunder! When it rains the streams swell and the logs float off somewhere new.',
  tunnel: 'A hollow log: in one end, out the other, and nobody sees',
  spider: 'Legs at the mouth of a log: somebody lives there. Wait until it comes out.',
  viper: 'A viper on its flower. It never leaves, but it strikes at what comes close and its hiss brings others.',
  door: 'A split in the old tree, glowing. Lizard-sized.',
  canopy: 'The canopy. Mind the gaps: it is a long way down, though the leaves break a fall.',
  fall: 'A soft landing. The way back up is the hollow tree.',
  hawk: 'Hawks dive on anything in the open beneath them',
  owl: "Owls glide low and never turn. Don't be underneath.",
  sentry: 'A guard. It will not leave its post unless something gives it a reason.',
  exit: 'The way home. Hold <kbd>SPACE</kbd> on it when you have what you came for.',
  power: 'A strange egg! Run over it to take it',
  thunder: '<kbd>E</kbd> Thunder Egg: smashes cracked rocks and knocks hunters silly',
  ghost: '<kbd>E</kbd> Ghost Egg: for a few seconds nothing can see you or catch you',
  chili: '<kbd>E</kbd> Chili Egg: run like fire and burn through thorns',
  rattle: '<kbd>E</kbd> Rattle Egg: throw it, and every walker nearby goes to look',
  cracked: 'Cracked rocks. Something could smash those...',
  thorns: 'Thorns: too sharp to push through. They would burn, though...',
  beetle: 'Beetles! Crunchy. Each one gets your dash back at once.',
};
/** The same advice in other words for a touch screen, where the keys' stand-ins alone would read oddly. */
const HINTS_TOUCH: Record<string, string> = {
  move: 'Put your left thumb down anywhere and drag: run',
  dash: 'Tap <kbd>DASH</kbd> for a burst of speed',
  water: 'Too wide to swim. Walk the pebbles, run a log, or tap <kbd>DASH</kbd> to skip over a narrow stream.',
  thunder: 'Tap the Thunder Egg: it smashes cracked rocks and knocks hunters silly',
  ghost: 'Tap the Ghost Egg: for a few seconds nothing can see you or catch you',
  chili: 'Tap the Chili Egg: run like fire and burn through thorns',
  rattle: 'Tap the Rattle Egg: throw it, and every walker nearby goes to look',
};

const POWER: Record<PowerKind, { name: string; tint: [number, number, number]; time: number }> = {
  thunder: { name: 'Thunder Egg', tint: [1, 0.88, 0.3], time: 0 },
  ghost: { name: 'Ghost Egg', tint: [0.6, 0.85, 1], time: 6.5 },
  chili: { name: 'Chili Egg', tint: [1, 0.42, 0.14], time: 4.6 },
  rattle: { name: 'Rattle Egg', tint: [0.3, 0.92, 0.82], time: 7.5 },
};
const THUNDER_REACH = 2.35;
const THUNDER_STUN = 4.4;
const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export interface Params { view?: string; skip?: boolean; mute?: boolean; at?: [number, number]; bot?: boolean; post?: boolean; eggs?: number; power?: string; safe?: boolean; res?: number }

/** What a game is lent and does not own: one of each for the whole visit, whichever level is up. */
export interface Shell {
  readonly renderer: THREE.WebGLRenderer;
  readonly post: Post;
  readonly sound: Sound;
  readonly hud: Hud;
  readonly input: Input;
  /** How far a phone that could not keep up has lowered its picture (1: not at all). It stays lowered from level to level. */
  resScale: number;
  /** The screens before play (splash, title, level select, the level's card) take the buttons while the game waits behind them. */
  menu(real: number): void;
}

/** Give back the graphics memory of everything in a set of textures (or anything else that holds some). */
export function disposeTextures(set: unknown, seen = new Set<unknown>()) {
  if (!set || typeof set !== 'object' || ArrayBuffer.isView(set) || seen.has(set)) return;
  seen.add(set);
  if (set instanceof THREE.Texture) { set.dispose(); return; }
  for (const v of Array.isArray(set) ? set : Object.values(set as Record<string, unknown>)) disposeTextures(v, seen);
}

export class Game {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly rig = new CameraRig();
  readonly input: Input;
  readonly sound: Sound;
  readonly post: Post;
  readonly hud: Hud;
  readonly world: World;
  readonly lizard: Lizard;
  readonly decoy: TailDecoy;
  readonly fx: Particles;
  readonly hunters: Hunters;
  readonly critters: Critters;
  state: State = 'title';
  paused = false;
  time = 0;
  playTime = 0;
  frames = 0;
  banked = 0;
  carried: Carried[] = [];
  stats = { caught: 0, tails: 0, alarms: 0, smashed: 0, burnt: 0 };
  /** The golden egg has been found. */
  gold = false;
  private flyers: Flyer[] = [];
  /** The eggs still lying in each nest (by nest id): a nest can get some of its clutch back. */
  private left: number[][] = [];
  private checkpoint = 0;
  private stateT = 0;
  private hitstop = 0;
  private slowmo = 0;
  private flash = 0;
  private aberr = 0;
  private desat = 0;
  private iris = 3;
  private irisOpen = 0;
  private danger = 0;
  private bankCd = 0;
  private hold = 0;
  private combo = 0;
  private comboT = 0;
  private zone: Zone | null = null;
  private zoneT = 0;
  private mood: Mood = structuredClone(MOODS.morning);
  /** The rain and the streams, and the hollow logs (a level without them has a sky that never changes and no logs). */
  readonly weather: Weather;
  private sky = 'dry';
  readonly tunnels: Tunnels;
  readonly canopy: Canopy;
  private explored: Uint8Array;
  private mapT = 0;
  private hinted = new Set<string>();
  private moved = 0;
  private last = 0;
  private noRender = false;
  /** Where the stand-in player is heading (null: it can think of nowhere to go), for a test to report when it sticks. */
  private aim: { x: number; z: number } | null = null;
  /** Where it last got somewhere, how many frames it has pushed on since without moving, and how many more it will back away for. */
  private botAt = { x: 0, z: 0, still: 0, back: 0 };
  /** Thrown away: another level has taken its place. */
  private gone = false;
  /** A phone or a tablet: fewer pixels are drawn than its sharp screen has, and fewer still if it cannot keep up. */
  private readonly handheld = navigator.maxTouchPoints > 0 && !!window.matchMedia?.('(pointer: coarse)').matches;
  private slowT = 0; private slowN = 0;
  private leaving: Burrow | null = null;
  private ctx: Ctx;
  private scr = { x: 0, y: 0, on: false };
  private v2: V2 = { x: 0, z: 0 };
  // --- power eggs
  /** The one it is carrying, ready to use. */
  private held: { kind: PowerKind; nest: number } | null = null;
  /** A power that lasts, while it lasts. */
  private active: { kind: 'ghost' | 'chili'; t: number; nest: number; tick: number } | null = null;
  /** A thrown Rattle Egg: in the air, then making its racket. */
  private rattle: { x0: number; z0: number; x1: number; z1: number; t: number; life: number; nest: number; beat: number; ring: number } | null = null;
  /** Seconds until each power nest has its egg again (0: it is there; Infinity: it is out being used). */
  private nestWait: number[] = [];
  private nestPop: number[] = [];
  /** Thorns that will catch from their burning neighbours. */
  private burnQueue: { c: number; r: number; t: number }[] = [];
  /** Footprints in the sand, and scorch marks under a lizard on fire: they fade. */
  private prints: { x: number; z: number; rot: number; t: number; hot: boolean }[] = [];
  private hop = 0;
  private pushT = 0;
  private pushRep = -1;
  private missCd = 0;
  /** How long a pad player has gone without sound the browser is holding back (100 once they have been told). */
  private soundWait = 0;
  // --- which area each nest is in, for "cleaned out!"
  private zoneOf: number[] = [];
  private zoneTotal: number[] = [];
  private zoneHome: number[] = [];

  /** `info`: the level's entry in the list of levels (its name, and the id its record is kept under). */
  constructor(readonly shell: Shell, readonly info: LevelInfo, readonly level: Level, private tex: Textures, private params: Params) {
    this.renderer = shell.renderer; this.post = shell.post; this.sound = shell.sound; this.hud = shell.hud; this.input = shell.input;
    this.post.enabled = params.post !== false;
    this.hud.newLevel();
    this.input.bot = null;
    this.world = new World(this.scene, level, tex);
    this.decoy = new TailDecoy(this.scene, tex.lizard);
    this.lizard = new Lizard(this.scene, tex.lizard);
    this.hunters = new Hunters(this.scene, level, tex);
    this.critters = new Critters(this.scene, level, tex);
    this.fx = new Particles(this.scene);
    this.weather = new Weather(level, this.world);
    this.tunnels = new Tunnels(this.scene, level, tex);
    this.canopy = new Canopy(this.scene, level, tex, this.world);
    this.sound.setTheme(level.theme.name);
    this.fx.blocked = (x, z) => level.isOpaque(Math.floor(x), Math.floor(z));
    this.explored = new Uint8Array(level.w * level.h);
    this.left = level.nests.map((n) => [...n.eggs]);
    this.nestWait = level.powerNests.map(() => 0);
    this.nestPop = level.powerNests.map(() => 0);
    this.checkpoint = Math.max(0, level.burrows.findIndex((b) => b.kind === 'start'));
    this.zoneOf = level.nests.map((n) => level.zones.indexOf(level.zoneAt(n.x, n.z) as Zone));
    this.zoneTotal = level.zones.map((_, i) => level.nests.reduce((sum, n) => sum + (this.zoneOf[n.id] === i ? n.eggs.length : 0), 0));
    this.zoneHome = level.zones.map(() => 0);

    this.rig.setView(params.view === 'top' ? 0 : 1, true);
    // The cards' buttons now mean this game (the one before, if there was one, is let go of here).
    this.hud.onResume = () => this.setPaused(false);
    this.hud.onRestart = () => { this.setPaused(false); this.resetLevel(); };
    this.hud.onAgain = () => this.again();
    this.hud.onStar = (i) => this.sound.play('star', i);
    this.hud.onMedal = (_, nth) => this.sound.play('medal', nth);
    this.critters.onEat = (x, z, n) => this.ate(x, z, n);

    this.ctx = {
      level, lizard: this.lizard, fx: this.fx, sound: this.sound, rig: this.rig, world: this.world, decoy: this.decoy, time: 0, rain: 0,
      lure: { x: 0, z: 0, active: false },
      catchLizard: (by, x, z) => this.catchLizard(by, x, z),
      mark: (kind, x, y, z) => this.mark(kind, x, y, z),
      hint: (id) => this.hintOnce(id),
      note: (what) => this.note(what),
    };

    this.lizard.place(level.start.x, level.start.z, Math.PI / 2);
    this.lizard.frozen = true;
    if (params.at) this.lizard.place(params.at[0], params.at[1], 0);
    this.rig.snapTo(this.lizard.pos.x, this.lizard.pos.z, this.lizard.heading);
    this.zone = level.zoneAt(this.lizard.pos.x, this.lizard.pos.z);
    this.mood = structuredClone(MOODS[this.zone?.mood ?? level.theme.mood] ?? MOODS[level.theme.mood]);
    this.sound.setZone(this.zone?.mood ?? level.theme.mood);
    this.sound.setPower(null);
    this.sound.setTension(0);
    this.openIris();

    this.resize();
    if (params.skip) this.start();
    if (params.eggs) for (let i = 0; i < params.eggs; i++) this.carried.push({ type: 1 + (i % 3), nest: -1, x: this.lizard.pos.x, z: this.lizard.pos.z, pop: 1, roll: i });
    if (params.power) this.give(params.power);
  }

  /** The window changed size (the shell listens for that, once, for whichever game is up). */
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    let ratio = Math.min(window.devicePixelRatio || 1, 2);
    // A tablet's screen has more pixels than its chip can paint sixty times a second with the finishing pass on.
    if (this.handheld) ratio = Math.min(ratio, Math.sqrt(3.2e6 / Math.max(1, w * h)));
    ratio = this.params.res ?? Math.max(0.75, ratio * this.shell.resScale);
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(w, h);
    this.post.resize();
    // A phone held upright has no room for the game: it shows a card asking to be turned, and the clock stops.
    if (this.state === 'play' && !this.paused && window.matchMedia?.('(orientation: portrait) and (max-width: 600px)').matches) this.setPaused(true);
  }

  /** On a phone or tablet that cannot keep up, draw fewer pixels: a softer picture beats a jerky lizard. Never back up, or it would see-saw. */
  private pace(ms: number) {
    if (!this.handheld || this.params.res || this.noRender || document.hidden || ms > 250) return;
    this.slowT += ms; this.slowN++;
    if (this.slowN < 120) return;
    const avg = this.slowT / this.slowN;
    this.slowT = this.slowN = 0;
    if (avg > 23 && this.shell.resScale > 0.5) { this.shell.resScale *= 0.85; this.resize(); }
  }

  /** The page put away (another tab, the phone locked, a call): stop the clock until it is back. */
  putAway() { if (this.state === 'play' && !this.paused) this.setPaused(true); }

  setView(i: number) {
    this.rig.setView(i);
  }

  /** Out from behind the menus and into play. */
  start() {
    if (this.state !== 'title') return;
    this.sound.unlock();
    this.sound.play('uiGo');
    this.state = 'play';
    this.lizard.frozen = false;
    this.hud.showPlay(true);
    if (this.zone) this.hud.zone(this.zone.name);
    this.hintOnce('move');
  }

  /** The finishing pass is the shell's, and remembers the last game's iris: open it wide. */
  private openIris() {
    this.iris = 3; this.irisOpen = 0; this.desat = 0;
    (this.post.u.uIris.value as THREE.Vector3).set(0.5, 0.5, 3);
    (this.post.u.uFocus.value as THREE.Vector2).set(0.5, 0.5);
  }

  /** Back behind the menus, from the pause card or the end card: the level as it was at the start, nobody playing. */
  idle() {
    const lv = this.level;
    this.paused = false;
    this.hud.showPause(false);
    this.hud.showResults(null);
    this.hud.showPlay(false);
    this.hud.prompt(null);
    this.resetLevel();
    this.state = 'title'; this.stateT = 0;
    this.lizard.place(lv.start.x, lv.start.z, Math.PI / 2);
    this.lizard.frozen = true;
    this.rig.snapTo(this.lizard.pos.x, this.lizard.pos.z, this.lizard.heading);
    this.zone = lv.zoneAt(this.lizard.pos.x, this.lizard.pos.z);
    this.sound.setZone(this.zone?.mood ?? lv.theme.mood);
    this.openIris();
  }

  /** Another level is taking this one's place: give back everything it drew with. The canvas, the sound, the HUD and
   *  the keys are the shell's and stay. Call it before the next game draws its first picture. */
  dispose() {
    if (this.gone) return;
    this.gone = true;
    this.endActive(true); this.endRattle(true);
    this.input.bot = null;
    const textures = new Set<unknown>();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      for (const mat of Array.isArray(m.material) ? m.material : m.material ? [m.material] : []) {
        // Pictures made on the spot (the ground's mask) are held only by the material that uses them.
        for (const u of Object.values((mat as THREE.ShaderMaterial).uniforms ?? {})) if (u.value instanceof THREE.Texture) disposeTextures(u.value, textures);
        mat.dispose();
      }
    });
    disposeTextures(this.tex, textures);
    this.scene.clear();
  }

  private again() {
    if (this.state !== 'won') return;
    this.hud.showResults(null);
    this.resetLevel();
    this.state = 'play';
    this.lizard.frozen = false;
    this.lizard.scale = 1;
    this.hud.showPlay(true);
  }

  private setPaused(on: boolean) {
    if (this.state === 'title' || this.state === 'won') return;
    this.paused = on;
    this.hud.showPause(on);
    this.sound.play('ui');
  }

  private resetLevel() {
    for (const n of this.level.nests) this.world.setNest(n, true);
    this.left = this.level.nests.map((n) => [...n.eggs]);
    this.carried = []; this.flyers = [];
    this.banked = 0; this.playTime = 0;
    this.stats = { caught: 0, tails: 0, alarms: 0, smashed: 0, burnt: 0 };
    this.gold = false;
    this.combo = 0; this.comboT = 0; this.hud.combo(0);
    this.zoneHome.fill(0);
    this.held = null; this.endActive(true); this.endRattle(true);
    this.nestWait.fill(0); this.nestPop.fill(0);
    this.burnQueue = []; this.prints = [];
    this.level.restore();
    this.world.resetBarriers();
    this.weather.reset();
    this.tunnels.reset();
    this.canopy.reset();
    this.critters.reset();
    this.checkpoint = Math.max(0, this.level.burrows.findIndex((b) => b.kind === 'start'));
    this.respawn();
    this.iris = 3; this.desat = 0;
    this.explored.fill(0);
  }

  private hintOnce(id: string) {
    if (this.hinted.has(id) || this.state !== 'play') return;
    this.hinted.add(id);
    // (A place with its own names for things says the hint in its own words.)
    const theme = this.level.theme, text = theme.hints[id] ?? HINTS[id];
    if (text) this.hud.hint(text, theme.hintsTouch[id] ?? HINTS_TOUCH[id]);
  }

  private mark(kind: '!' | '?', x: number, y: number, z: number) {
    const s = this.rig.toScreen(x, y, z, this.scr);
    if (s.on) { this.hud.mark(kind, s.x, s.y); return; }
    if (kind !== '!') return;
    // Off the screen and after you: an arrow at the edge.
    const dx = s.x - 0.5, dy = s.y - 0.5;
    const k = 0.46 / Math.max(Math.abs(dx), Math.abs(dy), 1e-3);
    this.hud.mark('>', 0.5 + dx * k, 0.5 + dy * k, Math.atan2(dy * innerHeight, dx * innerWidth));
  }

  /** The hunters report in, for the score: one of them raised the alarm, or one of them only just missed. */
  private note(what: 'alarm' | 'miss') {
    if (this.state !== 'play') return;
    if (what === 'alarm') { this.stats.alarms++; return; }
    if (this.missCd > 0 || !this.lizard.alive) return;
    this.missCd = 5;
    this.slowmo = Math.max(this.slowmo, 0.35);
    this.sound.play('nearMiss');
    this.hud.stamp('Close one!', 'by a whisker', 'danger');
  }

  // -------------------------------------------------------------------------------------------------------

  private catchLizard(by: string, x: number, z: number): 'tail' | 'dead' | 'none' | 'burnt' {
    const liz = this.lizard;
    if (!liz.alive || liz.invuln > 0 || this.state !== 'play' || this.params.safe) return 'none';
    if (this.active?.kind === 'ghost') return 'none';
    if (this.active?.kind === 'chili') {
      // Too hot to bite.
      this.sound.play('scare');
      this.fx.burst('fireRing', liz.pos.x, liz.pos.z);
      this.fx.burst('ember', x, z, { scale: 3 });
      return 'burnt';
    }
    const awayX = liz.pos.x - x, awayZ = liz.pos.z - z;
    const len = Math.hypot(awayX, awayZ) || 1;
    this.rig.kick((awayX / len) * 0.25, (awayZ / len) * 0.25);
    this.fx.burst('hit', liz.pos.x, liz.pos.z);
    this.fx.burst('ringRed', liz.pos.x, liz.pos.z);
    if (liz.hasTail && liz.tailLen > 0.8) {
      // The lizard's trick: leave the tail thrashing and run.
      this.decoy.drop(liz.tailPoints());
      liz.dropTail();
      this.stats.tails++;
      this.hitstop = 0.1; this.slowmo = 0.5;
      this.flash = 0.55; this.aberr = 1.4;
      this.rig.shake(0.6); this.rig.zoomPunch(0.8);
      this.sound.play('tail');
      this.input.rumble(0.8, 220);
      this.hud.toast('Tail dropped!');
      this.hintOnce('tail');
      this.fx.burst('poof', this.decoy.x, this.decoy.z);
      return 'tail';
    }
    liz.alive = false;
    liz.tumble = 0;
    this.stats.caught++;
    this.state = 'dying'; this.stateT = 0;
    this.hitstop = 0.16;
    this.flash = 0.7; this.aberr = 2;
    this.rig.shake(1); this.rig.zoomPunch(1);
    this.sound.play('caught');
    this.input.rumble(1, 400);
    this.hud.toast(by === 'scorpion' ? 'Stung!' : by === 'hawk' ? 'Snatched!' : by === 'owl' ? 'Taken!' : 'Gobbled!');
    this.combo = 0; this.comboT = 0; this.hud.combo(0);
    // What it was carrying goes back where it came from, and so does a power egg.
    for (const e of this.carried) {
      const nest = this.level.nests[e.nest];
      if (!nest) continue;
      this.flyers.push({ type: e.type, x0: e.x, z0: e.z, x1: nest.x, z1: nest.z, t: -Math.random() * 0.25, dur: 0.75, h: 2.2, done: () => { const l = this.left[nest.id]; l.push(e.type); this.world.setNest(nest, l.length === nest.eggs.length); this.fx.burst('poof', nest.x, nest.z, { scale: 0.5 }); } });
    }
    this.carried = [];
    if (this.held) { this.spend(this.held.nest, 1.2); this.held = null; }
    return 'dead';
  }

  private respawn() {
    const b = this.level.burrows[this.checkpoint] ?? { x: this.level.start.x, z: this.level.start.z };
    const liz = this.lizard;
    this.endActive(true);
    liz.alive = true; liz.hasTail = true; liz.tailLen = 1; liz.invuln = 1.6; liz.frozen = false;
    liz.ghost = 0; liz.fire = 0; liz.speedMul = 1; liz.lift = 0; liz.scale = 1;
    liz.place(b.x, b.z, liz.heading % TAU);
    this.decoy.clear();
    this.hunters.reset();
    this.rig.snapTo(b.x, b.z, liz.heading);
    this.hold = 0;
  }

  private steal(nest: Nest) {
    const eggs = this.left[nest.id];
    this.left[nest.id] = [];
    this.world.setNest(nest, false);
    // Nests robbed in quick succession count up.
    this.combo = this.comboT > 0 ? this.combo + 1 : 1;
    this.comboT = 7;
    eggs.forEach((type, i) => {
      this.carried.push({ type, nest: nest.id, x: nest.x + (i - (eggs.length - 1) / 2) * 0.25, z: nest.z, pop: 1, roll: Math.random() * TAU });
    });
    this.sound.play('egg', this.combo - 1 + this.carried.length - 1);
    if (this.combo >= 2) {
      this.hud.combo(this.combo);
      this.sound.play('combo', this.combo);
      this.fx.burst('sparkle', this.lizard.pos.x, this.lizard.pos.z, { scale: 0.6 + this.combo * 0.3 });
    }
    this.fx.burst('sparkle', nest.x, nest.z, { scale: nest.clutch ? 2 : 1 });
    this.fx.burst('ring', nest.x, nest.z);
    this.rig.zoomPunch(nest.clutch ? 0.5 : 0.25);
    this.input.rumble(0.25, 70);
    if (nest.clutch) this.hud.toast('A whole clutch!');
    this.hintOnce('carry');
  }

  private bankOne(b: Burrow, index: number) {
    const e = this.carried.shift()!;
    this.bankCd = 0.11;
    this.flyers.push({
      type: e.type, x0: e.x, z0: e.z, x1: b.x, z1: b.z, t: 0, dur: 0.26, h: 0.9,
      done: () => {
        this.banked++;
        this.sound.play('bank', this.banked % 12);
        this.fx.burst('sparkle', b.x, b.z, { scale: 0.6 });
        this.world.pulseBurrow(index);
        // The last egg of an area home: a stamp for it.
        const zi = this.zoneOf[e.nest] ?? -1;
        let cleared = false;
        if (zi >= 0 && ++this.zoneHome[zi] === this.zoneTotal[zi]) {
          cleared = true;
          this.hud.stamp(this.level.zones[zi].name, 'cleaned out!', 'good');
          this.sound.play('zoneClear');
          this.fx.burst('confetti', b.x, b.z, { scale: 1.4 });
          this.fx.burst('petals', b.x, b.z, { scale: 2 });
        }
        if (!this.carried.length && !this.flyers.some((f) => f.x1 === b.x && f.z1 === b.z && f.t < f.dur)) {
          if (!cleared) this.sound.play('bankDone');
          this.fx.burst('ring', b.x, b.z);
          if (this.banked === this.level.totalEggs) this.hud.toast('Every last egg!');
        }
      },
    });
  }

  private leave(b: Burrow) {
    this.state = 'leaving'; this.stateT = 0;
    this.leaving = b;
    this.lizard.frozen = true;
    this.endActive(true);
    this.sound.play('win');
    this.fx.burst('confetti', b.x, b.z, { scale: 2 });
    this.fx.burst('ringBig', b.x, b.z);
    this.rig.zoomPunch(1);
    this.hud.prompt(null);
  }

  /** A beetle, eaten. */
  private ate(x: number, z: number, n: number) {
    this.sound.play('crunch', n);
    this.fx.burst('crumbs', x, z);
    this.lizard.dashCd = 0;
    this.lizard.flash = 0.35;
    this.input.rumble(0.2, 50);
    this.hintOnce('beetle');
    if (n === this.critters.beetlesTotal) { this.hud.stamp('Bug buffet!', 'every last beetle', 'good'); this.sound.play('zoneClear'); }
  }

  private findGold() {
    const g = this.level.gold!;
    this.gold = true;
    this.hitstop = 0.14; this.slowmo = 1.0;
    this.flash = 0.6; this.aberr = 1;
    this.rig.zoomPunch(1); this.rig.shake(0.3);
    this.sound.play('gold');
    this.fx.burst('goldBurst', g.x, g.z);
    this.fx.burst('goldRing', g.x, g.z);
    this.fx.burst('goldRing', g.x, g.z, { size: 0.5 });
    this.hud.stamp('The Golden Egg!', 'you found the secret', 'gold');
    this.input.rumble(0.7, 500);
  }

  // -------------------------------------------------------------------------------------------------------
  // Power eggs. One can be carried; E uses it. Its nest grows another a few seconds after it is spent, so no
  // part of the map can ever be locked for good.

  /** For tests and the address bar (?power=ghost): start holding one. */
  give(kind: string) {
    if (!(POWERS as string[]).includes(kind)) return;
    if (this.held) this.spend(this.held.nest, 0.6);
    this.held = { kind: kind as PowerKind, nest: -1 };
  }

  private takePower(n: PowerNest) {
    if (this.held) this.spend(this.held.nest, 0.6); // the one it had goes home
    this.held = { kind: n.kind, nest: n.id };
    this.nestWait[n.id] = Infinity;
    this.sound.play('powerGet');
    this.fx.burst('sparkle', n.x, n.z, { scale: 2 });
    this.fx.burst('ringBig', n.x, n.z);
    this.rig.zoomPunch(0.5);
    this.lizard.flash = 0.6;
    this.input.rumble(0.4, 120);
    this.hud.toast(POWER[n.kind].name + '!');
    this.hintOnce(n.kind);
  }

  /** A nest's egg is used up (or dropped): it will be back after a wait. */
  private spend(nest: number, wait: number) { if (nest >= 0) this.nestWait[nest] = wait; }

  usePower() {
    const h = this.held, liz = this.lizard;
    if (!h) { if (!this.active && !this.rattle) this.sound.play('powerEmpty'); return; }
    if (!liz.alive || this.state !== 'play') return;
    this.held = null;
    if (h.kind === 'thunder') { this.thunder(); this.spend(h.nest, 5); return; }
    if (h.kind === 'rattle') {
      this.endRattle();
      // Lobbed ahead, as far as the first thing in the way.
      const reach = 3.8, hx = dirX(liz.heading), hz = dirZ(liz.heading);
      const d = Math.max(0.3, reach * this.level.raycast(liz.pos.x, liz.pos.z, liz.pos.x + hx * reach, liz.pos.z + hz * reach, true) - 0.5);
      this.rattle = { x0: liz.pos.x, z0: liz.pos.z, x1: liz.pos.x + hx * d, z1: liz.pos.z + hz * d, t: 0, life: POWER.rattle.time, nest: h.nest, beat: 0, ring: 0 };
      this.sound.play('rattleThrow');
      return;
    }
    this.endActive();
    this.active = { kind: h.kind, t: POWER[h.kind].time, nest: h.nest, tick: 0 };
    this.sound.setPower(h.kind);
    this.rig.zoomPunch(0.6);
    if (h.kind === 'ghost') {
      this.sound.play('ghostOn');
      this.fx.burst('ghostPop', liz.pos.x, liz.pos.z);
      this.flash = 0.3;
    } else {
      this.sound.play('chiliOn');
      this.fx.burst('fireRing', liz.pos.x, liz.pos.z);
      this.fx.burst('flame', liz.pos.x, liz.pos.z, { scale: 8 });
      this.rig.shake(0.3);
      liz.speedMul = 1.7;
    }
  }

  /** The ground-pound: cracked rocks in reach fly apart, and walkers nearby see stars. */
  private thunder() {
    const liz = this.lizard, lv = this.level;
    const c0 = Math.floor(liz.pos.x), r0 = Math.floor(liz.pos.z), R = Math.ceil(THUNDER_REACH);
    let broke = 0;
    for (let r = r0 - R; r <= r0 + R; r++) for (let c = c0 - R; c <= c0 + R; c++) {
      if (lv.barrierAt(c, r) !== 1 || dist(c + 0.5, r + 0.5, liz.pos.x, liz.pos.z) > THUNDER_REACH) continue;
      lv.clearTile(c, r);
      this.world.breakRock(c, r);
      this.fx.burst('rubble', c + 0.5, r + 0.5, { dirX: (c + 0.5 - liz.pos.x) * 1.2, dirZ: (r + 0.5 - liz.pos.z) * 1.2 });
      this.fx.burst('dustBig', c + 0.5, r + 0.5);
      broke++;
    }
    const stunned = this.hunters.stunNear(liz.pos.x, liz.pos.z, THUNDER_STUN, 3.8) + this.tunnels.stunNear(liz.pos.x, liz.pos.z, THUNDER_STUN, 3.8);
    this.stats.smashed += broke;
    this.hop = 1;
    this.hitstop = 0.09; this.flash = 0.6; this.aberr = 1.6;
    this.rig.shake(broke ? 1 : 0.7); this.rig.zoomPunch(0.9);
    this.sound.play('thunder');
    if (broke) this.sound.play('smash', broke);
    if (stunned) this.sound.play('stun');
    this.fx.burst('shock', liz.pos.x, liz.pos.z);
    this.fx.burst('shock', liz.pos.x, liz.pos.z, { size: 0.55 });
    this.fx.burst('spark', liz.pos.x, liz.pos.z);
    this.fx.burst('dustBig', liz.pos.x, liz.pos.z, { scale: 0.7 });
    this.input.rumble(1, 350);
    if (broke) this.hud.toast(broke > 1 ? `Smashed ${broke} rocks!` : 'Smash!');
    else if (stunned) this.hud.toast('Seeing stars!');
  }

  private endActive(quiet = false) {
    const a = this.active, liz = this.lizard;
    if (!a) return;
    this.active = null;
    liz.speedMul = 1;
    this.sound.setPower(null);
    this.spend(a.nest, 4);
    if (quiet) return;
    if (a.kind === 'ghost') { this.sound.play('ghostOff'); this.fx.burst('ghostPop', liz.pos.x, liz.pos.z, { scale: 0.7 }); }
    else { this.sound.play('chiliOff'); this.fx.burst('smoke', liz.pos.x, liz.pos.z, { scale: 2 }); }
  }

  private endRattle(quiet = false) {
    const r = this.rattle;
    if (!r) return;
    this.rattle = null;
    this.ctx.lure.active = false;
    this.spend(r.nest, 4);
    if (!quiet) { this.fx.burst('poof', r.x1, r.z1); this.fx.burst('shell', r.x1, r.z1, { color: 0x4fd8c8 }); }
  }

  /** A thorn bush catches, and passes it on to the bushes beside it a moment later. */
  private ignite(c: number, r: number) {
    const lv = this.level;
    if (lv.barrierAt(c, r) !== 2) return;
    lv.clearTile(c, r);
    this.world.burnThorns(c, r);
    this.stats.burnt++;
    this.sound.play('burn');
    this.fx.burst('flame', c + 0.5, r + 0.5, { scale: 9, size: 1.5 });
    this.fx.burst('ember', c + 0.5, r + 0.5, { scale: 3 });
    this.fx.burst('smoke', c + 0.5, r + 0.5);
    for (const [dc, dr] of SIDES) {
      if (lv.barrierAt(c + dc, r + dr) === 2 && !this.burnQueue.some((q) => q.c === c + dc && q.r === r + dr)) this.burnQueue.push({ c: c + dc, r: r + dr, t: 0.17 });
    }
  }

  private powersStep(dt: number) {
    const liz = this.lizard, lv = this.level, playing = this.state === 'play' && liz.alive;
    this.missCd = Math.max(0, this.missCd - dt);
    this.hop = Math.max(0, this.hop - dt / 0.42);

    // --- the nests: eggs growing back, and being picked up
    for (const n of lv.powerNests) {
      const wait = this.nestWait[n.id];
      if (wait > 0 && wait !== Infinity) {
        this.nestWait[n.id] = Math.max(0, wait - dt);
        if (this.nestWait[n.id] === 0) {
          this.nestPop[n.id] = 1;
          this.fx.burst('sparkle', n.x, n.z);
          if (dist(n.x, n.z, liz.pos.x, liz.pos.z) < 12) this.sound.play('nestRegrow');
        }
      }
      this.nestPop[n.id] = damp(this.nestPop[n.id], 0, 6, dt);
      if (!playing || this.nestWait[n.id] !== 0) continue;
      const d = dist(n.x, n.z, liz.pos.x, liz.pos.z);
      if (d < 0.62 && this.nestPop[n.id] < 0.5) this.takePower(n);
      else if (d < 5) this.hintOnce('power');
    }
    if (playing && this.input.power) this.usePower();

    // --- a power that lasts
    const a = this.active;
    if (a && playing) {
      a.t -= dt;
      if (a.kind === 'ghost') {
        if (Math.random() < dt * 22) this.fx.burst('wisp', liz.pos.x, liz.pos.z);
        // The last two seconds tick.
        if (a.t < 2 && Math.floor(a.t * 3) !== a.tick) { a.tick = Math.floor(a.t * 3); this.sound.play('ghostTick', 1 - a.t / 2); }
      } else {
        this.fx.burst('flame', liz.pos.x - dirX(liz.heading) * 0.2, liz.pos.z - dirZ(liz.heading) * 0.2, { scale: liz.speed > 1 ? 1.5 : 0.5 });
        if (Math.random() < dt * 12) this.fx.burst('ember', liz.pos.x, liz.pos.z, { scale: 0.4 });
        // Thorns it touches go up.
        const c0 = Math.floor(liz.pos.x), r0 = Math.floor(liz.pos.z);
        for (let r = r0 - 1; r <= r0 + 1; r++) for (let c = c0 - 1; c <= c0 + 1; c++) {
          if (lv.barrierAt(c, r) !== 2) continue;
          const nx = clamp(liz.pos.x, c, c + 1), nz = clamp(liz.pos.z, r, r + 1);
          if (dist(nx, nz, liz.pos.x, liz.pos.z) < 0.36) { this.ignite(c, r); this.rig.shake(0.25); }
        }
      }
      if (a.t <= 0) this.endActive();
    }
    liz.ghost = damp(liz.ghost, this.active?.kind === 'ghost' ? 1 : 0, 12, dt);
    liz.fire = damp(liz.fire, this.active?.kind === 'chili' ? 1 : 0, 12, dt);
    for (let i = this.burnQueue.length - 1; i >= 0; i--) {
      const q = this.burnQueue[i];
      q.t -= dt;
      if (q.t <= 0) { this.burnQueue.splice(i, 1); this.ignite(q.c, q.r); }
    }

    // --- a thrown Rattle Egg
    const r = this.rattle;
    if (r) {
      r.t += dt;
      if (r.t >= 0.5) {
        const lure = this.ctx.lure;
        if (!lure.active) {
          lure.active = true; lure.x = r.x1; lure.z = r.z1;
          this.fx.burst(lv.isSand(Math.floor(r.x1), Math.floor(r.z1)) ? 'sand' : 'dust', r.x1, r.z1);
        }
        r.life -= dt; r.beat -= dt; r.ring -= dt;
        if (r.beat <= 0) { r.beat = 0.2; this.sound.play('rattle'); if (Math.random() < 0.6) this.fx.burst('notes', r.x1, r.z1); }
        if (r.ring <= 0) { r.ring = 0.75; this.fx.burst('noise', r.x1, r.z1); }
        if (r.life <= 0) this.endRattle();
      }
    }

    // --- left alone, a lizard does push-ups (they really do)
    let lift = this.hop > 0 ? Math.sin((1 - this.hop) * Math.PI) * 0.55 : 0;
    if (playing && !liz.hidden && !this.active && liz.idleTime > 3.2) {
      this.pushT += dt;
      const k = this.pushT / 0.6, rep = Math.floor(k);
      if (rep % 9 < 5) {
        lift += Math.max(0, Math.sin((k - rep) * Math.PI)) * 0.1;
        if (rep !== this.pushRep) { this.pushRep = rep; this.sound.play('pushup'); }
      }
    } else { this.pushT = 0; this.pushRep = -1; }
    liz.lift = lift + this.weather.perch + this.canopy.lift;

    // --- the first sight of a barrier gets a word
    if (playing && !(this.hinted.has('cracked') && this.hinted.has('thorns'))) {
      const c0 = Math.floor(liz.pos.x), r0 = Math.floor(liz.pos.z);
      for (let rr = r0 - 2; rr <= r0 + 2; rr++) for (let cc = c0 - 2; cc <= c0 + 2; cc++) {
        const b = lv.barrierAt(cc, rr);
        if (b === 1 && this.held?.kind !== 'thunder') this.hintOnce('cracked');
        else if (b === 2 && this.active?.kind !== 'chili' && this.held?.kind !== 'chili') this.hintOnce('thorns');
      }
    }
  }

  // -------------------------------------------------------------------------------------------------------

  /**
   * A stand-in player for tests and screenshots. It fetches eggs and takes them home, blind to danger; where a
   * nest is walled off it fetches the power egg that opens the way. If it can finish a map, the map can be finished.
   */
  private bot() {
    const liz = this.lizard, lv = this.level;
    const reach = lv.fieldTo(Math.floor(liz.pos.x), Math.floor(liz.pos.z), 'lizard');
    const can = (x: number, z: number) => reach[Math.floor(z) * lv.w + Math.floor(x)] >= 0;
    const near = <T extends { x: number; z: number }>(list: T[], ok: (t: T) => boolean): T | null => {
      let best: T | null = null, bd = Infinity;
      for (const t of list) { if (!ok(t)) continue; const d = dist(t.x, t.z, liz.pos.x, liz.pos.z); if (d < bd) { bd = d; best = t; } }
      return best;
    };
    /** Places to stand beside a wall of one kind (1 cracked rock, 2 thorns) that it can get to. */
    const walls = (kind: number) => {
      const out: { x: number; z: number; bx: number; bz: number }[] = [];
      for (let r = 0; r < lv.h; r++) for (let c = 0; c < lv.w; c++) {
        if (lv.barrierAt(c, r) !== kind) continue;
        for (const [dc, dr] of SIDES) if (!lv.isSolid(c + dc, r + dr) && can(c + dc + 0.5, r + dr + 0.5)) out.push({ x: c + dc + 0.5, z: r + dr + 0.5, bx: c + 0.5, bz: r + 0.5 });
      }
      return out;
    };
    let target: { x: number; z: number } | null = null, hold = false, power = false;
    const wanted: { x: number; z: number }[] = lv.nests.filter((n) => this.left[n.id].length > 0);
    if (lv.gold && !this.gold) wanted.push(lv.gold);
    if (this.carried.length < 3) target = near(wanted, (n) => can(n.x, n.z));
    if (!target && (this.carried.length || this.flyers.length)) target = near(lv.burrows, (b) => can(b.x, b.z));
    if (!target && wanted.length) {
      // What is left is walled off: get the egg that opens walls, and take it to the nearest one.
      const opens = this.held?.kind === 'thunder' ? 1 : this.held?.kind === 'chili' || this.active?.kind === 'chili' ? 2 : 0;
      const wall = opens ? near(walls(opens), () => true) : null;
      if (wall) {
        const d = dist(wall.x, wall.z, liz.pos.x, liz.pos.z);
        if (opens === 1) { target = wall; power = d < 0.6; }
        else { power = !!this.held && d < 3; target = d < 0.7 ? { x: wall.bx, z: wall.bz } : wall; }
      } else {
        const kinds = [walls(1).length ? 'thunder' : '', walls(2).length ? 'chili' : ''];
        target = near(lv.powerNests, (n) => kinds.includes(n.kind) && this.nestWait[n.id] !== Infinity && can(n.x, n.z));
      }
    } else if (this.held && (this.held.kind === 'ghost' || this.held.kind === 'rattle')) power = this.hunters.danger > 0.35 || Math.random() < 0.004;
    if (!target && !wanted.length) {
      const exit = lv.burrows.find((b) => b.kind === 'exit');
      if (exit) { target = exit; hold = dist(exit.x, exit.z, liz.pos.x, liz.pos.z) < 0.5; }
    }
    this.aim = target;
    if (!target) { this.input.bot = { x: 0, z: 0, dash: false, power }; return; }
    // Straight at a wall it means to burn; round the rocks to anything else.
    if (lv.isSolid(Math.floor(target.x), Math.floor(target.z))) { this.v2.x = target.x; this.v2.z = target.z; } else lv.stepToward(liz.pos, target.x, target.z, 0.25, this.v2, 'lizard');
    let dx = this.v2.x - liz.pos.x, dz = this.v2.z - liz.pos.z;
    const len = Math.hypot(dx, dz) || 1;
    // Pushing at something on the way and getting nowhere (a hollow log's mouth wants a run-up before it lets a
    // lizard in): back away for half a second and come at it again. (Standing where it meant to go is not that.)
    const at = this.botAt;
    if (liz.frozen || dist(liz.pos.x, liz.pos.z, target.x, target.z) < 0.9 || dist(liz.pos.x, liz.pos.z, at.x, at.z) > 0.1) { at.x = liz.pos.x; at.z = liz.pos.z; at.still = 0; }
    else if (++at.still > 90) { at.still = 0; at.back = 30; }
    if (at.back > 0) { at.back--; dx = -dx; dz = -dz; }
    // The bot steers in world directions: undo the camera's turn.
    const s = Math.sin(-this.rig.yaw), c = Math.cos(-this.rig.yaw);
    this.input.bot = { x: (c * dx - s * dz) / len, z: (s * dx + c * dz) / len, dash: hold || Math.random() < 0.01, power };
  }

  frame(now: number) {
    if (this.gone) return;
    const real = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    if (this.frames > 60) this.pace(now - this.last);
    this.last = now;
    this.frames++;
    const input = this.input;
    if (this.params.bot && this.state === 'play') this.bot();
    input.poll();
    if (input.any) this.sound.unlock();
    // To a browser a pad button is not a "click", so it will not start the sound for one: say so, once.
    if (input.usingPad && this.sound.waiting && this.state === 'play') {
      this.soundWait += real;
      if (this.soundWait > 1.2 && this.soundWait < 100) { this.soundWait = 100; this.hud.hint('No sound yet: click the game once, or press any key'); }
    } else if (this.soundWait < 100) this.soundWait = 0;
    this.hud.usePad(input.usingPad, input.padKind);
    this.hud.useTouch(input.usingTouch);
    this.hud.setStick(input.stick);
    this.hud.setSound(this.sound.enabled && !this.sound.muted);
    if (input.mute) this.hud.toast(this.sound.toggleMute() ? 'Sound off' : 'Sound on');
    if (input.zoom) this.rig.zoom = Math.min(1.5, Math.max(0.65, this.rig.zoom * (1 + input.zoom * 0.08)));

    // The cards: the arrows move the light between a card's buttons, and "go" presses the lit one.
    if (this.state === 'title') { this.shell.menu(real); if (this.gone) return; }
    else if (this.state === 'won') { if (input.navX) this.navCard(input.navX); else if (input.confirm || input.dash) this.hud.press(); if (this.gone) return; }
    else if (input.pause) this.setPaused(!this.paused);
    else if (this.paused && input.back && input.usingPad) { this.setPaused(false); input.power = false; } // circle backs out of the pause card (and is not also "use the egg")
    else if (this.paused && input.restart) { this.setPaused(false); this.resetLevel(); }
    else if (this.paused && input.navX) this.navCard(input.navX);
    else if (this.paused && input.confirm) { this.hud.press(); input.dash = false; if (this.gone) return; } // (and is not also a dash as the clock restarts)

    // How fast the world runs this frame: stopped for a beat on a hit, slow just after.
    this.hitstop = Math.max(0, this.hitstop - real);
    this.slowmo = Math.max(0, this.slowmo - real);
    const dt = this.paused ? 0 : this.hitstop > 0 ? 0 : real * (this.slowmo > 0 ? 0.35 : 1);
    this.time += dt;
    this.ctx.time = this.time;
    shared.uTime.value = this.time;
    this.stateT += this.paused ? 0 : real;

    const liz = this.lizard, lv = this.level, w = this.world;
    w.blobs.clear(); w.glow.clear(); w.marks.clear(); w.rings.clear();
    w.eggs.forEach((b) => b.clear()); w.eggsAir.forEach((b) => b.clear());
    for (const k of POWERS) w.powerEggs[k].clear();
    w.goldEgg.clear();
    this.hud.beginMarks();

    // --- the lizard
    const nearExit = lv.burrows.some((b) => b.kind === 'exit' && dist(b.x, b.z, liz.pos.x, liz.pos.z) < 0.9) && !this.carried.length;
    this.rig.toWorld(input.moveX, input.moveZ, this.v2);
    if (dt > 0) liz.update(dt, this.v2.x, this.v2.z, input.dash && this.state === 'play' && !nearExit, lv);
    // --- the rain, the streams and the logs; then whoever is in a hollow log
    this.weather.update(dt, this.state === 'play', liz, this.fx, this.sound);
    if (this.weather.washed) { this.hintOnce('water'); this.rig.shake(0.25); this.input.rumble(0.4, 140); }
    if (this.weather.sky !== this.sky) {
      // Lightning with the thunder; a word when the water starts to move.
      this.sky = this.weather.sky;
      if (this.sky === 'warn') { this.flash = Math.max(this.flash, 0.3); this.hintOnce('rain'); }
      else if (this.sky === 'rain') { this.flash = Math.max(this.flash, 0.6); this.rig.shake(0.3); this.input.rumble(0.5, 260); if (this.state === 'play') this.hud.toast('The streams are rising'); }
      else if (this.sky === 'ease' && this.state === 'play') this.hud.toast('The rain is easing');
    }
    this.ctx.rain = this.weather.rain;
    this.sound.setRain(this.state === 'won' ? 0 : this.weather.rain);
    this.tunnels.update(dt, this.ctx, this.state === 'play');
    // --- up or down the hollow tree, or off the edge of the canopy
    this.canopy.update(dt, this.state === 'play', liz, this.fx, this.sound);
    if (this.canopy.moved) this.rig.snapTo(liz.pos.x, liz.pos.z, liz.heading);
    if (this.canopy.event === 'up') this.hintOnce('canopy');
    else if (this.canopy.event === 'landed') { this.hintOnce('fall'); this.rig.shake(0.3); this.input.rumble(0.5, 160); }
    if (lv.canopy && !this.canopy.up && dist(liz.pos.x, liz.pos.z, lv.canopy.door.x, lv.canopy.door.z) < 4.5) this.hintOnce('door');
    if (dt > 0 && this.state === 'play') this.lizardFx(dt);

    // --- eggs, burrows, powers, the way out
    if (dt > 0) { this.updateEggs(dt); this.powersStep(dt); }
    this.drawGround();

    // --- hunters and critters (drawn even when time is stopped)
    this.hunters.update(this.state === 'play' || this.state === 'title' ? dt : dt * 0.25, this.ctx);
    this.critters.update(dt, this.time, liz, this.fx, this.sound, w, this.state === 'play');
    const threat = Math.max(this.hunters.danger, this.tunnels.danger);
    this.danger = damp(this.danger, this.state === 'play' ? threat : 0, threat > this.danger ? 8 : 1.6, real);
    this.sound.setTension(this.danger);

    this.decoy.update(dt, this.time);
    this.fx.update(dt);
    w.update(dt);

    if (this.state === 'play' && dt > 0) this.playTime += dt;
    if (this.state === 'dying') this.dying(real);
    if (this.state === 'leaving') this.leavingStep(real);
    this.zones(real);

    // --- camera
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    // Behind the title and the end card the camera drifts about on its own.
    const calm = this.state === 'title' || this.state === 'won';
    const target = calm ? { x: liz.pos.x + Math.sin(this.time * 0.21) * 2.5, z: liz.pos.z + Math.cos(this.time * 0.17) * 1.6 } : liz.pos;
    const moodZoom = calm ? 1.08 : this.active?.kind === 'chili' ? 1.14 : liz.hidden ? 0.93 : this.danger > 0.6 ? 1.07 : 1;
    if (this.state === 'play' && !this.paused) this.rig.turnBy(input.look);
    this.rig.update(this.paused ? 0 : real, target, liz.alive ? liz.vel : { x: 0, z: 0 }, liz.heading, this.canopy.up ? lv.w : lv.floorW, lv.h, aspect, moodZoom, this.state === 'play' ? input.turn : 0);
    // The leaves part between the camera and a hidden lizard; long grass bows away from it.
    const hs = this.rig.toScreen(liz.pos.x, 0.1, liz.pos.z, this.scr);
    w.setHole(hs.x, hs.y, liz.hiddenAmt, this.post.size);
    shared.uLizard.value.set(liz.pos.x, liz.pos.z, liz.alive && this.state !== 'leaving' ? 1 : 0, 2.6);

    this.grade(real);
    this.hudStep(real);
    w.blobs.commit(); w.glow.commit(); w.marks.commit(); w.rings.commit();
    w.eggs.forEach((b) => b.commit()); w.eggsAir.forEach((b) => b.commit());
    for (const k of POWERS) w.powerEggs[k].commit();
    w.goldEgg.commit();
    this.hud.endMarks();
    if (!this.noRender) this.post.render(this.scene, this.rig.cam);
    this.sound.update(real, this.time);
  }

  /** Dust, leaves and noise from what the lizard just did. */
  private lizardFx(dt: number) {
    const liz = this.lizard, ev = liz.events, lv = this.level;
    const sandy = lv.isSand(Math.floor(liz.pos.x), Math.floor(liz.pos.z));
    this.moved += liz.speed * dt;
    if (this.moved > 3) this.hintOnce('dash');
    if (ev.dashed) {
      this.sound.play('dash');
      this.fx.burst(sandy ? 'sand' : 'dust', liz.pos.x, liz.pos.z, { dirX: -liz.vel.x * 0.12, dirZ: -liz.vel.z * 0.12, scale: 1.6 });
      this.rig.kick(-dirX(liz.heading) * 0.05, -dirZ(liz.heading) * 0.05);
      this.input.rumble(0.3, 80);
    }
    if (liz.dashing) this.fx.burst('streak', liz.pos.x - dirX(liz.heading) * 0.3, liz.pos.z - dirZ(liz.heading) * 0.3, { scale: 2 });
    if (ev.stepped && liz.speed > 1.5) {
      if (!liz.hidden) this.sound.play('step');
      const side = (this.frames & 1 ? 1 : -1) * 0.14;
      const fx = liz.pos.x - dirX(liz.heading) * 0.2 + dirZ(liz.heading) * side, fz = liz.pos.z - dirZ(liz.heading) * 0.2 - dirX(liz.heading) * side;
      this.fx.burst(sandy ? 'stepSand' : 'step', fx, fz);
      const hot = this.active?.kind === 'chili';
      if (sandy || hot) {
        if (this.prints.length >= 70) this.prints.shift();
        this.prints.push({ x: hot ? liz.pos.x : fx, z: hot ? liz.pos.z : fz, rot: liz.heading, t: this.time, hot });
      }
    }
    if (ev.bumped && liz.dashing) {
      this.fx.burst(sandy ? 'sand' : 'dust', liz.pos.x + dirX(liz.heading) * 0.2, liz.pos.z + dirZ(liz.heading) * 0.2);
      // Dashing at a wall that a power would open: a dull knock.
      if (ev.dashed && lv.barrierAt(Math.floor(liz.pos.x + dirX(liz.heading) * 0.6), Math.floor(liz.pos.z + dirZ(liz.heading) * 0.6))) this.sound.play('denied');
    }
    const grass = lv.inside(liz.coverC, liz.coverR) && lv.cover[liz.coverR * lv.w + liz.coverC] === 2;
    if (ev.enteredCover) {
      this.sound.play('rustle');
      if (grass) this.hintOnce('grass');
      else { this.world.rustle(liz.coverC, liz.coverR, 1); this.fx.burst('leaves', liz.coverC + 0.5, liz.coverR + 0.5); this.hintOnce('hidden'); }
    } else if (ev.leftCover) {
      this.sound.play('rustle');
      if (!grass) { this.world.rustle(liz.coverC, liz.coverR, 0.8); this.fx.burst('leaves', liz.coverC + 0.5, liz.coverR + 0.5, { scale: 0.6 }); }
    } else if (liz.hidden && liz.speed > 1 && !grass) this.world.rustle(liz.coverC, liz.coverR, 0.35);
  }

  private updateEggs(dt: number) {
    const liz = this.lizard, lv = this.level;
    if (this.comboT > 0) { this.comboT = Math.max(0, this.comboT - dt); if (this.comboT === 0) { this.combo = 0; this.hud.combo(0); } }
    this.bankCd = Math.max(0, this.bankCd - dt);
    if (this.state === 'play' && liz.alive) {
      for (const n of lv.nests) {
        if (!this.left[n.id].length) continue;
        const d = dist(n.x, n.z, liz.pos.x, liz.pos.z);
        if (d < 0.64) this.steal(n);
        else if (d < 5) this.hintOnce('nest');
      }
      if (lv.gold && !this.gold && dist(lv.gold.x, lv.gold.z, liz.pos.x, liz.pos.z) < 0.62) this.findGold();
      let onExit: Burrow | null = null;
      lv.burrows.forEach((b, i) => {
        const d = dist(b.x, b.z, liz.pos.x, liz.pos.z);
        if (b.kind === 'exit' && d < 6) this.hintOnce('exit');
        if (d > 0.9) return;
        if (this.checkpoint !== i) {
          this.checkpoint = i;
          this.sound.play('checkpoint');
          this.fx.burst('sparkle', b.x, b.z, { scale: 1.5 });
          this.fx.burst('ringBig', b.x, b.z);
          this.hud.toast(b.kind === 'exit' ? 'The way home' : 'Burrow found');
          this.world.pulseBurrow(i);
        }
        if (liz.tailLen < 1) {
          if (!liz.hasTail) { this.sound.play('regrow'); this.fx.burst('sparkle', liz.pos.x, liz.pos.z); }
          liz.regrowNow();
          liz.tailLen = Math.min(1, liz.tailLen + dt * 1.6);
        }
        if (this.carried.length && this.bankCd <= 0) this.bankOne(b, i);
        if (b.kind === 'exit') onExit = b;
      });
      // The way out: hold to leave, so nobody goes home by accident with half the eggs.
      const exit = onExit as Burrow | null;
      if (exit && !this.carried.length && !this.flyers.length) {
        const s = this.rig.toScreen(exit.x, 0.5, exit.z, this.scr);
        if (this.input.dashHeld) { this.hold += dt / 0.9; if (Math.floor(this.hold * 12) !== Math.floor((this.hold - dt / 0.9) * 12)) this.sound.play('hold', this.hold); }
        else this.hold = Math.max(0, this.hold - dt * 2);
        this.hud.prompt(`Hold ${this.input.usingPad ? '✕' : this.input.usingTouch ? 'DASH' : 'SPACE'} to go home with ${this.banked} of ${lv.totalEggs} eggs`, s.x, s.y, clamp01(this.hold));
        if (this.hold >= 1) this.leave(exit);
      } else { this.hold = 0; this.hud.prompt(null); }
    }

    // The eggs it carries trail behind along the path it took.
    const base = liz.physicalLength - 0.02;
    this.carried.forEach((e, k) => {
      liz.trail(base + 0.26 + k * 0.37, this.v2);
      const px = e.x, pz = e.z;
      e.x = damp(e.x, this.v2.x, 15, dt); e.z = damp(e.z, this.v2.z, 15, dt);
      e.roll += Math.hypot(e.x - px, e.z - pz) * 7;
      e.pop = damp(e.pop, 0, 7, dt);
    });
    for (let i = this.flyers.length - 1; i >= 0; i--) {
      const f = this.flyers[i];
      f.t += dt;
      if (f.t >= f.dur) { this.flyers.splice(i, 1); f.done(); }
    }
  }

  /** Eggs, their shadows, and the glows that say "this matters" (nests with eggs, burrows, power eggs, the way out). */
  private drawGround() {
    const lv = this.level, w = this.world, t = this.time, liz = this.lizard;
    this.carried.forEach((e, k) => {
      const s = 1 + e.pop * 0.6;
      w.blobs.push(e.x + 0.04, 0.02, e.z + 0.05, 0.5 * s, 0.5 * s, 0, 0, 0, 0, 0.32, 0, 1.5, 0, 0);
      w.eggs[e.type - 1].push(e.x, 0.06, e.z, 0.36 * s, 0.45 * s, Math.sin(e.roll) * 0.5 + k);
    });
    for (const f of this.flyers) {
      if (f.t < 0) { w.eggs[f.type - 1].push(f.x0, 0.06, f.z0, 0.36, 0.45, 0); continue; }
      const k = clamp01(f.t / f.dur), e = easeInOut(k);
      const x = lerp(f.x0, f.x1, e), z = lerp(f.z0, f.z1, e), y = Math.sin(k * Math.PI) * f.h;
      const s = (1 + Math.sin(k * Math.PI) * 0.35) * (f.dur < 0.4 ? 1 - k * 0.5 : 1);
      w.blobs.push(x + y * 0.2, 0.02, z + y * 0.16, 0.45, 0.45, 0, 0, 0, 0, 0.28 * (1 - y * 0.2), 0, 1.5, 0, 0);
      w.eggsAir[f.type - 1].push(x, 0.1 + y, z, 0.36 * s, 0.45 * s, k * 9);
    }
    for (const n of lv.nests) {
      const l = this.left[n.id];
      if (!l.length) continue;
      // Part of a clutch that came back: loose eggs in the empty nest.
      if (l.length < n.eggs.length) l.forEach((type, i) => w.eggs[type - 1].push(n.x + (i - (l.length - 1) / 2) * 0.3, 0.05, n.z + 0.03, 0.36, 0.45, i * 1.7 + n.id));
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.4 + n.id);
      w.glow.push(n.x, 0.025, n.z, 2.3, 2.3, 0, 1, 0.82, 0.35, 0.035 + pulse * 0.045, 0, 1.3, 0, 0);
      if (Math.random() < 0.012) this.fx.burst('glint', n.x, n.z);
    }

    // --- power eggs: standing in their nests, hovering over the lizard that holds one, thrown and rattling
    for (const n of lv.powerNests) {
      const [r, g, b] = POWER[n.kind].tint;
      const wait = this.nestWait[n.id];
      if (wait === 0) {
        const pop = this.nestPop[n.id], s = (1 - pop) * (1 + Math.sin(pop * Math.PI) * 0.5);
        const bob = Math.sin(t * 2.6 + n.id * 2) * 0.05;
        w.blobs.push(n.x + 0.05, 0.03, n.z + 0.05, 0.5, 0.5, 0, 0, 0, 0, 0.3, 0, 1.5, 0, 0);
        w.powerEggs[n.kind].push(n.x, 0.1 + bob, n.z, 0.46 * s, 0.58 * s, Math.sin(t * 1.7 + n.id) * 0.1);
        w.glow.push(n.x, 0.03, n.z, 3, 3, 0, r, g, b, 0.14 + 0.08 * Math.sin(t * 3 + n.id), 0, 1.2, 0, 0);
        w.rings.push(n.x, 0.035, n.z, 1.7, 1.7, 0, r, g, b, 0.5, 1, 0.05, 12, t * 0.2);
        if (Math.random() < 0.03) this.fx.burst('glint', n.x, n.z, { color: (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255) });
      } else if (wait !== Infinity) {
        // Growing back: a ring that fills.
        w.rings.push(n.x, 0.035, n.z, 1.3, 1.3, 0, r, g, b, 0.45, 3, 0.1, clamp01(1 - wait / 5), 0);
      }
    }
    if (this.held && liz.alive) {
      const [r, g, b] = POWER[this.held.kind].tint;
      const hx = liz.pos.x - dirX(liz.heading) * 0.15, hz = liz.pos.z - dirZ(liz.heading) * 0.15;
      w.powerEggs[this.held.kind].push(hx, 0.5 + Math.sin(t * 4) * 0.05 + liz.lift, hz, 0.3, 0.38, Math.sin(t * 3) * 0.12);
      w.glow.push(hx, 0.03, hz, 1.6, 1.6, 0, r, g, b, 0.12, 0, 1.3, 0, 0);
    }
    const rt = this.rattle;
    if (rt) {
      const k = clamp01(rt.t / 0.5), down = k >= 1;
      const x = lerp(rt.x0, rt.x1, k), z = lerp(rt.z0, rt.z1, k), y = Math.sin(k * Math.PI) * 1.5;
      w.blobs.push(x + y * 0.2, 0.02, z + y * 0.16, 0.5, 0.5, 0, 0, 0, 0, 0.3, 0, 1.5, 0, 0);
      w.powerEggs.rattle.push(x + (down ? Math.sin(t * 61) * 0.03 : 0), 0.03 + y + (down ? Math.abs(Math.sin(t * 22)) * 0.07 : 0), z, 0.4, 0.5, down ? Math.sin(t * 55) * 0.3 : k * 5);
      if (down) w.glow.push(x, 0.03, z, 3.4, 3.4, 0, 0.3, 0.92, 0.82, 0.12 + 0.06 * Math.sin(t * 20), 0, 1.2, 0, 0);
    }
    if (lv.gold && !this.gold) {
      const g = lv.gold, bob = Math.sin(t * 2.2) * 0.06;
      w.blobs.push(g.x + 0.05, 0.03, g.z + 0.05, 0.55, 0.55, 0, 0, 0, 0, 0.3, 0, 1.5, 0, 0);
      w.goldEgg.push(g.x, 0.12 + bob, g.z, 0.52, 0.65, Math.sin(t * 1.3) * 0.08);
      w.glow.push(g.x, 0.03, g.z, 4.2, 4.2, 0, 1, 0.85, 0.3, 0.2 + 0.1 * Math.sin(t * 3), 0, 1.1, 0, 0);
      w.rings.push(g.x, 0.035, g.z, 2, 2, 0, 1, 0.85, 0.3, 0.6, 1, 0.05, 16, -t * 0.25);
      if (Math.random() < 0.08) this.fx.burst('glint', g.x, g.z);
    }
    // A Thunder Egg in hand shows what it would reach.
    if (this.held?.kind === 'thunder' && liz.alive) w.rings.push(liz.pos.x, 0.03, liz.pos.z, THUNDER_REACH * 2, THUNDER_REACH * 2, 0, 1, 0.88, 0.3, 0.22, 1, 0.02, 28, t * 0.15);

    for (const p of this.prints) {
      const life = p.hot ? 7 : 11, a = 1 - (t - p.t) / life;
      if (a <= 0) continue;
      if (p.hot) w.blobs.push(p.x, 0.012, p.z, 0.46, 0.46, 0, 0.05, 0.03, 0.02, 0.45 * a, 0, 1.2, 0, 0);
      else w.blobs.push(p.x, 0.012, p.z, 0.1, 0.17, p.rot, 0.3, 0.19, 0.06, 0.42 * Math.min(1, a * 2), 0, 2.4, 0, 0);
    }

    const carrying = this.carried.length > 0;
    lv.burrows.forEach((b, i) => {
      const exit = b.kind === 'exit';
      const here = i === this.checkpoint;
      const pulse = 0.5 + 0.5 * Math.sin(t * 3 + i);
      const want = carrying || exit ? 1 : 0;
      w.glow.push(b.x, 0.02, b.z, 3.4, 3.4, 0, 1, 0.78, 0.3, (exit ? 0.16 : 0.06) + want * pulse * 0.14, 0, 1.4, 0, 0);
      if (here || exit || carrying) w.rings.push(b.x, 0.03, b.z, 2.2 + want * pulse * 0.25, 2.2 + want * pulse * 0.25, 0, 1, exit ? 0.78 : 0.9, exit ? 0.18 : 0.5, 0.35 + want * 0.35, 1, 0.045, exit ? 16 : 0, t * 0.12);
      if (exit && this.hold > 0) w.marks.push(b.x, 0.035, b.z, 2.7, 2.7, 0, 1, 0.95, 0.6, 0.95, 3, 0.09, clamp01(this.hold), 0);
    });
  }

  private dying(real: number) {
    const t = this.stateT;
    this.desat = damp(this.desat, 1, 5, real);
    const s = this.rig.toScreen(this.lizard.pos.x, 0.1, this.lizard.pos.z, this.scr);
    (this.post.u.uIris.value as THREE.Vector3).set(s.x, 1 - s.y, this.iris);
    if (t > 0.7) this.iris = Math.max(0, lerp(2.2, 0, easeInOut(clamp01((t - 0.7) / 0.5))));
    if (t > 1.35) {
      this.respawn();
      this.state = 'play'; this.stateT = 0;
      this.desat = 0;
      this.irisOpen = 0.0001;
      this.sound.play('respawn');
    }
  }

  private leavingStep(real: number) {
    const t = this.stateT, liz = this.lizard, b = this.leaving!;
    // Into the hole: slide to the middle, spin, shrink.
    liz.pos.x = damp(liz.pos.x, b.x, 8, real); liz.pos.z = damp(liz.pos.z, b.z, 8, real);
    liz.heading += real * 9;
    liz.scale = Math.max(0.02, 1 - easeInOut(clamp01(t / 0.9)));
    if (t > 0.3 && Math.random() < real * 14) this.fx.burst('sparkle', b.x, b.z, { scale: 0.4 });
    const s = this.rig.toScreen(b.x, 0.1, b.z, this.scr);
    (this.post.u.uIris.value as THREE.Vector3).set(s.x, 1 - s.y, this.iris);
    if (t > 1.1) this.iris = Math.max(0, lerp(2.2, 0, easeInOut(clamp01((t - 1.1) / 0.6))));
    if (t > 1.8) this.finish();
  }

  private navCard(d: number) { if (this.hud.nav(d)) this.sound.play('ui'); }

  /** Home: count it all up. */
  private finish() {
    if (this.state !== 'leaving') return;
    this.state = 'won';
    const lv = this.level, st = this.stats;
    const share = this.banked / Math.max(1, lv.totalEggs);
    const stars = share >= 1 ? 3 : share >= 0.6 ? 2 : 1;
    const par = `${Math.floor(lv.parSeconds / 60)}:${String(Math.round(lv.parSeconds % 60)).padStart(2, '0')}`;
    const medals: Medal[] = [
      { id: 'eggs', name: 'Clean Sweep', desc: 'Bring every egg home', got: share >= 1 },
      { id: 'gold', name: 'Gold Digger', desc: 'Find the golden egg', got: this.gold },
      { id: 'unseen', name: 'Unseen', desc: 'Never be spotted', got: st.alarms === 0 },
      { id: 'tail', name: 'Whole Tail', desc: 'Never drop your tail', got: st.tails === 0 },
      { id: 'speedy', name: 'Speedy', desc: `Home in under ${par}`, got: this.playTime <= lv.parSeconds },
      { id: 'bugs', name: 'Bug Buffet', desc: 'Eat every beetle', got: this.critters.beetlesTotal > 0 && this.critters.eaten === this.critters.beetlesTotal },
      { id: 'untouchable', name: 'Untouchable', desc: 'Never get eaten', got: st.caught === 0 },
    ];
    // The record is kept under the level's id. The golden egg, once found, stays found on it.
    const old = bestOf(this.info);
    const run: BestRun = { time: this.playTime, stars, eggs: this.banked, total: lv.totalEggs, medals: medals.filter((m) => m.got).length, gold: this.gold || !!old?.gold };
    const next = nextAfter(this.info.id);
    const wasShut = !!next && !isOpen(next);
    const newBest = betterRun(run, old);
    if (newBest) saveBest(this.info, run);
    else if (old && run.gold && !old.gold) saveBest(this.info, { ...old, gold: true });
    const open = !!next && isOpen(next);
    this.hud.showPlay(false);
    this.hud.showResults({
      title: this.info.line ? `${this.info.name} · ${this.info.line}` : this.info.name, eggs: this.banked, total: lv.totalEggs, seconds: this.playTime, par: lv.parSeconds, caught: st.caught, tails: st.tails, stars,
      gold: this.gold, beetles: this.critters.eaten, beetlesTotal: this.critters.beetlesTotal, newBest: newBest && !!old, medals,
      next: open, opened: open && wasShut ? next!.name : undefined,
    });
  }

  private zones(real: number) {
    const liz = this.lizard;
    const zone = this.level.zoneAt(liz.pos.x, liz.pos.z);
    if (zone && zone !== this.zone && this.state === 'play') {
      this.zoneT += real;
      if (this.zoneT > 0.35) {
        this.zone = zone; this.zoneT = 0;
        this.hud.zone(zone.name);
        this.sound.play('zone');
        this.sound.setZone(zone.mood);
      }
    } else this.zoneT = 0;
    const to = MOODS[this.zone?.mood ?? this.level.theme.mood] ?? MOODS[this.level.theme.mood];
    const k = 1 - Math.exp(-1.3 * real);
    const m = this.mood;
    m.sat += (to.sat - m.sat) * k; m.vigAmt += (to.vigAmt - m.vigAmt) * k; m.heat += (to.heat - m.heat) * k; m.wind += (to.wind - m.wind) * k;
    for (let i = 0; i < 3; i++) {
      m.mul[i] += (to.mul[i] - m.mul[i]) * k; m.shadow[i] += (to.shadow[i] - m.shadow[i]) * k;
      m.high[i] += (to.high[i] - m.high[i]) * k; m.vig[i] += (to.vig[i] - m.vig[i]) * k; m.fog[i] += (to.fog[i] - m.fog[i]) * k;
    }
    this.sound.setMood(m.wind, this.zone?.mood === 'dusk' ? 0.2 : this.zone?.mood === 'noon' ? 1 : 0.6);
    shared.uWind.value.set(0.0026 * m.wind, 0.0016 * m.wind);
  }

  private grade(real: number) {
    const u = this.post.u, m = this.mood, liz = this.lizard;
    this.flash = damp(this.flash, 0, 7, real);
    this.aberr = damp(this.aberr, 0, 5, real);
    if (this.state === 'won') {
      // The end card sits over the world going quietly on: the iris opens again behind it.
      this.iris = Math.min(3, this.iris + real * 1.4);
      (u.uIris.value as THREE.Vector3).set(0.5, 0.5, this.iris);
    }
    if (this.state === 'play') {
      this.desat = damp(this.desat, 0, 4, real);
      // The iris opens again after a respawn.
      if (this.irisOpen > 0) { this.irisOpen += real / 0.55; this.iris = lerp(0, 2.2, easeInOut(clamp01(this.irisOpen))); if (this.irisOpen >= 1) { this.irisOpen = 0; this.iris = 3; } }
      const s = this.rig.toScreen(liz.pos.x, 0.1, liz.pos.z, this.scr);
      // (The same wipe closes and opens as the lizard goes up the hollow tree, comes down it, or falls.)
      (u.uIris.value as THREE.Vector3).set(s.x, 1 - s.y, this.canopy.wipe > 0 ? Math.min(this.iris, 2.2 * (1 - this.canopy.wipe)) : this.iris);
      (u.uFocus.value as THREE.Vector2).set(s.x, 1 - s.y);
    }
    u.uSat.value = m.sat;
    (u.uMul.value as THREE.Vector3).fromArray(m.mul);
    (u.uShadow.value as THREE.Vector3).fromArray(m.shadow);
    (u.uHigh.value as THREE.Vector3).fromArray(m.high);
    (u.uVigCol.value as THREE.Vector3).fromArray(m.vig);
    u.uVig.value = m.vigAmt;
    u.uHeat.value = m.heat + liz.fire * 0.6;
    u.uDanger.value = this.danger;
    u.uHidden.value = this.state === 'play' ? liz.hiddenAmt * 0.85 : 0;
    u.uFlash.value = this.flash;
    u.uAberr.value = this.aberr + this.danger * 0.25 + liz.fire * 0.08;
    u.uDesat.value = this.desat;
    u.uGhost.value = liz.ghost;
    u.uFire.value = liz.fire;
    u.uTilt.value = this.rig.tilt;
    (u.uHaze.value as THREE.Vector4).set(m.fog[0] * m.mul[0], m.fog[1] * m.mul[1], m.fog[2] * m.mul[2], this.rig.haze);
    shared.uFog.value.set(m.fog[0], m.fog[1], m.fog[2], this.rig.fog);
  }

  private hudStep(real: number) {
    const liz = this.lizard, lv = this.level;
    this.hud.update(real);
    this.hud.setEggs(this.banked, lv.totalEggs, this.carried.map((e) => e.type));
    this.hud.setTimer(this.playTime);
    this.hud.setPips(liz.tailLen, liz.hasTail, 1 - clamp01(liz.dashCd / 0.68));
    this.hud.setHidden(liz.hidden && this.state === 'play');
    this.hud.setPower(this.held ? { kind: this.held.kind, active: 0 }
      : this.active ? { kind: this.active.kind, active: clamp01(this.active.t / POWER[this.active.kind].time) }
      : this.rattle ? { kind: 'rattle', active: clamp01(this.rattle.life / POWER.rattle.time) } : null);
    this.hud.setBeetles(this.critters.eaten, this.critters.beetlesTotal);
    this.hud.setGold(this.gold);
    // Uncover the little map around the lizard.
    const c0 = Math.floor(liz.pos.x), r0 = Math.floor(liz.pos.z), R = 7;
    for (let r = r0 - R; r <= r0 + R; r++) for (let c = c0 - R; c <= c0 + R; c++) {
      if (lv.inside(c, r) && (c - c0) ** 2 + (r - r0) ** 2 <= R * R) this.explored[r * lv.w + c] = 1;
    }
    this.mapT -= real;
    if (this.mapT <= 0) {
      this.mapT = 0.12;
      this.hud.drawMap(lv, this.explored, liz.pos.x, liz.pos.z, liz.heading,
        lv.nests.map((n) => ({ x: n.x, z: n.z, has: this.left[n.id].length > 0 })), this.hunters.runnerPositions(), this.checkpoint);
    }
  }

  /** For tests and the console. */
  debug() {
    return {
      level: this.info.id, state: this.state, banked: this.banked, carried: this.carried.length, x: +this.lizard.pos.x.toFixed(2), z: +this.lizard.pos.z.toFixed(2),
      alive: this.lizard.alive, hidden: this.lizard.hidden, tail: +this.lizard.tailLen.toFixed(2), caught: this.stats.caught, tails: this.stats.tails,
      alarms: this.stats.alarms, smashed: this.stats.smashed, burnt: this.stats.burnt, beetles: this.critters.eaten, gold: this.gold,
      power: this.held?.kind ?? (this.active ? this.active.kind + '!' : this.rattle ? 'rattle!' : null),
      danger: +this.danger.toFixed(2), zone: this.zone?.name, view: this.rig.view.id, particles: this.fx.live, frames: this.frames, time: +this.playTime.toFixed(1),
      draws: this.renderer.info.render.calls, sky: this.weather.sky, flood: +this.weather.flood.toFixed(2), inside: this.lizard.inside, deck: this.canopy.up ? 'canopy' : 'floor',
      // What the graphics card is holding: these must not creep up as levels come and go.
      geometries: this.renderer.info.memory.geometries, textures: this.renderer.info.memory.textures, programs: this.renderer.info.programs?.length ?? 0,
      aim: this.params.bot ? (this.aim ? [+this.aim.x.toFixed(1), +this.aim.z.toFixed(1)] : 'nowhere') : undefined,
    };
  }
  /** Run the game ahead without drawing it (tests: minutes of play in a moment). */
  fast(seconds: number) {
    this.noRender = true;
    for (let i = 0, n = Math.round(seconds * 60); i < n; i++) this.frame(this.last + 1000 / 60);
    this.noRender = false;
    this.last = performance.now();
    return this.debug();
  }
  teleport(x: number, z: number, heading = this.lizard.heading) { this.lizard.place(x, z, heading); this.rig.snapTo(x, z, heading); }
  headingTo(x: number, z: number) { return headingOf(x - this.lizard.pos.x, z - this.lizard.pos.z); }
}
