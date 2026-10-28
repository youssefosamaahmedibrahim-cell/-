import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

import { createWorld, VIEWS } from './world/buildWorld.js';
import { Ambience } from './audio.js';

/* textures.js بيستخدم المصنع ده في المتصفح */
globalThis.__canvasFactory = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
};

const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const isTouch = matchMedia('(hover: none)').matches;
const isMobile = isTouch && Math.min(innerWidth, innerHeight) < 820;

/* ============================================================
   الرسم الأساسي
   ============================================================ */
const canvas = $('#scene');

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
}

if (!webglAvailable()) {
  document.body.classList.add('no-webgl', 'is-ready');
  const l = document.getElementById('loader');
  if (l) l.remove();
  const msg = document.createElement('div');
  msg.className = 'no-webgl-msg';
  msg.innerHTML = '<h2>متصفحك لا يدعم WebGL</h2><p>المتجر ثلاثي الأبعاد محتاج متصفح حديث (Chrome / Edge / Safari / Firefox) وتفعيل تسريع الرسوميات.</p>';
  document.body.appendChild(msg);
  throw new Error('WebGL not available');
}

const renderer = new THREE.WebGLRenderer({
  canvas, antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false,
});
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, isMobile ? 1.35 : 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(VIEWS.hero.fov, innerWidth / innerHeight, 0.1, 500);
camera.position.set(48, 32, 66);

/* ============================================================
   العالم
   ============================================================ */
const world = createWorld(renderer);

/* ============================================================
   ما بعد المعالجة
   ============================================================ */
let composer = null;
try {
  composer = new EffectComposer(
    renderer,
    new THREE.WebGLRenderTarget(innerWidth, innerHeight, {
      type: THREE.HalfFloatType,
      samples: isMobile ? 0 : 4,
    }),
  );
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(innerWidth, innerHeight);
} catch (err) {
  console.warn('Post-processing غير مدعوم على هذا الجهاز، سيتم الرسم المباشر.', err);
  composer = null;
}

const renderPass = new RenderPass(world.scene, camera);
composer?.addPass(renderPass);

let bloom = null;
if (composer) {
  bloom = new UnrealBloomPass(
    new THREE.Vector2(innerWidth * 0.5, innerHeight * 0.5),
    isMobile ? 0.55 : 0.72,
    0.62,
    0.72,
  );
  composer.addPass(bloom);
}

const outputPass = new OutputPass();
composer?.addPass(outputPass);

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(innerWidth, innerHeight) },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec2 uRes;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv;
      vec2 d = uv - 0.5;
      float r2 = dot(d, d);
      vec2 off = d * r2 * 0.006;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + off).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - off).b;

      // تباين وتشبع
      col = (col - 0.5) * 1.07 + 0.5;
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(l), col, 1.1);
      col *= vec3(1.02, 0.995, 1.005);

      // فينييت
      float v = smoothstep(1.15, 0.3, length(d) * 1.32);
      col *= mix(0.42, 1.0, v);

      // حبيبات فيلم
      float g = hash(uv * uRes + fract(uTime) * 100.0);
      col += (g - 0.5) * 0.026;

      // توهج دافئ خفيف أسفل الصورة
      col += vec3(0.05, 0.012, 0.008) * smoothstep(0.75, 1.0, uv.y) * 0.5;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
const gradePass = new ShaderPass(GradeShader);
composer?.addPass(gradePass);

/* ============================================================
   التحكم بالكاميرا
   ============================================================ */
const controls = new OrbitControls(camera, canvas);
controls.target.set(...VIEWS.hero.target);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.rotateSpeed = 0.62;
controls.zoomSpeed = 0.85;
controls.panSpeed = 0.6;
controls.minDistance = 8;
controls.maxDistance = 92;
controls.minPolarAngle = 0.08;
controls.maxPolarAngle = Math.PI * 0.495;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.32;
controls.screenSpacePanning = false;
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

let spinWanted = true;
let idleTimer = null;
let userActive = false;

