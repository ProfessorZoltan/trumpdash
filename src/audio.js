// Trump Dash - procedural music + sound effects (Web Audio API).
// The engine owns the instruments and the 16th-note scheduler; each level's definition owns the
// arrangement (def.music.step). Every beat where the level requires a jump gets an "accent"
// (bright pluck + clap) so the music itself cues the jump.
(function (root) {
  const C = root.TD_CONST;
  const LV = root.TD_LEVEL;
  const mtof = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const stepSec = () => C.BEAT_SEC / 4;

  class Engine {
    constructor() {
      this.ctx = null;
      this.muted = false;
      this.vol = 0.8;
      this.timer = null;
      this.playing = false;
      this.songStart = 0;
      this.nextStep = 0;
      this.endStep = Infinity;
      this.level = null;
      this.engineNodes = null;
    }

    init() {
      if (this.ctx) return true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      let ctx;
      try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { ctx = new AC(); } // old webkit contexts reject options
      this.ctx = ctx;
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
      this.delay.delayTime.value = stepSec() * 3;
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

    resume() { // 'interrupted' is what iOS reports after a phone call, Siri or an app switch
      if (!this.ctx || (this.ctx.state !== 'suspended' && this.ctx.state !== 'interrupted')) return;
      try { const p = this.ctx.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* needs a user gesture; the next press retries */ }
    }
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
    tom(t, freq, v) {
      this.osc('sine', freq, t, 0.3, this.musicBus, (g) => {
        g.setValueAtTime(v, t);
        g.exponentialRampToValueAtTime(0.001, t + 0.28);
      }).frequency.exponentialRampToValueAtTime(freq * 0.55, t + 0.2);
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
    bell(t, midi, dur, v) {
      // glassy bell: fundamental + a quiet third partial, fast decay, into the delay
      const ctx = this.ctx;
      const f = mtof(midi);
      const g = ctx.createGain();
      g.gain.setValueAtTime(v * 0.3, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      g.connect(this.duckBus);
      g.connect(this.delaySend);
      for (const [mult, vol] of [[1, 1], [3, 0.18], [5.4, 0.05]]) {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * mult;
        const gg = ctx.createGain(); gg.gain.value = vol; o.connect(gg); gg.connect(g);
        o.start(t); o.stop(t + dur + 0.05);
      }
    }
    theremin(t, midi, dur, v) {
      // sine with a slow vibrato and a glide into the note
      const ctx = this.ctx;
      const f = mtof(midi);
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(f * 0.94, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.08);
      const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 5.5;
      const lfoG = ctx.createGain(); lfoG.gain.value = f * 0.012;
      lfo.connect(lfoG); lfoG.connect(o.frequency);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(v * 0.3, t + 0.05);
      g.gain.setValueAtTime(v * 0.3, t + dur * 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.duckBus); g.connect(this.delaySend);
      o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
    }
    zap(t, v) {
      // laser: fast downward sweep
      const ctx = this.ctx;
      const o = ctx.createOscillator(); o.type = 'square';
      o.frequency.setValueAtTime(1600, t); o.frequency.exponentialRampToValueAtTime(180, t + 0.16);
      const g = ctx.createGain(); g.gain.setValueAtTime(v * 0.25, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g); g.connect(this.musicBus); g.connect(this.delaySend);
      o.start(t); o.stop(t + 0.2);
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
    siren(t, dur) {
      // air-raid siren: slow pitch wobble
      const ctx = this.ctx;
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 560;
      const lfo = ctx.createOscillator(); lfo.type = 'triangle'; lfo.frequency.value = 0.45;
      const lfoG = ctx.createGain(); lfoG.gain.value = 210;
      lfo.connect(lfoG); lfoG.connect(o.frequency);
      const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 1400;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.09, t + 0.6);
      g.gain.setValueAtTime(0.09, t + dur - 0.5);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(filt); filt.connect(g); g.connect(this.musicBus);
      o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
    }

    // ---------- song ----------
    setLevel(level) {
      this.level = level;
      this.endStep = Math.ceil(level.endBeat * 4) + 8;
    }
    scheduleStep(step, t) {
      const lv = this.level;
      if (!lv) return;
      const bar = Math.floor(step / 16), sib = step % 16, bib = sib >> 2, sub = sib & 3;
      const beat = step / 4;
      const info = {
        t, step, bar, sib, bib, sub, beat, sec: LV.sectionAt(lv, beat).name,
        on8: sub === 0 || sub === 2, isJump: lv.jumpSet.has(beat), STEP: stepSec(), BEAT: C.BEAT_SEC,
      };
      lv.def.music.step(this, info);
    }
    startSong(fromBeat, lead) {
      this.stopSong(false);
      if (!this.ctx) { this.songStart = this.clock() + lead - fromBeat * C.BEAT_SEC; this.playing = true; return; }
      this.resume();
      const now = this.ctx.currentTime;
      this.songStart = now + lead - fromBeat * C.BEAT_SEC;
      this.nextStep = Math.round(fromBeat * 4);
      this.playing = true;
      this.delay.delayTime.setValueAtTime(stepSec() * 3, now);
      this.musicBus.gain.cancelScheduledValues(now);
      this.musicBus.gain.setValueAtTime(1, now);
      this.duckBus.gain.cancelScheduledValues(now);
      this.duckBus.gain.setValueAtTime(1, now);
      this.tick();
      this.timer = setInterval(() => this.tick(), 25);
    }
    tick() {
      const ctx = this.ctx;
      const STEP = stepSec();
      const horizon = ctx.currentTime + 0.14;
      let guard = 0;
      while (this.songStart + this.nextStep * STEP < horizon && guard++ < 64) {
        const t = this.songStart + this.nextStep * STEP;
        if (t >= ctx.currentTime - 0.01 && this.nextStep <= this.endStep) {
          try { this.scheduleStep(this.nextStep, t); } catch (e) { console.warn('music step failed', e); }
        }
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
    sfxCoin() {
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
    sfxBoom() {
      this.sfx((ctx, t) => {
        const n = this.noise(t, 0.6, 'lowpass', 500, 0.7, this.sfxBus); n.gain.setValueAtTime(0.8, t); n.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
        this.osc('sine', 90, t, 0.5, this.sfxBus, (g) => { g.setValueAtTime(0.8, t); g.exponentialRampToValueAtTime(0.001, t + 0.45); }).frequency.exponentialRampToValueAtTime(30, t + 0.4);
      });
    }
    sfxSplash() {
      this.sfx((ctx, t) => {
        const n = this.noise(t, 0.45, 'lowpass', 1500, 0.7, this.sfxBus); n.gain.setValueAtTime(0.55, t); n.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
        this.osc('sine', 320, t, 0.25, this.sfxBus, (g) => { g.setValueAtTime(0.25, t); g.exponentialRampToValueAtTime(0.001, t + 0.22); }).frequency.exponentialRampToValueAtTime(70, t + 0.2);
      });
    }
    sfxStamp() {
      this.sfx((ctx, t) => {
        this.osc('sine', 120, t, 0.25, this.sfxBus, (g) => { g.setValueAtTime(1, t); g.exponentialRampToValueAtTime(0.001, t + 0.25); }).frequency.exponentialRampToValueAtTime(35, t + 0.18);
        const n = this.noise(t, 0.12, 'lowpass', 600, 0.7, this.sfxBus); n.gain.setValueAtTime(0.7, t); n.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        const c = this.noise(t, 0.02, 'highpass', 3000, 0.7, this.sfxBus); c.gain.setValueAtTime(0.4, t); c.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
      });
    }
    sfxClank() {
      this.sfx((ctx, t) => {
        this.osc('square', 180, t, 0.2, this.sfxBus, (g) => { g.setValueAtTime(0.3, t); g.exponentialRampToValueAtTime(0.001, t + 0.18); });
        this.osc('triangle', 720, t, 0.3, this.sfxBus, (g) => { g.setValueAtTime(0.25, t); g.exponentialRampToValueAtTime(0.001, t + 0.3); });
        const n = this.noise(t, 0.04, 'highpass', 2000, 0.7, this.sfxBus); n.gain.setValueAtTime(0.5, t); n.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      });
    }
    sfxCash() {
      this.sfx((ctx, t) => {
        const n = this.noise(t, 0.05, 'highpass', 4000, 0.7, this.sfxBus); n.gain.setValueAtTime(0.35, t); n.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        for (const [f, dt] of [[2200, 0.06], [2800, 0.12]]) {
          this.osc('sine', f, t + dt, 0.45, this.sfxBus, (g) => { g.setValueAtTime(0.22, t + dt); g.exponentialRampToValueAtTime(0.001, t + dt + 0.45); });
        }
      });
    }
    sfxHorn() {
      this.sfx((ctx, t) => {
        const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 320; filt.connect(this.sfxBus);
        for (const f of [88, 90.5]) {
          this.osc('sawtooth', f, t, 0.7, filt, (g) => { g.setValueAtTime(0.0001, t); g.linearRampToValueAtTime(0.22, t + 0.06); g.setValueAtTime(0.22, t + 0.5); g.linearRampToValueAtTime(0.0001, t + 0.7); });
        }
      });
    }
    sfxWhoosh(dur) {
      this.sfx((ctx, t) => {
        const d = dur || 0.6;
        const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
        f.frequency.setValueAtTime(200, t); f.frequency.exponentialRampToValueAtTime(3500, t + d);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.35, t + d * 0.6); g.gain.linearRampToValueAtTime(0.0001, t + d);
        src.connect(f); f.connect(g); g.connect(this.sfxBus); src.start(t); src.stop(t + d + 0.05);
      });
    }
    sfxFlip(dir) {
      this.sfx((ctx, t) => {
        const from = dir === -1 ? 520 : 1040, to = dir === -1 ? 1040 : 520;
        this.osc('triangle', from, t, 0.22, this.sfxBus, (g) => { g.setValueAtTime(0.22, t); g.exponentialRampToValueAtTime(0.001, t + 0.22); }).frequency.exponentialRampToValueAtTime(to, t + 0.18);
        this.osc('sine', from * 1.5, t, 0.22, this.sfxBus, (g) => { g.setValueAtTime(0.1, t); g.exponentialRampToValueAtTime(0.001, t + 0.2); }).frequency.exponentialRampToValueAtTime(to * 1.5, t + 0.18);
      });
    }
    sfxBeep(hi) {
      this.sfx((ctx, t) => this.osc('square', hi ? 1320 : 880, t, 0.05, this.sfxBus, (g) => { g.setValueAtTime(0.08, t); g.exponentialRampToValueAtTime(0.001, t + 0.05); }));
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
    endingPad(kind) {
      this.sfx((ctx, t) => {
        this.musicBus.gain.cancelScheduledValues(t); this.musicBus.gain.setValueAtTime(1, t);
        this.duckBus.gain.cancelScheduledValues(t); this.duckBus.gain.setValueAtTime(1, t);
        const prog = kind === 'em' ? [[52, 55, 59, 64], [48, 52, 55, 60]]
          : kind === 'major' ? [[60, 64, 67, 72], [53, 57, 60, 65]]
          : [[57, 60, 64, 69], [53, 57, 60, 65]];
        this.padChord(t, prog[0], 3.2, 0.12); this.padChord(t + 3.3, prog[1], 3.2, 0.12);
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
})(typeof window !== 'undefined' ? window : globalThis);
