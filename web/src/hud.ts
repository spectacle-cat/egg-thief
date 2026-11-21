// Everything drawn over the game in HTML: the egg count, the power egg slot, the little map, banners, stamps, hints,
// and the three screens (title, pause, the end-of-level card on the family's hand-torn paper).
// The setters are called every frame: each remembers what it last showed and only touches the page when that changes.
import { VIEWS } from './camera';
import type { Level } from './level';

const el = <T extends HTMLElement = HTMLElement>(parent: ParentNode, sel: string) => parent.querySelector(sel) as T;
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
/** Play a one-shot CSS animation class again from the start. */
const replay = (e: HTMLElement, cls: string) => { e.classList.remove(cls); void e.offsetWidth; e.classList.add(cls); };

export type PowerKind = 'thunder' | 'ghost' | 'chili' | 'rattle';
export type MedalId = 'eggs' | 'gold' | 'unseen' | 'tail' | 'speedy' | 'bugs' | 'untouchable';
export interface Medal { id: MedalId; name: string; desc: string; got: boolean }
export interface BestRun { time: number; stars: number; eggs: number; total: number; medals: number }
export interface Results {
  title: string; eggs: number; total: number; seconds: number; caught: number; tails: number; stars: number;
  par?: number; gold?: boolean; beetles?: number; beetlesTotal?: number; newBest?: boolean; medals?: Medal[];
}

const POWERS: Record<PowerKind, { name: string; desc: string }> = {
  thunder: { name: 'Thunder Egg', desc: 'Smash cracked rocks' },
  ghost: { name: 'Ghost Egg', desc: 'Vanish for a moment' },
  chili: { name: 'Chili Egg', desc: 'Run like fire, burn thorns' },
  rattle: { name: 'Rattle Egg', desc: 'Throw a noisy decoy' },
};
/** The order of the cells in sprites/medals.png. */
const MEDAL_CELLS: MedalId[] = ['eggs', 'gold', 'unseen', 'tail', 'speedy', 'bugs', 'untouchable'];
/** Stand-ins until the medal art is there. */
const MEDAL_EMOJI: Record<MedalId, string> = { eggs: '🥚', gold: '🌟', unseen: '🌿', tail: '🦎', speedy: '⚡', bugs: '🪲', untouchable: '🛡️' };
/** Art that may not have been drawn yet: each has a stand-in made of CSS, swapped out when the picture loads. */
const OPTIONAL_ART = ['egg_thunder', 'egg_ghost', 'egg_chili', 'egg_rattle', 'egg_gold', 'beetle', 'medals'];

// Pad buttons are drawn, not typed: the font has no shapes, and a drawn one can be a PlayStation shape or an Xbox letter.
const PAD_SHAPE = {
  cross: '<svg viewBox="0 0 24 24"><path d="M7.6 7.6l8.8 8.8M16.4 7.6l-8.8 8.8"/></svg>',
  tri: '<svg viewBox="0 0 24 24"><path d="M12 6.4l6.4 10.9H5.6z"/></svg>',
};
const PAD_LETTER = { cross: 'A', tri: 'Y' };
const padBtn = (k: 'cross' | 'tri') => `<span class="padbtn ${k}">${PAD_SHAPE[k]}<b>${PAD_LETTER[k]}</b></span>`;
const STICK = '<span class="stick"><i></i></span>';
/** A pad button with a name and no shape: what a PlayStation pad calls it, and what an Xbox pad does. */
const padKey = (ps: string, xbox: string) => `<kbd class="ps-only">${ps}</kbd><kbd class="xbox-only">${xbox}</kbd>`;
const TICK = '<svg class="tick" viewBox="0 0 24 24"><path d="M4.5 12.5l5 5L19.5 6.5"/></svg>';
/** The dash button a touch screen gets, and the same drawing small, for the cards that explain it. */
const DASH_SHAPE = '<svg viewBox="0 0 24 24"><path d="M5.5 6.5l5.5 5.5-5.5 5.5M13 6.5l5.5 5.5-5.5 5.5"/></svg>';
const TDASH = `<span class="padbtn tdash">${DASH_SHAPE}</span>`;
/** Three versions of a control: for the keyboard, for a pad, and for a touch screen. */
const dev = (keys: string, pad: string, touch: string) => `<span class="for-keys">${keys}</span><span class="for-pad">${pad}</span><span class="for-touch">${touch}</span>`;
/** A hint's key caps, given their pad buttons and touch buttons too, so the same line of advice reads right on each. */
const PAD_FOR: Record<string, string> = { E: padBtn('tri'), SPACE: padBtn('cross'), WASD: STICK };
const TOUCH_FOR: Record<string, string> = { E: '<kbd>EGG</kbd>', SPACE: '<kbd>DASH</kbd>', WASD: STICK };
const padify = (html: string) => html.replace(/<kbd>(E|SPACE|WASD)<\/kbd>/g, (m, k: string) => dev(m, PAD_FOR[k], TOUCH_FOR[k]));
/** Plain text from the game with its keys turned into key caps. */
const keyify = (s: string) => esc(s).replace(/\b(SPACE|ENTER|ESC|DASH)\b/g, '<kbd>$1</kbd>').replace(/✕/g, padBtn('cross')).replace(/△/g, padBtn('tri'));

