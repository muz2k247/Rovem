import type { EventKind } from '../content/index.ts';
import { EVENT_KINDS } from '../content/types.ts';

// Endless Canyon saving (docs/DEMO_BUILD_PLAN.md A9). Not the Data Model: no Knowledge, no question progress.
// Replaced if the project direction changes. Every read and write is wrapped in try/catch; if storage fails,
// the game works with defaults.

export const DEMO_STORAGE_KEY = 'rovem.demo.v1';

export interface DemoBuild {
  chassisId: string;
  wheelsId: string;
  motorId: string;
}

export interface DemoProgress {
  bestDistanceM: number;
  bestScore: number;
  /** The seed of the last course, for "Replay last course". */
  lastSeed: number | null;
  build: DemoBuild;
  /** Event kinds the student has met (captions show their tidbit the first time). */
  seenEvents: EventKind[];
  speedUnit: 'mps' | 'kmh';
  /** The first run ever waits for a key at the briefing; once it has been seen, later runs close it after 2.5 s. */
  briefingSeen: boolean;
}

/** The starting build is free (CLAUDE.md, Key terms). */
export const DEFAULT_BUILD: DemoBuild = {
  chassisId: 'chassis-standard',
  wheelsId: 'wheels-all-terrain',
  motorId: 'motor-medium',
};

export function defaultProgress(): DemoProgress {
  return {
    bestDistanceM: 0,
    bestScore: 0,
    lastSeed: null,
    build: { ...DEFAULT_BUILD },
    seenEvents: [],
    speedUnit: 'mps',
    briefingSeen: false,
  };
}

/** The part of the Storage interface used here, so tests can pass a fake. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStorage(): StorageLike | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

const isNonNegative = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const isString = (v: unknown): v is string => typeof v === 'string' && v !== '';

/** Reads whatever field is valid and defaults the rest, so one bad field never loses the others. */
export function loadDemoProgress(storage: StorageLike | undefined = defaultStorage()): DemoProgress {
  const out = defaultProgress();
  try {
    const text = storage?.getItem(DEMO_STORAGE_KEY);
    if (!text) return out;
    const raw: unknown = JSON.parse(text);
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out;
    const o = raw as Record<string, unknown>;
    if (isNonNegative(o.bestDistanceM)) out.bestDistanceM = o.bestDistanceM;
    if (isNonNegative(o.bestScore)) out.bestScore = o.bestScore;
    if (Number.isInteger(o.lastSeed)) out.lastSeed = o.lastSeed as number;
    const b = o.build;
    if (typeof b === 'object' && b !== null) {
      const build = b as Record<string, unknown>;
      if (isString(build.chassisId) && isString(build.wheelsId) && isString(build.motorId)) {
        out.build = { chassisId: build.chassisId, wheelsId: build.wheelsId, motorId: build.motorId };
      }
    }
    if (Array.isArray(o.seenEvents)) {
      out.seenEvents = o.seenEvents.filter((k): k is EventKind => (EVENT_KINDS as readonly unknown[]).includes(k));
    }
    if (o.speedUnit === 'mps' || o.speedUnit === 'kmh') out.speedUnit = o.speedUnit;
    if (typeof o.briefingSeen === 'boolean') out.briefingSeen = o.briefingSeen;
  } catch {
    return defaultProgress();
  }
  return out;
}

/** Returns true if the data was saved. Storage that throws (full, blocked, private mode) is not an error for the game. */
export function saveDemoProgress(progress: DemoProgress, storage: StorageLike | undefined = defaultStorage()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

/** What a finished run changes: the bests, the last seed and the event kinds seen. A pure function; the caller saves. */
export function recordRun(
  progress: DemoProgress,
  run: { distanceM: number; score: number; seed: number; eventKinds: readonly EventKind[] },
): DemoProgress {
  const seen = new Set(progress.seenEvents);
  for (const k of run.eventKinds) seen.add(k);
  return {
    ...progress,
    bestDistanceM: Math.max(progress.bestDistanceM, run.distanceM),
    bestScore: Math.max(progress.bestScore, Math.round(run.score)),
    lastSeed: run.seed,
    seenEvents: EVENT_KINDS.filter((k) => seen.has(k)),
  };
}

/** Reset progress (Settings, A3): the bests, the last seed, what was met and the tutorial go; the chosen parts and the speed unit stay. */
export function resetDemoProgress(progress: DemoProgress): DemoProgress {
  return { ...defaultProgress(), build: progress.build, speedUnit: progress.speedUnit };
}
