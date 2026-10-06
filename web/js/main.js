// ============================================================
// main.js — المشهد، التحكم، المهارات (Z X C V) والكول داون
// معاينة متصفح لنظام التنين — نفس أرقام نسخة Roblox في Config.lua
// ============================================================
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildDragon } from './dragon.js';
import { createAnimator } from './animator.js';
import { createVFX } from './vfx.js';

// ------------------------------------------------------------
// إعدادات المهارات (مطابقة لـ Config.lua)
// ------------------------------------------------------------
const ABILITIES = {
  Z: { name: 'نَفَسُ النّار', nameEn: 'Inferno Breath', icon: '🔥', cooldown: 9,
       action: 'FireBreath', range: 60, radius: 8.5, total: 165, ticks: 10, knock: 26, burn: 14 },
  X: { name: 'مَخَالِبُ العَاصِفَة', nameEn: 'Storm Claws', icon: '⚔️', cooldown: 12,
       action: 'ClawBarrage', radius: 10, total: 240, hits: 5, dash: 34, knock: 34 },
  C: { name: 'مَطَرُ النّيَازِك', nameEn: 'Meteor Rain', icon: '☄️', cooldown: 22,
       action: 'MeteorCast', count: 12, castRadius: 34, radius: 13, total: 95, knock: 62, burn: 18 },
  V: { name: 'عَاصِفَةُ الرَّعْد', nameEn: 'Thunder Storm', icon: '⚡', cooldown: 42,
       action: 'ThunderCast', count: 16, castRadius: 40, radius: 9, total: 70, stun: 0.85, knock: 40 },
};
const ORDER = ['Z', 'X', 'C', 'V'];

// ------------------------------------------------------------
// المشهد
// ------------------------------------------------------------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a0f12);
scene.fog = new THREE.FogExp2(0x2a1618, 0.0034);

const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.5, 3000);
camera.position.set(0, 22, 46);

// الإضاءة
const hemi = new THREE.HemisphereLight(0xffd0a0, 0x2a1a18, 0.55);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffb072, 2.1);
sun.position.set(-70, 60, -40);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 300;
const sc = 90;
sun.shadow.camera.left = -sc; sun.shadow.camera.right = sc;
sun.shadow.camera.top = sc; sun.shadow.camera.bottom = -sc;
sun.shadow.bias = -0.0012;
scene.add(sun);
const rim = new THREE.DirectionalLight(0x5588ff, 0.4);
rim.position.set(60, 30, 60);
scene.add(rim);

// الأرض
const groundMat = new THREE.MeshStandardMaterial({ color: 0x36281f, roughness: 0.95, metalness: 0.05 });
const ground = new THREE.Mesh(new THREE.CircleGeometry(190, 96), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// دوائر نيون + منصة
for (let i = 1; i <= 3; i++) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(15 + i * 13, 15.7 + i * 13, 96),
    new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(0.07, 1, 0.5 - i * 0.04),
      transparent: true, opacity: 0.55, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  scene.add(ring);
}
const pad = new THREE.Mesh(new THREE.CylinderGeometry(35, 36, 1.2, 64),
  new THREE.MeshStandardMaterial({ color: 0x46342c, roughness: 0.6, metalness: 0.5 }));
pad.position.y = 0.6;
pad.receiveShadow = true;
scene.add(pad);

// أعمدة
const pillarMat = new THREE.MeshStandardMaterial({ color: 0x40302c, roughness: 0.85, metalness: 0.1 });
for (let i = 0; i < 14; i++) {
  const a = (i / 14) * Math.PI * 2;
  const d = 118;
  const h = 26 + Math.random() * 34;
  const p = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 5.4, h, 8), pillarMat);
  p.position.set(Math.cos(a) * d, h / 2, Math.sin(a) * d);
  p.rotation.y = Math.random() * Math.PI;
  p.castShadow = true;
  scene.add(p);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, 0.7, 8),
    new THREE.MeshBasicMaterial({ color: 0xff6e1e }));
  cap.position.set(p.position.x, h + 0.4, p.position.z);
  scene.add(cap);
  const l = new THREE.PointLight(0xff7a26, 26, 70, 2);
  l.position.set(p.position.x, h + 1.5, p.position.z);
  scene.add(l);
}

