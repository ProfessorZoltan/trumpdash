// Trump Dash - procedural music + sound effects (Web Audio API).
// The song is generated on a 16th-note grid locked to TD_CONST.BPM. Every beat where the
// level requires a jump gets an "accent" (bright pluck + clap) so the music itself cues the jump.
(function (root) {
  const C = root.TD_CONST;
  const LV = root.TD_LEVEL;
  const STEP = C.BEAT_SEC / 4;
  const mtof = (n) => 440 * Math.pow(2, (n - 69) / 12);

  // A minor progression: Am | F | C | G  (one chord per bar)
  const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
  const BASSN = [45, 41, 36, 43];
  const HOOK = [
    [76, 81, 84, 81, 76, 72, 69, 71],
    [72, 77, 81, 77, 72, 69, 65, 67],
    [76, 79, 84, 79, 76, 72, 67, 69],
    [74, 79, 83, 79, 74, 71, 67, 69],
  ];
  const ARP = [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 3];

  class Engine {
    constructor() {
      this.ctx = null;
      this.muted = false;
      this.vol = 0.8;
      this.timer = null;
      this.playing = false;
      this.songStart = 0;
      this.nextStep = 0;
      this.jumpSet = new Set();
      this.engineNodes = null;
    }

    init() {
      if (this.ctx) return true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      const ctx = (this.ctx = new AC());
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.vol;
      this.comp = ctx.createDynamicsCompressor();
      this.comp.threshold.value = -14;
      this.comp.knee.value = 18;
      this.comp.ratio.value = 5;
      this.comp.attack.value = 0.004;
      this.comp.release.value = 0.18;
      this.master.connect(this.comp);
      this.comp.connect(ctx.destination);

      this.musicBus = ctx.createGain();
      this.musicBus.connect(this.master);
      this.duckBus = ctx.createGain(); // side-chained by the kick
      this.duckBus.connect(this.musicBus);
      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = 0.9;
      this.sfxBus.connect(this.master);

      // dotted-8th delay for the lead
      this.delaySend = ctx.createGain();
      this.delaySend.gain.value = 0.35;
      this.delay = ctx.createDelay(2);
      this.delay.delayTime.value = STEP * 3;
      this.delayFb = ctx.createGain();
      this.delayFb.gain.value = 0.36;
      this.delayFilt = ctx.createBiquadFilter();
      this.delayFilt.type = 'lowpass';
      this.delayFilt.frequency.value = 2600;
      this.delaySend.connect(this.delay);
      this.delay.connect(this.delayFilt);
      this.delayFilt.connect(this.delayFb);
      this.delayFb.connect(this.delay);
      this.delayFilt.connect(this.duckBus);

      const len = ctx.sampleRate;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
      return true;
    }

    resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
    clock() { return this.ctx ? this.ctx.currentTime : performance.now() / 1000; }
    setMuted(m) {
      this.muted = m;
      if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : this.vol, this.ctx.currentTime, 0.02);
    }

    // ---------- instruments ----------
    osc(type, freq, t, dur, dest, gainEnv) {
      const ctx = this.ctx;
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      const g = ctx.createGain();
      gainEnv(g.gain);
      o.connect(g);
      g.connect(dest);
      o.start(t);
      o.stop(t + dur + 0.05);
      return o;
    }
    noise(t, dur, type, freq, q, dest) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      src.playbackRate.value = 1;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      src.connect(f);
      f.connect(g);
      g.connect(dest);
      src.start(t);
      src.stop(t + dur + 0.05);
      return g;
    }
    kick(t, v) {
      const ctx = this.ctx;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(175, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.09);
      const g = ctx.createGain();
      g.gain.setValueAtTime(v, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      o.connect(g);
      g.connect(this.musicBus);
      o.start(t);
      o.stop(t + 0.35);
      const n = this.noise(t, 0.03, 'highpass', 2500, 0.7, this.musicBus);
      n.gain.setValueAtTime(0.3 * v, t);
      n.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
      const dg = this.duckBus.gain;
      dg.cancelScheduledValues(t);
      dg.setValueAtTime(0.42, t);
      dg.linearRampToValueAtTime(1, t + 0.2);
    }
    snare(t, v) {
      const n = this.noise(t, 0.2, 'bandpass', 1900, 0.7, this.musicBus);
      n.gain.setValueAtTime(v * 0.8, t);
      n.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      this.osc('triangle', 210, t, 0.1, this.musicBus, (g) => {
        g.setValueAtTime(v * 0.5, t);
        g.exponentialRampToValueAtTime(0.001, t + 0.09);
      });
    }
    clap(t, v) {
      for (let i = 0; i < 3; i++) {
        const tt = t + i * 0.011;
        const n = this.noise(tt, 0.16, 'bandpass', 1300, 1.1, this.musicBus);
        n.gain.setValueAtTime(v * 0.45, tt);
        n.gain.exponentialRampToValueAtTime(0.001, tt + (i === 2 ? 0.14 : 0.025));
      }
    }
    hat(t, open, v) {
      const n = this.noise(t, open ? 0.3 : 0.06, 'highpass', 8200, 0.8, this.musicBus);
      n.gain.setValueAtTime(v, t);
      n.gain.exponentialRampToValueAtTime(0.001, t + (open ? 0.26 : 0.045));
    }
    bass(t, midi, dur, v) {
      const ctx = this.ctx;
      const f = mtof(midi);
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.setValueAtTime(1100, t);
      filt.frequency.exponentialRampToValueAtTime(240, t + dur);
      filt.Q.value = 2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v * 0.5, t + 0.008);
      g.gain.setValueAtTime(v * 0.5, t + dur * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      filt.connect(g);
      g.connect(this.duckBus);
      const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = f;
      const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = f / 2;
      const g2 = ctx.createGain(); g2.gain.value = 0.45;
      o1.connect(filt); o2.connect(g2); g2.connect(filt);
      o1.start(t); o2.start(t); o1.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
    }
    lead(t, midi, dur, v, bright) {
      const ctx = this.ctx;
      const f = mtof(midi);
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.setValueAtTime(bright ? 5200 : 2600, t);
      filt.frequency.exponentialRampToValueAtTime(bright ? 1600 : 1100, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v * 0.26, t + 0.012);
      g.gain.setValueAtTime(v * 0.26, t + dur * 0.55);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      filt.connect(g);
      g.connect(this.duckBus);
      g.connect(this.delaySend);
      const mk = (type, freq, det, vol) => {
        const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = det;
        const gg = ctx.createGain(); gg.gain.value = vol; o.connect(gg); gg.connect(filt);
        o.start(t); o.stop(t + dur + 0.05);
      };
      mk('sawtooth', f, -8, 0.5); mk('sawtooth', f, 8, 0.5); mk('square', f / 2, 0, 0.22);
    }
    accent(t, midi, v) {
      // the jump cue: a bright pluck, un-ducked, with delay tail
      const ctx = this.ctx;
      const f = mtof(midi);
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.setValueAtTime(7000, t);
      filt.frequency.exponentialRampToValueAtTime(1400, t + 0.28);
      const g = ctx.createGain();
      g.gain.setValueAtTime(v * 0.4, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      filt.connect(g);
      g.connect(this.musicBus);
      g.connect(this.delaySend);
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f;
      const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = f * 2;
      const g2 = ctx.createGain(); g2.gain.value = 0.3;
      o.connect(filt); o2.connect(g2); g2.connect(filt);
      o.start(t); o2.start(t); o.stop(t + 0.35); o2.stop(t + 0.35);
    }
    padChord(t, midis, dur, vol) {
      const ctx = this.ctx;
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 1500;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol || 0.09, t + 0.35);
      g.gain.setValueAtTime(vol || 0.09, t + dur);
      g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.4);
      filt.connect(g);
      g.connect(this.duckBus);
      for (const m of midis) {
        for (const det of [-6, 6]) {
          const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(m); o.detune.value = det;
          o.connect(filt); o.start(t); o.stop(t + dur + 0.5);
        }
      }
    }
    riser(t, dur) {
      const n = this.noise(t, dur, 'bandpass', 400, 1.5, this.musicBus);
      n.gain.setValueAtTime(0.0001, t);
      n.gain.exponentialRampToValueAtTime(0.35, t + dur);
      n.gain.setValueAtTime(0.0001, t + dur + 0.01);
    }

    // ---------- song ----------
    scheduleStep(step, t) {
      const bar = Math.floor(step / 16), sib = step % 16, bib = sib >> 2, sub = sib & 3;
      const beat = step / 4;
      const sec = LV.sectionAt(beat).name;
      const ci = bar % 4;
      const chord = CHORDS[ci];
      const on8 = sub === 0 || sub === 2;
      const full = sec === 'verse' || sec === 'drop' || sec === 'drop2' || sec === 'finale';
      const isJump = this.jumpSet.has(beat);

      // drums
      if (sub === 0) {
        if (full) this.kick(t, 1);
        else if (sec === 'intro' && bar >= 2 && (bib === 0 || bib === 2)) this.kick(t, 0.8);
        else if (sec === 'break' && (bib === 0 || bib === 2)) this.kick(t, 0.75);
        else if (sec === 'build') this.kick(t, 1);
        if (full && (bib === 1 || bib === 3)) this.snare(t, 0.85);
      }
      if (sec === 'build') {
        const bi = bar - 12;
        if (bi < 2) { if (on8) this.snare(t, 0.45 + 0.12 * bi); }
        else this.snare(t, 0.4 + (sib / 16) * 0.35 + 0.15 * (bi - 2));
        if (bi === 0 && sib === 0) this.riser(t, C.BEAT_SEC * 16);
      }
      if (!(sec === 'intro' && bar === 0)) {
        if (on8) this.hat(t, false, sub === 2 ? 0.32 : 0.45);
        if ((sec === 'drop' || sec === 'drop2' || sec === 'finale') && sub === 2) this.hat(t, true, 0.3);
        if ((sec === 'drop' || sec === 'drop2') && (sub === 1 || sub === 3)) this.hat(t, false, 0.16);
      }
      // bass
      if (sec === 'verse' || sec === 'break') { if (on8) this.bass(t, BASSN[ci] + (sub === 2 ? 12 : 0), STEP * 1.8, sub === 0 ? 0.9 : 0.6); }
      else if (sec === 'drop' || sec === 'drop2' || sec === 'finale') this.bass(t, BASSN[ci] + (sub % 2 ? 12 : 0), STEP * 0.95, sub === 0 ? 1 : 0.7);
      else if (sec === 'build') { if (on8) this.bass(t, BASSN[ci], STEP * 1.8, 0.8); }
      else if (sec === 'intro' && bar >= 2 && sub === 0) this.bass(t, BASSN[ci], STEP * 3.5, 0.7);
      // pads
      if (sib === 0 && (sec === 'intro' || sec === 'break' || sec === 'verse' || sec === 'build')) this.padChord(t, chord.map((n) => n + 12), C.BEAT_SEC * 4, sec === 'break' ? 0.13 : 0.08);
      // lead / melody
      if (sec === 'verse' && on8) this.lead(t, HOOK[ci][sib >> 1], STEP * 1.6, 0.4, false);
      if (sec === 'drop' || sec === 'drop2' || sec === 'finale') {
        const tones = [chord[0] + 12, chord[1] + 12, chord[2] + 12, chord[0] + 24];
        this.lead(t, tones[ARP[sib]] + (sec === 'drop2' ? 12 : 0), STEP * 0.9, 0.2, true);
        if (on8) this.lead(t, HOOK[ci][sib >> 1], STEP * 1.7, 0.5, true);
      }
      if (sec === 'break' && (sib === 0 || sib === 6 || sib === 10 || sib === 14)) this.lead(t, HOOK[ci][[0, 2, 4, 6][[0, 6, 10, 14].indexOf(sib)]], STEP * 4, 0.35, false);
      if (sec === 'intro' && bar >= 1 && sub === 0) this.lead(t, HOOK[ci][bib * 2], STEP * 2.5, 0.22, false);
      // THE JUMP CUE
      if (isJump) {
        const tone = chord[Math.round(beat * 2) % 3] + 24;
        this.accent(t, tone, 0.55);
        this.clap(t, 0.55);
      }
    }

    startSong(fromBeat, lead) {
      this.stopSong(false);
      if (!this.ctx) { this.songStart = this.clock() + lead - fromBeat * C.BEAT_SEC; this.playing = true; return; }
      this.resume();
      const now = this.ctx.currentTime;
      this.songStart = now + lead - fromBeat * C.BEAT_SEC;
      this.nextStep = Math.round(fromBeat * 4);
      this.playing = true;
      this.musicBus.gain.cancelScheduledValues(now);
      this.musicBus.gain.setValueAtTime(1, now);
      this.duckBus.gain.cancelScheduledValues(now);
      this.duckBus.gain.setValueAtTime(1, now);
      this.tick();
      this.timer = setInterval(() => this.tick(), 25);
    }
    tick() {
      const ctx = this.ctx;
      const horizon = ctx.currentTime + 0.14;
      let guard = 0;
      while (this.songStart + this.nextStep * STEP < horizon && guard++ < 64) {
        const t = this.songStart + this.nextStep * STEP;
        if (t >= ctx.currentTime - 0.01 && this.nextStep <= this.endStep) this.scheduleStep(this.nextStep, t);
        this.nextStep++;
      }
    }
    stopSong(fade) {
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      this.playing = false;
      if (this.ctx && fade) {
        const g = this.musicBus.gain, now = this.ctx.currentTime;
        g.cancelScheduledValues(now);
        g.setValueAtTime(g.value, now);
        g.linearRampToValueAtTime(0, now + 0.08);
      }
    }
    songTime() { return this.clock() - this.songStart; }
    setLevel(level) { this.jumpSet = level.jumpSet; this.endStep = Math.ceil(level.endBeat * 4) + 8; }

    // ---------- sound effects ----------
    sfx(fn) { if (!this.ctx) return; try { fn(this.ctx, this.ctx.currentTime); } catch (e) { console.warn('sfx failed', e); } }
    sfxJump() {
      this.sfx((ctx, t) => this.osc('square', 420, t, 0.1, this.sfxBus, (g) => { g.setValueAtTime(0.16, t); g.exponentialRampToValueAtTime(0.001, t + 0.1); })
        .frequency.exponentialRampToValueAtTime(760, t + 0.07));
    }
    sfxOrb() {
      this.sfx((ctx, t) => {
        this.osc('sine', 880, t, 0.25, this.sfxBus, (g) => { g.setValueAtTime(0.22, t); g.exponentialRampToValueAtTime(0.001, t + 0.25); }).frequency.exponentialRampToValueAtTime(1760, t + 0.1);
        this.osc('triangle', 1320, t + 0.03, 0.2, this.sfxBus, (g) => { g.setValueAtTime(0.12, t + 0.03); g.exponentialRampToValueAtTime(0.001, t + 0.22); });
      });
    }
    sfxPad() {
      this.sfx((ctx, t) => {
        this.osc('sawtooth', 180, t, 0.25, this.sfxBus, (g) => { g.setValueAtTime(0.18, t); g.exponentialRampToValueAtTime(0.001, t + 0.25); }).frequency.exponentialRampToValueAtTime(1100, t + 0.2);
        const n = this.noise(t, 0.25, 'bandpass', 900, 1, this.sfxBus); n.gain.setValueAtTime(0.15, t); n.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      });
    }
    sfxBarrel() {
      this.sfx((ctx, t) => {
        this.osc('sine', 1318, t, 0.08, this.sfxBus, (g) => { g.setValueAtTime(0.2, t); g.exponentialRampToValueAtTime(0.001, t + 0.08); });
        this.osc('sine', 1760, t + 0.07, 0.14, this.sfxBus, (g) => { g.setValueAtTime(0.2, t + 0.07); g.exponentialRampToValueAtTime(0.001, t + 0.2); });
      });
    }
    sfxDie() {
      this.sfx((ctx, t) => {
        const n = this.noise(t, 0.4, 'lowpass', 900, 0.7, this.sfxBus); n.gain.setValueAtTime(0.6, t); n.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
        this.osc('sawtooth', 240, t, 0.4, this.sfxBus, (g) => { g.setValueAtTime(0.3, t); g.exponentialRampToValueAtTime(0.001, t + 0.4); }).frequency.exponentialRampToValueAtTime(40, t + 0.38);
      });
    }
    sfxStamp() {
      this.sfx((ctx, t) => {
        this.osc('sine', 120, t, 0.25, this.sfxBus, (g) => { g.setValueAtTime(1, t); g.exponentialRampToValueAtTime(0.001, t + 0.25); }).frequency.exponentialRampToValueAtTime(35, t + 0.18);
        const n = this.noise(t, 0.12, 'lowpass', 600, 0.7, this.sfxBus); n.gain.setValueAtTime(0.7, t); n.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        const c = this.noise(t, 0.02, 'highpass', 3000, 0.7, this.sfxBus); c.gain.setValueAtTime(0.4, t); c.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
      });
    }
    sfxCheckpoint() {
      this.sfx((ctx, t) => this.osc('triangle', 990, t, 0.15, this.sfxBus, (g) => { g.setValueAtTime(0.15, t); g.exponentialRampToValueAtTime(0.001, t + 0.15); }));
    }
    fanfare() {
      this.sfx((ctx, t0) => {
        const seq = [[72, 0, 0.14], [72, 0.15, 0.14], [72, 0.3, 0.14], [79, 0.45, 0.5], [76, 0.95, 0.14], [79, 1.1, 0.14], [84, 1.25, 0.9]];
        for (const [m, dt, dur] of seq) {
          const t = t0 + dt;
          for (const [type, mult, vol] of [['sawtooth', 1, 0.16], ['square', 0.5, 0.08], ['sawtooth', 1.005, 0.12]]) {
            const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 2200; filt.connect(this.sfxBus);
            this.osc(type, mtof(m) * mult, t, dur, filt, (g) => { g.setValueAtTime(0.0001, t); g.linearRampToValueAtTime(vol, t + 0.02); g.setValueAtTime(vol, t + dur * 0.7); g.linearRampToValueAtTime(0.0001, t + dur); });
          }
        }
        this.padChord(t0 + 1.25, [60, 64, 67, 72], 1.6, 0.14);
      });
    }
    endingPad() {
      this.sfx((ctx, t) => {
        this.musicBus.gain.cancelScheduledValues(t); this.musicBus.gain.setValueAtTime(1, t);
        this.duckBus.gain.cancelScheduledValues(t); this.duckBus.gain.setValueAtTime(1, t);
        this.padChord(t, [57, 60, 64, 69], 3.2, 0.12);
        this.padChord(t + 3.3, [53, 57, 60, 65], 3.2, 0.12);
      });
    }
    engineStart() {
      this.sfx((ctx, t) => {
        if (this.engineNodes) return;
        const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 46;
        const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 23;
        const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 19;
        const lfoG = ctx.createGain(); lfoG.gain.value = 0.5;
        const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 170;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.25, t + 0.4);
        const mod = ctx.createGain(); mod.gain.value = 1;
        lfo.connect(lfoG); lfoG.connect(mod.gain);
        o1.connect(filt); o2.connect(filt); filt.connect(mod); mod.connect(g); g.connect(this.sfxBus);
        o1.start(t); o2.start(t); lfo.start(t);
        this.engineNodes = { o1, o2, lfo, filt, g };
      });
    }
    engineRev(dur) {
      this.sfx((ctx, t) => {
        const e = this.engineNodes; if (!e) return;
        e.o1.frequency.linearRampToValueAtTime(120, t + dur);
        e.o2.frequency.linearRampToValueAtTime(60, t + dur);
        e.filt.frequency.linearRampToValueAtTime(520, t + dur);
        e.g.gain.linearRampToValueAtTime(0.32, t + 0.3);
        e.g.gain.setValueAtTime(0.32, t + dur * 0.5);
        e.g.gain.linearRampToValueAtTime(0.0001, t + dur);
        e.o1.stop(t + dur + 0.1); e.o2.stop(t + dur + 0.1); e.lfo.stop(t + dur + 0.1);
        setTimeout(() => { this.engineNodes = null; }, (dur + 0.2) * 1000);
      });
    }
    engineStop() {
      this.sfx((ctx, t) => {
        const e = this.engineNodes; if (!e) return;
        e.g.gain.cancelScheduledValues(t); e.g.gain.setValueAtTime(e.g.gain.value, t); e.g.gain.linearRampToValueAtTime(0.0001, t + 0.2);
        try { e.o1.stop(t + 0.3); e.o2.stop(t + 0.3); e.lfo.stop(t + 0.3); } catch (err) { /* already stopped */ }
        this.engineNodes = null;
      });
    }
  }

  root.TD_AUDIO = { Engine };
})(window);
