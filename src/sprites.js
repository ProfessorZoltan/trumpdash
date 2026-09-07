// Trump Dash - sprite tables.
// FRAMES are measured from resources/sprite_sheet.png: the poses used by the endings, and the original
// 8-frame run that is only a fallback now. WALK is the 20-frame walk cycle in resources/walk_sheet.png,
// packed by tools/pack_walk.py: feet on the bottom edge of every box, `ax` the x of the head inside it
// (frames are anchored on the head so it holds still while the legs swing).
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
    SCALE: 72 / 289, // logical px per source px: the standing pose is 72 px tall in the game
    CYCLE: 176,      // px of travel per full cycle (two steps), the cadence the old 8-frame run had
    AIR: 4,          // frame shown while airborne
    MENU: 3,         // frame used in the level thumbnails
    FRAMES: [
      // WALK_FRAMES_BEGIN
      { x: 4, y: 4, w: 141, h: 289, ax: 72.4 },
      { x: 149, y: 4, w: 167, h: 289, ax: 97.8 },
      { x: 320, y: 5, w: 167, h: 288, ax: 97.3 },
      { x: 491, y: 5, w: 166, h: 288, ax: 97.5 },
      { x: 661, y: 10, w: 166, h: 283, ax: 98.3 },
      { x: 831, y: 11, w: 165, h: 282, ax: 97.0 },
      { x: 1000, y: 10, w: 166, h: 283, ax: 97.6 },
      { x: 1170, y: 11, w: 157, h: 282, ax: 89.4 },
      { x: 1331, y: 11, w: 162, h: 282, ax: 94.3 },
      { x: 1497, y: 9, w: 151, h: 284, ax: 84.6 },
      { x: 1652, y: 4, w: 154, h: 289, ax: 85.4 },
      { x: 1810, y: 4, w: 168, h: 289, ax: 98.2 },
      { x: 1982, y: 4, w: 162, h: 289, ax: 91.7 },
      { x: 2148, y: 5, w: 165, h: 288, ax: 95.8 },
      { x: 2317, y: 5, w: 162, h: 288, ax: 94.1 },
      { x: 2483, y: 5, w: 172, h: 288, ax: 103.0 },
      { x: 2659, y: 5, w: 168, h: 288, ax: 99.5 },
      { x: 2831, y: 4, w: 171, h: 289, ax: 102.5 },
      { x: 3006, y: 4, w: 158, h: 289, ax: 88.3 },
      { x: 3168, y: 4, w: 156, h: 289, ax: 86.3 },
      // WALK_FRAMES_END
    ],
  };
  root.TD_SPRITES = { FRAMES, SHEET: 'resources/sprite_sheet.png', RUN_SCALE: 72 / 308, WALK };
})(typeof window !== 'undefined' ? window : globalThis);
