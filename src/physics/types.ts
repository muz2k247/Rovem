/** A complete rover, as the physics sees it: one chassis, wheels and motor already added up. */
export interface RoverSpec {
  /** m = chassis + wheels + motor (after any power-up). */
  massKg: number;
  /** F_d,max: the motor's strongest driving force. */
  driveForceMaxN: number;
  /** F_b,max: fixed for the rover model (FR-6). */
  brakeForceMaxN: number;
  /** k_r: wheels' share of the surface's rolling friction. */
  rollingFactor: number;
  /** k_g: wheels' share of the surface's grip. */
  gripFactor: number;
  /** v_max: the motor's top speed. */
  topSpeedMps: number;
}

/** The two numbers a surface supplies. */
export interface SurfaceSpec {
  /** μ_r */
  rollingFriction: number;
  /** μ_g */
  grip: number;
}

export interface PhysicsConstants {
  gravityMps2: number;
  /** Δt */
  timeStepS: number;
  /** T_t */
  throttleBuildUpS: number;
  /** T_b */
  brakeBuildUpS: number;
  turnRateDegPerS: number;
  /** Reverse top speed = this × v_max. */
  reverseTopSpeedFraction: number;
}

/** The rover variables a power-up can multiply. */
export type RoverVariable = keyof RoverSpec;

/** One power-up, as the physics needs it. */
export interface Multiplier {
  variable: RoverVariable;
  multiplier: number;
}
