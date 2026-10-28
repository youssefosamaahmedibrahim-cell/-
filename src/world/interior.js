import * as THREE from 'three';
import { getMaterials } from '../lib/materials.js';
import { box, cyl, instanced, createLantern, createCrown, createChest, sprite, rand } from '../lib/shapes.js';
import { DIM } from './dims.js';

const FLOOR_Y = DIM.plinthH + 0.2;
const ROOM_W = 12.6;
const ROOM_D = 11.6;
const ROOM_H = 6.4;
const Z_BACK = DIM.frontZ - ROOM_D;

function shelfUnit(M, { width = 2.4, height = 4.2, shelves = 4, depth = 0.55, x = 0, z = 0, ry = 0 }) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = ry;

  // خلفية خشبية
  const back = box(width, height, 0.1, M.woodWall, 0, height / 2, -depth / 2);
  g.add(back);
  // أرفف
  for (let i = 0; i < shelves; i++) {
    const y = 0.55 + (i / (shelves - 1)) * (height - 1.1);
    g.add(box(width, 0.1, depth, M.woodTrim, 0, y, 0));
    g.add(box(width, 0.03, 0.04, M.neonSoft, 0, y + 0.07, depth / 2 + 0.01));
  }
  // إطار خشبي منحوت حول الرفوف.
  for (const sx of [-1, 1]) {
    g.add(box(0.16, height, depth, M.woodTrim, sx * width / 2, height / 2, 0));
    g.add(box(0.045, height - 0.15, 0.05, M.goldDark, sx * (width / 2 - 0.1), height / 2, depth / 2 + 0.03));
  }
  g.add(box(width + 0.18, 0.18, depth + 0.1, M.woodBeam, 0, height - 0.06, 0));
  g.add(box(width + 0.1, 0.045, 0.05, M.goldDark, 0, height - 0.13, depth / 2 + 0.05));

  // بضائع مضيئة
  const bottles = { gold: [], purple: [], cyan: [] };
  for (let i = 0; i < shelves; i++) {
    const y = 0.6 + (i / (shelves - 1)) * (height - 1.1);
    const count = 7;
    for (let j = 0; j < count; j++) {
      const bx = -width / 2 + 0.32 + (j / (count - 1)) * (width - 0.64);
      const kind = rand(0, 1) > 0.55 ? 'gold' : rand(0, 1) > 0.4 ? 'purple' : 'cyan';
      bottles[kind].push({ x: bx, y, z: rand(-0.05, 0.08), sy: rand(0.8, 1.5), ry: rand(0, 3) });
    }
  }
  const bodyGeo = new THREE.CylinderGeometry(0.095, 0.12, 0.25, 8);
  bodyGeo.translate(0, 0.125, 0);
  const neckGeo = new THREE.CylinderGeometry(0.045, 0.06, 0.1, 7);
  neckGeo.translate(0, 0.29, 0);
  const corkGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.055, 7);
  corkGeo.translate(0, 0.37, 0);
  const mk = (arr, mat) => {
    if (!arr.length) return;
    g.add(instanced(bodyGeo, mat, arr, { cast: false }));
    g.add(instanced(neckGeo, mat, arr, { cast: false }));
    g.add(instanced(corkGeo, M.goldDark, arr, { cast: false }));
  };
  mk(bottles.gold, M.potionGold);
  mk(bottles.purple, M.potion);
  mk(bottles.cyan, M.crystalBlue);

  // إضاءة رف خفيفة
  const gl = sprite(M.glowSpriteGold, 2.2, 0, height * 0.55, 0.4);
  gl.material.opacity = 0.16;
  g.add(gl);
  return g;
}

