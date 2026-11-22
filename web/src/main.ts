// Start-up, and what lasts a whole visit: the one canvas, the one sound, the HUD and the keys; which level is up; and
// the screens that lead into play:
//   splash -> title -> level select -> the level's card -> play -> end card (-> next level, or the level select)
// Changing level never reloads the page: the level in play is thrown away and another built on the same canvas, with
// the sound still running (a reload would drop a phone out of full screen and silence it until the next tap).
//
// Handy while working (add to the address):
//   ?view=top              an overhead camera, for pictures    ?skip=1    straight into play, no menus
//   ?at=27,24              start the lizard at that tile      ?mute=1    no sound
//   ?bot=1                 a stand-in player runs the level   ?post=0    without the finishing pass
//   ?level=desert          which level (an id from src/levels.ts, or the name of any map in public/levels): open, earned or not
//   ?unlock=1              every level open                   ?splash=0  no splash (or how many seconds of it)
//   ?eggs=5                start with eggs in tow             ?safe=1    nothing can catch the lizard
//   ?power=thunder|ghost|chili|rattle   start holding a power egg
//   ?res=1.5               draw at that many pixels per point, and leave it there (a phone otherwise lowers it if it can't keep up)
import './style.css';
import { Sound } from './audio';
import { Game, disposeTextures, type Params, type Shell } from './game';
import { Post, makeRenderer } from './gfx';
import { Hud, type CardView } from './hud';
import { Input } from './input';
import { loadLevel } from './level';
import {
  bestOf, coming, howToOpen, isOpen, knowsHow, lastPlayed, levelById, nextAfter, playable, setKnowsHow, setLastPlayed, strayLevel, unlockAll, unlockOne,
  type LevelInfo,
} from './levels';
import { loadTextures } from './world';

declare global {
  interface Window { __booted?: boolean; __bootError?: (msg: string) => void; et?: Game }
}

/** How long "Media Jousts presents" stays up, in seconds, unless a key, a button or a tap sends it away sooner. */
const SPLASH_SECONDS = 2;
/** A postcard must stay chosen this long before its level is fetched, so a run along the row does not fetch them all. */
const CHOOSE_WAIT = 0.3;
/** The dark sheet that hides one level being swapped for another takes this long to come down, in milliseconds. */
const VEIL_MS = 230;

const WONT_LOAD = 'That map would not load. Try again?';

/** Which screen has the buttons. 'none': the game itself (play, its pause card, its end card). 'wait': a level is on its way. */
type Screen = 'none' | 'splash' | 'title' | 'how' | 'select' | 'card' | 'first' | 'wait';

class App implements Shell {
  readonly renderer: Shell['renderer'];
  readonly post: Post;
  readonly sound = new Sound();
  readonly hud: Hud;
  readonly input = new Input();
  resScale = 1;
  /** The level that is up. window.et is always this. */
  game!: Game;
  screen: Screen = 'none';
  private base = import.meta.env.BASE_URL;
  /** The postcards on the table, and which is chosen. */
  private list: LevelInfo[] = [];
  private chosen = 0;
  private chooseT = 0;
  /** The level asked for last (it may still be on its way), and the fetching of it. */
  private wanted: LevelInfo | null = null;
  private loading: Promise<void> = Promise.resolve();
  private changes = 0;
  private splashT = 0;
  private splashAt = 0;

  constructor(container: HTMLElement, private params: Params, private splashFor: number) {
    this.renderer = makeRenderer(container);
    this.post = new Post(this.renderer);
    this.hud = new Hud(this.base);
    if (params.mute) this.sound.enabled = false;
    this.hud.onMenu = (action, index) => this.onMenu(action, index);
    this.hud.onSound = () => { this.sound.toggleMute(); this.sound.play('ui'); };
    this.hud.onFullscreen = () => this.fullscreen();
    // Sound can only be started from inside a key press, a click or a touch (an iPhone is strict about it).
    this.input.onGesture = () => this.sound.unlock();
    // One of each of these for the whole visit, whichever level is up.
    const resize = () => { this.game?.resize(); this.hud.layout(); };
    window.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    // The page put away (another tab, the phone locked, a call): stop the clock and the sound until it is back.
    document.addEventListener('visibilitychange', () => {
      this.input.letGo();
      if (document.hidden) this.game?.putAway();
      this.sound.sleep(document.hidden);
    });
  }

  /** The first level, with the splash over it while it is fetched (or nothing over it, for ?skip=1). */
  async begin(first: LevelInfo) {
    const splash = !this.params.skip && this.splashFor > 0;
    if (splash) {
      this.screen = 'splash';
      this.splashAt = performance.now();
      this.hud.showSplash(true);
      document.getElementById('boot')?.classList.add('gone');
      // Still fetching when the splash has had its time: it stays, and says what the wait is for.
      window.setTimeout(() => { if (!this.game) this.hud.showSplash(true, true); }, this.splashFor * 1000);
    }
    await this.open(first, this.params);
    if (this.params.skip) this.screen = 'none';
    else if (!splash) this.toTitle();
  }

