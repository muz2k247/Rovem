import type { ForceKind } from '../content/levelsConfig.ts';

// The types both Game v4 tracks build against (LEVELS_BUILD_PLAN B4). Frozen after P0: a track may add an
// optional field, never rename or remove one, and lists any addition in its report.

export type { ForceKind };

/** The most "What happened" cards a report shows (A3). */
export const MAX_REPORT_CARDS = 3;
/** The speed trace is sampled this many times a second (B4). */
export const SPEED_TRACE_HZ = 10;

/** A direction or a point in world space (x east, y up, z south, as in three.js). */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** One force drawn on the rover, with its size in newtons (A4). `directionWorld` need not be a unit vector. */
export interface ForceArrow {
  kind: ForceKind;
  forceN: number;
  directionWorld: Vec3;
  /** Extra text after the name and size, e.g. `tyres give up to 1638 N`. */
  extraLabel?: string;
}

export type MagnetPole = 'N' | 'S';

export interface HudBadges {
  reverse: boolean;
  slip: boolean;
  /** The rover magnet's pole, or null in levels without magnets. */
  pole: MagnetPole | null;
}

export interface HudCaption {
  title: string;
  line: string;
}

/** Everything the driving HUD shows (A3, A4). The game layer builds it each frame; React only draws it. */
export interface HudModel {
  speedMps: number;
  speedKmh: number;
  badges: HudBadges;
  levelName: string;
  progressText: string;
  /** 0 to 1. */
  progressFraction: number;
  /** Optional extra line under the progress, e.g. the Endless score (added in A1). */
  scoreText?: string;
  timeS: number;
  /** One caption at a time (A4); null when none is showing. */
  caption: HudCaption | null;
  /** The speed number goes red (the rover lost speed) or green (it gained it) for a moment after a launcher or a vent (R2, SHOWCASE_PLAN §10). */
  speedTone?: 'loss' | 'gain';
  /** The F = ma line, or null while the speed is not changing (A4). */
  forceLine: string | null;
  forces: ForceArrow[];
  /** The booster's pip (R4, SHOWCASE_PLAN §3a): ready, firing (with the time left) or recharging (with the time left and how full the ring is). Absent where there is no booster. */
  booster?: { state: 'ready' | 'firing' | 'recharging'; leftS: number; rechargeLeftS: number; rechargeFraction: number };
  /**
   * The stuck rule (R11, DECISIONS 2026-10-26 (7)): the rover is held at rest on full throttle (or floats almost still) and will go back to its
   * checkpoint. `progress` runs from 0 to 1 over the hold; the wheels spin and a ring shows it; the HUD points at Shift when `boosterReady`.
   */
  stuck?: { cause: 'stuck' | 'floated'; progress: number; boosterReady: boolean; atWall: boolean };
  /**
   * Present while the rover is in water (R12, DECISIONS 2026-10-26 (6)): the two bars of the meter, upthrust against weight, in newtons, and whether the
   * upthrust has passed the weight ("You float": no grip, no steering). `maxUpthrustN` is the most the river can push up with the rover fully under (ρ g V).
   */
  water?: { depthM: number; upthrustN: number; weightN: number; maxUpthrustN: number; floating: boolean };
  /** A kicker launcher is about to fire from behind, or its bag is in flight: the side of the screen its edge marker shows on (R11). */
  launcherWarning?: 'left' | 'right';
  /** The gap to the Scavenger, shown for a few seconds after a split gate (R4). */
  split?: { text: string; behind: boolean };
}

export type StarCount = 0 | 1 | 2 | 3;

export type ReportResult =
  | {
      kind: 'level';
      timeS: number;
      stars: StarCount;
      /** Reach the part, collect all 3 samples, beat the Scavenger (R4; a level with no Scavenger still has the par time, A2). */
      starFlags: [boolean, boolean, boolean];
      parS: number;
      /** When the Scavenger reached the part, on the student's clock; absent in a level with none. */
      scavengerS?: number;
    }
  | { kind: 'endless'; distanceM: number };

export interface SpeedSample {
  timeS: number;
  speedMps: number;
}

/** One "What happened" card (A3). */
export interface ReportCard {
  title: string;
  /** One plain sentence with the student's numbers. */
  sentence: string;
  /** The worked formula lines behind "Show the maths". */
  mathsLines: string[];
  /** When it happened, for the numbered marker on the speed graph. */
  markerTimeS: number;
}

export type TryThisAction = { kind: 'garage'; partId: string } | { kind: 'retry' };

export interface TryThis {
  text: string;
  action: TryThisAction;
}

/** One box of the report's strip (Showcase P6, SHOWCASE_PLAN §9): a named stretch and how your time on it compared with a clean drive. */
export interface StretchResult {
  id: string;
  name: string;
  timeS: number;
  /** The clean drive's time on it. */
  cleanS: number;
  /** Clean drive minus yours: positive means you were faster (green), negative means you lost time. */
  gainS: number;
  entrySpeedMps: number;
  exitSpeedMps: number;
}

/** The first two of the three lines under the strip (the third is `tryThis`): the biggest loss or gain, and the recorded cause behind it. */
export interface StretchExplanation {
  stretchId: string;
  headline: string;
  why: string;
}

/** A ship part brought home at the end of a level, with its line (SHOWCASE_PLAN §12). */
export interface PartPickup {
  levelId: string;
  partName: string;
  line: string;
}

/** "vs your last run" (SHOWCASE_PLAN §9 rule 5): the parts that changed and the stretches that moved most. Kept for the session, never saved. */
export interface VersusLast {
  /** Display names of what changed, e.g. "wheels (Smooth wheels → Spiked wheels)"; empty if nothing did. */
  changed: string[];
  /** The whole line. */
  line: string;
}

export interface ReportModel {
  result: ReportResult;
  speedTrace: SpeedSample[];
  /** At most MAX_REPORT_CARDS. */
  cards: ReportCard[];
  tryThis: TryThis | null;
  /** Added in R3 (P6): the stretch strip and its explanation, for a level whose file names stretches. */
  stretches?: StretchResult[];
  explanation?: StretchExplanation;
  /** Added in R3: the ship part this level brings home, once the level is finished. */
  pickup?: PartPickup;
  /** Added in R4: how this run compares with the last finished run of the level in this session, naming the parts that changed. */
  versusLast?: VersusLast;
}

/** One row of the Levels screen (A3). */
export interface LevelSummary {
  id: string;
  number: number;
  name: string;
  hook: string;
  stars: StarCount;
  bestTimeS: number | null;
  locked: boolean;
  /** Added in I1: the level has no file yet, so its card says "Coming soon" and cannot be opened (A2: unfinished levels). */
  comingSoon?: boolean;
}
