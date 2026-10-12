import * as THREE from 'three';

/** Builds the M1 placeholder scene: one cube lit by a single light. */
export function createPlaceholderScene(): { scene: THREE.Scene; cube: THREE.Mesh } {
  const scene = new THREE.Scene();
  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xc1440e }),
  );
  scene.add(cube);
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(3, 4, 5);
  scene.add(sun);
  return { scene, cube };
}
