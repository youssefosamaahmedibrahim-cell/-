import * as THREE from 'three';
import { getMaterials } from '../lib/materials.js';
import {
  box, cyl, shade, createRoof, createBanner, createLantern, createCrown,
  createPillar, createRailing, instanced, tubeFromPoints, sprite, rand,
  createChest, createPlant, createCrystalCluster,
} from '../lib/shapes.js';
import { createInterior } from './interior.js';

/* أبعاد المبنى */
import { DIM } from './dims.js';
export { DIM };

const flickers = [];
const animated = [];

function neon(w, h, d, x, y, z, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

/* ============================================================
   القاعدة والحجر
   ============================================================ */
function buildBase(g) {
  const M = getMaterials();
  const { plinthW, plinthD, plinthH } = DIM;

  // بلاطة رئيسية
  const plinth = box(plinthW, plinthH, plinthD, M.stoneDark, 0, plinthH / 2, 0);
  g.add(plinth);

  // حافة مضيئة حول القاعدة
  const edge = neon(plinthW + 0.2, 0.06, 0.08, 0, plinthH - 0.06, plinthD / 2 + 0.03, M.neonRed);
  g.add(edge);
  const edgeL = neon(0.08, 0.06, plinthD, -plinthW / 2 - 0.03, plinthH - 0.06, 0, M.neonRed);
  const edgeR = edgeL.clone(); edgeR.position.x *= -1;
  g.add(edgeL, edgeR);

  // سلالم أمامية
  const stepCount = 5, rise = plinthH / stepCount, run = 0.8, stepW = 10;
  const stepGeo = new THREE.BoxGeometry(stepW, rise, run);
  const glowGeo = new THREE.BoxGeometry(stepW * 0.98, 0.045, 0.06);
  for (let i = 0; i < stepCount; i++) {
    const y = plinthH - rise * (i + 1);
    const z = plinthD / 2 + run * (stepCount - i) - run / 2;
    const s = new THREE.Mesh(stepGeo, i % 2 ? M.stone : M.stoneDark);
    s.position.set(0, y + rise / 2, z);
    s.castShadow = true; s.receiveShadow = true;
    g.add(s);
    const gl = new THREE.Mesh(glowGeo, M.neonRed);
    gl.position.set(0, y + rise - 0.03, z + run / 2 + 0.01);
    g.add(gl);
  }
  // جوانب السلالم
  for (const sx of [-1, 1]) {
    const side = box(0.35, plinthH + 0.15, run * stepCount, M.stone, sx * (stepW / 2 + 0.18), plinthH / 2, plinthD / 2 + run * stepCount / 2);
    g.add(side);
    const gEdge = neon(0.06, 0.05, run * stepCount, sx * (stepW / 2 + 0.37), plinthH + 0.06, plinthD / 2 + run * stepCount / 2, M.neonSoft);
    g.add(gEdge);
  }

  // سجادة حمراء مضيئة على الدرج
  const carpet = box(3.2, 0.04, run * stepCount + 1.2, M.woodTrim, 0, plinthH + 0.02, plinthD / 2 + run * stepCount / 2 - 0.2);
  carpet.material = new THREE.MeshStandardMaterial({ color: 0x6b0a16, roughness: 0.9, emissive: 0x3a0209, emissiveIntensity: 0.7 });
  carpet.rotation.x = -Math.atan2(plinthH, run * stepCount);
  g.add(carpet);

  // أرضية المتجر الخشبية
  const floor = box(DIM.gfW, 0.2, DIM.gfD, M.woodWall, 0, plinthH + 0.1, -0.2);
  floor.receiveShadow = true;
  g.add(floor);
}

/* ============================================================
   الطابق الأرضي
   ============================================================ */
function buildGroundFloor(g) {
  const M = getMaterials();
  const { gfW, gfD, gfTop, plinthH, doorW, doorH, frontZ } = DIM;
  const h = gfTop - plinthH;
  const zFront = frontZ;
  const halfW = gfW / 2;

  // ---------- الجدران الخلفية والجانبية ----------
  const back = box(gfW, h, 0.7, M.woodWall, 0, plinthH + h / 2, -gfD / 2 + 0.35);
  g.add(back);
  for (const sx of [-1, 1]) {
    const side = box(0.7, h, gfD, M.woodWall, sx * (halfW - 0.35), plinthH + h / 2, -0.2);
    g.add(side);
    // نوافذ جانبية مضيئة
    const win = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.8), M.window);
    win.position.set(sx * (halfW + 0.01), plinthH + 4.2, 1.6);
    win.rotation.y = sx * Math.PI / 2;
    g.add(win);
  }

  // ---------- الواجهة الأمامية (باب في النص) ----------
  const sidePanelW = (gfW - doorW) / 2;
  for (const sx of [-1, 1]) {
    const panel = box(sidePanelW, h, 0.7, M.woodWall, sx * (doorW / 2 + sidePanelW / 2), plinthH + h / 2, zFront - 0.35);
    g.add(panel);

    // نافذة مضيئة على الواجهة
    const win = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.1), M.window);
    win.position.set(sx * 6.3, plinthH + 3.9, zFront + 0.02);
    g.add(win);
    // إطار النافذة الذهبي
    for (const [w, hh, dx, dy] of [[3.0, 0.14, 0, 1.62], [3.0, 0.14, 0, -1.62], [0.14, 3.3, -1.48, 0], [0.14, 3.3, 1.48, 0]]) {
      g.add(box(w, hh, 0.16, M.goldDark, sx * 6.3 + dx, plinthH + 3.9 + dy, zFront + 0.06));
    }
    // قضبان نيون أسفل النافذة
    g.add(neon(2.9, 0.05, 0.06, sx * 6.3, plinthH + 2.28, zFront + 0.08, M.neonSoft));
  }

  // عتب علوي فوق الباب
  const lintel = box(gfW, h - doorH, 0.9, M.woodWall, 0, plinthH + doorH + (h - doorH) / 2, zFront - 0.35);
  g.add(lintel);

  // ---------- إطار الباب ----------
  const jamb = 0.4;
  for (const sx of [-1, 1]) {
    g.add(box(jamb, doorH, 1.0, M.woodTrim, sx * (doorW / 2 + jamb / 2), plinthH + doorH / 2, zFront - 0.1));
    g.add(neon(0.07, doorH * 0.92, 0.07, sx * (doorW / 2 + 0.03), plinthH + doorH / 2, zFront + 0.42, M.neonRed));
  }
  const head = box(doorW + jamb * 2, 0.5, 1.1, M.woodTrim, 0, plinthH + doorH + 0.25, zFront - 0.1);
  g.add(head);
  g.add(neon(doorW + 0.2, 0.06, 0.08, 0, plinthH + doorH + 0.02, zFront + 0.46, M.neonRed));

  // ---------- أعمدة الواجهة ----------
  for (const sx of [-1, 1]) {
    for (const x of [3.9, 8.2]) {
      const p = createPillar({ h: h + 0.3, r: 0.3, rings: 2 });
      p.position.set(sx * x, plinthH, zFront + 0.55);
      g.add(p);
    }
  }

  // ---------- قوائم أفقية + نيون ----------
  for (const [y, thick] of [[plinthH + 0.18, 0.36], [gfTop - 0.25, 0.5], [plinthH + 5.9, 0.28]]) {
    g.add(box(gfW + 0.8, thick, 0.55, M.woodBeam, 0, y, zFront + 0.42));
    g.add(neon(gfW + 0.6, 0.05, 0.07, 0, y + thick / 2 + 0.02, zFront + 0.72, M.neonSoft));
  }
  // شرائط نيون رأسية على أطراف الأعمدة
  for (const sx of [-1, 1]) {
    g.add(neon(0.06, 4.6, 0.06, sx * 8.85, plinthH + 3, zFront + 0.86, M.neonRed));
  }

  // ---------- كتائف تحت السقف ----------
  const brackets = [];
  for (let i = 0; i < 11; i++) brackets.push({ x: (i / 10 - 0.5) * (gfW + 1), y: 0, z: 0 });
  const brGeo = new THREE.BoxGeometry(0.5, 0.24, 0.9);
  g.add(instanced(brGeo, M.woodTrim, brackets.map((b) => ({ ...b, y: gfTop - 0.62, z: zFront + 0.6 }))));
  g.add(instanced(brGeo, M.goldDark, brackets.map((b) => ({ ...b, y: gfTop - 0.84, z: zFront + 0.7, sy: 0.55 }))));

  // ---------- فانوسان كبيران بجانب الباب ----------
  for (const sx of [-1, 1]) {
    const lan = createLantern({ scale: 1.05, light: false });
    lan.position.set(sx * (doorW / 2 + 1.35), plinthH + 5.9, zFront + 1.0);
    g.add(lan);
    flickers.push(lan);
    // سلسلة التعليق
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.0, 5), M.iron);
    chain.position.set(sx * (doorW / 2 + 1.35), plinthH + 6.9, zFront + 1.0);
    g.add(chain);
  }

  // ---------- مصابيح أرضية على القاعدة ----------
  for (const sx of [-1, 1]) {
    const base = cyl(0.16, 0.22, 1.4, M.iron, 8);
    base.position.set(sx * 8.5, plinthH + 0.7, zFront + 2.7);
    g.add(base);
    const lan = createLantern({ scale: 0.62 });
    lan.position.set(sx * 8.5, plinthH + 1.75, zFront + 2.7);
    g.add(lan);
    flickers.push(lan);
  }
}

