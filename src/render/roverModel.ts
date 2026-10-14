import * as THREE from 'three';

// Original low-poly rover built from three.js geometry; no outside assets (CLAUDE.md, "Art and assets").
// Chassis, motor and wheels are separate meshes, and the three wheel types look clearly different.

export type WheelStyle = 'smooth' | 'all-terrain' | 'spiked';

/** Which look a wheels part gets. Unknown ids fall back to the starting wheels' look. */
export function wheelStyleFor(wheelsPartId: string): WheelStyle {
  if (wheelsPartId === 'wheels-smooth') return 'smooth';
  if (wheelsPartId === 'wheels-spiked') return 'spiked';
  return 'all-terrain';
}

const WHEEL_RADIUS_M = 0.35;

function mat(color: number, opts: { metalness?: number; roughness?: number } = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, ...opts });
}

function box(w: number, h: number, d: number, material: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
}

/**
 * One wheel, axle along local z, centred on the origin. Width is along z.
 * - smooth: slim, round, pale and shiny, with a silver hub
 * - all-terrain: chunky, black, with square tread blocks
 * - spiked: dark, with steel spikes standing out from the rim
 */
function createWheel(style: WheelStyle): { wheel: THREE.Group; widthM: number } {
  const wheel = new THREE.Group();
  wheel.name = 'wheel';
  const tyre = (radius: number, width: number, segments: number, material: THREE.Material) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, segments), material);
    m.rotation.x = Math.PI / 2;
    return m;
  };

  if (style === 'smooth') {
    const widthM = 0.2;
    wheel.add(tyre(WHEEL_RADIUS_M, widthM * 0.9, 24, mat(0xb8c0cc, { metalness: 0.4, roughness: 0.3 })));
    const hub = tyre(WHEEL_RADIUS_M * 0.55, widthM, 24, mat(0xe6e9f2, { metalness: 0.8, roughness: 0.2 }));
    hub.name = 'hub'; // stands just proud of the tyre faces
    wheel.add(hub);
    return { wheel, widthM };
  }

  if (style === 'all-terrain') {
    const widthM = 0.3;
    wheel.add(tyre(WHEEL_RADIUS_M * 0.88, widthM, 10, mat(0x15171d)));
    const treadMaterial = mat(0x2a2d36);
    const blocks = 10;
    for (let i = 0; i < blocks; i++) {
      const a = (i / blocks) * Math.PI * 2;
      const tread = box(0.13, 0.09, widthM, treadMaterial);
      tread.name = 'tread';
      tread.position.set(Math.cos(a) * WHEEL_RADIUS_M * 0.9, Math.sin(a) * WHEEL_RADIUS_M * 0.9, 0);
      tread.rotation.z = a;
      wheel.add(tread);
    }
    return { wheel, widthM };
  }

  const widthM = 0.34;
  wheel.add(tyre(WHEEL_RADIUS_M * 0.7, widthM, 8, mat(0x2b1d17)));
  const spikeMaterial = mat(0x9aa3ad, { metalness: 0.7, roughness: 0.35 });
  const spikes = 8;
  for (const z of [-widthM / 4, widthM / 4]) {
    for (let i = 0; i < spikes; i++) {
      const a = ((i + (z > 0 ? 0.5 : 0)) / spikes) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.06, WHEEL_RADIUS_M * 0.42, 5), spikeMaterial);
      spike.name = 'spike';
      const r = WHEEL_RADIUS_M * 0.7 + (WHEEL_RADIUS_M * 0.42) / 2 - 0.02;
      spike.position.set(Math.cos(a) * r, Math.sin(a) * r, z);
      spike.rotation.z = a - Math.PI / 2; // cone tip points out along the radius
      wheel.add(spike);
    }
  }
  return { wheel, widthM };
}

export interface RoverModel {
  root: THREE.Group;
  /** Tilts and lifts with the bumps. */
  body: THREE.Group;
  /** Spin these about local z to roll the wheels. */
  wheels: THREE.Group[];
  /** Front and rear axle, in metres behind the rover's front. */
  frontAxleBackM: number;
  rearAxleBackM: number;
}

/**
 * A rover whose chassis, wheels and motor are separate meshes. Local +x is forward; the origin is the front.
 * The outer faces of the wheels sit at ±widthM/2, so the model matches the footprint used for rocks.
 */
export function createRoverModel(lengthM: number, widthM: number, style: WheelStyle): RoverModel {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const frame = new THREE.Group();
  frame.position.x = -lengthM / 2; // the physics position is the rover's front, so centre the body behind it
  body.add(frame);

  const chassis = box(lengthM, 0.35, 1.2, mat(0xc1440e));
  chassis.position.y = 0.55;
  chassis.name = 'chassis';
  frame.add(chassis);

  const motor = box(lengthM * 0.35, 0.3, 0.7, mat(0x3b4256));
  motor.position.set(-lengthM * 0.25, 0.85, 0);
  motor.name = 'motor';
  frame.add(motor);

  const wheels: THREE.Group[] = [];
  const axleX = 0.6 * (lengthM / 2);
  for (const [x, side] of [
    [axleX, 1],
    [axleX, -1],
    [-axleX, 1],
    [-axleX, -1],
  ] as const) {
    const { wheel, widthM: wheelWidthM } = createWheel(style);
    wheel.position.set(x, WHEEL_RADIUS_M, side * (widthM / 2 - wheelWidthM / 2));
    frame.add(wheel);
    wheels.push(wheel);
  }
  return {
    root,
    body,
    wheels,
    frontAxleBackM: lengthM / 2 - axleX,
    rearAxleBackM: lengthM / 2 + axleX,
  };
}

export const ROVER_WHEEL_RADIUS_M = WHEEL_RADIUS_M;
