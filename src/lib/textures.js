/**
 * textures.js — كل الخامات مولّدة برمجياً على Canvas (مفيش أي ملفات صور)
 * كل الدوال ترجّع canvas، وبتشتغل في المتصفح وفي بيئة الاختبار (node) عن طريق
 * حقن canvas factory في globalThis.__canvasFactory
 */

export const FONT_DISPLAY = '"Impact","Haettenschweiler","Arial Black","Segoe UI Black","DejaVu Sans",sans-serif';
export const FONT_SERIF = '"Georgia","Times New Roman","DejaVu Serif",serif';
export const FONT_SANS = '"Segoe UI","Helvetica Neue",Arial,"DejaVu Sans",sans-serif';

function makeCanvas(w, h) {
  if (typeof globalThis.__canvasFactory === 'function') return globalThis.__canvasFactory(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

const rnd = (() => {
  let s = 20241028;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
})();

/** ضوضاء ناعمة بسيطة (قيمة) لعمل تفاصيل الخشب والحجر */
function valueNoise(w, h, scale = 8, seed = 1) {
  const cols = Math.max(2, Math.ceil(w / scale));
  const rows = Math.max(2, Math.ceil(h / scale));
  const grid = new Float32Array(cols * rows);
  let s = seed * 9301;
  for (let i = 0; i < grid.length; i++) {
    s = (s * 9301 + 49297) % 233280;
    grid[i] = s / 233280;
  }
  const out = new Float32Array(w * h);
  const lerp = (a, b, t) => a + (b - a) * t;
  for (let y = 0; y < h; y++) {
    const gy = (y / scale) % (rows - 1);
    const y0 = Math.floor(gy), ty = gy - y0, y1 = Math.min(rows - 1, y0 + 1);
    const fy = ty * ty * (3 - 2 * ty);
    for (let x = 0; x < w; x++) {
      const gx = (x / scale) % (cols - 1);
      const x0 = Math.floor(gx), tx = gx - x0, x1 = Math.min(cols - 1, x0 + 1);
      const fx = tx * tx * (3 - 2 * tx);
      const a = lerp(grid[y0 * cols + x0], grid[y0 * cols + x1], fx);
      const b = lerp(grid[y1 * cols + x0], grid[y1 * cols + x1], fx);
      out[y * w + x] = lerp(a, b, fy);
    }
  }
  return out;
}

function paintNoise(ctx, w, h, { scale = 10, seed = 2, alpha = 0.16 } = {}) {
  const n = valueNoise(w, h, scale, seed);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let p = 0, i = 0; p < n.length; p++, i += 4) {
    const k = (n[p] - 0.5) * 2 * alpha * 255 * (d[i + 3] / 255);
    d[i] = Math.max(0, Math.min(255, d[i] + k));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + k));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + k));
  }
  ctx.putImageData(img, 0, 0);
}

/* ============================================================
   الخشب
   ============================================================ */
export function woodTexture({
  w = 512, h = 512, base = '#2a1512', dark = '#150a0a', light = '#4a2a1d', planks = 5, horizontal = false, seed = 3,
} = {}) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // ألياف الخشب
  for (let i = 0; i < 260; i++) {
    ctx.strokeStyle = i % 3 === 0 ? light : dark;
    ctx.globalAlpha = i % 3 === 0 ? 0.035 + rnd() * 0.05 : 0.04 + rnd() * 0.09;
    ctx.lineWidth = 0.6 + rnd() * 2.6;
    const y = rnd() * h;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= w; x += 32) {
      ctx.lineTo(x, y + Math.sin((x / w) * Math.PI * 3 + i) * (1.2 + rnd() * 2.4));
    }
    ctx.stroke();
  }
  // عقد
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 6; i++) {
    const cx = rnd() * w, cy = rnd() * h, r = 4 + rnd() * 10;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, dark);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 1.6, r, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // فواصل الألواح
  ctx.globalAlpha = 0.75;
  for (let p = 1; p < planks; p++) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    if (horizontal) ctx.fillRect(0, (h / planks) * p, w, 3);
    else ctx.fillRect((w / planks) * p, 0, 3, h);
    ctx.fillStyle = 'rgba(255,190,150,0.05)';
    if (horizontal) ctx.fillRect(0, (h / planks) * p + 3, w, 1.5);
    else ctx.fillRect((w / planks) * p + 3, 0, 1.5, h);
  }
  ctx.globalAlpha = 1;
  paintNoise(ctx, w, h, { scale: 2.4, seed, alpha: 0.055 });
  return c;
}

