// Each power egg used where it matters, with a picture of each moment.
const tp = (x, z, heading = 0, settle = 1) => ({ eval: `et.teleport(${x}, ${z}, ${heading}); et.fast(${settle}).power`, as: `to ${x},${z}` });
export default {
  size: [1280, 720],
  steps: [
    { goto: 'skip=1&safe=1' },
    { wait: 500 },
    { shot: 'p-start' },
    { eval: 'et.critters.beetlesTotal', as: 'beetles' },
    // Thunder: take it from its nest, carry it to the cracked wall, smash.
    tp(7.5, 19.5, 4.7, 0.3),
    { expect: 'et.debug().power === "thunder"', as: 'picked up the Thunder Egg' },
    tp(3.2, 18.6, 3.14, 1.2), { wait: 700 },
    { shot: 'p-thunder-before' },
    { press: 'KeyE' }, { wait: 260 },
    { shot: 'p-thunder-hit' },
    { wait: 900 },
    { shot: 'p-thunder-after' },
    { expect: 'et.debug().smashed === 2', as: 'two cracked rocks smashed' },
    // Long grass.
    tp(6.5, 12.5, 0.6, 1.2), { wait: 600 },
    { shot: 'p-grass' },
    { expect: 'et.debug().hidden', as: 'hidden in long grass' },
    // Chili: through the thorn hedge.
    tp(10.5, 25.5, 3.14, 0.3),
    { expect: 'et.debug().power === "chili"', as: 'picked up the Chili Egg' },
    tp(4.5, 26.6, 3.14, 1.0), { wait: 600 },
    { shot: 'p-chili-before' },
    { press: 'KeyE' }, { down: 'KeyW' }, { eval: 'et.fast(0.45).burnt', as: 'burning' }, { wait: 250 },
    { shot: 'p-chili-burn' },
    { eval: 'et.fast(0.5).burnt', as: 'burning' }, { wait: 250 },
    { shot: 'p-chili-run' },
    { eval: 'et.fast(0.8).burnt', as: 'burnt' }, { up: 'KeyW' }, { wait: 300 },
    { shot: 'p-chili-after' },
    { expect: 'et.debug().burnt >= 6', as: 'the hedge burnt along its length' },
    // Ghost.
    tp(13.5, 14.5, 1.2, 4), { eval: 'et.give("ghost")' }, { press: 'KeyE' }, { wait: 900 },
    { shot: 'p-ghost' },
    { expect: 'et.debug().power === "ghost!"', as: 'ghost is running' },
    // Rattle at the Gulch guard.
    tp(29.5, 7.5, 1.57, 7), { eval: 'et.give("rattle")' }, { wait: 500 },
    { shot: 'p-guard' },
    { press: 'KeyE' }, { wait: 2600 },
    { shot: 'p-rattle' },
    // The golden egg.
    tp(11.5, 2.5, 1.57, 8), { wait: 500 }, { shot: 'p-roost-vault' },
    tp(14.2, 1.5, 1.57, 0.02), { wait: 500 },
    { shot: 'p-gold' },
    { expect: 'et.debug().gold', as: 'the golden egg was found' },
    // A beetle.
    tp(2.5, 13.5, 0, 0.5),
    { eval: 'et.debug().beetles', as: 'beetles eaten' },
    // Places.
    tp(27.5, 24.5, 0.6, 3), { wait: 600 }, { shot: 'p-dunes' },
    tp(22.5, 27.5, 4.71, 1.5), { wait: 600 }, { shot: 'p-thorn-ring' },
    tp(52.5, 9.5, 0, 1.5), { wait: 600 }, { shot: 'p-gate' },
    tp(48.5, 26.5, 1.2, 1.5), { wait: 600 }, { shot: 'p-badlands' },
    tp(24.5, 12.5, 1.0, 1.5), { wait: 600 }, { shot: 'p-gulch' },
  ],
};
