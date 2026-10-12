import { applyMultiplier } from './build.ts';
import { createState, step, type PhysicsState, type StepInput } from './step.ts';
import type { Multiplier, PhysicsConstants, RoverSpec, SurfaceSpec } from './types.ts';

// Mission measurement on a straight path with ideal driving and no screen (Physics Model Specification,
// "Mission measurement and pass rules"). Position x is the front of the rover along the path.

const MAX_SECONDS = 600; // safety stop for builds that can never finish

const withPowerUp = (rover: RoverSpec, powerUp?: Multiplier): RoverSpec =>
  powerUp ? applyMultiplier(rover, powerUp.variable, powerUp.multiplier) : rover;

export interface Mission1Result {
  /** Time to the target line: the end of the first step in which x reaches it. */
  timeS: number;
  /** Speed at the target, for average acceleration (DECISIONS OI-7). */
  endSpeedMps: number;
  /** Highest speed reached. */
  topSpeedMps: number;
}

/** Mission 1: from rest, full throttle, straight route of `lengthM` on one surface. A power-up is taken at the start. */
export function runMission1(
  rover: RoverSpec,
  surface: SurfaceSpec,
  lengthM: number,
  constants: PhysicsConstants,
  powerUp?: Multiplier,
): Mission1Result {
  const r = withPowerUp(rover, powerUp);
  const input: StepInput = { throttleHeld: true, brakeHeld: false, steer: 0 };
  let s = createState();
  let topSpeedMps = 0;
  const maxSteps = MAX_SECONDS / constants.timeStepS;
  while (s.distanceM < lengthM && s.stepCount < maxSteps) {
    s = step(s, input, r, surface, constants);
    topSpeedMps = Math.max(topSpeedMps, s.speedMps);
  }
  return { timeS: s.timeS, endSpeedMps: s.speedMps, topSpeedMps };
}

export interface Mission2Options {
  /** Taken at the start of the ice (Grip tyres). */
  startPowerUp?: Multiplier;
  /** Taken at the end of the ice (Smooth bearings): affects the coast only. */
  endOfIcePowerUp?: Multiplier;
}

export interface Mission2Result {
  /** Time to the power-cut line at the end of the ice. */
  iceTimeS: number;
  /** From x at the end of that step until the rover stops. */
  coastDistanceM: number;
  /** Speed at the power-cut line, for average acceleration (DECISIONS OI-7). */
  cutSpeedMps: number;
}

/** Mission 2: from rest on ice with full throttle; at the power-cut line the throttle is cut at once and locked. */
export function runMission2(
  rover: RoverSpec,
  ice: SurfaceSpec,
  sand: SurfaceSpec,
  params: { iceLengthM: number },
  constants: PhysicsConstants,
  options: Mission2Options = {},
): Mission2Result {
  const onIce = withPowerUp(rover, options.startPowerUp);
  const onSand = withPowerUp(onIce, options.endOfIcePowerUp);
  const maxSteps = MAX_SECONDS / constants.timeStepS;
  let s = createState();

  const drive: StepInput = { throttleHeld: true, brakeHeld: false, steer: 0 };
  while (s.distanceM < params.iceLengthM && s.stepCount < maxSteps) {
    s = step(s, drive, onIce, ice, constants);
  }
  const iceTimeS = s.timeS;
  const cutDistanceM = s.distanceM;
  const cutSpeedMps = s.speedMps;

  // From the next step: throttle level 0 with no release ramp (DECISIONS OI-2); the sand starts at the line.
  const coast: StepInput = { throttleHeld: true, brakeHeld: false, steer: 0, throttleLocked: true };
  while (s.speedMps > 0 && s.stepCount < maxSteps) {
    s = step(s, coast, onSand, sand, constants);
  }
  return { iceTimeS, coastDistanceM: s.distanceM - cutDistanceM, cutSpeedMps };
}

export interface Mission3Result {
  /** From x at the brake input (the brake line) to where the rover stops. */
  stoppingDistanceM: number;
  /** Time from the brake input to rest. */
  stoppingTimeS: number;
  /** Speed when the tow was released, for average acceleration (DECISIONS OI-7). */
  startSpeedMps: number;
}

/**
 * Mission 3: towed at the approach speed; the brake is held from the brake line, which releases the
 * tow and starts the brake build-up. This is the earliest and so the shortest stop the build can make.
 * A player who brakes later stops further on, so a build can pass iff this distance is at most the zone end.
 */
export function runMission3(
  rover: RoverSpec,
  asphalt: SurfaceSpec,
  params: { approachSpeedMps: number },
  constants: PhysicsConstants,
  powerUp?: Multiplier,
): Mission3Result {
  const r = withPowerUp(rover, powerUp);
  const maxSteps = MAX_SECONDS / constants.timeStepS;
  const brake: StepInput = { throttleHeld: false, brakeHeld: true, steer: 0, throttleLocked: true };
  let s: PhysicsState = createState({ speedMps: params.approachSpeedMps });
  while (s.speedMps > 0 && s.stepCount < maxSteps) {
    s = step(s, brake, r, asphalt, constants);
  }
  return { stoppingDistanceM: s.distanceM, stoppingTimeS: s.timeS, startSpeedMps: params.approachSpeedMps };
}

/**
 * Where a stopped rover is, against the zone (DECISIONS OI-8), with x the rover's front measured from the
 * brake line: inside if zoneStart + length ≤ x ≤ zoneEnd; short if x < zoneStart + length; past if x > zoneEnd.
 */
export function classifyStop(
  frontXM: number,
  zone: { zoneEndM: number; zoneLengthM: number; roverLengthM: number },
): 'inside' | 'short' | 'past' {
  const zoneStartM = zone.zoneEndM - zone.zoneLengthM;
  if (frontXM < zoneStartM + zone.roverLengthM) return 'short';
  if (frontXM > zone.zoneEndM) return 'past';
  return 'inside';
}
