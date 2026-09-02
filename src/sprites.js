// Trump Dash - sprite sheet frame table (measured from resources/sprite_sheet.png)
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
  root.TD_SPRITES = { FRAMES, SHEET: 'resources/sprite_sheet.png', RUN_SCALE: 72 / 308 };
})(typeof window !== 'undefined' ? window : globalThis);
