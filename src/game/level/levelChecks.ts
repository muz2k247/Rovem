import { describe, expect, it, vi } from 'vitest';
import { content } from '../../content/index.ts';
import { levelsConfig } from '../../content/levelsConfig.ts';
import { loadLevelDef } from './levels.ts';
import { levelPlans, naivePlan } from './levelPlans.ts';
import { createScavengerRun } from './scavenger.ts';
import { allBuilds, representativeBuilds, runPilot } from './testPilot.ts';
import type { LevelDef, LevelId } from './types.ts';
import { createLevelWorld, type LevelWorld } from './world.ts';

// The checks every level file must pass (LEVELS_BUILD_PLAN A7, A10; B4). One test file per level calls `checkLevelFile`,
// so the seven levels run side by side. Test-only: nothing in the game imports this.

vi.setConfig({ testTimeout: 240_000 });

const MAGNET_CUTOFF_M = levelsConfig.magnet.cutoffM;
/** Two roads are kept this far apart (two reaches of 9 m and a little more) except near their joins. */
const REACH_GAP_M = 20;
const JOIN_M = 80;

/** The level, its map and its plans, loaded once for a test file. */
export function loadLevel(id: LevelId): { def: LevelDef; world: LevelWorld; plans: ReturnType<typeof levelPlans> } {
  const def = loadLevelDef(id);
  const world = createLevelWorld(def, content);
  return { def, world, plans: levelPlans(def, world) };
}

/** The level restarted from one of its checkpoints, with no checkpoints of its own: for tests that only care about what comes next. */
export function startingAt(def: LevelDef, checkpointId: string): LevelDef {
  const c = def.checkpoints.find((x) => x.id === checkpointId);
  if (!c) throw new Error(`No checkpoint ${checkpointId}`);
  return { ...def, start: { xM: c.xM, zM: c.zM, headingDeg: c.headingDeg }, checkpoints: [] };
}

function centrelineSamples(world: LevelWorld, roadId: string, everyM = 2) {
  const road = world.roadById(roadId);
  const pts = road.line.points;
  const out: { xM: number; zM: number; alongM: number }[] = [];
  for (let s = 0; s <= road.line.lengthM; s += everyM) {
    let i = 0;
    while (i < pts.length - 2 && road.line.alongAt[i + 1]! < s) i++;
    const len = road.line.alongAt[i + 1]! - road.line.alongAt[i]!;
    const t = len === 0 ? 0 : (s - road.line.alongAt[i]!) / len;
    out.push({ xM: pts[i]!.xM + (pts[i + 1]!.xM - pts[i]!.xM) * t, zM: pts[i]!.zM + (pts[i + 1]!.zM - pts[i]!.zM) * t, alongM: s });
  }
  return out;
}

export interface CheckOptions {
  /**
   * The scripted driver's star run (all 3 samples, no booster) finishes before the Scavenger. Default true. Crater Field sets it false: after
   * R11 the Scavenger is +5.9% over the starting rover's clean best, and the sample line costs Crater Field 10%, so the scripted run with its
   * samples is 5.9 s behind the ghost. R13 rebuilds the level and retunes the Scavenger (DECISIONS 2026-10-26 (3)).
   */
  starRunBeatsScavenger?: boolean;
  /**
   * Holding W along the middle of the road misses at least one star. Default true. Geyser Canyon sets it false: after R11 each launcher fires
   * one aimed shot, so holding W takes the vent lane in 81 s, collects the three samples on the centre line and beats the Scavenger. R13
   * rebuilds the level (DECISIONS 2026-10-26 (8): about 150 s).
   */
  holdWMissesAStar?: boolean;
  /**
   * The window for the starting build's clean star run, in seconds (exclusive). Default 60 to 150, the v4 and Showcase rule. The levels rebuilt in the Polish round
   * (R12 onward) say 135 to 160: about 150 s (DECISIONS 2026-10-27 (8)).
   */
  starRunWindowS?: [number, number];
  /** The longest gap between checkpoints on a good drive, in seconds (exclusive). Default 55. The rebuilt levels say 40: a return costs little. */
  checkpointGapS?: number;
}