export class Hud {
  private root: HTMLElement;
  private play: HTMLElement;
  private eggsEl: HTMLElement; private eggsN: HTMLElement; private eggsOf: HTMLElement; private carryEl: HTMLElement; private timerEl: HTMLElement;
  private goldEl: HTMLElement; private comboEl: HTMLElement; private comboText: HTMLElement;
  private tailEl: HTMLElement; private tailBar: HTMLElement; private dashEl: HTMLElement; private dashBar: HTMLElement;
  private bugsEl: HTMLElement; private bugsN: HTMLElement; private bugsOf: HTMLElement;
  private powerEl: HTMLElement; private powerName: HTMLElement; private powerDesc: HTMLElement;
  private viewEls: HTMLElement[]; private cardEls: HTMLElement[];
  private zoneEl: HTMLElement; private hintEl: HTMLElement; private toastEl: HTMLElement; private hiddenEl: HTMLElement;
  private stampEl: HTMLElement; private stampTitle: HTMLElement; private stampSub: HTMLElement;
  private promptEl: HTMLElement; private promptBar: HTMLElement; private promptText: HTMLElement;
  private stickEl: HTMLElement; private dashBtn: HTMLElement; private soundEl: HTMLElement;
  private marksEl: HTMLElement; private markPool: HTMLElement[] = []; private markUsed = 0;
  private map: HTMLCanvasElement; private mapCtx: CanvasRenderingContext2D; private mapBase: HTMLCanvasElement | null = null;
  private bestEl: HTMLElement;
  readonly title: HTMLElement; readonly pause: HTMLElement; readonly results: HTMLElement;
  private hintTimer = 0;
  private hintQueue: string[] = [];
  private stampTimer = 0;
  private stampQueue: { title: string; sub: string; kind: string }[] = [];
  private resultTimers: number[] = [];
  private art = new Map<string, { state: 'loading' | 'ok' | 'missing'; tried: number; n: number }>();
  // What is on the page now, so that a setter called with the same thing again does nothing.
  private lastCarry = '';
  private lastBanked = -1; private lastTotal = -1;
  private lastTime = -1;
  private lastTail = -1; private lastTailLow: boolean | null = null; private lastDash = -1; private lastDashLow: boolean | null = null;
  private lastHidden = false;
  private lastPad: 'ps' | 'xbox' | false | null = null;
  private lastTouch: boolean | null = null;
  private lastStick = ''; private lastSound: boolean | null = null;
  private lastPowerKind: PowerKind | null = null; private lastPowerActive = -1; private lastUrgent = false;
  private lastBugs = -1; private lastBugsTotal = -1;
  private lastGold: boolean | null = null;
  private lastCombo = 0;
  private lastPrompt: string | null = null; private lastPromptPos = ''; private lastPromptBar = -1;
  onPickView: (i: number) => void = () => {};
  onStart: () => void = () => {};
  onResume: () => void = () => {};
  onRestart: () => void = () => {};
  onAgain: () => void = () => {};
  /** The sound button on the pause card (a phone has no M key). */
  onSound: () => void = () => {};
  onFullscreen: () => void = () => {};
  /** Each star on the results card as it pops (0, 1, 2). */
  onStar?: (index: number) => void;
  /** Each earned medal on the results card as it pops: its place in the medals list, and how many have popped before it. */
  onMedal?: (index: number, nth: number) => void;