/* ============================================================
   الحجر / الأرضية
   ============================================================ */
export function stoneTexture({ w = 512, h = 512, base = '#191318', tile = 128 } = {}) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // بلاطات حجرية
  for (let y = 0; y < h; y += tile) {
    const off = (y / tile) % 2 === 0 ? 0 : tile / 2;
    for (let x = -tile; x < w + tile; x += tile) {
      const px = x + off, py = y;
      const v = 0.04 + rnd() * 0.05;
      ctx.fillStyle = `rgba(255,220,220,${v * 0.22})`;
      ctx.fillRect(px + 2, py + 2, tile - 4, tile - 4);
      ctx.strokeStyle = 'rgba(0,0,0,0.62)';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(px + 1, py + 1, tile - 2, tile - 2);
      // شقوق
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      let cx = px + 10 + rnd() * (tile - 20), cy = py + 10 + rnd() * (tile - 20);
      ctx.moveTo(cx, cy);
      for (let i = 0; i < 4; i++) {
        cx += (rnd() - 0.5) * 38; cy += (rnd() - 0.5) * 38;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }
  }
  paintNoise(ctx, w, h, { scale: 3, seed: 9, alpha: 0.075 });
  return c;
}

/* ============================================================
   قرميد السطح
   ============================================================ */
export function roofTexture({ w = 512, h = 512 } = {}) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#3b3746');
  g.addColorStop(0.55, '#2b2836');
  g.addColorStop(1, '#201d29');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const cols = 14;
  for (let i = 0; i < cols; i++) {
    const x = (i / cols) * w;
    const grd = ctx.createLinearGradient(x, 0, x + w / cols, 0);
    grd.addColorStop(0, 'rgba(0,0,0,0.45)');
    grd.addColorStop(0.38, 'rgba(150,150,175,0.22)');
    grd.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = grd;
    ctx.fillRect(x, 0, w / cols, h);
    // خطوط الألواح الأفقية (بارزة)
    for (let y = 0; y < h; y += h / 6) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(x, y, w / cols, 3);
      ctx.fillStyle = 'rgba(220,210,235,0.16)';
      ctx.fillRect(x, y + 3, w / cols, 1.5);
    }
  }
  paintNoise(ctx, w, h, { scale: 2.6, seed: 11, alpha: 0.07 });
  return c;
}

/* ============================================================
   لوحة اللافتة الكبيرة SECRET SHOP (بخلفية شفافة)
   ============================================================ */
