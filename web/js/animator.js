// ============================================================
// animator.js — محرك أنيميشن إجرائي للتنين (نفس فكرة نسخة روبلوكس)
// ============================================================
import * as THREE from 'three';

const D = Math.PI / 180;
const EULER_ORDER = 'YXZ';

const _e = new THREE.Euler();
const _q = new THREE.Quaternion();

function quat(rx, ry, rz) {
  _e.set(rx * D, ry * D, rz * D, EULER_ORDER);
  return new THREE.Quaternion().setFromEuler(_e);
}

// ------------------------------------------------------------
export function createAnimator(dragon) {
  const bones = dragon.bones;
  const base = {};
  for (const k in bones) base[k] = bones[k].userData.baseQuat.clone();

  const target = {};          // اسم العظمة -> Quaternion هدف
  let bodyBob = 0, bodyBobTarget = 0, bodyPitch = 0, bodyPitchTarget = 0, bodyYaw = 0, bodyYawTarget = 0;

  let state = 'Idle';
  let stateTime = 0;
  let action = null;          // { name, t, dur, events, fired }
  const listeners = [];

  // ---------------- مساعدات الوضعيات ----------------
  function clear() { for (const k in target) delete target[k]; }

  function set(name, rx, ry, rz) {
    if (!bones[name]) return;
    target[name] = (target[name] || new THREE.Quaternion()).set(0, 0, 0, 1);
    target[name].multiply(quat(rx, ry || 0, rz || 0));
  }

  // الأجنحة (مرآة صحيحة بين اليمين والشمال)
  // البيانات: [رفة/فرد (rx), مسح (ry), ميل (rz)] — rx هو اللي بيرفع الجناح
  function W(spec) {
    for (const side of ['L', 'R']) {
      const s = side === 'R' ? 1 : -1;
      for (const joint in spec) {
        const v = spec[joint];
        set(`Wing${side}_${joint}`, v[0], s * (v[1] || 0), s * (v[2] || 0));
      }
    }
  }

  // الأرجل: spec = { FL: { Thigh: [rx, ry, rz], Shin: [...] }, ... }
  function L(spec) {
    for (const tag in spec) {
      const s = (tag === 'FL' || tag === 'BL') ? 1 : -1;
      for (const part in spec[tag]) {
        const v = spec[tag][part];
        set(`Leg${tag}_${part}`, v[0], s * (v[1] || 0), s * (v[2] || 0));
      }
    }
  }

  // الذيل: موجة
  function T(ampYaw, ampPitch, phase) {
    for (let i = 0; i < 6; i++) {
      const f = 0.3 + (i / 5) * 0.7;
      set(`Tail${i}`, ampPitch * f * Math.sin(phase - i * 0.45),
                      ampYaw * f * Math.sin(phase - i * 0.55), 0);
    }
  }

  // مشية قطرية
  function gait(u, amp, phase0) {
    const p = u * Math.PI * 2;
    const sA = Math.sin(p + phase0);
    const sB = Math.sin(p + phase0 + Math.PI);
    const lA = Math.max(0, sA) ** 2;
    const lB = Math.max(0, sB) ** 2;
    const leg = (tag, s, lift) => ({
      [tag]: {
        Thigh: [s * amp, 0, 2],
        Shin: [-4 - lift * amp * 1.5, 0, 0],
        Foot: [6 + lift * amp * 0.8, 0, 0],
      },
    });
    L({ ...leg('FL', sA, lA), ...leg('BR', sA, lA), ...leg('FR', sB, lB), ...leg('BL', sB, lB) });
    bodyBobTarget = -(lA + lB) * 0.55;
  }

  // أرجل مطوية للطيران
  function tuck(u, k = 1) {
    const w = Math.sin(u * Math.PI * 2) * 3;
    L({
      FL: { Thigh: [-26 + w, 0, 4], Shin: [58 - w, 0, 0], Foot: [26, 0, 0] },
      FR: { Thigh: [-26 + w, 0, 4], Shin: [58 - w, 0, 0], Foot: [26, 0, 0] },
      BL: { Thigh: [-22 - w, 0, 5], Shin: [62 + w, 0, 0], Foot: [24, 0, 0] },
      BR: { Thigh: [-22 - w, 0, 5], Shin: [62 + w, 0, 0], Foot: [24, 0, 0] },
    });
  }

  // ---------------- الحالات ----------------
  function poseIdle(t) {
    const b = (Math.sin(t * 1.85) + 1) * 0.5;      // 0..1 تنفّس
    const ph = t * 1.2;
    bodyBobTarget = -0.3 + b * 0.55;
    bodyPitchTarget = 1.2 + b * 1.4;
    set('Neck0', -5 - b * 3.5); set('Neck1', -3 - b * 2);
    set('Head', 4 + b * 3); set('Jaw', 6 + b * 7);
    W({
      Shoulder: [-4, -6 - b * 2, 0],
      Upper: [-18 + b * 5, -34 - b * 3, 0],
      Fore: [-13 + b * 4, -46 - b * 4, 0],
      F1: [-6, -20, 0], F2: [-5, -14, 0], F3: [-4, -10, 0],
    });
    L({
      FL: { Thigh: [3, 0, 2], Shin: [-6, 0, 0], Foot: [5, 0, 0] },
      FR: { Thigh: [3, 0, 2], Shin: [-6, 0, 0], Foot: [5, 0, 0] },
      BL: { Thigh: [-2, 0, 3], Shin: [-8, 0, 0], Foot: [6, 0, 0] },
      BR: { Thigh: [-2, 0, 3], Shin: [-8, 0, 0], Foot: [6, 0, 0] },
    });
    T(7, 3, ph);
  }

  function poseWalk(u, amp, bob, pitch, wingAmp, tailAmp) {
    const p = u * Math.PI * 2;
    gait(u, amp, 0);
    bodyPitchTarget = pitch;
    bodyBobTarget += Math.sin(p * 2) * bob;
    set('Neck0', -4 + Math.sin(p) * 3);
    set('Neck1', -2 + Math.sin(p) * 2);
    set('Head', 3 - Math.sin(p) * 2);
    set('Jaw', 7);
    W({
      Shoulder: [-4, -6, 0],
      Upper: [-20 - Math.sin(p) * wingAmp * 1.4, -32 + Math.sin(p) * wingAmp, 0],
      Fore: [-14 - Math.sin(p) * wingAmp, -44 + Math.sin(p) * (wingAmp + 1), 0],
      F1: [-6, -18, 0], F2: [-5, -13, 0], F3: [-4, -9, 0],
    });
    T(tailAmp, 4, p * 0.5 + 0.6);
  }

  function poseFly(u) {
    const p = u * Math.PI * 2;
    const flap = Math.sin(p + 0.42 * Math.sin(p));
    const flap2 = Math.sin(p - 0.55 + 0.3 * Math.sin(p));
    const flap3 = Math.sin(p - 1.05);
    tuck(u);
    bodyBobTarget = -flap * 1.7;
    bodyPitchTarget = -4 + flap * 3;
    set('Neck0', 2 + flap * 2); set('Neck1', 1 + flap * 1.5);
    set('Head', -1); set('Jaw', 8);
    W({
      Shoulder: [0, -4 - flap * 4, 0],
      Upper: [10 + flap * 50, -10 - flap * 12, 0],
      Fore: [4 + flap2 * 40, -6 - flap2 * 8, 0],
      F1: [flap3 * 16, 0, 0], F2: [flap3 * 13, 0, 0], F3: [flap3 * 10, 0, 0],
    });
    T(6, 6, p * 0.5 + 0.4);
  }

  function poseGlide(u) {
    const p = u * Math.PI * 2;
    tuck(u * 0.4);
    bodyBobTarget = Math.sin(p * 0.5) * 0.9;
    bodyPitchTarget = -2 + Math.sin(p) * 2;
    set('Neck0', 3 + Math.sin(p) * 2); set('Neck1', 2);
    set('Head', -1); set('Jaw', 6);
    W({
      Shoulder: [0, -2, 0],
      Upper: [6 + Math.sin(p) * 8, -3 + Math.sin(p) * 5, 0],
      Fore: [-2 + Math.sin(p - 0.4) * 6, -2 + Math.sin(p - 0.4) * 4, 0],
      F1: [4, -8, 0], F2: [3, -4, 0], F3: [2, 0, 0],
    });
    T(5, 3, p * 0.5);
  }

  // ---------------- الأكشنات (مرة واحدة) ----------------
  const ACTIONS = {
    FireBreath: {
      dur: 2.0,
      events: [{ t: 0.15, name: 'Cast' }, { t: 0.9, name: 'End' }],
      keys: [
        { t: 0, pose: () => {
          bodyPitchTarget = -7; bodyBobTarget = -0.5;
          set('Neck0', -9); set('Neck1', -7); set('Head', 7); set('Jaw', 5);
          W({ Shoulder: [-6, -8, 0], Upper: [-12, -26, 0], Fore: [-10, -40, 0],
              F1: [-6, -18, 0], F2: [-5, -12, 0], F3: [-4, -8, 0] });
          T(4, 8, 0.4);
        }},
        { t: 0.15, pose: () => {
          bodyPitchTarget = -11; bodyBobTarget = -0.7;
          set('Neck0', -16); set('Neck1', -13); set('Head', 13); set('Jaw', 46);
          W({ Shoulder: [-10, -14, 0], Upper: [8, -20, 0], Fore: [-6, -26, 0],
              F1: [6, -12, 0], F2: [5, -8, 0], F3: [4, -6, 0] });
          T(3, 12, 0.8);
        }},
        { t: 0.8, pose: () => {
          bodyPitchTarget = -4; bodyBobTarget = -0.4;
          set('Neck0', -3); set('Neck1', -2); set('Head', 2); set('Jaw', 50);
          W({ Shoulder: [-8, -12, 0], Upper: [14, -18, 0], Fore: [-2, -22, 0],
              F1: [8, -10, 0], F2: [6, -6, 0], F3: [5, -4, 0] });
          T(4, 6, 1.6);
        }},
        { t: 1, pose: () => {
          bodyPitchTarget = -5; bodyBobTarget = -0.3;
          set('Neck0', -7); set('Neck1', -4); set('Head', 5); set('Jaw', 12);
          W({ Shoulder: [-5, -8, 0], Upper: [-10, -28, 0], Fore: [-10, -42, 0],
              F1: [-6, -18, 0], F2: [-5, -12, 0], F3: [-4, -8, 0] });
          T(5, 4, 2.2);
        }},
      ],
    },

    ClawBarrage: {
      dur: 1.25,
      events: [
        { t: 0.05, name: 'Dash' },
        { t: 0.19, name: 'Slash1' }, { t: 0.37, name: 'Slash2' },
        { t: 0.55, name: 'Slash3' }, { t: 0.72, name: 'Slash4' },
      ],
      keys: (() => {
        const swingPose = (swing, side) => () => {
          bodyPitchTarget = -10 + swing * 12;
          bodyYawTarget = -swing * 8 * side;
          set('Neck0', -6 + swing * 6); set('Neck1', -4 + swing * 4);
          set('Head', 6 - swing * 3); set('Jaw', 26 + swing * 10);
          W({ Shoulder: [-8, -14, 0], Upper: [-6 - swing * 12, -24 + swing * 10, 0],
              Fore: [-16, -34, 0], F1: [-8, -14, 0], F2: [-6, -10, 0], F3: [-5, -7, 0] });
          T(10, 6, swing * 4);
          const front = side > 0 ? 'FL' : 'FR';
          const back = side > 0 ? 'FR' : 'FL';
          const s1 = side > 0 ? 1 : -1;
          const s2 = -s1;
          L({
            [front]: { Thigh: [30 - swing * 58, 0, 6], Shin: [-46 + swing * 34, 0, 0], Foot: [20, 0, 0] },
            [back]: { Thigh: [-14, 0, 4], Shin: [-20, 0, 0], Foot: [12, 0, 0] },
          });
        };
        return [
          { t: 0.00, pose: swingPose(0, 1) },
          { t: 0.19, pose: swingPose(1, 1) },
          { t: 0.37, pose: swingPose(1, -1) },
          { t: 0.55, pose: swingPose(1, 1) },
          { t: 0.72, pose: swingPose(1, -1) },
          { t: 1.00, pose: swingPose(0, 1) },
        ];
      })(),
    },

    MeteorCast: {
      dur: 2.6,
      events: [
        { t: 0.21, name: 'Roar' }, { t: 0.33, name: 'Summon' },
        { t: 0.81, name: 'Slam' },
      ],
      keys: [
        { t: 0, pose: () => {
          bodyPitchTarget = -16; bodyBobTarget = -1.6;
          set('Neck0', -14); set('Neck1', -10); set('Head', 10); set('Jaw', 10);
          W({ Shoulder: [-10, -6, 0], Upper: [-26, -30, 0], Fore: [-20, -44, 0],
              F1: [-10, -20, 0], F2: [-8, -14, 0], F3: [-6, -10, 0] });
          L({ FL: { Thigh: [10, 0, 3] }, FR: { Thigh: [10, 0, 3] },
              BL: { Thigh: [-10, 0, 4], Shin: [-26, 0, 0] },
              BR: { Thigh: [-10, 0, 4], Shin: [-26, 0, 0] } });
          T(6, 14, 0.2);
        }},
        { t: 0.21, pose: () => {
          bodyPitchTarget = 6; bodyBobTarget = 2.4;
          set('Neck0', 16); set('Neck1', 10); set('Head', -8); set('Jaw', 58);
          W({ Shoulder: [6, -10, 0], Upper: [46, -6, 0], Fore: [24, -14, 0],
              F1: [18, 0, 0], F2: [14, 0, 0], F3: [10, 0, 0] });
          tuck(0.25); T(4, 18, 0.9);
        }},
        { t: 0.54, pose: () => {
          bodyPitchTarget = 10; bodyBobTarget = 3.0;
          set('Neck0', 20); set('Neck1', 12); set('Head', -10); set('Jaw', 62);
          W({ Shoulder: [4, -8, 0], Upper: [34, -4, 0], Fore: [16, -10, 0],
              F1: [12, 0, 0], F2: [10, 0, 0], F3: [8, 0, 0] });
          tuck(0.5); T(5, 16, 1.4);
        }},
        { t: 0.81, pose: () => {
          bodyPitchTarget = -6; bodyBobTarget = 1.4;
          set('Neck0', 4); set('Neck1', 2); set('Head', -2); set('Jaw', 40);
          W({ Shoulder: [-10, -12, 0], Upper: [-34, -18, 0], Fore: [-30, -30, 0],
              F1: [-12, -14, 0], F2: [-10, -10, 0], F3: [-8, -7, 0] });
          tuck(0.75); T(6, 10, 2.0);
        }},
        { t: 1, pose: () => {
          bodyPitchTarget = -8; bodyBobTarget = -1.2;
          set('Neck0', -8); set('Neck1', -5); set('Head', 6); set('Jaw', 14);
          W({ Shoulder: [-6, -8, 0], Upper: [-18, -28, 0], Fore: [-14, -42, 0],
              F1: [-7, -18, 0], F2: [-6, -13, 0], F3: [-5, -9, 0] });
          T(6, 6, 2.6);
        }},
      ],
    },

    ThunderCast: {
      dur: 3.1,
      events: [
        { t: 0.23, name: 'Roar' }, { t: 0.31, name: 'Awaken' }, { t: 0.42, name: 'Bolts' },
      ],
      keys: [
        { t: 0, pose: () => {
          bodyPitchTarget = -18; bodyBobTarget = -1.8;
          set('Neck0', -16); set('Neck1', -11); set('Head', 12); set('Jaw', 8);
          W({ Shoulder: [-12, -4, 0], Upper: [-30, -28, 0], Fore: [-24, -42, 0],
              F1: [-12, -22, 0], F2: [-10, -16, 0], F3: [-8, -11, 0] });
          L({ FL: { Thigh: [14, 0, 4] }, FR: { Thigh: [14, 0, 4] },
              BL: { Thigh: [-14, 0, 5], Shin: [-30, 0, 0] },
              BR: { Thigh: [-14, 0, 5], Shin: [-30, 0, 0] } });
          T(5, 16, 0.1);
        }},
        { t: 0.23, pose: () => {
          bodyPitchTarget = 14; bodyBobTarget = 3.2;
          set('Neck0', 22); set('Neck1', 14); set('Head', -12); set('Jaw', 64);
          W({ Shoulder: [8, -12, 0], Upper: [58, -2, 0], Fore: [34, -8, 0],
              F1: [24, 0, 0], F2: [20, 0, 0], F3: [15, 0, 0] });
          tuck(0.2); T(4, 22, 0.8);
        }},
        { t: 0.52, pose: () => {
          bodyPitchTarget = 10; bodyBobTarget = 2.6;
          set('Neck0', 16); set('Neck1', 10); set('Head', -8); set('Jaw', 56);
          W({ Shoulder: [6, -10, 0], Upper: [40, -6, 0], Fore: [20, -12, 0],
              F1: [16, 0, 0], F2: [13, 0, 0], F3: [10, 0, 0] });
          tuck(0.5); T(6, 18, 1.3);
        }},
        { t: 0.84, pose: () => {
          bodyPitchTarget = -4; bodyBobTarget = 0.6;
          set('Neck0', 6); set('Neck1', 4); set('Head', -2); set('Jaw', 34);
          W({ Shoulder: [-6, -12, 0], Upper: [-20, -20, 0], Fore: [-20, -32, 0],
              F1: [-10, -16, 0], F2: [-8, -12, 0], F3: [-6, -8, 0] });
          tuck(0.8); T(6, 12, 2.2);
        }},
        { t: 1, pose: () => {
          bodyPitchTarget = -6; bodyBobTarget = -0.8;
          set('Neck0', -7); set('Neck1', -4); set('Head', 6); set('Jaw', 12);
          W({ Shoulder: [-6, -8, 0], Upper: [-18, -28, 0], Fore: [-14, -42, 0],
              F1: [-7, -18, 0], F2: [-6, -13, 0], F3: [-5, -9, 0] });
          T(6, 6, 2.8);
        }},
      ],
    },

    Roar: {
      dur: 1.4,
      events: [{ t: 0.25, name: 'Roar' }],
      keys: [
        { t: 0, pose: () => {
          bodyPitchTarget = -8; bodyBobTarget = -0.6;
          set('Neck0', -10); set('Neck1', -7); set('Head', 8); set('Jaw', 8);
          W({ Shoulder: [-6, -8, 0], Upper: [-14, -28, 0], Fore: [-12, -40, 0],
              F1: [-6, -16, 0], F2: [-5, -12, 0], F3: [-4, -8, 0] });
          T(5, 6, 0.3);
        }},
        { t: 0.25, pose: () => {
          bodyPitchTarget = 9; bodyBobTarget = 1.5;
          set('Neck0', 18); set('Neck1', 12); set('Head', -10); set('Jaw', 62);
          W({ Shoulder: [6, -12, 0], Upper: [44, -8, 0], Fore: [22, -16, 0],
              F1: [16, -2, 0], F2: [13, -1, 0], F3: [10, 0, 0] });
          T(5, 14, 0.9);
        }},
        { t: 0.7, pose: () => {
          bodyPitchTarget = 5; bodyBobTarget = 0.9;
          set('Neck0', 10); set('Neck1', 6); set('Head', -4); set('Jaw', 52);
          W({ Shoulder: [2, -10, 0], Upper: [24, -14, 0], Fore: [8, -22, 0],
              F1: [10, -6, 0], F2: [8, -4, 0], F3: [6, -3, 0] });
          T(6, 10, 1.5);
        }},
        { t: 1, pose: () => {
          bodyPitchTarget = -4; bodyBobTarget = -0.3;
          set('Neck0', -6); set('Neck1', -3); set('Head', 5); set('Jaw', 10);
          W({ Shoulder: [-5, -8, 0], Upper: [-12, -28, 0], Fore: [-11, -40, 0],
              F1: [-6, -17, 0], F2: [-5, -12, 0], F3: [-4, -8, 0] });
          T(6, 5, 2.0);
        }},
      ],
    },
  };

  // ---------------- الحلقة ----------------
  function lerpKeys(keys, p) {
    let a = keys[0], b = keys[keys.length - 1];
    for (let i = 0; i < keys.length - 1; i++) {
      if (p >= keys[i].t && p <= keys[i + 1].t) { a = keys[i]; b = keys[i + 1]; break; }
    }
    const span = Math.max(1e-5, b.t - a.t);
    const alpha = Math.max(0, Math.min(1, (p - a.t) / span));
    return { a, b, alpha: alpha * alpha * (3 - 2 * alpha) };
  }

  function update(dt, opts = {}) {
    stateTime += dt;
    clear();
    bodyBobTarget = 0; bodyPitchTarget = 0; bodyYawTarget = 0;

    if (action) {
      const def = ACTIONS[action.name];
      action.t += dt;
      const p = Math.min(1, action.t / def.dur);

      // الأحداث
      for (const ev of def.events) {
        if (!action.fired[ev.name] && p >= ev.t) {
          action.fired[ev.name] = true;
          for (const cb of listeners) cb(action.name, ev.name);
        }
      }

      const { a, b, alpha } = lerpKeys(def.keys, p);
      a.pose();
      const poseA = {};
      for (const k in target) poseA[k] = target[k].clone();
      const bobA = bodyBobTarget, pitchA = bodyPitchTarget, yawA = bodyYawTarget;
      clear();
      bodyBobTarget = 0; bodyPitchTarget = 0; bodyYawTarget = 0;
      b.pose();
      // دمج
      for (const k in poseA) {
        if (target[k]) target[k].slerpQuaternions(poseA[k], target[k], alpha);
        else target[k] = poseA[k].clone();
      }
      for (const k in target) {
        if (!poseA[k]) { /* يفضل زي ما هو */ }
      }
      bodyBobTarget = bobA + (bodyBobTarget - bobA) * alpha;
      bodyPitchTarget = pitchA + (bodyPitchTarget - pitchA) * alpha;
      bodyYawTarget = yawA + (bodyYawTarget - yawA) * alpha;

      if (action.t >= def.dur) {
        action = null;
        for (const cb of listeners) cb(null, 'ActionEnd');
      }
    } else {
      switch (state) {
        case 'Walk': poseWalk((stateTime * 0.87) % 1, 15, 0.35, -2, 5, 11); break;
        case 'Run': poseWalk((stateTime * 1.6) % 1, 27, 0.8, -9, 10, 16); break;
        case 'Fly': poseFly((stateTime * 0.69) % 1); break;
        case 'Glide': poseGlide((stateTime * 0.17) % 1); break;
        default: poseIdle(stateTime); break;
      }
    }

    // تطبيق ناعم
    const k = action ? 16 : 8;
    const f = 1 - Math.exp(-k * dt);
    for (const name in bones) {
      const b = bones[name];
      const q = target[name] ? base[name].clone().multiply(target[name]) : base[name];
      b.quaternion.slerp(q, f);
    }
    // الجسم: بوب + ميل
    bodyBob += (bodyBobTarget - bodyBob) * Math.min(1, dt * 9);
    bodyPitch += (bodyPitchTarget - bodyPitch) * Math.min(1, dt * 9);
    bodyYaw += (bodyYawTarget - bodyYaw) * Math.min(1, dt * 9);
    dragon.body.position.y = 6.0 + bodyBob;
    _e.set(bodyPitch * D, bodyYaw * D, 0, EULER_ORDER);
    dragon.body.quaternion.setFromEuler(_e);
  }

  return {
    update,
    setState(s) { if (state !== s) { state = s; stateTime = 0; } },
    getState() { return state; },
    play(name) {
      if (!ACTIONS[name]) return false;
      action = { name, t: 0, dur: ACTIONS[name].dur, fired: {} };
      return true;
    },
    isPlaying() { return !!action; },
    onEvent(cb) { listeners.push(cb); },
  };
}
