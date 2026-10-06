// ============================================================
// dragon.js — تنين إجرائي كامل (ميش + عظام + غشاء أجنحة بيتشوه)
// Infernal Dragon  •  Three.js
//
// اصطلاح العظام (نفس نظام روبلوكس بالظبط):
//    العظمة بتمتد على محور -Z (قدّام)، و +Y = فوق، و +X = يمين
//    → rx = رفع/خفض · ry = مسح يمين/شمال · rz = ميل (فرد الأجنحة)
// ============================================================
import * as THREE from 'three';

const COL = {
  body:     0x1e0a0e,
  bodyDark: 0x120608,
  belly:    0xc8964a,
  membrane: 0x7a141a,
  vein:     0xff5c14,
  horn:     0xe8ce96,
  claw:     0xf0ece0,
  spike:    0x421014,
  eye:      0xff921e,
};

const _m4 = new THREE.Matrix4();
const ZERO = new THREE.Vector3();
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const RIGHT_HINT = new THREE.Vector3(1, 0, 0);

export function makeMaterials() {
  const std = (color, opts = {}) => new THREE.MeshStandardMaterial({
    color, roughness: opts.rough ?? 0.55, metalness: opts.metal ?? 0.15,
    emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.ei ?? 1,
    flatShading: opts.flat ?? true, side: opts.side ?? THREE.FrontSide,
    transparent: opts.transparent ?? false, opacity: opts.opacity ?? 1,
  });
  return {
    body:     std(COL.body,     { rough: 0.48, metal: 0.22 }),
    bodyDark: std(COL.bodyDark, { rough: 0.5,  metal: 0.2 }),
    belly:    std(COL.belly,    { rough: 0.32, metal: 0.85 }),
    spike:    std(COL.spike,    { rough: 0.7,  metal: 0.1 }),
    horn:     std(COL.horn,     { rough: 0.28, metal: 0.35 }),
    claw:     std(COL.claw,     { rough: 0.2,  metal: 0.7 }),
    eye:      std(COL.eye,      { rough: 0.2, emissive: COL.eye, ei: 3.4, flat: false }),
    membrane: new THREE.MeshStandardMaterial({
      color: COL.membrane, roughness: 0.85, metalness: 0.05,
      side: THREE.DoubleSide, transparent: true, opacity: 0.95, flatShading: false,
    }),
    vein: new THREE.MeshStandardMaterial({
      color: COL.vein, emissive: COL.vein, emissiveIntensity: 2.6,
      roughness: 0.4, side: THREE.DoubleSide,
    }),
  };
}

// ------------------------------------------------------------
// أدوات بناء
// ------------------------------------------------------------
// أسطوانة مدببة من الأصل (0,0,0) لغاية -Z بطول len
function taperedBone(len, r0, r1, mat, segs = 10) {
  const geo = new THREE.CylinderGeometry(r1, r0, len, segs, 1);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, -len / 2);
  return new THREE.Mesh(geo, mat);
}

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

function cone(r, h, mat, segs = 6) {
  return new THREE.Mesh(new THREE.ConeGeometry(r, h, segs), mat);
}

function sphere(r, mat, segs = 14) {
  return new THREE.Mesh(new THREE.SphereGeometry(r, segs, Math.max(8, segs - 2)), mat);
}

// عظمة: مجموعتها عند المفصل وتمتد في اتجاه dir (على -Z)
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
const _pq = new THREE.Quaternion();
// dir / rightHint بييجوا بإحداثيات الموديل (العالم) وبنحوّلهم لإطار الأب
function bone(parent, bones, name, len, r0, r1, dir, mat, rightHint) {
  const g = new THREE.Group();
  g.name = name;
  if (dir) {
    parent.updateWorldMatrix(true, false);
    parent.getWorldQuaternion(_pq).invert();
    _z.copy(dir).normalize().applyQuaternion(_pq).negate();   // +Z = ضهر العظمة
    if (rightHint) {
      _x.copy(rightHint).applyQuaternion(_pq).addScaledVector(_z, -_z.dot(rightHint.clone().applyQuaternion(_pq)));
    } else {
      _x.set(0, 1, 0).applyQuaternion(_pq).cross(_z);          // نفس سلوك lookAt
    }
    if (_x.lengthSq() < 1e-8) { _x.set(1, 0, 0).addScaledVector(_z, -_z.x); }
    _x.normalize();
    _y.crossVectors(_z, _x);
    _m4.makeBasis(_x, _y, _z);
    g.quaternion.setFromRotationMatrix(_m4);
  }
  g.add(taperedBone(len, r0, r1, mat));
  g.userData.len = len;
  parent.add(g);
  bones[name] = g;
  return g;
}

