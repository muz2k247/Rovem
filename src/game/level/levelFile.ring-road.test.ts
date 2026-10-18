import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { levelsConfig } from '../../content/levelsConfig.ts';
import { STARTING_BUILD, physicsConstants, roverFromParts } from '../buildFromParts.ts';
import { checkLevelFile, loadLevel, startingAt } from './levelChecks.ts';
import { createLevelSession } from './session.ts';
import { runPilot } from './testPilot.ts';

checkLevelFile('ring-road');

describe('ring-road', () => {
  const { def, world } = loadLevel('ring-road');
  const session = () =>
    createLevelSession({ content, def, rover: roverFromParts(content, STARTING_BUILD), constants: physicsConstants(content), drive: () => ({ throttleHeld: false, brakeHeld: false, steer: 0 }) });

  /** The arcs of the main route: radius and turn in degrees. */
  const routeArcs = () =>
    def.route.flatMap((id) => def.roads.find((r) => r.id === id)!.segments.flatMap((s) => (s.kind === 'arc' ? [{ radiusM: s.radiusM, angleDeg: Math.abs(s.angleDeg) }] : [])));

  it('has the bends of A7 on the main route: r = 40 m twice, r = 25 m twice, a hairpin of r = 12 m, and the Ring of 270° at r = 30 m', () => {
    const arcs = routeArcs();
    expect(arcs.filter((a) => a.radiusM === 40)).toHaveLength(2);
    expect(arcs.filter((a) => a.radiusM === 25)).toHaveLength(2);
    expect(arcs.filter((a) => a.radiusM === 12).reduce((sum, a) => sum + a.angleDeg, 0)).toBe(180);
    expect(arcs.filter((a) => a.radiusM === 30)).toEqual([{ radiusM: levelsConfig.ringRoad.ringRadiusM, angleDeg: levelsConfig.ringRoad.ringArcDeg }]);
    // The one bend the list does not have: the 10 m turn after the Ring, which keeps the exit clear of the way in.
    expect(arcs.filter((a) => ![12, 25, 30, 40].includes(a.radiusM))).toEqual([{ radiusM: 10, angleDeg: 90 }]);
  });

  it('is point to point: the finish is far from the start', () => {
    expect(Math.hypot(def.finish.xM - def.start.xM, def.finish.zM - def.start.zM)).toBeGreaterThan(100);
  });

  it('gives every bend a sign with its radius near the bend, and every road has mud run-off', () => {
    for (const road of world.roads) {
      expect(road.runoffSurfaceId, road.def.id).toBe('mud');
      for (const arc of road.arcs) {
        const index = road.line.alongAt.findIndex((s) => s >= arc.fromM - 1e-6);
        const start = road.line.points[index]!;
        const sign = def.signs.find((s) => s.radiusM === arc.radiusM && Math.hypot(s.xM - start.xM, s.zM - start.zM) <= 60);
        expect(sign, `${road.def.id}: a sign for r = ${arc.radiusM} m within 60 m of the bend at ${arc.fromM.toFixed(0)} m`).toBeDefined();
      }
    }
  });

  it('the signs show the safe speed √(μ k g r): 9.70 m/s at the hairpin and 15.34 m/s at the Ring, for the starting build', () => {
    const s = session();
    expect(s.signInfo('sign-hairpin').safeSpeedMps).toBeCloseTo(Math.sqrt(0.8 * 9.8 * 12), 9);
    expect(s.signInfo('sign-hairpin').safeSpeedMps).toBeCloseTo(9.7, 1);
    expect(s.signInfo('sign-ring').safeSpeedMps).toBeCloseTo(15.34, 2);
    expect(s.signInfo('sign-ring').safeSpeedMps).toBeLessThan(content.parts.find((p) => p.id === 'motor-medium')!.topSpeedMps!);
  });

  it('the second fork is inside a low-gravity zone, so its bends show 0.71 of the safe speed', () => {
    const s = session();
    // The same radius, in and out of the zone: the sign for r = 25 m is in it, the main route’s r = 40 m sign is not.
    const inZone = s.signInfo('sign-t1').safeSpeedMps;
    expect(inZone).toBeCloseTo(Math.sqrt(0.8 * 9.8 * content.run.gravityMultipliers.low * 25), 9);
    expect(inZone / Math.sqrt(0.8 * 9.8 * 25)).toBeCloseTo(0.71, 2);
    for (const id of ['f2-tight', 'f2-wide']) {
      const pts = world.roadById(id).line.points;
      const mid = pts[Math.floor(pts.length / 2)]!;
      expect(world.gravityKindAt(mid.xM, mid.zM), id).toBe('low');
    }
    const first = world.roadById('c3').line.points[0]!;
    expect(world.gravityKindAt(first.xM, first.zM)).toBeUndefined();
  });

  it('the Ring is at the foot of a downhill: you arrive faster than you think', () => {
    const line = world.roadById('c5').line;
    const a = line.points[0]!;
    const b = line.points[1]!;
    const len = line.lengthM;
    const at = (s: number) => ({ x: a.xM + ((b.xM - a.xM) * s) / len, z: a.zM + ((b.zM - a.zM) * s) / len });
    const top = at(len - 60);
    const foot = at(len);
    expect(world.heightM(top.x, top.z) - world.heightM(foot.x, foot.z)).toBeGreaterThan(3);
  });

  it('holding W through the Ring slides wide: the safe speed is below the top speed', () => {
    const r = runPilot({
      content, def: startingAt(def, 'cp-3'), maxS: 40, plan: { roads: ['c5', 'ring', 'exit'], throttleOnly: true },
      until: (s) => s.events.some((e) => e.kind === 'respawn'),
    });
    expect(r.session.events.some((e) => e.kind === 'slide')).toBe(true);
    expect(r.respawns.crash + r.respawns.stuck).toBeGreaterThan(0);
  });

  it('driving the Ring under its safe speed does not slide', () => {
    const r = runPilot({ content, def: startingAt(def, 'cp-3'), maxS: 80, plan: { roads: ['c5', 'ring', 'exit'], bendMargin: 0.85 } });
    expect(r.finished).toBe(true);
    const slidesOnRing = r.session.events.filter((e) => e.kind === 'slide' && world.onRoadAt(e.xM, e.zM)?.road.def.id === 'ring');
    expect(slidesOnRing).toHaveLength(0);
  });

  it('the hairpin is a prediction: braked to its safe speed it beats the wide bends; at full throttle it throws you into the mud', () => {
    const lane = (road: string, throttleOnly: boolean) =>
      runPilot({
        content, def: startingAt(def, 'cp-1'), plan: { roads: ['c2', road, 'c3'], throttleOnly }, maxS: 60,
        until: (s) => s.events.some((e) => e.kind === 'fork' || e.kind === 'respawn'),
      });
    const braked = lane('f1-hairpin', false).session.events.find((e) => e.kind === 'fork')!.yourS!;
    const wide = lane('f1-wide', false).session.events.find((e) => e.kind === 'fork')!.yourS!;
    expect(braked).toBeLessThan(wide);
    const flatOut = lane('f1-hairpin', true);
    expect(flatOut.session.events.some((e) => e.kind === 'slide')).toBe(true);
  });

  it('the low-gravity bends: braked to their safe speed the tight road beats the wide one; at full throttle the wide one hits the wall too', () => {
    const lane = (road: string, throttleOnly: boolean) =>
      runPilot({
        content, def: startingAt(def, 'cp-2'), plan: { roads: ['c3', 'c4', road, 'c5'], throttleOnly }, maxS: 90,
        until: (s) => s.events.some((e) => e.kind === 'fork' || e.kind === 'respawn'),
      });
    const tight = lane('f2-tight', false).session.events.find((e) => e.kind === 'fork')!;
    expect(tight.yourS!).toBeLessThan(lane('f2-wide', false).session.events.find((e) => e.kind === 'fork')!.yourS!);
    // The caption after the tight road says what the wide road would have done at full throttle.
    expect(tight.otherOutcome).not.toBe('merged');
    expect(lane('f2-tight', true).session.events.some((e) => e.kind === 'slide')).toBe(true);
  });
});
