import * as THREE from 'three';
import type { PointM } from '../content/index.ts';
import type { WaterDef } from '../game/level/types.ts';
import type { LevelWorld } from '../game/level/world.ts';
import { pointInPolygon } from '../game/geometry.ts';

// Water in the level scene (LEVELS_BUILD_PLAN A7, The Crossing). The physics says how deep the water is over a flat
// riverbed. To look right, the water surface is flush with the ground around the pool and the bed is dug down by the
// depth, over a short bank so nothing jumps. The rover is drawn on the bed (or, when it floats, with the water line half
// way up its body). All of this is presentation: the physics reads `world.waterDepthM` and never these functions.

/** The bank: the bed eases down over this many metres inside the pool's edge. */
export const BANK_M = 3;
/** Half the height of the rover's body: a floating rover rides with the water line about here. */
export const BODY_HALF_HEIGHT_M = 0.45;
const WATER_COLOUR = 0x3d84ad;
const WATER_OPACITY = 0.58;

function distToEdge(xM: number, zM: number, polygon: readonly PointM[]): number {
  let best = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % polygon.length]!;
    const ex = b.xM - a.xM;
    const ez = b.zM - a.zM;
    const lenSq = ex * ex + ez * ez;
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((xM - a.xM) * ex + (zM - a.zM) * ez) / lenSq));
    best = Math.min(best, Math.hypot(xM - (a.xM + ex * t), zM - (a.zM + ez * t)));
  }
  return best;
}

/** How far below the surrounding ground the bed is drawn at a point: the pool's depth, eased in over the bank. 0 outside every pool. */
export function waterBedDropM(world: Pick<LevelWorld, 'def'>, xM: number, zM: number): number {
  let drop = 0;
  for (const w of world.def.water) {
    if (!pointInPolygon(xM, zM, w.polygon)) continue;
    drop = Math.max(drop, w.depthM * Math.min(1, distToEdge(xM, zM, w.polygon) / BANK_M));
  }
  return drop;
}

/** The height of a pool's surface: the ground level around it (the mean of the ground at its corners). */
export function waterSurfaceYM(world: Pick<LevelWorld, 'heightM'>, w: WaterDef): number {
  return w.polygon.reduce((sum, p) => sum + world.heightM(p.xM, p.zM), 0) / w.polygon.length;
}

/**
 * Where the rover's model sits vertically. A rover that sinks rides on the bed. One that floats rides high, with the
 * water line about half way up its body, but never below the bed.
 */
export function roverRideHeightM(o: { groundYM: number; bedDropM: number; floating: boolean }): number {
  const onBed = o.groundYM - o.bedDropM;
  return o.floating ? Math.max(o.groundYM - BODY_HALF_HEIGHT_M, onBed) : onBed;
}

export interface WaterView {
  group: THREE.Group;
  update(timeS: number): void;
  dispose(): void;
}

export function createWater(world: LevelWorld): WaterView {
  const group = new THREE.Group();
  group.name = 'waters';
  const material = new THREE.MeshStandardMaterial({
    color: WATER_COLOUR, transparent: true, opacity: WATER_OPACITY, roughness: 0.25, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide,
  });
  const meshes: { mesh: THREE.Mesh; baseY: number }[] = [];
  for (const w of world.def.water) {
    const contour = w.polygon.map((p) => new THREE.Vector2(p.xM, p.zM));
    const faces = THREE.ShapeUtils.triangulateShape(contour, []);
    const y = waterSurfaceYM(world, w);
    const positions = new Float32Array(w.polygon.length * 3);
    w.polygon.forEach((p, i) => positions.set([p.xM, 0, -p.zM], i * 3));
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(faces.flat().map((i) => i));
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'water';
    mesh.position.y = y;
    mesh.renderOrder = 2;
    // The triangles may wind either way once z is flipped; the surface is two-sided so it shows from above regardless.
    group.add(mesh);
    meshes.push({ mesh, baseY: y });
  }
  return {
    group,
    update(timeS) {
      // A gentle swell, small enough to keep the surface flush with the banks.
      for (const [i, m] of meshes.entries()) m.mesh.position.y = m.baseY + Math.sin(timeS * 1.3 + i) * 0.015;
    },
    dispose() {
      for (const m of meshes) m.mesh.geometry.dispose();
      material.dispose();
    },
  };
}

