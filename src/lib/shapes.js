import * as THREE from 'three';
import { getMaterials } from './materials.js';

/* ============================================================
   أدوات مساعدة
   ============================================================ */
export const rand = (() => {
  let s = 1337;
  return (a = 0, b = 1) => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return a + (s / 2147483648) * (b - a);
  };
})();

export function shade(obj, cast = true, receive = true) {
  obj.traverse((o) => {
    if (o.isMesh) { o.castShadow = cast; o.receiveShadow = receive; }
  });
  return obj;
}

export function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

export function cyl(rt, rb, h, mat, seg = 16, open = false) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), mat);
}

/** خط أنابيب من نقاط */
export function tubeFromPoints(points, radius, mat, tubular = 120, closed = false, radial = 7) {
  const curve = new THREE.CatmullRomCurve3(points, closed, 'catmullrom', 0.5);
  const geo = new THREE.TubeGeometry(curve, tubular, radius, radial, closed);
  return new THREE.Mesh(geo, mat);
}

export function sprite(material, size, x = 0, y = 0, z = 0) {
  const s = new THREE.Sprite(material.clone());
  s.scale.set(size, size, 1);
  s.position.set(x, y, z);
  return s;
}

const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();

/** InstancedMesh سريع لعناصر متكررة */
export function instanced(geo, mat, transforms, { cast = true, receive = true } = {}) {
  const mesh = new THREE.InstancedMesh(geo, mat, transforms.length);
  transforms.forEach((t, i) => {
    _e.set(t.rx || 0, t.ry || 0, t.rz || 0);
    _q.setFromEuler(_e);
    _v.set(t.x || 0, t.y || 0, t.z || 0);
    _s.set(t.sx ?? 1, t.sy ?? 1, t.sz ?? 1);
    _m4.compose(_v, _q, _s);
    mesh.setMatrixAt(i, _m4);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

/* ============================================================
   السقف المنحني (قلب الشكل)
   ============================================================ */
export function roofHeight(u, v, { height, sag, lift, corner }) {
  const ax = Math.abs(u), av = Math.abs(v);
  const m = Math.max(ax, av);
  const base = height * Math.pow(Math.max(0, 1 - m), sag);
  const edge = lift * Math.pow(m, 7);
  const cor = corner * Math.pow(ax * av, 4);
  return base + edge + cor;
}

export function createRoof({
  width = 24, depth = 18, height = 4.2,
  thickness = 0.3, sag = 1.9, lift = 0.55, corner = 1.4,
  segments = 60, trim = true, trimColor = null, hips = true, finials = false, rafters = 0, hipGlow = true,
} = {}) {
  const M = getMaterials();
  const g = new THREE.Group();
  const hw = width / 2, hd = depth / 2;
  const S = segments;
  const P = { height, sag, lift, corner };
  const at = (u, v) => new THREE.Vector3(u * hw, roofHeight(u, v, P), v * hd);

  /* ---------- السطح العلوي ---------- */
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= S; j++) {
    const v = (j / S) * 2 - 1;
    for (let i = 0; i <= S; i++) {
      const u = (i / S) * 2 - 1;
      const p = at(u, v);
      pos.push(p.x, p.y, p.z);
      uv.push((u + 1) / 2, (v + 1) / 2);
    }
  }
  for (let j = 0; j < S; j++) {
    for (let i = 0; i < S; i++) {
      const a = j * (S + 1) + i, b = a + 1, c = a + S + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const top = new THREE.BufferGeometry();
  top.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  top.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  top.setIndex(idx);
  top.computeVertexNormals();
  const topMesh = new THREE.Mesh(top, M.roofMat);
  topMesh.castShadow = true; topMesh.receiveShadow = true;
  g.add(topMesh);

  /* ---------- السطح السفلي ---------- */
  const posB = [];
  for (let i = 0; i < pos.length; i += 3) posB.push(pos[i], pos[i + 1] - thickness, pos[i + 2]);
  const bottom = new THREE.BufferGeometry();
  bottom.setAttribute('position', new THREE.Float32BufferAttribute(posB, 3));
  bottom.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const idxB = [];
  for (let k = 0; k < idx.length; k += 3) idxB.push(idx[k], idx[k + 2], idx[k + 1]);
  bottom.setIndex(idxB);
  bottom.computeVertexNormals();
  const bottomMesh = new THREE.Mesh(bottom, M.roofUnder);
  bottomMesh.receiveShadow = true;
  g.add(bottomMesh);

  /* ---------- الحافة (حلقة محيطة) ---------- */
  const loop = [];
  for (let i = 0; i < S; i++) loop.push([(i / S) * 2 - 1, -1]);
  for (let j = 0; j < S; j++) loop.push([1, (j / S) * 2 - 1]);
  for (let i = S; i > 0; i--) loop.push([(i / S) * 2 - 1, 1]);
  for (let j = S; j > 0; j--) loop.push([-1, (j / S) * 2 - 1]);

  const rimPos = [], rimIdx = [];
  let n = 0;
  for (const [u, v] of loop) {
    const p = at(u, v);
    rimPos.push(p.x, p.y, p.z, p.x, p.y - thickness, p.z);
    n++;
  }
  for (let i = 0; i < n; i++) {
    const a = i * 2, b = ((i + 1) % n) * 2;
    rimIdx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const rimGeo = new THREE.BufferGeometry();
  rimGeo.setAttribute('position', new THREE.Float32BufferAttribute(rimPos, 3));
  rimGeo.setIndex(rimIdx);
  rimGeo.computeVertexNormals();
  const rimMesh = new THREE.Mesh(rimGeo, M.roofUnder);
  rimMesh.castShadow = true;
  g.add(rimMesh);

  const perimeterPts = loop.map(([u, v]) => at(u, v));

  /* ---------- عوارض الإفريز ---------- */
  const fascia = tubeFromPoints(perimeterPts.map((p) => p.clone().setY(p.y - thickness * 0.55)), 0.14, M.woodTrim, 180, true, 6);
  g.add(fascia);

  /* ---------- إضاءة النيون على الحافة ---------- */
  if (trim) {
    const t = tubeFromPoints(perimeterPts.map((p) => p.clone().setY(p.y + 0.03)), 0.075, trimColor || M.neonRed, 200, true, 6);
    g.add(t);
  }

  /* ---------- خطوط التقاء السطح (hips) ---------- */
  if (hips) {
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const pts = [];
      for (let i = 0; i <= 14; i++) {
        const t = 0.08 + (i / 14) * 0.92;
        const u = sx * t, v = sz * t;
        pts.push(new THREE.Vector3(u * hw, roofHeight(u, v, P) + 0.06, v * hd));
      }
      g.add(tubeFromPoints(pts, 0.1, M.woodTrim, 24, false, 5));
      if (hipGlow) g.add(tubeFromPoints(pts.map((p) => p.clone().setY(p.y + 0.06)), 0.035, trimColor || M.neonSoft, 24, false, 4));
    }
  }

  /* ---------- مداميك مرتفعة فوق القرميد ---------- */
  for (let row = 2; row <= 9; row++) {
    const t = row / 10;
    for (const sign of [-1, 1]) {
      const front = [], side = [];
      for (let i = 0; i <= 12; i++) {
        const k = -t + (2 * t * i) / 12;
        const fp = at(k, sign * t); fp.y += 0.025; front.push(fp);
        const sp = at(sign * t, k); sp.y += 0.025; side.push(sp);
      }
      g.add(tubeFromPoints(front, 0.025, M.roofUnder, 16, false, 4));
      g.add(tubeFromPoints(side, 0.025, M.roofUnder, 16, false, 4));
    }
  }

  /* ---------- نهايات معدنية مدببة متصلة بالسقف ---------- */
  if (finials) {
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const p = at(sx, sz);
      const finial = new THREE.Group();
      finial.add(box(0.55, 0.14, 0.55, M.goldDark, 0, 0.05, 0));
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.55, 4), M.goldDark);
      spike.position.set(0, 0.35, 0);
      spike.rotation.y = Math.PI / 4;
      finial.add(spike);
      const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), M.neonSoft);
      tip.position.y = 0.68;
      finial.add(tip);
      finial.position.copy(p);
      g.add(finial);
    }
  }

  /* ---------- عوارض خشبية تحت الحافة (طابع الباجودا) ---------- */
  if (rafters > 0) {
    const step = Math.max(1, Math.floor(loop.length / rafters));
    for (let i = 0; i < loop.length; i += step) {
      const [u, v] = loop[i];
      const p = at(u, v);
      const out = new THREE.Vector3(p.x, 0, p.z).normalize();
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 1.25), M.woodTrim);
      const r = Math.hypot(p.x, p.z) - 0.22;
      beam.position.set(out.x * r, p.y - thickness - 0.16, out.z * r);
      beam.rotation.y = Math.atan2(out.x, out.z);
      beam.rotation.x = -0.12;
      g.add(beam);
      const gold = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.07, 1.28), M.goldDark);
      gold.position.copy(beam.position).setY(beam.position.y - 0.1);
      gold.rotation.copy(beam.rotation);
      g.add(gold);
    }
  }

  g.userData.perimeter = perimeterPts;
  g.userData.topGeometry = top;
  return g;
}

