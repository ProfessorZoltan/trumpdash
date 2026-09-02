// Headless verifier: simulates a player who presses exactly on the level's jump beats,
// checks the level is completable, and measures the timing window of every jump.
// Run: node tools/verify_level.js
const { TD_CONST: C } = require('../src/constants.js');
const { TD_PHYSICS: P } = require('../src/physics.js');
const { TD_LEVEL: L } = require('../src/level.js');

const HOLD = 0.06; // seconds the button is held per press

function simulate(pressTimes, startBeat, untilT) {
  const level = L.buildLevel();
  const st = P.makeState(startBeat);
  const presses = pressTimes.slice().sort((a, b) => a - b);
  let pi = 0;
  while (!st.dead && !st.finished && st.t < untilT) {
    const t = st.t;
    while (pi < presses.length && presses[pi] + HOLD < t) pi++;
    let held = false;
    for (let k = pi; k < presses.length && presses[k] <= t; k++) {
      if (t < presses[k] + HOLD) { held = true; break; }
    }
    P.step(st, level, held, C.DT);
  }
  const barrels = level.objs.filter((o) => o.t === 'barrel' && o.got).length;
  return { st, barrels, total: level.totalBarrels, level };
}

const level = L.buildLevel();
const beats = level.jumpBeats;
const exact = beats.map((b) => b * C.BEAT_SEC);

const base = simulate(exact, 0, Infinity);
console.log(`Jump beats: ${beats.length}, end beat: ${level.endBeat}, length: ${(level.endBeat * C.BEAT_SEC).toFixed(1)}s`);
if (base.st.finished) {
  console.log(`BASELINE: FINISHED at beat ${(base.st.t / C.BEAT_SEC).toFixed(2)} | barrels ${base.barrels}/${base.total}`);
} else {
  const o = base.st.deathBy;
  console.log(`BASELINE: DIED at beat ${(base.st.t / C.BEAT_SEC).toFixed(2)} x=${base.st.x.toFixed(0)} by ${o && o.t} ${o && (o.skin || '')} xmin=${o && o.xmin}`);
}

// Timing windows: vary one press at a time
const worst = [];
for (let i = 0; i < beats.length; i++) {
  const until = (beats[i] + 4) * C.BEAT_SEC;
  let lo = null, hi = null;
  const ok = (offMs) => {
    const presses = exact.slice();
    presses[i] += offMs / 1000;
    const r = simulate(presses, 0, until);
    return !r.st.dead;
  };
  if (!ok(0)) { worst.push({ beat: beats[i], lo: NaN, hi: NaN, note: 'FAILS AT 0' }); continue; }
  for (let ms = 0; ms >= -300; ms -= 5) { if (ok(ms)) lo = ms; else break; }
  for (let ms = 0; ms <= 300; ms += 5) { if (ok(ms)) hi = ms; else break; }
  worst.push({ beat: beats[i], lo, hi, width: hi - lo });
}
worst.sort((a, b) => (a.width || -1) - (b.width || -1));
console.log('\nTightest 12 jump windows (ms early / late):');
for (const w of worst.slice(0, 12)) console.log(`  beat ${w.beat}: [${w.lo}, +${w.hi}] width ${w.width} ${w.note || ''}`);
console.log('\nAll windows:');
worst.sort((a, b) => a.beat - b.beat);
console.log(worst.map((w) => `${w.beat}:[${w.lo},${w.hi}]`).join('  '));
// Practice-mode checkpoints: sample the exact-press run at integer beats using the game's rule,
// then confirm the level can still be finished when restarting from each checkpoint.
function findCheckpoints() {
  const level = L.buildLevel();
  const st = P.makeState(0);
  const cps = [];
  let last = 0, lastChecked = -1, pi = 0;
  while (!st.dead && !st.finished) {
    const t = st.t;
    while (pi < exact.length && exact[pi] + HOLD < t) pi++;
    let held = false;
    for (let k = pi; k < exact.length && exact[k] <= t; k++) if (t < exact[k] + HOLD) { held = true; break; }
    P.step(st, level, held, C.DT);
    const ib = Math.floor(st.t / C.BEAT_SEC);
    if (ib > lastChecked) {
      lastChecked = ib;
      if (ib >= 4 && ib - last >= 8 && st.onGround && st.ground === null && L.checkpointOK(level, ib)) { cps.push(ib); last = ib; }
    }
  }
  return cps;
}
const cps = findCheckpoints();
console.log(`
Practice checkpoints (${cps.length}): ${cps.join(', ')}`);
let cpFail = 0;
for (const cp of cps) {
  const presses = beats.filter((b) => b > cp).map((b) => b * C.BEAT_SEC);
  const r = simulate(presses, cp, Infinity);
  if (!r.st.finished) { cpFail++; console.log(`  restart from ${cp}: DIED at beat ${(r.st.t / C.BEAT_SEC).toFixed(2)}`); }
}
console.log(cpFail ? `${cpFail} checkpoint restarts fail.` : 'All checkpoint restarts finish the level.');

const bad = worst.filter((w) => !(w.width >= 90) || w.lo > -30 || w.hi < 30);
console.log(`\n${bad.length} problematic windows.`);
process.exit(base.st.finished && bad.length === 0 && cpFail === 0 ? 0 : 1);
