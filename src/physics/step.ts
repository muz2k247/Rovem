import { buildQuantities } from './build.ts';
import type { PhysicsConstants, RoverSpec, SurfaceSpec } from './types.ts';

export type DrivingState = 'Stopped' | 'Driving' | 'At top speed' | 'Cruising' | 'Coasting' | 'Braking';

/** What the controls say for one step. Keys, not levels: the levels are worked out inside `step`. */
export interface StepInput {
  throttleHeld: boolean;
  brakeHeld: boolean;
  /** +1 left (counter-clockwise from above), −1 right, 0 straight. */
  steer: -1 | 0 | 1;
  /** Mission 2 after the power-cut line, Mission 3 throughout: the throttle level is 0 at once (DECISIONS OI-2). */
  throttleLocked?: boolean;
  /** Mission 3 before the first brake input after the brake line: the tow line holds speed (Cruising). */
  towed?: boolean;
}

export interface PhysicsState {
  stepCount: number;
  /** stepCount × Δt, a multiple of Δt. */
  timeS: number;
  /** Distance along the path driven. */
  distanceM: number;
  speedMps: number;
  /** 0 points along +x; positive turns left. */
  headingRad: number;
  /** Position on the ground (heading + distance). */
  positionXM: number;
  positionZM: number;
  /** u_t and u_b, 0 to 1. */
  throttleLevel: number;
  brakeLevel: number;
  drivingState: DrivingState;
  accelerationMps2: number;
  /** F_d and F_b used in the last step. */
  driveForceN: number;
  brakeForceN: number;
  /** True when the requested force exceeded F_lim in the last step (FR-9). */
  slipping: boolean;
}

export function createState(init: Partial<PhysicsState> = {}): PhysicsState {
  return {
    stepCount: 0,
    timeS: 0,
    distanceM: 0,
    speedMps: 0,
    headingRad: 0,
    positionXM: 0,
    positionZM: 0,
    throttleLevel: 0,
    brakeLevel: 0,
    drivingState: 'Stopped',
    accelerationMps2: 0,
    driveForceN: 0,
    brakeForceN: 0,
    slipping: false,
    ...init,
  };
}

/** Held: the level rises by Δt/T up to 1. Released: it falls at the same rate down to 0. */
function nextLevel(level: number, held: boolean, buildUpS: number, dtS: number): number {
  return held ? Math.min(1, level + dtS / buildUpS) : Math.max(0, level - dtS / buildUpS);
}

/**
 * Moves for one step with constant acceleration a (step 4 of the fixed step):
 *   v' = v + aΔt,  d = vΔt + ½aΔt².
 * If v' would pass v_max the rover reaches v_max at t₁ = (v_max − v)/a and holds it; if v' would fall
 * below 0 it stops at t₁ = −v/a and stays stopped.
 */
export function advance(
  speedMps: number,
  accelerationMps2: number,
  dtS: number,
  topSpeedMps: number,
): { speedMps: number; distanceM: number } {
  const a = accelerationMps2;
  const v = speedMps;
  const vNew = v + a * dtS;
  if (a > 0 && vNew > topSpeedMps) {
    const t1 = (topSpeedMps - v) / a;
    return { speedMps: topSpeedMps, distanceM: v * t1 + 0.5 * a * t1 * t1 + topSpeedMps * (dtS - t1) };
  }
  if (a < 0 && vNew < 0) {
    const t1 = -v / a;
    return { speedMps: 0, distanceM: v * t1 + 0.5 * a * t1 * t1 };
  }
  return { speedMps: vNew, distanceM: v * dtS + 0.5 * a * dtS * dtS };
}

/**
 * One fixed step, in the order of the Physics Model Specification:
 * (1) control levels, (2) forces, (3) state and a, (4) move, (5) add distance and advance the clock.
 * Step 6, the mission lines, is the caller's job. `surface` is the surface under the rover's front.
 */
