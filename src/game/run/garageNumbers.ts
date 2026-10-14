import type { Content } from '../../content/index.ts';
import { buildQuantities } from '../../physics/build.ts';
import { applyImpulse, shareMomentum } from '../../physics/momentum.ts';
import { createState } from '../../physics/step.ts';
import type { RoverSpec } from '../../physics/types.ts';
import { surfaceSpec } from '../buildFromParts.ts';

// The "Your rover in the canyon" numbers of the garage (docs/DEMO_BUILD_PLAN.md A8), worked out with the same
// physics functions as the run (FR-3). Pure: no React.

export interface GarageNumbers {
  massKg: number;
  /** F_d,max: the motor's force. */
  motorForceN: number;
  topSpeedMps: number;
  /** In mud at top speed: the friction F_r against the most force the motor can pass on, min(F_d,max, F_lim). */
  mud: { frictionN: number; motorN: number; verdict: 'you slow down' | 'you push through' };
  /** Boost pad from top speed: Δv = J/m. */
  boostGainMps: number;
  /** Sandbag hit head-on from top speed: v_max → v′. */
  sandbag: { fromMps: number; toMps: number };
  weightLowN: number;
  weightHighN: number;
}

export function garageNumbers(content: Content, rover: RoverSpec): GarageNumbers {
  const run = content.run;
  const g = content.constants.gravityMps2;
  const mud = buildQuantities(rover, surfaceSpec(content, 'mud'), { gravityMps2: g });
  const motorN = Math.min(rover.driveForceMaxN, mud.gripLimitN);
  const atTop = createState({ speedMps: rover.topSpeedMps });
  const boosted = applyImpulse(atTop, rover.massKg, run.boostImpulseNs);
  const hit = shareMomentum(atTop, rover.massKg, run.sandbag.massKg, -run.sandbag.headOnSpeedMps);
  return {
    massKg: rover.massKg,
    motorForceN: rover.driveForceMaxN,
    topSpeedMps: rover.topSpeedMps,
    mud: { frictionN: mud.rollingForceN, motorN, verdict: mud.rollingForceN > motorN ? 'you slow down' : 'you push through' },
    boostGainMps: boosted.speedMps - atTop.speedMps,
    sandbag: { fromMps: rover.topSpeedMps, toMps: hit.direction === 'forward' ? hit.speedMps : -hit.speedMps },
    weightLowN: rover.massKg * g * run.gravityMultipliers.low,
    weightHighN: rover.massKg * g * run.gravityMultipliers.high,
  };
}
