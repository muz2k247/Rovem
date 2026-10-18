// Water (LEVELS_BUILD_PLAN A6, The Crossing). The game layer finds the depth at the rover's centre and passes the
// results to `step()`.

/** The share of the rover's volume under water: min(depth ÷ H, 1), H being the submersion height. */
export function submersionFraction(depthM: number, submersionHeightM: number): number {
  return Math.max(0, Math.min(depthM / submersionHeightM, 1));
}

/** Upthrust U = ρ_water g V_sub (Archimedes: the weight of the water pushed aside), V_sub = V_rover × the fraction. */
export function upthrustN(
  densityKgPerM3: number,
  gravityMps2: number,
  roverVolumeM3: number,
  submersionHeightM: number,
  depthM: number,
): number {
  return densityKgPerM3 * gravityMps2 * roverVolumeM3 * submersionFraction(depthM, submersionHeightM);
}

/** The drag coefficient b, N·s/m: the full value times the depth fraction. The drag force is F_w = b v. */
export function waterDragNsPerM(fullDragNsPerM: number, depthM: number, submersionHeightM: number): number {
  return fullDragNsPerM * submersionFraction(depthM, submersionHeightM);
}

/** True when U ≥ m g: the rover floats, so R = 0 (no grip, no drive, no turning). */
export function floats(massKg: number, gravityMps2: number, upthrustForceN: number): boolean {
  return upthrustForceN >= massKg * gravityMps2;
}