/* ============================================================
   الرايات
   ============================================================ */
export function createBanner({ w = 1.5, h = 4.2, rod = true, phase = 0 } = {}) {
  const M = getMaterials();
  const g = new THREE.Group();
  const seg = 10;
  const geo = new THREE.PlaneGeometry(w, h, seg, seg * 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    const t = (y / h) + 0.5; // 0 أعلى → 1 أسفل
    const wave = Math.sin(x * 3.2 + phase) * 0.09 * (0.25 + t);
    p.setZ(i, wave + Math.sin(t * Math.PI) * 0.16);
    p.setX(i, x * (1 - t * 0.06));
  }
  geo.computeVertexNormals();
  const cloth = new THREE.Mesh(geo, M.cloth);
  cloth.castShadow = true;
  cloth.position.y = -h / 2;
  g.add(cloth);

  if (rod) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, w + 0.5, 8), M.goldDark);
    r.rotation.z = Math.PI / 2;
    r.position.y = 0.03;
    g.add(r);
    for (const sx of [-1, 1]) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), M.gold);
      cap.position.set(sx * (w / 2 + 0.25), 0.03, 0);
      g.add(cap);
    }
    // سلاسل
    for (const sx of [-1, 1]) {
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.7, 5), M.iron);
      chain.position.set(sx * w * 0.32, 0.4, 0);
      g.add(chain);
    }
  }
  g.userData.sway = { mesh: cloth, phase, base: cloth.position.x };
  return g;
}

