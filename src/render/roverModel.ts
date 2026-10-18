import * as THREE from 'three';
import type { BuildSelection } from '../game/buildFromParts.ts';

// Original low-poly rover built from three.js geometry; no outside assets (CLAUDE.md, "Art and assets").
// LEVELS_BUILD_PLAN A5: a bevelled body with a deck and solar panel, a mast with a two-lens camera, an antenna dish,
// rocker suspension arms from a central pivot to the wheels, a rear motor and a headlight. Chassis, motor and wheels
// are separate groups, and each of the nine parts looks clearly different.

export type WheelStyle = 'smooth' | 'all-terrain' | 'spiked';
export type ChassisStyle = 'light' | 'standard' | 'heavy';
export type MotorStyle = 'small' | 'medium' | 'large';

/** The three looks that make up a rover. */
export interface RoverLook {
  chassis: ChassisStyle;
  wheels: WheelStyle;
  motor: MotorStyle;
}

export const STARTING_LOOK: RoverLook = { chassis: 'standard', wheels: 'all-terrain', motor: 'medium' };

/** Which look a wheels part gets. Unknown ids fall back to the starting wheels' look. */
export function wheelStyleFor(wheelsPartId: string): WheelStyle {
  if (wheelsPartId === 'wheels-smooth') return 'smooth';
  if (wheelsPartId === 'wheels-spiked') return 'spiked';
  return 'all-terrain';
}

export function chassisStyleFor(chassisPartId: string): ChassisStyle {
  if (chassisPartId === 'chassis-light') return 'light';
  if (chassisPartId === 'chassis-heavy') return 'heavy';
  return 'standard';
}

export function motorStyleFor(motorPartId: string): MotorStyle {
  if (motorPartId === 'motor-small') return 'small';
  if (motorPartId === 'motor-large') return 'large';
  return 'medium';
}

/** The look of a whole build. */
export function roverLookFor(build: BuildSelection): RoverLook {
  return {
    chassis: chassisStyleFor(build.chassisId),
    wheels: wheelStyleFor(build.wheelsId),
    motor: motorStyleFor(build.motorId),
  };
}

/** Big wheels give the low, wide, rugged stance. Only the picture; the physics never reads this. */
const WHEEL_RADIUS_M = 0.42;
/** The axles sit this share of the half-length from the middle, so the tyres stay inside the 2 m length. */
const AXLE_SHARE = 0.54;

// Colours: red-orange body against cream trim, gunmetal frame, deep-blue solar cells, brass dish, black tyres.
const COLOURS = {
  lightFrame: 0xffb02e,
  standardShell: 0xc1440e,
  heavyShell: 0x59627a,
  trim: 0xe9d8c4,
  dark: 0x1c2030,
  gunmetal: 0x3b4256,
  steel: 0xaab3c2,
  solar: 0x1b2f66,
  solarLine: 0x6f93e0,
  brass: 0xc9a24a,
  hazard: 0xf2c14e,
  lens: 0x0b0f1a,
  lensGlow: 0x28d8e8,
  lamp: 0xfff1c4,
};

function mat(color: number, opts: { metalness?: number; roughness?: number; emissive?: number; emissiveIntensity?: number } = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, ...opts });
}

function box(w: number, h: number, d: number, material: THREE.Material, name = ''): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.name = name;
  return m;
}

/** A cylinder with its axis along x (`axis` 'x'), or along z. Radii, length, segments. */
function drum(radiusTop: number, radiusBottom: number, length: number, segments: number, material: THREE.Material, name: string, axis: 'x' | 'z' = 'x'): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, length, segments), material);
  m.name = name;
  if (axis === 'x') m.rotation.z = Math.PI / 2;
  else m.rotation.x = Math.PI / 2;
  return m;
}

/** A box beam from a to b, `t` thick both ways. */
function beam(a: THREE.Vector3, b: THREE.Vector3, t: number, material: THREE.Material, name: string): THREE.Mesh {
  const dir = b.clone().sub(a);
  const m = box(dir.length(), t, t, material, name);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.normalize());
  return m;
}

