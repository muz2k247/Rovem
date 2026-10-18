import type { CannonKind, GravityKind, PointM } from '../../content/index.ts';

// The level file format (LEVELS_BUILD_PLAN A9). Each level is one JSON file in `src/content/levels/`, validated on
// load by `schema.ts`. Axes as everywhere in the game layer: x along the start heading, z to its left, metres.
// Every number a level needs is in its file; shared values (water, magnets, arrows) are in `levels.json`.

export const LEVEL_IDS = ['first-tracks', 'push-and-shove', 'crater-field', 'gravity-wells', 'ring-road', 'the-crossing', 'polar-pass'] as const;
export type LevelId = (typeof LEVEL_IDS)[number];

export interface Pose {
  xM: number;
  zM: number;
  headingDeg: number;
}

/** One piece of a road, driven from where the last one ended. An arc turns left for a positive angle, right for a negative one. */
export type RoadSegment = { kind: 'straight'; lengthM: number } | { kind: 'arc'; radiusM: number; angleDeg: number };

/**
 * A drivable road: a centreline built from segments, a width, and a run-off strip on each side before the walls
 * (A7: 4 m of sand). It starts at `start`, or where the road named in `after` ends. Forks are two roads that leave
 * the same stop line and meet again at the fork's merge point.
 */
export interface RoadDef {
  id: string;
  /** What a caption calls this road ("Sand"). Default: the id. */
  name?: string;
  widthM?: number;
  runoffM?: number;
  surfaceId?: string;
  /** The surface of the run-off strips (default sand; Ring Road uses mud). */
  runoffSurfaceId?: string;
  start?: Pose;
  after?: string;
  segments: RoadSegment[];
}

/** A cosine-bell hill: rises to `heightM` at the centre and falls to 0 at `radiusM`. */
export interface HillDef {
  xM: number;
  zM: number;
  radiusM: number;
  heightM: number;
}

/**
 * A crater: a flat floor of `floorRadiusM` at `depthM` below the rim, with a wall that climbs out at a constant angle.
 * The wall is steep (`wallAngleDeg`) except around `rampHeadingDeg`, where it is the gentle ramp (`rampAngleDeg`).
 */
export interface CraterDef {
  xM: number;
  zM: number;
  floorRadiusM: number;
  depthM: number;
  wallAngleDeg: number;
  rampAngleDeg: number;
  rampHeadingDeg: number;
}

/** A ridge or wall along `headingDeg`: rises at `riseAngleDeg` over `riseLengthM`, a flat top, then falls at `fallAngleDeg`. */
export interface RidgeDef {
  xM: number;
  zM: number;
  headingDeg: number;
  riseAngleDeg: number;
  riseLengthM: number;
  topLengthM: number;
  fallAngleDeg: number;
  widthM: number;
}

export interface WaterDef {
  id: string;
  polygon: PointM[];
  depthM: number;
}

export interface SurfaceZoneDef {
  surfaceId: string;
  polygon: PointM[];
}

export interface GravityZoneDef {
  id: string;
  kind: GravityKind;
  polygon: PointM[];
}

export interface PylonDef {
  id: string;
  xM: number;
  zM: number;
  pole: 'N' | 'S';
  /** An electromagnet that switches: 3 s on, 2 s off (levels.json), starting `phaseS` into its cycle. Left out: always on. */
  switching?: { phaseS: number };
}

export interface BoostDef {
  id: string;
  xM: number;
  zM: number;
  radiusM: number;
}

export interface CannonDef {
  id: string;
  kind: CannonKind;
  xM: number;
  zM: number;
  /** The way the sandbags fly. A head-on cannon points at the oncoming rover, a kicker the way it drives. */
  directionDeg: number;
  /** The rover wakes the cannon this close to it. Default: the run's trigger distance (head-on) or 12 m (kicker). */
  triggerM?: number;
}

/** A box the rover crashes into. `headingDeg` turns it; `lengthM` is along that heading. */
export interface BarrierDef {
  id: string;
  xM: number;
  zM: number;
  headingDeg: number;
  lengthM: number;
  widthM: number;
}

export interface CheckpointDef {
  id: string;
  xM: number;
  zM: number;
  headingDeg: number;
  radiusM?: number;
}

export interface StopLineDef {
  id: string;
  xM: number;
  zM: number;
  headingDeg: number;
  widthM: number;
  /** The red light: the rover is held at the line this long, then goes. */
  redS: number;
}

/** Two roads that leave one stop line and meet again at `mergeAt` (A7: the choice is a prediction). */
export interface ForkDef {
  id: string;
  stopLineId: string;
  /** The two road ids: the first is the one named first in the caption. */
  roadIds: [string, string];
  mergeAt: { xM: number; zM: number; radiusM: number };
}

export interface SampleDef {
  id: string;
  xM: number;
  zM: number;
}

/** A bend sign: shows the radius and the safe speed for the current build (A7). */
export interface SignDef {
  id: string;
  xM: number;
  zM: number;
  radiusM: number;
}

export type HintTrigger = { kind: 'start' } | { kind: 'coast' } | { kind: 'zone'; xM: number; zM: number; radiusM: number };
export type HintDone = 'throttle' | 'release' | 'steer' | 'brake';

/** First Tracks' on-the-move control hints (A7): shown when needed, gone once done. */
export interface HintDef {
  id: string;
  /** The key in `levelText.json` → `hints`. */
  textId: string;
  trigger: HintTrigger;
  doneWhen: HintDone;
  /** It also vanishes after this long. Default 8 s. */
  maxS?: number;
}

export interface FinishDef {
  xM: number;
  zM: number;
  radiusM: number;
}

export interface LevelDef {
  id: LevelId;
  name: string;
  placeholder: boolean;
  atmosphere: string;
  /** The par time (A2); the third star. Set by I1; provisional until k._muz has played. */
  parS: number;
  start: Pose;
  defaultSurfaceId: string;
  roads: RoadDef[];
  /** The road ids, in order, that make up the main route: progress and the bar along the top are measured along it. */
  route: string[];
  hills: HillDef[];
  craters: CraterDef[];
  ridges: RidgeDef[];
  water: WaterDef[];
  surfaceZones: SurfaceZoneDef[];
  gravityZones: GravityZoneDef[];
  pylons: PylonDef[];
  boosts: BoostDef[];
  cannons: CannonDef[];
  barriers: BarrierDef[];
  checkpoints: CheckpointDef[];
  stopLines: StopLineDef[];
  forks: ForkDef[];
  samples: SampleDef[];
  signs: SignDef[];
  hints: HintDef[];
  finish: FinishDef;
}
