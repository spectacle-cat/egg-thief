// The title, the other two cameras, and the end screen after a whole run.
const done = '(() => { const d = et.debug(); return d.state === "won" ? d.time : et.fast(60).time; })()';
export default {
  size: [1280, 720],
  steps: [
    { goto: 'x=1' },
    { wait: 1500 },
    { shot: 's-title' },
    { goto: 'skip=1&safe=1&view=tilt&at=27,24' },
    { eval: 'et.fast(2).view' }, { wait: 500 },
    { shot: 's-tilt' },
    { goto: 'skip=1&safe=1&view=top&at=8,27' },
    { eval: 'et.fast(2).view' }, { wait: 500 },
    { shot: 's-top' },
    { goto: 'skip=1&bot=1&safe=1' },
    { eval: done }, { eval: done }, { eval: done }, { eval: done }, { eval: done },
    { expect: 'et.debug().state === "won"', as: 'the run ended' },
    { wait: 6000 },
    { shot: 's-results' },
    { press: 'Enter' }, { wait: 1200 },
    { expect: 'et.debug().state === "play" && et.debug().banked === 0', as: 'play again starts a fresh run' },
    { shot: 's-again' },
  ],
};
