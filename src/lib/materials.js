import * as THREE from 'three';
import {
  woodTexture, stoneTexture, roofTexture, signTexture, bannerTexture, boardTexture,
  windowTexture, rugTexture, crownTexture, glowTexture, sparkTexture,
} from './textures.js';

export const PALETTE = {
  ink: 0x07040a,
  red: 0xff1f3d,
  redDeep: 0x9c0d20,
  cloth: 0x8f0f1f,
  gold: 0xf2c163,
  goldDeep: 0x9a6a22,
  cream: 0xffe6c4,
  wood: 0x2a1613,
  ember: 0xff8a3c,
  crystal: 0x7fb2ff,
};

const tex = (canvas, { repeat = [1, 1], srgb = true, aniso = 4 } = {}) => {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso;
  return t;
};

let cache = null;

export function getMaterials() {
  if (cache) return cache;

  const woodDarkMap = tex(woodTexture({ base: '#241210', dark: '#0d0505', light: '#3d231a' }), { repeat: [1, 1] });
  const woodWallMap = tex(woodTexture({ base: '#20100f', dark: '#0b0404', light: '#40251b', planks: 7, horizontal: true, seed: 7 }), { repeat: [2, 1] });
  const stoneMap = tex(stoneTexture({ base: '#151016', tile: 128 }), { repeat: [4, 4] });
  const roofMap = tex(roofTexture(), { repeat: [3, 3] });
  const signMap = tex(signTexture(), { repeat: [1, 1] });
  const bannerMap = tex(bannerTexture(), { repeat: [1, 1] });
  const windowMap = tex(windowTexture(), { repeat: [1, 1] });
  const rugMap = tex(rugTexture(), { repeat: [1, 1] });
  const crownMap = tex(crownTexture(), { repeat: [1, 1] });
  const boardL = tex(boardTexture({ lines: ['Rare Items', 'Exclusive', 'Limited'] }), { repeat: [1, 1] });
  const boardR = tex(boardTexture({ lines: ['Better', 'Items', 'Bigger Power'] }), { repeat: [1, 1] });
  const glowMap = tex(glowTexture(), { repeat: [1, 1] });
  const sparkMap = tex(sparkTexture(), { repeat: [1, 1] });

  const M = {
    /* ---------------- wood & stone ---------------- */
    woodDark: new THREE.MeshStandardMaterial({ color: 0xbfae9f, map: woodDarkMap, roughness: 0.72, metalness: 0.08 }),
    woodWall: new THREE.MeshStandardMaterial({ color: 0xbb9a80, map: woodWallMap, roughness: 0.82, metalness: 0.05 }),
    woodBeam: new THREE.MeshStandardMaterial({ color: 0x8d5f47, map: woodDarkMap, roughness: 0.62, metalness: 0.1 }),
    woodTrim: new THREE.MeshStandardMaterial({ color: 0x6d3a2a, map: woodDarkMap, roughness: 0.55, metalness: 0.12 }),
    stone: new THREE.MeshStandardMaterial({ color: 0xa9a2b3, map: stoneMap, roughness: 0.88, metalness: 0.02 }),
    stoneDark: new THREE.MeshStandardMaterial({ color: 0x5d5666, map: stoneMap, roughness: 0.9, metalness: 0.04 }),
    rock: new THREE.MeshStandardMaterial({ color: 0x4a3f4f, roughness: 0.95, metalness: 0.02 }),
    ground: new THREE.MeshStandardMaterial({ color: 0x8a8296, map: stoneMap, roughness: 0.42, metalness: 0.35, envMapIntensity: 0.9 }),

    /* ---------------- metals ---------------- */
    gold: new THREE.MeshStandardMaterial({ color: 0xf2c163, roughness: 0.24, metalness: 1, envMapIntensity: 1.6 }),
    goldDark: new THREE.MeshStandardMaterial({ color: 0x9a6a22, roughness: 0.42, metalness: 1, envMapIntensity: 1.2 }),
    iron: new THREE.MeshStandardMaterial({ color: 0x2b2630, roughness: 0.45, metalness: 0.9 }),

    /* ---------------- cloth ---------------- */
    cloth: new THREE.MeshStandardMaterial({ color: 0xffffff, map: bannerMap, roughness: 0.92, metalness: 0.0, side: THREE.DoubleSide, alphaTest: 0.35 }),
    rug: new THREE.MeshStandardMaterial({ color: 0xffffff, map: rugMap, roughness: 0.95 }),
    crownDecal: new THREE.MeshStandardMaterial({ color: 0xffffff, map: crownMap, transparent: true, roughness: 0.4, metalness: 0.6, emissive: 0xff9a3c, emissiveIntensity: 0.25, depthWrite: false }),

    /* ---------------- sign ---------------- */
    sign: new THREE.MeshStandardMaterial({
      map: signMap, transparent: true, alphaTest: 0.12,
      roughness: 0.42, metalness: 0.35,
      emissive: 0xffffff, emissiveMap: signMap, emissiveIntensity: 0.62,
      side: THREE.DoubleSide,
    }),
    signBack: new THREE.MeshStandardMaterial({ color: 0x120a0e, roughness: 0.7, metalness: 0.3 }),

    /* ---------------- emissive ---------------- */
    neonRed: new THREE.MeshStandardMaterial({ color: 0x2a0503, emissive: 0xff2a1e, emissiveIntensity: 1.15, roughness: 0.4, metalness: 0.1 }),
    neonSoft: new THREE.MeshStandardMaterial({ color: 0x3a0504, emissive: 0xff3524, emissiveIntensity: 0.95, roughness: 0.5 }),
    neonGlow: new THREE.MeshStandardMaterial({ color: 0x3a0a02, emissive: 0xff5a24, emissiveIntensity: 1.55, roughness: 0.45, metalness: 0.2 }),
    window: new THREE.MeshStandardMaterial({ color: 0x110806, map: windowMap, emissive: 0xffd0a0, emissiveMap: windowMap, emissiveIntensity: 0.62, roughness: 0.6 }),
    amber: new THREE.MeshStandardMaterial({ color: 0x3a1a06, emissive: 0xff8a35, emissiveIntensity: 1.25, roughness: 0.5 }),
    amberDim: new THREE.MeshStandardMaterial({ color: 0x2a1205, emissive: 0xff7a2a, emissiveIntensity: 0.9, roughness: 0.6 }),
    crystalRed: new THREE.MeshStandardMaterial({ color: 0x5c0010, emissive: 0xff2a34, emissiveIntensity: 2.2, roughness: 0.25, metalness: 0.3, transparent: true, opacity: 0.95 }),
    crystalBlue: new THREE.MeshStandardMaterial({ color: 0x0a1a3a, emissive: 0x5f9dff, emissiveIntensity: 2.2, roughness: 0.2, metalness: 0.4, transparent: true, opacity: 0.95 }),
    potion: new THREE.MeshStandardMaterial({ color: 0x220a20, emissive: 0xa855ff, emissiveIntensity: 1.6, roughness: 0.3 }),
    potionGold: new THREE.MeshStandardMaterial({ color: 0x2a1a05, emissive: 0xffb347, emissiveIntensity: 1.7, roughness: 0.3 }),

    /* ---------------- signs / decals ---------------- */
    boardLeft: new THREE.MeshStandardMaterial({ color: 0xffffff, map: boardL, roughness: 0.8, emissive: 0xffc07a, emissiveIntensity: 0.12 }),
    boardRight: new THREE.MeshStandardMaterial({ color: 0xffffff, map: boardR, roughness: 0.8, emissive: 0xffc07a, emissiveIntensity: 0.12 }),

    /* ---------------- sprites ---------------- */
    glowSprite: new THREE.SpriteMaterial({ map: glowMap, color: 0xff5a4a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85 }),
    glowSpriteGold: new THREE.SpriteMaterial({ map: glowMap, color: 0xffc06a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.75 }),
    spark: new THREE.SpriteMaterial({ map: sparkMap, color: 0xffe0c0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9 }),

    /* ---------------- foliage ---------------- */
    leafDark: new THREE.MeshStandardMaterial({ color: 0x1d3b33, roughness: 0.85, metalness: 0.05, side: THREE.DoubleSide }),
    leafTeal: new THREE.MeshStandardMaterial({ color: 0x2c5f52, roughness: 0.8, side: THREE.DoubleSide }),
    flowerRed: new THREE.MeshStandardMaterial({ color: 0x8a1420, emissive: 0x5a0610, emissiveIntensity: 0.5, roughness: 0.8 }),

    /* ---------------- textures kept for later use ---------------- */
    _textures: { signMap, bannerMap, glowMap, sparkMap, crownMap, roofMap },
    roofMat: new THREE.MeshStandardMaterial({ color: 0xdcd8e6, map: roofMap, roughness: 0.34, metalness: 0.65, envMapIntensity: 1.8 }),
    roofUnder: new THREE.MeshStandardMaterial({ color: 0x3c2836, roughness: 0.85, metalness: 0.25, side: THREE.DoubleSide }),
  };

  cache = M;
  return M;
}

export function disposeMaterials() {
  if (!cache) return;
  Object.values(cache).forEach((m) => { if (m && m.dispose) m.dispose(); });
  cache = null;
}
