import * as THREE from 'three';

// Giving the graphics memory back when a screen with a 3D view is left (R10; AUDIT_R9 A2). Every level visit, retry and Endless run
// makes its own WebGLRenderer, and `renderer.dispose()` alone leaves its WebGL context alive until the browser's garbage collector
// gets to the canvas: 12 contexts and about 17 MB of private memory per visit were left behind in the R9 leak test, and Chrome
// allows only 16 live contexts. `forceContextLoss()` frees the context at once.

/** Disposes the geometries, materials and textures of everything under `root` (the object itself included). Safe to call twice. */
export function disposeTree(root: THREE.Object3D): void {
  root.traverse((o) => {
    if (o instanceof THREE.InstancedMesh) o.dispose();
    const geometry = (o as { geometry?: THREE.BufferGeometry }).geometry;
    geometry?.dispose();
    const material = (o as { material?: THREE.Material | THREE.Material[] }).material;
    for (const m of Array.isArray(material) ? material : material ? [material] : []) disposeMaterial(m);
  });
}

function disposeMaterial(m: THREE.Material): void {
  for (const value of Object.values(m)) if (value instanceof THREE.Texture) value.dispose();
  const uniforms = (m as { uniforms?: Record<string, { value: unknown }> }).uniforms;
  if (uniforms) for (const u of Object.values(uniforms)) if (u.value instanceof THREE.Texture) u.value.dispose();
  m.dispose();
}

/** Stops the renderer's loop, frees its GPU memory and its context, and takes its canvas out of the page. */
export function releaseRenderer(renderer: THREE.WebGLRenderer): void {
  renderer.setAnimationLoop(null);
  renderer.dispose();
  renderer.forceContextLoss();
  renderer.domElement.remove();
}
