import * as THREE from 'three';
import { getMaterials } from '../lib/materials.js';
import {
  box, cyl, shade, createRoof, createBanner, createLantern,
  createPillar, createRailing, instanced, tubeFromPoints, sprite,
  createChest, createPlant, createCrystalCluster,
} from '../lib/shapes.js';
import { createInterior } from './interior.js';
import { mergeStaticMeshes } from '../lib/mergeStatic.js';

/* أبعاد المبنى */
import { DIM } from './dims.js';
export { DIM };

function neon(w, h, d, x, y, z, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

// عوارض مستقيمة في مستوى الواجهة، تستعمل للإطارات والزخارف الفعلية ثلاثية الأبعاد.
function beamBetween(group, a, b, width, depth, material) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const beam = box(width, Math.hypot(dx, dy) + width * 0.25, depth, material,
    (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  beam.rotation.z = -Math.atan2(dx, dy);
  group.add(beam);
  return beam;
}

function framedWindow({ width, height, pane = true }) {
  const M = getMaterials();
  const group = new THREE.Group();
  if (pane) {
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(width, height), M.window);
    glass.position.z = 0.03;
    group.add(glass);
  }
  // حواف عميقة، تقسيمات خشبية، وإطار معدني داخلي.
  for (const sx of [-1, 1]) {
    group.add(box(0.22, height + 0.45, 0.25, M.woodTrim, sx * (width / 2 + 0.12), 0, 0.11));
    group.add(box(0.055, height + 0.16, 0.07, M.goldDark, sx * (width / 2 - 0.01), 0, 0.25));
  }
  for (const sy of [-1, 1]) {
    group.add(box(width + 0.48, 0.22, 0.25, M.woodTrim, 0, sy * (height / 2 + 0.12), 0.11));
    group.add(box(width + 0.06, 0.055, 0.07, M.goldDark, 0, sy * (height / 2 - 0.01), 0.25));
  }
  for (const x of [-width / 6, width / 6]) group.add(box(0.1, height, 0.1, M.woodDark, x, 0, 0.2));
  for (const y of [-height / 6, height / 6]) group.add(box(width, 0.1, 0.1, M.woodDark, 0, y, 0.2));
  return group;
}

/* ============================================================
   القاعدة والحجر
   ============================================================ */
function buildBase(g) {
  const M = getMaterials();
  const { plinthW: w, plinthD: d, plinthH: h } = DIM;

  // قاعدة حجرية متدرجة، جزء من الموديل وليست أرضية للمشهد.
  g.add(box(w, 0.32, d, M.stoneDark, 0, 0.16, 0));
  g.add(box(w - 0.35, h - 0.32, d - 0.35, M.stone, 0, 0.32 + (h - 0.32) / 2, 0));
  g.add(box(w + 0.15, 0.16, d + 0.15, M.stoneDark, 0, h - 0.08, 0));
  g.add(box(w - 0.2, 0.035, 0.045, M.goldDark, 0, h - 0.14, d / 2 + 0.09));

  // فواصل حجارة القاعدة تعطيها عمقاً واضحاً من كل الزوايا.
  const joints = [];
  for (let x = -w / 2 + 1.65; x < w / 2; x += 2.45) joints.push({ x, y: 0.68, z: d / 2 - 0.165 });
  g.add(instanced(new THREE.BoxGeometry(0.035, 0.8, 0.025), M.woodDark, joints));
  for (const sx of [-1, 1]) {
    const sideJoints = [];
    for (let z = -d / 2 + 1.4; z < d / 2; z += 2.45) sideJoints.push({ x: sx * (w / 2 - 0.165), y: 0.68, z });
    g.add(instanced(new THREE.BoxGeometry(0.025, 0.8, 0.035), M.woodDark, sideJoints));
  }

  // ست درجات متصلة، ترتفع فعلياً باتجاه المدخل.
  const count = 6, rise = h / count, run = 0.72, stepW = 8.4;
  for (let i = 0; i < count; i++) {
    const height = rise * (i + 1);
    const z = d / 2 + run * (count - i - 0.5);
    const step = box(stepW, height, run + 0.025, i % 2 ? M.stone : M.stoneDark, 0, height / 2, z);
    step.castShadow = true;
    step.receiveShadow = true;
    g.add(step);
    // ضوء رفيع عند الجانبين بدلاً من تغطية كل الدرجة بالنيون.
    for (const sx of [-1, 1]) {
      g.add(box(0.14, 0.035, 0.065, M.neonRed, sx * 3.35, height + 0.012, z + run / 2));
    }
    g.add(box(stepW - 0.18, 0.025, 0.04, M.goldDark, 0, height + 0.008, z + run / 2 - 0.025));
  }
  for (const sx of [-1, 1]) {
    const rail = box(0.42, 0.42, run * count + 0.3, M.stoneDark, sx * (stepW / 2 + 0.15), h / 2 + 0.25, d / 2 + run * count / 2);
    rail.rotation.x = -Math.atan2(h, run * count);
    g.add(rail);
    const post = box(0.65, 0.85, 0.65, M.stone, sx * (stepW / 2 + 0.18), 0.43, d / 2 + run * count);
    g.add(post);
    g.add(box(0.72, 0.12, 0.72, M.goldDark, sx * (stepW / 2 + 0.18), 0.87, d / 2 + run * count));
  }

  const floor = box(DIM.gfW, 0.2, DIM.gfD, M.woodWall, 0, h + 0.1, -0.2);
  floor.receiveShadow = true;
  g.add(floor);
}

/* ============================================================
   الطابق الأرضي
   ============================================================ */
function buildGroundFloor(g, { flickers }) {
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
    base.position.set(sx * 8.5, plinthH + 0.7, zFront + 1.3);
    g.add(base);
    const lan = createLantern({ scale: 0.62 });
    lan.position.set(sx * 8.5, plinthH + 1.75, zFront + 1.3);
    g.add(lan);
    flickers.push(lan);
  }
}

