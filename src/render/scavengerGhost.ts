import * as THREE from 'three';
import { levelsConfig } from '../content/levelsConfig.ts';
import { roverLookFor, createRoverModel, wheelTurnRad } from './roverModel.ts';
import { groundOffsetOf } from './terrain.ts';
import type { ScavengerRun } from '../game/level/scavenger.ts';
import type { ForkLineDef } from '../game/level/types.ts';
import type { LevelWorld } from '../game/level/world.ts';

// The Scavenger in the scene (SHOWCASE_PLAN §8): the student's rover model built from the Scavenger's own parts, rusted and patched,
// played back from its recorded run. It looks solid from a distance and fades when the student's rover is close, never collides, and
// stands blinking at the part if the student beat it. Presentation only: it reads the run, never changes it.

const RUST = new THREE.Color(0x8a4b2a);
const RUST_SHARE = 0.55;
/** The blink at the part (times a second) when the student has beaten it. */
const BLINK_HZ = 2;
/** The marker floats this high above the ground. */
const MARKER_LIFT_M = 1.8;

export interface ScavengerGhost {
  group: THREE.Group;
  /** Moves it to where the run puts it when the student's clock reads `clockS`. `playerFront` is the student rover's front on the ground (physics x, z). */
  update(input: { clockS: number; frameS: number; playerFrontXM: number; playerFrontZM: number; beaten: boolean }): void;
  /** Where the edge marker points, and how far it is from the student's rover. */
  marker(): { position: THREE.Vector3; distanceM: number; boosting: boolean };
  /** The current opacity (for tests). */
  readonly opacity: number;
  dispose(): void;
}

/** Fully solid at `fadeWithinM` and further; down to `fadeOpacity` at half that distance and closer. */
export function ghostOpacity(distM: number, fadeWithinM: number, fadeOpacity: number): number {
  const full = fadeWithinM;
  const least = fadeWithinM / 2;
  if (distM >= full) return 1;
  if (distM <= least) return fadeOpacity;
  return fadeOpacity + (1 - fadeOpacity) * ((distM - least) / (full - least));
}

