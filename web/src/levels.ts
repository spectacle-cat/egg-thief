// The list of levels, and what the player has done in each: the level select, the cards before and after a run and
// the saved records all read it from here. To add a level: draw its map, give it an entry in LEVELS, and make its
// postcard picture (tools/scenarios/postcards.mjs says how).

export interface LevelInfo {
  /** Its handle: in the address (?level=desert) and in the saved records. The player never sees it. */
  id: string;
  /** What the player calls it. */
  name: string;
  /** One line under the name. */
  line: string;
  /** Its one new idea, in a sentence: on the card shown before play. */
  idea: string;
  /** Its map, in public/levels. */
  map: string;
  /** A strip of its colours, for its postcard. */
  colours: string[];
  /** Its postcard picture, in public/levels. */
  picture: string;
  /** false: not built yet. It lies face down on the level select as "on the way" (see SHOW_COMING). */
  ready: boolean;
  /** The level that must be finished once before this one opens. None: open from the start. */
  after?: string;
  /** The name its best run was saved under before levels had ids: a run found there is carried over. */
  oldRecord?: string;
}

/** false: every level is open from the start. (?unlock=1 in the address does the same for one visit.) */
export const LOCKS = true;
/** false: levels that are not ready are left off the level select altogether, instead of lying face down on it. */
export const SHOW_COMING = true;

export const LEVELS: LevelInfo[] = [
  {
    id: 'desert', name: 'Africa', line: 'The Long Way Home', idea: 'Collect eggs. Hide under bushes. Do not get eaten.',
    map: 'desert.tmj', picture: 'desert.jpg', ready: true, oldRecord: 'The Long Way Home',
    colours: ['#342b0e', '#7a7430', '#e9cf86', '#fde27f', '#f79a2e', '#e0600c'],
  },
  {
    id: 'rainforest', name: 'Rainforest', line: 'When It Rains', idea: 'When it rains, the crossings move.',
    map: 'rainforest.tmj', picture: 'rainforest.jpg', ready: true, after: 'desert', oldRecord: 'When It Rains',
    colours: ['#3b2350', '#5a3a6e', '#0c4a50', '#1e8c7b', '#86ddb9', '#f23d7f'],
  },
  { id: 'gardens', name: 'Back Gardens', line: '', idea: '', map: '', picture: '', ready: false, colours: [] },
  { id: 'coast', name: 'British Coast', line: '', idea: '', map: '', picture: '', ready: false, colours: [] },
];

export const levelById = (id: string | null | undefined): LevelInfo | undefined => LEVELS.find((l) => l.id === id);
/** The levels that can be played, in order. */
export const playable = (): LevelInfo[] => LEVELS.filter((l) => l.ready);
/** The levels still to come, for the face-down cards (none when they are hidden). */
export const coming = (): LevelInfo[] => (SHOW_COMING ? LEVELS.filter((l) => !l.ready) : []);
/** The level after this one, if there is one to play. */
export function nextAfter(id: string): LevelInfo | null {
  const list = playable(), i = list.findIndex((l) => l.id === id);
  return i >= 0 ? list[i + 1] ?? null : null;
}
/** A map that is not in the list (?level=name of a .tmj being drawn): it plays, and keeps a record, under that name. */
export const strayLevel = (id: string, name = id): LevelInfo => ({ id, name, line: '', idea: '', map: `${id}.tmj`, picture: '', ready: true, colours: [] });

// ---------------------------------------------------------------------------------------------------------
// What is remembered between visits. A browser that will not keep anything (a private window) still remembers for
// as long as the page is open.

/** The best finished run of a level. `gold`: the golden egg has been brought to light there, on this run or an earlier one. */
export interface BestRun { time: number; stars: number; eggs: number; total: number; medals: number; gold?: boolean }

const PREFIX = 'eggthief.';
const kept = new Map<string, string>();
function read(key: string): string | null {
  let v: string | null = null;
  try { v = localStorage.getItem(PREFIX + key); } catch { /* no storage here */ }
  return v ?? kept.get(key) ?? null;
}
function write(key: string, value: string) {
  try { localStorage.setItem(PREFIX + key, value); } catch { kept.set(key, value); /* a private window: kept until the page closes */ }
}
const parseRun = (s: string | null): BestRun | null => {
  try { const r = JSON.parse(s ?? 'null') as BestRun | null; return r && typeof r.time === 'number' && typeof r.stars === 'number' ? r : null; } catch { return null; }
};

/** The best run of a level so far (null: never finished). A run saved under the level's old name is moved to its id. */
export function bestOf(level: LevelInfo): BestRun | null {
  const own = parseRun(read(`best.${level.id}`));
  if (own || !level.oldRecord) return own;
  const old = parseRun(read(`best.${level.oldRecord}`));
  if (old) write(`best.${level.id}`, JSON.stringify(old));
  return old;
}
export function saveBest(level: LevelInfo, run: BestRun) { write(`best.${level.id}`, JSON.stringify(run)); }

/** Is one run better than another? More stars, then more medals, then less time. */
export const betterRun = (run: BestRun, old: BestRun | null) =>
  !old || run.stars > old.stars || (run.stars === old.stars && (run.medals > old.medals || (run.medals === old.medals && run.time < old.time)));

const opened = { all: false, ids: new Set<string>() };
/** Open every level for this visit (?unlock=1). */
export function unlockAll() { opened.all = true; }
/** Open one level for this visit (?level=rainforest goes there whether it has been earned or not). */
export function unlockOne(id: string) { opened.ids.add(id); }
/** May this level be played yet? */
export function isOpen(level: LevelInfo): boolean {
  if (!level.ready) return false;
  if (!LOCKS || opened.all || opened.ids.has(level.id) || !level.after) return true;
  const key = levelById(level.after);
  return !key || bestOf(key) !== null;
}
/** One line saying how a locked level is opened. */
export function howToOpen(level: LevelInfo): string {
  const key = levelById(level.after);
  return key ? `Get home from ${key.name} once to open this map.` : '';
}

/** The level played last: the title shows it, and the level select opens on it. */
export const lastPlayed = (): string | null => read('last');
export const setLastPlayed = (id: string) => write('last', id);

/** Has this player been shown how to play? Anyone with a finished run has no need of it. */
export const knowsHow = (): boolean => read('howto') === '1' || playable().some((l) => bestOf(l) !== null);
export const setKnowsHow = () => write('howto', '1');
