// A look at every screen and zone.
const zone = (name, c, r) => [
  { eval: `et.teleport(${c + 0.5}, ${r + 0.5}); et.fast(1.2).zone`, as: name },
  { wait: 700 },
  { shot: 'tour-' + name },
];
export default {
  size: [1280, 720],
  steps: [
    { goto: 'splash=0' },
    { wait: 1200 },
    { shot: 'tour-title' },
    { goto: 'skip=1' },
    { wait: 1500 },
    { shot: 'tour-start' },
    ...zone('roost', 8, 4),
    ...zone('thicket', 8, 29),
    ...zone('gulch', 26, 7),
    ...zone('dunes', 27, 24),
    ...zone('hollow', 45, 9),
    ...zone('badlands', 46, 27),
    { press: 'Escape' },
    { wait: 500 },
    { shot: 'tour-pause' },
  ],
};
