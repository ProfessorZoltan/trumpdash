// Trump Dash - sprite tables.
// FRAMES are measured from resources/sprite_sheet.png: the poses used by the endings, and the original
// 8-frame run that is only a fallback now. WALK is the walk cycle in resources/walk_sheet.png, packed in
// play order from resources/sprite_sheet_revised.jpg by tools/pack_walk.py: feet on the bottom edge of
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
    SCALE: 72 / 256, // logical px per source px: the standing pose is 72 px tall in the game
    PHASE: 0,        // frame that plays on the beat: the first foot-plant (the sheet is packed in play order, contact first)
    AIR: 5,          // frame shown while airborne: the widest stride
    MENU: 0,         // frame used in the level thumbnails
    FRAMES: [
      // WALK_FRAMES_BEGIN
      { x: 4, y: 7, w: 146, h: 253, ax: 89.3 },
      { x: 154, y: 10, w: 137, h: 250, ax: 79.9 },
      { x: 295, y: 8, w: 144, h: 252, ax: 88.0 },
      { x: 443, y: 8, w: 124, h: 252, ax: 65.6 },
      { x: 571, y: 8, w: 147, h: 252, ax: 89.1 },
      { x: 722, y: 9, w: 150, h: 251, ax: 88.6 },
      { x: 876, y: 7, w: 139, h: 253, ax: 83.0 },
      { x: 1019, y: 4, w: 139, h: 256, ax: 81.4 },
      // WALK_FRAMES_END
    ],
  };
  root.TD_SPRITES = { FRAMES, SHEET: 'resources/sprite_sheet.png', RUN_SCALE: 72 / 308, WALK };
})(typeof window !== 'undefined' ? window : globalThis);
