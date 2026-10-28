import * as THREE from 'three';
import { getMaterials } from '../lib/materials.js';
import {
  box, cyl, createRock, createPlant, createCrystalCluster, createChest,
  createLantern, createPillar, sprite, instanced, rand, shade,
} from '../lib/shapes.js';
import { DIM } from './dims.js';
import { mistTexture } from '../lib/textures.js';

/* ============================================================
   شلال أحمر متوهج
   ============================================================ */
const waterFragment = /* glsl */`
  varying vec2 vUv;
  uniform float uTime;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uSpeed;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i), b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    vec2 uv = vUv;
    float t = uTime * uSpeed;
    float n1 = noise(vec2(uv.x * 9.0, uv.y * 3.0 - t));
    float n2 = noise(vec2(uv.x * 26.0, uv.y * 9.0 - t * 1.9));
    float n3 = noise(vec2(uv.x * 60.0, uv.y * 22.0 - t * 3.1));
    float streak = n1 * 0.5 + n2 * 0.36 + n3 * 0.22;
    streak = smoothstep(0.34, 0.92, streak);
    vec3 col = mix(uColorA, uColorB, streak);
    col += vec3(1.0, 0.62, 0.55) * pow(streak, 4.0) * 0.85;
    float edge = smoothstep(0.0, 0.2, uv.x) * smoothstep(1.0, 0.8, uv.x);
    float topFade = smoothstep(0.0, 0.06, uv.y);
    float botFade = smoothstep(1.0, 0.82, uv.y);
    float a = streak * edge * topFade * (0.35 + botFade * 0.9);
    gl_FragColor = vec4(col, a * 0.62);
  }
`;

