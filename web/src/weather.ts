// The rain, and what it does to the water. A timetable, not dice, so it can be learned:
//   dry      the streams are narrow: walk the fords, run the logs, dash over the rest
//   warn     thunder, the picture dims, the first drops, the logs rock
//   rain     every stream a tile wider each side, the fords under, each log afloat to its next resting place
//   ease     the water draws back; the logs stay where they landed until the next rain
// Nobody dies of water: a lizard with nothing under its feet is washed back onto the bank it came from, eggs and
// all, and one standing on a log when it lifts rides it to where it lodges.
import type { Sound } from './audio';
import { shared } from './gfx';
import type { Level } from './level';
import type { Lizard } from './lizard';
import type { Particles } from './particles';
import { clamp01, type V2 } from './util';
import type { World } from './world';

export type Sky = 'dry' | 'warn' | 'rain' | 'ease';
const WARN = 6, EASE = 6, RISE = 3, DRIFT = 5.5;

export class Weather {
  sky: Sky = 'dry';
  /** Seconds left of this part of the timetable. */
  left = 0;
  /** How hard it is raining, 0..1, and how far the water has risen, 0..1. */
  rain = 0;
  flood = 0;
  /** How many times it has rained this run. */
  showers = 0;
  /** Set for a frame when the lizard has just been washed ashore. */
  washed = false;
  /** The log the lizard is riding (-1: none). */
  riding = -1;
  /** How far a log under the lizard's feet lifts it off the ground. */
  perch = 0;
  private spot: number[] = [];
  private drift: number[] = [];
  private from: V2[] = [];
  private pos: V2[] = [];
  private lastDry: V2 = { x: 0, z: 0 };
  private rideOff: V2 = { x: 0, z: 0 };
  private clock = 0;

  constructor(private level: Level, private world: World) { this.reset(); }

  /** Does it ever rain here? */
  get rains() { return this.level.drySeconds > 0 && this.level.rainSeconds > 0; }

  reset() {
    const lv = this.level;
    this.sky = 'dry'; this.left = lv.drySeconds; this.rain = 0; this.flood = 0; this.showers = 0; this.riding = -1;
    this.spot = lv.logs.map(() => 0);
    this.drift = lv.logs.map(() => 0);
    this.from = lv.logs.map((l) => ({ ...l.spots[0] }));
    this.pos = lv.logs.map((l) => ({ ...l.spots[0] }));
    this.lastDry = { ...lv.start };
    lv.setFlood(false);
    this.lodge();
    shared.uFlood.value = 0; shared.uRain.value = 0;
    lv.logs.forEach((_, i) => this.world.setLog(i, this.pos[i].x, this.pos[i].z, 0, 0));
  }

  /** For tests: where each log is, and whether it is afloat. */
  logs() { return this.pos.map((p, i) => ({ x: +p.x.toFixed(2), z: +p.z.toFixed(2), afloat: this.drift[i] > 0 })); }

  /** Jump the timetable on (for tests, and for showing someone the rain): the next part starts now. */
  skip(sound?: Sound) { this.left = 0; if (sound) this.next(sound); }

  /** Only the logs that are lodged can be walked on. */
  private lodge() {
    const lv = this.level;
    lv.setBridges(lv.logs.flatMap((l, i) => (this.drift[i] > 0 ? [] : [{ x: this.pos[i].x, z: this.pos[i].z, len: l.len, ns: l.ns }])));
  }

  private next(sound: Sound) {
    const lv = this.level;
    if (this.sky === 'dry') { this.sky = 'warn'; this.left = WARN; sound.play('storm'); }
    else if (this.sky === 'warn') {
      this.sky = 'rain'; this.left = lv.rainSeconds; this.showers++;
      sound.play('storm', 1);
      if (lv.logs.some((l) => l.spots.length > 1)) sound.play('logLift');
      // The water lifts every log that has somewhere else to go.
      lv.logs.forEach((l, i) => {
        if (l.spots.length < 2) return;
        this.from[i] = { ...this.pos[i] };
        this.spot[i] = (this.spot[i] + 1) % l.spots.length;
        this.drift[i] = 0.0001;
      });
      this.lodge();
    } else if (this.sky === 'rain') { this.sky = 'ease'; this.left = EASE; }
    else { this.sky = 'dry'; this.left = lv.drySeconds; }
  }

  /** Is this spot on log i as it lies now? */
  private onLog(i: number, x: number, z: number) {
    const l = this.level.logs[i], p = this.pos[i];
    const along = l.ns ? z - p.z : x - p.x, across = l.ns ? x - p.x : z - p.z;
    return Math.abs(along) < l.len / 2 + 0.3 && Math.abs(across) < 0.6;
  }

