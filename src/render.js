// Trump Dash - canvas renderer
(function (root) {
  const C = root.TD_CONST, SPR = root.TD_SPRITES, LV = root.TD_LEVEL;
  const W = C.W, H = C.H, B = C.BLOCK, GY = C.GROUND_Y;
  const TITLE_FONT = 'Impact, "Arial Black", "Segoe UI Black", sans-serif';
  const UI_FONT = '"Segoe UI", Arial, sans-serif';
  const SERIF = 'Georgia, "Times New Roman", serif';

  const PAL = {
    intro:  { top: '#0b0f2e', bot: '#3b2b74', ground: '#161b45', gline: '#8c8cff', accent: '#ffd400', spike: '#e9edff' },
    verse:  { top: '#08245c', bot: '#2f74c0', ground: '#0d2f66', gline: '#5fb3ff', accent: '#ffd400', spike: '#ffffff' },
    build:  { top: '#2a0b3d', bot: '#8a2f8f', ground: '#2b1046', gline: '#ff6ad5', accent: '#ff4fa3', spike: '#ffe1f6' },
    drop:   { top: '#3b0808', bot: '#c62828', ground: '#3d0d0d', gline: '#ff7b7b', accent: '#ffcc00', spike: '#ffffff' },
    break:  { top: '#053a3a', bot: '#1fb39a', ground: '#083a36', gline: '#5fffe0', accent: '#ffd400', spike: '#ffffff' },
    drop2:  { top: '#2a0a2f', bot: '#e0206a', ground: '#310a33', gline: '#5ce1ff', accent: '#00e5ff', spike: '#ffffff' },
    finale: { top: '#3a1604', bot: '#ff8a00', ground: '#2a1808', gline: '#ffd27f', accent: '#ffd400', spike: '#ffffff' },
  };

  let sheet = null;
  const runFrames = [];

  function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) {
    const A = hexToRgb(a), Bc = hexToRgb(b);
    return `rgb(${Math.round(A[0] + (Bc[0] - A[0]) * t)},${Math.round(A[1] + (Bc[1] - A[1]) * t)},${Math.round(A[2] + (Bc[2] - A[2]) * t)})`;
  }
  function palette(beat) {
    const s = LV.sectionAt(beat);
    const cur = PAL[s.name], prev = PAL[s.prev];
    const t = Math.min(1, Math.max(0, (beat - s.start) / 4));
    const out = {};
    for (const k of Object.keys(cur)) out[k] = mix(prev[k], cur[k], t);
    out.accentHex = cur.accent;
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
  function drawBackground(ctx, G, pal) {
    const grad = ctx.createLinearGradient(0, 0, 0, GY);
    grad.addColorStop(0, pal.top);
    grad.addColorStop(1, pal.bot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, GY);
    // beat pulse
    ctx.fillStyle = `rgba(255,255,255,${(0.07 * G.beatPulse).toFixed(3)})`;
    ctx.fillRect(0, 0, W, GY);
    const cam = G.camX;
    // stars
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 60; i++) {
      const sx = ((rnd(i) * 1400 - cam * 0.05) % 1400 + 1400) % 1400 - 200;
      const sy = rnd(i + 100) * 260;
      const tw = 0.5 + 0.5 * Math.sin(G.time * 3 + i);
      ctx.globalAlpha = 0.3 + 0.5 * tw;
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.globalAlpha = 1;
    // far mountains
    const per = 1600;
    const off = ((-cam * 0.15) % per + per) % per;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo(off + k * per, GY);
      for (let i = 0; i <= 16; i++) {
        const x = off + k * per + (i / 16) * per;
        const y = GY - 90 - rnd(i * 7 + 3) * 120;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(off + k * per + per, GY);
      ctx.closePath();
      ctx.fill();
    }
    // mid skyline
    const per2 = 1200;
    const off2 = ((-cam * 0.4) % per2 + per2) % per2;
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    for (let k = -1; k <= 1; k++) {
      let x = off2 + k * per2;
      let i = 0;
      while (x < off2 + (k + 1) * per2) {
        const w = 30 + rnd(i * 3 + 11) * 70, h = 40 + rnd(i * 5 + 17) * 150;
        ctx.fillRect(x, GY - h, w, h);
        ctx.fillStyle = 'rgba(255,230,120,0.35)';
        for (let wy = GY - h + 10; wy < GY - 10; wy += 16) for (let wx = x + 6; wx < x + w - 8; wx += 12) if (rnd(wx * 0.37 + wy * 0.11 + i) > 0.55) ctx.fillRect(wx, wy, 4, 6);
        ctx.fillStyle = 'rgba(0,0,0,0.38)';
        x += w + 12 + rnd(i * 9 + 1) * 40;
        i++;
      }
    }
  }

  function drawGround(ctx, G, pal) {
    ctx.fillStyle = pal.ground;
    ctx.fillRect(0, GY, W, H - GY);
    const off = -(((G.camX % B) + B) % B);
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = off; x < W; x += B) { ctx.moveTo(x + 0.5, GY); ctx.lineTo(x + 0.5, H); }
    ctx.stroke();
    const g2 = ctx.createLinearGradient(0, GY, 0, H);
    g2.addColorStop(0, 'rgba(0,0,0,0)');
    g2.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, GY, W, H - GY);
    ctx.fillStyle = pal.gline;
    ctx.fillRect(0, GY - 2, W, 3);
    ctx.fillStyle = `rgba(255,255,255,${(0.6 * G.beatPulse).toFixed(3)})`;
    ctx.fillRect(0, GY - 2, W, 3);
    // player-lane shadow line
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, GY + 1, W, 6);
  }

  // ---------------- decoration ----------------
  function drawScene(ctx, kind, sx) {
    ctx.save();
    switch (kind) {
      case 'whitehouse': {
        const w = 300, h = 120, x = sx - w / 2, y = GY - h;
        ctx.fillStyle = '#e9e9f2';
        ctx.fillRect(x, y + 30, w, h - 30);
        ctx.fillStyle = '#d0d0dc';
        ctx.fillRect(x + 90, y, 120, 40);
        ctx.fillStyle = '#c8c8d4';
        ctx.beginPath(); ctx.moveTo(x + 80, y + 30); ctx.lineTo(x + 150, y - 10); ctx.lineTo(x + 220, y + 30); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f7f7ff';
        for (let i = 0; i < 6; i++) ctx.fillRect(x + 95 + i * 20, y + 30, 8, h - 30);
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
  function drawSpike(ctx, o, sx, pal) {
    const x = sx, base = o.base;
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
  function drawBlock(ctx, o, sx, pal) {
    const x = sx, y = o.top, w = o.r - o.l, h = o.bot - o.top;
    ctx.save();
    switch (o.skin) {
      case 'constitution': case 'wall': {
        ctx.fillStyle = '#f1e3bb'; roundRect(ctx, x, y, w, h, 4); ctx.fill();
        ctx.strokeStyle = '#8a6d3b'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#d9c48f'; ctx.fillRect(x + 2, y + 2, w - 4, 5); ctx.fillRect(x + 2, y + h - 7, w - 4, 5);
        ctx.strokeStyle = 'rgba(90,60,20,0.45)'; ctx.lineWidth = 1;
        for (let ly = y + 12; ly < y + h - 8; ly += 6) { ctx.beginPath(); ctx.moveTo(x + 6, ly); ctx.lineTo(x + w - 6, ly); ctx.stroke(); }
        if (o.skin === 'wall') {
          ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(-Math.PI / 2);
          text(ctx, 'ARTICLE I', 0, 0, `bold 15px ${SERIF}`, '#5a3a10', 'center'); ctx.restore();
        } else {
          text(ctx, 'We the', x + w / 2, y + 14, `italic bold 10px ${SERIF}`, '#4a3010', 'center');
          text(ctx, 'People', x + w / 2, y + 26, `italic bold 10px ${SERIF}`, '#4a3010', 'center');
        }
        ctx.fillStyle = '#c8102e'; ctx.beginPath(); ctx.arc(x + w - 8, y + h - 8, 5, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'congress': case 'court': {
        const marble = o.skin === 'court' ? '#dfe3ea' : '#efe9dc';
        ctx.fillStyle = marble; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        for (let cx = x + 6; cx < x + w - 4; cx += 10) ctx.fillRect(cx, y + 10, 3, h - 16);
        ctx.fillStyle = o.skin === 'court' ? '#b8bfcc' : '#cbbf9f';
        ctx.fillRect(x - 3, y, w + 6, 8); ctx.fillRect(x - 2, y + h - 6, w + 4, 6);
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
        if (o.skin === 'court') {
          // gavel
          ctx.fillStyle = '#6b3d1a'; ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(-0.6);
          ctx.fillRect(-3, -2, 26, 5); ctx.fillRect(-14, -9, 14, 18); ctx.restore();
        }
        break;
      }
      case 'law': {
        ctx.fillStyle = '#2b6cc4'; roundRect(ctx, x, y, w, h, 4); ctx.fill();
        ctx.strokeStyle = '#0d2f66'; ctx.lineWidth = 2; ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.5;
        const cx = x + w / 2, cy = y + h / 2;
        ctx.beginPath(); ctx.arc(cx, cy, 13, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(cx, cy, 6, 13, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx - 13, cy); ctx.lineTo(cx + 13, cy); ctx.stroke();
        break;
      }
      case 'press': {
        ctx.fillStyle = '#f7f7f2'; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#111'; ctx.fillRect(x + 3, y + 3, w - 6, 9);
        text(ctx, 'THE TRUTH', x + w / 2, y + 7.5, `bold 7px ${SERIF}`, '#fff', 'center');
        ctx.fillStyle = '#777';
        for (let ly = y + 16; ly < y + h - 4; ly += 4) ctx.fillRect(x + 4, ly, w - 8 - (ly % 3) * 4, 2);
        ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
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
      case 'gag': {
        ctx.fillStyle = '#2b2b33'; ctx.fillRect(x, y, w, h);
        ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
        ctx.strokeStyle = '#c8102e'; ctx.lineWidth = 6;
        for (let d = -h; d < w + h; d += 22) { ctx.beginPath(); ctx.moveTo(x + d, y + h); ctx.lineTo(x + d + h, y); ctx.stroke(); }
        ctx.restore();
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x + w / 2 - 60, y + 8, 120, h - 16);
        text(ctx, 'GAG ORDER', x + w / 2, y + h / 2, `bold 16px ${TITLE_FONT}`, '#fff', 'center');
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
      const font = o.skin === 'constitution' || o.skin === 'wall' ? `bold 13px ${SERIF}` : `bold 12px ${UI_FONT}`;
      labelAbove(ctx, o.label, x + w / 2, y - 14, font, '#ffffff');
    }
  }
  function drawPad(ctx, o, sx, G) {
    const x = sx, w = o.r - o.l;
    const glow = 0.5 + 0.5 * Math.sin(G.time * 8);
    ctx.fillStyle = `rgba(255,212,0,${0.25 + 0.25 * glow})`;
    ctx.beginPath(); ctx.ellipse(x + w / 2, o.bot - 4, w * 0.9, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd400'; roundRect(ctx, x, o.top, w, o.bot - o.top, 4); ctx.fill();
    ctx.strokeStyle = '#7a5a00'; ctx.lineWidth = 2; ctx.stroke();
    // sign
    const sy = o.top - 40 - 4 * glow;
    ctx.fillStyle = '#fffbe6'; roundRect(ctx, x + w / 2 - 58, sy - 12, 116, 24, 4); ctx.fill();
    ctx.strokeStyle = '#7a5a00'; ctx.lineWidth = 1.5; ctx.stroke();
    text(ctx, '⬆ ' + o.label, x + w / 2, sy, `bold 11px ${UI_FONT}`, '#5a3a00', 'center');
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
  function drawBarrel(ctx, o, sx, G) {
    if (o.got) return;
    const bob = Math.sin(G.time * 4 + o.cx * 0.01) * 4;
    const x = sx - 11, y = o.cy - 14 + bob;
    ctx.fillStyle = 'rgba(255,212,0,0.25)'; ctx.beginPath(); ctx.arc(sx, o.cy + bob, 20, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#23232a'; roundRect(ctx, x, y, 22, 28, 5); ctx.fill();
    ctx.fillStyle = '#ffd400'; ctx.fillRect(x, y + 6, 22, 4); ctx.fillRect(x, y + 18, 22, 4);
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; roundRect(ctx, x, y, 22, 28, 5); ctx.stroke();
    text(ctx, 'OIL', sx, y + 13, `bold 8px ${UI_FONT}`, '#ffd400', 'center');
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
    // chassis + coupling
    ctx.fillStyle = '#222'; ctx.fillRect(tl + 10, tb - 2, tr - tl + 40, 14);
    // tank
    const g = ctx.createLinearGradient(0, tt, 0, tb);
    g.addColorStop(0, '#f0f0f5'); g.addColorStop(0.45, '#b9b9c6'); g.addColorStop(0.55, '#8d8d9c'); g.addColorStop(1, '#d6d6e0');
    ctx.fillStyle = g; roundRect(ctx, tl, tt, tr - tl, tb - tt, 30); ctx.fill();
    ctx.strokeStyle = '#33333c'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(tl + 40, tt + 4, 6, tb - tt - 8); ctx.fillRect(tr - 46, tt + 4, 6, tb - tt - 8);
    // flag stripes + name plate
    const cxT = (tl + tr) / 2, plateW = 200;
    ctx.fillStyle = '#ffd400'; ctx.fillRect(cxT - plateW / 2, tt + 18, plateW, 8);
    ctx.fillStyle = '#0033a0'; ctx.fillRect(cxT - plateW / 2, tt + 26, plateW, 8);
    ctx.fillStyle = '#c8102e'; ctx.fillRect(cxT - plateW / 2, tt + 34, plateW, 8);
    text(ctx, 'VENEZUELA', cxT, tt + 64, `bold 34px ${TITLE_FONT}`, '#0033a0', 'center', '#ffffff', 6);
    if (e) {
      drawStamp(ctx, 'U.S.A.', cxT + 6, tt + 60, -0.2, e.stamp1, '#c8102e', 40, null);
      drawStamp(ctx, 'TRUMP', cxT - 4, tt + 58, 0.12, e.stamp2, '#ffd400', 46, '#3a2a00');
    }
    // cab
    const cl = sx - 24, cr = sx + 116, ct = GY - 146, cb = GY - 40;
    ctx.fillStyle = '#c8102e'; roundRect(ctx, cl, ct, cr - cl, cb - ct, 12); ctx.fill();
    ctx.strokeStyle = '#4a0a12'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(cl, ct + 62, cr - cl, 10);
    ctx.fillStyle = '#0033a0'; ctx.fillRect(cl, ct + 72, cr - cl, 6);
    // hood
    ctx.fillStyle = '#a60d26'; roundRect(ctx, cr - 40, ct + 46, 42, cb - ct - 46, 8); ctx.fill(); ctx.stroke();
    // window
    const wl = sx + 36, wr = sx + 92, wt = ct + 12, wb = ct + 58;
    ctx.fillStyle = '#8fd3ff'; roundRect(ctx, wl, wt, wr - wl, wb - wt, 6); ctx.fill();
    ctx.strokeStyle = '#4a0a12'; ctx.lineWidth = 2; ctx.stroke();
    if (e && e.trumpIn >= 1) {
      ctx.save(); roundRect(ctx, wl, wt, wr - wl, wb - wt, 6); ctx.clip();
      drawPose(ctx, 'thumbs', (wl + wr) / 2 + 4, wb + 44, 96, false);
      ctx.restore();
    }
    // door
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; roundRect(ctx, sx - 8, ct + 10, 48, cb - ct - 20, 6); ctx.stroke();
    ctx.fillStyle = '#ddd'; ctx.fillRect(sx + 26, ct + 52, 10, 3);
    // grille, bumper, light
    ctx.fillStyle = '#cfcfd8'; ctx.fillRect(cr - 8, ct + 70, 10, 34);
    ctx.fillStyle = '#ffec8a'; ctx.fillRect(cr - 12, ct + 54, 10, 10);
    ctx.fillStyle = '#333'; ctx.fillRect(cl - 4, cb - 10, cr - cl + 12, 10);
    // exhaust stack
    ctx.fillStyle = '#9a9aa6'; ctx.fillRect(sx + 2, ct - 46, 8, 50);
    ctx.fillStyle = '#666'; ctx.fillRect(sx, ct - 50, 12, 6);
    // wheels
    drawWheel(ctx, sx - 268, GY - 20, 20, wheel);
    drawWheel(ctx, sx - 220, GY - 20, 20, wheel);
    drawWheel(ctx, sx + 8, GY - 20, 20, wheel);
    drawWheel(ctx, sx + 86, GY - 20, 20, wheel);
    // name on cab
    text(ctx, 'OIL', sx + 12, ct + 36, `bold 14px ${TITLE_FONT}`, 'rgba(255,255,255,0.85)', 'center');
  }

  function drawObjects(ctx, G, pal) {
    const cam = G.camX, lv = G.level;
    for (const d of lv.deco) {
      const sx = d.x - cam;
      if (sx < -600 || sx > W + 600) continue;
      if (d.t === 'scene') drawScene(ctx, d.kind, sx); else drawSign(ctx, d, sx);
    }
    const late = [];
    for (const o of lv.objs) {
      if (o.xmax < cam - 60) continue;
      if (o.xmin > cam + W + 60) break;
      switch (o.t) {
        case 'block': drawBlock(ctx, o, o.l - cam, pal); break;
        case 'spike': late.push(o); break;
        case 'pad': drawPad(ctx, o, o.l - cam, G); break;
        case 'orb': drawOrb(ctx, o, o.cx - cam, G); break;
        case 'barrel': drawBarrel(ctx, o, o.cx - cam, G); break;
        case 'truck': drawTruck(ctx, (G.ending ? G.ending.truckX : o.x) - cam, G, G.ending); break;
      }
    }
    for (const o of late) drawSpike(ctx, o, o.x - cam, pal);
    if (G.showHitboxes) {
      ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 1;
      for (const o of lv.objs) {
        if (o.xmax < cam - 60 || o.xmin > cam + W + 60) continue;
        if (o.t === 'spike') ctx.strokeRect(o.hb.l - cam, o.hb.top, o.hb.r - o.hb.l, o.hb.bot - o.hb.top);
        else if (o.t === 'block' || o.t === 'pad') ctx.strokeRect(o.l - cam, o.top, o.r - o.l, o.bot - o.top);
        else if (o.t === 'orb') { ctx.beginPath(); ctx.arc(o.cx - cam, o.cy, o.r, 0, Math.PI * 2); ctx.stroke(); }
      }
      const st = G.st;
      if (st) ctx.strokeRect(st.x - C.PLAYER_W / 2 - cam, st.y - C.PLAYER_H, C.PLAYER_W, C.PLAYER_H);
    }
  }

  function drawPlayer(ctx, G) {
    const st = G.st;
    if (!st || st.dead || G.ending) return;
    const sx = st.x - G.camX, sy = st.y;
    const idx = st.onGround ? Math.floor(st.x / 22) % 8 : 3;
    const fc = runFrames[idx];
    if (!fc) return;
    ctx.save();
    ctx.translate(sx, sy - 36);
    ctx.rotate(st.rot);
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
      const a = Math.max(0, 1 - age / f.dur);
      ctx.globalAlpha = a;
      text(ctx, f.text, f.x - G.camX, f.y - age * 40, `bold ${f.size || 18}px ${TITLE_FONT}`, f.color, 'center', 'rgba(0,0,0,0.8)', 4);
    }
    ctx.globalAlpha = 1;
  }

  function drawHUD(ctx, G, pal) {
    const lv = G.level;
    const pct = Math.min(100, Math.max(0, (G.st ? G.st.x : 0) / lv.lengthPx * 100));
    // progress bar
    const bx0 = 330, by0 = 14, bw = 300, bh = 12;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; roundRect(ctx, bx0 - 2, by0 - 2, bw + 4, bh + 4, 8); ctx.fill();
    const g = ctx.createLinearGradient(bx0, 0, bx0 + bw, 0);
    g.addColorStop(0, '#2ecc71'); g.addColorStop(1, pal.accentHex);
    ctx.fillStyle = g; roundRect(ctx, bx0, by0, Math.max(4, bw * pct / 100), bh, 6); ctx.fill();
    text(ctx, `${pct.toFixed(0)}%`, bx0 + bw + 16, by0 + bh / 2, `bold 16px ${TITLE_FONT}`, '#fff', 'left', 'rgba(0,0,0,0.8)', 3);
    // attempt & practice
    text(ctx, `ATTEMPT ${G.attempt}`, 16, 20, `bold 16px ${TITLE_FONT}`, '#fff', 'left', 'rgba(0,0,0,0.8)', 3);
    if (G.practice) text(ctx, 'PRACTICE MODE', 16, 42, `bold 12px ${UI_FONT}`, '#7dffb0', 'left', 'rgba(0,0,0,0.8)', 3);
    if (G.muted) text(ctx, 'MUTED', 16, G.practice ? 60 : 42, `bold 12px ${UI_FONT}`, '#ff9', 'left', 'rgba(0,0,0,0.8)', 3);
    if (G.autoplay) text(ctx, 'AUTOPLAY', 16, 78, `bold 12px ${UI_FONT}`, '#ff9', 'left', 'rgba(0,0,0,0.8)', 3);
    // barrels
    ctx.fillStyle = '#23232a'; roundRect(ctx, W - 118, 10, 14, 18, 3); ctx.fill();
    ctx.fillStyle = '#ffd400'; ctx.fillRect(W - 118, 14, 14, 3); ctx.fillRect(W - 118, 21, 14, 3);
    text(ctx, `${G.stats.barrels}/${lv.totalBarrels}`, W - 98, 20, `bold 16px ${TITLE_FONT}`, '#fff', 'left', 'rgba(0,0,0,0.8)', 3);
    // combo
    if (G.stats.combo >= 2 && G.st && !G.st.dead && G.state === 'playing') {
      text(ctx, `ON BEAT ×${G.stats.combo}`, C.PLAYER_X, GY - 100 - Math.min(60, G.stats.combo * 2), `bold 16px ${TITLE_FONT}`, '#7dffb0', 'center', 'rgba(0,0,0,0.8)', 4);
    }
    // big "Attempt N" in world at start of attempt
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
    const door = e.truckX - G.camX;
    if (e.trumpIn > 0 && e.trumpIn < 1) {
      const p = e.trumpIn, ease = p * p * (3 - 2 * p);
      const x = door + 10 + ease * 54, y = GY - ease * 62;
      drawPose(ctx, 'cheer', x, y, 84 - ease * 28, false);
    }
    if (e.banner) {
      ctx.globalAlpha = Math.min(1, e.bannerT * 6);
      text(ctx, e.banner, W / 2, 110, `bold 40px ${TITLE_FONT}`, '#ffd400', 'center', 'rgba(0,0,0,0.85)', 8);
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
  function drawMenu(ctx, G) {
    const blink = Math.sin(G.time * 4) > -0.2;
    drawTitle(ctx, W / 2 + 90, 120, 92);
    text(ctx, 'A GEOMETRY DASH PARODY', W / 2 + 90, 186, `bold 20px ${UI_FONT}`, '#fff', 'center', 'rgba(0,0,0,0.8)', 4);
    text(ctx, 'Run. Jump. Annex. Stay on the beat.', W / 2 + 90, 214, `italic 17px ${UI_FONT}`, '#ffe9a0', 'center', 'rgba(0,0,0,0.8)', 4);
    drawPose(ctx, 'podium', 150, GY - 4, 300, false);
    // little truck preview
    ctx.save(); ctx.translate(0, GY * (1 - 0.55)); ctx.scale(0.55, 0.55); drawTruck(ctx, 880 / 0.55, G, null); ctx.restore();
    if (blink) text(ctx, G.touch ? 'TAP TO DASH' : 'PRESS SPACE OR CLICK TO DASH', W / 2 + 90, 268, `bold 26px ${TITLE_FONT}`, '#fff', 'center', 'rgba(0,0,0,0.9)', 6);
    const lines = [
      'SPACE / ↑ / CLICK / TAP — jump (hold to keep jumping)',
      `P — practice mode with checkpoints  [${G.practice ? 'ON' : 'OFF'}]`,
      `M — mute  [${G.muted ? 'ON' : 'OFF'}]     ESC — pause     R — restart     H — hitboxes`,
    ];
    lines.forEach((l, i) => text(ctx, l, W / 2 + 90, 306 + i * 22, `14px ${UI_FONT}`, '#e8e8ff', 'center', 'rgba(0,0,0,0.8)', 3));
    text(ctx, `BEST: ${G.best.toFixed(0)}%   ·   OIL SECURED: ${G.wins}×`, W / 2 + 90, 386, `bold 16px ${TITLE_FONT}`, '#7dffb0', 'center', 'rgba(0,0,0,0.8)', 4);
    text(ctx, 'Jumps land on the beat: listen for the clap. Parody — not affiliated with any person, government or oil company.', W / 2, H - 16, `12px ${UI_FONT}`, 'rgba(255,255,255,0.75)', 'center', 'rgba(0,0,0,0.8)', 3);
  }
  function drawPaused(ctx, G) {
    drawOverlayPanel(ctx, W / 2 - 220, H / 2 - 110, 440, 220);
    text(ctx, 'PAUSED', W / 2, H / 2 - 60, `bold 44px ${TITLE_FONT}`, '#fff', 'center');
    text(ctx, 'SPACE / CLICK — resume', W / 2, H / 2 - 5, `16px ${UI_FONT}`, '#fff', 'center');
    text(ctx, `P — practice mode [${G.practice ? 'ON' : 'OFF'}]     M — mute [${G.muted ? 'ON' : 'OFF'}]`, W / 2, H / 2 + 25, `16px ${UI_FONT}`, '#fff', 'center');
    text(ctx, 'R — restart     Q — quit to menu', W / 2, H / 2 + 55, `16px ${UI_FONT}`, '#fff', 'center');
  }
  function drawComplete(ctx, G) {
    drawOverlayPanel(ctx, W / 2 - 330, 60, 660, 420);
    text(ctx, 'LEVEL COMPLETE', W / 2, 110, `bold 52px ${TITLE_FONT}`, '#ffd400', 'center', '#3a2a00', 8);
    text(ctx, "VENEZUELA'S OIL: UNDER NEW MANAGEMENT", W / 2, 158, `bold 20px ${UI_FONT}`, '#fff', 'center');
    text(ctx, '"Nobody has ever seen a takeover like this. Everyone is saying it."', W / 2, 186, `italic 15px ${UI_FONT}`, '#ffe9a0', 'center');
    const s = G.stats;
    const acc = s.jumps ? Math.round(((s.perfect + s.good) / s.jumps) * 100) : 0;
    const rows = [
      ['Attempts', `${G.attempt}`],
      ['Barrels collected', `${s.barrels} / ${G.level.totalBarrels}`],
      ['On-beat jumps', `${s.perfect + s.good} / ${s.jumps}  (${acc}%)`],
      ['Perfect', `${s.perfect}`],
      ['Best combo', `×${s.maxCombo}`],
      ['Constitutions harmed', `${G.constitutionsStepped || 0}`],
    ];
    rows.forEach(([k, v], i) => {
      text(ctx, k, W / 2 - 200, 236 + i * 30, `16px ${UI_FONT}`, '#cfd3ff', 'left');
      text(ctx, v, W / 2 + 200, 236 + i * 30, `bold 18px ${TITLE_FONT}`, '#fff', 'right');
    });
    if (Math.sin(G.time * 4) > -0.2) text(ctx, 'SPACE / CLICK — back to menu', W / 2, 440, `bold 20px ${TITLE_FONT}`, '#7dffb0', 'center');
  }

  function draw(ctx, G) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (G.shake > 0.5) ctx.translate((Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake);
    const beat = G.state === 'menu' || G.state === 'loading' ? 64 + (G.time * C.BPM) / 60 : G.beat;
    const pal = palette(G.state === 'menu' ? 64 : beat);
    drawBackground(ctx, G, pal);
    if (G.state === 'menu' || G.state === 'loading') {
      drawGround(ctx, G, pal);
      if (G.state === 'menu') drawMenu(ctx, G);
      else text(ctx, 'LOADING…', W / 2, H / 2, `bold 30px ${TITLE_FONT}`, '#fff', 'center');
      ctx.restore();
      return;
    }
    drawGround(ctx, G, pal);
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

  root.TD_RENDER = { init, draw, palette, drawPose };
})(window);
