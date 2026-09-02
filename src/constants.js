// Trump Dash - shared constants (works in browser and Node)
(function (root) {
  const C = {};
  C.W = 960;
  C.H = 540;

  // Rhythm: everything is derived from BPM so obstacles land on beats.
  C.BPM = 128;
  C.BEAT_SEC = 60 / C.BPM;            // 0.46875 s per beat
  C.SPEED = 384;                       // px per second (constant, like Geometry Dash)
  C.BEAT_PX = C.SPEED * C.BEAT_SEC;    // 180 px per beat

  C.BLOCK = 40;                        // one "block" in px
  C.GROUND_Y = 440;                    // world y of the ground surface
  C.PLAYER_X = 240;                    // screen x of the player (camera anchor)
  C.PLAYER_W = 30;                     // hitbox
  C.PLAYER_H = 58;

  // Jump tuned so a full jump lasts 0.8 of a beat: press on beat N, land before beat N+1.
  C.AIR_T = 0.8 * C.BEAT_SEC;                        // 0.375 s in the air
  C.JUMP_H = 100;                                    // apex height in px
  C.GRAVITY = (8 * C.JUMP_H) / (C.AIR_T * C.AIR_T);  // px/s^2
  C.JUMP_VY = (C.GRAVITY * C.AIR_T) / 2;             // px/s
  C.JUMP_DX = C.SPEED * C.AIR_T;                     // horizontal px covered by a jump (144)
  C.JUMP_OFFSET = (C.JUMP_DX / 2) / C.BEAT_PX;       // beats from press to apex (0.4)

  C.PAD_VY = C.JUMP_VY * 1.32;   // "Executive Order" pad: bigger launch
  C.ORB_VY = C.JUMP_VY;          // "Pardon" orb: mid-air jump
  C.MAX_FALL = 1800;
  C.DT = 1 / 240;                // physics step

  root.TD_CONST = C;
})(typeof module !== 'undefined' ? module.exports : window);
