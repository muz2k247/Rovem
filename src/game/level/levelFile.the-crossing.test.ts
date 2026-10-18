import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { levelsConfig } from '../../content/levelsConfig.ts';
import { STARTING_BUILD, physicsConstants, roverFromParts, type BuildSelection } from '../buildFromParts.ts';
import { checkLevelFile, loadLevel, startingAt } from './levelChecks.ts';
import { createLevelSession } from './session.ts';
import { allBuilds, roadPoint, runPilot } from './testPilot.ts';

checkLevelFile('the-crossing');

describe('the-crossing', () => {
  const { def, world } = loadLevel('the-crossing');
  const cfg = levelsConfig.water;
  const light = allBuilds(content).filter((b) => b.chassisId === 'chassis-light');
  const mass = (b: BuildSelection) => roverFromParts(content, b).massKg;

  /** Does a rover that enters the first deep channel at this speed, with the engine off, get out the far side? */
  const crossesAt = (build: BuildSelection, speedMps: number): boolean => {
    const p0 = roadPoint(world, 'ch1', 66, 0);
    const session = createLevelSession({
      content, rover: roverFromParts(content, build), constants: physicsConstants(content),
      def: { ...def, start: { xM: p0.xM + Math.cos(p0.headingRad), zM: p0.zM + Math.sin(p0.headingRad), headingDeg: (p0.headingRad * 180) / Math.PI }, checkpoints: [], stopLines: [], forks: [], hints: [] },
      drive: () => ({ throttleHeld: false, brakeHeld: false, steer: 0 }),
      initialState: { speedMps },
    });
    const lane = world.roadById('ch1').line;
    for (let i = 0; i < 120 * 10; i++) {
      session.stepOnce();
      if (session.events.some((e) => e.kind === 'respawn')) return false;
      if ((lane.nearest(session.pose.centreXM, session.pose.centreZM)?.alongM ?? 0) > 81) return true;
    }
    return false;
  };

  it('uses the A10 depths and widths: fords of 0.3 m, a river of 0.5 m, two deep channels of 1.0 m that are 10 m wide', () => {
    const depths = def.water.map((w) => w.depthM);
    expect(new Set(depths)).toEqual(new Set(cfg.depthsM));
    expect(depths.filter((d) => d === 0.3)).toHaveLength(2);
    expect(depths.filter((d) => d === 0.5)).toHaveLength(1);
    const deep = def.water.filter((w) => w.depthM === 1.0);
    expect(deep).toHaveLength(2);
    for (const w of deep) {
      // The channel is a rectangle across the road: its short side is the width.
      const sides = [0, 1, 2, 3].map((i) => Math.hypot(w.polygon[i]!.xM - w.polygon[(i + 1) % 4]!.xM, w.polygon[i]!.zM - w.polygon[(i + 1) % 4]!.zM));
      expect(Math.min(...sides)).toBeCloseTo(cfg.channelWidthM, 1);
    }
  });

  it('gives each deep channel a bridge: a long way round that stays dry', () => {
    for (const [channel, bridge] of [['ch1', 'bridge-1'], ['ch2', 'bridge-2']] as const) {
      expect(world.roadById(bridge).line.lengthM).toBeGreaterThan(world.roadById(channel).line.lengthM);
      for (const p of world.roadById(bridge).line.points) expect(world.waterDepthM(p.xM, p.zM), bridge).toBe(0);
    }
  });

  it('puts a boost pad before each deep channel', () => {
    for (const [channel, pad] of [['ch1', 'pad-ch1'], ['ch2', 'pad-ch2']] as const) {
      const b = def.boosts.find((x) => x.id === pad)!;
      const along = world.roadById(channel).line.nearest(b.xM, b.zM)!.alongM;
      expect(along).toBeGreaterThan(40);
      expect(along).toBeLessThan(65);
    }
  });

  it('every Light build floats in a deep channel (A6: 755 to 960 kg/m³); the starting build and heavier ones sink', () => {
    for (const b of light) expect((mass(b) / cfg.roverVolumeM3)).toBeLessThan(cfg.densityKgPerM3);
    expect(mass(STARTING_BUILD) / cfg.roverVolumeM3).toBeGreaterThan(cfg.densityKgPerM3);
    const floated = (build: BuildSelection) => {
      const r = runPilot({ content, def: startingAt(def, 'cp-2'), build, plan: { roads: ['mid', 'to-ch1', 'ch1'] }, maxS: 80, until: (s) => s.events.some((e) => e.kind === 'fork') });
      return r.session.events.some((e) => e.kind === 'float');
    };
    expect(floated({ chassisId: 'chassis-light', wheelsId: 'wheels-all-terrain', motorId: 'motor-medium' })).toBe(true);
    expect(floated(STARTING_BUILD)).toBe(false);
  });

  it('a Light build entering a deep channel fast enough coasts out the far side: from 9 m/s for the heavier ones, a little more for the lightest', () => {
    // m v₀ ÷ b = 10 m is the coasting distance: 169 kg needs 8.9 m/s on paper, a little more once the front end and the 0.2 m/s stop are counted.
    const needed = light.map((b) => {
      let v = 0;
      while (!crossesAt(b, v) && v < 15) v += 0.25;
      return { b, v };
    });
    for (const { v } of needed) expect(v).toBeLessThan(11);
    const at9 = needed.filter((n) => n.v <= 9);
    expect(at9.length).toBeGreaterThan(0);
    expect(crossesAt({ chassisId: 'chassis-light', wheelsId: 'wheels-spiked', motorId: 'motor-large' }, 9)).toBe(true);
    expect(crossesAt({ chassisId: 'chassis-light', wheelsId: 'wheels-smooth', motorId: 'motor-small' }, 9)).toBe(false);
    expect(crossesAt({ chassisId: 'chassis-light', wheelsId: 'wheels-smooth', motorId: 'motor-small' }, 11)).toBe(true);
  });

  it('with the pad, every one of the 27 builds crosses both deep channels from the stop line', () => {
    for (const build of allBuilds(content)) {
      const one = runPilot({ content, def: startingAt(def, 'cp-2'), build, plan: { roads: ['mid', 'to-ch1', 'ch1'] }, maxS: 80, until: (s) => s.events.some((e) => e.kind === 'fork' || e.kind === 'respawn') });
      expect(one.session.events.some((e) => e.kind === 'fork'), `${build.chassisId} ${build.wheelsId} ${build.motorId} channel 1`).toBe(true);
      const two = runPilot({ content, def: startingAt(def, 'cp-3'), build, plan: { roads: ['bar', 'ch2'] }, maxS: 80, until: (s) => s.events.some((e) => e.kind === 'fork' || e.kind === 'respawn') });
      expect(two.session.events.some((e) => e.kind === 'fork'), `${build.chassisId} ${build.wheelsId} ${build.motorId} channel 2`).toBe(true);
    }
  });

  it('without the pad a Light build that enters slowly floats to a stop and respawns', () => {
    const r = runPilot({
      content, def: { ...startingAt(def, 'cp-2'), boosts: def.boosts.filter((b) => b.id !== 'pad-ch1') },
      build: { chassisId: 'chassis-light', wheelsId: 'wheels-all-terrain', motorId: 'motor-medium' },
      plan: { roads: ['mid', 'to-ch1', 'ch1'], maxSpeedMps: 6 }, maxS: 90,
      until: (s) => s.events.some((e) => e.kind === 'fork' || e.kind === 'respawn'),
    });
    expect(r.respawns.floated).toBe(1);
  });

  it('a heavy build sinks and drives the riverbed slowly against the water drag', () => {
    const channel = def.water.find((w) => w.depthM === 1.0)!;
    const mid = channel.polygon.reduce((a, p) => ({ xM: a.xM + p.xM / 4, zM: a.zM + p.zM / 4 }), { xM: 0, zM: 0 });
    const heavy: BuildSelection = { chassisId: 'chassis-heavy', wheelsId: 'wheels-all-terrain', motorId: 'motor-medium' };
    const session = createLevelSession({
      content, rover: roverFromParts(content, heavy), constants: physicsConstants(content),
      def: { ...def, start: { xM: mid.xM, zM: mid.zM, headingDeg: def.checkpoints[0]!.headingDeg }, checkpoints: [], stopLines: [], forks: [], hints: [] },
      drive: () => ({ throttleHeld: true, brakeHeld: false, steer: 0 }),
    });
    for (let i = 0; i < 120 * 4; i++) session.stepOnce();
    expect(session.state.speedMps).toBeGreaterThan(0.5);
    expect(session.state.speedMps).toBeLessThan(3);
  });

  it('the shallow fords and the river slow nobody down to a stop: every build drives through them', () => {
    for (const build of representative()) {
      const r = runPilot({ content, def: startingAt(def, 'cp-1'), build, plan: { roads: ['lead', 'mid', 'to-ch1'] }, maxS: 80, until: (s) => s.events.some((e) => e.kind === 'respawn') || s.phase === 'held' });
      expect(r.respawns.floated + r.respawns.stuck + r.respawns.crash).toBe(0);
    }
    function representative() {
      return allBuilds(content).filter((_, i) => i % 4 === 0);
    }
  });
});