/** A round tube of the given radius from a to b. */
function tube(a: THREE.Vector3, b: THREE.Vector3, radius: number, material: THREE.Material, name: string): THREE.Mesh {
  const dir = b.clone().sub(a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, dir.length(), 8), material);
  m.name = name;
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return m;
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Adds `child` to `parent` at a position. */
function place<T extends THREE.Object3D>(parent: THREE.Object3D, child: T, x: number, y: number, z: number): T {
  child.position.set(x, y, z);
  parent.add(child);
  return child;
}

/**
 * One wheel, axle along local z, centred on the origin. Width is along z. All three are round tyres.
 * - smooth: slim, pale and shiny, with a dark rim and a silver hub
 * - all-terrain: a chunky black tyre with ten raised tread blocks and an orange hub cap
 * - spiked: a dark tyre studded with sixteen steel spikes and a steel hub cap
 * The inner face of every wheel is at least 0.55 m from the middle, so the body can be 1.0 m wide.
 */
function createWheel(style: WheelStyle): { wheel: THREE.Group; widthM: number } {
  const wheel = new THREE.Group();
  wheel.name = 'wheel';
  const R = WHEEL_RADIUS_M;
  const tyre = (radius: number, width: number, segments: number, material: THREE.Material, name = '') => drum(radius, radius, width, segments, material, name, 'z');

  if (style === 'smooth') {
    const widthM = 0.2;
    wheel.add(tyre(R, widthM * 0.9, 28, mat(0xb8c0cc, { metalness: 0.4, roughness: 0.3 })));
    wheel.add(tyre(R * 0.66, widthM * 0.96, 20, mat(COLOURS.dark, { metalness: 0.5 }), 'rim'));
    wheel.add(tyre(R * 0.5, widthM, 20, mat(0xe6e9f2, { metalness: 0.8, roughness: 0.2 }), 'hub')); // stands just proud of the tyre faces
    return { wheel, widthM };
  }

  if (style === 'all-terrain') {
    const widthM = 0.28;
    wheel.add(tyre(R * 0.88, widthM * 0.94, 28, mat(0x15171d)));
    const treadMaterial = mat(0x34383f);
    const blocks = 10;
    for (let i = 0; i < blocks; i++) {
      const a = (i / blocks) * Math.PI * 2;
      const tread = box(0.06, 0.17, widthM, treadMaterial, 'tread'); // 0.06 m out from the tyre, 0.17 m round it
      tread.position.set(Math.cos(a) * R * 0.95, Math.sin(a) * R * 0.95, 0);
      tread.rotation.z = a;
      wheel.add(tread);
    }
    wheel.add(tyre(R * 0.5, widthM * 0.97, 16, mat(COLOURS.dark, { metalness: 0.4 }), 'rim'));
    wheel.add(tyre(R * 0.34, widthM, 12, mat(COLOURS.standardShell, { metalness: 0.5, roughness: 0.4 }), 'cap'));
    return { wheel, widthM };
  }

  const widthM = 0.3;
  wheel.add(tyre(R * 0.86, widthM * 0.9, 28, mat(0x2b1d17)));
  const spikeMaterial = mat(COLOURS.steel, { metalness: 0.7, roughness: 0.35 });
  const spikes = 16;
  const spikeLength = R - R * 0.86 + 0.03;
  for (let i = 0; i < spikes; i++) {
    const a = (i / spikes) * Math.PI * 2;
    const z = i % 2 === 0 ? -widthM / 4 : widthM / 4; // alternate sides, so the studs stagger across the tread
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.038, spikeLength, 5), spikeMaterial);
    spike.name = 'spike';
    const r = R * 0.86 + spikeLength / 2 - 0.005;
    spike.position.set(Math.cos(a) * r, Math.sin(a) * r, z);
    spike.rotation.z = a - Math.PI / 2; // cone tip points out along the radius
    wheel.add(spike);
  }
  wheel.add(tyre(R * 0.5, widthM * 0.97, 16, mat(COLOURS.dark, { metalness: 0.4 }), 'rim'));
  wheel.add(tyre(R * 0.32, widthM, 12, mat(COLOURS.steel, { metalness: 0.8, roughness: 0.3 }), 'cap'));
  return { wheel, widthM };
}