// ------------------------------------------------------------
// التنين
// ------------------------------------------------------------
const dragon = buildDragon();
dragon.root.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
scene.add(dragon.root);
const animator = createAnimator(dragon);
const vfx = createVFX(scene, camera);

// نار النفس (ملزوقة في بؤ التنين)
const breath = vfx.createFireBreath(() => {
  const pos = dragon.mouth.getWorldPosition(new THREE.Vector3());
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(
    dragon.bones.Head.getWorldQuaternion(new THREE.Quaternion())).normalize();
  return { pos, dir };
});

// ------------------------------------------------------------
// الأعداء (دمى تجربة)
// ------------------------------------------------------------
const enemies = [];
function makeBarTexture(w, h, color) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = color; ctx.fillRect(0, 0, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function spawnEnemy(i) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x8c5a3c, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.1, 2.6, 6, 12), bodyMat);
  body.position.y = 2.4; body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.85, 14, 12),
    new THREE.MeshStandardMaterial({ color: 0xd8a074, roughness: 0.6 }));
  head.position.y = 4.6; head.castShadow = true;
  g.add(head);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 1.9, 4, 8), bodyMat);
    arm.position.set(s * 1.5, 2.7, 0);
    arm.rotation.z = s * 0.35;
    g.add(arm);
  }
  // شريط الصحة
  const bg = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeBarTexture(128, 16, '#3a0d0d'), depthTest: false }));
  bg.scale.set(5, 0.62, 1);
  bg.position.y = 6.2;
  bg.center.set(0.5, 0.5);
  g.add(bg);
  const fill = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeBarTexture(128, 16, '#ff5a2a'), depthTest: false }));
  fill.scale.set(4.7, 0.44, 1);
  fill.position.set(-2.35, 6.2, 0.01);
  fill.center.set(0, 0.5);
  g.add(fill);

  g.position.set(Math.cos(i / 6 * Math.PI * 2) * 30, 0, Math.sin(i / 6 * Math.PI * 2) * 30);
  scene.add(g);
  const e = { group: g, fill, hp: 4000, max: 4000, alive: true, hitFlash: 0, burn: 0, burnDps: 0, knock: new THREE.Vector3() };
  enemies.push(e);
  return e;
}
for (let i = 0; i < 6; i++) spawnEnemy(i);

function damageEnemy(e, amount, opts = {}) {
  if (!e.alive) return;
  e.hp -= amount;
  e.hitFlash = 0.18;
  const w = Math.max(0, e.hp / e.max) * 4.7;
  e.fill.scale.x = w;
  if (!opts.silent) {
    vfx.hitSpark(e.group.position.clone().setY(3), opts.color ?? 0xffecaa);
    showDamageNumber(e.group.position.clone().setY(5.4), amount, opts.crit);
  }
  if (opts.knock) {
    const dir = opts.dir ? opts.dir.clone().setY(0).normalize() : new THREE.Vector3(0, 0, 1);
    e.knock.addScaledVector(dir, opts.knock * 0.06).setY(Math.min(14, opts.knock * 0.22));
  }
  if (opts.burn) { e.burn = 4.5; e.burnDps = opts.burn; }
  if (e.hp <= 0) {
    e.alive = false;
    vfx.explosion(e.group.position.clone().setY(2), 6, { core: 0xffecaa, main: 0xff7a14 });
    e.group.visible = false;
    setTimeout(() => {
      const a = Math.random() * Math.PI * 2;
      e.group.position.set(Math.cos(a) * (20 + Math.random() * 30), 0, Math.sin(a) * (20 + Math.random() * 30));
      e.hp = e.max; e.alive = true; e.group.visible = true; e.fill.scale.x = 4.7;
      vfx.fadeRing(e.group.position, { color: 0xff7a14, maxR: 10, dur: 0.6 });
    }, 3500);
  }
}