/* ============================================================
   الشرفة + الطابق العلوي
   ============================================================ */
function buildUpperFloor(g) {
  const M = getMaterials();
  const { ufW, gfTop, ufD, ufTop, frontZ } = DIM;
  const h = ufTop - gfTop;

  // ---------- بلاطة الشرفة ----------
  const slab = box(ufW + 2.4, 0.4, ufD + 0.6, M.woodBeam, 0, gfTop + 0.2, 0.2);
  g.add(slab);
  // إفريز مضيء أسفل البلاطة
  g.add(neon(ufW + 2.2, 0.05, 0.06, 0, gfTop - 0.02, frontZ + 1.1, M.neonSoft));

  // ---------- درابزين الشرفة ----------
  const railFront = createRailing({ length: ufW + 2.2, height: 1.0, posts: 12, axis: 'x' });
  railFront.position.set(0, gfTop + 0.4, frontZ + 1.15);
  g.add(railFront);
  for (const sx of [-1, 1]) {
    const railSide = createRailing({ length: ufD - 1.4, height: 1.0, posts: 6, axis: 'z' });
    railSide.position.set(sx * (ufW / 2 + 1.1), gfTop + 0.4, frontZ - 3.2);
    g.add(railSide);
  }

  // ---------- جدران الطابق العلوي ----------
  const wallZ = frontZ - 1.2;
  for (const sx of [-1, 1]) {
    const w = (ufW - 6.6) / 2;
    g.add(box(w, h, 0.6, M.woodWall, sx * (3.3 + w / 2), gfTop + h / 2, wallZ));
    // نافذة مضيئة
    const win = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.2), M.window);
    win.position.set(sx * 5.9, gfTop + 2.3, wallZ + 0.32);
    g.add(win);
    for (const [ww, hh, dx, dy] of [[2.34, 0.12, 0, 1.2], [2.34, 0.12, 0, -1.2], [0.12, 2.5, -1.12, 0], [0.12, 2.5, 1.12, 0]]) {
      g.add(box(ww, hh, 0.16, M.goldDark, sx * 5.9 + dx, gfTop + 2.3 + dy, wallZ + 0.34));
    }
  }
  // خلفية الطابق العلوي (خلف اللافتة)
  g.add(box(ufW, h, 0.6, M.woodWall, 0, gfTop + h / 2, wallZ - 0.05));
  // هيكل مركزي مضاء خلف اللافتة
  const backLight = box(5.4, 2.4, 0.06, M.amberDim, 0, gfTop + 2.2, wallZ + 0.33);
  g.add(backLight);

  // أعمدة الطابق العلوي
  for (const sx of [-1, 1]) {
    for (const x of [7.6, 3.1]) {
      const p = createPillar({ h: h + 0.5, r: 0.26, rings: 1 });
      p.position.set(sx * x, gfTop + 0.4, frontZ + 0.55);
      g.add(p);
    }
  }

  // كتائف علوية
  const brGeo = new THREE.BoxGeometry(0.46, 0.22, 0.8);
  const arr = [];
  for (let i = 0; i < 10; i++) arr.push({ x: (i / 9 - 0.5) * (ufW + 1.4), y: ufTop - 0.5, z: frontZ + 0.7 });
  g.add(instanced(brGeo, M.woodTrim, arr));

  // ---------- رايات الطابق العلوي ----------
  for (const sx of [-1, 1]) {
    const b = createBanner({ w: 1.25, h: 3.4, phase: sx * 0.7 });
    b.position.set(sx * 7.1, ufTop - 0.6, frontZ + 1.0);
    g.add(b);
    animated.push(b);
  }
}