/* ============================================================
   الشرفة + الطابق العلوي
   ============================================================ */
function buildUpperFloor(g, { animated }) {
  const M = getMaterials();
  const { ufW, gfTop, ufD, ufTop, frontZ } = DIM;
  const h = ufTop - gfTop;

  // ---------- بلاطة الشرفة ----------
  const slab = box(ufW + 2.8, 0.45, ufD + 3.8, M.woodBeam, 0, gfTop + 0.18, 0.25);
  g.add(slab);
  // إفريز مضيء أسفل البلاطة
  g.add(neon(ufW + 2.2, 0.05, 0.06, 0, gfTop - 0.02, frontZ + 1.2, M.neonSoft));

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

/* تفاصيل إنشائية متصلة بالمبنى: جوانب مكتملة وإطارات وعتبة مدخل منحوتة. */
function buildArchitecturalDetails(g) {
  const M = getMaterials();
  const { plinthH, gfTop, ufTop, ufW, ufD, gfD, frontZ } = DIM;
  const upperH = ufTop - gfTop;
  const wallY = gfTop + upperH / 2;

  // استكمال جدران الطابق العلوي من الجانبين والخلف حتى يبدو المبنى صحيحاً عند الدوران.
  g.add(box(ufW, upperH, 0.6, M.woodWall, 0, wallY, -ufD / 2));
  for (const sx of [-1, 1]) {
    g.add(box(0.6, upperH, ufD, M.woodWall, sx * (ufW / 2 - 0.3), wallY, 0));
    for (const z of [-3.5, 3.5]) {
      g.add(box(0.36, upperH, 0.36, M.woodBeam, sx * (ufW / 2 + 0.02), wallY, z));
    }
    const upperSide = framedWindow({ width: 2.25, height: 2.35 });
    upperSide.position.set(sx * (ufW / 2 + 0.04), gfTop + 2.5, 0.1);
    upperSide.rotation.y = sx * Math.PI / 2;
    g.add(upperSide);
    const sideWindow = framedWindow({ width: 2.4, height: 2.8, pane: false });
    sideWindow.position.set(sx * (DIM.gfW / 2 + 0.06), plinthH + 4.2, 1.6);
    sideWindow.rotation.y = sx * Math.PI / 2;
    g.add(sideWindow);
    const secondSideWindow = framedWindow({ width: 2.4, height: 2.8 });
    secondSideWindow.position.set(sx * (DIM.gfW / 2 + 0.06), plinthH + 4.2, -3.1);
    secondSideWindow.rotation.y = sx * Math.PI / 2;
    g.add(secondSideWindow);
    // تقسيمات وعوارض للواجهتين الجانبيتين، بدلاً من جدار مسطح عند الدوران.
    for (const z of [-5.35, -0.75, 4.45]) {
      g.add(box(0.23, 5.95, 0.26, M.woodTrim, sx * 9.06, plinthH + 3.3, z));
      g.add(box(0.3, 0.15, 0.34, M.goldDark, sx * 9.09, plinthH + 0.46, z));
      g.add(box(0.3, 0.15, 0.34, M.goldDark, sx * 9.09, gfTop - 0.6, z));
    }
    for (const y of [plinthH + 1.0, plinthH + 5.9]) {
      g.add(box(0.18, 0.14, gfD - 0.7, M.woodTrim, sx * 9.08, y, 0));
    }
    const frontWindow = framedWindow({ width: 2.6, height: 3.1, pane: false });
    frontWindow.position.set(sx * 6.3, plinthH + 3.9, frontZ + 0.09);
    g.add(frontWindow);
    const upperFront = framedWindow({ width: 2, height: 2.2, pane: false });
    upperFront.position.set(sx * 5.9, gfTop + 2.3, frontZ - 0.81);
    g.add(upperFront);

    // أعمدة زاوية وعوارض أفقية على الجوانب.
    for (const z of [-gfD / 2 + 0.65, gfD / 2 - 0.65]) {
      g.add(box(0.42, gfTop - plinthH, 0.42, M.woodBeam, sx * 9.04, (gfTop + plinthH) / 2, z));
      g.add(box(0.52, 0.22, 0.52, M.goldDark, sx * 9.04, plinthH + 0.28, z));
      g.add(box(0.52, 0.18, 0.52, M.goldDark, sx * 9.04, gfTop - 0.34, z));
    }
    for (const y of [plinthH + 0.35, gfTop - 0.35]) {
      g.add(box(0.3, 0.27, gfD - 0.4, M.woodBeam, sx * 9.05, y, 0));
    }
    const rearWindow = framedWindow({ width: 2.3, height: 2.6 });
    rearWindow.position.set(sx * 5.2, plinthH + 3.9, -gfD / 2 - 0.04);
    rearWindow.rotation.y = Math.PI;
    g.add(rearWindow);
    const rearUpper = framedWindow({ width: 2.1, height: 2.1 });
    rearUpper.position.set(sx * 5.1, gfTop + 2.4, -ufD / 2 - 0.34);
    rearUpper.rotation.y = Math.PI;
    g.add(rearUpper);
  }

  // مدخل مقوّس متعدد الطبقات يحيط بالفتحة ولا يغلقها.
  const archPoints = [
    [-3.78, plinthH + 0.12], [-3.78, 5.75], [-3.12, 6.42],
    [-2.42, 6.9], [2.42, 6.9], [3.12, 6.42], [3.78, 5.75], [3.78, plinthH + 0.12],
  ];
  for (let i = 0; i < archPoints.length - 1; i++) {
    const a = archPoints[i], b = archPoints[i + 1];
    beamBetween(g, [a[0], a[1], frontZ + 0.66], [b[0], b[1], frontZ + 0.66], 0.33, 0.42, M.woodBeam);
    beamBetween(g, [a[0], a[1], frontZ + 0.9], [b[0], b[1], frontZ + 0.9], 0.075, 0.09, M.goldDark);
  }
  for (const sx of [-1, 1]) {
    g.add(box(0.72, 0.35, 0.75, M.goldDark, sx * 3.8, plinthH + 0.2, frontZ + 0.7));
    // زخارف خشبية غائرة على جانبي المدخل.
    for (const y of [2.1, 7.5]) {
      g.add(box(2.75, 0.12, 0.16, M.woodBeam, sx * 6.3, y, frontZ + 0.16));
      g.add(box(2.55, 0.035, 0.05, M.goldDark, sx * 6.3, y + 0.09, frontZ + 0.26));
    }
  }
}

/* ============================================================
   اللافتة الكبيرة
   ============================================================ */
function buildSign(g) {
  const M = getMaterials();
  const signW = 8.8, signH = 5.7;
  const group = new THREE.Group();
  group.position.set(0, 11.45, DIM.frontZ + 3.0);

  // حدود الدرع تطابق خامة اللافتة، لذلك لا تظهر كتلة مستطيلة خلفها.
  const outline = [
    [-0.44, -0.40], [-0.28, -0.475], [0.28, -0.475], [0.44, -0.40],
    [0.475, -0.10], [0.40, 0.30], [0.20, 0.455], [0, 0.49],
    [-0.20, 0.455], [-0.40, 0.30], [-0.475, -0.10],
  ].map(([x, y]) => [x * signW, -y * signH]);
  const shape = new THREE.Shape();
  outline.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
  shape.closePath();
  const solid = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {
    depth: 0.24, bevelEnabled: true, bevelSize: 0.055, bevelThickness: 0.055, bevelSegments: 2,
  }), M.goldDark);
  solid.position.z = -0.31;
  solid.castShadow = true;
  group.add(solid);

  const panel = new THREE.Mesh(new THREE.PlaneGeometry(signW, signH), M.sign);
  panel.position.z = 0.02;
  group.add(panel);
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length];
    beamBetween(group, [a[0], a[1], 0.075], [b[0], b[1], 0.075], 0.105, 0.1, M.gold);
  }
  // رؤوس مسامير على الإطار تبرز سمكه في المنظور القريب.
  const studGeo = new THREE.SphereGeometry(0.075, 8, 6);
  for (const [x, y] of outline) {
    const stud = new THREE.Mesh(studGeo, M.gold);
    stud.position.set(x, y, 0.15);
    group.add(stud);
  }
  const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), M.gold);
  diamond.position.set(0, -signH * 0.51, 0.07);
  diamond.scale.set(1, 1.35, 0.45);
  group.add(diamond);
  for (const sx of [-1, 1]) {
    const chainX = sx * 3.0;
    for (let i = 0; i < 5; i++) {
      const link = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.035, 5, 10), M.goldDark);
      link.position.set(chainX, signH * 0.45 + i * 0.19, -0.12);
      link.rotation.y = i % 2 ? Math.PI / 2 : 0;
      group.add(link);
    }
  }
  g.add(group);
  for (const sx of [-1, 1]) {
    g.add(box(0.22, 0.22, 1.65, M.woodDark, sx * 3.25, 9.45, DIM.frontZ + 2.1));
  }
  return group;
}

