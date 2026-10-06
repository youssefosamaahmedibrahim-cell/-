// ============================================================
// vfx.js — نظام التأثيرات البصرية (جزيئات، نيران، نيازك، صواعق)
// ============================================================
import * as THREE from 'three';

const MAX_PARTICLES = 6000;

// نسيج دائري ناعم للجزيئات
function makeSpriteTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.28)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const PARTICLE_VS = `
attribute float aSize;
attribute vec3 aColor;
attribute float aAlpha;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vColor = aColor;
  vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (420.0 / max(0.001, -mv.z));
  gl_Position = projectionMatrix * mv;
}`;

const PARTICLE_FS = `
uniform sampler2D uMap;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec4 t = texture2D(uMap, gl_PointCoord);
  if (t.a < 0.01) discard;
  gl_FragColor = vec4(vColor, 1.0) * t.a * vAlpha;
}`;

// ============================================================
export function createVFX(scene, camera) {
  // ---------------- نظام الجزيئات ----------------
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(MAX_PARTICLES * 3);
  const col = new Float32Array(MAX_PARTICLES * 3);
  const siz = new Float32Array(MAX_PARTICLES);
  const alp = new Float32Array(MAX_PARTICLES);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(siz, 1));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alp, 1));
  geo.setDrawRange(0, 0);

  const mat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: makeSpriteTexture() } },
    vertexShader: PARTICLE_VS,
    fragmentShader: PARTICLE_FS,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  const P = [];
  for (let i = 0; i < MAX_PARTICLES; i++) {
    P.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1,
             size: 1, size1: 0, r: 1, g: 1, b: 1, r1: 1, g1: 1, b1: 1, drag: 0, gravity: 0, alpha: 1 });
  }
  let cursor = 0;

  function spawn() {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      cursor = (cursor + 1) % MAX_PARTICLES;
      if (!P[cursor].alive) return P[cursor];
    }
    return P[cursor];
  }

  // cfg: { pos, count, speed:[min,max], spread, dir, dirJitter, size:[a,b],
  //        color:[Color3, Color3], life:[a,b], gravity, drag, cone }
  function emit(cfg) {
    const n = cfg.count || 1;
    const dir = cfg.dir ? cfg.dir.clone().normalize() : null;
    for (let i = 0; i < n; i++) {
      const p = spawn();
      p.alive = true;
      const r = cfg.radius || 0;
      p.x = cfg.pos.x + (Math.random() - 0.5) * r * 2;
      p.y = cfg.pos.y + (Math.random() - 0.5) * r * 2;
      p.z = cfg.pos.z + (Math.random() - 0.5) * r * 2;

      let vx, vy, vz;
      if (dir) {
        const spread = (cfg.spread || 10) * Math.PI / 180;
        // اتجاه مخروطي حوالين dir
        const u = new THREE.Vector3(
          Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
        const v = dir.clone().addScaledVector(u, Math.tan(spread * Math.random())).normalize();
        const sp = THREE.MathUtils.lerp(cfg.speed[0], cfg.speed[1], Math.random());
        vx = v.x * sp; vy = v.y * sp; vz = v.z * sp;
      } else {
        const sp = THREE.MathUtils.lerp(cfg.speed[0], cfg.speed[1], Math.random());
        const th = Math.random() * Math.PI * 2;
        const ph = Math.acos(2 * Math.random() - 1);
        vx = Math.sin(ph) * Math.cos(th) * sp;
        vy = Math.cos(ph) * sp;
        vz = Math.sin(ph) * Math.sin(th) * sp;
      }
      p.vx = vx; p.vy = vy; p.vz = vz;
      if (cfg.vel) { p.vx += cfg.vel.x; p.vy += cfg.vel.y; p.vz += cfg.vel.z; }

      p.max = THREE.MathUtils.lerp(cfg.life[0], cfg.life[1], Math.random());
      p.life = p.max;
      p.size = THREE.MathUtils.lerp(cfg.size[0], cfg.size[1], Math.random());
      p.size1 = cfg.size1 !== undefined ? THREE.MathUtils.lerp(cfg.size1[0], cfg.size1[1], Math.random()) : 0;
      const c0 = cfg.color[0], c1 = cfg.color[1] || cfg.color[0];
      const t = Math.random();
      p.r1 = THREE.MathUtils.lerp(c0.r, c1.r, t);
      p.g1 = THREE.MathUtils.lerp(c0.g, c1.g, t);
      p.b1 = THREE.MathUtils.lerp(c0.b, c1.b, t);
      p.r = p.r1; p.g = p.g1; p.b = p.b1;
      if (cfg.color2) { p.r = cfg.color2.r; p.g = cfg.color2.g; p.b = cfg.color2.b; }
      p.gravity = cfg.gravity || 0;
      p.drag = cfg.drag || 0;
      p.alpha = cfg.alpha !== undefined ? cfg.alpha : 1;
    }
  }

  function updateParticles(dt) {
    let n = 0;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = P[i];
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; continue; }
      const k = 1 - (p.life / p.max);
      p.vy += p.gravity * dt;
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d; p.vy *= d; p.vz *= d;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.05 && p.gravity < 0) { p.y = 0.05; p.vy *= -0.25; }

      const o = n * 3;
      pos[o] = p.x; pos[o + 1] = p.y; pos[o + 2] = p.z;
      col[o] = p.r + (p.r1 - p.r) * 0; col[o + 1] = p.g; col[o + 2] = p.b;
      siz[n] = p.size + (p.size1 - p.size) * k;
      alp[n] = Math.min(1, (p.life / p.max) * 1.6) * p.alpha;
      n++;
      if (n >= MAX_PARTICLES) break;
    }
    geo.setDrawRange(0, n);
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aColor.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;
    geo.attributes.aAlpha.needsUpdate = true;
  }

  // ---------------- التأثيرات المؤقتة ----------------
  const effects = [];
  const tmpObjects = [];

  function addEffect(obj, life, updateFn) {
    scene.add(obj);
    effects.push({ obj, life, t: 0, update: updateFn });
    return obj;
  }

  function fadeRing(pos, opts = {}) {
    const geoR = new THREE.RingGeometry(0.6, 1, 48);
    const matR = new THREE.MeshBasicMaterial({
      color: opts.color ?? 0xffa040, transparent: true, opacity: 0.9,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const m = new THREE.Mesh(geoR, matR);
    m.position.copy(pos);
    m.rotation.x = -Math.PI / 2;
    if (opts.vertical) { m.rotation.x = 0; m.rotation.y = opts.yaw || 0; }
    const dur = opts.dur ?? 0.7;
    const maxR = opts.maxR ?? 20;
    return addEffect(m, dur, (o, t) => {
      const k = t / dur;
      const s = 0.5 + k * maxR;
      o.scale.set(s, s, s);
      o.material.opacity = 0.9 * (1 - k) ** 1.4;
      if (opts.lift) o.position.y = pos.y + k * opts.lift;
    });
  }

  function flashLight(pos, color, intensity, range, dur = 0.4) {
    const l = new THREE.PointLight(color, intensity, range, 2);
    l.position.copy(pos);
    scene.add(l);
    effects.push({ obj: l, life: dur, t: 0, update: (o, t) => {
      o.intensity = intensity * (1 - t / dur) ** 2;
    }});
    return l;
  }

  // ---------------- انفجار ----------------
  function explosion(pos, size = 8, palette = {}) {
    const cA = new THREE.Color(palette.core ?? 0xffecaa);
    const cB = new THREE.Color(palette.main ?? 0xff7a14);
    const cC = new THREE.Color(palette.smoke ?? 0x262222);

    // كرة نارية
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(1, 20, 16),
      new THREE.MeshBasicMaterial({ color: cB, transparent: true, opacity: 0.85,
        blending: THREE.AdditiveBlending, depthWrite: false }));
    ball.position.copy(pos);
    addEffect(ball, 0.45, (o, t) => {
      const k = t / 0.45;
      const s = 1 + k * size * 1.8;
      o.scale.set(s, s, s);
      o.material.opacity = 0.85 * (1 - k) ** 1.5;
    });

    // وميض أبيض
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(1, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1,
        blending: THREE.AdditiveBlending, depthWrite: false }));
    flash.position.copy(pos);
    addEffect(flash, 0.18, (o, t) => {
      const k = t / 0.18;
      const s = 1 + k * size * 2.6;
      o.scale.set(s, s, s);
      o.material.opacity = (1 - k);
    });

    fadeRing(new THREE.Vector3(pos.x, pos.y + 0.3, pos.z), {
      color: cA.getHex(), maxR: size * 2.2, dur: 0.7,
    });
    flashLight(pos, cB.getHex(), 220, size * 14, 0.5);

    // جزيئات
    emit({ pos, count: 90, speed: [size * 1.2, size * 4], life: [0.3, 0.9],
           size: [size * 0.35, size * 0.1], color: [cA, cB], gravity: 10, drag: 1.6, alpha: 1 });
    emit({ pos, count: 40, speed: [2, size * 1.1], life: [0.9, 1.9],
           size: [size * 0.4, size * 1.2], color: [cC, new THREE.Color(0x4a403c)],
           gravity: 5, drag: 2.4, alpha: 0.5 });
    emit({ pos, count: 60, speed: [size * 3, size * 8], life: [0.25, 0.7],
           size: [1.1, 0], color: [new THREE.Color(0xffffff), cA], gravity: -22, drag: 1.2 });

    // حفرة
    const scorch = new THREE.Mesh(
      new THREE.CircleGeometry(size * 1.1, 24),
      new THREE.MeshBasicMaterial({ color: 0x0d0806, transparent: true, opacity: 0.75, depthWrite: false }));
    scorch.rotation.x = -Math.PI / 2;
    scorch.position.set(pos.x, 0.06, pos.z);
    addEffect(scorch, 8, (o, t) => { o.material.opacity = 0.75 * (1 - t / 8); });
  }

  // ---------------- نيزك ----------------
  function meteor(target, opts = {}) {
    const groundY = opts.groundY ?? 0;
    const start = new THREE.Vector3(target.x + (Math.random() - 0.5) * 8,
                                    groundY + 130, target.z + (Math.random() - 0.5) * 8);
    const radius = opts.radius ?? 9;
    const dur = opts.dur ?? 1.0;

    const rock = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.7, 0),
      new THREE.MeshStandardMaterial({ color: 0x2e1c18, roughness: 0.9, emissive: 0xff4400, emissiveIntensity: 1.4, flatShading: true }));
    rock.position.copy(start);
    scene.add(rock);
    const light = new THREE.PointLight(0xff6611, 120, 90, 2);
    rock.add(light);

    // حلقة تحذير
    const warn = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 1, 36),
      new THREE.MeshBasicMaterial({ color: 0xff7a14, transparent: true, opacity: 0.8,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    warn.rotation.x = -Math.PI / 2;
    warn.position.set(target.x, groundY + 0.1, target.z);
    warn.scale.setScalar(radius * 0.5);
    addEffect(warn, dur, (o, t) => { o.material.opacity = 0.8 * (1 - t / dur); });

    let t = 0;
    effects.push({ obj: rock, life: dur, t: 0, update: (o, tt, dt) => {
      t += dt;
      const k = Math.min(1, t / dur);
      o.position.lerpVectors(start, new THREE.Vector3(target.x, groundY + 1, target.z), k * k);
      o.rotation.x += dt * 6; o.rotation.y += dt * 4;
      // ذيل ناري
      emit({
        pos: o.position, count: 6, speed: [1, 6], life: [0.3, 0.7],
        size: [3.2, 0.4], color: [new THREE.Color(0xffecaa), new THREE.Color(0x961808)],
        gravity: 6, drag: 1.2,
      });
    }, onDone: () => {
      explosion(new THREE.Vector3(target.x, groundY + 1, target.z), radius * 0.75,
        { core: 0xffecaa, main: 0xff7a14 });
      // حريق مستمر
      const fire = { t: 0 };
      effects.push({ obj: new THREE.Object3D(), life: 4, t: 0, update: (o, tt, dt) => {
        emit({ pos: new THREE.Vector3(target.x, groundY + 0.6, target.z), count: 3,
               speed: [1, 5], life: [0.5, 1.2], size: [3.5, 1],
               color: [new THREE.Color(0xffecaa), new THREE.Color(0x961808)],
               gravity: 12, drag: 1 });
      }});
    }});
  }

  // ---------------- صاعقة ----------------
  function lightning(from, to, opts = {}) {
    const segs = opts.segments ?? 14;
    const jitter = opts.jitter ?? 3.2;
    const dur = opts.dur ?? 0.35;
    const group = new THREE.Group();
    const matCore = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false });
    const matGlow = new THREE.MeshBasicMaterial({ color: 0x96d2ff, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false });

    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    const up = new THREE.Vector3(0, 0, 1).cross(dir).normalize();
    if (!isFinite(up.x) || up.lengthSq() < 0.001) up.set(1, 0, 0);
    const side = new THREE.Vector3().crossVectors(dir, up).normalize();

    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const f = i / segs;
      const p = from.clone().addScaledVector(dir, f);
      const j = (i === 0 || i === segs) ? 0 : jitter;
      p.addScaledVector(up, (Math.random() - 0.5) * j);
      p.addScaledVector(side, (Math.random() - 0.5) * j);
      pts.push(p);
    }
    for (let i = 0; i < segs; i++) {
      const a = pts[i], b = pts[i + 1];
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const l = a.distanceTo(b) * 1.1;
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0),
        b.clone().sub(a).normalize());
      for (const [m, r] of [[matCore, 0.28], [matGlow, 0.9]]) {
        const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, 6), m);
        cyl.position.copy(mid);
        cyl.quaternion.copy(q);
        group.add(cyl);
      }
    }
    scene.add(group);
    effects.push({ obj: group, life: dur, t: 0, update: (o, t) => {
      const k = t / dur;
      matCore.opacity = (1 - k) ** 0.6;
      matGlow.opacity = 0.55 * (1 - k);
      const s = 1 + k * 0.5;
      o.children.forEach(c => c.scale.set(1 + k * 1.6, 1, 1 + k * 1.6));
    }, dispose: () => { matCore.dispose(); matGlow.dispose(); group.children.forEach(c => c.geometry.dispose()); } });

    flashLight(to, 0xaaddff, 260, 110, 0.35);
    fadeRing(new THREE.Vector3(to.x, to.y + 0.2, to.z), { color: 0x96d2ff, maxR: opts.impactRadius ?? 14, dur: 0.6 });
    emit({ pos: to, count: 50, speed: [8, 30], life: [0.3, 0.9], size: [1.6, 0],
           color: [new THREE.Color(0xffffff), new THREE.Color(0x96d2ff)], gravity: -14, drag: 1.6 });
  }

  // ---------------- موجة زئير ----------------
  function roarWave(origin, dir, opts = {}) {
    const color = opts.color ?? 0xff8c1e;
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const m = fadeRing(origin.clone().addScaledVector(dir, 2), {
          color, maxR: opts.maxR ?? 26, dur: 0.9, vertical: true,
          yaw: Math.atan2(dir.x, dir.z),
        });
      }, i * 90);
    }
    emit({ pos: origin, count: 70, dir, spread: 26, speed: [26, 70], life: [0.35, 0.9],
           size: [2.4, 0.3], color: [new THREE.Color(0xffffff), new THREE.Color(color)], drag: 1.3 });
    emit({ pos: origin.clone().add(new THREE.Vector3(0, -2, 0)), count: 40,
           speed: [10, 34], life: [0.6, 1.4], size: [3, 8],
           color: [new THREE.Color(0x8a7a68), new THREE.Color(0x4a4038)], drag: 2, alpha: 0.45 });
  }

  // ---------------- ضربة مخالب ----------------
  function slash(pos, yaw, size = 12, color = 0xff461e) {
    for (let a = 0; a < 3; a++) {
      const geo = new THREE.RingGeometry(size * 0.35, size * (0.55 + a * 0.12), 42, 1,
        -Math.PI * 0.42, Math.PI * 0.84);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.85, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, depthWrite: false }));
      m.position.copy(pos);
      m.rotation.set(-Math.PI * 0.28, yaw, Math.random() * 0.6 - 0.3);
      const dur = 0.3 + a * 0.04;
      addEffect(m, dur, (o, t) => {
        const k = t / dur;
        o.scale.setScalar(1 + k * 0.7);
        o.material.opacity = 0.85 * (1 - k) ** 1.6;
      });
    }
    emit({ pos, count: 40, speed: [10, 34], life: [0.2, 0.6], size: [1.6, 0],
           color: [new THREE.Color(0xffffff), new THREE.Color(color)], gravity: -20, drag: 2 });
    flashLight(pos, color, 90, 40, 0.25);
  }

  // ---------------- نفَس النار ----------------
  function createFireBreath(getOrigin) {
    const light = new THREE.PointLight(0xff7a14, 0, 90, 2);
    scene.add(light);
    let active = false, time = 0;
    const rings = [];
    for (let i = 0; i < 14; i++) {
      const r = new THREE.Mesh(
        new THREE.SphereGeometry(1, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0xff7a14, transparent: true, opacity: 0.5,
          blending: THREE.AdditiveBlending, depthWrite: false }));
      r.visible = false;
      scene.add(r);
      rings.push(r);
    }
    return {
      start() { active = true; time = 0; },
      stop() { active = false; light.intensity = 0; rings.forEach(r => r.visible = false); },
      get active() { return active; },
      update(dt, range = 60, radius = 6) {
        if (!active) return;
        time += dt;
        const { pos, dir } = getOrigin();
        light.position.copy(pos).addScaledVector(dir, 6);
        light.intensity = 120 + Math.random() * 60;

        for (let i = 0; i < rings.length; i++) {
          const f = (i + 1) / rings.length;
          const d = f * range;
          const r = (0.7 + f * radius * 0.55);
          const ring = rings[i];
          ring.visible = true;
          ring.position.copy(pos).addScaledVector(dir, d);
          const flick = 0.85 + Math.sin(time * 30 + i * 1.7) * 0.15 + Math.random() * 0.08;
          ring.scale.set(r * flick, r * flick * 0.85, r * flick);
          const col = new THREE.Color().setHSL(0.13 - f * 0.09, 1, 0.55 - f * 0.12);
          ring.material.color.copy(col);
          ring.material.opacity = Math.max(0, (0.65 - f * 0.42) * flick);
        }

        // جزيئات من الفم
        emit({ pos, dir, spread: 9, count: 12, speed: [38, 78], life: [0.35, 0.85],
               size: [2.2, 6.5], color: [new THREE.Color(0xffecaa), new THREE.Color(0x961808)],
               gravity: 8, drag: 0.7 });
        emit({ pos, dir, spread: 18, count: 4, speed: [16, 40], life: [0.9, 1.8],
               size: [3, 9], color: [new THREE.Color(0x262222), new THREE.Color(0x4a403c)],
               gravity: 6, drag: 1.2, alpha: 0.35 });
        emit({ pos, dir, spread: 22, count: 4, speed: [30, 70], life: [0.5, 1.2],
               size: [0.8, 1.6], color: [new THREE.Color(0xffecaa), new THREE.Color(0xff7a14)],
               gravity: 14, drag: 1 });

        // أثر الأرض
        const hitY = 0;
        const t = (hitY - pos.y) / (dir.y || -0.001);
        if (t > 0 && t < range) {
          const gp = pos.clone().addScaledVector(dir, t);
          emit({ pos: new THREE.Vector3(gp.x, 0.5, gp.z), count: 5, speed: [4, 16],
                 life: [0.5, 1.2], size: [3, 7],
                 color: [new THREE.Color(0xffecaa), new THREE.Color(0x961808)], gravity: 16, drag: 1 });
        }
      },
    };
  }

  // ---------------- هالة ----------------
  function aura(getPos, duration, color = 0xff8c1e) {
    let t = 0;
    effects.push({ obj: new THREE.Object3D(), life: duration, t: 0, update: (o, tt, dt) => {
      const p = getPos();
      emit({ pos: p, count: 6, speed: [2, 9], life: [0.5, 1.2], size: [1.8, 0.2],
             color: [new THREE.Color(0xffecaa), new THREE.Color(color)], gravity: 12, drag: 1.4 });
    }});
    // عمود طاقة
    const p0 = getPos();
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(4, 7, 90, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffecaa, transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    pillar.position.set(p0.x, 45, p0.z);
    addEffect(pillar, 1.1, (o, t) => {
      const k = t / 1.1;
      o.scale.set(1 + k * 1.8, 1, 1 + k * 1.8);
      o.material.opacity = 0.5 * (1 - k);
    });
  }

  // ---------------- أثر الاندفاع ----------------
  function dashTrail(getPos, duration, color = 0xff461e) {
    effects.push({ obj: new THREE.Object3D(), life: duration, t: 0, update: (o, t, dt) => {
      const p = getPos();
      emit({ pos: p, count: 8, speed: [4, 16], life: [0.25, 0.6], size: [2.4, 0.2],
             color: [new THREE.Color(0xffffff), new THREE.Color(color)], drag: 2 });
    }});
  }

  function footDust(p) {
    emit({ pos: p, count: 6, speed: [1, 5], life: [0.3, 0.8], size: [1.4, 4],
           color: [new THREE.Color(0x8c7c6c), new THREE.Color(0x5a5048)], gravity: 2, drag: 3, alpha: 0.4 });
  }

  function hitSpark(p, color = 0xffecaa) {
    emit({ pos: p, count: 22, speed: [8, 26], life: [0.15, 0.5], size: [1.2, 0],
           color: [new THREE.Color(0xffffff), new THREE.Color(color)], gravity: -16, drag: 2 });
  }

  // ---------------- التحديث العام ----------------
  function update(dt) {
    updateParticles(dt);
    for (let i = effects.length - 1; i >= 0; i--) {
      const e = effects[i];
      e.t += dt;
      if (e.update) e.update(e.obj, e.t, dt);
      if (e.t >= e.life) {
        if (e.obj.parent) e.obj.parent.remove(e.obj);
        if (e.dispose) e.dispose();
        if (e.onDone) e.onDone();
        effects.splice(i, 1);
      }
    }
  }

  return {
    update, emit, explosion, meteor, lightning, roarWave, slash,
    createFireBreath, aura, dashTrail, footDust, hitSpark, fadeRing, flashLight,
    particleCount: () => geo.drawRange.count,
  };
}
