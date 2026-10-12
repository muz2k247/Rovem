export type Slot = 'chassis' | 'wheels' | 'motor';

/** The rover quantities a power-up can multiply. Same names as the physics `RoverSpec`. */
export type PowerUpVariable =
  | 'massKg'
  | 'driveForceMaxN'
  | 'brakeForceMaxN'
  | 'rollingFactor'
  | 'gripFactor';

export interface Constants {
  gravityMps2: number;
  stepsPerSecond: number;
  throttleBuildUpS: number;
  brakeBuildUpS: number;
  maxBrakeForceN: number;
  roverLengthM: number;
  turnRateDegPerS: number;
}

export interface Surface {
  id: string;
  name: string;
  rollingFriction: number;
  grip: number;
}

export interface Part {
  id: string;
  slot: Slot;
  name: string;
  massKg: number;
  /** Wheels only. */
  rollingFactor?: number;
  /** Wheels only. */
  gripFactor?: number;
  /** Motors only. */
  driveForceMaxN?: number;
  /** Motors only. */
  topSpeedMps?: number;
  startsUnlocked: boolean;
  unlockCost: number;
}

export interface PowerUp {
  id: string;
  missionId: 1 | 2 | 3;
  name: string;
  variable: PowerUpVariable;
  multiplier: number;
}

export interface Mission1Params {
  asphaltRouteLengthM: number;
  sandRouteLengthM: number;
  timeLimitS: number;
}

export interface Mission2Params {
  iceLengthM: number;
  iceTimeLimitS: number;
  coastTargetM: number;
}

export interface Mission3Params {
  approachSpeedMps: number;
  zoneLengthM: number;
  brakeLineBeforeZoneEndM: number;
}

export interface MissionParams {
  mission1: Mission1Params;
  mission2: Mission2Params;
  mission3: Mission3Params;
}

export interface Content {
  constants: Constants;
  surfaces: Surface[];
  parts: Part[];
  powerUps: PowerUp[];
  missions: MissionParams;
}
