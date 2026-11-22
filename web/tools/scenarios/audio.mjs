// Listen to the sound without ears. Every effect is rendered alone through the whole master chain in an
// OfflineAudioContext and its length, peak and loudness are printed; then the tune in each area, the tension and the
// two power layers, the changes between them, and a worst case with everything at once. Last, the real (live) audio
// context: every name in a burst, the areas and powers switched about, spam of the small sounds; nothing may log an error.
//   flock .shots/chromium.lock node tools/drive.mjs tools/scenarios/audio.mjs
// Numbers are of the final output (after compressor, limiter and ceiling) unless they say "before the ceiling".

const NAMES = [
  'step', 'dash', 'rustle', 'egg', 'bank', 'bankDone', 'checkpoint', 'spotted', 'suspect', 'lost', 'runner', 'peck', 'screech', 'dive',
  'thud', 'swoop', 'hoot', 'rattle', 'snap', 'tail', 'regrow', 'caught', 'respawn', 'zone', 'ui', 'uiGo', 'hold', 'win', 'star',
  'powerGet', 'powerEmpty', 'thunder', 'smash', 'stun', 'ghostOn', 'ghostOff', 'ghostTick', 'chiliOn', 'chiliOff', 'burn', 'scare',
  'rattleThrow', 'lure', 'crunch', 'gold', 'combo', 'zoneClear', 'medal', 'nearMiss', 'pushup', 'flutter', 'tumble', 'sentry',
  'nestRegrow', 'denied', 'storm', 'splash', 'logLift', 'logLodge', 'tunnel', 'spiderOut', 'spiderIn', 'hiss', 'coati',
];
const ZONES = ['morning', 'noon', 'canyon', 'thicket', 'dusk', 'sunset'];
const MUSIC = [...ZONES, 'morning, hunted', 'morning, ghost', 'morning, chili', 'canyon, hunted, chili', 'tour of every area'];
const CHECKS = [
  'the list of names here matches Sound.names',
  'no sound throws',
  'no sound is silent',
  'nothing clips (every peak under 1.0)',
  'the ceiling is hardly touched by any single sound',
  'thunder is the loudest effect, gold is among the loudest',
  'step, flutter, pushup and ghostTick are among the quietest',
  'smash is louder and longer with more boulders',
  'combo, medal and ghostTick rise in pitch with n',
  'every effect is over within 4 s',
  'the tune plays in every area and never clips',
  'noon is brighter than morning, dusk is darker',
  'noon is faster than morning, dusk is slower',
  'the canyon has the most echo',
  'being hunted makes the tune louder and faster',
  'the ghost layer shuts the tune down, and leaves cleanly',
  'the chili layer drives the tune faster, and leaves cleanly',
  'changing area or power makes no click',
  'everything at once still does not clip',
  'voices are let go when they finish',
  'effects sit above the tune',
  'the first sound after the audio starts is as loud as any other time',
  'the air of every area can be heard, under the tune',
];

