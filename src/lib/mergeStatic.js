import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * تجميع الأجزاء الثابتة حسب الخامة يقلل عدد طلبات الرسم على الموبايل.
 * الأجزاء المتحركة والشفافة والـ InstancedMesh تبقى مستقلة كما هي.
 */
export function mergeStaticMeshes(root) {
  root.updateMatrixWorld(true);
  const rootInverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();

  function collect(object, dynamic = false) {
    const isDynamic = dynamic || !!object.userData.dynamic || !!object.userData.sway;
    if (!isDynamic && object.isMesh && !object.isInstancedMesh && !Array.isArray(object.material)
        && !object.material.transparent && object.geometry.getAttribute('position')
        && object.geometry.getAttribute('normal') && object.geometry.getAttribute('uv')) {
      const list = buckets.get(object.material) || [];
      list.push(object);
      buckets.set(object.material, list);
    }
    for (const child of object.children) collect(child, isDynamic);
  }
  collect(root);

  for (const [material, meshes] of buckets) {
    if (meshes.length < 3) continue;
    const geometries = meshes.map((mesh) => {
      const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      // كل الخامات المستخدمة هنا تحتاج position وnormal وuv فقط.
      for (const name of Object.keys(geometry.attributes)) {
        if (!['position', 'normal', 'uv'].includes(name)) geometry.deleteAttribute(name);
      }
      geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(rootInverse, mesh.matrixWorld));
      return geometry;
    });
    const geometry = mergeGeometries(geometries);
    geometries.forEach((part) => part.dispose());
    if (!geometry) continue;
    const merged = new THREE.Mesh(geometry, material);
    merged.castShadow = meshes.some((mesh) => mesh.castShadow);
    merged.receiveShadow = meshes.some((mesh) => mesh.receiveShadow);
    root.add(merged);
    meshes.forEach((mesh) => mesh.removeFromParent());
  }
}
