import { garageText } from '../../content/garage.ts';
import type { Content } from '../../content/index.ts';
import { levelsConfig } from '../../content/levelsConfig.ts';
import { buildQuantities } from '../../physics/build.ts';
import type { RoverSpec } from '../../physics/types.ts';
import { surfaceSpec } from '../buildFromParts.ts';

// The five numbers of the garage (LEVELS_BUILD_PLAN A5), worked out with the same physics functions as the levels
// (FR-3). Pure: no React.

export interface GarageNumbers {
  massKg: number;
  topSpeedMps: number;
  /** a_max on asphalt = (min(F_d,max, F_lim) − F_r) ÷ m. */
  accelerationMps2: number;
  cornerRadiusM: number;
  /** The fastest speed at which the grip still gives the turning force: m v² ÷ r = F_lim, so v = √(F_lim r ÷ m). */
  cornerSpeedMps: number;
  /** Deep water: the rover's density m ÷ V against the water's. It floats when the upthrust ρ g V is at least its weight m g. */
  water: { densityKgPerM3: number; floats: boolean };
}

export function garageNumbers(content: Content, rover: RoverSpec): GarageNumbers {
  const g = content.constants.gravityMps2;
  const asphalt = buildQuantities(rover, surfaceSpec(content, 'asphalt'), { gravityMps2: g });
  const r = garageText.cornerRadiusM;
  const { densityKgPerM3, roverVolumeM3 } = levelsConfig.water;
  const upthrustN = densityKgPerM3 * g * roverVolumeM3; // U = ρ g V, the rover fully under
  return {
    massKg: rover.massKg,
    topSpeedMps: rover.topSpeedMps,
    accelerationMps2: asphalt.maxAccelerationMps2,
    cornerRadiusM: r,
    cornerSpeedMps: Math.sqrt((asphalt.gripLimitN * r) / rover.massKg),
    water: { densityKgPerM3: rover.massKg / roverVolumeM3, floats: upthrustN >= asphalt.weightN },
  };
}
