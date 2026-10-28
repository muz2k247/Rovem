import * as THREE from 'three';
import { cullByDistance } from './cull.ts';
import type { EdgeStyle } from '../game/level/types.ts';

// What stands beyond the edge the rover scrapes along (SHOWCASE_PLAN §12a, R6b): a hillside behind a broken rock step, a
// faceted rock face, or a cliff drop behind a rim of rocks. This file holds the shapes (how high the ground rises, or falls,
// at a distance past the edge) and the small features that mark the edge (the rock step, the rim rocks, the boulders). It is
// shared by the level scene and the Endless scene, and it never touches the physics: the scrape line stays where it was, and
// the visible contact is built to stand on it. Every number here is presentation, chosen by Claude (provisional).

/** The numbers of SHOWCASE_PLAN §12a. They are listed in `showcase.csv` too. */
export const EDGE = {
  /** Outside ground is built this far out from the edge; beyond it a far ground and the mountain ring. */
  outM: 40,
  /** The broken rock step at the foot of a hillside or rock face. */
  stepMinM: 0.6,
  stepMaxM: 1.2,
  /** How far the step's flat top reaches back from the edge. */
  stepTopM: 0.7,
  /**
   * Low, wide foothills for open places (R15, DECISIONS 2026-10-27 (3)): the ground rises 4 to 6 m over about 80 m, with saddles
   * where it only reaches about 2 m, so the mountain ring shows above and through it. The terrain is built EDGE.outM (40 m) out,
   * so the first half of the 80 m profile is what is drawn; beyond it the fog hides the rest. Canyons keep the tall styles.
   */
  low: { riseMinM: 4, riseMaxM: 6, overM: 80, saddleShare: 0.4, saddleSpanM: 85, stepOutM: 1.5, rollM: 0.5 },
  hill: { angleMinDeg: 25, angleMaxDeg: 40, riseMinM: 8, riseMaxM: 15, stepOutM: 1 },
  rock: { angleMinDeg: 55, angleMaxDeg: 75, riseMinM: 10, riseMaxM: 25 },
  cliff: {
    rimMinM: 0.6,
    rimMaxM: 1.2,
    /** The widest gap between two rim rocks. */
    gapMaxM: 1.5,
    dropMinM: 10,
    dropMaxM: 20,
    /** The ground falls away within this distance beyond the rim. */
    dropWithinM: 6,
    /** The rim rocks stand this deep, edge to back. */
    rimDepthM: 1.2,
    /** A cliff is only drawn where no other road lies within this distance beyond the edge. */
    placementClearM: 30,
  },
  /** Rolling ground beyond a hillside, at most this high or low. */
  rollM: 1.4,
} as const;

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));
export const smoothstep = (a: number, b: number, x: number): number => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const DEG = Math.PI / 180;

