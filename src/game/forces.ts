import { buildQuantities } from '../physics/build.ts';
import type { PhysicsState } from '../physics/step.ts';
import type { RoverSpec, SurfaceSpec } from '../physics/types.ts';
import type { ForceArrow } from './contracts.ts';

// The forces along the path in the Endless Canyon (LEVELS_BUILD_PLAN A4): push (or brake) and friction. Worked out
// from the same physics functions as the run (FR-3), so the F = ma line and the arrows always agree with the rover.

export interface PathForces {
  /** The drive force along the motion. */
  pushN: number;
  /** The brake force, against the motion; 0 unless braking. */
  brakeN: number;
  /** Rolling friction, against the motion. */
  frictionN: number;
  /** Push − brake − friction. Divided by the mass it is the acceleration (F = ma). */
  netN: number;
  /** Moving at top speed with push = friction: "Balanced: constant speed". */
  balanced: boolean;
}

/** `surface` and `gravityMps2` are those in force under the front during the last step. */
export function pathForces(state: PhysicsState, rover: RoverSpec, surface: SurfaceSpec, gravityMps2: number): PathForces {
  const q = buildQuantities(rover, surface, { gravityMps2 });
  let pushN: number;
  switch (state.drivingState) {
    case 'At top speed':
      pushN = q.rollingForceN; // the motor only balances friction (FR-28)
      break;
    case 'Coasting':
      pushN = 0;
      break;
    default:
      pushN = state.driveForceN; // Driving, Stopped and Braking (where it is 0)
  }
  let frictionN = q.rollingForceN;
  let brakeN = 0;
  // Stopped: the ground holds the rover back by no more than the push, so the forces cancel.
  if (state.drivingState === 'Stopped') frictionN = Math.min(q.rollingForceN, state.driveForceN);
  if (state.drivingState === 'Braking') brakeN = state.brakeForceN;
  const netN = pushN - brakeN - frictionN;
  const balanced = Math.abs(netN) <= 1e-9 * Math.max(1, pushN, frictionN) && state.speedMps > 0 && state.drivingState === 'At top speed';
  return { pushN, brakeN, frictionN, netN, balanced };
}

/** The unit vector of the motion in scene axes (x east, y up, z south): the physics z is flipped. */
function motionDirection(state: PhysicsState) {
  const sign = state.direction === 'reverse' ? -1 : 1;
  return { x: sign * Math.cos(state.headingRad), y: 0, z: -sign * Math.sin(state.headingRad) };
}

/**
 * The arrows to draw on the rover: push along the motion, friction against it. While braking, one backward brake
 * arrow carries the brake and the friction together, so two arrows never lie on top of each other.
 */
export function pathArrows(forces: PathForces, state: PhysicsState): ForceArrow[] {
  const forward = motionDirection(state);
  const backward = { x: -forward.x, y: 0, z: -forward.z };
  const arrows: ForceArrow[] = [];
  if (forces.brakeN > 0) {
    arrows.push({
      kind: 'brake',
      forceN: forces.brakeN + forces.frictionN,
      directionWorld: backward,
      extraLabel: `includes friction ${Math.round(forces.frictionN)} N`,
    });
    return arrows;
  }
  if (forces.pushN > 0) arrows.push({ kind: 'push', forceN: forces.pushN, directionWorld: forward });
  if (forces.frictionN > 0) arrows.push({ kind: 'friction', forceN: forces.frictionN, directionWorld: backward });
  return arrows;
}
