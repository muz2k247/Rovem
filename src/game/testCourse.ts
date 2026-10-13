// PLACEHOLDER layout for the M4 test drive. Not a mission route: M5 replaces it with the two Mission 1
// routes once k._muz approves their top-down layout. Sizes here are scene geometry, not game values.

/** The asphalt strip runs along +x from the start line, with margin past the 100 m route length. */
export const TRACK_START_X_M = -10;
export const TRACK_END_X_M = 120;
export const TRACK_HALF_WIDTH_M = 4;

/** Which surface lies under a point on the ground. Physics x forward, z to the left of the start heading. */
export function courseSurfaceIdAt(xM: number, zM: number): 'asphalt' | 'sand' {
  const onTrack = xM >= TRACK_START_X_M && xM <= TRACK_END_X_M && Math.abs(zM) <= TRACK_HALF_WIDTH_M;
  return onTrack ? 'asphalt' : 'sand';
}