/* ============================================================
   السقوف
   ============================================================ */
function buildRoofs(g) {
  const M = getMaterials();
  const { gfTop, ufTop, ufW } = DIM;

  // إفريز الشرفة مكوّن من عوارض حقيقية بدل سطح يغطي الطابق العلوي.
  g.add(box(21.0, 0.42, 0.65, M.woodDark, 0, gfTop + 0.12, 7.55));
  g.add(box(20.8, 0.075, 0.1, M.goldDark, 0, gfTop + 0.37, 7.91));
  g.add(box(20.7, 0.045, 0.07, M.neonSoft, 0, gfTop - 0.05, 7.9));
  for (const sx of [-1, 1]) {
    g.add(box(0.52, 0.42, 14.3, M.woodDark, sx * 9.75, gfTop + 0.12, 0.1));
    g.add(box(0.08, 0.06, 14.2, M.goldDark, sx * 10.04, gfTop + 0.36, 0.1));
  }

  const main = createRoof({
    width: 23.7, depth: 17.0, height: 3.65, thickness: 0.42,
    sag: 1.35, lift: 0.42, corner: 1.45, segments: 64,
    finials: true, rafters: 30,
  });
  main.position.y = ufTop;
  g.add(main);
  const frontGable = createRoof({
    width: 12.8, depth: 5.6, height: 1.4, thickness: 0.28,
    sag: 1.4, lift: 0.24, corner: 0.8, segments: 40,
    rafters: 10, finials: false,
  });
  frontGable.position.set(0, ufTop + 0.9, 5.6);
  g.add(frontGable);
  for (const sx of [-1, 1]) {
    g.add(box(0.55, 0.42, 0.55, M.goldDark, sx * (ufW / 2 + 1.2), ufTop + 0.12, DIM.frontZ + 0.6));
  }
  return { main };
}