// ------------------------------------------------------------
// واجهة: أرقام الضرر
// ------------------------------------------------------------
const dmgLayer = document.getElementById('damage-layer');
const _proj = new THREE.Vector3();
function showDamageNumber(worldPos, amount, crit) {
  _proj.copy(worldPos).project(camera);
  if (_proj.z > 1) return;
  const x = (_proj.x * 0.5 + 0.5) * innerWidth;
  const y = (-_proj.y * 0.5 + 0.5) * innerHeight;
  const d = document.createElement('div');
  d.className = 'dmg' + (crit ? ' crit' : '');
  d.textContent = Math.round(amount);
  d.style.left = x + 'px';
  d.style.top = y + 'px';
  dmgLayer.appendChild(d);
  setTimeout(() => d.remove(), 950);
}

// ------------------------------------------------------------
// واجهة المهارات
// ------------------------------------------------------------
const barEl = document.getElementById('bar');
const slots = {};
const cooldowns = { Z: 0, X: 0, C: 0, V: 0 };

ORDER.forEach(key => {
  const ab = ABILITIES[key];
  const el = document.createElement('div');
  el.className = 'slot';
  el.innerHTML = `
    <div class="cd" data-key="${key}"></div>
    <div class="icon">${ab.icon}</div>
    <div class="keycap">${key}</div>
    <div class="nm">${ab.name}</div>
    <div class="en">${ab.nameEn}</div>
    <div class="num"></div>`;
  barEl.appendChild(el);
  slots[key] = { el, cd: el.querySelector('.cd'), num: el.querySelector('.num') };

  // كليك (موبايل/ماوس)
  el.addEventListener('pointerdown', ev => { ev.stopPropagation(); cast(key); });
});

function updateHUD() {
  for (const key of ORDER) {
    const ab = ABILITIES[key];
    const left = cooldowns[key];
    const f = Math.max(0, Math.min(1, left / ab.cooldown));
    const deg = f * 360;
    slots[key].cd.style.background =
      `conic-gradient(rgba(6,6,10,.82) ${deg}deg, rgba(6,6,10,.28) ${deg}deg)`;
    slots[key].cd.style.opacity = left > 0 ? 1 : 0;
    slots[key].num.textContent = left > 0 ? (left >= 1 ? left.toFixed(0) : left.toFixed(1)) : '';
    slots[key].el.classList.toggle('ready', left <= 0);
  }
}

// ------------------------------------------------------------
// التحكم
// ------------------------------------------------------------
const keys = {};
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['Space'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  const k = e.code.replace('Key', '');
  if (ORDER.includes(k)) cast(k);
  if (k === 'E') doRoar();
  if (k === 'F') toggleFly();
});
addEventListener('keyup', e => { keys[e.code] = false; });

// كاميرا بالماوس
let camYaw = 0, camPitch = 0.32, camDist = 42;
let dragging = false, lastX = 0, lastY = 0;
canvas.addEventListener('pointerdown', e => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
addEventListener('pointerup', () => { dragging = false; });
addEventListener('pointermove', e => {
  if (!dragging) return;
  camYaw -= (e.clientX - lastX) * 0.005;
  camPitch = Math.max(-0.5, Math.min(1.35, camPitch + (e.clientY - lastY) * 0.004));
  lastX = e.clientX; lastY = e.clientY;
});
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  camDist = Math.max(16, Math.min(120, camDist + e.deltaY * 0.05));
}, { passive: false });

// ------------------------------------------------------------
// حالة التنين
// ------------------------------------------------------------
const state = {
  pos: new THREE.Vector3(0, 0, 0),
  yaw: 0,
  speed: 0,
  flying: false,
  height: 0,
  castLock: 0,
  awaken: 0,
  dashTime: 0,
  dashDir: new THREE.Vector3(0, 0, -1),
};

