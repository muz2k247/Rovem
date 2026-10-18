// Ground push and slope pull (LEVELS_BUILD_PLAN A6). Textbook: a rover on a slope of angle θ is pressed into the
// ground by m g cos θ and pulled down the slope by m g sin θ. Water lifts it by the upthrust U.

/** What the ground and the water do to the rover this step. Every field defaults to "no effect". */
export interface GroundInput {
  /**
   * The slope along the gear (the way heading × direction points), in radians; positive is uphill that way.
   * The game layer takes it from the terrain gradient. While the rover rolls back it still means "along the gear",
   * so the pull along the gear is the same sign as when it drives.
   */
  slopeRad?: number;
  /** U, the upthrust from the water (Archimedes). */
  upthrustN?: number;
}

/** R = m g cos θ − U, never below 0. On flat dry ground it is m g. */
export function normalForceN(massKg: number, gravityMps2: number, slopeRad = 0, upthrustN = 0): number {
  return Math.max(0, massKg * gravityMps2 * Math.cos(slopeRad) - upthrustN);
}

/** Slope pull = m g sin θ, downhill. Positive when the slope rises along the gear. */
export function slopePullN(massKg: number, gravityMps2: number, slopeRad: number): number {
  return massKg * gravityMps2 * Math.sin(slopeRad);
}
