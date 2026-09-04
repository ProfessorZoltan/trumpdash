// Trump Dash - shared constants (works in browser and Node)
(function (root) {
  const C = {};
  C.W = 960;
  C.H = 540;

  C.BLOCK = 40;                        // one "block" in px
  C.GROUND_Y = 440;                    // world y of the ground surface
  C.CEIL_Y = 140;                      // world y of the ceiling surface used while gravity is flipped
  C.PLAYER_X = 240;                    // screen x of the player (camera anchor)
  C.PLAYER_W = 30;                     // hitbox
  C.PLAYER_H = 58;
  C.JUMP_H = 100;                      // apex height in px
  C.MAX_FALL = 1800;
  C.DT = 1 / 240;                      // physics step
  C.BEAT_PX = 180;                     // px per beat, fixed for every level

  // Rhythm: everything is derived from the level's BPM. The distance per beat stays 180 px,
  // so a faster song simply scrolls faster; obstacle geometry is identical between levels.
  C.setTempo = function (bpm) {
    C.BPM = bpm;
    C.BEAT_SEC = 60 / bpm;
    C.SPEED = C.BEAT_PX / C.BEAT_SEC;                  // px per second
    C.AIR_T = 0.8 * C.BEAT_SEC;                        // a full jump lasts 0.8 beat
    C.GRAVITY = (8 * C.JUMP_H) / (C.AIR_T * C.AIR_T);  // px/s^2
    C.JUMP_VY = (C.GRAVITY * C.AIR_T) / 2;             // px/s
    C.JUMP_DX = C.SPEED * C.AIR_T;                     // horizontal px covered by a jump (144)
    C.JUMP_OFFSET = (C.JUMP_DX / 2) / C.BEAT_PX;       // beats from press to apex (0.4)
    C.PAD_VY = C.JUMP_VY * 1.32;                       // "Executive Order" pad: bigger launch
    C.ORB_VY = C.JUMP_VY;                              // orb: mid-air jump
  };
  C.setTempo(128);

  // Flight (the jet): hold = thrust up, release = sink. The vertical speed eases toward a terminal
  // speed (+/- FLY_VMAX) with time constant FLY_TAU, so a timing error costs a bounded distance
  // (about 18 px per 60 ms) and then fades instead of compounding across the next gates. The ceiling
  // and the floor are safe surfaces to hug. st.y is the jet's underside.
  C.JET_W = 88; C.JET_H = 34;
  C.FLY_VMAX = 300; C.FLY_TAU = 0.18;
  C.flyStep = function (st, held, dt) {
    const target = held ? -C.FLY_VMAX : C.FLY_VMAX;
    st.vy += (target - st.vy) * (1 - Math.exp(-dt / C.FLY_TAU));
    st.y += st.vy * dt;
    const top = C.CEIL_Y + C.JET_H;
    if (st.y < top) { st.y = top; if (st.vy < 0) st.vy = 0; }
    if (st.y > C.GROUND_Y) { st.y = C.GROUND_Y; if (st.vy > 0) st.vy = 0; }
  };

  root.TD_CONST = C;
})(typeof window !== 'undefined' ? window : globalThis);
