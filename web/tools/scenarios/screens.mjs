// Every screen from the splash to the end card, with the keyboard: splash, title, how to play, the level select and
// its lock, the card before a level, play, the pause card and the end card, then on to the next level and back
// again, all in one page that is never reloaded. It also checks what changing level must not do: lose a record,
// drop the sound, or leave anything behind (listeners, bits of page, graphics memory). And the one camera.
// Pictures of each screen at 1280 x 720 go to .shots/s-*.png (touch.mjs takes the same screens at phone sizes).
const S = 'et.shell.screen';
const D = 'et.debug()';
const on = (sel) => `document.querySelector('${sel}').classList.contains('on')`;
const lit = `(document.querySelector('.screen.on .btn.on')?.dataset.a ?? null)`;
const chosen = `[...document.querySelectorAll('.pcard[data-i]')].findIndex((c) => c.classList.contains('on'))`;
/** Tap a key and let the game see it (drawn in software a frame can take a while to come round). */
const key = (code, as) => [{ press: code }, { eval: `et.fast(0.1); ${S} + ' / ' + et.state`, as: as ?? code }];
/** Wait for a level that is on its way, and let it draw. */
const up = (as = 'the level that is up') => [{ eval: 'et.shell.settled()', as }, { eval: 'et.fast(0.2).level' }];
const exit = 'et.level.burrows.find((b) => b.kind === "exit")';
/** Go home with whatever has been banked: stand on the way out and hold SPACE. */
const goHome = [
  { eval: `et.teleport(${exit}.x, ${exit}.z, 0); et.fast(0.4).state`, as: 'on the way out' },
  { down: 'Space' }, { eval: 'et.fast(1.6).state', as: 'holding SPACE' }, { up: 'Space' },
  { eval: 'et.fast(6).state', as: 'then' },
  { expect: `${D}.state === 'won'`, as: 'home' },
];
const record = (id) => `JSON.parse(localStorage.getItem('eggthief.best.${id}') ?? 'null')`;
/** What must stay the same however many times the level changes. */
const held = `({ level: et.info.id, nodes: document.querySelectorAll('*').length, canvases: document.querySelectorAll('#game canvas').length, geometries: ${D}.geometries, textures: ${D}.textures, programs: ${D}.programs })`;
const same = (a, b) => `['nodes', 'canvases', 'geometries', 'textures', 'programs'].every((k) => ${a}[k] === ${b}[k]) || JSON.stringify([${a}, ${b}])`;

