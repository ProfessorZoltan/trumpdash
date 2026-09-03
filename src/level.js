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

    def.build({ S, spikeRaw, blockRaw, slabRaw, OVER, WALLJ, P, DROP, O, PAD, COIN, CEIL, MINE, MS, MINES, DRONE, GJ, GAP, FLIP, FLIPRUN, ICE, LOWG, LIFT, SIGN, SCENE, GOAL, bx, mAt, kAt, JO, B, G, CY });
    if (flipped) ceilings.push({ l: ceilStart, r: bx(endBeat) + 400 });
    for (const z of zones) { z.x0 = xAtBeat(z.b0); z.x1 = xAtBeat(z.b1); }
    for (const z of lowg) { z.x0 = xAtBeat(z.b0); z.x1 = xAtBeat(z.b1); }

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
    return { def, objs, deco, gaps, ceilings, zones, lowg, xAtBeat, jumpBeats: jb, jumpSet: new Set(jb), endBeat, totalCoins, lengthPx: bx(endBeat) };
  }

  // A checkpoint may sit on an integer beat only if no press is required on that beat or its
  // half-beat: after the restart lead-in the player always gets at least one full beat to react.
  // (The runtime additionally requires normal gravity and standing on the floor.)
  function checkpointOK(level, beat) {
    return Number.isInteger(beat) && !level.jumpSet.has(beat) && !level.jumpSet.has(beat + 0.5);
  }

  root.TD_LEVEL = { buildLevel, sectionAt, checkpointOK };
})(typeof window !== 'undefined' ? window : globalThis);
