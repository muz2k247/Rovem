import type { Content, PowerUp } from '../content/index.ts';
import type { Multiplier, PhysicsConstants, RoverSpec, SurfaceSpec } from '../physics/types.ts';

/** One chassis, one set of wheels and one motor (FR-1). */
export interface BuildSelection {
  chassisId: string;
  wheelsId: string;
  motorId: string;
}

/** Free, and able to pass every mission. */
export const STARTING_BUILD: BuildSelection = {
  chassisId: 'chassis-standard',
  wheelsId: 'wheels-all-terrain',
  motorId: 'motor-medium',
};

function part(content: Content, id: string, slot: 'chassis' | 'wheels' | 'motor') {
  const found = content.parts.find((p) => p.id === id);
  if (!found) throw new Error(`Unknown part "${id}"`);
  if (found.slot !== slot) throw new Error(`Part "${id}" is a ${found.slot}, not a ${slot}`);
  return found;
}

/** Adds up the three parts into the numbers the physics uses. m = chassis + wheels + motor. */
export function roverFromParts(content: Content, selection: BuildSelection): RoverSpec {
  const chassis = part(content, selection.chassisId, 'chassis');
  const wheels = part(content, selection.wheelsId, 'wheels');
  const motor = part(content, selection.motorId, 'motor');
  return {
    massKg: chassis.massKg + wheels.massKg + motor.massKg,
    driveForceMaxN: motor.driveForceMaxN!,
    brakeForceMaxN: content.constants.maxBrakeForceN,
    rollingFactor: wheels.rollingFactor!,
    gripFactor: wheels.gripFactor!,
    topSpeedMps: motor.topSpeedMps!,
  };
}

export function physicsConstants(content: Content): PhysicsConstants {
  const c = content.constants;
  return {
    gravityMps2: c.gravityMps2,
    timeStepS: 1 / c.stepsPerSecond,
    throttleBuildUpS: c.throttleBuildUpS,
    brakeBuildUpS: c.brakeBuildUpS,
    turnRateDegPerS: c.turnRateDegPerS,
  };
}

export function surfaceSpec(content: Content, id: string): SurfaceSpec {
  const s = content.surfaces.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown surface "${id}"`);
  return { rollingFriction: s.rollingFriction, grip: s.grip };
}

export function powerUpById(content: Content, id: string): PowerUp {
  const p = content.powerUps.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown power-up "${id}"`);
  return p;
}

/** The physics' view of a power-up. */
export function multiplierOf(powerUp: PowerUp): Multiplier {
  return { variable: powerUp.variable, multiplier: powerUp.multiplier };
}