  constructor(private base: string) {
    this.root = document.getElementById('ui')!;
    const spr = (name: string) => `${base}sprites/${name}.png`;
    const views = VIEWS.map((v, i) => `<span data-v="${i}"><b>${i + 1}</b><em>${v.label}</em></span>`).join('');
    const picks = VIEWS.map((v, i) => `<span class="card" data-v="${i}" title="${esc(v.blurb)}"><b>${i + 1}</b>${v.label}</span>`).join('');
    const tiles = (word: string) => [...word].map((c) => `<span>${c}</span>`).join('');
    const wasd = '<span class="wasd"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span>';
    this.root.innerHTML = `
      <div class="hud off">
        <div class="tl">
          <div class="eggrow">
            <div class="eggs"><img src="${spr('egg_2')}" alt=""><b class="n">0</b><span class="of">/ 0</span><small>home</small></div>
            <div class="gold" title="The golden egg"><i class="g-out"></i><i class="g-egg"></i><i class="g-shine"></i></div>
            <div class="combo"><i></i><b></b></div>
          </div>
          <div class="carry"></div>
          <div class="pips">
            <div class="pip chip tail">Tail <i class="bar"><b></b></i></div>
            <div class="pip chip dash">Dash <i class="bar"><b></b></i></div>
            <div class="pip chip bugs"><i class="bug"></i><span><b class="n">0</b><small>/ 0</small></span></div>
          </div>
        </div>
        <div class="tr"><div class="t-top"><div class="tbtn t-pause" data-touch="pause"><i></i><i></i></div><div class="timer chip">0:00</div></div><div class="views">${views}</div></div>
        <div class="zone"><b></b><i></i></div>
        <div class="stamp"><div class="st"><b></b><small></small></div></div>
        <div class="toast"></div>
        <div class="hidden-tag">HIDDEN</div>
        <div class="hint chip"></div>
        <div class="power empty">
          <div class="p-sock" data-touch="power"><i class="p-burst"></i><i class="p-ring"></i><i class="p-out"></i><i class="p-egg"><i></i></i></div>
          <div class="p-card">
            <div class="p-info"><b class="p-name"></b><small class="p-desc"></small></div>
            <div class="p-key">${dev('<kbd>E</kbd>', padBtn('tri'), '')}</div>
          </div>
        </div>
        <div class="minimap chip"><canvas></canvas></div>
        <div class="tstick"><i></i></div>
        <div class="tbtn t-dash" data-touch="dash"><i class="t-ring"></i>${DASH_SHAPE}<b>DASH</b></div>
        <div class="marks"></div>
        <div class="prompt"><div class="pr"><span></span><i><b></b></i></div></div>
      </div>
      <div class="screen title on">
        <div class="t-stack">
          <div class="logo">
            <h1 aria-label="Egg Thief">${tiles('EGG')}<i></i>${tiles('THIEF')}</h1>
            <div class="t-liz"><i></i></div>
            <div class="t-loot"><img src="${spr('egg_1')}" alt=""><img src="${spr('egg_3')}" alt=""><img src="${spr('egg_2')}" alt=""></div>
          </div>
          <div class="creed">YOU ARE A LIZARD. <em>COLLECT EGGS.</em> HIDE UNDER BUSHES. <em>DO NOT GET EATEN.</em></div>
          <div class="aside">(Beware the scorpions…)</div>
          <div class="howto">
            <div class="how"><div class="pic">${dev(wasd, STICK, STICK)}</div><span>${dev('Run', 'Run', 'Drag your left thumb to run')}</span></div>
            <div class="how"><div class="pic">${dev('<kbd class="wide">SPACE</kbd>', padBtn('cross'), TDASH)}</div><span>Dash</span></div>
            <div class="how"><div class="pic">${dev('<kbd>E</kbd>', padBtn('tri'), '<kbd>TAP</kbd>')}<i class="how-egg"></i></div><span>Use a power egg</span></div>
            <div class="how"><div class="pic"><img class="how-tuft" src="${spr('tuft_1')}" alt=""></div><span>Hide in bushes and long grass</span></div>
            <div class="how"><div class="pic"><img class="how-loot" src="${spr('egg_2')}" alt=""><i class="how-arrow"></i><img class="how-burrow" src="${spr('burrow')}" alt=""></div><span>Bring eggs home to a burrow</span></div>
          </div>
          <div class="go">${dev('Press <kbd class="go-key">SPACE</kbd> or <kbd>ENTER</kbd>', `Press ${padBtn('cross')}`, 'Tap')} to scurry</div>
        </div>
        <div class="best">
          <small>Best run</small>
          <div class="b-stars"><i></i><i></i><i></i></div>
          <b class="b-time">0:00</b>
          <div class="b-line"></div>
        </div>
        <div class="t-foot">
          <div class="vpick"><small>Camera</small>${picks}</div>
          <div class="credit">A family game by Media Jousts. Drawn by hand; rebuilt for Easter.</div>
          <div class="t-keys">${dev('<kbd>M</kbd> sound <kbd>ESC</kbd> pause', `${padKey('OPTIONS', 'MENU')} pause`, '')}</div>
        </div>
        <div class="t-full touch-only full-only" data-a="full">Full screen</div>
      </div>
      <div class="screen pause">
        <div class="paper">
          <div class="sheet">
            <h2>Paused</h2>
            <div class="menu">
              <div class="btn" data-a="resume">Back to it ${dev('<kbd>ESC</kbd>', padKey('OPTIONS', 'MENU'), '')}</div>
              <div class="btn" data-a="restart">Start again ${dev('<kbd>R</kbd>', padKey('L1', 'LB'), '')}</div>
              <div class="btn touch-only" data-a="sound">Sound <b>on</b></div>
              <div class="btn touch-only full-only" data-a="full">Full screen</div>
            </div>
            <div class="controls">
              <div><span>Run</span>${dev('<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or arrows', `${STICK} the left stick`, `${STICK} drag your left thumb`)}</div>
              <div><span>Dash</span>${dev('<kbd>SPACE</kbd>', padBtn('cross'), `${TDASH} tap it`)}</div>
              <div><span>Power egg</span>${dev('<kbd>E</kbd>', padBtn('tri'), 'tap the egg when you hold one')}</div>
              <div><span>Go home</span>${dev('hold <kbd>SPACE</kbd> on the star burrow', `hold ${padBtn('cross')} on the star burrow`, `hold ${TDASH} on the star burrow`)}</div>
              <div><span>Look round</span>${dev('<kbd>Z</kbd><kbd>X</kbd>', 'the right stick', 'drag on the right of the screen')}</div>
              <div class="not-touch"><span>Camera</span>${dev('<kbd>C</kbd> or <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd>', `${padKey('CREATE', 'VIEW')} or click a stick`, '')}</div>
              <div class="not-touch"><span>Sound</span><kbd>M</kbd> on or off</div>
              <div class="not-touch"><span>Pause</span>${dev('<kbd>ESC</kbd> or <kbd>P</kbd>', `${padKey('OPTIONS', 'MENU')}<span class="ps-only"> or the touchpad</span>`, '')}</div>
            </div>
            <div class="vpick not-touch">${picks}</div>
            <div class="p-tip">Bushes and long grass hide you. A burrow keeps your eggs and mends your tail.</div>
          </div>
        </div>
      </div>
      <div class="screen results">
        <div class="paper">
          <div class="sheet">
            <div class="ribbon"><span>New best!</span></div>
            <div class="r-head"><h2>HOME SAFE</h2><i></i><div class="sub"></div></div>
            <div class="stars"><div class="star"></div><div class="star"></div><div class="star"></div></div>
            <div class="r-line"></div>
            <div class="tally">
              <div class="t-eggs"><b class="r-eggs">0</b><span>eggs home</span></div>
              <div class="t-time"><b class="r-time">0:00</b><span class="r-par">time</span></div>
              <div class="t-bugs"><b class="r-bugs">0</b><span>beetles</span></div>
              <div class="t-gold"><b><i class="g-egg"></i></b><span class="r-gold">golden egg</span></div>
              <div><b class="r-tails">0</b><span>tails lost</span></div>
              <div><b class="r-caught">0</b><span>times eaten</span></div>
            </div>
            <div class="m-block">
              <div class="m-head"><i></i><span>Medals <b class="m-count"></b></span><i></i></div>
              <div class="medals"></div>
              <div class="m-list"></div>
            </div>
            <div class="row"><div class="btn" data-a="again">Go again ${dev('<kbd>SPACE</kbd>', padBtn('cross'), '')}</div></div>
          </div>
          <div class="confetti"></div>
        </div>
      </div>`;
    this.play = el(this.root, '.hud');
    this.eggsEl = el(this.root, '.eggs'); this.eggsN = el(this.eggsEl, '.n'); this.eggsOf = el(this.eggsEl, '.of');
    this.carryEl = el(this.root, '.carry'); this.timerEl = el(this.root, '.timer');
    this.goldEl = el(this.root, '.eggrow .gold'); this.comboEl = el(this.root, '.combo'); this.comboText = el(this.comboEl, 'b');
    this.tailEl = el(this.root, '.pip.tail'); this.tailBar = el(this.root, '.pip.tail .bar b');
    this.dashEl = el(this.root, '.pip.dash'); this.dashBar = el(this.root, '.pip.dash .bar b');
    this.bugsEl = el(this.root, '.pip.bugs'); this.bugsN = el(this.bugsEl, '.n'); this.bugsOf = el(this.bugsEl, 'small');
    this.powerEl = el(this.root, '.power'); this.powerName = el(this.root, '.p-name'); this.powerDesc = el(this.root, '.p-desc');
    this.viewEls = [...this.root.querySelectorAll<HTMLElement>('.views span')];
    this.cardEls = [...this.root.querySelectorAll<HTMLElement>('.card')];
    this.zoneEl = el(this.root, '.zone'); this.hintEl = el(this.root, '.hint'); this.toastEl = el(this.root, '.toast'); this.hiddenEl = el(this.root, '.hidden-tag');
    this.stampEl = el(this.root, '.stamp'); this.stampTitle = el(this.stampEl, 'b'); this.stampSub = el(this.stampEl, 'small');
    this.promptEl = el(this.root, '.prompt'); this.promptBar = el(this.root, '.prompt b'); this.promptText = el(this.root, '.prompt span');
    this.marksEl = el(this.root, '.marks');
    this.stickEl = el(this.root, '.tstick'); this.dashBtn = el(this.root, '.t-dash'); this.soundEl = el(this.root, '.btn[data-a="sound"] b');
    this.map = el<HTMLCanvasElement>(this.root, '.minimap canvas'); this.mapCtx = this.map.getContext('2d')!;
    this.title = el(this.root, '.title'); this.pause = el(this.root, '.pause'); this.results = el(this.root, '.results');
    this.bestEl = el(this.root, '.best');

    this.cardEls.forEach((c) => c.addEventListener('click', (e) => { e.stopPropagation(); this.onPickView(Number(c.dataset.v)); }));
    el(this.root, '.go').addEventListener('click', () => this.onStart());
    this.root.querySelectorAll<HTMLElement>('[data-a]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      const a = b.dataset.a;
      if (a === 'resume') this.onResume(); else if (a === 'restart') this.onRestart(); else if (a === 'again') this.onAgain();
      else if (a === 'sound') this.onSound(); else if (a === 'full') this.onFullscreen();
    }));
    // The full-screen buttons are only there where the browser can do it (an iPhone's cannot: there the game is added to the home screen instead).
    this.root.classList.toggle('can-full', !!document.fullscreenEnabled);
    for (const name of OPTIONAL_ART) this.wantArt(name);
    this.usePad(false);
    this.useTouch(false);
  }

  /** Look for a picture that may not exist yet. When it loads, `--spr-<name>` and the class `has-<name>` appear on the root and the CSS stand-in gives way. */
  private wantArt(name: string) {
    const now = performance.now();
    let a = this.art.get(name);
    if (!a) this.art.set(name, (a = { state: 'missing', tried: -1e9, n: 0 }));
    if (a.state !== 'missing' || now - a.tried < 5000) return;
    const rec = a;
    rec.state = 'loading'; rec.tried = now;
    const url = new URL(`${this.base}sprites/${name}.png${rec.n ? `?r=${rec.n}` : ''}`, document.baseURI).href;
    rec.n++;
    const img = new Image();
    img.onload = () => { rec.state = 'ok'; this.root.style.setProperty(`--spr-${name}`, `url("${url}")`); this.root.classList.add(`has-${name}`); };
    img.onerror = () => { rec.state = 'missing'; };
    img.src = url;
  }

  showPlay(on: boolean) { this.play.classList.toggle('off', !on); }
  showTitle(on: boolean) { this.title.classList.toggle('on', on); }
  showPause(on: boolean) { this.pause.classList.toggle('on', on); }

  /** Show keyboard keys or pad buttons everywhere. An Xbox-style pad gets letters, anything else PlayStation shapes. */
  usePad(pad: boolean, kind: 'ps' | 'xbox' = 'ps') {
    const key = pad ? kind : false;
    if (key === this.lastPad) return;
    this.lastPad = key;
    this.root.classList.toggle('pad', pad);
    this.root.classList.toggle('xbox', pad && kind === 'xbox');
  }

  /** Show the touch controls (a thumb-stick, a dash button, the egg as a button) and word the advice for fingers. */
  useTouch(on: boolean) {
    if (on === this.lastTouch) return;
    this.lastTouch = on;
    this.root.classList.toggle('touch', on);
  }

  /** The thumb-stick: at rest it waits in its corner; under a thumb it sits where the thumb came down. dx, dy: the push, -1..1. */
  setStick(st: { on: boolean; x: number; y: number; r: number; dx: number; dy: number }) {
    const key = st.on ? `${st.x.toFixed(0)},${st.y.toFixed(0)},${st.r.toFixed(0)},${st.dx.toFixed(2)},${st.dy.toFixed(2)}` : `off,${st.r.toFixed(0)}`;
    if (key === this.lastStick) return;
    this.lastStick = key;
    const e = this.stickEl;
    e.classList.toggle('on', st.on);
    e.style.setProperty('--r', `${st.r.toFixed(0)}px`);
    e.style.transform = st.on ? `translate(${st.x.toFixed(0)}px, ${st.y.toFixed(0)}px)` : '';
    (e.firstElementChild as HTMLElement).style.transform = st.on ? `translate(${(st.dx * st.r).toFixed(1)}px, ${(st.dy * st.r).toFixed(1)}px)` : '';
  }

  /** What the sound button on the pause card says. */
  setSound(on: boolean) {
    if (on === this.lastSound) return;
    this.lastSound = on;
    this.soundEl.textContent = on ? 'on' : 'off';
  }

  setView(i: number) {
    this.viewEls.forEach((e, k) => e.classList.toggle('on', k === i));
    this.cardEls.forEach((e) => e.classList.toggle('on', Number(e.dataset.v) === i));
  }

  setEggs(banked: number, total: number, carried: number[]) {
    if (banked !== this.lastBanked || total !== this.lastTotal) {
      this.eggsN.textContent = String(banked);
      this.eggsOf.textContent = `/ ${total}`;
      this.eggsEl.classList.toggle('all', total > 0 && banked >= total);
      if (this.lastBanked >= 0 && banked > this.lastBanked) replay(this.eggsEl, 'bump');
      this.lastBanked = banked; this.lastTotal = total;
    }
    const key = carried.join('');
    if (key !== this.lastCarry) {
      // Only new eggs pop in: keep the ones already shown.
      const have = this.carryEl.querySelectorAll('img').length;
      if (carried.length < have || !key.startsWith(this.lastCarry)) this.carryEl.innerHTML = '';
      const from = this.carryEl.querySelectorAll('img').length;
      this.carryEl.querySelector('span')?.remove();
      for (let i = from; i < carried.length; i++) {
        const img = document.createElement('img');
        img.src = `${this.base}sprites/egg_${carried[i]}.png`;
        img.style.setProperty('--r', `${((i * 37) % 23) - 11}deg`);
        this.carryEl.appendChild(img);
      }
      if (carried.length) { const s = document.createElement('span'); s.textContent = 'carrying'; this.carryEl.appendChild(s); }
      this.lastCarry = key;
    }
  }

  setTimer(seconds: number) {
    const s = Math.floor(seconds);
    if (s === this.lastTime) return;
    this.lastTime = s;
    this.timerEl.textContent = fmtTime(s);
  }

  setPips(tail: number, hasTail: boolean, dash: number) {
    const t = Math.round((hasTail ? tail : Math.max(0.04, tail)) * 100), tl = !hasTail || tail < 0.95;
    if (t !== this.lastTail) { this.lastTail = t; this.tailBar.style.transform = `scaleX(${t / 100})`; }
    if (tl !== this.lastTailLow) { this.lastTailLow = tl; this.tailEl.classList.toggle('low', tl); }
    const d = Math.round(Math.min(1, Math.max(0, dash)) * 100), dl = dash < 1;
    if (d !== this.lastDash) { this.lastDash = d; this.dashBar.style.transform = `scaleX(${d / 100})`; this.dashBtn.style.setProperty('--d', (d / 100).toFixed(2)); }
    if (dl !== this.lastDashLow) {
      if (this.lastDashLow === true && !dl) { replay(this.dashEl, 'ready'); replay(this.dashBtn, 'ready'); }
      this.lastDashLow = dl; this.dashEl.classList.toggle('low', dl); this.dashBtn.classList.toggle('low', dl);
    }
  }

  setHidden(on: boolean) {
    if (on === this.lastHidden) return;
    this.lastHidden = on;
    this.hiddenEl.classList.toggle('on', on);
  }

  /** The power egg slot. null = empty. active: 0 when held and ready to use; while a timed power is running, the share of its time left (1 → 0). */
  setPower(p: { kind: PowerKind; active: number } | null) {
    const kind = p ? p.kind : null;
    const active = p ? Math.round(Math.min(1, Math.max(0, p.active)) * 200) : 0;
    if (kind === this.lastPowerKind && active === this.lastPowerActive) return;
    const e = this.powerEl;
    if (kind !== this.lastPowerKind) {
      const had = this.lastPowerKind;
      this.lastPowerKind = kind;
      e.classList.toggle('empty', !kind);
      if (kind) {
        this.wantArt(`egg_${kind}`);
        e.dataset.kind = kind;
        this.powerName.textContent = POWERS[kind].name;
        this.powerDesc.textContent = POWERS[kind].desc;
        e.classList.remove('spent');
        replay(e, 'pop');
      } else if (had) { e.classList.remove('pop'); replay(e, 'spent'); }   // data-kind stays so the egg can fade out in its own colours
    }
    if (active !== this.lastPowerActive) {
      const was = this.lastPowerActive;
      this.lastPowerActive = active;
      e.style.setProperty('--p', (active / 200).toFixed(3));
      e.classList.toggle('active', active > 0);
      if (active > 0 && was <= 0) replay(e, 'fire');
      const urgent = active > 0 && active < 50;
      if (urgent !== this.lastUrgent) { this.lastUrgent = urgent; e.classList.toggle('urgent', urgent); }
    }
  }

  /** Beetles eaten so far. The chip stays away while the level has none. */
  setBeetles(n: number, total: number) {
    if (n === this.lastBugs && total === this.lastBugsTotal) return;
    this.wantArt('beetle');
    this.bugsN.textContent = String(n);
    this.bugsOf.textContent = `/ ${total}`;
    this.bugsEl.classList.toggle('on', total > 0);
    this.bugsEl.classList.toggle('all', total > 0 && n >= total);
    if (this.lastBugs >= 0 && n > this.lastBugs) replay(this.bugsEl, 'bump');
    this.lastBugs = n; this.lastBugsTotal = total;
  }

  /** The hidden golden egg: shown as a faint empty outline until found. */
  setGold(found: boolean) {
    if (found === this.lastGold) return;
    const first = this.lastGold === null;
    this.lastGold = found;
    this.wantArt('egg_gold');
    this.goldEl.classList.toggle('found', found);
    this.goldEl.classList.remove('pop');
    if (found && !first) replay(this.goldEl, 'pop');
  }

  /** A steal streak: n = 2, 3, 4... pops a "×n" by the egg counter; n < 2 hides it. */
  combo(n: number) {
    n = Math.floor(n);
    if (n < 2) { if (this.lastCombo >= 2) this.comboEl.classList.remove('on', 'pop'); this.lastCombo = 0; return; }
    if (n === this.lastCombo) return;
    this.lastCombo = n;
    this.comboText.textContent = `×${n}`;
    this.comboEl.classList.toggle('long', n >= 10);
    this.comboEl.dataset.heat = String(Math.min(5, n));
    this.comboEl.classList.add('on');
    replay(this.comboEl, 'pop');
  }

  /** A big rubber-stamp style moment in the middle-top of the screen (zone cleared, golden egg, near miss...). kind picks the colour. Stamps that come together take turns. */
  stamp(title: string, sub = '', kind: 'good' | 'gold' | 'danger' = 'good') {
    this.stampQueue.push({ title, sub, kind });
    if (this.stampQueue.length > 3) this.stampQueue.shift();
    // Let one that is already up finish sooner.
    if (this.stampTimer > 0) this.stampTimer = Math.min(this.stampTimer, Math.max(0.4, this.stampTimer - 1.2));
    else this.nextStamp();
  }

  private nextStamp() {
    const s = this.stampQueue.shift();
    if (!s) { this.stampEl.classList.remove('show', 'out'); return; }
    this.stampTitle.textContent = s.title;
    this.stampSub.textContent = s.sub;
    this.stampSub.style.display = s.sub ? '' : 'none';
    this.stampEl.dataset.kind = s.kind;
    this.stampEl.classList.remove('out');
    replay(this.stampEl, 'show');
    this.zoneEl.classList.remove('show');
    this.stampTimer = 2.6;
  }

  zone(name: string) {
    el(this.zoneEl, 'b').textContent = name;
    replay(this.zoneEl, 'show');
  }

  toast(text: string) {
    this.toastEl.textContent = text;
    replay(this.toastEl, 'show');
  }

  /** Queue a line of advice (HTML allowed for <kbd>; the keys E, SPACE and WASD show as pad buttons when a pad is in
   *  use, and as the touch buttons on a touch screen). `touch`: other words altogether for a touch screen. */
  hint(html: string, touch?: string) {
    this.hintQueue.push(touch === undefined ? padify(html) : `<span class="not-touch">${padify(html)}</span><span class="for-touch">${touch}</span>`);
  }

  /** Hold-to-leave prompt at a spot on the screen; progress 0..1; null hides it. */
  prompt(text: string | null, sx = 0, sy = 0, progress = 0) {
    if (text === null) {
      if (this.lastPrompt !== null) { this.lastPrompt = null; this.promptEl.classList.remove('on'); }
      return;
    }
    if (text !== this.lastPrompt) {
      if (this.lastPrompt === null) this.promptEl.classList.add('on');
      this.lastPrompt = text;
      this.promptText.innerHTML = keyify(text);
    }
    const pos = `translate(${(sx * innerWidth).toFixed(0)}px, ${(sy * innerHeight).toFixed(0)}px)`;
    if (pos !== this.lastPromptPos) { this.lastPromptPos = pos; this.promptEl.style.transform = pos; }
    const bar = Math.round(Math.min(1, Math.max(0, progress)) * 100);
    if (bar !== this.lastPromptBar) { this.lastPromptBar = bar; this.promptBar.style.transform = `scaleX(${bar / 100})`; }
  }

  beginMarks() { this.markUsed = 0; }
  /** A "!" or "?" at a screen spot, or an arrow at the edge pointing at something off-screen that is after you. */
  mark(kind: '!' | '?' | '>', sx: number, sy: number, angle = 0) {
    let m = this.markPool[this.markUsed];
    if (!m) { m = document.createElement('div'); this.marksEl.appendChild(m); this.markPool.push(m); }
    this.markUsed++;
    const cls = kind === '>' ? 'arrow' : kind === '!' ? 'mark bang' : 'mark ask';
    if (m.className !== cls) { m.className = cls; m.textContent = kind === '>' ? '' : kind; }
    if (m.style.display) m.style.display = '';
    m.style.transform = `translate(${(sx * innerWidth).toFixed(1)}px, ${(sy * innerHeight).toFixed(1)}px)${kind === '>' ? ` rotate(${angle.toFixed(2)}rad)` : ''}`;
  }
  endMarks() { for (let i = this.markUsed; i < this.markPool.length; i++) if (!this.markPool[i].style.display) this.markPool[i].style.display = 'none'; }

  update(dt: number) {
    this.hintTimer -= dt;
    if (this.hintTimer <= 0) {
      const next = this.hintQueue.shift();
      if (next) { this.hintEl.innerHTML = next; this.hintEl.classList.add('on'); this.hintTimer = 5.5; }
      else this.hintEl.classList.remove('on');
    } else if (this.hintTimer < 0.5 && !this.hintQueue.length) this.hintEl.classList.remove('on');

    if (this.stampTimer > 0) {
      this.stampTimer -= dt;
      if (this.stampTimer <= 0.4) this.stampEl.classList.add('out');
      if (this.stampTimer <= 0) this.nextStamp();
    }
  }

  /** The small map: only what the lizard has been near is drawn in. */
  drawMap(level: Level, explored: Uint8Array, lx: number, lz: number, heading: number, nests: { x: number; z: number; has: boolean }[], threats: { x: number; z: number; hot: boolean }[], checkpoint: number) {
    const S = 4, W = level.w, H = level.h;
    if (!this.mapBase) {
      this.map.width = W * S; this.map.height = H * S;
      const base = (this.mapBase = document.createElement('canvas'));
      base.width = W * S; base.height = H * S;
      const b = base.getContext('2d')!;
      for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
        const i = r * W + c;
        b.fillStyle = level.solid[i] ? '#4a3f17' : level.sand[i] ? '#e9cf86' : '#8a7c3e';
        b.fillRect(c * S, r * S, S, S);
        if (level.cover[i]) { b.fillStyle = '#d9822a'; b.fillRect(c * S + 1, r * S + 1, S - 2, S - 2); }
      }
    }
    const g = this.mapCtx;
    g.drawImage(this.mapBase, 0, 0);
    g.fillStyle = 'rgba(31,25,5,0.93)';
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (!explored[r * W + c]) g.fillRect(c * S, r * S, S, S);
    const seen = (x: number, z: number) => explored[Math.floor(z) * W + Math.floor(x)] === 1;
    for (const n of nests) if (seen(n.x, n.z)) { g.fillStyle = n.has ? '#fff3c8' : 'rgba(255,243,200,0.25)'; g.beginPath(); g.arc(n.x * S, n.z * S, n.has ? 2.6 : 1.6, 0, 7); g.fill(); }
    level.burrows.forEach((bw, i) => {
      if (!seen(bw.x, bw.z) && bw.kind !== 'exit') return;
      g.fillStyle = bw.kind === 'exit' ? '#ffc62e' : '#1f1905';
      g.strokeStyle = i === checkpoint ? '#ffc62e' : '#fde27f'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(bw.x * S, bw.z * S, 3.4, 0, 7); g.fill(); g.stroke();
    });
    for (const t of threats) if (seen(t.x, t.z)) { g.fillStyle = t.hot ? '#ff3b1f' : '#b5442a'; g.fillRect(t.x * S - 2, t.z * S - 2, 4, 4); }
    g.save();
    g.translate(lx * S, lz * S); g.rotate(heading);
    g.fillStyle = '#ffd21f'; g.strokeStyle = '#1f1905'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(0, -5.5); g.lineTo(3.6, 4); g.lineTo(0, 2); g.lineTo(-3.6, 4); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }

  /** The best finished run so far, for the title screen (null = none yet). */
  setBest(best: BestRun | null) {
    this.bestEl.classList.toggle('on', best !== null);
    if (!best) return;
    this.bestEl.querySelectorAll<HTMLElement>('.b-stars i').forEach((s, i) => s.classList.toggle('won', i < best.stars));
    el(this.bestEl, '.b-time').textContent = fmtTime(best.time);
    const medals = best.medals > 0 ? `<span>${best.medals} medal${best.medals === 1 ? '' : 's'}</span>` : '';
    el(this.bestEl, '.b-line').innerHTML = `<span>${best.eggs}/${best.total} eggs</span>${medals}`;
  }

  /** The end-of-level card: stars pop one by one, then the earned medals (onStar and onMedal fire as each lands). null takes it away. */
  showResults(r: Results | null) {
    for (const t of this.resultTimers) clearTimeout(t);
    this.resultTimers = [];
    const R = this.results;
    R.classList.toggle('on', r !== null);
    if (!r) return;
    for (const name of ['medals', 'egg_gold', 'beetle']) this.wantArt(name);
    const later = (seconds: number, fn: () => void) => { this.resultTimers.push(window.setTimeout(fn, seconds * 1000)); };
    const all = r.total > 0 && r.eggs >= r.total;
    el(R, '.sub').textContent = r.title;
    el(R, '.r-line').textContent = all ? 'Every last egg!' : r.stars >= 2 ? 'A fine haul.' : r.eggs > 0 ? 'Slim pickings. Go back for more?' : 'Not one egg. The nests are laughing.';
    el(R, '.r-eggs').textContent = `${r.eggs}/${r.total}`;
    el(R, '.t-eggs').classList.toggle('good', all);
    el(R, '.r-tails').textContent = String(r.tails);
    el(R, '.r-caught').textContent = String(r.caught);

    // The time, against par when there is one.
    el(R, '.r-time').textContent = fmtTime(r.seconds);
    const parEl = el(R, '.r-par'), timeEl = el(R, '.t-time');
    const hasPar = r.par !== undefined && r.par > 0;
    const under = hasPar && Math.floor(r.seconds) <= r.par!;
    timeEl.classList.toggle('good', under);
    timeEl.classList.toggle('over', hasPar && !under);
    if (hasPar) {
      const d = Math.abs(Math.floor(r.seconds) - Math.floor(r.par!));
      parEl.innerHTML = `<i>${under ? TICK : ''}${under ? '−' : '+'}${fmtTime(d)}</i> par ${fmtTime(r.par!)}`;
    } else parEl.textContent = 'time';

    const bugs = el(R, '.t-bugs'), gold = el(R, '.t-gold');
    const hasBugs = r.beetles !== undefined;
    bugs.style.display = hasBugs ? '' : 'none';
    if (hasBugs) {
      el(R, '.r-bugs').textContent = r.beetlesTotal !== undefined ? `${r.beetles}/${r.beetlesTotal}` : String(r.beetles);
      bugs.classList.toggle('good', r.beetlesTotal !== undefined && r.beetlesTotal > 0 && r.beetles! >= r.beetlesTotal);
    }
    gold.style.display = r.gold !== undefined ? '' : 'none';
    gold.classList.toggle('good', !!r.gold);
    el(R, '.r-gold').textContent = r.gold ? 'golden egg!' : 'no golden egg';

    R.classList.remove('newbest');
    if (r.newBest) { void R.offsetWidth; R.classList.add('newbest'); }

    const stars = Math.max(0, Math.min(3, Math.round(r.stars)));
    R.querySelectorAll<HTMLElement>('.star').forEach((s, i) => {
      s.classList.remove('won');
      const at = 0.9 + i * 0.35;
      s.style.animationDelay = `${at}s`;
      if (i < stars) { void s.offsetWidth; s.classList.add('won'); later(at, () => this.onStar?.(i)); }
    });

    // Cut-paper confetti for a perfect run or a new best, thrown as the last star (or the ribbon) lands.
    const party = stars >= 3 || !!r.newBest, partyAt = stars >= 3 ? 0.9 + 2 * 0.35 + 0.1 : 2.1;
    const COLOURS = ['#f79a2e', '#e0600c', '#fff3c8', '#7a7430', '#e2401c', '#ffc62e', '#2aa39a'];
    el(R, '.confetti').innerHTML = !party ? '' : Array.from({ length: 34 }, (_, i) => {
      const a = (i / 34) * Math.PI * 2 + Math.random() * 0.4, far = 9 + Math.random() * 13;
      return `<i style="--x:${(Math.cos(a) * far * 1.5).toFixed(1)}em;--y:${(-Math.abs(Math.sin(a)) * far - 3).toFixed(1)}em;--r:${Math.round(Math.random() * 900 - 450)}deg;--c:${COLOURS[i % COLOURS.length]};--d:${(partyAt + Math.random() * 0.25).toFixed(2)}s"></i>`;
    }).join('');

    // Medals: every one has a place on the card; the earned ones spin in after the stars, the rest stay as shadows.
    const list = r.medals ?? [];
    const block = el(R, '.m-block');
    block.style.display = list.length ? '' : 'none';
    const row = el(R, '.medals');
    row.innerHTML = list.map(() => '<div class="medal" tabindex="0"><i class="disc"></i><span class="m-name"></span><div class="tip"><b></b><span></span></div></div>').join('');
    let nth = 0;
    const start = 1.1 + stars * 0.35 + 0.45;
    [...row.children].forEach((c, i) => {
      const cell = c as HTMLElement, m = list[i];
      cell.dataset.id = m.id;
      cell.style.setProperty('--i', String(Math.max(0, MEDAL_CELLS.indexOf(m.id))));
      cell.style.setProperty('--tilt', `${((i * 53) % 13) - 6}deg`);
      el(cell, '.disc').dataset.e = MEDAL_EMOJI[m.id] ?? '';
      el(cell, '.m-name').textContent = m.name;
      el(cell, '.tip b').textContent = m.name;
      el(cell, '.tip span').textContent = m.desc;
      cell.setAttribute('aria-label', `${m.name}: ${m.desc}${m.got ? ' (earned)' : ''}`);
      cell.classList.add(m.got ? 'got' : 'not');
      if (m.got) {
        const when = start + nth * 0.32, k = nth++;
        cell.style.setProperty('--at', `${when}s`);
        later(when, () => this.onMedal?.(i, k));
      }
    });
    const got = list.filter((m) => m.got).length;
    el(R, '.m-count').textContent = `${got}/${list.length}`;
    const todo = list.filter((m) => !m.got);
    const listEl = el(R, '.m-list');
    listEl.classList.toggle('done', list.length > 0 && !todo.length);
    listEl.innerHTML = todo.length
      ? todo.map((m) => `<div><b>${esc(m.name)}</b> ${esc(m.desc)}</div>`).join('')
      : list.length ? '<div>Every medal there is. A perfect heist!</div>' : '';
    listEl.style.setProperty('--at', `${start + got * 0.32 + 0.2}s`);
    R.style.setProperty('--btn-at', `${list.length ? start + got * 0.32 + 0.3 : 0.9 + stars * 0.35 + 0.4}s`);
  }
}