export function step(
  prev: PhysicsState,
  input: StepInput,
  rover: RoverSpec,
  surface: SurfaceSpec,
  constants: PhysicsConstants,
): PhysicsState {
  const dtS = constants.timeStepS;
  const q = buildQuantities(rover, surface, constants);
  const v = prev.speedMps;

  // 1. Control levels. Both held: the brake applies and the throttle counts as released (FR-6).
  const throttleKey = input.throttleHeld && !input.brakeHeld && !input.throttleLocked;
  const throttleLevel = input.throttleLocked ? 0 : nextLevel(prev.throttleLevel, throttleKey, constants.throttleBuildUpS, dtS);
  // While the tow line holds the rover, a held brake does nothing and its level stays 0 (FR-30, DECISIONS OI-8).
  const brakeLevel = input.towed ? 0 : nextLevel(prev.brakeLevel, input.brakeHeld, constants.brakeBuildUpS, dtS);

  // 2. Forces. F_d = min(u_t F_d,max, F_lim); F_b = min(u_b F_b,max, F_lim).
  const driveForceN = Math.min(throttleLevel * rover.driveForceMaxN, q.gripLimitN);
  const brakeForceN = Math.min(brakeLevel * rover.brakeForceMaxN, q.gripLimitN);

  // 3. State and acceleration, chosen from the levels (DECISIONS OI-1).
  let drivingState: DrivingState;
  let a: number;
  if (input.towed) {
    drivingState = 'Cruising'; // the tow line balances friction and holds the speed
    a = 0;
  } else if (brakeLevel > 0) {
    if (v > 0) {
      drivingState = 'Braking';
      a = -(brakeForceN + q.rollingForceN) / q.massKg; // a = −(F_b + F_r)/m
    } else {
      drivingState = 'Stopped';
      a = 0;
    }
  } else if (throttleLevel > 0) {
    if (v === 0 && driveForceN <= q.rollingForceN) {
      drivingState = 'Stopped';
      a = 0;
    } else if (v >= rover.topSpeedMps && driveForceN >= q.rollingForceN) {
      drivingState = 'At top speed'; // the motor only balances friction (FR-28)
      a = 0;
    } else {
      drivingState = 'Driving';
      a = (driveForceN - q.rollingForceN) / q.massKg; // a = (F_d − F_r)/m, negative if F_d < F_r
    }
  } else if (v > 0) {
    drivingState = 'Coasting';
    a = -q.rollingForceN / q.massKg; // a = −F_r/m
  } else {
    drivingState = 'Stopped';
    a = 0;
  }
  if (v >= rover.topSpeedMps && a > 0) a = 0;

  // Wheels slip when the force the current state uses is more than the grip can pass on (FR-9, DECISIONS OI-10):
  // drive force in Driving and At top speed, brake force in Braking. Other states never show slip.
  const slipping =
    ((drivingState === 'Driving' || drivingState === 'At top speed') && throttleLevel * rover.driveForceMaxN > q.gripLimitN) ||
    (drivingState === 'Braking' && brakeLevel * rover.brakeForceMaxN > q.gripLimitN);

  // Steering turns the heading before the move, only if the rover was moving at the start of the step.
  const turnRadPerS = (constants.turnRateDegPerS * Math.PI) / 180;
  const headingRad = v > 0 && input.steer !== 0 ? prev.headingRad + input.steer * turnRadPerS * dtS : prev.headingRad;

  // 4. Move with constant a.
  const moved = advance(v, a, dtS, rover.topSpeedMps);

  // 5. Add distance along the path, advance the clock.
  const stepCount = prev.stepCount + 1;
  return {
    stepCount,
    timeS: stepCount * dtS,
    distanceM: prev.distanceM + moved.distanceM,
    speedMps: moved.speedMps,
    headingRad,
    positionXM: prev.positionXM + moved.distanceM * Math.cos(headingRad),
    positionZM: prev.positionZM + moved.distanceM * Math.sin(headingRad),
    throttleLevel,
    brakeLevel,
    drivingState,
    accelerationMps2: a,
    driveForceN,
    brakeForceN,
    slipping,
  };
}
