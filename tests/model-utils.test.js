import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { mergeStaticMeshes } from '../src/lib/mergeStatic.js';
import { alphaBounds } from '../src/lib/alphaBounds.js';

test('static batching preserves world-space bounds and keeps animated/transparent meshes independent', () => {
  const root = new THREE.Group();
  root.position.set(5, 2, -1);
  root.scale.set(0.92, 1, 0.97);
  const opaque = new THREE.MeshStandardMaterial();
  const transparent = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.5 });
  const group = new THREE.Group();
  group.position.set(1, 2, 3);
  root.add(group);
  for (const x of [-2, 0, 3]) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), opaque);
    mesh.position.set(x, x / 2, 0);
    group.add(mesh);
  }
  const animated = new THREE.Group();
  animated.userData.dynamic = true;
  const moving = new THREE.Mesh(new THREE.BoxGeometry(), opaque);
  animated.add(moving);
  root.add(animated);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(), transparent);
  root.add(glass);
  root.updateMatrixWorld(true);
  const before = new THREE.Box3().setFromObject(root);
  mergeStaticMeshes(root);
  root.updateMatrixWorld(true);
  const after = new THREE.Box3().setFromObject(root);
  assert.ok(before.min.distanceTo(after.min) < 1e-5);
  assert.ok(before.max.distanceTo(after.max) < 1e-5);
  assert.equal(group.children.length, 0);
  assert.equal(animated.children[0], moving);
  assert.equal(glass.parent, root);
  assert.equal(root.children.filter((child) => child.isMesh && child.material === opaque).length, 1);
});

test('small batches are left alone', () => {
  const root = new THREE.Group();
  const material = new THREE.MeshBasicMaterial();
  const one = new THREE.Mesh(new THREE.BoxGeometry(), material);
  const two = new THREE.Mesh(new THREE.BoxGeometry(), material);
  root.add(one, two);
  mergeStaticMeshes(root);
  assert.equal(root.children.length, 2);
  assert.equal(one.parent, root);
  assert.equal(two.parent, root);
});

test('transparent export bounds ignore clear pixels and preserve the image edges', () => {
  const width = 5, height = 4;
  const pixels = new Uint8Array(width * height * 4);
  const setAlpha = (x, y, alpha) => { pixels[(y * width + x) * 4 + 3] = alpha; };
  assert.equal(alphaBounds(pixels, width, height), null);
  setAlpha(0, 0, 1);
  setAlpha(1, 1, 255);
  setAlpha(4, 3, 2);
  assert.deepEqual(alphaBounds(pixels, width, height), { left: 1, top: 1, right: 4, bottom: 3 });
  assert.deepEqual(alphaBounds(pixels, width, height, 0), { left: 0, top: 0, right: 4, bottom: 3 });
});
