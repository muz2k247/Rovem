import { buildQuantities } from './build.ts';
import type { PhysicsConstants, RoverSpec, SurfaceSpec } from './types.ts';

export type DrivingState = 'Stopped' | 'Driving' | 'At top speed' | 'Cruising' | 'Coasting' | 'Braking';

/** Direction of travel. The speed v ≥ 0 is the size of the velocity; the rover moves along heading × direction. */
export type Direction = 'forward' | 'reverse';

/** What the controls say for one step. Keys, not levels: the levels are worked out inside `step`. */
export interface StepInput {
  /** The throttle key (W/↑). Drives forward; brakes in reverse. */
  throttleHeld: boolean;
  /** The brake key (S/↓). Brakes forward; drives in reverse. */
  brakeHeld: boolean;
  /** +1 left (counter-clockwise from above), −1 right, 0 straight. */
  steer: -1 | 0 | 1;
  /** Mission 2 after the power-cut line, Mission 3 throughout (tow model; from M11 the lock starts after the brake line, DESIGN §5): the throttle level is 0 at once (DECISIONS OI-2). */
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
  direction: Direction;
  /** The way the rover faces: 0 points along +x; positive turns left. In reverse it moves the other way. */
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
    direction: 'forward',
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

/** Which key drives and which brakes: forward, W drives and S brakes; in reverse the roles swap. */
function keyRoles(direction: Direction, input: StepInput): { driveHeld: boolean; brakeHeld: boolean } {
  return direction === 'forward'
    ? { driveHeld: input.throttleHeld, brakeHeld: input.brakeHeld }
    : { driveHeld: input.brakeHeld, brakeHeld: input.throttleHeld };
}

/**
 * One fixed step, in the order of the Physics Model Specification:
 * (1) control levels, (2) forces, (3) state and a, (4) move, (5) add distance and advance the clock.
 * Step 6, the mission lines, is the caller's job. `surface` is the surface under the rover's front.
 * `externalForceN` acts along the direction of travel; it is reserved for future modifiers (wind, tractor
 * beam; DESIGN §8) and unused in the MVP. Left at 0, it changes nothing.
 */
export function step(
  prev: PhysicsState,
  input: StepInput,
  rover: RoverSpec,
  surface: SurfaceSpec,
  constants: PhysicsConstants,
  externalForceN = 0,
): PhysicsState {
  const dtS = constants.timeStepS;
  const q = buildQuantities(rover, surface, constants);
  const v = prev.speedMps;

  // 1a. Direction (DECISIONS 2026-10-13, Reverse). At the start of a step with v = 0, holding the current
  // brake key without the current drive key flips the direction. The levels carry on unchanged, so after
  // braking to a stop the brake level must fall to 0 before the rover moves the other way.
  let direction = prev.direction;
  let keys = keyRoles(direction, input);
  if (v === 0 && keys.brakeHeld && !keys.driveHeld) {
    direction = direction === 'forward' ? 'reverse' : 'forward';
    keys = keyRoles(direction, input);
  }
  // Reverse top speed = fraction × v_max.
  const topSpeedMps = direction === 'forward' ? rover.topSpeedMps : constants.reverseTopSpeedFraction * rover.topSpeedMps;

  // 1b. Control levels: u_t is the drive level and u_b the brake level, in either direction.
  // Both held: the brake applies and the throttle counts as released (FR-6). A lock holds u_t at 0 both ways.
  const throttleKey = keys.driveHeld && !keys.brakeHeld && !input.throttleLocked;
  const throttleLevel = input.throttleLocked ? 0 : nextLevel(prev.throttleLevel, throttleKey, constants.throttleBuildUpS, dtS);
  // While the tow line holds the rover, a held brake does nothing and its level stays 0 (FR-30, DECISIONS OI-8).
  const brakeLevel = input.towed ? 0 : nextLevel(prev.brakeLevel, keys.brakeHeld, constants.brakeBuildUpS, dtS);

  // 2. Forces. F_d = min(u_t F_d,max, F_lim); F_b = min(u_b F_b,max, F_lim).
  const driveCapN = Math.min(throttleLevel * rover.driveForceMaxN, q.gripLimitN);
  // Above top speed with no brake the motor gives no force (see step 3); the report shows 0.
  const aboveTopSpeed = brakeLevel === 0 && throttleLevel > 0 && !input.towed && v > topSpeedMps;
  const driveForceN = aboveTopSpeed ? 0 : driveCapN;
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
    } else if (v > topSpeedMps) {
      // Above top speed (DECISIONS 2026-10-14): the motor cannot push a rover that is already faster than
      // its top speed, so it gives no force and only friction acts: a = −F_r/m (Newton's first law).
      drivingState = 'Coasting';
      a = -q.rollingForceN / q.massKg;
    } else if (v >= topSpeedMps && driveForceN >= q.rollingForceN) {
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
  // Reserved hook: an outside force along the direction of travel adds F_ext/m to a moving rover. Whether it
  // can start a stopped rover, or count towards slip, is decided when the first modifier uses it.
  if (externalForceN !== 0 && drivingState !== 'Stopped') a += externalForceN / q.massKg;
  if (v >= topSpeedMps && a > 0) a = 0;

  // Wheels slip when the force the current state uses is more than the grip can pass on (FR-9, DECISIONS OI-10):
  // drive force in Driving and At top speed, brake force in Braking. Other states never show slip.
  const slipping =
    ((drivingState === 'Driving' || drivingState === 'At top speed') && throttleLevel * rover.driveForceMaxN > q.gripLimitN) ||
    (drivingState === 'Braking' && brakeLevel * rover.brakeForceMaxN > q.gripLimitN);

  // Steering turns the heading before the move, only if the rover was moving at the start of the step.
  // In reverse the heading change is mirrored, as in a car: holding right swings the rear to the right.
  const turnRadPerS = (constants.turnRateDegPerS * Math.PI) / 180;
  const steer = direction === 'forward' ? input.steer : -input.steer;
  const headingRad = v > 0 && steer !== 0 ? prev.headingRad + steer * turnRadPerS * dtS : prev.headingRad;

  // 4. Move with constant a.
  let moved = advance(v, a, dtS, topSpeedMps);
  if (aboveTopSpeed && v + a * dtS < topSpeedMps) {
    // The rover falls to v_max inside the step: split at t₁ = (v_max − v)/a. For the rest of the step it holds
    // v_max if the motor can balance friction (driveCap ≥ F_r); otherwise a₂ = (driveCap − F_r)/m.
    const t1 = (topSpeedMps - v) / a;
    const d1 = v * t1 + 0.5 * a * t1 * t1;
    const t2 = dtS - t1;
    const second =
      driveCapN >= q.rollingForceN
        ? { speedMps: topSpeedMps, distanceM: topSpeedMps * t2 }
        : advance(topSpeedMps, (driveCapN - q.rollingForceN) / q.massKg, t2, topSpeedMps);
    moved = { speedMps: second.speedMps, distanceM: d1 + second.distanceM };
  }

  // 5. Add distance along the path (d in either direction), advance the clock. Position moves along heading × direction.
  const alongM = direction === 'forward' ? moved.distanceM : -moved.distanceM;
  const stepCount = prev.stepCount + 1;
  return {
    stepCount,
    timeS: stepCount * dtS,
    distanceM: prev.distanceM + moved.distanceM,
    speedMps: moved.speedMps,
    direction,
    headingRad,
    positionXM: prev.positionXM + alongM * Math.cos(headingRad),
    positionZM: prev.positionZM + alongM * Math.sin(headingRad),
    throttleLevel,
    brakeLevel,
    drivingState,
    accelerationMps2: a,
    driveForceN,
    brakeForceN,
    slipping,
  };
}
