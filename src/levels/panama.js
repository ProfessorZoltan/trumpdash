// Level - PANAMA CANAL: "take it back". Introduces LOCK LIFTS: barges in lock chambers that rise
// on the beat; jump on low, ride up, jump off onto the upper wall. Signs, obstacles and the ending
// borrow the rhetoric: ridiculous, highly unfair fees; a foolish gift; a rip-off; reclaiming it.
(function (root) {
  // G minor: Gm | Eb | Bb | F (one chord per bar) - tropical minor with a brass-ish lead
  const CHORDS = [[55, 58, 62], [51, 55, 58], [58, 62, 65], [53, 57, 60]];
  const BASSN = [31, 39, 34, 29];
  const HOOK = [
    [74, 79, 82, 79, 74, 70, 67, 70],
    [75, 79, 82, 79, 75, 70, 67, 70],
    [74, 77, 82, 77, 74, 70, 65, 70],
    [72, 77, 81, 77, 72, 69, 65, 69],
  ];
  const ARP = [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 3];

  const def = {
    id: 'panama',
    name: 'PANAMA CANAL',
    tagline: 'Take it back',
    difficulty: 'EXPERT',
    bpm: 132,
    minWindowMs: 80,
    backdrop: 'tropics',
    water: 'canal',
    collectible: { label: 'fees', icon: 'coin' },
    ending: { type: 'canal', camOffset: 300 },
    sections: [
      { name: 'intro', bar: 0 }, { name: 'verse', bar: 4 }, { name: 'build', bar: 12 }, { name: 'drop', bar: 16 },
      { name: 'break', bar: 24 }, { name: 'drop2', bar: 28 }, { name: 'finale', bar: 36 },
    ],
    palettes: {
      intro:  { top: '#0b2a3a', bot: '#5fb3c9', ground: '#8a8f94', gline: '#ffffff', accent: '#ffd400', spike: '#ffffff', style: 'concrete' },
      verse:  { top: '#0a3a2a', bot: '#3fa66b', ground: '#3f6b2a', gline: '#c8ffb0', accent: '#ffd400', spike: '#ffffff', style: 'jungle' },
      build:  { top: '#1a1a4a', bot: '#5a6ab8', ground: '#8a8f94', gline: '#ffffff', accent: '#ff4fa3', spike: '#ffffff', style: 'concrete' },
      drop:   { top: '#3a0a0a', bot: '#c0442b', ground: '#7a7f84', gline: '#ffd27f', accent: '#ffcc00', spike: '#ffffff', style: 'concrete' },
      break:  { top: '#0a3a3a', bot: '#2fb0a0', ground: '#3f6b2a', gline: '#c8ffb0', accent: '#ffd400', spike: '#ffffff', style: 'jungle' },
      drop2:  { top: '#2a0a2a', bot: '#c02a6a', ground: '#7a7f84', gline: '#ffd27f', accent: '#00e5ff', spike: '#ffffff', style: 'concrete' },
      finale: { top: '#3a1604', bot: '#ff9a3a', ground: '#8a8f94', gline: '#ffffff', accent: '#ffd400', spike: '#ffffff', style: 'concrete' },
    },
    deathMsgs: {
      spike: ['Ridiculous. Highly unfair.', "That's a rip-off.", 'Foolish gift, foolish jump.', 'Sad!', 'Fake jump!', 'Not a winner.'],
      croc: ['Eaten by a canal crocodile.', 'The croc charged a fee too.'],
      feebooth: ['Charged an exorbitant transit fee.', 'The fee was ridiculous. So was the jump.'],
      gift: ['Tripped over the foolish gift.', 'Some gift.'],
      treaty: ['Blocked by the 1977 treaty.', 'The spirit of the agreement held.'],
      lockwall: ['Hit the lock wall.', 'Locked out.'],
      barge: ['Missed the barge.', 'The lock was not ready for you.'],
      container: ['Flattened by cargo.', 'Shipping is highly unfair.'],
      fee: ['Fee at the ceiling. Exorbitant.', 'You were told: no jumping.'],
      water: ['Fell in the canal.', 'Drowned in transit fees.', 'The canal took you back.'],
      plain: ['Blocked!'],
    },
    complete: {
      title: 'PANAMA CANAL: TAKEN BACK (FEE: $0, FOR US)',
      quote: '"A foolish gift, a total rip-off, and now it is ours again. Everyone is saying it."',
      statLabel: 'Foolish gifts returned',
    },

    build(api) {
      const { S, spikeRaw, blockRaw, OVER, P, DROP, O, PAD, COIN, CEIL, GJ, LIFT, SIGN, SCENE, GOAL, bx } = api;
      // ================= INTRO (bars 0-3): the entrance =================
      SCENE(1.2, 'canalsign');
      SIGN(3, 'PANAMA CANAL', 'transit fee: ridiculous');
      S(8); S(12); COIN(12.4, 130); S(14);
      // ================= VERSE (bars 4-11): jungle, crocs and fee booths =================
      S(16); S(18); S(20, 1, 'croc'); S(22);
      S(24, 2); S(26);
      OVER(28, 'feebooth', 'HIGHLY UNFAIR FEE');
      S(30); S(32); S(33); S(35);
      S(36, 1, 'croc'); S(38); COIN(38.4, 130);
      S(40); O(40.5, 120, 'DEAL'); spikeRaw(40.74, 4);
      S(42); S(44, 2); S(46); S(47);
      // ================= BUILD (bars 12-15): Miraflores Locks =================
      SIGN(47.6, 'MIRAFLORES LOCKS', 'going up');
      SCENE(52, 'miraflores');
      LIFT(48, 8, 0.5, 3, 3, 'barge', 'LOCK 1');
      P(50, 4, 3, 'lockwall', 'UPPER CHAMBER');
      S(51);
      DROP();
      S(53); S(54, 2); S(56); S(58); S(60); S(61); S(62); S(63);
      // ================= DROP (bars 16-23): take it back =================
      PAD(64, 'TAKE IT BACK');
      blockRaw(bx(64) + 75, 1, 3, 0, 'treaty', 'FOOLISH GIFT (1977)');
      S(66); S(67, 2);
      S(68); O(68.5, 120, 'DEAL'); spikeRaw(68.74, 4);
      S(70); S(71);
      OVER(72, 'gift', 'FOOLISH GIFT');
      S(74, 2);
      LIFT(76, 8, 0.5, 3, 3, 'barge', 'LOCK 2');
      P(78, 5, 3, 'lockwall');
      S(79);
      DROP();
      S(81); S(82, 2);
      SIGN(82.7, 'EXORBITANT FEE', 'no jumping');
      CEIL(83.2, 6, 2.75, 'fee');
      S(85); S(86); S(87);
      S(88, 2); S(90, 2);
      OVER(92, 'feebooth', 'RIP-OFF FEE');
      S(94); S(95);
      // ================= BREAKDOWN (bars 24-27): rip-off zone =================
      SIGN(96.3, 'RIP-OFF ZONE', 'highly unfair');
      SCENE(99, 'ship');
      GJ(97); COIN(97.4, 130); S(99); COIN(99.4, 130); GJ(101); COIN(101.4, 130); S(103); COIN(103.4, 130);
      P(104, 3, 1, 'container');
      P(105, 3, 2, 'container');
      P(106, 3, 3, 'container', 'CARGO');
      COIN(106.95, 60);
      DROP();
      S(109, 2); S(111);
      // ================= DROP 2 (bars 28-35): Gatun Locks =================
      SIGN(112.6, 'GATUN LOCKS', 'the big one');
      PAD(112, 'EXECUTIVE ORDER');
      spikeRaw(112.35, 3);
      S(114); S(115, 2);
      LIFT(116, 8, 0.5, 3, 3, 'barge', 'LOCK 3');
      P(118, 5, 3, 'lockwall');
      S(119);
      DROP();
      S(121); S(122, 2);
      S(124); O(124.5, 120, 'DEAL'); spikeRaw(124.74, 4);
      S(126); S(127, 2);
      LIFT(128, 8, 0.5, 3, 3, 'barge', 'LOCK 4');
      P(130, 6, 3, 'lockwall', 'SPIRIT OF THE AGREEMENT');
      S(131);
      DROP();
      S(133); S(134, 2); S(136, 2);
      S(138); O(138.5, 120, 'DEAL'); spikeRaw(138.74, 4);
      S(140); S(141); S(142); S(143);
      // ================= FINALE (bars 36-39): the gate =================
      SIGN(143.7, 'TAKE IT BACK', '→ →');
      SCENE(146, 'bridge');
      P(144, 3, 1, 'container');
      P(145, 3, 2, 'container');
      P(146, 3, 3, 'container', 'CARGO');
      COIN(146.95, 60);
      DROP();
      S(148); COIN(148.4, 130); GJ(150); S(152, 2); S(154); S(156);
      GOAL(158.5);
    },

    music: {
      // Reggaeton: the dembow. Kick on every beat, snare on the tresillo (16th steps 3, 6, 11, 14),
      // bass and horn stabs riding the same pattern, shaker 16ths under the drops.
      step(A, i) {
        const { t, bar, sib, bib, sub, beat, sec, on8, isJump, STEP, BEAT } = i;
        const ci = bar % 4, chord = CHORDS[ci];
        const full = sec === 'drop' || sec === 'drop2' || sec === 'finale';
        const active = !(sec === 'intro' && bar < 2);
        const dembow = sib === 3 || sib === 6 || sib === 11 || sib === 14;
        // drums
        if (active && sub === 0) A.kick(t, full ? 1 : 0.85);
        if (active && dembow) {
          if (full) { A.snare(t, 0.85); A.clap(t, 0.35); }
          else A.snare(t, sec === 'break' ? 0.4 : 0.65);
        }
        if (active && (sib === 2 || sib === 10)) A.tom(t, 260, 0.3);   // conga-ish
        if (active && (sib === 7 || sib === 15)) A.tom(t, 190, 0.28);
        if (sec === 'build') {
          const bi = bar - 12;
          if (bi >= 2) A.snare(t, 0.3 + (sib / 16) * 0.35 + 0.15 * (bi - 2));
          if (bi === 0 && sib === 0) A.riser(t, BEAT * 16);
        }
        if (active) {
          if (on8) A.hat(t, false, sub === 2 ? 0.28 : 0.4);
          if (full && (sub === 1 || sub === 3)) A.hat(t, false, 0.18);   // shaker
          if (full && sub === 2) A.hat(t, true, 0.22);
        }
        // bass follows the dembow
        const bassStep = sib === 0 || sib === 3 || sib === 6 || sib === 8 || sib === 11 || sib === 14;
        if (active && bassStep) A.bass(t, BASSN[ci] + (sib === 6 || sib === 14 ? 12 : 0), STEP * (sib === 0 || sib === 8 ? 2.5 : 1.6), sib === 0 || sib === 8 ? 0.95 : 0.65);
        else if (!active && bar >= 1 && sub === 0) A.bass(t, BASSN[ci], STEP * 3.5, 0.6);
        // pads under everything but the drops
        if (sib === 0 && !full) A.padChord(t, chord.map((n) => n + 12), BEAT * 4, sec === 'break' ? 0.13 : 0.09);
        // melody: hook in the verse, horn stabs on the tresillo plus the hook in the drops
        if (sec === 'verse' && on8) A.lead(t, HOOK[ci][sib >> 1], STEP * 1.6, 0.4, false);
        if (full) {
          if (dembow || sib === 0 || sib === 8) A.accent(t, chord[(sib >> 2) % 3] + 12, 0.42);
          if (on8) A.lead(t, HOOK[ci][sib >> 1] + (sec === 'drop2' ? 12 : 0), STEP * 1.7, 0.45, true);
          A.lead(t, [chord[0] + 12, chord[1] + 12, chord[2] + 12, chord[0] + 24][ARP[sib]], STEP * 0.9, 0.14, true);
        }
        if (sec === 'break' && (sib === 0 || sib === 6 || sib === 11)) A.bell(t, HOOK[ci][[0, 2, 4][[0, 6, 11].indexOf(sib)]], STEP * 4, 0.5);
        if (sec === 'intro' && bar >= 1 && sub === 0) A.lead(t, HOOK[ci][bib * 2], STEP * 2.5, 0.22, false);
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
