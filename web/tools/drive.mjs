// Play the game headless with real key presses and look at what happened. Software rendering only (SwiftShader),
// so it never touches the real GPU. The dev server must be running (npm run dev).
//   node tools/drive.mjs tools/scenarios/<name>.mjs
// A scenario's default export is { size?: [w, h], steps: [...] }. A step is one of:
//   { goto: 'skip=1&view=tilt' }      load the game with that query and wait until it runs
//   { wait: ms }                      let it run
//   { eval: 'js', as?: 'label' }      run in the page (window.et is the Game) and print the value
//   { expect: 'js', as?: 'label' }    the same, and the run fails unless it's truthy
//   { press: 'Space' }                tap a key (KeyboardEvent.code)        { hold: 'KeyD', ms: 800 }  hold one
//   { down: 'KeyW' } ... { up: 'KeyW' }   keep a key down across other steps (with et.fast() the frame rate doesn't matter)
//   { shot: 'name' }                  screenshot to .shots/<name>.png
//   { device: { size: [844, 390], scale: 2, touch: true } }   pretend to be a phone or tablet from the next goto on
//                                     ({ device: null } goes back to a desktop window). Each device is a browser
//                                     started afresh: one that has been several devices in a row loses track of fingers.
//   { tdown: [x, y], id?: 0 }         put a finger down (page pixels); a second finger takes another id
//   { tmove: [x, y], id?: 0 }         slide it          { tup: 0 }  lift the finger with that id
//   { tap: [x, y] } or { tap: '.css-selector' }   a quick touch, at a point or in the middle of an element
// Exits 1 on a failed expect, a step that throws, or anything the page logs as an error.
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = join(import.meta.dirname, '..');
const file = process.argv[2];
if (!file) throw new Error('usage: node tools/drive.mjs <scenario.mjs>');
const scenario = (await import(pathToFileURL(resolve(process.cwd(), file)).href)).default;
const [W, H] = scenario.size ?? [1280, 720];
mkdirSync(join(root, '.shots'), { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let seq = 0, failed = 0;
const pending = new Map();
const errors = [];
let chrome, ws, profile;
/** Shut the browser and throw its profile away. */
const close = () => { try { ws?.close(); } catch {} try { chrome?.kill('SIGKILL'); } catch {} try { if (profile) rmSync(profile, { recursive: true, force: true }); } catch {} ws = chrome = undefined; pending.clear(); };
const done = (code) => { close(); process.exit(code); };
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => done(130));
const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });

