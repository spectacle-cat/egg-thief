// The stand-in player runs the whole level. First with nothing able to catch it: that proves the map can be
// finished (every wall has its power egg within reach, every egg can be carried home, the golden egg can be found).
// Then for real, hunters and all, to see that nothing falls over in a long run.
const done = '(() => { const d = et.debug(); return d.state === "won" ? d : et.fast(60); })()';
export default {
  size: [1280, 720],
  steps: [
    { goto: 'skip=1&bot=1&safe=1' },
    { eval: 'et.fast(30)', as: 'safe 30 s' },
    { eval: 'et.fast(60)', as: 'safe 90 s' },
    { eval: done, as: 'safe 150 s' }, { eval: done, as: 'safe 210 s' }, { eval: done, as: 'safe 270 s' }, { eval: done, as: 'safe 330 s' },
    { eval: done, as: 'safe 390 s' }, { eval: done, as: 'safe 450 s' }, { eval: done, as: 'safe 510 s' }, { eval: done, as: 'safe 570 s' },
    { wait: 1200 },
    { shot: 'bot-safe-end' },
    { expect: 'et.debug().banked === et.level.totalEggs', as: 'every egg can be brought home' },
    { expect: 'et.debug().gold', as: 'the golden egg can be found' },
    { expect: 'et.debug().smashed > 0 && et.debug().burnt > 0', as: 'cracked rocks were smashed and thorns burnt' },
    { expect: 'et.debug().state === "won"', as: 'and the way home works' },
    { goto: 'skip=1&bot=1' },
    { eval: 'et.fast(120)', as: 'for real, 120 s' },
    { eval: 'et.fast(120)', as: 'for real, 240 s' },
    { eval: 'et.fast(120)', as: 'for real, 360 s' },
    { wait: 800 },
    { shot: 'bot-real' },
    { expect: 'et.debug().banked > 0', as: 'the bot got eggs home with the hunters about' },
  ],
};
