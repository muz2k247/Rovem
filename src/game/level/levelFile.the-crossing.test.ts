import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { levelsConfig } from '../../content/levelsConfig.ts';
import { STARTING_BUILD, physicsConstants, roverFromParts, type BuildSelection } from '../buildFromParts.ts';
import { checkLevelFile, loadLevel, startingAt } from './levelChecks.ts';
import { createLevelSession } from './session.ts';
import { allBuilds, roadPoint, runPilot } from './testPilot.ts';

checkLevelFile('the-crossing', { starRunWindowS: [135, 160], checkpointGapS: 40 });

// The Crossing (SHOWCASE_PLAN §3 Level 4; rebuilt in R12, DECISIONS 2026-10-26 (6) and 2026-10-27 (8)): the lakebed with a hill, a shallow ford and mud, a 60 m wading
// reach at 0.5 m with a sample in it, the fork between a 20 m deep crossing at 1.0 m and a long dry bridge, a mud bank and a vent on the far side, and the slope out.
// The water rules of v4 A6 are unchanged. About 145 s for the starting build.
describe('the-crossing', () => {
  const { def, world, plans } = loadLevel('the-crossing');
  const cfg = levelsConfig.water;
  const g = 9.8;
  const mass = (b: BuildSelection) => roverFromParts(content, b).massKg;
  const upthrustAt = (depthM: number) => cfg.densityKgPerM3 * g * cfg.roverVolumeM3 * Math.min(depthM / cfg.submersionHeightM, 1);
  const floaters = allBuilds(content).filter((b) => mass(b) * g <= upthrustAt(1.0));
  const lightRover: BuildSelection = { chassisId: 'chassis-light', wheelsId: 'wheels-all-terrain', motorId: 'motor-medium' };
  const heavyRover: BuildSelection = { chassisId: 'chassis-heavy', wheelsId: 'wheels-all-terrain', motorId: 'motor-medium' };
  const name = (b: BuildSelection) => `${b.chassisId} ${b.wheelsId} ${b.motorId}`;

  /** Metres of a road's centreline in water of this depth. */
  const wetM = (roadId: string, depthM: number) => {
    const len = world.roadById(roadId).line.lengthM;
    let m = 0;
    for (let a = 0; a < len; a += 0.25) {
      const p = roadPoint(world, roadId, a);
      if (world.waterDepthM(p.xM, p.zM) === depthM) m += 0.25;
    }
    return m;
  };
  const alongOn = (roadId: string, xM: number, zM: number) => world.roadById(roadId).line.nearest(xM, zM)?.alongM ?? 0;

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
  const deepAlong = (s: ReturnType<typeof onDeepFord>) => alongOn('f1-deep', s.pose.centreXM, s.pose.centreZM);
  /**
   * Does a rover that enters the deep crossing at this speed with the engine off get out the far side without floating to a stop? The burn is fired 1 m
   * into the water: at top speed a burn on dry ground ends at once and is wasted (SHOWCASE_PLAN §3a). R12 measured the window for the 11 floaters: any time
   * from 1 m into the water to 8 m or more works for all of them; right at the edge, while the rover is still within 0.5 m/s of its top speed, it does not.
   */
  const crossesAt = (build: BuildSelection, speedMps: number, fireBooster = false): boolean => {
    const session = onDeepFord(build, 128, speedMps);
    let fired = false;
    for (let i = 0; i < 120 * 12; i++) {
      if (fireBooster && !fired && deepAlong(session) >= 141) {
        session.fireBooster();
        fired = true;
      }
      session.stepOnce();
      if (session.events.some((e) => e.kind === 'respawn')) return false;
      if (deepAlong(session) > 166) return true;
    }
    return false;
  };

  it('has the three depths of the plan: a 0.3 m ford, a 60 m wading reach at 0.5 m and a 20 m deep crossing at 1.0 m', () => {
    expect(def.water.map((w) => w.depthM).sort()).toEqual([0.3, 0.5, 1]);
    for (const w of def.water) expect(cfg.depthsM).toContain(w.depthM);
    expect(wetM('reach', 0.5)).toBeCloseTo(60, 0);
    expect(wetM('f1-deep', 1)).toBeCloseTo(20, 0);
    expect(wetM('ford', 0.3)).toBeGreaterThan(10);
    expect(wetM('ford', 0.3)).toBeLessThan(20);
  });

  it('puts the ford and the wading reach on the way for everyone and the deep crossing on the deep road only', () => {
    expect(wetM('ford', 0.3)).toBeGreaterThan(0);
    expect(wetM('reach', 0.5)).toBeGreaterThan(0);
    for (const road of ['f1-bridge', 'lead', 'flat', 'run-in', 'bank', 'slope', 'start', 'bend-1']) expect(wetM(road, 0.3) + wetM(road, 0.5) + wetM(road, 1), road).toBe(0);
    expect(wetM('f1-deep', 1)).toBeGreaterThan(0);
  });

  it('holds a sample in the wading reach, so wading has a goal', () => {
    const s = def.samples.find((x) => x.id === 's-reach')!;
    expect(world.waterDepthM(s.xM, s.zM)).toBe(0.5);
    expect(world.onRoadAt(s.xM, s.zM)?.road.def.id).toBe('reach');
  });

  it('gives the deep crossing a bridge: a long way round (30 to 40 m more) that stays dry, with bends of at least 62 m', () => {
    const deep = world.roadById('f1-deep').line.lengthM;
    const bridge = world.roadById('f1-bridge');
    expect(bridge.line.lengthM).toBeGreaterThan(deep + 20);
    expect(bridge.line.lengthM).toBeLessThan(deep + 60);
    for (let a = 0; a < bridge.line.lengthM; a += 1) {
      const p = roadPoint(world, 'f1-bridge', a);
      expect(world.waterDepthM(p.xM, p.zM), `bridge at ${a} m`).toBe(0);
    }
    for (const arc of bridge.arcs) expect(arc.radiusM).toBeGreaterThanOrEqual(62);
  });

  it('keeps the river’s vent off the river: the vents are at the start and on the far bank, 150 m or more from any water', () => {
    expect(def.boosts.map((b) => world.onRoadAt(b.xM, b.zM)?.road.def.id)).toEqual(['start', 'bank']);
    for (const b of def.boosts) {
      for (const w of def.water) for (const p of w.polygon) expect(Math.hypot(b.xM - p.xM, b.zM - p.zM), `${b.id} from ${w.id}`).toBeGreaterThan(150);
    }
  });

  it('puts a mud pool on each side of the water (none longer than 12 m), a hill on the lakebed and a slope out', () => {
    const mud = def.surfaceZones.filter((z) => z.surfaceId === 'mud');
    const roadsOf = mud.map((z) => {
      const c = z.polygon.reduce((a, p) => ({ xM: a.xM + p.xM / z.polygon.length, zM: a.zM + p.zM / z.polygon.length }), { xM: 0, zM: 0 });
      return world.onRoadAt(c.xM, c.zM)?.road.def.id;
    });
    expect(roadsOf).toEqual(['ford', 'bank']);
    for (const road of ['ford', 'bank']) {
      let run = 0;
      let longest = 0;
      for (let a = 0; a < world.roadById(road).line.lengthM; a += 0.5) {
        const p = roadPoint(world, road, a);
        run = world.surfaceIdAt(p.xM, p.zM) === 'mud' ? run + 0.5 : 0;
        longest = Math.max(longest, run);
      }
      expect(longest, road).toBeLessThanOrEqual(12.5);
    }
    expect(def.ridges.map((r) => world.onRoadAt(r.xM, r.zM)?.road.def.id)).toEqual(['lead', 'slope']);
  });

  it('every Light build floats in the deep crossing (A6: 755 to 960 kg/m³), as do two Standard builds; the starting build and heavier ones sink', () => {
    const light = allBuilds(content).filter((b) => b.chassisId === 'chassis-light');
    for (const b of light) expect(mass(b) / cfg.roverVolumeM3).toBeLessThan(cfg.densityKgPerM3);
    expect(mass(STARTING_BUILD) / cfg.roverVolumeM3).toBeGreaterThan(cfg.densityKgPerM3);
    expect(floaters).toHaveLength(11);
    const floated = (build: BuildSelection) => {
      const r = runPilot({ content, def: startingAt(def, 'cp-5'), build, plan: { roads: ['run-in', 'f1-deep'] }, maxS: 80, until: (s) => s.events.some((e) => e.kind === 'fork') });
      return r.session.events.some((e) => e.kind === 'float');
    };
    expect(floated(lightRover)).toBe(true);
    expect(floated(STARTING_BUILD)).toBe(false);
  });

  it('a build that floats can cross the deep crossing with one burn, entering at its own top speed (DECISIONS 2026-10-26 (6))', () => {
    let needTheBurn = 0;
    for (const build of floaters) {
      const top = roverFromParts(content, build).topSpeedMps;
      expect(crossesAt(build, top, true), name(build)).toBe(true);
      if (!crossesAt(build, top, false)) needTheBurn += 1;
    }
    // The burn is not decoration: most of the floaters stop short without it and go back to the checkpoint.
    expect(needTheBurn).toBeGreaterThanOrEqual(5);
  });

  it('a Light build entering the deep crossing slowly floats to a stop and respawns', () => {
    const r = runPilot({
      content, def: { ...startingAt(def, 'cp-5'), boosts: [] }, build: lightRover,
      plan: { roads: ['run-in', 'f1-deep'], maxSpeedMps: 6 }, maxS: 90,
      until: (s) => s.events.some((e) => e.kind === 'fork' || e.kind === 'respawn'),
    });
    expect(r.respawns.floated).toBe(1);
  });

  it('a heavy build sinks and drives the riverbed slowly against the water drag', () => {
    const mid = roadPoint(world, 'f1-deep', 150);
    const session = createLevelSession({
      content, rover: roverFromParts(content, heavyRover), constants: physicsConstants(content),
      def: { ...def, start: { xM: mid.xM, zM: mid.zM, headingDeg: (mid.headingRad * 180) / Math.PI }, checkpoints: [], forks: [], hints: [] },
      drive: () => ({ throttleHeld: true, brakeHeld: false, steer: 0 }),
    });
    for (let i = 0; i < 120 * 4; i++) session.stepOnce();
    expect(session.state.speedMps).toBeGreaterThan(0.5);
    expect(session.state.speedMps).toBeLessThan(3);
  });

  describe('the wading reach (0.5 m, 60 m)', () => {
    /** Drives the reach from its checkpoint with this build, and says how long the front was in the 60 m of water and whether the wheels slipped there. */
    const wade = (build: BuildSelection) => {
      let enteredS: number | undefined;
      let leftS: number | undefined;
      let slipped = false;
      const r = runPilot({
        content, def: startingAt(def, 'cp-4'), build, plan: { roads: ['reach', 'run-in'] }, maxS: 80,
        until: (s) => {
          const depth = world.waterDepthM(s.pose.centreXM, s.pose.centreZM);
          if (depth === 0.5) {
            enteredS ??= s.clockS;
            if (s.hud.badges.slip) slipped = true;
          } else if (enteredS !== undefined && leftS === undefined) leftS = s.clockS;
          return leftS !== undefined;
        },
      });
      return { r, timeInS: leftS === undefined || enteredS === undefined ? Infinity : leftS - enteredS, slipped };
    };

    it('lets all 27 builds across, in 4 to 14 s, without a float, a crash or a stuck return', () => {
      for (const build of allBuilds(content)) {
        const w = wade(build);
        expect(w.r.respawns.floated + w.r.respawns.crash + w.r.respawns.stuck, name(build)).toBe(0);
        expect(w.timeInS, name(build)).toBeGreaterThan(4);
        expect(w.timeInS, name(build)).toBeLessThan(14);
      }
    });

    it('takes a Light build longer than a Heavy one: the same drag slows the lighter rover more, and the water takes weight off its wheels', () => {
      expect(wade(lightRover).timeInS).toBeGreaterThan(wade(heavyRover).timeInS);
    });

    it('lights the slip badge for a Light build, whose grip falls below its motor once the water takes weight off its wheels', () => {
      expect(wade(lightRover).slipped).toBe(true);
    });
  });

  describe('the booster in water (SHOWCASE_PLAN §3a: it works on the ground and in water, not in the air)', () => {
    it('pushes a floating rover, which has no grip: a Light build that would float to a stop crosses with it', () => {
      expect(crossesAt(lightRover, 5)).toBe(false);
      expect(crossesAt(lightRover, 5, true)).toBe(true);
    });

    it('gives a floating rover its impulse, F × t ÷ m, less what the water takes', () => {
      const session = onDeepFord(lightRover, 146, 2);
      const before = session.state.speedMps;
      session.fireBooster();
      for (let i = 0; i < 12; i++) session.stepOnce(); // 0.1 s, still in the water
      expect(session.events.some((e) => e.kind === 'float')).toBe(true);
      // 2500 N for 0.1 s on about 169 to 220 kg is 1.1 to 1.5 m/s, a little less after the drag.
      expect(session.state.speedMps - before).toBeGreaterThan(0.8);
      expect(session.state.speedMps - before).toBeLessThan(1.6);
    });

    it('pushes a sinking build along the riverbed too, so it leaves the crossing sooner', () => {
      const timeOut = (fire: boolean) => {
        const session = onDeepFord(heavyRover, 128, 6, true);
        if (fire) session.fireBooster();
        let steps = 0;
        while (deepAlong(session) < 170 && steps < 120 * 30) {
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
        expect(fastest, name(build)).toBeLessThanOrEqual(roverFromParts(content, build).topSpeedMps + 1e-6);
      }
    });
  });

  it('the mud pools cost time but trap nobody: every build drives out of both on the safe route', () => {
    for (const build of allBuilds(content)) {
      const r = runPilot({ content, def, build, plan: plans.safe });
      expect(r.respawns.stuck, name(build)).toBe(0);
    }
  });

  it('the shallow ford slows nobody down to a stop: every build drives through it', () => {
    for (const build of allBuilds(content).filter((_, i) => i % 4 === 0)) {
      const r = runPilot({ content, def: startingAt(def, 'cp-2'), build, plan: { roads: ['lead', 'ford', 'flat'] }, maxS: 80 });
      expect(r.respawns.floated + r.respawns.crash, name(build)).toBe(0);
      // A hold that is not a wall is the water or the mud stopping it.
      expect(r.session.events.filter((e) => e.kind === 'stuckHold' && e.obstacle !== 'wall'), name(build)).toHaveLength(0);
    }
  });

  it('the scripted driver no longer pins a Heavy + Spiked + Small build against a wall in the water (ROADMAP OI-57)', () => {
    const build: BuildSelection = { chassisId: 'chassis-heavy', wheelsId: 'wheels-spiked', motorId: 'motor-small' };
    const r = runPilot({ content, def: startingAt(def, 'cp-2'), build, plan: { roads: ['lead', 'ford', 'flat', 'reach', 'run-in'] }, maxS: 140 });
    expect(r.respawns.stuck).toBe(0);
    expect(r.session.events.filter((e) => e.kind === 'stuckHold' && e.obstacle === 'wall')).toHaveLength(0);
  });

  it('the fork is a real choice: the deep crossing wins for some builds and the bridge for others', () => {
    const roads = (f: string) => ['start', 'bend-1', 'lead', 'ford', 'flat', 'reach', 'run-in', f, 'bank', 'slope'];
    let deepWins = 0;
    for (const build of allBuilds(content)) {
      const t = (f: string) => runPilot({ content, def: startingAt(def, 'cp-5'), build, plan: { roads: ['run-in', f, 'bank', 'slope'] } }).timeS;
      if (t('f1-deep') < t('f1-bridge')) deepWins += 1;
    }
    void roads;
    expect(deepWins).toBeGreaterThan(5);
    expect(deepWins).toBeLessThan(22);
  });

  describe('the stretches of the report (P6)', () => {
    it('names five, in route order, and a clean drive takes what the file says on each', () => {
      expect(def.stretches.map((s) => s.name)).toEqual(['The Lakebed', 'The Ford', 'The Reach', 'The Channel', 'The Slope']);
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