const onUserStart = () => {
  userActive = true;
  controls.autoRotate = false;
  document.body.classList.add('is-dragging');
  clearTimeout(idleTimer);
};
const onUserEnd = () => {
  userActive = false;
  document.body.classList.remove('is-dragging');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (spinWanted && !flight && !tour.active) controls.autoRotate = true;
  }, 9000);
};
controls.addEventListener('start', onUserStart);
controls.addEventListener('end', onUserEnd);

/* ---------- الانتقال بين الزوايا ---------- */
let flight = null;
const tmpTarget = new THREE.Vector3();

function setView(name, { dur = 1.9, immediate = false } = {}) {
  const v = VIEWS[name] || VIEWS.hero;
  stopTour();
  if (immediate) {
    camera.position.set(...v.pos);
    controls.target.set(...v.target);
    camera.fov = v.fov;
    camera.updateProjectionMatrix();
    controls.update();
    return;
  }
  flight = {
    t: 0, dur,
    fromPos: camera.position.clone(),
    toPos: new THREE.Vector3(...v.pos),
    fromTarget: controls.target.clone(),
    toTarget: new THREE.Vector3(...v.target),
    fromFov: camera.fov,
    toFov: v.fov,
  };
  controls.autoRotate = false;
  controls.enabled = false;
  setActiveChip(name);
}

function updateFlight(dt) {
  if (!flight) return;
  flight.t += dt;
  const k = easeInOut(clamp(flight.t / flight.dur, 0, 1));
  camera.position.lerpVectors(flight.fromPos, flight.toPos, k);
  tmpTarget.lerpVectors(flight.fromTarget, flight.toTarget, k);
  controls.target.copy(tmpTarget);
  camera.fov = flight.fromFov + (flight.toFov - flight.fromFov) * k;
  camera.updateProjectionMatrix();
  controls.update();
  if (flight.t >= flight.dur) {
    const done = flight.onDone;
    flight = null;
    controls.enabled = true;
    if (done) done();
    if (spinWanted && !tour.active) controls.autoRotate = true;
  }
}

function setActiveChip(name) {
  document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-active', c.dataset.view === name));
}

/* ============================================================
   الجولة السينمائية
   ============================================================ */
const tour = {
  active: false,
  step: 0,
  timer: 0,
  steps: [
    { view: 'hero', dur: 2.4, hold: 3.0 },
    { view: 'shopFront', dur: 2.6, hold: 3.2 },
    { view: 'closeup', dur: 2.2, hold: 2.8 },
    { view: 'side', dur: 2.8, hold: 3.0 },
    { view: 'roof', dur: 2.6, hold: 2.8 },
    { view: 'top', dur: 3.0, hold: 2.6 },
    { view: 'inside', dur: 3.4, hold: 4.2 },
    { view: 'hero', dur: 3.2, hold: 2.4 },
  ],
};

function startTour() {
  tour.active = true;
  tour.step = -1;
  tour.timer = 0;
  $('#btnTour').classList.add('is-on');
  nextTourStep();
  showToast('الجولة السينمائية بدأت — اسحب في أي وقت للتحكم');
}

function nextTourStep() {
  tour.step++;
  if (tour.step >= tour.steps.length) tour.step = 0;
  const s = tour.steps[tour.step];
  const v = VIEWS[s.view];
  flight = {
    t: 0, dur: s.dur,
    fromPos: camera.position.clone(),
    toPos: new THREE.Vector3(...v.pos),
    fromTarget: controls.target.clone(),
    toTarget: new THREE.Vector3(...v.target),
    fromFov: camera.fov,
    toFov: v.fov,
    onDone: () => { tour.timer = s.hold; },
  };
  controls.autoRotate = false;
  setActiveChip(s.view);
}

function stopTour() {
  if (!tour.active) return;
  tour.active = false;
  tour.timer = 0;
  $('#btnTour')?.classList.remove('is-on');
}

const updateTour = (dt) => {
  if (!tour.active) return;
  if (tour.timer > 0) {
    tour.timer -= dt;
    if (tour.timer <= 0) nextTourStep();
  }
};

/* ============================================================
   واجهة المستخدم
   ============================================================ */