export function signTexture({ w = 1400, h = 1000 } = {}) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  // شكل الدرع (مثمّن بزوايا مشطوفة)
  const P = (x, y) => [cx + x * w, h / 2 + y * h];
  const pts = [
    P(-0.44, -0.40), P(-0.28, -0.475), P(0.28, -0.475), P(0.44, -0.40),
    P(0.475, -0.10), P(0.40, 0.30), P(0.20, 0.455), P(0.0, 0.49),
    P(-0.20, 0.455), P(-0.40, 0.30), P(-0.475, -0.10),
  ];
  const path = (arr) => {
    ctx.beginPath();
    arr.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
  };

  // إطار ذهبي خارجي
  ctx.save();
  path(pts);
  ctx.fillStyle = '#c9992f';
  ctx.shadowColor = 'rgba(255,170,60,0.85)';
  ctx.shadowBlur = 60;
  ctx.fill();
  ctx.restore();

  // تدرّج ذهبي على الإطار
  ctx.save();
  path(pts);
  const gold = ctx.createLinearGradient(0, 0, 0, h);
  gold.addColorStop(0, '#e8b95c');
  gold.addColorStop(0.22, '#b98a2c');
  gold.addColorStop(0.5, '#6f4a12');
  gold.addColorStop(0.72, '#d9ae4c');
  gold.addColorStop(1, '#5d3c0e');
  ctx.fillStyle = gold;
  ctx.fill();
  ctx.restore();

  // الجسم الأسود الداخلي
  const inner = pts.map(([x, y]) => [cx + (x - cx) * 0.918, h / 2 + (y - h / 2) * 0.905]);
  ctx.save();
  path(inner);
  const black = ctx.createLinearGradient(0, 0, w * 0.2, h);
  black.addColorStop(0, '#150a10');
  black.addColorStop(0.5, '#0b0509');
  black.addColorStop(1, '#160a12');
  ctx.fillStyle = black;
  ctx.fill();
  ctx.restore();

  // خط ذهبي داخلي
  ctx.save();
  path(inner.map(([x, y]) => [cx + (x - cx) * 0.955, h / 2 + (y - h / 2) * 0.95]));
  ctx.strokeStyle = 'rgba(255,205,120,0.55)';
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.restore();

  // لمعان أحمر خفيف أعلى اللوحة
  ctx.save();
  const gg = ctx.createRadialGradient(cx, h * 0.2, 10, cx, h * 0.25, w * 0.62);
  gg.addColorStop(0, 'rgba(255,40,70,0.20)');
  gg.addColorStop(1, 'rgba(255,40,70,0)');
  ctx.fillStyle = gg;
  path(inner);
  ctx.fill();
  ctx.restore();

  /* ---------- تاج ذهبي فوق النص ---------- */
  const crownY = h * 0.152, crownW = w * 0.2, crownH = h * 0.105;
  const crownPath = () => {
    ctx.beginPath();
    ctx.moveTo(cx - crownW / 2, crownY + crownH);
    ctx.lineTo(cx - crownW / 2 + crownW * 0.06, crownY + crownH * 0.1);
    ctx.lineTo(cx - crownW * 0.22, crownY + crownH * 0.62);
    ctx.lineTo(cx, crownY);
    ctx.lineTo(cx + crownW * 0.22, crownY + crownH * 0.62);
    ctx.lineTo(cx + crownW / 2 - crownW * 0.06, crownY + crownH * 0.1);
    ctx.lineTo(cx + crownW / 2, crownY + crownH);
    ctx.closePath();
  };
  ctx.save();
  ctx.shadowColor = 'rgba(255,190,90,0.95)';
  ctx.shadowBlur = 45;
  crownPath();
  const cg = ctx.createLinearGradient(cx, crownY, cx, crownY + crownH);
  cg.addColorStop(0, '#fff0c0');
  cg.addColorStop(0.45, '#f0c261');
  cg.addColorStop(1, '#a06f1d');
  ctx.fillStyle = cg;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(255,235,180,0.9)';
  ctx.stroke();
  ctx.restore();
  // جواهر التاج
  for (const [dx, r] of [[-0.34, 7], [0, 9], [0.34, 7]]) {
    ctx.beginPath();
    ctx.fillStyle = '#ff3b57';
    ctx.shadowColor = '#ff2a4d';
    ctx.shadowBlur = 24;
    ctx.arc(cx + dx * crownW, crownY + crownH * 0.62, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  /* ---------- النصوص ---------- */
  const fit = (text, maxW, font, weight = '', family = FONT_DISPLAY) => {
    let size = 320;
    do {
      ctx.font = `${weight} ${size}px ${family}`.trim();
      if (ctx.measureText(text).width <= maxW) break;
      size -= 6;
    } while (size > 40);
    return size;
  };

  // SECRET
  const secretSize = fit('SECRET', w * 0.70, 'bold', 'bold');
  ctx.save();
  // نقصّ الرسم على شكل الدرع الداخلي
  path(inner);
  ctx.clip();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${secretSize}px ${FONT_DISPLAY}`;
  ctx.translate(cx, h * 0.425);
  ctx.transform(1, 0, -0.10, 1, 0, 0); // ميل خفيف زي اللوجو
  ctx.lineJoin = 'round';

  // هالة نيون (بحدود سميكة شفافة بدل الظل — أسرع وبدون تسريب)
  ctx.strokeStyle = 'rgba(255,25,60,0.10)';
  for (const [lw, ga] of [[30, 0.12], [20, 0.16], [12, 0.22], [6, 0.3]]) {
    ctx.lineWidth = lw;
    ctx.globalAlpha = ga;
    ctx.strokeText('SECRET', 0, 0);
  }
  ctx.globalAlpha = 1;
  const tx = ctx.createLinearGradient(0, -secretSize * 0.42, 0, secretSize * 0.42);
  tx.addColorStop(0, '#fff2f2');
  tx.addColorStop(0.45, '#ff5d70');
  tx.addColorStop(0.75, '#e3002b');
  tx.addColorStop(1, '#ff9aa8');
  ctx.fillStyle = tx;
  ctx.fillText('SECRET', 0, 0);
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = 'rgba(255,190,190,0.5)';
  ctx.strokeText('SECRET', 0, 0);
  ctx.restore();

  // SHOP
  const shopSize = fit('SHOP', w * 0.54, 'bold', 'bold');
  ctx.save();
  path(inner);
  ctx.clip();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${shopSize}px ${FONT_DISPLAY}`;
  ctx.translate(cx, h * 0.635);
  ctx.transform(1, 0, -0.10, 1, 0, 0);
  ctx.strokeStyle = 'rgba(255,180,80,0.12)';
  for (const [lw, ga] of [[26, 0.14], [16, 0.18], [8, 0.28]]) {
    ctx.lineWidth = lw;
    ctx.globalAlpha = ga;
    ctx.strokeText('SHOP', 0, 0);
  }
  ctx.globalAlpha = 1;
  const sg = ctx.createLinearGradient(0, -shopSize * 0.4, 0, shopSize * 0.4);
  sg.addColorStop(0, '#fff8e0');
  sg.addColorStop(0.5, '#ffd98d');
  sg.addColorStop(1, '#e09a34');
  ctx.fillStyle = sg;
  ctx.fillText('SHOP', 0, 0);
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = 'rgba(120,70,10,0.75)';
  ctx.strokeText('SHOP', 0, 0);
  ctx.restore();

  // معيّنات ذهبية أسفل اللوحة
  ctx.save();
  ctx.shadowColor = 'rgba(255,190,90,0.9)';
  ctx.shadowBlur = 24;
  ctx.fillStyle = '#e8bd63';
  for (const dx of [-0.30, 0, 0.30]) {
    const px = cx + dx * w, py = h * 0.775;
    ctx.beginPath();
    ctx.moveTo(px, py - 16);
    ctx.lineTo(px + 12, py);
    ctx.lineTo(px, py + 16);
    ctx.lineTo(px - 12, py);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  return c;
}

/* ============================================================
   راية / بنر قرمزي
   ============================================================ */
export function bannerTexture({ w = 320, h = 900, color = '#8e0e1e', edge = '#e2b04b' } = {}) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  // شكل الراية (مستطيل بطرف سفلي مدبب)
  const m = 10;
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(m, 0);
    ctx.lineTo(w - m, 0);
    ctx.lineTo(w - m, h * 0.86);
    ctx.lineTo(w / 2, h - m);
    ctx.lineTo(m, h * 0.86);
    ctx.closePath();
  };
  // قماش
  path();
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, '#56060f');
  g.addColorStop(0.22, color);
  g.addColorStop(0.5, '#c4162c');
  g.addColorStop(0.78, color);
  g.addColorStop(1, '#4d050d');
  ctx.fillStyle = g;
  ctx.fill();

  // طيّات القماش
  ctx.save();
  path();
  ctx.clip();
  for (let i = 0; i < 26; i++) {
    const x = (i / 26) * w + Math.sin(i) * 4;
    ctx.globalAlpha = 0.07 + rnd() * 0.1;
    ctx.fillStyle = i % 2 ? '#ff7080' : '#340208';
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.quadraticCurveTo(x + 14, h * 0.5, x + 4, h);
    ctx.lineTo(x + 22, h);
    ctx.quadraticCurveTo(x + 32, h * 0.5, x + 20, 0);
    ctx.closePath();
    ctx.fill();
  }
  // ظل سفلي
  ctx.globalAlpha = 1;
  const sh = ctx.createLinearGradient(0, h * 0.6, 0, h);
  sh.addColorStop(0, 'rgba(0,0,0,0)');
  sh.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = sh;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // إطار ذهبي
  ctx.save();
  path();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 7;
  ctx.shadowColor = 'rgba(255,190,90,0.7)';
  ctx.shadowBlur = 20;
  ctx.stroke();
  ctx.restore();

  // تاج
  const cy = h * 0.34, cw = w * 0.52, ch = h * 0.13;
  ctx.save();
  ctx.translate(w / 2 - cw / 2, cy - ch / 2);
  ctx.beginPath();
  ctx.moveTo(0, ch);
  ctx.lineTo(cw * 0.06, ch * 0.1);
  ctx.lineTo(cw * 0.24, ch * 0.66);
  ctx.lineTo(cw * 0.5, 0);
  ctx.lineTo(cw * 0.76, ch * 0.66);
  ctx.lineTo(cw * 0.94, ch * 0.1);
  ctx.lineTo(cw, ch);
  ctx.closePath();
  const cg = ctx.createLinearGradient(0, 0, 0, ch);
  cg.addColorStop(0, '#fff0bd');
  cg.addColorStop(0.5, '#f0c161');
  cg.addColorStop(1, '#a5711e');
  ctx.fillStyle = cg;
  ctx.shadowColor = 'rgba(255,180,80,0.85)';
  ctx.shadowBlur = 26;
  ctx.fill();
  ctx.restore();

  // خط ذهبي رقيق أسفل التاج
  ctx.save();
  ctx.strokeStyle = 'rgba(240,195,105,0.55)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w * 0.24, h * 0.58);
  ctx.lineTo(w * 0.76, h * 0.58);
  ctx.stroke();
  ctx.restore();

  paintNoise(ctx, w, h, { scale: 4, seed: 21, alpha: 0.05 });
  return c;
}

