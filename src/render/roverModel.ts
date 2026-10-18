import * as THREE from 'three';
import type { BuildSelection } from '../game/buildFromParts.ts';

// Original low-poly rover built from three.js geometry; no outside assets (CLAUDE.md, "Art and assets").
// LEVELS_BUILD_PLAN A5: a bevelled body with a deck and solar panel, a mast with a two-lens camera, an antenna dish,
// rocker suspension arms from a central pivot to the wheels, a rear motor pod with cooling fins and a headlight.
// Chassis, motor and wheels are separate groups, and each of the nine parts looks clearly different.

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

const WHEEL_RADIUS_M = 0.35;

// Colours: red-orange body against cream trim, gunmetal motor, deep-blue solar cells, brass dish, black tyres.
const COLOURS = {
  lightFrame: 0xf29b2e,
  standardShell: 0xc1440e,
  heavyShell: 0x5d667c,
  trim: 0xe9d8c4,
  dark: 0x1c2030,
  gunmetal: 0x3b4256,
  steel: 0x9aa3ad,
  solar: 0x1b2f66,
  solarLine: 0x5b7fcf,
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
function place(parent: THREE.Object3D, child: THREE.Object3D, x: number, y: number, z: number): void {
  child.position.set(x, y, z);
  parent.add(child);
}

/**
 * One wheel, axle along local z, centred on the origin. Width is along z.
 * - smooth: slim, round, pale and shiny, with a silver hub
 * - all-terrain: chunky, black, with square tread blocks and an orange hub cap
 * - spiked: dark, with steel spikes standing out from the rim and a steel hub cap
 */
function createWheel(style: WheelStyle): { wheel: THREE.Group; widthM: number } {
  const wheel = new THREE.Group();
  wheel.name = 'wheel';
  const tyre = (radius: number, width: number, segments: number, material: THREE.Material) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, segments), material);
    m.rotation.x = Math.PI / 2;
    return m;
  };
  const cap = (radius: number, width: number, color: number) => {
    const m = tyre(radius, width, 12, mat(color, { metalness: 0.5, roughness: 0.4 }));
    m.name = 'cap';
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
    wheel.add(tyre(WHEEL_RADIUS_M * 0.88, widthM * 0.94, 10, mat(0x15171d)));
    const treadMaterial = mat(0x2a2d36);
    const blocks = 10;
    for (let i = 0; i < blocks; i++) {
      const a = (i / blocks) * Math.PI * 2;
      const tread = box(0.13, 0.09, widthM, treadMaterial, 'tread');
      tread.position.set(Math.cos(a) * WHEEL_RADIUS_M * 0.9, Math.sin(a) * WHEEL_RADIUS_M * 0.9, 0);
      tread.rotation.z = a;
      wheel.add(tread);
    }
    wheel.add(cap(WHEEL_RADIUS_M * 0.38, widthM, COLOURS.standardShell));
    return { wheel, widthM };
  }

  const widthM = 0.34;
  wheel.add(tyre(WHEEL_RADIUS_M * 0.7, widthM * 0.9, 8, mat(0x2b1d17)));
  const spikeMaterial = mat(COLOURS.steel, { metalness: 0.7, roughness: 0.35 });
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
  wheel.add(cap(WHEEL_RADIUS_M * 0.3, widthM, COLOURS.steel));
  return { wheel, widthM };
}

// Body measurements, in metres, in the frame (x forward, the frame's middle at x = 0). The body sits between the
// wheels (their inner faces are at |z| ≥ 0.51), and nothing reaches past the 2 m length.
const BODY_HALF_WIDTH_M = 0.46;
const BODY_BOTTOM_M = 0.42;
const BODY_TOP_M = 0.86;
const HALF_LENGTH_M = 1; // the rover's length is 2 m