// Runs in the page.
const lab = async () => {
  const S = window.et.sound.constructor, CHECKS = window.__checks;
  const SR = 44100;
  const db = (v) => (v > 1e-6 ? (20 * Math.log10(v)).toFixed(1) : '-inf');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /** Render `seconds` of a fresh Sound. Output channels 0,1 are the final output, 2,3 the signal before the ceiling. */
  const render = async (seconds, { prep, at = [], beds = true, tick = true } = {}) => {
    const ctx = new OfflineAudioContext(4, Math.ceil(SR * seconds), SR);
    const merge = ctx.createChannelMerger(4); merge.connect(ctx.destination);
    const a = ctx.createChannelSplitter(2), b = ctx.createChannelSplitter(2);
    a.connect(merge, 0, 0); a.connect(merge, 1, 1); b.connect(merge, 0, 2); b.connect(merge, 1, 3);
    const s = new S();
    prep?.(s);
    s.attach(ctx, { dest: a, beds });
    s.tap.connect(b);
    const events = [...at].sort((x, y) => x[0] - y[0]);
    const dt = 0.05;
    let error = null;
    const fire = (t) => {
      try {
        while (events.length && events[0][0] <= t + 1e-6) events.shift()[1](s);
        if (tick) s.update(dt, t);
      } catch (err) { error ??= String(err?.stack ?? err).split('\n').slice(0, 2).join(' '); }
    };
    fire(0);
    for (let k = 1; k * dt < seconds; k++) ctx.suspend(k * dt).then(() => { fire(k * dt); void ctx.resume(); });
    const t0 = performance.now();
    const buf = await ctx.startRendering();
    return { s, buf, ms: performance.now() - t0, error };
  };

  /** Length (first to last sample within 30 dB of the peak, so a faint echo does not count), peak, loudness over that
   *  length, and a few rough descriptions. */
  const stats = (buf, from = 0, to = buf.length / SR) => {
    const L = buf.getChannelData(0), R = buf.getChannelData(1), TL = buf.getChannelData(2), TR = buf.getChannelData(3);
    const i0 = Math.floor(from * SR), i1 = Math.min(buf.length, Math.floor(to * SR));
    let peak = 0, pre = 0, first = -1, last = -1;
    for (let i = i0; i < i1; i++) {
      peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
      pre = Math.max(pre, Math.abs(TL[i]), Math.abs(TR[i]));
    }
    const floor = Math.max(0.0005, peak * 0.03);
    for (let i = i0; i < i1; i++) if (Math.abs(L[i]) > floor || Math.abs(R[i]) > floor) { if (first < 0) first = i; last = i; }
    if (first < 0) return { dur: 0, peak, pre, rms: 0, loud: 0, bright: 0, width: 0, zc: 0, jump: 0 };
    let sum = 0, diff = 0, side = 0, mid = 0, zc = 0, jump = 0, heard = 0, h1 = 0, h2 = 0, was = 0, was1 = 0;
    const a = 1 / (1 + (2 * Math.PI * 200) / SR);
    for (let i = first + 1; i <= last; i++) {
      // A sound with no echo on it is mono, and then only the left channel carries it.
      const m = L[i] + R[i], d = m - (L[i - 1] + R[i - 1]);
      sum += Math.max(L[i] * L[i], R[i] * R[i]);
      // Loudness as an ear (or a laptop speaker) has it: the same, less what is below about 200 Hz.
      const x = Math.abs(L[i]) >= Math.abs(R[i]) ? L[i] : R[i];
      h1 = a * (h1 + x - was); was = x;
      const y = a * (h2 + h1 - was1); was1 = h1; h2 = y;
      heard += y * y;
      mid += m * m; diff += d * d; side += (L[i] - R[i]) * (L[i] - R[i]);
      if ((L[i] >= 0) !== (L[i - 1] >= 0)) zc++;
      jump = Math.max(jump, Math.abs(L[i] - L[i - 1]), Math.abs(R[i] - R[i - 1]));
    }
    const n = last - first;
    return {
      dur: (n + 1) / SR, peak, pre, rms: Math.sqrt(sum / n), loud: Math.sqrt(heard / n),
      bright: Math.round((SR / (2 * Math.PI)) * Math.sqrt(diff / Math.max(1e-12, mid))),   // about where the weight of the spectrum is, Hz
      width: Math.sqrt(side / Math.max(1e-12, mid)),                                        // 0 mono .. 1 all echo and beds
      zc: Math.round(zc / (2 * (n / SR))),                                                  // rough pitch, Hz
      jump,                                                                                 // biggest step between two samples
    };
  };
  const row = (x) => `${x.dur.toFixed(2).padStart(5)} s   peak ${x.peak.toFixed(3)} (${db(x.peak).padStart(5)} dB)   rms ${db(x.rms).padStart(5)} dB   heard ${db(x.loud).padStart(5)} dB   before the ceiling ${x.pre.toFixed(3)}`;

  const out = { sfx: {}, music: {}, ok: {}, detail: {}, extra: {} };
  const check = (name, ok, detail = '') => { out.ok[name] = !!ok; out.detail[name] = detail; };

  // --- every effect, alone. (Each is played one second in: a browser's compressor fades in from nothing over the
  // first fifth of a second of a context's life, and that would be measured instead of the sound.)
  const N = { egg: 3, bank: 3, star: 1, combo: 4, smash: 2, medal: 3, ghostTick: 0.5, hold: 0.5, crunch: 1 };
  const one = async (name, n) => {
    // (Without the echo, so the length is the sound's own.)
    const dry = (s) => { s.sfxSend.gain.cancelScheduledValues(0); s.sfxSend.gain.value = 0; };
    // (Three times, and the middle one by peak is kept: the sounds made of noise are not the same twice.)
    const goes = [];
    for (let k = 0; k < 3; k++) {
      const r = await render(5, { beds: false, tick: false, at: [[0, dry], [1, (s) => s.play(name, n)]] });
      goes.push({ ...stats(r.buf, 0.9), error: r.error });
    }
    const error = goes.find((g) => g.error)?.error ?? null;
    goes.sort((x, y) => x.peak - y.peak);
    return { ...goes[1], error, least: goes[0].peak, most: goes[2].peak };
  };
  const sfx = {};
  for (const name of S.names) {
    sfx[name] = await one(name, N[name] ?? 0);
    out.sfx[name] = sfx[name].error ? 'THREW ' + sfx[name].error : row(sfx[name]);
  }
  const names = S.names;
  check(CHECKS[0], JSON.stringify(names) === JSON.stringify(window.__names), names.filter((n) => !window.__names.includes(n)).join(' '));
  check(CHECKS[1], names.every((n) => !sfx[n].error), names.filter((n) => sfx[n].error).join(' '));
  check(CHECKS[2], names.every((n) => sfx[n].peak > 0.01 && sfx[n].dur > 0.008), names.filter((n) => !(sfx[n].peak > 0.01 && sfx[n].dur > 0.008)).join(' '));
  check(CHECKS[3], names.every((n) => sfx[n].peak < 1), names.filter((n) => sfx[n].peak >= 1).join(' '));
  check(CHECKS[4], names.every((n) => sfx[n].pre < 0.8), names.filter((n) => sfx[n].pre >= 0.8).map((n) => `${n} ${sfx[n].pre.toFixed(2)}`).join(' '));
  // Loudness as a listener would rank it: mostly the peak, a little the length.
  const loud = (x) => x.loud * Math.sqrt(Math.min(1, x.dur / 0.4));
  const byPeak = [...names].sort((a, b) => sfx[b].peak - sfx[a].peak);
  const byLoud = [...names].sort((a, b) => loud(sfx[b]) - loud(sfx[a]));
  out.extra['loudest first (by peak)'] = byPeak.join(' ');
  out.extra['loudest first (by rms and length)'] = byLoud.join(' ');
  check(CHECKS[5], byPeak[0] === 'thunder' && byLoud.indexOf('thunder') < 8 && byPeak.indexOf('gold') < 6 && byLoud.indexOf('gold') < 6, `thunder #${byPeak.indexOf('thunder') + 1}/#${byLoud.indexOf('thunder') + 1}, gold #${byPeak.indexOf('gold') + 1}/#${byLoud.indexOf('gold') + 1}`);
  out.extra['not the same every time (peak, least to most of three)'] = names.filter((n) => sfx[n].most > sfx[n].least * 1.25).map((n) => `${n} ${sfx[n].least.toFixed(3)}-${sfx[n].most.toFixed(3)}`).join(', ');
  const quiet = ['step', 'flutter', 'pushup', 'ghostTick'];
  check(CHECKS[6], quiet.every((n) => byPeak.indexOf(n) >= names.length - 12 && sfx[n].peak < sfx.thunder.peak * 0.3), quiet.map((n) => `${n} #${byPeak.indexOf(n) + 1} of ${names.length}`).join(', '));
  const v = {};
  for (const [name, n] of [['smash', 1], ['smash', 4], ['combo', 2], ['combo', 5], ['combo', 9], ['medal', 0], ['medal', 3], ['medal', 6], ['ghostTick', 0], ['ghostTick', 1], ['egg', 0], ['egg', 8]]) {
    v[name + n] = await one(name, n);
    out.extra[`${name} ${n}`] = row(v[name + n]) + `   pitch about ${v[name + n].zc} Hz`;
  }
  check(CHECKS[7], v.smash4.rms * Math.sqrt(v.smash4.dur) > v.smash1.rms * Math.sqrt(v.smash1.dur) * 1.15 && v.smash4.dur > v.smash1.dur * 1.15);
  check(CHECKS[8], v.combo2.zc < v.combo5.zc && v.combo5.zc < v.combo9.zc && v.medal0.zc < v.medal3.zc && v.medal3.zc < v.medal6.zc && v.ghostTick0.zc < v.ghostTick1.zc);
  check(CHECKS[9], names.every((n) => sfx[n].dur < 3.5), names.filter((n) => sfx[n].dur >= 3.5).join(' '));
  // The very first sound after the audio starts (the "go" of the title screen) must not be lost in that fade.
  const early = await render(2, { beds: false, tick: false, at: [[0, (s) => s.play('uiGo')]] });
  const e = stats(early.buf);
  out.extra['uiGo as the very first sound'] = row(e);
  check(CHECKS[21], e.peak > sfx.uiGo.peak * 0.6 && e.peak < sfx.uiGo.peak * 1.6, `${e.peak.toFixed(3)} against ${sfx.uiGo.peak.toFixed(3)} later`);

  // --- the tune and the air
  const LEN = 24;
  const tune = async (label, zone, opts = {}) => {
    const r = await render(LEN, { prep: (s) => { s.setZone(zone); opts.prep?.(s); }, at: opts.at });
    const x = { ...stats(r.buf, 2), steps: r.s.step, ms: r.ms, error: r.error, s: r.s, buf: r.buf };
    out.music[label] = x.error ? 'THREW ' + x.error : `peak ${x.peak.toFixed(3)}   rms ${db(x.rms).padStart(5)} dB   heard ${db(x.loud).padStart(5)} dB   ${String(Math.round((x.steps / 4 / LEN) * 60)).padStart(3)} beats a minute   bright ${String(x.bright).padStart(4)} Hz   width ${x.width.toFixed(2)}   costs ${(Math.max(0, x.ms - idle) / (LEN * 10)).toFixed(1)}% of one core here`;
    return x;
  };
  const m = {};
  // What the suspending and resuming of the off-line render itself costs, to take off the timings.
  const idle = (await render(LEN, { beds: false, tick: false })).ms;
  for (const zone of ['morning', 'noon', 'canyon', 'thicket', 'dusk', 'sunset']) m[zone] = await tune(zone, zone);
  m.hunted = await tune('morning, hunted', 'morning', { prep: (s) => { s.setTension(1); } });
  m.ghost = await tune('morning, ghost', 'morning', { prep: (s) => s.setPower('ghost') });
  m.chili = await tune('morning, chili', 'morning', { prep: (s) => { s.setPower('chili'); } });
  m.worst = await tune('canyon, hunted, chili', 'canyon', { prep: (s) => { s.setTension(1); s.setPower('chili'); } });
  const zones = ['morning', 'noon', 'canyon', 'thicket', 'dusk', 'sunset'];
  const all = Object.values(m);
  check(CHECKS[10], all.every((x) => !x.error && x.rms > 0.005 && x.peak < 1), all.map((x) => x.error).filter(Boolean).join(' '));
  check(CHECKS[11], m.noon.bright > m.morning.bright * 1.1 && m.dusk.bright < m.morning.bright * 0.8, zones.map((z) => `${z} ${m[z].bright}`).join(', '));
  check(CHECKS[12], m.noon.steps > m.morning.steps && m.dusk.steps < m.morning.steps * 0.9);
  check(CHECKS[13], zones.every((z) => z === 'canyon' || m.canyon.width > m[z].width), zones.map((z) => `${z} ${m[z].width.toFixed(2)}`).join(', '));
  check(CHECKS[14], m.hunted.loud > m.morning.loud * 1.15 && m.hunted.steps > m.morning.steps * 1.25, `heard ${db(m.morning.loud)} -> ${db(m.hunted.loud)} dB, steps ${m.morning.steps} -> ${m.hunted.steps}`);

  // The air of each area with the tune switched off: it should be there, and well under the tune.
  const air = {};
  for (const zone of zones) {
    const r = await render(LEN, { prep: (s) => s.setZone(zone), at: [[0, (s) => { s.music.gain.value = 0; }]] });
    air[zone] = stats(r.buf, 2);
    out.extra[`the air alone, ${zone}`] = r.error ? 'THREW ' + r.error : `peak ${air[zone].peak.toFixed(3)}   rms ${db(air[zone].rms)} dB   heard ${db(air[zone].loud)} dB   bright ${air[zone].bright} Hz   (the tune there is heard at ${db(m[zone].loud)} dB)`;
  }
  check(CHECKS[22], zones.every((z) => air[z].loud > 0.002 && air[z].loud < m[z].loud * 0.75), zones.map((z) => `${z} ${db(air[z].loud)}`).join(', '));

  // The powers, on at 8 s and off at 16 s: the tune's tone before, during and after; and that the layer's nodes go.
  const power = async (kind) => {
    const r = await render(LEN, { at: [[8, (s) => s.setPower(kind)], [16, (s) => s.setPower(null)]] });
    const before = stats(r.buf, 3, 8), during = stats(r.buf, 10, 16), after = stats(r.buf, 19, 24);
    return { before, during, after, s: r.s };
  };
  // (Only the tune, to hear what the ghost does to it: the same again with the pad muted would be nicer, but the
  // pad is bright by design, so compare the tune bus alone instead.)
  const tuneOnly = async (kind) => {
    const ctx = new OfflineAudioContext(1, SR * 12, SR);
    const s = new S(); s.setPower(kind); s.attach(ctx, { dest: ctx.createGain(), beds: false });
    s.musicDuck.connect(ctx.destination);
    s.update(0.05, 0);
    for (let k = 1; k * 0.05 < 12; k++) ctx.suspend(k * 0.05).then(() => { s.update(0.05, k * 0.05); void ctx.resume(); });
    const buf = await ctx.startRendering(), d = buf.getChannelData(0);
    let sum = 0, diff = 0;
    for (let i = SR; i < d.length; i++) { sum += d[i] * d[i]; diff += (d[i] - 2 * d[i - 1] + d[i - 2]) ** 2; }
    // `top` is the loudness of the high part of the sound only (what is left when the slow movement is taken out).
    return { rms: Math.sqrt(sum / d.length), top: Math.sqrt(diff / d.length), steps: s.step };
  };
  const plain = await tuneOnly(null), under = await tuneOnly('ghost'), hot = await tuneOnly('chili');
  out.extra['the tune alone'] = `rms ${db(plain.rms)} dB, its high part ${db(plain.top)} dB, ${plain.steps} steps in 12 s`;
  out.extra['the tune under the ghost egg'] = `rms ${db(under.rms)} dB, its high part ${db(under.top)} dB`;
  out.extra['the tune with the chili egg'] = `rms ${db(hot.rms)} dB, its high part ${db(hot.top)} dB, ${hot.steps} steps in 12 s`;
  const g = await power('ghost'), c = await power('chili');
  await sleep(150);
  out.extra['ghost on at 8 s, off at 16 s'] = `heard before ${db(g.before.loud)}, during ${db(g.during.loud)}, after ${db(g.after.loud)} dB`;
  out.extra['chili on at 8 s, off at 16 s'] = `heard before ${db(c.before.loud)}, during ${db(c.during.loud)}, after ${db(c.after.loud)} dB`;
  check(CHECKS[15], under.top < plain.top * 0.3 && g.s.ghost === null && m.ghost.s.ghost !== null && g.during.loud > g.before.loud && Math.abs(20 * Math.log10(g.after.loud / g.before.loud)) < 4, `the tune's high part ${db(plain.top)} -> ${db(under.top)} dB`);
  check(CHECKS[16], hot.steps > plain.steps * 1.15 && c.during.loud > c.before.loud * 1.12 && Math.abs(20 * Math.log10(c.after.loud / c.before.loud)) < 4, `steps ${plain.steps} -> ${hot.steps}`);

  // A walk through every area, 5 s in each, with both powers switched on and off on the way.
  const stops = zones.map((z, i) => [4 + i * 5, (s) => s.setZone(z)]);
  const tour = await render(36, { at: [...stops, [7, (s) => s.setPower('ghost')], [9.5, (s) => s.setPower(null)], [17, (s) => s.setPower('chili')], [18.5, (s) => s.setPower('ghost')], [20, (s) => s.setPower(null)]] });
  const whole = stats(tour.buf, 1);
  // A click is one sample far from its neighbours: look for the biggest step in the 60 ms after each change and
  // compare it with the biggest anywhere (the drums make steps of their own).
  const after = [...stops.map((x) => x[0]), 7, 9.5, 17, 18.5, 20].map((t) => stats(tour.buf, t, t + 0.06).jump);
  out.music['tour of every area'] = tour.error ? 'THREW ' + tour.error : `peak ${whole.peak.toFixed(3)}   rms ${db(whole.rms)} dB   biggest step between samples ${whole.jump.toFixed(3)}, just after a change ${Math.max(...after).toFixed(3)}`;
  check(CHECKS[17], !tour.error && Math.max(...after) < 0.12 && whole.jump < 0.35, `after changes ${Math.max(...after).toFixed(3)}, anywhere ${whole.jump.toFixed(3)}`);

  // --- everything at once: hunted in the canyon with the chili burning, and every effect fired in the same instant, twice
  const pile = await render(8, {
    prep: (s) => { s.setZone('canyon'); s.setTension(1); s.setPower('chili'); },
    at: [[1, (s) => names.forEach((n) => s.play(n, 3))], [1.5, (s) => names.forEach((n) => s.play(n, 6))], [2.5, (s) => { s.play('thunder'); s.play('gold'); s.play('smash', 6); s.play('caught'); s.play('win'); }]],
  });
  const p = stats(pile.buf);
  out.extra['everything at once'] = pile.error ? 'THREW ' + pile.error : row(p);
  check(CHECKS[18], !pile.error && p.peak < 1, `peak ${p.peak.toFixed(3)}, before the ceiling ${p.pre.toFixed(3)}`);

  // --- house-keeping
  await sleep(300);
  out.extra['voices still held after rendering'] = `tune ${m.worst.s.voices}, pile ${pile.s.voices}`;
  check(CHECKS[19], m.worst.s.voices < 40 && pile.s.voices < 40 && m.morning.s.voices < 40, `${m.morning.s.voices} ${m.worst.s.voices} ${pile.s.voices}`);
  // The effects heard most, against the tune: the middle one of each, by peak and by loudness while it sounds.
  const usual = ['egg', 'bank', 'dash', 'spotted', 'crunch', 'combo', 'powerGet', 'snap', 'rattle', 'tail'];
  const middle = (list) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
  const fxPeak = middle(usual.map((n) => sfx[n].peak)), fxLoud = middle(usual.map((n) => sfx[n].loud));
  const tunePeak = middle(zones.map((z) => m[z].peak)), tuneLoud = middle(zones.map((z) => m[z].loud));
  out.extra['a usual effect against the tune'] = `peak ${fxPeak.toFixed(3)} against ${tunePeak.toFixed(3)} (${(20 * Math.log10(fxPeak / tunePeak)).toFixed(1)} dB above), heard ${db(fxLoud)} against ${db(tuneLoud)} dB (${(20 * Math.log10(fxLoud / tuneLoud)).toFixed(1)} dB above)`;
  check(CHECKS[20], fxPeak > tunePeak && fxLoud > tuneLoud * 1.8);
  return out;
};

