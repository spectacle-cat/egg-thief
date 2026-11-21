// The stealth set pieces, with the hunters awake: the long grass past the gate guard, a Rattle Egg to pull the
// Gulch guard off its post, a Ghost Egg straight past it, and a Thunder Egg to knock it silly.
const guard = (x, z) => `et.hunters.runnerPositions().some((r) => Math.hypot(r.x - ${x}, r.z - ${z}) < 0.6)`;
export default {
  size: [1280, 720],
  steps: [
    // --- up the long grass beside the gate guard, to the way out
    { goto: 'skip=1&at=53,9' },
    { eval: 'et.teleport(53.5, 9.5, 0); et.fast(0.5).hidden', as: 'in the grass' },
    { down: 'KeyW' }, { eval: 'et.fast(1.5)', as: 'crept north' }, { up: 'KeyW' }, { wait: 300 },
    { shot: 'k-gate' },
    { expect: 'et.debug().alarms === 0 && et.debug().alive && et.debug().z < 4.2', as: 'past the gate guard unseen, through the grass' },
    { expect: guard(52.5, 4.5), as: 'the gate guard never left its post' },
    // --- a Rattle Egg thrown from out of sight: the Gulch guard goes to look
    { goto: 'skip=1&power=rattle&at=25,8' },
    { eval: 'et.teleport(25.5, 8.5, 1.5708); et.fast(1).power', as: 'holding' },
    { expect: guard(33.5, 7.5), as: 'the Gulch guard is at its post' },
    { press: 'KeyE' }, { eval: 'et.fast(3.5).alarms', as: 'alarms' }, { wait: 300 },
    { shot: 'k-rattle' },
    { expect: '!' + guard(33.5, 7.5), as: 'the rattle pulled the guard off its post' },
    { expect: 'et.debug().alarms === 0', as: 'and it never saw the lizard' },
    { eval: 'et.fast(12).alarms', as: 'later' },
    { expect: guard(33.5, 7.5), as: 'when the rattle stopped it went back' },
    // --- a Ghost Egg: straight down the lane under its nose
    { goto: 'skip=1&power=ghost&at=25,8' },
    { eval: 'et.teleport(28.5, 8.5, 1.5708); et.fast(0.3).power', as: 'holding' },
    { press: 'KeyE' }, { eval: 'et.teleport(29.5, 7.5, 1.5708); 1' }, { down: 'KeyW' }, { eval: 'et.fast(1.6)', as: 'ghost run' }, { up: 'KeyW' }, { wait: 300 },
    { shot: 'k-ghost' },
    { expect: 'et.debug().alarms === 0 && et.debug().alive && et.debug().x > 34', as: 'a ghost walks past the guard' },
    // --- a Thunder Egg beside it: stars
    { goto: 'skip=1&safe=1&power=thunder&at=25,8' },
    { eval: 'et.teleport(31.5, 7.5, 1.5708); 1' }, { press: 'KeyE' }, { eval: 'et.fast(0.6).alarms' }, { wait: 300 },
    { shot: 'k-stun' },
    { eval: 'et.fast(1).danger', as: 'danger while it is stunned' },
  ],
};