/** The bevelled side outline of the plated bodies, in x–y, extruded across the body's width. */
function shellGeometry(heavy: boolean): THREE.BufferGeometry {
  const s = new THREE.Shape();
  const noseTop = heavy ? BODY_TOP_M - 0.08 : BODY_TOP_M;
  s.moveTo(-0.86, BODY_BOTTOM_M);
  s.lineTo(0.84, BODY_BOTTOM_M);
  s.lineTo(0.98, BODY_BOTTOM_M + 0.12); // bevelled nose
  s.lineTo(0.98, noseTop - 0.16);
  s.lineTo(0.82, noseTop);
  s.lineTo(0.82, BODY_TOP_M);
  s.lineTo(-0.86, BODY_TOP_M);
  s.lineTo(-0.98, BODY_TOP_M - 0.1); // bevelled tail
  s.lineTo(-0.98, BODY_BOTTOM_M + 0.12);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: BODY_HALF_WIDTH_M * 2, bevelEnabled: false });
  g.translate(0, 0, -BODY_HALF_WIDTH_M);
  return g;
}

/** Light: an open frame of orange tubes and struts around a small battery plate. */
function createLightChassis(): THREE.Group {
  const g = new THREE.Group();
  const tubes = mat(COLOURS.lightFrame, { metalness: 0.3, roughness: 0.5 });
  const dark = mat(COLOURS.gunmetal);
  const zs = [-0.4, 0.4];
  const xs = [-0.92, -0.3, 0.3, 0.92];
  const lowY = 0.46;
  const highY = BODY_TOP_M - 0.03;
  for (const z of zs) {
    g.add(tube(v(-0.92, highY, z), v(0.92, highY, z), 0.035, tubes, 'tube')); // top rail
    g.add(tube(v(-0.92, lowY, z), v(0.92, lowY, z), 0.035, tubes, 'tube')); // bottom rail
    for (const x of [-0.92, 0.92]) g.add(tube(v(x, lowY, z), v(x, highY, z), 0.035, tubes, 'tube')); // end posts
    // Diagonal struts in each bay between the wheels.
    g.add(tube(v(-0.3, lowY, z), v(0.3, highY, z), 0.022, tubes, 'strut'));
    g.add(tube(v(0.3, lowY, z), v(-0.3, highY, z), 0.022, tubes, 'strut'));
  }
  for (const x of xs) {
    g.add(tube(v(x, highY, -0.4), v(x, highY, 0.4), 0.035, tubes, 'tube'));
  }
  for (const x of [-0.92, 0.92]) g.add(tube(v(x, lowY, -0.4), v(x, lowY, 0.4), 0.035, tubes, 'tube'));
  place(g, box(0.8, 0.1, 0.5, dark, 'plate'), 0, 0.5, 0); // battery pack on the floor
  place(g, box(0.5, 0.025, 0.6, dark, 'plate'), -0.62, BODY_TOP_M - 0.02, 0); // rear mounting plate for the motor
  g.name = 'chassis';
  return g;
}

/** Standard: a plated body: red-orange shell with cream side plates and a dark skid. */
function createStandardChassis(): THREE.Group {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(shellGeometry(false), mat(COLOURS.standardShell, { metalness: 0.2, roughness: 0.55 }));
  shell.name = 'shell';
  g.add(shell);
  const trim = mat(COLOURS.trim, { roughness: 0.6 });
  for (const side of [-1, 1]) {
    const plate = box(0.9, 0.22, 0.02, trim, 'plate');
    plate.position.set(0, 0.66, side * (BODY_HALF_WIDTH_M + 0.005));
    g.add(plate);
  }
  const skid = box(1.4, 0.04, 0.6, mat(COLOURS.dark), 'skid');
  skid.position.set(0, BODY_BOTTOM_M - 0.02, 0);
  g.add(skid);
  g.name = 'chassis';
  return g;
}

