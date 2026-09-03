// Level - THE 51st STATE: north across the border. Introduces ICE zones: frozen lakes and a
// hockey rink where the run gets faster (the beat grid stays exact, the screen just moves more).
(function (root) {
  // D major: D | A | Bm | G (one chord per bar) - arena rock
  const CHORDS = [[62, 66, 69], [57, 61, 64], [59, 62, 66], [55, 59, 62]];
  const BASSN = [38, 33, 35, 31];
  const HOOK = [
    [74, 78, 81, 78, 74, 69, 66, 69],
    [73, 76, 81, 76, 73, 69, 64, 69],
    [74, 78, 83, 78, 74, 71, 66, 71],
    [74, 79, 83, 79, 74, 71, 67, 71],
  ];
  const ARP = [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 3];

  const def = {
    id: 'canada',
    name: 'THE 51st STATE',
    tagline: 'Annex Canada, politely',
    difficulty: 'HARD',
    bpm: 120,
    minWindowMs: 90, // HARD: same double-spike tolerance as Venezuela
    backdrop: 'canada',
    water: 'syrup',
    collectible: { label: 'loonies', icon: 'coin' },
    ending: { type: 'sign', camOffset: 340 },
    sections: [
      { name: 'intro', bar: 0 }, { name: 'verse', bar: 4 }, { name: 'build', bar: 12 }, { name: 'drop', bar: 16 },
      { name: 'break', bar: 24 }, { name: 'drop2', bar: 28 }, { name: 'finale', bar: 36 },
    ],
    palettes: {
      intro:  { top: '#14213d', bot: '#7fa8d8', ground: '#e8f1fb', gline: '#ffffff', accent: '#c8102e', spike: '#ffffff', style: 'snow' },
      verse:  { top: '#1b2a4a', bot: '#6f9ad0', ground: '#dbe8f7', gline: '#ffffff', accent: '#c8102e', spike: '#ffffff', style: 'road' },
      build:  { top: '#2a1a4a', bot: '#8a5aa8', ground: '#d6d0c2', gline: '#ffe9a0', accent: '#ff4fa3', spike: '#ffffff', style: 'road' },
      drop:   { top: '#061a33', bot: '#1f6f9c', ground: '#dfeeff', gline: '#8fe0ff', accent: '#4fc3ff', spike: '#ffffff', style: 'snow' },
      break:  { top: '#3a1a10', bot: '#ff9f4a', ground: '#f0e6d0', gline: '#ffd27f', accent: '#ffd400', spike: '#ffffff', style: 'snow' },
      drop2:  { top: '#0a0a2a', bot: '#4a2a8a', ground: '#e8f4ff', gline: '#8fe0ff', accent: '#c8102e', spike: '#ffffff', style: 'ice' },
      finale: { top: '#2a0a1a', bot: '#ff7a7a', ground: '#f4f0ff', gline: '#ffffff', accent: '#c8102e', spike: '#ffffff', style: 'snow' },
    },
    deathMsgs: {
      spike: ['Sorry.', 'Sad, eh?', 'Fake jump!', 'Denied entry.', 'Not a winner.', 'Off the beat, into the snowbank.'],
      mountie: ['Arrested by a Mountie.', 'The Mountie always gets his man.', 'Very polite arrest.'],
      puck: ['Pucked.', 'High-sticking, two minutes.', 'That puck had a mind of its own.'],
      sorry: ['They said sorry. You still died.', 'Apology not accepted.'],
      parliament: ['Parliament said no, politely.', 'Question Period got you.'],
      usmca: ['Tripped over the trade deal.', 'USMCA: still in force.'],
      timmies: ['Spilled the double-double.', 'Coffee first, annexation later.'],
      syrup: ['Stuck in the syrup.', 'Grade A, very sticky.'],
      tariff: ['Tariffed at the ceiling.', 'You were told: no jumping.'],
      water: ['Drowned in maple syrup.', 'A sticky end.', 'Sweet, sweet defeat.'],
      plain: ['Blocked!'],
    },
    complete: {
      title: 'CANADA: 51st STATE (PENDING APOLOGY)',
      quote: '"They love it. They are saying sorry, which in Canada means yes."',
      statLabel: 'Provinces & territories acquired',
    },

    build(api) {
      const { S, spikeRaw, blockRaw, OVER, P, DROP, O, PAD, COIN, CEIL, MS, GJ, ICE, SIGN, SCENE, GOAL, bx } = api;
      // ================= INTRO (bars 0-3): the border =================
      SCENE(1.2, 'border');
      SIGN(3.2, 'CANADA', 'welcome · bienvenue');
      S(8); S(12); COIN(12.4, 130); S(14);
      // ================= VERSE (bars 4-11): Mounties and apologies =================
      S(16); S(18); S(20, 1, 'mountie'); S(22);
      S(24, 2); S(26);
      OVER(28, 'sorry', 'SORRY');
      S(30); S(32); S(33); S(35);
      S(36, 1, 'mountie'); S(38); COIN(38.4, 130);
      S(40); O(40.5, 120, 'EH?'); spikeRaw(40.74, 4);
      S(42); S(44, 2); S(46); S(47);
      // ================= BUILD (bars 12-15): Parliament Hill =================
      SIGN(47.6, 'PARLIAMENT HILL', 'question period →');
      SCENE(50.5, 'parliament');
      P(48, 3, 1, 'parliament', 'HOUSE OF COMMONS');
      P(49, 3, 1, 'parliament');
      P(50, 3, 2, 'parliament', 'SENATE');
      P(51, 3, 2, 'parliament');
      P(52, 3, 1, 'parliament');
      DROP();
      COIN(52.9, 90);
      S(54); S(55, 2); S(56); S(58); S(60); S(61); S(62); S(63);
      // ================= DROP (bars 16-23): the frozen lake =================
      PAD(64, 'TARIFF THREAT');
      blockRaw(bx(64) + 75, 1, 3, 0, 'usmca', 'USMCA');
      SIGN(65.4, 'FROZEN LAKE', 'faster on ice');
      ICE(66, 78, 1.25);
      S(67); S(69); MS(70, 1, 'puck'); S(71); S(72, 2);
      S(74); O(74.5, 120, 'EH?'); spikeRaw(74.74, 4);
      S(76); S(77);
      S(79); S(80, 2);
      OVER(82, 'timmies', 'DOUBLE DOUBLE');
      S(84); S(85); S(86, 2); S(88);
      SIGN(89.3, 'SYRUP COUNTRY', 'mind the pits');
      GJ(90); S(92); GJ(93); S(94, 2); S(95);
      // ================= BREAKDOWN (bars 24-27): sugar shack =================
      SCENE(98, 'forest');
      S(97); COIN(97.4, 130); S(99); COIN(99.4, 130); S(101); COIN(101.4, 130); S(103); COIN(103.4, 130);
      P(104, 3, 1, 'syrup');
      P(105, 3, 2, 'syrup');
      P(106, 3, 3, 'syrup', 'GRADE A');
      COIN(106.95, 60);
      DROP();
      S(109, 2); S(111);
      // ================= DROP 2 (bars 28-35): the rink =================
      SIGN(112.6, 'THE RINK', 'pucks incoming');
      SCENE(115, 'rink');
      PAD(112, 'EXECUTIVE ORDER');
      spikeRaw(112.35, 3);
      S(114); S(115, 2);
      ICE(116, 130, 1.3);
      S(117); MS(118, 1, 'puck'); S(119); S(120, 2);
      MS(122, 2, 'puck'); S(123);
      S(124); O(124.5, 120, 'EH?'); spikeRaw(124.74, 4);
      S(126); S(127, 2); MS(128, 1, 'puck'); S(129);
      SIGN(130.7, '25% TARIFF', 'no jumping');
      CEIL(131.2, 6, 2.75, 'tariff');
      S(134); S(135); S(136, 2); S(137, 2);
      S(138); O(138.5, 120, 'EH?'); spikeRaw(138.74, 4);
      S(140); S(141); S(142); S(143);
      // ================= FINALE (bars 36-39): Ottawa =================
      SIGN(143.7, 'OTTAWA', 'pop. 1 million, all sorry');
      SCENE(146, 'forest');
      P(144, 3, 1, 'parliament');
      P(145, 3, 2, 'parliament');
      P(146, 3, 3, 'parliament', 'PEACE TOWER');
      COIN(146.95, 60);
      DROP();
      ICE(148, 153, 1.25);
      S(148); COIN(148.4, 130); S(150); S(152, 2);
      S(154); S(156);
      GOAL(158.5);
    },

    music: {
      step(A, i) {
        const { t, bar, sib, bib, sub, beat, sec, on8, isJump, STEP, BEAT } = i;
        const ci = bar % 4, chord = CHORDS[ci];
        const full = sec === 'drop' || sec === 'drop2' || sec === 'finale';
        // drums: arena stomp-stomp-clap in the verse, four-on-the-floor in the drops
        if (sec === 'verse' || (sec === 'intro' && bar >= 2) || sec === 'break') {
          if (sib === 0 || sib === 4) A.kick(t, 0.95);
          if (sib === 8) { A.clap(t, 0.8); A.snare(t, 0.5); }
        }
        if (sub === 0) {
          if (full || sec === 'build') A.kick(t, 1);
          if (full && (bib === 1 || bib === 3)) { A.snare(t, 0.9); A.clap(t, 0.4); }
        }
        if (sec === 'build') {
          const bi = bar - 12;
          if (bi < 2) { if (on8) A.snare(t, 0.4 + 0.12 * bi); }
          else A.snare(t, 0.35 + (sib / 16) * 0.35 + 0.15 * (bi - 2));
          if (bi === 0 && sib === 0) A.riser(t, BEAT * 16);
          if (bi === 3 && sub === 2) A.tom(t, 120 + bib * 25, 0.5);
        }
        if (!(sec === 'intro' && bar === 0)) {
          if (on8) A.hat(t, false, sub === 2 ? 0.3 : 0.42);
          if (full && sub === 2) A.hat(t, true, 0.28);
          if (sec === 'drop2' && (sub === 1 || sub === 3)) A.hat(t, false, 0.16);
        }
        // bass
        if (sec === 'verse' || sec === 'break') { if (on8) A.bass(t, BASSN[ci] + (sub === 2 ? 12 : 0), STEP * 1.8, sub === 0 ? 0.9 : 0.55); }
        else if (full) A.bass(t, BASSN[ci] + (sub % 2 ? 12 : 0), STEP * 0.95, sub === 0 ? 1 : 0.7);
        else if (sec === 'build') { if (on8) A.bass(t, BASSN[ci], STEP * 1.8, 0.8); }
        else if (sec === 'intro' && bar >= 1 && sub === 0) A.bass(t, BASSN[ci], STEP * 3.5, 0.7);
        // pads
        if (sib === 0 && (sec === 'intro' || sec === 'break' || sec === 'verse' || sec === 'build')) A.padChord(t, chord.map((n) => n + 12), BEAT * 4, sec === 'break' ? 0.13 : 0.08);
        // organ-ish lead
        if (sec === 'verse' && on8) A.lead(t, HOOK[ci][sib >> 1], STEP * 1.6, 0.42, false);
        if (full) {
          const tones = [chord[0] + 12, chord[1] + 12, chord[2] + 12, chord[0] + 24];
          A.lead(t, tones[ARP[sib]] + (sec === 'drop2' ? 12 : 0), STEP * 0.9, 0.2, true);
          if (on8) A.lead(t, HOOK[ci][sib >> 1], STEP * 1.7, 0.5, true);
        }
        if (sec === 'break' && (sib === 0 || sib === 6 || sib === 10 || sib === 14)) A.bell(t, HOOK[ci][[0, 2, 4, 6][[0, 6, 10, 14].indexOf(sib)]], STEP * 5, 0.5);
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
