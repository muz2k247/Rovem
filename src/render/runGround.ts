import * as THREE from 'three';
import type { CourseChunk, RunCourse } from '../game/run/course.ts';
import { BARE_GROUND, blendColour, groundOffsetM, surfaceWeights, type Rgb, type Weights } from './groundBlend.ts';

// The ground of an Endless section (SHOWCASE_PLAN §5, "Natural terrain"): one mesh of small cells across the corridor. Each
// vertex takes the colour of the surfaces around it, blended over a fringe about 1 m wide with a noise-warped line, and is
// lifted or dug by the surface (sand ripples, mud and ice in dips). The physics zones stay simple polygons; this only draws.
// Axes as in the run scene: physics x is three x, physics z is three −z, y is up. Every number here is presentation.

/** Rock within this of level counts as level (sand ripples are at most 0.07 m). */
export const DIP_FREE_HEIGHT_M = 0.08;

const rgb = (hex: number): Rgb => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};

/** The colour of each surface on the ground; bare rock (asphalt in the surface table) takes the place's own rock colour. */
export const SURFACE_RGB: Readonly<Record<string, Rgb>> = {
  sand: rgb(0xcfae7f),
  ice: rgb(0xbfe3f2),
  mud: rgb(0x4a3222),
};

/** A deterministic 0–1 value for a point, so the colour varies a little without a random generator. */
function grain(xM: number, zM: number): number {
  const s = Math.sin(xM * 12.9898 + zM * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/** The surfaces around a point on the course, with the fringe blend. Rock and bare ground are both reported as `ground`. */
export function surfaceWeightsAt(course: RunCourse, xM: number, zM: number): Weights {
  return surfaceWeights((x, z) => {
    const id = course.surfaceIdAt(x, z);
    return id === 'asphalt' ? BARE_GROUND : id;
  }, xM, zM);
}

/** How high the drawn ground is at a point: sand ripples up, mud and ice down. The rover rides on this. */
export function groundHeightAt(course: RunCourse, xM: number, zM: number): number {
  return groundOffsetM(surfaceWeightsAt(course, xM, zM), xM, zM);
}

export interface ChunkGroundOptions {
  course: RunCourse;
  chunk: CourseChunk;
  halfWidthM: number;
  /** The size of a cell in metres; it must divide the corridor width and the section length. */
  cellM: number;
  /** The colour of bare rock at x (it eases from one place's colour to the next at a seam). */
  rockRgb: (xM: number) => Rgb;
}

/** The fringe reaches this far past a zone's edge (the ring, the noise warp and a little to spare). */
const REACH_M = 1.2;
const ALL_GROUND: Weights = new Map([[BARE_GROUND, 1]]);

export function buildChunkGround(o: ChunkGroundOptions): THREE.Mesh {
  const { course, chunk, halfWidthM, cellM } = o;
  // Far from every zone the answer is plain ground, so only the cells near a zone (this section's or its neighbours', which
  // can reach across the seam) take the nine samples of the fringe. This keeps building a section to a few milliseconds.
  const boxes = course.chunks
    .filter((c) => Math.abs(c.index - chunk.index) <= 1)
    .flatMap((c) => c.tiles)
    .map((t) => ({ x0: t.xM[0] - REACH_M, x1: t.xM[1] + REACH_M, z0: t.zM[0] - REACH_M, z1: t.zM[1] + REACH_M }));
  const nearZone = (x: number, z: number) => boxes.some((b) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1);
  const nx = Math.round((chunk.endXM - chunk.startXM) / cellM);
  const nz = Math.round((2 * halfWidthM) / cellM);
  const count = (nx + 1) * (nz + 1);
  const positions = new Float32Array(count * 3);
  const colours = new Float32Array(count * 3);
  for (let i = 0; i <= nx; i++) {
    const x = chunk.startXM + i * cellM;
    const rock = o.rockRgb(x);
    for (let j = 0; j <= nz; j++) {
      const z = -halfWidthM + j * cellM;
      const k = i * (nz + 1) + j;
      const w = nearZone(x, z) ? surfaceWeightsAt(course, x, z) : ALL_GROUND;
      const c = blendColour(w, SURFACE_RGB, rock);
      const shade = 0.94 + 0.12 * grain(x, z);
      positions.set([x, groundOffsetM(w, x, z), -z], k * 3);
      colours.set([c[0] * shade, c[1] * shade, c[2] * shade], k * 3);
    }
  }
  const indices: number[] = [];
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const p00 = i * (nz + 1) + j;
      const p01 = p00 + 1;
      const p10 = p00 + nz + 1;
      const p11 = p10 + 1;
      // physics z grows with j and three z is −z, so this winding is the one that faces up (and is not culled)
      indices.push(p00, p10, p01, p10, p11, p01);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }));
  mesh.name = `ground-${chunk.index}`;
  return mesh;
}