export function createScavengerGhost(run: ScavengerRun, world: LevelWorld, quality: 'high' | 'low'): ScavengerGhost {
  const { lengthM, widthM } = world.footprint;
  const model = createRoverModel(lengthM, widthM, roverLookFor(run.build));
  const root = model.root;
  root.rotation.order = 'YZX';
  root.name = 'scavenger';

  // Rusty and patched: every colour pulled toward rust, dull, and two mismatched plates welded on the deck.
  const materials = new Set<THREE.Material>();
  root.traverse((o) => {
    o.castShadow = quality === 'high';
    if (o instanceof THREE.Mesh) for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m);
  });
  for (const m of materials) {
    if (m instanceof THREE.MeshStandardMaterial) {
      m.color.lerp(RUST, RUST_SHARE);
      m.roughness = 0.95;
      m.metalness = Math.min(m.metalness, 0.25);
      m.emissive.setHex(0x000000);
    }
    m.transparent = true;
  }
  const patchMaterials = [new THREE.MeshStandardMaterial({ color: 0x6f7a55, flatShading: true, roughness: 1, transparent: true }), new THREE.MeshStandardMaterial({ color: 0x9b8f7a, flatShading: true, roughness: 1, transparent: true })];
  for (const m of patchMaterials) materials.add(m);
  const patches = [
    { size: [0.55, 0.04, 0.4], at: [-lengthM / 2 + 0.2, 0.95, 0.2], tilt: 0.12 },
    { size: [0.4, 0.04, 0.5], at: [-lengthM / 2 - 0.35, 0.93, -0.25], tilt: -0.1 },
  ] as const;
  patches.forEach((p, i) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(p.size[0], p.size[1], p.size[2]), patchMaterials[i]!);
    mesh.position.set(p.at[0], p.at[1], p.at[2]);
    mesh.rotation.y = p.tilt;
    root.add(mesh);
  });

  const group = new THREE.Group();
  group.add(root);
  const cfg = levelsConfig.scavenger;
  let opacity = 1;
  let wheelAngle = 0;
  let lastX: number | undefined;
  let lastZ: number | undefined;
  let distanceM = Infinity;
  const markerAt = new THREE.Vector3();
  let boosting = false;

  // Its booster (R11): a short orange flame behind it while it burns, in the replay as in the run.
  const flameMaterial = new THREE.MeshBasicMaterial({ color: 0xff9a3c, transparent: true, opacity: 0.9 });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.6, 8), flameMaterial);
  flame.rotation.z = Math.PI / 2; // the tip points backward along the rover (+x forward)
  flame.position.set(-lengthM / 2 - 0.9, 0.55, 0);
  flame.visible = false;
  root.add(flame);

  const place = (x: number, z: number, heading: number): number => {
    const y = world.heightM(x, z) + groundOffsetOf(world, x, z);
    root.position.set(x, y, -z);
    root.rotation.y = heading;
    root.rotation.z = world.slopeRad(x - (Math.cos(heading) * lengthM) / 2, z - (Math.sin(heading) * lengthM) / 2, heading);
    return y;
  };

  return {
    group,
    update({ clockS, frameS, playerFrontXM, playerFrontZM, beaten }) {
      // Beaten: it stands at the part and blinks. Otherwise it plays back its run.
      const pose = run.poseAt(beaten ? Number.POSITIVE_INFINITY : clockS);
      const y = place(pose.frontXM, pose.frontZM, pose.headingRad);
      if (lastX !== undefined && lastZ !== undefined && frameS > 0) {
        const moved = Math.hypot(pose.frontXM - lastX, pose.frontZM - lastZ);
        if (moved < 4) wheelAngle -= wheelTurnRad(moved);
      }
      lastX = pose.frontXM;
      lastZ = pose.frontZM;
      for (const w of model.wheels) w.rotation.z = wheelAngle;
      distanceM = Math.hypot(pose.frontXM - playerFrontXM, pose.frontZM - playerFrontZM);
      opacity = ghostOpacity(distanceM, cfg.fadeWithinM, cfg.fadeOpacity);
      group.visible = !beaten || Math.floor((performance.now() / 1000) * BLINK_HZ * 2) % 2 === 0;
      for (const m of materials) m.opacity = opacity;
      markerAt.set(pose.frontXM, y + MARKER_LIFT_M, -pose.frontZM);
      boosting = pose.boosting && !beaten;
      flame.visible = boosting;
      if (boosting) flame.scale.set(0.8 + 0.4 * Math.abs(Math.sin(clockS * 60)), 1, 1);
    },
    marker: () => ({ position: markerAt, distanceM, boosting }),
    get opacity() {
      return opacity;
    },
    dispose() {
      root.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      for (const m of materials) m.dispose();
      flameMaterial.dispose();
    },
  };
}

/**
 * The split gates (SHOWCASE_PLAN §8): a thin pair of posts and a faint band across the road where each stretch after the first begins.
 * The gap to the Scavenger shows on the HUD the moment the rover's front crosses one.
 */
export function createSplitGates(world: LevelWorld, gates: readonly ForkLineDef[]): THREE.Group {
  const group = new THREE.Group();
  group.name = 'splitGates';
  const post = new THREE.MeshStandardMaterial({ color: 0xf2c14e, flatShading: true, emissive: 0x6b4d10 });
  const band = new THREE.MeshBasicMaterial({ color: 0xf2c14e, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false });
  for (const g of gates) {
    const heading = (g.headingDeg * Math.PI) / 180;
    const sideX = -Math.sin(heading);
    const sideZ = Math.cos(heading);
    const one = new THREE.Group();
    for (const side of [-1, 1]) {
      const x = g.xM + sideX * side * (g.widthM / 2);
      const z = g.zM + sideZ * side * (g.widthM / 2);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3, 0.25), post);
      mesh.position.set(x, world.heightM(x, z) + 1.5, -z);
      one.add(mesh);
    }
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(g.widthM, 2.4), band);
    plane.position.set(g.xM, world.heightM(g.xM, g.zM) + 1.5, -g.zM);
    plane.rotation.y = heading + Math.PI / 2; // the plane's width runs across the road
    one.add(plane);
    group.add(one);
  }
  return group;
}
