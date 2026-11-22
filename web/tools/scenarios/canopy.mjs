// The Hollow Giant and the canopy: in at the door and out of the knothole, along a bough, off the edge and down
// onto the floor underneath (the dry way over the creek), back down the knothole, and pictures of it all.
const N = '0', E = 'Math.PI / 2', S = 'Math.PI', W = '-Math.PI / 2';
const go = (x, z, h) => ({ eval: `et.teleport(${x}, ${z}, ${h}); et.fast(0.3); 1`, as: `to ${x},${z}` });
const pic = (x, z, h, name) => [{ eval: `et.teleport(${x}, ${z}, ${h}); et.fast(0.4); et.debug().deck`, as: name }, { wait: 500 }, { shot: 'canopy-' + name }];
const walk = (seconds) => [{ down: 'KeyW' }, { eval: `et.fast(${seconds}); 1`, as: `walked ${seconds}s` }, { up: 'KeyW' }, { eval: 'et.fast(1.6); JSON.stringify(et.debug()).slice(0, 120)', as: 'then' }];
export default {
  steps: [
    { goto: 'level=rainforest&skip=1&safe=1' },
    { expect: 'et.level.canopy !== null && et.level.floorW === 56 && et.level.w === 132', as: 'the map has a canopy in its far corner, over a floor 56 wide' },
    { expect: 'et.level.sentries.filter((s) => s.x > 100).length === 2 && et.level.gold.x > 100', as: 'two vipers and the golden egg are up top' },
    { expect: `(() => { const f = et.level.fieldTo(127, 10, 'lizard'), s = et.level.start; return f[Math.floor(s.z) * et.level.w + Math.floor(s.x)] > 0; })()`, as: 'the stand-in player can find its way from the start to the golden egg' },
    { expect: `(() => { const f = et.level.fieldTo(127, 10, 'walker'), s = et.level.start; return f[Math.floor(s.z) * et.level.w + Math.floor(s.x)] < 0; })()`, as: 'and a coati cannot' },
    // --- up
    ...pic(21.5, 20.6, '-0.25', 'giant'),
    go(20.5, 19.4, N), ...walk(0.7),
    { expect: `et.debug().deck === 'canopy' && Math.hypot(et.debug().x - 103.5, et.debug().z - 17.5) < 0.5 && et.debug().alive`, as: 'in at the door of the Hollow Giant, out of the knothole' },
    { expect: `et.debug().zone === 'The Canopy'`, as: 'the banner says where she is' },
    { wait: 400 }, { shot: 'canopy-arrive' },
    // --- along the boughs
    go(110.5, 17.5, E),
    { expect: `et.debug().deck === 'canopy' && Math.abs(et.debug().x - 110.5) < 0.2`, as: 'a bough holds her' },
    ...pic(110.5, 16.5, E, 'bough'),
    // --- off the east end of the bough: down onto the east bank, with what she carries
    { eval: 'et.teleport(116.5, 15.5, 0); et.fast(0.4); et.debug().carried', as: 'eggs carried before the nest' },
    go(112.5, 17.5, S), ...walk(0.5),
    { expect: `et.debug().deck === 'floor' && et.debug().alive && et.debug().x > 30 && et.debug().x < 34 && Math.abs(et.debug().z - 18.5) < 2`, as: 'stepping off the bough east of the creek lands her on the east bank' },
    { wait: 300 }, { shot: 'canopy-landed' },
    // --- and from the west end, the west bank
    go(108.5, 18.6, S), { eval: 'et.fast(2); 1', as: 'put over a gap' },
    { expect: `et.debug().deck === 'floor' && et.debug().alive && et.debug().x < 26`, as: 'falling from the west end lands her on the west bank' },
    // --- down the knothole
    go(105.5, 17.5, W), ...walk(0.6),
    { expect: `et.debug().deck === 'floor' && Math.hypot(et.debug().x - 20.5, et.debug().z - 17.5) < 0.6`, as: 'down the knothole, out at the door' },
    // --- stepping out and back in goes up again; standing still in the doorway does not
    { eval: 'et.fast(2); et.debug().deck', as: 'still at the door' },
    { expect: `et.debug().deck === 'floor'`, as: 'she is not sent straight back up' },
    go(20.5, 19.4, N), ...walk(0.7),
    { expect: `et.debug().deck === 'canopy'`, as: 'out and in again: up she goes' },
    // --- pictures
    ...pic(116.5, 15.5, E, 'room2'),
    ...pic(108.5, 22.5, E, 'long-bough'),
    ...pic(123.5, 15.5, E, 'fork'),
    ...pic(126.5, 12.5, N, 'crown'),
    { eval: `et.weather.skip(); et.fast(0.1); et.weather.skip(); et.fast(5); et.weather.sky`, as: 'sky' },
    ...pic(110.5, 16.5, E, 'rain'),
    { expect: `et.debug().deck === 'canopy' && et.debug().alive`, as: 'the rain changes nothing up top' },
  ],
};
