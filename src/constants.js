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

  root.TD_CONST = C;
})(typeof window !== 'undefined' ? window : globalThis);
