import * as THREE from 'three';
import type { LevelWorld } from '../game/level/world.ts';
import type { RampDef } from '../game/level/types.ts';

// The ramps as solid wedges (R13; "ramp meshes"): until now a ramp was only a bump in the ground (`world.heightM`), drawn by the 1 m
// terrain tiles, so its lip was a smoothed slope and the drop behind it a ragged cliff. The wedge is exact: a plank up the slope at the
// ramp's angle, two sides, and a clean vertical face behind the lip, with a bright strip along the lip so the place where the rover leaves
// the ground can be seen from far down the road. It sits on the same heights the physics uses and draws nothing new for the physics.

const LIFT_M = 0.04;
const LIP_STRIP_M = 0.3;
const SKIRT_M = 0.6;
const DEG = Math.PI / 180;
const SLAB_COLOUR = 0x77634f;
const LIP_COLOUR = 0xffd23f;

/** The four top corners and four ground corners of a ramp, in physics coordinates (x east, z north) and heights. */
export interface RampCorners {
  footLeft: { xM: number; zM: number; yM: number };
  footRight: { xM: number; zM: number; yM: number };
  lipLeft: { xM: number; zM: number; yM: number; groundYM: number };
  lipRight: { xM: number; zM: number; yM: number; groundYM: number };
}

/** The wedge's corners: the foot is `lengthM` before the lip, the top rises `lengthM · tan φ`, and `ground` is the height behind the lip. */
export function rampCorners(world: LevelWorld, r: RampDef): RampCorners {
  const h = r.headingDeg * DEG;
  const fx = Math.cos(h);
  const fz = Math.sin(h);
  const nx = -Math.sin(h); // the ramp's left
  const nz = Math.cos(h);
  const half = r.widthM / 2;
  const rise = r.lengthM * Math.tan(r.angleDeg * DEG);
  const corner = (alongM: number, side: 1 | -1) => ({ xM: r.xM + fx * alongM + nx * half * side, zM: r.zM + fz * alongM + nz * half * side });
  const foot = (side: 1 | -1) => {
    const p = corner(-r.lengthM, side);
    return { ...p, yM: world.heightM(p.xM, p.zM) };
  };
  const lip = (side: 1 | -1) => {
    const p = corner(0, side);
    const behind = corner(0.05, side); // just past the lip the ramp's own height is gone: the ground under the wedge
    const groundYM = world.heightM(behind.xM, behind.zM);
    return { ...p, yM: groundYM + rise, groundYM };
  };
  return { footLeft: foot(1), footRight: foot(-1), lipLeft: lip(1), lipRight: lip(-1) };
}

function wedgeGeometry(c: RampCorners): THREE.BufferGeometry {
  const v = (p: { xM: number; zM: number }, y: number): [number, number, number] => [p.xM, y, -p.zM];
  const fl = v(c.footLeft, c.footLeft.yM + LIFT_M);
  const fr = v(c.footRight, c.footRight.yM + LIFT_M);
  const ll = v(c.lipLeft, c.lipLeft.yM + LIFT_M);
  const lr = v(c.lipRight, c.lipRight.yM + LIFT_M);
  // Below the corners: the wedge reaches down into the ground so no gap shows between it and the tiles.
  const flB = v(c.footLeft, c.footLeft.yM - SKIRT_M);
  const frB = v(c.footRight, c.footRight.yM - SKIRT_M);
  const llB = v(c.lipLeft, c.lipLeft.groundYM - SKIRT_M);
  const lrB = v(c.lipRight, c.lipRight.groundYM - SKIRT_M);
  const positions = [...fl, ...fr, ...ll, ...lr, ...flB, ...frB, ...llB, ...lrB];
  // 0 fl, 1 fr, 2 ll, 3 lr, 4 flB, 5 frB, 6 llB, 7 lrB. Wound so the faces look outward; the material is double-sided anyway.
  const indices = [
    0, 2, 1, 1, 2, 3, // the plank
    2, 6, 3, 3, 6, 7, // the face behind the lip
    0, 4, 2, 2, 4, 6, // the left side
    1, 3, 5, 3, 7, 5, // the right side
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function lipGeometry(c: RampCorners): THREE.BufferGeometry {
  // A flat strip along the lip, on the plank, LIP_STRIP_M deep (measured along the slope, close enough to the ground plane here).
  const dx = c.lipLeft.xM - c.footLeft.xM;
  const dz = c.lipLeft.zM - c.footLeft.zM;
  const len = Math.hypot(dx, dz) || 1;
  const back = LIP_STRIP_M / len;
  const lerp = (a: number, b: number) => a + (b - a) * (1 - back);
  const point = (foot: { xM: number; zM: number; yM: number }, lip: { xM: number; zM: number; yM: number }): { p: [number, number, number]; q: [number, number, number] } => ({
    p: [lerp(foot.xM, lip.xM), lerp(foot.yM, lip.yM) + LIFT_M * 2, -lerp(foot.zM, lip.zM)],
    q: [lip.xM, lip.yM + LIFT_M * 2, -lip.zM],
  });
  const l = point(c.footLeft, c.lipLeft);
  const r = point(c.footRight, c.lipRight);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([...l.p, ...r.p, ...l.q, ...r.q], 3));
  geometry.setIndex([0, 2, 1, 1, 2, 3]);
  return geometry;
}

export interface RampMeshes {
  readonly group: THREE.Group;
  readonly count: number;
  dispose(): void;
}

/** One wedge per ramp of the level; undefined for a level with none. */
export function createRampMeshes(world: LevelWorld): RampMeshes | undefined {
  const ramps = world.def.ramps;
  if (ramps.length === 0) return undefined;
  const group = new THREE.Group();
  group.name = 'ramps';
  const slab = new THREE.MeshStandardMaterial({ color: SLAB_COLOUR, roughness: 0.9, flatShading: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const strip = new THREE.MeshBasicMaterial({ color: LIP_COLOUR, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const geometries: THREE.BufferGeometry[] = [];
  for (const r of ramps) {
    const corners = rampCorners(world, r);
    const wedge = wedgeGeometry(corners);
    const lip = lipGeometry(corners);
    geometries.push(wedge, lip);
    const w = new THREE.Mesh(wedge, slab);
    w.name = `ramp-${r.id}`;
    const s = new THREE.Mesh(lip, strip);
    s.name = `ramp-lip-${r.id}`;
    group.add(w, s);
  }
  return {
    group,
    count: ramps.length,
    dispose() {
      for (const g of geometries) g.dispose();
      slab.dispose();
      strip.dispose();
      group.clear();
    },
  };
}
