import * as THREE from 'three';
import type { EdgeStyle } from '../content/index.ts';
import type { RunCourse } from '../game/run/course.ts';
import { EDGE, buildEdgeMeshes, edgeSample, planEdges, type EdgeMeshes, type EdgePlan, type EdgeSample, type EdgeSpan } from './edges.ts';

// The edges of the Endless Canyon (SHOWCASE_PLAN §12a, R6b). The corridor is |z| ≤ corridorHalfWidthM, and that line is what the
// rover scrapes along (`course.barrierHit`); behind the start line the rover stops at the start wall. What stands beyond is a
// hillside, a rock face or a cliff drop, chosen by the place's template (`edge` in runChunks.json). The ground beyond is a
// strip on each side of every section, built to EDGE.outM, with rows close together near the edge and wider apart further out.
// Heights are a function of position only, so neighbouring sections meet exactly. Presentation only.

/** Where one style gives way to the next, the ground blends over this far either side of the seam. */
const BLEND_OFFSETS_M = [-6, -2, 2, 6] as const;
/** Rows across a strip: this far apart near the edge (to FINE_TO_M) and this far apart beyond. */
const ROW_STEP_M = { high: { fine: 1, coarse: 4 }, low: { fine: 2, coarse: 6 } } as const;
const FINE_TO_M = 12;
/** A piece of the edge for the rock step and rocks. */
export const ENDLESS_EDGE_STEP_M = { high: 3, low: 5 } as const;
const SKIRT_DEPTH_M = 40;

export interface EndlessEdgeField {
  /** The rise (or fall) and colour factor of the ground at a point; zero inside the corridor and the start area. */
  sample(xM: number, zM: number): EdgeSample;
  /** The style of the place at x (blending is in `sample`). */
  styleAtX(xM: number): EdgeStyle;
  readonly halfWidthM: number;
  readonly startWallXM: number;
}

export function createEndlessEdgeField(course: RunCourse, halfWidthM: number, startWallXM: number): EndlessEdgeField {
  const styleAtX = (xM: number): EdgeStyle => course.sectionAt(Math.max(0, xM))?.edge ?? 'hill';
  return {
    halfWidthM,
    startWallXM,
    styleAtX,
    sample(xM, zM) {
      const dz = Math.max(0, Math.abs(zM) - halfWidthM);
      const dx = Math.max(0, startWallXM - xM);
      const depthM = Math.hypot(dx, dz);
      if (depthM <= 0 || depthM > EDGE.outM) return { riseM: 0, tint: 1 };
      const styles = BLEND_OFFSETS_M.map((o) => styleAtX(Math.max(0, xM) + o));
      if (styles.every((s) => s === styles[0])) return edgeSample(styles[0]!, depthM, xM, zM);
      let riseM = 0;
      let tint = 0;
      for (const s of styles) {
        const e = edgeSample(s, depthM, xM, zM);
        riseM += e.riseM / styles.length;
        tint += e.tint / styles.length;
      }
      return { riseM, tint };
    },
  };
}

/** The distances past the edge where a strip has a row of vertices: close together near the edge, wider apart beyond. */
export function stripRows(quality: 'high' | 'low'): number[] {
  const { fine, coarse } = ROW_STEP_M[quality];
  const rows: number[] = [];
  for (let d = 0; d < FINE_TO_M - 1e-9; d += fine) rows.push(d);
  for (let d = FINE_TO_M; d < EDGE.outM - 1e-9; d += coarse) rows.push(d);
  rows.push(EDGE.outM);
  return rows;
}