function marker(parent, x, y, z) {
  const o = new THREE.Object3D();
  o.position.set(x, y, z);
  parent.add(o);
  return o;
}

// ------------------------------------------------------------
// الجناح
// ------------------------------------------------------------
function buildWing(side, parent, bones, M) {
  const s = side;                       // +1 يمين  /  -1 شمال
  const tag = s > 0 ? 'R' : 'L';

  const shoulder = bone(parent, bones, `Wing${tag}_Shoulder`, 1.0, 0.85, 0.7,
    new THREE.Vector3(s * 0.88, 0.28, -0.38), M.body);

  const upper = bone(shoulder, bones, `Wing${tag}_Upper`, 4.2, 0.55, 0.42,
    new THREE.Vector3(s * 0.86, 0.3, 0.4), M.body);
  upper.position.set(0, 0, -1.0);

  const fore = bone(upper, bones, `Wing${tag}_Fore`, 5.0, 0.42, 0.3,
    new THREE.Vector3(s * 0.9, 0.06, -0.42), M.body);
  fore.position.set(0, 0, -4.2);

  const fan = [-0.72, -0.18, 0.4];
  const lens = [5.6, 6.2, 5.0];
  const fingers = [];
  for (let i = 0; i < 3; i++) {
    const yaw = fan[i];
    const dir = new THREE.Vector3(s * Math.cos(yaw), -0.02, -Math.sin(yaw) * 0.95);
    const f = bone(fore, bones, `Wing${tag}_F${i + 1}`, lens[i], 0.22, 0.09, dir, M.body);
    f.position.set(0, 0, -5.0);
    fingers.push(f);
    // عرق متوهج فوق كل إصبع
    const v = taperedBone(lens[i], 0.07, 0.025, M.vein, 4);
    f.add(v);
  }

  // مخلب طرف الجناح
  const claw = cone(0.17, 1.0, M.claw, 5);
  claw.position.set(0, -0.16, -lens[1] * 0.9);
  claw.rotation.x = -Math.PI * 0.42;
  fingers[1].add(claw);

  // نقاط تثبيت الغشاء
  const wrist = marker(fore, 0, 0, -5.0);
  const elbow = marker(upper, 0, 0, -4.2);
  const shoulderPt = marker(shoulder, 0, 0, -0.25);
  // الإصبع 3 = أمامي (حدّام الجناح) .. الإصبع 1 = خلفي (الطرف المرتخي)
  const f3a = marker(fingers[2], 0, 0, -lens[2] * 0.5);
  const f3t = marker(fingers[2], 0, 0, -lens[2]);
  const f2t = marker(fingers[1], 0, 0, -lens[1]);
  const f1t = marker(fingers[0], 0, 0, -lens[0]);

  // محيط الغشاء (null = نقطة ترهل بتتحسب أوتوماتيك)
  const outline = [shoulderPt, elbow, wrist, f3a, f3t, null, null, f2t, null, null, f1t, null, null];
  const triCount = outline.length + 1;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(triCount * 9), 3));
  const membrane = new THREE.Mesh(geo, M.membrane);
  membrane.frustumCulled = false;
  parent.add(membrane);

  function update(hipPoint) {
    const pts = [];
    for (let i = 0; i < outline.length; i++) {
      const o = outline[i];
      if (o) {
        pts.push(o.getWorldPosition(new THREE.Vector3()));
      } else {
        const a = pts[pts.length - 1];
        let b = null;
        for (let j = i + 1; j < outline.length && !b; j++) {
          if (outline[j]) b = outline[j].getWorldPosition(new THREE.Vector3());
        }
        if (a && b) {
          const mid = a.clone().add(b).multiplyScalar(0.5);
          pts.push(mid.lerp(wrist.getWorldPosition(new THREE.Vector3()), 0.3));
        } else {
          pts.push(a ? a.clone() : new THREE.Vector3());
        }
      }
    }
    pts.push(hipPoint.getWorldPosition(new THREE.Vector3()));

    const w = wrist.getWorldPosition(new THREE.Vector3());
    const arr = geo.attributes.position.array;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const o = i * 9;
      arr[o] = w.x;     arr[o + 1] = w.y; arr[o + 2] = w.z;
      arr[o + 3] = a.x; arr[o + 4] = a.y; arr[o + 5] = a.z;
      arr[o + 6] = b.x; arr[o + 7] = b.y; arr[o + 8] = b.z;
    }
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
  }

  return { update, fingers, wrist, membrane };
}

