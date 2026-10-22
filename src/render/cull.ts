import * as THREE from 'three';

// Drawing only what can be seen (R6b follow-up, frame time). Fog hides distant things: past FOG_HIDDEN_SHARE of fog a thing is
// the colour of the fog, so it need not be drawn at all. Meshes here sit at the origin with their points in world coordinates,
// so a mesh's bounding sphere is already in the world.

/** The share of fog at which an object is taken to be fog-coloured. */
export const FOG_HIDDEN_SHARE = 0.99;

/** The distance at which exponential-squared fog (FogExp2) covers FOG_HIDDEN_SHARE of an object: 1 − exp(−(d·density)²). */
export function fogRangeM(density: number): number {
  return Math.sqrt(-Math.log(1 - FOG_HIDDEN_SHARE)) / density;
}

/** Hide each mesh whose bounding sphere lies wholly beyond `rangeM` of the point (x, z) in scene axes (horizontal distance), show the rest. Returns how many are shown. */
export function cullByDistance(meshes: readonly THREE.Mesh[], xM: number, zM: number, rangeM: number): number {
  let shown = 0;
  for (const mesh of meshes) {
    const sphere = mesh instanceof THREE.InstancedMesh ? (mesh.boundingSphere ?? (mesh.computeBoundingSphere(), mesh.boundingSphere)) : (mesh.geometry.boundingSphere ?? (mesh.geometry.computeBoundingSphere(), mesh.geometry.boundingSphere));
    if (!sphere) continue;
    mesh.visible = Math.hypot(sphere.center.x - xM, sphere.center.z - zM) - sphere.radius <= rangeM;
    if (mesh.visible) shown++;
  }
  return shown;
}

/** How far from the camera the rocks along the edges are drawn (they are small; presentation). */
export const ROCK_RANGE_M = { high: 200, low: 140 } as const;
