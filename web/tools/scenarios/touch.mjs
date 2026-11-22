// A phone and a tablet that aren't there: the browser pretends to be one (its size, its sharp screen, fingers and no
// mouse) and the game is played by touch. It checks the wiring and takes pictures of every screen at both sizes
// (.shots/t-*.png). How it feels under real thumbs is for a person to say.
const PHONE = { size: [844, 390], scale: 2, touch: true };      // an iPhone on its side
const SMALL = { size: [667, 375], scale: 2, touch: true };      // an older, smaller phone
const UPRIGHT = { size: [390, 844], scale: 2, touch: true };
const TABLET = { size: [1180, 820], scale: 1, touch: true };    // an iPad on its side
const ui = (cls) => `document.getElementById('ui').classList.contains('${cls}')`;
const D = 'et.debug()';
const shown = (sel) => `(() => { const e = document.querySelector('${sel}'); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0; })()`;
/** Is the element wholly on the screen, and at least `min` pixels across (a thumb needs about 40)? */
const thumbable = (sel, min = 40) => `(() => { const r = document.querySelector('${sel}').getBoundingClientRect(); return r.width >= ${min} - 0.5 && r.height >= ${min} - 0.5 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; })()`;
/** Does everything inside the element fit on the screen (a card too tall for a phone would have its buttons cut off)? */
const fits = (sel) => `(() => { const r = document.querySelector('${sel}').getBoundingClientRect(); return r.top >= -1 && r.bottom <= innerHeight + 1 && r.left >= -1 && r.right <= innerWidth + 1 ? true : [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom), innerWidth, innerHeight].join(' '); })()`;
const exit = 'et.level.burrows.find((b) => b.kind === "exit")';
const S = 'et.shell.screen';
/** An end card with as much on it as there can be. */
const WORST = JSON.stringify({ title: 'Africa · The Long Way Home', eggs: 3, total: 37, seconds: 725, par: 600, caught: 4, tails: 3, stars: 1, gold: false, beetles: 2, beetlesTotal: 12, newBest: false, next: true, opened: 'Rainforest', medals: [
  ['eggs', 'Clean Sweep', 'Bring every egg home'], ['gold', 'Gold Digger', 'Find the golden egg'], ['unseen', 'Unseen', 'Never be spotted'], ['tail', 'Whole Tail', 'Never drop your tail'],
  ['speedy', 'Speedy', 'Home in under 10:00'], ['bugs', 'Bug Buffet', 'Eat every beetle'], ['untouchable', 'Untouchable', 'Never get eaten'],
].map(([id, name, desc]) => ({ id, name, desc, got: false })) });
const chosen = `[...document.querySelectorAll('.pcard[data-i]')].findIndex((c) => c.classList.contains('on'))`;
const row = `document.querySelector('.p-row')`;
/** Tap something and let the game see it. */
const tap = (sel, as) => [{ tap: sel }, { wait: 150 }, { eval: `et.fast(0.1); ${S} + ' / ' + et.state`, as: as ?? `a tap on ${sel}` }];
/** Wait for a level that is on its way. */
const up = [{ eval: 'et.shell.settled()', as: 'the level that is up' }, { eval: 'et.fast(0.2).level' }];
/** The level select: nothing above or below the screen, the heading, the cards and the buttons clear of each other, and the chosen card wholly in view. */
const tableFits = `(() => {
  const box = (q) => document.querySelector(q).getBoundingClientRect(), R = Math.round;
  const all = [...document.querySelectorAll('.pcard, .sel-head, .sel-foot .btn')].map((e) => e.getBoundingClientRect());
  const c = box('.pcard.on'), head = box('.sel-head'), foot = box('.sel-foot .btn.main');
  const ok = all.every((r) => r.top >= 0 && r.bottom <= innerHeight) && c.left >= 0 && c.right <= innerWidth && head.bottom <= c.top + 2 && c.bottom <= foot.top + 2;
  return ok || 'head ' + R(head.top) + '-' + R(head.bottom) + ', card ' + R(c.top) + '-' + R(c.bottom) + ' x ' + R(c.left) + '-' + R(c.right) + ', play ' + R(foot.top) + '-' + R(foot.bottom) + ', screen ' + innerWidth + ' x ' + innerHeight;
})()`;
/** Wait for the row of postcards to stop sliding (drawn in software it takes its time), five seconds at most. */
const rest = { eval: `new Promise((done) => { const row = document.querySelector('.p-row'); let last = -1, still = 0, n = 0; const tick = () => { still = row.scrollLeft === last ? still + 1 : 0; last = row.scrollLeft; if (still >= 4 || ++n > 50) done(Math.round(last)); else setTimeout(tick, 100); }; tick(); })`, as: 'the row comes to rest at' };
/** Is the chosen postcard in the middle of the screen? */
const centred = `(() => { const c = document.querySelector('.pcard.on').getBoundingClientRect(); const x = c.left + c.width / 2; return Math.abs(x - innerWidth / 2) < 6 || 'its middle is at ' + Math.round(x) + ' of ' + innerWidth; })()`;
const noKeys = (sel) => `![...document.querySelectorAll('${sel} kbd:not(.for-touch kbd), ${sel} .padbtn:not(.tdash)')].some((k) => k.getClientRects().length > 0)`;