export function checkLevelFile(id: LevelId, options: CheckOptions = {}): void {
  const { def, world, plans } = loadLevel(id);
  const starRunBeatsScavenger = options.starRunBeatsScavenger ?? true;
  const holdWMissesAStar = options.holdWMissesAStar ?? true;
  const [starRunMinS, starRunMaxS] = options.starRunWindowS ?? [60, 150];
  const checkpointGapS = options.checkpointGapS ?? 55;

  describe(`level file ${id}`, () => {
    it('is marked placeholder and has a par time', () => {
      expect(def.placeholder).toBe(true);
      expect(def.parS).toBeGreaterThan(0);
    });

    it('has at least one fork (the Showcase levels have one big choice, SHOWCASE_PLAN §2; the v4 levels have two), each leaving its fork line and meeting again at the merge point (A7)', () => {
      expect(def.forks.length).toBeGreaterThanOrEqual(1);
      for (const f of def.forks) {
        const line = f.line;
        for (const rid of f.roadIds) {
          const first = world.roadById(rid).line.points[0]!;
          expect(Math.hypot(first.xM - line.xM, first.zM - line.zM), `${f.id}: ${rid} starts at the fork line`).toBeLessThan(1);
          const end = world.roadById(rid).end;
          expect(Math.hypot(end.xM - f.mergeAt.xM, end.zM - f.mergeAt.zM), `${f.id}: ${rid} ends at the merge`).toBeLessThan(1);
        }
      }
    });

    it('keeps unrelated roads two reaches apart away from their joins, so a wall stands between them', () => {
      for (const a of world.roads) {
        for (const b of world.roads) {
          if (a === b) continue;
          for (const p of centrelineSamples(world, a.def.id)) {
            if (p.alongM < JOIN_M || p.alongM > a.line.lengthM - JOIN_M) continue;
            const near = b.line.nearest(p.xM, p.zM, REACH_GAP_M);
            expect(near, `${a.def.id} at ${p.alongM.toFixed(0)} m is only ${near?.distM.toFixed(1)} m from ${b.def.id}`).toBeUndefined();
          }
        }
      }
    });

    it('puts the start, the finish and the 3 samples on a road, and no sample inside a barrier', () => {
      expect(world.onRoadAt(def.start.xM, def.start.zM)).toBeDefined();
      expect(world.onRoadAt(def.finish.xM, def.finish.zM)).toBeDefined();
      expect(def.samples).toHaveLength(3);
      for (const s of def.samples) {
        expect(world.onRoadAt(s.xM, s.zM), `${s.id} on a road`).toBeDefined();
        for (const b of def.barriers) {
          expect(Math.hypot(s.xM - b.xM, s.zM - b.zM), `${s.id} clear of ${b.id}`).toBeGreaterThan(Math.max(b.lengthM, b.widthM));
        }
      }
    });

    it('puts every checkpoint where a respawn always works: dry, grippy, gentle, and out of every magnet reach', () => {
      expect(def.checkpoints.length).toBeGreaterThanOrEqual(2);
      for (const c of def.checkpoints) {
        expect(world.onRoadAt(c.xM, c.zM), `${c.id} on a road`).toBeDefined();
        expect(world.waterDepthM(c.xM, c.zM), `${c.id} out of the water`).toBe(0);
        expect(['asphalt', 'sand'], `${c.id} surface`).toContain(world.surfaceIdAt(c.xM, c.zM));
        expect(Math.abs(world.slopeRad(c.xM, c.zM, (c.headingDeg * Math.PI) / 180)), `${c.id} slope`).toBeLessThan((6 * Math.PI) / 180);
        for (const p of def.pylons) expect(Math.hypot(p.xM - c.xM, p.zM - c.zM), `${c.id} clear of ${p.id}`).toBeGreaterThan(MAGNET_CUTOFF_M + 1);
      }
    });

    it(`the starting build finishes with all 3 samples in ${starRunMinS} to ${starRunMaxS} s (A7), and beats the par time`, () => {
      // A level with a Scavenger: the third star is to beat it, and the starting build's best drive must manage that.
      const scavenger = createScavengerRun(content, def);
      const r = runPilot({ content, def, plan: plans.stars, ...(scavenger ? { scavenger } : {}) });
      expect(r.finished).toBe(true);
      expect(r.samples.sort()).toEqual(def.samples.map((s) => s.id).sort());
      expect(r.timeS).toBeGreaterThan(starRunMinS); // 60 s was 75 s before the stops were removed (R1); the Showcase levels were 90–150 s (SHOWCASE_PLAN §5)
      expect(r.timeS).toBeLessThan(starRunMaxS);
      expect(r.starFlags).toEqual([true, true, starRunBeatsScavenger]);
      // The par time follows the A10 rule for this scripted drive: × 1.15, up to the next 5 s (provisional until I1 plays the levels).
      const { factor, roundUpToS } = levelsConfig.par;
      expect(def.parS).toBeGreaterThanOrEqual(r.timeS * factor);
      expect(def.parS).toBeLessThan(r.timeS * factor + roundUpToS);
    });

    it('holding W along the middle of the road misses at least one star', () => {
      // The third star is beating the Scavenger (a level with none keeps the par time), so the simple drive races it.
      const rival = createScavengerRun(content, def);
      const r = runPilot({ content, def, plan: naivePlan(def), maxS: 300, ...(rival ? { scavenger: rival } : {}) });
      if (holdWMissesAStar) expect(r.stars).toBeLessThan(3);
      else expect(r.stars).toBe(3);
    });

    it('no build is trapped: all 27 finish the safe route', () => {
      for (const build of allBuilds(content)) {
        const r = runPilot({ content, def, build, plan: plans.safe });
        expect(r.finished, `${build.chassisId} ${build.wheelsId} ${build.motorId}: ${JSON.stringify(r.respawns)}`).toBe(true);
      }
    });

    it('puts every ramp on a road, and keeps every cave roof above the highest jump of all 27 builds (E45, R6)', () => {
      for (const r of def.ramps) expect(world.roadAt(r.xM, r.zM), `${r.id} on a road`).toBeDefined();
      const roofed = def.gravityZones.some((z) => z.ceilingM !== undefined);
      if (!roofed) return;
      let flights = 0;
      for (const build of allBuilds(content)) {
        for (const plan of [plans.stars, plans.safe]) {
          const r = runPilot({ content, def, build, plan, maxS: 200 });
          const events = r.session.events;
          events.forEach((e, i) => {
            if (e.kind !== 'landing') return;
            const lift = [...events.slice(0, i)].reverse().find((x) => x.kind === 'takeoff')!;
            const roofM = world.ceilingAt(lift.xM, lift.zM);
            flights += 1;
            if (roofM !== undefined) {
              expect(e.apexM!, `${build.chassisId} ${build.wheelsId} ${build.motorId}: a jump from ${lift.xM.toFixed(0)}, ${lift.zM.toFixed(0)} under a roof of ${roofM} m above the lip`).toBeLessThan(roofM);
            }
          });
        }
      }
      expect(flights).toBeGreaterThan(0);
    });

    it('a respawn at any checkpoint works: from each one, the extreme builds can finish', () => {
      for (const c of def.checkpoints) {
        const from = startingAt(def, c.id);
        for (const build of representativeBuilds()) {
          const r = runPilot({ content, def: from, build, plan: plans.safe });
          expect(r.finished, `${c.id}: ${build.chassisId} ${build.wheelsId} ${build.motorId}`).toBe(true);
        }
      }
    });

    it(`has a checkpoint at least every ${checkpointGapS} s of a good drive`, () => {
      const r = runPilot({ content, def, plan: plans.safe });
      const times = [0, ...r.session.events.filter((e) => e.kind === 'checkpoint').map((e) => e.timeS), r.timeS];
      for (let i = 1; i < times.length; i++) expect(times[i]! - times[i - 1]!, `gap ${i}`).toBeLessThan(checkpointGapS);
    });
  });
}
