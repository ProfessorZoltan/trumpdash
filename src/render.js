// Trump Dash - canvas renderer
(function (root) {
  const C = root.TD_CONST, SPR = root.TD_SPRITES, LV = root.TD_LEVEL, PHYS = root.TD_PHYSICS;
  const W = C.W, H = C.H, B = C.BLOCK, GY = C.GROUND_Y, CY = C.CEIL_Y;
  const TITLE_FONT = 'Impact, "Arial Black", "Segoe UI Black", sans-serif';
  const UI_FONT = '"Segoe UI", Arial, sans-serif';
  const SERIF = 'Georgia, "Times New Roman", serif';

  let sheet = null;
  const runFrames = [];
  let SCALE = 1;           // device pixels per logical pixel; the coordinate system stays 960x540 (setScale)
  const TILES = new Map(); // baked parallax layers / static images, rebuilt when the scale changes
  const GRADS = new Map(); // gradients keyed by geometry + stops (they only depend on logical coordinates)
  const IMAGES = {}; // extra artwork loaded on demand (maps for the Greenland ending)
  function loadImage(name, src) {
    const im = new Image();
    im.onload = () => { IMAGES[name] = im; };
    im.src = src;
  }
  // draw an image scaled to a given height, centred at (cx, cy)
  function drawImageFit(ctx, im, cx, cy, h, alpha) {
    const w = (im.width / im.height) * h;
    if (alpha != null) { ctx.save(); ctx.globalAlpha = alpha; }
    ctx.drawImage(im, cx - w / 2, cy - h / 2, w, h);
    if (alpha != null) ctx.restore();
    return w;
  }

  function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) {
    const A = hexToRgb(a), Bc = hexToRgb(b);
    return `rgb(${Math.round(A[0] + (Bc[0] - A[0]) * t)},${Math.round(A[1] + (Bc[1] - A[1]) * t)},${Math.round(A[2] + (Bc[2] - A[2]) * t)})`;
  }
  const COLOR_KEYS = ['top', 'bot', 'ground', 'gline', 'accent', 'spike'];
  function palette(level, beat) {
    const s = LV.sectionAt(level, beat);
    const P = level.def.palettes, cur = P[s.name], prev = P[s.prev];
    const t = Math.min(1, Math.max(0, (beat - s.start) / 4));
    const out = { style: cur.style, accentHex: cur.accent };
    for (const k of COLOR_KEYS) out[k] = mix(prev[k], cur[k], t);
    return out;
  }
  function paletteOf(def, name) {
    const p = def.palettes[name];
    const out = { style: p.style, accentHex: p.accent };
    for (const k of COLOR_KEYS) out[k] = p[k];
    return out;
  }
  // deterministic pseudo-random for scenery
  function rnd(i) { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function text(ctx, str, x, y, font, color, align, stroke, lw) {
    ctx.font = font;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'middle';
    if (stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = lw || 4; ctx.strokeStyle = stroke; ctx.strokeText(str, x, y); }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  function init(img) {
    sheet = img;
    buildRunFrames();
  }
  // The run cycle is pre-scaled from the sheet once. Each frame canvas carries its logical size (lw, lh)
  // while its bitmap is SCALE times larger, so the sprite stays crisp on high-density screens.
  function buildRunFrames() {
    runFrames.length = 0;
    if (!sheet) return;
    for (const f of SPR.FRAMES.run) {
      const cv = document.createElement('canvas');
      const lw = f.w * SPR.RUN_SCALE, lh = f.h * SPR.RUN_SCALE;
      cv.width = Math.ceil(lw * SCALE);
      cv.height = Math.ceil(lh * SCALE);
      cv.lw = lw; cv.lh = lh;
      const c = cv.getContext('2d');
      c.imageSmoothingEnabled = true;
      c.imageSmoothingQuality = 'high';
      c.drawImage(sheet, f.x, f.y, f.w, f.h, 0, 0, cv.width, cv.height);
      runFrames.push(cv);
    }
  }
  // Size the backing store to `scale` device pixels per logical pixel. game.js calls this whenever the
  // canvas's CSS size or the devicePixelRatio changes; 2 is the cap (1920x1080) to bound fill cost.
  function setScale(canvas, scale) {
    scale = Math.max(0.5, Math.min(2, scale || 1));
    const pw = Math.round(W * scale);
    if (Math.abs(scale - SCALE) < 0.005 && canvas.width === pw) return;
    SCALE = scale;
    canvas.width = pw; canvas.height = Math.round(H * scale);
    TILES.clear();
    buildRunFrames();
  }
  // Creating a gradient every frame is one of the more expensive canvas operations, so they are cached
  // by a key that names their geometry and stops. Palette blends produce new keys for a few seconds;
  // the map is simply cleared when it grows.
  function grad(ctx, key, x0, y0, x1, y1, stops) {
    let g = GRADS.get(key);
    if (!g) {
      if (GRADS.size > 256) GRADS.clear();
      g = ctx.createLinearGradient(x0, y0, x1, y1);
      for (let i = 0; i < stops.length; i += 2) g.addColorStop(stops[i], stops[i + 1]);
      GRADS.set(key, g);
    }
    return g;
  }
  // rgba strings are built every frame in a few hot spots; quantising the alpha keeps the set small
  const RGBA = new Map();
  function rgba(r, g, b, a) {
    a = Math.round(a * 50) / 50;
    const k = r + ',' + g + ',' + b + ',' + a;
    let s = RGBA.get(k);
    if (!s) { s = 'rgba(' + k + ')'; RGBA.set(k, s); }
    return s;
  }
  // a small pre-rendered sprite (coins, mines, orbs): painted once per scale, centred in a box of `size`
  function sprite(key, size, paint) { return tile(key, size, 0, size, (c, ox) => { if (ox === 0) paint(c, size / 2, size / 2); }); }
  // A parallax layer is periodic in world x, so it is painted once into an offscreen canvas one period
  // wide (three copies, so shapes that cross the seam wrap) and blitted up to three times per frame.
  // `paint(c, ox)` draws the layer with its origin at logical x = ox. Tiles hold device pixels.
  function tile(key, per, y0, h, paint) {
    let t = TILES.get(key);
    if (t) return t;
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(per * SCALE));
    cv.height = Math.max(1, Math.round(h * SCALE));
    const ty0 = Math.round(y0 * SCALE) / SCALE;
    const c = cv.getContext('2d');
    c.setTransform(SCALE, 0, 0, SCALE, 0, -ty0 * SCALE);
    for (let k = -1; k <= 1; k++) paint(c, k * per);
    t = { cv, per: cv.width / SCALE, y0: ty0, h: cv.height / SCALE };
    TILES.set(key, t);
    return t;
  }
  function blitTile(ctx, t, cam, p) {
    const off = ((-cam * p) % t.per + t.per) % t.per;
    for (let k = -1; k <= 1; k++) {
      const x = Math.round((off + k * t.per) * SCALE) / SCALE; // device-pixel aligned: no resampling blur
      if (x + t.per <= 0 || x >= W) continue;
      ctx.drawImage(t.cv, x, t.y0, t.per, t.h);
    }
  }
  // a ridge line: fill from `baseY` up to peaks `top + rnd * amp` above the ground, `n` segments per period
  function ridgeTile(key, per, baseY, top, amp, n, seed, color) {
    return tile(key, per, GY - top - amp - 6, top + amp + 6, (c, ox) => {
      c.beginPath(); c.moveTo(ox, baseY);
      for (let i = 0; i <= n; i++) c.lineTo(ox + (i / n) * per, GY - top - rnd((i % n) * seed[0] + seed[1]) * amp);
      c.lineTo(ox + per, baseY); c.closePath(); c.fillStyle = color; c.fill();
    });
  }
  // draw a pose anchored at bottom-centre with a given height
  function drawPose(ctx, name, x, bottomY, height, flip) {
    if (!sheet) return;
    const f = SPR.FRAMES[name];
    const s = height / f.h, w = f.w * s;
    ctx.save();
    ctx.translate(x, bottomY);
    if (flip) ctx.scale(-1, 1);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sheet, f.x, f.y, f.w, f.h, -w / 2, -height, w, height);
    ctx.restore();
  }

  // ---------------- background ----------------
  // Backdrops: the static parallax layers are baked into tiles the first time they are drawn at the
  // current scale; only the animated bits (twinkle, comet, flames, aurora, glints) are drawn live.
  const STARS = [], SPACE_STARS = [];
  for (let i = 0; i < 60; i++) STARS.push({ x: rnd(i) * 1400, y: rnd(i + 100) * 260, ph: i });
  for (let i = 0; i < 110; i++) SPACE_STARS.push({ x: rnd(i + 900) * 1600, y: rnd(i + 950) * 400, s: 1 + rnd(i + 960) * 2, ph: i });
  function drawBackground(ctx, G, pal, backdrop) {
    ctx.fillStyle = grad(ctx, 'sky|' + pal.top + '|' + pal.bot, 0, 0, 0, GY, [0, pal.top, 1, pal.bot]);
    ctx.fillRect(0, 0, W, GY);
    ctx.fillStyle = rgba(255, 255, 255, 0.07 * G.beatPulse);
    ctx.fillRect(0, 0, W, GY);
    const cam = G.camX, t3 = G.time * 3;
    ctx.fillStyle = '#fff';
    for (const s of STARS) {
      const sx = ((s.x - cam * 0.05) % 1400 + 1400) % 1400 - 200;
      ctx.globalAlpha = 0.55 + 0.25 * Math.sin(t3 + s.ph);
      ctx.fillRect(sx, s.y, 2, 2);
    }
    ctx.globalAlpha = 1;
    if (backdrop === 'gulf') drawGulfBackdrop(ctx, G, cam);
    else if (backdrop === 'arctic') drawArcticBackdrop(ctx, G, cam);
    else if (backdrop === 'canada') drawCanadaBackdrop(ctx, G, cam);
    else if (backdrop === 'tropics') drawTropicsBackdrop(ctx, G, cam);
    else if (backdrop === 'space') drawSpaceBackdrop(ctx, G, cam);
    else if (backdrop === 'desert') drawDesertBackdrop(ctx, G, cam);
    else drawCityBackdrop(ctx, cam);
  }
  function drawDesertBackdrop(ctx, G, cam) {
    // a low sun
    const sun = tile('desert-sun', 200, 0, 200, (c, ox) => {
      if (ox !== 0) return;
      const g = c.createRadialGradient(100, 100, 30, 100, 100, 100);
      g.addColorStop(0, 'rgba(255,220,120,0.9)'); g.addColorStop(0.35, 'rgba(255,190,80,0.55)'); g.addColorStop(1, 'rgba(255,170,60,0)');
      c.fillStyle = g; c.beginPath(); c.arc(100, 100, 100, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffe9a8'; c.beginPath(); c.arc(100, 100, 34, 0, Math.PI * 2); c.fill();
    });
    ctx.drawImage(sun.cv, W - 340 - ((cam * 0.01) % 40), 30, sun.per, sun.h);
    // Doha skyline in silhouette: glass towers, a dome, a minaret
    const sky = tile('desert-skyline', 1800, GY - 270, 270, (c, ox) => {
      const towers = [[40, 70, 190], [130, 50, 150], [200, 60, 230], [290, 44, 120], [360, 80, 200], [470, 46, 170], [540, 60, 250], [630, 50, 140], [720, 70, 210], [830, 46, 160], [900, 60, 190], [1000, 80, 240], [1110, 50, 130], [1370, 70, 150], [1470, 56, 200], [1560, 60, 120], [1650, 50, 170], [1730, 44, 140]];
      for (const [x, w, h] of towers) {
        c.fillStyle = 'rgba(30,40,70,0.5)'; c.fillRect(ox + x, GY - h, w, h);
        c.fillStyle = 'rgba(255,220,150,0.35)';
        for (let wy = GY - h + 8; wy < GY - 8; wy += 12) for (let wx = ox + x + 5; wx < ox + x + w - 6; wx += 10) if (rnd(wx * 0.3 + wy * 0.7) > 0.5) c.fillRect(wx, wy, 4, 6);
      }
      c.fillStyle = 'rgba(30,40,70,0.5)';
      c.beginPath(); c.arc(ox + 1240, GY - 40, 40, Math.PI, 0); c.fill(); c.fillRect(ox + 1200, GY - 40, 80, 40);
      c.fillRect(ox + 1300, GY - 180, 10, 180); c.beginPath(); c.moveTo(ox + 1295, GY - 180); c.lineTo(ox + 1305, GY - 205); c.lineTo(ox + 1315, GY - 180); c.fill();
    });
    blitTile(ctx, sky, cam, 0.12);
    // dunes, two layers
    blitTile(ctx, ridgeTile('desert-dunes-far', 1700, GY - 40, 60, 60, 10, [5, 21], 'rgba(230,170,90,0.55)'), cam, 0.25);
    blitTile(ctx, ridgeTile('desert-dunes-near', 1200, GY, 20, 50, 7, [9, 33], 'rgba(200,130,60,0.7)'), cam, 0.45);
  }
  function paintEarth(c, ex, ey, er) {
    const glow = c.createRadialGradient(ex, ey, er, ex, ey, er * 1.8);
    glow.addColorStop(0, 'rgba(120,180,255,0.35)'); glow.addColorStop(1, 'rgba(120,180,255,0)');
    c.fillStyle = glow; c.beginPath(); c.arc(ex, ey, er * 1.8, 0, Math.PI * 2); c.fill();
    c.save(); c.beginPath(); c.arc(ex, ey, er, 0, Math.PI * 2); c.clip();
    c.fillStyle = '#2b6cc4'; c.fillRect(ex - er, ey - er, er * 2, er * 2);
    c.fillStyle = '#2f9e44';
    c.beginPath(); c.ellipse(ex - 18, ey - 12, 22, 16, 0.4, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(ex + 20, ey + 14, 16, 22, -0.3, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(ex + 8, ey - 30, 14, 8, 0.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 6; i++) { c.beginPath(); c.ellipse(ex - 40 + i * 16, ey - 20 + rnd(i + 70) * 40, 12, 4, 0.3, 0, Math.PI * 2); c.fill(); }
    const term = c.createLinearGradient(ex - er, 0, ex + er, 0);
    term.addColorStop(0, 'rgba(0,0,20,0)'); term.addColorStop(0.65, 'rgba(0,0,20,0)'); term.addColorStop(1, 'rgba(0,0,20,0.75)');
    c.fillStyle = term; c.fillRect(ex - er, ey - er, er * 2, er * 2);
    c.restore();
  }
  function drawSpaceBackdrop(ctx, G, cam) {
    // dense starfield, twinkling
    const t2 = G.time * 2;
    ctx.fillStyle = '#fff';
    for (const s of SPACE_STARS) {
      const sx = ((s.x - cam * 0.03) % 1600 + 1600) % 1600 - 200;
      ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t2 + s.ph));
      ctx.fillRect(sx, s.y, s.s, s.s);
    }
    ctx.globalAlpha = 1;
    // a comet
    const cx = W - ((G.time * 140) % (W + 400)) + 200, cy = 60 + ((G.time * 35) % 120);
    ctx.strokeStyle = 'rgba(180,220,255,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + 60, cy - 18); ctx.stroke();
    ctx.fillStyle = '#e8f4ff'; ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
    // Earth, baked once (glow, oceans, continents, clouds, terminator)
    const er = 54, R2 = er * 1.8, ex = W - 160 - ((cam * 0.02) % 60), ey = 120;
    const earth = tile('earth', R2 * 2, 0, R2 * 2, (c, ox) => { if (ox === 0) paintEarth(c, R2, R2, er); });
    ctx.drawImage(earth.cv, ex - R2, ey - R2, earth.per, earth.h);
    // crater ridges
    blitTile(ctx, ridgeTile('moon-ridge-far', 1500, GY, 130, 120, 12, [3, 6], 'rgba(190,190,205,0.35)'), cam, 0.12);
    blitTile(ctx, ridgeTile('moon-ridge-near', 1100, GY, 70, 72, 12, [3, 15], 'rgba(120,120,135,0.55)'), cam, 0.3);
  }
  function drawTropicsBackdrop(ctx, G, cam) {
    // jungle hills
    blitTile(ctx, ridgeTile('tropics-hills', 1700, GY - 90, 140, 110, 14, [5, 4], 'rgba(20,80,50,0.55)'), cam, 0.12);
    // the canal: a water band with container ships
    ctx.fillStyle = grad(ctx, 'tropics-sea', 0, GY - 120, 0, GY, [0, 'rgba(40,140,170,0.9)', 1, 'rgba(10,60,90,0.95)']);
    ctx.fillRect(0, GY - 120, W, 120);
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(0, GY - 120, W, 1);
    const ships = tile('tropics-ships', 1500, GY - 140, 140, (c, ox) => {
      for (let i = 0; i < 3; i++) {
        const x = ox + rnd(i * 13 + 7) * 1500, w = 160 + rnd(i * 3) * 80, y = GY - 100 + rnd(i + 20) * 30;
        c.fillStyle = 'rgba(20,30,50,0.7)'; c.fillRect(x, y - 12, w, 14);
        c.fillRect(x + w - 30, y - 34, 22, 24);
        for (let k = 0; k < 6; k++) { c.fillStyle = ['#c8102e', '#2b6cc4', '#f2b134', '#2f9e44'][(k + i) % 4]; c.fillRect(x + 10 + k * 22, y - 24, 18, 12); }
      }
    });
    blitTile(ctx, ships, cam, 0.3);
    // palms along the bank
    const palms = tile('tropics-palms', 1100, GY - 195, 195, (c, ox) => {
      for (let i = 0; i < 4; i++) palm(c, ox + rnd(i * 17 + 3) * 1100, GY - 4, 90 + rnd(i + 9) * 60);
    });
    blitTile(ctx, palms, cam, 0.5);
  }
  function drawCanadaBackdrop(ctx, G, cam) {
    // Rockies
    blitTile(ctx, ridgeTile('canada-rockies', 1900, GY - 100, 170, 150, 12, [9, 2], 'rgba(225,235,250,0.55)'), cam, 0.12);
    // mist
    ctx.fillStyle = grad(ctx, 'canada-mist', 0, GY - 150, 0, GY - 40, [0, 'rgba(255,255,255,0)', 1, 'rgba(255,255,255,0.35)']);
    ctx.fillRect(0, GY - 150, W, 110);
    // pine forest, two layers
    for (const [p, per, col, hmul] of [[0.28, 1300, 'rgba(20,60,45,0.55)', 1], [0.45, 900, 'rgba(10,40,30,0.75)', 0.8]]) {
      const pines = tile('canada-pines' + p, per, GY - 200, 200, (c, ox) => {
        for (let i = 0; i < 14; i++) {
          const x = ox + (i / 14) * per + rnd(i * 3 + p * 100) * 40, h = (60 + rnd(i * 7 + p * 10) * 90) * hmul, w = 22 + h * 0.3;
          c.fillStyle = col;
          for (let t = 0; t < 3; t++) {
            const ty = GY - h + (t * h) / 3.2, tw = w * (0.5 + t * 0.25);
            c.beginPath(); c.moveTo(x, ty - h * 0.3); c.lineTo(x - tw / 2, ty + h / 3.2); c.lineTo(x + tw / 2, ty + h / 3.2); c.closePath(); c.fill();
          }
          c.fillStyle = 'rgba(255,255,255,0.25)';
          c.beginPath(); c.moveTo(x, GY - h - h * 0.3); c.lineTo(x - w * 0.18, GY - h - h * 0.05); c.lineTo(x + w * 0.18, GY - h - h * 0.05); c.closePath(); c.fill();
        }
      });
      blitTile(ctx, pines, cam, p);
    }
  }
  function drawCityBackdrop(ctx, cam) {
    blitTile(ctx, ridgeTile('city-hills', 1600, GY, 90, 120, 16, [7, 3], 'rgba(0,0,0,0.22)'), cam, 0.15);
    const buildings = tile('city-buildings', 1200, GY - 195, 195, (c, ox) => {
      let x = ox, i = 0;
      while (x < ox + 1200) {
        const w = 30 + rnd(i * 3 + 11) * 70, h = 40 + rnd(i * 5 + 17) * 150;
        c.fillStyle = 'rgba(0,0,0,0.38)';
        c.fillRect(x, GY - h, w, h);
        c.fillStyle = 'rgba(255,230,120,0.35)';
        for (let wy = GY - h + 10; wy < GY - 10; wy += 16) for (let wx = x + 6; wx < x + w - 8; wx += 12) if (rnd(wx * 0.37 + wy * 0.11 + i) > 0.55) c.fillRect(wx, wy, 4, 6);
        x += w + 12 + rnd(i * 9 + 1) * 40;
        i++;
      }
    });
    blitTile(ctx, buildings, cam, 0.4);
  }
  function drawGulfBackdrop(ctx, G, cam) {
    blitTile(ctx, ridgeTile('gulf-hills', 1800, GY - 120, 150, 70, 12, [5, 9], 'rgba(0,0,0,0.16)'), cam, 0.12);
    ctx.fillStyle = grad(ctx, 'gulf-sea', 0, GY - 130, 0, GY, [0, 'rgba(10,60,80,0.9)', 1, 'rgba(4,25,40,0.95)']);
    ctx.fillRect(0, GY - 130, W, 130);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(0, GY - 130, W, 1);
    // glints shimmer with time, so they stay live
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 40; i++) {
      const sx = ((rnd(i + 300) * 1200 - cam * 0.25) % 1200 + 1200) % 1200 - 100;
      const sy = GY - 125 + rnd(i + 400) * 100;
      const w = 10 + 30 * rnd(i + 500) * (0.5 + 0.5 * Math.sin(G.time * 2 + i));
      ctx.fillRect(sx, sy, w, 1.5);
    }
    // platforms and flare stacks (static), then the flames (animated)
    const per2 = 1500;
    const rigs = tile('gulf-rigs', per2, GY - 205, 205, (c, ox) => {
      for (let i = 0; i < 5; i++) {
        const x = ox + rnd(i * 13 + 7) * per2, w = 70 + rnd(i * 3) * 60, y = GY - 122 + rnd(i + 20) * 30;
        c.fillStyle = 'rgba(0,0,0,0.5)';
        c.fillRect(x, y - 8, w, 8);
        c.fillRect(x + w - 18, y - 22, 12, 14);
        c.fillStyle = 'rgba(255,255,200,0.7)';
        c.fillRect(x + w - 13, y - 26, 2, 2);
      }
      for (let i = 0; i < 3; i++) {
        const x = ox + 200 + i * 480 + rnd(i + 40) * 200;
        c.fillStyle = 'rgba(0,0,0,0.5)';
        c.fillRect(x, GY - 200, 6, 80);
        c.fillRect(x - 10, GY - 130, 26, 12);
      }
    });
    blitTile(ctx, rigs, cam, 0.3);
    const off2 = ((-cam * 0.3) % per2 + per2) % per2;
    for (let k = -1; k <= 1; k++) {
      for (let i = 0; i < 3; i++) {
        const x = off2 + k * per2 + 200 + i * 480 + rnd(i + 40) * 200;
        if (x < -20 || x > W + 20) continue;
        const fl = 0.6 + 0.4 * Math.sin(G.time * 9 + i * 2);
        ctx.fillStyle = rgba(255, 140, 30, 0.7 * fl);
        ctx.beginPath(); ctx.ellipse(x + 3, GY - 208, 6, 10 + 6 * fl, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = rgba(255, 220, 120, 0.8 * fl);
        ctx.beginPath(); ctx.ellipse(x + 3, GY - 206, 3, 6, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  const AURORA = ['90,220,255', '120,255,190', '150,120,255'];
  function drawArcticBackdrop(ctx, G, cam) {
    // aurora ribbons: animated, so drawn live but with a coarser step and cached gradients
    for (let k = 0; k < 3; k++) {
      const baseY = 70 + k * 45, hue = AURORA[k];
      ctx.beginPath();
      for (let x = -24; x <= W + 24; x += 24) {
        const y = baseY + Math.sin(x * 0.012 + G.time * 0.6 + k * 2 - cam * 0.0008) * 22 + Math.sin(x * 0.03 - G.time * 0.4) * 8;
        if (x === -24) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      for (let x = W + 24; x >= -24; x -= 24) {
        const y = baseY + 70 + Math.sin(x * 0.012 + G.time * 0.6 + k * 2 - cam * 0.0008) * 22 + Math.sin(x * 0.025 + G.time * 0.5) * 10;
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = grad(ctx, 'aurora' + k, 0, baseY, 0, baseY + 80, [0, `rgba(${hue},0.0)`, 0.4, `rgba(${hue},0.22)`, 1, `rgba(${hue},0.0)`]);
      ctx.fill();
    }
    // snowy mountains
    blitTile(ctx, ridgeTile('arctic-mts', 1700, GY - 110, 150, 130, 14, [7, 5], 'rgba(230,240,255,0.35)'), cam, 0.15);
    // icy sea band
    ctx.fillStyle = grad(ctx, 'arctic-sea', 0, GY - 120, 0, GY, [0, 'rgba(40,110,150,0.85)', 1, 'rgba(10,40,70,0.95)']);
    ctx.fillRect(0, GY - 120, W, 120);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(0, GY - 120, W, 1);
    // icebergs on the water
    const bergs = tile('arctic-bergs', 1400, GY - 185, 185, (c, ox) => {
      for (let i = 0; i < 6; i++) {
        const x = ox + rnd(i * 11 + 3) * 1400, w = 50 + rnd(i * 5) * 90, h = 25 + rnd(i * 3 + 1) * 45, y = GY - 110 + rnd(i + 30) * 60;
        c.fillStyle = 'rgba(235,248,255,0.9)';
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + w * 0.3, y - h); c.lineTo(x + w * 0.55, y - h * 0.6); c.lineTo(x + w * 0.75, y - h * 0.9); c.lineTo(x + w, y); c.closePath(); c.fill();
        c.fillStyle = 'rgba(120,190,230,0.6)';
        c.fillRect(x + 4, y - 3, w - 8, 3);
      }
    });
    blitTile(ctx, bergs, cam, 0.3);
  }

  const WATER = {
    ice: [0, '#9fd9ff', 0.15, '#2f7fb3', 1, '#0a2a44'],
    syrup: [0, '#f6c65a', 0.15, '#b5721a', 1, '#4a2a08'],
    canal: [0, '#6fc7d8', 0.15, '#2a8fa8', 1, '#0a3a4a'],
    void: [0, '#1a1a3a', 0.2, '#050510', 1, '#000000'],
    sea: [0, '#2d8fa8', 0.15, '#0f5f78', 1, '#03202c'],
  };
  function drawGround(ctx, G, pal, level) {
    const cam = G.camX;
    ctx.fillStyle = pal.ground;
    ctx.fillRect(0, GY, W, H - GY);
    const style = pal.style || 'road';
    const off = -(((cam % B) + B) % B);
    if (style === 'road') {
      ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = off; x < W; x += B) { ctx.moveTo(x + 0.5, GY); ctx.lineTo(x + 0.5, H); }
      ctx.stroke();
    } else if (style === 'grass') {
      ctx.fillStyle = 'rgba(120,220,120,0.35)'; ctx.fillRect(0, GY, W, 8);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      for (let x = off - 40; x < W; x += 20) ctx.fillRect(x + rnd(x + cam) * 8, GY + 10 + rnd(x * 3) * 40, 3, 6);
    } else if (style === 'steel') {
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      for (let x = off; x < W; x += B) ctx.fillRect(x, GY, 1, H - GY);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      for (let x = off - 80; x < W; x += 40) ctx.fillRect(x + 6, GY + 14, 3, 3);
      for (let x = off - 80; x < W; x += 30) { ctx.fillStyle = (Math.round((x - off) / 30) % 2) ? '#ffd400' : '#222'; ctx.fillRect(x, GY + 3, 30, 5); }
    } else if (style === 'deck') {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let x = off - 80; x < W; x += 80) ctx.fillRect(x, GY, 2, H - GY);
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      for (let y = GY + 18; y < H; y += 18) ctx.fillRect(0, y, W, 1);
    } else if (style === 'snow') {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (let i = 0; i < 50; i++) {
        const sx = ((rnd(i + 700) * 1000 - cam) % 1000 + 1000) % 1000 - 20;
        const sy = GY + 6 + rnd(i + 800) * 80;
        const tw = 0.5 + 0.5 * Math.sin(G.time * 5 + i);
        ctx.globalAlpha = 0.3 + 0.6 * tw; ctx.fillRect(sx, sy, 2, 2);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(120,170,220,0.25)'; ctx.fillRect(0, GY + 40, W, H - GY - 40);
    } else if (style === 'concrete') {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      for (let x = off - 160; x < W; x += 160) ctx.fillRect(x, GY, 3, H - GY);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(0, GY, W, 6);
      ctx.fillStyle = 'rgba(255,212,0,0.8)'; for (let x = off - 160; x < W; x += 160) ctx.fillRect(x + 20, GY + 12, 60, 4);
    } else if (style === 'jungle') {
      ctx.fillStyle = 'rgba(120,200,90,0.35)'; ctx.fillRect(0, GY, W, 8);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      for (let x = off - 40; x < W; x += 24) { const hh = 6 + rnd(x + cam) * 10; ctx.fillRect(x + rnd(x * 3) * 8, GY + 8, 3, hh); }
    } else if (style === 'moon') {
      for (let i = 0; i < 14; i++) {
        const sx = ((rnd(i + 1200) * 1100 - cam) % 1100 + 1100) % 1100 - 40, sy = GY + 16 + rnd(i + 1210) * 70, rx = 10 + rnd(i + 1220) * 26;
        ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(sx, sy, rx, rx * 0.4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(sx, sy - 2, rx, rx * 0.4, 0, Math.PI, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let x = off - 60; x < W; x += 30) { ctx.beginPath(); ctx.ellipse(x + 8, GY + 8, 5, 3, 0, 0, Math.PI * 2); ctx.fill(); }
    } else if (style === 'sand') {
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(0, GY, W, 4);
      ctx.strokeStyle = 'rgba(120,80,30,0.35)'; ctx.lineWidth = 1.5;
      for (let x = off - 80; x < W; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, GY + 24); ctx.quadraticCurveTo(x + 20, GY + 14, x + 40, GY + 24); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + 20, GY + 60); ctx.quadraticCurveTo(x + 40, GY + 50, x + 60, GY + 60); ctx.stroke();
      }
    } else if (style === 'ocean') {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
      for (let row = 0; row < 4; row++) {
        ctx.beginPath();
        const y0 = GY + 12 + row * 24;
        for (let x = 0; x <= W; x += 8) ctx.lineTo(x, y0 + Math.sin((x + cam * 0.5) * 0.04 + G.time * 2.5 + row) * 4);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(0, GY, W, 3);
    } else if (style === 'ice') {
      ctx.strokeStyle = 'rgba(80,140,200,0.35)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 12; i++) {
        const sx = ((rnd(i + 900) * 1000 - cam) % 1000 + 1000) % 1000 - 20, sy = GY + 8 + rnd(i + 950) * 60;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 18 + rnd(i) * 20, sy + 10 + rnd(i + 2) * 14); ctx.lineTo(sx + 30 + rnd(i + 3) * 24, sy + 4 + rnd(i + 4) * 30); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(0, GY, W, 5);
    }
    // ice zones: a glossy sheet over the ground where the run speeds up
    if (level && level.zones && level.zones.length) {
      for (const z of level.zones) {
        const l = z.x0 - cam, r = z.x1 - cam;
        if (r < 0 || l > W) continue;
        ctx.fillStyle = grad(ctx, 'ice-zone', 0, GY, 0, H, [0, '#eaf8ff', 0.3, '#9fd8f5', 1, '#2a6a99']);
        ctx.fillRect(l, GY, r - l, H - GY);
        ctx.save(); ctx.beginPath(); ctx.rect(l, GY, r - l, H - GY); ctx.clip();
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2;
        const shift = (G.time * 160) % 90;
        for (let x = l - 120 + shift; x < r + 40; x += 90) { ctx.beginPath(); ctx.moveTo(x, GY + 14); ctx.lineTo(x + 50, GY + 4); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + 20, GY + 40); ctx.lineTo(x + 56, GY + 30); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(40,100,150,0.35)'; ctx.lineWidth = 1.5;
        for (let i = 0; i < 8; i++) { const sx = l + rnd(i + 20) * (r - l), sy = GY + 12 + rnd(i + 21) * 60; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 20, sy + 12); ctx.lineTo(sx + 36, sy + 2); ctx.stroke(); }
        ctx.restore();
        ctx.fillStyle = '#1f6fa8'; roundRect(ctx, l + 6, GY + 8, 92, 22, 5); ctx.fill();
        text(ctx, `ICE  ×${z.m}`, l + 52, GY + 19, `bold 12px ${TITLE_FONT}`, '#eaf8ff', 'center');
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(l - 2, GY, 2, H - GY); ctx.fillRect(r, GY, 2, H - GY);
      }
    }
    // low-gravity fields: a violet haze over the whole play area with drifting motes
    if (level && level.lowg && level.lowg.length) {
      for (const z of level.lowg) {
        const l = z.x0 - cam, r = z.x1 - cam;
        if (r < 0 || l > W) continue;
        ctx.fillStyle = grad(ctx, 'lowg', 0, 0, 0, GY, [0, 'rgba(140,90,255,0.04)', 1, 'rgba(140,90,255,0.22)']);
        ctx.fillRect(l, 0, r - l, GY);
        ctx.save(); ctx.beginPath(); ctx.rect(l, 0, r - l, GY); ctx.clip();
        ctx.fillStyle = 'rgba(220,200,255,0.7)';
        for (let i = 0; i < 40; i++) {
          const mx = l + rnd(i + 1300) * (r - l), my = GY - 20 - ((rnd(i + 1310) * 400 + G.time * (10 + rnd(i) * 20)) % 400);
          ctx.fillRect(mx, my, 2, 2);
        }
        ctx.restore();
        ctx.fillStyle = 'rgba(140,90,255,0.9)'; roundRect(ctx, l + 6, GY - 34, 100, 22, 5); ctx.fill();
        text(ctx, `LOW-G  ÷${z.k}`, l + 56, GY - 23, `bold 12px ${TITLE_FONT}`, '#fff', 'center');
        ctx.fillStyle = 'rgba(200,180,255,0.6)'; ctx.fillRect(l, 0, 2, GY); ctx.fillRect(r - 2, 0, 2, GY);
      }
    }
    ctx.fillStyle = grad(ctx, 'ground-shade', 0, GY, 0, H, [0, 'rgba(0,0,0,0)', 1, 'rgba(0,0,0,0.55)']);
    ctx.fillRect(0, GY, W, H - GY);
    ctx.fillStyle = pal.gline;
    ctx.fillRect(0, GY - 2, W, 3);
    ctx.fillStyle = rgba(255, 255, 255, 0.6 * G.beatPulse);
    ctx.fillRect(0, GY - 2, W, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(0, GY + 1, W, 6);
    // water gaps
    if (level && level.gaps.length) {
      const water = level.def.water || (level.def.backdrop === 'arctic' ? 'ice' : 'sea');
      for (const gp of level.gaps) {
        const l = gp.l - cam, r = gp.r - cam;
        if (r < 0 || l > W) continue;
        ctx.fillStyle = grad(ctx, 'water-' + water, 0, GY - 4, 0, H, WATER[water] || WATER.sea);
        ctx.fillRect(l, GY - 4, r - l, H - GY + 4);
        ctx.save(); ctx.beginPath(); ctx.rect(l, GY - 4, r - l, H - GY + 4); ctx.clip();
        if (water === 'void') {
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          for (let i = 0; i < 12; i++) ctx.fillRect(l + rnd(i + gp.l) * (r - l), GY + 10 + rnd(i + 3 + gp.l) * 80, 2, 2);
        } else {
          ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
          for (let row = 0; row < 3; row++) {
            ctx.beginPath();
            const y0 = GY + 2 + row * 22;
            for (let x = l; x <= r; x += 6) ctx.lineTo(x, y0 + Math.sin((x + cam) * 0.05 + G.time * 3 + row) * 3);
            ctx.stroke();
          }
        }
        ctx.restore();
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(l - 3, GY - 4, 3, 30); ctx.fillRect(r, GY - 4, 3, 30);
      }
    }
  }
  // flight zones: a cloud deck marks the altitude ceiling, and the zone's edges are marked
  function drawFlightZones(ctx, G, level) {
    if (!level || !level.fly || !level.fly.length) return;
    const cam = G.camX;
    for (const z of level.fly) {
      const l = z.x0 - cam, r = z.x1 - cam;
      if (r < 0 || l > W) continue;
      ctx.save(); ctx.beginPath(); ctx.rect(Math.max(-1, l), 0, Math.min(W + 1, r) - Math.max(-1, l), CY + 30); ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(l, 0, r - l, CY - 8);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      const start = Math.floor((Math.max(l, -140) + cam) / 90) * 90 - cam;
      for (let x = start; x < Math.min(r, W) + 140; x += 90) {
        const i = Math.round((x + cam) / 90);
        ctx.beginPath(); ctx.ellipse(x, CY - 14 + rnd(i) * 12, 58 + rnd(i + 3) * 30, 16 + rnd(i + 5) * 10, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.setLineDash([8, 10]);
      ctx.beginPath(); ctx.moveTo(Math.max(0, l), CY); ctx.lineTo(Math.min(W, r), CY); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,212,0,0.6)'; ctx.fillRect(l - 2, 0, 3, GY); ctx.fillRect(r, 0, 3, GY);
    }
  }
  // ice shelf along the top of the screen wherever gravity can be flipped
  function drawCeilings(ctx, G, pal, level) {
    if (!level || !level.ceilings || !level.ceilings.length) return;
    const cam = G.camX;
    for (const s of level.ceilings) {
      const l = s.l - cam, r = s.r - cam;
      if (r < 0 || l > W) continue;
      const rock = level.def.backdrop === 'space';
      ctx.fillStyle = grad(ctx, rock ? 'ceil-rock' : 'ceil-ice', 0, 0, 0, CY, rock ? [0, '#4a4a56', 0.7, '#6e6e7a', 1, '#8a8a90'] : [0, '#f4fbff', 0.7, '#cfe9fb', 1, '#9fd4f5']);
      ctx.fillRect(l, 0, r - l, CY);
      ctx.save(); ctx.beginPath(); ctx.rect(l, 0, r - l, CY + 12); ctx.clip();
      ctx.fillStyle = rock ? '#8a8a90' : '#9fd4f5';
      for (let x = l - 40 + ((cam % 80) + 80) % 80 * 0; x < r + 40; x += 34) {
        ctx.beginPath(); ctx.arc(x, CY - 2, 14, 0, Math.PI); ctx.fill();
      }
      ctx.strokeStyle = rock ? 'rgba(0,0,0,0.3)' : 'rgba(80,140,200,0.3)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 10; i++) {
        const sx = l + rnd(i + 60) * (r - l), sy = 20 + rnd(i + 70) * 90;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 14, sy + 12); ctx.lineTo(sx + 30, sy + 4); ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = pal.gline; ctx.fillRect(l, CY - 1, r - l, 3);
      ctx.fillStyle = rgba(255, 255, 255, 0.6 * G.beatPulse); ctx.fillRect(l, CY - 1, r - l, 3);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(l - 3, 0, 3, CY + 8); ctx.fillRect(r, 0, 3, CY + 8);
    }
  }

  // ---------------- decoration ----------------
  function palm(ctx, x, y, h) {
    ctx.strokeStyle = '#7a5a2b'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 10, y - h / 2, x + 4, y - h); ctx.stroke();
    ctx.fillStyle = '#2f9e44';
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ctx.beginPath(); ctx.ellipse(x + 4 + Math.cos(a) * 18, y - h + Math.sin(a) * 9, 22, 7, a, 0, Math.PI * 2); ctx.fill(); }
  }
  function drawScene(ctx, kind, sx, G) {
    ctx.save();
    switch (kind) {
      case 'whitehouse': {
        const w = 300, h = 120, x = sx - w / 2, y = GY - h;
        ctx.fillStyle = '#e9e9f2'; ctx.fillRect(x, y + 30, w, h - 30);
        ctx.fillStyle = '#d0d0dc'; ctx.fillRect(x + 90, y, 120, 40);
        ctx.fillStyle = '#c8c8d4'; ctx.beginPath(); ctx.moveTo(x + 80, y + 30); ctx.lineTo(x + 150, y - 10); ctx.lineTo(x + 220, y + 30); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f7f7ff'; for (let i = 0; i < 6; i++) ctx.fillRect(x + 95 + i * 20, y + 30, 8, h - 30);
        ctx.fillStyle = '#4a5a8a';
        for (let i = 0; i < 4; i++) { ctx.fillRect(x + 12 + i * 18, y + 45, 10, 18); ctx.fillRect(x + 12 + i * 18, y + 80, 10, 18); ctx.fillRect(x + w - 22 - i * 18, y + 45, 10, 18); ctx.fillRect(x + w - 22 - i * 18, y + 80, 10, 18); }
        ctx.fillStyle = '#888'; ctx.fillRect(x + 150, y - 60, 3, 52);
        ctx.fillStyle = '#c8102e'; ctx.fillRect(x + 153, y - 60, 30, 18);
        ctx.fillStyle = '#fff'; for (let i = 0; i < 3; i++) ctx.fillRect(x + 153, y - 57 + i * 6, 30, 3);
        ctx.fillStyle = '#002868'; ctx.fillRect(x + 153, y - 60, 13, 10);
        break;
      }
      case 'capitol': {
        const x = sx - 200, y = GY - 150;
        ctx.fillStyle = '#e6e6ee'; ctx.fillRect(x, y + 70, 400, 80);
        ctx.fillStyle = '#f2f2f8'; ctx.fillRect(x + 140, y + 40, 120, 110);
        ctx.fillStyle = '#d8d8e4'; ctx.beginPath(); ctx.arc(x + 200, y + 40, 60, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#c4c4d2'; ctx.fillRect(x + 190, y - 40, 20, 24); ctx.fillRect(x + 196, y - 55, 8, 16);
        ctx.fillStyle = '#ffffff'; for (let i = 0; i < 8; i++) ctx.fillRect(x + 150 + i * 14, y + 50, 6, 100);
        for (let i = 0; i < 10; i++) { ctx.fillRect(x + 10 + i * 13, y + 80, 6, 70); ctx.fillRect(x + 265 + i * 13, y + 80, 6, 70); }
        break;
      }
      case 'derricks': {
        for (let k = 0; k < 4; k++) {
          const x = sx + k * 140 - 200, h = 150 + rnd(k) * 60;
          ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(x - 30, GY); ctx.lineTo(x, GY - h); ctx.lineTo(x + 30, GY); ctx.stroke();
          ctx.lineWidth = 2;
          for (let i = 1; i < 5; i++) { const yy = GY - (h * i) / 5, ww = 30 * (1 - i / 5); ctx.beginPath(); ctx.moveTo(x - ww, yy); ctx.lineTo(x + ww, yy); ctx.stroke(); }
          ctx.beginPath(); ctx.moveTo(x - 30, GY); ctx.lineTo(x + 20, GY - h * 0.55); ctx.moveTo(x + 30, GY); ctx.lineTo(x - 20, GY - h * 0.55); ctx.stroke();
        }
        break;
      }
      case 'oilfield': {
        for (let k = 0; k < 3; k++) {
          const x = sx - 150 + k * 130, w = 110, h = 90;
          ctx.fillStyle = '#3b3b44'; roundRect(ctx, x, GY - h, w, h, 8); ctx.fill();
          ctx.fillStyle = '#4b4b56'; ctx.fillRect(x, GY - h + 20, w, 6); ctx.fillRect(x, GY - h + 55, w, 6);
          ctx.fillStyle = '#ffd400'; ctx.fillRect(x + 10, GY - h + 30, w - 20, 18);
          text(ctx, 'PDVSA', x + w / 2, GY - h + 39, `bold 13px ${UI_FONT}`, '#111', 'center');
        }
        break;
      }
      case 'maralago': {
        const w = 340, h = 110, x = sx - w / 2, y = GY - h;
        ctx.fillStyle = '#f2c9a8'; roundRect(ctx, x, y, w, h, 6); ctx.fill();
        ctx.fillStyle = '#b5472a'; ctx.fillRect(x - 8, y - 14, w + 16, 16); ctx.fillRect(x + 120, y - 46, 100, 34);
        ctx.fillStyle = '#f2c9a8'; ctx.fillRect(x + 128, y - 40, 84, 26);
        ctx.fillStyle = '#5a3a2a';
        for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc(x + 30 + i * 47, y + 62, 14, Math.PI, 0); ctx.lineTo(x + 44 + i * 47, y + 100); ctx.lineTo(x + 16 + i * 47, y + 100); ctx.closePath(); ctx.fill(); }
        ctx.fillStyle = '#ffd400'; ctx.fillRect(x + w / 2 - 22, y - 60, 3, 50); ctx.beginPath(); ctx.moveTo(x + w / 2 - 19, y - 60); ctx.lineTo(x + w / 2 + 14, y - 52); ctx.lineTo(x + w / 2 - 19, y - 44); ctx.closePath(); ctx.fill();
        palm(ctx, x - 40, GY, 130); palm(ctx, x + w + 30, GY, 150); palm(ctx, x + w + 90, GY, 110);
        ctx.fillStyle = '#2f9e44'; ctx.fillRect(x - 80, GY - 6, w + 200, 6);
        ctx.fillStyle = '#fff'; ctx.fillRect(x + w + 60, GY - 30, 2, 30); ctx.fillStyle = '#c8102e'; ctx.beginPath(); ctx.moveTo(x + w + 62, GY - 30); ctx.lineTo(x + w + 76, GY - 26); ctx.lineTo(x + w + 62, GY - 22); ctx.closePath(); ctx.fill();
        break;
      }
      case 'pentagon': {
        const cx = sx, cy = GY - 70, R = 130;
        ctx.fillStyle = '#9aa0ad';
        ctx.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5; ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R * 0.45); } ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#b8bec9';
        ctx.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5; ctx.lineTo(cx + Math.cos(a) * R * 0.55, cy + Math.sin(a) * R * 0.25); } ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#6f7684'; ctx.fillRect(cx - R, cy, R * 2, 70);
        ctx.fillStyle = 'rgba(255,240,180,0.5)'; for (let i = 0; i < 16; i++) { ctx.fillRect(cx - R + 8 + i * 16, cy + 12, 6, 8); ctx.fillRect(cx - R + 8 + i * 16, cy + 34, 6, 8); }
        break;
      }
      case 'carrier': {
        ctx.fillStyle = '#5b6470'; ctx.fillRect(sx - 60, GY - 190, 90, 190);
        ctx.fillStyle = '#6f7a88'; ctx.fillRect(sx - 40, GY - 230, 50, 40);
        ctx.fillStyle = '#3d444e'; ctx.fillRect(sx - 20, GY - 290, 6, 60); ctx.fillRect(sx - 44, GY - 262, 54, 4);
        ctx.fillStyle = 'rgba(255,240,180,0.6)'; for (let r = 0; r < 4; r++) for (let i = 0; i < 4; i++) ctx.fillRect(sx - 50 + i * 20, GY - 175 + r * 30, 10, 8);
        ctx.fillStyle = '#c8c8d0';
        for (let k = 0; k < 2; k++) { const x = sx + 90 + k * 110; ctx.beginPath(); ctx.moveTo(x, GY - 8); ctx.lineTo(x + 70, GY - 8); ctx.lineTo(x + 40, GY - 30); ctx.closePath(); ctx.fill(); ctx.fillRect(x + 30, GY - 40, 10, 32); }
        text(ctx, '75', sx - 15, GY - 100, `bold 40px ${TITLE_FONT}`, 'rgba(255,255,255,0.35)', 'center');
        break;
      }
      case 'platform': {
        for (let k = 0; k < 2; k++) {
          const x = sx + k * 260, base = GY - 130;
          ctx.strokeStyle = '#3a3a44'; ctx.lineWidth = 8;
          for (const dx of [-70, -25, 25, 70]) { ctx.beginPath(); ctx.moveTo(x + dx, GY); ctx.lineTo(x + dx * 0.8, base); ctx.stroke(); }
          ctx.fillStyle = '#4b4b56'; ctx.fillRect(x - 90, base - 30, 180, 30);
          ctx.fillStyle = '#5c5c68'; ctx.fillRect(x - 80, base - 80, 70, 50);
          ctx.strokeStyle = '#2a2a30'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 30, base - 30); ctx.lineTo(x + 45, base - 150); ctx.lineTo(x + 60, base - 30); ctx.stroke();
          ctx.fillStyle = '#777'; ctx.fillRect(x + 75, base - 160, 5, 130);
          const fl = 0.6 + 0.4 * Math.sin(G.time * 11 + k);
          ctx.fillStyle = `rgba(255,150,30,${(0.85 * fl).toFixed(2)})`; ctx.beginPath(); ctx.ellipse(x + 77, base - 172, 8, 14 + 8 * fl, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = `rgba(255,230,140,${(0.9 * fl).toFixed(2)})`; ctx.beginPath(); ctx.ellipse(x + 77, base - 168, 4, 8, 0, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case 'missiles': {
        const x = sx;
        ctx.fillStyle = '#3f4a3a'; roundRect(ctx, x - 90, GY - 40, 180, 34, 6); ctx.fill();
        ctx.fillStyle = '#222'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(x - 66 + i * 44, GY - 10, 12, 0, Math.PI * 2); ctx.fill(); }
        ctx.save(); ctx.translate(x - 20, GY - 44); ctx.rotate(-0.9);
        for (let i = 0; i < 3; i++) { ctx.fillStyle = '#9ba4a0'; roundRect(ctx, 0, -8 - i * 16, 130, 12, 6); ctx.fill(); ctx.fillStyle = '#c8102e'; ctx.beginPath(); ctx.moveTo(130, -8 - i * 16); ctx.lineTo(146, -2 - i * 16); ctx.lineTo(130, 4 - i * 16); ctx.closePath(); ctx.fill(); }
        ctx.restore();
        ctx.strokeStyle = '#6b7a6b'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x + 150, GY); ctx.lineTo(x + 150, GY - 90); ctx.stroke();
        ctx.fillStyle = '#8a9a8a'; ctx.beginPath(); ctx.ellipse(x + 150, GY - 100, 26, 14, -0.5 + 0.3 * Math.sin(G.time), 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'tankers': {
        for (let k = 0; k < 2; k++) drawTanker(ctx, sx + k * 320 - 100, GY - 60, 0.55, k ? '#1b5e8a' : '#7a1f1f', G, 0);
        break;
      }
      case 'lander': {
        drawLander(ctx, sx, GY, 1);
        break;
      }
      case 'rocket': {
        const x = sx;
        ctx.fillStyle = '#6a6f78'; ctx.fillRect(x + 70, GY - 300, 14, 300); for (let i = 0; i < 10; i++) ctx.fillRect(x + 40, GY - 290 + i * 30, 44, 4);
        ctx.fillStyle = '#f2f2f5'; roundRect(ctx, x - 24, GY - 250, 48, 250, 8); ctx.fill();
        ctx.fillStyle = '#e67e22'; ctx.fillRect(x - 24, GY - 250, 48, 60); ctx.fillRect(x - 24, GY - 120, 48, 16);
        ctx.fillStyle = '#f2f2f5'; ctx.beginPath(); ctx.moveTo(x - 24, GY - 250); ctx.lineTo(x, GY - 300); ctx.lineTo(x + 24, GY - 250); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e9e9f2'; ctx.fillRect(x - 44, GY - 200, 16, 200); ctx.fillRect(x + 28, GY - 200, 16, 200);
        ctx.fillStyle = '#c8102e'; ctx.fillRect(x - 44, GY - 200, 16, 14); ctx.fillRect(x + 28, GY - 200, 16, 14);
        text(ctx, 'ARTEMIS', x, GY - 150, `bold 10px ${TITLE_FONT}`, '#1b2a4a', 'center');
        ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5; roundRect(ctx, x - 24, GY - 250, 48, 250, 8); ctx.stroke();
        break;
      }
      case 'flag': {
        drawMoonFlag(ctx, sx, GY);
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(sx - 80 + i * 24, GY + 10 + (i % 2) * 6, 6, 3, 0, 0, Math.PI * 2); ctx.fill(); }
        break;
      }
      case 'moonbase': {
        for (let k = 0; k < 2; k++) {
          const x = sx + k * 190, r = 70 - k * 15;
          ctx.fillStyle = '#e9e9f2'; ctx.beginPath(); ctx.arc(x, GY, r, Math.PI, 0); ctx.fill();
          ctx.strokeStyle = '#8a8f94'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, GY, r, Math.PI, 0); ctx.stroke();
          ctx.fillStyle = '#8fd3ff'; ctx.beginPath(); ctx.arc(x - r * 0.3, GY - r * 0.45, 10, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(x + r * 0.3, GY - r * 0.45, 10, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#2b6cc4'; ctx.fillRect(x - r, GY - 8, r * 2, 6);
        }
        ctx.fillStyle = '#1b2a4a'; ctx.fillRect(sx + 90, GY - 110, 4, 110); ctx.fillStyle = '#2b6cc4'; ctx.fillRect(sx + 60, GY - 130, 64, 22);
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; for (let i = 0; i < 4; i++) ctx.fillRect(sx + 62 + i * 16, GY - 128, 12, 18);
        text(ctx, 'OUTPOST 1', sx, GY - 78, `bold 11px ${TITLE_FONT}`, '#1b2a4a', 'center');
        break;
      }
      case 'doha': { // waterfront: stacked museum blocks, palms
        ctx.fillStyle = '#e8dcc4'; ctx.fillRect(sx - 120, GY - 110, 90, 110); ctx.fillRect(sx - 90, GY - 150, 60, 40); ctx.fillRect(sx - 70, GY - 180, 30, 30);
        ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(sx - 120, GY - 110, 90, 6); ctx.fillRect(sx - 90, GY - 150, 60, 6);
        palm(ctx, sx + 10, GY - 2, 120); palm(ctx, sx + 60, GY - 2, 90);
        text(ctx, 'DOHA', sx - 75, GY - 60, `bold 22px ${TITLE_FONT}`, 'rgba(60,40,20,0.5)', 'center');
        break;
      }
      case 'palace': { // domes and arches
        ctx.fillStyle = '#f1e7d0'; ctx.fillRect(sx - 160, GY - 120, 320, 120);
        ctx.fillStyle = '#d8c9a5';
        for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(sx - 120 + i * 60, GY - 60, 18, Math.PI, 0); ctx.fill(); ctx.fillRect(sx - 138 + i * 60, GY - 60, 36, 60); }
        ctx.fillStyle = '#c9a227'; ctx.beginPath(); ctx.arc(sx, GY - 120, 60, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#8d1b3d'; ctx.beginPath(); ctx.arc(sx - 130, GY - 120, 26, Math.PI, 0); ctx.fill(); ctx.beginPath(); ctx.arc(sx + 130, GY - 120, 26, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#ffd400'; ctx.fillRect(sx - 3, GY - 200, 6, 22); ctx.beginPath(); ctx.arc(sx, GY - 204, 6, 0, Math.PI * 2); ctx.fill();
        text(ctx, 'AMIRI DIWAN', sx, GY - 96, `bold 14px ${UI_FONT}`, 'rgba(90,60,20,0.7)', 'center');
        break;
      }
      case 'atlantic': { // a tanker far below the flight path
        drawTanker(ctx, sx, GY - 6, 0.55, '#3a4a6a', G, 1, null, false);
        break;
      }
      case 'dc': { // the Capitol and the Monument
        ctx.fillStyle = 'rgba(240,240,245,0.85)';
        ctx.fillRect(sx - 160, GY - 70, 320, 70); ctx.fillRect(sx - 60, GY - 120, 120, 50);
        ctx.beginPath(); ctx.arc(sx, GY - 120, 50, Math.PI, 0); ctx.fill(); ctx.fillRect(sx - 4, GY - 190, 8, 24);
        ctx.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 12; i++) ctx.fillRect(sx - 150 + i * 26, GY - 62, 6, 62);
        ctx.fillStyle = 'rgba(240,240,245,0.85)'; ctx.fillRect(sx + 300, GY - 230, 16, 230);
        ctx.beginPath(); ctx.moveTo(sx + 300, GY - 230); ctx.lineTo(sx + 308, GY - 250); ctx.lineTo(sx + 316, GY - 230); ctx.fill();
        break;
      }
      case 'canalsign': {
        const x = sx;
        ctx.fillStyle = '#888'; ctx.fillRect(x - 150, GY - 200, 8, 200); ctx.fillRect(x + 142, GY - 200, 8, 200);
        ctx.fillStyle = '#1b4f8a'; roundRect(ctx, x - 170, GY - 250, 340, 70, 8); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; roundRect(ctx, x - 164, GY - 244, 328, 58, 6); ctx.stroke();
        text(ctx, 'CANAL DE PANAMÁ', x, GY - 226, `bold 24px ${TITLE_FONT}`, '#fff', 'center');
        text(ctx, 'ATLANTIC ↔ PACIFIC  ·  FEES APPLY', x, GY - 200, `bold 11px ${UI_FONT}`, '#cfe3ff', 'center');
        // flag
        ctx.fillStyle = '#888'; ctx.fillRect(x + 190, GY - 240, 3, 240);
        ctx.fillStyle = '#fff'; ctx.fillRect(x + 193, GY - 240, 44, 30);
        ctx.fillStyle = '#c8102e'; ctx.fillRect(x + 215, GY - 240, 22, 15);
        ctx.fillStyle = '#1b4f8a'; ctx.fillRect(x + 193, GY - 225, 22, 15);
        break;
      }
      case 'miraflores': {
        const x = sx - 120, y = GY - 110;
        ctx.fillStyle = '#e6e6ee'; ctx.fillRect(x, y, 240, 110);
        ctx.fillStyle = '#c8c8d4'; ctx.fillRect(x - 10, y - 12, 260, 12);
        ctx.fillStyle = 'rgba(60,110,160,0.6)'; for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) ctx.fillRect(x + 14 + i * 38, y + 12 + r * 32, 24, 18);
        text(ctx, 'MIRAFLORES VISITOR CENTER', x + 120, y - 6, `bold 11px ${UI_FONT}`, '#333', 'center');
        ctx.fillStyle = '#9a9ea3'; ctx.fillRect(x + 250, GY - 60, 90, 60); ctx.fillStyle = '#ffd400'; ctx.fillRect(x + 250, GY - 60, 90, 5);
        break;
      }
      case 'ship': {
        drawTanker(ctx, sx - 220, GY - 60, 0.6, '#1b3a6e', G, 0, 'CARGO');
        break;
      }
      case 'bridge': {
        ctx.strokeStyle = '#7a7f84'; ctx.lineWidth = 10;
        ctx.beginPath(); ctx.moveTo(sx - 300, GY - 130); ctx.quadraticCurveTo(sx, GY - 330, sx + 300, GY - 130); ctx.stroke();
        ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(sx - 320, GY - 150); ctx.lineTo(sx + 320, GY - 150); ctx.stroke();
        ctx.lineWidth = 2; for (let i = -6; i <= 6; i++) { const x = sx + i * 44; const arcY = GY - 130 - (1 - (i / 6) * (i / 6)) * 190; ctx.beginPath(); ctx.moveTo(x, arcY); ctx.lineTo(x, GY - 150); ctx.stroke(); }
        text(ctx, 'BRIDGE OF THE AMERICAS', sx, GY - 168, `bold 11px ${UI_FONT}`, '#fff', 'center', 'rgba(0,0,0,0.6)', 3);
        break;
      }
      case 'border': {
        // Peace Arch style gate with a bilingual welcome
        const x = sx;
        ctx.fillStyle = '#f2f2f5'; ctx.fillRect(x - 130, GY - 170, 40, 170); ctx.fillRect(x + 90, GY - 170, 40, 170);
        ctx.beginPath(); ctx.moveTo(x - 130, GY - 170); ctx.quadraticCurveTo(x, GY - 260, x + 130, GY - 170); ctx.lineTo(x + 90, GY - 170); ctx.quadraticCurveTo(x, GY - 230, x - 90, GY - 170); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2; ctx.strokeRect(x - 130, GY - 170, 40, 170); ctx.strokeRect(x + 90, GY - 170, 40, 170);
        ctx.fillStyle = '#146b3a'; roundRect(ctx, x - 120, GY - 150, 240, 46, 6); ctx.fill();
        text(ctx, 'WELCOME TO CANADA', x, GY - 136, `bold 16px ${TITLE_FONT}`, '#fff', 'center');
        text(ctx, 'BIENVENUE · SORRY', x, GY - 117, `bold 11px ${UI_FONT}`, '#cfe9d6', 'center');
        // flags: US on the left post, Canada on the right post
        ctx.fillStyle = '#888'; ctx.fillRect(x - 112, GY - 240, 3, 70); ctx.fillRect(x + 108, GY - 240, 3, 70);
        ctx.fillStyle = '#c8102e'; ctx.fillRect(x - 109, GY - 240, 36, 22);
        ctx.fillStyle = '#fff'; for (let i = 0; i < 4; i++) ctx.fillRect(x - 109, GY - 237 + i * 6, 36, 3);
        ctx.fillStyle = '#002868'; ctx.fillRect(x - 109, GY - 240, 15, 12);
        ctx.fillStyle = '#fff'; ctx.fillRect(x + 111, GY - 240, 36, 22);
        ctx.fillStyle = '#c8102e'; ctx.fillRect(x + 111, GY - 240, 9, 22); ctx.fillRect(x + 138, GY - 240, 9, 22);
        ctx.beginPath(); ctx.moveTo(x + 129, GY - 236); ctx.lineTo(x + 134, GY - 229); ctx.lineTo(x + 131, GY - 229); ctx.lineTo(x + 131, GY - 222); ctx.lineTo(x + 127, GY - 222); ctx.lineTo(x + 127, GY - 229); ctx.lineTo(x + 124, GY - 229); ctx.closePath(); ctx.fill();
        break;
      }
      case 'parliament': {
        const x = sx - 240, y = GY - 130;
        ctx.fillStyle = '#d9c9a3'; ctx.fillRect(x, y, 480, 130);
        ctx.fillStyle = '#3f8f7a'; ctx.fillRect(x - 6, y - 18, 492, 18);
        for (let i = 0; i < 14; i++) { ctx.fillStyle = '#4a5a8a'; ctx.beginPath(); ctx.moveTo(x + 14 + i * 34, y + 40); ctx.lineTo(x + 22 + i * 34, y + 26); ctx.lineTo(x + 30 + i * 34, y + 40); ctx.lineTo(x + 30 + i * 34, y + 80); ctx.lineTo(x + 14 + i * 34, y + 80); ctx.closePath(); ctx.fill(); }
        // Peace Tower
        ctx.fillStyle = '#c9b88f'; ctx.fillRect(x + 210, y - 170, 60, 170);
        ctx.fillStyle = '#3f8f7a'; ctx.beginPath(); ctx.moveTo(x + 204, y - 170); ctx.lineTo(x + 240, y - 240); ctx.lineTo(x + 276, y - 170); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + 240, y - 120, 14, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 240, y - 120); ctx.lineTo(x + 240, y - 130); ctx.moveTo(x + 240, y - 120); ctx.lineTo(x + 247, y - 116); ctx.stroke();
        ctx.fillStyle = '#c8102e'; ctx.fillRect(x + 238, y - 262, 3, 24); ctx.fillRect(x + 241, y - 262, 18, 11);
        break;
      }
      case 'rink': {
        const x = sx - 260;
        ctx.fillStyle = '#f4f8ff'; ctx.fillRect(x, GY - 62, 520, 62);
        ctx.fillStyle = '#c8102e'; ctx.fillRect(x, GY - 34, 520, 4);
        ctx.fillStyle = '#2b6cc4'; ctx.fillRect(x + 120, GY - 62, 6, 62); ctx.fillRect(x + 394, GY - 62, 6, 62);
        ctx.fillStyle = '#ffd400'; ctx.fillRect(x, GY - 66, 520, 4);
        ctx.strokeStyle = '#c8102e'; ctx.lineWidth = 4; ctx.strokeRect(x + 236, GY - 58, 40, 50);
        ctx.strokeStyle = 'rgba(200,16,46,0.5)'; ctx.lineWidth = 1; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(x + 240 + i * 7, GY - 56); ctx.lineTo(x + 240 + i * 7, GY - 10); ctx.stroke(); }
        ctx.fillStyle = '#222'; ctx.fillRect(x + 200, GY - 150, 120, 50);
        text(ctx, 'HOME 0  AWAY 51', x + 260, GY - 125, `bold 12px ${TITLE_FONT}`, '#ff4d4d', 'center');
        break;
      }
      case 'forest': {
        for (let k = 0; k < 4; k++) {
          const x = sx - 200 + k * 140, h = 130 + rnd(k + 5) * 80, w = 70;
          ctx.fillStyle = '#1e5a3a';
          for (let t = 0; t < 3; t++) { const ty = GY - h + (t * h) / 3.2, tw = w * (0.5 + t * 0.25); ctx.beginPath(); ctx.moveTo(x, ty - h * 0.3); ctx.lineTo(x - tw / 2, ty + h / 3.2); ctx.lineTo(x + tw / 2, ty + h / 3.2); ctx.closePath(); ctx.fill(); }
          ctx.fillStyle = '#5a3a1a'; ctx.fillRect(x - 6, GY - 20, 12, 20);
          ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.moveTo(x, GY - h * 1.3); ctx.lineTo(x - w * 0.16, GY - h * 1.05); ctx.lineTo(x + w * 0.16, GY - h * 1.05); ctx.closePath(); ctx.fill();
        }
        // sugar shack
        ctx.fillStyle = '#6b3a1a'; ctx.fillRect(sx + 320, GY - 70, 90, 70);
        ctx.fillStyle = '#8b1a1a'; ctx.beginPath(); ctx.moveTo(sx + 312, GY - 70); ctx.lineTo(sx + 365, GY - 110); ctx.lineTo(sx + 418, GY - 70); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f2b134'; ctx.fillRect(sx + 350, GY - 40, 20, 40);
        ctx.fillStyle = '#999'; ctx.fillRect(sx + 390, GY - 100, 10, 34);
        break;
      }
      case 'nuuk': {
        const colors = ['#c8102e', '#f2b134', '#2b6cc4', '#2f9e44', '#8e44ad', '#e67e22'];
        for (let i = 0; i < 6; i++) {
          const x = sx - 200 + i * 70, w = 56, h = 60 + rnd(i + 7) * 40;
          ctx.fillStyle = colors[i]; ctx.fillRect(x, GY - h, w, h);
          ctx.fillStyle = '#3a3a44'; ctx.beginPath(); ctx.moveTo(x - 4, GY - h); ctx.lineTo(x + w / 2, GY - h - 26); ctx.lineTo(x + w + 4, GY - h); ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(255,240,180,0.85)'; ctx.fillRect(x + 12, GY - h + 16, 12, 14); ctx.fillRect(x + 32, GY - h + 16, 12, 14);
        }
        ctx.fillStyle = '#e9e9f2'; ctx.fillRect(sx + 230, GY - 90, 60, 90); ctx.fillStyle = '#3a3a44'; ctx.beginPath(); ctx.moveTo(sx + 226, GY - 90); ctx.lineTo(sx + 260, GY - 150); ctx.lineTo(sx + 294, GY - 90); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillRect(sx + 258, GY - 172, 4, 24); ctx.fillRect(sx + 251, GY - 166, 18, 4);
        break;
      }
      case 'folketing': {
        const x = sx - 220, y = GY - 140;
        ctx.fillStyle = '#d9d4c7'; ctx.fillRect(x, y, 440, 140);
        ctx.fillStyle = '#c4beae'; ctx.fillRect(x, y - 16, 440, 16);
        ctx.fillStyle = '#8a8474'; ctx.fillRect(x + 200, y - 120, 40, 104); ctx.beginPath(); ctx.moveTo(x + 196, y - 120); ctx.lineTo(x + 220, y - 200); ctx.lineTo(x + 244, y - 120); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(60,70,90,0.6)'; for (let i = 0; i < 12; i++) { ctx.fillRect(x + 16 + i * 36, y + 20, 14, 30); ctx.fillRect(x + 16 + i * 36, y + 70, 14, 30); }
        ctx.fillStyle = '#c8102e'; ctx.fillRect(x + 232, y - 196, 22, 14); ctx.fillStyle = '#fff'; ctx.fillRect(x + 232, y - 191, 22, 4); ctx.fillRect(x + 238, y - 196, 4, 14);
        break;
      }
      case 'icebergs': {
        for (let k = 0; k < 3; k++) {
          const x = sx - 150 + k * 220, w = 150 + rnd(k + 9) * 60, h = 90 + rnd(k + 4) * 70;
          ctx.fillStyle = '#eaf7ff';
          ctx.beginPath(); ctx.moveTo(x, GY); ctx.lineTo(x + w * 0.2, GY - h * 0.7); ctx.lineTo(x + w * 0.4, GY - h); ctx.lineTo(x + w * 0.6, GY - h * 0.6); ctx.lineTo(x + w * 0.8, GY - h * 0.85); ctx.lineTo(x + w, GY); ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(120,190,230,0.45)';
          ctx.beginPath(); ctx.moveTo(x + w * 0.4, GY - h); ctx.lineTo(x + w * 0.6, GY - h * 0.6); ctx.lineTo(x + w * 0.8, GY - h * 0.85); ctx.lineTo(x + w, GY); ctx.lineTo(x + w * 0.55, GY); ctx.closePath(); ctx.fill();
        }
        break;
      }
    }
    ctx.restore();
  }
  // Apollo-style lunar module, feet on `gy`, scaled by s
  function drawLander(ctx, x, gy, s) {
    ctx.save(); ctx.translate(x, gy); ctx.scale(s, s);
    ctx.strokeStyle = '#9a9ea3'; ctx.lineWidth = 5;
    for (const dx of [-70, 70]) { ctx.beginPath(); ctx.moveTo(dx * 0.5, -70); ctx.lineTo(dx, -6); ctx.stroke(); ctx.fillStyle = '#c9c9d4'; ctx.beginPath(); ctx.ellipse(dx, -4, 14, 5, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#d4a017';
    ctx.beginPath(); ctx.moveTo(-50, -70); ctx.lineTo(-32, -110); ctx.lineTo(32, -110); ctx.lineTo(50, -70); ctx.lineTo(32, -40); ctx.lineTo(-32, -40); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 6; i++) ctx.fillRect(-46 + i * 16, -100 + (i % 2) * 8, 10, 44);
    ctx.fillStyle = '#c9c9d4'; roundRect(ctx, -34, -170, 68, 62, 8); ctx.fill();
    ctx.fillStyle = '#9a9ea3'; ctx.fillRect(-34, -150, 68, 6);
    ctx.fillStyle = '#1b2a4a'; ctx.beginPath(); ctx.moveTo(-26, -160); ctx.lineTo(-10, -160); ctx.lineTo(-14, -140); ctx.lineTo(-26, -140); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(26, -160); ctx.lineTo(10, -160); ctx.lineTo(14, -140); ctx.lineTo(26, -140); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c8102e'; ctx.fillRect(-8, -132, 16, 20);
    ctx.strokeStyle = '#9a9ea3'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(30, -170); ctx.lineTo(48, -200); ctx.stroke();
    ctx.fillStyle = '#e9e9f2'; ctx.beginPath(); ctx.ellipse(52, -204, 12, 6, -0.6, 0, Math.PI * 2); ctx.fill();
    text(ctx, 'U.S.A.', 0, -122, `bold 9px ${TITLE_FONT}`, '#fff', 'center');
    ctx.restore();
  }
  function drawMoonFlag(ctx, x, gy) {
    ctx.fillStyle = '#c9c9d4'; ctx.fillRect(x - 2, gy - 150, 4, 150);
    ctx.fillRect(x, gy - 150, 60, 3);
    ctx.fillStyle = '#c8102e'; ctx.fillRect(x + 2, gy - 148, 58, 36);
    ctx.fillStyle = '#fff'; for (let i = 0; i < 4; i++) ctx.fillRect(x + 2, gy - 143 + i * 9, 58, 4);
    ctx.fillStyle = '#002868'; ctx.fillRect(x + 2, gy - 148, 24, 20);
    ctx.fillStyle = '#fff'; for (let i = 0; i < 6; i++) ctx.fillRect(x + 5 + (i % 3) * 7, gy - 145 + Math.floor(i / 3) * 8, 2, 2);
  }
  function drawSign(ctx, o, sx) {
    ctx.fillStyle = '#6b4a2b';
    ctx.fillRect(sx - 3, GY - 70, 6, 70);
    ctx.font = `bold 13px ${UI_FONT}`;
    const w = Math.max(90, ctx.measureText(o.text).width + 22);
    ctx.fillStyle = '#a8713d';
    roundRect(ctx, sx - w / 2, GY - 100, w, 40, 5); ctx.fill();
    ctx.strokeStyle = '#4a2f18'; ctx.lineWidth = 2; ctx.stroke();
    text(ctx, o.text, sx, GY - 88, `bold 13px ${UI_FONT}`, '#fff8e6', 'center');
    if (o.sub) text(ctx, o.sub, sx, GY - 71, `11px ${UI_FONT}`, '#ffe9c4', 'center');
  }

  // ---------------- objects ----------------
  function drawBear(ctx, x, base, flip) {
    ctx.save();
    ctx.translate(x + B / 2, base);
    if (flip) ctx.scale(1, -1);
    ctx.fillStyle = '#f7fbff';
    ctx.beginPath(); ctx.ellipse(0, -14, 19, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(14, -24, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(-15, -12, 7, 12); ctx.fillRect(-2, -12, 7, 12); ctx.fillRect(8, -12, 7, 12);
    ctx.beginPath(); ctx.arc(9, -31, 3, 0, Math.PI * 2); ctx.arc(19, -31, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(21, -22, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(15, -26, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(0, -14, 19, 12, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  function drawMountie(ctx, x, base, flip) {
    ctx.save();
    ctx.translate(x + B / 2, base);
    if (flip) ctx.scale(1, -1);
    ctx.fillStyle = '#111'; ctx.fillRect(-9, -10, 7, 10); ctx.fillRect(2, -10, 7, 10);
    ctx.fillStyle = '#1b2a4a'; ctx.fillRect(-9, -20, 18, 11);
    ctx.fillStyle = '#c8102e'; ctx.fillRect(-11, -34, 22, 15);
    ctx.fillStyle = '#5a3a1a'; ctx.fillRect(-12, -28, 24, 3);
    ctx.fillStyle = '#f2c9a8'; ctx.fillRect(-6, -44, 12, 10);
    ctx.fillStyle = '#7a4a1a'; ctx.fillRect(-13, -46, 26, 3); ctx.fillRect(-7, -52, 14, 6);
    ctx.fillStyle = '#111'; ctx.fillRect(-3, -41, 2, 2); ctx.fillRect(2, -41, 2, 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1; ctx.strokeRect(-11, -34, 22, 15);
    ctx.restore();
  }
  function drawCroc(ctx, x, base, flip) {
    ctx.save();
    ctx.translate(x + B / 2, base);
    if (flip) ctx.scale(1, -1);
    ctx.fillStyle = '#2f7a3a';
    ctx.beginPath(); ctx.ellipse(-2, -10, 20, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(10, -14); ctx.lineTo(26, -8); ctx.lineTo(10, -4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1f5a2a'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-16 + i * 8, -18); ctx.lineTo(-12 + i * 8, -26); ctx.lineTo(-8 + i * 8, -18); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = '#fff'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(12 + i * 4, -8); ctx.lineTo(14 + i * 4, -4); ctx.lineTo(16 + i * 4, -8); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = '#ffd400'; ctx.beginPath(); ctx.arc(6, -14, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(7, -14, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function drawAlien(ctx, x, base, flip, G) {
    ctx.save();
    ctx.translate(x + B / 2, base);
    if (flip) ctx.scale(1, -1);
    const wob = Math.sin(G.time * 8 + x) * 2;
    ctx.fillStyle = '#5ee36a';
    ctx.beginPath(); ctx.ellipse(0, -18 + wob, 14, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, -34 + wob, 12, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#5ee36a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-6, -40 + wob); ctx.lineTo(-10, -52 + wob); ctx.moveTo(6, -40 + wob); ctx.lineTo(10, -52 + wob); ctx.stroke();
    ctx.fillStyle = '#ff2d95'; ctx.beginPath(); ctx.arc(-10, -52 + wob, 3, 0, Math.PI * 2); ctx.arc(10, -52 + wob, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(-5, -35 + wob, 4, 5, 0.3, 0, Math.PI * 2); ctx.ellipse(5, -35 + wob, 4, 5, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(-6, -37 + wob, 2, 2); ctx.fillRect(4, -37 + wob, 2, 2);
    ctx.fillStyle = '#2f9e44'; ctx.fillRect(-10, -4, 6, 4); ctx.fillRect(4, -4, 6, 4);
    ctx.restore();
  }
  function drawSpike(ctx, o, sx, pal) {
    const x = sx, base = o.base;
    if (o.skin === 'bear') { drawBear(ctx, x, base, o.flip); return; }
    if (o.skin === 'mountie') { drawMountie(ctx, x, base, o.flip); return; }
    if (o.skin === 'croc') { drawCroc(ctx, x, base, o.flip); return; }
    if (o.skin === 'alien') { drawAlien(ctx, x, base, o.flip, pal.G || { time: 0 }); return; }
    ctx.beginPath();
    if (o.flip) { ctx.moveTo(x, base); ctx.lineTo(x + B / 2, base + B); ctx.lineTo(x + B, base); }
    else { ctx.moveTo(x, base); ctx.lineTo(x + B / 2, base - B); ctx.lineTo(x + B, base); }
    ctx.closePath();
    ctx.fillStyle = grad(ctx, `spike|${o.flip ? 1 : 0}|${base}|${pal.spike}|${pal.accent}`, 0, o.flip ? base + B : base - B, 0, base, [0, pal.spike, 1, pal.accent]);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.stroke();
  }
  function labelAbove(ctx, str, cx, y, font, color) {
    text(ctx, str, cx, y, font || `bold 12px ${UI_FONT}`, color || '#ffffff', 'center', 'rgba(0,0,0,0.8)', 3);
  }
  function parchment(ctx, x, y, w, h, fill, edge) {
    ctx.fillStyle = fill; roundRect(ctx, x, y, w, h, 4); ctx.fill();
    ctx.strokeStyle = edge; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(x + 2, y + 2, w - 4, 5); ctx.fillRect(x + 2, y + h - 7, w - 4, 5);
    ctx.strokeStyle = 'rgba(90,60,20,0.45)'; ctx.lineWidth = 1;
    for (let ly = y + 12; ly < y + h - 8; ly += 6) { ctx.beginPath(); ctx.moveTo(x + 6, ly); ctx.lineTo(x + w - 6, ly); ctx.stroke(); }
  }
  function column(ctx, x, y, w, h, marble, cap) {
    ctx.fillStyle = marble; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let cx = x + 6; cx < x + w - 4; cx += 10) ctx.fillRect(cx, y + 10, 3, h - 16);
    ctx.fillStyle = cap; ctx.fillRect(x - 3, y, w + 6, 8); ctx.fillRect(x - 2, y + h - 6, w + 4, 6);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
  }
  function drawBlock(ctx, o, sx, pal) {
    const x = sx, y = o.top, w = o.r - o.l, h = o.bot - o.top;
    ctx.save();
    switch (o.skin) {
      case 'constitution': case 'wall': case 'warpowers': {
        parchment(ctx, x, y, w, h, '#f1e3bb', '#8a6d3b');
        if (o.skin === 'wall') {
          ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(-Math.PI / 2);
          text(ctx, 'ARTICLE I', 0, 0, `bold 15px ${SERIF}`, '#5a3a10', 'center'); ctx.restore();
        } else if (o.skin === 'warpowers') {
          text(ctx, 'WAR', x + w / 2, y + 14, `bold 10px ${SERIF}`, '#4a3010', 'center');
          text(ctx, 'POWERS', x + w / 2, y + 26, `bold 9px ${SERIF}`, '#4a3010', 'center');
        } else {
          text(ctx, 'We the', x + w / 2, y + 14, `italic bold 10px ${SERIF}`, '#4a3010', 'center');
          text(ctx, 'People', x + w / 2, y + 26, `italic bold 10px ${SERIF}`, '#4a3010', 'center');
        }
        ctx.fillStyle = '#c8102e'; ctx.beginPath(); ctx.arc(x + w - 8, y + h - 8, 5, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'aumf': {
        ctx.fillStyle = '#e8c88a'; roundRect(ctx, x, y + 6, w, h - 6, 3); ctx.fill();
        ctx.fillRect(x, y, w * 0.5, 8);
        ctx.strokeStyle = '#8a6d3b'; ctx.lineWidth = 2; roundRect(ctx, x, y + 6, w, h - 6, 3); ctx.stroke();
        ctx.save(); ctx.translate(x + w / 2, y + h / 2 + 3); ctx.rotate(-0.25);
        text(ctx, 'AUMF', 0, 0, `bold 12px ${TITLE_FONT}`, '#c8102e', 'center'); ctx.strokeStyle = '#c8102e'; ctx.lineWidth = 1.5; ctx.strokeRect(-17, -8, 34, 16); ctx.restore();
        break;
      }
      case 'intel': {
        ctx.fillStyle = '#2f3542'; roundRect(ctx, x, y, w, h, 3); ctx.fill();
        ctx.fillStyle = '#c8102e'; ctx.fillRect(x, y + 6, w, 10);
        text(ctx, 'TOP SECRET', x + w / 2, y + 11, `bold 6px ${UI_FONT}`, '#fff', 'center');
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; for (let ly = y + 22; ly < y + h - 4; ly += 5) ctx.fillRect(x + 5, ly, w - 10 - (ly % 3) * 3, 2);
        ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
        break;
      }
      case 'congress': case 'court': case 'hearing': case 'folketing': {
        const marble = o.skin === 'court' ? '#dfe3ea' : o.skin === 'hearing' ? '#e8e2d2' : o.skin === 'folketing' ? '#e4dfd3' : '#efe9dc';
        column(ctx, x, y, w, h, marble, o.skin === 'court' ? '#b8bfcc' : o.skin === 'folketing' ? '#b9b2a2' : '#cbbf9f');
        if (o.skin === 'court') {
          ctx.fillStyle = '#6b3d1a'; ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(-0.6);
          ctx.fillRect(-3, -2, 26, 5); ctx.fillRect(-14, -9, 14, 18); ctx.restore();
        }
        if (o.skin === 'hearing') { ctx.fillStyle = '#222'; ctx.fillRect(x + w / 2 - 3, y + h / 2 - 6, 6, 10); ctx.fillRect(x + w / 2 - 1, y + h / 2 + 4, 2, 8); ctx.fillRect(x + w / 2 - 6, y + h / 2 + 11, 12, 2); }
        if (o.skin === 'folketing') { ctx.fillStyle = '#c8102e'; ctx.fillRect(x + w / 2 - 9, y + h / 2 - 6, 18, 12); ctx.fillStyle = '#fff'; ctx.fillRect(x + w / 2 - 9, y + h / 2 - 1, 18, 2); ctx.fillRect(x + w / 2 - 4, y + h / 2 - 6, 2, 12); }
        break;
      }
      case 'law': case 'un': {
        ctx.fillStyle = o.skin === 'un' ? '#5b92e5' : '#2b6cc4'; roundRect(ctx, x, y, w, h, 4); ctx.fill();
        ctx.strokeStyle = '#0d2f66'; ctx.lineWidth = 2; ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.5;
        const cx = x + w / 2, cy = o.skin === 'un' ? y + 28 : y + h / 2;
        ctx.beginPath(); ctx.arc(cx, cy, 13, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(cx, cy, 6, 13, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx - 13, cy); ctx.lineTo(cx + 13, cy); ctx.stroke();
        if (o.skin === 'un') { ctx.save(); ctx.translate(cx, y + h / 2 + 24); ctx.rotate(-Math.PI / 2); text(ctx, 'VETO', 0, 0, `bold 14px ${TITLE_FONT}`, 'rgba(255,255,255,0.9)', 'center'); ctx.restore(); }
        break;
      }
      case 'nej': {
        ctx.fillStyle = '#c8102e'; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#fff'; ctx.fillRect(x, y + h * 0.42, w, h * 0.16); ctx.fillRect(x + w * 0.3, y, w * 0.16, h);
        ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(-Math.PI / 2);
        text(ctx, 'NEJ', 0, 0, `bold 20px ${TITLE_FONT}`, '#fff', 'center', '#7a0a1a', 5); ctx.restore();
        ctx.strokeStyle = '#4a0a12'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
        break;
      }
      case 'sale': {
        ctx.fillStyle = '#fffdf5'; roundRect(ctx, x, y, w, h, 3); ctx.fill();
        ctx.strokeStyle = '#c8102e'; ctx.lineWidth = 3; roundRect(ctx, x + 2, y + 2, w - 4, h - 4, 3); ctx.stroke();
        text(ctx, 'NOT', x + w / 2, y + 11, `bold 10px ${TITLE_FONT}`, '#c8102e', 'center');
        text(ctx, 'FOR', x + w / 2, y + 21, `bold 10px ${TITLE_FONT}`, '#c8102e', 'center');
        text(ctx, 'SALE', x + w / 2, y + 31, `bold 10px ${TITLE_FONT}`, '#c8102e', 'center');
        break;
      }
      case 'inatsisartut': {
        ctx.fillStyle = '#6b4a2b'; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#8fd3ff'; ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(x + 6, y + 6, 6, h - 12);
        ctx.fillStyle = '#c8102e'; ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillRect(x + w / 2 - 7, y + h / 2, 14, 7);
        ctx.strokeStyle = '#3a2a10'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
        break;
      }
      case 'budget': {
        ctx.fillStyle = '#c8102e'; roundRect(ctx, x, y, w, h, 3); ctx.fill();
        text(ctx, 'NASA', x + w / 2, y + 12, `bold 11px ${TITLE_FONT}`, '#fff', 'center');
        text(ctx, '$', x + w / 2, y + 28, `bold 16px ${TITLE_FONT}`, '#fff', 'center');
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 8, y + 36); ctx.lineTo(x + w - 8, y + 20); ctx.stroke();
        ctx.strokeStyle = '#4a0a12'; ctx.lineWidth = 2; roundRect(ctx, x, y, w, h, 3); ctx.stroke();
        break;
      }
      case 'rocket': {
        for (let by = 0; by < o.h; by++) for (let bxi = 0; bxi < o.w; bxi++) {
          const bx0 = x + bxi * B, by0 = y + by * B;
          ctx.fillStyle = '#f2f2f5'; ctx.fillRect(bx0 + 1, by0 + 1, B - 2, B - 2);
          ctx.fillStyle = '#e67e22'; ctx.fillRect(bx0 + 1, by0 + 14, B - 2, 12);
          ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 6; i < B; i += 10) ctx.fillRect(bx0 + i, by0 + 5, 2, 2);
          ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5; ctx.strokeRect(bx0 + 1, by0 + 1, B - 2, B - 2);
        }
        break;
      }
      case 'regolith': {
        for (let by = 0; by < o.h; by++) for (let bxi = 0; bxi < o.w; bxi++) {
          const bx0 = x + bxi * B, by0 = y + by * B;
          ctx.fillStyle = '#7a7a86'; roundRect(ctx, bx0 + 1, by0 + 1, B - 2, B - 2, 6); ctx.fill();
          ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(bx0 + 12, by0 + 14, 5, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(bx0 + 27, by0 + 26, 4, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#3a3a44'; ctx.lineWidth = 1.5; roundRect(ctx, bx0 + 1, by0 + 1, B - 2, B - 2, 6); ctx.stroke();
        }
        break;
      }
      case 'moonbase': {
        ctx.fillStyle = '#e9e9f2'; roundRect(ctx, x, y, w, h, 6); ctx.fill();
        ctx.fillStyle = '#2b6cc4'; ctx.fillRect(x, y + 6, w, 6);
        ctx.fillStyle = 'rgba(0,0,0,0.12)'; for (let cy = y + 20; cy < y + h - 6; cy += 20) ctx.fillRect(x + 2, cy, w - 4, 2);
        for (let cy = y + 30; cy < y + h - 10; cy += 40) { ctx.fillStyle = '#8fd3ff'; ctx.beginPath(); ctx.arc(x + w / 2, cy, 9, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#555'; ctx.lineWidth = 2; ctx.stroke(); }
        ctx.strokeStyle = '#555'; ctx.lineWidth = 2; roundRect(ctx, x, y, w, h, 6); ctx.stroke();
        break;
      }
      case 'solar': {
        ctx.fillStyle = '#ff8c00'; ctx.fillRect(x, y, w, h);
        ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
        ctx.strokeStyle = '#ffd400'; ctx.lineWidth = 6;
        for (let d = -h; d < w + h; d += 22) { ctx.beginPath(); ctx.moveTo(x + d, y + h); ctx.lineTo(x + d + h, y); ctx.stroke(); }
        ctx.restore();
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x + w / 2 - 66, y + 8, 132, h - 16);
        text(ctx, 'SOLAR FLARE', x + w / 2, y + h / 2, `bold 16px ${TITLE_FONT}`, '#fff', 'center');
        ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
        break;
      }
      case 'feebooth': {
        ctx.fillStyle = '#f7f7f2'; roundRect(ctx, x, y, w, h, 3); ctx.fill();
        ctx.fillStyle = '#1b4f8a'; ctx.fillRect(x, y, w, 9);
        text(ctx, 'FEE', x + w / 2, y + 5, `bold 7px ${UI_FONT}`, '#fff', 'center');
        text(ctx, '$$$', x + w / 2, y + 24, `bold 14px ${TITLE_FONT}`, '#c8102e', 'center');
        ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
        break;
      }
      case 'gift': {
        ctx.fillStyle = '#c8102e'; roundRect(ctx, x, y + 6, w, h - 6, 3); ctx.fill();
        ctx.fillStyle = '#ffd400'; ctx.fillRect(x + w / 2 - 5, y + 6, 10, h - 6); ctx.fillRect(x, y + h / 2, w, 8);
        ctx.beginPath(); ctx.ellipse(x + w / 2 - 8, y + 5, 8, 5, -0.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x + w / 2 + 8, y + 5, 8, 5, 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#4a0a12'; ctx.lineWidth = 2; roundRect(ctx, x, y + 6, w, h - 6, 3); ctx.stroke();
        break;
      }
      case 'treaty': {
        parchment(ctx, x, y, w, h, '#f1e3bb', '#8a6d3b');
        ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(-Math.PI / 2);
        text(ctx, '1977 TREATY', 0, 0, `bold 14px ${SERIF}`, '#5a3a10', 'center'); ctx.restore();
        ctx.fillStyle = '#c8102e'; ctx.beginPath(); ctx.arc(x + w - 8, y + h - 8, 5, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'lockwall': {
        ctx.fillStyle = '#9a9ea3'; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = 'rgba(0,0,0,0.15)'; for (let cx = x + 20; cx < x + w; cx += 40) ctx.fillRect(cx, y, 2, h);
        for (let cy = y + 20; cy < y + h; cy += 20) ctx.fillRect(x, cy, w, 2);
        ctx.fillStyle = '#ffd400'; ctx.fillRect(x, y, w, 5);
        ctx.fillStyle = '#333'; for (let cx = x + 12; cx < x + w - 6; cx += 40) { ctx.fillRect(cx, y - 6, 8, 6); }
        ctx.strokeStyle = '#444'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
        break;
      }
      case 'container': {
        const cols = ['#c8102e', '#2b6cc4', '#f2b134', '#2f9e44', '#e67e22'];
        for (let by = 0; by < o.h; by++) for (let bxi = 0; bxi < o.w; bxi++) {
          const bx0 = x + bxi * B, by0 = y + by * B;
          ctx.fillStyle = cols[(bxi + by * 2 + Math.round(x / 37)) % cols.length]; ctx.fillRect(bx0 + 1, by0 + 1, B - 2, B - 2);
          ctx.fillStyle = 'rgba(0,0,0,0.18)'; for (let i = 6; i < B - 4; i += 8) ctx.fillRect(bx0 + i, by0 + 4, 2, B - 8);
          ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.5; ctx.strokeRect(bx0 + 1, by0 + 1, B - 2, B - 2);
        }
        break;
      }
      case 'fee': {
        ctx.fillStyle = '#1b4f8a'; ctx.fillRect(x, y, w, h);
        ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6;
        for (let d = -h; d < w + h; d += 22) { ctx.beginPath(); ctx.moveTo(x + d, y + h); ctx.lineTo(x + d + h, y); ctx.stroke(); }
        ctx.restore();
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x + w / 2 - 78, y + 8, 156, h - 16);
        text(ctx, 'EXORBITANT FEE', x + w / 2, y + h / 2, `bold 15px ${TITLE_FONT}`, '#fff', 'center');
        ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
        break;
      }
      case 'sorry': {
        ctx.fillStyle = '#fffdf5'; roundRect(ctx, x, y, w, h, 4); ctx.fill();
        ctx.strokeStyle = '#c8102e'; ctx.lineWidth = 3; roundRect(ctx, x + 2, y + 2, w - 4, h - 4, 4); ctx.stroke();
        text(ctx, 'SORRY', x + w / 2, y + h / 2 - 4, `bold 11px ${TITLE_FONT}`, '#c8102e', 'center');
        text(ctx, 'eh?', x + w / 2, y + h / 2 + 9, `italic 9px ${UI_FONT}`, '#7a0a1a', 'center');
        break;
      }
      case 'parliament': {
        column(ctx, x, y, w, h, '#d9c9a3', '#3f8f7a');
        ctx.fillStyle = '#4a5a8a'; ctx.beginPath(); ctx.moveTo(x + w / 2 - 6, y + h / 2 + 8); ctx.lineTo(x + w / 2, y + h / 2 - 8); ctx.lineTo(x + w / 2 + 6, y + h / 2 + 8); ctx.closePath(); ctx.fill();
        break;
      }
      case 'usmca': {
        parchment(ctx, x, y, w, h, '#f1e3bb', '#8a6d3b');
        ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(-Math.PI / 2);
        text(ctx, 'USMCA', 0, 0, `bold 16px ${SERIF}`, '#5a3a10', 'center'); ctx.restore();
        ctx.fillStyle = '#c8102e'; ctx.beginPath(); ctx.arc(x + w - 8, y + h - 8, 5, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'timmies': {
        ctx.fillStyle = '#5a2a12'; ctx.beginPath(); ctx.moveTo(x + 4, y + 8); ctx.lineTo(x + w - 4, y + 8); ctx.lineTo(x + w - 8, y + h); ctx.lineTo(x + 8, y + h); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#c8102e'; ctx.fillRect(x + 5, y + 16, w - 10, 12);
        ctx.fillStyle = '#e9e9f2'; roundRect(ctx, x + 2, y + 2, w - 4, 8, 3); ctx.fill();
        text(ctx, 'DOUBLE', x + w / 2, y + 22, `bold 7px ${UI_FONT}`, '#fff', 'center');
        ctx.strokeStyle = '#2a1408'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + 4, y + 8); ctx.lineTo(x + w - 4, y + 8); ctx.lineTo(x + w - 8, y + h); ctx.lineTo(x + 8, y + h); ctx.closePath(); ctx.stroke();
        break;
      }
      case 'syrup': {
        for (let by = 0; by < o.h; by++) for (let bxi = 0; bxi < o.w; bxi++) {
          const bx0 = x + bxi * B, by0 = y + by * B;
          const sg = ctx.createLinearGradient(bx0, by0, bx0, by0 + B);
          sg.addColorStop(0, '#f6c65a'); sg.addColorStop(1, '#b5721a');
          ctx.fillStyle = sg; roundRect(ctx, bx0 + 2, by0 + 2, B - 4, B - 4, 5); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(bx0 + 6, by0 + 5, 6, B - 12);
          ctx.strokeStyle = '#6b3a08'; ctx.lineWidth = 1.5; roundRect(ctx, bx0 + 2, by0 + 2, B - 4, B - 4, 5); ctx.stroke();
          ctx.fillStyle = '#c8102e'; ctx.beginPath(); ctx.moveTo(bx0 + 27, by0 + 12); ctx.lineTo(bx0 + 32, by0 + 20); ctx.lineTo(bx0 + 29, by0 + 20); ctx.lineTo(bx0 + 29, by0 + 27); ctx.lineTo(bx0 + 25, by0 + 27); ctx.lineTo(bx0 + 25, by0 + 20); ctx.lineTo(bx0 + 22, by0 + 20); ctx.closePath(); ctx.fill();
        }
        break;
      }
      case 'tariff': {
        ctx.fillStyle = '#7a0a1a'; ctx.fillRect(x, y, w, h);
        ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6;
        for (let d = -h; d < w + h; d += 22) { ctx.beginPath(); ctx.moveTo(x + d, y + h); ctx.lineTo(x + d + h, y); ctx.stroke(); }
        ctx.restore();
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x + w / 2 - 66, y + 8, 132, h - 16);
        text(ctx, '25% TARIFF', x + w / 2, y + h / 2, `bold 16px ${TITLE_FONT}`, '#fff', 'center');
        ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
        break;
      }
      case 'ice': {
        for (let by = 0; by < o.h; by++) for (let bxi = 0; bxi < o.w; bxi++) {
          const bx0 = x + bxi * B, by0 = y + by * B;
          ctx.fillStyle = 'rgba(190,230,255,0.85)'; ctx.fillRect(bx0, by0, B, B);
          ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(bx0 + 3, by0 + 3, B - 6, 6);
          ctx.strokeStyle = 'rgba(80,140,200,0.5)'; ctx.lineWidth = 1.5; ctx.strokeRect(bx0 + 1, by0 + 1, B - 2, B - 2);
          ctx.beginPath(); ctx.moveTo(bx0 + 8, by0 + 30); ctx.lineTo(bx0 + 20, by0 + 18); ctx.lineTo(bx0 + 30, by0 + 26); ctx.stroke();
        }
        break;
      }
      case 'press': {
        ctx.fillStyle = '#f7f7f2'; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#111'; ctx.fillRect(x + 3, y + 3, w - 6, 9);
        text(ctx, 'THE TRUTH', x + w / 2, y + 7.5, `bold 7px ${SERIF}`, '#fff', 'center');
        ctx.fillStyle = '#777'; for (let ly = y + 16; ly < y + h - 4; ly += 4) ctx.fillRect(x + 4, ly, w - 8 - (ly % 3) * 4, 2);
        ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
        break;
      }
      case 'jcpoa': {
        for (let by = 0; by < o.h; by++) for (let bxi = 0; bxi < o.w; bxi++) {
          const bx0 = x + bxi * B, by0 = y + by * B;
          ctx.fillStyle = '#f4f1e6'; ctx.beginPath(); ctx.moveTo(bx0 + 2, by0 + 6);
          for (let i = 0; i < 6; i++) ctx.lineTo(bx0 + 2 + (i + 0.5) * 6, by0 + (i % 2 ? 6 : 1));
          ctx.lineTo(bx0 + B - 2, by0 + 6); ctx.lineTo(bx0 + B - 2, by0 + B - 2); ctx.lineTo(bx0 + 2, by0 + B - 2); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = '#9a9488'; ctx.lineWidth = 1; ctx.stroke();
          ctx.fillStyle = '#666'; for (let ly = by0 + 12; ly < by0 + B - 5; ly += 5) ctx.fillRect(bx0 + 7, ly, B - 14 - (ly % 3) * 3, 2);
        }
        ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(-0.35);
        text(ctx, 'VOID', 0, 0, `bold ${Math.min(22, w / 2)}px ${TITLE_FONT}`, 'rgba(200,16,46,0.85)', 'center'); ctx.restore();
        break;
      }
      case 'nato': {
        ctx.fillStyle = '#0a2d6e'; ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#7fb3ff'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
        const cx = x + w / 2, cy = y + h / 2;
        ctx.fillStyle = '#fff'; ctx.beginPath();
        for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, r = i % 2 ? 6 : 17; ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.stroke();
        break;
      }
      case 'barrels': {
        for (let by = 0; by < o.h; by++) for (let bxi = 0; bxi < o.w; bxi++) {
          const bx0 = x + bxi * B, by0 = y + by * B;
          ctx.fillStyle = '#23232a'; roundRect(ctx, bx0 + 3, by0 + 2, B - 6, B - 4, 6); ctx.fill();
          ctx.fillStyle = '#ffd400'; ctx.fillRect(bx0 + 3, by0 + 10, B - 6, 5); ctx.fillRect(bx0 + 3, by0 + 25, B - 6, 5);
          ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; roundRect(ctx, bx0 + 3, by0 + 2, B - 6, B - 4, 6); ctx.stroke();
          text(ctx, 'OIL', bx0 + B / 2, by0 + 20, `bold 9px ${UI_FONT}`, '#ffd400', 'center');
        }
        break;
      }
      case 'tanker': {
        ctx.fillStyle = '#8b1a1a'; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#c62828'; ctx.fillRect(x, y, w, 10);
        ctx.fillStyle = '#f2f2f2'; ctx.fillRect(x, y + 10, w, 4);
        ctx.fillStyle = '#111'; ctx.fillRect(x, y + h - 8, w, 8);
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; for (let px = x + 12; px < x + w - 6; px += 20) { ctx.beginPath(); ctx.arc(px, y + h / 2 + 2, 4, 0, Math.PI * 2); ctx.fill(); }
        ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
        break;
      }
      case 'tower': { // a Doha glass tower
        ctx.fillStyle = '#4c7fb8'; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x + 6, y, 6, h);
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let wy = y + 6; wy < y + h - 4; wy += 10) ctx.fillRect(x + 3, wy, w - 6, 2);
        ctx.fillStyle = '#2a4f7e'; ctx.fillRect(x - 3, y, w + 6, 6);
        ctx.strokeStyle = '#1b2a4a'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
        break;
      }
      case 'minaret': {
        ctx.fillStyle = '#e8dcc4'; ctx.fillRect(x + 4, y, w - 8, h);
        ctx.fillStyle = '#c9b48a'; ctx.fillRect(x, y, w, 8); ctx.fillRect(x, y + h * 0.5, w, 6);
        ctx.fillStyle = '#8d1b3d'; ctx.beginPath(); ctx.moveTo(x - 2, y); ctx.lineTo(x + w / 2, y - 18); ctx.lineTo(x + w + 2, y); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.strokeRect(x + 4, y, w - 8, h);
        break;
      }
      case 'cloud': { // a storm cloud hanging from the sky
        ctx.fillStyle = '#4a4f66'; ctx.fillRect(x + 4, y, w - 8, h);
        ctx.fillStyle = '#5c617a';
        for (let cy = y + 10; cy < y + h; cy += 26) { ctx.beginPath(); ctx.ellipse(x + w / 2, cy, w * 0.75, 14, 0, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = '#3a3e52'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h - 4, w * 0.8, 12, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ffe97a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + w / 2 + 4, y + h - 2); ctx.lineTo(x + w / 2 - 4, y + h + 10); ctx.lineTo(x + w / 2 + 2, y + h + 10); ctx.lineTo(x + w / 2 - 6, y + h + 24); ctx.stroke();
        break;
      }
      case 'emoluments': { // a hanging clause of the Constitution
        parchment(ctx, x - 6, y, w + 12, h, '#f3e6c4', '#8a6a3a');
        ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(-Math.PI / 2);
        text(ctx, 'EMOLUMENTS', 0, -5, `bold 11px ${SERIF}`, '#4a3010', 'center'); text(ctx, 'CLAUSE', 0, 7, `bold 11px ${SERIF}`, '#4a3010', 'center');
        ctx.restore();
        break;
      }
      case 'ethics': { // the Office of Government Ethics, as an office block
        ctx.fillStyle = '#9aa0ad'; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let wy = y + 8; wy < y + h - 6; wy += 14) { ctx.fillRect(x + 6, wy, 8, 8); ctx.fillRect(x + w - 14, wy, 8, 8); }
        ctx.fillStyle = '#5c6270'; ctx.fillRect(x - 2, y, w + 4, 6);
        ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(-Math.PI / 2); text(ctx, 'ETHICS', 0, 0, `bold 12px ${TITLE_FONT}`, '#fff', 'center'); ctx.restore();
        ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
        break;
      }
      case 'monument': { // the Washington Monument
        ctx.fillStyle = '#e9e6dc'; ctx.fillRect(x + 6, y + 14, w - 12, h - 14);
        ctx.fillStyle = '#f7f5ee'; ctx.beginPath(); ctx.moveTo(x + 6, y + 14); ctx.lineTo(x + w / 2, y - 6); ctx.lineTo(x + w - 6, y + 14); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(x + w / 2, y + 14, w / 2 - 6, h - 14);
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.strokeRect(x + 6, y + 14, w - 12, h - 14);
        break;
      }
      case 'mast': { // a ship's mast
        ctx.fillStyle = '#6b7280'; ctx.fillRect(x + w / 2 - 5, y, 10, h);
        ctx.fillStyle = '#4b5563'; ctx.fillRect(x - 6, y + 8, w + 12, 6); ctx.fillRect(x - 2, y + h * 0.5, w + 4, 5);
        ctx.fillStyle = '#c8102e'; ctx.fillRect(x + w / 2 + 5, y + 14, 16, 10);
        break;
      }
      case 'sand': { // sandstone
        ctx.fillStyle = '#d9b77a'; ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = 'rgba(120,80,30,0.5)'; ctx.lineWidth = 1.5;
        for (let by = y + 12; by < y + h; by += 14) { ctx.beginPath(); ctx.moveTo(x, by); ctx.lineTo(x + w, by); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
        break;
      }
      case 'carpet': { // a red carpet on a gilded step
        ctx.fillStyle = '#b8862b'; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#8d1b3d'; ctx.fillRect(x, y, w, 8);
        ctx.fillStyle = '#ffd400'; ctx.fillRect(x, y + 8, w, 2);
        ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
        break;
      }
      case 'gag': case 'ceasefire': {
        const cease = o.skin === 'ceasefire';
        ctx.fillStyle = cease ? '#eef2f7' : '#2b2b33'; ctx.fillRect(x, y, w, h);
        ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
        ctx.strokeStyle = cease ? '#2b6cc4' : '#c8102e'; ctx.lineWidth = 6;
        for (let d = -h; d < w + h; d += 22) { ctx.beginPath(); ctx.moveTo(x + d, y + h); ctx.lineTo(x + d + h, y); ctx.stroke(); }
        ctx.restore();
        ctx.fillStyle = cease ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.55)'; ctx.fillRect(x + w / 2 - 60, y + 8, 120, h - 16);
        text(ctx, cease ? 'CEASEFIRE' : 'GAG ORDER', x + w / 2, y + h / 2, `bold 16px ${TITLE_FONT}`, cease ? '#0a2d6e' : '#fff', 'center');
        ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
        break;
      }
      default: {
        ctx.fillStyle = '#1b2a4a'; ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = pal.gline; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      }
    }
    ctx.restore();
    if (o.label) {
      const serif = o.skin === 'constitution' || o.skin === 'wall' || o.skin === 'warpowers';
      labelAbove(ctx, o.label, x + w / 2, o.hang ? o.bot + 14 : y - 14, serif ? `bold 13px ${SERIF}` : `bold 12px ${UI_FONT}`, '#ffffff');
    }
  }
  function drawPad(ctx, o, sx, G) {
    const x = sx, w = o.r - o.l;
    const glow = 0.5 + 0.5 * Math.sin(G.time * 8);
    const edge = o.flip ? o.top : o.bot;
    ctx.fillStyle = `rgba(255,212,0,${0.25 + 0.25 * glow})`;
    ctx.beginPath(); ctx.ellipse(x + w / 2, edge + (o.flip ? 4 : -4), w * 0.9, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd400'; roundRect(ctx, x, o.top, w, o.bot - o.top, 4); ctx.fill();
    ctx.strokeStyle = '#7a5a00'; ctx.lineWidth = 2; ctx.stroke();
    const sy = o.flip ? o.bot + 40 + 4 * glow : o.top - 40 - 4 * glow;
    const lbl = (o.flip ? '⬇ ' : '⬆ ') + o.label;
    ctx.font = `bold 11px ${UI_FONT}`;
    const tw = Math.max(116, ctx.measureText(lbl).width + 20);
    ctx.fillStyle = '#fffbe6'; roundRect(ctx, x + w / 2 - tw / 2, sy - 12, tw, 24, 4); ctx.fill();
    ctx.strokeStyle = '#7a5a00'; ctx.lineWidth = 1.5; ctx.stroke();
    text(ctx, lbl, x + w / 2, sy, `bold 11px ${UI_FONT}`, '#5a3a00', 'center');
  }
  function drawOrb(ctx, o, sx, G) {
    const cx = sx, cy = o.cy;
    const pulse = G.beatPulse;
    ctx.save();
    ctx.globalAlpha = o.used ? 0.35 : 1;
    ctx.strokeStyle = rgba(255, 212, 0, 0.35 + 0.5 * pulse); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, o.r + 6 + 6 * pulse, 0, Math.PI * 2); ctx.stroke();
    const sp = sprite('spr-orb' + o.r, o.r * 2 + 6, (c, mx, my) => {
      const g = c.createRadialGradient(mx - 6, my - 6, 2, mx, my, o.r);
      g.addColorStop(0, '#fff6b0'); g.addColorStop(0.6, '#ffd400'); g.addColorStop(1, '#c48a00');
      c.fillStyle = g; c.beginPath(); c.arc(mx, my, o.r, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#5a3a00'; c.lineWidth = 2; c.stroke();
    });
    ctx.drawImage(sp.cv, cx - sp.per / 2, cy - sp.h / 2, sp.per, sp.h);
    text(ctx, o.label, cx, cy - o.r - 14, `bold 11px ${UI_FONT}`, '#fff', 'center', 'rgba(0,0,0,0.8)', 3);
    text(ctx, 'TAP', cx, cy + 1, `bold 11px ${TITLE_FONT}`, '#5a3a00', 'center');
    ctx.restore();
  }
  function drawPortal(ctx, o, sx, G) {
    const cx = sx, cy = o.cy, r = o.r;
    const col = o.dir === -1 ? '79,195,255' : '255,212,0';
    const spin = G.time * 2.5;
    ctx.save();
    ctx.fillStyle = `rgba(${col},${(0.12 + 0.1 * G.beatPulse).toFixed(2)})`;
    ctx.beginPath(); ctx.arc(cx, cy, r + 10, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = `rgba(${col},0.95)`;
    ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.55, r, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -spin * 20;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(cx, cy, r * 0.3 + i * 8, spin + i, spin + i + 2.2); ctx.stroke(); }
    // arrow showing which way gravity goes after the portal
    ctx.fillStyle = '#fff';
    const d = o.dir === -1 ? -1 : 1;
    ctx.beginPath(); ctx.moveTo(cx, cy + d * 14); ctx.lineTo(cx - 7, cy + d * 2); ctx.lineTo(cx - 3, cy + d * 2); ctx.lineTo(cx - 3, cy - d * 12); ctx.lineTo(cx + 3, cy - d * 12); ctx.lineTo(cx + 3, cy + d * 2); ctx.lineTo(cx + 7, cy + d * 2); ctx.closePath(); ctx.fill();
    text(ctx, o.label, cx, cy - r - 18, `bold 11px ${UI_FONT}`, '#fff', 'center', 'rgba(0,0,0,0.8)', 3);
    ctx.restore();
  }
  function drawCoin(ctx, o, sx, G, icon) {
    if (o.got) return;
    const bob = Math.sin(G.time * 4 + o.cx * 0.01) * 4;
    if (icon === 'coin') {
      const sp = sprite('spr-coin', 44, (c, mx, my) => {
        c.fillStyle = 'rgba(255,212,0,0.25)'; c.beginPath(); c.arc(mx, my, 20, 0, Math.PI * 2); c.fill();
        const g = c.createRadialGradient(mx - 4, my - 4, 2, mx, my, 14);
        g.addColorStop(0, '#fff2a8'); g.addColorStop(0.7, '#ffcc00'); g.addColorStop(1, '#b8860b');
        c.fillStyle = g; c.beginPath(); c.arc(mx, my, 14, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#7a5a00'; c.lineWidth = 2; c.stroke();
        text(c, '$', mx, my + 1, `bold 16px ${TITLE_FONT}`, '#7a5a00', 'center');
      });
      ctx.drawImage(sp.cv, sx - sp.per / 2, o.cy + bob - sp.h / 2, sp.per, sp.h);
    } else {
      ctx.fillStyle = 'rgba(255,212,0,0.25)'; ctx.beginPath(); ctx.arc(sx, o.cy + bob, 20, 0, Math.PI * 2); ctx.fill();
      const x = sx - 11, y = o.cy - 14 + bob;
      ctx.fillStyle = '#23232a'; roundRect(ctx, x, y, 22, 28, 5); ctx.fill();
      ctx.fillStyle = '#ffd400'; ctx.fillRect(x, y + 6, 22, 4); ctx.fillRect(x, y + 18, 22, 4);
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; roundRect(ctx, x, y, 22, 28, 5); ctx.stroke();
      text(ctx, 'OIL', sx, y + 13, `bold 8px ${UI_FONT}`, '#ffd400', 'center');
    }
  }
  function drawMine(ctx, o, sx, G) {
    const cx = sx, cy = o.cy, r = o.r;
    if (o.skin === 'asteroid') {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(G.time * 1.5 + o.cx * 0.01);
      ctx.fillStyle = '#7a7a86'; ctx.beginPath();
      for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2, rr = r * (0.8 + 0.3 * rnd(i + o.cx)); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#3a3a44'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(-4, -3, 4, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(5, 4, 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      return;
    }
    if (o.skin === 'puck') {
      const spin = G.time * 6;
      ctx.fillStyle = '#0a0a0a'; ctx.beginPath(); ctx.ellipse(cx, cy + 4, r, r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1e1e22'; ctx.beginPath(); ctx.ellipse(cx, cy - 2, r, r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0a0a0a'; ctx.fillRect(cx - r, cy - 2, r * 2, 6);
      ctx.fillStyle = '#1e1e22'; ctx.beginPath(); ctx.ellipse(cx, cy - 2, r, r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(cx, cy - 2, r * 0.7, r * 0.35, 0, spin, spin + 2); ctx.stroke();
      return;
    }
    const sp = sprite('spr-mine' + r, r * 2 + 20, (c, mx, my) => {
      c.strokeStyle = '#111'; c.lineWidth = 3;
      for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4 + 0.39; c.beginPath(); c.moveTo(mx + Math.cos(a) * r * 0.7, my + Math.sin(a) * r * 0.7); c.lineTo(mx + Math.cos(a) * (r + 6), my + Math.sin(a) * (r + 6)); c.stroke(); c.fillStyle = '#333'; c.beginPath(); c.arc(mx + Math.cos(a) * (r + 6), my + Math.sin(a) * (r + 6), 2.5, 0, Math.PI * 2); c.fill(); }
      const g = c.createRadialGradient(mx - r * 0.4, my - r * 0.4, 1, mx, my, r);
      g.addColorStop(0, '#6b6b75'); g.addColorStop(1, '#0d0d12');
      c.fillStyle = g; c.beginPath(); c.arc(mx, my, r, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#000'; c.lineWidth = 1.5; c.stroke();
    });
    ctx.drawImage(sp.cv, cx - sp.per / 2, cy - sp.h / 2, sp.per, sp.h);
    ctx.fillStyle = rgba(255, 40, 40, 0.35 + 0.65 * G.beatPulse); ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  function drawDrone(ctx, o, sx, G) {
    const beat = G.st ? G.st.t / C.BEAT_SEC : G.beat;
    const cy = PHYS.droneCY(o, beat), cx = sx;
    const d = o.dir || 1;
    const top = o.floorY - d * (o.hBase + o.amp), bot = o.floorY - d * (o.hBase - o.amp);
    ctx.strokeStyle = 'rgba(255,90,90,0.25)'; ctx.lineWidth = 1; ctx.setLineDash([4, 6]);
    ctx.beginPath(); ctx.moveTo(cx, Math.min(top, bot) - 8); ctx.lineTo(cx, Math.max(top, bot) + 8); ctx.stroke(); ctx.setLineDash([]);
    if (o.skin === 'ufo') {
      ctx.fillStyle = 'rgba(120,255,160,0.25)'; ctx.beginPath(); ctx.moveTo(cx - 10, cy + 6); ctx.lineTo(cx - 30, cy + 70); ctx.lineTo(cx + 30, cy + 70); ctx.lineTo(cx + 10, cy + 6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#9a9ea3'; ctx.beginPath(); ctx.ellipse(cx, cy + 2, 26, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8fd3ff'; ctx.beginPath(); ctx.arc(cx, cy - 4, 10, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = '#3a3a44'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(cx, cy + 2, 26, 8, 0, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 5; i++) { ctx.fillStyle = (Math.floor(G.time * 6) + i) % 2 ? '#ff2d95' : '#ffd400'; ctx.beginPath(); ctx.arc(cx - 20 + i * 10, cy + 5, 2.2, 0, Math.PI * 2); ctx.fill(); }
      return;
    }
    const spin = G.time * 40;
    ctx.fillStyle = '#2a2d36'; roundRect(ctx, cx - 14, cy - 5, 28, 10, 4); ctx.fill();
    ctx.strokeStyle = '#4a4f5c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx - 24, cy - 6); ctx.lineTo(cx + 24, cy - 6); ctx.stroke();
    ctx.fillStyle = 'rgba(220,230,255,0.6)';
    for (const dx of [-24, 24]) { ctx.beginPath(); ctx.ellipse(cx + dx, cy - 8, 12 * Math.abs(Math.cos(spin + dx)), 2.5, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = rgba(255, 50, 50, 0.4 + 0.6 * G.beatPulse); ctx.beginPath(); ctx.arc(cx, cy + 6, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111'; ctx.fillRect(cx - 4, cy + 4, 8, 4);
  }
  function drawWheel(ctx, x, y, r, angle) {
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#9a9aa6'; ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#3a3a44'; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) { const a = angle + (i * Math.PI) / 3; ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * r * 0.5, y - Math.sin(a) * r * 0.5); ctx.lineTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5); ctx.stroke(); }
    ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
  }
  function drawStamp(ctx, str, cx, cy, angle, prog, color, size, outline) {
    if (prog <= 0) return;
    const p = Math.min(1, prog);
    const ease = 1 - Math.pow(1 - p, 3);
    const scale = 2.8 - 1.8 * ease;
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(angle); ctx.scale(scale, scale);
    ctx.globalAlpha = Math.min(1, p * 2) * 0.92;
    ctx.font = `bold ${size}px ${TITLE_FONT}`;
    const tw = ctx.measureText(str).width;
    ctx.lineWidth = 5; ctx.strokeStyle = color; ctx.lineJoin = 'round';
    roundRect(ctx, -tw / 2 - 12, -size * 0.55 - 6, tw + 24, size * 1.1 + 12, 6); ctx.stroke();
    if (outline) { ctx.lineWidth = 6; ctx.strokeStyle = outline; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.strokeText(str, 0, 2); }
    text(ctx, str, 0, 2, `bold ${size}px ${TITLE_FONT}`, color, 'center');
    ctx.restore();
  }
  function drawTruck(ctx, sx, G, e) {
    const wheel = e ? e.wheel : 0;
    const tl = sx - 318, tr = sx - 30, tt = GY - 132, tb = GY - 44;
    ctx.fillStyle = '#222'; ctx.fillRect(tl + 10, tb - 2, tr - tl + 40, 14);
    const g = ctx.createLinearGradient(0, tt, 0, tb);
    g.addColorStop(0, '#f0f0f5'); g.addColorStop(0.45, '#b9b9c6'); g.addColorStop(0.55, '#8d8d9c'); g.addColorStop(1, '#d6d6e0');
    ctx.fillStyle = g; roundRect(ctx, tl, tt, tr - tl, tb - tt, 30); ctx.fill();
    ctx.strokeStyle = '#33333c'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(tl + 40, tt + 4, 6, tb - tt - 8); ctx.fillRect(tr - 46, tt + 4, 6, tb - tt - 8);
    const cxT = (tl + tr) / 2, plateW = 200;
    ctx.fillStyle = '#ffd400'; ctx.fillRect(cxT - plateW / 2, tt + 18, plateW, 8);
    ctx.fillStyle = '#0033a0'; ctx.fillRect(cxT - plateW / 2, tt + 26, plateW, 8);
    ctx.fillStyle = '#c8102e'; ctx.fillRect(cxT - plateW / 2, tt + 34, plateW, 8);
    text(ctx, 'VENEZUELA', cxT, tt + 64, `bold 34px ${TITLE_FONT}`, '#0033a0', 'center', '#ffffff', 6);
    if (e) {
      drawStamp(ctx, 'U.S.A.', cxT + 6, tt + 60, -0.2, e.stamp1, '#c8102e', 40, null);
      drawStamp(ctx, 'TRUMP', cxT - 4, tt + 58, 0.12, e.stamp2, '#ffd400', 46, '#3a2a00');
    }
    const cl = sx - 24, cr = sx + 116, ct = GY - 146, cb = GY - 40;
    ctx.fillStyle = '#c8102e'; roundRect(ctx, cl, ct, cr - cl, cb - ct, 12); ctx.fill();
    ctx.strokeStyle = '#4a0a12'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(cl, ct + 62, cr - cl, 10);
    ctx.fillStyle = '#0033a0'; ctx.fillRect(cl, ct + 72, cr - cl, 6);
    ctx.fillStyle = '#a60d26'; roundRect(ctx, cr - 40, ct + 46, 42, cb - ct - 46, 8); ctx.fill(); ctx.stroke();
    const wl = sx + 36, wr = sx + 92, wt = ct + 12, wb = ct + 58;
    ctx.fillStyle = '#8fd3ff'; roundRect(ctx, wl, wt, wr - wl, wb - wt, 6); ctx.fill();
    ctx.strokeStyle = '#4a0a12'; ctx.lineWidth = 2; ctx.stroke();
    if (e && e.trumpIn >= 1) {
      ctx.save(); roundRect(ctx, wl, wt, wr - wl, wb - wt, 6); ctx.clip();
      drawPose(ctx, 'thumbs', (wl + wr) / 2 + 4, wb + 44, 96, false);
      ctx.restore();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; roundRect(ctx, sx - 8, ct + 10, 48, cb - ct - 20, 6); ctx.stroke();
    ctx.fillStyle = '#ddd'; ctx.fillRect(sx + 26, ct + 52, 10, 3);
    ctx.fillStyle = '#cfcfd8'; ctx.fillRect(cr - 8, ct + 70, 10, 34);
    ctx.fillStyle = '#ffec8a'; ctx.fillRect(cr - 12, ct + 54, 10, 10);
    ctx.fillStyle = '#333'; ctx.fillRect(cl - 4, cb - 10, cr - cl + 12, 10);
    ctx.fillStyle = '#9a9aa6'; ctx.fillRect(sx + 2, ct - 46, 8, 50);
    ctx.fillStyle = '#666'; ctx.fillRect(sx, ct - 50, 12, 6);
    drawWheel(ctx, sx - 268, GY - 20, 20, wheel);
    drawWheel(ctx, sx - 220, GY - 20, 20, wheel);
    drawWheel(ctx, sx + 8, GY - 20, 20, wheel);
    drawWheel(ctx, sx + 86, GY - 20, 20, wheel);
    text(ctx, 'OIL', sx + 12, ct + 36, `bold 14px ${TITLE_FONT}`, 'rgba(255,255,255,0.85)', 'center');
  }
  // A lock lift: a barge floating in a chamber whose water rises and falls on the beat
  function drawLift(ctx, o, sx, G) {
    const beat = G.st ? G.st.t / C.BEAT_SEC : G.beat;
    const top = PHYS.liftTop(o, beat), w = o.r - o.l;
    const wl = top + o.thick - 8;
    const wg = ctx.createLinearGradient(0, wl, 0, GY + 60);
    wg.addColorStop(0, '#5fc0d8'); wg.addColorStop(1, '#0a3a4a');
    ctx.fillStyle = wg; ctx.fillRect(sx, wl, w, GY + 60 - wl);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(sx, wl, w, 2);
    // chamber posts
    for (const px of [sx - 14, sx + w]) {
      ctx.fillStyle = '#8a8f94'; ctx.fillRect(px, GY - 150, 14, 200);
      ctx.fillStyle = '#ffd400'; ctx.fillRect(px, GY - 150, 14, 6);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let cy = GY - 130; cy < GY + 40; cy += 20) ctx.fillRect(px, cy, 14, 2);
    }
    // barge
    ctx.fillStyle = '#2b2b33'; roundRect(ctx, sx + 2, top, w - 4, o.thick, 6); ctx.fill();
    ctx.fillStyle = '#c8102e'; ctx.fillRect(sx + 4, top + o.thick - 9, w - 8, 6);
    ctx.fillStyle = '#8a8f94'; ctx.fillRect(sx + 6, top, w - 12, 5);
    ctx.fillStyle = '#ffd400'; for (let cx = sx + 14; cx < sx + w - 14; cx += 36) ctx.fillRect(cx, top + 8, 18, 6);
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; roundRect(ctx, sx + 2, top, w - 4, o.thick, 6); ctx.stroke();
    if (o.label) text(ctx, o.label, sx + w / 2, top - 16, `bold 12px ${UI_FONT}`, '#fff', 'center', 'rgba(0,0,0,0.8)', 3);
  }
  // A tanker ship, bow at (x, waterline y), pointing left (flipX: pointing right). scale s.
  function drawTanker(ctx, x, y, s, hull, G, wake, label, flipX) {
    ctx.save();
    ctx.translate(x, y); ctx.scale(flipX ? -s : s, s);
    const L = 420;
    ctx.fillStyle = hull;
    ctx.beginPath(); ctx.moveTo(0, -30); ctx.quadraticCurveTo(-40, -10, -20, 40); ctx.lineTo(L, 40); ctx.lineTo(L, -30); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.moveTo(-28, 18); ctx.lineTo(L, 18); ctx.lineTo(L, 40); ctx.lineTo(-20, 40); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f2f2f2'; ctx.fillRect(20, -26, L - 30, 5);
    ctx.fillStyle = '#d7d7de'; ctx.fillRect(L - 110, -90, 90, 60); ctx.fillRect(L - 100, -120, 60, 30);
    ctx.fillStyle = '#c8102e'; ctx.fillRect(L - 60, -150, 22, 32); ctx.fillStyle = '#111'; ctx.fillRect(L - 60, -156, 22, 8);
    ctx.fillStyle = '#8fd3ff'; for (let i = 0; i < 5; i++) ctx.fillRect(L - 104 + i * 16, -82, 10, 10);
    ctx.fillStyle = '#4b4b56'; for (let i = 0; i < 6; i++) ctx.fillRect(40 + i * 52, -42, 30, 14);
    ctx.fillStyle = '#777'; ctx.fillRect(L - 20, -190, 4, 100);
    ctx.save(); if (flipX) { ctx.translate(L / 2, 0); ctx.scale(-1, 1); ctx.translate(-L / 2, 0); }
    text(ctx, label || 'CRUDE', L / 2, -6, `bold 22px ${TITLE_FONT}`, 'rgba(255,255,255,0.8)', 'center');
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -30); ctx.quadraticCurveTo(-40, -10, -20, 40); ctx.lineTo(L, 40); ctx.lineTo(L, -30); ctx.closePath(); ctx.stroke();
    if (wake > 0) {
      ctx.fillStyle = `rgba(255,255,255,${(0.5 * wake).toFixed(2)})`;
      for (let i = 0; i < 6; i++) ctx.fillRect(-60 - i * 14 + (G.time * 200) % 14, 22 + Math.sin(G.time * 6 + i) * 3, 12, 3);
    }
    ctx.restore();
  }
  function drawTollGate(ctx, sx, G, e) {
    const cam = G.camX;
    if (e && e.tankers) for (const tk of e.tankers) drawTanker(ctx, tk.x - cam, GY - 4, 0.5, tk.hull, G, tk.moving ? 1 : 0);
    const postX = sx + 25;
    ctx.fillStyle = '#888'; ctx.fillRect(postX - 4, GY - 236, 8, 130);
    const sw = 320, sh = 78, sxx = postX - sw / 2, syy = GY - 270;
    ctx.fillStyle = '#146b3a'; roundRect(ctx, sxx, syy, sw, sh, 8); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; roundRect(ctx, sxx + 6, syy + 6, sw - 12, sh - 12, 6); ctx.stroke();
    text(ctx, 'STRAIT OF HORMUZ', postX, syy + 30, `bold 30px ${TITLE_FONT}`, '#ffffff', 'center');
    text(ctx, 'INTERNATIONAL WATERS  ·  NO TOLLS', postX, syy + 58, `bold 12px ${UI_FONT}`, '#cfe9d6', 'center');
    if (e) {
      drawStamp(ctx, 'CLOSED', postX + 10, syy + 38, -0.16, e.stamp1, '#c8102e', 44, null);
      drawStamp(ctx, 'TRUMP TOLL', postX - 6, syy + 36, 0.1, e.stamp2, '#ffd400', 42, '#3a2a00');
      if (e.subSign > 0) {
        const p = e.subSign, ph = 30 * p;
        ctx.fillStyle = '#fffbe6'; roundRect(ctx, postX - 130, syy + sh + 6, 260, ph, 5); ctx.fill();
        ctx.strokeStyle = '#7a5a00'; ctx.lineWidth = 2; ctx.stroke();
        if (p > 0.6) text(ctx, '$1,000,000,000 PER TANKER', postX, syy + sh + 6 + ph / 2, `bold 15px ${TITLE_FONT}`, '#5a3a00', 'center');
      }
    }
    const bl = sx - 10, br = sx + 60, bt = GY - 112;
    ctx.fillStyle = '#f2f2f5'; ctx.fillRect(bl, bt, br - bl, GY - bt);
    ctx.fillStyle = '#c8102e'; for (let i = 0; i < 4; i++) ctx.fillRect(bl + i * 20, GY - 24, 10, 20);
    ctx.fillStyle = '#8fd3ff'; roundRect(ctx, bl + 14, bt + 18, 42, 44, 4); ctx.fill();
    ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.stroke();
    if (e && e.trumpIn >= 1) {
      ctx.save(); roundRect(ctx, bl + 14, bt + 18, 42, 44, 4); ctx.clip();
      drawPose(ctx, 'thumbs', bl + 37, bt + 62 + 42, 90, false);
      ctx.restore();
    }
    ctx.fillStyle = '#333'; ctx.fillRect(bl - 6, bt - 10, br - bl + 12, 10);
    ctx.fillStyle = '#c8102e'; roundRect(ctx, bl + 4, bt - 34, br - bl - 8, 22, 4); ctx.fill();
    text(ctx, 'TOLL', (bl + br) / 2, bt - 23, `bold 15px ${TITLE_FONT}`, '#fff', 'center');
    ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.strokeRect(bl, bt, br - bl, GY - bt);
    const px = sx + 84, py = GY - 46;
    ctx.fillStyle = '#555'; roundRect(ctx, px - 9, py, 18, 46, 3); ctx.fill();
    ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.stroke();
    const arm = e ? e.arm : 0;
    const ang = -Math.PI / 2 * (1 - arm);
    ctx.save(); ctx.translate(px, py); ctx.rotate(ang);
    for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? '#ffffff' : '#c8102e'; ctx.fillRect(i * 20, -5, 20, 10); }
    ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.strokeRect(0, -5, 160, 10);
    ctx.restore();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill();
  }
  // ---- Greenland ending: the big map ----
  const GL = [[0.30, 0.02], [0.55, 0.00], [0.78, 0.06], [0.92, 0.14], [0.98, 0.28], [0.90, 0.40], [0.86, 0.55], [0.80, 0.68], [0.70, 0.82], [0.58, 0.95], [0.50, 1.00], [0.44, 0.92], [0.36, 0.80], [0.26, 0.66], [0.18, 0.52], [0.08, 0.40], [0.02, 0.26], [0.08, 0.14], [0.18, 0.06]];
  const FL = [[0, 0], [1, 0], [0.95, 0.25], [0.8, 0.6], [0.6, 0.95], [0.45, 1], [0.4, 0.7], [0.3, 0.4], [0.1, 0.2]];
  function polyPath(ctx, pts, cx, cy, w, h) {
    ctx.beginPath();
    pts.forEach(([px, py], i) => { const x = cx + (px - 0.5) * w, y = cy + (py - 0.5) * h; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.closePath();
  }
  function drawIsland(ctx, cx, cy, w, h, e) {
    const im = IMAGES.greenland;
    if (im) {
      drawImageFit(ctx, im, cx, cy, h);
      if (h >= 120) text(ctx, 'GREENLAND', cx, cy - h * 0.34, `bold ${Math.max(10, h * 0.09)}px ${TITLE_FONT}`, '#0a2d6e', 'center', 'rgba(255,255,255,0.85)', 4);
    } else {
      polyPath(ctx, GL, cx, cy, w, h);
      ctx.fillStyle = '#f2f8ff'; ctx.fill();
      ctx.strokeStyle = '#2b6cc4'; ctx.lineWidth = 3; ctx.stroke();
      text(ctx, 'GREENLAND', cx, cy - h * 0.05, `bold ${Math.max(10, w * 0.11)}px ${TITLE_FONT}`, '#0a2d6e', 'center');
    }
    if (e) {
      const s = h / 220;
      // ownership tag under the island
      ctx.fillStyle = '#fff'; roundRect(ctx, cx - 44 * s, cy + h * 0.32, 88 * s, 22 * s, 4); ctx.fill();
      ctx.strokeStyle = '#c8102e'; ctx.lineWidth = 2; ctx.stroke();
      text(ctx, '(DENMARK)', cx, cy + h * 0.32 + 11 * s, `bold ${13 * s}px ${TITLE_FONT}`, '#c8102e', 'center');
      ctx.save(); ctx.translate(cx, cy + h * 0.32 + 11 * s); ctx.scale(s, s);
      drawStamp(ctx, 'U.S.A.', 4, 0, -0.18, e.stamp1, '#c8102e', 30, null);
      ctx.restore();
      ctx.save(); ctx.translate(cx, cy + h * 0.02); ctx.scale(s, s);
      drawStamp(ctx, 'TRUMP', 0, 0, 0.12, e.stamp2, '#ffd400', 52, '#3a2a00');
      ctx.restore();
    }
  }
  function drawMapBoard(ctx, sx, G, e) {
    const bx0 = sx + 70, by0 = 110, bw = 380, bh = 260, bcx = bx0 + bw / 2, bcy = by0 + bh / 2 + 8;
    // easel legs
    ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(bx0 + 30, by0 + bh); ctx.lineTo(bx0 + 10, GY); ctx.moveTo(bx0 + bw - 30, by0 + bh); ctx.lineTo(bx0 + bw - 10, GY); ctx.stroke();
    // board
    ctx.fillStyle = '#6b4a2b'; roundRect(ctx, bx0 - 8, by0 - 8, bw + 16, bh + 16, 8); ctx.fill();
    ctx.fillStyle = '#f7f3e8'; ctx.fillRect(bx0, by0, bw, bh);
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1;
    for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(bx0, by0 + (bh * i) / 6); ctx.lineTo(bx0 + bw, by0 + (bh * i) / 6); ctx.stroke(); }
    for (let i = 1; i < 8; i++) { ctx.beginPath(); ctx.moveTo(bx0 + (bw * i) / 8, by0); ctx.lineTo(bx0 + (bw * i) / 8, by0 + bh); ctx.stroke(); }
    text(ctx, 'ARCTIC ACQUISITIONS', bcx, by0 + 18, `bold 14px ${TITLE_FONT}`, '#6b4a2b', 'center');
    // Florida off to the right
    const fx = sx + 545, fy = GY - 150;
    const fl = IMAGES.florida;
    if (fl) drawImageFit(ctx, fl, fx, fy, 110);
    else { ctx.fillStyle = '#e8f0c8'; polyPath(ctx, FL, fx, fy, 60, 84); ctx.fill(); ctx.strokeStyle = '#2f9e44'; ctx.lineWidth = 2; ctx.stroke(); }
    text(ctx, 'FLORIDA', fx, fy + 68, `bold 12px ${TITLE_FONT}`, '#fff', 'center', 'rgba(0,0,0,0.8)', 3);
    const slide = e ? e.slide || 0 : 0;
    const islandH = 236;
    if (slide > 0) {
      // ghost of where the island used to be
      if (IMAGES.greenland) drawImageFit(ctx, IMAGES.greenland, bcx, bcy, islandH, 0.14);
      else { ctx.setLineDash([6, 6]); ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2; polyPath(ctx, GL, bcx, bcy, 200, 220); ctx.stroke(); ctx.setLineDash([]); }
      text(ctx, '(VACANT)', bcx, bcy, `bold 16px ${TITLE_FONT}`, 'rgba(0,0,0,0.5)', 'center', 'rgba(255,255,255,0.7)', 4);
    }
    const ease = slide < 0.5 ? 2 * slide * slide : 1 - Math.pow(-2 * slide + 2, 2) / 2;
    const cx = bcx + (fx - 92 - bcx) * ease, cy = bcy + (fy - 2 - bcy) * ease, sc = 1 - 0.58 * ease;
    drawIsland(ctx, cx, cy, 200 * sc, islandH * sc, e);
  }

  // ---- Canada ending: the border sign and the flagpole ----
  function drawCanadaFlag(ctx, x, y, w, h) {
    ctx.fillStyle = '#fff'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#c8102e'; ctx.fillRect(x, y, w * 0.25, h); ctx.fillRect(x + w * 0.75, y, w * 0.25, h);
    const cx = x + w / 2, cy = y + h / 2, s = h / 40;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 14 * s); ctx.lineTo(cx + 4 * s, cy - 7 * s); ctx.lineTo(cx + 9 * s, cy - 9 * s); ctx.lineTo(cx + 7 * s, cy - 1 * s); ctx.lineTo(cx + 13 * s, cy + 2 * s);
    ctx.lineTo(cx + 3 * s, cy + 6 * s); ctx.lineTo(cx + 2 * s, cy + 14 * s); ctx.lineTo(cx - 2 * s, cy + 14 * s); ctx.lineTo(cx - 3 * s, cy + 6 * s); ctx.lineTo(cx - 13 * s, cy + 2 * s);
    ctx.lineTo(cx - 7 * s, cy - 1 * s); ctx.lineTo(cx - 9 * s, cy - 9 * s); ctx.lineTo(cx - 4 * s, cy - 7 * s); ctx.closePath(); ctx.fill();
  }
  function drawBorderSign(ctx, sx, G, e) {
    const cx = sx + 250, top = 120, sw = 380, sh = 110;
    ctx.fillStyle = '#888'; ctx.fillRect(cx - 60, top + sh, 8, GY - top - sh); ctx.fillRect(cx + 52, top + sh, 8, GY - top - sh);
    ctx.fillStyle = '#146b3a'; roundRect(ctx, cx - sw / 2, top, sw, sh, 10); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; roundRect(ctx, cx - sw / 2 + 7, top + 7, sw - 14, sh - 14, 7); ctx.stroke();
    drawCanadaFlag(ctx, cx - sw / 2 + 20, top + 30, 70, 46);
    text(ctx, 'CANADA', cx + 35, top + 44, `bold 44px ${TITLE_FONT}`, '#ffffff', 'center');
    text(ctx, 'BIENVENUE  ·  POP. 40,000,000  ·  SORRY', cx + 35, top + 84, `bold 12px ${UI_FONT}`, '#cfe9d6', 'center');
    if (e) {
      drawStamp(ctx, '51st STATE', cx + 20, top + 56, -0.14, e.stamp1, '#c8102e', 40, null);
      drawStamp(ctx, 'TRUMP', cx - 10, top + 52, 0.1, e.stamp2, '#ffd400', 50, '#3a2a00');
    }
    // flagpole
    const px = sx + 520, poleTop = GY - 300;
    ctx.fillStyle = '#c9c9d4'; ctx.fillRect(px - 3, poleTop, 6, GY - poleTop);
    ctx.fillStyle = '#ffd400'; ctx.beginPath(); ctx.arc(px, poleTop - 4, 6, 0, Math.PI * 2); ctx.fill();
    const flagY = e ? e.flagY : 1, flag2Y = e ? e.flag2Y : 0;
    const wave = Math.sin(G.time * 5) * 3;
    if (flagY > 0) {
      const fy = poleTop + 6 + (1 - flagY) * 200;
      drawCanadaFlag(ctx, px + 3, fy + wave, 90, 58);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.5; ctx.strokeRect(px + 3, fy + wave, 90, 58);
    }
    if (flag2Y > 0) {
      const fy = poleTop + 6 + (1 - flag2Y) * 200;
      ctx.fillStyle = '#ffd400'; ctx.fillRect(px + 3, fy - wave, 90, 58);
      ctx.strokeStyle = '#3a2a00'; ctx.lineWidth = 2; ctx.strokeRect(px + 3, fy - wave, 90, 58);
      text(ctx, 'TRUMP', px + 48, fy - wave + 24, `bold 22px ${TITLE_FONT}`, '#3a2a00', 'center');
      text(ctx, '51', px + 48, fy - wave + 45, `bold 16px ${TITLE_FONT}`, '#c8102e', 'center');
    }
  }

  // ---- Panama ending: the lock gate, the sign, and the ship that sails through for free ----
  function drawCanalGate(ctx, sx, G, e) {
    const cx = sx + 305;
    const gate = e ? e.gate || 0 : 0, ship = e ? e.ship || 0 : 0;
    // canal water beyond the gate
    const sea = ctx.createLinearGradient(0, GY - 120, 0, GY - 10);
    sea.addColorStop(0, '#5fc0d8'); sea.addColorStop(1, '#0a3a4a');
    ctx.fillStyle = sea; ctx.fillRect(sx + 100, GY - 120, W, 110);
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(sx + 100, GY - 120, W, 2);
    // the ship (behind the gate posts)
    if (ship > 0) {
      const shipX = sx - 420 + ship * 1500;
      drawTanker(ctx, shipX, GY - 30, 0.45, '#1b3a6e', G, 1, 'U.S.A.', true);
    }
    // gate posts and doors
    const lp = sx + 150, rp = sx + 430, top = GY - 170;
    for (const px of [lp, rp]) {
      ctx.fillStyle = '#8a8f94'; ctx.fillRect(px, top, 30, GY - top);
      ctx.fillStyle = '#ffd400'; ctx.fillRect(px, top, 30, 8);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let cy = top + 24; cy < GY; cy += 22) ctx.fillRect(px, cy, 30, 2);
    }
    const open = gate < 0.5 ? 2 * gate * gate : 1 - Math.pow(-2 * gate + 2, 2) / 2;
    const doorW = 125 * (1 - 0.86 * open);
    for (const [hx, dir] of [[lp + 30, 1], [rp, -1]]) {
      const x0 = dir === 1 ? hx : hx - doorW;
      ctx.fillStyle = '#5a6068'; ctx.fillRect(x0, top + 16, doorW, GY - top - 16);
      ctx.strokeStyle = '#2a2e33'; ctx.lineWidth = 3; ctx.strokeRect(x0, top + 16, doorW, GY - top - 16);
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; for (let cy = top + 34; cy < GY - 10; cy += 26) ctx.fillRect(x0 + 4, cy, doorW - 8, 3);
    }
    // sign above the gate
    const sw = 380, sh = 100, syy = top - 150;
    ctx.fillStyle = '#888'; ctx.fillRect(cx - 4, syy + sh, 8, top - syy - sh);
    ctx.fillStyle = '#1b4f8a'; roundRect(ctx, cx - sw / 2, syy, sw, sh, 10); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; roundRect(ctx, cx - sw / 2 + 7, syy + 7, sw - 14, sh - 14, 7); ctx.stroke();
    text(ctx, 'PANAMA CANAL', cx, syy + 38, `bold 38px ${TITLE_FONT}`, '#ffffff', 'center');
    text(ctx, 'TRANSIT FEE: $1,000,000  ·  RIDICULOUS, HIGHLY UNFAIR', cx, syy + 76, `bold 11px ${UI_FONT}`, '#cfe3ff', 'center');
    if (e) {
      drawStamp(ctx, 'TAKEN BACK', cx + 10, syy + 50, -0.14, e.stamp1, '#c8102e', 40, null);
      drawStamp(ctx, 'TRUMP CANAL', cx - 6, syy + 46, 0.1, e.stamp2, '#ffd400', 44, '#3a2a00');
      if (e.subSign > 0) {
        const p = e.subSign, ph = 30 * p;
        ctx.fillStyle = '#fffbe6'; roundRect(ctx, cx - 160, syy + sh + 4, 320, ph, 5); ctx.fill();
        ctx.strokeStyle = '#7a5a00'; ctx.lineWidth = 2; ctx.stroke();
        if (p > 0.6) text(ctx, 'U.S. SHIPS: FREE  ·  EVERYONE ELSE: $5,000,000', cx, syy + sh + 4 + ph / 2, `bold 13px ${TITLE_FONT}`, '#5a3a00', 'center');
      }
    }
  }

  // ---- Moon ending: the outpost site and the plaque ----
  const PLAQUE = [
    'AMERICA HAS RETURNED',
    'Under the leadership of President Donald Trump,',
    'and with the hopes and dreams of all mankind,',
    "here marks the beginnings of humanity's",
    'first outpost on another world.',
    'Signed, President Donald Trump',
  ];
  const PLAQUE_CHARS = PLAQUE.reduce((n, l) => n + l.length, 0);
  function drawMoonSite(ctx, sx, G, e) {
    drawLander(ctx, sx + 560, GY, 1.05);
    drawMoonFlag(ctx, sx + 440, GY);
    // sign
    const cx = sx + 120, top = 150, sw = 250, sh = 74;
    ctx.fillStyle = '#9a9ea3'; ctx.fillRect(cx - 4, top + sh, 8, GY - top - sh);
    ctx.fillStyle = '#1b2a4a'; roundRect(ctx, cx - sw / 2, top, sw, sh, 8); ctx.fill();
    ctx.strokeStyle = '#8fd3ff'; ctx.lineWidth = 3; roundRect(ctx, cx - sw / 2 + 6, top + 6, sw - 12, sh - 12, 6); ctx.stroke();
    text(ctx, 'THE MOON', cx, top + 30, `bold 32px ${TITLE_FONT}`, '#ffffff', 'center');
    text(ctx, 'POP. 0  ·  GRAVITY 1/6  ·  OWNER: NOBODY', cx, top + 58, `bold 10px ${UI_FONT}`, '#cfe3ff', 'center');
    if (e) {
      drawStamp(ctx, 'RETURNED', cx + 8, top + 40, -0.14, e.stamp1, '#c8102e', 36, null);
      drawStamp(ctx, 'TRUMP', cx - 6, top + 36, 0.1, e.stamp2, '#ffd400', 46, '#3a2a00');
    }
    // pedestal
    ctx.fillStyle = '#7a7a86'; roundRect(ctx, sx + 250, GY - 56, 180, 56, 4); ctx.fill();
    ctx.strokeStyle = '#3a3a44'; ctx.lineWidth = 2; ctx.stroke();
    // the plaque, lowered into place then engraved line by line
    const py = e ? e.plaqueY : GY - 200;
    const pw = 360, ph = 132, px = sx + 340 - pw / 2;
    const bg = ctx.createLinearGradient(px, py, px + pw, py + ph);
    bg.addColorStop(0, '#b8860b'); bg.addColorStop(0.5, '#e6c15a'); bg.addColorStop(1, '#8a6508');
    ctx.fillStyle = bg; roundRect(ctx, px, py, pw, ph, 8); ctx.fill();
    ctx.strokeStyle = '#5a4008'; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; roundRect(ctx, px + 6, py + 6, pw - 12, ph - 12, 6); ctx.stroke();
    for (const [dx, dy] of [[12, 12], [pw - 12, 12], [12, ph - 12], [pw - 12, ph - 12]]) { ctx.fillStyle = '#5a4008'; ctx.beginPath(); ctx.arc(px + dx, py + dy, 3, 0, Math.PI * 2); ctx.fill(); }
    let remaining = e ? Math.floor(e.typed || 0) : PLAQUE_CHARS;
    for (let i = 0; i < PLAQUE.length; i++) {
      const line = PLAQUE[i];
      const shown = line.slice(0, Math.max(0, Math.min(line.length, remaining)));
      remaining -= line.length;
      const font = i === 0 ? `bold 15px ${TITLE_FONT}` : i === PLAQUE.length - 1 ? `italic bold 11px ${SERIF}` : `bold 11px ${SERIF}`;
      text(ctx, shown, px + pw / 2, py + 22 + i * 19 + (i > 0 ? 4 : 0), font, '#3a2a08', 'center');
      if (shown.length < line.length) break;
    }
  }

  // The jet, facing right. (x, y) is the centre of the underside; s = scale; rot = nose tilt.
  function drawJet(ctx, x, y, s, rot, e) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(s, s);
    ctx.fillStyle = '#d9d9e2'; ctx.beginPath(); ctx.moveTo(-10, -14); ctx.lineTo(-52, 4); ctx.lineTo(-30, 4); ctx.lineTo(14, -14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8d8d99'; roundRect(ctx, -30, -6, 26, 12, 6); ctx.fill();
    ctx.fillStyle = '#ffb347'; ctx.fillRect(-31, -3, 4, 6);
    ctx.fillStyle = '#f7f7fa'; roundRect(ctx, -60, -32, 116, 24, 12); ctx.fill();
    ctx.fillStyle = '#8d1b3d'; ctx.fillRect(-58, -19, 110, 4);
    ctx.strokeStyle = '#3a3a44'; ctx.lineWidth = 2; roundRect(ctx, -60, -32, 116, 24, 12); ctx.stroke();
    ctx.fillStyle = '#8d1b3d'; ctx.beginPath(); ctx.moveTo(-58, -30); ctx.lineTo(-38, -62); ctx.lineTo(-22, -62); ctx.lineTo(-30, -30); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#4a0a12'; ctx.lineWidth = 1.5; ctx.stroke();
    text(ctx, 'QATAR', -40, -46, `bold 8px ${TITLE_FONT}`, '#fff', 'center');
    ctx.fillStyle = '#2b3a55'; for (let i = 0; i < 7; i++) ctx.fillRect(-36 + i * 10, -27, 5, 4);
    ctx.fillStyle = '#8fd3ff'; ctx.beginPath(); ctx.moveTo(40, -30); ctx.lineTo(52, -24); ctx.lineTo(40, -22); ctx.closePath(); ctx.fill();
    ctx.save(); roundRect(ctx, 26, -30, 16, 12, 3); ctx.clip();
    drawPose(ctx, 'thumbs', 34, -14, 26, false);
    ctx.restore();
    if (e) {
      drawStamp(ctx, 'AIR FORCE ONE', -38, -46, -0.12, e.stamp1, '#c8102e', 9, null);
      drawStamp(ctx, 'TRUMP LIBRARY', -38, -48, 0.1, e.stamp2, '#ffd400', 10, '#3a2a00');
    }
    ctx.restore();
  }
  // Joint Base Andrews: the runway, the terminal, a windsock, and during the ending the jet itself
  function drawAndrews(ctx, sx, G, e) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; for (let x = sx - 400; x < sx + 900; x += 60) ctx.fillRect(x, GY - 6, 30, 3);
    ctx.fillStyle = '#c8c8d0'; ctx.fillRect(sx + 420, GY - 90, 220, 90);
    ctx.fillStyle = '#9a9aa6'; ctx.fillRect(sx + 480, GY - 140, 60, 50);
    ctx.fillStyle = 'rgba(140,200,255,0.5)'; for (let i = 0; i < 6; i++) ctx.fillRect(sx + 432 + i * 34, GY - 70, 22, 30);
    text(ctx, 'JOINT BASE ANDREWS', sx + 530, GY - 22, `bold 12px ${UI_FONT}`, '#333', 'center');
    const ws = Math.sin(G.time * 3) * 4;
    ctx.fillStyle = '#777'; ctx.fillRect(sx + 380, GY - 120, 4, 120);
    ctx.fillStyle = '#ff8c00'; ctx.beginPath(); ctx.moveTo(sx + 384, GY - 120); ctx.lineTo(sx + 420 + ws, GY - 112); ctx.lineTo(sx + 420 + ws, GY - 104); ctx.lineTo(sx + 384, GY - 100); ctx.closePath(); ctx.fill();
    if (e) {
      const s = e.jetScale, jx = e.jetX - G.camX;
      drawJet(ctx, jx, e.jetY, s, e.jetRot, e);
      if (e.door > 0) {
        const dx = jx + 10 * s, dy = e.jetY - 20 * s;
        ctx.fillStyle = '#c9c9d4'; ctx.beginPath(); ctx.moveTo(dx, dy); ctx.lineTo(dx + 40 * s * e.door, GY); ctx.lineTo(dx + 54 * s * e.door, GY); ctx.lineTo(dx + 14 * s, dy); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#4a4a55'; ctx.lineWidth = 2; ctx.stroke();
        if (e.door >= 1) drawPose(ctx, 'thumbs', dx + 7 * s, dy + 2, 32 * s, false);
      }
    }
  }
  function drawObjects(ctx, G, pal) {
    const cam = G.camX, lv = G.level, def = lv.def;
    for (const d of lv.deco) {
      const sx = d.x - cam;
      if (sx < -700 || sx > W + 700) continue;
      if (d.t === 'scene') drawScene(ctx, d.kind, sx, G); else drawSign(ctx, d, sx);
    }
    const late = [];
    for (const o of lv.objs) {
      if (o.xmax < cam - 200) continue;
      if (o.xmin > cam + W + 200) break;
      switch (o.t) {
        case 'block': drawBlock(ctx, o, o.l - cam, pal); break;
        case 'spike': late.push(o); break;
        case 'pad': drawPad(ctx, o, o.l - cam, G); break;
        case 'orb': drawOrb(ctx, o, o.cx - cam, G); break;
        case 'coin': drawCoin(ctx, o, o.cx - cam, G, def.collectible.icon); break;
        case 'mine': drawMine(ctx, o, o.cx - cam, G); break;
        case 'drone': drawDrone(ctx, o, o.cx - cam, G); break;
        case 'portal': drawPortal(ctx, o, o.cx - cam, G); break;
        case 'lift': drawLift(ctx, o, o.l - cam, G); break;
        case 'goal':
          if (def.ending.type === 'truck') drawTruck(ctx, (G.ending ? G.ending.truckX : o.x) - cam, G, G.ending);
          else if (def.ending.type === 'toll') drawTollGate(ctx, o.x - cam, G, G.ending);
          else if (def.ending.type === 'sign') drawBorderSign(ctx, o.x - cam, G, G.ending);
          else if (def.ending.type === 'canal') drawCanalGate(ctx, o.x - cam, G, G.ending);
          else if (def.ending.type === 'plaque') drawMoonSite(ctx, o.x - cam, G, G.ending);
          else if (def.ending.type === 'jet') drawAndrews(ctx, o.x - cam, G, G.ending);
          else drawMapBoard(ctx, o.x - cam, G, G.ending);
          break;
      }
    }
    pal.G = G;
    for (const o of late) drawSpike(ctx, o, o.x - cam, pal);
    if (G.showHitboxes) {
      ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 1;
      const beat = G.st ? G.st.t / C.BEAT_SEC : 0;
      for (const o of lv.objs) {
        if (o.xmax < cam - 60 || o.xmin > cam + W + 60) continue;
        if (o.t === 'spike') ctx.strokeRect(o.hb.l - cam, o.hb.top, o.hb.r - o.hb.l, o.hb.bot - o.hb.top);
        else if (o.t === 'block' || o.t === 'pad') ctx.strokeRect(o.l - cam, o.top, o.r - o.l, o.bot - o.top);
        else if (o.t === 'lift') { const tp = PHYS.liftTop(o, beat); ctx.strokeRect(o.l - cam, tp, o.r - o.l, o.thick); }
        else if (o.t === 'orb' || o.t === 'mine' || o.t === 'portal') { ctx.beginPath(); ctx.arc(o.cx - cam, o.cy, o.r, 0, Math.PI * 2); ctx.stroke(); }
        else if (o.t === 'drone') { ctx.beginPath(); ctx.arc(o.cx - cam, PHYS.droneCY(o, beat), o.r, 0, Math.PI * 2); ctx.stroke(); }
      }
      const st = G.st;
      if (st) { const hw = st.flying ? C.JET_W : C.PLAYER_W; ctx.strokeRect(st.x - hw / 2 - cam, PHYS.hitTop(st), hw, PHYS.hitBot(st) - PHYS.hitTop(st)); }
    }
  }

  function drawPlayer(ctx, G) {
    const st = G.st;
    if (!st || st.dead || G.ending) return;
    const px = G.viewX != null ? G.viewX : st.x, py = G.viewY != null ? G.viewY : st.y;
    const sx = px - G.camX;
    if (st.flying) { drawJet(ctx, sx, py, 1, st.rot, null); return; }
    const idx = st.onGround ? Math.floor(st.x / 22) % 8 : 3;
    const fc = runFrames[idx];
    if (!fc) return;
    const onIce = st.speedMul > 1 && st.onGround;
    if (onIce) { // speed lines
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const ly = (st.grav === 1 ? st.y - 60 : st.y + 4) + i * 13 + ((G.time * 90 + i * 7) % 8);
        const len = 26 + ((i * 37 + Math.floor(G.time * 30)) % 22);
        ctx.beginPath(); ctx.moveTo(sx - 26, ly); ctx.lineTo(sx - 26 - len, ly); ctx.stroke();
      }
    }
    ctx.save();
    if (st.grav === 1) { ctx.translate(sx, py - 36); ctx.rotate(st.rot + (onIce ? -0.14 : 0)); }
    else { ctx.translate(sx, py + 36); ctx.scale(1, -1); ctx.rotate(st.rot + (onIce ? -0.14 : 0)); }
    ctx.drawImage(fc, -fc.lw / 2, 36 - fc.lh, fc.lw, fc.lh);
    ctx.restore();
  }

  function drawParticles(ctx, G) {
    for (const p of G.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x - G.camX, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const f of G.floaters) {
      const age = G.time - f.t0;
      ctx.globalAlpha = Math.max(0, 1 - age / f.dur);
      text(ctx, f.text, f.x - G.camX, f.y - age * 40, `bold ${f.size || 18}px ${TITLE_FONT}`, f.color, 'center', 'rgba(0,0,0,0.8)', 4);
    }
    ctx.globalAlpha = 1;
  }

  function drawCollectibleIcon(ctx, icon, x, y) {
    if (icon === 'coin') {
      ctx.fillStyle = '#ffcc00'; ctx.beginPath(); ctx.arc(x + 8, y + 9, 9, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#7a5a00'; ctx.lineWidth = 1.5; ctx.stroke();
      text(ctx, '$', x + 8, y + 10, `bold 11px ${TITLE_FONT}`, '#7a5a00', 'center');
    } else {
      ctx.fillStyle = '#23232a'; roundRect(ctx, x, y, 14, 18, 3); ctx.fill();
      ctx.fillStyle = '#ffd400'; ctx.fillRect(x, y + 4, 14, 3); ctx.fillRect(x, y + 11, 14, 3);
    }
  }
  function drawHUD(ctx, G, pal) {
    const lv = G.level, def = lv.def;
    const pct = Math.min(100, Math.max(0, (G.st ? G.st.x : 0) / lv.lengthPx * 100));
    const bx0 = 330, by0 = 14, bw = 300, bh = 12;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; roundRect(ctx, bx0 - 2, by0 - 2, bw + 4, bh + 4, 8); ctx.fill();
    ctx.fillStyle = grad(ctx, 'hud|' + pal.accentHex, bx0, 0, bx0 + bw, 0, [0, '#2ecc71', 1, pal.accentHex]);
    roundRect(ctx, bx0, by0, Math.max(4, bw * pct / 100), bh, 6); ctx.fill();
    text(ctx, `${pct.toFixed(0)}%`, bx0 + bw + 16, by0 + bh / 2, `bold 16px ${TITLE_FONT}`, '#fff', 'left', 'rgba(0,0,0,0.8)', 3);
    text(ctx, `ATTEMPT ${G.attempt}`, 16, 20, `bold 16px ${TITLE_FONT}`, '#fff', 'left', 'rgba(0,0,0,0.8)', 3);
    text(ctx, def.name, 16, 40, `bold 11px ${UI_FONT}`, 'rgba(255,255,255,0.75)', 'left', 'rgba(0,0,0,0.8)', 3);
    let ly = 58;
    if (G.practice || G.runPractice) { text(ctx, G.practice ? 'PRACTICE MODE' : 'PRACTICE RUN', 16, ly, `bold 12px ${UI_FONT}`, '#7dffb0', 'left', 'rgba(0,0,0,0.8)', 3); ly += 18; }
    if (G.muted) { text(ctx, 'MUTED', 16, ly, `bold 12px ${UI_FONT}`, '#ff9', 'left', 'rgba(0,0,0,0.8)', 3); ly += 18; }
    if (G.autoplay && !G.clean) text(ctx, 'AUTOPLAY', 16, ly, `bold 12px ${UI_FONT}`, '#ff9', 'left', 'rgba(0,0,0,0.8)', 3);
    drawCollectibleIcon(ctx, def.collectible.icon, W - 176, 10);
    text(ctx, `${G.stats.coins}/${lv.totalCoins}`, W - 156, 20, `bold 16px ${TITLE_FONT}`, '#fff', 'left', 'rgba(0,0,0,0.8)', 3);
    if (G.stats.combo >= 2 && G.st && !G.st.dead && G.state === 'playing') {
      const cy = G.st.grav === 1 ? GY - 100 - Math.min(60, G.stats.combo * 2) : CY + 100 + Math.min(60, G.stats.combo * 2);
      text(ctx, `ON BEAT ×${G.stats.combo}`, C.PLAYER_X, cy, `bold 16px ${TITLE_FONT}`, '#7dffb0', 'center', 'rgba(0,0,0,0.8)', 4);
    }
    if (G.attemptX != null) {
      const sx = G.attemptX - G.camX;
      if (sx > -300 && sx < W + 300) text(ctx, `Attempt ${G.attempt}`, sx, 150, `bold 44px ${TITLE_FONT}`, '#fff', 'center', 'rgba(0,0,0,0.8)', 6);
    }
    if (G.practice && G.checkpoints) {
      for (let i = 0; i < G.checkpoints.length; i++) {
        const sx = G.checkpoints[i] - G.camX;
        if (sx < -50 || sx > W + 50) continue;
        const latest = i === G.checkpoints.length - 1;
        ctx.fillStyle = '#ccc'; ctx.fillRect(sx - 2, GY - 70, 4, 70);
        ctx.fillStyle = latest ? '#2ecc71' : '#8fd9a8';
        ctx.beginPath(); ctx.moveTo(sx + 2, GY - 70); ctx.lineTo(sx + 34, GY - 58); ctx.lineTo(sx + 2, GY - 46); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
      }
    }
  }

  function drawDeath(ctx, G) {
    if (!G.deathMsg) return;
    const x = C.PLAYER_X, y = GY - 130;
    ctx.font = `bold 20px ${UI_FONT}`;
    const w = ctx.measureText(G.deathMsg).width + 40;
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; roundRect(ctx, x - w / 2, y - 22, w, 44, 10); ctx.fill();
    ctx.strokeStyle = '#c8102e'; ctx.lineWidth = 3; ctx.stroke();
    text(ctx, G.deathMsg, x, y, `bold 20px ${UI_FONT}`, '#fff', 'center');
  }

  function drawEndingExtras(ctx, G) {
    const e = G.ending;
    if (!e) return;
    const goal = e.goalX - G.camX;
    if (e.type === 'plaque') {
      const cheering = e.phase === 'hop' || e.phase === 'done';
      const hop = cheering ? Math.abs(Math.sin(G.time * 3.2)) * 110 : 0; // low-gravity bounces
      drawPose(ctx, cheering ? 'cheer' : 'point', goal, GY - hop, 96, false);
      if (e.ufoX != null) {
        const ux = e.goalX + e.ufoX - G.camX, uy = 150 + Math.sin(G.time * 4) * 8;
        drawDrone(ctx, { cx: ux, skin: 'ufo', floorY: uy, hBase: 0, amp: 0, period: 1, phase: 0, dir: 1, r: 14 }, ux, Object.assign({}, G, { st: null, beat: 0 }));
      }
    } else if (e.type === 'map' || e.type === 'sign' || e.type === 'canal') {
      const cheering = e.phase === 'slide' || e.phase === 'flag' || e.phase === 'ship' || e.phase === 'done';
      const hop = e.phase === 'slide' || e.phase === 'ship' || (e.phase === 'flag' && e.flag2Y > 0) ? Math.abs(Math.sin(G.time * 10)) * 12 : 0;
      drawPose(ctx, cheering ? 'cheer' : 'point', goal, GY - hop, 96, false);
    } else if (e.trumpIn > 0 && e.trumpIn < 1) {
      const p = e.trumpIn, ease = p * p * (3 - 2 * p);
      if (e.type === 'truck') drawPose(ctx, 'cheer', goal + 10 + ease * 54, GY - ease * 62, 84 - ease * 28, false);
      else drawPose(ctx, 'point', goal - 30 + ease * 55, GY - ease * 30, 84 - ease * 20, false);
    }
    if (e.banner && G.state !== 'complete') {
      ctx.globalAlpha = Math.min(1, e.bannerT * 6);
      text(ctx, e.banner, W / 2, 80, `bold 40px ${TITLE_FONT}`, '#ffd400', 'center', 'rgba(0,0,0,0.85)', 8);
      ctx.globalAlpha = 1;
    }
  }

  // ---------------- on-screen buttons ----------------
  // Geometry is shared with input hit-testing in game.js (TD_RENDER.uiButtons), so what is drawn is
  // exactly what is tappable. Sizes are chosen for thumbs: a phone in landscape scales the canvas to
  // roughly 0.7, so a 46 px button is a 32 px target plus the touch slop applied in game.js.
  function uiButtons(G) {
    const b = [], s = G.state;
    if (s === 'menu') {
      b.push({ id: 'practice', x: 14, y: 110, w: 142, h: 34, label: 'PRACTICE', value: G.practice ? 'ON' : 'OFF', on: G.practice });
      b.push({ id: 'mute', x: 14, y: 150, w: 142, h: 34, label: 'SOUND', value: G.muted ? 'OFF' : 'ON', on: !G.muted });
      b.push({ id: 'sync', x: 14, y: 190, w: 142, h: 34, label: 'SYNC', value: G.offsetMs ? `${G.offsetMs > 0 ? '+' : ''}${G.offsetMs} ms` : 'AUTO', neutral: true });
      if (G.fsAvailable) b.push({ id: 'fullscreen', x: W - 60, y: 8, w: 48, h: 40, icon: G.fullscreen ? 'exitfs' : 'fs' });
      b.push({ id: 'privacy', x: W - 96, y: H - 36, w: 84, h: 26, label: 'PRIVACY', small: true });
    } else if (s === 'playing' || s === 'dead') {
      b.push({ id: 'pause', x: W - 62, y: 8, w: 50, h: 40, icon: 'pause' });
    } else if (s === 'paused') {
      const x0 = W / 2 - 205, y0 = 196;
      b.push({ id: 'resume', x: x0, y: y0, w: 200, h: 46, label: 'RESUME', primary: true });
      b.push({ id: 'restart', x: x0 + 210, y: y0, w: 200, h: 46, label: 'RESTART' });
      b.push({ id: 'practice', x: x0, y: y0 + 56, w: 200, h: 46, label: 'PRACTICE', value: G.practice ? 'ON' : 'OFF', on: G.practice });
      b.push({ id: 'mute', x: x0 + 210, y: y0 + 56, w: 200, h: 46, label: 'SOUND', value: G.muted ? 'OFF' : 'ON', on: !G.muted });
      b.push({ id: 'quit', x: x0, y: y0 + 112, w: 410, h: 46, label: 'QUIT TO MENU' });
    } else if (s === 'complete') {
      b.push({ id: 'menu', x: W / 2 - 140, y: 420, w: 280, h: 46, label: 'BACK TO MENU', primary: true });
    } else if (s === 'calibrate' && G.calib) {
      if (G.calib.phase === 'tap') b.push({ id: 'calib_cancel', x: W / 2 - 80, y: 436, w: 160, h: 40, label: 'CANCEL' });
      else {
        b.push({ id: 'calib_done', x: W / 2 - 320, y: 420, w: 200, h: 46, label: 'DONE', primary: true });
        b.push({ id: 'calib_again', x: W / 2 - 100, y: 420, w: 200, h: 46, label: 'TAP AGAIN' });
        b.push({ id: 'calib_reset', x: W / 2 + 120, y: 420, w: 200, h: 46, label: 'RESET TO AUTO' });
      }
    }
    return b;
  }
  function drawUiIcon(ctx, icon, cx, cy) {
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (icon === 'pause') { ctx.fillRect(cx - 9, cy - 9, 6, 18); ctx.fillRect(cx + 3, cy - 9, 6, 18); return; }
    const enter = icon === 'fs', r = enter ? 9 : 4, a = 6; // corner brackets: arms point in (enter) or out (exit)
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const x = cx + sx * r, y = cy + sy * r, d = enter ? -1 : 1;
      ctx.beginPath(); ctx.moveTo(x + d * sx * a, y); ctx.lineTo(x, y); ctx.lineTo(x, y + d * sy * a); ctx.stroke();
    }
  }
  function drawButtons(ctx, G) {
    for (const b of uiButtons(G)) {
      ctx.fillStyle = b.primary ? '#ffd400' : b.on ? 'rgba(20,110,60,0.92)' : 'rgba(0,0,0,0.65)';
      roundRect(ctx, b.x, b.y, b.w, b.h, 10); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = b.primary ? '#7a5a00' : b.on ? '#7dffb0' : 'rgba(255,255,255,0.55)'; ctx.stroke();
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      if (b.icon) { drawUiIcon(ctx, b.icon, cx, cy); continue; }
      if (b.value != null) {
        text(ctx, b.label, b.x + 14, cy + 1, `bold 15px ${TITLE_FONT}`, '#fff', 'left');
        text(ctx, b.value, b.x + b.w - 14, cy + 1, `bold 15px ${TITLE_FONT}`, b.neutral ? '#ffe9a0' : b.on ? '#7dffb0' : '#ff9d9d', 'right');
      } else text(ctx, b.label, cx, cy + 1, `bold ${b.small ? 12 : 16}px ${TITLE_FONT}`, b.primary ? '#1a0a0a' : b.small ? '#cfd3ff' : '#fff', 'center');
    }
  }
  function drawOverlayPanel(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(5,6,20,0.88)'; roundRect(ctx, x, y, w, h, 16); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2; ctx.stroke();
  }
  function drawTitle(ctx, x, y, size) {
    ctx.save();
    ctx.font = `bold ${size}px ${TITLE_FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = size * 0.16; ctx.strokeStyle = '#1a0a0a'; ctx.strokeText('TRUMP DASH', x + 4, y + 6);
    ctx.lineWidth = size * 0.16; ctx.strokeStyle = '#ffd400'; ctx.strokeText('TRUMP DASH', x, y);
    ctx.fillStyle = grad(ctx, `title|${y}|${size}`, 0, y - size / 2, 0, y + size / 2, [0, '#c8102e', 0.48, '#c8102e', 0.5, '#ffffff', 0.62, '#ffffff', 0.64, '#0033a0', 1, '#0033a0']);
    ctx.fillText('TRUMP DASH', x, y);
    ctx.restore();
  }
  // level-select card geometry (shared with input hit-testing)
  function menuCardRect(i, n) {
    if (n > 4) { // two rows of three, or of four once there are more than six levels
      const cols = n > 6 ? 4 : 3, w = n > 6 ? 186 : 250, h = 140, gap = n > 6 ? 12 : 15;
      const x0 = 170 + (780 - (cols * w + (cols - 1) * gap)) / 2;
      return { x: x0 + (i % cols) * (w + gap), y: 118 + Math.floor(i / cols) * (h + 10), w, h };
    }
    const w = n > 3 ? 186 : n > 2 ? 250 : 330, h = 210, gap = n > 3 ? 12 : n > 2 ? 15 : 40;
    const total = n * w + (n - 1) * gap;
    const x0 = 170 + (780 - total) / 2;
    return { x: x0 + i * (w + gap), y: 150, w, h };
  }
  // shorten a string with an ellipsis until it fits `maxW` in `font`
  function fitText(ctx, str, maxW, font) {
    ctx.font = font;
    if (ctx.measureText(str).width <= maxW) return str;
    let s = str;
    while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    return s.trimEnd() + '…';
  }
  function drawRunFrame(ctx, x) { const fc = runFrames[2]; if (fc) ctx.drawImage(fc, x, GY - fc.lh, fc.lw, fc.lh); }
  function drawThumb(ctx, def, x, y, w, h, G) {
    ctx.save();
    roundRect(ctx, x, y, w, h, 8); ctx.clip();
    const p = def.palettes.drop;
    ctx.fillStyle = grad(ctx, `thumb|${def.id}|${y}|${h}`, 0, y, 0, y + h, [0, p.top, 1, p.bot]);
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = p.ground; ctx.fillRect(x, y + h - 22, w, 22);
    ctx.fillStyle = p.gline; ctx.fillRect(x, y + h - 23, w, 2);
    const s = 0.34;
    ctx.translate(x, y + h - 22 - GY * s);
    ctx.scale(s, s);
    const fakeG = { camX: 0, time: G.time, beatPulse: G.beatPulse, st: null, beat: 0 };
    const pal = paletteOf(def, 'drop');
    if (def.ending.type === 'truck') {
      drawTruck(ctx, (w * 0.78) / s, fakeG, null);
      drawSpike(ctx, { x: (w * 0.12) / s, base: GY, flip: false }, (w * 0.12) / s, pal);
      drawSpike(ctx, { x: (w * 0.12) / s + 40, base: GY, flip: false }, (w * 0.12) / s + 40, pal);
      drawRunFrame(ctx, (w * 0.33) / s);
    } else if (def.ending.type === 'toll') {
      drawTanker(ctx, (w * 0.98) / s, GY - 4, 0.5, '#7a1f1f', fakeG, 0);
      drawTollGate(ctx, (w * 0.52) / s, fakeG, { arm: 1, stamp1: 0, stamp2: 0, subSign: 0, trumpIn: 0, tankers: [] });
      drawMine(ctx, { cx: (w * 0.14) / s, cy: GY - 46, r: 16 }, (w * 0.14) / s, fakeG);
      drawRunFrame(ctx, (w * 0.28) / s);
    } else if (def.ending.type === 'plaque') {
      drawLander(ctx, (w * 0.8) / s, GY, 0.9);
      drawSpike(ctx, { x: (w * 0.1) / s, base: GY, flip: false, skin: 'alien' }, (w * 0.1) / s, Object.assign({ G: fakeG }, pal));
      drawMine(ctx, { cx: (w * 0.5) / s, cy: GY - 120, r: 16, skin: 'asteroid' }, (w * 0.5) / s, fakeG);
      drawRunFrame(ctx, (w * 0.3) / s);
    } else if (def.ending.type === 'canal') {
      drawCanalGate(ctx, (w * 0.05) / s - 120, fakeG, { gate: 1, ship: 0.42, stamp1: 0, stamp2: 0, subSign: 0 });
      drawSpike(ctx, { x: (w * 0.1) / s, base: GY, flip: false, skin: 'croc' }, (w * 0.1) / s, pal);
      drawRunFrame(ctx, (w * 0.3) / s);
    } else if (def.ending.type === 'jet') {
      drawBlock(ctx, { l: 0, r: 40, top: GY - 150, bot: GY, w: 1, h: 4, skin: 'tower' }, (w * 0.62) / s, pal);
      drawBlock(ctx, { l: 0, r: 40, top: GY - 90, bot: GY, w: 1, h: 2, skin: 'minaret' }, (w * 0.9) / s, pal);
      drawSpike(ctx, { x: (w * 0.1) / s, base: GY, flip: false }, (w * 0.1) / s, pal);
      drawJet(ctx, (w * 0.36) / s, GY - 170, 1.25, -0.18, null);
    } else if (def.ending.type === 'sign') {
      ctx.save(); ctx.scale(0.62, 0.62); ctx.translate(0, GY * 0.6);
      drawBorderSign(ctx, (w * 0.05) / (s * 0.62), fakeG, { stamp1: 0, stamp2: 0, flagY: 1, flag2Y: 0 });
      ctx.restore();
      drawSpike(ctx, { x: (w * 0.12) / s, base: GY, flip: false, skin: 'mountie' }, (w * 0.12) / s, pal);
      drawMine(ctx, { cx: (w * 0.62) / s, cy: GY - 18, r: 16, skin: 'puck' }, (w * 0.62) / s, fakeG);
      drawRunFrame(ctx, (w * 0.32) / s);
    } else {
      drawIsland(ctx, (w * 0.72) / s, GY - 112, 190, 220, null);
      drawSpike(ctx, { x: (w * 0.1) / s, base: GY, flip: false, skin: 'bear' }, (w * 0.1) / s, pal);
      drawPortal(ctx, { cx: (w * 0.42) / s, cy: GY - 150, r: 34, dir: -1, label: '' }, (w * 0.42) / s, fakeG);
      drawRunFrame(ctx, (w * 0.24) / s);
    }
    ctx.restore();
  }
  function drawMenu(ctx, G) {
    const blink = Math.sin(G.time * 4) > -0.2;
    const levels = G.levels, n = levels.length;
    const grid = n > 4;
    drawTitle(ctx, W / 2 + 60, grid ? 52 : 70, grid ? 62 : 76);
    text(ctx, 'A RHYTHM-RUNNER PARODY  ·  RUN. JUMP. ANNEX. STAY ON THE BEAT.', W / 2 + 60, grid ? 94 : 122, `bold ${grid ? 13 : 15}px ${UI_FONT}`, '#ffe9a0', 'center', 'rgba(0,0,0,0.8)', 4);
    drawPose(ctx, 'podium', 88, GY - 2, 210, false);
    const small = n > 2, compact = n > 3;
    for (let i = 0; i < n; i++) {
      const def = levels[i], r = menuCardRect(i, n), sel = i === G.levelIdx;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; roundRect(ctx, r.x, r.y, r.w, r.h, 12); ctx.fill();
      ctx.lineWidth = sel ? 4 : 2; ctx.strokeStyle = sel ? '#ffd400' : 'rgba(255,255,255,0.3)';
      if (sel) { ctx.shadowColor = '#ffd400'; ctx.shadowBlur = 18; }
      roundRect(ctx, r.x, r.y, r.w, r.h, 12); ctx.stroke();
      ctx.shadowBlur = 0;
      if (grid) {
        const tight = r.w < 200; // four-column layout: narrower thumbnail and type
        drawThumb(ctx, def, r.x + 8, r.y + 8, tight ? 56 : 100, r.h - 16, G);
        const tx = r.x + (tight ? 72 : 118), maxW = r.x + r.w - 8 - tx;
        text(ctx, fitText(ctx, `${i + 1}. ${def.name}`, maxW, `bold ${tight ? 12 : 14}px ${TITLE_FONT}`), tx, r.y + 22, `bold ${tight ? 12 : 14}px ${TITLE_FONT}`, '#fff', 'left');
        const diffCol = def.difficulty === 'EXTREME' ? '#ff2d95' : def.difficulty === 'INSANE' ? '#c8102e' : def.difficulty === 'EXPERT' ? '#8e44ad' : def.difficulty === 'HARD' ? '#ff8c00' : '#2ecc71';
        const pw = tight ? 48 : 58;
        ctx.fillStyle = diffCol; roundRect(ctx, tx, r.y + 34, pw, 16, 8); ctx.fill();
        text(ctx, def.difficulty, tx + pw / 2, r.y + 42, `bold ${tight ? 8 : 9}px ${TITLE_FONT}`, '#fff', 'center');
        text(ctx, `${def.bpm} BPM`, tx + pw + 8, r.y + 42, `${tight ? 9 : 10}px ${UI_FONT}`, '#cfd3ff', 'left');
        text(ctx, fitText(ctx, def.tagline, maxW, `${tight ? 9 : 10}px ${UI_FONT}`), tx, r.y + 62, `${tight ? 9 : 10}px ${UI_FONT}`, '#cfd3ff', 'left');
        const sf = `bold ${tight ? 9 : 10}px ${TITLE_FONT}`, vx = tx + (tight ? 28 : 34);
        const best = G.best[def.id] || 0, wins = G.wins[def.id] || 0, pbest = G.pbest[def.id] || 0, pwins = G.pwins[def.id] || 0;
        text(ctx, 'REG', tx, r.y + 88, sf, '#ffffff', 'left');
        text(ctx, `BEST ${best.toFixed(0)}%  ·  ${wins}×`, vx, r.y + 88, sf, '#7dffb0', 'left');
        text(ctx, 'PRAC', tx, r.y + 106, sf, '#ffffff', 'left');
        text(ctx, `BEST ${pbest.toFixed(0)}%  ·  ${pwins}×`, vx, r.y + 106, sf, '#8fd3ff', 'left');
        if (sel && blink) text(ctx, '▶', r.x + r.w - 14, r.y + 124, `bold 16px ${TITLE_FONT}`, '#ffd400', 'center');
        continue;
      }
      drawThumb(ctx, def, r.x + 10, r.y + 10, r.w - 20, compact ? 86 : 100, G);
      const nameFont = compact ? 15 : small ? 20 : 24;
      const ny = compact ? r.y + 112 : r.y + 128;
      text(ctx, `${i + 1}. ${def.name}`, r.x + 12, ny, `bold ${nameFont}px ${TITLE_FONT}`, '#fff', 'left');
      const diffCol = def.difficulty === 'INSANE' ? '#c8102e' : def.difficulty === 'HARD' ? '#ff8c00' : '#2ecc71';
      const bw = compact ? 56 : 68;
      ctx.fillStyle = diffCol; roundRect(ctx, r.x + r.w - bw - 12, ny + (compact ? 12 : -11), bw, compact ? 18 : 22, 11); ctx.fill();
      text(ctx, def.difficulty, r.x + r.w - bw / 2 - 12, ny + (compact ? 21 : 0), `bold ${compact ? 9 : 11}px ${TITLE_FONT}`, '#fff', 'center');
      text(ctx, compact ? `${def.bpm} BPM` : `${def.tagline}  ·  ${def.bpm} BPM`, r.x + 12, ny + 21, `${compact ? 10 : small ? 12 : 13}px ${UI_FONT}`, '#cfd3ff', 'left');
      if (compact) text(ctx, def.tagline, r.x + 12, ny + 36, `10px ${UI_FONT}`, '#cfd3ff', 'left');
      const sf = `bold ${compact ? 10 : small ? 11 : 12}px ${TITLE_FONT}`;
      const best = G.best[def.id] || 0, wins = G.wins[def.id] || 0, pbest = G.pbest[def.id] || 0, pwins = G.pwins[def.id] || 0;
      const y1 = compact ? ny + 56 : r.y + 172, y2 = compact ? ny + 72 : r.y + 191, lx = compact ? r.x + 50 : r.x + 78;
      text(ctx, compact ? 'REG' : 'REGULAR', r.x + 12, y1, sf, '#ffffff', 'left');
      text(ctx, `BEST ${best.toFixed(0)}%  ·  ${wins}×`, lx, y1, sf, '#7dffb0', 'left');
      text(ctx, compact ? 'PRAC' : 'PRACTICE', r.x + 12, y2, sf, '#ffffff', 'left');
      text(ctx, `BEST ${pbest.toFixed(0)}%  ·  ${pwins}×`, lx, y2, sf, '#8fd3ff', 'left');
      if (sel && blink) text(ctx, '▶', r.x + r.w - 16, y2, `bold 16px ${TITLE_FONT}`, '#ffd400', 'center');
    }
    const py = grid ? 434 : 392;
    if (blink) text(ctx, G.touch ? 'TAP TO DASH' : 'PRESS SPACE OR CLICK TO DASH', W / 2 + 60, py, `bold ${grid ? 22 : 26}px ${TITLE_FONT}`, '#fff', 'center', 'rgba(0,0,0,0.9)', 6);
    text(ctx, G.touch ? 'TAP A CARD TO CHOOSE A LEVEL  ·  TAP IT AGAIN TO START' : `← →  or  1–${n}  or click a card to choose a level`, W / 2 + 60, py + 26, `13px ${UI_FONT}`, '#e8e8ff', 'center', 'rgba(0,0,0,0.8)', 3);
    const lines = G.touch ? [
      'TAP — jump (hold to keep jumping)     PAUSE button top-right during a run',
      'PRACTICE adds checkpoints. SYNC tunes tap timing: do it once with the headphones you play with.',
    ] : [
      'SPACE / ↑ / CLICK — jump (hold to keep jumping)',
      'P — practice mode     M — mute     C — sync taps to the beat     ESC — pause     R — restart     F — fullscreen     H — hitboxes',
    ];
    lines.forEach((l, i) => text(ctx, l, W / 2 + 60, (grid ? 480 : 460) + i * (grid ? 17 : 20), `${grid ? 12 : 13}px ${UI_FONT}`, '#e8e8ff', 'center', 'rgba(0,0,0,0.8)', 3));
    text(ctx, 'Jumps land on the beat: listen for the clap. Parody — not affiliated with any person, government or oil company.', W / 2, H - 16, `12px ${UI_FONT}`, 'rgba(255,255,255,0.75)', 'center', 'rgba(0,0,0,0.8)', 3);
  }
  function drawCalibrate(ctx, G) { // buttons come from uiButtons / drawButtons
    const c = G.calib;
    if (!c) return;
    drawOverlayPanel(ctx, W / 2 - 330, 54, 660, 434);
    text(ctx, 'TAP TO THE BEAT', W / 2, 96, `bold 40px ${TITLE_FONT}`, '#ffd400', 'center', '#3a2a00', 6);
    if (c.phase === 'tap') {
      text(ctx, (G.touch ? 'Tap the screen' : 'Press SPACE or click') + ' on every click, with the headphones or speaker you play with.', W / 2, 134, `15px ${UI_FONT}`, '#fff', 'center');
      const ready = c.song >= 0.3, beat = Math.max(0, c.song) / C.BEAT_SEC, ph = beat % 1; // ph = 0 on the click
      const cx = W / 2, cy = 272, r = 60 + 16 * Math.pow(1 - ph, 3);
      ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.arc(cx, cy, 94, 0, Math.PI * 2); ctx.stroke();
      if (c.taps.length) { ctx.strokeStyle = '#7dffb0'; ctx.beginPath(); ctx.arc(cx, cy, 94, -Math.PI / 2, -Math.PI / 2 + (c.taps.length / c.need) * Math.PI * 2); ctx.stroke(); }
      ctx.fillStyle = ready ? `rgba(255,212,0,${(0.55 + 0.45 * Math.pow(1 - ph, 2)).toFixed(2)})` : 'rgba(255,255,255,0.3)';
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      text(ctx, ready ? String((Math.floor(beat) % 4) + 1) : 'READY', cx, cy + 2, `bold ${ready ? 48 : 22}px ${TITLE_FONT}`, '#1a0a0a', 'center');
      if (c.last != null && G.time - c.lastAt < 0.25) { ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, 80 + (G.time - c.lastAt) * 140, 0, Math.PI * 2); ctx.stroke(); }
      text(ctx, `${c.taps.length} / ${c.need}`, cx, 394, `bold 22px ${TITLE_FONT}`, '#fff', 'center');
      if (c.last != null) text(ctx, `last tap ${c.last >= 0 ? '+' : ''}${Math.round(c.last * 1000)} ms`, cx, 418, `13px ${UI_FONT}`, '#cfd3ff', 'center');
    } else {
      const late = Math.round(c.measured * 1000), auto = Math.round(c.auto * 1000);
      text(ctx, `Your taps arrive ${Math.abs(late)} ms ${late >= 0 ? 'after' : 'before'} the click.`, W / 2, 148, `bold 20px ${UI_FONT}`, '#fff', 'center');
      text(ctx, `Sync offset set to ${G.offsetMs >= 0 ? '+' : ''}${G.offsetMs} ms` + (auto ? ` on top of the ${auto} ms your device reports.` : '.'), W / 2, 186, `15px ${UI_FONT}`, '#cfd3ff', 'center');
      text(ctx, 'The music now starts that much earlier, so taps that feel on the beat land on the beat.', W / 2, 212, `15px ${UI_FONT}`, '#cfd3ff', 'center');
      const sx0 = W / 2 - 240, sw = 480, sy = 300, px = (e) => sx0 + sw / 2 + Math.max(-1, Math.min(1, e / 0.15)) * (sw / 2 - 10);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; roundRect(ctx, sx0, sy - 14, sw, 28, 8); ctx.fill();
      ctx.fillStyle = '#7dffb0'; ctx.fillRect(sx0 + sw / 2 - 1, sy - 22, 2, 44);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (const e of c.taps) { ctx.beginPath(); ctx.arc(px(e), sy, 5, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#ffd400'; ctx.fillRect(px(c.measured) - 2, sy - 20, 4, 40);
      text(ctx, '-150 ms', sx0, sy + 32, `12px ${UI_FONT}`, '#cfd3ff', 'left');
      text(ctx, 'on the beat', W / 2, sy + 32, `12px ${UI_FONT}`, '#cfd3ff', 'center');
      text(ctx, '+150 ms', sx0 + sw, sy + 32, `12px ${UI_FONT}`, '#cfd3ff', 'right');
      text(ctx, 'Recalibrate if you switch to Bluetooth headphones or another device.', W / 2, 376, `13px ${UI_FONT}`, 'rgba(255,255,255,0.7)', 'center');
    }
  }
  function drawPaused(ctx, G) { // the buttons themselves come from uiButtons / drawButtons
    drawOverlayPanel(ctx, W / 2 - 240, 116, 480, 310);
    text(ctx, 'PAUSED', W / 2, 160, `bold 44px ${TITLE_FONT}`, '#fff', 'center');
    text(ctx, G.runPractice ? 'This run counts toward practice-mode records.' : 'Turning practice on makes this run count as practice.', W / 2, 378, `12px ${UI_FONT}`, '#cfd3ff', 'center');
    if (!G.touch) text(ctx, 'SPACE resume  ·  R restart  ·  P practice  ·  M mute  ·  Q quit', W / 2, 402, `12px ${UI_FONT}`, 'rgba(255,255,255,0.7)', 'center');
  }
  function drawComplete(ctx, G) {
    const def = G.level.def;
    drawOverlayPanel(ctx, W / 2 - 330, 60, 660, 420);
    text(ctx, 'LEVEL COMPLETE', W / 2, 110, `bold 52px ${TITLE_FONT}`, '#ffd400', 'center', '#3a2a00', 8);
    text(ctx, def.complete.title, W / 2, 158, `bold 20px ${UI_FONT}`, '#fff', 'center');
    text(ctx, def.complete.quote, W / 2, 186, `italic 15px ${UI_FONT}`, '#ffe9a0', 'center');
    const s = G.stats;
    const acc = s.jumps ? Math.round(((s.perfect + s.good) / s.jumps) * 100) : 0;
    const mode = G.runPractice ? 'PRACTICE MODE' : 'REGULAR MODE';
    const cleared = G.runPractice ? G.pwins[def.id] : G.wins[def.id];
    const rows = [
      ['Counted as', `${mode}  (cleared ${cleared || 0}×)`],
      ['Attempts', `${G.attempt}`],
      [`${def.collectible.label[0].toUpperCase() + def.collectible.label.slice(1)} collected`, `${s.coins} / ${G.level.totalCoins}`],
      ['On-beat jumps', `${s.perfect + s.good} / ${s.jumps}  (${acc}%)`],
      ['Perfect', `${s.perfect}`],
      ['Best combo', `×${s.maxCombo}`],
      [def.complete.statLabel, `${s.extra || 0}`],
    ];
    rows.forEach(([k, v], i) => {
      text(ctx, k, W / 2 - 200, 226 + i * 28, `16px ${UI_FONT}`, '#cfd3ff', 'left');
      text(ctx, v, W / 2 + 200, 226 + i * 28, `bold 18px ${TITLE_FONT}`, i === 0 ? (G.runPractice ? '#8fd3ff' : '#7dffb0') : '#fff', 'right');
    });
    if (!G.touch) text(ctx, 'or press SPACE', W / 2, 474, `11px ${UI_FONT}`, 'rgba(255,255,255,0.6)', 'center');
  }

  // frame diagnostics overlay: fps, frame-time strip (red bars are dropped frames), the last long frames
  function drawPerf(ctx, G) {
    const p = G.perf;
    const x = 12, y = H - 132, w = 420, h = 120;
    ctx.fillStyle = 'rgba(0,0,0,0.72)'; roundRect(ctx, x, y, w, h, 8); ctx.fill();
    const scale = ctx.canvas ? (ctx.canvas.width / W).toFixed(2) : '?';
    text(ctx, `${p.fps.toFixed(0)} fps   display ${(p.period * 1000).toFixed(1)} ms   game js ${p.jsMs.toFixed(1)} ms   draw ${(G.drawMs || 0).toFixed(1)} ms   scale ${scale}   dropped ${p.longCount}`, x + 10, y + 14, `11px monospace`, '#fff', 'left');
    const sx = x + 10, sy = y + 26, sw = w - 20, sh = 28, n = p.dts.length;
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(sx, sy, sw, sh);
    for (let i = 0; i < n; i++) {
      const d = p.dts[i], bh = Math.min(sh, (d / (p.period * 3)) * sh);
      ctx.fillStyle = d > p.period * 1.6 && d > 0.02 ? '#ff5555' : '#7dffb0';
      ctx.fillRect(sx + (i / 240) * sw, sy + sh - bh, Math.max(1, sw / 240), bh);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(sx, sy + sh - sh / 3, sw, 1); // one display period
    let ly = y + 66;
    const recent = p.long.slice(-4).reverse();
    if (!recent.length) text(ctx, 'no dropped frames yet', x + 10, ly, `11px monospace`, '#cfd3ff', 'left');
    for (const l of recent) {
      const blame = l.js > l.dt * 0.6 ? (l.draw > l.js * 0.6 ? 'draw' : l.steps > 12 ? 'physics catch-up' : 'game js') : l.tick > 6 ? 'audio scheduling' : 'browser / system';
      text(ctx, `${l.at.toFixed(1)}s  ${l.dt.toFixed(0)} ms  (js ${l.js.toFixed(1)}, draw ${l.draw.toFixed(1)}, steps ${l.steps}, tick ${l.tick.toFixed(1)})  ${blame}`, x + 10, ly, `11px monospace`, l.js > l.dt * 0.6 ? '#ffd27f' : '#cfd3ff', 'left');
      ly += 14;
    }
  }
  function draw(ctx, G) {
    ctx.save();
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    if (G.shake > 0.5) ctx.translate((Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake);
    if (G.state === 'menu' || G.state === 'loading' || G.state === 'calibrate') {
      const def = G.levels[G.levelIdx] || G.levels[0];
      const pal = paletteOf(def, 'drop');
      drawBackground(ctx, G, pal, def.backdrop);
      drawGround(ctx, G, pal, null);
      if (G.state === 'menu') { drawMenu(ctx, G); drawButtons(ctx, G); }
      else if (G.state === 'calibrate') { drawCalibrate(ctx, G); drawButtons(ctx, G); }
      else text(ctx, 'LOADING…', W / 2, H / 2, `bold 30px ${TITLE_FONT}`, '#fff', 'center');
      if (G.perf && G.perf.on) drawPerf(ctx, G);
      ctx.restore();
      return;
    }
    const pal = palette(G.level, G.beat);
    drawBackground(ctx, G, pal, G.level.def.backdrop);
    drawGround(ctx, G, pal, G.level);
    drawCeilings(ctx, G, pal, G.level);
    drawFlightZones(ctx, G, G.level);
    drawObjects(ctx, G, pal);
    drawPlayer(ctx, G);
    drawEndingExtras(ctx, G);
    drawParticles(ctx, G);
    drawHUD(ctx, G, pal);
    if (G.state === 'dead') drawDeath(ctx, G);
    if (G.state === 'paused') drawPaused(ctx, G);
    if (G.state === 'complete') drawComplete(ctx, G);
    drawButtons(ctx, G);
    if (G.perf && G.perf.on) drawPerf(ctx, G);
    ctx.restore();
  }

  root.TD_RENDER = { init, draw, palette, drawPose, drawTitle, menuCardRect, loadImage, uiButtons, setScale };
})(typeof window !== 'undefined' ? window : globalThis);