/* ============================================================
   اللافتة الكبيرة
   ============================================================ */
function buildSign(g) {
  const M = getMaterials();
  const signW = 9.4, signH = 6.5;
  const signY = 11.35, signZ = DIM.frontZ + 1.35;

  const group = new THREE.Group();
  group.position.set(0, signY, signZ);
  group.rotation.x = -0.05;

  const panel = new THREE.Mesh(new THREE.PlaneGeometry(signW, signH), M.sign);
  group.add(panel);

  // إطار ذهبي خلفي بسيط
  const bezel = new THREE.Mesh(
    new THREE.BoxGeometry(signW * 0.96, signH * 0.94, 0.16),
    new THREE.MeshStandardMaterial({ color: 0xd9a83f, roughness: 0.35, metalness: 1, envMapIntensity: 1.4 }),
  );
  bezel.position.z = -0.12;
  bezel.scale.set(1.035, 1.03, 1);
  group.add(bezel);

  const backPanel = new THREE.Mesh(new THREE.BoxGeometry(signW * 0.92, signH * 0.92, 0.35), M.signBack);
  backPanel.position.z = -0.24;
  group.add(backPanel);

  // ظل ونور خلفي
  const glow = sprite(M.glowSprite, 9, 0, 0.4, -0.9);
  glow.material.color.setHex(0xff2a4d);
  glow.material.opacity = 0.13;
  group.add(glow);

  // سلاسل تعليق تصل اللافتة بالسقف
  for (const sx of [-1, 1]) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 1.7, 6), M.goldDark);
    c.position.set(sx * signW * 0.33, signH * 0.5, -0.2);
    c.rotation.z = sx * 0.26;
    group.add(c);
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.028, 6, 10), M.gold);
    hook.position.set(sx * signW * 0.33, signH * 0.52 + 0.98, -0.14);
    group.add(hook);
  }

  // مظلة صغيرة فوق اللافتة (تثبيت بصري)
  const canopy = createRoof({
    width: signW + 1.6, depth: 3.0, height: 1.0, thickness: 0.18,
    sag: 1.5, lift: 0.34, corner: 0.5, segments: 28, hips: false, rafters: 0, hipGlow: false,
  });
  canopy.position.set(0, signY + signH * 0.5 + 0.25, signZ - 0.3);
  g.add(canopy);

  g.add(group);
  animated.push(group);

  return group;
}