export function createInterior() {
  const M = getMaterials();
  const group = new THREE.Group();
  group.name = 'interior';

  /* ---------- الأرضية والسقف والجدران ---------- */
  const floor = box(ROOM_W, 0.16, ROOM_D, M.woodWall, 0, FLOOR_Y - 0.08, DIM.frontZ - ROOM_D / 2 + 0.2);
  floor.receiveShadow = true;
  group.add(floor);

  const rug = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 8.2), M.rug);
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, FLOOR_Y + 0.015, DIM.frontZ - 4.6);
  group.add(rug);

  const backWall = box(ROOM_W, ROOM_H, 0.3, M.woodWall, 0, FLOOR_Y + ROOM_H / 2, Z_BACK);
  group.add(backWall);
  for (const x of [-6, -2.3, 2.3, 6]) {
    group.add(box(0.2, ROOM_H, 0.24, M.woodBeam, x, FLOOR_Y + ROOM_H / 2, Z_BACK + 0.23));
    group.add(box(0.28, 0.14, 0.3, M.goldDark, x, FLOOR_Y + 0.28, Z_BACK + 0.23));
  }
  for (const y of [0.35, ROOM_H - 0.25]) {
    group.add(box(ROOM_W, 0.18, 0.2, M.woodBeam, 0, FLOOR_Y + y, Z_BACK + 0.24));
  }

  for (const sx of [-1, 1]) {
    const side = box(0.3, ROOM_H, ROOM_D, M.woodWall, sx * ROOM_W / 2, FLOOR_Y + ROOM_H / 2, DIM.frontZ - ROOM_D / 2);
    group.add(side);
  }
  const ceil = box(ROOM_W, 0.25, ROOM_D, M.woodBeam, 0, FLOOR_Y + ROOM_H, DIM.frontZ - ROOM_D / 2);
  group.add(ceil);

  // عوارض السقف
  for (let i = 0; i < 5; i++) {
    const z = DIM.frontZ - 1 - i * (ROOM_D / 5);
    group.add(box(ROOM_W, 0.24, 0.3, M.woodTrim, 0, FLOOR_Y + ROOM_H - 0.18, z));
  }

  /* ---------- أرفف على الجانبين والخلف ---------- */
  const s1 = shelfUnit(M, { width: 3.4, height: 4.4, shelves: 4, x: -4.4, z: Z_BACK + 1.0, ry: -0.15 });
  s1.position.y = FLOOR_Y;
  group.add(s1);
  const s2 = shelfUnit(M, { width: 3.4, height: 4.4, shelves: 4, x: 4.4, z: Z_BACK + 1.0, ry: 0.15 });
  s2.position.y = FLOOR_Y;
  group.add(s2);

  for (const sx of [-1, 1]) {
    const s = shelfUnit(M, { width: 4.6, height: 4.2, shelves: 3, x: sx * (ROOM_W / 2 - 0.55), z: DIM.frontZ - 3.4, ry: sx * Math.PI / 2 });
    s.position.y = FLOOR_Y;
    group.add(s);
  }

  /* ---------- طاولة/كاونتر في الخلف ---------- */
  const counter = new THREE.Group();
  const body = box(4.4, 1.25, 1.15, M.woodDark, 0, 0.63, 0);
  counter.add(body);
  counter.add(box(4.7, 0.16, 1.4, M.goldDark, 0, 1.32, 0));
  counter.add(box(4.4, 0.08, 0.06, M.neonRed, 0, 1.2, 0.6));
  // درج ذهبي
  for (let i = 0; i < 3; i++) {
    counter.add(box(1.1, 0.42, 0.08, M.goldDark, -1.4 + i * 1.4, 0.72, 0.6));
    counter.add(box(0.22, 0.08, 0.06, M.gold, -1.4 + i * 1.4, 0.72, 0.65));
  }
  const counterCrown = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), M.crownDecal);
  counterCrown.position.set(0, 0.7, 0.66);
  counter.add(counterCrown);
  counter.position.set(0, FLOOR_Y, Z_BACK + 1.6);
  group.add(counter);

  // كرة بلورية على الكاونتر
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 2), M.crystalBlue);
  orb.position.set(0, FLOOR_Y + 1.7, Z_BACK + 1.6);
  group.add(orb);
  const orbLight = new THREE.PointLight(0x7fb2ff, 6, 9, 2);
  orbLight.position.copy(orb.position);
  group.add(orbLight);
  const orbGlow = sprite(M.glowSprite, 3.2, 0, FLOOR_Y + 1.75, Z_BACK + 1.6);
  orbGlow.material.color.setHex(0x8ec2ff);
  group.add(orbGlow);

  /* ---------- تاج كبير على الجدار الخلفي ---------- */
  const crownBack = createCrown({ size: 2.1 });
  crownBack.position.set(0, FLOOR_Y + 4.25, Z_BACK + 0.42);
  group.add(crownBack);
  const crownGlow = sprite(M.glowSpriteGold, 5.5, 0, FLOOR_Y + 4.9, Z_BACK + 0.5);
  group.add(crownGlow);

  // لوحة مضيئة خلف التاج
  const emblemPanel = new THREE.Mesh(new THREE.CircleGeometry(1.85, 40), new THREE.MeshStandardMaterial({
    color: 0x2a0810, emissive: 0x5c0614, emissiveIntensity: 0.35, roughness: 0.65, metalness: 0.25,
  }));
  emblemPanel.position.set(0, FLOOR_Y + 4.9, Z_BACK + 0.2);
  group.add(emblemPanel);
  const emblemRing = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.055, 6, 44), M.goldDark);
  emblemRing.position.set(0, FLOOR_Y + 4.9, Z_BACK + 0.24);
  group.add(emblemRing);

  /* ---------- فوانيس داخلية على السقف ---------- */
  const lanterns = [];
  for (const [x, z] of [[-3.2, DIM.frontZ - 2.6], [3.2, DIM.frontZ - 2.6], [0, DIM.frontZ - 5.2]]) {
    const lan = createLantern({ scale: 1.1, light: false });
    lan.position.set(x, FLOOR_Y + ROOM_H - 1.5, z);
    group.add(lan);
    const chain = cyl(0.02, 0.02, 1.2, M.iron, 5);
    chain.position.set(x, FLOOR_Y + ROOM_H - 0.75, z);
    group.add(chain);
    lanterns.push(lan);
    const gl = sprite(M.glowSpriteGold, 3.6, x, FLOOR_Y + ROOM_H - 1.5, z);
    gl.material.opacity = 0.28;
    group.add(gl);
  }

  /* ---------- صناديق وكريستالات ---------- */
  const chest = createChest({ size: 1.0, open: true });
  chest.position.set(-3.4, FLOOR_Y, DIM.frontZ - 3.4);
  chest.rotation.y = 0.6;
  group.add(chest);

  const chest2 = createChest({ size: 0.85, open: false });
  chest2.position.set(3.8, FLOOR_Y, DIM.frontZ - 3.0);
  chest2.rotation.y = -0.8;
  group.add(chest2);

  // براميل
  for (const [x, z] of [[-4.9, DIM.frontZ - 6.4], [5.0, DIM.frontZ - 6.6]]) {
    const b = cyl(0.44, 0.5, 1.3, M.woodDark, 12);
    b.position.set(x, FLOOR_Y + 0.65, z);
    group.add(b);
    for (const y of [0.35, 0.95]) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.045, 5, 14), M.goldDark);
      r.rotation.x = Math.PI / 2;
      r.position.set(x, FLOOR_Y + y, z);
      group.add(r);
    }
  }

  /* ---------- إضاءة داخلية ---------- */
  const warm = new THREE.PointLight(0xffa25a, 75, 24, 2);
  warm.position.set(0, FLOOR_Y + 4.2, DIM.frontZ - 4.2);
  group.add(warm);

  const warm2 = new THREE.PointLight(0xff6a44, 30, 16, 2);
  warm2.position.set(0, FLOOR_Y + 2.4, Z_BACK + 2.4);
  group.add(warm2);

  // ضوء يخرج من الباب
  const spill = new THREE.PointLight(0xff8a4a, 30, 16, 2);
  spill.position.set(0, FLOOR_Y + 2.2, DIM.frontZ + 0.6);
  group.add(spill);

  const update = (t) => {
    lanterns.forEach((l, i) => {
      const f = l.userData.flicker;
      if (!f) return;
      f.glow.material.opacity = 0.5 + Math.sin(t * 6 + i * 2) * 0.12;
    });
    orb.rotation.y = t * 0.4;
    orb.position.y = FLOOR_Y + 1.7 + Math.sin(t * 1.4) * 0.06;
    orbGlow.position.y = orb.position.y + 0.05;
    orbLight.intensity = 6 + Math.sin(t * 2.2) * 1.6;
    crownBack.rotation.y = Math.sin(t * 0.4) * 0.16;
  };

  return { group, update };
}
