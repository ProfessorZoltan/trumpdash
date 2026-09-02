// Trump Dash - level builder. Level definitions live in src/levels/*.js and register
// themselves in TD_LEVELS; buildLevel() turns a definition into physics/render objects.
// All positions are expressed in BEATS so every required jump lands on the music grid.
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
    const B = C.BLOCK, G = C.GROUND_Y, JO = C.JUMP_OFFSET;
    const bx = (b) => b * C.BEAT_PX;
    const objs = [];      // physical objects
    const deco = [];      // decoration only
    const gaps = [];      // water gaps in the floor {l, r} px
    const jumpBeats = []; // beats where the player must press (music cue)
    let curH = 0;         // height (in blocks) the player is currently running on
    let endBeat = 0;

    function spikeHB(x, base, flip) {
      return flip ? { l: x + 13, r: x + 27, top: base, bot: base + 32 }
                  : { l: x + 13, r: x + 27, top: base - 32, bot: base };
    }
    // n spikes centred on centerBeat, sitting at hBlocks height (or hanging if flip)
    function spikeRaw(centerBeat, n, hBlocks, flip) {
      hBlocks = hBlocks || 0;
      const left = bx(centerBeat) - (n * B) / 2;
      const base = G - hBlocks * B;
      for (let i = 0; i < n; i++) {
        const x = left + i * B;
        objs.push({ t: 'spike', x, base, flip: !!flip, hb: spikeHB(x, base, flip) });
      }
    }
    // Spikes that require a press exactly on `press` (apex lands over the group)
    function S(press, n) { spikeRaw(press + JO, n || 1, curH, false); jumpBeats.push(press); }

    function blockRaw(leftPx, w, h, bottomH, skin, label) {
      const b = G - bottomH * B;
      objs.push({ t: 'block', l: leftPx, r: leftPx + w * B, top: b - h * B, bot: b, w, h, skin: skin || 'plain', label });
    }
    // A 1-high obstacle you jump over (press on `press`)
    function OVER(press, skin, label) { blockRaw(bx(press + JO + 0.12) - B / 2, 1, 1, 0, skin, label); jumpBeats.push(press); }
    // A platform you jump onto (press on `press`, land on top)
    function P(press, w, h, skin, label) {
      const rel = h - curH;
      const off = rel >= 2 ? 100 : 95;
      blockRaw(bx(press) + off, w, h, 0, skin, label);
      jumpBeats.push(press);
      curH = h;
    }
    function DROP() { curH = 0; }
    // Mid-air orb: press while touching it to jump again
    function O(press, hPx, label) {
      objs.push({ t: 'orb', cx: bx(press), cy: G - curH * B - hPx, r: 22, used: false, label: label || 'PARDON' });
      jumpBeats.push(press);
    }
    // Launch pad (automatic, no press)
    function PAD(beat, label) {
      const x = bx(beat) - B / 2, base = G - curH * B;
      objs.push({ t: 'pad', l: x, r: x + B, top: base - 10, bot: base, label: label || 'EXECUTIVE ORDER' });
    }
    // Collectible
    function COIN(beat, hPx) { objs.push({ t: 'coin', cx: bx(beat), cy: G - curH * B - hPx, got: false }); }
    // Ceiling block with hanging spikes: do not jump under it
    function CEIL(beatL, w, bottomH, skin, label) {
      blockRaw(bx(beatL), w, 1, bottomH, skin, label);
      for (let i = 0; i < w; i++) spikeRaw(beatL + ((i + 0.5) * B) / C.BEAT_PX, 1, bottomH, true);
    }
    // Floating naval mine (circular hazard)
    function MINE(beat, hPx, r) { objs.push({ t: 'mine', cx: bx(beat), cy: G - curH * B - hPx, r: r || 16 }); }
    // Mines used like spikes: press on `press`, apex passes over the group
    function MS(press, n) {
      n = n || 1;
      // centre 18 px up: the circle's top (34 px) matches a spike's hitbox height
      const left = bx(press + JO) - ((n - 1) * 30) / 2;
      for (let i = 0; i < n; i++) objs.push({ t: 'mine', cx: left + i * 30, cy: G - curH * B - 18, r: 16 });
      jumpBeats.push(press);
    }
    // A row of mines hanging over the lane: safe to run under, fatal to jump into
    function MINES(beatL, beatR, hPx, step) {
      for (let b = beatL; b <= beatR + 1e-6; b += step || 0.5) MINE(b, hPx || 118, 16);
    }
    // Drone bobbing over a jump: highest exactly when an on-beat jump reaches its apex
    function DRONE(press, opts) {
      opts = opts || {};
      const period = opts.period || 2;
      objs.push({
        t: 'drone', cx: bx(press + JO), floorY: G - curH * B, hBase: opts.hBase || 150, amp: opts.amp || 50,
        period, phase: press + JO - period / 4, r: 14,
      });
    }
    // Water gap you must jump across (press on `press`)
    function GJ(press, w) {
      const l = bx(press) + 40;
      gaps.push({ l, r: l + (w || 60) });
      jumpBeats.push(press);
    }
    function GAP(beatL, beatR) { gaps.push({ l: bx(beatL), r: bx(beatR) }); }
    function SIGN(beat, text, sub) { deco.push({ t: 'sign', x: bx(beat), text, sub }); }
    function SCENE(beat, kind) { deco.push({ t: 'scene', x: bx(beat), kind }); }
    function GOAL(beat) { endBeat = beat; objs.push({ t: 'goal', x: bx(beat) }); }

    def.build({ S, spikeRaw, blockRaw, OVER, P, DROP, O, PAD, COIN, CEIL, MINE, MS, MINES, DRONE, GJ, GAP, SIGN, SCENE, GOAL, bx, JO, B, G });

    // ---- finalize ----
    let totalCoins = 0;
    for (const o of objs) {
      switch (o.t) {
        case 'spike': o.xmin = o.x; o.xmax = o.x + B; break;
        case 'block': case 'pad': o.xmin = o.l; o.xmax = o.r; break;
        case 'orb': case 'mine': case 'drone': o.xmin = o.cx - o.r; o.xmax = o.cx + o.r; break;
        case 'coin': o.xmin = o.cx - 20; o.xmax = o.cx + 20; totalCoins++; break;
        case 'goal': o.xmin = o.x; o.xmax = o.x + 1; break;
      }
    }
    objs.sort((a, b) => a.xmin - b.xmin);
    deco.sort((a, b) => a.x - b.x);
    gaps.sort((a, b) => a.l - b.l);
    const jb = Array.from(new Set(jumpBeats)).sort((a, b) => a - b);
    return { def, objs, deco, gaps, jumpBeats: jb, jumpSet: new Set(jb), endBeat, totalCoins, lengthPx: bx(endBeat) };
  }

  // A checkpoint may sit on an integer beat only if no press is required on that beat or its
  // half-beat: after the restart lead-in the player always gets at least one full beat to react.
  function checkpointOK(level, beat) {
    return Number.isInteger(beat) && !level.jumpSet.has(beat) && !level.jumpSet.has(beat + 0.5);
  }

  root.TD_LEVEL = { buildLevel, sectionAt, checkpointOK };
})(typeof window !== 'undefined' ? window : globalThis);
