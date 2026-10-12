import type { PhysicsConstants, RoverSpec, RoverVariable, SurfaceSpec } from './types.ts';

export interface BuildQuantities {
  massKg: number;
  /** R = m g */
  weightN: number;
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

/** The build quantities of the Physics Model Specification, for one rover on one surface (FR-2, FR-3). */
export function buildQuantities(
  rover: RoverSpec,
  surface: SurfaceSpec,
  constants: Pick<PhysicsConstants, 'gravityMps2'>,
): BuildQuantities {
  const massKg = rover.massKg;
  const weightN = massKg * constants.gravityMps2; // R = m g
  const rollingForceN = surface.rollingFriction * rover.rollingFactor * weightN; // F_r = μ_r k_r R
  const gripLimitN = surface.grip * rover.gripFactor * weightN; // F_lim = μ_g k_g R
  return {
    massKg,
    weightN,
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
