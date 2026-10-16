import * as THREE from 'three';

// Skid marks (DECISIONS 2026-10-16): presentation only, no physics. While the physics reports wheel slip, a dark strip is
// laid behind each wheel; every strip fades out and is removed after a few seconds.

/** How long a mark takes to fade away, in seconds. */
export const SKID_FADE_S = 4;
/** The most marks alive at once: a guard for frame rate, oldest dropped first. */
export const SKID_MAX_MARKS = 600;
const SKID_START_OPACITY = 0.65;
const SKID_WIDTH_M = 0.22;
const SKID_HEIGHT_M = 0.065; // just above the tiles (their tops are at most about 0.05 m)
const SKID_MIN_LENGTH_M = 0.02;

/** 0.65 when new, fading linearly to 0 at SKID_FADE_S. */
export function skidOpacity(ageS: number): number {
  return Math.max(0, SKID_START_OPACITY * (1 - ageS / SKID_FADE_S));
}

interface Mark {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  ageS: number;
}

export interface SkidMarks {
  /** A strip from the wheel's last ground position to its new one (physics axes: x forward, z left). */
  addSegment(fromX: number, fromZ: number, toX: number, toZ: number): void;
  /** Ages every mark by `frameS` and removes the faded ones. */
  update(frameS: number): void;
  readonly count: number;
  dispose(): void;
}

export function createSkidMarks(scene: THREE.Scene): SkidMarks {
  const group = new THREE.Group();
  group.name = 'skidMarks';
  scene.add(group);
  const geometry = new THREE.PlaneGeometry(1, 1);
  let marks: Mark[] = [];

  const remove = (m: Mark) => {
    group.remove(m.mesh);
    m.material.dispose();
  };

  return {
    addSegment(fromX, fromZ, toX, toZ) {
      const dx = toX - fromX;
      const dz = toZ - fromZ;
      const length = Math.hypot(dx, dz);
      if (length < SKID_MIN_LENGTH_M) return;
      const material = new THREE.MeshBasicMaterial({ color: 0x0a0a0c, transparent: true, opacity: SKID_START_OPACITY, depthWrite: false });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = 'skidMark';
      mesh.rotation.order = 'YXZ'; // lie flat first, then turn about the vertical axis, as the rover model does
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.y = Math.atan2(dz, dx); // physics heading; three z is −physics z
      mesh.scale.set(length * 1.05, SKID_WIDTH_M, 1); // a little overlap so consecutive strips join
      mesh.position.set((fromX + toX) / 2, SKID_HEIGHT_M, -(fromZ + toZ) / 2);
      group.add(mesh);
      marks.push({ mesh, material, ageS: 0 });
      while (marks.length > SKID_MAX_MARKS) remove(marks.shift()!);
    },
    update(frameS) {
      for (const m of marks) {
        m.ageS += frameS;
        m.material.opacity = skidOpacity(m.ageS);
      }
      const alive: Mark[] = [];
      for (const m of marks) (m.ageS >= SKID_FADE_S ? remove(m) : alive.push(m));
      marks = alive;
    },
    get count() {
      return marks.length;
    },
    dispose() {
      for (const m of marks) remove(m);
      marks = [];
      scene.remove(group);
      geometry.dispose();
    },
  };
}
