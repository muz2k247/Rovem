import type { PhysicsState } from '../physics/step.ts';

/** How long "Blocked" stays up after a rock last undid a step. Display only: the rover creeps back up to a
 * rock from rest, so the raw flag switches on and off; holding it keeps the label readable. */
const BLOCKED_HOLD_S = 0.5;

/** What the driving screen shows, ready to display (FR-27, FR-9). Few variables at once (NFR-6). */
export interface DriveHud {
  timeText: string;
  speedText: string;
  /** For feel, beside m/s (DESIGN §6). Whole km/h; m/s keeps 2 decimals. */
  speedKmhText: string;
  /** Show the "R" indicator. */
  reverse: boolean;
  throttlePercent: number;
  brakePercent: number;
  targetText: string;
  /** Direction the rover faces: 0° is the start heading, positive turns left. */
  arrowDegrees: number;
  slipping: boolean;
  /** A rock stopped the rover within the last half second. */
  blocked: boolean;
  stateText: string;
}

export function driveHud(state: PhysicsState, targetDistanceM: number, secondsSinceBlocked?: number): DriveHud {
  const remainingM = targetDistanceM - state.distanceM;
  const blocked = secondsSinceBlocked !== undefined && secondsSinceBlocked <= BLOCKED_HOLD_S;
  return {
    timeText: `${state.timeS.toFixed(2)} s`,
    speedText: `${state.speedMps.toFixed(2)} m/s`,
    speedKmhText: `${Math.round(state.speedMps * 3.6)} km/h`,
    reverse: state.direction === 'reverse',
    throttlePercent: Math.round(state.throttleLevel * 100),
    brakePercent: Math.round(state.brakeLevel * 100),
    targetText: remainingM > 0 ? `Target in ${remainingM.toFixed(2)} m` : 'Target reached',
    arrowDegrees: (state.headingRad * 180) / Math.PI,
    slipping: state.slipping,
    blocked,
    stateText: blocked ? 'Blocked' : state.drivingState,
  };
}
