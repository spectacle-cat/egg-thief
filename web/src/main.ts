// Start-up: load the level and the art, make the game, run the frame loop.
//
// Handy while working (add to the address):
//   ?view=top|tilt|chase   which camera to start in          ?skip=1    straight into play, no title
//   ?at=27,24              start the lizard at that tile      ?mute=1    no sound
//   ?bot=1                 a stand-in player runs the level   ?post=0    without the finishing pass
//   ?level=desert          which map in public/levels         ?eggs=5    start with eggs in tow
//   ?power=thunder|ghost|chili|rattle   start holding a power egg     ?safe=1    nothing can catch the lizard
//   ?res=1.5               draw at that many pixels per point, and leave it there (a phone otherwise lowers it if it can't keep up)
import './style.css';
import { Game, type Params } from './game';
import { loadLevel } from './level';
import { loadTextures } from './world';

declare global {
  interface Window { __booted?: boolean; __bootError?: (msg: string) => void; et?: Game }
}

async function boot() {
  const q = new URLSearchParams(location.search);
  const base = import.meta.env.BASE_URL;
  const at = q.get('at')?.split(',').map(Number);
  const params: Params = {
    view: q.get('view') ?? undefined,
    skip: q.has('skip'),
    mute: q.has('mute'),
    bot: q.has('bot'),
    post: q.get('post') !== '0',
    at: at && at.length === 2 && at.every(Number.isFinite) ? [at[0] + 0.5, at[1] + 0.5] : undefined,
    eggs: Number(q.get('eggs') ?? 0) || undefined,
    power: q.get('power') ?? undefined,
    safe: q.has('safe'),
    res: Number(q.get('res')) > 0 ? Math.min(3, Math.max(0.25, Number(q.get('res')))) : undefined,
  };
  const [level, tex] = await Promise.all([loadLevel(`${base}levels/${q.get('level') ?? 'desert'}.tmj`), loadTextures(base), document.fonts.load('20px Caroni').catch(() => null)]);
  const game = new Game(document.getElementById('game')!, level, tex, params);
  window.et = game;
  window.__booted = true;
  document.getElementById('boot')?.classList.add('gone');
  const loop = (now: number) => {
    game.frame(now);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

boot().catch((err) => {
  console.error(err);
  window.__bootError?.(String(err?.message ?? err));
});
