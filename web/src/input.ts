// Keyboard, gamepad (a PS5 DualSense, a DualShock, an Xbox pad or any standard one) and touch. The game asks for a
// move direction and a few buttons.
//
// Touch (a phone or a tablet): a thumb put down on the left of the picture becomes a stick, there and then, wherever
// it lands. The right thumb has buttons the HUD draws (any element with data-touch="dash", "power" or "pause"), and
// dragging anywhere else on the right swings the view round.

const MOVE_KEYS: Record<string, [number, number]> = {
  KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0],
};

/** Where each control sits in a pad's lists of buttons and axes. */
interface Layout {
  cross: number; circle: number; square: number; triangle: number;
  l1: number; r1: number; l2: number; r2: number; select: number; start: number; l3: number; r3: number;
  /** The touchpad's click, on a PlayStation pad. */
  touch?: number;
  /** The arrows as four buttons... */
  up?: number; down?: number; left?: number; right?: number;
  /** ...or as two axes, or as one "hat" axis that names eight directions. */
  hatX?: number; hatY?: number; hat?: number;
  /** The right stick, side to side. */
  rx: number;
}
/** What every browser gives for a pad it knows (Chrome, Firefox and Safari all know the DualSense). */
const STANDARD: Layout = { cross: 0, circle: 1, square: 2, triangle: 3, l1: 4, r1: 5, l2: 6, r2: 7, select: 8, start: 9, l3: 10, r3: 11, up: 12, down: 13, left: 14, right: 15, touch: 17, rx: 2 };
/** A Sony pad the browser has not mapped. Linux hands over the kernel's order of buttons... */
const SONY_LINUX: Layout = { cross: 0, circle: 1, triangle: 2, square: 3, l1: 4, r1: 5, l2: 6, r2: 7, select: 8, start: 9, l3: 11, r3: 12, rx: 3, hatX: 6, hatY: 7 };
/** ...and Windows and macOS the pad's own. */
const SONY_RAW: Layout = { square: 0, cross: 1, circle: 2, triangle: 3, l1: 4, r1: 5, l2: 6, r2: 7, select: 8, start: 9, l3: 10, r3: 11, touch: 13, rx: 2, hat: 9 };

const isSony = (id: string) => /054c|dualsense|dualshock|playstation|sony|ps[345] controller|^wireless controller/i.test(id);
/** A DualSense on Linux also shows up as its own motion sensor and its touchpad: neither is a thing to play with. */
const playable = (g: Gamepad | null): g is Gamepad => !!g && g.connected && g.buttons.length >= 10 && g.axes.length >= 2 && !/motion|sensor|touchpad/i.test(g.id);
function layoutOf(g: Gamepad): Layout {
  if (g.mapping === 'standard' || !isSony(g.id)) return STANDARD;
  return /linux|android|cros/i.test(navigator.userAgent) ? SONY_LINUX : SONY_RAW;
}

/** 'ps' gets shapes on its buttons, 'xbox' letters. */
export type PadKind = 'ps' | 'xbox';

/** A finger on the glass, and what it is doing there. */
interface Finger {
  role: 'stick' | 'look' | 'button' | 'other';
  x: number; y: number; x0: number; y0: number; t0: number;
  /** It has slid too far to be a tap. */
  moved: boolean;
  /** A button: which one, and its element (lit while the finger is on it). */
  name?: string; el?: HTMLElement;
}
const touchy = (e: PointerEvent) => e.pointerType === 'touch' || e.pointerType === 'pen';
/** Things on the page that have their own idea of what a tap means. */
const TAPPABLE = '[data-touch], [data-a], .btn, .card, .medal, a, button';

export class Input {
  moveX = 0;
  moveZ = 0;
  /** Buttons that went down this frame. */
  dash = false; confirm = false; back = false; pause = false; camNext = false; restart = false; mute = false; any = false;
  /** Use the power egg. */
  power = false;
  camPick = 0;
  zoom = 0;
  /** Swing the low camera round by hand: -1 left .. 1 right. */
  turn = 0;
  dashHeld = false;
  usingPad = false;
  /** The game is being played by touch: the HUD shows its stick and buttons, and the hints talk of tapping. */
  usingTouch = false;
  /** A tap on the picture or on an empty part of a screen (the title starts on one). */
  tap = false;
  /** How far a finger dragged the view round this frame, in radians (+ is to the right). */
  look = 0;
  /** The thumb-stick, for the HUD to draw: where its base is on the page, how big, and where the thumb has pushed it (-1..1). */
  readonly stick = { on: false, x: 0, y: 0, r: 60, dx: 0, dy: 0 };
  /** Called inside every key press, click and touch, while the browser still counts it as the player's own doing: sound may only be started from there. */
  onGesture: () => void = () => {};
  /** Whose buttons to draw in the hints. An unknown pad is shown as a PlayStation one. */
  padKind: PadKind = 'ps';
  /** A test or the attract mode can steer: when set, it replaces the player's hands. */
  bot: { x: number; z: number; dash: boolean; power?: boolean } | null = null;