function toggleFly() {
  state.flying = !state.flying;
  if (state.flying) {
    state.height = Math.max(state.height, 14);
    vfx.flashLight(dragon.root.position.clone().add(new THREE.Vector3(0, 4, 0)), 0xff7a14, 160, 80, 0.5);
    vfx.fadeRing(dragon.root.position.clone().add(new THREE.Vector3(0, 0.2, 0)), { color: 0xff7a14, maxR: 18, dur: 0.7 });
  } else {
    vfx.footDust(dragon.root.position.clone().add(new THREE.Vector3(0, 1, 0)));
  }
  document.getElementById('flyState').textContent = state.flying ? 'طيران ✈' : 'أرض 🐾';
}

function doRoar() {
  if (animator.isPlaying()) return;
  animator.play('Roar');
}

// ------------------------------------------------------------
// المهارات
// ------------------------------------------------------------
function cast(key) {
  const ab = ABILITIES[key];
  if (!ab) return;
  if (cooldowns[key] > 0) { flashDenied(key); return; }
  if (animator.isPlaying()) { flashDenied(key); return; }
  cooldowns[key] = ab.cooldown;
  animator.play(ab.action);
  slots[key].el.classList.add('flash');
  setTimeout(() => slots[key].el.classList.remove('flash'), 260);
}

function flashDenied(key) {
  slots[key].el.classList.add('denied');
  setTimeout(() => slots[key].el.classList.remove('denied'), 300);
}

