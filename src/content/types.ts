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
  /** A head-on cannon wakes when the front is this far before it. */
  headOnTriggerDistanceM: number;
  /** A kicker wakes when the rover's rear edge is this far past the cannon (OI-15). */
  kickerWakeRearOffsetM: number;
  /** A bag is removed once it has travelled this far. */
  rangeM: number;
  /** Roadside launchers (R11, DECISIONS 2026-10-26 (5)): a bag flies this many degrees off the road. */
  angleDeg: number;
  /** A launcher stands this far from the road's centre line. */
  roadsideOffsetM: number;
  /** Two hits are at least this far apart in time: a bag that arrives sooner after a hit does nothing. */
  minHitGapS: number;
  /** A kicker warns (a sound and an edge marker) once the rover is this close to it, before it fires. */
  kickerWarnM: number;
  /** A launcher stands on a square base this wide and is solid: the rover cannot drive through it (R11). */
  baseSizeM: number;
  /** A launcher does not aim at a rover slower than this: it is not going anywhere a bag could meet it. */
  minAimSpeedMps: number;
}

/** In `run.json`. All provisional (DECISIONS 2026-10-14). */
export interface RunParams {
  /** The canyon runs along +x, |z| ≤ this. */
  corridorHalfWidthM: number;
  warmUpLengthM: number;
  /** With no steer key held, the game steers the heading back toward 0 (DECISIONS 2026-10-16). Off: the heading stays where it was left. */
  steerReturnToStraight: boolean;
  /** Demo only (DECISIONS 2026-10-16): reverse top speed = this × v_max, passed to step() by the game layer. The v2 value (0.5) stays in constants.json. */
  reverseTopSpeedFactor: number;
  /** Demo only: the travel direction lags the heading when the tyres cannot turn the rover fast enough (DESIGN, drifting). Off: the rover moves along its heading. */
  drift: boolean;
  /** Demo only: the wall behind the start line (x < 0), clear of the chase camera. Engineering value, set by Claude (DECISIONS 2026-10-16). */
  startWallXM: number;
  /** The most field sections between two Gravity Caves sections; the generator picks one after this many (DECISIONS 2026-10-21 R2). */
  fieldChunksBetweenTunnels: number;
  /** Every Endless section is at least this long (SHOWCASE_PLAN §11, §16: 150 m). */
  sectionMinLengthM: number;
  /** A mud patch is at most this long (SHOWCASE_PLAN §5, §16: 12 m). */
  mudPatchMaxLengthM: number;
  /** The tightest bend a section's line may need, per surface id (D5: 1.5 × the tightest bend all-terrain wheels hold at 18 m/s). */
  minBendRadiusM: Record<string, number>;
  /** Distance at which difficulty 1, 2 and 3 chunks start to be allowed. */
  difficultyStartsM: [number, number, number];
  gravityMultipliers: { low: number; high: number };
  boostImpulseNs: number;
  sandbag: SandbagParams;
}

/** A rectangle in chunk-local metres: x from 0 to the chunk length, z across the canyon. */
export interface RectM {
  xM: [number, number];
  zM: [number, number];
}

/**
 * A zone on the ground. The data may give it as a rectangle (xM, zM ranges, which stays valid) or as a `polygon`; either way the
 * loaded zone has both: `polygon` is the shape the lookup uses, and the ranges are its bounding box.
 */
export interface ChunkZoneShape extends RectM {
  polygon: PointM[];
}

export interface ChunkTile extends ChunkZoneShape {
  surfaceId: string;
}

export type CannonKind = 'headOn' | 'kicker';
export type GravityKind = 'low' | 'high';

export interface ChunkCannon {
  kind: CannonKind;
  xM: number;
  zM: number;
}

export interface ChunkGravityZone extends ChunkZoneShape {
  kind: GravityKind;
}

/**
 * One Endless section, a named place (SHOWCASE_PLAN §11). Coordinates are section-local: x from 0 to the length, z across the canyon.
 * Several templates can share a place ("Dune Sea") at different difficulties.
 */
/** What stands beyond an edge the rover scrapes along (SHOWCASE_PLAN §12a, R6b): a hillside, a faceted rock face, or a cliff drop behind a rim of rocks. */
export type EdgeStyle = 'hill' | 'rock' | 'cliff';

export interface RunChunk {
  id: string;
  /** What stands beyond the corridor walls in this place (R6b). Default `hill`. */
  edge?: EdgeStyle;
  /** The place id, shared by the variants of one place: the generator never puts the same place twice in a row. */
  place: string;
  /** The place's name, on the entry post and in the HUD ("Dune Sea"). */
  name: string;
  /** 1–3. The Gravity Caves section has 1 too. */
  difficulty: number;
  lengthM: number;
  /** Where the entry post stands (section-local x). */
  entryPostXM: number;
  /** A line through the section that avoids every obstacle; the bend rule (D5) is checked on it. */
  line: PointM[];
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
export const EVENT_KINDS = ['mud', 'sand', 'ice', 'boost', 'headOnHit', 'kickerHit', 'gravity', 'slip', 'aboveTopSpeed', 'slide', 'scrape'] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

/** Effects that get a formula line in the report. */
export const FORMULA_KINDS = ['mud', 'boost', 'headOnHit', 'kickerHit', 'gravity'] as const;
export type FormulaKind = (typeof FORMULA_KINDS)[number];

export const TRY_THIS_KEYS = ['pickLane', 'stuckInHighGravity', 'smoothWheels', 'brakeFirst', 'heavyChassis', 'dodgeCannon', 'steerEarlier', 'brakeBeforeCorner', 'takeBoosts'] as const;
export type TryThisKey = (typeof TRY_THIS_KEYS)[number];

/** In `runText.json`. Placeholder text until k._muz reviews it (CLAUDE.md, Questions). */
export interface RunText {
  placeholder: boolean;
  briefing: { headline: string; hazards: string[] };
  tidbits: Record<EventKind, string>;
  /** The name of each element on its caption card and in the field log (R2: "Vent", not "Boost pad"). */
  titles: Record<EventKind, string>;
  formulas: Record<FormulaKind, string>;
  /** The question on the tunnel signs. */
  tunnelQuestion: string;
  tryThis: Record<TryThisKey, string>;
}
