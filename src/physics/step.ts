import { buildQuantities } from './build.ts';
import { slopePullN, type GroundInput } from './ground.ts';
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
  /** True while the rover moves opposite to its gear because a slope or a magnet pushes it back (A6). `speedMps` stays the size of the speed. */
  rollingBack: boolean;
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
    rollingBack: false,
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

/** The outside pushes of Game v4 that the game layer works out each step. Every field defaults to "no effect". */
export interface StepEnvironment extends GroundInput {
  /** b, N·s/m: the water drag force is F_w = b v, against the motion. */
  waterDragNsPerM?: number;
}

/** +1 when the rover moves along the way it faces (forward gear, not rolling back), −1 when it moves the other way. */
export function motionSign(direction: Direction, rollingBack: boolean): 1 | -1 {
  return (direction === 'forward') === !rollingBack ? 1 : -1;
}

/**
 * One fixed step, in the order of the Physics Model Specification:
 * (1) control levels, (2) forces, (3) state and a, (4) move, (5) add distance and advance the clock.
 * Step 6, the mission lines, is the caller's job. `surface` is the surface under the rover's front.
 *
 * `externalForceN` pushes along the gear (positive is the way the gear points); the magnets of Game v4 use it.
 * `env` carries the slope, the water upthrust and the water drag (A6); left out, nothing changes.
 *
 * `slopeRad` and `externalForceN` are given for the gear at the start of the step; if the brake key flips the gear
 * at rest, `step()` turns their signs itself.
 *
 * Forces split in two kinds (A6). Pushing forces: the drive, the slope pull and the magnet. Resisting forces: the
 * brake, rolling friction and water drag; they only oppose the motion and never reverse it. At rest the pushing
 * forces N are compared with the most the resisting forces can hold, F_r (plus the brake force if the brake is on):
 * |N| ≤ hold stays, N > hold moves along the gear, N < −hold rolls back (`rollingBack`).
 */