/* ============================================================
   السقوف
   ============================================================ */
function buildRoofs(g) {
  const M = getMaterials();
  const { gfTop, ufTop, ufW } = DIM;

  // سقف الطابق الأرضي (ممشى محيطي)
  const lower = createRoof({
    width: 25.0, depth: 16.6, height: 2.1, thickness: 0.3,
    sag: 1.9, lift: 0.85, corner: 1.85, segments: 52, rafters: 26,
  });
  lower.position.y = gfTop + 0.05;
  g.add(lower);

  // السقف الرئيسي
  const main = createRoof({
    width: 24, depth: 18, height: 5.6, thickness: 0.36,
    sag: 1.9, lift: 1.2, corner: 2.6, segments: 64, finials: true, rafters: 30,
  });
  main.position.y = ufTop;
  g.add(main);

  // حواف ذهبية أسفل نهاية السقف
  for (const sx of [-1, 1]) {
    g.add(box(0.5, 0.4, 0.5, M.goldDark, sx * (ufW / 2 + 1.2), ufTop + 0.1, DIM.frontZ + 0.6));
  }

  return { lower, main };
}

/* ============================================================
   الشعار على قمة السقف (نصل أسود بحواف ذهبية وعيون متوهجة)
   ============================================================ */
let gem = null;
function buildCrest(g) {
  const M = getMaterials();
  const crest = new THREE.Group();

  const obsidian = new THREE.MeshStandardMaterial({
    color: 0x1c0f1a, roughness: 0.26, metalness: 0.85, envMapIntensity: 1.8,
    emissive: 0x2a0509, emissiveIntensity: 0.5,
  });
  const goldHot = new THREE.MeshStandardMaterial({
    color: 0xffdc95, emissive: 0xff7a1a, emissiveIntensity: 1.1, roughness: 0.2, metalness: 1,
    envMapIntensity: 1.6,
  });

  /* ---------- نصل بشكل قطرة مدببة ---------- */
  const bladeShape = (w, h) => {
    const sh = new THREE.Shape();
    sh.moveTo(0, h);
    sh.bezierCurveTo(w * 0.62, h * 0.42, w * 0.5, h * 0.1, w * 0.2, -h * 0.12);
    sh.quadraticCurveTo(w * 0.07, -h * 0.2, 0, -h * 0.26);
    sh.quadraticCurveTo(-w * 0.07, -h * 0.2, -w * 0.2, -h * 0.12);
    sh.bezierCurveTo(-w * 0.5, h * 0.1, -w * 0.62, h * 0.42, 0, h);
    return sh;
  };

  const specs = [
    { w: 0.82, h: 3.05, x: 0.0, y: 0.0, rz: 0.0, z: 0.26 },
    { w: 0.66, h: 2.25, x: -0.8, y: -0.1, rz: 0.4, z: 0.24 },
    { w: 0.66, h: 2.25, x: 0.8, y: -0.1, rz: -0.4, z: 0.24 },
    { w: 0.5, h: 1.5, x: -1.48, y: -0.24, rz: 0.62, z: -0.06 },
    { w: 0.5, h: 1.5, x: 1.48, y: -0.24, rz: -0.62, z: -0.06 },
  ];

  for (const b of specs) {
    const geo = new THREE.ExtrudeGeometry(bladeShape(b.w, b.h), {
      depth: 0.16, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.04, bevelSegments: 2,
    });
    const mesh = new THREE.Mesh(geo, obsidian);
    mesh.position.set(b.x, b.y, b.z);
    mesh.rotation.z = b.rz;
    crest.add(mesh);

    // ظل ذهبي خلف النصل → يظهر كحافة ذهبية رفيعة حول الحدود
    const trimGeo = new THREE.ExtrudeGeometry(bladeShape(b.w * 1.34, b.h * 1.1), {
      depth: 0.05, bevelEnabled: false,
    });
    const trim = new THREE.Mesh(trimGeo, goldHot);
    trim.position.set(b.x, b.y, b.z - 0.13);
    trim.rotation.z = b.rz;
    crest.add(trim);
  }

  /* ---------- الجوهرة ---------- */
  gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), new THREE.MeshStandardMaterial({
    color: 0x5c0010, emissive: 0xff2030, emissiveIntensity: 4.5, roughness: 0.15, metalness: 0.4,
  }));
  gem.position.set(0, 0.05, 0.42);
  gem.scale.set(1, 1.5, 0.7);
  crest.add(gem);
  const gemGlow = sprite(M.glowSprite, 2.2, 0, 0.05, 0.55);
  gemGlow.material.opacity = 0.8;
  crest.add(gemGlow);

  /* ---------- عيون متوهجة ---------- */
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x2a0004, emissive: 0xff2030, emissiveIntensity: 6, roughness: 0.2 });
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), eyeMat);
    eye.position.set(sx * 0.3, 1.32, 0.32);
    eye.scale.set(1.9, 0.55, 0.5);
    crest.add(eye);
    const eg = sprite(M.glowSprite, 1.5, sx * 0.32, 1.32, 0.42);
    eg.material.opacity = 0.85;
    crest.add(eg);
  }

  /* ---------- قاعدة ذهبية ---------- */
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.78, 0.34, 10), M.goldDark);
  base.position.y = -0.75;
  crest.add(base);
  const baseRing = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.06, 6, 18), goldHot);
  baseRing.rotation.x = Math.PI / 2;
  baseRing.position.y = -0.6;
  crest.add(baseRing);

  /* ---------- هالة ---------- */
  const halo = sprite(M.glowSprite, 6.5, 0, 1.0, -0.6);
  halo.material.opacity = 0.16;
  crest.add(halo);

  for (const sx of [-1, 1]) {
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 1.1, 5), M.goldDark);
    chain.position.set(sx * 0.85, -0.85, -0.6);
    chain.rotation.x = -0.55;
    chain.rotation.z = sx * 0.12;
    crest.add(chain);
  }

  crest.position.set(0, 15.95, 7.45);
  crest.rotation.x = -0.18;
  crest.scale.setScalar(0.86);
  g.add(crest);
  animated.push(crest);
  crest.userData.baseY = 15.95;
  return crest;
}