/** Heavy: an armoured body: dark steel, thick side plates, a hood plate, rivets and a hazard-striped bumper. */
function createHeavyChassis(): THREE.Group {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(shellGeometry(true), mat(COLOURS.heavyShell, { metalness: 0.5, roughness: 0.45 }));
  shell.name = 'shell';
  g.add(shell);
  const armour = mat(0x9aa3b8, { metalness: 0.5, roughness: 0.4 });
  const rivetMaterial = mat(COLOURS.steel, { metalness: 0.8, roughness: 0.3 });
  const rivet = (x: number, y: number, z: number) => {
    const r = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 4), rivetMaterial);
    r.name = 'rivet';
    r.position.set(x, y, z);
    g.add(r);
  };
  for (const side of [-1, 1]) {
    for (const y of [0.54, 0.74]) {
      const plate = box(0.44, 0.16, 0.06, armour, 'plate');
      const z = side * (BODY_HALF_WIDTH_M + 0.03);
      plate.position.set(0, y, z);
      g.add(plate);
      for (const x of [-0.16, 0.16]) rivet(x, y, side * (BODY_HALF_WIDTH_M + 0.06));
    }
  }
  const hood = box(0.3, 0.04, 0.6, armour, 'plate');
  hood.position.set(0.76, 0.77, 0);
  g.add(hood);
  for (const x of [0.66, 0.86]) for (const z of [-0.24, 0.24]) rivet(x, 0.8, z);
  const belly = box(1.3, 0.05, 0.7, mat(COLOURS.dark), 'plate');
  belly.position.set(0, BODY_BOTTOM_M - 0.025, 0);
  g.add(belly);
  const bumper = box(0.1, 0.18, 1.0, mat(COLOURS.hazard, { roughness: 0.5 }), 'bumper');
  bumper.position.set(0.94, 0.52, 0);
  g.add(bumper);
  for (const z of [-0.3, 0, 0.3]) {
    const stripe = box(0.104, 0.18, 0.1, mat(COLOURS.dark), 'stripe');
    stripe.position.set(0.94, 0.52, z);
    g.add(stripe);
  }
  g.name = 'chassis';
  return g;
}

const MOTOR_SIZES: Record<MotorStyle, { lengthM: number; heightM: number; widthM: number; fins: number; band: number }> = {
  small: { lengthM: 0.44, heightM: 0.2, widthM: 0.5, fins: 3, band: COLOURS.lensGlow },
  medium: { lengthM: 0.54, heightM: 0.27, widthM: 0.6, fins: 4, band: 0xffb347 },
  large: { lengthM: 0.64, heightM: 0.36, widthM: 0.78, fins: 6, band: 0xe0703c },
};

/** The rear motor pod: a gunmetal housing with cooling fins on top, a colour band and a nozzle at the back. */
function createMotor(style: MotorStyle): THREE.Group {
  const { lengthM, heightM, widthM, fins, band } = MOTOR_SIZES[style];
  const g = new THREE.Group();
  g.name = 'motor';
  const centreX = -0.62;
  const housing = box(lengthM, heightM, widthM, mat(COLOURS.gunmetal, { metalness: 0.5, roughness: 0.45 }), 'housing');
  housing.position.set(centreX, BODY_TOP_M + heightM / 2, 0);
  g.add(housing);
  const finMaterial = mat(0x8793b2, { metalness: 0.6, roughness: 0.4 });
  const finGap = lengthM / (fins + 1);
  for (let i = 0; i < fins; i++) {
    const fin = box(0.03, 0.08, widthM * 0.9, finMaterial, 'fin');
    fin.position.set(centreX - lengthM / 2 + finGap * (i + 1), BODY_TOP_M + heightM + 0.04, 0);
    g.add(fin);
  }
  const bandMesh = box(lengthM + 0.01, 0.04, widthM + 0.01, mat(band, { emissive: band, emissiveIntensity: 0.25 }), 'band');
  bandMesh.position.set(centreX, BODY_TOP_M + heightM * 0.55, 0);
  g.add(bandMesh);
  const nozzleRadius = heightM * 0.3;
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(nozzleRadius, nozzleRadius * 1.25, 0.06, 10), mat(0xa0673a, { metalness: 0.7, roughness: 0.4 }));
  nozzle.name = 'nozzle';
  nozzle.rotation.z = Math.PI / 2;
  nozzle.position.set(centreX - lengthM / 2 - 0.02, BODY_TOP_M + heightM * 0.45, 0);
  g.add(nozzle);
  return g;
}