// Body measurements, in metres, in the frame (x forward, the frame's middle at x = 0). The body sits between the
// wheels (their inner faces are at |z| ≥ 0.55), and nothing reaches past the 2 m length.
const BODY_HALF_WIDTH_M = 0.5;
const BODY_BOTTOM_M = 0.4;
const BODY_TOP_M = 0.78;
const HALF_LENGTH_M = 1; // the rover's length is 2 m
const BEVEL_M = 0.04;

/** The side outline of the plated bodies, in x–y, extruded across the width with a bevel on every edge. */
function shellGeometry(heavy: boolean): THREE.BufferGeometry {
  const s = new THREE.Shape();
  const top = BODY_TOP_M - BEVEL_M;
  const hoodTop = heavy ? top - 0.04 : top - 0.08; // the hood sits a little lower than the back
  const nose = HALF_LENGTH_M - 0.06 - BEVEL_M;
  s.moveTo(-0.76, BODY_BOTTOM_M + BEVEL_M);
  s.lineTo(0.76, BODY_BOTTOM_M + BEVEL_M);
  s.lineTo(nose, BODY_BOTTOM_M + 0.16); // bevelled nose
  s.lineTo(nose, hoodTop - 0.06);
  s.lineTo(0.5, hoodTop);
  s.lineTo(0.3, top);
  s.lineTo(-0.74, top);
  s.lineTo(-nose, top - 0.1); // sloped tail
  s.lineTo(-nose, BODY_BOTTOM_M + 0.16);
  s.closePath();
  const depth = BODY_HALF_WIDTH_M * 2 - BEVEL_M * 2;
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: BEVEL_M, bevelSize: BEVEL_M, bevelSegments: 1 });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** Light: an open frame of amber tubes and struts around a battery pack: you can see through it. */
function createLightChassis(): THREE.Group {
  const g = new THREE.Group();
  const tubes = mat(COLOURS.lightFrame, { metalness: 0.3, roughness: 0.45 });
  const dark = mat(COLOURS.gunmetal);
  const lowY = 0.46;
  const highY = BODY_TOP_M - 0.04;
  const rail = 0.04;
  const zs = [-0.44, 0.44];
  for (const z of zs) {
    g.add(tube(v(-0.92, highY, z), v(0.92, highY, z), rail, tubes, 'tube')); // top rail
    g.add(tube(v(-0.92, lowY, z), v(0.92, lowY, z), rail, tubes, 'tube')); // bottom rail
    for (const x of [-0.92, 0.92]) g.add(tube(v(x, lowY, z), v(x, highY, z), rail, tubes, 'tube')); // end posts
    // Diagonal struts in each bay.
    g.add(tube(v(-0.4, lowY, z), v(0.4, highY, z), 0.026, tubes, 'strut'));
    g.add(tube(v(0.4, lowY, z), v(-0.4, highY, z), 0.026, tubes, 'strut'));
    for (const x of [-0.4, 0.4]) g.add(tube(v(x, lowY, z), v(x, highY, z), 0.03, tubes, 'tube'));
  }
  for (const x of [-0.92, -0.4, 0.4, 0.92]) g.add(tube(v(x, highY, -0.44), v(x, highY, 0.44), rail, tubes, 'tube'));
  for (const x of [-0.92, 0.92]) g.add(tube(v(x, lowY, -0.44), v(x, lowY, 0.44), rail, tubes, 'tube'));
  // The load it carries: a battery pack and a thin deck plate under the solar panel.
  place(g, box(0.8, 0.14, 0.5, dark, 'plate'), 0, 0.53, 0);
  place(g, box(1.3, 0.025, 0.86, mat(COLOURS.dark, { metalness: 0.4 }), 'plate'), 0, BODY_TOP_M - 0.07, 0);
  g.name = 'chassis';
  return g;
}