/* ============================================================
   تفاصيل الواجهة: رايات، فوانيس، أعلام
   ============================================================ */
function buildFacadeDetails(g) {
  const M = getMaterials();

  // رايات كبيرة على جانبي السقف السفلي
  for (const sx of [-1, 1]) {
    const b = createBanner({ w: 1.7, h: 4.6, phase: sx * 1.2 });
    b.position.set(sx * 11.0, 8.25, 7.4);
    g.add(b);
    animated.push(b);

    const b2 = createBanner({ w: 1.25, h: 3.2, phase: sx * 2.1 });
    b2.position.set(sx * 13.2, 11.4, 6.4);
    b2.rotation.y = sx * -0.5;
    g.add(b2);
    animated.push(b2);

    // فوانيس معلقة تحت السقف
    const lan = createLantern({ scale: 1.0, light: sx > 0, lightIntensity: 22 });
    lan.position.set(sx * 5.6, 7.35, 8.5);
    g.add(lan);
    flickers.push(lan);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.55, 5), M.iron);
    chain.position.set(sx * 5.6, 7.86, 8.5);
    g.add(chain);

    const lan2 = createLantern({ scale: 0.85 });
    lan2.position.set(sx * 9.6, 7.2, 8.2);
    g.add(lan2);
    flickers.push(lan2);

    // فانوس على الشرفة
    const lan3 = createLantern({ scale: 0.8 });
    lan3.position.set(sx * 7.4, 11.95, 7.1);
    g.add(lan3);
    flickers.push(lan3);
  }

  // فانوسان على الواجهة العلوية
  for (const sx of [-1, 1]) {
    const lan = createLantern({ scale: 0.7 });
    lan.position.set(sx * 8.6, 12.2, 6.6);
    g.add(lan);
    flickers.push(lan);
  }

  // سلاسل فوانيس صغيرة على طول الواجهة
  for (const [y, z, scale, count] of [[7.55, 8.35, 0.46, 7], [11.55, 7.9, 0.4, 6]]) {
    const span = y > 9 ? 15 : 19;
    for (let i = 0; i < count; i++) {
      const x = (i / (count - 1) - 0.5) * span;
      const lan = createLantern({ scale, light: false });
      lan.position.set(x, y, z);
      g.add(lan);
      flickers.push(lan);
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.34, 4), M.iron);
      cord.position.set(x, y + 0.36, z);
      g.add(cord);
    }
  }

  // كرات ضوئية صغيرة تحت الإفريز
  for (let i = 0; i < 9; i++) {
    const x = (i / 8 - 0.5) * 20;
    const s = sprite(M.glowSprite, 1.1, x, 8.05, 8.0);
    s.material.opacity = 0.32;
    g.add(s);
  }

  // ------------------ الأعلام المعلقة على الأطراف ------------------
  const flagGeo = new THREE.PlaneGeometry(1.1, 2.6, 4, 8);
  for (const sx of [-1, 1]) {
    for (const [z, h] of [[-5, 3.4], [0.5, 3.0], [5, 3.6]]) {
      const f = new THREE.Mesh(flagGeo, M.cloth);
      f.position.set(sx * 12.6, 11.0 - h / 2, z);
      f.rotation.y = sx * Math.PI / 2;
      g.add(f);
    }
  }

  // ------------------ لوحات خشبية على الجانبين ------------------
  // الإطار الخشبي بيتبني من 4 قضبان رفيعة ورا اللوحة (بدل صندوق كبير)
  const boardFrame = (group, w, h, y, depthZ = -0.14) => {
    const th = 0.26;
    group.add(box(w + th * 2, th, 0.3, M.woodTrim, 0, y + h / 2 + th / 2, depthZ));
    group.add(box(w + th * 2, th, 0.3, M.woodTrim, 0, y - h / 2 - th / 2, depthZ));
    group.add(box(th, h, 0.3, M.woodTrim, -w / 2 - th / 2, y, depthZ));
    group.add(box(th, h, 0.3, M.woodTrim, w / 2 + th / 2, y, depthZ));
  };
  const boardL = new THREE.Group();
  const panelL = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), M.boardLeft);
  panelL.position.y = 2.9;
  boardL.add(panelL);
  boardFrame(boardL, 3.4, 3.4, 2.9);
  for (const sx of [-1, 1]) boardL.add(box(0.24, 4.9, 0.24, M.woodDark, sx * 1.75, 2.45, -0.2));
  boardL.position.set(-23.0, 0, 12.6);
  boardL.rotation.y = 0.55;
  g.add(boardL);

  const boardR = boardL.clone();
  boardR.rotation.y = -0.42;
  boardR.position.set(19.5, 0, 12.0);
  boardR.children[0].material = M.boardRight;
  g.add(boardR);

  // ------------------ صناديق ونباتات وكريستالات ----------------
  const chestA = createChest({ size: 1.25, open: true });
  chestA.position.set(-7.6, DIM.plinthH, 9.2);
  chestA.rotation.y = 0.45;
  g.add(chestA);

  const chestB = createChest({ size: 1.05, open: false });
  chestB.position.set(9.2, DIM.plinthH, 8.6);
  chestB.rotation.y = -0.5;
  g.add(chestB);

  return { boardL, boardR };
}

