// Sound, all made in the browser (no files): short effects, the air of each area (wind, insects, the odd bird) and a
// small desert tune that changes with the area and tightens when something is hunting the lizard. Nothing plays until
// the first key or click (browsers insist).
//
// How it is wired:
//   effects ─┐
//   tune ────┼─ master ─ compressor ─ limiter ─ soft ceiling ─ speakers        (and an echo the canyon turns up)
//   air ─────┘
// `attach` builds all of that on any audio context, so tools/scenarios/audio.mjs can render each sound off-line and
// measure it (nobody can listen to a headless browser). Run that after changing anything here: it prints how long
// and how loud every effect is, and fails if something is silent, clips, or is out of its place in the mix.
//
// For the game: play(name, n) for an effect; every frame update(dt, time), setTension(danger), setMood(wind, bugs),
// setZone(the area's mood) and setPower('ghost' | 'chili' | null): the setters cost nothing when nothing changed.
// The rainforest adds setRain(0..1) every frame (a bed of drops, 0 is silent) and setTheme('desert' | 'rainforest') for the tune.

type Wave = OscillatorType;

/** D Phrygian dominant, the scale the tune and the chimes share. */
const ROOT = 146.83;
const SCALE = [0, 1, 4, 5, 7, 8, 10];
const note = (degree: number, octave = 0) => {
  const n = SCALE.length;
  const d = ((degree % n) + n) % n;
  return ROOT * Math.pow(2, (SCALE[d] + 12 * (Math.floor(degree / n) + octave)) / 12);
};
/** Five notes of that scale that never clash (D F# G A C): streaks and medals climb these. */
const FIVE = [0, 4, 5, 7, 10];
const chime = (step: number, octave = 0) => {
  const d = ((step % 5) + 5) % 5;
  return ROOT * Math.pow(2, (FIVE[d] + 12 * (Math.floor(step / 5) + octave)) / 12);
};
/** B Dorian, the rainforest's own mode: slower, rounder, no desert in it. */
const WROOT = 123.47;
const WSCALE = [0, 2, 3, 5, 7, 9, 10];
const wnote = (degree: number, octave = 0) => {
  const n = WSCALE.length;
  const d = ((degree % n) + n) % n;
  return WROOT * Math.pow(2, (WSCALE[d] + 12 * (Math.floor(degree / n) + octave)) / 12);
};
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const smooth = (a: number, b: number, v: number) => { const x = clamp((v - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
const rnd = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

/** What an area does to the tune and the air. Every number glides to the next area's over a couple of seconds. */
interface ZoneMix {
  /** Beats a minute, how open the tune's tone is (Hz), how much echo. */
  tempo: number; bright: number; echo: number;
  /** The register of the melody (octaves) and how many of its notes are played (0 only the main beats .. 1 all). */
  octave: number; busy: number;
  /** How loud each player is. */
  lead: number; reply: number; bass: number; drum: number; shaker: number; drone: number; pad: number;
  /** The air: insects (a multiplier on setMood), cicadas, crickets, heat shimmer, a low hum, wind that howls. */
  bugs: number; cicada: number; cricket: number; shimmer: number; low: number; howl: number;
  /** The forest's air (0 in every desert area): running water, a chorus of frogs, and how far the wind is hushed. */
  water: number; frog: number; hush: number;
}
const DRY = { water: 0, frog: 0, hush: 0 };
const ZONES: Record<string, ZoneMix> = {
  morning: { ...DRY, tempo: 96, bright: 5200, echo: 0.1, octave: 0, busy: 0.6, lead: 1, reply: 0.8, bass: 0.8, drum: 0.6, shaker: 0.7, drone: 0.6, pad: 0, bugs: 1, cicada: 0, cricket: 0, shimmer: 0, low: 0, howl: 0 },
  noon: { ...DRY, tempo: 104, bright: 7600, echo: 0.05, octave: 0, busy: 0.85, lead: 1, reply: 0.6, bass: 0.9, drum: 0.9, shaker: 1, drone: 0.4, pad: 0, bugs: 1, cicada: 1, cricket: 0, shimmer: 1, low: 0, howl: 0 },
  canyon: { ...DRY, tempo: 88, bright: 3600, echo: 0.6, octave: 0, busy: 0.45, lead: 0.9, reply: 1, bass: 0.7, drum: 0.5, shaker: 0.3, drone: 0.8, pad: 0, bugs: 0.4, cicada: 0, cricket: 0, shimmer: 0, low: 0.3, howl: 1 },
  thicket: { ...DRY, tempo: 108, bright: 4400, echo: 0.08, octave: 0, busy: 1, lead: 0.85, reply: 0.7, bass: 0.9, drum: 0.85, shaker: 1, drone: 0.5, pad: 0, bugs: 3, cicada: 0.3, cricket: 0.6, shimmer: 0, low: 0, howl: 0 },
  dusk: { ...DRY, tempo: 76, bright: 2300, echo: 0.3, octave: -1, busy: 0.2, lead: 0.6, reply: 0.9, bass: 0.6, drum: 0.15, shaker: 0, drone: 0.9, pad: 0.3, bugs: 0.5, cicada: 0, cricket: 1, shimmer: 0, low: 1, howl: 0.2 },
  sunset: { ...DRY, tempo: 92, bright: 4000, echo: 0.2, octave: 0, busy: 0.7, lead: 1, reply: 1, bass: 1, drum: 0.7, shaker: 0.6, drone: 0.7, pad: 1, bugs: 0.8, cicada: 0, cricket: 0.5, shimmer: 0, low: 0.4, howl: 0 },
  // The rainforest: slow and wet, a tune of wooden plucks.
  hall: { tempo: 66, bright: 2600, echo: 0.45, octave: 0, busy: 0.35, lead: 0.8, reply: 0.8, bass: 0.6, drum: 0.1, shaker: 0.15, drone: 0.7, pad: 0.5, bugs: 0.35, cicada: 0.3, cricket: 0, shimmer: 0, low: 0.6, howl: 0.05, water: 0.15, frog: 0.3, hush: 0.8 },
  fords: { tempo: 78, bright: 3400, echo: 0.25, octave: 0, busy: 0.55, lead: 0.9, reply: 0.7, bass: 0.6, drum: 0.25, shaker: 0.5, drone: 0.4, pad: 0.2, bugs: 0.6, cicada: 0.2, cricket: 0, shimmer: 0, low: 0.2, howl: 0, water: 0.7, frog: 0.5, hush: 0.8 },
  creek: { tempo: 64, bright: 2000, echo: 0.5, octave: 0, busy: 0.3, lead: 0.7, reply: 0.9, bass: 0.8, drum: 0.1, shaker: 0.1, drone: 0.8, pad: 0.6, bugs: 0.3, cicada: 0, cricket: 0.2, shimmer: 0, low: 0.8, howl: 0.1, water: 1, frog: 0.3, hush: 0.8 },
  heliconia: { tempo: 86, bright: 4200, echo: 0.12, octave: 0, busy: 0.8, lead: 0.9, reply: 0.6, bass: 0.7, drum: 0.5, shaker: 0.8, drone: 0.5, pad: 0.1, bugs: 2.5, cicada: 0.6, cricket: 0.3, shimmer: 0, low: 0, howl: 0, water: 0.1, frog: 0.8, hush: 0.85 },
  // Up in the canopy: higher, brighter, airier; the water is a long way down.
  canopy: { tempo: 80, bright: 5000, echo: 0.3, octave: 0, busy: 0.5, lead: 0.9, reply: 0.8, bass: 0.4, drum: 0.15, shaker: 0.35, drone: 0.3, pad: 0.6, bugs: 0.5, cicada: 0.5, cricket: 0, shimmer: 0.4, low: 0, howl: 0.3, water: 0.05, frog: 0.1, hush: 0.6 },
  firefly: { tempo: 68, bright: 2800, echo: 0.4, octave: 0, busy: 0.3, lead: 0.8, reply: 1, bass: 0.6, drum: 0.05, shaker: 0, drone: 0.8, pad: 0.8, bugs: 0.4, cicada: 0, cricket: 1, shimmer: 0, low: 0.6, howl: 0.1, water: 0.25, frog: 1, hush: 0.8 },
};
const MIX_KEYS = Object.keys(ZONES.morning) as (keyof ZoneMix)[];

/** The tune, eight bars of sixteen steps: [step, scale degree, length in steps]. Bars 0-1 call, 2-3 answer; 4-5 call
 *  again higher, 6-7 answer and come home. */
const TUNE: [number, number, number][][] = [
  [[0, 0, 3], [3, 2, 3], [6, 3, 2], [8, 4, 4], [12, 5, 2], [14, 4, 2]],
  [[0, 3, 3], [3, 2, 3], [6, 1, 2], [8, 0, 6]],
  [[0, 4, 3], [3, 6, 3], [6, 5, 2], [8, 4, 3], [11, 3, 3], [14, 2, 2]],
  [[0, 3, 3], [3, 1, 3], [6, 2, 2], [8, 0, 6]],
  [[0, 7, 3], [3, 6, 3], [6, 5, 2], [8, 4, 2], [10, 5, 2], [12, 6, 2], [14, 7, 2]],
  [[0, 8, 3], [3, 7, 3], [6, 6, 2], [8, 5, 6]],
  [[0, 4, 2], [2, 5, 2], [4, 4, 2], [6, 3, 2], [8, 2, 3], [11, 3, 3], [14, 1, 2]],
  [[0, 0, 6], [8, 0, 2], [10, -3, 2], [12, 0, 4]],
];
/** The bass under each bar: the root of its first and second half. */
const BASS: [number, number][] = [[0, 0], [0, 0], [0, 0], [1, 0], [3, 3], [1, 1], [0, 0], [0, 0]];
/** The low figure of a hunt, in eighth notes. */
const HUNT = [0, 0, 1, 0, 0, 0, 2, 1];
/** The hand drum while the chili burns: D a deep hit, T a sharp one, k a light one. */
const CHILI_DRUM = 'DkTkDkTkDDTkDkTT';

/** Sounds that can be asked for many times a second: the least time between two of them. */
const GAP: Record<string, number> = {
  step: 0.05, hold: 0.03, peck: 0.05, rustle: 0.07, rattle: 0.11, crunch: 0.09, flutter: 0.14, tumble: 0.2, ghostTick: 0.07,
  pushup: 0.12, burn: 0.09, stun: 0.1, scare: 0.1, lure: 0.1, smash: 0.06, spotted: 0.1, sentry: 0.2, nearMiss: 0.15, denied: 0.15,
  storm: 0.5, splash: 0.12, logLift: 0.3, logLodge: 0.3, tunnel: 0.2, spiderOut: 0.3, spiderIn: 0.3, hiss: 0.4, coati: 0.25,
};
/** ...and the ones that are dropped first when a great deal is already sounding. */
const SMALL = new Set(['step', 'hold', 'peck', 'rustle', 'rattle', 'crunch', 'flutter', 'tumble', 'ghostTick', 'pushup', 'burn', 'tunnel', 'spiderOut', 'spiderIn']);

/** How hard the whole mix is pushed into the compressor: more is louder and more even, less is quieter with more
 *  difference between the tune and a thunderclap. */
const LEVEL = 1.2;
/** After the limiter: how loud the loudest thing can be (about three quarters of full scale). */
const TRIM = 0.8;

/** The last thing before the speakers: straight up to 0.6, then bending over so nothing can pass 0.89. */
function ceilingCurve() {
  const n = 1025, curve = new Float32Array(n), knee = 0.6, top = 0.94;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1, a = Math.abs(x);
    curve[i] = Math.sign(x) * (a <= knee ? a : knee + (top - knee) * Math.tanh((a - knee) / (top - knee)));
  }
  return curve;
}

const audioContextClass = (): typeof AudioContext | undefined =>
  window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

export class Sound {
  /** Every name `play` knows. */
  static readonly names = [
    'step', 'dash', 'rustle', 'egg', 'bank', 'bankDone', 'checkpoint', 'spotted', 'suspect', 'lost', 'runner', 'peck', 'screech', 'dive',
    'thud', 'swoop', 'hoot', 'rattle', 'snap', 'tail', 'regrow', 'caught', 'respawn', 'zone', 'ui', 'uiGo', 'hold', 'win', 'star',
    'powerGet', 'powerEmpty', 'thunder', 'smash', 'stun', 'ghostOn', 'ghostOff', 'ghostTick', 'chiliOn', 'chiliOff', 'burn', 'scare',
    'rattleThrow', 'lure', 'crunch', 'gold', 'combo', 'zoneClear', 'medal', 'nearMiss', 'pushup', 'flutter', 'tumble', 'sentry',
    'nestRegrow', 'denied', 'storm', 'splash', 'logLift', 'logLodge', 'tunnel', 'spiderOut', 'spiderIn', 'hiss', 'coati',
  ];

  private ctx: BaseAudioContext | null = null;
  private live: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private music!: GainNode;
  private ambient!: GainNode;
  /** Far-off things in the air (an owl, a pebble): quiet, and into the echo. */
  private far!: GainNode;
  private layer!: GainNode;
  private echoIn!: GainNode;
  private sfxSend!: GainNode;
  private musicSend!: GainNode;
  private musicTone!: BiquadFilterNode;
  private musicDuck!: GainNode;
  private white!: AudioBuffer;
  private brown!: AudioBuffer;
  private crackle!: AudioBuffer;
  private beads!: AudioBuffer;
  private windFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;
  private bugGain: GainNode | null = null;
  private cicadaGain: GainNode | null = null;
  private shimmerGain: GainNode | null = null;
  private lowGain: GainNode | null = null;
  private waterGain: GainNode | null = null;
  private frogGain: GainNode | null = null;
  private rainRoar: GainNode | null = null;
  private rainPatter: GainNode | null = null;
  private rainDeep: GainNode | null = null;
  private rainSrc: AudioBufferSourceNode | null = null;
  private rain = 0;
  private nextDrip = 0;
  private theme: 'desert' | 'rainforest' = 'desert';
  private wind = 0.5;
  private bugs = 0.6;
  private tension = 0;
  private tensionTarget = 0;
  private nextStep = 0;
  private step = 0;
  private motif = [0, 2, 4, 2, 5, 4, 2, 1];
  private zoneName = 'morning';
  private zone: ZoneMix = ZONES.morning;
  private mix: ZoneMix = { ...ZONES.morning };
  private power: 'ghost' | 'chili' | null = null;
  private chili = 0;
  private ghost: { out: GainNode; srcs: AudioScheduledSourceNode[] } | null = null;
  private voices = 0;
  private last = new Map<string, number>();
  private nextLife = 0;
  private nextCricket = 0;
  private nextWind = 0;
  private foot = false;
  private unknown = new Set<string>();
  /** The last node before the speakers, and the one just before the ceiling (for meters and tests). */
  out: AudioNode | null = null;
  tap: AudioNode | null = null;
  muted = false;
  enabled = true;

  /** Call on the first key or click. */
  unlock() {
    if (!this.enabled) return;
    // Anything but 'running': an iPhone calls it 'interrupted' after a phone call or a trip to the home screen.
    if (this.live) { if (!this.asleep && this.live.state !== 'running') void this.live.resume().catch(() => {}); return; }
    if (this.ctx) return;
    const Ctx = audioContextClass();
    if (!Ctx) return;
    this.live = new Ctx();
    this.attach(this.live);
  }

  private asleep = false;
  /** The page has been put away, or is back: the wind and the tune must not play on in a pocket. */
  sleep(on: boolean) {
    this.asleep = on;
    if (!this.live || this.live.state === 'closed') return;
    if (on) void this.live.suspend().catch(() => {});
    else void this.live.resume().catch(() => {}); // a phone may refuse until the next touch; `unlock` asks again then
  }

  /** True while sound is wanted but the browser is still holding it back until a click or a key press (a gamepad
   *  button does not count as one to a browser), so the game can ask for a click. It can stay true for a moment after
   *  that click, while the audio starts up. */
  get waiting(): boolean {
    if (!this.enabled || this.muted) return false;
    if (this.live) return this.live.state !== 'running';
    // Not started yet. (A browser with no audio at all, or a test's own context, is not waiting for anybody.)
    return !this.ctx && !!audioContextClass();
  }

  /** Build everything on an audio context. `unlock` does this with a real one; a test can pass an OfflineAudioContext,
   *  somewhere else for the result to go, and `beds: false` to leave out the wind and insects. */
  attach(ctx: BaseAudioContext, opts: { dest?: AudioNode; beds?: boolean } = {}) {
    this.ctx = ctx;
    const gain = (v: number, to?: AudioNode) => { const g = ctx.createGain(); g.gain.value = v; if (to) g.connect(to); return g; };

    // The way out. The compressor holds the mix together, the limiter stops loud moments, and the ceiling is a promise:
    // whatever happens upstream, the speakers never get a sample past 0.89.
    const ceiling = ctx.createWaveShaper(); ceiling.curve = ceilingCurve();
    ceiling.connect(opts.dest ?? ctx.destination);
    const trim = gain(TRIM, ceiling);
    // (A browser's compressor wakes up slowly: for the first fifth of a second of a context's life it lets almost
    // nothing through, and the game's very first sound is played right then. So for that moment the mix goes round
    // the compressors, straight to the ceiling.)
    const t0 = ctx.currentTime;
    const early = gain(1.45, ceiling);
    early.gain.setValueAtTime(1.45, t0 + 0.22); early.gain.linearRampToValueAtTime(0, t0 + 0.28);
    trim.gain.setValueAtTime(0, t0); trim.gain.setValueAtTime(0, t0 + 0.22); trim.gain.linearRampToValueAtTime(TRIM, t0 + 0.28);
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3; limiter.knee.value = 2; limiter.ratio.value = 20; limiter.attack.value = 0.001; limiter.release.value = 0.08;
    limiter.connect(trim);
    const glue = ctx.createDynamicsCompressor();
    glue.threshold.value = -18; glue.knee.value = 12; glue.ratio.value = 2.5; glue.attack.value = 0.008; glue.release.value = 0.22;
    glue.connect(limiter);
    // Nothing below about 35 Hz goes any further: no speaker plays it, and it would only make the compressors work.
    const floor = ctx.createBiquadFilter(); floor.type = 'highpass'; floor.frequency.value = 35; floor.Q.value = 0.7;
    floor.connect(glue); floor.connect(early);
    this.master = gain(this.muted ? 0 : LEVEL, floor);
    this.out = ceiling; this.tap = trim;

    // An echo that bounces from one side to the other, duller each time.
    const echoOut = gain(0.8, this.master);
    this.echoIn = gain(1);
    const left = ctx.createDelay(1), right = ctx.createDelay(1);
    left.delayTime.value = 0.29; right.delayTime.value = 0.21;
    const dull = ctx.createBiquadFilter(); dull.type = 'lowpass'; dull.frequency.value = 2400;
    const panL = ctx.createStereoPanner(), panR = ctx.createStereoPanner();
    panL.pan.value = -0.55; panR.pan.value = 0.55;
    this.echoIn.connect(left); left.connect(panL).connect(echoOut);
    left.connect(right); right.connect(panR).connect(echoOut);
    right.connect(dull).connect(gain(0.42, left));

    this.sfx = gain(0.8, this.master);
    this.sfxSend = gain(0, this.echoIn); this.sfx.connect(this.sfxSend);
    // The tune goes through a tone filter (areas open and close it; the ghost egg shuts it) and a gain that big
    // effects push down for a moment, so they are heard over it.
    const musicLevel = gain(0.27, this.master);
    this.musicDuck = gain(1, musicLevel);
    this.musicTone = ctx.createBiquadFilter(); this.musicTone.type = 'lowpass'; this.musicTone.Q.value = 0.7;
    this.musicTone.frequency.value = this.zone.bright;
    this.musicTone.connect(this.musicDuck);
    this.music = gain(1, this.musicTone);
    this.musicSend = gain(0, this.echoIn); musicLevel.connect(this.musicSend);
    this.ambient = gain(0.5, this.master);
    this.far = gain(1, this.ambient); this.far.connect(gain(0.8, this.echoIn));
    this.layer = gain(1, this.master);

    // Four kinds of noise, made once and shared by everything: hiss, rumble, sparse crackles (fire, pebbles) and
    // dense ticks (the beads in a rattle).
    const sr = ctx.sampleRate;
    const make = (seconds: number, fill: (ch: Float32Array, n: number) => void) => {
      const n = Math.floor(sr * seconds), buf = ctx.createBuffer(1, n, sr);
      fill(buf.getChannelData(0), n);
      return buf;
    };
    const ticks = (perSecond: number, minMs: number, maxMs: number, power: number) => (ch: Float32Array, n: number) => {
      let peak = 0.001;
      for (let i = 0; i < n;) {
        i += 1 + Math.floor(-Math.log(1 - Math.random()) * sr / perSecond);
        const a = Math.pow(Math.random(), power), len = Math.floor(rnd(minMs, maxMs) * sr / 1000);
        for (let k = 0; k < len && i + k < n; k++) { ch[i + k] += a * (Math.random() * 2 - 1) * Math.exp(-k / (len * 0.25)); peak = Math.max(peak, Math.abs(ch[i + k])); }
      }
      for (let i = 0; i < n; i++) ch[i] *= 0.9 / peak;
    };
    this.white = make(2, (ch, n) => { for (let i = 0; i < n; i++) ch[i] = Math.random() * 2 - 1; });
    this.brown = make(2, (ch, n) => {
      // Rumble is hiss with a memory. The end is blended into the start so it can go round without a click.
      const m = Math.floor(sr * 0.05), x = new Float32Array(n + m);
      let v = 0, peak = 0;
      for (let i = 0; i < n + m; i++) { v = (v + (Math.random() * 2 - 1) * 0.02) * 0.998; x[i] = v; peak = Math.max(peak, Math.abs(v)); }
      for (let i = 0; i < n; i++) ch[i] = (i < m ? x[i] * (i / m) + x[n + i] * (1 - i / m) : x[i]) / peak;
    });
    this.crackle = make(2, ticks(55, 1, 6, 2));
    this.beads = make(1, ticks(600, 0.6, 2.5, 1));

    if (opts.beds !== false) this.startBeds();
    Object.assign(this.mix, this.zone);
    this.applyZone(0.01);
    if (this.power === 'ghost') this.ghostStart();
    this.nextStep = ctx.currentTime + 0.3;
    this.nextLife = ctx.currentTime + rnd(2, 5);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : LEVEL, this.ctx.currentTime, 0.05);
    return this.muted;
  }

  // --- the building blocks

  /** Count what is sounding, and let go of a finished sound's nodes. */
  private track(src: AudioScheduledSourceNode, tail?: AudioNode) {
    this.voices++;
    src.onended = () => { this.voices--; tail?.disconnect(); };
  }

  // (Every gain below starts at 0 and only then gets its envelope. A gain node is born at 1, and a sound scheduled
  // for a moment between two blocks of audio can start a sample before its envelope does: with noise, that one
  // sample at full volume is a click many times louder than the sound itself. The off-line measurements found it.)

  /** One oscillator, struck and dying away, sliding from f0 to f1. */
  private tone(wave: Wave, f0: number, f1: number, dur: number, vol: number, when = 0, bus: AudioNode = this.sfx, attack = 0.005) {
    if (vol < 0.0005) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = wave;
    o.frequency.value = Math.max(20, f0);
    if (f1 !== f0) { o.frequency.setValueAtTime(Math.max(20, f0), t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); }
    g.gain.value = 0;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(attack, dur * 0.85));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus);
    o.start(t); o.stop(t + dur + 0.02);
    this.track(o, g);
  }

  /** A burst of noise through a sliding filter. `buf` picks the kind of noise, `rate` plays it faster (higher, denser). */
  private noise(dur: number, vol: number, type: BiquadFilterType, f0: number, f1: number, q = 1, when = 0, bus: AudioNode = this.sfx, attack = 0.004, buf: AudioBuffer = this.white, rate = 1) {
    if (vol < 0.0005) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.playbackRate.value = rate;
    const f = ctx.createBiquadFilter();
    f.type = type; f.Q.value = q;
    f.frequency.value = f0;
    if (f1 !== f0) { f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur); }
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(attack, dur * 0.85));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(bus);
    src.start(t, Math.random() * buf.duration * 0.95); src.stop(t + dur + 0.02);
    this.track(src, g);
  }

  /** A soft struck note (the eggs, the tune). */
  private pluck(freq: number, vol: number, when = 0, bus: AudioNode = this.sfx, dur = 0.5) {
    this.tone('triangle', freq, freq, dur, vol, when, bus, 0.003);
    this.tone('sine', freq * 2.01, freq * 2.01, dur * 0.5, vol * 0.35, when, bus, 0.003);
  }

  /** A small glassy bell: partials that are not quite in tune with each other, which is what makes it glitter. */
  private bell(freq: number, vol: number, when = 0, dur = 0.8, bus: AudioNode = this.sfx) {
    this.tone('sine', freq, freq, dur, vol, when, bus, 0.002);
    this.tone('sine', freq * 2.76, freq * 2.76, dur * 0.55, vol * 0.35, when, bus, 0.002);
    if (freq * 5.4 < 11000) this.tone('sine', freq * 5.4, freq * 5.4, dur * 0.25, vol * 0.16, when, bus, 0.002);
  }

  /** A held note: rise, stay, fall. `scoop` starts it a little flat, the way a breath does. */
  private sing(wave: Wave, freq: number, vol: number, when: number, attack: number, hold: number, release: number, bus: AudioNode = this.music, scoop = 1) {
    if (vol < 0.0005) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = wave;
    o.frequency.value = freq * scoop;
    if (scoop !== 1) { o.frequency.setValueAtTime(freq * scoop, t); o.frequency.exponentialRampToValueAtTime(freq, t + attack * 1.5); }
    g.gain.value = 0;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.setValueAtTime(vol, t + attack + hold);
    g.gain.linearRampToValueAtTime(0, t + attack + hold + release);
    o.connect(g).connect(bus);
    o.start(t); o.stop(t + attack + hold + release + 0.02);
    this.track(o, g);
  }

  /** A voice: a line of pitch ([seconds, Hz] points) with an optional wobble on it and a band filter round it. */
  private cry(wave: Wave, line: [number, number][], vol: number, when = 0, wobble = 0, depth = 0, band = 0, q = 1.5, bus: AudioNode = this.sfx) {
    if (vol < 0.0005) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime + when, dur = line[line.length - 1][0];
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = wave;
    o.frequency.value = line[0][1];
    o.frequency.setValueAtTime(line[0][1], t);
    for (let i = 1; i < line.length; i++) o.frequency.exponentialRampToValueAtTime(line[i][1], t + line[i][0]);
    if (wobble > 0) {
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = wobble; lg.gain.value = depth;
      lfo.connect(lg); lg.connect(o.frequency);
      lfo.start(t); lfo.stop(t + dur + 0.02);
    }
    g.gain.value = 0;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.012, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(vol * 0.7, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (band > 0) {
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = band; f.Q.value = q;
      o.connect(f).connect(g);
    } else o.connect(g);
    g.connect(bus);
    o.start(t); o.stop(t + dur + 0.02);
    this.track(o, g);
  }

  /** A bright chord, like a little brass section: saw waves through a filter that opens as they speak. */
  private brass(freqs: number[], vol: number, when: number, dur: number, bus: AudioNode = this.sfx) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + when;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.9;
    f.frequency.value = 500;
    f.frequency.setValueAtTime(500, t);
    f.frequency.exponentialRampToValueAtTime(3200, t + 0.05);
    f.frequency.exponentialRampToValueAtTime(1300, t + dur);
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.025);
    g.gain.exponentialRampToValueAtTime(vol * 0.6, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    f.connect(g).connect(bus);
    freqs.forEach((freq, i) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = freq; o.detune.value = (i % 2 ? 5 : -5);
      o.connect(f);
      o.start(t); o.stop(t + dur + 0.02);
      this.track(o, i ? undefined : g);
    });
  }

  /** Push the tune down for a moment so a big sound is heard over it. */
  private duck(to: number, hold: number) {
    const t = this.ctx!.currentTime, g = this.musicDuck.gain;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(to, t, 0.02);
    g.setTargetAtTime(1, t + hold, 0.3);
  }

  // --- the effects

  /** Play an effect by name. `n` means something to a few of them:
   *  egg, bank: how many in a row (each rings a step higher)      combo: the streak (2, 3, 4...), a step higher each time
   *  star: 0..2 and medal: 0..6, which one (higher each time)     smash: how many boulders broke (bigger with more)
   *  ghostTick: 0..1, how nearly over (higher and sharper)        crunch: a running count (small changes of pitch)
   *  hold: 0..1, how far along the hold is */
  play(name: string, n = 0) {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const now = ctx.currentTime;
    if (now - (this.last.get(name) ?? -9) < (GAP[name] ?? 0.02)) return;
    if (this.voices > (SMALL.has(name) ? 70 : 180)) return;
    this.last.set(name, now);
    const sfx = this.sfx;
    switch (name) {
      // --- the lizard
      case 'step': {
        this.foot = !this.foot;
        // A scuff of sand and a soft pat under it. (A wide band of noise: a narrow one is a different loudness every
        // time, as much as 10 dB apart, and a footstep that comes and goes like that sounds like a fault.)
        this.noise(0.035, 0.085 + Math.random() * 0.025, 'bandpass', (this.foot ? 2300 : 2900) + Math.random() * 1200, 1800, 1.2);
        this.tone('triangle', this.foot ? 210 : 240, 120, 0.035, 0.025);
        break;
      }
      case 'dash': this.noise(0.2, 0.22, 'bandpass', 700, 3200, 1.2); this.tone('sine', 300, 620, 0.12, 0.06); this.tone('sine', 150, 70, 0.08, 0.1); break;
      case 'rustle': for (let i = 0; i < 3; i++) this.noise(0.07, 0.11, 'highpass', 2600 + Math.random() * 1500, 4200, 0.7, i * 0.045 + Math.random() * 0.02); break;
      case 'tail': this.tone('sine', 880, 220, 0.3, 0.2); this.noise(0.08, 0.3, 'bandpass', 1300, 700, 2); this.tone('triangle', 1320, 1760, 0.1, 0.12, 0.05); break;
      case 'regrow': this.tone('sine', 330, 880, 0.3, 0.12); this.pluck(note(4, 2), 0.1, 0.22); break;
      case 'pushup': this.cry('sine', [[0, 170], [0.05, 310], [0.2, 215]], 0.07, 0, 30, 28); break;
      case 'nearMiss': {
        // Something rushes past, and a quick breath in after it.
        this.noise(0.16, 0.42, 'bandpass', 500, 3600, 1.3, 0, sfx, 0.09);
        this.noise(0.2, 0.26, 'bandpass', 900, 1900, 2.2, 0.12, sfx, 0.1);
        this.noise(0.2, 0.14, 'bandpass', 2400, 3400, 2.5, 0.12, sfx, 0.1);
        this.tone('sine', 480, 900, 0.14, 0.07, 0.14, sfx, 0.06);
        break;
      }
      case 'denied': this.tone('sine', 150, 62, 0.12, 0.17); this.noise(0.06, 0.17, 'lowpass', 700, 250, 0.8); this.tone('triangle', 330, 233, 0.13, 0.11, 0.08); break;
      case 'crunch': {
        // Two bites, the second a little brighter.
        const p = 1 + ((Math.floor(n) % 5) - 2) * 0.05 + rnd(-0.02, 0.02);
        this.noise(0.045, 0.4, 'bandpass', 2300 * p, 1300 * p, 1.3, 0, sfx, 0.002);
        this.tone('square', 190 * p, 90 * p, 0.035, 0.09);
        this.noise(0.06, 0.46, 'bandpass', 3000 * p, 1500 * p, 1.3, 0.085, sfx, 0.002);
        this.tone('square', 230 * p, 100 * p, 0.04, 0.1, 0.085);
        this.noise(0.07, 0.1, 'highpass', 3500, 5000, 0.7, 0.085, sfx, 0.002, this.crackle, 1.5);
        break;
      }

      // --- eggs and prizes
      case 'egg': {
        // Each egg in a run rings one step higher.
        const f = note(Math.min(n, 13), 1);
        this.pluck(f, 0.26); this.pluck(f * 1.5, 0.14, 0.07); this.bell(f * 2, 0.05, 0.07, 0.4); this.noise(0.05, 0.05, 'highpass', 6000, 9000, 1);
        break;
      }
      case 'bank': {
        const f = note(Math.min(n, 13) + 2, 1);
        this.pluck(f, 0.24, 0, sfx, 0.35); this.tone('sine', f * 2, f * 2, 0.2, 0.08, 0.02); this.noise(0.03, 0.07, 'lowpass', 900, 300, 0.8);
        break;
      }
      case 'bankDone': [0, 2, 4, 7].forEach((d, i) => this.pluck(note(d, 2), 0.16, i * 0.07)); this.bell(note(7, 3), 0.05, 0.21, 0.5); break;
      case 'checkpoint': [0, 4, 7].forEach((d, i) => this.pluck(note(d, 1), 0.2, i * 0.09, sfx, 0.7)); this.bell(note(7, 2), 0.06, 0.18, 0.7); break;
      case 'combo': {
        // A streak: one step up the five-note scale each time, with more sparkle the longer it runs.
        const k = clamp(Math.floor(n) - 2, 0, 12), f = chime(k, 1);
        this.pluck(chime(k - 1, 1), 0.08);
        this.pluck(f, 0.19, 0.05, sfx, 0.5); this.bell(f * 2, 0.07, 0.05, 0.6);
        if (k >= 2) this.pluck(chime(k + 2, 1), 0.1, 0.11, sfx, 0.45);
        if (k >= 5) this.bell(chime(k + 4, 2), 0.07, 0.17, 0.6);
        this.noise(0.08, 0.03 + k * 0.004, 'highpass', 6000, 10000, 0.8, 0.05);
        break;
      }
      case 'gold': {
        // The most special sound in the game: a run up the scale like a harp, the tune's own two-chord ending played
        // bright and big, and glitter falling after it.
        this.duck(0.15, 2.1);
        for (let i = 0; i < 8; i++) this.pluck(note(i, 1), 0.1 + i * 0.012, i * 0.028, sfx, 0.4);
        this.brass([note(1, 1), note(3, 1), note(5, 1)], 0.13, 0.25, 0.3);
        this.bell(note(5, 2), 0.16, 0.25, 0.5);
        this.tone('sine', 150, 60, 0.3, 0.3, 0.25);
        this.brass([note(0, 1), note(2, 1), note(4, 1), note(7, 1)], 0.15, 0.53, 1.25);
        this.bell(note(4, 2), 0.2, 0.53, 1.1); this.bell(note(7, 2), 0.2, 0.7, 1.3); this.bell(note(9, 2), 0.16, 0.87, 1.3);
        this.tone('sine', 147, 55, 0.5, 0.42, 0.53);
        this.noise(1.2, 0.1, 'highpass', 7000, 11000, 0.7, 0.53, sfx, 0.02);
        for (let i = 0; i < 12; i++) this.bell(chime(Math.floor(rnd(5, 13)), 2), 0.07 * (1 - i / 16), 0.62 + i * 0.085 + rnd(0, 0.03), 0.5);
        break;
      }
      case 'medal': {
        const f = chime(clamp(Math.floor(n), 0, 6), 2);
        this.bell(f, 0.18, 0, 0.9); this.pluck(f, 0.1, 0, sfx, 0.4);
        this.noise(0.03, 0.1, 'bandpass', 2600, 1800, 3); this.noise(0.12, 0.04, 'highpass', 7000, 10000, 0.8, 0.01);
        break;
      }
      case 'star': {
        const f = note(7 + n * 2, 1);
        this.pluck(f, 0.26); this.tone('sine', f * 2, f * 2, 0.4, 0.1, 0.02); this.bell(f * 2, 0.06, 0.02, 0.6); this.noise(0.1, 0.03, 'highpass', 7000, 10000, 0.8);
        break;
      }
      case 'nestRegrow': [4, 6, 8].forEach((s, i) => this.bell(chime(s, 2), 0.07, i * 0.07, 0.45)); this.noise(0.25, 0.02, 'highpass', 7000, 10000, 0.7, 0, sfx, 0.1); break;
      case 'zoneClear': {
        // A quick run up, then ta-daa.
        this.duck(0.4, 1);
        [0, 2, 4, 7].forEach((d, i) => this.pluck(note(d, 1), 0.17, i * 0.06, sfx, 0.35));
        this.brass([note(4, 0), note(0, 1), note(2, 1)], 0.11, 0.27, 0.16); this.tone('sine', 130, 55, 0.14, 0.3, 0.27);
        this.brass([note(0, 1), note(2, 1), note(4, 1)], 0.13, 0.45, 0.7); this.tone('sine', 150, 55, 0.2, 0.36, 0.45);
        this.bell(note(7, 2), 0.14, 0.45, 0.9); this.bell(note(9, 2), 0.1, 0.56, 0.8);
        this.noise(0.5, 0.1, 'highpass', 5000, 8000, 0.8, 0.45, sfx, 0.01, this.beads, 1.5);
        break;
      }
      case 'win': {
        this.duck(0.35, 1.3);
        [0, 2, 4, 7, 9, 11, 14].forEach((d, i) => this.pluck(note(d, 1), 0.22, i * 0.09, sfx, 0.9));
        this.brass([note(0, 1), note(2, 1), note(4, 1)], 0.07, 0.54, 0.9);
        this.bell(note(14, 2), 0.08, 0.54, 1);
        this.noise(0.9, 0.05, 'highpass', 5000, 9000, 1, 0.5);
        break;
      }

      // --- power eggs
      case 'powerGet': {
        // Magic, rising: six chimes up the scale on a breath of air.
        [2, 3, 4, 5, 6, 8].forEach((s, i) => this.bell(chime(s, 2), 0.13 + i * 0.012, i * 0.05, 0.5 + i * 0.07));
        this.tone('sine', 330, 1320, 0.34, 0.07, 0, sfx, 0.08);
        this.noise(0.45, 0.05, 'highpass', 5000, 11000, 0.8, 0.05, sfx, 0.25);
        break;
      }
      case 'powerEmpty': this.tone('sine', 250, 170, 0.1, 0.1); this.tone('triangle', 500, 340, 0.06, 0.03); this.noise(0.05, 0.05, 'lowpass', 700, 300, 0.7); break;
      case 'thunder': {
        // The crack, the boom under it, and the rumble rolling away.
        this.duck(0.2, 1.4);
        // (Most of it is a roar in the middle of the range, which any speaker can play; the deep boom is for those
        // that have the bass. The long sounds are given more time than they need so that they die away slowly.)
        this.noise(0.1, 0.9, 'highpass', 1800, 900, 0.7, 0, sfx, 0.002);
        this.noise(0.3, 0.7, 'bandpass', 2400, 350, 0.7, 0.02);
        this.noise(0.6, 0.6, 'bandpass', 1100, 250, 0.9, 0.04, sfx, 0.004, this.crackle, 0.6);
        this.tone('sine', 95, 32, 1, 0.45, 0.02, sfx, 0.008);
        this.tone('triangle', 190, 55, 0.5, 0.3, 0.02);
        this.noise(3, 0.9, 'lowpass', 2200, 160, 0.7, 0.04, sfx, 0.02);
        [[0.35, 0.8], [0.8, 0.5]].forEach(([at, v]) => this.noise(1.6, v, 'bandpass', 520, 200, 0.8, at, sfx, 0.18));
        this.noise(2.4, 0.5, 'lowpass', 400, 80, 0.7, 0.1, sfx, 0.2, this.brown);
        break;
      }
      case 'smash': {
        // Rock: a thud, a crunch, and the pieces coming down. More boulders, more of everything.
        const k = clamp(Math.floor(n) || 1, 1, 6), v = 0.55 + 0.15 * Math.min(k, 4);
        this.duck(0.6, 0.3);
        this.tone('sine', 120, 42, 0.2 + 0.04 * k, 0.28 * v);
        this.tone('triangle', 240, 80, 0.12, 0.25 * v);
        this.noise(0.5 + 0.1 * k, 0.8 * v, 'bandpass', 1100, 260, 0.9);
        this.noise(0.05, 0.5 * v, 'highpass', 2500, 1200, 0.7);
        this.noise(0.6 + 0.2 * k, 0.9 * v, 'bandpass', 1400, 500, 0.8, 0.04, sfx, 0.01, this.crackle, 0.55);
        this.noise(0.9 + 0.25 * k, 0.3 * v, 'bandpass', 750, 300, 0.8, 0.05, sfx, 0.06);
        for (let i = 0; i <= k; i++) this.noise(0.05, 0.2 * v * rnd(0.5, 1), 'bandpass', rnd(500, 1200), 300, 2.5, 0.12 + i * 0.09 + rnd(0, 0.05));
        break;
      }
      case 'stun': {
        // Dizzy: a note wobbling round and round, with little stars.
        this.cry('triangle', [[0, 1250], [0.6, 950]], 0.09, 0, 11, 110);
        [8, 6, 9, 7].forEach((s, i) => this.bell(chime(s, 2), 0.07, 0.04 + i * 0.13, 0.3));
        break;
      }
      case 'ghostOn': {
        // A swell that grows out of nothing and is cut off, as if played backwards; then only air.
        this.noise(0.6, 0.3, 'bandpass', 500, 3800, 1.4, 0, sfx, 0.5);
        this.tone('sine', 220, 880, 0.6, 0.12, 0, sfx, 0.5);
        this.tone('sine', 331, 1320, 0.6, 0.07, 0, sfx, 0.5);
        this.bell(chime(5, 2), 0.1, 0.5, 0.9);
        this.noise(0.5, 0.05, 'highpass', 7000, 9000, 0.7, 0.5, sfx, 0.01);
        break;
      }
      case 'ghostOff': {
        this.tone('sine', 260, 720, 0.07, 0.14); this.noise(0.05, 0.09, 'lowpass', 1200, 400, 0.8);
        this.noise(0.22, 0.08, 'bandpass', 3000, 700, 1.2, 0.03); this.bell(chime(3, 2), 0.05, 0.05, 0.3);
        break;
      }
      case 'ghostTick': {
        const u = clamp(n, 0, 1), f = 820 + u * 620;
        this.tone('sine', f, f * 0.97, 0.05, 0.05 + u * 0.04); this.tone('sine', f * 2, f * 2, 0.03, 0.015 + u * 0.012);
        break;
      }
      case 'chiliOn': {
        // It catches: a low whump, a rush of flame, then the sizzle.
        this.tone('sine', 70, 180, 0.3, 0.3, 0, sfx, 0.03);
        this.tone('triangle', 140, 360, 0.3, 0.12, 0, sfx, 0.03);
        this.tone('sawtooth', 110, 330, 0.25, 0.06, 0.02);
        this.noise(0.42, 0.7, 'bandpass', 250, 3400, 0.9, 0, sfx, 0.12);
        this.noise(1.2, 0.55, 'highpass', 3800, 6500, 0.8, 0.12, sfx, 0.05, this.crackle, 1.4);
        this.noise(1, 0.13, 'highpass', 6000, 8000, 0.7, 0.2, sfx, 0.1);
        break;
      }
      case 'chiliOff': {
        this.noise(0.55, 0.2, 'highpass', 7000, 2500, 0.7, 0, sfx, 0.01);
        this.noise(0.5, 0.16, 'bandpass', 3000, 1200, 1, 0.02, sfx, 0.01, this.crackle, 1.2);
        this.tone('sine', 520, 140, 0.35, 0.08);
        break;
      }
      case 'burn': {
        this.noise(0.5, 0.3, 'bandpass', 2600, 1200, 0.7, 0, sfx, 0.01, this.crackle, 1.5);
        this.noise(0.3, 0.2, 'lowpass', 700, 250, 0.8, 0, sfx, 0.04);
        this.noise(0.35, 0.1, 'highpass', 5000, 7000, 0.7, 0.03);
        break;
      }
      case 'rattleThrow': {
        this.noise(0.2, 0.42, 'bandpass', 500, 2600, 1.1, 0, sfx, 0.07);
        this.noise(0.16, 0.34, 'highpass', 4000, 5000, 1, 0.02, sfx, 0.01, this.beads, 1.4);
        this.tone('sine', 420, 700, 0.14, 0.04);
        break;
      }
      case 'rattle': {
        // One shake of a maraca: the beads go forward, hit, and fall back. (The scorpion's warning is the same sound.)
        this.noise(0.08, 0.1, 'highpass', 4200, 5200, 0.8, 0, sfx, 0.05);
        this.noise(0.08, 0.45, 'bandpass', 4200, 3600, 1.2, 0, sfx, 0.05, this.beads, 1.5);
        this.noise(0.09, 0.28, 'bandpass', 5200, 4200, 0.9, 0.085, sfx, 0.002);
        this.noise(0.12, 0.8, 'bandpass', 3800, 3000, 1.2, 0.085, sfx, 0.003, this.beads, 1.3);
        this.noise(0.08, 0.13, 'highpass', 4500, 5500, 0.8, 0.2, sfx, 0.03);
        this.noise(0.08, 0.36, 'bandpass', 4000, 3400, 1.2, 0.2, sfx, 0.03, this.beads, 1.5);
        break;
      }

      // --- hunters
      case 'spotted': this.tone('square', 660, 660, 0.07, 0.13); this.tone('square', 990, 990, 0.16, 0.14, 0.08); this.noise(0.12, 0.08, 'highpass', 3000, 6000, 1, 0.08); break;
      case 'suspect': this.tone('triangle', 420, 520, 0.14, 0.12); break;
      case 'lost': this.tone('triangle', 520, 340, 0.22, 0.1); this.tone('triangle', 420, 300, 0.2, 0.08, 0.2); break;
      case 'runner': {
        // What a real roadrunner does when it has seen something: a clatter of the bill and a falling coo.
        for (let i = 0; i < 7; i++) this.noise(0.018, 0.45 - i * 0.035, 'bandpass', 1900 - i * 60, 1500, 5, i * 0.032, sfx, 0.002);
        this.cry('triangle', [[0, 640], [0.2, 460]], 0.1, 0.02);
        break;
      }
      case 'sentry': {
        // A guard's low, woody warning: tuk... tuk-tuk.
        [0, 0.2, 0.3].forEach((at, i) => {
          this.tone('triangle', 330 - i * 18, 190, 0.07, 0.17, at); this.tone('sine', 660 - i * 36, 380, 0.035, 0.08, at);
          this.noise(0.025, 0.2, 'bandpass', 1200, 700, 3, at, sfx, 0.002);
        });
        break;
      }
      case 'lure': {
        // "Hm?": a curious little rise, then a higher one with a question mark on it.
        this.cry('triangle', [[0, 520], [0.13, 700]], 0.13);
        this.cry('triangle', [[0, 760], [0.06, 800], [0.17, 1180]], 0.12, 0.17, 18, 25);
        break;
      }
      case 'scare': {
        // A yelp, and a smaller one already further off.
        this.cry('sawtooth', [[0, 620], [0.07, 1250], [0.26, 520]], 0.3, 0, 24, 60, 1500, 1.8);
        this.cry('sawtooth', [[0, 760], [0.05, 1350], [0.16, 700]], 0.16, 0.24, 24, 60, 1700, 1.8);
        this.noise(0.12, 0.06, 'bandpass', 1800, 2600, 1.5);
        break;
      }
      case 'peck': this.noise(0.03, 0.34, 'bandpass', 1800, 900, 4); this.tone('triangle', 520, 300, 0.02, 0.05); break;
      case 'screech': {
        this.cry('sawtooth', [[0, 2300], [0.6, 1300]], 0.18, 0, 28, 160, 2200, 2.5);
        this.noise(0.5, 0.06, 'bandpass', 3200, 1800, 2);
        break;
      }
      case 'dive': this.noise(0.45, 0.3, 'bandpass', 2400, 280, 1.6); break;
      case 'thud': this.tone('sine', 150, 38, 0.3, 0.5); this.noise(0.25, 0.3, 'lowpass', 900, 200, 0.8); break;
      case 'swoop': this.noise(0.55, 0.3, 'bandpass', 500, 1400, 0.9, 0, sfx, 0.2); break;
      case 'hoot': this.tone('sine', 392, 370, 0.22, 0.09, 0, this.ambient, 0.04); this.tone('sine', 330, 311, 0.4, 0.1, 0.3, this.ambient, 0.05); break;
      case 'snap': this.noise(0.06, 0.34, 'bandpass', 1500, 500, 2.4); this.tone('square', 210, 80, 0.09, 0.16); break;
      case 'caught': {
        this.duck(0.35, 1);
        [7, 5, 4, 1, 0].forEach((d, i) => this.tone('triangle', note(d, 1), note(d, 1) * 0.97, 0.22, 0.2, i * 0.11));
        this.tone('sine', 160, 40, 0.5, 0.4, 0.5); this.noise(0.3, 0.2, 'lowpass', 700, 150, 0.8, 0.5);
        break;
      }
      case 'respawn': this.tone('sine', 220, 660, 0.3, 0.12); this.pluck(note(0, 2), 0.14, 0.2); break;

      // --- the world, the menus
      case 'flutter': for (let i = 0; i < 4; i++) this.noise(0.03, 0.15 * rnd(0.7, 1), 'bandpass', rnd(1400, 2800), 900, 0.9, i * 0.034 + rnd(0, 0.008), sfx, 0.01); break;
      case 'tumble': {
        // Dry twigs going over and over.
        for (let i = 0; i < 4; i++) this.noise(0.11, 0.34 * (1 - i * 0.15), 'bandpass', rnd(1500, 2400), 900, 0.8, i * 0.1 + rnd(0, 0.02), sfx, 0.03, this.crackle, 1.3);
        this.noise(0.45, 0.05, 'highpass', 3000, 2000, 0.7, 0, sfx, 0.1);
        break;
      }
      case 'zone': [0, 4].forEach((d, i) => this.tone('sine', note(d, 1), note(d, 1), 1.1, 0.07, i * 0.12, sfx, 0.25)); break;
      case 'ui': this.tone('triangle', 660, 660, 0.06, 0.1); break;
      case 'uiGo': this.pluck(note(0, 2), 0.18); this.pluck(note(4, 2), 0.16, 0.08); break;
      case 'hold': this.tone('sine', 300 + n * 500, 320 + n * 500, 0.06, 0.05); break;

      // --- the rainforest
      case 'storm': {
        if (n < 1) {
          // Far off: a long low roll that swells and sinks, twice.
          this.noise(4.2, 0.3, 'lowpass', 520, 90, 0.7, 0, sfx, 0.9, this.brown);
          this.noise(3, 0.22, 'bandpass', 300, 120, 0.8, 0.9, sfx, 0.6, this.crackle, 0.4);
          this.tone('sine', 62, 36, 3, 0.2, 0.2, sfx, 0.7);
        } else {
          // Closer: a crack, a boom under it, and a long roll away.
          this.duck(0.45, 1.6);
          this.noise(0.08, 0.5, 'highpass', 2000, 1000, 0.7, 0, sfx, 0.002);
          this.noise(0.25, 0.4, 'bandpass', 2200, 400, 0.7, 0.02);
          this.tone('sine', 90, 34, 0.9, 0.35, 0.03, sfx, 0.01);
          this.noise(4.5, 0.5, 'lowpass', 1400, 100, 0.7, 0.06, sfx, 0.05);
          this.noise(3.5, 0.4, 'bandpass', 450, 150, 0.8, 0.9, sfx, 0.5, this.crackle, 0.5);
          this.noise(4, 0.3, 'lowpass', 300, 70, 0.7, 0.3, sfx, 0.5, this.brown);
        }
        break;
      }
      case 'splash': {
        // A plop, the bubble coming up, and spray.
        this.tone('sine', 420, 140, 0.09, 0.22, 0, sfx, 0.004);
        this.tone('sine', 260, 720, 0.08, 0.09, 0.03, sfx, 0.01);
        this.noise(0.12, 0.2, 'bandpass', 800, 1800, 1, 0, sfx, 0.006);
        this.noise(0.35, 0.16, 'highpass', 3500, 6500, 0.8, 0.02, sfx, 0.02);
        for (let i = 0; i < 4; i++) this.tone('sine', rnd(1400, 2600), rnd(900, 1600), 0.04, 0.03, 0.1 + i * rnd(0.04, 0.08), sfx, 0.003);
        break;
      }
      case 'logLift': {
        // Wood groaning as the water gets under it, with the slosh.
        this.cry('sawtooth', [[0, 110], [0.35, 165], [0.7, 120], [1.1, 150]], 0.06, 0, 34, 24, 420, 4);
        this.cry('sawtooth', [[0, 95], [0.3, 130], [0.6, 100]], 0.045, 0.45, 41, 18, 350, 4);
        this.noise(1.2, 0.18, 'bandpass', 380, 700, 1.2, 0, sfx, 0.4, this.brown);
        for (let i = 0; i < 3; i++) this.noise(0.03, 0.1, 'bandpass', rnd(600, 1100), 400, 3, 0.15 + i * 0.3 + rnd(0, 0.08), sfx, 0.002, this.crackle, 1.2);
        break;
      }
      case 'logLodge': {
        // A hollow knock against the bank, a second, softer, and the creak of settling.
        this.tone('sine', 190, 80, 0.2, 0.36, 0, sfx, 0.003);
        this.tone('triangle', 400, 170, 0.1, 0.14);
        this.tone('sine', 250, 235, 0.35, 0.1, 0.02, sfx, 0.004);
        this.noise(0.08, 0.2, 'bandpass', 800, 300, 1.5, 0, sfx, 0.002);
        this.tone('sine', 170, 75, 0.16, 0.16, 0.24, sfx, 0.003);
        this.noise(0.05, 0.08, 'bandpass', 700, 300, 1.5, 0.24, sfx, 0.002);
        this.cry('sawtooth', [[0, 130], [0.3, 100]], 0.035, 0.4, 30, 14, 380, 4);
        this.noise(0.5, 0.1, 'bandpass', 500, 300, 1, 0.1, sfx, 0.15, this.brown);
        break;
      }
      case 'tunnel': {
        // Into the hollow: muffled scrabbling on wood.
        for (let i = 0; i < 4; i++) this.noise(0.07, 0.16 * (1 - i * 0.18), 'lowpass', rnd(700, 1300), 400, 1.2, i * 0.07 + rnd(0, 0.02), sfx, 0.01, this.crackle, 1.2);
        this.tone('triangle', 150, 100, 0.05, 0.08, 0.05);
        this.tone('triangle', 130, 90, 0.05, 0.07, 0.2);
        this.noise(0.25, 0.06, 'bandpass', 500, 300, 1, 0.1, sfx, 0.08);
        break;
      }
      case 'spiderOut': {
        // Legs testing the wood, one then the next, with a dry breath of movement behind them.
        let at = 0;
        for (let i = 0; i < 10; i++) {
          at += i % 3 === 2 ? rnd(0.16, 0.26) : rnd(0.05, 0.1);
          this.noise(0.012, 0.16, 'bandpass', rnd(2200, 3800), 1600, 6, at, sfx, 0.001);
          if (i % 2) this.tone('triangle', rnd(900, 1300), 600, 0.012, 0.012, at);
        }
        this.noise(at + 0.1, 0.035, 'highpass', 3500, 5000, 0.8, 0, sfx, 0.3);
        break;
      }
      case 'spiderIn': {
        let at = 0;
        for (let i = 0; i < 6; i++) { at += rnd(0.045, 0.09); this.noise(0.012, 0.14 * (1 - i * 0.1), 'bandpass', rnd(2000, 3200), 1400, 6, at, sfx, 0.001); }
        this.noise(at + 0.05, 0.03, 'highpass', 3000, 4500, 0.8, 0, sfx, 0.1);
        break;
      }
      case 'hiss': {
        // Air through a narrow gap: a quick breath in, a long sharp one out.
        this.noise(0.75, 0.3, 'highpass', 3000, 5200, 0.8, 0.03, sfx, 0.06);
        this.noise(0.7, 0.2, 'bandpass', 6500, 5000, 0.9, 0.04, sfx, 0.08);
        this.noise(0.5, 0.07, 'bandpass', 1500, 900, 1, 0.08, sfx, 0.1);
        break;
      }
      case 'coati': {
        // "Hnk?": a quick chirp, then a snuffling grunt.
        this.cry('triangle', [[0, 900], [0.05, 1550], [0.13, 1150]], 0.13);
        this.cry('sawtooth', [[0, 200], [0.12, 150]], 0.12, 0.13, 40, 12, 600, 1.5);
        this.noise(0.08, 0.1, 'bandpass', 1400, 900, 1.5, 0.14, sfx, 0.02);
        break;
      }
      default:
        if (import.meta.env.DEV && !this.unknown.has(name)) { this.unknown.add(name); console.warn(`sound: no effect called "${name}"`); }
    }
  }

  // --- the air

  private startBeds() {
    const ctx = this.ctx!;
    const gain = (v: number, to: AudioNode) => { const g = ctx.createGain(); g.gain.value = v; g.connect(to); return g; };
    const band = (type: BiquadFilterType, freq: number, q: number) => { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; return f; };
    const lfo = (wave: Wave, hz: number, depth: number, to: AudioParam) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = wave; o.frequency.value = hz; g.gain.value = depth;
      o.connect(g); g.connect(to); o.start();
    };
    const pan = (v: number, to: AudioNode) => { const p = ctx.createStereoPanner(); p.pan.value = v; p.connect(to); return p; };
    // One loop of hiss feeds every bed; each takes its own band of it.
    const hiss = ctx.createBufferSource(); hiss.buffer = this.white; hiss.loop = true; hiss.start();

    // Wind: a slow, wandering band.
    this.windFilter = band('bandpass', 420, 0.6);
    this.windGain = gain(0.05, this.ambient);
    hiss.connect(this.windFilter).connect(this.windGain);

    // Insects: a high band, gated on and off quickly.
    const am = gain(0.5, this.bugGain = gain(0.02, pan(0.3, this.ambient)));
    lfo('square', 17, 0.5, am.gain);
    hiss.connect(band('bandpass', 5200, 9)).connect(am);

    // Cicadas (noon): two buzzing bands that swell and sink together, slowly.
    this.cicadaGain = gain(0, pan(-0.35, this.ambient));
    const swell = gain(0.6, this.cicadaGain);
    lfo('sine', 0.13, 0.4, swell.gain);
    ([[6100, 14, 52], [4500, 10, 41]] as const).forEach(([freq, q, buzz]) => {
      const pulse = gain(0.5, swell);
      lfo('sawtooth', buzz, 0.5, pulse.gain);
      hiss.connect(band('bandpass', freq, q)).connect(pulse);
    });

    // Heat (noon): the very top of the hiss, trembling.
    this.shimmerGain = gain(0, this.ambient);
    const tremble = gain(0.5, this.shimmerGain);
    lfo('sine', 6.3, 0.5, tremble.gain);
    hiss.connect(band('highpass', 9000, 0.7)).connect(tremble);

    // A low hum (dusk): the tune's root and fifth, breathing.
    this.lowGain = gain(0, this.ambient);
    const soft = band('lowpass', 420, 0.7); soft.connect(this.lowGain);
    const breath = gain(0.7, soft);
    lfo('sine', 0.07, 0.3, breath.gain);
    ([[note(0, -1), 0.4], [note(4, -1) * 1.003, 0.3], [note(0, 0) * 0.998, 0.22], [note(4, 0) * 1.002, 0.08]] as const).forEach(([freq, v]) => {
      const o = ctx.createOscillator(); o.frequency.value = freq; o.connect(gain(v, breath)); o.start();
    });

    // Water (the streams): a soft rush with a bubbling top that shifts about.
    this.waterGain = gain(0, pan(0.15, this.ambient));
    const rush = band('bandpass', 700, 0.8);
    lfo('sine', 0.23, 300, rush.frequency);
    hiss.connect(rush).connect(this.waterGain);
    const bubble = gain(0.4, this.waterGain);
    lfo('sine', 0.37, 0.25, bubble.gain);
    const sparkle = band('bandpass', 2600, 2.5);
    lfo('sine', 0.9, 800, sparkle.frequency);
    hiss.connect(sparkle).connect(bubble);

    // Frogs: two chorus bands, peeping at different speeds, swelling and sinking.
    this.frogGain = gain(0, pan(-0.25, this.ambient));
    const chorus = gain(0.6, this.frogGain);
    lfo('sine', 0.11, 0.4, chorus.gain);
    ([[2100, 12, 6.5], [2900, 14, 4.2]] as const).forEach(([freq, q, peep]) => {
      const gate = gain(0.5, chorus);
      lfo('square', peep, 0.5, gate.gain);
      hiss.connect(band('bandpass', freq, q)).connect(gate);
    });

    // Rain: a hiss, a roar under it, and drops on leaves (a sparse crackle that gets denser as it grows).
    const rainOut = gain(1, this.ambient);
    this.rainRoar = gain(0, rainOut);
    hiss.connect(band('bandpass', 3600, 0.35)).connect(this.rainRoar);
    this.rainDeep = gain(0, rainOut);
    const deep = ctx.createBufferSource(); deep.buffer = this.brown; deep.loop = true; deep.start();
    deep.connect(band('lowpass', 650, 0.7)).connect(this.rainDeep);
    this.rainPatter = gain(0, pan(0.1, rainOut));
    this.rainSrc = ctx.createBufferSource(); this.rainSrc.buffer = this.crackle; this.rainSrc.loop = true; this.rainSrc.start();
    this.rainSrc.connect(band('bandpass', 3000, 0.9)).connect(this.rainPatter);
    this.applyRain(0.01);
  }

  /** The rain: 0 is silent, 0.2 to 0.35 a few drops on leaves, 1 a steady downpour. Fades over about a second. */
  setRain(amount: number) {
    const a = clamp(amount, 0, 1);
    if (Math.abs(a - this.rain) < 0.004 && (a > 0 || this.rain === 0)) return;
    this.rain = a;
    this.applyRain(0.4);
  }

  private applyRain(tau: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, a = this.rain;
    this.rainPatter?.gain.setTargetAtTime(0.2 * smooth(0, 0.3, a) * (1 - 0.3 * smooth(0.6, 1, a)), t, tau);
    this.rainRoar?.gain.setTargetAtTime(0.13 * smooth(0.2, 1, a), t, tau);
    this.rainDeep?.gain.setTargetAtTime(0.16 * smooth(0.45, 1, a), t, tau);
    this.rainSrc?.playbackRate.setTargetAtTime(0.5 + a * 1.4, t, tau);
  }

  /** Drips off the leaves and the odd plink, more of them as it rains. */
  private drips(now: number) {
    if (this.rain < 0.05 || now < this.nextDrip) return;
    this.nextDrip = now + rnd(0.35, 1.5) / (0.25 + this.rain);
    const f = rnd(1300, 2800), v = 0.035 * (0.5 + this.rain * 0.5) * rnd(0.6, 1);
    this.tone('sine', f, f * 1.5, 0.05, v, 0, this.far, 0.003);
    if (Math.random() < 0.35) this.tone('sine', f * 0.75, f * 1.1, 0.07, v * 0.6, rnd(0.08, 0.2), this.far, 0.003);
  }

  /** The air of an area: how much wind, how many insects. */
  setMood(wind: number, bugs: number) {
    if (Math.abs(wind - this.wind) < 0.01 && Math.abs(bugs - this.bugs) < 0.01) return;
    this.wind = wind; this.bugs = bugs;
    this.air(1.5);
  }

  private air(tau: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, z = this.zone;
    this.windGain?.gain.setTargetAtTime((0.045 + this.wind * 0.06) * (1 + z.howl * 2.5) * (1 - z.hush * 0.8), t, tau);
    this.bugGain?.gain.setTargetAtTime(this.bugs * 0.1 * z.bugs, t, tau);
  }

  /** Which area the lizard is in: 'morning' | 'noon' | 'canyon' | 'thicket' | 'dusk' | 'sunset'. The tune and the air
   *  change to suit, over a couple of seconds. */
  setZone(mood: string) {
    const name = mood in ZONES ? mood : 'morning';
    if (name === this.zoneName) return;
    this.zoneName = name;
    this.zone = ZONES[name];
    this.applyZone(0.9);
  }

  private applyZone(tau: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime, z = this.zone;
    this.tuneTone(tau);
    this.musicSend.gain.setTargetAtTime(z.echo, t, tau);
    this.sfxSend.gain.setTargetAtTime(z.echo * 0.45, t, tau);
    this.cicadaGain?.gain.setTargetAtTime(z.cicada * 0.36, t, tau);
    this.shimmerGain?.gain.setTargetAtTime(z.shimmer * 0.035, t, tau);
    this.lowGain?.gain.setTargetAtTime(z.low * 0.1, t, tau);
    this.waterGain?.gain.setTargetAtTime(z.water * 0.1, t, tau);
    this.frogGain?.gain.setTargetAtTime(z.frog * 0.05, t, tau);
    this.windFilter?.Q.setTargetAtTime(0.6 + z.howl * 2.4, t, tau);
    this.air(tau);
    // Let the new place speak up soon (a bird, an owl), so the change is noticed.
    this.nextLife = Math.min(this.nextLife, t + rnd(1.5, 3));
    this.nextCricket = t + rnd(0.3, 0.8);
  }

  /** How open the tune sounds: the area sets it, and the ghost egg shuts it right down, as if heard under water. */
  private tuneTone(tau: number) {
    const t = this.ctx!.currentTime, ghost = this.power === 'ghost';
    this.musicTone.frequency.setTargetAtTime(ghost ? 360 : this.zone.bright, t, ghost ? 0.15 : tau);
    this.musicTone.Q.setTargetAtTime(ghost ? 1.6 : 0.7, t, 0.15);
  }

  /** A layer that lasts as long as a timed power: 'ghost' an airy, shimmering chord with the tune sunk beneath it;
   *  'chili' a fast hand drum and a hurrying tune. null takes it away again. */
  setPower(kind: 'ghost' | 'chili' | null) {
    if (kind !== 'ghost' && kind !== 'chili') kind = null;
    if (kind === this.power) return;
    const was = this.power;
    this.power = kind;
    if (!this.ctx) return;
    if (was === 'ghost') this.ghostStop();
    if (kind === 'ghost') this.ghostStart();
    if (was === 'ghost' || kind === 'ghost') this.tuneTone(0.35);
  }

  private ghostStart() {
    const ctx = this.ctx!, t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.gain.setValueAtTime(0, t); out.gain.setTargetAtTime(1, t, 0.3);
    out.connect(this.layer);
    const srcs: AudioScheduledSourceNode[] = [];
    const lfo = (hz: number, depth: number, to: AudioParam) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = hz; g.gain.value = depth;
      o.connect(g); g.connect(to); o.start(t); srcs.push(o);
    };
    // A hollow chord (D A D F# D). Every note has a twin a hair out of tune, and the pairs beat against each other
    // at different speeds: that is the shimmer.
    const pad = ctx.createGain(); pad.gain.value = 0.3; pad.connect(out);
    lfo(0.8, 0.14, pad.gain);
    ([[293.66, 0.05], [440, 0.04], [587.33, 0.035], [739.99, 0.022], [1174.66, 0.012]] as const).forEach(([freq, v]) => {
      const g = ctx.createGain(); g.gain.value = v; g.connect(pad);
      for (const cents of [-3, 3]) {
        const o = ctx.createOscillator(); o.frequency.value = freq; o.detune.value = cents;
        o.connect(g); o.start(t); srcs.push(o);
      }
    });
    // Air: a band of hiss that drifts up and down.
    const air = ctx.createBufferSource(); air.buffer = this.white; air.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = 4;
    lfo(0.27, 1300, f.frequency);
    const ag = ctx.createGain(); ag.gain.value = 0.06;
    air.connect(f).connect(ag).connect(out);
    air.start(t, Math.random()); srcs.push(air);
    this.ghost = { out, srcs };
  }

  private ghostStop() {
    const g = this.ghost;
    if (!g || !this.ctx) return;
    this.ghost = null;
    const t = this.ctx.currentTime;
    g.out.gain.cancelScheduledValues(t);
    g.out.gain.setTargetAtTime(0, t, 0.1);
    g.srcs[0].onended = () => g.out.disconnect();
    for (const s of g.srcs) s.stop(t + 0.7);
  }

  /** Small things that happen in the air of each area now and then. */
  private life(now: number) {
    const z = this.mix, far = this.far;
    if (z.cricket > 0.05 && now > this.nextCricket) {
      this.nextCricket = now + rnd(0.35, 0.85) / (0.4 + z.cricket * 0.6);
      const f = rnd(4000, 4600), v = 0.05 * z.cricket * rnd(0.5, 1);
      for (let i = 0; i < 3; i++) this.tone('sine', f, f, 0.024, v, i * 0.034, this.ambient, 0.004);
    }
    if (now < this.nextLife) return;
    switch (this.zoneName) {
      case 'morning': {
        // A small bird: a few quick chirps.
        const f = rnd(2600, 3600), k = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < k; i++) this.cry('sine', [[0, f], [0.045, f * 1.35], [0.085, f * 0.9]], 0.04, i * 0.13 + rnd(0, 0.02), 0, 0, 0, 1, far);
        this.nextLife = now + rnd(4, 9);
        break;
      }
      case 'canyon': {
        // A pebble comes down somewhere, and the walls answer.
        const k = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < k; i++) this.noise(0.03, 0.14 * rnd(0.5, 1), 'bandpass', rnd(900, 1900), 600, 4, i * rnd(0.09, 0.16), far, 0.002);
        this.noise(2.4, 0.07, 'bandpass', 280, 520, 2.5, 0.3, this.ambient, 1.1);
        this.nextLife = now + rnd(6, 11);
        break;
      }
      case 'thicket': {
        // Something small buzzes by, or the leaves stir.
        if (Math.random() < 0.6) { const f = rnd(170, 230); this.cry('sawtooth', [[0, f], [0.2, f * 1.2], [0.5, f * 0.85]], 0.05, 0, 31, 14, 1100, 1.2, this.ambient); }
        else for (let i = 0; i < 3; i++) this.noise(0.09, 0.04, 'highpass', rnd(2600, 4000), 4200, 0.7, i * 0.07 + rnd(0, 0.03), this.ambient);
        this.nextLife = now + rnd(2.5, 6);
        break;
      }
      case 'dusk': {
        // An owl, a long way off (lower and softer than the one hunting nearby).
        this.tone('sine', 330, 311, 0.24, 0.07, 0, far, 0.05);
        this.tone('sine', 277, 262, 0.45, 0.08, 0.32, far, 0.06);
        this.nextLife = now + rnd(9, 18);
        break;
      }
      case 'sunset': {
        // A dove settling for the night.
        this.cry('sine', [[0, 520], [0.12, 560], [0.36, 470]], 0.05, 0, 0, 0, 0, 1, far);
        this.cry('sine', [[0, 500], [0.1, 530], [0.3, 450]], 0.04, 0.5, 0, 0, 0, 1, far);
        this.nextLife = now + rnd(8, 15);
        break;
      }
      case 'hall': case 'heliconia': case 'firefly': {
        const r = Math.random();
        if (r < 0.4) {
          // A tree frog: a few ticking peeps.
          const f = rnd(1800, 2600), k = 2 + Math.floor(Math.random() * 4), gap = rnd(0.08, 0.13);
          for (let i = 0; i < k; i++) this.tone('sine', f, f * 0.8, 0.045, 0.045, i * gap, far, 0.004);
        } else if (r < 0.6 && this.zoneName !== 'firefly') {
          // Cicadas, a short buzz that swells.
          this.cry('sawtooth', [[0, 5200], [1.4, 5700]], 0.025, 0, 48, 180, 5400, 8, this.ambient);
        } else if (r < 0.8 && this.zoneName === 'hall') {
          // A howler monkey, a long way off: a slow, hoarse roar.
          this.cry('sawtooth', [[0, 170], [0.6, 230], [1.6, 165], [2.6, 190]], 0.05, 0, 9, 14, 380, 1.5, far);
          this.noise(2.6, 0.05, 'bandpass', 320, 220, 1.5, 0, far, 0.5);
        } else if (this.zoneName === 'firefly') {
          // Soft glints, like something lighting up.
          for (let i = 0; i < 3; i++) this.bell(chime(Math.floor(rnd(6, 11)), 2), 0.025, i * rnd(0.2, 0.5), 0.5, far);
        } else if (this.zoneName === 'heliconia') {
          // A hummingbird whirring past, and the leaves it touched.
          this.cry('sawtooth', [[0, 240], [0.3, 330], [0.6, 220]], 0.04, 0, 42, 25, 900, 1.5, this.ambient);
          for (let i = 0; i < 3; i++) this.noise(0.08, 0.04, 'highpass', rnd(2600, 4000), 4200, 0.7, 0.2 + i * 0.07, this.ambient);
        } else {
          // A bird far off: two thin falling whistles.
          this.cry('sine', [[0, 1900], [0.18, 1500]], 0.04, 0, 0, 0, 0, 1, far);
          this.cry('sine', [[0, 1700], [0.2, 1250]], 0.035, 0.3, 0, 0, 0, 1, far);
        }
        this.nextLife = now + rnd(2.5, 6);
        break;
      }
      case 'fords': case 'creek': {
        // Water: little plinks and trickles, and in the creek a slow gulp now and then.
        const k = 3 + Math.floor(Math.random() * 4);
        for (let i = 0; i < k; i++) { const f = rnd(900, 2400); this.tone('sine', f, f * 1.6, 0.05, 0.03, i * rnd(0.05, 0.16), far, 0.003); }
        this.noise(0.8, 0.04, 'bandpass', 1200, 2400, 1.5, 0, this.ambient, 0.2);
        if (this.zoneName === 'creek') this.cry('sine', [[0, 150], [0.12, 260]], 0.05, rnd(0.2, 0.6), 0, 0, 0, 1, far);
        else if (Math.random() < 0.3) { const f = rnd(1900, 2500); this.tone('sine', f, f * 0.8, 0.05, 0.04, 0.5, far, 0.004); this.tone('sine', f, f * 0.8, 0.05, 0.04, 0.62, far, 0.004); }
        this.nextLife = now + rnd(2, 5);
        break;
      }
      default: this.nextLife = now + 5;
    }
  }

  // --- the tune

  /** 'desert' (the default) or 'rainforest': which tune is played. */
  setTheme(name: string) { this.theme = name === 'rainforest' ? 'rainforest' : 'desert'; }

  /** 0 calm .. 1 being chased. */
  setTension(v: number) { this.tensionTarget = clamp(v, 0, 1); }

  update(dt: number, time: number) {
    const ctx = this.ctx;
    if (!ctx || (this.live && this.live.state !== 'running')) return;
    const now = ctx.currentTime;
    this.tension += (this.tensionTarget - this.tension) * Math.min(1, dt * (this.tensionTarget > this.tension ? 6 : 0.7));
    const k = 1 - Math.exp(-dt / 0.7);
    for (const key of MIX_KEYS) this.mix[key] += (this.zone[key] - this.mix[key]) * k;
    this.chili += ((this.power === 'chili' ? 1 : 0) - this.chili) * (1 - Math.exp(-dt / 0.2));
    if (this.windFilter && now >= this.nextWind) {
      this.nextWind = now + 0.12;
      const howl = this.mix.howl;
      this.windFilter.frequency.setTargetAtTime((380 + Math.sin(time * 0.31) * 140 + Math.sin(time * 0.13) * 90) * (1 - howl * 0.25) + Math.sin(time * 0.9) * 60 * howl, now, 0.4);
    }
    // The tune: sixteenth notes, scheduled a little ahead of the clock. (After a long gap, say the tab was hidden,
    // start again from now instead of playing everything that was missed at once.)
    const tempo = this.mix.tempo * (1 + this.tension * 0.4) * (1 + this.chili * 0.22);
    const stepLen = 60 / tempo / 4;
    if (this.nextStep < now - 0.25) this.nextStep = now + 0.05;
    while (this.nextStep < now + 0.15) {
      this.tuneStep(this.step, Math.max(0, this.nextStep - now), stepLen);
      this.nextStep += stepLen;
      this.step++;
    }
    if (!this.muted) { this.life(now); this.drips(now); }
  }

  private dum(vol: number, when: number, f = 115) {
    this.tone('sine', f, 52, 0.16, vol, when, this.music, 0.004);
    this.tone('triangle', f * 2, f, 0.07, vol * 0.35, when, this.music, 0.003);
    this.noise(0.05, vol * 0.3, 'lowpass', 800, 300, 1, when, this.music);
  }

  private tek(vol: number, when: number) {
    this.noise(0.08, vol, 'bandpass', 1900, 1300, 3, when, this.music, 0.002);
    this.tone('triangle', 430, 300, 0.06, vol * 0.5, when, this.music, 0.002);
  }

  /** One half of a heartbeat. */
  private heart(vol: number, when: number, pitch = 1) {
    this.tone('sine', 66 * pitch, 40, 0.17, vol, when, this.music, 0.012);
    this.tone('triangle', 132 * pitch, 70, 0.1, vol * 0.3, when, this.music, 0.012);
    this.noise(0.06, vol * 0.3, 'lowpass', 520 * pitch, 180, 0.8, when, this.music, 0.008);
  }

  /** A buzzing string: a saw wave through a filter that closes as it rings. With `tremble`, a long shivering note. */
  private reed(freq: number, vol: number, when: number, dur: number, tremble = 0) {
    if (vol < 0.0005) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.value = 0;
    if (tremble > 0) {
      f.frequency.value = Math.min(3000, freq * 3);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + dur * 0.4);
      g.gain.linearRampToValueAtTime(0, t + dur);
      const lfo = ctx.createOscillator(), lg = ctx.createGain(), shake = ctx.createGain();
      lfo.frequency.value = tremble; lg.gain.value = 0.45; shake.gain.value = 0.55;
      lfo.connect(lg); lg.connect(shake.gain);
      lfo.start(t); lfo.stop(t + dur + 0.02);
      o.connect(f).connect(shake).connect(g);
    } else {
      f.frequency.value = freq * 9;
      f.frequency.setValueAtTime(freq * 9, t);
      f.frequency.exponentialRampToValueAtTime(freq * 3.5, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
      g.gain.exponentialRampToValueAtTime(vol * 0.4, t + dur * 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(f).connect(g);
    }
    g.connect(this.music);
    o.start(t); o.stop(t + dur + 0.02);
    this.track(o, g);
  }

  /** The answering voice: a breathy flute. */
  private flute(freq: number, vol: number, when: number, dur: number) {
    const a = Math.min(0.05, dur * 0.3);
    this.sing('sine', freq, vol, when, a, Math.max(0.02, dur * 0.7 - a), Math.min(0.2, dur * 0.5), this.music, 0.985);
    this.sing('triangle', freq * 2, vol * 0.14, when, a, Math.max(0.02, dur * 0.5 - a), 0.08, this.music);
    this.noise(Math.min(0.12, dur), vol * 0.3, 'bandpass', freq * 3, freq * 3, 2, when, this.music, 0.03);
  }

  /** The rainforest's plucked voice: a marimba-like wooden note with a little kalimba tine on the high ones. */
  private wood(freq: number, vol: number, when: number, dur: number) {
    const m = this.music;
    this.tone('sine', freq, freq, dur, vol, when, m, 0.002);
    this.tone('sine', freq * 3.98, freq * 3.98, dur * 0.12, vol * 0.3, when, m, 0.002);
    this.noise(0.012, vol * 0.2, 'bandpass', freq * 2, freq * 2, 3, when, m, 0.001);
    if (freq > 300) this.tone('sine', freq * 5.4, freq * 5.4, dur * 0.2, vol * 0.08, when, m, 0.002);
  }

  /** The rainforest's answering voice: a soft wooden flute, slow to speak, with a lot of breath. */
  private woodFlute(freq: number, vol: number, when: number, dur: number) {
    const a = Math.min(0.09, dur * 0.4);
    this.sing('sine', freq, vol, when, a, Math.max(0.02, dur * 0.7 - a), Math.min(0.3, dur * 0.5), this.music, 0.99);
    this.sing('sine', freq * 3, vol * 0.05, when, a, Math.max(0.02, dur * 0.5 - a), 0.1);
    this.noise(Math.min(0.25, dur), vol * 0.5, 'bandpass', freq * 2, freq * 2, 1.5, when, this.music, 0.06);
  }

  private tuneStep(s: number, when: number, len: number) {
    if (this.muted) return;
    const bar = Math.floor(s / 16), i = s % 16, ph = bar % 8, round = Math.floor(bar / 8) % 3;
    const z = this.mix, tense = this.tension, hot = this.chili, m = this.music;
    // The tune itself steps back as a hunt closes in, and the hunt's own music takes over.
    const calm = 1 - smooth(0.3, 0.75, tense);
    const oct = Math.round(z.octave);
    const [r1, r2] = BASS[ph];
    const rf = this.theme === 'rainforest', nt = rf ? wnote : note;

    // Drone: the root under everything, a fifth above it every other bar.
    if (i === 0) {
      this.tone('sine', nt(0, -1), nt(0, -1), len * 10, 0.1 * z.drone, when, m, 0.08);
      this.tone('sine', nt(0, 0), nt(0, 0), len * 10, 0.035 * z.drone, when, m, 0.12);
      if (bar % 2) this.tone('sine', nt(4, -1), nt(4, -1), len * 8, 0.055 * z.drone, when, m, 0.1);
    }

    // Bass: the root of the bar, its fifth half way, and now and then a step that leads back home.
    let low: number | null = null, long = 2;
    if (i === 0) { low = r1; long = 5; }
    else if (i === 8) { low = r2 !== r1 ? r2 : r1 + 4; long = 4; }
    else if (i === 6 && z.busy > 0.4) low = r1;
    else if (i === 12 && z.busy > 0.65) low = r2;
    else if (i === 14 && z.busy > 0.4 && (ph === 1 || ph === 7)) low = 1;
    if (low !== null) {
      const f = nt(low, -1), v = z.bass * (0.45 + 0.55 * calm);
      this.tone('triangle', f, f, len * long * 0.9, 0.15 * v, when, m, 0.008);
      this.tone('sine', f * 2, f * 2, len * long * 0.5, 0.07 * v, when, m, 0.008);
    }

    // The melody. Twice through, the plucked voice calls and the flute answers, then the other way round; the third
    // time round it rests, and the plucked voice just wanders (a little differently every time).
    if (calm > 0.03) {
      if (round === 2) {
        if (i === 0 && ph % 4 === 0) {
          const k = Math.floor(Math.random() * this.motif.length);
          this.motif[k] = clamp(this.motif[k] + (Math.random() < 0.5 ? -1 : 1), 0, 9);
        }
        const hits = [0, 3, 6, 10, 12], k = hits.indexOf(i);
        if (k >= 0 && (ph % 4 !== 3 || i < 8) && (z.busy >= 0.5 || i % 8 === 0 || k === 1))
          { const f = nt(this.motif[(k + bar * 3) % this.motif.length], 1 + oct), v = 0.16 * z.lead * calm; if (rf) this.wood(f, v * 1.1, when, 0.7); else this.pluck(f, v, when, m, 0.55); }
      } else {
        for (const [at, degree, steps] of TUNE[ph]) {
          if (at !== i) continue;
          if (!(z.busy >= 0.5 || at % 8 === 0 || (z.busy >= 0.3 && steps >= 3))) continue;
          const call = ph % 4 < 2, accent = at % 8 === 0 ? 1.15 : 1, dur = len * steps;
          if (call === (round === 0)) {
            const f = nt(degree, 1 + oct), v = z.lead * calm * accent;
            if (rf) this.wood(f, 0.19 * v, when, clamp(dur * 1.6, 0.35, 1));
            else { this.pluck(f, 0.17 * v, when, m, clamp(dur * 1.8, 0.3, 1.1)); this.reed(f, 0.045 * v, when, clamp(dur, 0.2, 0.5)); }
          }
          else {
            const g = rf ? this.woodFlute : this.flute;
            g.call(this, nt(degree, 2 + oct), 0.11 * z.reply * calm * accent, when, dur);
            if (z.pad > 0.5) g.call(this, nt(degree + 2, 2 + oct), 0.05 * z.reply * calm, when, dur);
          }
        }
      }
    }

    // A warm chord under each half bar (sunset has the most of it).
    if (i % 8 === 0 && z.pad * calm > 0.05) {
      const root = i ? r2 : r1, dur = len * 8;
      for (const d of [root, root + 2, root + 4]) this.sing('sine', nt(d, 0), 0.035 * z.pad * calm, when, dur * 0.35, dur * 0.4, dur * 0.6, m);
    }

    // Hand drum (dum tek . tek dum . tek .) and shaker. Both make way for the hunt and for the chili.
    const groove = z.drum * (1 - smooth(0.25, 0.55, tense)) * (1 - hot);
    if (groove > 0.03) {
      if (i === 0 || i === 8) this.dum(0.2 * groove, when);
      else if (i === 2 || i === 6 || i === 12) this.tek(0.13 * groove, when);
      else if ((i === 10 || i === 14) && z.busy > 0.6) this.tek(0.06 * groove, when);
    }
    if (i % 4 === 2) this.noise(0.04, 0.03 * z.shaker + tense * 0.05, 'highpass', 5000, 7000, 1, when, m);
    else if (i % 2 === 1 && z.busy > 0.8) this.noise(0.025, 0.012 * z.shaker, 'highpass', 6500, 8000, 1, when, m);

    // Something has noticed: a heartbeat, slow at first, then on every beat.
    if (tense > 0.1) {
      const v = smooth(0.1, 0.45, tense) * (1 - 0.5 * smooth(0.5, 0.9, tense));
      const racing = tense > 0.6, beat = racing ? i % 4 : i % 8;
      if (beat === 0) this.heart(0.5 * v, when);
      else if (beat === (racing ? 1 : 2)) this.heart(0.32 * v, when, 0.85);
    }
    // Hunted: a driving hand drum, a hurried low figure that keeps falling back on the root, ticking sixteenths, and
    // a high shiver over the top.
    if (tense > 0.3) {
      const v = (tense - 0.3) / 0.7;
      if (hot > 0.5) { /* the chili's own drum is already going */ }
      else if (i % 4 === 0 || i === 6 || i === 14) this.dum(0.4 * v, when, i % 8 === 0 ? 120 : 170);
      else if (i % 4 === 2) this.tek(0.26 * v, when);
      if (i % 2 === 0) { this.reed(nt(HUNT[i / 2], 0), 0.14 * v, when, len * 1.6); this.reed(nt(HUNT[i / 2], 1), 0.22 * v, when, len * 1.5); }
      if (i === 0 || i === 10) for (const d of [0, 4]) this.reed(nt(d, 1), 0.15 * v, when, len * 2.5);
      this.noise(0.018, (i % 4 === 0 ? 0.09 : 0.045) * v, 'highpass', 7500, 9000, 1, when, m, 0.002);
      if (i === 0 && tense > 0.55) this.reed(nt(bar % 2 ? 1 : 0, 2), 0.2 * smooth(0.55, 0.9, tense), when, len * 16, 13);
    }

    // Chili: every sixteenth is a drum, the bass pumps, and the fire spits.
    if (hot > 0.05) {
      const hit = CHILI_DRUM[i];
      if (hit === 'D') this.dum(0.42 * hot, when, 140); else this.tek((hit === 'T' ? 0.34 : 0.15) * hot, when);
      if (i % 2 === 0) this.reed(nt(i % 8 === 6 ? 4 : 0, i % 4 === 0 ? 1 : 2), 0.22 * hot, when, len * 1.5);
      if (i % 4 === 0) this.reed(nt(0, 0), 0.12 * hot, when, len * 2);
      if (i % 4 === 0) this.noise(len * 6, 0.2 * hot, 'bandpass', 2400, 1800, 0.8, when, m, 0.02, this.crackle, 1.2);
    }
  }
}