/** Standard: a bevelled plated body: red-orange shell, cream side plates, a dark skirt and nose grille. */
function createStandardChassis(): THREE.Group {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(shellGeometry(false), mat(COLOURS.standardShell, { metalness: 0.2, roughness: 0.5 }));
  shell.name = 'shell';
  g.add(shell);
  const trim = mat(COLOURS.trim, { roughness: 0.6 });
  for (const side of [-1, 1]) {
    place(g, box(0.78, 0.2, 0.02, trim, 'plate'), 0.02, 0.64, side * (BODY_HALF_WIDTH_M + 0.01));
    place(g, box(1.5, 0.05, 0.02, mat(COLOURS.dark), 'skirt'), 0, 0.45, side * (BODY_HALF_WIDTH_M + 0.01));
  }
  place(g, box(0.02, 0.14, 0.56, mat(COLOURS.dark, { metalness: 0.5 }), 'grille'), HALF_LENGTH_M - 0.06, 0.56, 0);
  place(g, box(0.9, 0.012, 0.1, trim, 'stripe'), 0.3, BODY_TOP_M + 0.005, 0); // a racing stripe along the top
  for (const z of [-0.32, 0.32]) place(g, box(0.02, 0.06, 0.14, mat(0xff4d3a, { emissive: 0xff4d3a, emissiveIntensity: 0.7 }), 'taillight'), -(HALF_LENGTH_M - 0.06), 0.62, z);
  g.name = 'chassis';
  return g;
}

/** Heavy: an armoured body: dark steel, thick side plates with rivets, a hood plate and a hazard-striped bumper. */
function createHeavyChassis(): THREE.Group {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(shellGeometry(true), mat(COLOURS.heavyShell, { metalness: 0.5, roughness: 0.45 }));
  shell.name = 'shell';
  g.add(shell);
  const armour = mat(0xa9b2c6, { metalness: 0.5, roughness: 0.4 });
  const rivetMaterial = mat(0xe2e6ee, { metalness: 0.8, roughness: 0.3 });
  const rivet = (x: number, y: number, z: number) => {
    const r = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), rivetMaterial);
    r.name = 'rivet';
    r.position.set(x, y, z);
    g.add(r);
  };
  for (const side of [-1, 1]) {
    for (const y of [0.54, 0.72]) {
      place(g, box(0.9, 0.16, 0.06, armour, 'plate'), 0, y, side * (BODY_HALF_WIDTH_M + 0.03));
      for (const x of [-0.36, -0.12, 0.12, 0.36]) rivet(x, y, side * (BODY_HALF_WIDTH_M + 0.065));
    }
  }
  place(g, box(0.36, 0.04, 0.7, armour, 'plate'), 0.64, 0.76, 0); // hood plate
  for (const x of [0.52, 0.76]) for (const z of [-0.28, 0.28]) rivet(x, 0.8, z);
  place(g, box(1.5, 0.06, 0.8, mat(COLOURS.dark), 'plate'), 0, BODY_BOTTOM_M - 0.02, 0); // belly plate
  place(g, box(0.1, 0.2, 1.04, mat(COLOURS.hazard, { roughness: 0.5 }), 'bumper'), 0.94, 0.54, 0);
  for (const z of [-0.36, -0.12, 0.12, 0.36]) place(g, box(0.104, 0.2, 0.08, mat(COLOURS.dark), 'stripe'), 0.94, 0.54, z);
  g.name = 'chassis';
  return g;
}

interface MotorSize {
  lengthM: number;
  radiusM: number;
  fins: number;
  housing: number;
  fin: number;
  band: number;
}

