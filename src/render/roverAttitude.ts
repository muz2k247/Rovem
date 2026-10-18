// How the rover model moves besides driving (LEVELS_BUILD_PLAN A5): the front wheels turn, the body leans a little
// in turns, the changed part pops in. Presentation only: none of this feeds back into the physics. The sizes are
// look choices made by Claude, kept here so they can be tuned in one place.

/** Largest front wheel angle, about 26°. */
export const MAX_STEER_RAD = 0.45;
/** Largest lean, about 4°: "leans a little". */
export const MAX_LEAN_RAD = 0.07;
/** Lean per m/s² of sideways acceleration. */
const LEAN_RAD_PER_MPS2 = 0.006;

/** Front wheel angle for a steer input (+1 left, −1 right). Steering is mirrored in reverse. */
export function steerAngleRad(steer: -1 | 0 | 1, direction: 'forward' | 'reverse'): number {
  return steer * (direction === 'reverse' ? -1 : 1) * MAX_STEER_RAD || 0;
}

/**
 * Roll of the body, outward in a turn. The sideways acceleration of a turn is a = v ω (circular motion); the body
 * leans in proportion to it, up to a small limit. ω is positive for a left turn, so a left turn leans the top to
 * the right (positive).
 */
export function leanRad(speedMps: number, turnRateRadPerS: number): number {
  const sideways = speedMps * turnRateRadPerS;
  return Math.max(-MAX_LEAN_RAD, Math.min(MAX_LEAN_RAD, sideways * LEAN_RAD_PER_MPS2)) || 0;
}

/** Ease-out with a small overshoot, for a part popping into place. 0 → 0, 1 → 1, clamped outside. */
export function easeOutBack(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return x === 0 ? 0 : 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}
