// Pictures around the rainforest, for looking at: each area, the creatures, and the rain.
const at = (x, z, h, name) => [{ eval: `et.teleport(${x}, ${z}, ${h}); et.fast(0.4); 1`, as: name }, { wait: 500 }, { shot: 'forest-' + name }];
export default {
  steps: [
    { goto: 'level=rainforest&skip=1&safe=1' },
    ...at(8.5, 9.5, 'Math.PI / 2', 'hall'),
    ...at(9.5, 20, 'Math.PI', 'fords'),
    ...at(24.5, 9, 'Math.PI / 2', 'creek'),
    ...at(41.5, 5.5, 'Math.PI / 2', 'thicket'),
    ...at(46.5, 4.5, '-0.4', 'viper'),
    ...at(43.5, 24.5, 'Math.PI / 2', 'hollow'),
    ...at(50.5, 29.5, 'Math.PI / 2', 'old-tree'),
    { eval: `et.weather.skip(); et.fast(0.1); et.weather.skip(); et.fast(6); et.weather.sky`, as: 'sky' },
    ...at(24.5, 13, 'Math.PI / 2', 'creek-rain'),
    ...at(9.5, 20, 'Math.PI', 'fords-rain'),
    { goto: 'level=rainforest&skip=1&safe=1&view=top&at=28,17' },
    { wait: 800 }, { shot: 'forest-map' },
  ],
};