/* ============================================================
   لوحة خشبية مكتوب عليها (Rare Items / Exclusive / Limited)
   ============================================================ */
export function boardTexture({ w = 512, h = 512, lines = ['Rare Items', 'Exclusive', 'Limited'], gold = '#e8bd63' } = {}) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2a1712';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 140; i++) {
    ctx.strokeStyle = i % 3 === 0 ? '#4d2c1f' : '#150a08';
    ctx.globalAlpha = 0.08 + rnd() * 0.2;
    ctx.lineWidth = 1 + rnd() * 2;
    const y = rnd() * h;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(w * 0.3, y + 6, w * 0.7, y - 6, w, y + 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // إطار
  ctx.strokeStyle = 'rgba(230,190,110,0.45)';
  ctx.lineWidth = 6;
  ctx.strokeRect(16, 16, w - 32, h - 32);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 3;
  ctx.strokeRect(26, 26, w - 52, h - 52);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = gold;
  ctx.shadowColor = 'rgba(255,190,90,0.55)';
  ctx.shadowBlur = 18;
  const lineH = h / (lines.length + 1.1);
  lines.forEach((line, i) => {
    let size = 96;
    do {
      ctx.font = `bold ${size}px ${FONT_SERIF}`;
      if (ctx.measureText(line).width < w * 0.78) break;
      size -= 4;
    } while (size > 20);
    ctx.fillText(line, w / 2, lineH * (i + 0.85) + 14);
  });
  return c;
}

