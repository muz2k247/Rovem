import type { RunSession } from './runSession.ts';

// Pause for the run screen (DECISIONS 2026-10-16). While paused no steps run: the session is not advanced and the
// fixed-step loop's leftover time is untouched, so a pause cannot change the run, however long it lasts.

/** The longest frame the run screen simulates (A10): a long stall must not make the rover jump. */
export const MAX_FRAME_S = 0.1;

export function createPausableRun(session: Pick<RunSession, 'advanceFrame'>) {
  let paused = false;
  return {
    get paused(): boolean {
      return paused;
    },
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
    },
    /** Runs the steps that fit in this frame (none while paused). Returns how many ran. */
    advance(frameS: number): number {
      return paused ? 0 : session.advanceFrame(Math.min(frameS, MAX_FRAME_S));
    },
  };
}
