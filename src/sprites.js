// Trump Dash - sprite tables.
// FRAMES are measured from resources/sprite_sheet.png: the poses used by the endings, and the original
// 8-frame run that is only a fallback now. WALK is the walk cycle in resources/walk_sheet.png, packed in
// play order from the walk-cycle sheet by tools/pack_walk.py: feet on the bottom edge of
// every box, `ax` the x of the head inside it (frames are anchored on the head so it holds still while
// the legs swing).
(function (root) {
  const FRAMES = {
    thumbs: { x: 41, y: 124, w: 247, h: 384 },
    podium: { x: 329, y: 107, w: 267, h: 401 },
    point: { x: 620, y: 128, w: 312, h: 380 },
    cheer: { x: 950, y: 135, w: 287, h: 374 },
    stand: { x: 1251, y: 158, w: 252, h: 352 },
    run: [
      { x: 25, y: 594, w: 168, h: 311 },
      { x: 200, y: 594, w: 176, h: 308 },
      { x: 394, y: 600, w: 166, h: 305 },
      { x: 584, y: 598, w: 175, h: 306 },
      { x: 778, y: 597, w: 178, h: 307 },
      { x: 965, y: 600, w: 182, h: 304 },
      { x: 1159, y: 595, w: 168, h: 309 },
      { x: 1358, y: 600, w: 151, h: 305 },
    ],
  };
  const WALK = {
    SHEET: 'resources/walk_sheet.png',
    SCALE: 72 / 244, // logical px per source px: the standing pose is 72 px tall in the game
    PHASE: 2,        // frame that plays on the beat: the first foot-plant (each half starts with a passing pose)
    AIR: 9,          // frame shown while airborne: the widest stride
    MENU: 2,         // frame used in the level thumbnails
    FRAMES: [
      // WALK_FRAMES_BEGIN
      { x: 4, y: 4, w: 114, h: 244, ax: 60.8 },
      { x: 122, y: 10, w: 128, h: 238, ax: 73.0 },
      { x: 254, y: 5, w: 139, h: 243, ax: 84.5 },
      { x: 397, y: 12, w: 137, h: 236, ax: 79.3 },
      { x: 538, y: 13, w: 138, h: 235, ax: 78.3 },
      { x: 680, y: 12, w: 128, h: 236, ax: 74.5 },
      { x: 812, y: 13, w: 121, h: 235, ax: 70.1 },
      { x: 937, y: 10, w: 109, h: 238, ax: 54.5 },
      { x: 1050, y: 4, w: 157, h: 244, ax: 85.5 },
      { x: 1211, y: 7, w: 152, h: 241, ax: 85.6 },
      { x: 1367, y: 6, w: 151, h: 242, ax: 88.4 },
      { x: 1522, y: 7, w: 131, h: 241, ax: 73.9 },
      { x: 1657, y: 5, w: 119, h: 243, ax: 66.9 },
      { x: 1780, y: 7, w: 113, h: 241, ax: 61.1 },
      // WALK_FRAMES_END
    ],
  };
  root.TD_SPRITES = { FRAMES, SHEET: 'resources/sprite_sheet.png', RUN_SCALE: 72 / 308, WALK };
})(typeof window !== 'undefined' ? window : globalThis);