// Each motor is a drum on its side: the housing grows with the motor, its colour changes, and cooling fins ring it.
const MOTORS: Record<MotorStyle, MotorSize> = {
  small: { lengthM: 0.44, radiusM: 0.13, fins: 3, housing: 0x3aa6a6, fin: 0xc7d2dc, band: 0x28d8e8 },
  medium: { lengthM: 0.56, radiusM: 0.17, fins: 4, housing: 0x6b7fa8, fin: 0xd8dde8, band: 0xffb347 },
  large: { lengthM: 0.68, radiusM: 0.22, fins: 6, housing: 0x2b2f3d, fin: 0xe0703c, band: 0xe0703c },
};

/** The rear motor: a drum with ringed cooling fins, a colour band, an end bell, a shaft and a cradle. */
function createMotor(style: MotorStyle): THREE.Group {
  const { lengthM, radiusM, fins, housing: housingColour, fin: finColour, band } = MOTORS[style];
  const g = new THREE.Group();
  g.name = 'motor';
  const rearX = -0.94;
  const centreX = rearX + lengthM / 2;
  const centreY = BODY_TOP_M + radiusM * 0.7;
  place(g, drum(radiusM, radiusM, lengthM, 16, mat(housingColour, { metalness: 0.5, roughness: 0.4 }), 'housing'), centreX, centreY, 0);
  const finMaterial = mat(finColour, { metalness: 0.6, roughness: 0.4 });
  const span = lengthM * 0.62;
  for (let i = 0; i < fins; i++) {
    const x = centreX + lengthM * 0.04 - span / 2 + (span * (i + 0.5)) / fins;
    place(g, drum(radiusM * 1.28, radiusM * 1.28, 0.025, 16, finMaterial, 'fin'), x, centreY, 0);
  }
  place(g, drum(radiusM * 1.05, radiusM * 1.05, 0.05, 16, mat(band, { emissive: band, emissiveIntensity: 0.3 }), 'band'), centreX + lengthM * 0.4, centreY, 0);
  place(g, drum(radiusM * 0.8, radiusM * 0.95, 0.07, 16, mat(COLOURS.gunmetal, { metalness: 0.6 }), 'endbell'), centreX - lengthM / 2 - 0.02, centreY, 0);
  place(g, drum(radiusM * 0.3, radiusM * 0.3, 0.1, 8, mat(COLOURS.brass, { metalness: 0.8, roughness: 0.3 }), 'shaft'), centreX + lengthM / 2 + 0.04, centreY, 0);
  place(g, box(lengthM * 0.7, 0.05, radiusM * 2.2, mat(COLOURS.dark, { metalness: 0.4 }), 'cradle'), centreX, BODY_TOP_M + 0.01, 0);
  g.add(tube(v(centreX + lengthM * 0.3, centreY + radiusM * 0.8, 0.0), v(centreX + lengthM * 0.45, BODY_TOP_M + 0.04, radiusM * 1.1), 0.012, mat(0xff4d3a), 'cable'));
  return g;
}

