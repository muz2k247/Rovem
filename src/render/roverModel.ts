import * as THREE from 'three';
import type { BuildSelection } from '../game/buildFromParts.ts';
import {
  WHEEL_WIDTH_M,
  createAllTerrainWheel,
  createHeavyChassis,
  createLargeMotor,
  createLightChassis,
  createMediumMotor,
  createSmallMotor,
  createSmoothWheel,
  createSpikedWheel,
  createStandardChassis,
} from './roverParts.ts';

// Original low-poly rover built from three.js geometry; no outside assets (CLAUDE.md, "Art and assets").
// roverParts.ts holds the nine parts; this file puts a chassis, a motor and four wheels together. LEVELS_BUILD_PLAN A5: each chassis
// carries its own deck, solar panel, mast and camera, antenna dish, headlight and rocker arms. Chassis, motor and wheels
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
/** The rocker arms sit this far out on each side; the short axle runs from there to the wheel. */
const ROCKER_Z_M = 0.52;

// The nine parts come from roverParts.ts (made for Rovem by k._muz with Claude; docs/ASSETS.md). Every call there builds its own
// materials, so one rover's colours, fade and rust never touch another's (the Scavenger re-colours and fades its copy).
const CHASSIS_PARTS: Record<ChassisStyle, () => THREE.Group> = { light: createLightChassis, standard: createStandardChassis, heavy: createHeavyChassis };
const MOTOR_PARTS: Record<MotorStyle, () => THREE.Group> = { small: createSmallMotor, medium: createMediumMotor, large: createLargeMotor };
const WHEEL_PARTS: Record<WheelStyle, { make: () => THREE.Group; widthM: number }> = {
  smooth: { make: createSmoothWheel, widthM: WHEEL_WIDTH_M.smooth },
  'all-terrain': { make: createAllTerrainWheel, widthM: WHEEL_WIDTH_M.allTerrain },
  spiked: { make: createSpikedWheel, widthM: WHEEL_WIDTH_M.spiked },
};

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

  // The chassis carries the deck, mast, dish, headlight and rocker arms (roverParts.ts), so nothing else is added on top.
  const chassis = CHASSIS_PARTS[l.chassis]();
  chassis.name = 'chassis';
  frame.add(chassis);
  const motor = MOTOR_PARTS[l.motor]();
  motor.name = 'motor';
  frame.add(motor);

  const wheels: THREE.Group[] = [];
  const mounts: THREE.Group[] = [];
  const axleX = AXLE_SHARE * (lengthM / 2);
  const axleMaterial = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.35, metalness: 0.85, flatShading: true });
  const wheelOrder = [
    [axleX, 1],
    [axleX, -1],
    [-axleX, 1],
    [-axleX, -1],
  ] as const;
  const { make: makeWheel, widthM: wheelWidthM } = WHEEL_PARTS[l.wheels];
  for (const [x, side] of wheelOrder) {
    const mount = new THREE.Group();
    mount.name = 'wheelMount';
    const z = side * (widthM / 2 - wheelWidthM / 2);
    mount.position.set(x, WHEEL_RADIUS_M, z);
    // A short axle from the wheel to the rocker arm, which stays still while the wheel spins.
    const armZ = side * ROCKER_Z_M;
    const axleLength = Math.max(0.04, Math.abs(z - armZ));
    const axleGeometry = new THREE.CylinderGeometry(0.024, 0.024, axleLength, 8);
    axleGeometry.rotateX(Math.PI / 2);
    const axle = new THREE.Mesh(axleGeometry, axleMaterial);
    axle.name = 'axle';
    axle.position.z = (armZ - z) / 2;
    mount.add(axle);
    // The wheels are not the same on both faces (the outer face carries the disc, the inner one the brake), so the left ones are
    // turned half a turn. The spin group stays unturned, so spinning about its z means the same on both sides.
    const wheel = new THREE.Group();
    wheel.name = 'wheel';
    const part = makeWheel();
    if (side < 0) part.rotation.y = Math.PI;
    wheel.add(part);
    mount.add(wheel);
    frame.add(mount);
    wheels.push(wheel);
    mounts.push(mount);
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

/**
 * The tread blocks are 36° apart and the spikes 22.5°. A wheel that turns more than half of that between two frames looks
 * still or backwards (the wagon-wheel effect), and at 16 m/s and 60 fps the true turn is about 38°. So the picture turns at most
 * this far per frame: about 10° (under half of 22.5°). Presentation only.
 */
export const MAX_WHEEL_TURN_PER_FRAME_RAD = 0.18;

/** How far the wheels turn this frame for a move of `movedM` (signed, along the way the rover faces): s ÷ r, but never past the per-frame limit. */
export function wheelTurnRad(movedM: number): number {
  const turn = movedM / ROVER_WHEEL_RADIUS_M;
  return Math.max(-MAX_WHEEL_TURN_PER_FRAME_RAD, Math.min(MAX_WHEEL_TURN_PER_FRAME_RAD, turn));
}
