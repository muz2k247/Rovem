/**
 * Runs a fixed-size step as many times as the frame time allows, so results do not depend on the
 * frame rate (FR-29). Time left over carries to the next frame. `onStep` must take its input from the
 * simulation clock, never from the frame, for two frame rates to give the same run.
 */
export function createFixedStepLoop(stepS: number, onStep: () => void, maxStepsPerFrame = 240) {
  let leftoverS = 0;
  // Frame times such as 1/144 do not add up to an exact multiple of the step; this absorbs the rounding.
  const toleranceS = stepS * 1e-9;
  return {
    /** Adds one frame's time and runs the steps it covers. Returns how many ran. */
    advance(frameS: number): number {
      leftoverS += frameS;
      let ran = 0;
      while (leftoverS >= stepS - toleranceS && ran < maxStepsPerFrame) {
        onStep();
        leftoverS -= stepS;
        ran += 1;
      }
      // Hit the cap after a long stall: drop the backlog rather than spiral.
      if (ran === maxStepsPerFrame) leftoverS = 0;
      return ran;
    },
  };
}
