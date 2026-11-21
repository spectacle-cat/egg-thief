// A quick look at the low camera in a few places.
const at = (name, c, r, heading = 0) => [
  { eval: `et.teleport(${c + 0.5}, ${r + 0.5}, ${heading}); et.fast(1.5).zone`, as: name },
  { wait: 600 },
  { shot: 'look-' + name },
];
export default {
  size: [1280, 720],
  steps: [
    { goto: 'skip=1&view=chase' },
    { eval: "document.getElementById('ui').style.display = 'none'", as: 'hud off (it is being rebuilt)' },
    { wait: 800 },
    { shot: 'look-start' },
    ...at('flats', 9, 17, 1.2),
    ...at('gulch', 26, 7, 0),
    ...at('dunes', 27, 24, 0.6),
    ...at('hollow', 45, 9, 3.6),
  ],
};