/** The deck details every rover has: solar panel, a short mast with a two-lens camera, an antenna dish and a headlight. */
function createDeck(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'deck';

  const panel = new THREE.Group();
  panel.name = 'solarPanel';
  const frameMaterial = mat(COLOURS.steel, { metalness: 0.7, roughness: 0.4 });
  panel.add(box(0.54, 0.02, 0.7, frameMaterial, 'panelFrame'));
  place(panel, box(0.5, 0.012, 0.66, mat(COLOURS.solar, { metalness: 0.6, roughness: 0.3 }), 'cells'), 0, 0.013, 0);
  const lineMaterial = mat(COLOURS.solarLine, { metalness: 0.4 });
  for (const z of [-0.2, 0, 0.2]) place(panel, box(0.5, 0.004, 0.012, lineMaterial, 'cellLine'), 0, 0.021, z);
  for (const x of [-0.12, 0.12]) place(panel, box(0.012, 0.004, 0.66, lineMaterial, 'cellLine'), x, 0.021, 0);
  panel.position.set(0.0, BODY_TOP_M + 0.035, 0);
  panel.rotation.z = -0.06; // tilted a little toward the sun
  g.add(panel);
  for (const z of [-0.26, 0.26]) place(g, box(0.05, 0.05, 0.05, frameMaterial, 'panelFoot'), 0, BODY_TOP_M + 0.015, z);

  // The mast: a squat tapered post on a base plate, with a collar, topped by a camera head with a sun visor.
  const mast = new THREE.Group();
  mast.name = 'mast';
  place(mast, drum(0.08, 0.1, 0.03, 12, mat(COLOURS.dark, { metalness: 0.5 }), 'base', 'x'), 0, 0.015, 0).rotation.set(0, 0, 0);
  place(mast, new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.035, 0.26, 8), mat(COLOURS.steel, { metalness: 0.7, roughness: 0.4 })), 0, 0.16, 0).name = 'pole';
  place(mast, drum(0.045, 0.045, 0.03, 10, mat(COLOURS.brass, { metalness: 0.8 }), 'collar', 'x'), 0, 0.12, 0).rotation.set(0, 0, 0);
  place(mast, box(0.15, 0.1, 0.3, mat(COLOURS.trim, { roughness: 0.5 }), 'head'), 0.01, 0.34, 0);
  place(mast, box(0.1, 0.02, 0.32, mat(COLOURS.dark), 'visor'), 0.06, 0.4, 0);
  for (const z of [-0.08, 0.08]) {
    place(mast, drum(0.05, 0.05, 0.02, 12, mat(COLOURS.dark, { metalness: 0.6 }), 'bezel'), 0.088, 0.34, z);
    place(mast, drum(0.038, 0.038, 0.03, 12, mat(COLOURS.lens, { emissive: COLOURS.lensGlow, emissiveIntensity: 0.5, metalness: 0.8, roughness: 0.2 }), 'lens'), 0.095, 0.34, z);
  }
  place(mast, new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), mat(0xff4d3a, { emissive: 0xff4d3a, emissiveIntensity: 0.9 })), -0.04, 0.4, 0).name = 'beacon';
  mast.position.set(0.55, BODY_TOP_M, 0);
  g.add(mast);

  const dish = new THREE.Group();
  dish.name = 'dish';
  place(dish, new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.12, 6), mat(COLOURS.steel, { metalness: 0.7 })), 0, 0.06, 0).name = 'stalk';
  const bowl = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2.8),
    new THREE.MeshStandardMaterial({ color: COLOURS.brass, metalness: 0.8, roughness: 0.3, flatShading: true, side: THREE.DoubleSide }),
  );
  bowl.name = 'bowl';
  bowl.rotation.x = Math.PI; // a cup facing up
  bowl.position.y = 0.16;
  bowl.rotation.z = 0.35; // tipped back toward the sky
  dish.add(bowl);
  dish.position.set(-0.18, BODY_TOP_M, -0.4);
  g.add(dish);

  place(g, box(0.04, 0.07, 0.42, mat(COLOURS.lamp, { emissive: COLOURS.lamp, emissiveIntensity: 0.7 }), 'headlight'), HALF_LENGTH_M - 0.02, 0.68, 0);
  return g;
}

export interface RoverAttitude {
  /** Nose up is positive. */
  pitchRad: number;
  /** The top leaning toward +z (the rover's right) is positive. */
  leanRad: number;
}

export interface RoverModel {
  root: THREE.Group;
  /** Lifted and tilted with the bumps by the drive scene. */
  body: THREE.Group;
  /** Spin these about local z to roll the wheels. Front left and right first, then rear. */
  wheels: THREE.Group[];
  /** The mounts of the two front wheels: turning them about y steers. */
  steerPivots: THREE.Group[];
  /** The separate parts, e.g. for the garage swap animation. */
  parts: { chassis: THREE.Group; motor: THREE.Group; wheelMounts: THREE.Group[] };
  /** Front and rear axle, in metres behind the rover's front. */
  frontAxleBackM: number;
  rearAxleBackM: number;
  /** Front wheel angle about the vertical axis; positive turns left. */
  setSteer(angleRad: number): void;
  /** Pitch and lean of the whole body about its middle, a little above the ground. Presentation only. */
  setAttitude(a: RoverAttitude): void;
}

