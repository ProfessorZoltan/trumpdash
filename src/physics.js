// Trump Dash - deterministic physics (shared by the game and the Node verifier).
// Gravity can be flipped: st.grav = 1 runs on the floor (GROUND_Y), st.grav = -1 runs along
// the ceiling (CEIL_Y). st.y is always the player's FEET; the body extends away from the surface.
(function (root) {
  const C = root.TD_CONST;
  const HW = C.PLAYER_W / 2, PH = C.PLAYER_H;

  function makeState(beat, level) {
    return {
      t: beat * C.BEAT_SEC, x: level && level.xAtBeat ? level.xAtBeat(beat) : beat * C.BEAT_PX, y: C.GROUND_Y, vy: 0, grav: 1,
      onGround: true, ground: null, airT: 0, rot: 0, speedMul: 1, gk: 1, flying: false, heldPrev: false,
      dead: false, deathBy: null, finished: false, oi: 0, events: [],
      prevTop: C.GROUND_Y - PH, prevBot: C.GROUND_Y,
    };
  }
  // Speed multiplier at a world x (ice zones make the run faster)
  function speedAt(level, x) {
    const zs = level.zones;
    if (zs) for (let i = 0; i < zs.length; i++) { const z = zs[i]; if (x < z.x0) break; if (x < z.x1) return z.m; }
    return 1;
  }
  // Gravity divisor at a world x (low-gravity zones: jumps go k times higher and last k times longer)
  function gravAt(level, x) {
    const zs = level.lowg;
    if (zs) for (let i = 0; i < zs.length; i++) { const z = zs[i]; if (x < z.x0) break; if (x < z.x1) return z.k; }
    return 1;
  }

  function emit(st, type, obj) { st.events.push({ type, t: st.t, x: st.x, y: st.y, grav: st.grav, obj }); }

  function launch(st, v, type, obj) {
    st.vy = -st.grav * v; st.onGround = false; st.ground = null; st.airT = 0;
    emit(st, type, obj);
  }
  function land(st, y, ground) {
    st.y = y; st.vy = 0; st.onGround = true; st.ground = ground; st.airT = 0; st.rot = 0;
    emit(st, 'land', ground);
  }
  function die(st, obj) { st.dead = true; st.deathBy = obj; emit(st, 'die', obj); }

  function circleHit(cx, cy, r, l, rr, t, b) {
    const px = Math.max(l, Math.min(cx, rr)), py = Math.max(t, Math.min(cy, b));
    const dx = cx - px, dy = cy - py;
    return dx * dx + dy * dy <= r * r;
  }
  // Drone centre y at a given beat (shared with the renderer so hitbox and picture agree)
  function droneCY(o, beat) {
    return o.floorY - (o.dir || 1) * (o.hBase + o.amp * Math.sin((2 * Math.PI * (beat - o.phase)) / o.period));
  }
  // Is there floor under any part of the hitbox [pl, pr]?
  function overGround(level, pl, pr) {
    const gaps = level.gaps;
    for (let i = 0; i < gaps.length; i++) {
      const g = gaps[i];
      if (g.l > pr) break;
      if (g.l < pl && pr < g.r) return false;
    }
    return true;
  }
  // Is there ceiling above any part of the hitbox [pl, pr]? (ceilings only exist in segments)
  function overCeiling(level, pl, pr) {
    const segs = level.ceilings || [];
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      if (s.l > pr) break;
      if (s.l < pr && s.r > pl) return true;
    }
    return false;
  }
  // Inside a flight zone the player is the jet (smaller, wider hitbox; underside at st.y)
  function flyAt(level, x) {
    const zs = level.fly;
    if (zs) for (let i = 0; i < zs.length; i++) { const z = zs[i]; if (x < z.x0) break; if (x <= z.x1) return true; }
    return false;
  }
  function hitTop(st) { const ph = st.flying ? C.JET_H : PH; return st.grav === 1 ? st.y - ph : st.y; }
  function hitBot(st) { const ph = st.flying ? C.JET_H : PH; return st.grav === 1 ? st.y : st.y + ph; }
  // Top surface of a lock lift (moving platform) at a given beat: lowest at o.phase, highest half a period later
  function liftTop(o, beat) {
    const f = 0.5 - 0.5 * Math.cos((2 * Math.PI * (beat - o.phase)) / o.period);
    return C.GROUND_Y - (o.hLow + (o.hHigh - o.hLow) * f);
  }

  // Advance one fixed step. `held` = jump button currently down.
  function step(st, level, held, dt) {
    if (st.dead || st.finished) return;
    const objs = level.objs;
    const g = st.grav;
    if (!st.flying && st.onGround && held) launch(st, C.JUMP_VY, 'jump', null);

    st.t += dt;
    const m = speedAt(level, st.x);
    if (m !== st.speedMul) { st.speedMul = m; emit(st, 'zone', { m }); }
    st.x += C.SPEED * m * dt;
    const fz = flyAt(level, st.x);
    if (fz !== st.flying) { // boarding the jet, or leaving it
      st.flying = fz; st.onGround = false; st.ground = null; st.airT = 0; st.rot = 0;
      if (fz) st.vy = 0;
      emit(st, 'fly', { on: fz });
    }
    const hw = st.flying ? C.JET_W / 2 : HW;
    const pl = st.x - hw, pr = st.x + hw;
    const beatNow = st.t / C.BEAT_SEC;
    // riding a lift: the feet follow the platform
    if (st.onGround && st.ground && st.ground.t === 'lift') st.y = liftTop(st.ground, beatNow);
    const k = gravAt(level, st.x);
    if (k !== st.gk) { st.gk = k; emit(st, 'lowg', { k }); }
    if (st.flying) {
      C.flyStep(st, held, dt);
      st.rot = (st.vy / C.FLY_VMAX) * 0.35; // nose tilt
      if (held && !st.heldPrev) emit(st, 'thrust', null);
    } else if (!st.onGround) {
      st.vy += (g * C.GRAVITY / k) * dt;
      if (g === 1) st.vy = Math.min(st.vy, C.MAX_FALL); else st.vy = Math.max(st.vy, -C.MAX_FALL);
      st.y += st.vy * dt;
      st.airT += dt;
      st.rot += ((Math.PI * 2) / (C.AIR_T * k)) * dt;
      if (g === 1) {
        if (st.y >= C.GROUND_Y) {
          if (overGround(level, pl, pr)) land(st, C.GROUND_Y, null);
          else if (st.y > C.GROUND_Y + 16) { die(st, { t: 'water' }); return; }
        }
      } else if (st.y <= C.CEIL_Y) {
        if (overCeiling(level, pl, pr)) land(st, C.CEIL_Y, null);
        else if (st.y < C.CEIL_Y - 16) { die(st, { t: 'sky' }); return; }
      }
    } else if (st.ground === null && !(g === 1 ? overGround(level, pl, pr) : overCeiling(level, pl, pr))) {
      // ran off the edge of the surface
      st.onGround = false; st.airT = 0; st.vy = 0;
    }

    const pt = hitTop(st), pb = hitBot(st);
    let flipTo = 0;
    while (st.oi < objs.length && objs[st.oi].xmax < pl - 80) st.oi++;
    for (let i = st.oi; i < objs.length; i++) {
      const o = objs[i];
      if (o.xmin > pr + 80) break;
      switch (o.t) {
        case 'block':
          if (pr > o.l && pl < o.r && pb > o.top && pt < o.bot) {
            if (st.flying) { die(st, o); return; }
            if (g === 1 && !st.onGround && st.vy >= 0 && st.prevBot <= o.top + 0.5) land(st, o.top, o);
            else if (g === -1 && !st.onGround && st.vy <= 0 && st.prevTop >= o.bot - 0.5) land(st, o.bot, o);
            else { die(st, o); return; }
          }
          break;
        case 'lift': {
          const top = liftTop(o, beatNow), bot = top + o.thick;
          if (pr > o.l && pl < o.r && pb > top && pt < bot) {
            if (st.flying) { die(st, o); return; }
            // generous landing: the platform may be rising to meet a falling player
            if (g === 1 && !st.onGround && st.vy >= 0 && st.prevBot <= top + 14) land(st, top, o);
            else if (st.ground !== o) { die(st, o); return; }
          }
          break;
        }
        case 'spike': {
          const h = o.hb;
          if (pr > h.l && pl < h.r && pb > h.top && pt < h.bot) { die(st, o); return; }
          break;
        }
        case 'pad':
          if (!st.flying && pr > o.l && pl < o.r) {
            if (!o.flip && g === 1 && pb >= o.top - 6 && pb <= o.bot + 14 && (st.onGround || st.vy >= 0)) launch(st, C.PAD_VY, 'pad', o);
            else if (o.flip && g === -1 && pt <= o.bot + 6 && pt >= o.top - 14 && (st.onGround || st.vy <= 0)) launch(st, C.PAD_VY, 'pad', o);
          }
          break;
        case 'orb':
          if (!st.flying && !o.used && held && circleHit(o.cx, o.cy, o.r, pl, pr, pt, pb)) {
            o.used = true; launch(st, C.ORB_VY, 'orb', o);
          }
          break;
        case 'mine':
          if (circleHit(o.cx, o.cy, o.r, pl, pr, pt, pb)) { die(st, o); return; }
          break;
        case 'drone': {
          const cy = droneCY(o, st.t / C.BEAT_SEC);
          if (circleHit(o.cx, cy, o.r, pl, pr, pt, pb)) { die(st, o); return; }
          break;
        }
        case 'coin':
          if (!o.got && circleHit(o.cx, o.cy, 20, pl, pr, pt, pb)) { o.got = true; emit(st, 'coin', o); }
          break;
        case 'portal':
          if (!st.flying && o.dir !== g && circleHit(o.cx, o.cy, o.r, pl, pr, pt, pb)) flipTo = o.dir;
          break;
        case 'goal':
          if (st.x >= o.x) { st.finished = true; emit(st, 'finish', o); return; }
          break;
      }
    }
    // walked off the edge of a platform?
    if (st.onGround && st.ground && !(pr > st.ground.l && pl < st.ground.r)) {
      st.onGround = false; st.ground = null; st.airT = 0; st.vy = 0;
    }
    if (flipTo) {
      // keep the body where it is on screen; only the feet reference changes
      st.y = flipTo === -1 ? st.y - PH : st.y + PH;
      st.grav = flipTo;
      st.onGround = false; st.ground = null; st.airT = 0;
      emit(st, 'flip', null);
    }
    st.heldPrev = held;
    st.prevTop = hitTop(st);
    st.prevBot = hitBot(st);
  }

  // Reset consumable objects at or after a world x (used for checkpoints/restarts)
  function resetObjects(level, fromX) {
    for (const o of level.objs) {
      if (o.xmin >= fromX - 60) { if (o.t === 'orb') o.used = false; if (o.t === 'coin') o.got = false; }
    }
  }

  root.TD_PHYSICS = { makeState, step, resetObjects, droneCY, liftTop, overGround, overCeiling, hitTop, hitBot, speedAt, gravAt };
})(typeof window !== 'undefined' ? window : globalThis);
