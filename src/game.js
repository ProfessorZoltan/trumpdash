// Trump Dash - game loop, input, state machine
(function () {
  const C = window.TD_CONST, PHYS = window.TD_PHYSICS, LV = window.TD_LEVEL, R = window.TD_RENDER, SPR = window.TD_SPRITES;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const audio = new window.TD_AUDIO.Engine();
  const LS = { best: 'trumpdash.best', wins: 'trumpdash.wins', practice: 'trumpdash.practice', muted: 'trumpdash.muted' };
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) { /* ignore */ } };

  const G = {
    state: 'loading',
    level: null, st: null, attempt: 0, attemptX: null,
    practice: lsGet(LS.practice, '0') === '1',
    muted: lsGet(LS.muted, '0') === '1',
    showHitboxes: false, touch: false,
    held: false, beat: 0, beatPulse: 0, time: 0, camX: -C.PLAYER_X, camLock: null,
    particles: [], floaters: [], shake: 0,
    stats: null, deathMsg: null, deadAt: 0, checkpoint: 0, checkpointX: 0, lastCpCheck: -1,
    ending: null, constitutionsStepped: 0,
    best: parseFloat(lsGet(LS.best, '0')) || 0, wins: parseInt(lsGet(LS.wins, '0'), 10) || 0,
  };
  audio.muted = G.muted;
  // Debug/automation URL params: ?autoplay=1&start=<beat>&noaudio=1&mute=1
  const Q = new URLSearchParams(location.search);
  G.autoplay = Q.get('autoplay') === '1';
  G.noAudio = Q.get('noaudio') === '1';
  if (Q.get('mute') === '1') { G.muted = true; audio.muted = true; }

  const DEATH_MSGS = {
    spike: ['Impeached!', "Tariff'd!", 'Sad!', 'Fake jump!', 'Covfefe.', 'Bigly missed.', 'Off the beat, off the cliff.', 'Very unfair. Rigged spike.'],
    constitution: ['Blocked by the Constitution!', 'The Constitution held. For now.', 'Article II does not say that.'],
    wall: ['Article I is a big, beautiful wall.', 'Congress has the power of the purse. Ouch.'],
    congress: ['Congress said no. (This time.)', 'Lost the vote. Sad!'],
    court: ['Overruled, 9-0.', 'The Supreme Court declined to hear your jump.'],
    law: ['International law happened.', 'The UN sent a strongly worded spike.'],
    press: ['Caught by the free press!', 'Front page: TRUMP TRIPS.'],
    gag: ['Violated the gag order!', 'You were told: no jumping.'],
    barrels: ['Slipped on Venezuelan crude.', 'That oil was not yours yet.'],
    plain: ['Blocked!'],
  };
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function resetStats() { G.stats = { jumps: 0, perfect: 0, good: 0, barrels: 0, combo: 0, maxCombo: 0 }; }

  // ---------- flow ----------
  function startGame() {
    if (!G.noAudio) audio.init();
    audio.resume();
    audio.setMuted(G.muted);
    G.level = LV.buildLevel();
    audio.setLevel(G.level);
    G.attempt = 0;
    G.checkpoint = 0; G.checkpointX = 0; G.lastCpCheck = -1;
    G.constitutionsStepped = 0;
    resetStats();
    startAttempt(0);
  }
  function startAttempt(beat) {
    G.attempt++;
    G.st = PHYS.makeState(beat);
    PHYS.resetObjects(G.level, beat * C.BEAT_PX);
    if (beat === 0) { G.stats.barrels = 0; G.stats.combo = 0; }
    G.state = 'playing';
    G.held = false;
    G.particles.length = 0; G.floaters.length = 0;
    G.deathMsg = null; G.ending = null; G.camLock = null;
    G.attemptX = beat * C.BEAT_PX + 420;
    G.beat = beat;
    audio.startSong(beat, 0.6);
  }
  function onDeath() {
    const st = G.st;
    G.state = 'dead';
    G.deadAt = G.time;
    audio.stopSong(true);
    audio.sfxDie();
    G.shake = 14;
    const o = st.deathBy;
    const key = o ? (o.t === 'block' ? o.skin : 'spike') : 'spike';
    G.deathMsg = pick(DEATH_MSGS[key] || DEATH_MSGS.plain);
    G.stats.combo = 0;
    for (let i = 0; i < 46; i++) {
      const a = Math.random() * Math.PI * 2, sp = 120 + Math.random() * 380;
      G.particles.push({ x: st.x, y: st.y - 30, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 150, life: 0.7 + Math.random() * 0.5, maxLife: 1.1, size: 3 + Math.random() * 4, color: pick(['#ffd400', '#0033a0', '#c8102e', '#ffffff', '#ff9d3f']), gravity: 900 });
    }
    const pct = Math.min(100, (st.x / G.level.lengthPx) * 100);
    if (pct > G.best) { G.best = pct; lsSet(LS.best, pct.toFixed(1)); }
  }
  function onFinish() {
    const st = G.st;
    G.state = 'ending';
    G.camLock = G.level.lengthPx - 520;
    G.camX = G.camLock;
    audio.stopSong(true);
    audio.endingPad();
    audio.engineStart();
    G.attemptX = null;
    G.ending = { phase: 'enter', t0: G.time, truckX0: st.x, truckX: st.x, wheel: 0, stamp1: 0, stamp2: 0, trumpIn: 0.0001, banner: null, bannerT: 0, exhaustT: 0 };
    G.best = 100; lsSet(LS.best, '100');
  }
  function togglePause() {
    if (G.state === 'playing') { G.state = 'paused'; G.pausedBeat = G.st.t / C.BEAT_SEC; audio.stopSong(true); }
    else if (G.state === 'paused') resume();
  }
  function resume() {
    G.state = 'playing';
    G.held = false;
    audio.startSong(G.pausedBeat, 0.4);
  }
  function quitToMenu() { audio.stopSong(true); audio.engineStop(); G.state = 'menu'; G.st = null; G.ending = null; G.camX = -C.PLAYER_X; }

  // ---------- events from physics ----------
  function nearestJumpBeat(beat) {
    const arr = G.level.jumpBeats;
    let lo = 0, hi = arr.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid] < beat) lo = mid + 1; else hi = mid; }
    let best = arr[lo], d = Math.abs(arr[lo] - beat);
    if (lo > 0 && Math.abs(arr[lo - 1] - beat) < d) { best = arr[lo - 1]; d = Math.abs(arr[lo - 1] - beat); }
    return { beat: best, offMs: (beat - best) * C.BEAT_SEC * 1000 };
  }
  function judge(ev) {
    const beat = ev.t / C.BEAT_SEC;
    const n = nearestJumpBeat(beat);
    if (Math.abs(n.offMs) > 260) return; // a free jump, not tied to an obstacle
    G.stats.jumps++;
    let label, color;
    const a = Math.abs(n.offMs);
    if (a <= 60) { label = 'PERFECT'; color = '#7dffb0'; G.stats.perfect++; G.stats.combo++; }
    else if (a <= 120) { label = 'GOOD'; color = '#ffd400'; G.stats.good++; G.stats.combo++; }
    else { label = n.offMs < 0 ? 'EARLY' : 'LATE'; color = '#ff8a8a'; G.stats.combo = 0; }
    G.stats.maxCombo = Math.max(G.stats.maxCombo, G.stats.combo);
    G.floaters.push({ text: label, x: ev.x, y: ev.y - 90, t0: G.time, dur: 0.7, color, size: 18 });
  }
  function handleEvents(st) {
    for (const ev of st.events) {
      switch (ev.type) {
        case 'jump': audio.sfxJump(); judge(ev); break;
        case 'orb': audio.sfxOrb(); judge(ev); burst(ev.x, ev.y - 30, 12, '#ffd400'); break;
        case 'pad': audio.sfxPad(); burst(ev.x, ev.y, 16, '#ffd400'); G.floaters.push({ text: 'EXECUTIVE ORDER!', x: ev.x, y: ev.y - 110, t0: G.time, dur: 0.9, color: '#ffd400', size: 16 }); break;
        case 'barrel': audio.sfxBarrel(); G.stats.barrels++; burst(ev.obj.cx, ev.obj.cy, 10, '#ffd400'); G.floaters.push({ text: '+1 BARREL', x: ev.obj.cx, y: ev.obj.cy - 24, t0: G.time, dur: 0.7, color: '#fff', size: 14 }); break;
        case 'land':
          for (let i = 0; i < 4; i++) G.particles.push({ x: ev.x + (Math.random() - 0.5) * 20, y: ev.y, vx: (Math.random() - 0.5) * 80 - 60, vy: -40 - Math.random() * 60, life: 0.3, maxLife: 0.3, size: 2 + Math.random() * 2, color: 'rgba(255,255,255,0.7)', gravity: 300 });
          if (ev.obj && (ev.obj.skin === 'constitution' || ev.obj.skin === 'wall')) {
            G.constitutionsStepped++;
            G.floaters.push({ text: 'STEPPED ON THE CONSTITUTION', x: ev.x, y: ev.y - 100, t0: G.time, dur: 1.0, color: '#ffe9a0', size: 14 });
          }
          break;
      }
    }
    st.events.length = 0;
  }
  function burst(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 200;
      G.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.4 + Math.random() * 0.3, maxLife: 0.7, size: 2 + Math.random() * 3, color, gravity: 400 });
    }
  }

  function maybeCheckpoint() {
    const st = G.st;
    const ib = Math.floor(st.t / C.BEAT_SEC);
    if (ib <= G.lastCpCheck) return;
    G.lastCpCheck = ib;
    if (ib - G.checkpoint < 8 || ib < 4) return;
    if (!st.onGround || st.ground !== null) return;
    for (const jb of G.level.jumpBeats) { if (jb > ib - 0.6 && jb < ib + 1.6) return; if (jb > ib + 2) break; }
    G.checkpoint = ib;
    G.checkpointX = ib * C.BEAT_PX;
    audio.sfxCheckpoint();
  }

  // ---------- update ----------
  function updateEnding(dt) {
    const e = G.ending;
    const t = G.time - e.t0; // seconds since the current phase began (real time, frame-rate independent)
    const next = (phase) => { e.phase = phase; e.t0 = G.time; };
    if (e.banner) e.bannerT = G.time - e.bannerT0;
    switch (e.phase) {
      case 'enter':
        e.trumpIn = Math.min(1, t / 0.8);
        if (t >= 1.3) next('stamp1');
        break;
      case 'stamp1':
        e.stamp1 = Math.min(1, t / 0.32);
        if (t >= 0.32 && !e.hit1) { e.hit1 = true; audio.sfxStamp(); G.shake = 16; burstInk(e, '#c8102e'); e.banner = 'U.S.A.'; e.bannerT0 = G.time; }
        if (t >= 1.5) next('stamp2');
        break;
      case 'stamp2':
        e.stamp2 = Math.min(1, t / 0.32);
        if (t >= 0.32 && !e.hit2) { e.hit2 = true; audio.sfxStamp(); G.shake = 20; burstInk(e, '#ffd400'); e.banner = 'TRUMP'; e.bannerT0 = G.time; }
        if (t >= 1.7) { next('drive'); audio.engineRev(3.6); audio.fanfare(); e.banner = 'OIL SECURED'; e.bannerT0 = G.time; }
        break;
      case 'drive': {
        const a = 240, vmax = 560, ta = vmax / a;
        const dist = t < ta ? 0.5 * a * t * t : 0.5 * a * ta * ta + vmax * (t - ta);
        e.truckX = e.truckX0 + dist;
        e.wheel = dist / 20;
        e.exhaustT += dt;
        if (e.exhaustT > 0.06) {
          e.exhaustT = 0;
          G.particles.push({ x: e.truckX + 6, y: C.GROUND_Y - 196, vx: -60 - Math.random() * 60, vy: -60 - Math.random() * 40, life: 0.9, maxLife: 0.9, size: 6 + Math.random() * 8, color: 'rgba(90,90,100,0.6)', gravity: -60 });
        }
        if (t >= 3.6) { next('done'); G.state = 'complete'; G.wins++; lsSet(LS.wins, G.wins); }
        break;
      }
    }
  }
  function burstInk(e, color) {
    const cx = e.truckX - 174, cy = C.GROUND_Y - 72;
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2, sp = 80 + Math.random() * 260;
      G.particles.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.6 + Math.random() * 0.4, maxLife: 1, size: 2 + Math.random() * 4, color, gravity: 500 });
    }
  }

  function update(dt, nowSec) {
    G.time = nowSec;
    if (G.state === 'playing') {
      const st = G.st;
      const target = audio.songTime();
      let steps = 0;
      while (st.t + C.DT <= target && steps < 4000) {
        let held = G.held;
        if (G.autoplay) { // debug: press exactly on every jump beat for 60 ms
          const b = st.t / C.BEAT_SEC, ib = Math.floor(b + 0.0001);
          let cand = null;
          if (b >= ib + 0.5 && G.level.jumpSet.has(ib + 0.5)) cand = ib + 0.5; else if (b < ib + 0.5 && G.level.jumpSet.has(ib)) cand = ib;
          held = cand != null && (b - cand) * C.BEAT_SEC < 0.06;
        }
        PHYS.step(st, G.level, held, C.DT);
        steps++;
        if (st.dead || st.finished) break;
      }
      handleEvents(st);
      G.beat = st.t / C.BEAT_SEC;
      if (G.attemptX != null && st.x > G.attemptX + 400) G.attemptX = null;
      if (G.practice) maybeCheckpoint();
      if (st.dead) onDeath();
      else if (st.finished) onFinish();
    } else if (G.state === 'dead') {
      if (G.time - G.deadAt > 1.0) startAttempt(G.practice ? G.checkpoint : 0);
    } else if (G.state === 'ending') {
      updateEnding(dt);
    }
    // camera
    if (G.st && G.state !== 'menu') {
      let cam = G.st.x - C.PLAYER_X;
      const truckX = G.level.lengthPx;
      cam = Math.min(cam, truckX - 520);
      if (G.camLock != null) cam = G.camLock;
      G.camX = cam;
    }
    // beat pulse for visuals (menu pulses on its own clock)
    const b = G.state === 'menu' ? (G.time * C.BPM) / 60 : G.beat;
    G.beatPulse = Math.pow(1 - (b % 1), 3);
    // particles & floaters
    for (let i = G.particles.length - 1; i >= 0; i--) {
      const p = G.particles[i];
      p.life -= dt; if (p.life <= 0) { G.particles.splice(i, 1); continue; }
      p.vy += (p.gravity || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.y > C.GROUND_Y && p.gravity > 0) { p.y = C.GROUND_Y; p.vy *= -0.4; p.vx *= 0.8; }
    }
    for (let i = G.floaters.length - 1; i >= 0; i--) if (G.time - G.floaters[i].t0 > G.floaters[i].dur) G.floaters.splice(i, 1);
    G.shake *= Math.pow(0.02, dt);
  }

  // ---------- input ----------
  function press() {
    if (!G.noAudio) audio.init();
    audio.resume();
    switch (G.state) {
      case 'menu': startGame(); break;
      case 'complete': quitToMenu(); break;
      case 'paused': resume(); break;
      case 'playing': G.held = true; break;
      case 'dead': G.held = true; break;
    }
  }
  function release() { G.held = false; }
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    switch (e.code) {
      case 'Space': case 'ArrowUp': case 'KeyW': e.preventDefault(); press(); break;
      case 'Escape': if (G.state === 'playing' || G.state === 'paused') togglePause(); break;
      case 'KeyR': if (G.state === 'playing' || G.state === 'paused' || G.state === 'dead') { audio.stopSong(true); G.checkpoint = 0; G.checkpointX = 0; G.lastCpCheck = -1; G.stats.combo = 0; startAttempt(0); } break;
      case 'KeyQ': if (G.state === 'paused' || G.state === 'complete') quitToMenu(); break;
      case 'KeyM': G.muted = !G.muted; audio.setMuted(G.muted); lsSet(LS.muted, G.muted ? '1' : '0'); break;
      case 'KeyP': if (G.state === 'menu' || G.state === 'paused') { G.practice = !G.practice; lsSet(LS.practice, G.practice ? '1' : '0'); } break;
      case 'KeyH': G.showHitboxes = !G.showHitboxes; break;
      case 'KeyA': G.autoplay = !G.autoplay; break;
    }
  });
  window.addEventListener('keyup', (e) => { if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') release(); });
  canvas.addEventListener('mousedown', (e) => { e.preventDefault(); press(); });
  window.addEventListener('mouseup', release);
  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); G.touch = true; press(); }, { passive: false });
  window.addEventListener('touchend', (e) => { e.preventDefault(); release(); }, { passive: false });
  window.addEventListener('touchcancel', release);
  document.addEventListener('visibilitychange', () => { if (document.hidden && G.state === 'playing') togglePause(); });
  window.addEventListener('blur', () => { release(); if (G.state === 'playing') togglePause(); });

  // ---------- loop ----------
  let last = performance.now();
  const dbgEl = Q.has('debug') ? document.body.appendChild(document.createElement('pre')) : null;
  if (dbgEl) dbgEl.id = 'dbg';
  let frameCount = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    frameCount++;
    if (dbgEl) dbgEl.textContent = JSON.stringify({ frames: frameCount, now, time: G.time, state: G.state, beat: G.beat, x: G.st && G.st.x, song: audio.songTime(), ending: G.ending && { phase: G.ending.phase, trumpIn: G.ending.trumpIn, stamp1: G.ending.stamp1, stamp2: G.ending.stamp2, truckX: G.ending.truckX, truckX0: G.ending.truckX0 }, audio: audio.ctx ? audio.ctx.state + ':' + audio.ctx.currentTime.toFixed(2) + ':step' + audio.nextStep : 'none', stats: G.stats, err: G.lastError || null });
    try { update(dt, now / 1000); R.draw(ctx, G); }
    catch (err) { G.lastError = String(err && err.stack || err); console.error(err); }
    if (G.lastError) { ctx.fillStyle = '#ff5555'; ctx.font = '12px monospace'; ctx.textAlign = 'left'; G.lastError.split(String.fromCharCode(10)).slice(0, 4).forEach((l, i) => ctx.fillText(l, 10, 100 + i * 14)); }
    requestAnimationFrame(frame);
  }
  window.addEventListener('error', (ev) => { G.lastError = ev.message + ' @ ' + ev.filename + ':' + ev.lineno; });
  const img = new Image();
  img.onload = () => {
    R.init(img); G.state = 'menu';
    if (Q.has('start')) { startGame(); const b = parseFloat(Q.get('start')) || 0; if (b > 0) { G.attempt = 0; startAttempt(b); } }
  };
  img.onerror = () => { G.state = 'menu'; console.error('Could not load sprite sheet'); };
  img.src = SPR.SHEET;
  requestAnimationFrame(frame);
  window.TD_GAME = G;
})();
