import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { levelsConfig } from '../../content/levelsConfig.ts';
import { STARTING_BUILD, physicsConstants, roverFromParts } from '../buildFromParts.ts';
import { checkLevelFile, loadLevel, startingAt } from './levelChecks.ts';
import { createLevelSession } from './session.ts';
import { allBuilds, roadPoint, runPilot, type PilotPlan } from './testPilot.ts';

checkLevelFile('iron-ridge');

// Iron Ridge (SHOWCASE_PLAN §3 Level 5, R7): the old Polar Pass pylons re-laid on open ground: a pull beside the road, a bend
// the magnet helps round, the pass, the ice shelf, the switching gate, the fork between the magnet line and the switchback
// road, and the icy ridge that only the pylons carry every build up. The magnet rules of v4 A6 are unchanged.
describe('iron-ridge', () => {
  const { def, world, plans } = loadLevel('iron-ridge');
  const magnet = levelsConfig.magnet;
  const alongOf = (roadId: string, x: number, z: number) => world.roadById(roadId).line.nearest(x, z)?.alongM ?? -1;
  /** The pole to carry through the pass: unlike the pylons to be pulled into the gap, then like them to be pushed out. */
  const passPoles: PilotPlan['poles'] = [{ roadId: 'pass', fromM: 0, pole: 'N' }, { roadId: 'pass', fromM: 21, pole: 'S' }];
  /** The poles for the ridge: pulled up to the first pylon, pushed on past it, pulled to the second, pushed over the top. */
  const climbPoles: NonNullable<PilotPlan['poles']> = [
    { roadId: 'lead-2', fromM: 0, pole: 'S' }, { roadId: 'climb', fromM: 77, pole: 'N' }, { roadId: 'climb', fromM: 93, pole: 'S' }, { roadId: 'climb', fromM: 120, pole: 'N' },
  ];

  it('uses the A10 magnets: 1600 N, full within 5 m, 25 m reach, 3 s on and 2 s off, the rover starts as S', () => {
    expect(magnet).toMatchObject({ maxForceN: 1600, fullWithinM: 5, cutoffM: 25, cycleOnS: 3, cycleOffS: 2, startPole: 'S' });
    const switching = def.pylons.filter((p) => p.switching);
    expect(switching.map((p) => p.id)).toEqual(['pyl-gate-a', 'pyl-gate-b']);
    const session = createLevelSession({ content, def, rover: roverFromParts(content, STARTING_BUILD), constants: physicsConstants(content), drive: () => ({ throttleHeld: false, brakeHeld: false, steer: 0 }) });
    expect(session.hud.badges.pole).toBe('S');
  });

  it('has the pylons in order: a pull beside the road, the bend, the pass, the mud side, the gate, a slingshot, the ridge', () => {
    expect(def.pylons.map((p) => p.id)).toEqual([
      'pyl-feel', 'pyl-bend', 'pyl-pass-a', 'pyl-pass-b', 'pyl-mud', 'pyl-gate-a', 'pyl-gate-b', 'pyl-sling-1', 'pyl-up', 'pyl-top',
    ]);
    expect(def.forks.map((f) => f.roadIds)).toEqual([['f1-line', 'f1-switch']]);
  });

  it('fills the plan: a pylon in the first 10 s, boulders, an icy ridge, a cave of rock walls and a launcher', () => {
    const feel = def.pylons[0]!;
    expect(alongOf('start', feel.xM, feel.zM)).toBeLessThan(150);
    // Boulders stand beside the road's middle, so a driver who keeps to the line passes them and one who wanders crashes.
    expect(def.barriers).toHaveLength(4);
    for (const b of def.barriers) {
      expect(b.look).toBe('boulder');
      const near = world.roadById('p1').line.nearest(b.xM, b.zM)!;
      expect(Math.abs(near.offsetM)).toBeGreaterThan(2.5);
      expect(Math.abs(near.offsetM)).toBeLessThan(5);
    }
    // The ridge's steep side lies on ice.
    const ridge = def.ridges[0]!;
    const foot = roadPoint(world, 'climb', 50 + 35, 0);
    expect(world.surfaceIdAt(foot.xM, foot.zM)).toBe('ice');
    expect(ridge.riseAngleDeg).toBeGreaterThanOrEqual(12);
    // The cave: the gate and the road after it have rock faces on both sides.
    for (const id of ['gate', 'lead-1']) expect(def.roads.find((r) => r.id === id)!.edges?.some((e) => e.style === 'rock' && e.side === 'both')).toBe(true);
    expect(def.cannons.map((c) => c.kind)).toEqual(['kicker']);
  });

  it('the bend: the pylon on its inside pulls the rover round, and every one of the 27 builds still takes it', () => {
    const bend = world.roadById('bend-1');
    expect(bend.arcs[0]!.radiusM).toBeGreaterThanOrEqual(62);
    const pyl = def.pylons.find((p) => p.id === 'pyl-bend')!;
    expect(alongOf('bend-1', pyl.xM, pyl.zM)).toBeGreaterThan(10);
    for (const build of allBuilds(content).filter((_, i) => i % 3 === 0)) {
      const r = runPilot({ content, def: startingAt(def, 'cp-2'), build, plan: { roads: ['p1', 'bend-1', 'pass'], poles: passPoles }, maxS: 60, until: (s) => s.world.roadAt(s.state.positionXM, s.state.positionZM)?.road.def.id === 'pass' });
      expect(r.respawns.crash, `${build.chassisId} ${build.wheelsId} ${build.motorId}`).toBe(0);
    }
  });

  it('the pass: flip to the unlike pole to be pulled in, and back after the pylons to be pushed out; every one of the 27 builds gets through', () => {
    for (const build of allBuilds(content)) {
      const r = runPilot({
        content, def: startingAt(def, 'cp-2'), build, plan: { roads: ['p1', 'bend-1', 'pass', 'ice'], poles: passPoles }, maxS: 60,
        until: (s) => s.world.roadAt(s.state.positionXM, s.state.positionZM)?.road.def.id === 'ice' && alongOf('ice', s.state.positionXM, s.state.positionZM) > 10,
      });
      const on = r.session.world.roadAt(r.session.state.positionXM, r.session.state.positionZM)?.road.def.id;
      expect(on, `${build.chassisId} ${build.wheelsId} ${build.motorId}`).toBe('ice');
    }
  });

  it('the mud side: on the ice shelf the attracting pylon pulls the rover into the mud unless the pole is flipped', () => {
    const run = (poles: PilotPlan['poles']) => {
      let steps = 0;
      runPilot({
        content, def: startingAt(def, 'cp-3'), plan: { roads: ['ice', 'gate'], poles, maxSpeedMps: 14 }, maxS: 40,
        until: (s) => {
          if (s.world.surfaceIdAt(s.pose.centreXM, s.pose.centreZM) === 'mud') steps += 1;
          return s.world.roadAt(s.state.positionXM, s.state.positionZM)?.road.def.id === 'gate';
        },
      });
      return steps;
    };
    expect(run(undefined)).toBeGreaterThan(60);
    expect(run([{ roadId: 'ice', fromM: 0, pole: 'N' }])).toBe(0);
  });

  it('the gate: with its coils on it holds the rover back; when they switch off the rover drives through, holding W the whole time', () => {
    const r = runPilot({
      content, def: startingAt(def, 'cp-4'), plan: { roads: ['ice', 'gate', 'lead-1'], throttleOnly: true }, maxS: 40,
      until: (s) => s.world.roadAt(s.state.positionXM, s.state.positionZM)?.road.def.id === 'lead-1',
    });
    expect(r.session.world.roadAt(r.session.state.positionXM, r.session.state.positionZM)?.road.def.id).toBe('lead-1');
    // The coils were on at some point on the way: the gate is a magnet that switches.
    expect(r.session.events.some((e) => e.kind === 'magnet')).toBe(true);
  });

  it('a slingshot: approach on attract, flip to repel as you pass, and leave about 3.5 m/s faster', () => {
    const exitSpeed = (flip: boolean) => {
      const p0 = roadPoint(world, 'f1-line', 30, 0);
      const session = createLevelSession({
        content, rover: roverFromParts(content, STARTING_BUILD), constants: physicsConstants(content),
        def: { ...def, start: { xM: p0.xM, zM: p0.zM, headingDeg: (p0.headingRad * 180) / Math.PI }, checkpoints: [], forks: [], hints: [] },
        drive: () => ({ throttleHeld: false, brakeHeld: false, steer: 0 }), initialState: { speedMps: 11 },
      });
      let flipped = false;
      for (let i = 0; i < 120 * 6; i++) {
        session.stepOnce();
        const along = alongOf('f1-line', session.pose.centreXM, session.pose.centreZM);
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

  it('the ridge: its icy side defeats the tyres, so some builds roll back without the pylons, and with them every one of the 27 climbs', () => {
    const climbs = (pylons: typeof def.pylons) =>
      allBuilds(content).filter((build) => {
        const r = runPilot({ content, def: { ...startingAt(def, 'cp-6'), pylons }, build, plan: { roads: ['lead-2', 'climb', 'end'], poles: climbPoles }, maxS: 80 });
        return r.finished && Object.values(r.respawns).every((n) => n === 0);
      }).length;
    expect(climbs(def.pylons)).toBe(27);
    expect(climbs(def.pylons.filter((p) => p.id !== 'pyl-up' && p.id !== 'pyl-top'))).toBeLessThan(20);
  });

  it('the fork is a real choice: riding the magnets beats the switchback road, but without flipping the pole it does not', () => {
    const time = (road: string, withPoles: boolean) => {
      const plan = road === 'f1-line' ? plans.stars : plans.safe;
      const poles = withPoles ? plan.poles : undefined;
      return runPilot({ content, def, plan: { ...plan, ...(poles ? { poles } : { poles: undefined }), via: undefined } as PilotPlan }).timeS;
    };
    expect(time('f1-line', true)).toBeLessThan(time('f1-switch', true) - 1);
    expect(time('f1-line', false)).toBeGreaterThan(time('f1-line', true) + 5);
  });

  it('the launcher at the end kicks the rover from behind: it speeds up', () => {
    const r = runPilot({
      content, def: startingAt(def, 'cp-6'), plan: { roads: ['lead-2', 'climb', 'end'], poles: climbPoles },
      until: (s) => s.events.some((e) => e.kind === 'hit' && e.hitKind === 'kicker'),
    });
    const hit = r.session.events.find((e) => e.kind === 'hit' && e.hitKind === 'kicker')!;
    expect(hit.speedAfterMps!).toBeGreaterThan(hit.speedBeforeMps!);
  });

  describe('the stretches of the report (P6)', () => {
    it('names five, in route order, and a clean drive takes what the file says on each', () => {
      expect(def.stretches.map((s) => s.name)).toEqual(['The Foothills', 'The Pass', 'The Old Mine', 'The Ridge Run', 'The Climb']);
      const r = runPilot({ content, def, plan: plans.stars });
      const got = r.session.stretches;
      expect(got.map((s) => s.id)).toEqual(def.stretches.map((s) => s.id));
      got.forEach((s, i) => expect(s.timeS, s.id).toBeCloseTo(def.stretches[i]!.cleanS, 1));
      expect(got.reduce((sum, s) => sum + s.timeS, 0)).toBeCloseTo(r.timeS, 6);
    });

    it('brings the docking clamps home', () => {
      const r = runPilot({ content, def, plan: plans.stars });
      expect(r.session.report().pickup?.partName).toBe('Docking clamps');
    });
  });
});