/** A deterministic 0–1 value for a lattice point. */
const hash2 = (ix: number, iz: number): number => {
  const s = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** Smooth value noise, 0–1 (the same everywhere, every run). */
export function noise2(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** How tall the rock step is at a point: 0.6 to 1.2 m. */
// The wavelength is about 14 m (R15: at 3 m it read as a sawtooth along the edge).
export const stepHeightM = (xM: number, zM: number): number => lerp(EDGE.stepMinM, EDGE.stepMaxM, noise2(xM * 0.07 + 5.3, zM * 0.07 - 2.9));

/** How the ground beyond an edge is shaped at a point: how far it rises above (or falls below) the ground height, and a colour factor. */
export interface EdgeSample {
  riseM: number;
  /** 1 = plain ground colour; rock faces and drops are darker. */
  tint: number;
}

const NONE: EdgeSample = { riseM: 0, tint: 1 };

/** The shape of one style at `depthM` metres past the edge (zero or less: the edge itself or inside it, where nothing rises). */
export function edgeSample(style: EdgeStyle, depthM: number, xM: number, zM: number): EdgeSample {
  if (depthM <= 0) return NONE;
  const slow1 = noise2(xM * 0.021 + 3.1, zM * 0.021 - 1.7);
  const slow2 = noise2(xM * 0.017 - 9.2, zM * 0.017 + 4.4);
  if (style === 'low') {
    const l = EDGE.low;
    const topM = lerp(l.riseMinM, l.riseMaxM, slow2);
    // A saddle: where the slow noise is low the hills only reach saddleShare of their height (about 2 m of 5).
    const saddle = lerp(l.saddleShare, 1, smoothstep(0.3, 0.7, noise2(xM / l.saddleSpanM + 11.3, zM / l.saddleSpanM - 6.1)));
    const step = stepHeightM(xM, zM) * smoothstep(0, l.stepOutM, depthM);
    const body = topM * saddle * smoothstep(l.stepOutM, l.overM, depthM);
    const roll = l.rollM * smoothstep(6, 30, depthM) * (2 * noise2(xM * 0.045, zM * 0.045) - 1);
    return { riseM: step + body + roll, tint: 1 };
  }
  if (style === 'hill') {
    const h = EDGE.hill;
    const tan = Math.tan(lerp(h.angleMinDeg, h.angleMaxDeg, slow1) * DEG);
    const topM = lerp(h.riseMinM, h.riseMaxM, slow2);
    const step = stepHeightM(xM, zM) * smoothstep(0, h.stepOutM, depthM);
    const body = topM * Math.tanh((tan * Math.max(0, depthM - h.stepOutM)) / topM);
    const roll = EDGE.rollM * smoothstep(8, 30, depthM) * (2 * noise2(xM * 0.045, zM * 0.045) - 1);
    return { riseM: step + body + roll, tint: 1 };
  }
  if (style === 'rock') {
    const r = EDGE.rock;
    const tan = Math.tan(lerp(r.angleMinDeg, r.angleMaxDeg, slow1) * DEG);
    const topM = lerp(r.riseMinM, r.riseMaxM, slow2);
    const step = stepHeightM(xM, zM) * smoothstep(0, 1, depthM);
    const body = topM * Math.tanh((tan * Math.max(0, depthM - 1)) / topM);
    // Facets: a coarse, sharp wobble on the face, so flat shading breaks it into planes.
    const facet = 0.55 * smoothstep(0, 3, depthM) * (2 * noise2(xM * 0.33 + depthM * 0.07, zM * 0.33) - 1);
    const riseM = step + body + facet;
    return { riseM, tint: 0.72 + 0.09 * Math.sin(riseM * 1.4 + slow2 * 6) };
  }
  const c = EDGE.cliff;
  const dropM = lerp(c.dropMinM, c.dropMaxM, slow2);
  const t = smoothstep(c.rimDepthM, c.rimDepthM + c.dropWithinM, depthM);
  const floor = 0.9 * t * (2 * noise2(xM * 0.06, zM * 0.06) - 1);
  return { riseM: -dropM * t + floor, tint: 1 - 0.3 * t };
}

// --- features along an edge ---

/** One straight piece of an edge. The outward normal points away from the road. Positions are physics x and z. */
export interface EdgeSpan {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  nx: number;
  nz: number;
  style: EdgeStyle;
}

/** The rock step of a hillside or rock face: a vertical face at the edge, with a flat top behind it. */
export interface KerbSeg {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  nx: number;
  nz: number;
  ya: number;
  yb: number;
  heightA: number;
  heightB: number;
}

/** A rock of the rim or a boulder at the foot of a hillside. Its inner face (the `-x` side) stands `insetM` from the edge line. */
export interface RockPlace {
  /** The middle of the rock on the ground. */
  xM: number;
  zM: number;
  yM: number;
  /** The direction of the outward normal (away from the road), in physics axes. */
  nx: number;
  nz: number;
  /** Across the edge, along it, and up. */
  depthM: number;
  lengthM: number;
  heightM: number;
  /** Distance from the edge line to the inner face (0 = on it). */
  insetM: number;
  kind: 'rim' | 'boulder';
  /** Where it sits along its span (for tests). */
  style: EdgeStyle;
}

export interface EdgePlan {
  kerbs: KerbSeg[];
  rocks: RockPlace[];
}

const hash = (a: number, b: number, salt: number): number => hash2(a * 1.7 + salt, b * 2.3 - salt);

export interface EdgeInput {
  spans: readonly EdgeSpan[];
  /** The presentation height of the ground at a point (physics ground, or Endless ground, plus any rise outside). */
  heightAt: (xM: number, zM: number) => number;
  quality: 'high' | 'low';
}

/** Plans the rock steps, rim rocks and boulders along the spans. Pure: the meshes are built from this and the tests read it. */
export function planEdges({ spans, heightAt, quality }: EdgeInput): EdgePlan {
  const kerbs: KerbSeg[] = [];
  const rocks: RockPlace[] = [];
  const boulderEvery = quality === 'high' ? 2 : 4;
  spans.forEach((s, i) => {
    const len = Math.hypot(s.bx - s.ax, s.bz - s.az);
    if (len < 1e-6) return;
    const mx = (s.ax + s.bx) / 2;
    const mz = (s.az + s.bz) / 2;
    if (s.style === 'cliff') {
      // A rim of rocks along the whole edge, gaps no wider than the plan allows.
      const n = Math.max(1, Math.floor(len / 2));
      const pitch = len / n;
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        const x = s.ax + (s.bx - s.ax) * t;
        const z = s.az + (s.bz - s.az) * t;
        const gap = lerp(0.3, 1.2, hash(x, z, 1));
        const lengthM = pitch - gap;
        const heightM = lerp(EDGE.cliff.rimMinM, EDGE.cliff.rimMaxM, hash(x, z, 2));
        const depthM = EDGE.cliff.rimDepthM + 0.4 * hash(x, z, 3);
        const insetM = 0.1 * hash(x, z, 4);
        const cx = x + s.nx * (insetM + depthM / 2);
        const cz = z + s.nz * (insetM + depthM / 2);
        rocks.push({ xM: cx, zM: cz, yM: heightAt(x, z), nx: s.nx, nz: s.nz, depthM, lengthM, heightM, insetM, kind: 'rim', style: 'cliff' });
      }
      return;
    }
    kerbs.push({
      ax: s.ax, az: s.az, bx: s.bx, bz: s.bz, nx: s.nx, nz: s.nz,
      ya: heightAt(s.ax, s.az), yb: heightAt(s.bx, s.bz),
      heightA: stepHeightM(s.ax, s.az), heightB: stepHeightM(s.bx, s.bz),
    });
    // Boulders at the foot, a few metres out from the step.
    if (i % boulderEvery === 0 && hash(mx, mz, 5) < 0.75) {
      const lengthM = lerp(0.9, 2.2, hash(mx, mz, 6));
      const depthM = lerp(0.9, 1.8, hash(mx, mz, 7));
      const heightM = lerp(0.5, 1.4, hash(mx, mz, 8));
      const out = lerp(1.2, 5, hash(mx, mz, 9));
      const x = mx + s.nx * out;
      const z = mz + s.nz * out;
      rocks.push({ xM: x, zM: z, yM: heightAt(x, z), nx: s.nx, nz: s.nz, depthM, lengthM, heightM, insetM: out - depthM / 2, kind: 'boulder', style: s.style });
    }
  });
  return { kerbs, rocks };
}

// --- meshes ---

/**
 * A unit rock: a knocked-about low-poly stone. Its bottom is flat on the ground (y = 0), and its inner face (x = −0.5, the side
 * toward the road) is flat and upright, so a rim rock stands square to the edge. Nothing reaches further in than x = −0.5.
 */
export function createRockGeometry(): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(0.5, 1);
  g.translate(0, 0.5, 0);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    // The same push for the same corner, so the faces that share it stay joined.
    const j = (salt: number) => hash2(Math.round(x * 100) * 0.37 + salt, Math.round(y * 100) * 0.53 + Math.round(z * 100) * 0.29 - salt) - 0.5;
    // A small push, so the stone stays round (R15; it was 0.16 to 0.2 and read as a lump of facets).
    let nx = x + 0.08 * j(1);
    let ny = y + 0.1 * j(2);
    const nz = z + 0.08 * j(3);
    if (ny < 0.12) ny = 0; // a flat bottom
    if (nx < -0.3) nx = -0.5; // a flat, upright face toward the road
    p.setXYZ(i, Math.max(nx, -0.5), ny, nz);
  }
  g.computeVertexNormals();
  return g;
}

