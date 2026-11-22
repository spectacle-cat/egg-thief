// A level's look. The game's parts are named for the desert they were first drawn for (a boulder, a tuft, a
// roadrunner); another place plays the same parts with its own drawings and its own colours. A theme says which
// drawing stands in for which part, what its map tiles are called, and the few colours no drawing carries.
export type Rgb = [number, number, number];

export interface Theme {
  name: string;
  /** The folder under sprites/ its own drawings live in ('' for the desert, whose drawings are the default set). */
  dir: string;
  /** Part of the game (the desert's sprite name) -> this theme's drawing of it. Anything not listed is the desert's. */
  art: Record<string, string>;
  /** This theme's name for a map tile -> the part it plays. */
  tiles: Record<string, string>;
  /** Who walks the routes and stands guard here. */
  walker: 'roadrunner' | 'coati';
  guard: 'roadrunner' | 'viper';
  /** Standing scenery: width and height in tiles, where they differ from the desert's. */
  propSize: Record<string, [number, number]>;
  /** The second kind of ground (the desert's sand; pebbles here): its colour, and the colour of the bits that catch the light. */
  ground2: [Rgb, Rgb];
  /** The floor drawing repeats edge to edge (laid as it is), or is one patch turned a different way on every tile. */
  seamless: boolean;
  /** Whether the second ground has wind ripples. */
  ripples: boolean;
  /** Water: deep, lit, and the foam along its edge. */
  water: [Rgb, Rgb, Rgb];
  /** Tint of the rocks (or roots) beyond the edge of the map, and of the far wall behind them. */
  ringTint: Rgb;
  /** How strongly cloud shadows cross the ground (a forest has a roof). */
  clouds: number;
  /** The light when no area says otherwise. */
  mood: string;
  /** Mini-map colours: ground, second ground, wall, water, cover. */
  map: [string, string, string, string, string];
  /** The game's hints that name the desert's things, in this place's words (by hint; touch: as said on a touch screen). */
  hints: Record<string, string>;
  hintsTouch: Record<string, string>;
}

const hex = (h: string): Rgb => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];

const DESERT: Theme = {
  name: 'desert', dir: '', art: {}, tiles: {}, walker: 'roadrunner', guard: 'roadrunner', propSize: {},
  ground2: [[0.925, 0.79, 0.5], [0.965, 0.9, 0.7]], seamless: false, ripples: true,
  water: [hex('#2f7f8f'), hex('#7fd0c8'), hex('#e8f4e0')],
  ringTint: [1, 1, 1], clouds: 1, mood: 'morning',
  map: ['#8a7c3e', '#e9cf86', '#4a3f17', '#3a8f9f', '#d9822a'],
  hints: {}, hintsTouch: {},
};

const RAINFOREST: Theme = {
  name: 'rainforest', dir: 'rainforest',
  art: {
    scrub: 'floor', boulder: 'buttress', rock_cracked: 'stump', rubble_pile: 'stump_rubble',
    rubble_1: 'stump_bit_1', rubble_2: 'stump_bit_2', rubble_3: 'stump_bit_3',
    thorns: 'vines', thorns_ash: 'vines_ash',
    tuft_1: 'fern_1', tuft_2: 'fern_2', tuft_3: 'fern_3', tuft_4: 'fern_4', up_tuft_1: 'up_fern_1', up_tuft_2: 'up_fern_2',
    up_grass: 'up_ears', pebbles: 'pebbles', cracks: 'litter', flowers: 'flowers', up_flowers: 'up_flowers',
    burrow: 'burrow', nest_empty: 'nest_empty', nest_egg_1: 'nest_egg_1', nest_egg_2: 'nest_egg_2', nest_egg_3: 'nest_egg_3',
    nest_clutch: 'nest_clutch', egg_1: 'egg_1', egg_2: 'egg_2', egg_3: 'egg_3',
    beetle: 'beetle', butterfly: 'butterfly', roadrunner: 'coati',
    up_rockspire: 'up_trunk', up_cactus_1: 'up_heliconia', up_agave: 'up_bromeliad', skull: 'fungi',
    up_mesa_1: 'up_far_1', up_mesa_2: 'up_far_2', up_mesa_3: 'up_far_3',
  },
  tiles: {
    floor: 'scrub', pebble: 'sand', pebbles: 'sand', buttress: 'boulder', stump: 'rock_cracked', vines: 'thorns',
    fern_1: 'tuft_1', fern_2: 'tuft_2', fern_3: 'tuft_3', fern_4: 'tuft_4', ears: 'grass',
    trunk: 'rockspire', heliconia: 'cactus_1', bromeliad: 'agave', fungi: 'skull',
  },
  walker: 'coati', guard: 'viper',
  propSize: { rockspire: [2.3, 4.6], cactus_1: [1.2, 2.4], agave: [1.3, 1.02] },
  ground2: [hex('#5A3A6E'), hex('#D9F5E6')], seamless: false, ripples: false,
  water: [hex('#0C4A50'), hex('#1E8C7B'), hex('#D9F5E6')],
  ringTint: [0.62, 0.72, 0.8], clouds: 0.25, mood: 'hall',
  map: ['#5A3A6E', '#8a6fa0', '#241638', '#1E8C7B', '#86DDB9'],
  hints: {
    runner: 'Stay out of its sight, or get under a fern',
    grass: 'Elephant ears hide you, even on the run',
    thunder: '<kbd>E</kbd> Thunder Egg: smashes rotten stumps and knocks hunters silly',
    chili: '<kbd>E</kbd> Chili Egg: run like fire and burn through thorn vines',
    cracked: 'A rotten stump. Something could smash that...',
    thorns: 'Thorn vines: too sharp to push through. They would burn, though...',
  },
  hintsTouch: {
    thunder: 'Tap the Thunder Egg: it smashes rotten stumps and knocks hunters silly',
    chili: 'Tap the Chili Egg: run like fire and burn through thorn vines',
  },
};

export const THEMES: Record<string, Theme> = { desert: DESERT, rainforest: RAINFOREST };
export const themeOf = (name: string | undefined): Theme => THEMES[name ?? 'desert'] ?? DESERT;
