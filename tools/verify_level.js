// Headless verifier: for every level, simulates a player who presses exactly on the level's
// jump beats, checks the level is completable, measures the timing window of every jump, and
// confirms every practice checkpoint can still finish the level.
// Run: node tools/verify_level.js [levelId]
require('../src/constants.js');
require('../src/level.js');
require('../src/levels/greenland.js');
require('../src/levels/venezuela.js');
require('../src/levels/hormuz.js');
require('../src/levels/canada.js');
require('../src/levels/panama.js');
require('../src/levels/moon.js');
require('../src/levels/qatar.js');
require('../src/physics.js');
const C = globalThis.TD_CONST, P = globalThis.TD_PHYSICS, L = globalThis.TD_LEVEL, DEFS = globalThis.TD_LEVELS;

const HOLD = 0.06; // seconds the button is held per press

// pressTimes: seconds at which the button is tapped (held HOLD s); holds: [start, end] seconds during
// which it is held down (flight)
function simulate(def, pressTimes, holds, startBeat, untilT) {
  const level = L.buildLevel(def);
  const st = P.makeState(startBeat, level);
  const presses = pressTimes.slice().sort((a, b) => a - b);
  let pi = 0;
  while (!st.dead && !st.finished && st.t < untilT) {
    const t = st.t;
    while (pi < presses.length && presses[pi] + HOLD < t) pi++;
    let held = false;
    for (let k = pi; k < presses.length && presses[k] <= t; k++) {
      if (t < presses[k] + HOLD) { held = true; break; }
    }
    if (!held) for (let k = 0; k < holds.length; k++) if (t >= holds[k][0] && t < holds[k][1]) { held = true; break; }
    P.step(st, level, held, C.DT);
  }
  const coins = level.objs.filter((o) => o.t === 'coin' && o.got).length;
  return { st, coins, total: level.totalCoins, level };
}

function describe(o) {
  if (!o) return 'nothing';
  return `${o.t}${o.skin ? '/' + o.skin : ''} xmin=${o.xmin != null ? o.xmin.toFixed(0) : '?'}`;
}

function verify(def) {
  console.log(`\n=== ${def.name} (${def.bpm} BPM) ===`);
  const level = L.buildLevel(def);
  const beats = level.jumpBeats;
  const exact = beats.map((b) => b * C.BEAT_SEC);
  const holdsSec = level.holds.map(([a, b]) => [a * C.BEAT_SEC, b * C.BEAT_SEC]);
  const holdStarts = new Set(level.holds.map((h) => h[0]));
  const minWin = def.minWindowMs || Math.round((90 * 128) / def.bpm); // same px window as 90 ms at 128 BPM unless the level says otherwise

  const base = simulate(def, exact, holdsSec, 0, Infinity);
  console.log(`Jump beats: ${beats.length}, holds: ${level.holds.length}, end beat: ${level.endBeat}, length: ${(level.endBeat * C.BEAT_SEC).toFixed(1)}s`);
  if (base.st.finished) console.log(`BASELINE: FINISHED at beat ${(base.st.t / C.BEAT_SEC).toFixed(2)} | collectibles ${base.coins}/${base.total}`);
  else console.log(`BASELINE: DIED at beat ${(base.st.t / C.BEAT_SEC).toFixed(2)} x=${base.st.x.toFixed(0)} by ${describe(base.st.deathBy)}`);

  // Timing windows: vary one control at a time (a tap, a hold's start, or a hold's release)
  const controls = [];
  beats.forEach((b, i) => { if (!holdStarts.has(b)) controls.push({ label: `${b}`, beat: b, apply: (P, H, s) => { P[i] += s; } }); });
  level.holds.forEach(([a, b], j) => {
    controls.push({ label: `hold ${a}`, beat: a, apply: (P, H, s) => { H[j][0] += s; } });
    controls.push({ label: `release ${b}`, beat: b, apply: (P, H, s) => { H[j][1] += s; } });
  });
  const windows = [];
  for (const c of controls) {
    const until = (c.beat + 4) * C.BEAT_SEC;
    const ok = (offMs) => {
      const presses = exact.slice(), hs = holdsSec.map((h) => h.slice());
      c.apply(presses, hs, offMs / 1000);
      return !simulate(def, presses, hs, 0, until).st.dead;
    };
    if (!ok(0)) { windows.push({ beat: c.label, lo: NaN, hi: NaN, width: -1, note: 'FAILS AT 0' }); continue; }
    let lo = null, hi = null;
    for (let ms = 0; ms >= -300; ms -= 5) { if (ok(ms)) lo = ms; else break; }
    for (let ms = 0; ms <= 300; ms += 5) { if (ok(ms)) hi = ms; else break; }
    windows.push({ beat: c.label, lo, hi, width: hi - lo });
  }
  const sorted = windows.slice().sort((a, b) => a.width - b.width);
  console.log('Tightest 8 jump windows (ms early / late):');
  for (const w of sorted.slice(0, 8)) console.log(`  beat ${w.beat}: [${w.lo}, +${w.hi}] width ${w.width} ${w.note || ''}`);
  console.log('All windows: ' + windows.map((w) => `${w.beat}:[${w.lo},${w.hi}]`).join('  '));

  // Practice checkpoints
  const cps = [];
  {
    const lv = L.buildLevel(def);
    const st = P.makeState(0, lv);
    let last = 0, lastChecked = -1, pi = 0;
    while (!st.dead && !st.finished) {
      const t = st.t;
      while (pi < exact.length && exact[pi] + HOLD < t) pi++;
      let held = false;
      for (let k = pi; k < exact.length && exact[k] <= t; k++) if (t < exact[k] + HOLD) { held = true; break; }
      if (!held) for (const h of holdsSec) if (t >= h[0] && t < h[1]) { held = true; break; }
      P.step(st, lv, held, C.DT);
      const ib = Math.floor(st.t / C.BEAT_SEC);
      if (ib > lastChecked) {
        lastChecked = ib;
        if (ib >= 4 && ib - last >= 8 && ib <= lv.endBeat - 3 && st.onGround && st.ground === null && st.grav === 1 && L.checkpointOK(lv, ib)) { cps.push(ib); last = ib; }
      }
    }
  }
  console.log(`Practice checkpoints (${cps.length}): ${cps.join(', ')}`);
  let cpFail = 0;
  for (const cp of cps) {
    const presses = beats.filter((b) => b > cp).map((b) => b * C.BEAT_SEC);
    const r = simulate(def, presses, holdsSec.filter((h) => h[1] > cp * C.BEAT_SEC), cp, Infinity);
    if (!r.st.finished) { cpFail++; console.log(`  restart from ${cp}: DIED at beat ${(r.st.t / C.BEAT_SEC).toFixed(2)} by ${describe(r.st.deathBy)}`); }
  }
  console.log(cpFail ? `${cpFail} checkpoint restarts fail.` : 'All checkpoint restarts finish the level.');

  const bad = windows.filter((w) => !(w.width >= minWin) || w.lo > -30 || w.hi < 30);
  console.log(`${bad.length} problematic windows (min width ${minWin} ms).`);
  return base.st.finished && bad.length === 0 && cpFail === 0;
}

const only = process.argv[2];
let allOk = true;
for (const def of DEFS) if (!only || def.id === only) allOk = verify(def) && allOk;
console.log(allOk ? '\nALL LEVELS OK' : '\nPROBLEMS FOUND');
process.exit(allOk ? 0 : 1);
