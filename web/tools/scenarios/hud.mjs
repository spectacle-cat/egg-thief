// Every HUD widget and screen in every state, for looking at:  node tools/drive.mjs tools/scenarios/hud.mjs
//   HUD_SIZE=1920x1080 node tools/drive.mjs tools/scenarios/hud.mjs      the same at another size (shots get the size as a suffix)
// The game's own per-frame calls into the HUD are switched off first (window.H keeps the real ones), so a state set
// here stays put for the picture.
// (The size is the page's: headless Chromium's window is 143px taller than what it shows.)
const [W, H] = (process.env.HUD_SIZE ?? '1280x720').split('x').map(Number);
const tag = W === 1280 && H === 720 ? '' : `-${W}${H * 16 === W * 9 ? '' : 'x' + H}`;
const shot = (name) => ({ shot: `hud-${name}${tag}` });

const SETUP = `(window.H || (() => {
  // Software rendering of the 3D scene is slow, and slower still when other tests share the machine: draw the world
  // only now and then, and keep the HUD's own clock (hints, stamps) running in between.
  const f = et.frame.bind(et); let last = 0, prev = performance.now();
  et.frame = (now) => { const dt = Math.min(0.1, (now - prev) / 1000); prev = now; if (now - last > 900) { last = now; f(now); } else et.hud.update(dt); };
  const h = et.hud; window.H = {};
  for (const k of ['setPower', 'setBeetles', 'setGold', 'combo', 'setEggs', 'setPips', 'setTimer', 'setHidden', 'usePad', 'stamp', 'toast', 'zone', 'hint', 'prompt', 'setBest', 'showResults']) { H[k] = h[k].bind(h); h[k] = () => {}; }
  // True when two widgets overlap on the screen.
  window.hit = (a, b) => { const r = document.querySelector(a).getBoundingClientRect(), s = document.querySelector(b).getBoundingClientRect(); return !(r.right <= s.left || s.right <= r.left || r.bottom <= s.top || s.bottom <= r.top); };
})())`;
// A step that sets things up first if a reload (someone else's edit) has wiped the page.
const run = (js, as) => ({ eval: `${SETUP}, ${js}`, as });
const check = (js, as) => ({ expect: `${SETUP}, ${js}`, as });

const MEDALS = [
  { id: 'eggs', name: 'Clean Sweep', desc: 'Bring every egg home' },
  { id: 'gold', name: 'Gold Digger', desc: 'Find the golden egg' },
  { id: 'unseen', name: 'Ghost', desc: 'Never be spotted' },
  { id: 'tail', name: 'Whole Tail', desc: 'Finish without dropping your tail' },
  { id: 'speedy', name: 'Speedy', desc: 'Get home under par' },
  { id: 'bugs', name: 'Bug Hunter', desc: 'Eat every beetle' },
  { id: 'untouchable', name: 'Untouchable', desc: 'Never get eaten' },
];
const medals = (got) => JSON.stringify(MEDALS.map((m) => ({ ...m, got: got.includes(m.id) })));

const power = (kind) => [
  run(`H.setPower(null), H.setPower({ kind: '${kind}', active: 0 }), document.querySelector('.power').dataset.kind`, 'power'),
  { wait: 1100 },
  shot('power-' + kind),
];

// HUD_LIVE=1: no stand-ins. The stand-in player runs the real game for a while with the HUD as the game drives it.
const live = [
  { goto: 'skip=1&view=chase&bot=1&eggs=2' },
  { wait: 9000 },
  { eval: `JSON.stringify(et.debug())`, as: 'game' },
  shot('live-1'),
  { wait: 9000 },
  shot('live-2'),
  { expect: `document.querySelector('.eggs .of').textContent.trim().length > 2 && !document.querySelector('.hud').classList.contains('off')`, as: 'the game is driving the HUD' },
];