/* ============================================================
   البناء الكامل
   ============================================================ */
export function createShop() {
  const M = getMaterials();
  const g = new THREE.Group();
  g.name = 'shop';

  buildBase(g);
  buildGroundFloor(g);
  buildUpperFloor(g);
  const roofs = buildRoofs(g);
  buildSign(g);
  const crest = buildCrest(g);
  buildFacadeDetails(g);

  // ------------------ كريستالات ونباتات حوالين المدخل ------------------
  for (const sx of [-1, 1]) {
    const cr = createCrystalCluster({ count: 5, size: 0.9, material: sx > 0 ? M.crystalBlue : M.crystalRed, light: false });
    cr.position.set(sx * 6.4, DIM.plinthH, 8.6);
    g.add(cr);
    animated.push(cr);

    const pl = createPlant({ size: 1.0 });
    pl.position.set(sx * 10.4, DIM.plinthH, 7.9);
    g.add(pl);

    const pl2 = createPlant({ size: 0.8 });
    pl2.position.set(sx * 4.4, DIM.plinthH + 0.3, 11.4);
    g.add(pl2);
  }

  // ------------------ الداخل ------------------
  const interior = createInterior();
  g.add(interior.group);

  // ------------------ زخارف ذهبية فوق المدخل ------------------
  const orn = new THREE.Group();
  const goldHot = new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xff8a2a, emissiveIntensity: 0.55, roughness: 0.3, metalness: 1 });
  for (const sx of [-1, 1]) {
    // رأس تنين مبسّط: كتلة + قرون + عين
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), M.goldDark);
    head.scale.set(1.25, 0.9, 0.7);
    head.position.set(sx * 2.6, 0, 0);
    orn.add(head);
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 8), M.gold);
    snout.rotation.x = Math.PI / 2;
    snout.position.set(sx * 2.6, -0.1, 0.36);
    orn.add(snout);
    for (const k of [-1, 1]) {
      const horn = tubeFromPoints([
        new THREE.Vector3(sx * 2.6 + k * 0.16, 0.2, 0.05),
        new THREE.Vector3(sx * 2.6 + k * 0.34, 0.55, -0.1),
        new THREE.Vector3(sx * 2.6 + k * 0.2, 0.85, -0.2),
      ], 0.055, goldHot, 14, false, 5);
      orn.add(horn);
    }
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), M.neonRed);
    eye.position.set(sx * 2.6 + sx * 0.14, 0.1, 0.3);
    orn.add(eye);
  }
  // حلية مركزية
  const medallion = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.12, 20), M.goldDark);
  medallion.rotation.x = Math.PI / 2;
  orn.add(medallion);
  const medRing = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.06, 6, 22), goldHot);
  orn.add(medRing);
  const medGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), M.neonRed);
  medGem.position.z = 0.12;
  orn.add(medGem);
  orn.position.set(0, DIM.plinthH + DIM.doorH + 0.72, DIM.frontZ + 0.62);
  orn.userData.gem = medGem;
  g.add(orn);

  g.scale.set(0.92, 1, 0.97);
  shade(g);

  const update = (t, dt) => {
    // وميض الفوانيس
    for (const l of flickers) {
      const f = l.userData.flicker;
      if (!f) continue;
      const k = 0.78 + Math.sin(t * 7 + f.phase) * 0.12 + Math.sin(t * 19.3 + f.phase * 2) * 0.07;
      f.glow.material.opacity = f.base * k;
      if (l.userData.light) l.userData.light.intensity = 22 * (0.85 + k * 0.25);
    }
    // تمايل الرايات
    for (const b of animated) {
      if (b.userData && b.userData.sway) {
        const s = b.userData.sway;
        s.mesh.rotation.z = Math.sin(t * 1.1 + s.phase) * 0.05;
        s.mesh.rotation.x = Math.sin(t * 0.8 + s.phase * 1.4) * 0.04;
      }
    }
    if (orn.userData.gem) orn.userData.gem.rotation.y = t * 1.4;
    // نبض الكريستالات
    if (crest) {
      crest.position.y = crest.userData.baseY + Math.sin(t * 0.9) * 0.05;
      gem.rotation.y = t * 0.8;
    }
    interior.update(t, dt);
  };

  return { group: g, update, interior };
}
