import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { loadLevel } from './levelChecks.ts';
import { runPilot } from './autopilot.ts';
import { createScavengerRun } from './scavenger.ts';
import { validateLevelDef } from './schema.ts';
import { SURFACE_IDS, testLevelRaw } from './testLevel.ts';

// The Scavengers of The Crossing and Iron Ridge (R7; SHOWCASE_PLAN §8): each finishes 4 to 8% after the starting rover's clean best,
// and the one on Iron Ridge flips its magnet pole the way a good student does (`scavenger.poles`).

describe.each([
  ['the-crossing', 'f1-bridge'],
  ['iron-ridge', 'f1-switch'],
] as const)('the Scavenger of %s', (id, road) => {
  const { def, plans } = loadLevel(id);
  const ghost = createScavengerRun(content, def)!;
  const cleanBest = runPilot({ content, def, plan: plans.stars }).timeS;

  it('finishes 4 to 8% slower than the starting rover’s clean best, counting its start delay', () => {
    expect(ghost.finishAtS).toBeGreaterThanOrEqual(cleanBest * 1.04);
    expect(ghost.finishAtS).toBeLessThanOrEqual(cleanBest * 1.08);
  });

  it('takes the other road from the starting rover’s star run, and is an honest drive with no respawn', () => {
    expect(def.scavenger!.roads).toContain(road);
    const r = runPilot({ content, def, build: def.scavenger!.build, plan: { roads: def.scavenger!.roads, ...(def.scavenger!.poles ? { poles: def.scavenger!.poles } : {}) } });
    expect(r.finished).toBe(true);
    expect(r.respawns).toEqual({ crash: 0, stuck: 0, floated: 0, fell: 0, manual: 0 });
    expect(ghost.finishS).toBe(r.timeS);
  });
});

describe('scavenger.poles in level data', () => {
  it('is validated: a pole is N or S and the road must exist', () => {
    const raw = testLevelRaw();
    const scavenger = { build: { chassisId: 'chassis-standard', wheelsId: 'wheels-all-terrain', motorId: 'motor-medium' }, roads: ['start'], startDelayS: 0 };
    const roadId = (raw as { roads: { id: string }[] }).roads[0]!.id;
    const ok = validateLevelDef({ ...raw, scavenger: { ...scavenger, roads: [roadId], poles: [{ roadId, fromM: 10, pole: 'N' }] } }, SURFACE_IDS);
    expect(ok.scavenger?.poles).toEqual([{ roadId, fromM: 10, pole: 'N' }]);
    expect(() => validateLevelDef({ ...raw, scavenger: { ...scavenger, roads: [roadId], poles: [{ roadId, fromM: 10, pole: 'X' }] } }, SURFACE_IDS)).toThrow(/pole/);
    expect(() => validateLevelDef({ ...raw, scavenger: { ...scavenger, roads: [roadId], poles: [{ roadId: 'nowhere', fromM: 10, pole: 'N' }] } }, SURFACE_IDS)).toThrow(/unknown road/);
  });

  it('makes the ghost on Iron Ridge faster than the same ghost that never flips', () => {
    const { def } = loadLevel('iron-ridge');
    const without = runPilot({ content, def, build: def.scavenger!.build, plan: { roads: def.scavenger!.roads }, maxS: 300 });
    const ghost = createScavengerRun(content, def)!;
    expect(without.finished && !Object.values(without.respawns).some((n) => n) ? without.timeS : Infinity).toBeGreaterThan(ghost.finishS);
  });
});