/** Start a browser (a new one each time: nothing is carried over) and get it ready to be driven. */
async function open() {
  close();
  const port = 9300 + Math.floor(Math.random() * 500);
  profile = join(root, '.shots', 'chrome-' + port);
  chrome = spawn('chromium', [
    '--headless=new', '--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--hide-scrollbars', '--mute-audio', `--window-size=${W},${H}`, `--remote-debugging-port=${port}`, '--user-data-dir=' + profile, 'about:blank',
  ], { stdio: 'ignore' });
  let sock;
  for (let i = 0; i < 60 && !sock; i++) {
    try {
      const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page');
      if (page) sock = new WebSocket(page.webSocketDebuggerUrl);
    } catch {}
    if (!sock) await sleep(250);
  }
  if (!sock) { console.error('could not connect to chromium'); done(1); }
  await new Promise((r) => sock.addEventListener('open', r, { once: true }));
  sock.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    else if (msg.method === 'Runtime.exceptionThrown') errors.push('exception: ' + (msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text).split('\n').slice(0, 3).join(' '));
    else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      const text = msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 400);
      if (!/vite|GPU stall|swiftshader/i.test(text)) errors.push('error: ' + text);
    }
  });
  ws = sock;
  await send('Runtime.enable');
  await send('Page.enable');
  // No hot reloading during a run: a file saved by someone else mid-test must not restart the page under it.
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => { const WS = window.WebSocket; window.WebSocket = function (url, protocols) {
    if (protocols === 'vite-hmr' || (Array.isArray(protocols) && protocols.includes('vite-hmr'))) return { addEventListener() {}, removeEventListener() {}, send() {}, close() {}, readyState: 0 };
    return new WS(url, protocols); }; })();` });
  // No real gamepad either: a controller plugged into this machine is seen by the headless browser too, and a
  // thumb resting on its stick walks the lizard off in the middle of a test. A scenario that wants a pad makes
  // one up by setting navigator.getGamepads itself, which hides this. The real pad's "here I am" is swallowed too
  // (it would take a pretend phone out of touch mode); one a scenario sends itself is not trusted, and gets through.
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `Navigator.prototype.getGamepads = () => [];
    for (const ev of ['gamepadconnected', 'gamepaddisconnected']) window.addEventListener(ev, (e) => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);` });
}
async function run(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.error) throw new Error(r.error.message);
  const x = r.result?.exceptionDetails;
  if (x) throw new Error((x.exception?.description ?? x.text ?? 'threw').split('\n')[0]);
  return r.result?.result?.value;
}
const KEYS = { Space: [' ', 32], Enter: ['Enter', 13], Escape: ['Escape', 27], ShiftLeft: ['Shift', 16] };
const key = (type, code) => {
  const [k, vk] = KEYS[code] ?? (/^Key[A-Z]$/.test(code) ? [code[3].toLowerCase(), code.charCodeAt(3)] : /^Digit\d$/.test(code) ? [code[5], code.charCodeAt(5)] : [code, 0]);
  return send('Input.dispatchKeyEvent', { type, code, key: k, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
};

await open();
// Fingers. The browser is told where every finger is each time one of them moves; a finger left out has been lifted.
const fingers = new Map();
const touch = (type) => send('Input.dispatchTouchEvent', { type: fingers.size || type === 'touchStart' ? type : 'touchEnd', touchPoints: [...fingers].map(([id, [x, y]]) => ({ x, y, id, radiusX: 12, radiusY: 12, force: 1 })) });
// Drawn in software the game is slow enough that a pretend phone stops waiting for the page and no longer passes
// its fingers on (a real phone's browser does the same to a page that hangs). So nothing is drawn while a finger moves.
const hush = async (on) => { await run(`window.et && (et.noRender = ${on}); 1`).catch(() => {}); await sleep(on ? 160 : 20); };
// A page just loaded, resized or photographed has not yet told the browser where it listens for fingers, and a touch
// then arrives as a bare click. Let it draw a few pictures first.
let unsettled = false;
const settle = async () => {
  if (!unsettled) return;
  unsettled = false;
  await run('new Promise((r) => { let n = 0; const f = () => (++n > 3 ? r(1) : requestAnimationFrame(f)); requestAnimationFrame(f); })');
  await sleep(350);
};
const middleOf = async (sel) => {
  const p = await run(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
  if (!p) throw new Error('nothing on the page matches ' + sel);
  return p;
};
let used = false;
async function device(d) {
  fingers.clear();
  if (used) await open();
  used = false;
  if (!d) return;
  const [w, h] = d.size;
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: d.scale ?? 1, mobile: d.touch !== false, screenWidth: w, screenHeight: h });
  await send('Emulation.setTouchEmulationEnabled', { enabled: d.touch !== false, maxTouchPoints: 5 });
}
try {
  for (const step of scenario.steps) {
    if (step.device !== undefined) await device(step.device);
    if (step.device !== undefined || step.goto !== undefined || step.shot) unsettled = true;
    if (step.goto !== undefined) {
      used = true;
      fingers.clear();
      await send('Page.navigate', { url: `http://127.0.0.1:5183/?mute=1&${step.goto}` });
      for (let i = 0; i < 240; i++) { await sleep(250); if (await run('!!(window.et && window.et.frames > 3)').catch(() => false)) break; }
      if (!(await run('!!window.et'))) throw new Error('the game did not start: ' + (await run('document.getElementById("boot")?.textContent ?? ""')));
    }
    if (step.wait) await sleep(step.wait);
    if (step.press) { await key('keyDown', step.press); await sleep(60); await key('keyUp', step.press); await sleep(60); }
    if (step.down) { await key('keyDown', step.down); await sleep(40); }
    if (step.up) { await key('keyUp', step.up); await sleep(40); }
    if (step.hold) { await key('keyDown', step.hold); await sleep(step.ms ?? 500); await key('keyUp', step.hold); }
    const fingered = step.tdown || step.tmove || step.tup !== undefined || step.tap;
    if (fingered) { await settle(); await hush(true); }
    if (step.tdown) { fingers.set(step.id ?? 0, step.tdown); await touch('touchStart'); await sleep(50); }
    if (step.tmove) { fingers.set(step.id ?? 0, step.tmove); await touch('touchMove'); await sleep(50); }
    if (step.tup !== undefined) { fingers.delete(step.tup); await touch('touchMove'); await sleep(50); }
    if (step.tap) {
      const at = typeof step.tap === 'string' ? await middleOf(step.tap) : step.tap;
      fingers.set(9, at); await touch('touchStart'); await sleep(70);
      fingers.delete(9); await touch('touchMove'); await sleep(90);
    }
    if (fingered) await hush(false);
    if (step.eval) console.log(`${step.as ?? step.eval.slice(0, 50)}:`, JSON.stringify(await run(step.eval)));
    if (step.expect) {
      const v = await run(step.expect);
      console.log(`${v ? 'PASS' : 'FAIL'} ${step.as ?? step.expect.slice(0, 70)}${v ? '' : ' → ' + JSON.stringify(v)}`);
      if (!v) failed++;
    }
    if (step.shot) {
      const r = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(join(root, '.shots', step.shot + '.png'), Buffer.from(r.result.data, 'base64'));
      console.log('shot: .shots/' + step.shot + '.png');
    }
  }
} catch (err) { console.log('FAIL step threw: ' + err.message); failed++; }
for (const e of errors) console.log(e);
console.log(`drive: ${failed || errors.length ? 'FAIL' : 'PASS'}`);
done(failed || errors.length ? 1 : 0);