/* ============================================================
   الفوانيس
   ============================================================ */
export function createLantern({ scale = 1, light = false, lightIntensity = 26, color = 0xff5a2a } = {}) {
  const M = getMaterials();
  const g = new THREE.Group();
  const profile = [
    [0.001, 0.44], [0.14, 0.38], [0.22, 0.22], [0.245, 0.0],
    [0.22, -0.22], [0.14, -0.38], [0.001, -0.44],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 18), M.amber);
  g.add(body);

  // أضلاع معدنية
  const ribs = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ribs.push({ x: Math.cos(a) * 0.225, z: Math.sin(a) * 0.225, ry: -a });
  }
  const ribGeo = new THREE.BoxGeometry(0.02, 0.62, 0.02);
  g.add(instanced(ribGeo, M.woodTrim, ribs, { cast: false }));

  const capT = cyl(0.16, 0.2, 0.1, M.woodTrim, 12);
  capT.position.y = 0.44;
  const capB = cyl(0.2, 0.15, 0.1, M.woodTrim, 12);
  capB.position.y = -0.44;
  g.add(capT, capB);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.025, 6, 12), M.gold);
  ring.position.y = 0.53;
  ring.rotation.x = Math.PI / 2;
  g.add(ring);

  const glow = sprite(M.glowSprite, 1.9);
  glow.material.opacity = 0.34;
  g.add(glow);

  if (light) {
    const l = new THREE.PointLight(color, lightIntensity, 26, 2);
    l.position.y = 0.05;
    g.add(l);
    g.userData.light = l;
  }

  g.scale.setScalar(scale);
  g.userData.flicker = { glow, phase: rand(0, 10), base: 0.34 };
  return g;
}

/* ============================================================
   التاج الذهبي
   ============================================================ */
export function createCrown({ size = 1 } = {}) {
  const M = getMaterials();
  const g = new THREE.Group();
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.55, 0.26, 14, 1, true), M.gold);
  band.position.y = 0.13;
  g.add(band);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.53, 0.045, 6, 18), M.gold);
  rim.position.y = 0.27;
  rim.rotation.x = Math.PI / 2;
  g.add(rim);
  const spikes = [0, 0.62, -0.62, 1.35, -1.35];
  spikes.forEach((a, i) => {
    const hSize = i === 0 ? 0.6 : 0.46;
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.11, hSize, 6), M.gold);
    s.position.set(Math.sin(a) * 0.44, 0.3 + hSize / 2, Math.cos(a) * 0.44);
    s.rotation.set(Math.cos(a) * 0.14, 0, -Math.sin(a) * 0.14);
    g.add(s);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), M.gold);
    ball.position.set(Math.sin(a) * 0.44, 0.32 + hSize, Math.cos(a) * 0.44);
    g.add(ball);
  });
  const jewel = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), M.crystalRed);
  jewel.position.set(0, 0.13, 0.52);
  g.add(jewel);
  g.scale.setScalar(size);
  return g;
}