export interface SplashInput {
  xM: number;
  /** The water surface under the rover (three y). */
  yM: number;
  zM: number;
  speedMps: number;
  inWater: boolean;
  headingRad: number;
}

const SPLASH_POOL = 160;
const SPLASH_PER_MPS = 6;
const SPLASH_BURST = 26;
const SPLASH_BURST_MIN_MPS = 2;

/** Spray thrown up by a rover moving through water: a small pool of fading points. The random spread is visual only, from a fixed seed. */
export function createSplashes(scene: THREE.Scene) {
  const positions = new Float32Array(SPLASH_POOL * 3);
  const colours = new Float32Array(SPLASH_POOL * 4);
  const velocity = new Float32Array(SPLASH_POOL * 3);
  const age = new Float32Array(SPLASH_POOL).fill(Infinity);
  const life = new Float32Array(SPLASH_POOL).fill(1);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 4));
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({ size: 0.32, vertexColors: true, transparent: true, depthWrite: false }));
  points.frustumCulled = false;
  points.name = 'splashes';
  scene.add(points);
  let next = 0;
  let owed = 0;
  let wasInWater = false;
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  const emit = (o: SplashInput, upMps: number) => {
    const i = next;
    next = (next + 1) % SPLASH_POOL;
    const side = (rand() - 0.5) * 2.2;
    const fx = Math.cos(o.headingRad);
    const fz = Math.sin(o.headingRad);
    positions.set([o.xM + fx * 0.4 - fz * side * 0.5, o.yM + 0.05, -(o.zM + fz * 0.4 + fx * side * 0.5)], i * 3);
    velocity.set([-fx * 1.2 + (rand() - 0.5) * 2.4, upMps * (0.6 + rand() * 0.8), fz * 1.2 + (rand() - 0.5) * 2.4], i * 3);
    colours.set([0.86, 0.95, 1, 0.8], i * 4);
    age[i] = 0;
    life[i] = 0.6 + rand() * 0.4;
  };

  return {
    group: points,
    get liveCount(): number {
      let n = 0;
      for (let i = 0; i < SPLASH_POOL; i++) if (age[i]! < life[i]!) n++;
      return n;
    },
    update(frameS: number, o: SplashInput) {
      if (o.inWater && !wasInWater && o.speedMps >= SPLASH_BURST_MIN_MPS) {
        for (let k = 0; k < SPLASH_BURST; k++) emit(o, 2 + o.speedMps * 0.25);
      }
      wasInWater = o.inWater;
      if (o.inWater) {
        owed += o.speedMps * SPLASH_PER_MPS * frameS;
        while (owed >= 1) {
          owed -= 1;
          emit(o, 1.5 + o.speedMps * 0.15);
        }
      } else {
        owed = 0;
      }
      for (let i = 0; i < SPLASH_POOL; i++) {
        if (age[i]! >= life[i]!) {
          colours[i * 4 + 3] = 0;
          continue;
        }
        age[i] = age[i]! + frameS;
        velocity[i * 3 + 1] = velocity[i * 3 + 1]! - 9.8 * frameS;
        positions[i * 3] = positions[i * 3]! + velocity[i * 3]! * frameS;
        positions[i * 3 + 1] = positions[i * 3 + 1]! + velocity[i * 3 + 1]! * frameS;
        positions[i * 3 + 2] = positions[i * 3 + 2]! + velocity[i * 3 + 2]! * frameS;
        colours[i * 4 + 3] = 0.8 * Math.max(0, 1 - age[i]! / life[i]!);
      }
      geometry.attributes.position!.needsUpdate = true;
      geometry.attributes.color!.needsUpdate = true;
    },
    dispose() {
      scene.remove(points);
      geometry.dispose();
      (points.material as THREE.Material).dispose();
    },
  };
}
