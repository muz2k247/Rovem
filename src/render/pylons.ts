import * as THREE from 'three';
import { levelsConfig } from '../content/levelsConfig.ts';
import type { MagnetPole } from '../game/contracts.ts';
import type { PylonDef } from '../game/level/types.ts';

// Magnet pylons in the level scene (LEVELS_BUILD_PLAN A7, Polar Pass): a tower with a glowing coil, and field lines that
// show the pull. Opposite poles attract, so the dots flow in towards the coil; equal poles repel, so they flow out. A pylon
// that is off goes dark and its lines vanish. The lines fade out with the rover's distance, as the force does. Presentation
// only: the force itself is the physics' (`src/physics/magnet.ts`).

export const FIELD_LINES = 6;
/** How far out a field line starts, in metres. */
export const FIELD_RADIUS_M = 9;
/** Height of the top of the coil. */
export const COIL_TOP_M = 4.2;
const DOTS_PER_LINE = 3;
const FLOW_PER_S = 0.25;
const LINE_SEGMENTS = 20;
const LINE_OPACITY = 0.4;
const POLE_COLOURS: Record<MagnetPole, number> = { N: 0xff6a4d, S: 0x4da3ff };

/** +1: the dots flow out (equal poles repel), −1: they flow in (opposite poles attract). */
export function flowDirection(roverPole: MagnetPole, pylonPole: MagnetPole): 1 | -1 {
  return roverPole === pylonPole ? 1 : -1;
}

/**
 * A point on a field line, relative to the pylon's foot, in three.js axes. t = 0 is the outer end on the ground, t = 1 is
 * the coil. `variant` 0 is the full-length line; each line sits at its own angle round the pylon. A quadratic curve that
 * rises steeply from the ground and arrives at the coil from above.
 */
export function fieldLinePoint(line: number, variant: number, t: number): { x: number; y: number; z: number } {
  const angle = (line / FIELD_LINES) * Math.PI * 2 + variant * (Math.PI / FIELD_LINES);
  const reach = FIELD_RADIUS_M * (1 - 0.35 * variant);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const p0 = { r: reach, y: 0.3 };
  const p1 = { r: reach * 0.45, y: COIL_TOP_M * 1.9 };
  const p2 = { r: 0, y: COIL_TOP_M };
  const a = (1 - t) * (1 - t);
  const b = 2 * (1 - t) * t;
  const d = t * t;
  const r = a * p0.r + b * p1.r + d * p2.r;
  return { x: r * c, y: a * p0.y + b * p1.y + d * p2.y, z: r * s };
}

export interface PylonUpdate {
  timeS: number;
  roverPole: MagnetPole;
  roverXM: number;
  roverZM: number;
  /** Is this pylon's magnet on right now? */
  isOn: (id: string) => boolean;
  /** The ground height (three y) at a physics position. */
  groundYM: (xM: number, zM: number) => number;
}

interface Entry {
  def: PylonDef;
  root: THREE.Group;
  coilMaterial: THREE.MeshStandardMaterial;
  capMaterial: THREE.MeshStandardMaterial;
  lines: THREE.LineSegments;
  lineMaterial: THREE.LineBasicMaterial;
  dots: THREE.InstancedMesh;
  radii: number[];
}

