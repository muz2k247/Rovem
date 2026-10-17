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
  timeS: number;
  /** One caption at a time (A4); null when none is showing. */
  caption: HudCaption | null;
  /** The F = ma line, or null while the speed is not changing (A4). */
  forceLine: string | null;
  forces: ForceArrow[];
}

export type StarCount = 0 | 1 | 2 | 3;

export type ReportResult =
  | {
      kind: 'level';
      timeS: number;
      stars: StarCount;
      /** Finish, beat the par time, the level's challenge (A2). */
      starFlags: [boolean, boolean, boolean];
      parS: number;
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

export interface ReportModel {
  result: ReportResult;
  speedTrace: SpeedSample[];
  /** At most MAX_REPORT_CARDS. */
  cards: ReportCard[];
  tryThis: TryThis | null;
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
}
