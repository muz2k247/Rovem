import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { checkLevelFile, loadLevel, startingAt } from './levelChecks.ts';
import { allBuilds, runPilot } from './testPilot.ts';

checkLevelFile('first-tracks');

describe('first-tracks', () => {
  const { def, world } = loadLevel('first-tracks');

  it('has the three forks of A7: sand, ice, mud', () => {
    expect(def.forks.map((f) => f.roadIds.map((r) => world.roadById(r).surfaceId))).toEqual([['asphalt', 'sand'], ['asphalt', 'ice'], ['asphalt', 'mud']]);
  });

  it('teaches the controls on the move: hold W, the coast, steering, braking', () => {
    expect(def.hints.map((h) => h.textId)).toEqual(['hold-w', 'coast', 'steer', 'brake']);
  });

  it('the first fork matters: some builds are faster on the sand and some on the asphalt', () => {
    const times = (road: string) =>
      allBuilds(content).map((build) => {
        const r = runPilot({
          content, def: startingAt(def, 'cp-1'), build, plan: { roads: ['chicane', road, 'm1'] },
          until: (s) => s.events.some((e) => e.kind === 'fork'),
        });
        return r.session.events.find((e) => e.kind === 'fork')!.yourS!;
      });
    const sand = times('f1-sand');
    const asphalt = times('f1-asphalt');
    const sandFaster = sand.filter((t, i) => t < asphalt[i]!).length;
    expect(sandFaster).toBeGreaterThan(0);
    expect(sandFaster).toBeLessThan(27);
  });

  it('the mud still bogs down some builds (most, before the stops were removed in R1)', () => {
    const passed = allBuilds(content).filter((build) => {
      const r = runPilot({
        content, def: startingAt(def, 'cp-3'), build, maxS: 60,
        plan: { roads: ['m2', 'f3-mud'] },
        until: (s) => s.events.some((e) => e.kind === 'fork' || e.kind === 'respawn'),
      });
      return r.session.events.some((e) => e.kind === 'fork' && e.yourRoad === 'f3-mud');
    });
    expect(passed.length).toBeGreaterThan(0);
    expect(passed.length).toBeLessThan(27);
    // Before R1 only smooth wheels, the large motor or the light chassis got through; entering at speed lets more builds across.
  });

  it('the ice bend is a trap at full speed: holding W on the ice road crashes', () => {
    const r = runPilot({
      content, def: startingAt(def, 'cp-2'), maxS: 100,
      plan: { roads: ['m1', 'f2-ice'], throttleOnly: true },
      until: (s) => s.events.some((e) => e.kind === 'respawn'),
    });
    expect(r.respawns.crash).toBeGreaterThan(0);
  });
});
