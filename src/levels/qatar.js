// Level - QATARI JET: "it's a gift". Two halves. On foot through Doha to the Amiri Diwan with the
// new ground vocabulary (platforms to climb, pits to clear in a row, low ceilings that punish an
// early jump right before a spike), then the gift itself: the jet. In FLIGHT the button is thrust:
// hold to climb, release to sink; the ceiling and the floor are safe. The level declares the
// intended HOLDs and every GATE is cut around the resulting path, so flying the cues exactly clears
// the section. It ends on the runway at Joint Base Andrews, where the tail gets restamped.
(function (root) {
  // D hijaz: D Eb F# G A Bb C. Chords: D major-ish drone | Eb | G minor | A
  const CHORDS = [[62, 66, 69], [63, 67, 70], [67, 70, 74], [69, 72, 76]];
  const BASSN = [38, 39, 43, 45];
  const HOOK = [
    [74, 75, 78, 74, 72, 70, 69, 70],
    [74, 78, 81, 78, 74, 70, 69, 66],
    [69, 70, 74, 70, 69, 67, 66, 67],
    [66, 67, 70, 69, 66, 63, 62, 63],
  ];
  const ARP = [0, 2, 1, 3, 0, 2, 1, 3, 2, 0, 3, 1, 2, 0, 3, 1];

  const def = {
    id: 'qatar',
    name: 'QATARI JET',
    tagline: "It's a gift",
    difficulty: 'EXPERT',
    bpm: 136,
    minWindowMs: 70,
    backdrop: 'desert',
    water: 'sea',
    collectible: { label: 'gifts', icon: 'coin' },
    ending: { type: 'jet', camOffset: 330 },
    sections: [
      { name: 'intro', bar: 0 }, { name: 'verse', bar: 4 }, { name: 'build', bar: 12 }, { name: 'drop', bar: 16 },
      { name: 'break', bar: 24 }, { name: 'drop2', bar: 28 }, { name: 'finale', bar: 36 },
    ],
    palettes: {
      intro:  { top: '#2a1245', bot: '#f2a65a', ground: '#c9a35a', gline: '#ffe9a8', accent: '#8d1b3d', spike: '#ffffff', style: 'sand' },
      verse:  { top: '#1a2a6a', bot: '#ffb36a', ground: '#c9a35a', gline: '#ffe9a8', accent: '#8d1b3d', spike: '#ffffff', style: 'sand' },
      build:  { top: '#3a0a2a', bot: '#ffcc55', ground: '#b8862b', gline: '#fff0b0', accent: '#ffd400', spike: '#ffffff', style: 'sand' },
      drop:   { top: '#0b1a3a', bot: '#5aa9e6', ground: '#7a7f86', gline: '#ffffff', accent: '#8d1b3d', spike: '#ffffff', style: 'road' },
      break:  { top: '#0a1e3a', bot: '#2f8fd0', ground: '#1b4f7a', gline: '#8fd3ff', accent: '#ffd400', spike: '#ffffff', style: 'ocean' },
      drop2:  { top: '#141428', bot: '#4a4f66', ground: '#22303c', gline: '#9fb3c8', accent: '#ffe97a', spike: '#ffffff', style: 'ocean' },
      finale: { top: '#1a2a5a', bot: '#ffb36a', ground: '#7a7f86', gline: '#ffffff', accent: '#ffd400', spike: '#ffffff', style: 'road' },
    },
    deathMsgs: {
      spike: ['Sad!', 'Fake jump!', 'Not a winner.', 'The Amir is watching.', 'No gift for you.'],
      gift: ['Tripped over the gift.', 'It was free. You still paid.', 'Some gift.'],
      sand: ['Hit the ceiling. Very low.', 'You were told: no jumping.', 'Sandstone: 1, hair: 0.'],
      carpet: ['Tripped on the red carpet.', 'Face-first into the ceremony.'],
      tower: ['Flew into a tower.', 'Doha: 1, jet: 0.', 'That building was not a gift.'],
      minaret: ['Clipped a minaret.', 'Too low over the souq.'],
      cloud: ['Flew into the storm.', 'Turbulence. Very unfair.', 'Should have climbed.'],
      emoluments: ['Blocked by the Emoluments Clause.', 'Foreign gifts need the consent of Congress. Sad!', 'Article I, Section 9. Who knew?'],
      ethics: ['The ethics office had questions.', 'Grounded by ethics.', 'Paperwork: 1, jet: 0.'],
      monument: ['Hit the Monument.', 'Too low over the Mall.'],
      mast: ['Hit a mast.', 'That ship was not ours.'],
      mine: ['Hit the flak.', 'Somebody objected.', 'Intercepted.'],
      water: ['Fell in the Gulf.', 'Splash. No jet.'],
      plain: ['Blocked!'],
    },
    complete: {
      title: 'QATARI JET: ACCEPTED (FOR THE LIBRARY)',
      quote: '"A free jet. Very beautiful. Only a stupid person would say no. Tremendous gift."',
      statLabel: 'Jets accepted',
    },

    build(api) {
      const { S, OVER, P, DROP, COIN, CEIL, GJ, FLY, HOLD, GATE, FLYCOIN, FLYMINE, SIGN, SCENE, GOAL } = api;
      // ================= INTRO (bars 0-3): Doha waterfront =================
      SCENE(1.3, 'doha');
      SIGN(3, 'DOHA', 'gift shop ahead');
      S(8); S(11); COIN(11.4, 130); S(14);
      // ================= VERSE (bars 4-11): the souq, up and down =================
      S(16); S(18, 2);
      OVER(20, 'gift', '$400M GIFT');
      S(22);
      // stairs: two platforms to climb, a gift on top, then a drop back to the street
      SIGN(23.4, 'SOUQ WAQIF', 'up the stairs');
      P(24, 4, 1, 'sand'); P(25, 4, 2, 'sand', 'SOUQ'); COIN(26.2, 60);
      DROP();
      S(28); S(29, 2);
      // pits: four gaps in a row, one jump each, no pause
      SIGN(30.4, 'CONTINUOUS JUMPING', 'do not stop');
      GJ(32, 90); GJ(33, 90); GJ(34, 90); GJ(35, 90); COIN(33.4, 130); COIN(35.4, 130);
      S(37); S(38, 2);
      // a low ceiling right before the spike: jump early and you hit it
      SIGN(38.6, 'LOW CEILING', 'no jumping until the spike');
      CEIL(39.2, 3, 2.6, 'sand'); S(40);
      S(42);
      OVER(44, 'gift', 'ANOTHER GIFT');
      S(46); S(47);
      // ================= BUILD (bars 12-15): the Amiri Diwan =================
      SIGN(47.6, 'AMIRI DIWAN', 'the gift ceremony');
      SCENE(52, 'palace');
      P(48, 3, 1, 'carpet'); P(49, 3, 2, 'carpet'); P(50, 4, 3, 'carpet', 'RED CARPET'); COIN(50.9, 60);
      DROP();
      S(53); S(54, 2);
      CEIL(55.2, 3, 2.6, 'sand'); S(56);
      P(58, 5, 2, 'sand', 'HANGAR'); S(59);
      DROP();
      S(61);
      SIGN(62.3, 'BOARDING', 'hold = climb  ·  release = dive');
      // ================= FLIGHT (bars 16-39): hold to climb, release to sink =================
      // Every HOLD is a press cue at its start and a release cue at its end. Gates are cut around the
      // path at the turning points of each arc (0.3 beat after a press or a release), where the jet
      // is level; skins and gaps follow the section.
      FLY(64, 175); // runs past the goal so the zone's end marker stays off screen during the ending
      const H = [
        // bars 16-19: over Doha
        [64, 65.5], [68, 69], [70.5, 71], [72, 73.5], [76, 77], [78, 78.5],
        // bars 20-23: the towers of West Bay
        [80, 81], [83, 84.5], [86.5, 87], [88, 89.5], [92, 93], [94, 95],
        // bars 24-27: the Atlantic
        [96, 97.5], [100, 101], [103, 104.5], [107.5, 108.5], [110, 111],
        // bars 28-35: the storm
        [112, 113], [115, 116.5], [118.5, 119], [120, 121], [122, 122.5], [124, 125.5], [127, 127.5], [128.5, 129],
        [131, 132], [134, 135.5], [137.5, 138], [139, 140.5], [142, 143],
        // bars 36-39: the approach to DC, then sink to the runway
        [144, 145.5], [148, 149], [150.5, 151], [152, 153.5],
      ];
      for (const [a, b] of H) HOLD(a, b);
      const gateAt = (beat, i) => {
        if (beat < 66 || beat > 155) return;
        if (beat < 96) GATE(beat, 58, i % 3 === 2 ? 'minaret' : 'tower', 'cloud');
        else if (beat < 112) GATE(beat, 68, 'mast', 'cloud');
        else if (beat < 144) GATE(beat, 54, 'ethics', i % 2 ? 'cloud' : 'emoluments');
        else GATE(beat, 58, 'monument', 'cloud');
      };
      let lastG = -10, gi = 0;
      for (const [a, b] of H) {
        if (a + 0.3 - lastG >= 0.8) { gateAt(a + 0.3, gi++); lastG = a + 0.3; }
        if (b + 0.3 - lastG >= 0.8) { gateAt(b + 0.3, gi++); lastG = b + 0.3; }
      }
      // pickups along the path, flak beside it where it is level
      for (const b of [67, 73.4, 84.4, 94.4, 97.4, 99, 101.6, 104.4, 106.4, 109.1, 111.6, 122.4, 130.9, 140.4, 149.2, 153.6]) FLYCOIN(b);
      FLYMINE(91, 75, 'flak'); FLYMINE(126.9, -75, 'flak'); FLYMINE(135.4, 75, 'flak');
      SIGN(80.3, 'WEST BAY', 'mind the towers');
      SIGN(96.3, 'THE ATLANTIC', 'long way to DC');
      SCENE(100, 'atlantic'); SCENE(108, 'atlantic');
      SIGN(112.4, 'THE STORM', 'Congress has questions');
      SIGN(144.4, 'WASHINGTON, D.C.', 'final approach');
      SCENE(150, 'dc');
      SIGN(156.4, 'JOINT BASE ANDREWS', 'runway 01L');
      GOAL(158.5);
    },

    music: {
      // Hijaz on D with a darbuka maqsum (doum on 1 and the and-of-2, tek on 2 and 4). The run gets a
      // ney-like theremin melody; flight gets a four-on-the-floor pulse under a bright lead, arps in the
      // storm, bells over the Atlantic. Cues: hold/press = accent + clap, release = zap.
      step(A, i) {
        const { t, bar, sib, bib, sub, beat, sec, on8, isJump, isRelease, STEP, BEAT } = i;
        const ci = bar % 4, chord = CHORDS[ci];
        const flight = sec === 'drop' || sec === 'break' || sec === 'drop2' || sec === 'finale';
        const full = sec === 'drop' || sec === 'drop2' || sec === 'finale';
        const active = !(sec === 'intro' && bar < 2);
        if (active) {
          if (sib === 0 || sib === 8 || ((sec === 'verse' || sec === 'build') && sib === 10)) A.tom(t, 150, sib === 0 ? 0.9 : 0.7);
          if (sib === 2 || sib === 6 || sib === 12) A.tom(t, 330, 0.5);
          if (sib === 14 && (sec === 'verse' || sec === 'build')) A.tom(t, 330, 0.35);
          if (on8) A.hat(t, false, sub === 2 ? 0.22 : 0.32);
          if (full && (sub === 1 || sub === 3)) A.hat(t, false, 0.14);
        }
        if (full && sub === 0) A.kick(t, 0.9);
        if (full && sub === 0 && (bib === 1 || bib === 3)) { A.snare(t, 0.7); A.clap(t, 0.3); }
        if (sec === 'build') {
          const bi = bar - 12;
          if (bi === 0 && sib === 0) A.riser(t, BEAT * 16);
          if (bi >= 2 && on8) A.snare(t, 0.3 + (sib / 16) * 0.3 + 0.15 * (bi - 2));
        }
        // bass: a drone on D that steps through the maqam
        if (full) { if (on8) A.bass(t, BASSN[ci] + (sub === 2 ? 12 : 0), STEP * 1.7, sub === 0 ? 0.95 : 0.65); }
        else if (active && (sib === 0 || sib === 6 || sib === 8)) A.bass(t, BASSN[ci], STEP * 4, 0.75);
        else if (bar >= 1 && sub === 0) A.bass(t, 38, STEP * 3.5, 0.55);
        if (sib === 0) A.padChord(t, chord.map((n) => n + 12), BEAT * 4, flight ? 0.1 : 0.13);
        // melody
        if (sec === 'verse' || sec === 'build') { const mi = [0, 3, 6, 8, 11, 14].indexOf(sib); if (mi >= 0) A.theremin(t, HOOK[ci][mi], STEP * 2.6, 0.42); }
        if (sec === 'intro' && bar >= 1 && sub === 0) A.theremin(t, HOOK[ci][bib * 2], STEP * 3.5, 0.32);
        if (full && on8) A.lead(t, HOOK[ci][sib >> 1] + (sec === 'drop2' ? 12 : 0), STEP * 1.7, 0.45, true);
        if (sec === 'drop2') A.lead(t, [chord[0] + 12, chord[1] + 12, chord[2] + 12, chord[0] + 24][ARP[sib]], STEP * 0.9, 0.16, true);
        if (sec === 'break' && (sib === 0 || sib === 6 || sib === 10)) A.bell(t, HOOK[ci][[0, 2, 4][[0, 6, 10].indexOf(sib)]], STEP * 5, 0.45);
        // THE CUES
        if (isJump) {
          A.accent(t, chord[Math.round(beat * 2) % 3] + 24, 0.55);
          A.clap(t, 0.55);
        }
        if (isRelease) A.zap(t, 0.4);
      },
    },
  };

  (root.TD_LEVELS = root.TD_LEVELS || []).push(def);
})(typeof window !== 'undefined' ? window : globalThis);
