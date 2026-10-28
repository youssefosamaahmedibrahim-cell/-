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
      g.add(tubeFromPoints(pts.map((p) => p.clone().setY(p.y + 0.06)), 0.045, trimColor || M.neonRed, 24, false, 4));
    }
  }

  /* ---------- زخارف الأطراف الذهبية ---------- */
  if (finials) {
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const p = at(sx, sz);
      const finial = new THREE.Group();
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), M.gold);
      ball.position.y = 0.16;
      finial.add(ball);
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.62, 8), M.gold);
      spike.position.y = 0.62;
      finial.add(spike);
      const curl = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.045, 6, 14, Math.PI * 1.3), M.gold);
      curl.position.set(0, 0.95, 0);
      curl.rotation.set(Math.PI / 2, 0, Math.PI * 0.15);
      finial.add(curl);
      finial.position.copy(p);
      finial.position.y += 0.05;
      const glow = sprite(M.glowSpriteGold, 1.6, 0, 0.3, 0);
      finial.add(glow);
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
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 1.9), M.woodTrim);
      const r = Math.hypot(p.x, p.z) + 0.55;
      beam.position.set(out.x * r, p.y - thickness - 0.16, out.z * r);
      beam.rotation.y = Math.atan2(out.x, out.z);
      beam.rotation.x = -0.12;
      g.add(beam);
      const gold = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.07, 1.95), M.goldDark);
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
  const w = 1.5, h = 0.95, d = 1.05;

  const body = box(w, h, d, M.woodDark, 0, h / 2, 0);
  g.add(body);
  // ألواح ذهبية
  for (const sx of [-0.45, 0.45]) {
    const bandM = box(0.09, h + 0.02, d + 0.03, M.goldDark, sx * w * 0.5 * 1.4, h / 2, 0);
    g.add(bandM);
    const bandS = box(0.09, h + 0.02, d + 0.03, M.goldDark, sx * w * 0.5 * 0.2, h / 2, 0);
    g.add(bandS);
  }
  const foot = box(w + 0.08, 0.1, d + 0.08, M.goldDark, 0, 0.05, 0);
  g.add(foot);

  // الغطاء
  const lid = new THREE.Group();
  const lidGeo = new THREE.CylinderGeometry(d / 2, d / 2, w, 14, 1, false, Math.PI / 2, Math.PI);
  const lidMesh = new THREE.Mesh(lidGeo, M.woodDark);
  lidMesh.rotation.z = Math.PI / 2;
  lidMesh.position.y = 0;
  lid.add(lidMesh);
  const lidRimGeo = new THREE.TorusGeometry(d / 2, 0.05, 6, 18, Math.PI);
  for (const sx of [-1, 1]) {
    const r = new THREE.Mesh(lidRimGeo, M.goldDark);
    r.rotation.y = Math.PI / 2;
    r.position.set(sx * (w / 2 - 0.02), 0, 0);
    lid.add(r);
  }
  // أشرطة ذهبية على الغطاء
  for (const t of [-0.55, 0, 0.55]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(d / 2 + 0.01, 0.035, 5, 16, Math.PI), M.goldDark);
    band.rotation.y = Math.PI / 2;
    band.position.set(t * w * 0.5, 0, 0);
    lid.add(band);
  }
  lid.position.y = h;
  if (open) lid.rotation.x = -1.15;
  g.add(lid);

  // القفل
  const lock = box(0.24, 0.3, 0.06, M.gold, 0, h * 0.72, d / 2 + 0.02);
  g.add(lock);

  if (open) {
    const innerGlow = box(w * 0.85, 0.02, d * 0.75, M.amberDim, 0, h - 0.02, 0);
    g.add(innerGlow);
    if (withLight) {
      const light = new THREE.PointLight(glowColor, 5, 7, 2);
      light.position.set(0, h + 0.4, 0);
      g.add(light);
    }
    const glow = sprite(M.glowSpriteGold, 3.2, 0, h + 0.2, 0);
    glow.material.opacity = 0.5;
    g.add(glow);
    // كنز صغير
    for (let i = 0; i < 5; i++) {
      const c = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), M.gold);
      c.position.set(rand(-0.5, 0.5), h + 0.03, rand(-0.3, 0.3));
      c.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
      g.add(c);
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
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.34, 0.5, 10), M.woodTrim);
    p.position.y = 0.25;
    g.add(p);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.05, 5, 12), M.goldDark);
    rim.position.y = 0.5;
    rim.rotation.x = Math.PI / 2;
    g.add(rim);
    const soil = new THREE.Mesh(new THREE.CircleGeometry(0.4, 12), M.rock);
    soil.rotation.x = -Math.PI / 2;
    soil.position.y = 0.5;
    g.add(soil);
  }
  const leaves = 9;
  for (let i = 0; i < leaves; i++) {
    const a = (i / leaves) * Math.PI * 2 + rand(-0.2, 0.2);
    const h = rand(0.7, 1.5) * size;
    const geo = new THREE.ConeGeometry(rand(0.1, 0.18) * size, h, 4, 1);
    geo.translate(0, h / 2, 0);
    const leaf = new THREE.Mesh(geo, i % 3 === 0 ? M.leafTeal : M.leafDark);
    leaf.position.set(Math.cos(a) * 0.15, 0.5, Math.sin(a) * 0.15);
    leaf.rotation.set(Math.cos(a) * rand(0.35, 0.75), a, Math.sin(a) * rand(0.35, 0.75));
    leaf.scale.z = 0.45;
    g.add(leaf);
  }
  // زهور حمراء
  for (let i = 0; i < 3; i++) {
    const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), M.flowerRed);
    f.position.set(rand(-0.35, 0.35), 0.65 + rand(0, 0.3), rand(-0.35, 0.35));
    g.add(f);
  }
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
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r, h, 12), M.woodBeam);
  body.position.y = h / 2;
  body.castShadow = true; body.receiveShadow = true;
  g.add(body);
  for (let i = 0; i < rings; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.99, 0.055, 6, 16), M.goldDark);
    ring.position.y = (h / (rings + 1)) * (i + 1);
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
  }
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.3, r * 1.05, 0.22, 12), M.goldDark);
  cap.position.y = 0.11;
  g.add(cap);
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
