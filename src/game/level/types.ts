import type { CannonKind, EdgeStyle, GravityKind, PointM } from '../../content/index.ts';

// The level file format (LEVELS_BUILD_PLAN A9). Each level is one JSON file in `src/content/levels/`, validated on
// load by `schema.ts`. Axes as everywhere in the game layer: x along the start heading, z to its left, metres.
// Every number a level needs is in its file; shared values (water, magnets, arrows) are in `levels.json`.

// Crash Site (Showcase R3) replaces First Tracks and Ring Road; Geyser Canyon (R5) replaces Push & Shove; Crater Field (R6) folds in Gravity Wells.
// The other two are the v4 files, rebuilt in R7 (SHOWCASE_PLAN §7).
export const LEVEL_IDS = ['crash-site', 'geyser-canyon', 'crater-field', 'the-crossing', 'polar-pass'] as const;
export type LevelId = (typeof LEVEL_IDS)[number];

export interface Pose {
  xM: number;
  zM: number;
  headingDeg: number;
}

/**
 * What stands beyond the edge the rover scrapes along (SHOWCASE_PLAN §12a, R6b): a hillside behind a broken rock step (the default),
 * a faceted rock face (canyons and caves), or a cliff drop behind a rim of rocks. Presentation only: the scrape line does not move.
 */
export const EDGE_STYLES: readonly EdgeStyle[] = ['hill', 'rock', 'cliff'];
export type { EdgeStyle };

/** The edge style along a stretch of one side of a road. Later rules win. A side is the left (+z of the heading) or the right of the road. */
export interface EdgeRule {
  side: 'left' | 'right' | 'both';
  /** Distance along the road where the stretch begins and ends. Left out: the road's start and end. */
  fromM?: number;
  toM?: number;
  style: EdgeStyle;
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
  /**
   * A chasm in the road (E45): between these two distances along it there is no ground. The road is still one road for forks and
   * routes. A rover that lands there, or drives into it, falls and comes back to the last checkpoint; a jump crosses it.
   */
  gap?: { fromM: number; toM: number };
  /** What stands beyond the edge of this road, per side and stretch (R6b). Left out: the level's `edgeStyle`. */
  edges?: EdgeRule[];
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

/**
 * A ramp with a lip (Physics Model Specification 11.3, E45): the only place the rover leaves the ground. The ground climbs at
 * `angleDeg` over `lengthM` up to the lip, then drops away. The lip is a line across the ramp, `xM`, `zM` at its middle,
 * square to `headingDeg`, the way the rover is driven over it. A rover crossing the lip leaves with v_h = v cos φ and v_y = v sin φ.
 */
export interface RampDef {
  id: string;
  xM: number;
  zM: number;
  headingDeg: number;
  angleDeg: number;
  lengthM: number;
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
  /** A cave: the height of its roof above the lip of a ramp in it, in metres. Every jump of every build must clear it (R6; `levelChecks.ts`). */
  ceilingM?: number;
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
  /** How it is drawn: the orange block (default) or a rock. The physics is the same box. */
  look?: 'boulder';
}

export interface CheckpointDef {
  id: string;
  xM: number;
  zM: number;
  headingDeg: number;
  radiusM?: number;
}

/** A line the rover drives through where a fork begins. Nothing stops there (SHOWCASE_PLAN §5). */
export interface ForkLineDef {
  xM: number;
  zM: number;
  headingDeg: number;
  widthM: number;
}

/** Two roads that leave one fork line and meet again at `mergeAt` (A7: the choice is a prediction). */
export interface ForkDef {
  id: string;
  line: ForkLineDef;
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

/**
 * A named part of a level's route that the report compares time on (SHOWCASE_PLAN §9, P6). A stretch begins where the route
 * road named in `startsAfterRoad` ends (the first stretch begins at the start) and ends where the next one begins; the last
 * ends at the part. The rover enters a stretch the first time its front crosses that line, so a crash and the drive back
 * count against the stretch the crash happened in.
 */
export interface StretchDef {
  id: string;
  /** What the report calls it ("The Ring"). */
  name: string;
  startsAfterRoad?: string;
  /** The time a clean drive with the starting build takes on it (provisional: the Scavenger's trace replaces it in R4). */
  cleanS: number;
}

/**
 * The Scavenger (SHOWCASE_PLAN §8): an old robot rover that drives an honest run of this level at load, with its own build and route.
 * Levels without one keep the v4 par time as the third star.
 */
export interface ScavengerDef {
  /** Part ids, as in the garage. */
  build: { chassisId: string; wheelsId: string; motorId: string };
  /** The roads it drives, in order (each starting where the one before ends); the main route with a fork's road swapped. */
  roads: string[];
  /** Points its path passes through, if the roads alone are not enough. */
  via?: PointM[];
  /** The autopilot's bend margin (fraction of the safe bend speed). Default 0.9. */
  bendMargin?: number;
  /**
   * `scavengerStartDelayS` (SHOWCASE_PLAN §8): the one tuning knob, shown to the student. 0 starts it beside you; positive: it starts
   * that many seconds after you; negative: a head start. Its driving is never slowed in secret.
   */
  startDelayS: number;
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
  ramps: RampDef[];
  water: WaterDef[];
  surfaceZones: SurfaceZoneDef[];
  gravityZones: GravityZoneDef[];
  pylons: PylonDef[];
  boosts: BoostDef[];
  cannons: CannonDef[];
  barriers: BarrierDef[];
  checkpoints: CheckpointDef[];
  forks: ForkDef[];
  samples: SampleDef[];
  signs: SignDef[];
  hints: HintDef[];
  finish: FinishDef;
  /** 4–6 named stretches for the report (P6), or none. */
  stretches: StretchDef[];
  /** The rival (R4); left out: the third star is the par time. */
  scavenger?: ScavengerDef;
  /** The smoking wreck beside the start (Crash Site): where the opening line stands. */
  wreck?: Pose;
  /** What stands beyond the edges where a road's own `edges` say nothing (R6b). Default `hill`. */
  edgeStyle?: EdgeStyle;
}

/** The looks a level can ask for (A8). Presentation only; `src/render/atmosphere.ts` has one preset for each. */
export const ATMOSPHERE_IDS = ['clear-dusk', 'orange-haze', 'low-sun', 'starry', 'violet-evening', 'blue-mist', 'aurora-night'] as const;
export type AtmosphereId = (typeof ATMOSPHERE_IDS)[number];
