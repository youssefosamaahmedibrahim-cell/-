import * as THREE from 'three';
import { createShop } from './shop.js';
import { createSurroundings, createWaterfall } from './surroundings.js';
import { createAtmosphere, createEnvironment } from './atmosphere.js';

/* زوايا الكاميرا الجاهزة */
export const VIEWS = {
  hero: { pos: [20.5, 13.5, 36], target: [0, 10.4, 0.5], fov: 40 },
  front: { pos: [0.6, 11, 38], target: [0, 10.2, 0], fov: 36 },
  side: { pos: [31, 12.5, 17], target: [2, 9.5, 0], fov: 40 },
  roof: { pos: [17, 23, 24], target: [0, 12.8, 0], fov: 40 },
  closeup: { pos: [6.5, 6.6, 18.5], target: [0, 8.2, 2], fov: 44 },
  inside: { pos: [0, 4.4, 8.2], target: [0, 4.3, -5], fov: 62 },
  top: { pos: [2, 40, 20], target: [0, 7, 0], fov: 42 },
  shopFront: { pos: [0, 8.0, 27], target: [0, 8.2, 0], fov: 42 },
  crest: { pos: [7.5, 18.2, 17.5], target: [0, 16.4, 7.2], fov: 34 },
  waterfall: { pos: [-7, 7, 20], target: [-19, 5.5, 6], fov: 44 },
};

export function createWorld(renderer) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x090405, 0.0062);

  /* ---------------- البيئة ---------------- */
  if (renderer) {
    scene.environment = createEnvironment(renderer);
    scene.environmentIntensity = 0.75;
  }

  /* ---------------- الإضاءة ---------------- */
  const hemi = new THREE.HemisphereLight(0x3c1626, 0x050308, 0.32);
  scene.add(hemi);

  const moon = new THREE.DirectionalLight(0x9d7cc4, 0.78);
  moon.position.set(-22, 38, 26);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.near = 1;
  moon.shadow.camera.far = 120;
  moon.shadow.camera.left = -38;
  moon.shadow.camera.right = 38;
  moon.shadow.camera.top = 44;
  moon.shadow.camera.bottom = -14;
  moon.shadow.bias = -0.0006;
  moon.shadow.normalBias = 0.03;
  scene.add(moon);

  const rim = new THREE.DirectionalLight(0xff4a3a, 0.3);
  rim.position.set(6, 6, -30);
  scene.add(rim);

  const front = new THREE.DirectionalLight(0xff8a5a, 0.22);
  front.position.set(4, 4, 40);
  scene.add(front);

  /* ---------------- العالم ---------------- */
  const atmosphere = createAtmosphere();
  atmosphere.group.name = 'atmosphere';
  scene.add(atmosphere.group);

  const surroundings = createSurroundings();
  surroundings.group.name = 'surroundings';
  scene.add(surroundings.group);

  const waterfall = createWaterfall();
  waterfall.group.name = 'waterfall';
  scene.add(waterfall.group);

  const shop = createShop();
  shop.group.name = 'shop';
  scene.add(shop.group);

  /* ---------------- إضاءة الواجهة (لمسات دافئة) ---------------- */
  const facadeLights = [];
  for (const [x, y, z, color, intensity, dist] of [
    [-6.8, 4.4, 10.6, 0xff7a30, 34, 15],
    [6.8, 4.4, 10.6, 0xff7a30, 34, 15],
    [-11.6, 9.2, 9.6, 0xff2018, 24, 13],
    [11.6, 9.2, 9.6, 0xff2018, 24, 13],
    [0, 9.8, 3.4, 0xff9040, 30, 15],
    [0, 3.6, 13.0, 0xffb070, 20, 11],
  ]) {
    const l = new THREE.PointLight(color, intensity, dist, 2);
    l.position.set(x, y, z);
    scene.add(l);
    facadeLights.push(l);
  }

  /* ---------------- كشافات على الواجهة والسقف ---------------- */
  const spotFront = new THREE.SpotLight(0xffd0a0, 320, 60, Math.PI / 5.2, 0.55, 1.6);
  spotFront.position.set(0, 24, 34);
  spotFront.target.position.set(0, 8, 2);
  scene.add(spotFront, spotFront.target);

  const spotSide = new THREE.SpotLight(0xff8a5a, 180, 60, Math.PI / 4.6, 0.7, 1.6);
  spotSide.position.set(-26, 20, 20);
  spotSide.target.position.set(-6, 8, 0);
  scene.add(spotSide, spotSide.target);

  const spotRoof = new THREE.SpotLight(0xb98cff, 200, 60, Math.PI / 5, 0.8, 1.6);
  spotRoof.position.set(18, 30, 18);
  spotRoof.target.position.set(0, 15, 0);
  scene.add(spotRoof, spotRoof.target);

  /* ---------------- إضاءة الشعار العلوي ---------------- */
  const crestLightA = new THREE.PointLight(0xff2a18, 22, 7, 2);
  crestLightA.position.set(0, 17.0, 9.8);
  scene.add(crestLightA);

  /* ---------------- إضاءة درامية إضافية ---------------- */
  const signLight = new THREE.PointLight(0xff3a24, 26, 20, 2);
  signLight.position.set(0, 13.5, 11);
  scene.add(signLight);

  const porchLight = new THREE.PointLight(0xff8a4a, 40, 20, 2);
  porchLight.position.set(0, 5.5, 10.5);
  scene.add(porchLight);

  const roofLight = new THREE.PointLight(0xff3a28, 16, 16, 2);
  roofLight.position.set(0, 15.2, 8.5);
  scene.add(roofLight);

  const update = (t, dt) => {
    atmosphere.update(t, dt);
    surroundings.update(t, dt);
    waterfall.update(t, dt);
    shop.update(t, dt);
    signLight.intensity = 24 + Math.sin(t * 2.3) * 4;
    roofLight.intensity = 15 + Math.sin(t * 1.1 + 1) * 3;
  };

  return { scene, update, shop, lights: { hemi, moon, rim, front, signLight, porchLight, roofLight, facadeLights } };
}