// أحداث الأنيميشن → الـ VFX + الضرر
const pending = [];
animator.onEvent((action, ev) => {
  const head = dragon.bones.Head.getWorldPosition(new THREE.Vector3());
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(
    dragon.root.getWorldQuaternion(new THREE.Quaternion())).setY(0).normalize();

  if (action === 'FireBreath') {
    if (ev === 'Cast') {
      breath.start();
      shake(0.6, 0.9);
      // ضرر متكرر
      startBreathDamage();
    } else if (ev === 'End') {
      breath.stop();
      stopBreathDamage();
    }
  }

  if (action === 'ClawBarrage') {
    if (ev === 'Dash') {
      state.dashDir.copy(fwd);
      state.dashTime = 0.85;
      vfx.dashTrail(() => dragon.root.position.clone().add(new THREE.Vector3(0, 4, 0)), 0.9);
      shake(0.7, 0.5);
    }
    if (ev.startsWith('Slash')) {
      const p = dragon.root.position.clone().addScaledVector(fwd, 9).setY(3.4);
      vfx.slash(p, Math.atan2(fwd.x, fwd.z) + Math.PI / 2, 13, 0xff461e);
      shake(0.5, 0.28);
      const crit = Math.random() < 0.12;
      const dmg = (ABILITIES.X.total / ABILITIES.X.hits) * (crit ? 1.5 : 1) * awakenMul();
      areaDamage(dragon.root.position.clone(), fwd, ABILITIES.X.radius, 16, dmg, { crit, knock: ABILITIES.X.knock });
    }
  }

  if (action === 'MeteorCast') {
    if (ev === 'Roar') {
      vfx.roarWave(head.clone().addScaledVector(fwd, 3), fwd, { color: 0xff8c1e, maxR: 30 });
      shake(0.9, 0.7);
    }
    if (ev === 'Summon') {
      const ab = ABILITIES.C;
      const center = dragon.root.position.clone().addScaledVector(fwd, 12);
      for (let i = 0; i < ab.count; i++) {
        const a = (i / ab.count) * Math.PI * 2 + Math.random();
        const d = Math.sqrt(Math.random()) * ab.castRadius;
        const target = new THREE.Vector3(center.x + Math.cos(a) * d, 0, center.z + Math.sin(a) * d);
        pending.push({
          t: (i / ab.count) * ab.count * 0.16,
          fn: () => {
            vfx.meteor(target, { radius: ab.radius, groundY: 0, dur: 0.95 });
            setTimeout(() => {
              const crit = Math.random() < 0.12;
              areaDamage(target.clone().setY(1), null, ab.radius * 1.15, 0,
                ab.total * (crit ? 1.5 : 1) * awakenMul(), { crit, knock: ab.knock, burn: ab.burn, radial: true });
              shake(0.8, 0.4);
            }, 960);
          },
        });
      }
    }
    if (ev === 'Slam') {
      vfx.explosion(dragon.root.position.clone().setY(1.5), 9, { core: 0xffecaa, main: 0xff7a14 });
      shake(1.0, 0.5);
    }
  }

  if (action === 'ThunderCast') {
    if (ev === 'Roar') {
      vfx.roarWave(head.clone().addScaledVector(fwd, 3), fwd, { color: 0x96d2ff, maxR: 34 });
      shake(1.1, 0.8);
    }
    if (ev === 'Awaken') {
      state.awaken = 12;
      vfx.aura(() => dragon.root.position.clone().add(new THREE.Vector3(0, 4, 0)), 12, 0xff8c1e);
      document.getElementById('awaken').style.display = 'block';
      setTimeout(() => document.getElementById('awaken').style.display = 'none', 12000);
    }
    if (ev === 'Bolts') {
      const ab = ABILITIES.V;
      const center = dragon.root.position.clone().addScaledVector(fwd, 10);
      for (let i = 0; i < ab.count; i++) {
        pending.push({
          t: (i / ab.count) * 2.2,
          fn: () => {
            const a = Math.random() * Math.PI * 2;
            const d = Math.sqrt(Math.random()) * ab.castRadius;
            const target = new THREE.Vector3(center.x + Math.cos(a) * d, 0, center.z + Math.sin(a) * d);
            const from = target.clone().add(new THREE.Vector3((Math.random() - 0.5) * 16, 120 + Math.random() * 40, (Math.random() - 0.5) * 16));
            vfx.lightning(from, target.clone().setY(0.5), { jitter: 4, impactRadius: ab.radius * 1.6 });
            const crit = Math.random() < 0.12;
            areaDamage(target.clone().setY(1), null, ab.radius * 1.2, 0,
              ab.total * (crit ? 1.5 : 1) * awakenMul(), { crit, knock: ab.knock, stun: ab.stun, radial: true, color: 0x96d2ff });
            if (i % 3 === 0) shake(0.55, 0.3);
          },
        });
      }
    }
  }

  if (ev === 'ActionEnd') { breath.stop(); stopBreathDamage(); }

  if (action === 'Roar' && ev === 'Roar') {
    vfx.roarWave(head.clone().addScaledVector(fwd, 3), fwd, { color: 0xff8c1e, maxR: 26 });
    shake(0.6, 0.5);
  }
});

function awakenMul() { return state.awaken > 0 ? 1.35 : 1; }

// ضرر في منطقة
function areaDamage(center, dir, radius, range, amount, opts = {}) {
  for (const e of enemies) {
    if (!e.alive) continue;
    const p = e.group.position.clone().setY(1.5);
    const to = p.clone().sub(center);
    const dist = to.length();
    if (dist > (opts.radial ? radius : Math.max(radius, range)) ) continue;
    if (dir && !opts.radial) {
      const ang = to.normalize().angleTo(dir);
      if (ang > Math.PI * 0.42) continue;
    }
    const d = opts.dirOverride || (opts.radial ? to.normalize() : dir.clone());
    damageEnemy(e, amount, { crit: opts.crit, knock: opts.knock, burn: opts.burn, dir: d, color: opts.color });
  }
}

