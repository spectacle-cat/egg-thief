// A whole rain in the rainforest: a ford crossed dry, a dash over the brook, the ford shut in the rain, the log in
// each resting place and crossed in the rain, a dash that cannot clear the flood, and a lizard caught on a ford as
// it floods washed back to its bank with its eggs.
const S = 'Math.PI'; // facing south
const go = (x, z, h) => ({ eval: `et.teleport(${x}, ${z}, ${h}); et.fast(0.2); 1`, as: `to ${x},${z}` });
const walk = (seconds) => [{ down: 'KeyW' }, { eval: `et.fast(${seconds}).z`, as: 'walked to z' }, { up: 'KeyW' }];
const sky = (to) => ({ eval: `(() => { for (let i = 0; i < 4 && et.weather.sky !== '${to}'; i++) { et.weather.skip(); et.fast(0.1); } return et.weather.sky; })()`, as: `sky -> ${to}` });
export default {
  steps: [
    { goto: 'level=rainforest&skip=1&safe=1&eggs=3&at=4,19' },
    { expect: `et.level.theme.name === 'rainforest' && et.weather.rains && et.level.logs.length === 3`, as: 'the rainforest loads, with rain and three logs' },
    { expect: `et.weather.sky === 'dry' && !et.level.flooded`, as: 'it starts dry' },
    // dry: the ford
    go(4.5, 20.5, S), ...walk(1.6),
    { expect: 'et.debug().z > 23.4', as: 'dry: walked over the ford' },
    // dry: the brook stops a walk, and a dash skims it
    go(10.5, 20.6, S), ...walk(1.2),
    { expect: 'et.debug().z < 22', as: 'dry: the brook stops a walk' },
    go(10.5, 21.3, S), { down: 'KeyW' }, { down: 'Space' }, { eval: 'et.fast(0.7).z', as: 'dashed to z' }, { up: 'Space' }, { up: 'KeyW' },
    { expect: 'et.debug().z > 23', as: 'dry: a dash skims the brook' },
    { expect: `JSON.stringify(et.weather.logs().map((l) => [l.x, l.z])) === '[[8.5,22.5],[27.5,6.5],[27.5,27.5]]'`, as: 'dry: every log in its first resting place' },
    // (not far past the log: there is a burrow just beyond it, and the eggs must stay in tow for what follows)
    go(8.5, 20.5, S), { down: 'KeyW' }, { eval: '(() => { for (let i = 0; i < 60 && et.debug().z < 23.9; i++) et.fast(0.04); return et.debug().z; })()', as: 'walked to z' }, { up: 'KeyW' },
    { expect: 'et.debug().z > 23.8 && et.debug().carried === 3', as: 'dry: walked the log' },
    // the warning, then the rain
    sky('warn'),
    { expect: `et.weather.sky === 'warn' && et.weather.rain > 0`, as: 'the warning: first drops' },
    sky('rain'),
    { eval: 'et.fast(7); et.weather.logs()', as: 'logs after the rain came' },
    { expect: `et.weather.sky === 'rain' && et.level.flooded && et.weather.flood > 0.95`, as: 'rain: the streams are up' },
    { expect: `JSON.stringify(et.weather.logs().map((l) => [l.x, l.z, l.afloat])) === '[[15.5,22.5,false],[28.5,14.5,false],[27.5,31.5,false]]'`, as: 'rain: every log floated to its second resting place' },
    { shot: 'rain-brook' },
    go(4.5, 24.6, 0), ...walk(1.6),
    { expect: 'et.debug().z > 23.9', as: 'rain: the ford is shut' },
    go(15.5, 19.5, S), ...walk(2),
    { expect: 'et.debug().z > 24.4', as: 'rain: crossed on the log where it lodged' },
    // (eggs are counted from here: sliding along the flooded bank a moment ago may have robbed the nest beside the ford)
    go(10.5, 20.3, S), { eval: 'window.eggsNow = et.debug().carried', as: 'eggs in tow' }, { down: 'KeyW' }, { down: 'Space' }, { eval: 'et.fast(0.9).z', as: 'dashed to z' }, { up: 'Space' }, { up: 'KeyW' },
    { expect: 'et.debug().z < 21 && et.debug().alive && window.eggsNow >= 3 && et.debug().carried === window.eggsNow', as: 'rain: a dash cannot clear it, and the lizard is washed back with its eggs' },
    // easing, dry again; the logs stay where they landed
    sky('ease'), { eval: 'et.fast(7).sky', as: 'after easing' }, sky('dry'),
    { eval: 'et.fast(3).flood', as: 'flood' },
    { expect: `!et.level.flooded && et.weather.logs()[0].x === 15.5`, as: 'dry again: the water is back down and the log stays where it landed' },
    // caught on a ford as it floods
    go(4.5, 19.5, S), go(4.5, 22.5, S),
    sky('warn'), sky('rain'),
    { eval: 'et.fast(4).z', as: 'z after the flood' },
    { expect: 'et.debug().z < 20.5 && et.debug().alive && et.debug().carried === window.eggsNow && et.debug().caught === 0', as: 'on a ford as it floods: washed back to the bank it came from, unharmed, eggs and all' },
    // riding a log
    sky('ease'), { eval: 'et.fast(7).sky' }, sky('dry'), { eval: 'et.fast(3).sky' },
    // (two rains so far: the Upper log is back at its first resting place, and the third rain takes it to its second)
    go(27.5, 6.5, S), sky('warn'), sky('rain'),
    { eval: 'et.fast(0.5); [et.weather.riding, et.debug().x, et.debug().z]', as: 'riding' },
    { expect: 'et.weather.riding === 1', as: 'on a log when it lifts: the lizard rides it' },
    { eval: 'et.fast(7); [et.weather.riding, et.debug().x, et.debug().z]', as: 'after the ride' },
    { expect: 'et.weather.riding === -1 && Math.abs(et.debug().z - 14.5) < 0.6 && et.debug().alive', as: 'and steps off where it lodges' },
    { shot: 'rain-creek' },
  ],
};
