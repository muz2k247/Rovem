import type { PhysicsState } from './step.ts';

/** Signed velocity along the heading: u = +v forward, −v in reverse. */
function signedVelocity(state: PhysicsState): number {
  return state.direction === 'forward' ? state.speedMps : -state.speedMps;
}

/** The new speed is |u′|; the direction follows the sign of u′ (kept if u′ = 0). Everything else is unchanged. */
function withVelocity(state: PhysicsState, u: number): PhysicsState {
  const direction = u > 0 ? 'forward' : u < 0 ? 'reverse' : state.direction;
  return { ...state, speedMps: Math.abs(u), direction };
}

/**
 * Two bodies collide and move off together (conservation of momentum):
 *   m₁u₁ + m₂u₂ = (m₁ + m₂)u′.
 * The rover is body 1 and keeps u′ afterwards; the other body (a sandbag) drops off with no sideways or
 * along-track force. `otherVelocityAlongHeadingMps` is signed along the rover's heading.
 */
export function shareMomentum(
  state: PhysicsState,
  roverMassKg: number,
  otherMassKg: number,
  otherVelocityAlongHeadingMps: number,
): PhysicsState {
  const u = signedVelocity(state);
  const uNew = (roverMassKg * u + otherMassKg * otherVelocityAlongHeadingMps) / (roverMassKg + otherMassKg);
  return withVelocity(state, uNew);
}

/** Impulse equals change in momentum: J = m(u′ − u), so u′ = u + J/m. `impulseAlongHeadingNs` is signed along the heading. */
export function applyImpulse(state: PhysicsState, roverMassKg: number, impulseAlongHeadingNs: number): PhysicsState {
  return withVelocity(state, signedVelocity(state) + impulseAlongHeadingNs / roverMassKg);
}

/** A velocity on the ground plane, in m/s: x east, z north (the physics axes: the left of a rover heading east is +z). */
export interface GroundVelocity {
  x: number;
  z: number;
}

/**
 * The same collision with the velocities as arrows (vectors), for a bag that flies at an angle to the rover's path:
 *   (m₁ + m₂) v′ = m₁ v₁ + m₂ v₂.
 * Each component is the one-line rule `shareMomentum` uses, so a bag along the rover's path (0° from behind, 180° head-on) gives
 * exactly that rule's result. The rover is body 1 and keeps v′; the bag drops off. Returns the new velocity; the caller turns it into a
 * speed |v′| and a travel direction (the heading does not change: the tyres bend the path back, see drift.ts).
 */
export function shareMomentumVectors(
  roverMassKg: number,
  roverVelocity: GroundVelocity,
  otherMassKg: number,
  otherVelocity: GroundVelocity,
): GroundVelocity {
  const total = roverMassKg + otherMassKg;
  return {
    x: (roverMassKg * roverVelocity.x + otherMassKg * otherVelocity.x) / total,
    z: (roverMassKg * roverVelocity.z + otherMassKg * otherVelocity.z) / total,
  };
}