// ------------------------------------------------------------
// رجل
// ------------------------------------------------------------
function buildLeg(tag, side, parent, bones, M, cfg) {
  const hip = bone(parent, bones, `Leg${tag}_Hip`, 0.6, 0.7, 0.6,
    new THREE.Vector3(side * 0.2, -1, 0.1), M.body, RIGHT_HINT);
  hip.position.set(cfg.x, cfg.y, cfg.z);

  const thigh = bone(hip, bones, `Leg${tag}_Thigh`, cfg.thigh, 0.55, 0.42,
    new THREE.Vector3(0.1 * side, -1, 0.12), M.body, RIGHT_HINT);
  thigh.position.set(0, 0, -0.6);

  const shin = bone(thigh, bones, `Leg${tag}_Shin`, cfg.shin, 0.42, 0.3,
    new THREE.Vector3(-0.05 * side, -1, -0.16), M.body, RIGHT_HINT);
  shin.position.set(0, 0, -cfg.thigh);

  const foot = bone(shin, bones, `Leg${tag}_Foot`, 1.2, 0.3, 0.22,
    new THREE.Vector3(0, -0.35, -0.95), M.bodyDark, RIGHT_HINT);
  foot.position.set(0, 0, -cfg.shin);

  // مخالب
  for (let i = -1; i <= 1; i++) {
    const c = cone(0.15, 0.7, M.claw, 5);
    c.position.set(i * 0.3, -0.34, -1.0);
    c.rotation.x = -1.15;
    foot.add(c);
  }
  // شوكة الكعب (إطار الرجل: +X يمين، +Y قدام، +Z فوق)
  const sp = cone(0.2, 0.8, M.spike, 5);
  sp.position.set(0, -0.35, 0.15);
  sp.rotation.x = 2.5;
  shin.add(sp);
}