/* ============================================================
   صندوق الكنز
   ============================================================ */
export function createChest({ size = 1, open = false, glowColor = 0xffb35a, withLight = false } = {}) {
  const M = getMaterials();
  const g = new THREE.Group();
  const w = 1.5, h = 0.9, d = 1.05;

  // جدران وأركان مستقلة بدل كتلة واحدة، مع ألواح ومسامير معدنية.
  g.add(box(w, 0.12, d, M.woodDark, 0, 0.06, 0));
  for (const z of [-d / 2 + 0.07, d / 2 - 0.07]) {
    g.add(box(w, h, 0.14, M.woodDark, 0, h / 2, z));
    g.add(box(w, 0.07, 0.05, M.goldDark, 0, 0.16, z + Math.sign(z) * 0.08));
  }
  for (const sx of [-1, 1]) {
    g.add(box(0.14, h, d, M.woodDark, sx * (w / 2 - 0.07), h / 2, 0));
    g.add(box(0.1, h + 0.02, d + 0.04, M.goldDark, sx * (w / 2 - 0.17), h / 2, 0));
  }
  g.add(box(w + 0.08, 0.1, d + 0.08, M.goldDark, 0, 0.04, 0));
  g.add(box(w + 0.06, 0.08, d + 0.06, M.goldDark, 0, h - 0.04, 0));

  // غطاء مقبب بسطح حقيقي ومفصلة عند الخلف.
  const lidShape = new THREE.Shape();
  lidShape.moveTo(-d / 2, 0);
  lidShape.quadraticCurveTo(-d / 2, 0.44, 0, 0.44);
  lidShape.quadraticCurveTo(d / 2, 0.44, d / 2, 0);
  lidShape.closePath();
  const lidGeometry = new THREE.ExtrudeGeometry(lidShape, {
    depth: w, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 2,
  });
  lidGeometry.rotateY(Math.PI / 2);
  lidGeometry.translate(-w / 2, 0, 0);
  const hinge = new THREE.Group();
  const lid = new THREE.Group();
  lid.add(new THREE.Mesh(lidGeometry, M.woodDark));
  for (const sx of [-1, 1]) {
    const arc = [];
    for (let i = 0; i <= 12; i++) {
      const z = -d / 2 + (i / 12) * d;
      const y = 0.44 * Math.sqrt(Math.max(0, 1 - (z / (d / 2)) ** 2));
      arc.push(new THREE.Vector3(sx * (w / 2 - 0.18), y + 0.025, z));
    }
    lid.add(tubeFromPoints(arc, 0.045, M.goldDark, 24, false, 5));
  }
  lid.position.z = d / 2;
  hinge.position.set(0, h, -d / 2);
  hinge.add(lid);
  if (open) hinge.rotation.x = -0.9;
  g.add(hinge);

  const lock = box(0.24, 0.3, 0.08, M.gold, 0, h * 0.75, d / 2 + 0.035);
  g.add(lock);
  const pin = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), M.iron);
  pin.position.set(0, h * 0.76, d / 2 + 0.085);
  g.add(pin);

  if (open) {
    g.add(box(w * 0.78, 0.06, d * 0.72, M.amberDim, 0, h * 0.66, 0));
    if (withLight) {
      const light = new THREE.PointLight(glowColor, 5, 7, 2);
      light.position.set(0, h + 0.3, 0);
      g.add(light);
    }
    const glow = sprite(M.glowSpriteGold, 2.0, 0, h + 0.1, 0);
    glow.material.opacity = 0.3;
    g.add(glow);
    for (let i = 0; i < 5; i++) {
      const coin = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), M.gold);
      coin.position.set(rand(-0.5, 0.5), h * 0.72 + rand(0, 0.1), rand(-0.28, 0.28));
      coin.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
      g.add(coin);
    }
  }
  g.scale.setScalar(size);
  return g;
}

/* ============================================================
   كريستالات
   ============================================================ */
