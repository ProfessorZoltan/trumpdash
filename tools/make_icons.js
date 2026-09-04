// Renders the app icons (manifest + apple-touch-icon) and the social preview image from the game's
// own sprite sheet, using headless Chrome over CDP like tools/shoot.js. Server must be running on 8765.
// usage: node tools/make_icons.js
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = parseInt(process.env.PORT || '9334', 10);
const OUT = path.join(__dirname, '..', 'icons');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && this.pending.has(m.id)) { this.pending.get(m.id)(m); this.pending.delete(m.id); } }; }
  send(method, params) { const id = ++this.id; this.ws.send(JSON.stringify({ id, method, params: params || {} })); return new Promise((res) => this.pending.set(id, res)); }
  async eval(expr) { const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); return r.result && r.result.result ? r.result.result.value : undefined; }
}

// Runs inside the page once the sprite sheet is loaded (state === 'menu').
const RENDER_ICONS = `(function () {
  const R = window.TD_RENDER;
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function icon(size, fullBleed) {
    const cv = document.createElement('canvas'); cv.width = cv.height = size; const c = cv.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, size); g.addColorStop(0, '#0a3fb8'); g.addColorStop(0.55, '#0033a0'); g.addColorStop(1, '#05060f');
    c.fillStyle = g;
    if (fullBleed) c.fillRect(0, 0, size, size); else { rr(c, 0, 0, size, size, size * 0.2); c.fill(); }
    c.save(); if (!fullBleed) { rr(c, 0, 0, size, size, size * 0.2); c.clip(); }
    c.fillStyle = 'rgba(200,16,46,0.75)';
    for (let i = 0; i < 3; i++) c.fillRect(0, size * (0.6 + i * 0.13), size, size * 0.065);
    c.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 3; i++) c.fillRect(0, size * (0.665 + i * 0.13), size, size * 0.065);
    c.restore();
    // ground line + character (thumbs up), kept inside the maskable safe zone when full bleed
    const h = size * (fullBleed ? 0.62 : 0.78), bottom = size * (fullBleed ? 0.86 : 0.95);
    c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = size * 0.04; c.shadowOffsetY = size * 0.02;
    R.drawPose(c, 'thumbs', size / 2, bottom, h, false);
    c.shadowColor = 'transparent';
    if (!fullBleed) { c.lineWidth = size * 0.04; c.strokeStyle = '#ffd400'; rr(c, c.lineWidth / 2, c.lineWidth / 2, size - c.lineWidth, size - c.lineWidth, size * 0.19); c.stroke(); }
    return cv.toDataURL('image/png');
  }
  return { 'icon-192.png': icon(192, false), 'icon-512.png': icon(512, false), 'icon-512-maskable.png': icon(512, true), 'apple-touch-icon.png': icon(180, true) };
})()`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const profile = path.join(require('os').tmpdir(), 'td-chrome-profile-' + PORT);
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--window-size=960,540', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let wsUrl = null;
  for (let i = 0; i < 60 && !wsUrl; i++) { try { const j = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); const t = j.find((x) => x.type === 'page'); if (t) wsUrl = t.webSocketDebuggerUrl; } catch (e) { /* retry */ } if (!wsUrl) await sleep(250); }
  if (!wsUrl) { console.error('chrome did not start'); chrome.kill(); process.exit(1); }
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => (ws.onopen = r));
  const cdp = new CDP(ws);
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
  await cdp.send('Page.navigate', { url: 'http://localhost:8765/?noaudio=1&debug=1' });
  let ready = false;
  for (let i = 0; i < 100 && !ready; i++) { const s = await cdp.eval("(window.TD_GAME||{}).state"); ready = s === 'menu'; if (!ready) await sleep(100); }
  if (!ready) { console.error('game did not reach the menu'); chrome.kill(); process.exit(1); }
  // a clean menu for the preview: no records, sound on
  await cdp.eval("(function(){const G=window.TD_GAME; for (const k in G.best) { G.best[k]=0; G.wins[k]=0; G.pbest[k]=0; G.pwins[k]=0; } G.muted=false; return true;})()");
  await sleep(300);
  const icons = await cdp.eval(RENDER_ICONS);
  for (const [name, url] of Object.entries(icons)) {
    fs.writeFileSync(path.join(OUT, name), Buffer.from(url.split(',')[1], 'base64'));
    console.log('wrote', name);
  }
  // Play Store feature graphic (1024x500, required by the listing)
  const feature = await cdp.eval(`(function () {
    const R = window.TD_RENDER, cv = document.createElement('canvas'); cv.width = 1024; cv.height = 500; const c = cv.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, 500); g.addColorStop(0, '#05061a'); g.addColorStop(0.6, '#0c1a52'); g.addColorStop(1, '#0033a0');
    c.fillStyle = g; c.fillRect(0, 0, 1024, 500);
    let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    c.fillStyle = '#fff'; for (let i = 0; i < 120; i++) { c.globalAlpha = 0.3 + rnd() * 0.7; const s = 1 + rnd() * 2; c.fillRect(rnd() * 1024, rnd() * 330, s, s); } c.globalAlpha = 1;
    c.fillStyle = 'rgba(200,16,46,0.8)'; for (let i = 0; i < 3; i++) c.fillRect(0, 386 + i * 40, 1024, 20);
    c.fillStyle = 'rgba(255,255,255,0.35)'; for (let i = 0; i < 3; i++) c.fillRect(0, 406 + i * 40, 1024, 20);
    c.fillStyle = '#ffd400'; c.fillRect(0, 383, 1024, 4);
    R.drawTitle(c, 670, 120, 118);
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    c.font = 'bold 24px "Segoe UI", Arial, sans-serif'; c.lineWidth = 6; c.strokeStyle = 'rgba(0,0,0,0.8)'; c.fillStyle = '#ffe9a0';
    c.strokeText('A RHYTHM-RUNNER PARODY', 670, 202); c.fillText('A RHYTHM-RUNNER PARODY', 670, 202);
    c.font = 'bold 34px Impact, "Arial Black", sans-serif'; c.lineWidth = 8; c.fillStyle = '#fff';
    c.strokeText('RUN. JUMP. ANNEX. STAY ON THE BEAT.', 670, 252); c.fillText('RUN. JUMP. ANNEX. STAY ON THE BEAT.', 670, 252);
    c.font = 'bold 19px Impact, "Arial Black", sans-serif'; c.lineWidth = 6; c.fillStyle = '#7dffb0';
    c.strokeText('SIX LEVELS: GREENLAND · VENEZUELA · HORMUZ · CANADA · PANAMA · THE MOON', 670, 300); c.fillText('SIX LEVELS: GREENLAND · VENEZUELA · HORMUZ · CANADA · PANAMA · THE MOON', 670, 300);
    c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = 18; c.shadowOffsetY = 8;
    R.drawPose(c, 'thumbs', 185, 488, 430, false);
    c.shadowColor = 'transparent';
    c.font = '15px "Segoe UI", Arial, sans-serif'; c.lineWidth = 4; c.fillStyle = 'rgba(255,255,255,0.85)';
    c.strokeText('Parody. Not affiliated with any person, government or oil company.', 670, 356); c.fillText('Parody. Not affiliated with any person, government or oil company.', 670, 356);
    return cv.toDataURL('image/png');
  })()`);
  const STORE = path.join(__dirname, '..', 'store');
  fs.mkdirSync(STORE, { recursive: true });
  fs.writeFileSync(path.join(STORE, 'feature.png'), Buffer.from(feature.split(',')[1], 'base64'));
  console.log('wrote store/feature.png');
  // social preview: the menu itself, straight from the 960x540 canvas
  const og = await cdp.eval("document.getElementById('game').toDataURL('image/png')");
  fs.writeFileSync(path.join(OUT, 'og.png'), Buffer.from(og.split(',')[1], 'base64'));
  console.log('wrote og.png');
  ws.close(); chrome.kill();
})();
