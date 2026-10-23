import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { levelsConfig } from '../../content/levelsConfig.ts';
import { STARTING_BUILD, physicsConstants, roverFromParts, type BuildSelection } from '../buildFromParts.ts';
import { checkLevelFile, loadLevel, startingAt } from './levelChecks.ts';
import { createLevelSession } from './session.ts';
import { allBuilds, roadPoint, runPilot } from './testPilot.ts';

checkLevelFile('the-crossing');

// The Crossing (SHOWCASE_PLAN §3 Level 4, R7): the lakebed, a shallow ford, a vent before the river, the fork between the deep
// ford and the long bridge, a mud bank on the far side, and the slope out. The water rules of v4 A6 are unchanged.
describe('the-crossing', () => {
  const { def, world, plans } = loadLevel('the-crossing');
  const cfg = levelsConfig.water;
  const light = allBuilds(content).filter((b) => b.chassisId === 'chassis-light');
  const mass = (b: BuildSelection) => roverFromParts(content, b).massKg;
  const lightRover: BuildSelection = { chassisId: 'chassis-light', wheelsId: 'wheels-all-terrain', motorId: 'motor-medium' };
  const heavyRover: BuildSelection = { chassisId: 'chassis-heavy', wheelsId: 'wheels-all-terrain', motorId: 'motor-medium' };
  const centreOf = (polygon: { xM: number; zM: number }[]) => polygon.reduce((a, p) => ({ xM: a.xM + p.xM / 4, zM: a.zM + p.zM / 4 }), { xM: 0, zM: 0 });
  const sidesOf = (polygon: { xM: number; zM: number }[]) => [0, 1, 2, 3].map((i) => Math.hypot(polygon[i]!.xM - polygon[(i + 1) % 4]!.xM, polygon[i]!.zM - polygon[(i + 1) % 4]!.zM));

  /** A session on the deep ford road, `alongM` down it and heading along it, at this speed. */
  const onDeepFord = (build: BuildSelection, alongM: number, speedMps: number, throttleHeld = false) => {
    const p0 = roadPoint(world, 'f1-deep', alongM, 0);
    return createLevelSession({
      content, rover: roverFromParts(content, build), constants: physicsConstants(content),
      def: { ...def, start: { xM: p0.xM, zM: p0.zM, headingDeg: (p0.headingRad * 180) / Math.PI }, checkpoints: [], forks: [], hints: [] },
      drive: () => ({ throttleHeld, brakeHeld: false, steer: 0 }),
      initialState: { speedMps },
    });
  };
  const deepAlong = (s: ReturnType<typeof onDeepFord>) => world.roadById('f1-deep').line.nearest(s.pose.centreXM, s.pose.centreZM)?.alongM ?? 0;
  /** Does a rover that enters the deep ford at this speed with the engine off get out the far side without floating to a stop? */
  const crossesAt = (build: BuildSelection, speedMps: number, fireBooster = false): boolean => {
    const session = onDeepFord(build, 66, speedMps);
    if (fireBooster) session.fireBooster();
    for (let i = 0; i < 120 * 12; i++) {
      session.stepOnce();
      if (session.events.some((e) => e.kind === 'respawn')) return false;
      if (deepAlong(session) > 81) return true;
    }
    return false;
  };

  it('uses the A10 depths and widths: a shallow ford of 0.3 m and a deep channel of 1.0 m that is 10 m wide', () => {
    expect(def.water.map((w) => w.depthM).sort()).toEqual([0.3, 1]);
    for (const w of def.water) expect(cfg.depthsM).toContain(w.depthM);
    // The channel is a rectangle across the road: its short side is the width.
    expect(Math.min(...sidesOf(def.water.find((w) => w.depthM === 1.0)!.polygon))).toBeCloseTo(cfg.channelWidthM, 1);
  });

  it('puts the shallow ford on the way for everyone and the deep channel on the deep ford road only', () => {
    const ford = centreOf(def.water.find((w) => w.depthM === 0.3)!.polygon);
    expect(world.onRoadAt(ford.xM, ford.zM)?.road.def.id).toBe('ford');
    const deep = centreOf(def.water.find((w) => w.depthM === 1.0)!.polygon);
    expect(world.onRoadAt(deep.xM, deep.zM)?.road.def.id).toBe('f1-deep');
  });

  it('gives the deep ford a bridge: a long way round (30 to 40 m more) that stays dry, with bends of at least 62 m', () => {
    const deep = world.roadById('f1-deep').line.lengthM;
    const bridge = world.roadById('f1-bridge');
    expect(bridge.line.lengthM).toBeGreaterThan(deep + 20);
    expect(bridge.line.lengthM).toBeLessThan(deep + 60);
    for (const p of bridge.line.points) expect(world.waterDepthM(p.xM, p.zM), 'bridge').toBe(0);
    for (const arc of bridge.arcs) expect(arc.radiusM).toBeGreaterThanOrEqual(62);
  });

  it('puts a vent before the river, a mud bank on each side of the water (none longer than 12 m), and a slope out', () => {
    expect(def.boosts.some((b) => world.onRoadAt(b.xM, b.zM)?.road.def.id === 'run-in')).toBe(true);
    const mud = def.surfaceZones.filter((z) => z.surfaceId === 'mud');
    expect(mud.map((z) => world.onRoadAt(centreOf(z.polygon).xM, centreOf(z.polygon).zM)?.road.def.id)).toEqual(['ford', 'bank']);
    // Along the road the patch is the shorter side of its rectangle.
    for (const z of mud) expect(Math.min(...sidesOf(z.polygon))).toBeLessThanOrEqual(12);
    expect(def.ridges).toHaveLength(1);
    expect(world.onRoadAt(def.ridges[0]!.xM, def.ridges[0]!.zM)?.road.def.id).toBe('slope');
  });

  it('every Light build floats in a deep channel (A6: 755 to 960 kg/m³); the starting build and heavier ones sink', () => {
    for (const b of light) expect(mass(b) / cfg.roverVolumeM3).toBeLessThan(cfg.densityKgPerM3);
    expect(mass(STARTING_BUILD) / cfg.roverVolumeM3).toBeGreaterThan(cfg.densityKgPerM3);
    const floated = (build: BuildSelection) => {
      const r = runPilot({ content, def: startingAt(def, 'cp-2'), build, plan: { roads: ['run-in', 'f1-deep'] }, maxS: 80, until: (s) => s.events.some((e) => e.kind === 'fork') });
      return r.session.events.some((e) => e.kind === 'float');
    };
    expect(floated(lightRover)).toBe(true);
    expect(floated(STARTING_BUILD)).toBe(false);
  });

  it('a Light build entering the deep channel fast enough coasts out the far side: from 9 m/s for the heavier ones, a little more for the lightest', () => {
    // m v₀ ÷ b = 10 m is the coasting distance: 169 kg needs 8.9 m/s on paper, a little more once the front end and the 0.2 m/s stop are counted.
    const needed = light.map((b) => {
      let v = 0;
      while (!crossesAt(b, v) && v < 15) v += 0.25;
      return { b, v };
    });
    for (const { v } of needed) expect(v).toBeLessThan(11);
    expect(needed.filter((n) => n.v <= 9).length).toBeGreaterThan(0);
    expect(crossesAt({ chassisId: 'chassis-light', wheelsId: 'wheels-spiked', motorId: 'motor-large' }, 9)).toBe(true);
    expect(crossesAt({ chassisId: 'chassis-light', wheelsId: 'wheels-smooth', motorId: 'motor-small' }, 9)).toBe(false);
    expect(crossesAt({ chassisId: 'chassis-light', wheelsId: 'wheels-smooth', motorId: 'motor-small' }, 11)).toBe(true);
  });

  it('from the checkpoint before the river, every one of the 27 builds crosses the deep ford (the run-in and the vent carry the light ones over)', () => {
    for (const build of allBuilds(content)) {
      const r = runPilot({ content, def: startingAt(def, 'cp-2'), build, plan: { roads: ['run-in', 'f1-deep'] }, maxS: 80, until: (s) => s.events.some((e) => e.kind === 'fork' || e.kind === 'respawn') });
      expect(r.session.events.some((e) => e.kind === 'fork'), `${build.chassisId} ${build.wheelsId} ${build.motorId}`).toBe(true);
    }
  });

  it('a Light build that enters slowly floats to a stop and respawns', () => {
    const r = runPilot({
      content, def: { ...startingAt(def, 'cp-2'), boosts: [] }, build: lightRover,
      plan: { roads: ['run-in', 'f1-deep'], maxSpeedMps: 6 }, maxS: 90,
      until: (s) => s.events.some((e) => e.kind === 'fork' || e.kind === 'respawn'),
    });
    expect(r.respawns.floated).toBe(1);
  });

  it('a heavy build sinks and drives the riverbed slowly against the water drag', () => {
    const mid = centreOf(def.water.find((w) => w.depthM === 1.0)!.polygon);
    const session = createLevelSession({
      content, rover: roverFromParts(content, heavyRover), constants: physicsConstants(content),
      def: { ...def, start: { xM: mid.xM, zM: mid.zM, headingDeg: def.checkpoints[1]!.headingDeg }, checkpoints: [], forks: [], hints: [] },
      drive: () => ({ throttleHeld: true, brakeHeld: false, steer: 0 }),
    });
    for (let i = 0; i < 120 * 4; i++) session.stepOnce();
    expect(session.state.speedMps).toBeGreaterThan(0.5);
    expect(session.state.speedMps).toBeLessThan(3);
  });

  describe('the booster in water (SHOWCASE_PLAN §3a: it works on the ground and in water, not in the air)', () => {
    it('pushes a floating rover, which has no grip: a Light build that would float to a stop crosses with it', () => {
      expect(crossesAt(lightRover, 5)).toBe(false);
      expect(crossesAt(lightRover, 5, true)).toBe(true);
    });

    it('gives a floating rover its impulse, F × t ÷ m, less what the water takes', () => {
      const session = onDeepFord(lightRover, 71, 2);
      const before = session.state.speedMps;
      session.fireBooster();
      for (let i = 0; i < 12; i++) session.stepOnce(); // 0.1 s, still in the water
      expect(session.events.some((e) => e.kind === 'float')).toBe(true);
      // 2500 N for 0.1 s on about 169 to 220 kg is 1.1 to 1.5 m/s, a little less after the drag.
      expect(session.state.speedMps - before).toBeGreaterThan(0.8);
      expect(session.state.speedMps - before).toBeLessThan(1.6);
    });

    it('pushes a sinking build along the riverbed too, so it leaves the channel sooner', () => {
      const timeOut = (fire: boolean) => {
        const session = onDeepFord(heavyRover, 66, 6, true);
        if (fire) session.fireBooster();
        let steps = 0;
        while (deepAlong(session) < 90 && steps < 120 * 30) {
          session.stepOnce();
          steps += 1;
        }
        return steps / 120;
      };
      expect(timeOut(true)).toBeLessThan(timeOut(false));
    });

    it('stops at top speed in the water as it does on the ground', () => {
      for (const build of allBuilds(content).filter((_, i) => i % 5 === 0)) {
        const session = onDeepFord(build, 20, 0, true);
        session.fireBooster();
        let fastest = 0;
        for (let i = 0; i < 120 * 3; i++) {
          session.stepOnce();
          fastest = Math.max(fastest, session.state.speedMps);
        }
        expect(fastest, `${build.chassisId} ${build.wheelsId} ${build.motorId}`).toBeLessThanOrEqual(roverFromParts(content, build).topSpeedMps + 1e-6);
      }
    });
  });

  it('the mud banks cost time but trap nobody: every build drives out of both on the safe route', () => {
    for (const build of allBuilds(content)) {
      const r = runPilot({ content, def, build, plan: plans.safe });
      expect(r.respawns.stuck, `${build.chassisId} ${build.wheelsId} ${build.motorId}`).toBe(0);
    }
  });

  it('the shallow ford slows nobody down to a stop: every build drives through it', () => {
    for (const build of allBuilds(content).filter((_, i) => i % 4 === 0)) {
      const r = runPilot({ content, def: startingAt(def, 'cp-1'), build, plan: { roads: ['lead', 'ford', 'run-in'] }, maxS: 80 });
      expect(r.respawns.floated + r.respawns.stuck + r.respawns.crash, `${build.chassisId} ${build.wheelsId} ${build.motorId}`).toBe(0);
    }
  });

  it('the fork is a real choice: the deep ford wins for some builds and the bridge for others', () => {
    const roads = (f: string) => ['start', 'bend-1', 'lead', 'ford', 'run-in', f, 'bank', 'slope'];
    let deepWins = 0;
    for (const build of allBuilds(content)) {
      const t = (f: string) => runPilot({ content, def, build, plan: { roads: roads(f) } }).timeS;
      if (t('f1-deep') < t('f1-bridge')) deepWins += 1;
    }
    expect(deepWins).toBeGreaterThan(5);
    expect(deepWins).toBeLessThan(22);
  });

  describe('the stretches of the report (P6)', () => {
    it('names five, in route order, and a clean drive takes what the file says on each', () => {
      expect(def.stretches.map((s) => s.name)).toEqual(['The Lakebed', 'The Ford', 'The Run-in', 'The River', 'The Slope']);
      const r = runPilot({ content, def, plan: plans.stars });
      const got = r.session.stretches;
      expect(got.map((s) => s.id)).toEqual(def.stretches.map((s) => s.id));
      got.forEach((s, i) => expect(s.timeS, s.id).toBeCloseTo(def.stretches[i]!.cleanS, 1));
      expect(got.reduce((sum, s) => sum + s.timeS, 0)).toBeCloseTo(r.timeS, 6);
    });

    it('brings the splashdown floats home, with the upthrust in the line', () => {
      const r = runPilot({ content, def, plan: plans.stars });
      const pickup = r.session.report().pickup;
      expect(pickup?.partName).toBe('Splashdown floats');
      expect(pickup?.line).toContain('1960 N');
    });
  });
});