// Runs in the page, on the real audio context.
const live = async () => {
  const s = window.et.sound, S = s.constructor, ctx = s.live;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const an = ctx.createAnalyser(); an.fftSize = 2048;
  s.out.connect(an);
  const data = new Float32Array(an.fftSize);
  let peak = 0, most = 0;
  const poll = setInterval(() => { an.getFloatTimeDomainData(data); for (const x of data) peak = Math.max(peak, Math.abs(x)); most = Math.max(most, s.voices); }, 20);
  const t0 = ctx.currentTime;
  s.setTension(1);
  for (const n of S.names) s.play(n, 3);
  await sleep(1200);
  for (const zone of ['noon', 'canyon', 'thicket', 'dusk', 'sunset', 'nowhere', 'morning']) {
    s.setZone(zone);
    s.setPower('ghost'); await sleep(200);
    s.setPower('chili'); await sleep(200);
    for (const n of S.names) s.play(n, 1);
    s.setPower(null); await sleep(250);
  }
  // Mute and back: nothing may be scheduled while muted.
  const before = s.voices;
  s.toggleMute(); for (const n of S.names) s.play(n, 2);
  const whileMuted = s.voices - before;
  s.toggleMute();
  // The small sounds, asked for 250 times a second for a second and a half (once the burst has died away).
  s.setTension(0);
  await sleep(3200);
  let asked = 0;
  const spamFrom = s.voices;
  let spamMost = 0;
  const spam = setInterval(() => { for (const n of ['step', 'rattle', 'crunch', 'flutter', 'tumble', 'hold', 'peck']) { s.play(n, asked++); } spamMost = Math.max(spamMost, s.voices); }, 4);
  await sleep(1500);
  clearInterval(spam);
  await sleep(1500);
  clearInterval(poll);
  s.out.disconnect(an);
  return { state: ctx.state, seconds: +(ctx.currentTime - t0).toFixed(1), peak: +peak.toFixed(3), mostVoices: most, scheduledWhileMuted: whileMuted, spam: `${asked} asked, voices went from ${spamFrom} to at most ${spamMost}`, voicesAtEnd: s.voices, ghost: s.ghost === null ? 'gone' : 'still there' };
};