  private keys = new Set<string>();
  private pressed = new Set<string>();
  private padWas: boolean[] = [];
  /** The pad in use: with two plugged in, whichever was touched last. */
  private padIndex = -1;
  private wheel = 0;
  private fingers = new Map<number, Finger>();
  /** Touch buttons with a finger on them (a count each: two fingers can be on one). */
  private held = new Map<string, number>();
  private lookSum = 0;
  private lastPointer = 'mouse';

  constructor() {
    // A phone or a tablet shows its touch controls from the start, before the first touch.
    this.usingTouch = navigator.maxTouchPoints > 0 && !!window.matchMedia?.('(pointer: coarse)').matches;
    window.addEventListener('keydown', (e) => {
      this.onGesture();
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      this.usingPad = false; this.usingTouch = false;
      if (e.code in MOVE_KEYS || e.code === 'Space' || e.code === 'Tab') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.letGo(); });
    window.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); }, { passive: true });
    window.addEventListener('pointerdown', (e) => {
      this.onGesture();
      this.pressed.add('Pointer');
      this.lastPointer = e.pointerType;
      // (A mouse may press the touch buttons too, when they are showing: a laptop with a touch screen has both.)
      if (touchy(e) || (e.target instanceof Element && e.target.closest('[data-touch]'))) this.fingerDown(e);
    });
    window.addEventListener('pointermove', (e) => {
      const f = this.fingers.get(e.pointerId);
      if (!f) return;
      if (f.role === 'look') this.lookSum += (e.clientX - f.x) * 3.4 / Math.max(480, window.innerWidth);
      f.x = e.clientX; f.y = e.clientY;
      if (Math.hypot(f.x - f.x0, f.y - f.y0) > 12) f.moved = true;
    });
    const up = (e: PointerEvent) => { if (e.type === 'pointerup') this.onGesture(); this.fingerUp(e.pointerId, e.type === 'pointerup'); };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    // iOS only lets sound start from the end of a touch, or from the click that follows it.
    window.addEventListener('touchend', () => this.onGesture(), { passive: true });
    window.addEventListener('click', () => this.onGesture());
    // A long press is not a right click: on a phone it would use up the power egg under a resting thumb.
    window.addEventListener('contextmenu', (e) => { e.preventDefault(); if (this.lastPointer === 'mouse') this.pressed.add('PointerRight'); });
    // The page is the game: a finger must never scroll it, zoom it, or pull it down to reload. (A touch that starts
    // on a paper button is let through, or the browser would not turn it into a click.)
    const inGame = (t: EventTarget | null) => t instanceof Element && (t.tagName === 'CANVAS' || !!t.closest('[data-touch]'));
    document.addEventListener('touchstart', (e) => { if (inGame(e.target) && e.cancelable) e.preventDefault(); }, { passive: false });
    document.addEventListener('touchmove', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
    for (const type of ['gesturestart', 'gesturechange', 'dblclick']) document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
    // A pad wakes up (the browser shows it on its first button press): the hints change to its buttons straight away.
    window.addEventListener('gamepadconnected', (e) => { if (playable(e.gamepad)) { this.padIndex = e.gamepad.index; this.usingPad = true; this.usingTouch = false; } });
    window.addEventListener('gamepaddisconnected', (e) => { if (e.gamepad.index === this.padIndex) { this.padIndex = -1; this.padWas = []; this.usingPad = false; } });
  }

  /** How far the thumb pushes the stick to run flat out, in page pixels: a comfortable roll of the thumb on a phone, no bigger on a tablet. */
  private stickSize() { return Math.min(84, Math.max(46, Math.min(window.innerWidth, window.innerHeight) * 0.14)); }

  private fingerDown(e: PointerEvent) {
    this.usingTouch = true; this.usingPad = false;
    const t = e.target instanceof Element ? e.target : null;
    const f: Finger = { role: 'other', x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now(), moved: false };
    const btn = t?.closest<HTMLElement>('[data-touch]');
    if (btn) {
      f.role = 'button'; f.name = btn.dataset.touch!; f.el = btn;
      this.pressed.add('Touch:' + f.name);
      this.held.set(f.name, (this.held.get(f.name) ?? 0) + 1);
      btn.classList.add('down');
    } else if (t?.tagName === 'CANVAS') {
      // The left of the picture is the stick's; the rest swings the view. One thumb each.
      const roles = [...this.fingers.values()].map((o) => o.role);
      if (e.clientX < window.innerWidth * 0.46 && !roles.includes('stick')) {
        f.role = 'stick';
        Object.assign(this.stick, { on: true, x: e.clientX, y: e.clientY, r: this.stickSize(), dx: 0, dy: 0 });
      } else if (!roles.includes('look')) f.role = 'look';
    } else if (t?.closest(TAPPABLE)) f.moved = true; // a paper button: its own click deals with it
    this.fingers.set(e.pointerId, f);
  }

  private fingerUp(id: number, lifted: boolean) {
    const f = this.fingers.get(id);
    if (!f) return;
    this.fingers.delete(id);
    if (f.role === 'stick') this.stick.on = false;
    if (f.role === 'button') {
      const n = (this.held.get(f.name!) ?? 1) - 1;
      if (n > 0) this.held.set(f.name!, n); else { this.held.delete(f.name!); f.el?.classList.remove('down'); }
    } else if (lifted && !f.moved && performance.now() - f.t0 < 600) this.pressed.add('Tap');
  }

  /** Every finger off (the page lost the screen: the browser may never say they lifted). */
  letGo() { for (const id of [...this.fingers.keys()]) this.fingerUp(id, false); this.lookSum = 0; }

  /** The pad to listen to: the one touched last, else one the browser has mapped, else any. */
  private pad(): Gamepad | null {
    const pads = [...(navigator.getGamepads?.() ?? [])].filter(playable);
    if (!pads.length) return null;
    const busy = (g: Gamepad) => g.buttons.some((b) => b.pressed) || Math.hypot(g.axes[0] ?? 0, g.axes[1] ?? 0) > 0.5;
    const cur = pads.find((g) => g.index === this.padIndex);
    const other = pads.find((g) => g !== cur && busy(g));
    const pad = (cur && busy(cur) ? cur : other) ?? cur ?? pads.find((g) => g.mapping === 'standard') ?? pads[0];
    if (pad.index !== this.padIndex) { this.padIndex = pad.index; this.padWas = []; }
    this.padKind = /xbox|xinput|045e|microsoft/i.test(pad.id) && !isSony(pad.id) ? 'xbox' : 'ps';
    return pad;
  }

  /** Read everything once a frame. */
  poll() {
    let x = 0, z = 0;
    for (const code in MOVE_KEYS) if (this.keys.has(code)) { x += MOVE_KEYS[code][0]; z += MOVE_KEYS[code][1]; }
    const p = this.pressed;
    this.dash = p.has('Space') || p.has('ShiftLeft') || p.has('ShiftRight') || p.has('Touch:dash');
    this.dashHeld = this.keys.has('Space') || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.held.has('dash');
    this.confirm = p.has('Enter') || p.has('Space');
    this.back = p.has('Escape');
    this.pause = p.has('Escape') || p.has('KeyP') || p.has('Touch:pause');
    this.camNext = p.has('KeyC');
    this.power = p.has('KeyE') || p.has('KeyF') || p.has('PointerRight') || p.has('Touch:power');
    this.tap = p.has('Tap');
    this.look = this.lookSum; this.lookSum = 0;
    this.turn = (this.keys.has('KeyX') || this.keys.has('Period') ? 1 : 0) - (this.keys.has('KeyZ') || this.keys.has('Comma') ? 1 : 0);
    this.restart = p.has('KeyR');
    this.mute = p.has('KeyM');
    this.camPick = p.has('Digit1') ? 1 : p.has('Digit2') ? 2 : p.has('Digit3') ? 3 : 0;
    this.zoom = this.wheel + (p.has('BracketRight') ? -1 : 0) + (p.has('BracketLeft') ? 1 : 0);
    this.any = p.size > 0;
    this.wheel = 0;

    // The thumb-stick. Pushed past its rim, the base is towed along behind the thumb, so turning back is always a
    // short move and never a long reach.
    const st = this.stick;
    if (st.on) {
      const f = [...this.fingers.values()].find((o) => o.role === 'stick');
      if (!f) st.on = false;
      else {
        let dx = f.x - st.x, dy = f.y - st.y;
        const d = Math.hypot(dx, dy);
        if (d > st.r) { const k = 1 - st.r / d; st.x += dx * k; st.y += dy * k; dx -= dx * k; dy -= dy * k; }
        st.dx = dx / st.r; st.dy = dy / st.r;
        const n = Math.min(1, d / st.r);
        if (n > 0.16) { const k = Math.min(1, (n - 0.16) / 0.56) / n; x = st.dx * k; z = st.dy * k; } // flat out a little before the rim
      }
    }
    if (!st.on) st.dx = st.dy = 0;

    const pad = this.pad();
    if (pad) {
      const L = layoutOf(pad);
      // The left stick: one round dead zone, so a worn stick doesn't creep and a diagonal stays a diagonal.
      let px = pad.axes[0] ?? 0, pz = pad.axes[1] ?? 0;
      const tilt = Math.hypot(px, pz);
      if (tilt < 0.18) px = pz = 0;
      else { const k = Math.min(1, (tilt - 0.18) / 0.78) / tilt; px *= k; pz *= k; }
      const down = (i: number | undefined) => { const b = i === undefined ? undefined : pad.buttons[i]; return !!b && (b.pressed || b.value > 0.5); };
      const hit = (i: number | undefined) => i !== undefined && down(i) && !this.padWas[i];
      // The arrows, however this pad reports them.
      let ax = (down(L.right) ? 1 : 0) - (down(L.left) ? 1 : 0), az = (down(L.down) ? 1 : 0) - (down(L.up) ? 1 : 0);
      if (L.hatX !== undefined) { ax ||= Math.round(pad.axes[L.hatX] ?? 0); az ||= Math.round(pad.axes[L.hatY ?? -1] ?? 0); }
      if (L.hat !== undefined) {
        const h = Math.round(((pad.axes[L.hat] ?? 9) + 1) * 3.5); // 0 up, then clockwise by eighths; anything else is "let go"
        if (h >= 0 && h <= 7) { ax = h >= 1 && h <= 3 ? 1 : h >= 5 ? -1 : 0; az = h === 0 || h === 1 || h === 7 ? -1 : h >= 3 && h <= 5 ? 1 : 0; }
      }
      if (ax || az) { px = ax; pz = az; }
      if (px || pz) { x = px; z = pz; this.usingPad = true; this.usingTouch = false; }
      if (hit(L.cross) || hit(L.square) || hit(L.r2)) this.dash = true;
      if (down(L.cross) || down(L.square) || down(L.r2)) this.dashHeld = true;
      if (hit(L.triangle) || hit(L.circle) || hit(L.r1) || hit(L.l2)) this.power = true;
      const rx = pad.axes[L.rx] ?? 0;
      if (Math.abs(rx) > 0.2) { this.turn = (rx - Math.sign(rx) * 0.2) / 0.8; this.usingPad = true; this.usingTouch = false; }
      if (hit(L.cross)) this.confirm = true;
      if (hit(L.circle)) this.back = true;
      if (hit(L.start) || hit(L.touch)) this.pause = true;
      if (hit(L.select) || hit(L.l3) || hit(L.r3)) this.camNext = true;
      if (hit(L.l1)) this.restart = true; // only means anything on the pause card
      for (let i = 0; i < pad.buttons.length; i++) { if (hit(i)) { this.any = true; this.usingPad = true; this.usingTouch = false; } this.padWas[i] = down(i); }
    }
    if (this.bot) { x = this.bot.x; z = this.bot.z; this.dash = this.bot.dash; this.dashHeld = this.bot.dash; this.bot.dash = false; if (this.bot.power) { this.power = true; this.bot.power = false; } }
    const len = Math.hypot(x, z);
    if (len > 1) { x /= len; z /= len; }
    this.moveX = x; this.moveZ = z;
    this.pressed.clear();
  }

  /** Shake the pad in use (a DualSense does, in Chrome and Edge; where the browser can't, nothing happens). A phone
   *  played by touch buzzes instead, where it can (Android; an iPhone's browser has no way to). */
  rumble(strong: number, ms: number) {
    if (this.usingTouch) { try { navigator.vibrate?.(Math.round(ms * (0.25 + strong * 0.35))); } catch { /* not allowed here */ } return; }
    if (!this.usingPad) return;
    const pad = [...(navigator.getGamepads?.() ?? [])].find((g) => g?.index === this.padIndex) as unknown as {
      vibrationActuator?: { playEffect?: (t: string, o: object) => Promise<unknown> };
      hapticActuators?: { pulse?: (v: number, ms: number) => Promise<unknown> }[];
    } | undefined;
    if (!pad) return;
    try {
      const act = pad.vibrationActuator;
      if (act?.playEffect) void act.playEffect('dual-rumble', { startDelay: 0, duration: ms, strongMagnitude: strong, weakMagnitude: strong * 0.6 })?.catch(() => {});
      else void pad.hapticActuators?.[0]?.pulse?.(strong, ms)?.catch(() => {});
    } catch { /* a pad that can't shake */ }
  }
}
