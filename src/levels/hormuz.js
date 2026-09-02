// Level 2 - HORMUZ: from the golf course to the Strait of Hormuz, where the level ends at a toll booth.
(function (root) {
  // E harmonic minor: Em | C | Am | B (one chord per bar)
  const CHORDS = [[64, 67, 71], [60, 64, 67], [57, 60, 64], [59, 63, 66]];
  const BASSN = [40, 36, 33, 35];
  const HOOK = [
    [76, 79, 83, 79, 76, 75, 76, 71],
    [72, 76, 79, 76, 72, 71, 72, 67],
    [69, 72, 76, 72, 69, 68, 69, 64],
    [71, 75, 78, 75, 71, 69, 71, 66],
  ];
  const ARP = [0, 2, 1, 3, 0, 2, 1, 3, 2, 0, 3, 1, 2, 0, 3, 1];

  const def = {
    id: 'hormuz',
    name: 'HORMUZ',
    tagline: 'Strait of Hormuz blockade',
    difficulty: 'INSANE',
    bpm: 140,
    minWindowMs: 70, // INSANE: double spikes at 140 BPM leave ±35 ms
    backdrop: 'gulf',
    collectible: { label: 'tolls', icon: 'coin' },
    ending: { type: 'toll', camOffset: 380 },
    sections: [
      { name: 'intro', bar: 0 }, { name: 'verse', bar: 4 }, { name: 'build', bar: 12 }, { name: 'drop', bar: 16 },
      { name: 'break', bar: 24 }, { name: 'drop2', bar: 28 }, { name: 'finale', bar: 36 },
    ],
    palettes: {
      intro:  { top: '#2b1240', bot: '#ff7a59', ground: '#1f5a2e', gline: '#7cff9a', accent: '#ffd400', spike: '#ffffff', style: 'grass' },
      verse:  { top: '#0a0f1e', bot: '#2a3a5c', ground: '#1a2233', gline: '#8fb3ff', accent: '#ffd400', spike: '#e9edff', style: 'road' },
      build:  { top: '#06111f', bot: '#1e4d7a', ground: '#2b3644', gline: '#9fd0ff', accent: '#ff4fa3', spike: '#ffffff', style: 'steel' },
      drop:   { top: '#031b24', bot: '#0e5c6b', ground: '#3a2f28', gline: '#5fffe0', accent: '#ffcc00', spike: '#ffffff', style: 'deck' },
      break:  { top: '#3a1550', bot: '#ff8c42', ground: '#3a2f28', gline: '#ffd27f', accent: '#ffd400', spike: '#ffffff', style: 'deck' },
      drop2:  { top: '#1a0000', bot: '#7a1010', ground: '#2b2b33', gline: '#ff5c5c', accent: '#ff9d00', spike: '#ffffff', style: 'steel' },
      finale: { top: '#0b2a3a', bot: '#ffb347', ground: '#3a2f28', gline: '#ffe08a', accent: '#ffd400', spike: '#ffffff', style: 'deck' },
    },
    deathMsgs: {
      spike: ['Sad!', 'Not a winner.', 'The generals said no.', 'Wrong beat, wrong war.', 'Fake jump!', 'Unbelievable. Rigged.'],
      warpowers: ['Sunk by the War Powers Act.', 'Congress remembered it has a job.'],
      aumf: ['No AUMF, no dash.', 'Authorization denied.'],
      intel: ['You should have read the briefing.', 'Intel says: ouch.'],
      hearing: ['Subpoenaed.', 'The hearing went badly.'],
      un: ['The Security Council held.', 'Vetoed.'],
      jcpoa: ['Slipped on the nuclear deal.', 'Torn up, and it still tripped you.'],
      nato: ['Article 5 was not triggered.', 'The allies declined.'],
      ceasefire: ['Violated the ceasefire. Again.', 'You were told: no jumping.'],
      tanker: ['Rammed a tanker.', 'That crude was not yours yet.'],
      mine: ['Mined!', 'Boom. Sad!', 'The Gulf is full of surprises.'],
      drone: ['Droned.', 'Buzzed. Badly.'],
      water: ['Sunk.', 'Man overboard!', 'The Gulf is deeper than it looks.'],
      plain: ['Blocked!'],
    },
    complete: {
      title: 'STRAIT OF HORMUZ: NOW A TOLL ROAD',
      quote: '"Best blockade in history. The tankers are thrilled."',
      statLabel: 'Tankers tolled',
    },

    build(api) {
      const { S, spikeRaw, blockRaw, OVER, P, DROP, O, PAD, COIN, CEIL, MS, MINES, DRONE, GJ, GAP, SIGN, SCENE, GOAL, bx } = api;
      // ================= INTRO (bars 0-3): Mar-a-Lago =================
      SCENE(0.9, 'maralago');
      SIGN(2.6, 'MAR-A-LAGO', 'golf, interrupted');
      S(6); S(8); COIN(8.4, 130); S(10, 2); S(12); S(13); S(15);
      // ================= VERSE (bars 4-11): the Pentagon =================
      SIGN(16.4, 'THE PENTAGON', 'situation room →');
      SCENE(18, 'pentagon');
      S(17); S(19); S(20, 2); S(22); S(23);
      OVER(24, 'warpowers', 'WAR POWERS ACT'); S(26); S(27);
      S(28); O(28.5, 120, 'DEAL'); spikeRaw(28.74, 4);
      S(30); S(31, 2);
      OVER(32, 'aumf', 'AUMF'); S(34); S(35); S(36, 2); COIN(36.4, 130);
      S(38); O(38.5, 120, 'DEAL'); spikeRaw(38.74, 4);
      S(40); S(41); OVER(42, 'intel', 'INTEL BRIEFING'); S(44); S(45); S(46, 2); S(47);
      // ================= BUILD (bars 12-15): carrier deck =================
      SIGN(47.6, 'USS TRUTH', 'flight deck');
      SCENE(50.5, 'carrier');
      P(48, 3, 1, 'hearing', 'SENATE HEARING');
      P(49, 3, 1, 'hearing');
      P(50, 3, 2, 'hearing', 'HOUSE HEARING');
      P(51, 3, 2, 'hearing');
      P(52, 3, 1, 'hearing');
      DROP();
      COIN(52.9, 90);
      S(54); S(55, 2); S(56); S(57); S(58, 2); S(60); S(61); S(62); S(63);
      // catapult off the bow, over open water
      PAD(64, 'TRUTH SOCIAL POST');
      GAP(64 - 10 / 180, 64 + 120 / 180);
      // ================= DROP 1 (bars 16-23): the Gulf =================
      SIGN(65.5, 'PERSIAN GULF', 'mind the mines');
      S(66); S(67);
      GJ(68); MS(70, 2); S(71);
      MINES(72.2, 73.6, 118, 0.35);
      MS(74); GJ(75);
      S(76); O(76.5, 120, 'DEAL'); spikeRaw(76.74, 4);
      S(78); S(79, 2);
      PAD(80, 'VETO');
      blockRaw(bx(80) + 75, 1, 3, 0, 'un', 'UN SECURITY COUNCIL');
      S(82); S(83, 2); GJ(84); GJ(85); S(87);
      MINES(88.2, 89.6, 118, 0.35);
      MS(90); MS(91); S(92, 2); GJ(93); S(94, 2); S(95);
      // ================= BREAKDOWN (bars 24-27): oil platforms =================
      SIGN(96.3, 'TOLL ZONE', '$1B per tanker');
      SCENE(98, 'platform');
      S(97); COIN(97.4, 130); S(99); COIN(99.4, 130); S(101); COIN(101.4, 130); S(103); COIN(103.4, 130);
      P(104, 3, 1, 'jcpoa', 'JCPOA');
      P(105, 3, 2, 'jcpoa');
      P(106, 3, 3, 'jcpoa', '(TORN UP)');
      COIN(106.95, 60);
      DROP();
      S(109, 2); S(111);
      // ================= DROP 2 (bars 28-35): missile & drone alley =================
      SIGN(112.6, 'DRONE ALLEY', 'jump on the beat');
      SCENE(114, 'missiles');
      PAD(112, 'EXECUTIVE ORDER');
      spikeRaw(112.35, 3);
      S(114); S(115, 2);
      S(116); DRONE(116); S(117); DRONE(117);
      S(118); O(118.5, 120, 'TACO'); spikeRaw(118.74, 4);
      SIGN(119.7, 'CEASEFIRE', 'no jumping');
      CEIL(120.2, 6, 2.75, 'ceasefire');
      S(122); S(123, 2);
      P(124, 5, 1, 'nato', 'NATO ARTICLE 5');
      S(125);
      DROP();
      S(127); S(128, 2); GJ(129); S(130); DRONE(130); S(131); DRONE(131);
      S(132); S(133); S(134, 2); S(135, 2);
      S(136); O(136.5, 120, 'TACO'); spikeRaw(136.74, 4);
      MINES(137.7, 139.1, 118, 0.35);
      S(140); S(141); S(142, 2); S(143);
      // ================= FINALE (bars 36-43): the Strait =================
      SIGN(143.7, 'STRAIT AHEAD', '21 miles wide');
      SCENE(147, 'tankers');
      P(144, 3, 1, 'tanker');
      P(145, 3, 2, 'tanker');
      P(146, 3, 3, 'tanker', 'VLCC');
      COIN(146.95, 60);
      DROP();
      S(148); COIN(148.4, 130); GJ(149); S(150); S(151); S(152, 2);
      MINES(153.2, 154.6, 118, 0.35);
      S(155); S(156); S(157, 2); S(158); DRONE(158); S(160); GJ(161); S(162); S(163); S(164, 2);
      S(166); S(167); S(168, 2);
      GAP(170.5 + 90 / 180, 176);
      GOAL(170.5);
    },

    music: {
      step(A, i) {
        const { t, bar, sib, bib, sub, beat, sec, on8, isJump, STEP, BEAT } = i;
        const ci = bar % 4, chord = CHORDS[ci];
        const drop = sec === 'drop' || sec === 'drop2' || sec === 'finale';
        // drums: half-time march in the verse, four-on-the-floor in the drops
        if (sub === 0) {
          if (drop || sec === 'build') A.kick(t, 1);
          else if ((sec === 'intro' && bar >= 1) || sec === 'verse' || sec === 'break') { if (bib === 0 || bib === 2) A.kick(t, 0.9); }
          if (drop && (bib === 1 || bib === 3)) { A.snare(t, 0.9); A.clap(t, 0.35); }
          if (sec === 'verse' && (bib === 1 || bib === 3)) A.snare(t, 0.75);
          if (sec === 'break' && bib === 3) A.snare(t, 0.35);
        }
        if (sec === 'verse' && sib === 6) A.kick(t, 0.7);
        if (sec === 'intro' && bar >= 1 && (sib === 14 || sib === 15)) A.tom(t, sib === 14 ? 140 : 100, 0.6);
        if (sec === 'build') {
          const bi = bar - 12;
          if (bi < 2) { if (on8) A.snare(t, 0.45 + 0.12 * bi); }
          else A.snare(t, 0.4 + (sib / 16) * 0.35 + 0.15 * (bi - 2));
          if (bi === 0 && sib === 0) A.siren(t, BEAT * 8);
          if (bi === 2 && sib === 0) { A.siren(t, BEAT * 8); A.riser(t, BEAT * 8); }
          if (bi === 3 && sub === 2) A.tom(t, 110 + bib * 20, 0.5);
        }
        if (!(sec === 'intro' && bar === 0)) {
          if (on8) A.hat(t, false, sub === 2 ? 0.3 : 0.42);
          if (drop && sub === 2) A.hat(t, true, 0.28);
          if ((sec === 'drop2' || sec === 'finale') && (sub === 1 || sub === 3)) A.hat(t, false, 0.18);
        }
        // bass
        if (sec === 'verse') { if (on8) A.bass(t, BASSN[ci] + (sib === 6 || sib === 14 ? 12 : 0), STEP * 1.8, sub === 0 ? 0.9 : 0.55); }
        else if (drop) A.bass(t, BASSN[ci] + (sub % 2 ? 12 : 0), STEP * 0.95, sub === 0 ? 1 : 0.7);
        else if (sec === 'build') { if (on8) A.bass(t, BASSN[ci], STEP * 1.8, 0.8); }
        else if (sec === 'break' && (sib === 0 || sib === 8)) A.bass(t, BASSN[ci], STEP * 7, 0.7);
        else if (sec === 'intro' && bar >= 2 && sub === 0) A.bass(t, BASSN[ci], STEP * 3.5, 0.7);
        // pads
        if (sib === 0 && (sec === 'intro' || sec === 'break' || sec === 'verse' || sec === 'build')) A.padChord(t, chord.map((n) => n + 12), BEAT * 4, sec === 'break' ? 0.13 : 0.08);
        // lead / melody
        if (sec === 'verse' && on8) A.lead(t, HOOK[ci][sib >> 1], STEP * 1.6, 0.4, false);
        if (drop) {
          const tones = [chord[0] + 12, chord[1] + 12, chord[2] + 12, chord[0] + 24];
          A.lead(t, tones[ARP[sib]] + (sec === 'finale' ? 12 : 0), STEP * 0.9, 0.2, true);
          if (on8) A.lead(t, HOOK[ci][sib >> 1] + (sec === 'drop2' ? 12 : 0), STEP * 1.7, 0.5, true);
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
