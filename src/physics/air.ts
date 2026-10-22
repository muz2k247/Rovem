// Leaving the ground (Physics Model Specification 11.3, E45; SHOWCASE_PLAN P1). Pure functions, outside `step()`.
// The rover leaves the ground only at a ramp lip in the level data. In the air nothing drives, brakes or steers it:
// the level speed stays the same and gravity pulls the upward speed down. There is no air resistance.

/** The rover's motion in the air: the height above the ground below it, and the two parts of its velocity. */
export interface AirState {
  /** Height above the ground, in metres (0 on the ground). */
  heightM: number;
  /** Upward speed, in m/s (negative while falling). */
  verticalMps: number;
  /** Speed along the ground, in m/s. It does not change in the air. */
  horizontalMps: number;
}

/** What one air step did. */
export interface AirStep {
  state: AirState;
  /** How much of the step was flown (less than Δt in the step that lands). */
  usedS: number;
  /** The distance flown along the ground during `usedS`. */
  horizontalM: number;
  /** True when the rover came back to the ground (height 0) in this step. */
  landed: boolean;
}

/** At the lip, with speed v along a ramp of angle φ: v_h = v cos φ and v_y = v sin φ. */
export function launch(speedMps: number, angleRad: number): { horizontalMps: number; verticalMps: number } {
  return { horizontalMps: speedMps * Math.cos(angleRad), verticalMps: speedMps * Math.sin(angleRad) };
}

/** Time in the air when landing at the take-off height: t = 2 v_y ÷ g. */
export function flightTimeS(verticalMps: number, gravityMps2: number): number {
  return (2 * verticalMps) / gravityMps2;
}

/** The highest point above the lip: h = v_y² ÷ 2g. */
export function apexHeightM(verticalMps: number, gravityMps2: number): number {
  return (verticalMps * verticalMps) / (2 * gravityMps2);
}

/** Distance flown along the ground when landing at the take-off height: v_h × t. */
export function rangeM(horizontalMps: number, verticalMps: number, gravityMps2: number): number {
  return horizontalMps * flightTimeS(verticalMps, gravityMps2);
}

/**
 * One step of flight with constant gravity g (the zone's g):
 *   v_y falls by g Δt, and the height changes by v_y Δt − ½ g Δt²; v_h is constant.
 * A step that would end below the ground is split at the exact landing time, the root of y + v_y t − ½ g t² = 0,
 *   t = (v_y + √(v_y² + 2 g y)) ÷ g,
 * as `step()` splits at v_max and at 0. The rover then lands with the downward speed it has at that moment.
 */
export function airStep(state: AirState, gravityMps2: number, dtS: number): AirStep {
  const heightAfterM = state.heightM + state.verticalMps * dtS - 0.5 * gravityMps2 * dtS * dtS;
  if (heightAfterM > 0) {
    return {
      state: { heightM: heightAfterM, verticalMps: state.verticalMps - gravityMps2 * dtS, horizontalMps: state.horizontalMps },
      usedS: dtS,
      horizontalM: state.horizontalMps * dtS,
      landed: false,
    };
  }
  const landS = Math.min(dtS, (state.verticalMps + Math.sqrt(state.verticalMps * state.verticalMps + 2 * gravityMps2 * state.heightM)) / gravityMps2);
  return {
    state: { heightM: 0, verticalMps: state.verticalMps - gravityMps2 * landS, horizontalMps: state.horizontalMps },
    usedS: landS,
    horizontalM: state.horizontalMps * landS,
    landed: true,
  };
}