export function createPylons(defs: readonly PylonDef[]) {
  const group = new THREE.Group();
  group.name = 'pylons';
  const towerMaterial = new THREE.MeshStandardMaterial({ color: 0x59546a, flatShading: true });
  const towerGeometry = new THREE.CylinderGeometry(0.35, 0.55, COIL_TOP_M - 0.6, 8);
  const coilGeometry = new THREE.TorusGeometry(0.75, 0.13, 8, 20);
  const capGeometry = new THREE.SphereGeometry(0.42, 12, 8);
  const dotGeometry = new THREE.SphereGeometry(0.15, 6, 5);
  const entries = new Map<string, Entry>();
  const { fullWithinM, cutoffM } = levelsConfig.magnet;

  for (const def of defs) {
    const root = new THREE.Group();
    root.name = 'pylon';
    root.userData.id = def.id;
    root.position.set(def.xM, 0, -def.zM);
    const tower = new THREE.Mesh(towerGeometry, towerMaterial);
    tower.position.y = (COIL_TOP_M - 0.6) / 2;
    tower.castShadow = true;
    root.add(tower);

    const colour = POLE_COLOURS[def.pole];
    const coilMaterial = new THREE.MeshStandardMaterial({ color: 0x2b2f3a, emissive: colour, emissiveIntensity: 0, roughness: 0.4 });
    for (const y of [1.2, 2.0, 2.8]) {
      const coil = new THREE.Mesh(coilGeometry, coilMaterial);
      coil.name = 'coil';
      coil.rotation.x = Math.PI / 2;
      coil.position.y = y;
      root.add(coil);
    }
    const capMaterial = new THREE.MeshStandardMaterial({ color: colour, emissive: colour, emissiveIntensity: 0.6 });
    const cap = new THREE.Mesh(capGeometry, capMaterial);
    cap.position.y = COIL_TOP_M;
    root.add(cap);

    // The field lines: faint curves plus dots that flow along them.
    const positions: number[] = [];
    for (let l = 0; l < FIELD_LINES; l++) {
      for (let s = 0; s < LINE_SEGMENTS; s++) {
        const a = fieldLinePoint(l, 0, s / LINE_SEGMENTS);
        const b = fieldLinePoint(l, 0, (s + 1) / LINE_SEGMENTS);
        positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const lineMaterial = new THREE.LineBasicMaterial({ color: colour, transparent: true, opacity: 0, depthWrite: false });
    const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
    lines.name = 'fieldLines';
    lines.frustumCulled = false;
    root.add(lines);

    const dotMaterial = new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.9, depthWrite: false });
    const dots = new THREE.InstancedMesh(dotGeometry, dotMaterial, FIELD_LINES * DOTS_PER_LINE);
    dots.name = 'fieldDots';
    dots.frustumCulled = false;
    dots.count = 0;
    root.add(dots);

    group.add(root);
    entries.set(def.id, { def, root, coilMaterial, capMaterial, lines, lineMaterial, dots, radii: [] });
  }

  const matrix = new THREE.Matrix4();
  const get = (id: string): Entry => {
    const e = entries.get(id);
    if (!e) throw new Error(`Unknown pylon "${id}"`);
    return e;
  };

  return {
    group,
    update(input: PylonUpdate) {
      for (const e of entries.values()) {
        const on = input.isOn(e.def.id);
        e.root.position.y = input.groundYM(e.def.xM, e.def.zM);
        e.coilMaterial.emissiveIntensity = on ? 2 : 0;
        e.capMaterial.emissiveIntensity = on ? 1.2 : 0.15;
        const dist = Math.hypot(input.roverXM - e.def.xM, input.roverZM - e.def.zM);
        const fade = Math.max(0, Math.min(1, (cutoffM - dist) / (cutoffM - fullWithinM)));
        const opacity = on ? LINE_OPACITY * fade : 0;
        e.lineMaterial.opacity = opacity;
        e.lines.visible = opacity > 0;
        e.radii = [];
        if (opacity <= 0) {
          e.dots.count = 0;
          continue;
        }
        const flow = flowDirection(input.roverPole, e.def.pole);
        let k = 0;
        for (let l = 0; l < FIELD_LINES; l++) {
          for (let d = 0; d < DOTS_PER_LINE; d++) {
            const u = (((d / DOTS_PER_LINE + input.timeS * FLOW_PER_S) % 1) + 1) % 1;
            const p = fieldLinePoint(l, 0, flow < 0 ? u : 1 - u);
            matrix.makeTranslation(p.x, p.y, p.z);
            e.dots.setMatrixAt(k++, matrix);
            e.radii.push(Math.hypot(p.x, p.z));
          }
        }
        e.dots.count = k;
        e.dots.instanceMatrix.needsUpdate = true;
      }
    },
    coilMaterial: (id: string) => get(id).coilMaterial,
    visibleDots: (id: string) => get(id).dots.count,
    dotRadii: (id: string) => get(id).radii,
    lineOpacity: (id: string) => get(id).lineMaterial.opacity,
    dispose() {
      for (const e of entries.values()) {
        e.coilMaterial.dispose();
        e.capMaterial.dispose();
        e.lines.geometry.dispose();
        e.lineMaterial.dispose();
        e.dots.dispose();
        (e.dots.material as THREE.Material).dispose();
      }
      towerGeometry.dispose();
      coilGeometry.dispose();
      capGeometry.dispose();
      dotGeometry.dispose();
      towerMaterial.dispose();
    },
  };
}
