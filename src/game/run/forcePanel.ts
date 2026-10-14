import { buildQuantities } from '../../physics/build.ts';
import type { PhysicsState } from '../../physics/step.ts';
import type { RoverSpec, SurfaceSpec } from '../../physics/types.ts';

// The force panel numbers (docs/DEMO_BUILD_PLAN.md A7), worked out from the same physics functions as the run (FR-3).

/** Arrow length is proportional to newtons, capped (A7). */
export const HORIZONTAL_SCALE_N = 3000;
export const VERTICAL_SCALE_N = 6000;

export interface ForceArrow {
  label: string;
  valueN: number;
  /** 0 to 1 of the full arrow length. */
  lengthFraction: number;
}

export interface ForcePanel {
  /** The forward arrow, "Motor". */
  motor: ForceArrow;
  /** The backward arrow: "Friction", or "Brake + friction" while braking. */
  friction: ForceArrow;
  weight: ForceArrow;
  groundPush: ForceArrow;
  /** "Balanced: constant speed" when the forward and backward values are equal, else undefined. */
  balancedLabel: string | undefined;
}

const fraction = (valueN: number, scaleN: number) => Math.min(1, Math.max(0, valueN / scaleN));

/** `surface` and `gravityMps2` are those in force under the front during the last step. */
export function forcePanel(state: PhysicsState, rover: RoverSpec, surface: SurfaceSpec, gravityMps2: number): ForcePanel {
  const q = buildQuantities(rover, surface, { gravityMps2 });
  let motorN: number;
  switch (state.drivingState) {
    case 'At top speed':
      motorN = q.rollingForceN; // the motor only balances friction (FR-28)
      break;
    case 'Coasting':
      motorN = 0;
      break;
    default:
      motorN = state.driveForceN; // Driving, and Stopped (the drive force)
  }
  let frictionN = q.rollingForceN;
  let frictionLabel = 'Friction';
  if (state.drivingState === 'Stopped') frictionN = Math.min(q.rollingForceN, state.driveForceN); // so the arrows balance
  if (state.drivingState === 'Braking') {
    frictionN = state.brakeForceN + q.rollingForceN;
    frictionLabel = 'Brake + friction';
  }
  const equal = Math.abs(motorN - frictionN) <= 1e-9 * Math.max(1, motorN, frictionN);
  return {
    motor: { label: 'Motor', valueN: motorN, lengthFraction: fraction(motorN, HORIZONTAL_SCALE_N) },
    friction: { label: frictionLabel, valueN: frictionN, lengthFraction: fraction(frictionN, HORIZONTAL_SCALE_N) },
    weight: { label: 'Weight', valueN: q.weightN, lengthFraction: fraction(q.weightN, VERTICAL_SCALE_N) },
    groundPush: { label: 'Ground push', valueN: q.weightN, lengthFraction: fraction(q.weightN, VERTICAL_SCALE_N) },
    balancedLabel: equal ? 'Balanced: constant speed' : undefined,
  };
}
