// "Reset progress (press twice to confirm)" (LEVELS_BUILD_PLAN A3). The first press arms the button; the second
// one confirms. Anything else the student does on the screen disarms it.

export interface ResetState {
  armed: boolean;
}

export const resetIdle: ResetState = { armed: false };

/** One press of the Reset button. `confirmed` is true on the second press only. */
export function pressReset(state: ResetState): { state: ResetState; confirmed: boolean } {
  return state.armed ? { state: resetIdle, confirmed: true } : { state: { armed: true }, confirmed: false };
}

export const disarmReset = (): ResetState => resetIdle;
