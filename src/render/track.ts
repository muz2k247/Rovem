import * as THREE from 'three';
import type { Polyline, RoadGeometry, LevelWorld } from '../game/level/world.ts';
import { drawnHeightM } from './terrain.ts';

// The roads' furniture in the level scene (LEVELS_BUILD_PLAN A7, A9): the canyon walls that stand at the edge of the
// run-off, the dashes down the middle of asphalt and the reflector posts along the edges. Walls and marks follow the
// ground, and the walls stop where another road joins, so a fork opens up where it should. Presentation only: the walls
// the rover crashes into are `world.hit`; these are drawn to match that rule (a wall is anywhere past every road and its run-off).

export const WALL_HEIGHT_M = 6;
/** Walls reach this far below the ground, so a bumpy slope never shows a gap under them. */
const WALL_FOOT_M = 0.8;
const WALL_STEP_M = { high: 3, low: 5 } as const;
export const DASH_PERIOD_M = 8;
const DASH_LENGTH_M = 3;
const DASH_WIDTH_M = 0.25;
const DASH_LIFT_M = 0.07;
const POST_PERIOD_M = { high: 16, low: 32 } as const;
const POST_SETBACK_M = 0.4;
const POST_HEIGHT_M = 0.9;

export interface Span {
  ax: number;
  az: number;
  bx: number;
  bz: number;
}

/** The point, and the heading in radians, at a distance along a polyline. */
export function pointAt(line: Polyline, alongM: number): { xM: number; zM: number; headingRad: number } {
  const pts = line.points;
  const s = Math.max(0, Math.min(line.lengthM, alongM));
  let lo = 0;
  let hi = pts.length - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (line.alongAt[mid]! <= s) lo = mid;
    else hi = mid - 1;
  }
  const a = pts[lo]!;
  const b = pts[lo + 1]!;
  const len = line.alongAt[lo + 1]! - line.alongAt[lo]!;
  const t = len === 0 ? 0 : (s - line.alongAt[lo]!) / len;
  return { xM: a.xM + (b.xM - a.xM) * t, zM: a.zM + (b.zM - a.zM) * t, headingRad: Math.atan2(b.zM - a.zM, b.xM - a.xM) };
}

/** The heading in radians of a road at a distance along it. */
export const directionAt = (line: Polyline, alongM: number): number => pointAt(line, alongM).headingRad;

const reachOf = (road: RoadGeometry): number => road.widthM / 2 + road.runoffM;

/** Is this point inside the reach (road plus run-off) of any road other than `road`? */
function coveredByOther(world: LevelWorld, road: RoadGeometry, xM: number, zM: number): boolean {
  return world.roads.some((r) => r !== road && r.line.nearest(xM, zM, reachOf(r)) !== undefined);
}

export function canyonWallSpans(world: LevelWorld, stepM: number = WALL_STEP_M.high): { sides: Span[]; caps: Span[] } {
  const sides: Span[] = [];
  const caps: Span[] = [];
  for (const road of world.roads) {
    const reach = reachOf(road);
    const line = road.line;
    const steps = Math.max(1, Math.ceil(line.lengthM / stepM));
    for (const side of [1, -1]) {
      let prev: { x: number; z: number } | undefined;
      for (let i = 0; i <= steps; i++) {
        const p = pointAt(line, (line.lengthM * i) / steps);
        const nx = -Math.sin(p.headingRad) * side;
        const nz = Math.cos(p.headingRad) * side;
        const cur = { x: p.xM + nx * reach, z: p.zM + nz * reach };
        if (prev) {
          const mx = (prev.x + cur.x) / 2 + nx * 0.6;
          const mz = (prev.z + cur.z) / 2 + nz * 0.6;
          if (!coveredByOther(world, road, mx, mz)) sides.push({ ax: prev.x, az: prev.z, bx: cur.x, bz: cur.z });
        }
        prev = cur;
      }
    }
    // The two ends: a wall round the end of the road, unless another road carries on from it.
    for (const end of ['start', 'end'] as const) {
      const p = pointAt(line, end === 'start' ? 0 : line.lengthM);
      const dir = end === 'start' ? -1 : 1;
      const dx = Math.cos(p.headingRad) * dir;
      const dz = Math.sin(p.headingRad) * dir;
      if (coveredByOther(world, road, p.xM + dx, p.zM + dz)) continue;
      const nx = -Math.sin(p.headingRad);
      const nz = Math.cos(p.headingRad);
      const pt = (along: number, across: number) => ({ x: p.xM + dx * along + nx * across, z: p.zM + dz * along + nz * across });
      const [a, b, c, d] = [pt(0, reach), pt(reach, reach), pt(reach, -reach), pt(0, -reach)];
      for (const [from, to] of [[a, b], [b, c], [c, d]] as const) caps.push({ ax: from.x, az: from.z, bx: to.x, bz: to.z });
    }
  }
  return { sides, caps };
}

const WALL_COLOUR = new THREE.Color(0xa65a38);

/** All the wall spans as one mesh geometry: a vertical strip per span, darker at the foot. */
export function buildCanyonWalls(world: LevelWorld, stepM: number = WALL_STEP_M.high): THREE.BufferGeometry {
  const { sides, caps } = canyonWallSpans(world, stepM);
  const spans = [...sides, ...caps];
  const positions = new Float32Array(spans.length * 4 * 3);
  const colours = new Float32Array(spans.length * 4 * 3);
  const indices: number[] = [];
  spans.forEach((s, i) => {
    const ya = drawnHeightM(world, s.ax, s.az);
    const yb = drawnHeightM(world, s.bx, s.bz);
    positions.set([s.ax, ya - WALL_FOOT_M, -s.az, s.bx, yb - WALL_FOOT_M, -s.bz, s.bx, yb + WALL_HEIGHT_M, -s.bz, s.ax, ya + WALL_HEIGHT_M, -s.az], i * 12);
    for (let k = 0; k < 4; k++) {
      const shade = k < 2 ? 0.55 : 1;
      colours.set([WALL_COLOUR.r * shade, WALL_COLOUR.g * shade, WALL_COLOUR.b * shade], (i * 4 + k) * 3);
    }
    const o = i * 4;
    indices.push(o, o + 1, o + 2, o, o + 2, o + 3);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
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
  const wallGeometry = buildCanyonWalls(world, WALL_STEP_M[options.quality]);
  const wallMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
  const walls = new THREE.Mesh(wallGeometry, wallMaterial);
  walls.name = 'canyonWall';
  walls.castShadow = options.quality === 'high';
  group.add(walls);

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
      wallGeometry.dispose();
      wallMaterial.dispose();
      dashGeometry.dispose();
      dashMaterial.dispose();
      dashMesh.dispose();
      postGeometry.dispose();
      postMaterial.dispose();
      postMesh.dispose();
    },
  };
}