export function step(
  prev: PhysicsState,
  input: StepInput,
  rover: RoverSpec,
  surface: SurfaceSpec,
  constants: PhysicsConstants,
  externalForceN = 0,
  env: StepEnvironment = {},
): PhysicsState {
  const dtS = constants.timeStepS;
  const q = buildQuantities(rover, surface, constants, env);
  const v = prev.speedMps;
  const rollingBack = v > 0 && prev.rollingBack;

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

  // 2. Forces. F_d = min(u_t F_d,max, F_lim); F_b = min(u_b F_b,max, F_lim). F_lim uses R = m g cos θ − U.
  const driveCapN = Math.min(throttleLevel * rover.driveForceMaxN, q.gripLimitN);
  // Pushing forces other than the drive, along the gear: slope pull m g sin θ (downhill) and the outside push.
  // The caller signs the slope and the outside force for the gear the rover had at the start of the step; if the gear
  // flipped in 1a they point the other way now.
  const gearSign = direction === prev.direction ? 1 : -1;
  const pushN = gearSign * ((env.slopeRad ? -slopePullN(q.massKg, constants.gravityMps2, env.slopeRad) : 0) + externalForceN);
  // Resisting forces while moving: rolling friction F_r and water drag F_w = b v.
  const dragNsPerM = env.waterDragNsPerM ?? 0;
  const resistN = q.rollingForceN + dragNsPerM * v;
  // Acceleration along the gear with the motor off (what slope, magnet and friction do alone).
  const freeA = (pushN - resistN) / q.massKg;
  // The motor gives no force when the rover is faster than its top speed, or at top speed when the slope or a
  // magnet alone would speed it up. Only motion along the gear counts. With no brake the report shows 0.
  const aboveTopSpeed =
    brakeLevel === 0 && throttleLevel > 0 && !input.towed && !rollingBack && (v > topSpeedMps || (v >= topSpeedMps && freeA > 0));
  const driveForceN = aboveTopSpeed ? 0 : driveCapN;
  const brakeForceN = Math.min(brakeLevel * rover.brakeForceMaxN, q.gripLimitN);

  // 3. State and acceleration, chosen from the levels (DECISIONS OI-1). `a` is the rate of change of the speed.
  let drivingState: DrivingState;
  let a: number;
  let startsRollingBack = false;
  const sg = rollingBack ? -1 : 1; // pushing forces count against a rover that moves opposite to its gear
  if (input.towed) {
    drivingState = 'Cruising'; // the tow line balances friction and holds the speed
    a = 0;
  } else if (v === 0) {
    // At rest (A6): compare the pushing forces N with what the resisting forces can hold.
    const driveN = brakeLevel > 0 ? 0 : driveForceN; // brake beats throttle
    const netN = driveN + pushN;
    const holdN = q.rollingForceN + (brakeLevel > 0 ? brakeForceN : 0);
    if (Math.abs(netN) <= holdN) {
      drivingState = 'Stopped';
      a = 0;
    } else {
      drivingState = brakeLevel > 0 ? 'Braking' : driveN > 0 ? 'Driving' : 'Coasting';
      a = (Math.abs(netN) - holdN) / q.massKg;
      startsRollingBack = netN < 0;
    }
  } else if (brakeLevel > 0) {
    drivingState = 'Braking';
    a = (sg * pushN - (brakeForceN + resistN)) / q.massKg; // a = −(F_b + F_r + F_w)/m, plus the pushing forces
  } else if (throttleLevel > 0) {
    if (rollingBack) {
      drivingState = 'Driving'; // the drive pushes against the roll
      a = (-(driveForceN + pushN) - resistN) / q.massKg;
    } else if (aboveTopSpeed) {
      // Above top speed (DECISIONS 2026-10-14): the motor cannot push a rover that is already faster than
      // its top speed, so it gives no force and only the other forces act: a = −F_r/m on the flat.
      drivingState = 'Coasting';
      a = freeA;
    } else if (v >= topSpeedMps && driveForceN + pushN >= resistN) {
      drivingState = 'At top speed'; // the motor only balances friction (FR-28)
      a = 0;
    } else {
      drivingState = 'Driving';
      a = (driveForceN + pushN - resistN) / q.massKg; // a = (F_d − F_r)/m, negative if F_d < F_r
    }
  } else {
    drivingState = 'Coasting';
    a = (sg * pushN - resistN) / q.massKg; // a = −F_r/m on the flat
  }

  // Wheels slip when the force the current state uses is more than the grip can pass on (FR-9, DECISIONS OI-10):
  // drive force in Driving and At top speed, brake force in Braking. Other states never show slip.
  const slipping =
    ((drivingState === 'Driving' || drivingState === 'At top speed') && throttleLevel * rover.driveForceMaxN > q.gripLimitN) ||
    (drivingState === 'Braking' && brakeLevel * rover.brakeForceMaxN > q.gripLimitN);

  // The rover moves opposite to the way it faces in reverse gear, and when it rolls back.
  const movesBackwards = rollingBack || startsRollingBack;
  const sign = motionSign(direction, movesBackwards);

  // Steering turns the heading before the move, only if the rover was moving at the start of the step and has grip
  // (a floating rover, R = 0, cannot turn). The heading change is mirrored while the rover moves backwards, as in a
  // car: holding right swings the rear to the right.
  const turnRadPerS = (constants.turnRateDegPerS * Math.PI) / 180;
  const steer = motionSign(direction, rollingBack) === 1 ? input.steer : -input.steer;
  const headingRad = v > 0 && steer !== 0 && q.normalForceN > 0 ? prev.headingRad + steer * turnRadPerS * dtS : prev.headingRad;

  // 4. Move with constant a. The motor holds the speed at v_max only while it is the motor that is pushing
  // (Driving, At top speed); slope, magnet and roll can carry the rover past it, and a roll has no top speed.
  const motorLimited = !movesBackwards && (drivingState === 'Driving' || drivingState === 'At top speed');
  let moved = advance(v, a, dtS, motorLimited ? topSpeedMps : Infinity);
  if (motorLimited && freeA > 0 && a > 0 && v + a * dtS > topSpeedMps) {
    // Slope or magnet out-pushes friction by itself: the motor stops helping at v_max and the rover carries on at
    // the free acceleration. Split at t₁ = (v_max − v)/a.
    const t1 = (topSpeedMps - v) / a;
    const second = advance(topSpeedMps, freeA, dtS - t1, Infinity);
    moved = { speedMps: second.speedMps, distanceM: v * t1 + 0.5 * a * t1 * t1 + second.distanceM };
  }
  if (aboveTopSpeed && v + a * dtS < topSpeedMps) {
    // The rover falls to v_max inside the step: split at t₁ = (v_max − v)/a. For the rest of the step it holds
    // v_max if the motor can balance the resisting forces (driveCap + pushing ≥ F_r + F_w); otherwise
    // a₂ = (driveCap + pushing − F_r − F_w)/m.
    const t1 = (topSpeedMps - v) / a;
    const d1 = v * t1 + 0.5 * a * t1 * t1;
    const t2 = dtS - t1;
    const resistAtTopN = q.rollingForceN + dragNsPerM * topSpeedMps;
    const second =
      driveCapN + pushN >= resistAtTopN
        ? { speedMps: topSpeedMps, distanceM: topSpeedMps * t2 }
        : advance(topSpeedMps, (driveCapN + pushN - resistAtTopN) / q.massKg, t2, topSpeedMps);
    moved = { speedMps: second.speedMps, distanceM: d1 + second.distanceM };
  }

  // 5. Add distance along the path (d in either direction), advance the clock. Position moves along heading × sign.
  const alongM = sign * moved.distanceM;
  const stepCount = prev.stepCount + 1;
  return {
    stepCount,
    timeS: stepCount * dtS,
    distanceM: prev.distanceM + moved.distanceM,
    speedMps: moved.speedMps,
    direction,
    rollingBack: moved.speedMps > 0 && movesBackwards,
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
