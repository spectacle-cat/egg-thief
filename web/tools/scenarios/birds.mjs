// The birds moving, for looking at: strips of pictures a moment apart, the camera close beside each bird. (The owl
// and the hawk are puppets; the roadrunner runs through its four drawn frames.)
//   node tools/drive.mjs tools/scenarios/birds.mjs      then see .shots/bd-*.png
// The lizard stands next to the bird it is watching (nothing can catch it, and to begin with nothing can see it).
const blind = 'et.hunters.runners.forEach((r) => { r.sees = () => false; }); 1';
const sighted = 'et.hunters.runners.forEach((r) => { delete r.sees; }); 1';
/** Stand `side` tiles to the bird's right (as the camera sees it) and `ahead` in front, the camera turned by `turn` from the bird's heading. */
const watch = (who, turn = 0, side = 0.9, ahead = 0) => `(() => { const b = ${who}, yaw = b.heading + ${turn};
  et.teleport(b.pos.x + Math.cos(yaw) * ${side} + Math.sin(b.heading) * ${ahead}, b.pos.z + Math.sin(yaw) * ${side} - Math.cos(b.heading) * ${ahead}, yaw); return 1; })()`;
/** n pictures of `who`, `dt` seconds of the game apart. */
const strip = (name, who, n, dt, turn, side, ahead) => Array.from({ length: n }, (_, i) => [
  { eval: `et.fast(${dt}); ${watch(who, turn, side, ahead)}` }, { wait: 140 }, { shot: `bd-${name}-${i}` },
]).flat();
const runner = (i) => `et.hunters.runners[${i}]`;
const owl = 'et.hunters.owls[0]', hawk = 'et.hunters.hawks[0]';
export default {
  size: [1280, 720],
  steps: [
    { goto: 'skip=1&safe=1&mute=1&at=12,15' },
    { eval: `document.getElementById('ui').style.display = 'none'; et.rig.zoom = 0.65; ${blind}` },
    // --- a roadrunner walking its beat, from behind and from the side
    ...strip('walk', runner(0), 6, 0.11, 0),
    ...strip('walkside', runner(0), 4, 0.11, -Math.PI / 2, 0.2, 0),
    // --- a guard at its post (the head and tail move slowly: half a second between looks)
    ...strip('guard', runner(5), 4, 0.5, 0.5),
    // --- seen: craning, then flat out after the lizard, which keeps just ahead
    { eval: `${sighted}; ${watch(runner(0), -Math.PI / 2, 0.2, 2.6)}; et.fast(0.3); ${runner(0)}.state`, as: 'seen, the walker is' },
    { wait: 240 }, { shot: 'bd-suspect' },
    { eval: `for (let i = 0; i < 30; i++) { ${watch(runner(0), -Math.PI / 2, 0.2, 2.6)}; et.fast(0.05); } ${runner(0)}.state`, as: 'and then' },
    ...strip('chase', runner(0), 6, 0.05, -Math.PI / 2, 0.2, 2.6),
    // --- a Thunder Egg: seeing stars
    { eval: `${blind}; et.give('thunder'); ${watch(runner(0), 0)}; et.fast(0.05).power`, as: 'holding' },
    { press: 'KeyE' }, { eval: `et.fast(0.9); ${runner(0)}.state`, as: 'after the thunder' },
    ...strip('stun', runner(0), 3, 0.22, 0),
    // --- an owl: a round of wingbeats from its first stroke, then the glide
    { eval: `(() => { const o = ${owl}; let n = 0; while (o.beat % 1 > 0.04 && n++ < 400) et.fast(0.02); return (o.beat % 1).toFixed(2); })()`, as: 'owl, start of its beats' },
    { eval: 'et.rig.zoom = 1' },
    ...strip('owl', owl, 10, 0.05, 0, 0, -1.6),
    { eval: `et.fast(1.4); 1` },
    ...strip('owlglide', owl, 2, 0.2, 0, 0, -1.6),
    ...strip('owlside', owl, 6, 0.07, -Math.PI / 2, 0, 0),
    // --- a hawk soaring
    { eval: 'et.rig.zoom = 1.4' },
    ...strip('hawk', hawk, 4, 0.4, 0, 0, -4.5),
    { expect: 'et.debug().alive', as: 'nothing broke' },
  ],
};
