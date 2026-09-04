// Trump Dash - level builder. Level definitions live in src/levels/*.js and register
// themselves in TD_LEVELS; buildLevel() turns a definition into physics/render objects.
// All positions are expressed in BEATS so every required jump lands on the music grid.
// Helpers place everything relative to the CURRENT SURFACE: the floor normally, or the ceiling
// after a FLIP portal (gravity flipped), so the same level code works upside down.
(function (root) {
  const C = root.TD_CONST;
  root.TD_LEVELS = root.TD_LEVELS || [];

  function sectionAt(level, beat) {
    const S = level.def.sections;
    let idx = 0;
    for (let i = 0; i < S.length; i++) if (beat >= S[i].bar * 4) idx = i;
    const s = S[idx];
    return { name: s.name, idx, start: s.bar * 4, prev: S[Math.max(0, idx - 1)].name };
  }

  function buildLevel(def) {
    C.setTempo(def.bpm);
    const B = C.BLOCK, G = C.GROUND_Y, CY = C.CEIL_Y, JO = C.JUMP_OFFSET, BP = C.BEAT_PX;
    const objs = [];      // physical objects
    const deco = [];      // decoration only
    const gaps = [];      // water gaps in the floor {l, r} px
    const ceilings = [];  // ceiling segments (exist only around flipped sections) {l, r} px
    const zones = [];     // speed zones (ice) {b0, b1, m} in beats; x0/x1 filled in at the end
    const jumpBeats = []; // beats where the player must press (music cue)
    // Beat -> world x. Inside a speed zone the player covers BEAT_PX * m per beat, so the
    // music grid stays exact while the screen scrolls faster. Zones must be declared (ICE)
    // before anything placed inside or beyond them.
    function xAtBeat(b) {
      let x = 0, pb = 0;
      for (const z of zones) {
        if (b <= z.b0) break;
        x += (z.b0 - pb) * BP;
        const e = Math.min(b, z.b1);
        x += (e - z.b0) * BP * z.m;
        pb = e;
        if (b <= z.b1) return x;
      }
      return x + (b - pb) * BP;
    }
    const bx = xAtBeat;
    const mAt = (b) => { for (const z of zones) if (b >= z.b0 && b < z.b1) return z.m; return 1; };
    function ICE(b0, b1, m) { zones.push({ b0, b1, m: m || 1.25 }); zones.sort((a, c) => a.b0 - c.b0); }
    // Low-gravity zones: gravity divided by k, so a jump reaches k*JUMP_H and lasts k*AIR_T.
    // Every helper measures its geometry in beats from the press, so it scales the apex offset by k.
    const lowg = [];
    const kAt = (b) => { for (const z of lowg) if (b >= z.b0 && b < z.b1) return z.k; return 1; };
    function LOWG(b0, b1, k) { lowg.push({ b0, b1, k: k || 2 }); lowg.sort((a, c) => a.b0 - c.b0); }
    // Flight zones: inside FLY(b0, b1) the player is the jet (hold = climb, release = sink). The level
    // declares HOLD(b0, b1) intervals for the intended flight; the verifier and autoplay follow them,
    // and GATE / FLYCOIN / FLYMINE are cut around the resulting path, so flying the cues exactly clears
    // the section. Declare a zone's HOLDs before its gates. A hold's start is a press cue (jumpBeats),
    // its end a release cue (releaseBeats).
    const fly = [], holds = [], releaseBeats = [];
    function FLY(b0, b1) { fly.push({ b0, b1 }); fly.sort((a, c) => a.b0 - c.b0); curH = 0; }
    function HOLD(b0, b1) { holds.push([b0, b1]); jumpBeats.push(b0); releaseBeats.push(b1); }
    const flyZoneAt = (b) => { for (const z of fly) if (b >= z.b0 && b <= z.b1) return z; return null; };
    const paths = new Map(); // simulated jet paths per zone (underside y per physics step)
    function flyPath(z) {
      const key = z.b0 + ':' + holds.length;
      if (paths.has(key)) return paths.get(key);
      const ys = [], st = { y: G, vy: 0 };
      const n = Math.ceil(((z.b1 - z.b0) * C.BEAT_SEC) / C.DT);
      let t = z.b0 * C.BEAT_SEC;
      for (let i = 0; i <= n; i++) {
        ys.push(st.y);
        const b = t / C.BEAT_SEC;
        let held = false;
        for (const h of holds) if (b >= h[0] && b < h[1]) { held = true; break; }
        C.flyStep(st, held, C.DT);
        t += C.DT;
      }
      const p = { ys, t0: z.b0 * C.BEAT_SEC };
      paths.set(key, p);
      return p;
    }
    // jet centre y at a beat inside a flight zone, following the declared holds
    function flyY(beat) { return flyRange(beat, beat).min; }
    // lowest and highest jet centre y over [b0, b1]
    function flyRange(b0, b1) {
      const z = flyZoneAt(b0);
      if (!z) throw new Error('flight helper used outside a FLY zone at beat ' + b0);
      const p = flyPath(z), last = p.ys.length - 1;
      const i0 = Math.max(0, Math.min(last, Math.round((b0 * C.BEAT_SEC - p.t0) / C.DT)));
      const i1 = Math.max(0, Math.min(last, Math.round((b1 * C.BEAT_SEC - p.t0) / C.DT)));
      let min = Infinity, max = -Infinity;
      for (let i = i0; i <= i1; i++) { const y = p.ys[i] - C.JET_H / 2; if (y < min) min = y; if (y > max) max = y; }
      return { min, max };
    }
    // A gate in flight: a column up from the floor and one down from the sky, leaving `gap` px above
    // and below the jet's path for the whole time the jet overlaps the column (it is 88 px long and
    // the column 40 px wide, so about a third of a beat either side of `beat`). Put gates where the
    // path is level, near the top or bottom of an arc, or the corridor gets tall.
    const TRANSIT = (C.JET_W / 2 + B / 2) / BP;
    function GATE(beat, gap, skinBot, skinTop, label) {
      const r = flyRange(beat - TRANSIT, beat + TRANSIT), x = bx(beat) - B / 2;
      gap = gap || 60;
      if (r.max + gap < G - 4) slabRaw(x, 1, r.max + gap, G, skinBot || 'tower', label);
      if (r.min - gap > CY + 4) slabRaw(x, 1, CY, r.min - gap, skinTop || 'cloud');
    }
    // A mine beside the path: `dy` px below (positive) or above (negative) the path's envelope while
    // the jet passes, so the clearance holds for the whole crossing
    function FLYMINE(beat, dy, skin) {
      const r = flyRange(beat - TRANSIT, beat + TRANSIT);
      objs.push({ t: 'mine', cx: bx(beat), cy: dy >= 0 ? r.max + dy : r.min + dy, r: 16, skin: skin || 'mine' });
    }
    function FLYCOIN(beat, dy) { objs.push({ t: 'coin', cx: bx(beat), cy: flyY(beat) + (dy || 0), got: false }); }
    let curH = 0;         // height (in blocks) the player is currently running on
    let flipped = false;  // gravity state at the current point of the level
    let ceilStart = 0;
    let endBeat = 0;

    // y of the current running surface, and a point `px` away from it (into the play area)
    const surf = () => (flipped ? CY + curH * B : G - curH * B);
    const away = (px) => (flipped ? surf() + px : surf() - px);

    function spikeHB(x, base, flip) {
      return flip ? { l: x + 13, r: x + 27, top: base, bot: base + 32 }
                  : { l: x + 13, r: x + 27, top: base - 32, bot: base };
    }
    function spikeObj(x, base, flip, skin) { return { t: 'spike', x, base, flip: !!flip, skin: skin || 'spike', hb: spikeHB(x, base, flip) }; }
    // n spikes centred on centerBeat; base at hBlocks from the floor (or from the ceiling when hanging)
    function spikeRaw(centerBeat, n, hBlocks, flip, skin) {
      hBlocks = hBlocks || 0;
      const left = bx(centerBeat) - (n * B) / 2;
      const base = flip ? CY + hBlocks * B : G - hBlocks * B;
      for (let i = 0; i < n; i++) objs.push(spikeObj(left + i * B, base, flip, skin));
    }
    // Spikes that require a press exactly on `press` (apex passes over the group)
    function S(press, n, skin) { spikeRaw(press + JO * kAt(press), n || 1, curH, flipped, skin); jumpBeats.push(press); }
    // A tall 1-wide wall centred under the apex of a low-gravity jump (needs the full k*JUMP_H)
    function WALLJ(press, h, skin, label) {
      const cx = bx(press + JO * kAt(press));
      if (flipped) slabRaw(cx - B / 2, 1, CY, CY + h * B, skin, label); else slabRaw(cx - B / 2, 1, G - h * B, G, skin, label);
      jumpBeats.push(press);
    }

    function slabRaw(leftPx, w, top, bot, skin, label) {
      objs.push({ t: 'block', l: leftPx, r: leftPx + w * B, top, bot, w, h: Math.round((bot - top) / B), skin: skin || 'plain', label, hang: top <= CY });
    }
    // floor-anchored block (bottomH blocks above the floor)
    function blockRaw(leftPx, w, h, bottomH, skin, label) {
      const b = G - bottomH * B;
      slabRaw(leftPx, w, b - h * B, b, skin, label);
    }
    // a block of height h on the current surface
    function surfBlock(leftPx, w, h, skin, label) {
      if (flipped) slabRaw(leftPx, w, CY, CY + h * B, skin, label);
      else slabRaw(leftPx, w, G - h * B, G, skin, label);
    }
    // A 1-high obstacle you jump over (press on `press`)
    function OVER(press, skin, label) { surfBlock(bx(press + JO * kAt(press) + 0.12) - B / 2, 1, 1, skin, label); jumpBeats.push(press); }
    // A platform you jump onto (press on `press`, land on top)
    function P(press, w, h, skin, label) {
      const rel = h - curH, k = kAt(press);
      let off = (rel >= 2 ? 100 : 95) * mAt(press); // jump geometry stretches with speed
      if (k !== 1) { // low gravity: land three quarters of the way along the (longer) descending arc
        const hh = Math.max(0, rel) * B;
        off = (k * C.JUMP_DX / 2) * (1 + Math.sqrt(Math.max(0, 1 - hh / (k * C.JUMP_H)))) * 0.75 * mAt(press);
      }
      surfBlock(bx(press) + off, w, h, skin, label);
      jumpBeats.push(press);
      curH = h;
    }
    function DROP() { curH = 0; }
    // Mid-air orb: press while touching it to jump again
    function O(press, hPx, label) {
      objs.push({ t: 'orb', cx: bx(press), cy: away(hPx), r: 22, used: false, label: label || 'PARDON' });
      jumpBeats.push(press);
    }
    // Launch pad on the current surface (automatic, no press)
    function PAD(beat, label) {
      const x = bx(beat) - B / 2, s = surf();
      if (flipped) objs.push({ t: 'pad', l: x, r: x + B, top: s, bot: s + 10, flip: true, label: label || 'EXECUTIVE ORDER' });
      else objs.push({ t: 'pad', l: x, r: x + B, top: s - 10, bot: s, flip: false, label: label || 'EXECUTIVE ORDER' });
    }
    // Collectible
    function COIN(beat, hPx) { objs.push({ t: 'coin', cx: bx(beat), cy: away(hPx), got: false }); }
    // A slab `dist` blocks away from the surface with spikes pointing back at it: do not jump here
    function CEIL(beatL, w, dist, skin, label) {
      const l = bx(beatL);
      if (flipped) {
        const top = CY + dist * B;
        slabRaw(l, w, top, top + B, skin, label);
        for (let i = 0; i < w; i++) objs.push(spikeObj(l + i * B, top, false));
      } else {
        const bot = G - dist * B;
        slabRaw(l, w, bot - B, bot, skin, label);
        for (let i = 0; i < w; i++) objs.push(spikeObj(l + i * B, bot, true));
      }
    }
    // Floating naval mine (circular hazard)
    function MINE(beat, hPx, r) { objs.push({ t: 'mine', cx: bx(beat), cy: away(hPx), r: r || 16 }); }
    // Mines used like spikes: press on `press`, apex passes over the group
    function MS(press, n, skin) {
      n = n || 1;
      // centre 18 px off the surface: the circle's far edge (34 px) matches a spike's hitbox height
      const left = bx(press + JO * kAt(press)) - ((n - 1) * 30) / 2;
      for (let i = 0; i < n; i++) objs.push({ t: 'mine', cx: left + i * 30, cy: away(18), r: 16, skin: skin || 'mine' });
      jumpBeats.push(press);
    }
    // A row of mines hanging over the lane: safe to run under, fatal to jump into
    function MINES(beatL, beatR, hPx, step) {
      for (let b = beatL; b <= beatR + 1e-6; b += step || 0.5) MINE(b, hPx || 118, 16);
    }
    // Drone bobbing over a jump: highest exactly when an on-beat jump reaches its apex
    function DRONE(press, opts) {
      opts = opts || {};
      const period = opts.period || 2, k = kAt(press);
      objs.push({
        t: 'drone', cx: bx(press + JO * k), floorY: surf(), dir: flipped ? -1 : 1, hBase: (opts.hBase || 150) * k, amp: (opts.amp || 50) * k,
        period, phase: press + JO * k - period / 4, r: 14, skin: opts.skin || 'drone',
      });
    }
    // Lock lift: a barge in a water chamber that rises from hLow to hHigh blocks and back every
    // `period` beats. It is lowest exactly when a jump pressed on `press` lands on it; ride it up and
    // jump off near the top (press about period*2/3 later) onto a platform at hHigh.
    function LIFT(press, w, hLow, hHigh, period, skin, label) {
      const m = mAt(press);
      const l = bx(press) + 90 * m, r = l + w * B;
      objs.push({ t: 'lift', l, r, w, thick: 26, hLow: hLow * B, hHigh: hHigh * B, period, phase: press + 0.7, skin: skin || 'barge', label });
      gaps.push({ l, r });
      jumpBeats.push(press);
      curH = hHigh;
    }
    // Water gap you must jump across (press on `press`); floor only
    function GJ(press, w) {
      const m = mAt(press);
      const l = bx(press) + 40 * m;
      gaps.push({ l, r: l + (w || 60) * m });
      jumpBeats.push(press);
    }
    function GAP(beatL, beatR) { gaps.push({ l: bx(beatL), r: bx(beatR) }); }
    // Gravity portal at the apex of the jump pressed on `press`
    function FLIP(press, label) { const k = kAt(press); portalAt(bx(press + JO * k), away(k * C.JUMP_H + C.PLAYER_H / 2), label); jumpBeats.push(press); }
    // Gravity portal at running height (no press needed)
    function FLIPRUN(beat, label) { portalAt(bx(beat), away(C.PLAYER_H / 2), label); }
    function portalAt(cx, cy, label) {
      const dir = flipped ? 1 : -1;
      objs.push({ t: 'portal', cx, cy, r: 34, dir, label: label || 'FLIP-FLOP' });
      if (dir === -1) ceilStart = cx - 80;
      else ceilings.push({ l: ceilStart, r: cx + 80 });
      flipped = !flipped;
      curH = 0;
    }
    function SIGN(beat, text, sub) { deco.push({ t: 'sign', x: bx(beat), text, sub }); }
    function SCENE(beat, kind) { deco.push({ t: 'scene', x: bx(beat), kind }); }
    function GOAL(beat) { endBeat = beat; objs.push({ t: 'goal', x: bx(beat) }); }

    def.build({ S, spikeRaw, blockRaw, slabRaw, OVER, WALLJ, P, DROP, O, PAD, COIN, CEIL, MINE, MS, MINES, DRONE, GJ, GAP, FLIP, FLIPRUN, ICE, LOWG, LIFT, FLY, HOLD, GATE, FLYCOIN, FLYMINE, flyY, SIGN, SCENE, GOAL, bx, mAt, kAt, JO, B, G, CY });
    if (flipped) ceilings.push({ l: ceilStart, r: bx(endBeat) + 400 });
    for (const z of zones) { z.x0 = xAtBeat(z.b0); z.x1 = xAtBeat(z.b1); }
    for (const z of lowg) { z.x0 = xAtBeat(z.b0); z.x1 = xAtBeat(z.b1); }
    for (const z of fly) { z.x0 = xAtBeat(z.b0); z.x1 = xAtBeat(z.b1); }

    // ---- finalize ----
    let totalCoins = 0;
    for (const o of objs) {
      switch (o.t) {
        case 'spike': o.xmin = o.x; o.xmax = o.x + B; break;
        case 'block': case 'pad': case 'lift': o.xmin = o.l; o.xmax = o.r; break;
        case 'orb': case 'mine': case 'drone': case 'portal': o.xmin = o.cx - o.r; o.xmax = o.cx + o.r; break;
        case 'coin': o.xmin = o.cx - 20; o.xmax = o.cx + 20; totalCoins++; break;
        case 'goal': o.xmin = o.x; o.xmax = o.x + 1; break;
      }
    }
    objs.sort((a, b) => a.xmin - b.xmin);
    deco.sort((a, b) => a.x - b.x);
    gaps.sort((a, b) => a.l - b.l);
    ceilings.sort((a, b) => a.l - b.l);
    const jb = Array.from(new Set(jumpBeats)).sort((a, b) => a - b);
    holds.sort((a, c) => a[0] - c[0]);
    return { def, objs, deco, gaps, ceilings, zones, lowg, fly, holds, releaseSet: new Set(releaseBeats), xAtBeat, jumpBeats: jb, jumpSet: new Set(jb), endBeat, totalCoins, lengthPx: bx(endBeat) };
  }

  // A checkpoint may sit on an integer beat only if no press is required on that beat or its
  // half-beat: after the restart lead-in the player always gets at least one full beat to react.
  // (The runtime additionally requires normal gravity and standing on the floor.)
  function checkpointOK(level, beat) {
    return Number.isInteger(beat) && !level.jumpSet.has(beat) && !level.jumpSet.has(beat + 0.5);
  }

  root.TD_LEVEL = { buildLevel, sectionAt, checkpointOK };
})(typeof window !== 'undefined' ? window : globalThis);
