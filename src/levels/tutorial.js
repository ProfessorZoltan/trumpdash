// Level - HOW TO PLAY: an optional walk through the moves, opened from the HOW TO PLAY button on the
// menu rather than a card (hidden: true keeps it out of the numbered list). One mechanic per section,
// a callout before each, and every hazard carries a death message that says what to do differently.
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

  const def = {
    id: 'tutorial',
    name: 'HOW TO PLAY',
    tagline: 'The moves, one at a time',
    difficulty: 'TUTORIAL',
    hidden: true,
    bpm: 104,
    backdrop: 'city',
    collectible: { label: 'gold stars', icon: 'coin' },
    ending: { type: 'ready', camOffset: 340 },
    sections: [
      { name: 'intro', bar: 0 }, { name: 'jump', bar: 2 }, { name: 'orb', bar: 9 }, { name: 'pad', bar: 13 },
      { name: 'flip', bar: 17 }, { name: 'mix', bar: 23 }, { name: 'finale', bar: 29 },
    ],
    palettes: {
      intro:  { top: '#4aa3e8', bot: '#bfe3ff', ground: '#3f8f3a', gline: '#9be86f', accent: '#ffd400', spike: '#ffffff', style: 'grass' },
      jump:   { top: '#3d95e0', bot: '#b8e0ff', ground: '#3f8f3a', gline: '#9be86f', accent: '#ffd400', spike: '#ffffff', style: 'grass' },
      orb:    { top: '#2f7fd0', bot: '#a9d6ff', ground: '#3a8536', gline: '#9be86f', accent: '#ffd400', spike: '#ffffff', style: 'grass' },
      pad:    { top: '#3a6fc0', bot: '#b9c9ff', ground: '#3a8536', gline: '#9be86f', accent: '#ffd400', spike: '#ffffff', style: 'grass' },
      flip:   { top: '#1e3a7a', bot: '#7a8fd0', ground: '#2f6e2c', gline: '#8fe0ff', accent: '#4fc3ff', spike: '#ffffff', style: 'grass' },
      mix:    { top: '#2c5aa8', bot: '#9fc3ff', ground: '#3a8536', gline: '#9be86f', accent: '#ffd400', spike: '#ffffff', style: 'grass' },
      finale: { top: '#5a3a8a', bot: '#ffb37a', ground: '#3f8f3a', gline: '#ffd27f', accent: '#ffd400', spike: '#ffffff', style: 'grass' },
    },
    deathMsgs: {
      tut_jump: ['Tap when you hear the chime.', 'A touch earlier: the jump peaks over the spike.', 'Space, click or tap the screen. On the chime.'],
      tut_hold: ['Hold the button down: it keeps jumping for you.', 'No need to tap each one. Just hold.'],
      tut_orb: ['Tap again in mid-air, right at the orb.', 'Two taps: one to jump, one at the orb.', 'The orb is a second jump. Tap while touching it.'],
      tut_wall: ['Let the pad do the work: no tap on it.', 'Run onto the pad. It throws you over.'],
      flipwall: ['Take the FLIP-FLOP portal: jump into it.', 'The portal is the only way past that wall.'],
      spike: ['Same rule upside down: tap on the chime.', 'Sad! Try again.'],
      sky: ['Fell into the sky.'],
      plain: ['Blocked!'],
    },
    complete: {
      title: 'YOU ARE READY',
      quote: '"Nobody learns faster than me. Many people are saying it."',
      statLabel: 'Moves mastered',
    },

    build(api) {
      const { S, spikeRaw, blockRaw, slabRaw, O, PAD, COIN, FLIP, TIP, SCENE, GOAL, bx, B, CY } = api;
      // Lessons are TIP callouts: they appear as the player reaches them and hold still in the sky
      // ================= INTRO (bars 0-1): the lawn =================
      SCENE(1.2, 'whitehouse');
      TIP(1.5, 'HOW TO PLAY', 'A short walk through the moves', 3);
      TIP(5.5, 'LISTEN FOR THE CHIME', 'Every jump lands on that bright note');
      // ================= JUMP (bars 2-8): one tap per spike, then hold =================
      TIP(9, 'TAP TO JUMP', 'Space, click, or tap the screen. Tap on the chime.', 4);
      S(12, 1, 'tut_jump'); S(16, 1, 'tut_jump'); S(20, 1, 'tut_jump'); COIN(20.4, 130);
      S(22, 1, 'tut_jump'); S(24, 1, 'tut_jump'); S(26, 1, 'tut_jump'); S(28, 1, 'tut_jump');
      TIP(29, 'HOLD TO KEEP JUMPING', 'One press covers a whole run of spikes', 4);
      S(32, 1, 'tut_hold'); S(33, 1, 'tut_hold'); S(34, 1, 'tut_hold'); S(35, 1, 'tut_hold'); S(36, 1, 'tut_hold');
      // ================= ORB (bars 9-12): the double jump =================
      TIP(37, 'DOUBLE JUMP', 'Jump, then tap again while you touch the orb', 4);
      S(40); O(40.5, 120, 'TAP'); spikeRaw(40.74, 4, 0, false, 'tut_orb');
      COIN(44, 24);
      S(46); O(46.5, 120, 'TAP'); spikeRaw(46.74, 4, 0, false, 'tut_orb');
      TIP(49, 'ONE MORE', 'Tap on the chime, then tap on the orb', 3);
      S(52); O(52.5, 120, 'TAP'); spikeRaw(52.74, 4, 0, false, 'tut_orb');
      // ================= PAD (bars 13-16): launch pads =================
      TIP(55, 'LAUNCH PAD', 'No tap needed: it throws you over the wall', 4);
      PAD(58, 'EXECUTIVE ORDER'); blockRaw(bx(58) + 75, 1, 3, 0, 'tut_wall', 'WALL');
      COIN(58.5, 170);
      PAD(64, 'EXECUTIVE ORDER'); blockRaw(bx(64) + 75, 1, 3, 0, 'tut_wall', 'WALL');
      // ================= FLIP (bars 17-22): gravity portals, walled so the portal is the only way =================
      TIP(68, 'FLIP-FLOP PORTAL', 'Jump into it and gravity flips. Same rules upside down.', 4.5);
      FLIP(72, 'FLIP-FLOP');
      blockRaw(bx(73.3) - B / 2, 1, 5, 0, 'flipwall');
      S(76); S(78); COIN(78.4, 130); S(80); S(82);
      FLIP(84, 'FLIP-FLOP');
      slabRaw(bx(85.3) - B / 2, 1, CY, CY + 5 * B, 'flipwall');
      S(88); S(90);
      // ================= MIX (bars 23-28): everything once more =================
      TIP(92, 'PRACTICE MODE', 'Press P, or the PRACTICE chip: checkpoints every few bars', 4);
      S(96, 1, 'tut_jump'); S(98, 1, 'tut_jump');
      S(100); O(100.5, 120, 'TAP'); spikeRaw(100.74, 4, 0, false, 'tut_orb');
      PAD(104, 'EXECUTIVE ORDER'); blockRaw(bx(104) + 75, 1, 3, 0, 'tut_wall', 'WALL');
      S(108, 1, 'tut_hold'); S(109, 1, 'tut_hold'); S(110, 1, 'tut_hold'); COIN(110.4, 130); S(112, 1, 'tut_jump');
      TIP(113, 'TAPS FEEL LATE?', 'Use SYNC on the menu once, with your own headphones', 3.5);
      // ================= FINALE (bars 29-30) =================
      S(116, 1, 'tut_jump'); S(118, 1, 'tut_jump');
      TIP(120, "THAT'S ALL", 'Now go pick a level', 3);
      GOAL(124);
    },

    music: {
      step(A, i) {
        const { t, bar, sib, bib, sub, beat, sec, on8, isJump, STEP, BEAT } = i;
        const ci = bar % 4, chord = CHORDS[ci];
        const drums = !(sec === 'intro' && bar === 0);
        const busy = sec === 'orb' || sec === 'mix' || sec === 'finale';
        if (sub === 0 && drums) {
          if (bib === 0 || bib === 2 || busy) A.kick(t, 0.8);
          if ((bib === 1 || bib === 3) && busy) A.snare(t, 0.28); // a snare on the backbeat; the jump cue (chime + clap) stays distinct
        }
        if (on8 && drums) A.hat(t, false, sub === 2 ? 0.22 : 0.32);
        if (on8 && drums) A.bass(t, BASSN[ci] + (sub === 2 ? 12 : 0), STEP * 1.8, sub === 0 ? 0.7 : 0.45);
        if (sib === 0) A.padChord(t, chord.map((n) => n + 12), BEAT * 4, sec === 'flip' ? 0.14 : 0.1);
        if (on8 && (sec === 'jump' || busy)) A.bell(t, HOOK[ci][sib >> 1], STEP * 2.5, 0.42);
        if (sec === 'flip' && on8) A.lead(t, chord[(sib >> 1) % 3] + 12, STEP * 0.9, 0.14, true);
        // THE JUMP CUE
        if (isJump) {
          A.accent(t, chord[Math.round(beat * 2) % 3] + 24, 0.55);
          A.clap(t, 0.6);
        }
      },
    },
  };

  (root.TD_LEVELS = root.TD_LEVELS || []).push(def);
})(typeof window !== 'undefined' ? window : globalThis);
