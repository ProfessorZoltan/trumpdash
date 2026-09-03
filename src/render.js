// Trump Dash - canvas renderer
(function (root) {
  const C = root.TD_CONST, SPR = root.TD_SPRITES, LV = root.TD_LEVEL, PHYS = root.TD_PHYSICS;
  const W = C.W, H = C.H, B = C.BLOCK, GY = C.GROUND_Y, CY = C.CEIL_Y;
  const TITLE_FONT = 'Impact, "Arial Black", "Segoe UI Black", sans-serif';
  const UI_FONT = '"Segoe UI", Arial, sans-serif';
  const SERIF = 'Georgia, "Times New Roman", serif';

  let sheet = null;
  const runFrames = [];

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
    runFrames.length = 0;
    for (const f of SPR.FRAMES.run) {
      const cv = document.createElement('canvas');
      cv.width = Math.ceil(f.w * SPR.RUN_SCALE);
      cv.height = Math.ceil(f.h * SPR.RUN_SCALE);
      const c = cv.getContext('2d');
      c.imageSmoothingEnabled = true;
      c.imageSmoothingQuality = 'high';
      c.drawImage(img, f.x, f.y, f.w, f.h, 0, 0, cv.width, cv.height);
      runFrames.push(cv);
    }
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
  function drawBackground(ctx, G, pal, backdrop) {
    const grad = ctx.createLinearGradient(0, 0, 0, GY);
    grad.addColorStop(0, pal.top);
    grad.addColorStop(1, pal.bot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, GY);
    ctx.fillStyle = `rgba(255,255,255,${(0.07 * G.beatPulse).toFixed(3)})`;
    ctx.fillRect(0, 0, W, GY);
    const cam = G.camX;
    for (let i = 0; i < 60; i++) {
      const sx = ((rnd(i) * 1400 - cam * 0.05) % 1400 + 1400) % 1400 - 200;
      const sy = rnd(i + 100) * 260;
      const tw = 0.5 + 0.5 * Math.sin(G.time * 3 + i);
      ctx.fillStyle = `rgba(255,255,255,${(0.3 + 0.5 * tw).toFixed(2)})`;
      ctx.fillRect(sx, sy, 2, 2);
    }
    if (backdrop === 'gulf') drawGulfBackdrop(ctx, G, cam);
    else if (backdrop === 'arctic') drawArcticBackdrop(ctx, G, cam);
    else drawCityBackdrop(ctx, cam);
  }
  function drawCityBackdrop(ctx, cam) {
    const per = 1600;
    const off = ((-cam * 0.15) % per + per) % per;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo(off + k * per, GY);
      for (let i = 0; i <= 16; i++) ctx.lineTo(off + k * per + (i / 16) * per, GY - 90 - rnd(i * 7 + 3) * 120);
      ctx.lineTo(off + k * per + per, GY);
      ctx.closePath();
      ctx.fill();
    }
    const per2 = 1200;
    const off2 = ((-cam * 0.4) % per2 + per2) % per2;
    for (let k = -1; k <= 1; k++) {
      let x = off2 + k * per2, i = 0;
      while (x < off2 + (k + 1) * per2) {
        const w = 30 + rnd(i * 3 + 11) * 70, h = 40 + rnd(i * 5 + 17) * 150;
        ctx.fillStyle = 'rgba(0,0,0,0.38)';
        ctx.fillRect(x, GY - h, w, h);
        ctx.fillStyle = 'rgba(255,230,120,0.35)';
        for (let wy = GY - h + 10; wy < GY - 10; wy += 16) for (let wx = x + 6; wx < x + w - 8; wx += 12) if (rnd(wx * 0.37 + wy * 0.11 + i) > 0.55) ctx.fillRect(wx, wy, 4, 6);
        x += w + 12 + rnd(i * 9 + 1) * 40;
        i++;
      }
    }
  }
  function drawGulfBackdrop(ctx, G, cam) {
    const per = 1800;
    const off = ((-cam * 0.12) % per + per) % per;
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo(off + k * per, GY - 120);
      for (let i = 0; i <= 12; i++) ctx.lineTo(off + k * per + (i / 12) * per, GY - 150 - rnd(i * 5 + 9) * 70);
      ctx.lineTo(off + k * per + per, GY - 120);
      ctx.closePath();
      ctx.fill();
    }
    const sea = ctx.createLinearGradient(0, GY - 130, 0, GY);
    sea.addColorStop(0, 'rgba(10,60,80,0.9)');
    sea.addColorStop(1, 'rgba(4,25,40,0.95)');
    ctx.fillStyle = sea;
    ctx.fillRect(0, GY - 130, W, 130);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(0, GY - 130, W, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 40; i++) {
      const sx = ((rnd(i + 300) * 1200 - cam * 0.25) % 1200 + 1200) % 1200 - 100;
      const sy = GY - 125 + rnd(i + 400) * 100;
      const w = 10 + 30 * rnd(i + 500) * (0.5 + 0.5 * Math.sin(G.time * 2 + i));
      ctx.fillRect(sx, sy, w, 1.5);
    }
    const per2 = 1500;
    const off2 = ((-cam * 0.3) % per2 + per2) % per2;
    for (let k = -1; k <= 1; k++) {
      for (let i = 0; i < 5; i++) {
        const x = off2 + k * per2 + rnd(i * 13 + 7) * per2, w = 70 + rnd(i * 3) * 60, y = GY - 122 + rnd(i + 20) * 30;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(x, y - 8, w, 8);
        ctx.fillRect(x + w - 18, y - 22, 12, 14);
        ctx.fillStyle = 'rgba(255,255,200,0.7)';
        ctx.fillRect(x + w - 13, y - 26, 2, 2);
      }
      for (let i = 0; i < 3; i++) {
        const x = off2 + k * per2 + 200 + i * 480 + rnd(i + 40) * 200;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(x, GY - 200, 6, 80);
        ctx.fillRect(x - 10, GY - 130, 26, 12);
        const fl = 0.6 + 0.4 * Math.sin(G.time * 9 + i * 2);
        ctx.fillStyle = `rgba(255,140,30,${(0.7 * fl).toFixed(2)})`;
        ctx.beginPath(); ctx.ellipse(x + 3, GY - 208, 6, 10 + 6 * fl, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(255,220,120,${(0.8 * fl).toFixed(2)})`;
        ctx.beginPath(); ctx.ellipse(x + 3, GY - 206, 3, 6, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  function drawArcticBackdrop(ctx, G, cam) {
    // aurora ribbons
    for (let k = 0; k < 3; k++) {
      const baseY = 70 + k * 45, hue = k === 1 ? '120,255,190' : k === 2 ? '150,120,255' : '90,220,255';
      ctx.beginPath();
      for (let x = -20; x <= W + 20; x += 12) {
        const y = baseY + Math.sin(x * 0.012 + G.time * 0.6 + k * 2 - cam * 0.0008) * 22 + Math.sin(x * 0.03 - G.time * 0.4) * 8;
        if (x === -20) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      for (let x = W + 20; x >= -20; x -= 12) {
        const y = baseY + 70 + Math.sin(x * 0.012 + G.time * 0.6 + k * 2 - cam * 0.0008) * 22 + Math.sin(x * 0.025 + G.time * 0.5) * 10;
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      const gg = ctx.createLinearGradient(0, baseY, 0, baseY + 80);
      gg.addColorStop(0, `rgba(${hue},0.0)`); gg.addColorStop(0.4, `rgba(${hue},0.22)`); gg.addColorStop(1, `rgba(${hue},0.0)`);
      ctx.fillStyle = gg;
      ctx.fill();
    }
    // snowy mountains
    const per = 1700;
    const off = ((-cam * 0.15) % per + per) % per;
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo(off + k * per, GY - 110);
      for (let i = 0; i <= 14; i++) ctx.lineTo(off + k * per + (i / 14) * per, GY - 150 - rnd(i * 7 + 5) * 130);
      ctx.lineTo(off + k * per + per, GY - 110);
      ctx.closePath();
      ctx.fillStyle = 'rgba(230,240,255,0.35)';
      ctx.fill();
    }
    // icy sea band
    const sea = ctx.createLinearGradient(0, GY - 120, 0, GY);
    sea.addColorStop(0, 'rgba(40,110,150,0.85)');
    sea.addColorStop(1, 'rgba(10,40,70,0.95)');
    ctx.fillStyle = sea;
    ctx.fillRect(0, GY - 120, W, 120);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(0, GY - 120, W, 1);
    // icebergs on the water
    const per2 = 1400;
    const off2 = ((-cam * 0.3) % per2 + per2) % per2;
    for (let k = -1; k <= 1; k++) {
      for (let i = 0; i < 6; i++) {
        const x = off2 + k * per2 + rnd(i * 11 + 3) * per2, w = 50 + rnd(i * 5) * 90, h = 25 + rnd(i * 3 + 1) * 45, y = GY - 110 + rnd(i + 30) * 60;
        ctx.fillStyle = 'rgba(235,248,255,0.9)';
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w * 0.3, y - h); ctx.lineTo(x + w * 0.55, y - h * 0.6); ctx.lineTo(x + w * 0.75, y - h * 0.9); ctx.lineTo(x + w, y); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(120,190,230,0.6)';
        ctx.fillRect(x + 4, y - 3, w - 8, 3);
      }
    }
  }

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
    } else if (style === 'ice') {
      ctx.strokeStyle = 'rgba(80,140,200,0.35)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 12; i++) {
        const sx = ((rnd(i + 900) * 1000 - cam) % 1000 + 1000) % 1000 - 20, sy = GY + 8 + rnd(i + 950) * 60;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 18 + rnd(i) * 20, sy + 10 + rnd(i + 2) * 14); ctx.lineTo(sx + 30 + rnd(i + 3) * 24, sy + 4 + rnd(i + 4) * 30); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(0, GY, W, 5);
    }
    const g2 = ctx.createLinearGradient(0, GY, 0, H);
    g2.addColorStop(0, 'rgba(0,0,0,0)');
    g2.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, GY, W, H - GY);
    ctx.fillStyle = pal.gline;
    ctx.fillRect(0, GY - 2, W, 3);
    ctx.fillStyle = `rgba(255,255,255,${(0.6 * G.beatPulse).toFixed(3)})`;
    ctx.fillRect(0, GY - 2, W, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(0, GY + 1, W, 6);
    // water gaps
    if (level && level.gaps.length) {
      const icy = level.def.backdrop === 'arctic';
      for (const gp of level.gaps) {
        const l = gp.l - cam, r = gp.r - cam;
        if (r < 0 || l > W) continue;
        const wg = ctx.createLinearGradient(0, GY - 4, 0, H);
        if (icy) { wg.addColorStop(0, '#9fd9ff'); wg.addColorStop(0.15, '#2f7fb3'); wg.addColorStop(1, '#0a2a44'); }
        else { wg.addColorStop(0, '#2d8fa8'); wg.addColorStop(0.15, '#0f5f78'); wg.addColorStop(1, '#03202c'); }
        ctx.fillStyle = wg;
        ctx.fillRect(l, GY - 4, r - l, H - GY + 4);
        ctx.save(); ctx.beginPath(); ctx.rect(l, GY - 4, r - l, H - GY + 4); ctx.clip();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
        for (let row = 0; row < 3; row++) {
          ctx.beginPath();
          const y0 = GY + 2 + row * 22;
          for (let x = l; x <= r; x += 6) ctx.lineTo(x, y0 + Math.sin((x + cam) * 0.05 + G.time * 3 + row) * 3);
          ctx.stroke();
        }
        ctx.restore();
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(l - 3, GY - 4, 3, 30); ctx.fillRect(r, GY - 4, 3, 30);
      }
    }
  }
  // ice shelf along the top of the screen wherever gravity can be flipped
  function drawCeilings(ctx, G, pal, level) {
    if (!level || !level.ceilings || !level.ceilings.length) return;
    const cam = G.camX;
    for (const s of level.ceilings) {
      const l = s.l - cam, r = s.r - cam;
      if (r < 0 || l > W) continue;
      const g = ctx.createLinearGradient(0, 0, 0, CY);
      g.addColorStop(0, '#f4fbff'); g.addColorStop(0.7, '#cfe9fb'); g.addColorStop(1, '#9fd4f5');
      ctx.fillStyle = g;
      ctx.fillRect(l, 0, r - l, CY);
      ctx.save(); ctx.beginPath(); ctx.rect(l, 0, r - l, CY + 12); ctx.clip();
      ctx.fillStyle = '#9fd4f5';
      for (let x = l - 40 + ((cam % 80) + 80) % 80 * 0; x < r + 40; x += 34) {
        ctx.beginPath(); ctx.arc(x, CY - 2, 14, 0, Math.PI); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(80,140,200,0.3)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 10; i++) {
        const sx = l + rnd(i + 60) * (r - l), sy = 20 + rnd(i + 70) * 90;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 14, sy + 12); ctx.lineTo(sx + 30, sy + 4); ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = pal.gline; ctx.fillRect(l, CY - 1, r - l, 3);
      ctx.fillStyle = `rgba(255,255,255,${(0.6 * G.beatPulse).toFixed(3)})`; ctx.fillRect(l, CY - 1, r - l, 3);
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
  function drawSpike(ctx, o, sx, pal) {
    const x = sx, base = o.base;
    if (o.skin === 'bear') { drawBear(ctx, x, base, o.flip); return; }
    ctx.beginPath();
    if (o.flip) { ctx.moveTo(x, base); ctx.lineTo(x + B / 2, base + B); ctx.lineTo(x + B, base); }
    else { ctx.moveTo(x, base); ctx.lineTo(x + B / 2, base - B); ctx.lineTo(x + B, base); }
    ctx.closePath();
    const g = ctx.createLinearGradient(x, o.flip ? base + B : base - B, x, base);
    g.addColorStop(0, pal.spike);
    g.addColorStop(1, pal.accent);
    ctx.fillStyle = g;
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
    ctx.strokeStyle = `rgba(255,212,0,${0.35 + 0.5 * pulse})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, o.r + 6 + 6 * pulse, 0, Math.PI * 2); ctx.stroke();
    const g = ctx.createRadialGradient(cx - 6, cy - 6, 2, cx, cy, o.r);
    g.addColorStop(0, '#fff6b0'); g.addColorStop(0.6, '#ffd400'); g.addColorStop(1, '#c48a00');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, o.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#5a3a00'; ctx.lineWidth = 2; ctx.stroke();
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
    ctx.fillStyle = 'rgba(255,212,0,0.25)'; ctx.beginPath(); ctx.arc(sx, o.cy + bob, 20, 0, Math.PI * 2); ctx.fill();
    if (icon === 'coin') {
      const g = ctx.createRadialGradient(sx - 4, o.cy + bob - 4, 2, sx, o.cy + bob, 14);
      g.addColorStop(0, '#fff2a8'); g.addColorStop(0.7, '#ffcc00'); g.addColorStop(1, '#b8860b');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, o.cy + bob, 14, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#7a5a00'; ctx.lineWidth = 2; ctx.stroke();
      text(ctx, '$', sx, o.cy + bob + 1, `bold 16px ${TITLE_FONT}`, '#7a5a00', 'center');
    } else {
      const x = sx - 11, y = o.cy - 14 + bob;
      ctx.fillStyle = '#23232a'; roundRect(ctx, x, y, 22, 28, 5); ctx.fill();
      ctx.fillStyle = '#ffd400'; ctx.fillRect(x, y + 6, 22, 4); ctx.fillRect(x, y + 18, 22, 4);
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; roundRect(ctx, x, y, 22, 28, 5); ctx.stroke();
      text(ctx, 'OIL', sx, y + 13, `bold 8px ${UI_FONT}`, '#ffd400', 'center');
    }
  }
  function drawMine(ctx, o, sx, G) {
    const cx = sx, cy = o.cy, r = o.r;
    ctx.strokeStyle = '#111'; ctx.lineWidth = 3;
    for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4 + 0.39; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * 0.7, cy + Math.sin(a) * r * 0.7); ctx.lineTo(cx + Math.cos(a) * (r + 6), cy + Math.sin(a) * (r + 6)); ctx.stroke(); ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * (r + 6), cy + Math.sin(a) * (r + 6), 2.5, 0, Math.PI * 2); ctx.fill(); }
    const g = ctx.createRadialGradient(cx - r * 0.4, cy - r * 0.4, 1, cx, cy, r);
    g.addColorStop(0, '#6b6b75'); g.addColorStop(1, '#0d0d12');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = `rgba(255,40,40,${(0.35 + 0.65 * G.beatPulse).toFixed(2)})`; ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  function drawDrone(ctx, o, sx, G) {
    const beat = G.st ? G.st.t / C.BEAT_SEC : G.beat;
    const cy = PHYS.droneCY(o, beat), cx = sx;
    const d = o.dir || 1;
    const top = o.floorY - d * (o.hBase + o.amp), bot = o.floorY - d * (o.hBase - o.amp);
    ctx.strokeStyle = 'rgba(255,90,90,0.25)'; ctx.lineWidth = 1; ctx.setLineDash([4, 6]);
    ctx.beginPath(); ctx.moveTo(cx, Math.min(top, bot) - 8); ctx.lineTo(cx, Math.max(top, bot) + 8); ctx.stroke(); ctx.setLineDash([]);
    const spin = G.time * 40;
    ctx.fillStyle = '#2a2d36'; roundRect(ctx, cx - 14, cy - 5, 28, 10, 4); ctx.fill();
    ctx.strokeStyle = '#4a4f5c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx - 24, cy - 6); ctx.lineTo(cx + 24, cy - 6); ctx.stroke();
    ctx.fillStyle = 'rgba(220,230,255,0.6)';
    for (const dx of [-24, 24]) { ctx.beginPath(); ctx.ellipse(cx + dx, cy - 8, 12 * Math.abs(Math.cos(spin + dx)), 2.5, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = `rgba(255,50,50,${(0.4 + 0.6 * G.beatPulse).toFixed(2)})`; ctx.beginPath(); ctx.arc(cx, cy + 6, 3, 0, Math.PI * 2); ctx.fill();
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
  // A tanker ship, bow at (x, waterline y), pointing left. scale s.
  function drawTanker(ctx, x, y, s, hull, G, wake) {
    ctx.save();
    ctx.translate(x, y); ctx.scale(s, s);
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
    text(ctx, 'CRUDE', L / 2, -6, `bold 22px ${TITLE_FONT}`, 'rgba(255,255,255,0.8)', 'center');
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
    polyPath(ctx, GL, cx, cy, w, h);
    ctx.fillStyle = '#f2f8ff'; ctx.fill();
    ctx.strokeStyle = '#2b6cc4'; ctx.lineWidth = 3; ctx.stroke();
    ctx.save(); polyPath(ctx, GL, cx, cy, w, h); ctx.clip();
    ctx.fillStyle = 'rgba(160,210,240,0.5)'; ctx.fillRect(cx - w * 0.2, cy - h * 0.4, w * 0.45, h * 0.6);
    ctx.restore();
    text(ctx, 'GREENLAND', cx, cy - h * 0.05, `bold ${Math.max(10, w * 0.11)}px ${TITLE_FONT}`, '#0a2d6e', 'center');
    if (e) {
      const s = w / 200;
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
    // Florida marker off to the right
    const fx = sx + 560, fy = GY - 150;
    ctx.fillStyle = '#e8f0c8'; polyPath(ctx, FL, fx, fy, 60, 84); ctx.fill(); ctx.strokeStyle = '#2f9e44'; ctx.lineWidth = 2; ctx.stroke();
    text(ctx, 'FLORIDA', fx, fy + 56, `bold 12px ${TITLE_FONT}`, '#fff', 'center', 'rgba(0,0,0,0.8)', 3);
    const slide = e ? e.slide || 0 : 0;
    if (slide > 0) {
      // ghost of where the island used to be
      ctx.setLineDash([6, 6]); ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2;
      polyPath(ctx, GL, bcx, bcy, 200, 220); ctx.stroke(); ctx.setLineDash([]);
      text(ctx, '(VACANT)', bcx, bcy, `bold 16px ${TITLE_FONT}`, 'rgba(0,0,0,0.45)', 'center');
    }
    const ease = slide < 0.5 ? 2 * slide * slide : 1 - Math.pow(-2 * slide + 2, 2) / 2;
    const cx = bcx + (fx - 70 - bcx) * ease, cy = bcy + (fy - 10 - bcy) * ease, sc = 1 - 0.62 * ease;
    drawIsland(ctx, cx, cy, 200 * sc, 220 * sc, e);
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
        case 'goal':
          if (def.ending.type === 'truck') drawTruck(ctx, (G.ending ? G.ending.truckX : o.x) - cam, G, G.ending);
          else if (def.ending.type === 'toll') drawTollGate(ctx, o.x - cam, G, G.ending);
          else drawMapBoard(ctx, o.x - cam, G, G.ending);
          break;
      }
    }
    for (const o of late) drawSpike(ctx, o, o.x - cam, pal);
    if (G.showHitboxes) {
      ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 1;
      const beat = G.st ? G.st.t / C.BEAT_SEC : 0;
      for (const o of lv.objs) {
        if (o.xmax < cam - 60 || o.xmin > cam + W + 60) continue;
        if (o.t === 'spike') ctx.strokeRect(o.hb.l - cam, o.hb.top, o.hb.r - o.hb.l, o.hb.bot - o.hb.top);
        else if (o.t === 'block' || o.t === 'pad') ctx.strokeRect(o.l - cam, o.top, o.r - o.l, o.bot - o.top);
        else if (o.t === 'orb' || o.t === 'mine' || o.t === 'portal') { ctx.beginPath(); ctx.arc(o.cx - cam, o.cy, o.r, 0, Math.PI * 2); ctx.stroke(); }
        else if (o.t === 'drone') { ctx.beginPath(); ctx.arc(o.cx - cam, PHYS.droneCY(o, beat), o.r, 0, Math.PI * 2); ctx.stroke(); }
      }
      const st = G.st;
      if (st) ctx.strokeRect(st.x - C.PLAYER_W / 2 - cam, PHYS.hitTop(st), C.PLAYER_W, C.PLAYER_H);
    }
  }

  function drawPlayer(ctx, G) {
    const st = G.st;
    if (!st || st.dead || G.ending) return;
    const sx = st.x - G.camX;
    const idx = st.onGround ? Math.floor(st.x / 22) % 8 : 3;
    const fc = runFrames[idx];
    if (!fc) return;
    ctx.save();
    if (st.grav === 1) { ctx.translate(sx, st.y - 36); ctx.rotate(st.rot); }
    else { ctx.translate(sx, st.y + 36); ctx.scale(1, -1); ctx.rotate(st.rot); }
    ctx.drawImage(fc, -fc.width / 2, 36 - fc.height);
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
    const g = ctx.createLinearGradient(bx0, 0, bx0 + bw, 0);
    g.addColorStop(0, '#2ecc71'); g.addColorStop(1, pal.accentHex);
    ctx.fillStyle = g; roundRect(ctx, bx0, by0, Math.max(4, bw * pct / 100), bh, 6); ctx.fill();
    text(ctx, `${pct.toFixed(0)}%`, bx0 + bw + 16, by0 + bh / 2, `bold 16px ${TITLE_FONT}`, '#fff', 'left', 'rgba(0,0,0,0.8)', 3);
    text(ctx, `ATTEMPT ${G.attempt}`, 16, 20, `bold 16px ${TITLE_FONT}`, '#fff', 'left', 'rgba(0,0,0,0.8)', 3);
    text(ctx, def.name, 16, 40, `bold 11px ${UI_FONT}`, 'rgba(255,255,255,0.75)', 'left', 'rgba(0,0,0,0.8)', 3);
    let ly = 58;
    if (G.practice || G.runPractice) { text(ctx, G.practice ? 'PRACTICE MODE' : 'PRACTICE RUN', 16, ly, `bold 12px ${UI_FONT}`, '#7dffb0', 'left', 'rgba(0,0,0,0.8)', 3); ly += 18; }
    if (G.muted) { text(ctx, 'MUTED', 16, ly, `bold 12px ${UI_FONT}`, '#ff9', 'left', 'rgba(0,0,0,0.8)', 3); ly += 18; }
    if (G.autoplay) text(ctx, 'AUTOPLAY', 16, ly, `bold 12px ${UI_FONT}`, '#ff9', 'left', 'rgba(0,0,0,0.8)', 3);
    drawCollectibleIcon(ctx, def.collectible.icon, W - 118, 10);
    text(ctx, `${G.stats.coins}/${lv.totalCoins}`, W - 98, 20, `bold 16px ${TITLE_FONT}`, '#fff', 'left', 'rgba(0,0,0,0.8)', 3);
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
    if (e.type === 'map') {
      const hop = e.phase === 'slide' ? Math.abs(Math.sin(G.time * 10)) * 12 : 0;
      drawPose(ctx, e.phase === 'slide' || e.phase === 'done' ? 'cheer' : 'point', goal, GY - hop, 96, false);
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
    const g = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2);
    g.addColorStop(0, '#c8102e'); g.addColorStop(0.48, '#c8102e'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(0.62, '#ffffff'); g.addColorStop(0.64, '#0033a0'); g.addColorStop(1, '#0033a0');
    ctx.fillStyle = g; ctx.fillText('TRUMP DASH', x, y);
    ctx.restore();
  }
  // level-select card geometry (shared with input hit-testing)
  function menuCardRect(i, n) {
    const w = n > 2 ? 250 : 330, h = 210, gap = n > 2 ? 15 : 40;
    const total = n * w + (n - 1) * gap;
    const x0 = 170 + (780 - total) / 2;
    return { x: x0 + i * (w + gap), y: 150, w, h };
  }
  function drawThumb(ctx, def, x, y, w, h, G) {
    ctx.save();
    roundRect(ctx, x, y, w, h, 8); ctx.clip();
    const p = def.palettes.drop;
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, p.top); g.addColorStop(1, p.bot);
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
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
      if (runFrames[2]) ctx.drawImage(runFrames[2], (w * 0.33) / s, GY - 72);
    } else if (def.ending.type === 'toll') {
      drawTanker(ctx, (w * 0.98) / s, GY - 4, 0.5, '#7a1f1f', fakeG, 0);
      drawTollGate(ctx, (w * 0.52) / s, fakeG, { arm: 1, stamp1: 0, stamp2: 0, subSign: 0, trumpIn: 0, tankers: [] });
      drawMine(ctx, { cx: (w * 0.14) / s, cy: GY - 46, r: 16 }, (w * 0.14) / s, fakeG);
      if (runFrames[2]) ctx.drawImage(runFrames[2], (w * 0.28) / s, GY - 72);
    } else {
      drawIsland(ctx, (w * 0.7) / s, GY - 190, 210, 230, null);
      drawSpike(ctx, { x: (w * 0.1) / s, base: GY, flip: false, skin: 'bear' }, (w * 0.1) / s, pal);
      drawPortal(ctx, { cx: (w * 0.42) / s, cy: GY - 150, r: 34, dir: -1, label: '' }, (w * 0.42) / s, fakeG);
      if (runFrames[2]) ctx.drawImage(runFrames[2], (w * 0.24) / s, GY - 72);
    }
    ctx.restore();
  }
  function drawMenu(ctx, G) {
    const blink = Math.sin(G.time * 4) > -0.2;
    const levels = G.levels, n = levels.length;
    drawTitle(ctx, W / 2 + 60, 70, 76);
    text(ctx, 'A RHYTHM-RUNNER PARODY  ·  RUN. JUMP. ANNEX. STAY ON THE BEAT.', W / 2 + 60, 122, `bold 15px ${UI_FONT}`, '#ffe9a0', 'center', 'rgba(0,0,0,0.8)', 4);
    drawPose(ctx, 'podium', 88, GY - 2, 210, false);
    const small = n > 2;
    for (let i = 0; i < n; i++) {
      const def = levels[i], r = menuCardRect(i, n), sel = i === G.levelIdx;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; roundRect(ctx, r.x, r.y, r.w, r.h, 12); ctx.fill();
      ctx.lineWidth = sel ? 4 : 2; ctx.strokeStyle = sel ? '#ffd400' : 'rgba(255,255,255,0.3)';
      if (sel) { ctx.shadowColor = '#ffd400'; ctx.shadowBlur = 18; }
      roundRect(ctx, r.x, r.y, r.w, r.h, 12); ctx.stroke();
      ctx.shadowBlur = 0;
      drawThumb(ctx, def, r.x + 10, r.y + 10, r.w - 20, 100, G);
      text(ctx, `${i + 1}. ${def.name}`, r.x + 14, r.y + 128, `bold ${small ? 20 : 24}px ${TITLE_FONT}`, '#fff', 'left');
      const diffCol = def.difficulty === 'INSANE' ? '#c8102e' : def.difficulty === 'HARD' ? '#ff8c00' : '#2ecc71';
      ctx.fillStyle = diffCol; roundRect(ctx, r.x + r.w - 82, r.y + 117, 68, 22, 11); ctx.fill();
      text(ctx, def.difficulty, r.x + r.w - 48, r.y + 128, `bold 11px ${TITLE_FONT}`, '#fff', 'center');
      text(ctx, `${def.tagline}  ·  ${def.bpm} BPM`, r.x + 14, r.y + 149, `${small ? 12 : 13}px ${UI_FONT}`, '#cfd3ff', 'left');
      const sf = `bold ${small ? 11 : 12}px ${TITLE_FONT}`;
      const best = G.best[def.id] || 0, wins = G.wins[def.id] || 0, pbest = G.pbest[def.id] || 0, pwins = G.pwins[def.id] || 0;
      text(ctx, 'REGULAR', r.x + 14, r.y + 172, sf, '#ffffff', 'left');
      text(ctx, `BEST ${best.toFixed(0)}%  ·  CLEARED ${wins}×`, r.x + 78, r.y + 172, sf, '#7dffb0', 'left');
      text(ctx, 'PRACTICE', r.x + 14, r.y + 191, sf, '#ffffff', 'left');
      text(ctx, `BEST ${pbest.toFixed(0)}%  ·  CLEARED ${pwins}×`, r.x + 78, r.y + 191, sf, '#8fd3ff', 'left');
      if (sel && blink) text(ctx, '▶', r.x + r.w - 22, r.y + 191, `bold 16px ${TITLE_FONT}`, '#ffd400', 'center');
    }
    if (blink) text(ctx, G.touch ? 'TAP TO DASH' : 'PRESS SPACE OR CLICK TO DASH', W / 2 + 60, 392, `bold 26px ${TITLE_FONT}`, '#fff', 'center', 'rgba(0,0,0,0.9)', 6);
    text(ctx, '← →  or  1 / 2 / 3  or click a card to choose a level', W / 2 + 60, 420, `13px ${UI_FONT}`, '#e8e8ff', 'center', 'rgba(0,0,0,0.8)', 3);
    const lines = [
      'SPACE / ↑ / CLICK / TAP — jump (hold to keep jumping)',
      `P — practice mode with checkpoints [${G.practice ? 'ON' : 'OFF'}]     M — mute [${G.muted ? 'ON' : 'OFF'}]     ESC — pause     R — restart     H — hitboxes`,
    ];
    lines.forEach((l, i) => text(ctx, l, W / 2 + 60, 460 + i * 20, `13px ${UI_FONT}`, '#e8e8ff', 'center', 'rgba(0,0,0,0.8)', 3));
    text(ctx, 'Jumps land on the beat: listen for the clap. Parody — not affiliated with any person, government or oil company.', W / 2, H - 16, `12px ${UI_FONT}`, 'rgba(255,255,255,0.75)', 'center', 'rgba(0,0,0,0.8)', 3);
  }
  function drawPaused(ctx, G) {
    drawOverlayPanel(ctx, W / 2 - 220, H / 2 - 110, 440, 220);
    text(ctx, 'PAUSED', W / 2, H / 2 - 60, `bold 44px ${TITLE_FONT}`, '#fff', 'center');
    text(ctx, 'SPACE / CLICK — resume', W / 2, H / 2 - 5, `16px ${UI_FONT}`, '#fff', 'center');
    text(ctx, `P — practice mode [${G.practice ? 'ON' : 'OFF'}]     M — mute [${G.muted ? 'ON' : 'OFF'}]`, W / 2, H / 2 + 25, `16px ${UI_FONT}`, '#fff', 'center');
    text(ctx, 'R — restart     Q — quit to menu', W / 2, H / 2 + 52, `16px ${UI_FONT}`, '#fff', 'center');
    text(ctx, G.runPractice ? 'This run counts toward practice-mode records.' : 'Turning practice on makes this run count as practice.', W / 2, H / 2 + 82, `12px ${UI_FONT}`, '#cfd3ff', 'center');
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
    if (Math.sin(G.time * 4) > -0.2) text(ctx, 'SPACE / CLICK — back to menu', W / 2, 445, `bold 20px ${TITLE_FONT}`, '#7dffb0', 'center');
  }

  function draw(ctx, G) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (G.shake > 0.5) ctx.translate((Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake);
    if (G.state === 'menu' || G.state === 'loading') {
      const def = G.levels[G.levelIdx] || G.levels[0];
      const pal = paletteOf(def, 'drop');
      drawBackground(ctx, G, pal, def.backdrop);
      drawGround(ctx, G, pal, null);
      if (G.state === 'menu') drawMenu(ctx, G);
      else text(ctx, 'LOADING…', W / 2, H / 2, `bold 30px ${TITLE_FONT}`, '#fff', 'center');
      ctx.restore();
      return;
    }
    const pal = palette(G.level, G.beat);
    drawBackground(ctx, G, pal, G.level.def.backdrop);
    drawGround(ctx, G, pal, G.level);
    drawCeilings(ctx, G, pal, G.level);
    drawObjects(ctx, G, pal);
    drawPlayer(ctx, G);
    drawEndingExtras(ctx, G);
    drawParticles(ctx, G);
    drawHUD(ctx, G, pal);
    if (G.state === 'dead') drawDeath(ctx, G);
    if (G.state === 'paused') drawPaused(ctx, G);
    if (G.state === 'complete') drawComplete(ctx, G);
    ctx.restore();
  }

  root.TD_RENDER = { init, draw, palette, drawPose, menuCardRect };
})(typeof window !== 'undefined' ? window : globalThis);
