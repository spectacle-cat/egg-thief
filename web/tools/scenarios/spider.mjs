// Hollow logs and the spider: through a log unseen, the spider's tell, its walk out and back (never far from its
// door), a bite for going in while it is home, and a Ghost Egg walking past it.
const E = 'Math.PI / 2', S = 'Math.PI';
const go = (x, z, h) => ({ eval: `et.teleport(${x}, ${z}, ${h}); et.fast(0.2); 1`, as: `to ${x},${z}` });
const sp = 'et.tunnels.spiderStates()[0]';
const until = (state, max = 30) => ({ eval: `(() => { for (let i = 0; i < ${max * 10}; i++) { if (${sp}.state === '${state}') return i / 10; et.fast(0.1); } return -1; })()`, as: `seconds until the spider is ${state}` });
export default {
  steps: [
    { goto: 'level=rainforest&skip=1&at=52,19' },
    { expect: 'et.level.tunnels.length === 2 && et.tunnels.spiderStates().length === 1', as: 'two hollow logs, one with a spider' },
    // the empty log: in one end, out the other, unseen on the way
    go(52.5, 20.5, S), { down: 'KeyW' },
    { eval: '(() => { let seen = false; for (let i = 0; i < 30; i++) { et.fast(0.05); if (et.debug().inside) seen = et.debug().hidden; } return seen; })()', as: 'hidden while inside' },
    { up: 'KeyW' },
    { expect: 'et.debug().z > 24.4 && !et.debug().inside && et.debug().alive', as: 'through the Root log and out the far end' },
    // the spider's tell, from a safe way off
    go(41.5, 29, E),
    { expect: `${sp}.state === 'home'`, as: 'the spider starts at home' },
    go(44, 26.5, E), { shot: 'spider-tell' }, go(41.5, 29, E),
    until('out'),
    { expect: `${sp}.state === 'out'`, as: 'now and again it creeps out' },
    { eval: `(() => { let far = 0; for (let i = 0; i < 120 && ${sp}.state !== 'home'; i++) { et.fast(0.1); far = Math.max(far, Math.hypot(${sp}.x - 46.5, ${sp}.z - 26.5)); } return +far.toFixed(2); })()`, as: 'furthest from its door' },
    { expect: `${sp}.state === 'home'`, as: 'and backs in again' },
    // going in while it is home is a bite
    go(44.5, 26.5, E), { down: 'KeyW' }, { eval: 'et.fast(1.2); et.debug()', as: 'walked at the spider log' }, { up: 'KeyW' },
    { expect: 'et.debug().tails === 1 && et.debug().x < 47.5', as: 'in at the front door while it is home: bitten, and not through' },
    // a ghost walks past it
    { eval: `et.fast(4); et.give('ghost'); et.teleport(44.5, 26.5, ${E}); et.fast(0.2); ${sp}.state`, as: 'spider before the ghost' },
    until('home', 40), go(44.5, 26.5, E),
    { press: 'KeyE' }, { down: 'KeyW' }, { eval: 'et.fast(1.6); et.debug()', as: 'walked through as a ghost' }, { up: 'KeyW' },
    { expect: 'et.debug().x > 49.4 && et.debug().tails === 1 && et.debug().alive', as: 'a Ghost Egg goes straight past the spider' },
  ],
};