/* ============================================================
   الشعار على قمة السقف (نصل أسود بحواف ذهبية وعيون متوهجة)
   ============================================================ */
function buildCrest(g) {
  const M = getMaterials();
  const crest = new THREE.Group();
  const obsidian = new THREE.MeshStandardMaterial({ color: 0x28151b, roughness: 0.32, metalness: 0.6 });
  const darkFacet = new THREE.MeshStandardMaterial({ color: 0x45151a, roughness: 0.38, metalness: 0.48 });
  const edge = new THREE.MeshStandardMaterial({ color: 0xd09b51, roughness: 0.3, metalness: 0.8 });
  const eye = new THREE.MeshBasicMaterial({ color: 0xff3b27 });
  const makeShape = (points) => {
    const shape = new THREE.Shape();
    points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
    shape.closePath();
    return shape;
  };
  const plate = (points, material, z, depth = 0.12) => {
    const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(makeShape(points), {
      depth, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.035, bevelSegments: 2,
    }), material);
    mesh.position.z = z;
    crest.add(mesh);
    return mesh;
  };

  // قرون متعددة الطبقات، ثم قناع تنين بوجنتين وحواف ذهبية بارزة.
  for (const sx of [-1, 1]) {
    const mirror = (pts) => pts.map(([x, y]) => [x * sx, y]);
    plate(mirror([[0.25, 0.9], [0.5, 2.65], [1.05, 3.4], [0.94, 2.15], [1.5, 1.0]]), edge, -0.18, 0.13);
    plate(mirror([[0.36, 0.95], [0.62, 2.53], [0.94, 3.12], [0.82, 2.05], [1.36, 1.02]]), obsidian, -0.02, 0.12);
    plate(mirror([[0.82, 0.42], [1.5, 1.45], [2.12, 2.1], [1.9, 0.95], [1.25, 0.1]]), edge, -0.2, 0.14);
    plate(mirror([[0.87, 0.44], [1.54, 1.36], [2.0, 1.94], [1.77, 0.91], [1.22, 0.2]]), obsidian, -0.03, 0.12);
  }
  const face = [[0, 2.6], [0.6, 1.85], [1.35, 1.56], [1.52, 0.72], [1.05, 0.04], [0, -0.75], [-1.05, 0.04], [-1.52, 0.72], [-1.35, 1.56], [-0.6, 1.85]];
  plate(face, edge, 0, 0.16);
  const innerFace = face.map(([x, y]) => [x * 0.89, y * 0.91]);
  plate(innerFace, obsidian, 0.17, 0.13);
  for (const sx of [-1, 1]) {
    plate([[0, 1.85], [sx * 1.25, 1.3], [sx * 1.15, 0.45], [sx * 0.15, -0.3]], darkFacet, 0.32, 0.06);
    plate([[sx * 0.18, 0.84], [sx * 1.0, 1.12], [sx * 0.75, 0.65], [sx * 0.28, 0.55]], eye, 0.42, 0.035);
    const shine = sprite(M.glowSprite, 1.25, sx * 0.6, 0.82, 0.55);
    shine.material.opacity = 0.42;
    crest.add(shine);
  }
  plate([[0, 1.9], [0.22, 0.92], [0, -0.45], [-0.22, 0.92]], obsidian, 0.43, 0.07);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), M.neonRed);
  gem.position.set(0, 0.28, 0.57);
  gem.userData.dynamic = true;
  crest.add(gem);
  const base = box(1.8, 0.25, 0.65, M.goldDark, 0, -0.83, -0.03);
  crest.add(base);

  crest.position.set(0, 15.15, DIM.frontZ + 3.1);
  g.add(crest);
  return { crest, gem };
}

