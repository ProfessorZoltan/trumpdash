// Level 1 - VENEZUELA: dash from Washington to the Orinoco oil belt and drive off with the oil.
(function (root) {
  // A minor progression: Am | F | C | G (one chord per bar)
  const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
  const BASSN = [45, 41, 36, 43];
  const HOOK = [
    [76, 81, 84, 81, 76, 72, 69, 71],
    [72, 77, 81, 77, 72, 69, 65, 67],
    [76, 79, 84, 79, 76, 72, 67, 69],
    [74, 79, 83, 79, 74, 71, 67, 69],
  ];
  const ARP = [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 3];

  const def = {
    id: 'venezuela',
    name: 'VENEZUELA',
    tagline: 'Orinoco oil belt',
    difficulty: 'HARD',
    bpm: 128,
    backdrop: 'city',
    collectible: { label: 'barrels', icon: 'barrel' },
    ending: { type: 'truck', camOffset: 520 },
    sections: [
      { name: 'intro', bar: 0 }, { name: 'verse', bar: 4 }, { name: 'build', bar: 12 }, { name: 'drop', bar: 16 },
      { name: 'break', bar: 24 }, { name: 'drop2', bar: 28 }, { name: 'finale', bar: 36 },
    ],
    palettes: {
      intro:  { top: '#0b0f2e', bot: '#3b2b74', ground: '#161b45', gline: '#8c8cff', accent: '#ffd400', spike: '#e9edff', style: 'road' },
      verse:  { top: '#08245c', bot: '#2f74c0', ground: '#0d2f66', gline: '#5fb3ff', accent: '#ffd400', spike: '#ffffff', style: 'road' },
      build:  { top: '#2a0b3d', bot: '#8a2f8f', ground: '#2b1046', gline: '#ff6ad5', accent: '#ff4fa3', spike: '#ffe1f6', style: 'road' },
      drop:   { top: '#3b0808', bot: '#c62828', ground: '#3d0d0d', gline: '#ff7b7b', accent: '#ffcc00', spike: '#ffffff', style: 'road' },
      break:  { top: '#053a3a', bot: '#1fb39a', ground: '#083a36', gline: '#5fffe0', accent: '#ffd400', spike: '#ffffff', style: 'road' },
      drop2:  { top: '#2a0a2f', bot: '#e0206a', ground: '#310a33', gline: '#5ce1ff', accent: '#00e5ff', spike: '#ffffff', style: 'road' },
      finale: { top: '#3a1604', bot: '#ff8a00', ground: '#2a1808', gline: '#ffd27f', accent: '#ffd400', spike: '#ffffff', style: 'road' },
    },
    deathMsgs: {
      spike: ['Impeached!', "Tariff'd!", 'Sad!', 'Fake jump!', 'Covfefe.', 'Bigly missed.', 'Off the beat, off the cliff.', 'Very unfair. Rigged spike.'],
      constitution: ['Blocked by the Constitution!', 'The Constitution held. For now.', 'Article II does not say that.'],
      wall: ['Article I is a big, beautiful wall.', 'Congress has the power of the purse. Ouch.'],
      congress: ['Congress said no. (This time.)', 'Lost the vote. Sad!'],
      court: ['Overruled, 9-0.', 'The Supreme Court declined to hear your jump.'],
      law: ['International law happened.', 'The UN sent a strongly worded spike.'],
      press: ['Caught by the free press!', 'Front page: TRUMP TRIPS.'],
      gag: ['Violated the gag order!', 'You were told: no jumping.'],
      barrels: ['Slipped on Venezuelan crude.', 'That oil was not yours yet.'],
      water: ['Sunk.'],
      plain: ['Blocked!'],
    },
    complete: {
      title: "VENEZUELA'S OIL: UNDER NEW MANAGEMENT",
      quote: '"Nobody has ever seen a takeover like this. Everyone is saying it."',
      statLabel: 'Constitutions harmed',
    },

    build(api) {
      const { S, spikeRaw, blockRaw, OVER, P, DROP, O, PAD, COIN, CEIL, SIGN, SCENE, GOAL, bx } = api;
      // ================= INTRO (bars 0-3) =================
      SCENE(0.9, 'whitehouse');
      SIGN(2.6, 'WASHINGTON, D.C.', 'oil reserves: none');
      S(8); COIN(8.4, 130);
      S(12); S(14);
      SIGN(15.3, 'VENEZUELA', '3,400 km  →');
      // ================= VERSE (bars 4-11) =================
      S(16); S(18); S(20); COIN(20.4, 130); S(22);
      S(24, 2); S(26);
      OVER(28, 'constitution', 'THE CONSTITUTION');
      S(30); COIN(30.4, 130);
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
      COIN(52.9, 90);
      S(54); S(55); S(56, 2); S(58);
      S(60); S(61); S(62); S(63);
      // ================= DROP 1 (bars 16-23) =================
      PAD(64);
      blockRaw(bx(64) + 75, 1, 3, 0, 'wall', 'ARTICLE I');
      S(66); S(67, 2);
      S(68); O(68.5, 120); spikeRaw(68.74, 4);
      S(70); S(71);
      OVER(72, 'law', 'INTERNATIONAL LAW');
      S(74, 2); COIN(74.4, 130);
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
      S(97); COIN(97.4, 130);
      S(99); COIN(99.4, 130);
      S(101); COIN(101.4, 130);
      S(103); COIN(103.4, 130);
      P(104, 3, 1, 'barrels');
      P(105, 3, 2, 'barrels');
      P(106, 3, 3, 'barrels', 'CRUDE');
      COIN(106.95, 60);
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
      COIN(146.95, 60);
      DROP();
      S(148); COIN(148.4, 130);
      S(150); S(152, 2); S(154);
      SCENE(155.2, 'oilfield');
      GOAL(158.5);
    },

    music: {
      step(A, i) {
        const { t, bar, sib, bib, sub, beat, sec, on8, isJump, STEP, BEAT } = i;
        const ci = bar % 4, chord = CHORDS[ci];
        const full = sec === 'verse' || sec === 'drop' || sec === 'drop2' || sec === 'finale';
        // drums
        if (sub === 0) {
          if (full) A.kick(t, 1);
          else if (sec === 'intro' && bar >= 2 && (bib === 0 || bib === 2)) A.kick(t, 0.8);
          else if (sec === 'break' && (bib === 0 || bib === 2)) A.kick(t, 0.75);
          else if (sec === 'build') A.kick(t, 1);
          if (full && (bib === 1 || bib === 3)) A.snare(t, 0.85);
        }
        if (sec === 'build') {
          const bi = bar - 12;
          if (bi < 2) { if (on8) A.snare(t, 0.45 + 0.12 * bi); }
          else A.snare(t, 0.4 + (sib / 16) * 0.35 + 0.15 * (bi - 2));
          if (bi === 0 && sib === 0) A.riser(t, BEAT * 16);
        }
        if (!(sec === 'intro' && bar === 0)) {
          if (on8) A.hat(t, false, sub === 2 ? 0.32 : 0.45);
          if ((sec === 'drop' || sec === 'drop2' || sec === 'finale') && sub === 2) A.hat(t, true, 0.3);
          if ((sec === 'drop' || sec === 'drop2') && (sub === 1 || sub === 3)) A.hat(t, false, 0.16);
        }
        // bass
        if (sec === 'verse' || sec === 'break') { if (on8) A.bass(t, BASSN[ci] + (sub === 2 ? 12 : 0), STEP * 1.8, sub === 0 ? 0.9 : 0.6); }
        else if (sec === 'drop' || sec === 'drop2' || sec === 'finale') A.bass(t, BASSN[ci] + (sub % 2 ? 12 : 0), STEP * 0.95, sub === 0 ? 1 : 0.7);
        else if (sec === 'build') { if (on8) A.bass(t, BASSN[ci], STEP * 1.8, 0.8); }
        else if (sec === 'intro' && bar >= 2 && sub === 0) A.bass(t, BASSN[ci], STEP * 3.5, 0.7);
        // pads
        if (sib === 0 && (sec === 'intro' || sec === 'break' || sec === 'verse' || sec === 'build')) A.padChord(t, chord.map((n) => n + 12), BEAT * 4, sec === 'break' ? 0.13 : 0.08);
        // lead / melody
        if (sec === 'verse' && on8) A.lead(t, HOOK[ci][sib >> 1], STEP * 1.6, 0.4, false);
        if (sec === 'drop' || sec === 'drop2' || sec === 'finale') {
          const tones = [chord[0] + 12, chord[1] + 12, chord[2] + 12, chord[0] + 24];
          A.lead(t, tones[ARP[sib]] + (sec === 'drop2' ? 12 : 0), STEP * 0.9, 0.2, true);
          if (on8) A.lead(t, HOOK[ci][sib >> 1], STEP * 1.7, 0.5, true);
        }
        if (sec === 'break' && (sib === 0 || sib === 6 || sib === 10 || sib === 14)) A.lead(t, HOOK[ci][[0, 2, 4, 6][[0, 6, 10, 14].indexOf(sib)]], STEP * 4, 0.35, false);
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
