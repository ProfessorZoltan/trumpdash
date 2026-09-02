// Trump Dash - deterministic physics (shared by the game and the Node verifier).
(function (root) {
  const C = root.TD_CONST || require('./constants.js').TD_CONST;
  const HW = C.PLAYER_W / 2, PH = C.PLAYER_H;

  function makeState(beat) {
    return {
      t: beat * C.BEAT_SEC, x: beat * C.BEAT_PX, y: C.GROUND_Y, vy: 0,
      onGround: true, ground: null, airT: 0, rot: 0,
      dead: false, deathBy: null, finished: false, oi: 0, events: [],
    };
  }

  function emit(st, type, obj) { st.events.push({ type, t: st.t, x: st.x, y: st.y, obj }); }

  function launch(st, vy, type, obj) {
    st.vy = -vy; st.onGround = false; st.ground = null; st.airT = 0;
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

  // Advance one fixed step. `held` = jump button currently down.
  function step(st, level, held, dt) {
    if (st.dead || st.finished) return;
    const objs = level.objs;
    if (st.onGround && held) launch(st, C.JUMP_VY, 'jump', null);

    st.t += dt;
    const prevY = st.y;
    st.x = st.t * C.SPEED;
    if (!st.onGround) {
      st.vy = Math.min(st.vy + C.GRAVITY * dt, C.MAX_FALL);
      st.y += st.vy * dt;
      st.airT += dt;
      st.rot += ((Math.PI * 2) / C.AIR_T) * dt;
      if (st.y >= C.GROUND_Y) land(st, C.GROUND_Y, null);
    }

    const pl = st.x - HW, pr = st.x + HW, pb = st.y, pt = st.y - PH;
    while (st.oi < objs.length && objs[st.oi].xmax < pl - 80) st.oi++;
    for (let i = st.oi; i < objs.length; i++) {
      const o = objs[i];
      if (o.xmin > pr + 80) break;
      switch (o.t) {
        case 'block':
          if (pr > o.l && pl < o.r && pb > o.top && pt < o.bot) {
            if (!st.onGround && st.vy >= 0 && prevY <= o.top + 0.5) land(st, o.top, o);
            else { die(st, o); return; }
          }
          break;
        case 'spike': {
          const h = o.hb;
          if (pr > h.l && pl < h.r && pb > h.top && pt < h.bot) { die(st, o); return; }
          break;
        }
        case 'pad':
          if (pr > o.l && pl < o.r && pb >= o.top - 6 && pb <= o.bot + 14 && (st.onGround || st.vy >= 0)) {
            launch(st, C.PAD_VY, 'pad', o);
          }
          break;
        case 'orb':
          if (!o.used && held && circleHit(o.cx, o.cy, o.r, pl, pr, pt, pb)) {
            o.used = true; launch(st, C.ORB_VY, 'orb', o);
          }
          break;
        case 'barrel':
          if (!o.got && circleHit(o.cx, o.cy, 20, pl, pr, pt, pb)) { o.got = true; emit(st, 'barrel', o); }
          break;
        case 'truck':
          if (st.x >= o.x) { st.finished = true; emit(st, 'finish', o); return; }
          break;
      }
    }
    // walked off the edge of a platform?
    if (st.onGround && st.ground && !(pr > st.ground.l && pl < st.ground.r)) {
      st.onGround = false; st.ground = null; st.airT = 0; st.vy = 0;
    }
  }

  // Reset consumable objects at or after a world x (used for checkpoints/restarts)
  function resetObjects(level, fromX) {
    for (const o of level.objs) {
      if (o.xmin >= fromX - 60) { if (o.t === 'orb') o.used = false; if (o.t === 'barrel') o.got = false; }
    }
  }

  root.TD_PHYSICS = { makeState, step, resetObjects };
})(typeof module !== 'undefined' ? module.exports : window);
