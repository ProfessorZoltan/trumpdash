// Level - THE MOON: "America has returned". The hardest and strangest: 150 BPM, LOW-GRAVITY zones
// where jumps go twice as high and last twice as long, gravity flips inside them, UFOs, asteroid
// belts, aliens, crater pits, and a plaque at the end.
(function (root) {
  // D minor: Dm | Bb | F | C - space synths, theremin lead
  const CHORDS = [[62, 65, 69], [58, 62, 65], [65, 69, 72], [60, 64, 67]];
  const BASSN = [38, 34, 41, 36];
  const HOOK = [
    [74, 77, 81, 77, 74, 72, 69, 72],
    [74, 77, 82, 77, 74, 70, 65, 70],
    [77, 81, 84, 81, 77, 72, 69, 72],
    [76, 79, 84, 79, 76, 72, 67, 72],
  ];
  const ARP = [0, 2, 1, 3, 0, 2, 1, 3, 2, 0, 3, 1, 2, 0, 3, 1];

  const def = {
    id: 'moon',
    name: 'THE MOON',
    tagline: 'America has returned',
    difficulty: 'EXTREME',
    bpm: 150,
    minWindowMs: 60,
    backdrop: 'space',
    water: 'void',
    collectible: { label: 'moon rocks', icon: 'coin' },
    ending: { type: 'plaque', camOffset: 300 },
    sections: [
      { name: 'intro', bar: 0 }, { name: 'verse', bar: 4 }, { name: 'build', bar: 12 }, { name: 'drop', bar: 16 },
      { name: 'break', bar: 24 }, { name: 'drop2', bar: 28 }, { name: 'finale', bar: 36 },
    ],
    palettes: {
      intro:  { top: '#000008', bot: '#0a0a2a', ground: '#8a8a90', gline: '#e8e8f0', accent: '#4fc3ff', spike: '#ffffff', style: 'moon' },
      verse:  { top: '#02020f', bot: '#101038', ground: '#8a8a90', gline: '#e8e8f0', accent: '#4fc3ff', spike: '#ffffff', style: 'moon' },
      build:  { top: '#0a0020', bot: '#3a1060', ground: '#8a8a90', gline: '#ff6ad5', accent: '#ff4fa3', spike: '#ffe1f6', style: 'moon' },
      drop:   { top: '#05001a', bot: '#2a0a5a', ground: '#7a7a86', gline: '#b388ff', accent: '#b388ff', spike: '#ffffff', style: 'moon' },
      break:  { top: '#000010', bot: '#0a2a4a', ground: '#8a8a90', gline: '#8fe0ff', accent: '#4fc3ff', spike: '#ffffff', style: 'moon' },
      drop2:  { top: '#000000', bot: '#1a0030', ground: '#6a6a76', gline: '#ff4fa3', accent: '#ff4fa3', spike: '#ffffff', style: 'moon' },
      finale: { top: '#02001a', bot: '#3a1a6a', ground: '#8a8a90', gline: '#ffd400', accent: '#ffd400', spike: '#ffffff', style: 'moon' },
    },
    deathMsgs: {
      spike: ['Lost in space.', 'One small trip for a man.', 'Houston, we have a problem.', 'Sad!', 'Fake jump!', 'Not a winner, not an astronaut.'],
      alien: ['Abducted.', 'The aliens were not impressed.', 'Probed. Sad!'],
      asteroid: ['Hit by a moon rock.', 'Asteroid. Very unfair.'],
      ufo: ['Beamed up.', 'The UFO had other plans.'],
      budget: ['NASA budget cut. Mission scrubbed.', 'Defunded mid-jump.'],
      rocket: ['Rocket exploded. Rapid unscheduled disassembly.', 'Stage separation failed.'],
      regolith: ['Face full of regolith.', 'Crater rim: 1, Trump: 0.'],
      moonbase: ['Walked into the outpost.', "Humanity's first outpost has a wall."],
      solar: ['Solar flare. Toasted.', 'You were told: no jumping.'],
      water: ['Fell into a crater.', 'Lost in the void.', 'The crater has no bottom. Or taxes.'],
      sky: ['Floated off into space.', 'Gravity is a hoax, apparently.'],
      plain: ['Blocked!'],
    },
    complete: {
      title: "THE MOON: HUMANITY'S FIRST OUTPOST (SIGNED)",
      quote: '"America has returned. Under my leadership, and with the hopes and dreams of all mankind. Signed, me."',
      statLabel: 'Worlds outposted',
    },

    build(api) {
      const { S, spikeRaw, blockRaw, OVER, WALLJ, P, DROP, O, PAD, COIN, CEIL, MS, MINES, DRONE, GJ, FLIP, LOWG, SIGN, SCENE, GOAL, bx } = api;
      // ================= INTRO (bars 0-3): the landing site =================
      SCENE(1.5, 'lander');
      SIGN(3, 'THE MOON', 'gravity 1/6 · taxes 0');
      S(8); S(11); S(12); COIN(12.4, 130); S(14);
      // ================= VERSE (bars 4-11): dense normal gravity =================
      S(16); S(17); S(19); S(20, 2); S(22); S(23);
      OVER(24, 'budget', 'NASA BUDGET');
      S(26); S(27);
      S(28); O(28.5, 120, 'BOOST'); spikeRaw(28.74, 4);
      S(30, 2); S(31); MS(32, 1, 'asteroid'); S(33); S(34, 1, 'alien'); S(35);
      S(36, 2); S(37, 2); S(38); DRONE(38, { skin: 'ufo' }); S(39);
      S(40); O(40.5, 120, 'BOOST'); spikeRaw(40.74, 4);
      S(42); S(43, 2); S(44); S(45, 1, 'alien'); S(46, 2); S(47);
      // ================= BUILD (bars 12-15): Artemis pad =================
      SIGN(47.6, 'ARTEMIS PAD', 'launch in 3, 2, 1');
      SCENE(50.5, 'rocket');
      P(48, 3, 1, 'rocket'); P(49, 3, 1, 'rocket'); P(50, 3, 2, 'rocket', 'STAGE 2'); P(51, 3, 2, 'rocket'); P(52, 3, 1, 'rocket');
      DROP();
      COIN(52.9, 90);
      S(54); S(55, 2); S(56); S(57); S(58, 2); S(60); S(61); S(62); S(63);
      // ================= DROP (bars 16-23): LOW GRAVITY =================
      SIGN(64.5, 'LOW GRAVITY', 'float, do not flail');
      LOWG(65, 95, 2);
      S(66); S(68); WALLJ(70, 4, 'moonbase', 'OUTPOST 1'); S(72, 2); S(74, 3);
      GJ(76, 200); S(78);
      SIGN(79.2, 'ASTEROID BELT', 'no jumping');
      MINES(80.2, 81.4, 118, 0.4);
      S(82); O(82.5, 201, 'BOOST'); spikeRaw(83.45, 6);
      S(86); S(88, 2); WALLJ(90, 4, 'moonbase', 'OUTPOST 2'); S(92, 3); S(94);
      // ================= BREAKDOWN (bars 24-27): Sea of Tranquility =================
      SIGN(96.3, 'SEA OF TRANQUILITY', 'very tranquil');
      SCENE(99, 'flag');
      S(97); COIN(97.4, 130); S(99); COIN(99.4, 130); S(101); COIN(101.4, 130); S(103); COIN(103.4, 130);
      P(104, 3, 1, 'regolith'); P(105, 3, 2, 'regolith'); P(106, 3, 3, 'regolith', 'CRATER RIM');
      COIN(106.95, 60);
      DROP();
      S(109, 2); S(111);
      // ================= DROP 2 (bars 28-35): the dark side, low gravity plus flips =================
      SIGN(112.6, 'DARK SIDE', 'gravity is negotiable');
      LOWG(113, 143, 2);
      PAD(114, 'SPACE FORCE');
      blockRaw(bx(114) + 170, 1, 6, 0, 'moonbase', 'OUTPOST 3');
      S(117); S(119);
      FLIP(121, 'FLIP-FLOP');
      S(123); S(125, 2); WALLJ(127, 4, 'moonbase'); S(129);
      O(129.5, 201, 'BOOST'); spikeRaw(130.45, 6, 0, true);
      S(133); S(135, 2);
      FLIP(137, 'FLIP-FLOP');
      S(139); S(141, 3);
      // ================= FINALE (bars 36-39): the outpost site =================
      SIGN(143.7, 'OUTPOST SITE', 'America has returned');
      LOWG(145, 159, 2);
      SCENE(151, 'moonbase');
      S(146); S(148, 2); WALLJ(150, 4, 'moonbase', 'FIRST OUTPOST'); S(152); DRONE(152, { skin: 'ufo' }); S(154, 2); S(156);
      GOAL(158.5);
    },

    music: {
      // Space: synthwave arps drenched in delay, a theremin lead, laser zaps, sparse 808 verse drums
      step(A, i) {
        const { t, bar, sib, bib, sub, beat, sec, on8, isJump, STEP, BEAT } = i;
        const ci = bar % 4, chord = CHORDS[ci];
        const full = sec === 'drop' || sec === 'drop2' || sec === 'finale';
        const active = !(sec === 'intro' && bar < 2);
        // drums
        if (sub === 0) {
          if (full) A.kick(t, 1);
          else if (sec === 'build') A.kick(t, 1);
          else if (active && (bib === 0 || bib === 2)) A.kick(t, 0.8);
          if (full && (bib === 1 || bib === 3)) { A.snare(t, 0.85); A.clap(t, 0.3); }
          if ((sec === 'verse' || sec === 'break') && bib === 3) A.snare(t, 0.5);
        }
        if (sec === 'verse' && (sib === 6 || sib === 13)) A.kick(t, 0.6);
        if (sec === 'build') {
          const bi = bar - 12;
          if (bi < 2) { if (on8) A.snare(t, 0.4 + 0.12 * bi); }
          else A.snare(t, 0.35 + (sib / 16) * 0.35 + 0.15 * (bi - 2));
          if (bi === 0 && sib === 0) A.riser(t, BEAT * 16);
          if (bi >= 2 && sub === 0) A.zap(t, 0.25);
        }
        if (active) {
          if (on8) A.hat(t, false, sub === 2 ? 0.26 : 0.38);
          if (full && (sub === 1 || sub === 3)) A.hat(t, false, 0.16);
          if (full && sub === 2) A.hat(t, true, 0.24);
        }
        // bass: long sub notes in the verse, driving 8ths in the drops
        if (full) { if (on8) A.bass(t, BASSN[ci] + (sub === 2 ? 12 : 0), STEP * 1.7, sub === 0 ? 1 : 0.7); }
        else if (active && (sib === 0 || sib === 8)) A.bass(t, BASSN[ci], STEP * 7, 0.8);
        else if (bar >= 1 && sub === 0) A.bass(t, BASSN[ci], STEP * 3.5, 0.6);
        // pads always: space needs a floor of sound
        if (sib === 0) A.padChord(t, chord.map((n) => n + 12), BEAT * 4, full ? 0.08 : 0.14);
        // arps in 16ths everywhere after the intro, theremin lead on top
        if (active) A.lead(t, [chord[0] + 12, chord[1] + 12, chord[2] + 12, chord[0] + 24][ARP[sib]] + (sec === 'drop2' ? 12 : 0), STEP * 0.9, full ? 0.22 : 0.12, true);
        if ((sec === 'verse' || sec === 'break') && (sib === 0 || sib === 6 || sib === 10)) A.theremin(t, HOOK[ci][[0, 2, 4][[0, 6, 10].indexOf(sib)]], STEP * 5, 0.45);
        if (full && on8) A.theremin(t, HOOK[ci][sib >> 1], STEP * 1.8, 0.5);
        if (sec === 'intro' && bar >= 1 && sub === 0) A.theremin(t, HOOK[ci][bib * 2], STEP * 3.5, 0.35);
        if (full && sib === 14) A.zap(t, 0.3);
        // THE JUMP CUE
        if (isJump) {
          A.accent(t, chord[Math.round(beat * 2) % 3] + 24, 0.55);
          A.clap(t, 0.55);
        }
      },
    },
  };

  (root.TD_LEVELS = root.TD_LEVELS || []).push(def);
})(typeof window !== 'undefined' ? window : globalThis);
