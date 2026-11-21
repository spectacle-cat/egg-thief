// How much is being drawn: batches (one draw call each), cut-outs in them, and how long a frame takes on the CPU.
export default {
  size: [1280, 720],
  steps: [
    { goto: 'skip=1&safe=1&at=27,24' },
    { eval: 'et.fast(2).zone' },
    { eval: `(() => { const m = et.scene.children.filter((c) => c.isMesh && c.visible); const inst = m.map((c) => c.geometry.instanceCount ?? 1).filter((n) => Number.isFinite(n)); return { batches: m.length, cutouts: inst.reduce((a, b) => a + b, 0), biggest: Math.max(...inst) }; })()`, as: 'scene' },
    { eval: `(() => { et.renderer.info.autoReset = false; et.renderer.info.reset(); et.frame(performance.now()); const r = et.renderer.info.render; et.renderer.info.autoReset = true; return { calls: r.calls, triangles: r.triangles }; })()`, as: 'one frame' },
    { eval: `(() => { const t0 = performance.now(); et.fast(10); return ((performance.now() - t0) / 600).toFixed(3) + ' ms of game logic per frame'; })()`, as: 'cpu' },
  ],
};
