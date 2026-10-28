import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createShop } from './shop.js';

// كل الزوايا تدور حول الموديل نفسه، بدون مشهد أو أرضية خارجية.
export const VIEWS = {
  hero: { pos: [22, 16.5, 48], target: [0, 8.1, 0], fov: 37 },
  front: { pos: [0, 12.5, 50], target: [0, 8.1, 0], fov: 37 },
  side: { pos: [43, 16, 28], target: [0, 8.2, 0], fov: 39 },
  roof: { pos: [24, 29, 38], target: [0, 7.5, 0], fov: 46 },
  inside: { pos: [0, 4.6, 7.7], target: [0, 4.2, -5], fov: 60 },
  top: { pos: [0, 49, 12], target: [0, 7.5, 1.5], fov: 43 },
};

export function createWorld(renderer) {
  const scene = new THREE.Scene();
  // خريطة انعكاس للذهب فقط: لا توجد سماء أو خلفية مرسومة في المشهد.
  if (renderer) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    scene.environment = pmrem.fromScene(room, 0.04).texture;
    scene.environmentIntensity = 0.65;
    room.dispose();
    pmrem.dispose();
  }

  const hemi = new THREE.HemisphereLight(0xffe6d5, 0x514554, 1.2);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffdfc4, 2.6);
  key.position.set(-18, 30, 28);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { near: 1, far: 100, left: -25, right: 25, top: 26, bottom: -20 });
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.035;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xc3d4ff, 1.0);
  fill.position.set(24, 16, 20);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xff5c43, 1.45);
  rim.position.set(-8, 20, -24);
  scene.add(rim);

  const front = new THREE.DirectionalLight(0xffbe91, 0.65);
  front.position.set(0, 9, 34);
  scene.add(front);

  const shop = createShop();
  scene.add(shop.group);

  // الإضاءة مرتبطة بالمبنى نفسه لإبراز المدخل واللافتة من غير مؤثرات في الخلفية.
  const lamps = [];
  for (const [x, y, z, color, intensity, distance] of [
    [-6.5, 5, 9, 0xff6b32, 35, 13],
    [6.5, 5, 9, 0xff6b32, 35, 13],
    [0, 10.8, 10.5, 0xff5141, 22, 15],
    [0, 4.7, 7.2, 0xffad68, 26, 12],
  ]) {
    const light = new THREE.PointLight(color, intensity, distance, 2);
    light.position.set(x, y, z);
    scene.add(light);
    lamps.push(light);
  }

  return {
    scene,
    shop,
    update: (time, dt) => shop.update(time, dt),
    lights: { hemi, key, fill, rim, front, lamps },
  };
}
