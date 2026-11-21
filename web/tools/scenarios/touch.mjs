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
const thumbable = (sel, min = 40) => `(() => { const r = document.querySelector('${sel}').getBoundingClientRect(); return r.width >= ${min} && r.height >= ${min} && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; })()`;
/** Does everything inside the element fit on the screen (a card too tall for a phone would have its buttons cut off)? */
const fits = (sel) => `(() => { const r = document.querySelector('${sel}').getBoundingClientRect(); return r.top >= -1 && r.bottom <= innerHeight + 1 && r.left >= -1 && r.right <= innerWidth + 1 ? true : [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom), innerWidth, innerHeight].join(' '); })()`;
const exit = 'et.level.burrows.find((b) => b.kind === "exit")';

export default {
  size: [1280, 720],
  steps: [
    // --- the title on a phone: touch wording before anything has been touched, and a tap starts the game
    { device: PHONE },
    { goto: 'res=2' },
    { wait: 1200 },
    { expect: ui('touch'), as: 'a phone gets the touch controls without being asked' },
    { expect: `document.querySelector('.go').innerText.replace(/\\s+/g, ' ').trim() === 'Tap to scurry'`, as: 'the title says "Tap to scurry"' },
    { expect: `${fits('.t-stack')} === true`, as: 'the title fits a phone' },
    { shot: 't-phone-title' },
    { tap: [422, 120] },
    { eval: 'et.fast(0.1).state', as: 'after a tap' },
    { expect: `${D}.state === 'play'`, as: 'a tap starts the game' },
    { eval: 'et.fast(0.6); document.querySelector(".hint").innerText', as: 'the first hint' },
    { expect: `/thumb/.test(document.querySelector('.hint > .for-touch')?.textContent ?? '')`, as: 'the first hint talks of thumbs, not keys' },

    // --- play: the stick
    { goto: 'skip=1&safe=1&at=8,16&res=2' },
    { eval: 'et.teleport(8.5, 16.5, 0); et.fast(0.3).z', as: 'at rest' },
    { expect: `${thumbable('.t-dash', 56)} && ${thumbable('.p-sock', 50)} && ${thumbable('.t-pause', 38)}`, as: 'dash, egg and pause are on screen and thumb-sized' },
    { expect: `!${shown('.views')}`, as: 'the camera numbers are put away' },
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
    { expect: `${shown('.btn[data-a="sound"]')} && !${shown('.pause .vpick')}`, as: 'it has a sound button and no camera picker' },
    { expect: `!document.elementFromPoint(...(() => { const r = document.querySelector('.p-sock').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()).closest('[data-touch]')`, as: 'the buttons under the pause card cannot be tapped through it' },
    { shot: 't-phone-pause' },
    { eval: 'window.muted0 = et.sound.muted; 1' },
    { tap: '.btn[data-a="sound"]' }, { wait: 150 },
    { expect: 'et.sound.muted !== muted0', as: 'the sound button turns the sound off and on' },
    { tap: '.btn[data-a="sound"]' }, { wait: 150 },
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
    { shot: 't-phone-results' },
    { tap: '.btn[data-a="again"]' }, { wait: 300 },
    { eval: 'et.fast(0.2).state' },
    { expect: `${D}.state === 'play'`, as: '"Go again" takes a tap' },

    // --- a keyboard (an iPad's, say) takes the hints back, and a touch takes them back again
    { press: 'KeyM' }, { eval: 'et.fast(0.1).state' },
    { expect: `!${ui('touch')}`, as: 'a key press brings the keyboard hints back' },
    { tdown: [150, 250] }, { tup: 0 }, { eval: 'et.fast(0.1).state' },
    { expect: ui('touch'), as: 'and a touch brings the touch controls back' },

    // --- a smaller phone
    { device: SMALL },
    { goto: 'res=2' }, { wait: 1200 },
    { expect: `${fits('.t-stack')} === true`, as: 'the title fits a small phone' },
    { shot: 't-small-title' },
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
    { goto: 'res=1' }, { wait: 1200 },
    { expect: `${ui('touch')} && !${shown('#rotate')}`, as: 'a tablet gets the touch controls' },
    { shot: 't-tablet-title' },
    { tap: '.go' }, { eval: 'et.fast(0.1).state' },
    { expect: `${D}.state === 'play'`, as: 'tablet: a tap on "Tap to scurry" starts' },
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
    { goto: 'res=1' }, { wait: 1200 },
    { expect: `${fits('.t-stack')} === true && !${shown('#rotate')}`, as: 'tablet upright: the title fits, and nobody is asked to turn it' },
    { goto: 'skip=1&safe=1&at=8,16&res=1&power=thunder' },
    { eval: 'et.fast(1).state' }, { wait: 500 },
    { shot: 't-tablet-upright' },
    { tap: '.t-pause' }, { eval: 'et.fast(0.1); et.paused' }, { wait: 700 },
    { expect: `et.paused && ${fits('.pause .sheet')} === true`, as: 'tablet upright: the pause card fits' },

    // --- and none of it shows on a desk
    { device: null },
    { goto: 'skip=1&safe=1&at=8,16' },
    { eval: 'et.fast(0.5).state' },
    { expect: `!${ui('touch')} && !${shown('.t-dash')} && !${shown('.tstick')} && !${shown('.t-pause')} && ${shown('.views')}`, as: 'a desktop sees no touch controls' },
  ],
};
