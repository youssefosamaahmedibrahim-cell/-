import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createWorld, VIEWS } from './world/buildWorld.js';
import { getMaterials } from './lib/materials.js';
import { signTexture } from './lib/textures.js';
import { alphaBounds } from './lib/alphaBounds.js';

globalThis.__canvasFactory = (w, h) => {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
};

const $ = (selector) => document.querySelector(selector);
const canvas = $('#scene');
const isMobile = matchMedia('(hover: none)').matches && Math.min(innerWidth, innerHeight) < 820;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function showError(title, message) {
  $('#loader')?.remove();
  const element = document.createElement('div');
  element.className = 'no-webgl-msg';
  const heading = document.createElement('h2');
  const text = document.createElement('p');
  heading.textContent = title;
  text.textContent = message;
  element.append(heading, text);
  document.body.appendChild(element);
}

function webglAvailable() {
  try {
    const testCanvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (testCanvas.getContext('webgl2') || testCanvas.getContext('webgl')));
  } catch {
    return false;
  }
}

if (!webglAvailable()) {
  showError('متصفحك لا يدعم WebGL', 'افتح الصفحة بمتصفح حديث، وتأكد من تفعيل تسريع الرسوميات لعرض النموذج.');
  throw new Error('WebGL not available');
}

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance',
  stencil: false,
});
renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, isMobile ? 1.4 : 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.13;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const world = createWorld(renderer);
// خامة اللافتة تُرسم على Canvas؛ نحدّثها بعد تحميل خطها المحلي.
document.fonts?.load('400 64px "Shop Sign"').then(() => {
  const signMap = getMaterials()._textures.signMap;
  signMap.image = signTexture();
  signMap.needsUpdate = true;
}).catch((error) => console.warn('Sign font could not be loaded', error));
const camera = new THREE.PerspectiveCamera(VIEWS.hero.fov, innerWidth / innerHeight, 0.1, 250);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.rotateSpeed = 0.65;
controls.zoomSpeed = 0.8;
controls.panSpeed = 0.6;
controls.minDistance = 5;
controls.maxDistance = 95;
controls.minPolarAngle = 0.08;
controls.maxPolarAngle = Math.PI * 0.49;
controls.autoRotate = false;
controls.autoRotateSpeed = 0.45;
controls.screenSpacePanning = false;
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

let baseFov = VIEWS.hero.fov;
let flight = null;
let spinWanted = false;
let resumeTimer;
const easing = (t) => t < 0.5 ? 4 * t ** 3 : 1 - ((-2 * t + 2) ** 3) / 2;

// الحفاظ على ظهور المبنى كله في الشاشات العمودية، مع نفس الزاوية الأفقية.
function applyFov() {
  const aspect = innerWidth / innerHeight;
  const shortScreenFactor = innerHeight < 520 ? 1.12 : 1;
  const factor = Math.max(1, 0.88 / aspect) * shortScreenFactor;
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(baseFov) / 2) * factor));
  camera.updateProjectionMatrix();
}