const toastEl = $('#toast');
let toastTimer = null;
function showToast(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 2600);
}

const ambience = new Ambience();

function bindUI() {
  $('#btnTour')?.addEventListener('click', () => {
    if (tour.active) { stopTour(); showToast('تم إيقاف الجولة'); }
    else startTour();
  });
  $('#tourBtn2')?.addEventListener('click', () => startTour());

  const enter = () => {
    stopTour();
    setView('inside', { dur: 2.6 });
    showToast('مرحباً بك داخل المتجر السري');
    $('#btnEnter').classList.add('is-on');
    setTimeout(() => $('#btnEnter').classList.remove('is-on'), 2600);
  };
  $('#btnEnter')?.addEventListener('click', enter);
  $('#enterShop2')?.addEventListener('click', enter);

  $('#btnSpin')?.addEventListener('click', (e) => {
    spinWanted = !spinWanted;
    controls.autoRotate = spinWanted && !flight && !tour.active;
    e.currentTarget.classList.toggle('is-on', spinWanted);
    showToast(spinWanted ? 'الدوران التلقائي مفعّل' : 'الدوران التلقائي متوقف');
  });

  $('#btnReset')?.addEventListener('click', () => { setView('hero'); showToast('رجوع للزاوية الأمامية'); });

  $('#btnSound')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const on = await (async () => {
      const enabled = !ambience.enabled;
      if (enabled) await ambience.enable(); else ambience.disable();
      return enabled;
    })();
    btn.classList.toggle('is-on', on);
    showToast(on ? 'الصوت شغّال — استمتع بالجو' : 'تم كتم الصوت');
  });

  const infoCard = $('#infoCard');
  const openInfo = () => {
    infoCard?.classList.remove('is-hidden');
    if (window.innerWidth <= 900) document.body.classList.add('show-info');
  };
  const closeInfo = () => {
    infoCard?.classList.add('is-hidden');
    document.body.classList.remove('show-info');
  };
  $('#btnInfo')?.addEventListener('click', openInfo);
  $('#infoClose')?.addEventListener('click', closeInfo);

  // إغلاق بالضغط على الخلفية في الموبايل
  document.addEventListener('pointerdown', (e) => {
    if (document.body.classList.contains('show-info') && !e.target.closest('#infoCard') && !e.target.closest('#btnInfo')) {
      closeInfo();
    }
  }, { passive: true });

  $('#btnFull')?.addEventListener('click', () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  });

  document.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => { setView(chip.dataset.view); });
  });

  // اختصارات لوحة المفاتيح
  addEventListener('keydown', (e) => {
    const keys = { '1': 'hero', '2': 'front', '3': 'side', '4': 'roof', '5': 'inside', '6': 'top' };
    if (keys[e.key]) setView(keys[e.key]);
    if (e.key === 'r' || e.key === 'R') setView('hero');
    if (e.key === 'f' || e.key === 'F') $('#btnFull').click();
    if (e.key === ' ') { e.preventDefault(); $('#btnSpin').click(); }
    if (e.key === 't' || e.key === 'T') $('#btnTour').click();
    if (e.key === 'h' || e.key === 'H') {
      const on = document.body.classList.toggle('is-cinema');
      showToast(on ? 'وضع السينما — اضغط H للرجوع' : 'رجعت الواجهة');
    }
  });

  // إخفاء تلميح السحب بعد أول تفاعل
  controls.addEventListener('start', () => { $('#hint')?.style.setProperty('opacity', '0.15'); }, { once: true });
}

/* ============================================================
   الحلقة الرئيسية
   ============================================================ */
const clock = new THREE.Clock();
let elapsed = 0;
let renderFrames = 0;
let onFirstFrames = null;
let fpsAccum = 0;
let fpsFrames = 0;
let qualityChecked = false;