  update(dt: number, playing: boolean, liz: Lizard, fx: Particles, sound: Sound) {
    const lv = this.level;
    this.washed = false;
    this.clock += dt;
    if (this.rains && playing && dt > 0) {
      const was = this.sky;
      this.left -= dt;
      if (this.left <= 0) this.next(sound);
      // Standing on a log as it lifts: go with it.
      if (was === 'warn' && this.sky === 'rain' && liz.alive && this.riding < 0) {
        const i = lv.logs.findIndex((_, k) => this.drift[k] > 0 && this.onLog(k, liz.pos.x, liz.pos.z));
        if (i >= 0) { this.riding = i; this.rideOff = { x: liz.pos.x - this.pos[i].x, z: liz.pos.z - this.pos[i].z }; liz.frozen = true; }
      }
    }
    const rainTo = this.sky === 'rain' ? 1 : this.sky === 'warn' ? 0.35 * (1 - this.left / WARN) : this.sky === 'ease' ? this.left / EASE : 0;
    this.rain += (rainTo - this.rain) * Math.min(1, dt * 2.5);
    const floodTo = this.sky === 'rain' ? 1 : this.sky === 'ease' ? this.left / EASE : 0;
    this.flood = floodTo > this.flood ? Math.min(floodTo, this.flood + dt / RISE) : Math.max(floodTo, this.flood - dt / (EASE * 0.8));
    if (lv.flooded !== this.flood > 0.5) lv.setFlood(this.flood > 0.5);
    shared.uFlood.value = this.flood * this.flood * (3 - 2 * this.flood);
    shared.uRain.value = this.rain;

    // --- the logs: afloat they drift to the next resting place, turning a little; in the warning they rock
    lv.logs.forEach((l, i) => {
      const to = l.spots[this.spot[i]];
      if (this.drift[i] > 0) {
        this.drift[i] += dt / DRIFT;
        const u = clamp01(this.drift[i]), e = u * u * (3 - 2 * u);
        this.pos[i].x = this.from[i].x + (to.x - this.from[i].x) * e;
        this.pos[i].z = this.from[i].z + (to.z - this.from[i].z) * e;
        if (u >= 1) {
          this.drift[i] = 0;
          this.lodge();
          sound.play('logLodge');
          fx.burst('ring', to.x, to.z);
        }
        this.world.setLog(i, this.pos[i].x, this.pos[i].z, Math.sin(u * Math.PI), Math.sin(this.clock * 1.3 + i) * 0.16 * Math.sin(u * Math.PI));
      } else if (this.sky === 'warn') {
        this.world.setLog(i, to.x, to.z, 0.3 * (1 - this.left / WARN), Math.sin(this.clock * 7 + i * 2) * 0.035 * (1 - this.left / WARN));
      } else if (this.sky === 'rain' && this.left > lv.rainSeconds - 0.2) this.world.setLog(i, to.x, to.z, 0, 0);
    });

    // Up on a log, not wading through it.
    const lc = Math.floor(liz.pos.x), lr = Math.floor(liz.pos.z);
    const up = this.riding >= 0 || (lv.inside(lc, lr) && lv.bridge[lr * lv.w + lc] === 1 && lv.logs.some((_, i) => this.drift[i] === 0 && this.onLog(i, liz.pos.x, liz.pos.z)));
    this.perch += ((up ? 0.36 : 0) - this.perch) * Math.min(1, dt * 12);

    // --- the lizard and the water
    if (!playing || !liz.alive) return;
    if (this.riding >= 0) {
      const i = this.riding;
      liz.pos.x = this.pos[i].x + this.rideOff.x; liz.pos.z = this.pos[i].z + this.rideOff.z;
      if (this.drift[i] === 0) { this.riding = -1; liz.frozen = false; }
      return;
    }
    if (liz.events.swamped) {
      fx.burst('ringBig', liz.pos.x, liz.pos.z);
      fx.burst('poof', liz.pos.x, liz.pos.z);
      sound.play('splash');
      liz.place(this.lastDry.x, this.lastDry.z, liz.heading + Math.PI);
      liz.invuln = Math.max(liz.invuln, 0.7);
      fx.burst('poof', liz.pos.x, liz.pos.z);
      this.washed = true;
      return;
    }
    // The bank it came from: the last ground it stood on that no flood reaches.
    const c = Math.floor(liz.pos.x), r = Math.floor(liz.pos.z);
    if (!liz.dashing && !liz.inside && lv.inside(c, r) && lv.water[r * lv.w + c] === 0 && !lv.hard[r * lv.w + c] && lv.deck[r * lv.w + c] !== 1) { this.lastDry.x = liz.pos.x; this.lastDry.z = liz.pos.z; }
  }
}