/* ============================================================
   تفاصيل الواجهة: رايات، فوانيس، أعلام
   ============================================================ */
function buildFacadeDetails(g, { flickers, animated }) {
  const M = getMaterials();

  // رايات كبيرة على جانبي السقف السفلي
  for (const sx of [-1, 1]) {
    const b = createBanner({ w: 1.7, h: 4.6, phase: sx * 1.2 });
    b.position.set(sx * 11.0, 8.25, 7.4);
    g.add(b);
    animated.push(b);

    const b2 = createBanner({ w: 1.25, h: 3.2, phase: sx * 2.1 });
    b2.position.set(sx * 10.6, 12.3, 7.0);
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
      f.position.set(sx * 11.5, 12.4 - h / 2, z);
      f.rotation.y = sx * Math.PI / 2;
      g.add(f);
    }
  }


  // ------------------ صناديق ونباتات وكريستالات ----------------
  const chestA = createChest({ size: 1.25, open: true });
  chestA.position.set(-7.4, DIM.plinthH, 7.7);
  chestA.rotation.y = 0.45;
  g.add(chestA);

  const chestB = createChest({ size: 1.05, open: false });
  chestB.position.set(9.3, DIM.plinthH, 7.6);
  chestB.rotation.y = -0.5;
  g.add(chestB);

  return g;
}

