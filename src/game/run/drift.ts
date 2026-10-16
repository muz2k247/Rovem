// Drifting (DECISIONS 2026-10-16, provisional, demo only). Game layer: the physics in `src/physics/` is unchanged.
// The rover keeps a travel direction separate from its heading. The heading turns as before (the turn rate); the travel
// direction follows the way the rover is driving (the heading, or the opposite way in reverse) no faster than the tyres
// can bend the path. Simplifications: sliding does not change speed, and the turning grip and the drive grip (F_lim)
// are not shared.

/** Angle wrapped into (−π, π]. */
export function wrapAngle(rad: number): number {
  const twoPi = 2 * Math.PI;
  let a = rad % twoPi;
  if (a > Math.PI) a -= twoPi;
  else if (a <= -Math.PI) a += twoPi;
  return a;
}

/**
 * The fastest the tyres can bend the path: ω_max = μ_g × k_g × g ÷ v. A rover going round a curve needs a sideways
 * acceleration v·ω, and the ground can give at most μ_g·k_g·g (friction = μN with N = mg, divided by m).
 * At rest there is no limit (Infinity), so the travel direction snaps to the way the rover points.
 */
export function travelTurnLimitRadPerS(surfaceGrip: number, wheelGripFactor: number, gravityMps2: number, speedMps: number): number {
  if (speedMps <= 0) return Infinity;
  return (surfaceGrip * wheelGripFactor * gravityMps2) / speedMps;
}

/**
 * Turns the travel direction toward the target by the short way, by at most limit × Δt. With no limit, or when the
 * target is within one step's turn, it lands exactly on the target (so a rover that does not slide has slide angle 0).
 */
export function turnTravelDirection(travelRad: number, targetRad: number, limitRadPerS: number, dtS: number): number {
  const diff = wrapAngle(targetRad - travelRad);
  const maxTurn = limitRadPerS * dtS;
  if (Math.abs(diff) <= maxTurn) return targetRad;
  return travelRad + Math.sign(diff) * maxTurn;
}

/** The angle between the way the rover is travelling and the way it is driving (always ≥ 0). */
export function slideAngleRad(travelRad: number, targetRad: number): number {
  return Math.abs(wrapAngle(targetRad - travelRad));
}

/** Squeal and skid marks start at this slide angle (DECISIONS 2026-10-16). Presentation threshold, in degrees. */
export const SLIDE_MARK_DEG = 5;
export const SLIDE_MARK_RAD = (SLIDE_MARK_DEG * Math.PI) / 180;
