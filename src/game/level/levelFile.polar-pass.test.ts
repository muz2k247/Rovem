import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { levelsConfig } from '../../content/levelsConfig.ts';
import { STARTING_BUILD, physicsConstants, roverFromParts, type BuildSelection } from '../buildFromParts.ts';
import { checkLevelFile, loadLevel, startingAt } from './levelChecks.ts';
import { createLevelSession } from './session.ts';
import { allBuilds, roadPoint, runPilot, type PilotPlan } from './testPilot.ts';
import type { LevelDef } from './types.ts';

checkLevelFile('polar-pass');

describe('polar-pass', () => {
  const { def, world, plans } = loadLevel('polar-pass');
  const magnet = levelsConfig.magnet;
  const alongOf = (roadId: string, x: number, z: number) => world.roadById(roadId).line.nearest(x, z)?.alongM ?? -1;
  /** The pole to carry through the pass: unlike the pylons to be pulled into the gap, then like them to be pushed out. */
  const passPoles: PilotPlan['poles'] = [{ roadId: 'pass', fromM: 0, pole: 'N' }, { roadId: 'pass', fromM: 21, pole: 'S' }];

  it('uses the A10 magnets: 1600 N, full within 5 m, 25 m reach, 3 s on and 2 s off, the rover starts as S', () => {
    expect(magnet).toMatchObject({ maxForceN: 1600, fullWithinM: 5, cutoffM: 25, cycleOnS: 3, cycleOffS: 2, startPole: 'S' });
    const switching = def.pylons.filter((p) => p.switching);
    expect(switching.map((p) => p.id)).toEqual(['pyl-gate-a', 'pyl-gate-b']);
    const session = createLevelSession({ content, def, rover: roverFromParts(content, STARTING_BUILD), constants: physicsConstants(content), drive: () => ({ throttleHeld: false, brakeHeld: false, steer: 0 }) });
    expect(session.hud.badges.pole).toBe('S');
  });

  it('has the pylons of A7 in order: a pull beside the road, the pass, the mud side, the gate, the far bank, two slingshots, the crater', () => {
    expect(def.pylons.map((p) => p.id)).toEqual([
      'pyl-feel', 'pyl-pass-a', 'pyl-pass-b', 'pyl-mud', 'pyl-gate-a', 'pyl-gate-b', 'pyl-bank', 'pyl-sling-1', 'pyl-sling-2', 'pyl-kick',
    ]);
    expect(def.forks.map((f) => f.roadIds)).toEqual([['channel', 'bridge'], ['crater', 'ramp']]);
  });

  it('the pass: held at the red light, the throttle alone cannot get through between two repelling pylons; the rover rolls back', () => {
    const r = runPilot({
      content, def: startingAt(def, 'cp-1'), plan: { roads: ['start', 'p1', 'pass'], throttleOnly: true }, maxS: 45,
      until: (s) => alongOf('pass', s.state.positionXM, s.state.positionZM) > 30 && s.world.roadAt(s.state.positionXM, s.state.positionZM)?.road.def.id === 'pass',
    });
    const passed = alongOf('pass', r.session.state.positionXM, r.session.state.positionZM) > 30 && r.session.world.roadAt(r.session.state.positionXM, r.session.state.positionZM)?.road.def.id === 'pass';
    expect(passed).toBe(false);
    expect(r.session.events.some((e) => e.kind === 'rollback') || r.session.state.speedMps < 1).toBe(true);
  });

  it('the pass: flip to the unlike pole to be pulled in, and back after the pylons to be pushed out; every one of the 27 builds gets through', () => {
    for (const build of allBuilds(content)) {
      const r = runPilot({
        content, def: startingAt(def, 'cp-1'), build, plan: { roads: ['start', 'p1', 'pass', 'ice'], poles: passPoles }, maxS: 60,
        until: (s) => s.world.roadAt(s.state.positionXM, s.state.positionZM)?.road.def.id === 'ice' && alongOf('ice', s.state.positionXM, s.state.positionZM) > 10,
      });
      const on = r.session.world.roadAt(r.session.state.positionXM, r.session.state.positionZM)?.road.def.id;
      expect(on, `${build.chassisId} ${build.wheelsId} ${build.motorId}`).toBe('ice');
    }
  });

  it('the mud side: on the ice shelf the attracting pylon pulls the rover into the mud unless the pole is flipped', () => {
    const run = (poles: PilotPlan['poles']) => {
      let steps = 0;
      const r = runPilot({
        content, def: startingAt(def, 'cp-2'), plan: { roads: ['ice', 'gate'], poles, maxSpeedMps: 14 }, maxS: 40,
        until: (s) => {
          if (s.world.surfaceIdAt(s.pose.centreXM, s.pose.centreZM) === 'mud') steps += 1;
          return s.phase === 'held' || s.world.roadAt(s.state.positionXM, s.state.positionZM)?.road.def.id === 'gate';
        },
      });
      return { steps, r };
    };
    expect(run(undefined).steps).toBeGreaterThan(60);
    expect(run([{ roadId: 'ice', fromM: 0, pole: 'N' }]).steps).toBe(0);
  });

  it('the gate: with its coils on it holds the rover back; when they switch off the rover drives through, holding W the whole time', () => {
    const r = runPilot({
      content, def: startingAt(def, 'cp-3'), plan: { roads: ['ice', 'gate', 'lead-1'], throttleOnly: true }, maxS: 40,
      until: (s) => s.world.roadAt(s.state.positionXM, s.state.positionZM)?.road.def.id === 'lead-1',
    });
    expect(r.session.world.roadAt(r.session.state.positionXM, r.session.state.positionZM)?.road.def.id).toBe('lead-1');
    // It had to wait: the 3 s of current are in the way of a rover that starts the gate from a red light.
    const light = r.session.events.find((e) => e.kind === 'stopLine')!;
    const through = r.session.events.find((e) => e.kind === 'magnet' && e.timeS > light.timeS);
    expect(through).toBeDefined();
  });

  it('a slingshot: approach on attract, flip to repel as you pass, and leave about 3.5 m/s faster', () => {
    const exitSpeed = (flip: boolean) => {
      const p0 = roadPoint(world, 'sling', 30, 0);
      const session = createLevelSession({
        content, rover: roverFromParts(content, STARTING_BUILD), constants: physicsConstants(content),
        def: { ...def, start: { xM: p0.xM, zM: p0.zM, headingDeg: (p0.headingRad * 180) / Math.PI }, checkpoints: [], stopLines: [], forks: [], hints: [] },
        drive: () => ({ throttleHeld: false, brakeHeld: false, steer: 0 }), initialState: { speedMps: 11 },
      });
      let flipped = false;
      for (let i = 0; i < 120 * 6; i++) {
        session.stepOnce();
        const along = alongOf('sling', session.pose.centreXM, session.pose.centreZM);
        if (flip && !flipped && along > 71) {
          session.flipPole();
          flipped = true;
        }
        if (along > 110) break;
      }
      return session.state.speedMps;
    };
    expect(exitSpeed(true) - exitSpeed(false)).toBeGreaterThan(2.5);
    expect(exitSpeed(true) - exitSpeed(false)).toBeLessThan(4.5);
  });

  it('the far bank of the channel: a pylon there pulls a floating Light build across, if its pole is flipped to attract; without it the build floats to a stop', () => {
    const light: BuildSelection = { chassisId: 'chassis-light', wheelsId: 'wheels-all-terrain', motorId: 'motor-medium' };
    const crosses = (speedMps: number, pylons: LevelDef['pylons'], pole: 'S' | 'N') => {
      const p0 = roadPoint(world, 'channel', 66, 0);
      const session = createLevelSession({
        content, rover: roverFromParts(content, light), constants: physicsConstants(content),
        def: { ...def, pylons, start: { xM: p0.xM + Math.cos(p0.headingRad), zM: p0.zM + Math.sin(p0.headingRad), headingDeg: (p0.headingRad * 180) / Math.PI }, checkpoints: [], stopLines: [], forks: [], hints: [] },
        drive: () => ({ throttleHeld: false, brakeHeld: false, steer: 0 }), initialState: { speedMps },
      });
      if (session.pole !== pole) session.flipPole();
      for (let i = 0; i < 120 * 40; i++) {
        session.stepOnce();
        if (session.events.some((e) => e.kind === 'respawn')) return false;
        if (alongOf('channel', session.pose.centreXM, session.pose.centreZM) > 82) return true;
      }
      return false;
    };
    const bank = def.pylons.filter((p) => p.id === 'pyl-bank');
    expect(crosses(5, bank, 'S')).toBe(true);
    expect(crosses(5, [], 'S')).toBe(false);
    expect(crosses(5, bank, 'N')).toBe(false);
  });

  it('the crater: a repelling pylon behind the red light kicks every build up the steep wall; without it eight builds would roll back', () => {
    const climbs = (pylons: LevelDef['pylons']) =>
      allBuilds(content).filter((build) => {
        const r = runPilot({
          content, def: { ...startingAt(def, 'cp-6'), pylons }, build, plan: { roads: ['lead-2', 'crater'], poles: [{ roadId: 'lead-2', fromM: 0, pole: 'S' }] }, maxS: 80,
          until: (s) => s.events.some((e) => e.kind === 'fork' || e.kind === 'respawn'),
        });
        return r.session.events.some((e) => e.kind === 'fork');
      }).length;
    expect(climbs(def.pylons)).toBe(27);
    expect(climbs([])).toBeLessThan(24);
  });

  it('holding W the whole way fails: the pass stops it, so the naive drive never finishes', () => {
    expect(plans.stars.poles?.some((p) => p.roadId === 'pass')).toBe(true);
    const r = runPilot({ content, def, plan: { roads: def.route, throttleOnly: true }, maxS: 120 });
    expect(r.finished).toBe(false);
  });
});