/* ============================================================
   نافذة مضيئة (شبكة خشبية + ضوء دافئ)
   ============================================================ */
export function windowTexture({ w = 256, h = 256, cols = 3, rows = 4 } = {}) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(w / 2, h * 0.75, 6, w / 2, h / 2, w * 0.8);
  g.addColorStop(0, '#ffc078');
  g.addColorStop(0.35, '#e87a35');
  g.addColorStop(0.7, '#7a2416');
  g.addColorStop(1, '#180706');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // براويز الشبكة
  ctx.fillStyle = '#1b0f0c';
  for (let i = 1; i < cols; i++) ctx.fillRect((w / cols) * i - 3, 0, 6, h);
  for (let j = 1; j < rows; j++) ctx.fillRect(0, (h / rows) * j - 3, w, 6);
  ctx.strokeStyle = '#120a08';
  ctx.lineWidth = 18;
  ctx.strokeRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,190,120,0.28)';
  ctx.lineWidth = 3;
  ctx.strokeRect(12, 12, w - 24, h - 24);
  return c;
}

/* ============================================================
   سجادة داخلية
   ============================================================ */
export function rugTexture({ w = 512, h = 640 } = {}) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#3d0a12';
  ctx.fillRect(0, 0, w, h);
  // إطار
  ctx.strokeStyle = '#cfa257';
  ctx.lineWidth = 12;
  ctx.strokeRect(20, 20, w - 40, h - 40);
  ctx.strokeStyle = '#7d1520';
  ctx.lineWidth = 26;
  ctx.strokeRect(48, 48, w - 96, h - 96);
  ctx.strokeStyle = 'rgba(240,200,120,0.7)';
  ctx.lineWidth = 4;
  ctx.strokeRect(70, 70, w - 140, h - 140);
  // شمس في المنتصف
  const cx = w / 2, cy = h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  for (let i = 0; i < 24; i++) {
    ctx.rotate((Math.PI * 2) / 24);
    ctx.fillStyle = i % 2 ? 'rgba(240,200,120,0.5)' : 'rgba(160,30,40,0.55)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w * 0.055, -w * 0.02);
    ctx.lineTo(w * 0.16, 0);
    ctx.lineTo(w * 0.055, w * 0.02);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 0, w * 0.11, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,220,150,0.6)';
  ctx.fill();
  ctx.restore();
  paintNoise(ctx, w, h, { scale: 3.4, seed: 33, alpha: 0.06 });
  return c;
}

