// A PS5 pad that isn't there: the page is handed a made-up DualSense and the game is played with it.
// It checks the wiring (which button does what, on each layout a browser may report); how a real pad feels in the
// hand is for a person to say.
const DUALSENSE = 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)';
const install = `(() => {
  const btn = () => ({ pressed: false, touched: false, value: 0 });
  window.rumbles = [];
  // On Linux the pad's motion sensor turns up as a "gamepad" of its own, with axes that never rest.
  const sensor = { id: 'Sony Interactive Entertainment DualSense Wireless Controller Motion Sensors', index: 0, connected: true, mapping: '', axes: [0.4, -0.9, 0.2, 0, 0, 0], buttons: [] };
  window.pad = { id: ${JSON.stringify(DUALSENSE)}, index: 1, connected: true, mapping: 'standard', timestamp: 0,
    axes: [0, 0, 0, 0, 0, 0, 0, 0, 0, 9], buttons: Array.from({ length: 18 }, btn),
    vibrationActuator: { playEffect: (type, o) => { window.rumbles.push(type + ' ' + o.duration); return Promise.resolve('complete'); } } };
  navigator.getGamepads = () => [sensor, window.pad, null, null];
  window.B = (i, on) => { pad.buttons[i].pressed = !!on; pad.buttons[i].value = on ? 1 : 0; return i; };
  // Tap a button: down for a few frames of the game, then up.
  window.tap = (i) => { B(i, 1); et.fast(0.1); B(i, 0); return et.fast(0.1); };
  window.rest = () => { pad.axes.fill(0); pad.axes[9] = 9; pad.buttons.forEach((b, i) => B(i, 0)); et.fast(0.2); return 1; };
  return 'a pad';
})()`;
const ui = (cls) => `document.getElementById('ui').classList.contains('${cls}')`;
const D = 'et.debug()';
const S = 'et.shell.screen';
const lit = `(document.querySelector('.screen.on .btn.on')?.dataset.a ?? null)`;
const chosen = `[...document.querySelectorAll('.pcard[data-i]')].findIndex((c) => c.classList.contains('on'))`;
/** Is that pad button's picture showing inside the element (and no key cap)? */
const shows = (sel, shape) => `(() => { const e = document.querySelector('${sel}'); const vis = (x) => !!x && x.getClientRects().length > 0; return vis(e?.querySelector('.padbtn.${shape}')) && ![...(e?.querySelectorAll('kbd') ?? [])].some(vis); })()`;
/** Wait for a level that is on its way. */
const up = [{ eval: 'et.shell.settled()', as: 'the level that is up' }, { eval: 'et.fast(0.2).level' }];
const exit = 'et.level.burrows.find((b) => b.kind === "exit")';
export default {
  size: [1280, 863], // a 1280 x 720 page
  steps: [
    // --- the splash and the title: any button wakes the hints up as PlayStation shapes
    { goto: 'splash=60&unlock=1&safe=1' },
    { eval: install, as: 'plugged in' },
    { expect: `${S} === 'splash'`, as: 'the splash is up' },
    { eval: `tap(5); ${S}`, as: 'R1 on the splash' },
    { expect: `${S} === 'title'`, as: 'any button sends the splash away' },
    { expect: `${ui('pad')} && !${ui('xbox')}`, as: 'the title shows PlayStation buttons' },
    { expect: `${lit} === 'play' && ${shows('.title .btn.on', 'cross')}`, as: 'Play is lit, with a cross on it' },
    { wait: 700 }, { shot: 'pad-title' },
    { eval: `B(15, 1); et.fast(0.5); B(15, 0); et.fast(0.1); ${lit}`, as: 'd-pad right, held half a second' },
    { expect: `${lit} === 'how'`, as: 'the d-pad moves the light one button a push, however long it is held' },
    { eval: `pad.axes[0] = 1; et.fast(0.3); pad.axes[0] = 0; et.fast(0.1); ${lit}`, as: 'a flick of the stick, right' },
    { expect: `${lit} === 'sound'`, as: 'so does a flick of the left stick' },
    { eval: `pad.axes[0] = -1; et.fast(0.1); pad.axes[0] = 0; et.fast(0.1); B(14, 1); et.fast(0.1); B(14, 0); et.fast(0.1); ${lit}`, as: 'stick left, d-pad left' },
    { expect: `${lit} === 'play'`, as: 'and back again' },
    { eval: `tap(1); ${S}`, as: 'circle on the title' },
    { expect: `${S} === 'title'`, as: 'circle does nothing on the title' },

    // --- the level select
    { eval: `tap(0); ${S}`, as: 'cross on Play' },
    { expect: `${S} === 'select' && ${chosen} === 0`, as: 'cross opens the level select' },
    { expect: `${shows('.btn[data-a="sel-go"]', 'cross')} && ${shows('.btn[data-a="sel-back"]', 'circle')} && !!document.querySelector('.sel-keys .dpad')?.getClientRects().length`, as: 'its buttons show cross, circle and the d-pad' },
    { wait: 900 }, { shot: 'pad-select' },
    { eval: `B(15, 1); et.fast(0.1); B(15, 0); et.fast(0.1); ${chosen}`, as: 'd-pad right' },
    { expect: `${chosen} === 1`, as: 'the d-pad chooses the next postcard' },
    { eval: 'et.fast(0.5); 1' }, ...up,
    { expect: `${D}.level === 'rainforest' && ${S} === 'select'`, as: 'and its level comes up behind the table' },
    { eval: `B(15, 1); et.fast(0.1); B(15, 0); et.fast(0.1); pad.axes[0] = -1; et.fast(0.1); pad.axes[0] = 0; et.fast(0.1); ${chosen}`, as: 'd-pad right at the end of the row, then stick left' },
    { expect: `${chosen} === 0`, as: 'the stick chooses too' },
    { eval: 'et.fast(0.5); 1' }, ...up,
    { expect: `${D}.level === 'desert'`, as: 'and Africa comes back up' },
    { eval: `tap(1); ${S}`, as: 'circle' },
    { expect: `${S} === 'title'`, as: 'circle goes back to the title' },
    { eval: `tap(0); B(15, 1); et.fast(0.1); B(15, 0); et.fast(0.6); ${chosen}`, as: 'cross, d-pad right' }, ...up,

    // --- the card before a level
    { eval: `tap(0); ${S}`, as: 'cross on the rainforest' }, ...up,
    { expect: `${S} === 'card' && document.querySelector('.lc-name').textContent === 'Rainforest' && ${lit} === 'card-go'`, as: 'cross opens its card, with Go lit' },
    { expect: `${shows('.lcard .btn.on', 'cross')} && ${shows('.btn[data-a="card-back"]', 'circle')}`, as: 'Go shows a cross, Back a circle' },
    { wait: 700 }, { shot: 'pad-card' },
    { eval: `tap(1); ${S}`, as: 'circle' },
    { expect: `${S} === 'select' && ${chosen} === 1`, as: 'circle goes back to the level select' },
    { eval: `tap(0); ${S}`, as: 'cross' }, ...up,
    { eval: `tap(0); ${S}`, as: 'cross on Go' },
    { expect: `${S} === 'first' && ${lit} === 'how-ok'`, as: 'a first run is shown how to play' },
    { expect: `${shows('.howcard .how:nth-child(2) .pic', 'cross')}`, as: 'in pad buttons' },
    { wait: 700 }, { shot: 'pad-how' },
    { eval: `tap(1); ${S}`, as: 'circle' }, ...up,
    { expect: `${S} === 'card'`, as: 'circle goes back to the card' },
    { eval: `tap(0); tap(0); ${S}`, as: 'cross, cross' },
    { expect: `${S} === 'none' && ${D}.state === 'play' && ${D}.level === 'rainforest'`, as: 'cross on "Got it" starts the rainforest' },
    { expect: 'et.lizard.dashCd === 0', as: 'and is not also a dash' },

    // --- the pause card: on to the level select
    { eval: 'tap(9); et.paused', as: 'Options' },
    { expect: `et.paused === true && ${lit} === 'resume'`, as: 'Options pauses, with "Back to it" lit' },
    { eval: `B(15, 1); et.fast(0.1); B(15, 0); et.fast(0.1); B(15, 1); et.fast(0.1); B(15, 0); et.fast(0.1); ${lit}`, as: 'd-pad right, twice' },
    { expect: `${lit} === 'select' && et.paused === true && Math.abs(${D}.time) < 0.5`, as: 'the d-pad moves the light to Level select (and the lizard stays put)' },
    { wait: 600 }, { shot: 'pad-pause-select' },
    { eval: `tap(0); ${S}`, as: 'cross' },
    { expect: `${S} === 'select' && !et.paused && ${D}.state === 'title' && ${chosen} === 1`, as: 'cross on Level select leaves the run for the level select' },
    { eval: `B(14, 1); et.fast(0.1); B(14, 0); et.fast(0.6); ${chosen}`, as: 'd-pad left' }, ...up,
    { eval: `tap(0); ${S}`, as: 'cross on Africa' }, ...up,
    { eval: `tap(0); ${S}`, as: 'cross on Go' },
    { expect: `${S} === 'none' && ${D}.state === 'play' && ${D}.level === 'desert'`, as: 'and Africa is played with the pad' },

    // --- the end card
    { eval: `et.teleport(${exit}.x, ${exit}.z, 0); et.fast(0.4); B(0, 1); et.fast(1.7); B(0, 0); et.fast(6).state`, as: 'cross held on the way out' },
    { expect: `${D}.state === 'won' && ${lit} === 'again'`, as: 'home, with Go again lit' },
    { expect: `${shows('.results .btn.on', 'cross')} && !!document.querySelector('.results .navhint .dpad')?.getClientRects().length`, as: 'the end card shows a cross and the d-pad' },
    { wait: 5000 }, { shot: 'pad-results' },
    { eval: `B(15, 1); et.fast(0.1); B(15, 0); et.fast(0.1); ${lit}`, as: 'd-pad right' },
    { expect: `${lit} === 'next'`, as: 'the d-pad moves the light to Next level' },
    { eval: `tap(0); ${S}`, as: 'cross on Next level' }, ...up,
    { expect: `${S} === 'card' && ${D}.level === 'rainforest'`, as: 'cross on Next level goes to the rainforest\'s card' },
    { eval: `tap(1); tap(1); ${S}`, as: 'circle, circle' },
    { expect: `${S} === 'title'`, as: 'and circle leads all the way back to the title' },

    // --- an Xbox pad gets letters on the menus too
    { eval: `rest(); pad.id = 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)'; tap(5); tap(0); ${S}`, as: 'an Xbox pad: RB, then A' },
    { expect: `${ui('xbox')} && ${S} === 'select'`, as: 'an Xbox pad gets letters, and A opens the level select' },
    { expect: `(() => { const b = (a) => document.querySelector('.btn[data-a="' + a + '"] .padbtn b'); return getComputedStyle(b('sel-go')).display === 'block' && b('sel-go').textContent === 'A' && b('sel-back').textContent === 'B'; })()`, as: 'Play shows an A and Back a B' },
    { wait: 700 }, { shot: 'pad-select-xbox' },

    // --- play
    { goto: 'skip=1&safe=1&mute=1&at=8,16' },
    { eval: install, as: 'plugged in' },
    { eval: 'et.teleport(8.5, 16.5, 0); et.fast(0.3).z', as: 'z at rest (the sensor is ignored)' },
    { expect: `Math.abs(${D}.z - 16.5) < 0.05 && Math.abs(${D}.x - 8.5) < 0.05`, as: 'the motion sensor does not steer' },
    { eval: 'pad.axes[1] = -1; et.fast(0.7).z', as: 'stick up' },
    { expect: `${D}.z < 15.6`, as: 'the left stick runs' },
    { eval: 'pad.axes[1] = -0.12; pad.axes[0] = 0.1; const z0 = et.debug().z; et.fast(0.5); Math.abs(et.debug().z - z0)', as: 'a worn stick, drift' },
    { expect: `et.lizard.speed < 0.2`, as: 'a little stick drift does nothing' },
    { eval: 'rest(); et.teleport(8.5, 16.5, 0); B(15, 1); et.fast(0.5); B(15, 0); et.fast(0.1).x', as: 'd-pad right' },
    { expect: `${D}.x > 9`, as: 'the d-pad runs too' },
    { eval: 'rest(); pad.axes[1] = -1; B(0, 1); et.fast(0.05); const d = et.lizard.dashing; B(0, 0); rest(); d', as: 'cross' },
    { expect: 'et.lizard.dashCd > 0', as: 'cross dashes' },
    { expect: 'rumbles.length > 0 && rumbles[0].startsWith("dual-rumble")', as: 'the pad shakes' },
    { eval: 'et.fast(3); const y0 = et.rig.yaw; pad.axes[2] = 1; et.fast(0.5); pad.axes[2] = 0; et.rig.yaw - y0', as: 'right stick' },
    { expect: 'Math.abs(et.rig.yaw) > 0.5', as: 'the right stick looks round' },
    { eval: `rest(); et.give('thunder'); et.fast(0.3).power`, as: 'holding' },
    { eval: 'tap(3).power', as: 'triangle' },
    { expect: `${D}.power === null`, as: 'triangle uses the power egg' },
    { eval: 'tap(8); tap(11); tap(10).view', as: 'Create, R3, L3' },
    { expect: `${D}.view === 'chase'`, as: 'Create and the stick clicks do nothing to the camera' },

    // --- the pause card
    { eval: 'tap(9); et.paused', as: 'Options' },
    { expect: 'et.paused === true', as: 'Options pauses' },
    { wait: 600 }, { shot: 'pad-pause' },
    { eval: `et.give('ghost'); tap(1); et.paused`, as: 'circle' },
    { expect: `et.paused === false && ${D}.power === 'ghost'`, as: 'circle backs out, and keeps the egg' },
    { eval: 'tap(17); et.paused', as: 'touchpad' },
    { expect: 'et.paused === true', as: 'the touchpad click pauses' },
    { eval: 'et.fast(0.2); tap(4); et.paused + " " + et.playTime.toFixed(1)', as: 'L1' },
    { expect: 'et.paused === false && et.playTime < 1', as: 'L1 on the pause card starts again' },

    // --- a browser that has not mapped the pad (the kernel's order: triangle and square change places, the
    //     right stick and the d-pad are other axes)
    { eval: `rest(); pad.mapping = ''; pad.id = 'Sony Interactive Entertainment DualSense Wireless Controller'; et.teleport(8.5, 16.5, 0); et.give('ghost'); et.fast(0.3).power`, as: 'unmapped, holding' },
    { eval: 'tap(2).power', as: 'button 2 (triangle here)' },
    { expect: `${D}.power === 'ghost!'`, as: 'unmapped: triangle uses the egg' },
    { eval: 'et.fast(8); rest(); et.teleport(8.5, 16.5, 0); pad.axes[6] = 1; et.fast(0.5); pad.axes[6] = 0; et.fast(0.1).x', as: 'hat right' },
    { expect: `${D}.x > 9`, as: 'unmapped: the d-pad runs' },
    { eval: 'et.fast(3); window.yawWas = et.rig.yaw; pad.axes[3] = -1; et.fast(0.5); pad.axes[3] = 0; et.rig.yaw - yawWas', as: 'right stick (axis 3)' },
    { expect: 'et.rig.yaw - yawWas < -0.5', as: 'unmapped: the right stick is read from its own axis' },
    { eval: 'pad.axes[1] = -1; B(3, 1); et.fast(0.05); B(3, 0); rest(); et.lizard.dashCd', as: 'button 3 (square here)' },
    { expect: 'et.lizard.dashCd > 0', as: 'unmapped: square dashes' },
    { expect: `${ui('pad')} && !${ui('xbox')}`, as: 'still PlayStation shapes' },

    // --- an Xbox pad gets letters
    { eval: `rest(); pad.mapping = 'standard'; pad.id = 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)'; tap(5); 1` },
    { expect: ui('xbox'), as: 'an Xbox pad gets letters' },
    // --- and the keyboard takes the hints back
    { press: 'KeyM' }, { eval: 'et.fast(0.1).state' },
    { expect: `!${ui('pad')}`, as: 'a key press brings the keyboard hints back' },
  ],
};
