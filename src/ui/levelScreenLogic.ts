// The small decisions the level screen makes that are not drawing: how hard the camera shakes during the crash moment,
// and whether a frame is worth running the HUD update for. Kept apart from the React file so they can be tested.

/** Presentation values (the same feel as the endless run's crash moment). */
export const CRASH_SHAKE_PEAK_M = 0.35;

/** The camera shake while the crash moment plays: strongest at the start, gone at the end. */
export function crashShakeM(elapsedS: number, momentS: number): number {
  if (momentS <= 0 || elapsedS >= momentS) return 0;
  return CRASH_SHAKE_PEAK_M * Math.max(0, 1 - elapsedS / momentS);
}

/** The HUD is rebuilt every other frame (the 3D scene still moves every frame), and always on the frame a report opens. */
export function shouldRefreshHud(frame: number, forced: boolean): boolean {
  return forced || frame % 2 === 0;
}