function makeWaterMaterial({ colorA = 0x2a0106, colorB = 0xe82a1e, speed = 0.6 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColorA: { value: new THREE.Color(colorA) },
      uColorB: { value: new THREE.Color(colorB) },
      uSpeed: { value: speed },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 p = position;
        p.z += sin(uv.y * 7.0 + uv.x * 3.0) * 0.06;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: waterFragment,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

const poolFragment = /* glsl */`
  varying vec2 vUv;
  uniform float uTime;
  void main(){
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    if (r > 1.0) discard;
    float rings = sin(r * 26.0 - uTime * 2.4) * 0.5 + 0.5;
    rings = pow(rings, 2.0) * smoothstep(1.0, 0.15, r);
    float glow = smoothstep(1.0, 0.0, r);
    vec3 col = mix(vec3(1.0, 0.18, 0.16), vec3(1.0, 0.62, 0.42), rings);
    float a = (glow * 0.55 + rings * 0.45) * 0.85;
    gl_FragColor = vec4(col, a);
  }
`;

export function createWaterfall() {
  const M = getMaterials();
  const group = new THREE.Group();

  /* ---------- الصخور ---------- */
  const rocks = [
    { x: -2.6, y: 1.0, z: 0.0, r: 3.2, s: 1.15 },
    { x: 2.9, y: 0.8, z: 0.6, r: 2.7, s: 1.0 },
    { x: -2.9, y: 3.6, z: -0.2, r: 2.7, s: 1.1 },
    { x: 2.7, y: 4.6, z: 0.2, r: 2.3, s: 1.0 },
    { x: -2.2, y: 6.6, z: -0.1, r: 2.4, s: 1.05 },
    { x: 2.4, y: 7.6, z: -0.4, r: 1.9, s: 0.9 },
    { x: -1.6, y: 8.9, z: 0.4, r: 1.7, s: 0.8 },
    { x: -4.2, y: 5.4, z: 2.2, r: 2.2, s: 0.95 },
    { x: 4.3, y: 6.0, z: 2.0, r: 2.0, s: 0.9 },
    { x: -3.6, y: 2.4, z: 3.2, r: 1.8, s: 0.8 },
    { x: 4.0, y: 3.0, z: 3.0, r: 1.7, s: 0.8 },
  ];
  for (const r of rocks) {
    const rock = createRock({ radius: r.r, detail: 2 });
    rock.position.set(r.x, r.y, r.z);
    rock.scale.set(r.s, r.s * 0.9, r.s * 0.85);
    rock.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
    group.add(rock);
  }
  // صخور صغيرة عند القاعدة
  for (let i = 0; i < 8; i++) {
    const r = createRock({ radius: rand(0.5, 1.2), detail: 1 });
    const a = rand(0, Math.PI * 2), d = rand(2.4, 4.6);
    r.position.set(Math.cos(a) * d, rand(0.1, 0.5), Math.sin(a) * d * 0.7 + 1);
    group.add(r);
  }

  /* ---------- الشلال ---------- */
  const waterGeo = new THREE.PlaneGeometry(2.6, 8.8, 30, 44);
  // نلوي الشريط عشان ينزل على وجه الصخر (مش لوح مسطح)
  {
    const pos = waterGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const v = (y + 4.4) / 8.8; // 0 تحت → 1 فوق
      const t = 1 - v;
      // يبرز لبرّه كل ما نزل
      pos.setZ(i, Math.pow(t, 1.5) * 0.95 + Math.sin(t * 6.0) * 0.05);
      // يضيق شوية في النص ويرجع يتّسع في الحوض
      const taper = 0.78 + 0.22 * v + 0.16 * Math.pow(t, 3);
      pos.setX(i, x * taper);
      // تموّج طبيعي
      pos.setY(i, y + Math.sin(v * Math.PI) * 0.05);
    }
    waterGeo.computeVertexNormals();
  }
  const waterMat = makeWaterMaterial();
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.position.set(0.1, 4.35, 2.15);
  group.add(water);

  // خلفية صخرية داكنة خلف الماء
  const wetBack = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 8.2),
    new THREE.MeshStandardMaterial({ color: 0x1a0b14, roughness: 0.18, metalness: 0.75 }),
  );
  wetBack.position.set(0.1, 4.3, 2.28);
  group.add(wetBack);

  const waterMat2 = makeWaterMaterial({ colorA: 0x2a0106, colorB: 0xd8402a, speed: 0.45 });
  const water2 = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 6.0, 8, 20), waterMat2);
  water2.position.set(-1.28, 3.3, 2.35);
  water2.rotation.set(-0.04, -0.24, 0.04);
  group.add(water2);
  const water3 = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 4.6, 8, 16), makeWaterMaterial({ speed: 0.5 }));
  water3.position.set(1.15, 2.6, 2.55);
  water3.rotation.set(-0.03, 0.3, -0.03);
  group.add(water3);

  /* ---------- الحوض ---------- */
  const pool = new THREE.Mesh(new THREE.CircleGeometry(4.4, 48), new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: poolFragment,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(0.1, 0.09, 3.4);
  group.add(pool);

  // قاعدة حجرية للحوض
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(3.9, 3.7, 0.3, 32), M.stoneDark);
  basin.position.set(0.1, 0.05, 3.4);
  basin.receiveShadow = true;
  group.add(basin);

  // رذاذ
  const mist = [];
  for (let i = 0; i < 7; i++) {
    const s = sprite(M.glowSprite, rand(2.4, 5), rand(-1.6, 1.8), rand(0.3, 0.9), 3.3 + rand(-0.8, 0.8));
    s.material.color.setHex(0xff5a3a);
    s.material.opacity = rand(0.05, 0.1);
    group.add(s);
    mist.push(s);
  }

  // كريستالات عند حوض الشلال
  for (const [dx, dz, sz] of [[2.6, 2.4, 0.9], [-2.8, 2.0, 0.7], [1.2, 4.2, 0.6]]) {
    const cr = createCrystalCluster({ count: 4, size: sz, material: M.crystalRed });
    cr.position.set(dx, 0.1, dz);
    group.add(cr);
  }

  // ضوء أحمر داخل الشلال
  const wl = new THREE.PointLight(0xff2a3a, 55, 26, 2);
  wl.position.set(0.2, 4.2, 3.4);
  group.add(wl);

  group.position.set(-18.4, 0.25, 7.6);
  group.rotation.y = 0.5;
  group.scale.setScalar(1.08);

  const update = (t) => {
    waterMat.uniforms.uTime.value = t;
    waterMat2.uniforms.uTime.value = t;
    water3.material.uniforms.uTime.value = t;
    pool.material.uniforms.uTime.value = t;
    wl.intensity = 42 + Math.sin(t * 2.1) * 6;
    mist.forEach((m, i) => {
      m.position.y = 0.5 + Math.sin(t * 0.7 + i) * 0.18;
      m.material.opacity = 0.06 + Math.sin(t * 1.3 + i * 1.7) * 0.03 + 0.03;
    });
  };

  return { group, update };
}

/* ============================================================
   فوق الأرض: أرضية، برك ضوء، ديكور
   ============================================================ */