// ------------------------------------------------------------
// التنين كله
// ------------------------------------------------------------
export function buildDragon() {
  const M = makeMaterials();
  const root = new THREE.Group();
  root.name = 'Dragon';
  const bones = {};

  // ---------- الجسم ----------
  const body = new THREE.Group();
  body.position.set(0, 6.0, 0.4);
  root.add(body);
  bones.Body = body;

  const chest = sphere(1.9, M.body);
  chest.scale.set(1.15, 1.05, 1.35);
  chest.position.set(0, 0.35, -1.6);
  body.add(chest);

  const torso = sphere(1.7, M.body);
  torso.scale.set(1.05, 1.0, 1.7);
  torso.position.set(0, 0, 1.2);
  body.add(torso);

  const belly = sphere(1.5, M.belly);
  belly.scale.set(0.85, 0.5, 1.55);
  belly.position.set(0, -1.0, 0.8);
  body.add(belly);

  for (let i = 0; i < 9; i++) {
    const h = 1.15 - Math.abs(i - 3) * 0.08;
    const sp = cone(0.28, h, M.spike, 5);
    sp.position.set(0, 1.5 + h * 0.35, -2.2 + i * 0.85);
    sp.rotation.x = -0.35;
    body.add(sp);
  }

  // ---------- الرقبة والرأس ----------
  const neck0 = bone(body, bones, 'Neck0', 2.3, 0.95, 0.8, new THREE.Vector3(0, 0.42, -1), M.body);
  neck0.position.set(0, 0.8, -2.9);
  const neck1 = bone(neck0, bones, 'Neck1', 2.1, 0.8, 0.66, new THREE.Vector3(0, 0.3, -1), M.body);
  neck1.position.set(0, 0, -2.3);

  const head = bone(neck1, bones, 'Head', 2.4, 0.66, 0.5, new THREE.Vector3(0, 0.2, -1), M.body);
  head.position.set(0, 0, -2.1);

  // خطم
  head.add(box(0.9, 0.8, 1.6, M.body, 0, -0.12, -2.0));
  const noseHorn = cone(0.18, 0.75, M.horn, 5);
  noseHorn.position.set(0, 0.28, -2.5);
  noseHorn.rotation.x = -0.45;
  head.add(noseHorn);

  // فك سفلي
  const jaw = bone(head, bones, 'Jaw', 1.9, 0.42, 0.28, new THREE.Vector3(0, -0.2, -1), M.bodyDark);
  jaw.position.set(0, -0.42, -0.55);

  // أسنان
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const t = cone(0.09, 0.45, M.claw, 4);
      t.position.set(sx * 0.34, -0.5, -1.15 - k * 0.5);
      t.rotation.x = Math.PI;                 // لأسفل
      head.add(t);
      const b = cone(0.09, 0.45, M.claw, 4);
      b.position.set(sx * 0.32, 0.24, -0.75 - k * 0.5);
      jaw.add(b);                              // لأعلى
    }
  }

  // قرون
  for (const sx of [-1, 1]) {
    const horn = cone(0.23, 2.7, M.horn, 6);
    horn.position.set(sx * 0.5, 0.8, -0.5);
    horn.rotation.set(0.95, 0, sx * 0.5);
    head.add(horn);
    const h2 = cone(0.14, 1.4, M.horn, 5);
    h2.position.set(sx * 0.75, 0.45, 0.15);
    h2.rotation.set(1.25, 0, sx * 0.9);
    head.add(h2);
  }

  // عيون
  for (const sx of [-1, 1]) {
    const e = sphere(0.2, M.eye, 12);
    e.position.set(sx * 0.52, 0.36, -1.2);
    head.add(e);
    const light = new THREE.PointLight(0xff8a1e, 7, 16, 2);
    light.position.set(sx * 0.52, 0.36, -1.35);
    head.add(light);
    // حاجب
    const brow = box(0.5, 0.16, 0.7, M.spike, sx * 0.52, 0.62, -1.2);
    brow.rotation.x = 0.25;
    head.add(brow);
  }

  // نقطة خروج النفس
  const mouth = new THREE.Object3D();
  mouth.position.set(0, -0.12, -2.7);
  head.add(mouth);

  // ---------- الذيل ----------
  const tailLens = [2.2, 2.1, 2.0, 1.8, 1.6, 1.4];
  let tailParent = body;
  let tailPos = new THREE.Vector3(0, 0.1, 2.9);
  for (let i = 0; i < 6; i++) {
    const t = bone(tailParent, bones, `Tail${i}`, tailLens[i], 0.85 - i * 0.11, 0.72 - i * 0.1,
      new THREE.Vector3(0, 0.06 + i * 0.03, 1), M.body);
    t.position.copy(tailPos);
    const sp = cone(0.18, 0.7, M.spike, 5);
    sp.position.set(0, tailLens[i] * 0.28, -tailLens[i] * 0.5);
    sp.rotation.x = -0.5;
    t.add(sp);
    tailParent = t;
    tailPos = new THREE.Vector3(0, 0, -tailLens[i]);
  }
  const fin = cone(0.95, 2.4, M.membrane, 4);
  fin.position.set(0, 0.55, -tailLens[5] - 0.7);
  fin.rotation.x = -1.45;
  fin.scale.set(0.32, 1, 1);
  tailParent.add(fin);

  // ---------- الأجنحة ----------
  const wingL = buildWing(-1, body, bones, M);
  const wingR = buildWing(1, body, bones, M);

  // ---------- الأرجل ----------
  buildLeg('FL', 1, body, bones, M,  { x:  1.35, y: -0.9, z: -1.5, thigh: 2.2, shin: 1.9 });
  buildLeg('FR', -1, body, bones, M, { x: -1.35, y: -0.9, z: -1.5, thigh: 2.2, shin: 1.9 });
  buildLeg('BL', 1, body, bones, M,  { x:  1.5,  y: -1.0, z:  2.2, thigh: 2.3, shin: 2.0 });
  buildLeg('BR', -1, body, bones, M, { x: -1.5,  y: -1.0, z:  2.2, thigh: 2.3, shin: 2.0 });

  // نقطة تثبيت الغشاء من الخلف
  const hipPt = new THREE.Object3D();
  hipPt.position.set(0, 0.4, 2.4);
  body.add(hipPt);

  // حفظ الأوضاع الأساسية
  for (const key in bones) {
    const b = bones[key];
    b.userData.baseQuat = b.quaternion.clone();
    b.userData.basePos = b.position.clone();
  }

  return {
    root, body, bones, mouth, hipPt,
    wings: { L: wingL, R: wingR },
    materials: M,
    update() {
      wingL.update(hipPt);
      wingR.update(hipPt);
    },
  };
}
