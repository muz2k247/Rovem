import type { PointM } from '../content/index.ts';
import type { PhysicsState } from '../physics/step.ts';
import type { PhysicsConstants } from '../physics/types.ts';
import { nearestOnPath, pointAlongPath } from './geometry.ts';

/**
 * Steering assist (DESIGN §6, accessibility): the steer key a careful driver would hold this step to stay on
 * the level's ideal line. It only chooses a steer input; steering never changes speed, so a run's time and
 * speeds are the same with or without it.
 *
 * Method: the wanted heading is the path's direction at the nearest point, turned back towards the line by
 * atan(offset / look-ahead). The look-ahead is the turning radius v/ω, no shorter than the rover, so the
 * correction is gentle at speed. The assist steers towards the wanted heading when it is off by more than
 * half of one step's turn. Forward only: in reverse, or when stopped, it returns 0.
 */
export function assistSteer(
  state: PhysicsState,
  path: readonly PointM[],
  constants: PhysicsConstants,
  minLookAheadM: number,
): -1 | 0 | 1 {
  if (state.speedMps === 0 || state.direction === 'reverse') return 0;
  const turnRadPerS = (constants.turnRateDegPerS * Math.PI) / 180;
  const lookAheadM = Math.max(minLookAheadM, state.speedMps / turnRadPerS);
  const near = nearestOnPath(path, state.positionXM, state.positionZM);
  // Path direction: from the nearest point to the point one rover length further on.
  const here = pointAlongPath(path, near.alongM);
  const ahead = pointAlongPath(path, near.alongM + minLookAheadM);
  const pathHeading = Math.atan2(ahead.zM - here.zM, ahead.xM - here.xM);
  const wanted = pathHeading - Math.atan(near.offsetM / lookAheadM);
  const error = Math.atan2(Math.sin(wanted - state.headingRad), Math.cos(wanted - state.headingRad));
  const deadbandRad = (turnRadPerS * constants.timeStepS) / 2;
  if (error > deadbandRad) return 1;
  if (error < -deadbandRad) return -1;
  return 0;
}