export function createSurroundings() {
  const M = getMaterials();
  const group = new THREE.Group();
  const updaters = [];

  /* ---------- الأرضية ---------- */
  const groundGeo = new THREE.CircleGeometry(340, 96);
  const ground = new THREE.Mesh(groundGeo, M.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  group.add(ground);

  // حلقات أرضية متوهجة حول المبنى (كأنها أرض مبللة تعكس النيون)
  const glowMat = new THREE.MeshBasicMaterial({
    map: M._textures.glowMap, color: 0xff2f45, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.3,
  });
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(46, 34), glowMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(0, 0.03, 2);
  group.add(ring);

  const glowMat2 = glowMat.clone();
  glowMat2.color.setHex(0xff8a3a);
  glowMat2.opacity = 0.22;
  const porchLight = new THREE.Mesh(new THREE.PlaneGeometry(16, 14), glowMat2);
  porchLight.rotation.x = -Math.PI / 2;
  porchLight.position.set(0, 0.05, 11);
  group.add(porchLight);

  // بركة ماء سوداء لامعة أمام المتجر
  const puddleMat = new THREE.MeshStandardMaterial({ color: 0x0a0810, roughness: 0.06, metalness: 0.95, envMapIntensity: 1.4 });
  for (const [x, z, r, sx] of [[-4, 12.5, 3.2, 1.5], [6.5, 14, 2.4, 1.3], [1.5, 18, 2.0, 1.6]]) {
    const p = new THREE.Mesh(new THREE.CircleGeometry(r, 28), puddleMat);
    p.rotation.x = -Math.PI / 2;
    p.scale.x = sx;
    p.position.set(x, 0.02, z);
    group.add(p);
  }

  /* ---------- أعمدة فوانيس على الساحة ---------- */
  for (const [x, z, h] of [[-13, 12.5, 4.2], [13.5, 13, 4.4], [-15.5, 20, 4.8], [15.5, 21, 4.6], [-24, 6, 4.0], [24, 7, 4.2]]) {
    const post = createPillar({ h, r: 0.24, rings: 2 });
    post.position.set(x, 0, z);
    group.add(post);
    const arm = box(1.1, 0.12, 0.12, M.woodTrim, x + (x > 0 ? -0.5 : 0.5), h - 0.2, z);
    group.add(arm);
    const lan = createLantern({ scale: 1.0 });
    lan.position.set(x + (x > 0 ? -0.95 : 0.95), h - 0.75, z);
    group.add(lan);
    const gl = sprite(M.glowSpriteGold, 3.4, lan.position.x, lan.position.y, z);
    gl.material.opacity = 0.22;
    group.add(gl);
    updaters.push(lan);
  }

  /* ---------- تعليق فوانيس على حبال بين الأعمدة ---------- */
  for (const sx of [-1, 1]) {
    const p1 = new THREE.Vector3(sx * 13, 3.9, 12.7);
    const p2 = new THREE.Vector3(sx * 24, 3.6, 7);
    const curve = new THREE.CatmullRomCurve3([p1, p1.clone().lerp(p2, 0.5).setY(3.1), p2]);
    const rope = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.02, 4, false), M.iron);
    group.add(rope);
    for (let i = 1; i < 5; i++) {
      const p = curve.getPoint(i / 5);
      const lan = createLantern({ scale: 0.55 + rand(0, 0.15) });
      lan.position.copy(p).setY(p.y - 0.7);
      group.add(lan);
      updaters.push(lan);
    }
  }

  /* ---------- ديكور: صناديق وبراميل وكريستالات ---------- */
  const deco = new THREE.Group();
  // صناديق خشبية على اليسار
  for (let i = 0; i < 4; i++) {
    const b = box(rand(0.8, 1.1), rand(0.7, 1.0), rand(0.8, 1.1), M.woodDark, -20 + i * 1.35, 0.45, 13 + rand(-0.4, 0.4));
    b.rotation.y = rand(-0.3, 0.3);
    deco.add(b);
    deco.add(box(1.12, 0.08, 0.08, M.goldDark, b.position.x, 0.85, b.position.z));
  }
  // براميل
  for (const [x, z] of [[19, 11], [20.4, 12.2], [-21, 5], [21, 3.5]]) {
    const b = cyl(0.55, 0.62, 1.5, M.woodDark, 12);
    b.position.set(x, 0.75, z);
    deco.add(b);
    for (const y of [0.3, 1.2]) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.05, 5, 14), M.goldDark);
      r.rotation.x = Math.PI / 2;
      r.position.set(x, y, z);
      deco.add(r);
    }
  }
  // صناديق كنز
  for (const [x, z, s, ry] of [[-11.5, 10.5, 1.0, 0.5], [12.5, 15.5, 0.85, -0.9]]) {
    const c = createChest({ size: s, open: true });
    c.position.set(x, 0, z);
    c.rotation.y = ry;
    deco.add(c);
  }
  // كريستالات على الأرض
  for (const [x, z, size, mat] of [[-19, 16, 1.3, M.crystalRed], [18, 17, 1.1, M.crystalBlue], [22, 9, 0.9, M.crystalRed], [-22, 10, 0.8, M.crystalBlue]]) {
    const c = createCrystalCluster({ count: 6, size, material: mat });
    c.position.set(x, 0, z);
    deco.add(c);
    updaters.push(c);
  }
  // نباتات
  for (const [x, z, s] of [[-9.5, 16, 1.1], [10, 19, 1.2], [-24, 15, 1.4], [25, 14, 1.3]]) {
    const p = createPlant({ size: s });
    p.position.set(x, 0, z);
    deco.add(p);
  }
  group.add(deco);

  /* ---------- أشجار الأرواح ---------- */
  const trees = [];
  for (const [x, z, scale] of [[-30, -6, 1.4], [31, -9, 1.5], [-26, -22, 1.25], [27, -24, 1.3], [-36, 12, 1.2], [34, 14, 1.25]]) {
    const tree = new THREE.Group();
    const trunkH = 7.2 * scale;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * scale, 0.62 * scale, trunkH, 8), M.woodDark);
    trunk.position.y = trunkH / 2;
    tree.add(trunk);
    // جذور
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const root = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * scale, 0.3 * scale, 1.5 * scale, 5), M.woodDark);
      root.position.set(Math.cos(a) * 0.5 * scale, 0.3 * scale, Math.sin(a) * 0.5 * scale);
      root.rotation.set(Math.cos(a) * 0.9, 0, -Math.sin(a) * 0.9);
      tree.add(root);
    }
    // أغصان رفيعة + عناقيد أوراق صغيرة
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + rand(-0.4, 0.4);
      const len = rand(2.6, 4.6) * scale;
      const yBase = trunkH * rand(0.55, 0.92);
      const p0 = new THREE.Vector3(0, yBase, 0);
      const p1 = new THREE.Vector3(Math.cos(a) * len * 0.45, yBase + len * 0.28, Math.sin(a) * len * 0.45);
      const p2 = new THREE.Vector3(Math.cos(a + 0.2) * len * 0.95, yBase + len * 0.5, Math.sin(a + 0.2) * len * 0.95);
      const branch = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([p0, p1, p2]), 8, 0.09 * scale, 5, false), M.woodDark);
      tree.add(branch);
      for (let j = 0; j < 4; j++) {
        const t = 0.55 + j * 0.14;
        const pos = p1.clone().lerp(p2, t);
        const leafMat = new THREE.MeshStandardMaterial({
          color: 0x2a0810, emissive: 0x8a0a1e, emissiveIntensity: rand(0.5, 1.2), roughness: 0.8, flatShading: true,
        });
        const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.24, 0.5) * scale, 0), leafMat);
        leaf.position.copy(pos).add(new THREE.Vector3(rand(-0.3, 0.3), rand(-0.2, 0.3), rand(-0.3, 0.3)));
        leaf.scale.set(1.5, 0.6, 1.5);
        tree.add(leaf);
      }
    }
    tree.position.set(x, 0, z);
    tree.rotation.y = rand(0, 6);
    group.add(tree);
    trees.push(tree);
    const gl = sprite(M.glowSprite, 12 * scale, x, trunkH * 0.7, z);
    gl.material.opacity = 0.12;
    group.add(gl);
  }

  /* ---------- المدينة البعيدة (سيلويت ضبابي) ---------- */
  const far = new THREE.Group();
  const farMat = new THREE.MeshStandardMaterial({ color: 0x171021, roughness: 1, metalness: 0.1 });
  const farRows = [
    [-190, -190, 30, 34, 28], [-125, -215, 34, 44, 30], [-58, -235, 30, 36, 28],
    [16, -240, 36, 48, 32], [88, -222, 32, 40, 30], [160, -196, 30, 34, 28],
    [-250, -110, 36, 38, 36], [252, -118, 38, 42, 38],
    [-215, -40, 24, 26, 24], [218, -50, 26, 28, 24],
  ];
  for (const [x, z, w, hh, d] of farRows) {
    const b = box(w, hh, d, farMat, x, hh / 2, z);
    far.add(b);
    // سقف باجودا مقلّد
    const r = new THREE.Mesh(new THREE.ConeGeometry(w * 0.9, hh * 0.22, 4), farMat);
    r.position.set(x, hh + hh * 0.11, z);
    r.rotation.y = Math.PI / 4;
    far.add(r);
    // نوافذ مضيئة
    for (let j = 0; j < 6; j++) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.4), M.amberDim);
      win.position.set(x + rand(-w * 0.36, w * 0.36), rand(3, hh - 3), z + d / 2 + 0.05);
      far.add(win);
    }
    // أشرطة نيون
    const strip = new THREE.Mesh(new THREE.BoxGeometry(w * 0.95, 0.35, 0.35), M.neonSoft);
    strip.position.set(x, hh - 1.6, z + d / 2 + 0.25);
    far.add(strip);
  }
  group.add(far);

  /* ---------- ضباب الأفق (يلغي الحدّة بين الأرض والسماء) ---------- */
  const mistMap = new THREE.CanvasTexture(mistTexture({ size: 256 }));
  const mistMat = new THREE.MeshBasicMaterial({
    map: mistMap, color: 0x2a0a14, transparent: true, opacity: 0.65,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  for (const [size, y, op] of [[520, 2.0, 0.5], [320, 3.5, 0.42], [180, 5.0, 0.3]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size * 0.42), mistMat.clone());
    m.material.opacity = op;
    m.position.set(0, y, -40);
    group.add(m);
  }
  // ضباب أرضي دائري
  const groundMist = new THREE.Mesh(new THREE.CircleGeometry(330, 64), new THREE.MeshBasicMaterial({
    map: mistMap, color: 0x22080f, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  groundMist.rotation.x = -Math.PI / 2;
  groundMist.position.y = 0.12;
  group.add(groundMist);

  /* ---------- مشاعل أمام المتجر ---------- */
  for (const sx of [-1, 1]) {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 0.5, 10), M.stoneDark);
    base.position.set(sx * 13.5, 0.25, 17.5);
    group.add(base);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.3, 0.6, 12), M.goldDark);
    bowl.position.set(sx * 13.5, 0.8, 17.5);
    group.add(bowl);
    const fire = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 0), new THREE.MeshStandardMaterial({
      color: 0x661000, emissive: 0xff5a1a, emissiveIntensity: 3.2, roughness: 0.6,
    }));
    fire.position.set(sx * 13.5, 1.35, 17.5);
    group.add(fire);
    const fl = new THREE.PointLight(0xff7a2a, 26, 16, 2);
    fl.position.set(sx * 13.5, 2.2, 17.5);
    group.add(fl);
    const glow = sprite(M.glowSprite, 5, sx * 13.5, 1.5, 17.5);
    glow.material.color.setHex(0xff6a2a);
    glow.material.opacity = 0.4;
    group.add(glow);
    updaters.push({ userData: { fire, glow, light: fl, flicker: { glow }, pulse: null } });
  }

  shade(group, false, true);
  // خلي الشلال والصناديق تعمل ظلال
  group.traverse((o) => { if (o.isMesh && o.geometry && o.material === M.rock) o.castShadow = true; });

  const update = (t, dt) => {
    updaters.forEach((u) => {
      if (!u.userData) return;
      if (u.userData.fire) {
        const f = u.userData.fire;
        const k = 0.82 + Math.sin(t * 9 + f.position.x) * 0.1 + Math.sin(t * 23 + f.position.z) * 0.06;
        f.scale.set(k, 1.15 * k, k);
        u.userData.glow.material.opacity = 0.28 * k + 0.12;
        u.userData.light.intensity = 22 * k;
        return;
      }
      if (u.userData.flicker && u.userData.flicker.glow) u.userData.flicker.glow.material.opacity = 0.32 + Math.sin(t * 5 + u.position.x) * 0.08;
      if (u.userData.pulse) u.userData.pulse.glow.material.opacity = 0.55 + Math.sin(t * 2.2 + u.position.x) * 0.18;
    });
    trees.forEach((tr, i) => { tr.rotation.z = Math.sin(t * 0.35 + i) * 0.008; });
    ring.material.opacity = 0.26 + Math.sin(t * 1.1) * 0.04;
  };

  return { group, update };
}
