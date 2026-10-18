// Super electromagnets (LEVELS_BUILD_PLAN A6, Polar Pass). Like poles repel, unlike poles attract, and the pull is
// weaker further away. The 1/d² fall-off is a stated game simplification and is never shown to the student as a formula.

export interface MagnetParams {
  /** The strongest force, N. */
  maxForceN: number;
  /** Full force at or inside this distance, m. */
  fullWithinM: number;
  /** No force beyond this distance, m. */
  cutoffM: number;
}

/** F = F_max for d ≤ d_full; F = F_max (d_full ÷ d)² up to the cut-off; 0 beyond. d is pylon to rover centre. */
export function magnetForceN(distanceM: number, p: MagnetParams): number {
  if (distanceM > p.cutoffM) return 0;
  if (distanceM <= p.fullWithinM) return p.maxForceN;
  const ratio = p.fullWithinM / distanceM;
  return p.maxForceN * ratio * ratio;
}

/**
 * The magnet's force on the rover, split for the game layer. The force acts along the line from the rover to the
 * pylon: towards it when the poles attract, away when they repel.
 * `alongGearN` goes to `step()` as `externalForceN` (positive pushes along the gear). `sidewaysN` bends the travel
 * direction (positive towards the rover's left, the direction heading + 90°). `gearRad` is the way the gear points.
 */
export function magnetOnRover(
  p: MagnetParams,
  roverX: number,
  roverZ: number,
  pylonX: number,
  pylonZ: number,
  gearRad: number,
  attract: boolean,
): { forceN: number; alongGearN: number; sidewaysN: number } {
  const dx = pylonX - roverX;
  const dz = pylonZ - roverZ;
  const d = Math.hypot(dx, dz);
  if (d === 0) return { forceN: 0, alongGearN: 0, sidewaysN: 0 }; // on top of the pylon: no direction
  const forceN = magnetForceN(d, p);
  const sign = attract ? 1 : -1;
  const ux = dx / d;
  const uz = dz / d;
  return {
    forceN,
    alongGearN: sign * forceN * (ux * Math.cos(gearRad) + uz * Math.sin(gearRad)),
    sidewaysN: sign * forceN * (-ux * Math.sin(gearRad) + uz * Math.cos(gearRad)),
  };
}