export default {
  size: [W, H + 143],
  steps: process.env.HUD_LIVE ? live : [
    // ---- title ----
    { goto: 'view=chase' },
    check(`innerWidth === ${W} && innerHeight === ${H} || [innerWidth, innerHeight]`, `page is ${W}x${H}`),
    { wait: 1400 },
    shot('title'),
    run(`H.setBest({ time: 134, stars: 3, eggs: 21, total: 21, medals: 5 }), H.usePad(true), 1`, 'best + pad'),
    { wait: 700 },
    shot('title-pad'),
    check(`document.querySelector('.best').classList.contains('on') && document.querySelector('.b-time').textContent === '2:14'`, 'best run is shown'),
    check(`document.querySelector('.logo').getBoundingClientRect().top > 0 && document.querySelector('.go').getBoundingClientRect().bottom < document.querySelector('.t-foot').getBoundingClientRect().top`, 'title fits the window'),
    check(`!hit('.best', '.logo') && !hit('.best', '.howto') && !hit('.best', '.go') && !hit('.best', '.t-foot') && !hit('.t-liz', '.creed')`, 'best run ticket is clear of the rest'),

    // ---- play ----
    { goto: 'skip=1&view=chase' },
    run(`H.usePad(false), H.setEggs(3, 21, []), H.setPips(1, true, 1), H.setTimer(47), H.setBeetles(0, 12), H.setGold(false), H.setPower(null), 1`, 'empty'),
    { wait: 2600 },
    shot('play-empty'),
    check(`!hit('.power', '.minimap') && !hit('.power', '.hint') && !hit('.tl', '.zone') && !hit('.tr', '.zone')`, 'nothing overlaps (empty)'),
    run(`H.zone('Roadrunner Ridge'), 1`, 'zone banner'),
    { wait: 900 },
    shot('zone'),
    check(`!hit('.zone', '.tl') && !hit('.zone', '.tr')`, 'zone banner clears the corners'),
    ...power('thunder'),
    ...power('ghost'),
    ...power('chili'),
    ...power('rattle'),
    run(`H.hint('<kbd>E</kbd> to throw the rattle: everything nearby runs to the noise'), et.hud.update(0.016), 1`, 'hint'),
    { wait: 500 },
    check(`!hit('.power', '.minimap') && !hit('.power', '.hint') && !hit('.hint', '.minimap')`, 'power, hint and map keep apart'),
    run(`H.setPower(null), H.setPower({ kind: 'thunder', active: 0 }), 1`, 'pick up'),
    { wait: 230 },
    shot('power-pop'),

    run(`H.usePad(true), H.setPower({ kind: 'rattle', active: 0 }), 1`, 'pad'),
    { wait: 900 },
    shot('power-pad'),
    // An Xbox-style pad gets letters instead of PlayStation shapes.
    run(`navigator.getGamepads = () => [{ id: 'Xbox 360 Controller (XInput STANDARD GAMEPAD)' }], H.usePad(false), H.usePad(true, 'xbox'), H.toast('Rattle Egg!'), 1`, 'xbox pad'),
    { wait: 500 },
    shot('power-xbox'),
    check(`document.getElementById('ui').classList.contains('xbox')`, 'xbox letters'),
    run(`delete navigator.getGamepads, H.usePad(false), 1`),

    run(`H.setPower({ kind: 'ghost', active: 0.6 }), H.setEggs(6, 21, [1, 3, 2]), H.combo(3), H.setBeetles(4, 12), H.stamp('Hawk Dunes', 'cleaned out!', 'good'), 1`, 'active 0.6, combo 3, good stamp'),
    { wait: 900 },
    shot('play-active'),
    check(`document.querySelector('.power').classList.contains('active') && !document.querySelector('.power').classList.contains('urgent')`, 'active, not urgent'),
    check(`!hit('.stamp .st', '.tl') && !hit('.stamp .st', '.tr') && !hit('.combo', '.stamp .st')`, 'stamp clears the corners'),

    run(`H.setPower({ kind: 'chili', active: 0.15 }), H.setEggs(9, 21, [2, 2, 1, 3, 1]), H.combo(5), H.setBeetles(12, 12), H.setGold(true), H.setPips(0.4, false, 0.3), H.stamp('Near miss', 'by a whisker', 'danger'), 1`, 'active 0.15, combo 5, danger stamp, gold'),
    { wait: 1700 },
    shot('play-urgent'),
    check(`document.querySelector('.power').classList.contains('urgent') && document.querySelector('.gold').classList.contains('found')`, 'urgent, gold found'),

    run(`H.setPower({ kind: 'thunder', active: 0 }), H.combo(0), H.setHidden(true), H.stamp('Golden egg!', 'the one they hid', 'gold'), H.toast('A whole clutch!'), H.prompt('Hold SPACE to go home with 9 of 21 eggs', 0.5, 0.62, 0.45), 1`, 'gold stamp, hidden, prompt'),
    { wait: 1300 },
    shot('play-gold'),
    check(`!document.querySelector('.combo').classList.contains('on')`, 'combo hidden below 2'),
    // Called again with what is already showing, as the game does 60 times a second, nothing on the page may change.
    check(`(() => { const mo = new MutationObserver(() => {}); mo.observe(document.getElementById('ui'), { subtree: true, childList: true, attributes: true, characterData: true });
      for (let i = 0; i < 200; i++) { H.setEggs(9, 21, [2, 2, 1, 3, 1]); H.setTimer(47.4 + i / 400); H.setPips(0.4, false, 0.3); H.setHidden(true); H.setPower({ kind: 'thunder', active: 0 }); H.setBeetles(12, 12); H.setGold(true); H.combo(0); H.usePad(false); H.prompt('Hold SPACE to go home with 9 of 21 eggs', 0.5, 0.62, 0.45); }
      const n = mo.takeRecords().length; mo.disconnect(); return n === 0 || n; })()`, 'unchanged values touch nothing'),
    run(`H.prompt(null), H.setHidden(false), H.setPower(null), 1`),
    { wait: 200 },
    shot('power-spent'),

    // ---- pause ----
    { wait: 2500 },
    { press: 'Escape' },
    { wait: 1500 },
    check(`document.querySelector('.pause').classList.contains('on')`, 'paused'),
    shot('pause'),
    run(`H.usePad(true), 1`),
    { wait: 300 },
    shot('pause-pad'),
    run(`H.usePad(false), 1`),
    { press: 'Escape' },
    { wait: 1300 },

    // ---- results ----
    run(`window.pops = [], et.hud.onMedal = (i, n) => pops.push(i), et.hud.showPlay(false), H.showResults({ title: 'The Long Way Home', eggs: 21, total: 21, seconds: 102, par: 120, caught: 0, tails: 1, stars: 3, gold: true, beetles: 12, beetlesTotal: 12, newBest: true, medals: ${medals(['eggs', 'gold', 'speedy', 'bugs', 'untouchable'])} }), 1`, 'results: 3 stars'),
    { wait: 1500 },
    shot('results-3-early'),
    { wait: 4200 },
    shot('results-3'),
    check(`pops.join() === '0,1,4,5,6'`, 'onMedal fired for each earned medal, in order'),
    check(`document.querySelector('.results .paper').getBoundingClientRect().top > 0 && document.querySelector('.results .paper').getBoundingClientRect().bottom < innerHeight`, 'results card fits the window'),
    run(`document.querySelectorAll('.medal')[3].focus(), 1`, 'focus an unearned medal'),
    { wait: 400 },
    shot('results-3-tip'),
    run(`H.showResults(null), 1`),
    { wait: 600 },
    run(`H.showResults({ title: 'The Long Way Home', eggs: 8, total: 21, seconds: 251, par: 120, caught: 3, tails: 2, stars: 1, gold: false, beetles: 3, beetlesTotal: 12, newBest: false, medals: ${medals([])} }), 1`, 'results: 1 star'),
    { wait: 3200 },
    shot('results-1'),
    check(`document.querySelector('.results .paper').getBoundingClientRect().bottom < innerHeight`, 'results card fits the window (1 star)'),
    run(`H.showResults(null), 1`),
    { wait: 500 },
    // The card as the game calls it today, with none of the new fields.
    run(`H.showResults({ title: 'The Long Way Home', eggs: 14, total: 21, seconds: 95, par: 120, caught: 1, tails: 0, stars: 2 }), 1`, 'results: old shape'),
    { wait: 2600 },
    shot('results-plain'),
  ],
};