/* تخفيض تلقائي للجودة لو الجهاز بطيء */
function adaptQuality(dt) {
  if (qualityChecked) return;
  fpsAccum += dt;
  fpsFrames++;
  if (fpsAccum < 3.5) return;
  const fps = fpsFrames / fpsAccum;
  qualityChecked = true;
  if (fps < 34) {
    renderer.setPixelRatio(1);
    composer?.setPixelRatio(1);
    onResize();
    if (bloom) bloom.strength = 0.5;
    renderer.shadowMap.enabled = false;
    world.scene.traverse((o) => { if (o.isLight && o.shadow) o.shadow.map = null; });
  } else if (fps < 48) {
    renderer.setPixelRatio(Math.min(1.2, renderer.getPixelRatio()));
    composer?.setPixelRatio(renderer.getPixelRatio());
    onResize();
    if (bloom) bloom.strength = 0.6;
  }
}

function onResize() {
  const w = innerWidth, h = innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer?.setSize(w, h);
  bloom?.setSize(w * 0.5, h * 0.5);
  if (gradePass) gradePass.uniforms.uRes.value.set(w, h);
}
addEventListener('resize', onResize);

function tick() {
  requestAnimationFrame(tick);
  if (document.hidden) return;
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;

  adaptQuality(dt);
  updateFlight(dt);
  updateTour(dt);
  if (!flight) controls.update();

  world.update(elapsed, dt);

  if (composer) {
    if (gradePass) gradePass.uniforms.uTime.value = elapsed;
    composer.render();
  } else {
    renderer.render(world.scene, camera);
  }
  renderFrames++;
  if (renderFrames === 3 && onFirstFrames) {
    const cb = onFirstFrames;
    onFirstFrames = null;
    cb();
  }
}

/* ============================================================
   البداية
   ============================================================ */
function fatal(message, err) {
  console.error(message, err);
  const l = document.getElementById('loader');
  if (l) l.remove();
  document.body.classList.add('is-ready');
  const box = document.createElement('div');
  box.className = 'no-webgl-msg';
  box.innerHTML = `<h2>حصلت مشكلة في تحميل المشهد</h2><p>${message}</p>`;
  document.body.appendChild(box);
}

async function boot() {
  bindUI();
  setView('hero', { immediate: true });
  camera.position.set(50, 34, 70);
  camera.fov = 52;
  camera.updateProjectionMatrix();
  controls.target.set(0, 9.2, 0);

  // ضبط أولي حسب الشاشة
  if (isMobile) {
    controls.minDistance = 14;
    $('#infoCard')?.classList.add('is-hidden');
  }

  // تجميع الشيدرز مسبقاً لو المتصفح بيدعم
  try {
    if (renderer.compileAsync) await renderer.compileAsync(world.scene, camera);
    else renderer.compile(world.scene, camera);
  } catch (err) { console.warn('compile skipped', err); }

  const firstFrames = new Promise((resolve) => { onFirstFrames = resolve; });
  tick();

  // استنى أول كام فريم بعد تجميع الشيدرز
  await Promise.race([firstFrames, new Promise((r) => setTimeout(r, 1600))]);

  // دخول سينمائي
  flight = {
    t: 0, dur: 3.2,
    fromPos: camera.position.clone(),
    toPos: new THREE.Vector3(...VIEWS.hero.pos),
    fromTarget: new THREE.Vector3(0, 9.2, 0),
    toTarget: new THREE.Vector3(...VIEWS.hero.target),
    fromFov: 52,
    toFov: VIEWS.hero.fov,
  };
  controls.autoRotate = false;

  setTimeout(() => {
    document.body.classList.add('is-ready');
    $('#loader')?.classList.add('is-hidden');
    setTimeout(() => $('#loader')?.remove(), 1400);
  }, 420);
}

boot().catch((err) => fatal('جرّب تحديث الصفحة أو متصفح أحدث يدعم WebGL.', err));

/* استعادة السياق لو الجهاز فقد الـ GPU */
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  showToast('تم فقدان تسريع الرسوميات… جارٍ الاستعادة');
}, false);
canvas.addEventListener('webglcontextrestored', () => {
  renderer.setSize(innerWidth, innerHeight);
  showToast('تم استعادة العرض');
}, false);

/* حفظ مرجع للتشخيص */
window.__shop = { scene, camera, renderer, composer, controls, world, VIEWS, setView };