  /** Resolves when no level is on its way, with the id of the one that is up (for tests). */
  async settled() { await this.loading.catch(() => {}); return this.game.info.id; }

  /** Put a level up behind the menus in place of the one there. The picture goes dark for the moment of the swap. */
  private open(level: LevelInfo, params: Params = { ...this.params, skip: false, at: undefined, eggs: undefined, power: undefined }): Promise<void> {
    if (level === this.wanted) return this.loading;
    this.wanted = level;
    const change = ++this.changes, first = !this.game;
    if (!first) this.hud.veil(true);
    const job = (async () => {
      const [lv] = await Promise.all([
        loadLevel(`${this.base}levels/${level.map}`),
        first ? document.fonts.load('20px Caroni').catch(() => null) : new Promise((r) => window.setTimeout(r, VEIL_MS)),
      ]);
      // The map says which place it is, and so whose drawings to fetch.
      const tex = await loadTextures(this.base, lv.theme);
      if (change !== this.changes) { disposeTextures(tex); return; } // another level was asked for meanwhile
      this.game?.dispose();
      this.game = new Game(this, level, lv, tex, params);
      window.et = this.game;
    })();
    this.loading = job.catch((err) => {
      if (change !== this.changes) return;
      this.wanted = this.game?.info ?? null;
      throw err;
    }).finally(() => { if (change === this.changes) this.hud.veil(false); });
    return this.loading;
  }

  // ---- the screens

  /** Called by the game every frame it is waiting behind a menu: the keys and the pad work whichever screen is up. */
  menu(real: number) {
    const i = this.input, hud = this.hud;
    const light = (d: number) => { if (hud.nav(d)) this.sound.play('ui'); };
    switch (this.screen) {
      case 'splash':
        // It doubles as the first key, tap or button: the one a browser wants before it plays sound, and the one that
        // says whether hints should show keys, a pad or a touch screen.
        this.splashT += real;
        if (i.any || this.splashT >= this.splashFor || performance.now() - this.splashAt >= this.splashFor * 1000) this.toTitle();
        break;
      case 'title':
        if (i.navX || i.navY) light(i.navX || i.navY);
        else if (i.confirm) hud.press();
        break;
      case 'how': case 'first':
        if (i.confirm) hud.press();
        else if (i.back) this.onMenu('how-back');
        break;
      case 'select':
        if (i.navX) this.choose(this.chosen + i.navX);
        else if (i.confirm) this.onMenu('sel-go');
        else if (i.back) this.onMenu('sel-back');
        // The chosen level comes up behind the table, once the choosing has stopped.
        if (this.chooseT > 0 && (this.chooseT -= real) <= 0) {
          const level = this.list[this.chosen];
          if (level && isOpen(level)) this.open(level).catch(() => { if (this.screen === 'select') this.hud.selectNote(WONT_LOAD); });
        }
        break;
      case 'card':
        if (i.navX) light(i.navX);
        else if (i.confirm) hud.press();
        else if (i.back) this.onMenu('card-back');
        break;
    }
  }

  /** A button on a menu, pressed with a key, a pad, a mouse or a finger. */
  private onMenu(action: string, index = 0) {
    const hud = this.hud, s = this.screen;
    if (action === 'play' && s === 'title') this.toSelect();
    else if (action === 'how' && s === 'title') { this.screen = 'how'; hud.showTitle(false); hud.showHow(true); this.sound.play('ui'); }
    else if (action === 'how-ok' && s === 'how') { hud.showHow(false); this.toTitle(); this.sound.play('ui'); }
    else if (action === 'how-back' && s === 'how') { hud.showHow(false); this.toTitle(); this.sound.play('ui'); }
    else if (action === 'how-ok' && s === 'first') this.play();
    else if (action === 'how-back' && s === 'first') { hud.showHow(false); this.toCard(this.game.info); }
    else if (action === 'sel-back' && s === 'select') { hud.showSelect(null); this.toTitle(); this.sound.play('ui'); }
    else if (action === 'pick' && s === 'select') { if (index === this.chosen) this.onMenu('sel-go'); else this.choose(index); }
    else if (action === 'sel-go' && s === 'select') {
      const level = this.list[this.chosen];
      if (level && isOpen(level)) { this.sound.play('ui'); void this.toCard(level); }
      else { hud.refuse(); this.sound.play('denied'); }
    }
    else if (action === 'card-back' && s === 'card') this.toSelect();
    else if (action === 'card-go' && s === 'card') {
      // Before a player's first run: how to play, once.
      if (knowsHow()) this.play();
      else { this.screen = 'first'; hud.showLevelCard(null); hud.showHow(true); this.sound.play('ui'); }
    }
    // From the game's own cards: the end card and the pause card.
    else if (action === 'select' && s === 'none') this.toSelect();
    else if (action === 'next' && s === 'none') {
      const next = nextAfter(this.game.info.id);
      if (next && isOpen(next) && this.game.state === 'won') { hud.showResults(null); this.sound.play('ui'); void this.toCard(next); }
    }
  }

