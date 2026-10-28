import * as THREE from 'three';
import { getMaterials } from '../lib/materials.js';
import { rand, sprite } from '../lib/shapes.js';

/* ============================================================
   قبة السماء
   ============================================================ */
const skyVert = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const skyFrag = /* glsl */`
  varying vec3 vDir;
  uniform float uTime;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i), b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float fbm(vec2 p){
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; }
    return s;
  }

  void main() {
    vec3 d = normalize(vDir);
    float h = clamp(d.y, -1.0, 1.0);

    vec3 top = vec3(0.0025, 0.0022, 0.005);
    vec3 mid = vec3(0.016, 0.0035, 0.011);
    vec3 horizon = vec3(0.085, 0.008, 0.022);
    vec3 col = mix(horizon, mid, smoothstep(-0.02, 0.22, h));
    col = mix(col, top, smoothstep(0.18, 0.8, h));

    // غبار سديم بعيد
    vec2 sp = vec2(atan(d.z, d.x) * 1.6, h * 2.4 + uTime * 0.006);
    float clouds = fbm(sp * 2.2);
    clouds = pow(clouds, 2.2);
    col += vec3(0.16, 0.02, 0.045) * clouds * smoothstep(-0.05, 0.45, h) * 0.8;

    // توهج أحمر خلف المتجر (اتجاه -Z)
    float behind = smoothstep(0.15, 1.0, -d.z) * smoothstep(-0.12, 0.25, h);
    col += vec3(0.17, 0.02, 0.04) * behind * 0.5;

    // نجوم خفيفة
    vec2 g = floor(vec2(atan(d.z, d.x) * 120.0, d.y * 120.0));
    float star = step(0.9975, hash(g));
    col += vec3(0.8, 0.7, 0.85) * star * smoothstep(0.12, 0.6, h) * 0.9;

    // خط أرضي داكن جداً
    col = mix(col, vec3(0.006, 0.003, 0.008), smoothstep(0.02, -0.16, h));

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createSky() {
  const geo = new THREE.SphereGeometry(300, 48, 32);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: skyVert,
    fragmentShader: skyFrag,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return { mesh, update: (t) => { mat.uniforms.uTime.value = t; } };
}

/* ============================================================
   الجزيئات: شرر وجمر متطاير
   ============================================================ */
export function createEmbers({ count = 380 } = {}) {
  const M = getMaterials();
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const speed = new Float32Array(count);

  const spread = 46;
  for (let i = 0; i < count; i++) {
    pos[i * 3] = rand(-spread, spread);
    pos[i * 3 + 1] = rand(0, 26);
    pos[i * 3 + 2] = rand(-spread * 0.7, spread * 0.9);
    seed[i] = rand(0, Math.PI * 2);
    speed[i] = rand(0.25, 1.1);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.34,
    map: M._textures.sparkMap,
    color: 0xff8a55,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.9,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;

  const update = (t, dt) => {
    const p = geo.attributes.position.array;
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      p[i3 + 1] += dt * speed[i] * 1.4;
      p[i3] += Math.sin(t * 0.6 + seed[i]) * dt * 0.55;
      p[i3 + 2] += Math.cos(t * 0.45 + seed[i] * 1.3) * dt * 0.4;
      if (p[i3 + 1] > 26) {
        p[i3 + 1] = -0.5;
        p[i3] = rand(-spread, spread);
        p[i3 + 2] = rand(-spread * 0.7, spread * 0.9);
      }
    }
    geo.attributes.position.needsUpdate = true;
    mat.opacity = 0.72 + Math.sin(t * 1.7) * 0.12;
  };

  return { points, update };
}

/* ============================================================
   أعمدة ضوء خلف المتجر
   ============================================================ */
export function createLightShafts() {
  const group = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0xff2a4d) } },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vView;
      void main(){
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vView;
      uniform float uTime;
      uniform vec3 uColor;
      void main(){
        float edge = pow(abs(dot(normalize(vNormal), normalize(vView))), 1.4);
        float fade = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.55, vUv.y);
        float a = edge * fade * (0.16 + 0.05 * sin(uTime * 1.4 + vUv.y * 3.0));
        gl_FragColor = vec4(uColor, a);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  for (const [x, z, h, r, rot] of [[-9, -12, 34, 4.5, 0.16], [8, -14, 40, 5.5, -0.2], [0, -20, 46, 7, 0]]) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 24, 1, true), mat);
    cone.position.set(x, h / 2 - 2, z);
    cone.rotation.z = rot;
    group.add(cone);
  }
  return { group, update: (t) => { mat.uniforms.uTime.value = t; } };
}

/* ============================================================
   الضباب + هالة خلفية
   ============================================================ */
export function createAtmosphere() {
  const M = getMaterials();
  const group = new THREE.Group();

  const sky = createSky();
  group.add(sky.mesh);

  const embers = createEmbers();
  group.add(embers.points);

  const shafts = createLightShafts();
  group.add(shafts.group);

  // هالة حمراء خلف المبنى
  const halo = sprite(M.glowSprite, 70, 2, 16, -22);
  halo.material.color.setHex(0xff1c3a);
  halo.material.opacity = 0.3;
  group.add(halo);

  const halo2 = sprite(M.glowSprite, 34, 0, 24, -10);
  halo2.material.color.setHex(0xff5a3a);
  halo2.material.opacity = 0.2;
  group.add(halo2);

  // غبار قريب من الكاميرا
  const dustGeo = new THREE.BufferGeometry();
  const N = 200;
  const arr = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = rand(6, 26);
    const a = rand(0, Math.PI * 2);
    arr[i * 3] = Math.cos(a) * r;
    arr[i * 3 + 1] = rand(0.5, 14);
    arr[i * 3 + 2] = Math.sin(a) * r;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const dustMat = new THREE.PointsMaterial({
    size: 0.09, map: M._textures.sparkMap, color: 0xffb894,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  group.add(dust);

  const update = (t, dt) => {
    sky.update(t);
    embers.update(t, dt);
    shafts.update(t);
    dust.rotation.y = t * 0.02;
    dustMat.opacity = 0.4 + Math.sin(t * 0.9) * 0.12;
    halo.material.opacity = 0.26 + Math.sin(t * 0.7) * 0.04;
  };

  return { group, update };
}

/* ============================================================
   خريطة البيئة (للانعكاسات المعدنية)
   ============================================================ */
export function createEnvironment(renderer) {
  const envScene = new THREE.Scene();

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(60, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0x1a0812, side: THREE.BackSide }),
  );
  envScene.add(dome);

  const addPanel = (color, intensity, w, h, x, y, z, rx = 0, ry = 0) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }),
    );
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, 0);
    envScene.add(m);
  };

  // مصادر ضوء ملونة تعكس على الذهب
  addPanel(0xff2a3a, 1.5, 24, 14, 0, 8, 26);
  addPanel(0xffa04a, 1.6, 12, 8, -22, 16, 6, 0, Math.PI / 2);
  addPanel(0x6fa8ff, 0.6, 9, 7, 22, 12, -8, 0, -Math.PI / 2);
  addPanel(0xff6a3a, 0.9, 40, 40, 0, -24, 0, Math.PI / 2, 0);
  addPanel(0x2a1030, 0.7, 60, 30, 0, 24, -20, -Math.PI / 3, 0);

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const env = pmrem.fromScene(envScene, 0.06).texture;
  pmrem.dispose();

  envScene.traverse((o) => {
    if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); }
  });

  return env;
}
