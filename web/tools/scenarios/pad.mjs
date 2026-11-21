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
export default {
  size: [1280, 720],
  steps: [
    // --- the title: any button wakes the hints up as PlayStation shapes
    { goto: 'mute=1' },
    { eval: install, as: 'plugged in' },
    { eval: 'tap(5).state', as: 'R1 on the title' },
    { expect: `${ui('pad')} && !${ui('xbox')}`, as: 'the title shows PlayStation buttons' },
    { wait: 700 }, { shot: 'pad-title' },
    { eval: 'tap(0).state', as: 'cross' },
    { expect: `${D}.state === 'play'`, as: 'cross starts the game' },

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
    { eval: 'const v = et.debug().view; tap(8); v + " -> " + et.debug().view', as: 'Create' },
    { expect: `${D}.view !== 'chase'`, as: 'Create switches camera' },
    { eval: 'tap(11); tap(10).view', as: 'R3, L3' },
    { expect: `${D}.view === 'chase'`, as: 'two stick clicks come back round to the low camera' },

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