  private toTitle() {
    this.screen = 'title';
    this.hud.showSplash(false);
    this.hud.showTitle(true);
  }

  /** The table of postcards, open on the level that is up. */
  private toSelect() {
    if (this.game.state !== 'title') this.game.idle();
    this.screen = 'select';
    this.chooseT = 0;
    this.hud.showTitle(false);
    this.hud.showLevelCard(null);
    this.list = playable();
    const here = this.wanted ?? this.game.info; // (the one on its way, if the one that is up is about to go)
    if (!this.list.includes(here)) this.list.push(here); // a map that is not in the list yet still gets a card
    this.chosen = this.list.indexOf(here);
    const card = (l: LevelInfo): CardView => ({
      name: l.name, line: l.line, picture: l.picture ? `${this.base}levels/${l.picture}` : '', colours: l.colours,
      best: bestOf(l), locked: isOpen(l) ? null : howToOpen(l),
    });
    this.hud.showSelect(this.list.map(card), this.chosen, coming().length);
    this.sound.play('ui');
  }

  private choose(i: number) {
    i = Math.min(this.list.length - 1, Math.max(0, i));
    if (i === this.chosen) return;
    this.chosen = i;
    this.chooseT = CHOOSE_WAIT;
    this.hud.choose(i);
    this.sound.play('ui');
  }

  /** The card before a level, once that level is up behind it. */
  private async toCard(level: LevelInfo) {
    this.screen = 'wait';
    this.hud.showSelect(null);
    let failed = false;
    try { await this.open(level); } catch { failed = true; }
    if (this.game.info !== level) { this.toSelect(); if (failed) this.hud.selectNote(WONT_LOAD); return; }
    this.screen = 'card';
    this.hud.showLevelCard({ name: level.name, line: level.line, idea: level.idea, par: this.game.level.parSeconds, best: bestOf(level) });
  }

  private play() {
    setKnowsHow();
    setLastPlayed(this.game.info.id);
    this.hud.showLevelCard(null);
    this.hud.showHow(false);
    this.screen = 'none';
    this.input.dash = false; // the key that said "go" is not also a dash
    this.game.start();
  }

  /** Fill the screen, on its side (where the browser can: the buttons that call this are only shown there). */
  private fullscreen() {
    const lock = () => (screen.orientation as unknown as { lock?: (o: string) => Promise<void> })?.lock?.('landscape')?.catch(() => {});
    try {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen({ navigationUI: 'hide' }).then(lock).catch(() => {});
    } catch { /* not here */ }
  }
}

async function boot() {
  const q = new URLSearchParams(location.search);
  const at = q.get('at')?.split(',').map(Number);
  const params: Params = {
    view: q.get('view') ?? undefined,
    skip: q.has('skip'),
    mute: q.has('mute'),
    bot: q.has('bot'),
    post: q.get('post') !== '0',
    at: at && at.length === 2 && at.every(Number.isFinite) ? [at[0] + 0.5, at[1] + 0.5] : undefined,
    eggs: Number(q.get('eggs') ?? 0) || undefined,
    power: q.get('power') ?? undefined,
    safe: q.has('safe'),
    res: Number(q.get('res')) > 0 ? Math.min(3, Math.max(0.25, Number(q.get('res')))) : undefined,
  };
  if (q.has('unlock')) unlockAll();
  // A level named in the address is gone to whether it has been earned or not; otherwise the one played last.
  const asked = q.get('level');
  if (asked) unlockOne(asked);
  // (?skip=1 is for working on the game: without a level named it is always the first one.)
  const known = levelById(asked ?? (params.skip ? null : lastPlayed()));
  const first = known?.ready ? known : asked ? strayLevel(asked) : playable()[0];
  const splash = q.has('splash') ? Math.max(0, Number(q.get('splash')) || 0) : SPLASH_SECONDS;
  const app = new App(document.getElementById('game')!, params, splash);
  await app.begin(first);
  window.__booted = true;
  document.getElementById('boot')?.classList.add('gone');
  const loop = (now: number) => {
    app.game.frame(now);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

boot().catch((err) => {
  console.error(err);
  window.__bootError?.(String(err?.message ?? err));
});