export function createCrystalCluster({ count = 5, size = 1, material = null, light = false } = {}) {
  const M = getMaterials();
  const g = new THREE.Group();
  const mat = material || M.crystalRed;
  for (let i = 0; i < count; i++) {
    const h = size * rand(0.5, 1.35);
    const geo = new THREE.ConeGeometry(size * rand(0.1, 0.2), h, 5);
    const c = new THREE.Mesh(geo, mat);
    const a = rand(0, Math.PI * 2), r = size * rand(0, 0.42);
    c.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
    c.rotation.set(rand(-0.35, 0.35), rand(0, Math.PI), rand(-0.35, 0.35));
    g.add(c);
  }
  const glow = sprite(M.glowSprite, size * 3.4, 0, size * 0.5, 0);
  g.add(glow);
  if (light) {
    const l = new THREE.PointLight(mat === M.crystalBlue ? 0x7fb2ff : 0xff3355, 8, 9, 2);
    l.position.y = size * 0.6;
    g.add(l);
  }
  g.userData.pulse = { glow };
  return g;
}

/* ============================================================
   نباتات
   ============================================================ */
export function createPlant({ size = 1, pot = true } = {}) {
  const M = getMaterials();
  const g = new THREE.Group();
  if (pot) {
    // صندوق نباتات خشبي مثل بقية تفاصيل الواجهة.
    g.add(box(0.85, 0.62, 0.85, M.woodDark, 0, 0.31, 0));
    g.add(box(0.94, 0.09, 0.94, M.goldDark, 0, 0.61, 0));
    g.add(box(0.94, 0.09, 0.94, M.woodTrim, 0, 0.08, 0));
    for (const sx of [-1, 1]) {
      g.add(box(0.07, 0.55, 0.07, M.goldDark, sx * 0.34, 0.32, 0.45));
    }
    const soil = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 0.74), M.rock);
    soil.rotation.x = -Math.PI / 2;
    soil.position.y = 0.65;
    g.add(soil);
  }
  // أوراق عريضة محدبة، وليست مخاريط رفيعة.
  for (let i = 0; i < 13; i++) {
    const a = (i / 13) * Math.PI * 2;
    const height = rand(0.7, 1.35);
    const width = rand(0.18, 0.3);
    const leafShape = new THREE.Shape();
    leafShape.moveTo(0, 0);
    leafShape.quadraticCurveTo(-width, height * 0.35, 0, height);
    leafShape.quadraticCurveTo(width, height * 0.35, 0, 0);
    const leaf = new THREE.Mesh(new THREE.ExtrudeGeometry(leafShape, {
      depth: 0.025, bevelEnabled: false, curveSegments: 4,
    }), i % 3 === 0 ? M.leafTeal : M.leafDark);
    const stem = new THREE.Group();
    stem.position.set(Math.cos(a) * 0.12, 0.6, Math.sin(a) * 0.12);
    stem.rotation.y = a;
    leaf.rotation.x = rand(0.35, 0.95);
    stem.add(leaf);
    g.add(stem);
  }
  g.scale.setScalar(size);
  return g;
}

/* ============================================================
   صخور
   ============================================================ */
export function createRock({ radius = 1, detail = 1, material = null } = {}) {
  const M = getMaterials();
  const geo = new THREE.IcosahedronGeometry(radius, detail);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = 0.78 + Math.sin(v.x * 3.1 + v.y * 2.3) * 0.08 + Math.cos(v.z * 2.7 + v.x) * 0.09;
    v.multiplyScalar(n);
    v.y *= 0.86;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, material || M.rock);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

/* ============================================================
   الدرج
   ============================================================ */
export function createStairs({ steps = 5, width = 9, rise = 0.26, run = 0.72, topY = 0 } = {}) {
  const M = getMaterials();
  const g = new THREE.Group();
  const stepGeo = new THREE.BoxGeometry(width, rise, run);
  const glowGeo = new THREE.BoxGeometry(width * 0.96, 0.035, 0.05);
  for (let i = 0; i < steps; i++) {
    const y = topY - rise * (i + 1);
    const z = run * (steps - i) - run / 2;
    const s = new THREE.Mesh(stepGeo, i % 2 ? M.stone : M.stoneDark);
    s.position.set(0, y + rise / 2, z);
    s.castShadow = true; s.receiveShadow = true;
    g.add(s);
    const glow = new THREE.Mesh(glowGeo, M.neonRed);
    glow.position.set(0, y + rise - 0.02, z + run / 2 + 0.005);
    g.add(glow);
  }
  // حواف ذهبية
  for (const sx of [-1, 1]) {
    const rail = box(0.22, rise * steps + 0.25, run * steps, M.goldDark, sx * (width / 2 + 0.08), topY - (rise * steps) / 2 + 0.1, run * steps / 2);
    rail.rotation.x = Math.atan2(rise * steps, run * steps);
    g.add(rail);
  }
  g.userData.run = run * steps;
  return g;
}