function setActiveView(name) {
  document.querySelectorAll('.view-btn').forEach((button) => {
    const active = button.dataset.view === name;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function setView(name, { immediate = false } = {}) {
  const view = VIEWS[name] || VIEWS.hero;
  setActiveView(name);
  controls.autoRotate = false;
  clearTimeout(resumeTimer);
  if (immediate || reducedMotion) {
    flight = null;
    camera.position.set(...view.pos);
    controls.target.set(...view.target);
    baseFov = view.fov;
    applyFov();
    controls.update();
    controls.autoRotate = spinWanted && name !== 'inside';
    return;
  }
  flight = {
    time: 0,
    duration: 1.25,
    fromPosition: camera.position.clone(),
    toPosition: new THREE.Vector3(...view.pos),
    fromTarget: controls.target.clone(),
    toTarget: new THREE.Vector3(...view.target),
    fromFov: baseFov,
    toFov: view.fov,
    name,
  };
}

function updateFlight(dt) {
  if (!flight) return;
  flight.time += dt;
  const amount = easing(Math.min(flight.time / flight.duration, 1));
  camera.position.lerpVectors(flight.fromPosition, flight.toPosition, amount);
  controls.target.lerpVectors(flight.fromTarget, flight.toTarget, amount);
  baseFov = THREE.MathUtils.lerp(flight.fromFov, flight.toFov, amount);
  applyFov();
  if (flight.time >= flight.duration) {
    const viewName = flight.name;
    flight = null;
    controls.autoRotate = spinWanted && viewName !== 'inside';
  }
}

controls.addEventListener('start', () => {
  flight = null;
  controls.autoRotate = false;
  clearTimeout(resumeTimer);
  document.body.classList.add('is-dragging');
});
controls.addEventListener('end', () => {
  document.body.classList.remove('is-dragging');
  resumeTimer = setTimeout(() => { if (spinWanted && !flight) controls.autoRotate = true; }, 6000);
});

let toastTimer;
function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2400);
}

function downloadTransparentPng() {
  try {
    // الرسم مباشرة قبل الالتقاط يحفظ قناة الشفافية من غير خلفية الواجهة.
    renderer.render(world.scene, camera);
    const source = document.createElement('canvas');
    source.width = canvas.width;
    source.height = canvas.height;
    const context = source.getContext('2d', { willReadFrequently: true });
    context.drawImage(canvas, 0, 0);
    const pixels = context.getImageData(0, 0, source.width, source.height);
    const bounds = alphaBounds(pixels.data, source.width, source.height);
    let output = source;
    if (bounds) {
      const padding = Math.ceil(Math.max(bounds.right - bounds.left, bounds.bottom - bounds.top) * 0.035);
      const left = Math.max(0, bounds.left - padding);
      const top = Math.max(0, bounds.top - padding);
      const right = Math.min(source.width - 1, bounds.right + padding);
      const bottom = Math.min(source.height - 1, bounds.bottom + padding);
      output = document.createElement('canvas');
      output.width = right - left + 1;
      output.height = bottom - top + 1;
      output.getContext('2d').drawImage(source, left, top, output.width, output.height, 0, 0, output.width, output.height);
    }
    const link = document.createElement('a');
    link.download = 'secret-shop-transparent.png';
    link.href = output.toDataURL('image/png');
    link.click();
    showToast('تم حفظ الصورة بخلفية شفافة');
  } catch (error) {
    console.error('Could not save PNG', error);
    showToast('تعذّر حفظ الصورة، جرّب متصفحاً آخر');
  }
}

function bindUI() {
  document.querySelectorAll('.view-btn').forEach((button) => {
    button.addEventListener('click', () => setView(button.dataset.view));
  });
  $('#btnReset').addEventListener('click', () => setView('hero'));
  $('#btnSpin').addEventListener('click', (event) => {
    spinWanted = !spinWanted;
    controls.autoRotate = spinWanted && !flight;
    event.currentTarget.classList.toggle('is-on', spinWanted);
    event.currentTarget.setAttribute('aria-pressed', String(spinWanted));
    event.currentTarget.setAttribute('aria-label', spinWanted ? 'إيقاف الدوران التلقائي' : 'تشغيل الدوران التلقائي');
    showToast(spinWanted ? 'الدوران التلقائي مفعّل' : 'الدوران التلقائي متوقف');
  });
  $('#btnDownload').addEventListener('click', downloadTransparentPng);
  $('#btnFull').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else showToast('ملء الشاشة غير مدعوم في هذا المتصفح');
    } catch {
      showToast('ملء الشاشة غير متاح حالياً');
    }
  });
  addEventListener('keydown', (event) => {
    if (event.target.closest?.('button')) return;
    const keys = { '1': 'hero', '2': 'side', '3': 'roof', '4': 'inside', '5': 'top' };
    if (keys[event.key]) setView(keys[event.key]);
    if (event.key.toLowerCase() === 'r') setView('hero');
    if (event.key === ' ') { event.preventDefault(); $('#btnSpin').click(); }
  });
}

function onResize() {
  camera.aspect = innerWidth / innerHeight;
  const offset = camera.aspect < 0.8 ? 0.045 : innerHeight < 520 ? 0.035 : 0;
  if (offset) {
    camera.setViewOffset(innerWidth, innerHeight, 0, innerHeight * offset, innerWidth, innerHeight);
  } else {
    camera.clearViewOffset();
  }
  applyFov();
  renderer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', onResize);

const clock = new THREE.Clock();
let elapsed = 0;
let frameCount = 0;
let fpsTime = 0;
let fpsFrames = 0;
let qualityChecked = false;
function tick() {
  requestAnimationFrame(tick);
  if (document.hidden) return;
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  updateFlight(dt);
  controls.update();
  world.update(reducedMotion ? 0 : elapsed, dt);
  renderer.render(world.scene, camera);
  if (++frameCount === 2) {
    document.body.classList.add('is-ready');
    $('#loader')?.classList.add('is-hidden');
  }
  if (!qualityChecked) {
    fpsTime += dt;
    fpsFrames++;
    if (fpsTime > 3.5) {
      qualityChecked = true;
      if (fpsFrames / fpsTime < 30) {
        renderer.setPixelRatio(1);
        renderer.setSize(innerWidth, innerHeight);
        renderer.shadowMap.enabled = false;
      }
    }
  }
}

canvas.addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  showToast('فُقد تسريع الرسوميات، جارٍ الاستعادة');
});
canvas.addEventListener('webglcontextrestored', () => {
  onResize();
  showToast('تم استعادة العرض');
});

try {
  bindUI();
  onResize();
  setView('hero', { immediate: true });
  tick();
} catch (error) {
  console.error('Could not start the model viewer', error);
  showError('تعذّر تحميل النموذج', 'جرّب تحديث الصفحة أو استخدام متصفح أحدث.');
}

// مرجع للتشخيص والتأكد من بقاء المشهد شفافاً.
window.__shop = { scene: world.scene, camera, renderer, controls, world, VIEWS, setView };