export default {
  size: [640, 360],
  steps: [
    { goto: 'skip=1' },
    { eval: `window.__names = ${JSON.stringify(NAMES)}; window.__checks = ${JSON.stringify(CHECKS)}; (${lab})().then((r) => { window.__lab = r; return 'done'; })`, as: 'off-line lab' },
    ...NAMES.map((n) => ({ eval: `__lab.sfx[${JSON.stringify(n)}] ?? 'MISSING'`, as: n.padEnd(11) })),
    ...MUSIC.map((n) => ({ eval: `__lab.music[${JSON.stringify(n)}] ?? 'MISSING'`, as: n.padEnd(21) })),
    { eval: '__lab.extra', as: 'more' },
    ...CHECKS.map((c) => ({ expect: `__lab.ok[${JSON.stringify(c)}]`, as: c })),
    { eval: 'Object.fromEntries(Object.entries(__lab.detail).filter(([k, v]) => v))', as: 'details' },
    // The real thing: a key press is what lets a browser start its audio.
    { expect: 'et.sound.waiting === false', as: 'switched off, the sound is not waiting for anything' },
    { eval: 'et.sound.enabled = true', as: 'sound switched on' },
    { expect: '(() => { const s = et.sound, a = s.waiting; s.muted = true; const b = s.waiting; s.muted = false; return a === true && b === false; })()', as: 'before any key or click the sound is waiting for one (and not when muted)' },
    { press: 'KeyV' },
    { wait: 700 },
    { expect: 'et.sound.live?.state === "running"', as: 'the live audio context is running' },
    { expect: 'et.sound.waiting === false', as: 'after a key press it is no longer waiting' },
    { eval: `(${live})().then((r) => { window.__live = r; return r; })`, as: 'live' },
    { expect: '__live.peak > 0.02 && __live.peak < 1', as: 'the live output is audible and does not clip' },
    { expect: '__live.scheduledWhileMuted === 0', as: 'nothing is scheduled while muted' },
    { expect: '__live.mostVoices < 260', as: 'the number of voices stays bounded under spam' },
    { expect: '__live.ghost === "gone"', as: 'the ghost layer is gone at the end' },
    // What a browser does to a page that has only had gamepad presses: the context exists, but is held back.
    { expect: '(async () => { const s = et.sound; await s.live.suspend(); const a = s.waiting; s.muted = true; const b = s.waiting; s.muted = false; await s.live.resume(); return a === true && b === false && s.waiting === false; })()', as: 'a context the browser holds back counts as waiting; resumed, it does not' },
  ],
};