/* ============================================================
   السور / الدرابزين
   ============================================================ */
export function createRailing({ length = 10, height = 1.05, posts = 7, axis = 'x', beams = true } = {}) {
  const M = getMaterials();
  const g = new THREE.Group();
  const postGeo = new THREE.BoxGeometry(0.13, height, 0.13);
  const arr = [];
  for (let i = 0; i < posts; i++) {
    const t = (i / (posts - 1) - 0.5) * length;
    arr.push({ x: axis === 'x' ? t : 0, y: height / 2, z: axis === 'x' ? 0 : t });
  }
  g.add(instanced(postGeo, M.woodTrim, arr));
  if (beams) {
    for (const y of [height - 0.06, height * 0.45]) {
      const b = box(axis === 'x' ? length : 0.1, 0.09, axis === 'x' ? 0.1 : length, M.goldDark, 0, y, 0);
      g.add(b);
    }
  }
  return g;
}

/* ============================================================
   لوحة إعلانية خشبية
   ============================================================ */
export function createSignBoard({ material, w = 3.4, h = 3.4, posts = true, tilt = 0.06 } = {}) {
  const M = getMaterials();
  const g = new THREE.Group();
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  panel.position.y = h / 2 + 0.9;
  panel.rotation.y = tilt;
  g.add(panel);
  const frame = box(w + 0.28, h + 0.28, 0.16, M.woodTrim, 0, h / 2 + 0.9, -0.1);
  g.add(frame);
  if (posts) {
    for (const sx of [-1, 1]) {
      const p = box(0.22, h + 1.1, 0.22, M.woodDark, sx * (w / 2 + 0.02), (h + 1.1) / 2, -0.16);
      g.add(p);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.34, 4), M.goldDark);
      cap.position.set(sx * (w / 2 + 0.02), h + 1.2, -0.16);
      g.add(cap);
    }
  }
  return g;
}

/* ============================================================
   عمود خشبي بحلقات ذهبية
   ============================================================ */
export function createPillar({ h = 7, r = 0.34, rings = 3 } = {}) {
  const M = getMaterials();
  const g = new THREE.Group();
  const width = r * 2;
  g.add(box(width, h, width, M.woodBeam, 0, h / 2, 0));
  // خطوط طولية وحلقات نحاسية مربعة تبرز مقطع العمود.
  for (const sx of [-1, 1]) {
    g.add(box(0.045, h - 0.5, 0.045, M.woodTrim, sx * width * 0.33, h / 2, width / 2 + 0.01));
  }
  for (let i = 0; i < rings; i++) {
    const y = (h / (rings + 1)) * (i + 1);
    g.add(box(width + 0.08, 0.11, width + 0.08, M.goldDark, 0, y, 0));
  }
  g.add(box(width + 0.18, 0.22, width + 0.18, M.goldDark, 0, 0.11, 0));
  g.add(box(width + 0.14, 0.18, width + 0.14, M.woodTrim, 0, h - 0.09, 0));
  return g;
}

/* ============================================================
   كتيفة زخرفية (dougong) — صف قوائم تحت السقف
   ============================================================ */
export function createBracketRow({ length = 10, count = 9, material = null } = {}) {
  const M = getMaterials();
  const g = new THREE.Group();
  const mat = material || M.woodTrim;
  const arr = [];
  for (let i = 0; i < count; i++) {
    const x = ((i + 0.5) / count - 0.5) * length;
    arr.push({ x, y: 0.12, z: 0.1, sx: 1, sy: 1, sz: 1 });
  }
  const geo = new THREE.BoxGeometry(length / count * 0.55, 0.26, 0.3);
  g.add(instanced(geo, mat, arr));
  const goldArr = arr.map((a) => ({ ...a, y: -0.06, sx: 1.2, sy: 0.5, sz: 1.2 }));
  g.add(instanced(geo, M.goldDark, goldArr));
  return g;
}
