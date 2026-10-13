import type { PhysicsState } from '../physics/step.ts';

/** What the driving screen shows, ready to display (FR-27, FR-9). Few variables at once (NFR-6). */
export interface DriveHud {
  timeText: string;
  speedText: string;
  throttlePercent: number;
  brakePercent: number;
  targetText: string;
  /** Direction of travel: 0° is the start heading, positive turns left. */
  arrowDegrees: number;
  slipping: boolean;
  stateText: string;
}

export function driveHud(state: PhysicsState, targetDistanceM: number): DriveHud {
  const remainingM = targetDistanceM - state.distanceM;
  return {
    timeText: `${state.timeS.toFixed(2)} s`,
    speedText: `${state.speedMps.toFixed(2)} m/s`,
    throttlePercent: Math.round(state.throttleLevel * 100),
    brakePercent: Math.round(state.brakeLevel * 100),
    targetText: remainingM > 0 ? `Target in ${remainingM.toFixed(2)} m` : 'Target reached',
    arrowDegrees: (state.headingRad * 180) / Math.PI,
    slipping: state.slipping,
    stateText: state.drivingState,
  };
}
