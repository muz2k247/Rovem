import * as THREE from 'three';

/**
 * Build every shader the scene can use before the first frame. A shader is otherwise built the first time something that uses
 * it is drawn (a burst of sparks, the first splash, the first force arrow), which stalls that frame for 100 to 300 ms. The
 * scene is drawn once with everything shown and nothing culled, so the shaders for hidden or off-screen things are built too,
 * then everything is put back.
 */
export function warmShaders(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): void {
  const saved: { o: THREE.Object3D; visible: boolean; culled: boolean }[] = [];
  scene.traverse((o) => {
    saved.push({ o, visible: o.visible, culled: o.frustumCulled });
    o.visible = true;
    o.frustumCulled = false;
  });
  renderer.compile(scene, camera);
  renderer.render(scene, camera);
  for (const s of saved) {
    s.o.visible = s.visible;
    s.o.frustumCulled = s.culled;
  }
}
