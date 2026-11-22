// The pictures on the level select's postcards, taken from the game itself: one view of each level with nothing
// drawn over it. Run this, then shrink each shot into public/levels (640 wide is plenty for a postcard):
//   node tools/drive.mjs tools/scenarios/postcards.mjs
//   for id in desert rainforest; do magick .shots/postcard-$id.png -resize 640x -quality 84 public/levels/$id.jpg; done
// A new level: add its line here (where to stand, which way to look), and name the picture in src/levels.ts.
const VIEWS = [
  // id, x, z, heading
  ['desert', 27.5, 24.5, 0.8],      // the dunes: sand, cactus, a dead tree, a burrow
  ['rainforest', 6.5, 20.5, 0.4],   // the fords: a stream, a log across it, ferns
];
const bare = `document.getElementById('ui').style.visibility = 'hidden'; 1`;
export default {
  size: [1280, 863], // a 1280 x 720 page (headless Chromium's window is 143px taller than what it shows)
  steps: VIEWS.flatMap(([id, x, z, heading]) => [
    { goto: `level=${id}&skip=1&safe=1` },
    { eval: bare, as: `${id}: nothing over the picture` },
    { eval: `et.teleport(${x}, ${z}, ${heading}); et.fast(1.5).zone`, as: `${id}: standing in` },
    { wait: 700 },
    { expect: `innerWidth === 1280 && innerHeight === 720`, as: 'the picture is 1280 x 720' },
    { shot: `postcard-${id}` },
  ]),
};