export interface EdgeMeshes {
  group: THREE.Group;
  /** The rocks as instances, for tests and stats. */
  rockCount: number;
  /** Show only the cells within range of the camera: the step and the cliff rim out to `rangeM`, the rocks out to `rockRangeM`. */
  update(xM: number, zM: number, rangeM: number, rockRangeM: number): void;
  dispose(): void;
}

const tmp = new THREE.Color();

/** The face of a rock step leans back this far from its foot (on the scrape line) to its top lip, so it reads as a worn bank, not a wall (R15). */
const STEP_LEAN_M = 0.4;

/** How big a cell of the level is, in metres: the unit the camera shows or hides. */
export const EDGE_CELL_M = 96;

/** The items sorted into square cells by position. */
function partition<T>(items: readonly T[], xOf: (t: T) => number, zOf: (t: T) => number): T[][] {
  const cells = new Map<string, T[]>();
  for (const t of items) {
    const key = `${Math.floor(xOf(t) / EDGE_CELL_M)},${Math.floor(zOf(t) / EDGE_CELL_M)}`;
    const list = cells.get(key);
    if (list) list.push(t);
    else cells.set(key, [t]);
  }
  return [...cells.values()];
}

export function buildEdgeMeshes(plan: EdgePlan, colours: { kerb: number; rock: number }, quality: 'high' | 'low'): EdgeMeshes {
  const group = new THREE.Group();
  group.name = 'edges';
  const disposables: { dispose(): void }[] = [];
  const kerbMeshes: THREE.Mesh[] = [];
  const rockMeshes: THREE.Mesh[] = [];

  // One mesh per cell of the level, so the camera draws only the cells in view (a whole level's rocks in one instanced mesh are all drawn, always).
  for (const kerbs of partition(plan.kerbs, (k) => k.ax, (k) => k.az)) {
    // Per piece: a vertical face at the edge (from just below the ground up to the step) and a flat top behind it.
    const positions = new Float32Array(kerbs.length * 6 * 3);
    const cols = new Float32Array(kerbs.length * 6 * 3);
    const indices: number[] = [];
    const base = new THREE.Color(colours.kerb);
    kerbs.forEach((k, i) => {
      const top = (x: number, z: number, y: number, h: number, out: number) => [x + k.nx * out, y + h, -(z + k.nz * out)] as const;
      const verts = [
        [k.ax, k.ya - 0.3, -k.az], [k.bx, k.yb - 0.3, -k.bz],
        top(k.ax, k.az, k.ya, k.heightA, STEP_LEAN_M), top(k.bx, k.bz, k.yb, k.heightB, STEP_LEAN_M),
        top(k.ax, k.az, k.ya, k.heightA * 0.92, EDGE.stepTopM + STEP_LEAN_M), top(k.bx, k.bz, k.yb, k.heightB * 0.92, EDGE.stepTopM + STEP_LEAN_M),
      ] as const;
      verts.forEach((v, j) => {
        positions.set(v, (i * 6 + j) * 3);
        const shade = j < 2 ? 0.62 : j < 4 ? 0.9 : 1;
        const v2 = 0.94 + 0.12 * noise2((j < 2 ? k.ax : j % 2 === 0 ? k.ax : k.bx) * 0.2, (j < 2 ? k.az : k.az) * 0.2);
        tmp.copy(base).multiplyScalar(shade * v2);
        cols.set([tmp.r, tmp.g, tmp.b], (i * 6 + j) * 3);
      });
      const o = i * 6;
      // Both faces are drawn from both sides (the material is double-sided), so the winding does not matter.
      indices.push(o, o + 1, o + 3, o, o + 3, o + 2, o + 2, o + 3, o + 5, o + 2, o + 5, o + 4);
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'edgeKerb';
    kerbMeshes.push(mesh);
    mesh.castShadow = quality === 'high';
    mesh.receiveShadow = quality === 'high';
    group.add(mesh);
    disposables.push(geometry, material);
  }

  if (plan.rocks.length > 0) {
    const geometry = createRockGeometry();
    const material = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 1 });
    disposables.push(geometry, material);
    for (const rocks of partition(plan.rocks, (r) => r.xM, (r) => r.zM)) {
      const mesh = new THREE.InstancedMesh(geometry, material, rocks.length);
      mesh.name = 'edgeRocks';
      rockMeshes.push(mesh);
      mesh.castShadow = quality === 'high';
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const up = new THREE.Vector3(0, 1, 0);
      const base = new THREE.Color(colours.rock);
      rocks.forEach((r, i) => {
        // Local +x points away from the road. In three axes the outward direction is (nx, −nz).
        q.setFromAxisAngle(up, Math.atan2(r.nz, r.nx));
        m.compose(new THREE.Vector3(r.xM, r.yM - 0.12, -r.zM), q, new THREE.Vector3(r.depthM, r.heightM + 0.12, r.lengthM));
        mesh.setMatrixAt(i, m);
        tmp.copy(base).multiplyScalar(0.8 + 0.4 * hash(r.xM, r.zM, 30));
        mesh.setColorAt(i, tmp);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      group.add(mesh);
      disposables.push(mesh);
    }
  }

  return {
    group,
    rockCount: plan.rocks.length,
    update(xM, zM, rangeM, rockRangeM) {
      cullByDistance(kerbMeshes, xM, zM, rangeM);
      cullByDistance(rockMeshes, xM, zM, Math.min(rangeM, rockRangeM));
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