const grain = (xM: number, zM: number): number => {
  const s = Math.sin(xM * 12.9898 + zM * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

export interface StripOptions {
  field: EndlessEdgeField;
  /** The strip's side: +1 for z above the corridor, −1 below. */
  side: 1 | -1;
  x0: number;
  x1: number;
  cellM: number;
  quality: 'high' | 'low';
  /** The colour of the ground at x (the place's rock colour, eased across a seam). */
  rockRgb: (xM: number) => readonly [number, number, number];
}

/** One side of one section: the ground beyond the corridor wall, as a grid with rows at the distances of `stripRows`, plus a skirt on its outer side. */
export function buildEdgeStrip(o: StripOptions): THREE.BufferGeometry {
  const { field, side, x0, x1, cellM } = o;
  const rows = stripRows(o.quality);
  const nx = Math.max(1, Math.round((x1 - x0) / cellM));
  const nr = rows.length;
  const stride = nr + 1; // + one skirt vertex under the last row
  const positions = new Float32Array((nx + 1) * stride * 3);
  const normals = new Float32Array((nx + 1) * stride * 3);
  const colours = new Float32Array((nx + 1) * stride * 3);
  const probe = 0.5;
  const heightAt = (x: number, z: number) => field.sample(x, z).riseM;
  for (let i = 0; i <= nx; i++) {
    const x = x0 + ((x1 - x0) * i) / nx;
    const rock = o.rockRgb(x);
    for (let r = 0; r < nr; r++) {
      const z = side * (field.halfWidthM + rows[r]!);
      const e = field.sample(x, z);
      const k = (i * stride + r) * 3;
      positions.set([x, e.riseM, -z], k);
      const dhdx = (heightAt(x + probe, z) - heightAt(x - probe, z)) / (2 * probe);
      const dhdz = (heightAt(x, z + probe) - heightAt(x, z - probe)) / (2 * probe);
      const len = Math.hypot(dhdx, 1, dhdz);
      normals.set([-dhdx / len, 1 / len, dhdz / len], k);
      const shade = (0.94 + 0.12 * grain(x, z)) * e.tint;
      colours.set([rock[0] * shade, rock[1] * shade, rock[2] * shade], k);
    }
    // the skirt vertex hangs under the last row
    const last = (i * stride + nr - 1) * 3;
    const s = (i * stride + nr) * 3;
    positions.set([positions[last]!, positions[last + 1]! - SKIRT_DEPTH_M, positions[last + 2]!], s);
    normals.set([0, 1, 0], s);
    colours.set([colours[last]! * 0.7, colours[last + 1]! * 0.7, colours[last + 2]! * 0.7], s);
  }
  const indices: number[] = [];
  for (let i = 0; i < nx; i++) {
    for (let r = 0; r < nr; r++) {
      const a = i * stride + r;
      const b = a + 1;
      const c = (i + 1) * stride + r;
      const d = c + 1;
      // physics z grows with r on the +1 side and shrinks on the −1 side, and three's z is −z: the winding that faces up differs by side
      if (side === 1) indices.push(a, c, b, c, d, b);
      else indices.push(a, b, c, c, b, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geometry.setIndex(indices);
  return geometry;
}

/** The ground behind the start line: a grid from EDGE.outM behind the start wall up to it, across the corridor and EDGE.outM beyond both walls. */
export function buildStartSurround(field: EndlessEdgeField, cellM: number, rock: readonly [number, number, number]): THREE.BufferGeometry {
  const xFrom = field.startWallXM - EDGE.outM;
  const zHalf = field.halfWidthM + EDGE.outM;
  const nx = Math.max(1, Math.round(EDGE.outM / cellM));
  const nz = Math.max(1, Math.round((2 * zHalf) / cellM));
  const positions = new Float32Array((nx + 1) * (nz + 1) * 3);
  const normals = new Float32Array((nx + 1) * (nz + 1) * 3);
  const colours = new Float32Array((nx + 1) * (nz + 1) * 3);
  const probe = 0.5;
  const heightAt = (x: number, z: number) => field.sample(x, z).riseM;
  for (let i = 0; i <= nx; i++) {
    const x = xFrom + ((field.startWallXM - xFrom) * i) / nx;
    for (let j = 0; j <= nz; j++) {
      const z = -zHalf + ((2 * zHalf) * j) / nz;
      const e = field.sample(x, z);
      const k = (i * (nz + 1) + j) * 3;
      positions.set([x, e.riseM, -z], k);
      const dhdx = (heightAt(x + probe, z) - heightAt(x - probe, z)) / (2 * probe);
      const dhdz = (heightAt(x, z + probe) - heightAt(x, z - probe)) / (2 * probe);
      const len = Math.hypot(dhdx, 1, dhdz);
      normals.set([-dhdx / len, 1 / len, dhdz / len], k);
      const shade = (0.94 + 0.12 * grain(x, z)) * e.tint;
      colours.set([rock[0] * shade, rock[1] * shade, rock[2] * shade], k);
    }
  }
  const indices: number[] = [];
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const a = i * (nz + 1) + j;
      const b = a + 1;
      const c = a + nz + 1;
      const d = c + 1;
      indices.push(a, c, b, c, d, b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geometry.setIndex(indices);
  return geometry;
}

/** The straight pieces of the corridor wall along x in [x0, x1], both sides. */
export function endlessSpans(field: EndlessEdgeField, x0: number, x1: number, stepM: number): EdgeSpan[] {
  const spans: EdgeSpan[] = [];
  const steps = Math.max(1, Math.ceil((x1 - x0) / stepM));
  for (const side of [1, -1] as const) {
    for (let i = 0; i < steps; i++) {
      const ax = x0 + ((x1 - x0) * i) / steps;
      const bx = x0 + ((x1 - x0) * (i + 1)) / steps;
      spans.push({ ax, az: side * field.halfWidthM, bx, bz: side * field.halfWidthM, nx: 0, nz: side, style: field.styleAtX((ax + bx) / 2) });
    }
  }
  return spans;
}

/** The wall behind the start line, across the corridor. */
export function startWallSpans(field: EndlessEdgeField, stepM: number): EdgeSpan[] {
  const spans: EdgeSpan[] = [];
  const steps = Math.max(1, Math.ceil((2 * field.halfWidthM) / stepM));
  for (let i = 0; i < steps; i++) {
    const az = -field.halfWidthM + ((2 * field.halfWidthM) * i) / steps;
    const bz = -field.halfWidthM + ((2 * field.halfWidthM) * (i + 1)) / steps;
    // The start wall is never a cliff: nothing to drive off behind the start.
    const style = field.styleAtX(0) === 'cliff' ? 'hill' : field.styleAtX(0);
    spans.push({ ax: field.startWallXM, az, bx: field.startWallXM, bz, nx: -1, nz: 0, style });
  }
  return spans;
}

export interface EndlessEdges extends EdgeMeshes {
  plan: EdgePlan;
  spans: readonly EdgeSpan[];
}

/** The rock step, the rim of rocks and the boulders along a set of spans of the corridor wall. */
export function createEndlessEdgeFeatures(
  field: EndlessEdgeField,
  spans: readonly EdgeSpan[],
  colours: { kerb: number; rock: number },
  quality: 'high' | 'low',
): EndlessEdges {
  const plan = planEdges({ spans, heightAt: (x, z) => field.sample(x, z).riseM, quality });
  const meshes = buildEdgeMeshes(plan, colours, quality);
  return { ...meshes, plan, spans };
}

