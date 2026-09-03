// Trump Dash - game loop, input, state machine, level select, ending cutscenes
(function () {
  const C = window.TD_CONST, PHYS = window.TD_PHYSICS, LV = window.TD_LEVEL, R = window.TD_RENDER, SPR = window.TD_SPRITES;
  const LEVELS = window.TD_LEVELS;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const audio = new window.TD_AUDIO.Engine();
  // Regular-mode and practice-mode records are stored separately per level.
  const LS = {
    practice: 'trumpdash.practice', muted: 'trumpdash.muted',
    best: (id) => `trumpdash.best.${id}`, wins: (id) => `trumpdash.wins.${id}`,
    pbest: (id) => `trumpdash.pbest.${id}`, pwins: (id) => `trumpdash.pwins.${id}`,
  };
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) { /* ignore */ } };

  const G = {
    state: 'loading',
    levels: LEVELS, levelIdx: 0,
    level: null, st: null, attempt: 0, attemptX: null,
    practice: lsGet(LS.practice, '0') === '1',
    muted: lsGet(LS.muted, '0') === '1',
    // touch: coarse-pointer devices get tap wording and touch-sized hit slop from the first frame
    showHitboxes: false, touch: !!(window.matchMedia && matchMedia('(pointer: coarse)').matches), touches: new Set(),
    fsAvailable: false, fullscreen: false,
    held: false, beat: 0, beatPulse: 0, time: 0, camX: -C.PLAYER_X, camLock: null,
    particles: [], floaters: [], shake: 0,
    stats: null, deathMsg: null, deadAt: 0, checkpoint: 0, checkpoints: [], lastCpCheck: -1,
    ending: null, best: {}, wins: {}, pbest: {}, pwins: {}, runPractice: false, lastError: null,
  };
  for (const def of LEVELS) {
    G.best[def.id] = parseFloat(lsGet(LS.best(def.id), def.id === 'venezuela' ? lsGet('trumpdash.best', '0') : '0')) || 0;
    G.wins[def.id] = parseInt(lsGet(LS.wins(def.id), def.id === 'venezuela' ? lsGet('trumpdash.wins', '0') : '0'), 10) || 0;
    G.pbest[def.id] = parseFloat(lsGet(LS.pbest(def.id), '0')) || 0;
    G.pwins[def.id] = parseInt(lsGet(LS.pwins(def.id), '0'), 10) || 0;
  }
  // Record a progress percentage / a clear in the bucket for the current run's mode
  function recordBest(id, pct) {
    if (G.runPractice) { if (pct > (G.pbest[id] || 0)) { G.pbest[id] = pct; lsSet(LS.pbest(id), pct.toFixed(1)); } }
    else if (pct > (G.best[id] || 0)) { G.best[id] = pct; lsSet(LS.best(id), pct.toFixed(1)); }
  }
  function recordWin(id) {
    if (G.runPractice) { G.pwins[id] = (G.pwins[id] || 0) + 1; lsSet(LS.pwins(id), G.pwins[id]); }
    else { G.wins[id] = (G.wins[id] || 0) + 1; lsSet(LS.wins(id), G.wins[id]); }
  }
  audio.muted = G.muted;
  // Debug/automation URL params: ?level=<id>&autoplay=1&start=<beat>&noaudio=1&mute=1&practice=1&debug=1
  const Q = new URLSearchParams(location.search);
  G.autoplay = Q.get('autoplay') === '1';
  G.noAudio = Q.get('noaudio') === '1';
  if (Q.get('mute') === '1') { G.muted = true; audio.muted = true; }
  if (Q.has('practice')) G.practice = Q.get('practice') === '1';
  if (Q.has('level')) { const i = LEVELS.findIndex((d) => d.id === Q.get('level')); if (i >= 0) G.levelIdx = i; }

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  function resetStats() { G.stats = { jumps: 0, perfect: 0, good: 0, coins: 0, combo: 0, maxCombo: 0, extra: 0 }; }

  // ---------- flow ----------
  function startGame(def) {
    if (!G.noAudio) audio.init();
    audio.resume();
    audio.setMuted(G.muted);
    G.level = LV.buildLevel(def);
    audio.setLevel(G.level);
    G.attempt = 0;
    G.checkpoint = 0; G.checkpoints = []; G.lastCpCheck = -1;
    G.runPractice = G.practice;
    resetStats();
    startAttempt(0);
  }
  function startAttempt(beat) {
    G.attempt++;
    G.st = PHYS.makeState(beat, G.level);
    PHYS.resetObjects(G.level, G.level.xAtBeat(beat));
    G.stats.coins = G.level.objs.reduce((n, o) => n + (o.t === 'coin' && o.got ? 1 : 0), 0);
    if (beat === 0) { G.stats.combo = 0; G.stats.extra = 0; }
    G.state = 'playing';
    G.held = false;
    G.particles.length = 0; G.floaters.length = 0;
    G.deathMsg = null; G.ending = null; G.camLock = null;
    G.attemptX = G.level.xAtBeat(beat) + 420;
    G.beat = beat;
    audio.startSong(beat, 0.6);
  }
  function deathKey(o) {
    if (!o) return 'spike';
    if (o.t === 'block') return o.skin;
    if (o.t === 'spike') return o.skin && o.skin !== 'spike' ? o.skin : 'spike';
    return o.t;
  }
  function onDeath() {
    const st = G.st, def = G.level.def;
    G.state = 'dead';
    G.deadAt = G.time;
    audio.stopSong(true);
    const key = deathKey(st.deathBy);
    if (key === 'mine') audio.sfxBoom(); else if (key === 'water') audio.sfxSplash(); else audio.sfxDie();
    G.shake = key === 'mine' ? 22 : 14;
    G.deathMsg = pick(def.deathMsgs[key] || def.deathMsgs.plain || ['Blocked!']);
    G.stats.combo = 0;
    const colors = key === 'water' ? ['#8fd3ff', '#ffffff', '#2d8fa8', '#cfefff'] : ['#ffd400', '#0033a0', '#c8102e', '#ffffff', '#ff9d3f'];
    const cy = st.grav === 1 ? st.y - 30 : st.y + 30;
    for (let i = 0; i < 46; i++) {
      const a = Math.random() * Math.PI * 2, sp = 120 + Math.random() * 380;
      G.particles.push({ x: st.x, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 150 * st.grav, life: 0.7 + Math.random() * 0.5, maxLife: 1.1, size: 3 + Math.random() * 4, color: pick(colors), gravity: 900 * st.grav });
    }
    recordBest(def.id, Math.min(100, (st.x / G.level.lengthPx) * 100));
  }
  function onFinish() {
    const st = G.st, def = G.level.def, type = def.ending.type;
    G.state = 'ending';
    G.camLock = G.level.lengthPx - def.ending.camOffset;
    G.camX = G.camLock;
    audio.stopSong(true);
    audio.endingPad(type === 'toll' || type === 'canal' || type === 'plaque' ? 'em' : type === 'map' || type === 'sign' ? 'major' : 'am');
    if (type === 'truck') audio.engineStart();
    G.attemptX = null;
    G.ending = {
      type, phase: 'enter', t0: G.time, goalX: st.x, truckX0: st.x, truckX: st.x, wheel: 0,
      stamp1: 0, stamp2: 0, subSign: 0, arm: 0, slide: 0, flagY: 1, flag2Y: 0, gate: 0, ship: 0, plaqueY: -170, typed: 0, ufoX: null, trumpIn: 0.0001, banner: null, bannerT: 0, bannerT0: 0, exhaustT: 0,
      tankers: [], tolls: 0, nextTankerAt: 0,
    };
    recordBest(def.id, 100);
  }
  function completeLevel() {
    G.state = 'complete';
    recordWin(G.level.def.id);
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
  function restartRun() {
    if (G.state !== 'playing' && G.state !== 'paused' && G.state !== 'dead') return;
    audio.stopSong(true); G.checkpoint = 0; G.checkpoints = []; G.lastCpCheck = -1; G.stats.combo = 0; G.runPractice = G.practice; startAttempt(0);
  }
  function togglePractice() {
    if (G.state !== 'menu' && G.state !== 'paused') return;
    G.practice = !G.practice; lsSet(LS.practice, G.practice ? '1' : '0');
    if (G.state === 'paused' && G.practice) G.runPractice = true; // once practice is used, the run counts as practice
  }
  function toggleMute() { G.muted = !G.muted; audio.setMuted(G.muted); lsSet(LS.muted, G.muted ? '1' : '0'); }
  // On-screen buttons (drawn by render.js, hit-tested in press)
  function uiAction(id) {
    switch (id) {
      case 'pause': if (G.state === 'playing') togglePause(); break;
      case 'resume': if (G.state === 'paused') resume(); break;
      case 'restart': restartRun(); break;
      case 'practice': togglePractice(); break;
      case 'mute': toggleMute(); break;
      case 'quit': case 'menu': if (G.state === 'paused' || G.state === 'complete') quitToMenu(); break;
      case 'fullscreen': toggleFullscreen(); break;
    }
  }

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
    const n = nearestJumpBeat(ev.t / C.BEAT_SEC);
    if (Math.abs(n.offMs) > 260) return; // a free jump, not tied to an obstacle
    G.stats.jumps++;
    let label, color;
    const a = Math.abs(n.offMs);
    if (a <= 60) { label = 'PERFECT'; color = '#7dffb0'; G.stats.perfect++; G.stats.combo++; }
    else if (a <= 120) { label = 'GOOD'; color = '#ffd400'; G.stats.good++; G.stats.combo++; }
    else { label = n.offMs < 0 ? 'EARLY' : 'LATE'; color = '#ff8a8a'; G.stats.combo = 0; }
    G.stats.maxCombo = Math.max(G.stats.maxCombo, G.stats.combo);
    G.floaters.push({ text: label, x: ev.x, y: ev.grav === 1 ? ev.y - 90 : ev.y + 120, t0: G.time, dur: 0.7, color, size: 18 });
  }
  function handleEvents(st) {
    const def = G.level.def;
    for (const ev of st.events) {
      const up = ev.grav === 1;
      switch (ev.type) {
        case 'jump': audio.sfxJump(); judge(ev); break;
        case 'orb': audio.sfxOrb(); judge(ev); burst(ev.x, ev.y - 30 * ev.grav, 12, '#ffd400'); break;
        case 'pad': audio.sfxPad(); burst(ev.x, ev.y, 16, '#ffd400'); G.floaters.push({ text: ev.obj.label + '!', x: ev.x, y: up ? ev.y - 110 : ev.y + 130, t0: G.time, dur: 0.9, color: '#ffd400', size: 16 }); break;
        case 'flip': audio.sfxFlip(ev.grav); burst(ev.x, ev.y, 18, ev.grav === -1 ? '#4fc3ff' : '#ffd400'); G.floaters.push({ text: 'FLIP-FLOP!', x: ev.x, y: ev.y, t0: G.time, dur: 0.8, color: ev.grav === -1 ? '#4fc3ff' : '#ffd400', size: 18 }); break;
        case 'zone':
          if (ev.obj.m > 1) { audio.sfxWhoosh(0.35); G.floaters.push({ text: `ICE  ×${ev.obj.m}`, x: ev.x + 60, y: up ? ev.y - 100 : ev.y + 120, t0: G.time, dur: 0.9, color: '#8fe0ff', size: 18 }); }
          break;
        case 'lowg':
          audio.sfxFlip(ev.obj.k > 1 ? -1 : 1);
          G.floaters.push({ text: ev.obj.k > 1 ? `LOW GRAVITY  ÷${ev.obj.k}` : 'GRAVITY RESTORED', x: ev.x + 60, y: up ? ev.y - 120 : ev.y + 140, t0: G.time, dur: 1.0, color: '#d0b8ff', size: 18 });
          break;
        case 'coin': audio.sfxCoin(); G.stats.coins++; burst(ev.obj.cx, ev.obj.cy, 10, '#ffd400'); G.floaters.push({ text: `+1 ${def.collectible.label.replace(/s$/, '').toUpperCase()}`, x: ev.obj.cx, y: ev.obj.cy - 24, t0: G.time, dur: 0.7, color: '#fff', size: 14 }); break;
        case 'land':
          for (let i = 0; i < 4; i++) G.particles.push({ x: ev.x + (Math.random() - 0.5) * 20, y: ev.y, vx: (Math.random() - 0.5) * 80 - 60, vy: (-40 - Math.random() * 60) * ev.grav, life: 0.3, maxLife: 0.3, size: 2 + Math.random() * 2, color: 'rgba(255,255,255,0.7)', gravity: 300 * ev.grav });
          if (ev.obj && (ev.obj.skin === 'constitution' || ev.obj.skin === 'wall')) {
            G.stats.extra++;
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
    if (ib - G.checkpoint < 8 || ib < 4 || ib > G.level.endBeat - 3) return;
    if (!st.onGround || st.ground !== null || st.grav !== 1) return;
    if (!LV.checkpointOK(G.level, ib)) return;
    G.checkpoint = ib;
    G.checkpoints.push(G.level.xAtBeat(ib));
    G.floaters.push({ text: 'CHECKPOINT', x: st.x, y: st.y - 90, t0: G.time, dur: 0.8, color: '#7dffb0', size: 16 });
    audio.sfxCheckpoint();
  }

  // ---------- ending cutscenes ----------
  function burstInk(x, y, color) {
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2, sp = 80 + Math.random() * 260;
      G.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.6 + Math.random() * 0.4, maxLife: 1, size: 2 + Math.random() * 4, color, gravity: 500 });
    }
  }
  function updateEnding(dt) {
    const e = G.ending;
    const t = G.time - e.t0; // seconds since the current phase began (real time, frame-rate independent)
    const next = (phase) => { e.phase = phase; e.t0 = G.time; };
    const banner = (txt) => { e.banner = txt; e.bannerT0 = G.time; };
    if (e.banner) e.bannerT = G.time - e.bannerT0;
    if (e.type === 'truck') {
      switch (e.phase) {
        case 'enter':
          e.trumpIn = Math.min(1, t / 0.8);
          if (t >= 1.3) next('stamp1');
          break;
        case 'stamp1':
          e.stamp1 = Math.min(1, t / 0.32);
          if (t >= 0.32 && !e.hit1) { e.hit1 = true; audio.sfxStamp(); G.shake = 16; burstInk(e.truckX - 174, C.GROUND_Y - 72, '#c8102e'); banner('U.S.A.'); }
          if (t >= 1.5) next('stamp2');
          break;
        case 'stamp2':
          e.stamp2 = Math.min(1, t / 0.32);
          if (t >= 0.32 && !e.hit2) { e.hit2 = true; audio.sfxStamp(); G.shake = 20; burstInk(e.truckX - 174, C.GROUND_Y - 72, '#ffd400'); banner('TRUMP'); }
          if (t >= 1.7) { next('drive'); audio.engineRev(3.6); audio.fanfare(); banner('OIL SECURED'); }
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
          if (t >= 3.6) { next('done'); completeLevel(); }
          break;
        }
      }
      return;
    }
    if (e.type === 'plaque') {
      const sx = e.goalX + 120, sy = 188, TOTAL = 214;
      switch (e.phase) {
        case 'enter':
          e.trumpIn = 1;
          if (t >= 0.9) { next('plaque'); audio.sfxWhoosh(0.7); }
          break;
        case 'plaque': {
          const p = Math.min(1, t / 0.7);
          e.plaqueY = -170 + (C.GROUND_Y - 200 + 170) * (1 - Math.pow(1 - p, 3));
          if (p >= 1 && !e.hitP) { e.hitP = true; audio.sfxClank(); G.shake = 8; }
          if (t >= 0.9) {
            e.typed = Math.min(TOTAL, ((t - 0.9) / 3.0) * TOTAL);
            const c = Math.floor(e.typed / 4);
            if (c !== e.lastBeep) { e.lastBeep = c; audio.sfxBeep(c % 5 === 0); }
          }
          if (t >= 4.2) next('stamp1');
          break;
        }
        case 'stamp1':
          e.stamp1 = Math.min(1, t / 0.32);
          if (t >= 0.32 && !e.hit1) { e.hit1 = true; audio.sfxStamp(); G.shake = 14; burstInk(sx, sy, '#c8102e'); banner('AMERICA HAS RETURNED'); }
          if (t >= 1.5) next('stamp2');
          break;
        case 'stamp2':
          e.stamp2 = Math.min(1, t / 0.32);
          if (t >= 0.32 && !e.hit2) { e.hit2 = true; audio.sfxStamp(); G.shake = 20; burstInk(sx, sy, '#ffd400'); banner('TRUMP'); }
          if (t >= 1.7) { next('hop'); audio.fanfare(); banner("HUMANITY'S FIRST OUTPOST"); G.stats.extra = 1; e.ufoX = -300; }
          break;
        case 'hop':
          e.ufoX = -300 + t * 320;
          if (Math.random() < 0.5) G.particles.push({ x: e.goalX + (Math.random() - 0.5) * 500, y: 60 + Math.random() * 300, vx: (Math.random() - 0.5) * 40, vy: 10 + Math.random() * 30, life: 1.4, maxLife: 1.4, size: 2 + Math.random() * 2, color: pick(['#ffd400', '#ffffff', '#8fd3ff', '#ff2d95']), gravity: 0 });
          if (t >= 3.6) { next('done'); completeLevel(); }
          break;
      }
      return;
    }
    if (e.type === 'canal') {
      const sx = e.goalX + 305, sy = 170;
      switch (e.phase) {
        case 'enter':
          e.trumpIn = 1;
          if (t >= 0.9) next('stamp1');
          break;
        case 'stamp1':
          e.stamp1 = Math.min(1, t / 0.32);
          if (t >= 0.32 && !e.hit1) { e.hit1 = true; audio.sfxStamp(); G.shake = 14; burstInk(sx, sy, '#c8102e'); banner('TAKEN BACK'); }
          if (t >= 1.5) next('stamp2');
          break;
        case 'stamp2':
          e.stamp2 = Math.min(1, t / 0.32);
          if (t >= 0.32 && !e.hit2) { e.hit2 = true; audio.sfxStamp(); G.shake = 20; burstInk(sx, sy, '#ffd400'); banner('TRUMP CANAL'); }
          if (t >= 0.9) e.subSign = Math.min(1, (t - 0.9) / 0.3);
          if (t >= 1.9) { next('gate'); audio.sfxWhoosh(1.0); banner('OPENING THE LOCKS'); }
          break;
        case 'gate':
          e.gate = Math.min(1, t / 1.1);
          if (t >= 1.1 && !e.hitGate) { e.hitGate = true; audio.sfxClank(); G.shake = 10; }
          if (t >= 1.5) { next('ship'); audio.sfxHorn(); }
          break;
        case 'ship':
          e.ship = Math.min(1, t / 3.8);
          if (t >= 1.2 && !e.hit3) { e.hit3 = true; audio.sfxCash(); audio.fanfare(); banner('FOOLISH GIFT: RETURNED'); G.stats.extra = 1; }
          if (t >= 2.6 && !e.hit4) { e.hit4 = true; audio.sfxHorn(); }
          if (t >= 4.4) { next('done'); completeLevel(); }
          break;
      }
      return;
    }
    if (e.type === 'sign') {
      const sx = e.goalX + 250, sy = 175;
      switch (e.phase) {
        case 'enter':
          e.trumpIn = 1;
          if (t >= 0.9) next('stamp1');
          break;
        case 'stamp1':
          e.stamp1 = Math.min(1, t / 0.32);
          if (t >= 0.32 && !e.hit1) { e.hit1 = true; audio.sfxStamp(); G.shake = 14; burstInk(sx, sy, '#c8102e'); banner('51st STATE'); }
          if (t >= 1.5) next('stamp2');
          break;
        case 'stamp2':
          e.stamp2 = Math.min(1, t / 0.32);
          if (t >= 0.32 && !e.hit2) { e.hit2 = true; audio.sfxStamp(); G.shake = 20; burstInk(sx, sy, '#ffd400'); banner('TRUMP'); }
          if (t >= 1.7) { next('flag'); audio.sfxWhoosh(1.2); banner('LOWERING THE FLAG…'); }
          break;
        case 'flag':
          e.flagY = Math.max(0, 1 - t / 1.2);
          if (t >= 1.3) e.flag2Y = Math.min(1, (t - 1.3) / 1.2);
          if (t >= 1.3 && !e.hit3) { e.hit3 = true; audio.sfxWhoosh(1.2); audio.fanfare(); banner('ANNEXED (POLITELY)'); G.stats.extra = 13; }
          if (t >= 4.2) { next('done'); completeLevel(); }
          break;
      }
      return;
    }
    if (e.type === 'map') {
      const bx = e.goalX + 260, by = 250;
      switch (e.phase) {
        case 'enter':
          e.trumpIn = 1;
          if (t >= 0.9) next('stamp1');
          break;
        case 'stamp1':
          e.stamp1 = Math.min(1, t / 0.32);
          if (t >= 0.32 && !e.hit1) { e.hit1 = true; audio.sfxStamp(); G.shake = 14; burstInk(bx, by + 70, '#c8102e'); banner('U.S.A.'); }
          if (t >= 1.5) next('stamp2');
          break;
        case 'stamp2':
          e.stamp2 = Math.min(1, t / 0.32);
          if (t >= 0.32 && !e.hit2) { e.hit2 = true; audio.sfxStamp(); G.shake = 20; burstInk(bx, by, '#ffd400'); banner('TRUMP'); }
          if (t >= 1.7) { next('slide'); audio.sfxWhoosh(1.6); banner('RELOCATING…'); }
          break;
        case 'slide':
          e.slide = Math.min(1, t / 2.2);
          if (t >= 2.2 && !e.hit3) { e.hit3 = true; audio.sfxStamp(); G.shake = 18; burstInk(e.goalX + 560, C.GROUND_Y - 150, '#ffd400'); audio.fanfare(); banner('NEXT TO FLORIDA NOW'); G.stats.extra = 1; }
          if (t >= 4.2) { next('done'); completeLevel(); }
          break;
      }
      return;
    }
    // ---- toll booth ending ----
    const signX = e.goalX + 25, signY = C.GROUND_Y - 232;
    switch (e.phase) {
      case 'enter':
        e.trumpIn = Math.min(1, t / 0.9);
        if (t >= 1.2) next('stamp1');
        break;
      case 'stamp1':
        e.stamp1 = Math.min(1, t / 0.32);
        if (t >= 0.32 && !e.hit1) { e.hit1 = true; audio.sfxStamp(); G.shake = 16; burstInk(signX, signY, '#c8102e'); banner('CLOSED'); }
        if (t >= 1.5) next('stamp2');
        break;
      case 'stamp2':
        e.stamp2 = Math.min(1, t / 0.32);
        if (t >= 0.32 && !e.hit2) { e.hit2 = true; audio.sfxStamp(); G.shake = 20; burstInk(signX, signY, '#ffd400'); banner('TRUMP TOLL'); }
        if (t >= 0.9) e.subSign = Math.min(1, (t - 0.9) / 0.3);
        if (t >= 1.9) next('barrier');
        break;
      case 'barrier': {
        const p = Math.min(1, t / 0.55);
        e.arm = 1 - Math.pow(1 - p, 2);
        if (p >= 1 && !e.hitArm) { e.hitArm = true; audio.sfxClank(); G.shake = 10; banner('STRAIT CLOSED'); }
        if (t >= 1.0) { next('queue'); e.nextTankerAt = 0; }
        break;
      }
      case 'queue': {
        const hulls = ['#7a1f1f', '#1b5e8a', '#2f6b3a'];
        if (e.tankers.length < 3 && t >= e.nextTankerAt) {
          const idx = e.tankers.length;
          e.tankers.push({ x: e.goalX + 1400, target: e.goalX + 120 + idx * 228, hull: hulls[idx], moving: true, arrived: false, arrivedAt: 0 });
          e.nextTankerAt = t + 1.25;
        }
        let allDone = e.tankers.length === 3;
        for (const tk of e.tankers) {
          if (tk.moving) {
            const v = Math.min(520, (tk.x - tk.target) * 3 + 60);
            tk.x = Math.max(tk.target, tk.x - v * dt);
            if (tk.x <= tk.target + 0.5) { tk.moving = false; tk.arrivedAt = t; audio.sfxHorn(); }
          } else if (!tk.arrived && t - tk.arrivedAt >= 0.5) {
            tk.arrived = true; e.tolls++; G.stats.extra = e.tolls; audio.sfxCash();
            banner(`$${e.tolls}B COLLECTED`);
            burstInk(e.goalX + 25, C.GROUND_Y - 90, '#ffd400');
          }
          if (!tk.arrived) allDone = false;
        }
        if (allDone && !e.fanfared) { e.fanfared = true; e.doneAt = t; audio.fanfare(); banner('OPEN FOR BUSINESS'); }
        if (e.fanfared && t - e.doneAt >= 2.2) { next('done'); completeLevel(); }
        break;
      }
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
      if (st.gk > 1 && !st.dead && Math.random() < 0.35) { // low gravity: drifting motes around the player
        G.particles.push({ x: st.x + (Math.random() - 0.5) * 80, y: st.y - (st.grav === 1 ? 20 : -20) - Math.random() * 60 * st.grav, vx: (Math.random() - 0.5) * 30, vy: -18 * st.grav, life: 0.9, maxLife: 0.9, size: 1.5 + Math.random() * 1.5, color: 'rgba(220,200,255,0.8)', gravity: 0 });
      }
      if (st.speedMul > 1 && st.onGround && !st.dead) { // ice spray behind the feet
        G.particles.push({ x: st.x - 12 - Math.random() * 10, y: st.y - (st.grav === 1 ? 2 : -2), vx: -120 - Math.random() * 120, vy: (-30 - Math.random() * 60) * st.grav, life: 0.3, maxLife: 0.3, size: 1.5 + Math.random() * 2, color: 'rgba(230,248,255,0.9)', gravity: 500 * st.grav });
      }
      if (G.attemptX != null && st.x > G.attemptX + 400) G.attemptX = null;
      if (G.practice) maybeCheckpoint();
      if (st.dead) onDeath();
      else if (st.finished) onFinish();
    } else if (G.state === 'dead') {
      if (G.time - G.deadAt > 1.0) startAttempt(G.practice ? G.checkpoint : 0);
    } else if (G.state === 'ending') {
      updateEnding(dt);
    }
    if (G.st && G.state !== 'menu') {
      let cam = G.st.x - C.PLAYER_X;
      cam = Math.min(cam, G.level.lengthPx - G.level.def.ending.camOffset);
      if (G.camLock != null) cam = G.camLock;
      G.camX = cam;
    }
    const b = G.state === 'menu' ? (G.time * C.BPM) / 60 : G.beat;
    G.beatPulse = Math.pow(1 - (b % 1), 3);
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
  function selectLevel(i) { G.levelIdx = (i + LEVELS.length) % LEVELS.length; }
  function press(pt) {
    if (!G.noAudio) audio.init();
    audio.resume();
    if (pt) { // on-screen buttons first; their geometry lives in render.js so drawing and hit-testing agree
      const slop = G.touch ? 10 : 2;
      for (const b of R.uiButtons(G)) {
        if (pt.x >= b.x - slop && pt.x <= b.x + b.w + slop && pt.y >= b.y - slop && pt.y <= b.y + b.h + slop) { uiAction(b.id); return; }
      }
    }
    switch (G.state) {
      case 'menu': {
        if (pt) {
          for (let i = 0; i < LEVELS.length; i++) {
            const r = R.menuCardRect(i, LEVELS.length);
            if (pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h) {
              if (G.levelIdx !== i) { selectLevel(i); return; }
            }
          }
        }
        startGame(LEVELS[G.levelIdx]);
        break;
      }
      case 'complete': quitToMenu(); break;
      case 'paused': resume(); break;
      case 'playing': G.held = true; break;
      case 'dead': G.held = true; break;
    }
  }
  function release() { G.held = false; }
  function canvasPoint(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * C.W, y: ((clientY - r.top) / r.height) * C.H };
  }
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    switch (e.code) {
      case 'Space': case 'ArrowUp': case 'KeyW': case 'Enter': e.preventDefault(); press(null); break;
      case 'ArrowLeft': if (G.state === 'menu') selectLevel(G.levelIdx - 1); break;
      case 'ArrowRight': if (G.state === 'menu') selectLevel(G.levelIdx + 1); break;
      case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': case 'Digit5': case 'Digit6': case 'Digit7': case 'Digit8': case 'Digit9': if (G.state === 'menu') { const i = parseInt(e.code.slice(5), 10) - 1; if (i < LEVELS.length) selectLevel(i); } break;
      case 'Escape': if (G.state === 'playing' || G.state === 'paused') togglePause(); break;
      case 'KeyR': restartRun(); break;
      case 'KeyQ': if (G.state === 'paused' || G.state === 'complete') quitToMenu(); break;
      case 'KeyM': toggleMute(); break;
      case 'KeyP': togglePractice(); break;
      case 'KeyF': toggleFullscreen(); break;
      case 'KeyH': G.showHitboxes = !G.showHitboxes; break;
      case 'KeyA': G.autoplay = !G.autoplay; break;
    }
  });
  window.addEventListener('keyup', (e) => { if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Enter') release(); });
  canvas.addEventListener('mousedown', (e) => { e.preventDefault(); press(canvasPoint(e.clientX, e.clientY)); });
  window.addEventListener('mouseup', release);
  // Touch: the jump button is "held" while any finger is on the canvas. Every new finger is a press (so
  // taps drive the menus and two-thumb tapping works) and the hold ends only when the last tracked
  // finger lifts, so a resting thumb never cancels a jump.
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault(); G.touch = true;
    for (const t of e.changedTouches) { G.touches.add(t.identifier); press(canvasPoint(t.clientX, t.clientY)); }
  }, { passive: false });
  const touchUp = (e) => {
    if (e.target === canvas && e.cancelable) e.preventDefault(); // no synthetic clicks; DOM buttons keep theirs
    for (const t of e.changedTouches) G.touches.delete(t.identifier);
    if (G.touches.size === 0) release();
  };
  window.addEventListener('touchend', touchUp, { passive: false });
  window.addEventListener('touchcancel', touchUp, { passive: false });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (G.state === 'playing') togglePause(); }
    else audio.resume(); // iOS leaves the context interrupted after a call, Siri or an app switch
  });
  window.addEventListener('blur', () => { G.touches.clear(); release(); if (G.state === 'playing') togglePause(); });

  // ---------- screen fit, fullscreen, orientation ----------
  // The canvas keeps its 960x540 bitmap; its CSS box is the largest 16:9 rectangle inside #wrap, which
  // is inset by the phone's safe areas (style.css). Re-fit on every viewport change: rotation, the
  // mobile URL bar collapsing, entering fullscreen.
  const wrap = document.getElementById('wrap');
  function fitCanvas() {
    const cw = wrap.clientWidth, ch = wrap.clientHeight;
    if (!cw || !ch) return;
    const s = Math.min(cw / C.W, ch / C.H);
    canvas.style.width = Math.round(C.W * s) + 'px';
    canvas.style.height = Math.round(C.H * s) + 'px';
  }
  fitCanvas();
  window.addEventListener('resize', fitCanvas);
  window.addEventListener('orientationchange', () => { fitCanvas(); setTimeout(fitCanvas, 150); });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fitCanvas);

  const docEl = document.documentElement;
  const standalone = navigator.standalone === true || !!(window.matchMedia && (matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches));
  G.fsAvailable = !standalone && !!(document.fullscreenEnabled || document.webkitFullscreenEnabled) && !!(docEl.requestFullscreen || docEl.webkitRequestFullscreen);
  const isFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  function toggleFullscreen() {
    if (!G.fsAvailable) return;
    try {
      if (isFullscreen()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
      const p = (docEl.requestFullscreen || docEl.webkitRequestFullscreen).call(docEl);
      // Android: lock landscape once fullscreen (the lock is only allowed in fullscreen)
      const lock = () => { try { const o = screen.orientation; if (o && o.lock) { const q = o.lock('landscape'); if (q && q.catch) q.catch(() => {}); } } catch (e) { /* unsupported */ } };
      if (p && p.then) p.then(lock, () => {}); else lock();
    } catch (e) { /* unsupported */ }
  }
  const onFsChange = () => { G.fullscreen = isFullscreen(); fitCanvas(); setTimeout(fitCanvas, 150); };
  document.addEventListener('fullscreenchange', onFsChange);
  document.addEventListener('webkitfullscreenchange', onFsChange);
  // Portrait phones: the rotate overlay in index.html covers the game (shown by the media query in
  // style.css, mirrored here); pause a run when it appears.
  const rotateEl = document.getElementById('rotate');
  if (rotateEl && G.fsAvailable) {
    rotateEl.classList.add('fs');
    const btn = document.getElementById('rotate-fs');
    if (btn) btn.addEventListener('click', toggleFullscreen);
  }
  const portraitMQ = window.matchMedia ? matchMedia('(orientation: portrait) and (pointer: coarse) and (max-width: 720px)') : null;
  if (portraitMQ) {
    const onRotate = () => { if (portraitMQ.matches && G.state === 'playing') togglePause(); fitCanvas(); setTimeout(fitCanvas, 150); };
    if (portraitMQ.addEventListener) portraitMQ.addEventListener('change', onRotate); else if (portraitMQ.addListener) portraitMQ.addListener(onRotate);
  }

  // ---------- loop ----------
  let last = performance.now();
  const dbgEl = Q.has('debug') ? document.body.appendChild(document.createElement('pre')) : null;
  if (dbgEl) dbgEl.id = 'dbg';
  let frameCount = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    frameCount++;
    if (dbgEl) dbgEl.textContent = JSON.stringify({ frames: frameCount, now, time: G.time, state: G.state, level: G.level && G.level.def.id, beat: G.beat, attempt: G.attempt, checkpoints: G.checkpoints.length, practice: G.practice, runPractice: G.runPractice, best: G.best, pbest: G.pbest, wins: G.wins, pwins: G.pwins, autoplay: !!G.autoplay, touch: G.touch, levelIdx: G.levelIdx, fs: G.fsAvailable, fullscreen: G.fullscreen, x: G.st && G.st.x, grav: G.st && G.st.grav, speedMul: G.st && G.st.speedMul, gk: G.st && G.st.gk, song: audio.songTime(), ending: G.ending && { phase: G.ending.phase, trumpIn: G.ending.trumpIn, stamp1: G.ending.stamp1, stamp2: G.ending.stamp2, subSign: G.ending.subSign, arm: G.ending.arm, slide: G.ending.slide, flagY: G.ending.flagY, flag2Y: G.ending.flag2Y, gate: G.ending.gate, ship: G.ending.ship, typed: G.ending.typed, plaqueY: G.ending.plaqueY, ufoX: G.ending.ufoX, tolls: G.ending.tolls, tankers: G.ending.tankers.length, truckX: G.ending.truckX, truckX0: G.ending.truckX0 }, audio: audio.ctx ? audio.ctx.state + ':' + audio.ctx.currentTime.toFixed(2) + ':step' + audio.nextStep : 'none', stats: G.stats, err: G.lastError || null });
    try { update(dt, now / 1000); R.draw(ctx, G); }
    catch (err) { G.lastError = String(err && err.stack || err); console.error(err); }
    if (G.lastError) { ctx.fillStyle = '#ff5555'; ctx.font = '12px monospace'; ctx.textAlign = 'left'; G.lastError.split(String.fromCharCode(10)).slice(0, 4).forEach((l, i) => ctx.fillText(l, 10, 100 + i * 14)); }
    requestAnimationFrame(frame);
  }
  window.addEventListener('error', (ev) => { G.lastError = ev.message + ' @ ' + ev.filename + ':' + ev.lineno; });
  R.loadImage('greenland', 'resources/greenland_map.png');
  R.loadImage('florida', 'resources/florida_map.png');
  const img = new Image();
  img.onload = () => {
    R.init(img); G.state = 'menu';
    if (Q.has('start')) { startGame(LEVELS[G.levelIdx]); const b = parseFloat(Q.get('start')) || 0; if (b > 0) { G.attempt = 0; startAttempt(b); } }
  };
  img.onerror = () => { G.state = 'menu'; console.error('Could not load sprite sheet'); };
  img.src = SPR.SHEET;
  requestAnimationFrame(frame);
  window.TD_GAME = G;
})();
