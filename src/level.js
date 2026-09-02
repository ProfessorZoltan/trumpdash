// Trump Dash - level definition. All positions are expressed in BEATS so that
// every required jump lands exactly on the music grid.
(function (root) {
  const C = root.TD_CONST || require('./constants.js').TD_CONST;

  // Song / level sections (in bars of 4 beats). Audio and renderer both use this.
  const SECTIONS = [
    { name: 'intro', bar: 0 },
    { name: 'verse', bar: 4 },
    { name: 'build', bar: 12 },
    { name: 'drop', bar: 16 },
    { name: 'break', bar: 24 },
    { name: 'drop2', bar: 28 },
    { name: 'finale', bar: 36 },
  ];
  function sectionAt(beat) {
    let idx = 0;
    for (let i = 0; i < SECTIONS.length; i++) if (beat >= SECTIONS[i].bar * 4) idx = i;
    const s = SECTIONS[idx];
    return { name: s.name, idx, start: s.bar * 4, prev: SECTIONS[Math.max(0, idx - 1)].name };
  }

  function buildLevel() {
    const B = C.BLOCK, G = C.GROUND_Y, JO = C.JUMP_OFFSET;
    const bx = (b) => b * C.BEAT_PX;
    const objs = [];      // physical objects
    const deco = [];      // decoration only
    const jumpBeats = []; // beats where the player must press (music cue)
    let curH = 0;         // height (in blocks) the player is currently running on

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
    function O(press, hPx, label) {
      objs.push({ t: 'orb', cx: bx(press), cy: G - curH * B - hPx, r: 22, used: false, label: label || 'PARDON' });
      jumpBeats.push(press);
    }
    function PAD(beat, label) {
      const x = bx(beat) - B / 2, base = G - curH * B;
      objs.push({ t: 'pad', l: x, r: x + B, top: base - 10, bot: base, label: label || 'EXECUTIVE ORDER' });
    }
    function BARREL(beat, hPx) { objs.push({ t: 'barrel', cx: bx(beat), cy: G - curH * B - hPx, got: false }); }
    function CEIL(beatL, w, bottomH, skin, label) {
      blockRaw(bx(beatL), w, 1, bottomH, skin, label);
      for (let i = 0; i < w; i++) spikeRaw(beatL + ((i + 0.5) * B) / C.BEAT_PX, 1, bottomH, true);
    }
    function SIGN(beat, text, sub) { deco.push({ t: 'sign', x: bx(beat), text, sub }); }
    function SCENE(beat, kind) { deco.push({ t: 'scene', x: bx(beat), kind }); }

    // ================= INTRO (bars 0-3) =================
    SCENE(0.9, 'whitehouse');
    SIGN(2.6, 'WASHINGTON, D.C.', 'oil reserves: none');
    S(8); BARREL(8.4, 130);
    S(12); S(14);
    SIGN(15.3, 'VENEZUELA', '3,400 km  →');

    // ================= VERSE (bars 4-11) =================
    S(16); S(18); S(20); BARREL(20.4, 130); S(22);
    S(24, 2); S(26);
    OVER(28, 'constitution', 'THE CONSTITUTION');
    S(30); BARREL(30.4, 130);
    S(32); S(33); S(35);
    S(36, 2); S(38, 2);
    OVER(40, 'constitution', 'THE CONSTITUTION');
    S(42); S(43);
    S(44); O(44.5, 120); spikeRaw(44.74, 4);
    S(46); S(47);

    // ================= BUILD (bars 12-15) =================
    SCENE(48.2, 'capitol');
    SIGN(47.6, 'CONGRESS', 'co-equal branch (allegedly)');
    P(48, 3, 1, 'congress', 'CONGRESS');
    P(49, 3, 1, 'congress');
    P(50, 3, 2, 'congress', 'SENATE');
    P(51, 3, 2, 'congress');
    P(52, 3, 1, 'congress', 'HOUSE');
    DROP();
    BARREL(52.9, 90);
    S(54); S(55); S(56, 2); S(58);
    S(60); S(61); S(62); S(63);

    // ================= DROP 1 (bars 16-23) =================
    PAD(64);
    blockRaw(bx(64) + 75, 1, 3, 0, 'wall', 'ARTICLE I');
    S(66); S(67, 2);
    S(68); O(68.5, 120); spikeRaw(68.74, 4);
    S(70); S(71);
    OVER(72, 'law', 'INTERNATIONAL LAW');
    S(74, 2); BARREL(74.4, 130);
    P(76, 5, 1, 'court', 'SUPREME COURT');
    S(77);
    DROP();
    S(79); S(80, 2);
    SIGN(80.7, 'GAG ORDER', 'no jumping');
    CEIL(81.2, 6, 2.75, 'gag');
    S(83);
    S(84); S(85); S(86); S(87);
    S(88, 2); S(90, 2);
    OVER(92, 'constitution', 'THE CONSTITUTION');
    S(94); S(95);

    // ================= BREAKDOWN (bars 24-27) =================
    SIGN(96.3, 'TARIFF ZONE', '25% on everything');
    S(97); BARREL(97.4, 130);
    S(99); BARREL(99.4, 130);
    S(101); BARREL(101.4, 130);
    S(103); BARREL(103.4, 130);
    P(104, 3, 1, 'barrels');
    P(105, 3, 2, 'barrels');
    P(106, 3, 3, 'barrels', 'CRUDE');
    BARREL(106.95, 60);
    DROP();
    S(109, 2); S(111);

    // ================= DROP 2 (bars 28-35) =================
    PAD(112);
    spikeRaw(112.35, 3);
    S(114); S(115, 2);
    S(116); O(116.5, 120); spikeRaw(116.74, 4);
    S(118); O(118.5, 120); spikeRaw(118.74, 4);
    OVER(120, 'constitution', 'THE CONSTITUTION');
    S(121); S(122, 2);
    OVER(124, 'press', 'FREE PRESS');
    S(126); S(127);
    P(128, 5, 1, 'congress', 'CONGRESS');
    S(129);
    DROP();
    S(131);
    SIGN(131.7, 'GAG ORDER', 'no jumping');
    CEIL(132.2, 6, 2.75, 'gag');
    S(134); S(135);
    S(136, 2); S(137, 2);
    S(138); O(138.5, 120); spikeRaw(138.74, 4);
    S(140); S(141); S(142); S(143);

    // ================= FINALE (bars 36-39) =================
    SIGN(143.7, 'ORINOCO OIL BELT', '303 billion barrels');
    SCENE(145, 'derricks');
    P(144, 3, 1, 'barrels');
    P(145, 3, 2, 'barrels');
    P(146, 3, 3, 'barrels', 'CRUDE');
    BARREL(146.95, 60);
    DROP();
    S(148); BARREL(148.4, 130);
    S(150); S(152, 2); S(154);
    SCENE(155.2, 'oilfield');
    const endBeat = 158.5;
    objs.push({ t: 'truck', x: bx(endBeat) });

    // ---- finalize ----
    let totalBarrels = 0;
    for (const o of objs) {
      switch (o.t) {
        case 'spike': o.xmin = o.x; o.xmax = o.x + B; break;
        case 'block': case 'pad': o.xmin = o.l; o.xmax = o.r; break;
        case 'orb': o.xmin = o.cx - o.r; o.xmax = o.cx + o.r; break;
        case 'barrel': o.xmin = o.cx - 20; o.xmax = o.cx + 20; totalBarrels++; break;
        case 'truck': o.xmin = o.x; o.xmax = o.x + 1; break;
      }
    }
    objs.sort((a, b) => a.xmin - b.xmin);
    deco.sort((a, b) => a.x - b.x);
    const jb = Array.from(new Set(jumpBeats)).sort((a, b) => a - b);
    return { objs, deco, jumpBeats: jb, jumpSet: new Set(jb), endBeat, totalBarrels, lengthPx: bx(endBeat) };
  }

  // A checkpoint may sit on an integer beat only if no press is required on that beat or its
  // half-beat: after the restart lead-in the player always gets at least one full beat to react.
  function checkpointOK(level, beat) {
    return Number.isInteger(beat) && !level.jumpSet.has(beat) && !level.jumpSet.has(beat + 0.5);
  }

  root.TD_LEVEL = { buildLevel, SECTIONS, sectionAt, checkpointOK };
})(typeof module !== 'undefined' ? module.exports : window);