/* ============================================================
   نقوش التاج الذهبي (شفافة) — تُستخدم كـ decal
   ============================================================ */
export function crownTexture({ size = 256 } = {}) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const s = size;
  ctx.beginPath();
  ctx.moveTo(s * 0.18, s * 0.72);
  ctx.lineTo(s * 0.24, s * 0.28);
  ctx.lineTo(s * 0.40, s * 0.52);
  ctx.lineTo(s * 0.5, s * 0.18);
  ctx.lineTo(s * 0.60, s * 0.52);
  ctx.lineTo(s * 0.76, s * 0.28);
  ctx.lineTo(s * 0.82, s * 0.72);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, s * 0.2, 0, s * 0.75);
  g.addColorStop(0, '#fff2c6');
  g.addColorStop(0.5, '#f0c161');
  g.addColorStop(1, '#9a6a1c');
  ctx.fillStyle = g;
  ctx.shadowColor = 'rgba(255,190,90,0.9)';
  ctx.shadowBlur = 26;
  ctx.fill();
  return c;
}

/* ============================================================
   سبrites
   ============================================================ */
export function glowTexture({ size = 128, inner = 'rgba(255,255,255,1)', mid = 'rgba(255,180,120,0.6)' } = {}) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.18, mid);
  g.addColorStop(0.55, 'rgba(255,80,90,0.12)');
  g.addColorStop(1, 'rgba(255,40,60,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

export function sparkTexture({ size = 128 } = {}) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.34);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,200,170,0.75)');
  g.addColorStop(1, 'rgba(255,80,100,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  // أشعة نجمية
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 4);
    const lg = ctx.createLinearGradient(-size / 2, 0, size / 2, 0);
    lg.addColorStop(0, 'rgba(255,255,255,0)');
    lg.addColorStop(0.5, 'rgba(255,235,225,0.35)');
    lg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(-size / 2, -1.6, size, 3.2);
  }
  ctx.restore();
  return c;
}

export function crownTextureSmall() { return crownTexture({ size: 128 }); }

/** تدرّج دائري ناعم — للضباب والهالات */
export function mistTexture({ size = 256, inner = 'rgba(255,255,255,0)', mid = 'rgba(255,255,255,0.55)' } = {}) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.08, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.55, mid);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}