export default {
  size: [1280, 863], // a 1280 x 720 page (headless Chromium's window is 143px taller than what it shows)
  steps: [
    // ---- a first visit: nothing remembered. The splash.
    { goto: 'splash=0' },
    { eval: 'localStorage.clear(); 1', as: 'forget everything' },
    { goto: 'splash=60' },
    { expect: 'innerWidth === 1280 && innerHeight === 720', as: 'the page is 1280 x 720' },
    { expect: `${S} === 'splash' && ${on('.splash')} && !${on('.title')}`, as: 'it opens on the splash' },
    { expect: `/Media Jousts\\s+presents/.test(document.querySelector('.splash .sp').innerText)`, as: 'which says "Media Jousts presents"' },
    { expect: `!document.querySelector('.splash').classList.contains('has-logo') && getComputedStyle(document.querySelector('.splash img')).display === 'none'`, as: 'with no logo picture yet, the name is spelt out' },
    { eval: `et.fast(1); ${S}`, as: 'a second later' },
    { expect: `${S} === 'splash' && ${D}.level === 'desert'`, as: 'the desert is up behind it the first time' },
    { shot: 's-splash' },
    ...key('KeyZ', 'any key'),
    { expect: `${S} === 'title' && ${on('.title')} && !${on('.splash')}`, as: 'any key sends the splash away' },
    { goto: 'splash=2' },
    { eval: `et.fast(2.2); ${S}`, as: 'left alone for two seconds' },
    { expect: `${S} === 'title'`, as: 'the splash goes by itself after two seconds' },

    // ---- the title: one main thing to do, and the rest smaller
    { goto: 'splash=0&safe=1' }, // (nothing can catch the lizard: this run is about the screens)
    { eval: 'window.__page = 1; window.__sound = et.sound; window.__canvas = document.querySelector("#game canvas"); 1', as: 'mark this page: it must never be reloaded' },
    { wait: 1200 },
    { expect: `${S} === 'title' && ${D}.state === 'title' && !${on('.splash')}`, as: '?splash=0 opens on the title' },
    { expect: `!document.querySelector('.title .howto, .title .how, .views, .vpick, .best')`, as: 'no how-to cards, camera picker or best-run ticket on the title' },
    { expect: `[...document.querySelectorAll('.title .btn')].filter((b) => b.offsetParent).map((b) => b.dataset.a).join() === 'play,how,sound'`, as: 'it offers Play, How to play and Sound (and Full screen only to a touch screen)' },
    { expect: `${lit} === 'play'`, as: 'Play is the lit one' },
    { shot: 's-title' },
    ...key('ArrowRight'),
    { expect: `${lit} === 'how'`, as: 'right moves the light to How to play' },
    ...key('Enter', 'ENTER on How to play'),
    { expect: `${S} === 'how' && ${on('.howcard')} && !${on('.title')} && document.querySelectorAll('.howcard .how').length === 5`, as: 'the five how-to cards are on their own card' },
    { wait: 700 }, { shot: 's-how' },
    ...key('Escape', 'ESC'),
    { expect: `${S} === 'title' && ${on('.title')} && !${on('.howcard')}`, as: 'ESC goes back to the title' },
    ...key('ArrowRight'), ...key('ArrowRight'),
    { expect: `${lit} === 'sound'`, as: 'right again: Sound' },
    { eval: 'window.muted0 = et.sound.muted; 1' },
    ...key('Space', 'SPACE on Sound'),
    { expect: 'et.sound.muted !== muted0', as: 'it turns the sound off and on' },
    ...key('Space'), ...key('ArrowLeft'), ...key('ArrowLeft'), ...key('ArrowLeft'),
    { expect: `${lit} === 'play' && et.sound.muted === muted0`, as: 'left goes back to Play, and stops there' },

    // ---- the level select
    ...key('Space', 'SPACE on Play'),
    { expect: `${S} === 'select' && ${on('.select')} && !${on('.title')} && ${D}.state === 'title'`, as: 'Play opens the level select, the level still going on behind it' },
    { expect: `document.querySelectorAll('.pcard[data-i]').length === 2 && document.querySelectorAll('.pcard.back').length === 2`, as: 'two postcards, and two face down for the maps on the way' },
    { expect: `[...document.querySelectorAll('.pcard[data-i] .pc-name')].map((e) => e.textContent).join() === 'Africa,Rainforest' && [...document.querySelectorAll('.pc-line')].map((e) => e.textContent).join() === 'The Long Way Home,When It Rains'`, as: 'named Africa and Rainforest, each with its line' },
    { wait: 1500 }, // (the chosen card takes a moment to be lifted, and longer when the machine is busy)
    { expect: `[...document.querySelectorAll('.pc-pic img')].every((i) => i.complete && i.naturalWidth === 640)`, as: 'each has its picture' },
    { expect: `[...document.querySelectorAll('.pcard[data-i]')].every((c) => c.querySelectorAll('.pc-strip i').length === 6)`, as: 'and a strip of its colours' },
    { expect: `${chosen} === 0 && /Not played yet/.test(document.querySelector('.pcard.on').innerText)`, as: 'Africa is chosen, and has no record yet' },
    { eval: `[...document.querySelectorAll('.pcard[data-i]')].map((c) => getComputedStyle(c).transform)`, as: 'how the cards lie' },
    { expect: `(() => { const t = (c) => getComputedStyle(c).transform; const [a, b] = document.querySelectorAll('.pcard[data-i]'); const m = new DOMMatrix(t(a)), n = new DOMMatrix(t(b)); return Math.abs(m.b) < 0.001 && m.f < -5 && Math.abs(n.b) > 0.01; })()`, as: 'the chosen card is lifted and straight, the other crooked' },
    { expect: `document.querySelectorAll('.pcard[data-i]')[1].classList.contains('locked') && /Get home from Africa once/.test(document.querySelector('.pcard.locked .pc-rec').textContent)`, as: 'the rainforest is locked, and says how to open it' },
    { shot: 's-select' },
    ...key('ArrowRight'),
    { expect: `${chosen} === 1 && /Locked/.test(document.querySelector('.btn[data-a="sel-go"]').textContent)`, as: 'right chooses the rainforest; the button says Locked' },
    { eval: 'et.fast(0.6); 1' }, ...up(),
    { expect: `${D}.level === 'desert'`, as: 'a locked level is not put up behind the table' },
    ...key('Enter', 'ENTER on a locked card'),
    { expect: `${S} === 'select'`, as: 'a locked card cannot be played' },
    { wait: 500 }, { shot: 's-select-locked' },
    ...key('ArrowRight'),
    { expect: `${chosen} === 1`, as: 'the face-down cards cannot be chosen' },
    ...key('Escape', 'ESC'),
    { expect: `${S} === 'title' && ${on('.title')} && !${on('.select')}`, as: 'ESC goes back to the title' },
    ...key('Enter'), ...key('Enter', 'ENTER on Africa'), ...up(),

    // ---- the card before a level, and how to play before a first run
    { expect: `${S} === 'card' && ${on('.lcard')} && !${on('.select')}`, as: 'choosing Africa shows its card' },
    { expect: `document.querySelector('.lc-name').textContent === 'Africa' && document.querySelector('.lc-idea').textContent === 'Collect eggs. Hide under bushes. Do not get eaten.'`, as: 'with its name and its one idea' },
    { expect: `document.querySelector('.lc-par b').textContent === Math.floor(et.level.parSeconds / 60) + ':' + String(et.level.parSeconds % 60).padStart(2, '0') && /no run yet/.test(document.querySelector('.lc-best').innerText)`, as: 'the time to beat, and no best yet' },
    { wait: 600 }, { shot: 's-card' },
    ...key('Escape', 'ESC'),
    { expect: `${S} === 'select' && ${chosen} === 0`, as: 'ESC goes back to the level select' },
    ...key('Space'), ...up(), ...key('Space', 'SPACE on Go'),
    { expect: `${S} === 'first' && ${on('.howcard')} && ${D}.state === 'title'`, as: 'before a first run: how to play' },
    { wait: 600 }, { shot: 's-first-run' },
    ...key('Space', 'SPACE on Got it'),
    { expect: `${S} === 'none' && ${D}.state === 'play' && !document.querySelector('.screen.on') && !document.querySelector('.hud').classList.contains('off')`, as: 'then play, with every card gone' },
    { expect: `et.lizard.dashCd === 0`, as: 'the key that said go was not also a dash' },
    { expect: `localStorage.getItem('eggthief.last') === 'desert' && localStorage.getItem('eggthief.howto') === '1'`, as: 'the level played last is remembered' },

    // ---- play: the one camera, as before
    { eval: 'et.teleport(27.5, 24.5); et.fast(2).view' }, { wait: 500 },
    { expect: `${D}.view === 'chase' && !document.querySelector('.views, .vpick')`, as: 'play is in the chase camera, with no picker' },
    { press: 'KeyC' }, { press: 'Digit1' }, { press: 'Digit2' }, { press: 'Digit3' },
    { eval: 'et.fast(0.3).view' },
    { expect: `${D}.view === 'chase'`, as: 'C and 1 2 3 do nothing' },
    { shot: 's-chase' },

    // ---- the pause card: a way back to the level select
    ...key('Escape', 'ESC'),
    { expect: `et.paused && ${on('.pause')} && !/camera/i.test(document.querySelector('.pause').textContent)`, as: 'ESC pauses; the card has no camera picker or camera hint' },
    { expect: `[...document.querySelectorAll('.pause .btn')].filter((b) => b.offsetParent).map((b) => b.dataset.a).join() === 'resume,restart,select' && ${lit} === 'resume'`, as: 'it offers Back to it, Start again and Level select' },
    ...key('ArrowRight'), ...key('ArrowRight'),
    { expect: `${lit} === 'select'`, as: 'right, right: Level select is lit' },
    { wait: 600 }, { shot: 's-pause' },
    ...key('Enter', 'ENTER on Level select'),
    { expect: `${S} === 'select' && !et.paused && !${on('.pause')} && ${D}.state === 'title' && ${D}.time === 0`, as: 'it leaves the run for the level select' },
    ...key('Enter'), ...up(), ...key('Enter', 'ENTER on Go'),
    { expect: `${S} === 'none' && ${D}.state === 'play'`, as: 'a second run starts without the how-to card' },
    ...key('Escape'), ...key('Space', 'SPACE on the pause card'),
    { expect: `!et.paused && et.lizard.dashCd === 0`, as: 'SPACE presses the lit button (Back to it), and is not a dash' },

    // ---- home: the end card, the record, and the rainforest opening
    ...goHome,
    { expect: `${record('desert')}?.stars >= 1 && ${record('desert')}.eggs === 0`, as: 'the run is kept under the level\'s id' },
    { expect: `localStorage.getItem('eggthief.best.The Long Way Home') === null`, as: 'and not under its title' },
    { expect: `[...document.querySelectorAll('.results .btn')].filter((b) => b.offsetParent).map((b) => b.dataset.a).join() === 'again,next,select' && ${lit} === 'again'`, as: 'the end card offers Go again, Next level and Level select' },
    { expect: `document.querySelector('.r-open').textContent === 'New map open: Rainforest'`, as: 'and says the rainforest is open' },
    { wait: 5000 },
    { expect: `(() => { const r = document.querySelector('.results .paper').getBoundingClientRect(); return r.top > 0 && r.bottom < innerHeight; })()`, as: 'it fits the window' },
    { shot: 's-results' },
    ...key('Enter', 'ENTER on Go again'),
    { expect: `${D}.state === 'play' && ${D}.banked === 0 && ${D}.level === 'desert'`, as: 'Go again starts a fresh run' },
    ...goHome,
    { expect: `document.querySelector('.r-open').textContent === ''`, as: 'the second time nothing new has opened' },
    ...key('ArrowRight'),
    { expect: `${lit} === 'next'`, as: 'right: Next level is lit' },
    { eval: `et.sound.enabled = true; 1`, as: 'sound switched on' }, { press: 'KeyV' }, { wait: 700 },
    { eval: `window.__ctx = et.sound.live; et.sound.live?.state`, as: 'the audio' },
    ...key('Enter', 'ENTER on Next level'), ...up(),

    // ---- the rainforest, on the same page, the same canvas and the same sound
    { expect: `${D}.level === 'rainforest' && et.level.theme.name === 'rainforest' && window.et === et.shell.game`, as: 'the rainforest is up, and window.et is its game' },
    { expect: `window.__page === 1`, as: 'the page was not reloaded' },
    { expect: `document.querySelectorAll('#game canvas').length === 1 && document.querySelector('#game canvas') === __canvas && !et.renderer.getContext().isContextLost()`, as: 'it is drawn on the same canvas' },
    { expect: `et.sound === __sound && !!__ctx && et.sound.live === __ctx && __ctx.state === 'running' && et.sound.theme === 'rainforest'`, as: 'the sound never stopped: one audio context, now playing the rainforest' },
    { eval: `et.sound.enabled = false; 1` },
    { expect: `${S} === 'card' && document.querySelector('.lc-name').textContent === 'Rainforest' && document.querySelector('.lc-idea').textContent === 'When it rains, the crossings move.'`, as: 'its card says its one new idea' },
    { expect: `document.querySelector('.lc-par b').textContent === '12:00'`, as: 'and its own time to beat' },
    { wait: 700 }, { shot: 's-card-rainforest' },
    ...key('Enter', 'ENTER on Go'),
    { expect: `${S} === 'none' && ${D}.state === 'play' && ${D}.level === 'rainforest' && !!${D}.zone`, as: 'and the rainforest plays' },
    { eval: 'et.fast(1).zone' }, { wait: 1500 },
    { shot: 's-rainforest' },
    ...goHome,
    { expect: `${record('rainforest')}?.stars >= 1 && ${record('desert')}?.stars >= 1`, as: 'each level keeps its own record' },
    { expect: `[...document.querySelectorAll('.results .btn')].filter((b) => b.offsetParent).map((b) => b.dataset.a).join() === 'again,select'`, as: 'the last level\'s end card has no Next level' },
    ...key('ArrowRight'), ...key('Enter', 'ENTER on Level select'),

    // ---- the level select again: records on the cards, and each choice put up behind the table
    { expect: `${S} === 'select' && ${chosen} === 1 && !document.querySelector('.pcard.locked')`, as: 'the level select opens on the rainforest, now unlocked' },
    { expect: `[...document.querySelectorAll('.pcard[data-i]')].every((c) => c.querySelectorAll('.b-stars .won').length >= 1 && /^0:\\d\\d$/.test(c.querySelector('.pc-rec b').textContent) && /eggs/.test(c.querySelector('.pc-rec').textContent))`, as: 'both cards show stars, a best time and eggs home' },
    { wait: 1500 }, { eval: `window.__a = ${held}; __a`, as: 'held with the rainforest up' },
    { shot: 's-select-open' },
    // Count anything that starts listening to the window or the page from here on.
    { eval: `window.__listens = 0; for (const t of [window, document]) { const add = t.addEventListener.bind(t); t.addEventListener = (...a) => { __listens++; return add(...a); }; } 1` },
    ...key('ArrowLeft'),
    { eval: 'et.fast(0.2).level', as: 'just chosen' },
    { expect: `${D}.level === 'rainforest'`, as: 'a card just chosen is not fetched at once' },
    { eval: 'et.fast(0.4); 1' }, ...up(),
    { expect: `${D}.level === 'desert' && ${S} === 'select' && ${D}.state === 'title'`, as: 'left: Africa comes up behind the table' },
    { wait: 1500 }, { eval: `window.__d = ${held}; __d`, as: 'held with the desert up' },
    ...key('ArrowRight'), { eval: 'et.fast(0.5); 1' }, ...up(), { wait: 1500 },
    { expect: `${D}.level === 'rainforest'`, as: 'right: the rainforest again' },
    { expect: same('__a', held), as: 'the rainforest a second time holds exactly what it did the first' },
    ...key('ArrowLeft'), { eval: 'et.fast(0.5); 1' }, ...up(), { wait: 1500 },
    { expect: same('__d', held), as: 'and so does the desert' },
    // Left and right faster than a level can be fetched: only the last one asked for comes up.
    ...key('ArrowRight'), { eval: 'et.fast(0.4); 1' }, ...key('ArrowLeft'), { eval: 'et.fast(0.4); 1' }, ...key('ArrowRight'), { eval: 'et.fast(0.4); 1' }, ...up(), { wait: 1500 },
    { expect: `${D}.level === 'rainforest' && window.et === et.shell.game`, as: 'changing one\'s mind mid-fetch ends on the last choice' },
    { expect: same('__a', held), as: 'with nothing left over from the ones thrown away' },
    { expect: `window.__listens === 0`, as: 'six changes of level added no listeners to the window or the page' },
    { expect: `window.__page === 1 && document.querySelector('#game canvas') === __canvas && et.sound === __sound`, as: 'still the same page, canvas and sound' },
    ...key('ArrowLeft'), { eval: 'et.fast(0.5); 1' }, ...up(),
    ...key('Enter'), ...up(),
    { expect: `${S} === 'card' && /^0:\\d\\d$/.test(document.querySelector('.lc-best b').textContent) && document.querySelectorAll('.lc-best .b-stars .won').length >= 1`, as: 'Africa\'s card now shows the best run' },
    { wait: 600 }, { shot: 's-card-best' },
    ...key('Enter'),
    { expect: `${D}.state === 'play' && ${D}.level === 'desert' && ${D}.time < 1`, as: 'and the desert plays again after all that' },

    // ---- what is remembered on the next visit
    { goto: 'splash=0' }, { wait: 800 },
    { expect: `${D}.level === 'desert' && ${S} === 'title'`, as: 'the title shows the level played last (the desert)' },
    { eval: `localStorage.setItem('eggthief.last', 'rainforest'); 1` },
    { goto: 'splash=0' }, { wait: 1200 },
    { expect: `${D}.level === 'rainforest' && ${S} === 'title'`, as: 'and the rainforest, when that was the last' },
    { shot: 's-title-rainforest' },

    // ---- an old save: the desert's best run under its old name is carried over, and opens the rainforest
    { eval: `localStorage.clear(); localStorage.setItem('eggthief.best.The Long Way Home', JSON.stringify({ time: 134, stars: 3, eggs: 37, total: 37, medals: 5 })); 1`, as: 'a save from before levels had ids' },
    { goto: 'splash=0' },
    ...key('Enter'), { wait: 700 },
    { expect: `${S} === 'select' && /2:14/.test(document.querySelector('.pcard.on .pc-rec').textContent) && document.querySelectorAll('.pcard.on .b-stars .won').length === 3 && /37\\/37 eggs/.test(document.querySelector('.pcard.on').innerText)`, as: 'the old best run is on Africa\'s card' },
    { expect: `${record('desert')}?.time === 134 && localStorage.getItem('eggthief.best.The Long Way Home') !== null`, as: 'copied to the new key, the old one left alone' },
    { expect: `!document.querySelector('.pcard.locked')`, as: 'and it counts: the rainforest is open' },
    { shot: 's-select-old-save' },
    ...key('Enter'), ...up(), ...key('Enter'),
    { expect: `${D}.state === 'play'`, as: 'someone with a finished run is not shown how to play' },

    // ---- the golden egg on a card
    { eval: `localStorage.setItem('eggthief.best.desert', JSON.stringify({ time: 134, stars: 3, eggs: 37, total: 37, medals: 6, gold: true })); 1` },
    { goto: 'splash=0' }, ...key('Enter'), { wait: 700 },
    { expect: `!!document.querySelector('.pcard.on .pc-rec .g-egg') && !document.querySelectorAll('.pcard[data-i]')[1].querySelector('.g-egg')`, as: 'a card shows the golden egg once it has been found there' },
    { shot: 's-select-gold' },

    // ---- the lock, and the ways round it
    { eval: 'localStorage.clear(); 1' },
    { goto: 'splash=0&unlock=1' }, ...key('Enter'),
    { expect: `${S} === 'select' && !document.querySelector('.pcard.locked')`, as: '?unlock=1 opens everything' },
    ...key('ArrowRight'), { eval: 'et.fast(0.5); 1' }, ...up(),
    { expect: `${D}.level === 'rainforest'`, as: 'and the rainforest can be chosen' },
    { wait: 1200 }, { shot: 's-select-rainforest' },
    { goto: 'splash=0&level=rainforest' },
    { expect: `${D}.level === 'rainforest' && ${S} === 'title'`, as: '?level=rainforest goes there though it is locked' },
    ...key('Enter'), ...key('Enter'), ...up(), ...key('Enter'), ...key('Enter'),
    { expect: `${D}.state === 'play' && ${D}.level === 'rainforest'`, as: 'and it can be played from the menus' },
    { goto: 'skip=1&level=rainforest' },
    { expect: `${D}.state === 'play' && ${D}.level === 'rainforest' && ${S} === 'none' && !document.querySelector('.screen.on')`, as: '?skip=1&level=rainforest goes straight into play' },
    { goto: 'skip=1' },
    { expect: `${D}.state === 'play' && ${D}.level === 'desert' && !document.querySelector('.screen.on')`, as: '?skip=1 alone plays the desert, with no menus' },
    { expect: `localStorage.getItem('eggthief.last') === 'rainforest'`, as: 'whichever level was played last' },
    { goto: 'skip=1&safe=1&view=tilt&at=8,27' },
    { eval: 'et.fast(1).view' },
    { expect: `${D}.view === 'chase'`, as: '?view=tilt is not a view any more' },
  ],
};