/* ============================================================
   البناء الكامل
   ============================================================ */
export function createShop() {
  const flickers = [];
  const animated = [];
  const M = getMaterials();
  const g = new THREE.Group();
  g.name = 'shop';

  buildBase(g);
  buildGroundFloor(g, { flickers });
  buildUpperFloor(g, { animated });
  buildArchitecturalDetails(g);
  buildRoofs(g);
  buildSign(g);
  const { crest, gem } = buildCrest(g);
  buildFacadeDetails(g, { flickers, animated });

  // ------------------ كريستالات ونباتات حوالين المدخل ------------------
  for (const sx of [-1, 1]) {
    const cr = createCrystalCluster({ count: 5, size: 0.9, material: sx > 0 ? M.crystalBlue : M.crystalRed, light: false });
    cr.position.set(sx * 6.2, DIM.plinthH, 7.75);
    g.add(cr);
    animated.push(cr);

    const pl = createPlant({ size: 1.0 });
    pl.position.set(sx * 10.2, DIM.plinthH, 7.45);
    g.add(pl);

    const pl2 = createPlant({ size: 0.8 });
    pl2.position.set(sx * 5.2, DIM.plinthH, 7.75);
    g.add(pl2);
  }

  // ------------------ الداخل ------------------
  const interior = createInterior();
  interior.group.userData.dynamic = true;
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
  medGem.userData.dynamic = true;
  orn.userData.gem = medGem;
  g.add(orn);

  g.scale.set(0.92, 1, 0.97);
  shade(g);
  mergeStaticMeshes(g);

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
      gem.rotation.y = t * 0.8;
    }
    interior.update(t, dt);
  };

  return { group: g, update, interior };
}
