// A look at every screen and zone, in each camera.
const zone = (name, c, r, view) => [
  { eval: `et.setView(${view}); et.teleport(${c + 0.5}, ${r + 0.5}); et.fast(1.2).zone`, as: name },
  { wait: 700 },
  { shot: 'tour-' + name },
];
export default {
  size: [1280, 720],
  steps: [
    { goto: 'view=tilt' },
    { wait: 1200 },
    { shot: 'tour-title' },
    { press: 'Enter' },
    { wait: 1500 },
    { shot: 'tour-start' },
    ...zone('roost', 8, 4, 1),
    ...zone('thicket', 8, 29, 1),
    ...zone('gulch', 26, 7, 0),
    ...zone('dunes', 27, 24, 2),
    ...zone('hollow', 45, 9, 1),
    ...zone('badlands', 46, 27, 0),
    { press: 'Escape' },
    { wait: 500 },
    { shot: 'tour-pause' },
  ],
};