// ضرر مستمر لنفَس النار
let breathTick = null;
function startBreathDamage() {
  stopBreathDamage();
  breathTick = setInterval(() => {
    const head = dragon.mouth.getWorldPosition(new THREE.Vector3());
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(
      dragon.bones.Head.getWorldQuaternion(new THREE.Quaternion())).normalize();
    const ab = ABILITIES.Z;
    const crit = Math.random() < 0.12;
    areaDamage(head, dir, ab.radius, ab.range,
      (ab.total / ab.ticks) * (crit ? 1.5 : 1) * awakenMul(), { crit, burn: ab.burn, knock: 4 });
    shake(0.25, 0.2);
  }, 150);
}
function stopBreathDamage() { if (breathTick) { clearInterval(breathTick); breathTick = null; } }

// ------------------------------------------------------------
// اهتزاز الكاميرا
// ------------------------------------------------------------
let shakeAmp = 0, shakeTime = 0, shakeDur = 0;
function shake(amp, dur) {
  shakeAmp = Math.max(shakeAmp, amp);
  shakeDur = Math.max(shakeDur, dur);
  shakeTime = Math.max(shakeTime, dur);
}

// ------------------------------------------------------------
// الحلقة الرئيسية
// ------------------------------------------------------------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.95, 0.62, 0.72);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const clock = new THREE.Clock();
let dustTimer = 0;
const tmpV = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;

  // ---------------- الحركة ----------------
  let mx = 0, mz = 0;
  if (keys['KeyW'] || keys['ArrowUp']) mz -= 1;
  if (keys['KeyS'] || keys['ArrowDown']) mz += 1;
  if (keys['KeyA'] || keys['ArrowLeft']) mx -= 1;
  if (keys['KeyD'] || keys['ArrowRight']) mx += 1;
  const input = new THREE.Vector3(mx, 0, mz);
  const sprint = keys['ShiftLeft'] || keys['ShiftRight'];

  if (input.lengthSq() > 0) {
    input.normalize();
    const camFwd = new THREE.Vector3(Math.sin(camYaw), 0, Math.cos(camYaw)); // من الهدف للكاميرا
    const camRight = new THREE.Vector3(camFwd.z, 0, -camFwd.x);
    const move = camFwd.clone().multiplyScalar(input.z).add(camRight.clone().multiplyScalar(input.x));
    const targetYaw = Math.atan2(move.x, move.z) + Math.PI;
    let d = targetYaw - state.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    state.yaw += d * Math.min(1, dt * 7);

    const speed = state.flying ? (sprint ? 46 : 30) : (sprint ? 20 : 9);
    state.pos.addScaledVector(move, speed * dt);
  }

  // الطيران: ارتفاع
  if (state.flying) {
    const up = (keys['Space'] ? 1 : 0) - ((keys['ControlLeft'] || keys['KeyQ']) ? 1 : 0);
    state.height = Math.max(0.5, Math.min(70, state.height + up * 26 * dt));
    if (!keys['Space'] && !keys['ControlLeft']) state.height += (16 - state.height) * dt * 0.35;
  } else {
    state.height += (0 - state.height) * Math.min(1, dt * 5);
  }
  state.pos.y = state.height;

  // اندفاع X
  if (state.dashTime > 0) {
    state.dashTime -= dt;
    state.pos.addScaledVector(state.dashDir, 34 * dt * 1.15);
  }

  // حدود الساحة
  const r = state.pos.length();
  if (r > 150) state.pos.multiplyScalar(150 / r);

  dragon.root.position.copy(state.pos);
  dragon.root.rotation.y = state.yaw;

  // ---------------- حالة الأنيميشن ----------------
  if (!animator.isPlaying()) {
    const moving = input.lengthSq() > 0;
    if (state.flying) animator.setState(moving ? 'Fly' : 'Glide');
    else if (moving) animator.setState(sprint ? 'Run' : 'Walk');
    else animator.setState('Idle');
  }
  animator.update(dt);
  dragon.update(dt, t);

  // غبار الأرض
  if (!state.flying && input.lengthSq() > 0) {
    dustTimer -= dt;
    if (dustTimer <= 0) {
      dustTimer = 0.24;
      vfx.footDust(state.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6, 0.4, (Math.random() - 0.5) * 6)));
    }
  }

  // ---------------- الكول داونات ----------------
  for (const k of ORDER) if (cooldowns[k] > 0) cooldowns[k] = Math.max(0, cooldowns[k] - dt);
  if (state.awaken > 0) state.awaken -= dt;
  updateHUD();

  // الأحداث المؤجلة (نيازك/صواعق)
  for (let i = pending.length - 1; i >= 0; i--) {
    pending[i].t -= dt;
    if (pending[i].t <= 0) { pending[i].fn(); pending.splice(i, 1); }
  }

  // حرق مستمر
  for (const e of enemies) {
    if (!e.alive) continue;
    if (e.burn > 0) {
      e.burn -= dt;
      if (Math.random() < dt * 2) {
        vfx.emit({ pos: e.group.position.clone().setY(2.5), count: 3, speed: [0.5, 3],
                   life: [0.4, 0.9], size: [1.6, 3], color: [new THREE.Color(0xffecaa), new THREE.Color(0x961808)],
                   gravity: 10, drag: 1 });
      }
      damageEnemy(e, e.burnDps * dt, { silent: true });
    }
    // طرد + جاذبية
    if (e.knock.lengthSq() > 0.0001) {
      e.group.position.addScaledVector(e.knock, dt * 12);
      e.knock.multiplyScalar(Math.max(0, 1 - dt * 4));
    }
    if (e.group.position.y > 0) e.group.position.y = Math.max(0, e.group.position.y - 26 * dt);
    // حدود الساحة
    const er = Math.hypot(e.group.position.x, e.group.position.z);
    if (er > 150) { e.group.position.x *= 150 / er; e.group.position.z *= 150 / er; }
    if (e.hitFlash > 0) {
      e.hitFlash -= dt;
      e.group.children[0].material.emissive?.setScalar(Math.max(0, e.hitFlash * 2));
    }
    e.group.lookAt(state.pos.x, e.group.position.y, state.pos.z);
  }

  // ---------------- الـ VFX ----------------
  breath.update(dt, ABILITIES.Z.range, ABILITIES.Z.radius);
  vfx.update(dt);

  // ---------------- الكاميرا ----------------
  const target = state.pos.clone().add(new THREE.Vector3(0, 7 + state.height * 0.25, 0));
  const offset = new THREE.Vector3(
    Math.sin(camYaw) * Math.cos(camPitch),
    Math.sin(camPitch),
    Math.cos(camYaw) * Math.cos(camPitch)).multiplyScalar(camDist);
  const desired = target.clone().add(offset);
  camera.position.lerp(desired, Math.min(1, dt * 4.5));
  camera.lookAt(target);

  if (shakeTime > 0) {
    shakeTime -= dt;
    const k = Math.max(0, shakeTime / Math.max(0.001, shakeDur));
    const a = shakeAmp * k * k;
    camera.position.x += (Math.random() - 0.5) * a * 3;
    camera.position.y += (Math.random() - 0.5) * a * 3;
    camera.position.z += (Math.random() - 0.5) * a * 3;
    if (shakeTime <= 0) { shakeAmp = 0; shakeDur = 0; }
  }

  // السماء وقت الألتميت
  const target2 = state.awaken > 0 ? 0.45 : 1.05;
  renderer.toneMappingExposure += (target2 - renderer.toneMappingExposure) * dt * 1.5;
  bloom.strength = 0.95 + (state.awaken > 0 ? 0.5 : 0) + (breath.active ? 0.35 : 0);

  composer.render();
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

document.getElementById('loading').style.display = 'none';

// للتجربة من الكونسول: DragonDemo.cast('Z') وهكذا
window.DragonDemo = { dragon, animator, vfx, state, enemies, cooldowns, cast, ABILITIES, camera, scene };

animate();
