import { normalForceN, type GroundInput } from './ground.ts';
import type { PhysicsConstants, RoverSpec, RoverVariable, SurfaceSpec } from './types.ts';

export interface BuildQuantities {
  massKg: number;
  /** W = m g (the weight; R equals it on flat dry ground) */
  weightN: number;
  /** R = m g cos θ − U, never below 0 (Game v4; equals m g on flat dry ground) */
  normalForceN: number;
  /** F_r = μ_r k_r R */
  rollingForceN: number;
  /** F_lim = μ_g k_g R */
  gripLimitN: number;
  /** a_max = (min(F_d,max, F_lim) − F_r) / m */
  maxAccelerationMps2: number;
  /** b_max = (min(F_b,max, F_lim) + F_r) / m */
  maxBrakingMps2: number;
  topSpeedMps: number;
}

/**
 * The build quantities of the Physics Model Specification, for one rover on one surface (FR-2, FR-3).
 * `ground` (Game v4) adds a slope and water upthrust; left out, R = m g exactly as before.
 */
export function buildQuantities(
  rover: RoverSpec,
  surface: SurfaceSpec,
  constants: Pick<PhysicsConstants, 'gravityMps2'>,
  ground: GroundInput = {},
): BuildQuantities {
  const massKg = rover.massKg;
  const weightN = massKg * constants.gravityMps2; // W = m g
  // R = m g cos θ − U, never below 0; the plain weight when there is no slope and no water.
  const normalN =
    ground.slopeRad || ground.upthrustN ? normalForceN(massKg, constants.gravityMps2, ground.slopeRad, ground.upthrustN) : weightN;
  const rollingForceN = surface.rollingFriction * rover.rollingFactor * normalN; // F_r = μ_r k_r R
  const gripLimitN = surface.grip * rover.gripFactor * normalN; // F_lim = μ_g k_g R
  return {
    massKg,
    weightN,
    normalForceN: normalN,
    rollingForceN,
    gripLimitN,
    maxAccelerationMps2: (Math.min(rover.driveForceMaxN, gripLimitN) - rollingForceN) / massKg,
    maxBrakingMps2: (Math.min(rover.brakeForceMaxN, gripLimitN) + rollingForceN) / massKg,
    topSpeedMps: rover.topSpeedMps,
  };
}

/** A power-up: a copy of the rover with one variable multiplied and every other variable untouched (FR-38). */
export function applyMultiplier(rover: RoverSpec, variable: RoverVariable, multiplier: number): RoverSpec {
  return { ...rover, [variable]: rover[variable] * multiplier };
}