/** Height of the roll axis the body pitches and leans about. */
const ATTITUDE_PIVOT_Y_M = 0.3;

/**
 * A rover whose chassis, wheels and motor are separate groups. Local +x is forward; the origin is the front.
 * The outer faces of the wheels sit at ±widthM/2, so the model matches the footprint used for rocks.
 * Passing only a wheel style gives the starting body and motor.
 */
export function createRoverModel(lengthM: number, widthM: number, look: RoverLook | WheelStyle): RoverModel {
  const l: RoverLook = typeof look === 'string' ? { ...STARTING_LOOK, wheels: look } : look;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const attitude = new THREE.Group();
  attitude.position.set(-lengthM / 2, ATTITUDE_PIVOT_Y_M, 0); // the physics position is the rover's front, so centre the body behind it
  body.add(attitude);
  const frame = new THREE.Group();
  frame.position.y = -ATTITUDE_PIVOT_Y_M;
  attitude.add(frame);

  const chassis = l.chassis === 'light' ? createLightChassis() : l.chassis === 'heavy' ? createHeavyChassis() : createStandardChassis();
  frame.add(chassis);
  const motor = createMotor(l.motor);
  frame.add(motor);
  frame.add(createDeck());

  const wheels: THREE.Group[] = [];
  const mounts: THREE.Group[] = [];
  const axleX = AXLE_SHARE * (lengthM / 2);
  const rockerMaterial = mat(COLOURS.gunmetal, { metalness: 0.6, roughness: 0.4 });
  const wheelOrder = [
    [axleX, 1],
    [axleX, -1],
    [-axleX, 1],
    [-axleX, -1],
  ] as const;
  for (const [x, side] of wheelOrder) {
    const { wheel, widthM: wheelWidthM } = createWheel(l.wheels);
    const mount = new THREE.Group();
    mount.name = 'wheelMount';
    const z = side * (widthM / 2 - wheelWidthM / 2);
    mount.position.set(x, WHEEL_RADIUS_M, z);
    // A short axle from the wheel to the rocker arm, which stays still while the wheel spins.
    const armZ = side * 0.52;
    const axleLength = Math.abs(z - armZ);
    const axle = drum(0.035, 0.035, axleLength, 8, rockerMaterial, 'axle', 'z');
    axle.position.z = (armZ - z) / 2;
    mount.add(axle);
    mount.add(wheel);
    frame.add(mount);
    wheels.push(wheel);
    mounts.push(mount);
  }

  // Rocker arms: from a central pivot on each side down to the front and rear wheel centres.
  for (const side of [1, -1]) {
    const rocker = new THREE.Group();
    rocker.name = 'rocker';
    const z = side * 0.52;
    const pivot = v(0, 0.66, z);
    rocker.add(beam(pivot, v(axleX, WHEEL_RADIUS_M, z), 0.07, rockerMaterial, 'arm'));
    rocker.add(beam(pivot, v(-axleX, WHEEL_RADIUS_M, z), 0.07, rockerMaterial, 'arm'));
    place(rocker, drum(0.065, 0.065, 0.08, 10, mat(COLOURS.steel, { metalness: 0.8, roughness: 0.3 }), 'pivot', 'z'), pivot.x, pivot.y, pivot.z);
    frame.add(rocker);
  }

  const steerPivots = [mounts[0]!, mounts[1]!];
  return {
    root,
    body,
    wheels,
    steerPivots,
    parts: { chassis, motor, wheelMounts: mounts },
    frontAxleBackM: lengthM / 2 - axleX,
    rearAxleBackM: lengthM / 2 + axleX,
    setSteer(angleRad) {
      for (const p of steerPivots) p.rotation.y = angleRad;
    },
    setAttitude({ pitchRad, leanRad }) {
      attitude.rotation.set(leanRad, 0, pitchRad);
    },
  };
}

export const ROVER_WHEEL_RADIUS_M = WHEEL_RADIUS_M;
