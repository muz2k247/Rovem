import { describe, expect, it, vi } from 'vitest';
import { content } from '../../content/index.ts';
import { levelsConfig } from '../../content/levelsConfig.ts';
import { loadLevelDef } from './levels.ts';
import { levelPlans, naivePlan } from './levelPlans.ts';
import { allBuilds, representativeBuilds, runPilot } from './testPilot.ts';
import type { LevelDef, LevelId } from './types.ts';
import { createLevelWorld, type LevelWorld } from './world.ts';

// The checks every level file must pass (LEVELS_BUILD_PLAN A7, A10; B4). One test file per level calls `checkLevelFile`,
// so the seven levels run side by side. Test-only: nothing in the game imports this.

vi.setConfig({ testTimeout: 240_000 });

const MAGNET_CUTOFF_M = levelsConfig.magnet.cutoffM;
/** Two roads are kept this far apart (two reaches of 9 m and a little more) except near their joins. */
const REACH_GAP_M = 20;
const JOIN_M = 60;

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

export function checkLevelFile(id: LevelId): void {
  const { def, world, plans } = loadLevel(id);

  describe(`level file ${id}`, () => {
    it('is marked placeholder and has a par time', () => {
      expect(def.placeholder).toBe(true);
      expect(def.parS).toBeGreaterThan(0);
    });

    it('has at least two forks, each leaving its stop line and meeting again at the merge point (A7)', () => {
      expect(def.forks.length).toBeGreaterThanOrEqual(2);
      for (const f of def.forks) {
        const line = def.stopLines.find((l) => l.id === f.stopLineId)!;
        for (const rid of f.roadIds) {
          const first = world.roadById(rid).line.points[0]!;
          expect(Math.hypot(first.xM - line.xM, first.zM - line.zM), `${f.id}: ${rid} starts at the stop line`).toBeLessThan(1);
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

    it('the starting build finishes with all 3 samples in 75 to 150 s (A7), and beats the par time', () => {
      const r = runPilot({ content, def, plan: plans.stars });
      expect(r.finished).toBe(true);
      expect(r.samples.sort()).toEqual(def.samples.map((s) => s.id).sort());
      expect(r.timeS).toBeGreaterThan(75);
      expect(r.timeS).toBeLessThan(150);
      expect(r.starFlags).toEqual([true, true, true]);
    });

    it('holding W along the middle of the road misses at least one star', () => {
      const r = runPilot({ content, def, plan: naivePlan(def), maxS: 300 });
      expect(r.stars).toBeLessThan(3);
    });

    it('no build is trapped: all 27 finish the safe route', () => {
      for (const build of allBuilds(content)) {
        const r = runPilot({ content, def, build, plan: plans.safe });
        expect(r.finished, `${build.chassisId} ${build.wheelsId} ${build.motorId}: ${JSON.stringify(r.respawns)}`).toBe(true);
      }
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

    it('has a checkpoint about every 30 s of a good drive', () => {
      const r = runPilot({ content, def, plan: plans.safe });
      const times = [0, ...r.session.events.filter((e) => e.kind === 'checkpoint').map((e) => e.timeS), r.timeS];
      for (let i = 1; i < times.length; i++) expect(times[i]! - times[i - 1]!, `gap ${i}`).toBeLessThan(55);
    });
  });
}
