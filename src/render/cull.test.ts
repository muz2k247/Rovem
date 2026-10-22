import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { cullByDistance, FOG_HIDDEN_SHARE, fogRangeM } from './cull.ts';
import { createLevelEdges } from './levelEdgeScene.ts';
import { worldOf } from './levelTestKit.ts';
import { createTerrain } from './terrain.ts';

const box = (x: number, y: number, z: number) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(10, 2, 10));
  mesh.geometry.translate(x, y, z);
  return mesh;
};

describe('drawing only what the fog has not hidden', () => {
  it('the fog range is where exponential-squared fog covers 99% of an object', () => {
    const density = 0.006;
    const d = fogRangeM(density);
    expect(1 - Math.exp(-((d * density) ** 2))).toBeCloseTo(FOG_HIDDEN_SHARE, 9);
    expect(d).toBeGreaterThan(300);
    expect(fogRangeM(0.013)).toBeLessThan(fogRangeM(0.006)); // thicker fog hides sooner
  });

  it('hides a mesh whose sphere lies wholly beyond the range and shows the rest, in scene axes', () => {
    const near = box(10, 0, -20); // three z = −20 is physics z = 20
    const far = box(500, 0, 0);
    const behind = box(10, 0, 300);
    const shown = cullByDistance([near, far, behind], 0, -20, 100);
    expect(shown).toBe(1);
    expect(near.visible).toBe(true);
    expect(far.visible).toBe(false);
    expect(behind.visible).toBe(false);
    cullByDistance([near, far, behind], 400, 0, 120); // the camera moved: the far one is back
    expect(far.visible).toBe(true);
    expect(near.visible).toBe(false);
  });

  it('the ground near the camera stays drawn where a level\'s road bends to positive physics z', () => {
    // A mirrored z would hide the ground under the rover here: the bend ends at physics z > 0, which is three z < 0.
    const world = worldOf();
    const end = world.roads[1]!.line.points.at(-1)!;
    expect(end.zM).toBeGreaterThan(10);
    const terrain = createTerrain(world, { quality: 'low' });
    const edges = createLevelEdges(world, { quality: 'low' });
    terrain.update(end.xM, -end.zM, 60);
    edges.update(end.xM, -end.zM, 60, 60);
    const drawn: THREE.Box3[] = [];
    terrain.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.visible && m.name.endsWith('ile')) drawn.push(m.geometry.boundingBox ?? (m.geometry.computeBoundingBox(), m.geometry.boundingBox!));
    });
    const at = (x: number, z: number) => drawn.some((b) => b.min.x <= x && x <= b.max.x && b.min.z <= z && z <= b.max.z);
    expect(at(end.xM, -end.zM)).toBe(true); // the ground under the camera
    expect(at(20, 0)).toBe(false); // the far start of the road is hidden
    expect(drawn.length).toBeGreaterThan(0);
    terrain.dispose();
    edges.dispose();
  });
});
