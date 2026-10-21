import type { StretchDef } from './types.ts';

// What the session records per stretch (SHOWCASE_PLAN §9, P6): the time, the speed going in and coming out, and the causes
// the report may name. Plain bookkeeping with no physics of its own, so the report's rules can be tested on hand-built records.
//
// A stretch is entered the first time the rover's front crosses its gate. Time runs from there to the next gate, so a crash
// and the drive back to the checkpoint count against the stretch the rover was in when it crashed (the loss it caused).

export interface StretchCauses {
  /** Seconds the tyres were past their limit: the wheels slipping, or the rover sliding wide in a bend. */
  gripLimitS: number;
  /** What the tyres could give (μ_g k_g R, in newtons) at the last moment counted in `gripLimitS`. */
  gripLimitN: number;
  /** The ground that last moment was on, so the Scavenger's grip can be worked out on the same ground. */
  gripSurfaceId?: string;
  crashes: number;
  scrapes: number;
  /** The speed the wall scrapes took off, added up (m/s). */
  scrapeSpeedLostMps: number;
  rollingBackS: number;
  hits: number;
  /** The speed change from launcher hits, added up (m/s; negative: lost). */
  hitSpeedChangeMps: number;
  boosts: number;
  /** Seconds on each surface (water counts as the sand of its bed, as the physics does). */
  surfaceS: Record<string, number>;
  /** Rolling friction on each surface the rover drove on, against the same build on rock (newtons). */
  surfaceInfo: Record<string, { frictionN: number; rockN: number }>;
}

export interface StretchRecord {
  id: string;
  name: string;
  /** A clean drive's time on it (from the level file). */
  cleanS: number;
  /** When the rover first entered it; null if it never did. */
  enteredAtS: number | null;
  entrySpeedMps: number;
  /** The speed at the gate of the next stretch, or at the part; null while the stretch is not over. */
  exitSpeedMps: number | null;
  /** Entry to exit, or entry to now while it is still running; 0 if never entered. */
  timeS: number;
  causes: StretchCauses;
}

const emptyCauses = (): StretchCauses => ({
  gripLimitS: 0, gripLimitN: 0, crashes: 0, scrapes: 0, scrapeSpeedLostMps: 0, rollingBackS: 0, hits: 0, hitSpeedChangeMps: 0, boosts: 0,
  surfaceS: {}, surfaceInfo: {},
});

export function createStretchTracker(defs: readonly StretchDef[]) {
  const causes: StretchCauses[] = defs.map(emptyCauses);
  const enteredAt: (number | null)[] = defs.map(() => null);
  const entrySpeed: number[] = defs.map(() => 0);
  let current = -1;
  let finishedAtS: number | null = null;
  let finishSpeedMps = 0;

  const cur = (): StretchCauses | undefined => causes[current];

  return {
    get count(): number {
      return defs.length;
    },
    /** The stretch the rover has got furthest into, or −1 before the start or when the level names none. */
    get current(): number {
      return current;
    },
    start(atS: number): void {
      if (defs.length > 0) {
        current = 0;
        enteredAt[0] = atS;
        entrySpeed[0] = 0;
      }
    },
    /** The rover crossed the gate of stretch `index`. Only the next stretch can be entered, and only once. */
    enter(index: number, atS: number, speedMps: number): void {
      if (index !== current + 1 || index >= defs.length) return;
      current = index;
      enteredAt[index] = atS;
      entrySpeed[index] = speedMps;
    },
    finish(atS: number, speedMps: number): void {
      if (finishedAtS !== null) return;
      finishedAtS = atS;
      finishSpeedMps = speedMps;
    },
    /** Time past the grip limit; `gripLimitN` is what the tyres could give at that moment. */
    addGripLimit(dtS: number, gripLimitN: number, surfaceId?: string): void {
      const c = cur();
      if (!c) return;
      c.gripLimitS += dtS;
      c.gripLimitN = gripLimitN;
      if (surfaceId !== undefined) c.gripSurfaceId = surfaceId;
    },
    addRollingBack(dtS: number): void {
      const c = cur();
      if (c) c.rollingBackS += dtS;
    },
    addSurface(surfaceId: string, dtS: number, info?: () => { frictionN: number; rockN: number }): void {
      const c = cur();
      if (!c) return;
      c.surfaceS[surfaceId] = (c.surfaceS[surfaceId] ?? 0) + dtS;
      if (info && !c.surfaceInfo[surfaceId]) c.surfaceInfo[surfaceId] = info();
    },
    addCrash(): void {
      const c = cur();
      if (c) c.crashes += 1;
    },
    addScrape(speedLostMps: number): void {
      const c = cur();
      if (!c) return;
      c.scrapes += 1;
      c.scrapeSpeedLostMps += Math.max(0, speedLostMps);
    },
    addHit(speedChangeMps: number): void {
      const c = cur();
      if (!c) return;
      c.hits += 1;
      c.hitSpeedChangeMps += speedChangeMps;
    },
    addBoost(): void {
      const c = cur();
      if (c) c.boosts += 1;
    },
    /** Copies of the records as they stand at `nowS`. */
    records(nowS: number): StretchRecord[] {
      return defs.map((d, i) => {
        const start = enteredAt[i] ?? null;
        const next = i + 1 < defs.length ? enteredAt[i + 1] ?? null : null;
        const end = next ?? finishedAtS;
        // The last stretch the rover entered ends at the part.
        const exitSpeed = next !== null ? entrySpeed[i + 1]! : start !== null && finishedAtS !== null ? finishSpeedMps : null;
        const c = causes[i]!;
        return {
          id: d.id,
          name: d.name,
          cleanS: d.cleanS,
          enteredAtS: start,
          entrySpeedMps: entrySpeed[i]!,
          exitSpeedMps: exitSpeed,
          timeS: start === null ? 0 : (end ?? nowS) - start,
          causes: { ...c, surfaceS: { ...c.surfaceS }, surfaceInfo: { ...c.surfaceInfo } },
        };
      });
    },
  };
}

export type StretchTracker = ReturnType<typeof createStretchTracker>;
