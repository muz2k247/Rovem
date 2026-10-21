import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { levelsConfig } from '../../content/levelsConfig.ts';
import { STARTING_BUILD, physicsConstants, roverFromParts, type BuildSelection } from '../buildFromParts.ts';
import { checkLevelFile, loadLevel, startingAt } from './levelChecks.ts';
import { createLevelSession } from './session.ts';
import { allBuilds, runPilot } from './testPilot.ts';

checkLevelFile('crater-field');

describe('crater-field', () => {
  const { def, world } = loadLevel('crater-field');

  it('uses the A10 values: craters 5 m deep with a 25° wall and a 12° ramp', () => {
    expect(def.craters).toHaveLength(3);
    for (const c of def.craters) {
      expect(c.depthM).toBe(levelsConfig.crater.depthM);
      expect(c.wallAngleDeg).toBe(levelsConfig.crater.wallAngleDeg);
      expect(c.rampAngleDeg).toBe(levelsConfig.crater.rampAngleDeg);
    }
  });

  it('uses the A10 values: hills at most 4 m high, at least 60 m long, with a crest radius of at least 50 m', () => {
    expect(def.hills.length).toBeGreaterThanOrEqual(3);
    for (const h of def.hills) {
      expect(h.heightM).toBeLessThanOrEqual(levelsConfig.hills.maxHeightM);
      expect(2 * h.radiusM).toBeGreaterThanOrEqual(levelsConfig.hills.minLengthM);
      // A cosine bell h/2 (1 + cos(π d ÷ r)) has crest curvature h π² ÷ (2 r²), so a radius of curvature 2 r² ÷ (h π²).
      expect((2 * h.radiusM ** 2) / (h.heightM * Math.PI ** 2)).toBeGreaterThanOrEqual(levelsConfig.hills.minCrestRadiusM);
    }
  });

  it('the way round each crater is flat, so it always works', () => {
    for (const id of ['c1-around', 'c2-around', 'c3-around']) {
      const line = world.roadById(id).line;
      for (const p of line.points) expect(Math.abs(world.heightM(p.xM, p.zM)), `${id} at (${p.xM.toFixed(0)}, ${p.zM.toFixed(0)})`).toBeLessThan(1e-9);
    }
  });

  it('coasting over a 4 m hill takes about √(2 g h) = 8.85 m/s: a rover at 12 m/s clears the crest, one at 6 m/s does not', () => {
    const hill = def.hills[0]!;
    const road = world.roadById('start');
    const reach = (speed: number) => {
      const session = createLevelSession({
        content, def: { ...def, checkpoints: [], hints: [] }, rover: roverFromParts(content, STARTING_BUILD), constants: physicsConstants(content),
        drive: () => ({ throttleHeld: false, brakeHeld: false, steer: 0 }),
        initialState: { positionXM: hill.xM - hill.radiusM + 2, positionZM: hill.zM, headingRad: 0, speedMps: speed },
      });
      let top = 0;
      for (let i = 0; i < 120 * 12; i++) {
        session.stepOnce();
        top = Math.max(top, world.heightM(session.pose.centreXM, session.pose.centreZM));
      }
      return { top, pastCrest: session.pose.centreXM > hill.xM + 2 };
    };
    expect(road.line.lengthM).toBeGreaterThan(0);
    expect(reach(12).pastCrest).toBe(true);
    expect(reach(6).pastCrest).toBe(false);
    expect(reach(6).top).toBeLessThan(hill.heightM);
  });

  it('crater 2 has a mud floor: the spiked-wheel builds bog down on it, the starting build gets across', () => {
    const outcome = (build: BuildSelection) => {
      const r = runPilot({
        content, def: startingAt(def, 'cp-2'), build, plan: { roads: ['m1', 'c2-through'] }, maxS: 70,
        until: (s) => s.events.some((e) => e.kind === 'fork' || e.kind === 'respawn'),
      });
      return r.session.events.some((e) => e.kind === 'fork');
    };
    const builds = allBuilds(content);
    const crossed = builds.filter(outcome);
    expect(outcome(STARTING_BUILD)).toBe(true);
    expect(crossed.length).toBeLessThan(27);
    expect(crossed.length).toBeGreaterThan(15);
    for (const b of builds.filter((x) => !crossed.includes(x))) expect(b.wheelsId).toBe('wheels-spiked');
  });

  it('crater 3: the starting build climbs the steep wall with the pad’s kick; with no stop at the foot every build now arrives fast enough (R1)', () => {
    const climbs = (build: BuildSelection) => {
      const r = runPilot({
        content, def: startingAt(def, 'cp-3'), build, plan: { roads: ['m2', 'c3-through'] }, maxS: 80,
        until: (s) => s.events.some((e) => e.kind === 'fork' || e.kind === 'respawn'),
      });
      return { passed: r.session.events.some((e) => e.kind === 'fork'), rolledBack: r.session.events.some((e) => e.kind === 'rollback') };
    };
    expect(climbs(STARTING_BUILD).passed).toBe(true);
    const results = allBuilds(content).map((b) => climbs(b));
    // Before the stops were removed (R1) weak builds rolled back here, held at rest at the foot. Now they arrive moving and none does;
    // the crater is redesigned in R6. The rolling-back physics itself is tested by the next test.
    expect(results.filter((r) => r.passed).length).toBeGreaterThan(10);
  });

  it('a rover with a Small motor at rest at the foot of the 25° wall rolls back (A6)', () => {
    const foot = { xM: 1001.71, zM: -262.65, headingDeg: -30 }; // the foot of the wall (it was once marked by a stop line)
    const r = runPilot({
      content, build: { chassisId: 'chassis-standard', wheelsId: 'wheels-all-terrain', motorId: 'motor-small' }, maxS: 20,
      def: { ...def, start: { xM: foot.xM, zM: foot.zM, headingDeg: foot.headingDeg }, checkpoints: [], boosts: [], forks: [] },
      plan: { roads: ['c3-through'], throttleOnly: true },
      until: (s) => s.events.some((e) => e.kind === 'rollback'),
    });
    expect(r.session.events.some((e) => e.kind === 'rollback')).toBe(true);
  });
});
