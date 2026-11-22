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
  for (const k of ['setPower', 'setBeetles', 'setGold', 'combo', 'setEggs', 'setPips', 'setTimer', 'setHidden', 'usePad', 'stamp', 'toast', 'zone', 'hint', 'prompt', 'showResults']) { H[k] = h[k].bind(h); h[k] = () => {}; }
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
/** Postcards for the level select: a full record with the golden egg, a part one, a locked one. */
const CARDS = JSON.stringify([
  { name: 'Africa', line: 'The Long Way Home', picture: '/levels/desert.jpg', colours: ['#342b0e', '#7a7430', '#e9cf86', '#fde27f', '#f79a2e', '#e0600c'], best: { time: 134, stars: 3, eggs: 37, total: 37, medals: 6, gold: true }, locked: null },
  { name: 'Rainforest', line: 'When It Rains', picture: '/levels/rainforest.jpg', colours: ['#3b2350', '#5a3a6e', '#0c4a50', '#1e8c7b', '#86ddb9', '#f23d7f'], best: { time: 431, stars: 1, eggs: 9, total: 38, medals: 2 }, locked: null },
  { name: 'Back Gardens', line: 'Mind the Cat', picture: '/levels/desert.jpg', colours: ['#2b3a1c', '#4f7a3a', '#a9cf7a', '#f3e9c8', '#d96a5a', '#7a4a8c'], best: null, locked: 'Get home from Rainforest once to open this map.' },
]).replace(/'/g, "\\'");
/** Is the element wholly inside the window? */
const inside = (sel) => `(() => { const r = document.querySelector('${sel}').getBoundingClientRect(); return r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth; })()`;
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
    { goto: 'view=chase&splash=0' },
    check(`innerWidth === ${W} && innerHeight === ${H} || [innerWidth, innerHeight]`, `page is ${W}x${H}`),
    { wait: 1400 },
    shot('title'),
    run(`H.usePad(true), 1`, 'pad'),
    { wait: 700 },
    shot('title-pad'),
    check(`document.querySelector('.logo').getBoundingClientRect().top > 0 && document.querySelector('.t-menu').getBoundingClientRect().bottom < document.querySelector('.t-foot').getBoundingClientRect().top`, 'title fits the window'),
    check(`!hit('.t-liz', '.creed') && !hit('.creed', '.t-menu') && !hit('.title .btn.big', '.t-more')`, 'the logo, the creed and the buttons keep apart'),
    run(`H.usePad(false), 1`),

    // ---- the menus, each put up by hand: splash, how to play, level select, the card before a level ----
    run(`et.hud.showTitle(false), et.hud.showSplash(true), 1`, 'splash'),
    { wait: 700 },
    shot('splash'),
    run(`et.hud.showSplash(true, true), 1`, 'splash, still loading'),
    { wait: 700 },
    shot('splash-late'),
    check(`getComputedStyle(document.querySelector('.sp-wait')).opacity > 0.5`, 'a slow start says what the wait is for'),
    run(`et.hud.showSplash(false), et.hud.showHow(true), 1`, 'how to play'),
    { wait: 700 },
    shot('how'),
    check(`${inside('.howcard .sheet')}`, 'how to play fits the window'),
    run(`H.usePad(true), 1`), { wait: 300 },
    shot('how-pad'),
    run(`H.usePad(false), et.hud.showHow(false), et.hud.showSelect(${CARDS}, 0, 2), 1`, 'level select'),
    { wait: 1000 },
    shot('select'),
    check(`${inside('.sel-head')} && ${inside('.sel-foot')} && [...document.querySelectorAll('.pcard')].every((c) => { const r = c.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })`, 'the level select fits the window'),
    check(`!hit('.sel-head', '.pcard.on') && !hit('.pcard.on', '.sel-foot .btn.main')`, 'the heading, the chosen card and Play keep apart'),
    check(`[...document.querySelectorAll('.pcard[data-i]')].every((c) => [...c.children].every((k) => { const r = k.getBoundingClientRect(), o = c.getBoundingClientRect(); return k.classList.contains('pc-lock') || r.width === 0 || (r.left >= o.left - 3 && r.right <= o.right + 3 && r.top >= o.top - 3 && r.bottom <= o.bottom + 3); }))`, 'nothing hangs out of a postcard'),
    run(`et.hud.choose(1), 1`, 'the second card'), { wait: 700 },
    shot('select-2'),
    run(`et.hud.choose(2), et.hud.refuse(), H.usePad(true), 1`, 'the locked card, refused, pad'), { wait: 180 },
    shot('select-locked'),
    check(`document.querySelector('.btn[data-a="sel-go"]').classList.contains('off') && /Locked/.test(document.querySelector('.btn[data-a="sel-go"]').textContent)`, 'a locked card turns Play off'),
    run(`H.usePad(false), et.hud.selectNote('That map would not load. Try again?'), 1`), { wait: 300 },
    shot('select-note'),
    run(`et.hud.showSelect(null), et.hud.showLevelCard({ name: 'Rainforest', line: 'When It Rains', idea: 'When it rains, the crossings move.', par: 720, best: { time: 431, stars: 2, eggs: 26, total: 38, medals: 3 } }), 1`, 'the card before a level'),
    { wait: 800 },
    shot('card'),
    check(`${inside('.lcard .sheet')}`, 'the card before a level fits the window'),
    run(`et.hud.showLevelCard({ name: 'Africa', line: 'The Long Way Home', idea: 'Collect eggs. Hide under bushes. Do not get eaten.', par: 600, best: null }), H.usePad(true), 1`, 'with no run yet, pad'),
    { wait: 500 },
    shot('card-new-pad'),
    check(`${inside('.lcard .sheet')}`, 'and with the longest idea'),
    run(`H.usePad(false), et.hud.showLevelCard(null), 1`),

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
    run(`window.pops = [], et.hud.onMedal = (i, n) => pops.push(i), et.hud.showPlay(false), H.showResults({ title: 'Africa · The Long Way Home', eggs: 21, total: 21, seconds: 102, par: 120, caught: 0, tails: 1, stars: 3, gold: true, beetles: 12, beetlesTotal: 12, newBest: true, medals: ${medals(['eggs', 'gold', 'speedy', 'bugs', 'untouchable'])}, next: true, opened: 'Rainforest' }), 1`, 'results: 3 stars, a new map open'),
    { wait: 1500 },
    shot('results-3-early'),
    { wait: 4200 },
    shot('results-3'),
    check(`pops.join() === '0,1,4,5,6'`, 'onMedal fired for each earned medal, in order'),
    check(`document.querySelector('.results .paper').getBoundingClientRect().top > 0 && document.querySelector('.results .paper').getBoundingClientRect().bottom < innerHeight`, 'results card fits the window'),
    check(`[...document.querySelectorAll('.results .row .btn')].filter((b) => b.offsetParent).map((b) => b.dataset.a).join() === 'again,next,select' && document.querySelector('.r-open').textContent === 'New map open: Rainforest'`, 'with Go again, Next level, Level select and the news of a new map'),
    run(`document.querySelectorAll('.medal')[3].focus(), 1`, 'focus an unearned medal'),
    { wait: 400 },
    shot('results-3-tip'),
    run(`H.showResults(null), 1`),
    { wait: 600 },
    run(`H.showResults({ title: 'Rainforest · When It Rains', eggs: 8, total: 21, seconds: 251, par: 120, caught: 3, tails: 2, stars: 1, gold: false, beetles: 3, beetlesTotal: 12, newBest: false, medals: ${medals([])} }), 1`, 'results: 1 star, the last level'),
    { wait: 3200 },
    shot('results-1'),
    check(`document.querySelector('.results .paper').getBoundingClientRect().bottom < innerHeight`, 'results card fits the window (1 star)'),
    check(`[...document.querySelectorAll('.results .row .btn')].filter((b) => b.offsetParent).map((b) => b.dataset.a).join() === 'again,select'`, 'with no Next level after the last one'),
    run(`H.showResults(null), 1`),
    { wait: 500 },
    run(`H.showResults({ title: 'Africa · The Long Way Home', eggs: 3, total: 37, seconds: 725, par: 600, caught: 4, tails: 3, stars: 1, gold: false, beetles: 2, beetlesTotal: 12, newBest: false, medals: ${medals([])}, next: true, opened: 'Rainforest' }), 1`, 'results: at their tallest'),
    { wait: 3200 },
    shot('results-tallest'),
    check(`document.querySelector('.results .paper').getBoundingClientRect().top > 0 && document.querySelector('.results .paper').getBoundingClientRect().bottom < innerHeight`, 'results card fits the window at its tallest (no medals, a new map open)'),
    run(`H.showResults(null), 1`),
    { wait: 500 },
    // The card as the game calls it today, with none of the new fields.
    run(`H.showResults({ title: 'The Long Way Home', eggs: 14, total: 21, seconds: 95, par: 120, caught: 1, tails: 0, stars: 2 }), 1`, 'results: old shape'),
    { wait: 2600 },
    shot('results-plain'),
  ],
};
