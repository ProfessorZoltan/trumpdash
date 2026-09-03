// Real-time screenshot harness: drives headless Chrome over CDP, polls the game's
// debug state (?debug=1) and captures screenshots when conditions are met.
// usage: node tools/shoot.js <plan> [outDir]   plans: ending, tour, audio
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = parseInt(process.env.PORT || '9333', 10);
const OUT = process.argv[3] || path.join(__dirname, '..', 'shots');
const BASE = 'http://localhost:8765/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PLANS = {
  ending: { url: '?level=venezuela&autoplay=1&noaudio=1&mute=1&start=155&debug=1', shots: [
    ['end_enter', (s) => s.ending && s.ending.phase === 'enter' && s.ending.trumpIn > 0.45],
    ['end_inside', (s) => s.ending && s.ending.phase === 'enter' && s.ending.trumpIn >= 1],
    ['end_stamp1', (s) => s.ending && s.ending.phase === 'stamp1' && s.ending.stamp1 >= 1],
    ['end_stamp2', (s) => s.ending && s.ending.phase === 'stamp2' && s.ending.stamp2 >= 1],
    ['end_drive', (s) => s.ending && s.ending.phase === 'drive' && s.ending.truckX - s.ending.truckX0 > 260],
    ['end_complete', (s) => s.state === 'complete'],
  ], timeout: 30000 },
  tour: { url: '?level=venezuela&autoplay=1&noaudio=1&mute=1&start=0&debug=1', shots: [
    ['t_start', (s) => s.beat >= 1.2], ['t_spike', (s) => s.beat >= 8.35], ['t_constitution', (s) => s.beat >= 28.3],
    ['t_orb', (s) => s.beat >= 44.65], ['t_congress', (s) => s.beat >= 50.2], ['t_wall', (s) => s.beat >= 64.3],
    ['t_court', (s) => s.beat >= 77.2], ['t_gag', (s) => s.beat >= 82], ['t_stairs', (s) => s.beat >= 106.5],
    ['t_pad2', (s) => s.beat >= 112.4], ['t_press', (s) => s.beat >= 124.4], ['t_finale', (s) => s.beat >= 150.4],
    ['t_approach', (s) => s.beat >= 157.6], ['t_complete', (s) => s.state === 'complete'],
  ], timeout: 100000 },
  audio: { url: '?level=venezuela&autoplay=1&start=0&debug=1', shots: [['a_mid', (s) => s.beat >= 40], ['a_end', (s) => s.state === 'complete']], timeout: 100000 },
  tour3: { url: '?level=greenland&autoplay=1&noaudio=1&mute=1&start=0&debug=1', shots: [
    ['g_start', (s) => s.beat >= 1.3], ['g_bear', (s) => s.beat >= 24.35], ['g_sale', (s) => s.beat >= 30.4],
    ['g_folketing', (s) => s.beat >= 50.3], ['g_nej', (s) => s.beat >= 64.4], ['g_portal', (s) => s.beat >= 66.45],
    ['g_flipped', (s) => s.beat >= 70.35], ['g_flipped2', (s) => s.beat >= 82.5], ['g_unflip', (s) => s.beat >= 86.55],
    ['g_icebergs', (s) => s.beat >= 101.4], ['g_flippad', (s) => s.beat >= 116.5], ['g_finale', (s) => s.beat >= 130.4],
    ['g_approach', (s) => s.beat >= 149.5], ['g_complete', (s) => s.state === 'complete'],
  ], timeout: 110000 },
  ending3: { url: '?level=greenland&autoplay=1&noaudio=1&mute=1&start=146&debug=1', shots: [
    ['m_enter', (s) => s.ending && s.ending.phase === 'enter'],
    ['m_stamp1', (s) => s.ending && s.ending.phase === 'stamp1' && s.ending.stamp1 >= 1],
    ['m_stamp2', (s) => s.ending && s.ending.phase === 'stamp2' && s.ending.stamp2 >= 1],
    ['m_slide', (s) => s.ending && s.ending.phase === 'slide' && s.ending.slide > 0.5],
    ['m_slid', (s) => s.ending && s.ending.phase === 'slide' && s.ending.slide >= 1],
    ['m_complete', (s) => s.state === 'complete'],
  ], timeout: 40000 },
  flip: { url: '?level=greenland&autoplay=1&noaudio=1&mute=1&start=62&debug=1', shots: [
    ['f_before', (s) => s.beat >= 66.2 && s.grav === 1],
    ['f_flipped', (s) => s.beat >= 67.2 && s.grav === -1],
    ['f_running', (s) => s.beat >= 70.35 && s.grav === -1],
    ['f_back', (s) => s.beat >= 87.2 && s.grav === 1],
  ], timeout: 40000 },
  regmode: { url: '?level=greenland&autoplay=1&noaudio=1&mute=1&start=146&debug=1&practice=0', shots: [
    ['reg_complete', (s) => s.state === 'complete' && s.runPractice === false && s.wins && s.wins.greenland >= 1],
  ], timeout: 40000 },
  pracmode: { url: '?level=greenland&autoplay=1&noaudio=1&mute=1&start=146&debug=1&practice=1', shots: [
    ['prac_complete', (s) => s.state === 'complete' && s.runPractice === true && s.pwins && s.pwins.greenland >= 1],
  ], timeout: 40000 },
  tour4: { url: '?level=canada&autoplay=1&noaudio=1&mute=1&start=0&debug=1', shots: [
    ['c_start', (s) => s.beat >= 1.5], ['c_mountie', (s) => s.beat >= 20.35], ['c_sorry', (s) => s.beat >= 28.4],
    ['c_parliament', (s) => s.beat >= 50.3], ['c_usmca', (s) => s.beat >= 64.4], ['c_ice', (s) => s.beat >= 70.3 && s.speedMul > 1],
    ['c_iceorb', (s) => s.beat >= 74.6], ['c_timmies', (s) => s.beat >= 82.4], ['c_syrup', (s) => s.beat >= 93.3],
    ['c_shack', (s) => s.beat >= 105.4], ['c_rink', (s) => s.beat >= 122.3 && s.speedMul > 1], ['c_tariff', (s) => s.beat >= 131.9],
    ['c_finale', (s) => s.beat >= 148.4], ['c_approach', (s) => s.beat >= 157.5], ['c_complete', (s) => s.state === 'complete'],
  ], timeout: 110000 },
  ending4: { url: '?level=canada&autoplay=1&noaudio=1&mute=1&start=155&debug=1', shots: [
    ['b_enter', (s) => s.ending && s.ending.phase === 'enter'],
    ['b_stamp1', (s) => s.ending && s.ending.phase === 'stamp1' && s.ending.stamp1 >= 1],
    ['b_stamp2', (s) => s.ending && s.ending.phase === 'stamp2' && s.ending.stamp2 >= 1],
    ['b_flagdown', (s) => s.ending && s.ending.phase === 'flag' && s.ending.flagY <= 0.05 && s.ending.flag2Y < 0.3],
    ['b_flagup', (s) => s.ending && s.ending.phase === 'flag' && s.ending.flag2Y >= 1],
    ['b_complete', (s) => s.state === 'complete'],
  ], timeout: 40000 },
  tour5: { url: '?level=panama&autoplay=1&noaudio=1&mute=1&start=0&debug=1', shots: [
    ['p_start', (s) => s.beat >= 1.6], ['p_croc', (s) => s.beat >= 20.35], ['p_fee', (s) => s.beat >= 28.4],
    ['p_lift_low', (s) => s.beat >= 48.75], ['p_lift_high', (s) => s.beat >= 49.9], ['p_lift_off', (s) => s.beat >= 50.4],
    ['p_treaty', (s) => s.beat >= 64.4], ['p_gift', (s) => s.beat >= 72.4], ['p_feeceil', (s) => s.beat >= 83.9],
    ['p_ship', (s) => s.beat >= 99.3], ['p_lock3', (s) => s.beat >= 117.4], ['p_lock4', (s) => s.beat >= 129.6],
    ['p_bridge', (s) => s.beat >= 146.4], ['p_approach', (s) => s.beat >= 157.6], ['p_complete', (s) => s.state === 'complete'],
  ], timeout: 110000 },
  ending5: { url: '?level=panama&autoplay=1&noaudio=1&mute=1&start=155&debug=1', shots: [
    ['n_enter', (s) => s.ending && s.ending.phase === 'enter'],
    ['n_stamp2', (s) => s.ending && s.ending.phase === 'stamp2' && s.ending.stamp2 >= 1 && s.ending.subSign >= 1],
    ['n_gate', (s) => s.ending && s.ending.phase === 'gate' && s.ending.gate >= 1],
    ['n_ship', (s) => s.ending && s.ending.phase === 'ship' && s.ending.ship > 0.45],
    ['n_complete', (s) => s.state === 'complete'],
  ], timeout: 40000 },
  tour6: { url: '?level=moon&autoplay=1&noaudio=1&mute=1&start=0&debug=1', shots: [
    ['x_start', (s) => s.beat >= 1.8], ['x_alien', (s) => s.beat >= 34.35], ['x_ufo', (s) => s.beat >= 38.4],
    ['x_rocket', (s) => s.beat >= 50.3], ['x_lowg', (s) => s.beat >= 66.8 && s.gk > 1], ['x_wall', (s) => s.beat >= 70.7],
    ['x_belt', (s) => s.beat >= 80.6], ['x_boost', (s) => s.beat >= 83.2], ['x_flag', (s) => s.beat >= 99.3],
    ['x_pad', (s) => s.beat >= 114.6], ['x_flipped', (s) => s.beat >= 125.7 && s.grav === -1], ['x_finale', (s) => s.beat >= 150.7],
    ['x_approach', (s) => s.beat >= 157.4], ['x_complete', (s) => s.state === 'complete'],
  ], timeout: 110000 },
  ending6: { url: '?level=moon&autoplay=1&noaudio=1&mute=1&start=157.3&debug=1', shots: [
    ['q_enter', (s) => s.ending && s.ending.phase === 'enter'],
    ['q_typing', (s) => s.ending && s.ending.phase === 'plaque' && s.ending.typed > 60 && s.ending.typed < 150],
    ['q_stamp2', (s) => s.ending && s.ending.phase === 'stamp2' && s.ending.stamp2 >= 1],
    ['q_hop', (s) => s.ending && s.ending.phase === 'hop' && s.ending.ufoX > 200],
    ['q_complete', (s) => s.state === 'complete'],
  ], timeout: 45000 },
  probe: { url: process.env.PROBE_URL || '?debug=1', shots: [
    ['probe', (s) => { if (s.frames % 40 < 3) console.log('PROBE', JSON.stringify({ frames: s.frames, state: s.state, level: s.level, beat: +(s.beat || 0).toFixed(2), attempt: s.attempt, gk: s.gk, song: +(s.song || 0).toFixed(2), err: s.err })); return s.frames > 420; }],
  ], timeout: 15000 },
  menu: { url: '?debug=1', shots: [
    ['menu_1', (s) => s.state === 'menu'],
    ['menu_2', (s) => s.state === 'menu', { key: 'ArrowRight' }],
  ], timeout: 20000 },
  tour2: { url: '?level=hormuz&autoplay=1&noaudio=1&mute=1&start=0&debug=1', shots: [
    ['h_start', (s) => s.beat >= 1.3], ['h_warpowers', (s) => s.beat >= 24.4], ['h_hearing', (s) => s.beat >= 50.2],
    ['h_catapult', (s) => s.beat >= 64.45], ['h_mines', (s) => s.beat >= 70.35], ['h_mineline', (s) => s.beat >= 72.9],
    ['h_un', (s) => s.beat >= 80.4], ['h_gap', (s) => s.beat >= 84.35], ['h_jcpoa', (s) => s.beat >= 105.3],
    ['h_drones', (s) => s.beat >= 116.4], ['h_ceasefire', (s) => s.beat >= 120.9], ['h_nato', (s) => s.beat >= 124.6],
    ['h_tankers', (s) => s.beat >= 146.5], ['h_approach', (s) => s.beat >= 168.6], ['h_complete', (s) => s.state === 'complete'],
  ], timeout: 110000 },
  ending2: { url: '?level=hormuz&autoplay=1&noaudio=1&mute=1&start=166&debug=1', shots: [
    ['t_enter', (s) => s.ending && s.ending.phase === 'enter' && s.ending.trumpIn > 0.45],
    ['t_stamp1', (s) => s.ending && s.ending.phase === 'stamp1' && s.ending.stamp1 >= 1],
    ['t_stamp2', (s) => s.ending && s.ending.phase === 'stamp2' && s.ending.stamp2 >= 1 && s.ending.arm === 0],
    ['t_barrier', (s) => s.ending && s.ending.phase === 'barrier' && s.ending.arm >= 1],
    ['t_queue1', (s) => s.ending && s.ending.tolls >= 1],
    ['t_queue3', (s) => s.ending && s.ending.tolls >= 3],
    ['t_complete', (s) => s.state === 'complete'],
  ], timeout: 40000 },
  // practice mode: flags appear, autoplay is switched off so the run dies, then restarts at the last flag
  practice: { url: '?level=venezuela&autoplay=1&noaudio=1&mute=1&start=0&debug=1&practice=1', shots: [
    ['p_cp1', (s) => s.beat >= 9.3],
    ['p_cp3', (s) => s.beat >= 25.3],
    ['p_off', (s) => s.beat >= 25.6 && s.attempt === 1, { key: 'a' }],
    ['p_dead', (s) => s.state === 'dead'],
    ['p_restart', (s) => s.state === 'playing' && s.attempt === 2],
    ['p_on', (s) => s.state === 'playing' && s.attempt === 2 && !s.autoplay, { key: 'a' }],
    ['p_more', (s) => s.beat >= 34.3 && s.attempt === 2],
  ], timeout: 60000 },
};

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && this.pending.has(m.id)) { this.pending.get(m.id)(m); this.pending.delete(m.id); } }; }
  send(method, params) { const id = ++this.id; this.ws.send(JSON.stringify({ id, method, params: params || {} })); return new Promise((res) => this.pending.set(id, res)); }
  async eval(expr) { const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true }); return r.result && r.result.result ? r.result.result.value : undefined; }
}

