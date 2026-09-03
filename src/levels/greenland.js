// Level - GREENLAND: "NOT FOR SALE". The easy on-ramp, and the level that introduces the
// FLIP-FLOP gravity portals: two sections are run upside down along the underside of the ice.
(function (root) {
  // C major: C | G | Am | F (one chord per bar)
  const CHORDS = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]];
  const BASSN = [36, 31, 33, 29];
  const HOOK = [
    [72, 76, 79, 76, 72, 67, 64, 67],
    [71, 74, 79, 74, 71, 67, 62, 67],
    [72, 76, 81, 76, 72, 69, 64, 69],
    [72, 77, 81, 77, 72, 69, 65, 69],
  ];
  const ARP = [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 3];

  const def = {
    id: 'greenland',
    name: 'GREENLAND',
    tagline: 'Not for sale (allegedly)',
    difficulty: 'NORMAL',
    bpm: 112,
    backdrop: 'arctic',
    collectible: { label: 'kroner', icon: 'coin' },
    ending: { type: 'map', camOffset: 340 },
    sections: [
      { name: 'intro', bar: 0 }, { name: 'verse', bar: 4 }, { name: 'build', bar: 12 }, { name: 'drop', bar: 16 },
      { name: 'break', bar: 22 }, { name: 'drop2', bar: 26 }, { name: 'finale', bar: 32 },
    ],
    palettes: {
      intro:  { top: '#0b1a3a', bot: '#3a6fa8', ground: '#dfeeff', gline: '#ffffff', accent: '#4fc3ff', spike: '#ffffff', style: 'snow' },
      verse:  { top: '#10224a', bot: '#4a8ac8', ground: '#d6e9fb', gline: '#ffffff', accent: '#4fc3ff', spike: '#ffffff', style: 'snow' },
      build:  { top: '#1a1a4a', bot: '#7a5aa8', ground: '#cfe3f7', gline: '#ffffff', accent: '#ff4fa3', spike: '#ffffff', style: 'ice' },
      drop:   { top: '#051633', bot: '#0f6d8c', ground: '#c8e6ff', gline: '#8fe0ff', accent: '#4fc3ff', spike: '#ffffff', style: 'ice' },
      break:  { top: '#2a1a4a', bot: '#ff9f6e', ground: '#e6f0ff', gline: '#ffffff', accent: '#ffd400', spike: '#ffffff', style: 'snow' },
      drop2:  { top: '#07102a', bot: '#1f8f7a', ground: '#c8e6ff', gline: '#8fe0ff', accent: '#7dffb0', spike: '#ffffff', style: 'ice' },
      finale: { top: '#2a1040', bot: '#ffb0a0', ground: '#f0f6ff', gline: '#ffffff', accent: '#ffd400', spike: '#ffffff', style: 'snow' },
    },
    deathMsgs: {
      spike: ['Sad!', 'Iced.', 'Cold, cold deal.', 'Fake jump!', 'Denmark laughed.', 'Off the beat, into the snow.'],
      bear: ['Eaten by a polar bear.', 'The bear was not for sale either.', 'Nanoq says no.'],
      sale: ['NOT. FOR. SALE.', 'The sign was very clear.'],
      folketing: ['The Folketing said nej.', 'Denmark has a parliament. Who knew.'],
      inatsisartut: ['Greenland has a parliament too.', 'Inatsisartut objected.'],
      nej: ['Nej means no.', 'A very Danish wall.'],
      ice: ['Slipped on the iceberg.', 'Ice, ice, baby.'],
      water: ['Fell in the fjord.', 'That water is 2°C.', 'Man overboard, Arctic edition.'],
      sky: ['Fell into the sky.', 'Gravity is a hoax, apparently.'],
      plain: ['Blocked!'],
    },
    complete: {
      title: 'GREENLAND: SOLD (TO NOBODY, BY NOBODY)',
      quote: '"I have relocated the island. It is now next to Florida. Tremendous."',
      statLabel: 'Islands relocated',
    },

    build(api) {
      const { S, spikeRaw, blockRaw, OVER, P, DROP, O, PAD, COIN, GJ, FLIP, SIGN, SCENE, GOAL, bx } = api;
      // ================= INTRO (bars 0-3): Nuuk =================
      SCENE(1.0, 'nuuk');
      SIGN(2.6, 'NUUK, GREENLAND', 'not for sale');
      S(8); S(12); COIN(12.4, 130);
      // ================= VERSE (bars 4-11): across the ice =================
      S(16); S(18); S(20); S(22);
      S(24, 1, 'bear'); S(26); S(28);
      OVER(30, 'sale', 'NOT FOR SALE');
      S(32); S(34); S(36, 1, 'bear'); S(38); COIN(38.4, 130);
      S(40); S(41); S(43); S(44); S(46);
      // ================= BUILD (bars 12-15): the Folketing =================
      SIGN(47.6, 'FOLKETING', 'Danish parliament');
      SCENE(50.5, 'folketing');
      P(48, 3, 1, 'folketing', 'FOLKETING');
      P(49, 3, 1, 'folketing');
      P(50, 3, 2, 'folketing');
      P(52, 3, 1, 'folketing');
      DROP();
      COIN(52.9, 90);
      S(54); S(56); S(58); S(60); S(62); S(63);
      // ================= DROP (bars 16-21): purchase offer, then the world flips =================
      PAD(64, 'PURCHASE OFFER');
      blockRaw(bx(64) + 75, 1, 3, 0, 'nej', 'NEJ');
      SIGN(65.4, 'FLIP-FLOP AHEAD', 'the map turns over');
      FLIP(66, 'FLIP-FLOP');
      S(68); S(70); S(72); COIN(72.4, 130); S(74); S(76);
      O(76.5, 120, 'DEAL'); spikeRaw(76.74, 4, 0, true);
      S(78); S(80);
      OVER(82, 'inatsisartut', 'INATSISARTUT');
      S(84);
      FLIP(86, 'FLIP-FLOP');
      // ================= BREAKDOWN (bars 22-25): iceberg alley =================
      SIGN(88.3, 'ICEBERG ALLEY', 'mind the fjord');
      SCENE(91, 'icebergs');
      S(89); COIN(89.4, 130); GJ(91); S(93); GJ(95); S(97); COIN(97.4, 130);
      P(99, 3, 1, 'ice');
      P(100, 3, 2, 'ice');
      P(101, 3, 3, 'ice', 'ICEBERG');
      COIN(101.95, 60);
      DROP();
      // ================= DROP 2 (bars 26-31): upside down again =================
      S(104);
      FLIP(106, 'FLIP-FLOP');
      S(108); S(110); S(111); S(113); S(114);
      PAD(116, 'EXECUTIVE ORDER');
      api.slabRaw(bx(116) + 75, 1, api.CY, api.CY + 120, 'nej', 'NEJ');
      S(118); O(118.5, 120, 'DEAL'); spikeRaw(118.74, 4, 0, true);
      S(120); S(121); S(122);
      FLIP(124, 'FLIP-FLOP');
      // ================= FINALE (bars 32-37): the big map =================
      SIGN(126.5, 'GREENLAND', '2.1 million km²');
      S(128); S(130, 1, 'bear'); S(132); S(133); S(134); S(136); COIN(136.4, 130);
      S(138); S(140); GJ(142); S(144); S(146); COIN(146.4, 130); S(148);
      GOAL(151);
    },

    music: {
      step(A, i) {
        const { t, bar, sib, bib, sub, beat, sec, on8, isJump, STEP, BEAT } = i;
        const ci = bar % 4, chord = CHORDS[ci];
        const full = sec === 'drop' || sec === 'drop2' || sec === 'finale';
        // drums: soft house
        if (sub === 0) {
          if (full || sec === 'build') A.kick(t, 0.9);
          else if ((sec === 'intro' && bar >= 2) || sec === 'verse' || sec === 'break') { if (bib === 0 || bib === 2) A.kick(t, 0.8); }
          if ((full || sec === 'verse') && (bib === 1 || bib === 3)) A.clap(t, 0.5);
        }
        if (sec === 'build') {
          const bi = bar - 12;
          if (bi < 2) { if (on8) A.snare(t, 0.35 + 0.1 * bi); }
          else A.snare(t, 0.3 + (sib / 16) * 0.3 + 0.12 * (bi - 2));
          if (bi === 0 && sib === 0) A.riser(t, BEAT * 16);
        }
        if (!(sec === 'intro' && bar === 0)) {
          if (on8) A.hat(t, false, sub === 2 ? 0.25 : 0.38);
          if (full && sub === 2) A.hat(t, true, 0.22);
        }
        // bass
        if (sec === 'verse' || sec === 'break') { if (on8) A.bass(t, BASSN[ci] + (sub === 2 ? 12 : 0), STEP * 1.8, sub === 0 ? 0.8 : 0.5); }
        else if (full) { if (on8) A.bass(t, BASSN[ci] + (sub === 2 ? 12 : 0), STEP * 1.6, sub === 0 ? 0.9 : 0.6); }
        else if (sec === 'build') { if (on8) A.bass(t, BASSN[ci], STEP * 1.8, 0.7); }
        else if (sec === 'intro' && bar >= 1 && sub === 0) A.bass(t, BASSN[ci], STEP * 3.5, 0.6);
        // pads everywhere but the drops
        if (sib === 0 && !full) A.padChord(t, chord.map((n) => n + 12), BEAT * 4, sec === 'break' ? 0.14 : 0.1);
        if (sib === 0 && full) A.padChord(t, chord.map((n) => n + 12), BEAT * 4, 0.07);
        // bells carry the melody
        if ((sec === 'verse' || sec === 'finale') && on8) A.bell(t, HOOK[ci][sib >> 1], STEP * 2.5, 0.5);
        if (sec === 'drop' || sec === 'drop2') {
          const tones = [chord[0] + 12, chord[1] + 12, chord[2] + 12, chord[0] + 24];
          A.lead(t, tones[ARP[sib]], STEP * 0.9, 0.16, true);
          if (on8) A.bell(t, HOOK[ci][sib >> 1] + (sec === 'drop2' ? 12 : 0), STEP * 2, 0.55);
        }
        if (sec === 'break' && (sib === 0 || sib === 6 || sib === 10 || sib === 14)) A.bell(t, HOOK[ci][[0, 2, 4, 6][[0, 6, 10, 14].indexOf(sib)]], STEP * 5, 0.5);
        if (sec === 'intro' && bar >= 1 && sub === 0) A.bell(t, HOOK[ci][bib * 2], STEP * 3, 0.4);
        // THE JUMP CUE
        if (isJump) {
          A.accent(t, chord[Math.round(beat * 2) % 3] + 24, 0.5);
          A.clap(t, 0.5);
        }
      },
    },
  };

  (root.TD_LEVELS = root.TD_LEVELS || []).push(def);
})(typeof window !== 'undefined' ? window : globalThis);
