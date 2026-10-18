import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { STARTING_BUILD, physicsConstants, roverFromParts } from '../buildFromParts.ts';
import { checkLevelFile, loadLevel, startingAt } from './levelChecks.ts';
import { createLevelSession } from './session.ts';
import { allBuilds, runPilot } from './testPilot.ts';
import type { LevelDef } from './types.ts';

checkLevelFile('gravity-wells');

describe('gravity-wells', () => {
  const { def, world } = loadLevel('gravity-wells');

  it('marks its zones with the run’s two gravities: a low zone for the hill, high zones for the ice and mud lanes', () => {
    expect(def.gravityZones.map((z) => [z.id, z.kind])).toEqual([['low-1', 'low'], ['high-2', 'high'], ['high-3', 'high']]);
    expect(content.run.gravityMultipliers).toEqual({ low: 0.5, high: 2 });
  });

  it('keeps the ways round in normal gravity, on their own plain surface', () => {
    for (const id of ['w1-round', 'w2-round', 'w3-round']) {
      const road = world.roadById(id);
      for (const p of road.line.points) {
        expect(world.gravityKindAt(p.xM, p.zM), `${id} at (${p.xM.toFixed(0)}, ${p.zM.toFixed(0)})`).toBeUndefined();
        expect(world.surfaceIdAt(p.xM, p.zM), `${id} surface`).toBe('asphalt');
      }
    }
  });

  it('has a 30° asphalt hill inside the low zone, and the zone covers its whole slope', () => {
    expect(def.ridges).toHaveLength(1);
    const r = def.ridges[0]!;
    expect(r.riseAngleDeg).toBe(30);
    expect(r.fallAngleDeg).toBe(30);
    const along = (u: number) => ({ x: r.xM + Math.cos((r.headingDeg * Math.PI) / 180) * u, z: r.zM + Math.sin((r.headingDeg * Math.PI) / 180) * u });
    for (const u of [-10, 0, r.riseLengthM, r.riseLengthM + r.topLengthM, r.riseLengthM * 2 + r.topLengthM, r.riseLengthM * 2 + r.topLengthM + 10]) {
      const p = along(u);
      expect(world.gravityKindAt(p.x, p.z), `u = ${u}`).toBe('low');
      expect(world.surfaceIdAt(p.x, p.z)).toBe('asphalt');
    }
  });

  it('the hill: from rest, the starting build cannot climb it in normal gravity but does in half gravity', () => {
    const r = def.ridges[0]!;
    const topM = r.riseLengthM * Math.tan((30 * Math.PI) / 180);
    const climb = (withZone: boolean) =>
      runPilot({
        content, build: STARTING_BUILD, maxS: 20,
        def: { ...def, gravityZones: withZone ? def.gravityZones : [], start: { xM: r.xM + 1, zM: r.zM, headingDeg: r.headingDeg }, checkpoints: [], stopLines: [], forks: [], barriers: [], cannons: [], boosts: [] },
        plan: { roads: ['w1-hill'], throttleOnly: true },
        until: (s) => s.world.heightM(s.pose.centreXM, s.pose.centreZM) > topM - 0.3,
      });
    const normal = climb(false);
    expect(world.heightM(normal.session.pose.centreXM, normal.session.pose.centreZM)).toBeLessThan(topM / 2);
    const half = climb(true);
    expect(world.heightM(half.session.pose.centreXM, half.session.pose.centreZM)).toBeGreaterThan(topM - 0.5);
  });

  it('braking takes much further in low gravity: the tyres grip half as hard (about 1.5 times as far from 12 m/s)', () => {
    const stopDistance = (zones: LevelDef['gravityZones']) => {
      const lane = world.roadById('w1-hill').line;
      const start = lane.points[0]!;
      const end = lane.points[lane.points.length - 1]!;
      const session = createLevelSession({
        content, rover: roverFromParts(content, STARTING_BUILD), constants: physicsConstants(content),
        def: { ...def, gravityZones: zones, barriers: [], cannons: [], ridges: [], checkpoints: [], hints: [], stopLines: [], forks: [], samples: def.samples },
        drive: () => ({ throttleHeld: false, brakeHeld: true, steer: 0 }),
        initialState: { positionXM: start.xM, positionZM: start.zM, headingRad: Math.atan2(end.zM - start.zM, end.xM - start.xM), speedMps: 12 },
      });
      const from = { x: session.state.positionXM, z: session.state.positionZM };
      for (let i = 0; i < 120 * 10 && session.state.speedMps > 0; i++) session.stepOnce();
      return Math.hypot(session.state.positionXM - from.x, session.state.positionZM - from.z);
    };
    // Same spot, same start; the zone is only in or out.
    const inZone = stopDistance([{ ...def.gravityZones[0]!, polygon: [{ xM: -1e4, zM: -1e4 }, { xM: 1e4, zM: -1e4 }, { xM: 1e4, zM: 1e4 }, { xM: -1e4, zM: 1e4 }] }]);
    const outside = stopDistance([]);
    expect(inZone / outside).toBeGreaterThan(1.4);
    expect(inZone / outside).toBeLessThan(2.1);
  });

  it('a kicker in the low zone pushes just as hard: its sandbag has the same mass in any gravity', () => {
    const r = runPilot({
      content, def: startingAt(def, 'cp-1'), plan: { roads: ['lead-1', 'w1-hill'] }, maxS: 40,
      until: (s) => s.events.some((e) => e.kind === 'hit'),
    });
    const hit = r.session.events.find((e) => e.kind === 'hit')!;
    expect(hit.hitKind).toBe('kicker');
    expect(world.gravityKindAt(hit.xM, hit.zM)).toBe('low');
    // m₁u₁ + m₂u₂ = (m₁ + m₂)u′, with the numbers the run uses: the same 40 kg bag at 30 m/s.
    const m = hit.massKg!;
    expect(hit.u3!).toBeCloseTo((m * hit.u1! + hit.bagKg! * hit.u2!) / (m + hit.bagKg!), 9);
  });

  it('the barrier after the descent is a trap at speed: holding W on the hill lane crashes', () => {
    const r = runPilot({
      content, def: startingAt(def, 'cp-1'), plan: { roads: ['lead-1', 'w1-hill'], throttleOnly: true }, maxS: 60,
      until: (s) => s.events.some((e) => e.kind === 'respawn'),
    });
    expect(r.respawns.crash).toBe(1);
  });

  it('grip doubles in double gravity: from rest on the ice lane the same build gains speed twice as fast', () => {
    const speedAfter = (zones: LevelDef['gravityZones']) => {
      const lane = world.roadById('w2-ice').line;
      const p = lane.points[0]!;
      const q = lane.points[lane.points.length - 1]!;
      const len = Math.hypot(q.xM - p.xM, q.zM - p.zM);
      const at = { xM: p.xM + ((q.xM - p.xM) / len) * 60, zM: p.zM + ((q.zM - p.zM) / len) * 60 };
      const session = createLevelSession({
        content, rover: roverFromParts(content, STARTING_BUILD), constants: physicsConstants(content),
        def: { ...def, gravityZones: zones, checkpoints: [], hints: [], stopLines: [], forks: [], barriers: [], cannons: [], boosts: [] },
        drive: () => ({ throttleHeld: true, brakeHeld: false, steer: 0 }),
        initialState: { positionXM: at.xM, positionZM: at.zM, headingRad: Math.atan2(q.zM - p.zM, q.xM - p.xM), speedMps: 0 },
      });
      for (let i = 0; i < 120 * 4; i++) session.stepOnce();
      return session.state.speedMps;
    };
    const everywhere = [{ ...def.gravityZones[1]!, polygon: [{ xM: -1e4, zM: -1e4 }, { xM: 1e4, zM: -1e4 }, { xM: 1e4, zM: 1e4 }, { xM: -1e4, zM: 1e4 }] }];
    expect(speedAfter(everywhere) / speedAfter([])).toBeGreaterThan(1.6);
  });

  it('the mud lane in double gravity bogs down almost every build: weight doubles, so friction doubles', () => {
    const crossed = allBuilds(content).filter((build) => {
      const r = runPilot({
        content, def: startingAt(def, 'cp-3'), build, plan: { roads: ['m2', 'w3-mud'] }, maxS: 100,
        until: (s) => s.events.some((e) => e.kind === 'fork' || e.kind === 'respawn'),
      });
      return r.session.events.some((e) => e.kind === 'fork');
    });
    expect(crossed.length).toBeLessThan(6);
    expect(crossed.some((b) => b.chassisId === 'chassis-standard' && b.wheelsId === 'wheels-all-terrain' && b.motorId === 'motor-medium')).toBe(false);
  });

  it('the pad, the zone and the barrier are all in the first fork’s lane, as A7 lists them', () => {
    expect(def.boosts.map((b) => b.id)).toEqual(['pad-start']);
    expect(def.barriers.map((b) => b.id)).toEqual(['well-barrier']);
    expect(def.cannons.map((c) => c.id)).toEqual(['k-well']);
  });
});