(async () => {
  const plan = PLANS[process.argv[2] || 'ending'];
  if (!plan) { console.error('unknown plan'); process.exit(2); }
  fs.mkdirSync(OUT, { recursive: true });
  const profile = path.join(require('os').tmpdir(), 'td-chrome-profile-' + PORT);
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--window-size=960,540', '--autoplay-policy=no-user-gesture-required', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let wsUrl = null;
  for (let i = 0; i < 60 && !wsUrl; i++) { try { const j = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); const t = j.find((x) => x.type === 'page'); if (t) wsUrl = t.webSocketDebuggerUrl; } catch (e) { /* retry */ } if (!wsUrl) await sleep(250); }
  if (!wsUrl) { console.error('chrome did not start'); chrome.kill(); process.exit(1); }
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => (ws.onopen = r));
  const cdp = new CDP(ws);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Page.navigate', { url: BASE + plan.url });
  const t0 = Date.now();
  let idx = 0, lastState = null;
  while (idx < plan.shots.length && Date.now() - t0 < plan.timeout) {
    const txt = await cdp.eval("(document.getElementById('dbg')||{}).textContent || ''");
    let s = null; try { s = JSON.parse(txt); } catch (e) { s = null; }
    if (s) {
      lastState = s;
      if (s.err) { console.log('PAGE ERROR:', s.err); break; }
      const [name, cond, action] = plan.shots[idx];
      if (cond(s)) {
        if (action && action.key) {
          const special = { ArrowRight: 39, ArrowLeft: 37, Space: 32 };
          const code = special[action.key] ? action.key : 'Key' + action.key.toUpperCase();
          const vk = special[action.key] || action.key.toUpperCase().charCodeAt(0);
          await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: action.key, code, windowsVirtualKeyCode: vk });
          await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: action.key, code, windowsVirtualKeyCode: vk });
          await sleep(60);
        }
        const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(shot.result.data, 'base64'));
        console.log(`${name}: beat=${(s.beat || 0).toFixed(2)} state=${s.state} attempt=${s.attempt} checkpoints=${s.checkpoints} barrels=${s.stats && s.stats.barrels} autoplay=${s.autoplay} ending=${s.ending ? s.ending.phase : '-'} audio=${s.audio}`);
        idx++;
      }
    }
    await sleep(40);
  }
  if (idx < plan.shots.length) console.log('TIMEOUT waiting for', plan.shots[idx][0], 'last state:', JSON.stringify(lastState));
  if (lastState) console.log('final stats:', JSON.stringify(lastState.stats), 'audio:', lastState.audio);
  ws.close(); chrome.kill();
  process.exit(idx < plan.shots.length ? 1 : 0);
})();
