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
  /** Footprint width for rocks: the M4 model's outer wheel edges (DECISIONS 2026-10-13). */
  roverWidthM: number;
  turnRateDegPerS: number;
  /** Reverse top speed = this × v_max (DECISIONS 2026-10-13, provisional). */
  reverseTopSpeedFraction: number;
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
  /** One per file in `levels/`, keyed by file name. */
  levels: Levels;
  /** Demo v3 (DECISIONS 2026-10-14): the endless canyon run. */
  run: RunParams;
  runChunks: RunChunks;
  runText: RunText;
}

/** A point on the ground, physics axes: x along the start heading, z to its left. */
export interface PointM {
  xM: number;
  zM: number;
}

/** A region of one surface. Later regions are drawn over earlier ones, so friction tiles go last. */
export interface SurfaceRegion {
  surfaceId: string;
  polygon: PointM[];
}

/** A solid rock (DECISIONS 2026-10-13): a circle on the ground. */
export interface Rock {
  kind: 'rock';
  xM: number;
  zM: number;
  radiusM: number;
}

export interface Pickup {
  powerUpId: string;
  xM: number;
  zM: number;
  radiusM: number;
}

export type SegmentLineKind = 'start' | 'target' | 'gate';
export type AreaLineKind = 'gridBox' | 'zone';

/** A line the rover crosses (start, target, gate) or an area it stops in (grid box, zone). */
export type LevelLine =
  | { id: string; kind: SegmentLineKind; from: PointM; to: PointM }
  | { id: string; kind: AreaLineKind; polygon: PointM[] };

/** One level as data (DESIGN §8). `hazards` and `modifiers` are reserved and empty in the MVP. */
export interface Level {
  name: string;
  /** True for stand-in layouts, such as the M4 test course. */
  placeholder: boolean;
  start: { xM: number; zM: number; headingDeg: number };
  /** The surface wherever no region covers the ground. */
  defaultSurfaceId: string;
  surfaces: SurfaceRegion[];
  props: Rock[];
  pickups: Pickup[];
  lines: LevelLine[];
  /** The ideal line, used by the steering assist and the balance. */
  path: PointM[];
  hazards: never[];
  modifiers: never[];
}

/** Every level the game ships, keyed by file name in `levels/`. M5b adds the Canyon Dash. */
export interface Levels {
  testCourse: Level;
}

// ---- Demo v3: endless canyon run (docs/DEMO_BUILD_PLAN.md A3, A10, A11) ----

export interface SandbagParams {
  massKg: number;
  radiusM: number;
  headOnSpeedMps: number;
  kickerSpeedMps: number;
  fireIntervalS: number;
  /** A head-on cannon wakes when the front is this far before it. */
  headOnTriggerDistanceM: number;
  kickerShots: number;
  /** A kicker wakes when the rover's rear edge is this far past the cannon (OI-15). */
  kickerWakeRearOffsetM: number;
  /** A bag is removed once it has travelled this far. */
  rangeM: number;
}

export interface RunUnlock {
  partId: string;
  atBestDistanceM: number;
}

/** In `run.json`. All provisional (DECISIONS 2026-10-14). */
export interface RunParams {
  /** The canyon runs along +x, |z| ≤ this. */
  corridorHalfWidthM: number;
  warmUpLengthM: number;
  fieldChunksBetweenTunnels: number;
  /** Distance at which difficulty 1, 2 and 3 chunks start to be allowed. */
  difficultyStartsM: [number, number, number];
  gravityMultipliers: { low: number; high: number };
  boostImpulseNs: number;
  sandbag: SandbagParams;
  unlocks: RunUnlock[];
}

/** A rectangle in chunk-local metres: x from 0 to the chunk length, z across the canyon. */
export interface RectM {
  xM: [number, number];
  zM: [number, number];
}

export interface ChunkTile extends RectM {
  surfaceId: string;
}

export type CannonKind = 'headOn' | 'kicker';
export type GravityKind = 'low' | 'high';

export interface ChunkCannon {
  kind: CannonKind;
  xM: number;
  zM: number;
}

export interface ChunkGravityZone extends RectM {
  kind: GravityKind;
}

export interface RunChunk {
  id: string;
  /** 1–3. The tunnel has none (0). */
  difficulty: number;
  lengthM: number;
  tiles: ChunkTile[];
  barriers: RectM[];
  boostPads: RectM[];
  cannons: ChunkCannon[];
  gravityZones: ChunkGravityZone[];
}

export interface RunChunks {
  fieldChunks: RunChunk[];
  tunnel: RunChunk;
}

/** The event kinds the student can meet (A7, A11). */
export const EVENT_KINDS = ['mud', 'sand', 'ice', 'boost', 'headOnHit', 'kickerHit', 'gravity', 'slip', 'aboveTopSpeed'] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

/** Effects that get a formula line in the report. */
export const FORMULA_KINDS = ['mud', 'boost', 'headOnHit', 'kickerHit', 'gravity'] as const;
export type FormulaKind = (typeof FORMULA_KINDS)[number];

export const TRY_THIS_KEYS = ['stuckInHighGravity', 'smoothWheels', 'heavyChassis', 'steerEarlier', 'takeBoosts'] as const;
export type TryThisKey = (typeof TRY_THIS_KEYS)[number];

/** In `runText.json`. Placeholder text until k._muz reviews it (CLAUDE.md, Questions). */
export interface RunText {
  placeholder: boolean;
  briefing: { headline: string; hazards: string[] };
  tidbits: Record<EventKind, string>;
  formulas: Record<FormulaKind, string>;
  tryThis: Record<TryThisKey, string>;
}