/** The deck details every rover has: solar panel, mast with a two-lens camera, antenna dish and headlight. */
function createDeck(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'deck';

  const panel = new THREE.Group();
  panel.name = 'solarPanel';
  const cells = box(0.45, 0.025, 0.8, mat(COLOURS.solar, { metalness: 0.6, roughness: 0.3 }), 'cells');
  panel.add(cells);
  const lineMaterial = mat(COLOURS.solarLine, { metalness: 0.4 });
  for (const z of [-0.2, 0, 0.2]) place(panel, box(0.45, 0.006, 0.012, lineMaterial, 'cellLine'), 0, 0.0145, z);
  place(panel, box(0.012, 0.006, 0.8, lineMaterial, 'cellLine'), 0, 0.0145, 0);
  panel.position.set(0.075, BODY_TOP_M + 0.04, 0);
  panel.rotation.z = -0.05; // tilted a little toward the sun
  g.add(panel);

  const mast = new THREE.Group();
  mast.name = 'mast';
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.62, 8), mat(COLOURS.steel, { metalness: 0.7, roughness: 0.4 }));
  pole.name = 'pole';
  pole.position.y = 0.31;
  mast.add(pole);
  const head = box(0.13, 0.13, 0.36, mat(COLOURS.trim, { roughness: 0.5 }), 'head');
  head.position.y = 0.66;
  mast.add(head);
  for (const z of [-0.1, 0.1]) {
    const lens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.05, 10),
      mat(COLOURS.lens, { emissive: COLOURS.lensGlow, emissiveIntensity: 0.5, metalness: 0.8, roughness: 0.2 }),
    );
    lens.name = 'lens';
    lens.rotation.z = Math.PI / 2;
    lens.position.set(0.085, 0.66, z);
    mast.add(lens);
  }
  mast.position.set(0.55, BODY_TOP_M, 0);
  g.add(mast);

  const dish = new THREE.Group();
  dish.name = 'dish';
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.16, 6), mat(COLOURS.steel, { metalness: 0.7 }));
  stalk.name = 'stalk';
  stalk.position.y = 0.08;
  dish.add(stalk);
  const bowl = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2.8),
    new THREE.MeshStandardMaterial({ color: COLOURS.brass, metalness: 0.8, roughness: 0.3, flatShading: true, side: THREE.DoubleSide }),
  );
  bowl.name = 'bowl';
  bowl.rotation.x = Math.PI; // a cup facing up
  bowl.position.y = 0.2;
  bowl.rotation.z = 0.35; // tipped back toward the sky
  dish.add(bowl);
  dish.position.set(-0.22, BODY_TOP_M, -0.33);
  g.add(dish);

  const lamp = box(0.04, 0.07, 0.5, mat(COLOURS.lamp, { emissive: COLOURS.lamp, emissiveIntensity: 0.7 }), 'headlight');
  lamp.position.set(HALF_LENGTH_M - 0.02, 0.68, 0);
  g.add(lamp);
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
  const axleX = 0.6 * (lengthM / 2);
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
    const armZ = side * 0.5;
    const axleLength = Math.abs(z - armZ);
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, axleLength, 8), rockerMaterial);
    axle.name = 'axle';
    axle.rotation.x = Math.PI / 2;
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
    const z = side * 0.5;
    const pivot = v(0, 0.62, z);
    rocker.add(beam(pivot, v(axleX, WHEEL_RADIUS_M, z), 0.06, rockerMaterial, 'arm'));
    rocker.add(beam(pivot, v(-axleX, WHEEL_RADIUS_M, z), 0.06, rockerMaterial, 'arm'));
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.07, 10), mat(COLOURS.steel, { metalness: 0.8, roughness: 0.3 }));
    pin.name = 'pivot';
    pin.rotation.x = Math.PI / 2;
    pin.position.copy(pivot);
    rocker.add(pin);
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