export default {
  size: [1280, 720],
  steps: [
    // --- a phone: the splash, the title, how to play
    { device: PHONE },
    { goto: 'res=2&splash=60&unlock=1' },
    { wait: 1200 },
    { expect: ui('touch'), as: 'a phone gets the touch controls without being asked' },
    { expect: `${S} === 'splash' && ${fits('.splash .sp')} === true`, as: 'the splash fits a phone' },
    { shot: 't-phone-splash' },
    { tap: [422, 120] },
    { eval: `et.fast(0.1); ${S}`, as: 'after a tap' },
    { expect: `${S} === 'title'`, as: 'a tap sends the splash away' },
    { wait: 900 },
    { expect: `${fits('.t-stack')} === true && ${fits('.t-foot')} === true`, as: 'the title fits a phone' },
    { expect: `${thumbable('.title .btn[data-a="play"]', 44)} && ${thumbable('.title .btn[data-a="how"]', 34)} && ${thumbable('.title .btn[data-a="sound"]', 34)}`, as: 'Play, How to play and Sound are on screen and thumb-sized' },
    { expect: `${shown('.title .btn[data-a="full"]')} === document.fullscreenEnabled`, as: 'Full screen is offered where the browser can do it' },
    { expect: noKeys('.title'), as: 'no key caps or pad buttons on the title' },
    { shot: 't-phone-title' },
    { tap: [70, 200] }, { wait: 150 },
    { eval: `et.fast(0.1); ${S}`, as: 'after a tap on nothing' },
    { expect: `${S} === 'title' && ${D}.state === 'title'`, as: 'a tap that misses the buttons does nothing' },
    ...tap('.title .btn[data-a="how"]'),
    { wait: 700 },
    { expect: `${S} === 'how' && ${fits('.howcard .sheet')} === true && ${thumbable('.btn[data-a="how-ok"]', 34)}`, as: 'How to play fits a phone' },
    { expect: `/thumb/.test(document.querySelector('.howcard').innerText) && ${noKeys('.howcard')}`, as: 'and talks of thumbs, not keys' },
    { shot: 't-phone-how' },
    ...tap('.btn[data-a="how-ok"]'),
    { expect: `${S} === 'title'`, as: '"Got it" goes back to the title' },

    // --- the level select: tap a postcard to choose it, tap it again (or Play) to go
    ...tap('.title .btn[data-a="play"]'),
    { wait: 900 },
    { expect: `${S} === 'select'`, as: 'a tap on Play opens the level select' },
    { expect: `${tableFits} === true`, as: 'the level select fits a phone' },
    { expect: `${row}.scrollWidth > ${row}.clientWidth && ${row}.classList.contains('wide')`, as: 'the row of postcards is wider than a phone, and scrolls' },
    { expect: `${chosen} === 0 && ${centred} === true`, as: 'with the chosen card in the middle' },
    { expect: `${thumbable('.btn[data-a="sel-go"]', 40)} && ${thumbable('.btn[data-a="sel-back"]', 34)}`, as: 'Play and Back are thumb-sized' },
    { expect: `/Tap a map/.test(document.querySelector('.sel-keys').innerText) && ${noKeys('.select')}`, as: 'the hint says to tap, and shows no keys' },
    { shot: 't-phone-select' },
    ...tap('.pcard[data-i="1"]', 'a tap on the rainforest'),
    { wait: 300 }, rest,
    { expect: `${S} === 'select' && ${chosen} === 1`, as: 'a tap on another postcard chooses it' },
    { expect: `${centred} === true`, as: 'and the row slides it to the middle' },
    { eval: 'et.fast(0.5); 1' }, ...up,
    { expect: `${D}.level === 'rainforest'`, as: 'its level comes up behind the table' },
    { expect: `${tableFits} === true`, as: 'still fitting' },
    { wait: 700 }, { shot: 't-phone-select-2' },
    // A finger slid along the row scrolls it, and chooses nothing.
    { eval: `window.left0 = ${row}.scrollLeft; getComputedStyle(${row}).touchAction`, as: 'the row lets a finger slide it' },
    { tdown: [520, 180] }, { tmove: [470, 182] }, { tmove: [400, 184] }, { tmove: [330, 186] }, { tmove: [300, 186] }, { tup: 0 },
    { wait: 300 }, rest,
    { eval: `et.fast(0.1); [left0, ${row}.scrollLeft]`, as: 'the row, before and after a finger slid along it' },
    { expect: `getComputedStyle(${row}).touchAction === 'pan-x' && ${row}.scrollLeft !== left0`, as: 'a finger slides the row' },
    { expect: `${S} === 'select' && ${chosen} === 1 && ${D}.level === 'rainforest'`, as: 'and that is not a choice' },
    { eval: `${row}.scrollTo({ left: 0 }); 1` }, { wait: 300 }, rest,
    ...tap('.pcard[data-i="0"]', 'a tap on Africa'),
    { wait: 300 }, rest,
    { expect: `${chosen} === 0 && ${centred} === true`, as: 'a tap on Africa chooses it again' },
    { eval: 'et.fast(0.5); 1' }, ...up,
    ...tap('.pcard[data-i="0"]', 'a second tap on Africa'), ...up,
    { wait: 700 },
    { expect: `${S} === 'card' && document.querySelector('.lc-name').textContent === 'Africa'`, as: 'a second tap on the chosen postcard opens its card' },
    { expect: `${fits('.lcard .sheet')} === true && ${thumbable('.btn[data-a="card-go"]', 34)} && ${thumbable('.btn[data-a="card-back"]', 34)} && ${noKeys('.lcard')}`, as: 'which fits a phone, its buttons thumb-sized' },
    { shot: 't-phone-card' },
    ...tap('.btn[data-a="card-back"]'),
    { expect: `${S} === 'select' && ${chosen} === 0`, as: 'Back takes a tap' },
    { wait: 500 },
    ...tap('.btn[data-a="sel-go"]', 'a tap on Play'), ...up,
    { expect: `${S} === 'card'`, as: 'the Play button opens the card too' },
    { wait: 500 },
    ...tap('.btn[data-a="card-go"]', 'a tap on Go'),
    { wait: 700 },
    { expect: `${S} === 'first' && ${fits('.howcard .sheet')} === true`, as: 'a first run is shown how to play' },
    { shot: 't-phone-first' },
    ...tap('.btn[data-a="how-ok"]', 'a tap on Got it'),
    { expect: `${S} === 'none' && ${D}.state === 'play' && ${D}.level === 'desert'`, as: 'and "Got it" starts the game' },
    { eval: 'et.fast(0.6); document.querySelector(".hint").innerText', as: 'the first hint' },
    { expect: `/thumb/.test(document.querySelector('.hint > .for-touch')?.textContent ?? '')`, as: 'the first hint talks of thumbs, not keys' },

    // --- play: the stick
    { goto: 'skip=1&safe=1&at=8,16&res=2' },
    { eval: 'et.teleport(8.5, 16.5, 0); et.fast(0.3).z', as: 'at rest' },
    { expect: `${thumbable('.t-dash', 56)} && ${thumbable('.p-sock', 50)} && ${thumbable('.t-pause', 38)}`, as: 'dash, egg and pause are on screen and thumb-sized' },
    { expect: `!${shown('.views')}`, as: 'there are no camera numbers' },
    { tdown: [150, 250] }, { tmove: [150, 180] },
    { eval: 'et.fast(0.7).z', as: 'thumb pushed up' },
    { expect: `${D}.z < 15.6 && Math.abs(${D}.x - 8.5) < 0.3`, as: 'the stick runs the way it is pushed' },
    { expect: `document.querySelector('.tstick').classList.contains('on')`, as: 'the stick is drawn under the thumb' },
    { shot: 't-phone-run' },
    // pushed far past the rim and then back a little: the base has followed, so that is already "the other way"
    { tmove: [150, 60] }, { eval: 'et.fast(0.2).z' }, { tmove: [150, 150] },
    { eval: 'const z0 = et.debug().z; et.fast(0.6); et.debug().z - z0', as: 'far up, then back down a bit' },
    { expect: 'et.input.moveZ > 0.6', as: 'the base follows a thumb that strays, so turning back is a short move' },
    { tmove: [150, 150] },
    { tup: 0 },
    { eval: 'et.fast(0.5); et.lizard.speed', as: 'thumb off' },
    { expect: 'et.lizard.speed < 0.2 && et.input.moveX === 0 && et.input.moveZ === 0', as: 'lifting the thumb stops' },
    { tdown: [120, 300] }, { tmove: [123, 303] },
    { eval: 'et.fast(0.3); et.lizard.speed', as: 'a thumb resting, barely moved' },
    { expect: 'et.lizard.speed < 0.2', as: 'a resting thumb does not creep' },
    { tup: 0 },

    // --- two thumbs at once: run and dash
    { eval: 'et.teleport(8.5, 16.5, 0); et.fast(1.5).z' },
    { tdown: [150, 250] }, { tmove: [220, 250] },
    { eval: 'et.fast(0.3).x', as: 'running right' },
    { tap: '.t-dash' },
    { eval: 'et.fast(0.05); et.lizard.dashCd', as: 'dash cooldown' },
    { expect: 'et.lizard.dashCd > 0', as: 'the dash button dashes while the other thumb steers' },
    { expect: `${D}.x > 9`, as: 'and it went right' },
    { tup: 0 },

    // --- the right of the screen swings the view
    { eval: 'et.fast(3); window.yaw0 = et.rig.yaw; 1' },
    { tdown: [560, 200], id: 1 }, { tmove: [460, 200], id: 1 },
    { eval: 'et.fast(0.1); et.rig.yaw - yaw0', as: 'dragged 100px left on the right half' },
    { expect: 'et.rig.yaw - yaw0 < -0.3', as: 'dragging on the right swings the view' },
    { tup: 1 },

    // --- the power egg is a button; a long press is not a right click
    { eval: `et.give('thunder'); et.fast(0.4).power`, as: 'holding' },
    { wait: 500 }, { shot: 't-phone-egg' },
    { tdown: [520, 240], id: 2 },
    { eval: `document.querySelector('canvas').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })); et.fast(0.2).power`, as: 'after a long press on the picture' },
    { expect: `${D}.power === 'thunder'`, as: 'a long press does not use up the egg' },
    { tup: 2 },
    { tap: '.p-sock' },
    { eval: 'et.fast(0.2).power', as: 'after a tap on the egg' },
    { expect: `${D}.power === null`, as: 'tapping the egg uses it' },

    // --- pause, by its button; the paper buttons take taps
    { eval: 'et.fast(1.5).state' },
    { tap: '.t-pause' },
    { eval: 'et.fast(0.1); et.paused', as: 'paused' },
    { expect: 'et.paused === true', as: 'the pause button pauses' },
    { wait: 700 },
    { expect: `${fits('.pause .sheet')} === true`, as: 'the pause card fits a phone' },
    { expect: `${shown('.pause .btn[data-a="sound"]')} && !${shown('.pause .vpick')} && !${shown('.pause .card')}`, as: 'it has a sound button and no camera picker' },
    { expect: `${thumbable('.pause .btn[data-a="select"]', 34)} && ${thumbable('.pause .btn[data-a="resume"]', 34)} && ${thumbable('.pause .btn[data-a="restart"]', 34)}`, as: 'and a Level select button, each of them thumb-sized' },
    { expect: `!document.elementFromPoint(...(() => { const r = document.querySelector('.p-sock').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()).closest('[data-touch]')`, as: 'the buttons under the pause card cannot be tapped through it' },
    { shot: 't-phone-pause' },
    { eval: 'window.muted0 = et.sound.muted; 1' },
    { tap: '.pause .btn[data-a="sound"]' }, { wait: 150 },
    { expect: 'et.sound.muted !== muted0', as: 'the sound button turns the sound off and on' },
    { tap: '.pause .btn[data-a="sound"]' }, { wait: 150 },
    { tap: '.btn[data-a="resume"]' }, { wait: 150 },
    { eval: 'et.fast(0.1); et.paused' },
    { expect: 'et.paused === false', as: '"Back to it" takes a tap' },

    // --- the page put away stops the clock
    { eval: `Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); et.paused`, as: 'page hidden' },
    { expect: 'et.paused === true', as: 'putting the page away pauses' },
    { eval: `delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); 1` },
    { wait: 700 }, // the card swings in: a button is not where it will be until it has landed
    { tap: '.btn[data-a="resume"]' }, { wait: 150 }, { eval: 'et.fast(0.1); et.paused' },
    { expect: 'et.paused === false', as: 'and a tap carries on' },

    // --- going home: hold the dash button on the way out
    { eval: `et.teleport(${exit}.x, ${exit}.z, 0); et.fast(0.4).state`, as: 'on the way out' },
    { expect: `/DASH/.test(document.querySelector('.prompt').innerText)`, as: 'the way out asks for DASH to be held' },
    { tdown: [770, 310], id: 3 },
    { eval: 'et.fast(0.5); et.hold', as: 'held half a second' },
    { shot: 't-phone-exit' },
    { eval: 'et.fast(1.2).state', as: 'held on' },
    { tup: 3 },
    { expect: `${D}.state === 'leaving' || ${D}.state === 'won'`, as: 'holding the dash button on the way out goes home' },
    { eval: 'et.fast(6).state', as: 'then' },
    { expect: `${D}.state === 'won'`, as: 'home' },
    { wait: 5000 },
    { expect: `${fits('.results .sheet')} === true`, as: 'the end card fits a phone' },
    { expect: `${thumbable('.results .btn[data-a="again"]', 34)} && ${thumbable('.results .btn[data-a="next"]', 34)} && ${thumbable('.results .btn[data-a="select"]', 34)}`, as: 'with Go again, Next level and Level select, all thumb-sized' },
    { expect: `document.querySelector('.r-open').textContent === 'New map open: Rainforest' && ${noKeys('.results')}`, as: 'and the news that the rainforest is open' },
    { shot: 't-phone-results' },
    { tap: '.btn[data-a="again"]' }, { wait: 300 },
    { eval: 'et.fast(0.2).state' },
    { expect: `${D}.state === 'play'`, as: '"Go again" takes a tap' },
    // home a second time, and on to the next level
    { eval: `et.teleport(${exit}.x, ${exit}.z, 0); et.fast(0.4).state` },
    { tdown: [770, 310], id: 3 }, { eval: 'et.fast(1.7).state' }, { tup: 3 }, { eval: 'et.fast(6).state', as: 'home again' },
    { wait: 2500 }, // the card rises into place: a button is not where it will be until it has landed
    // The tallest the end card can be: a new map open, and every medal still to be earned and explained.
    { eval: `et.hud.showResults(${WORST}); 1`, as: 'the end card at its tallest' },
    { wait: 2500 },
    { expect: `${fits('.results .sheet')} === true`, as: 'the end card fits a phone at its tallest' },
    { expect: `${thumbable('.results .btn[data-a="again"]', 34)} && ${thumbable('.results .btn[data-a="next"]', 34)} && ${thumbable('.results .btn[data-a="select"]', 34)}`, as: 'its buttons still whole and thumb-sized' },
    { shot: 't-phone-results-tallest' },
    { tap: '.results .btn[data-a="next"]' }, { wait: 300 }, ...up,
    { wait: 700 },
    { expect: `${S} === 'card' && ${D}.level === 'rainforest' && document.querySelector('.lc-name').textContent === 'Rainforest'`, as: '"Next level" takes a tap: the rainforest\'s card' },
    { expect: `${fits('.lcard .sheet')} === true`, as: 'which fits' },
    { shot: 't-phone-card-rainforest' },
    ...tap('.btn[data-a="card-go"]', 'a tap on Go'),
    { expect: `${D}.state === 'play' && ${D}.level === 'rainforest'`, as: 'and the rainforest is played by touch' },
    { eval: 'et.fast(1).state' }, { wait: 700 },
    { expect: `${thumbable('.t-dash', 56)} && ${thumbable('.t-pause', 38)}`, as: 'with its touch buttons' },
    { shot: 't-phone-rainforest' },
    { tap: '.t-pause' }, { eval: 'et.fast(0.1); et.paused' }, { wait: 700 },
    { tap: '.pause .btn[data-a="select"]' }, { wait: 300 },
    { eval: `et.fast(0.1); ${S}`, as: 'after a tap on Level select' },
    { wait: 800 },
    { expect: `${S} === 'select' && !et.paused && ${chosen} === 1`, as: 'the pause card\'s Level select takes a tap' },
    { expect: `${tableFits} === true && ${centred} === true`, as: 'the level select fits with a record on a card, the rainforest in the middle' },
    { shot: 't-phone-select-record' },
    ...tap('.btn[data-a="sel-go"]', 'a tap on Play'), ...up, ...tap('.btn[data-a="card-go"]', 'a tap on Go'),
    { expect: `${D}.state === 'play' && ${D}.level === 'rainforest'`, as: 'and back into the rainforest' },

    // --- a keyboard (an iPad's, say) takes the hints back, and a touch takes them back again
    { press: 'KeyM' }, { eval: 'et.fast(0.1).state' },
    { expect: `!${ui('touch')}`, as: 'a key press brings the keyboard hints back' },
    { tdown: [150, 250] }, { tup: 0 }, { eval: 'et.fast(0.1).state' },
    { expect: ui('touch'), as: 'and a touch brings the touch controls back' },

    // --- a smaller phone
    { device: SMALL },
    { goto: 'res=2&splash=0' }, { wait: 1200 },
    { expect: `${fits('.t-stack')} === true && ${fits('.t-foot')} === true && ${thumbable('.title .btn[data-a="play"]', 44)}`, as: 'the title fits a small phone' },
    { shot: 't-small-title' },
    ...tap('.title .btn[data-a="how"]'), { wait: 700 },
    { expect: `${fits('.howcard .sheet')} === true`, as: 'How to play fits a small phone' },
    { shot: 't-small-how' },
    ...tap('.btn[data-a="how-ok"]'),
    ...tap('.title .btn[data-a="play"]'), { wait: 900 },
    { expect: `${S} === 'select' && ${tableFits} === true && ${centred} === true`, as: 'the level select fits a small phone' },
    { expect: `document.querySelector('.pcard.locked') && /Get home from Africa once/.test(document.querySelector('.pcard.locked').innerText)`, as: 'the locked card says how to open it' },
    { shot: 't-small-select' },
    ...tap('.pcard[data-i="1"]', 'a tap on the locked rainforest'), { wait: 300 }, rest,
    { expect: `${chosen} === 1 && ${centred} === true && ${tableFits} === true && /Locked/.test(document.querySelector('.btn[data-a="sel-go"]').textContent)`, as: 'a locked card can be chosen, and looked at' },
    ...tap('.pcard[data-i="1"]', 'a second tap on it'),
    { expect: `${S} === 'select'`, as: 'but not played' },
    { wait: 500 }, { shot: 't-small-select-locked' },
    ...tap('.btn[data-a="sel-back"]'),
    { expect: `${S} === 'title'`, as: 'Back goes to the title' },
    ...tap('.title .btn[data-a="play"]'), { wait: 600 }, ...tap('.btn[data-a="sel-go"]'), ...up, { wait: 700 },
    { expect: `${S} === 'card' && ${fits('.lcard .sheet')} === true`, as: 'the level\'s card fits a small phone' },
    { shot: 't-small-card' },
    { goto: 'skip=1&safe=1&at=8,16&res=2&power=chili' },
    { eval: 'et.fast(1).state' }, { wait: 400 },
    { expect: `${thumbable('.t-dash', 56)} && ${thumbable('.p-sock', 50)}`, as: 'small phone: the buttons are still thumb-sized' },
    { shot: 't-small-play' },
    { tap: '.t-pause' }, { eval: 'et.fast(0.1); et.paused' }, { wait: 700 },
    { expect: `et.paused && ${fits('.pause .sheet')} === true`, as: 'the pause card fits a small phone' },
    { shot: 't-small-pause' },

    // --- a phone held upright is asked to turn
    { device: UPRIGHT },
    { goto: 'skip=1&safe=1&at=8,16&res=2' }, { wait: 600 },
    { expect: shown('#rotate'), as: 'held upright, a phone is asked to turn' },
    { eval: 'window.dispatchEvent(new Event("resize")); et.fast(0.1); et.paused', as: 'and the clock' },
    { expect: 'et.paused === true', as: 'the clock stops while it is upright' },
    { shot: 't-phone-upright' },

    // --- a tablet
    { device: TABLET },
    { goto: 'res=1&splash=0.5' }, { wait: 1200 },
    { expect: `${ui('touch')} && !${shown('#rotate')}`, as: 'a tablet gets the touch controls' },
    { eval: `et.fast(0.1); ${S}`, as: 'the splash goes by itself' },
    { expect: `${S} === 'title' && ${fits('.t-stack')} === true`, as: 'tablet: the title fits' },
    { shot: 't-tablet-title' },
    ...tap('.title .btn[data-a="play"]'), { wait: 900 },
    { expect: `${S} === 'select' && ${tableFits} === true`, as: 'tablet: the level select fits' },
    { expect: `${row}.scrollWidth <= ${row}.clientWidth + 1 && !${row}.classList.contains('wide')`, as: 'tablet: every postcard is in view, with no need to slide the row' },
    { shot: 't-tablet-select' },
    ...tap('.pcard[data-i="0"]', 'a tap on the chosen card'), ...up, { wait: 700 },
    { expect: `${S} === 'card' && ${fits('.lcard .sheet')} === true`, as: 'tablet: a tap on the chosen postcard opens its card' },
    { shot: 't-tablet-card' },
    ...tap('.btn[data-a="card-go"]'), { wait: 700 },
    { expect: `${S} === 'first' && ${fits('.howcard .sheet')} === true`, as: 'tablet: how to play fits' },
    { shot: 't-tablet-first' },
    ...tap('.btn[data-a="how-ok"]'),
    { expect: `${D}.state === 'play'`, as: 'tablet: "Got it" starts the game' },
    { goto: 'skip=1&safe=1&at=8,16&res=1&power=ghost' },
    { eval: 'et.teleport(8.5, 16.5, 0); et.fast(0.5).z' },
    { tdown: [200, 600] }, { tmove: [200, 500] },
    { eval: 'et.fast(0.7).z', as: 'tablet, thumb up' },
    { expect: `${D}.z < 15.6`, as: 'tablet: the stick runs' },
    { wait: 400 }, { shot: 't-tablet-play' },
    { tup: 0 },
    { tap: '.p-sock' }, { eval: 'et.fast(0.2).power' },
    { expect: `${D}.power === 'ghost!'`, as: 'tablet: the egg button works' },
    { tap: '.t-pause' }, { eval: 'et.fast(0.1); et.paused' }, { wait: 700 },
    { expect: 'et.paused === true', as: 'tablet: the pause button pauses' },
    { shot: 't-tablet-pause' },

    // --- a tablet held upright is narrow, but there is room
    { device: { size: [820, 1180], scale: 1, touch: true } },
    { goto: 'res=1&splash=0&unlock=1' }, { wait: 1200 },
    { expect: `${fits('.t-stack')} === true && !${shown('#rotate')}`, as: 'tablet upright: the title fits, and nobody is asked to turn it' },
    { shot: 't-tablet-upright-title' },
    ...tap('.title .btn[data-a="play"]'), { wait: 900 },
    { expect: `${S} === 'select' && ${tableFits} === true && ${centred} === true`, as: 'tablet upright: the level select fits, the row sliding' },
    { shot: 't-tablet-upright-select' },
    ...tap('.pcard[data-i="1"]'), { wait: 300 }, rest,
    { expect: `${chosen} === 1 && ${centred} === true`, as: 'tablet upright: a tap chooses the next card and brings it to the middle' },
    { goto: 'skip=1&safe=1&at=8,16&res=1&power=thunder' },
    { eval: 'et.fast(1).state' }, { wait: 500 },
    { shot: 't-tablet-upright' },
    { tap: '.t-pause' }, { eval: 'et.fast(0.1); et.paused' }, { wait: 700 },
    { expect: `et.paused && ${fits('.pause .sheet')} === true`, as: 'tablet upright: the pause card fits' },

    // --- and none of it shows on a desk
    { device: null },
    { goto: 'skip=1&safe=1&at=8,16' },
    { eval: 'et.fast(0.5).state' },
    { expect: `!${ui('touch')} && !${shown('.t-dash')} && !${shown('.tstick')} && !${shown('.t-pause')} && !${shown('.views')}`, as: 'a desktop sees no touch controls or camera picker' },
  ],
};
