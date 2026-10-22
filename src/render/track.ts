import * as THREE from 'three';
import type { Polyline, RoadGeometry, LevelWorld } from '../game/level/world.ts';
import { pointAt } from './roadLine.ts';
import { drawnHeightM } from './terrain.ts';

// The roads' furniture in the level scene (LEVELS_BUILD_PLAN A7, A9): the dashes down the middle of asphalt and the reflector
// posts along the edges. Marks follow the ground. (The canyon walls that stood at the edge of the run-off are gone since R6b: what
// stands beyond the edge is drawn by levelEdgeScene.ts, SHOWCASE_PLAN §12a.)

export const DASH_PERIOD_M = 8;
const DASH_LENGTH_M = 3;
const DASH_WIDTH_M = 0.25;
const DASH_LIFT_M = 0.07;
const POST_PERIOD_M = { high: 16, low: 32 } as const;
const POST_SETBACK_M = 0.4;
const POST_HEIGHT_M = 0.9;

export { pointAt };

/** The heading in radians of a road at a distance along it. */
export const directionAt = (line: Polyline, alongM: number): number => pointAt(line, alongM).headingRad;

const reachOf = (road: RoadGeometry): number => road.widthM / 2 + road.runoffM;

/** Is this point inside the reach (road plus run-off) of any road other than `road`? */
function coveredByOther(world: LevelWorld, road: RoadGeometry, xM: number, zM: number): boolean {
  return world.roads.some((r) => r !== road && r.line.nearest(xM, zM, reachOf(r)) !== undefined);
}

export interface DashMark {
  xM: number;
  zM: number;
  headingRad: number;
}

export function roadMarks(world: LevelWorld, quality: 'high' | 'low' = 'high'): { dashes: DashMark[]; posts: { xM: number; zM: number }[] } {
  const dashes: DashMark[] = [];
  const posts: { xM: number; zM: number }[] = [];
  for (const road of world.roads) {
    const line = road.line;
    if (road.surfaceId === 'asphalt') {
      for (let s = DASH_PERIOD_M / 2; s < line.lengthM; s += DASH_PERIOD_M) {
        const p = pointAt(line, s);
        dashes.push({ xM: p.xM, zM: p.zM, headingRad: p.headingRad });
      }
    }
    const period = POST_PERIOD_M[quality];
    for (let s = period / 2; s < line.lengthM; s += period) {
      const p = pointAt(line, s);
      for (const side of [1, -1]) {
        const off = (road.widthM / 2 + POST_SETBACK_M) * side;
        const x = p.xM - Math.sin(p.headingRad) * off;
        const z = p.zM + Math.cos(p.headingRad) * off;
        if (!coveredByOther(world, road, x, z)) posts.push({ xM: x, zM: z });
      }
    }
  }
  return { dashes, posts };
}

export interface Track {
  group: THREE.Group;
  dispose(): void;
}

export function createTrack(world: LevelWorld, options: { quality: 'high' | 'low' }): Track {
  const group = new THREE.Group();
  group.name = 'track';
  const { dashes, posts } = roadMarks(world, options.quality);
  const dashGeometry = new THREE.BoxGeometry(DASH_LENGTH_M, 0.03, DASH_WIDTH_M);
  const dashMaterial = new THREE.MeshStandardMaterial({ color: 0xe9e4d2, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const dashMesh = new THREE.InstancedMesh(dashGeometry, dashMaterial, dashes.length);
  dashMesh.name = 'dashes';
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler(0, 0, 0, 'YZX');
  dashes.forEach((d, i) => {
    e.set(0, d.headingRad, world.slopeRad(d.xM, d.zM, d.headingRad), 'YZX');
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(d.xM, drawnHeightM(world, d.xM, d.zM) + DASH_LIFT_M, -d.zM), q, new THREE.Vector3(1, 1, 1));
    dashMesh.setMatrixAt(i, m);
  });
  dashMesh.instanceMatrix.needsUpdate = true;
  group.add(dashMesh);

  const postGeometry = new THREE.BoxGeometry(0.14, POST_HEIGHT_M, 0.14);
  const postMaterial = new THREE.MeshStandardMaterial({ color: 0xe0703c, emissive: 0x3a1a08, flatShading: true });
  const postMesh = new THREE.InstancedMesh(postGeometry, postMaterial, posts.length);
  postMesh.name = 'posts';
  posts.forEach((p, i) => {
    m.makeTranslation(p.xM, drawnHeightM(world, p.xM, p.zM) + POST_HEIGHT_M / 2, -p.zM);
    postMesh.setMatrixAt(i, m);
  });
  postMesh.instanceMatrix.needsUpdate = true;
  group.add(postMesh);

  return {
    group,
    dispose() {
      dashGeometry.dispose();
      dashMaterial.dispose();
      dashMesh.dispose();
      postGeometry.dispose();
      postMaterial.dispose();
      postMesh.dispose();
    },
  };
}
