import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { launcherDirectionRad } from '../launchers.ts';
import { loadLevelDef } from './levels.ts';
import { LEVEL_IDS } from './types.ts';
import { createLevelWorld } from './world.ts';

// The launchers in the level files obey the roadside rule (R11, DECISIONS 2026-10-26 (5), AUDIT_R9 C3): 11 m from the centre line, on both
// sides alternately, firing 30° to the road; the shot is aimed at the crossing point, so the crossing is on a straight road, never on ice,
// clear of any vent, and two crossings are at least 2 s of the fastest motor apart.

const DEG = Math.PI / 180;
const b = content.run.sandbag;
const FASTEST_MPS = Math.max(...content.parts.filter((p) => p.slot === 'motor').map((p) => p.topSpeedMps!));
/** A vent between the shot and the crossing changes the rover's speed (by about 6 m/s) and spoils the aim: no vent within the bag's flight of the crossing. */
const VENT_GAIN_MPS = 6;
const flightWindowM = (kind: 'headOn' | 'kicker') => {
  const flightM = b.roadsideOffsetM / Math.sin(b.angleDeg * DEG);
  return (flightM / (kind === 'headOn' ? b.headOnSpeedMps : b.kickerSpeedMps)) * (FASTEST_MPS + VENT_GAIN_MPS);
};

describe.each(LEVEL_IDS)('%s: launchers', (id) => {
  const def = loadLevelDef(id);
  const world = createLevelWorld(def, content);

  const placed = def.cannons.map((c) => {
    let best: { roadId: string; alongM: number; distM: number; pointXM: number; pointZM: number } | undefined;
    for (const road of def.roads) {
      const n = world.roadById(road.id).line.nearest(c.xM, c.zM);
      if (n && (!best || n.distM < best.distM)) best = { roadId: road.id, alongM: n.alongM, distM: n.distM, pointXM: n.pointXM, pointZM: n.pointZM };
    }
    const road = world.roadById(best!.roadId);
    const a = road.line.nearest(c.xM, c.zM)!;
    const ahead = road.line.points[Math.min(road.line.points.length - 1, 1 + road.line.alongAt.findIndex((s) => s > a.alongM))]!;
    const behind = road.line.points[Math.max(0, road.line.alongAt.findIndex((s) => s > a.alongM) - 1)]!;
    const headingRad = Math.atan2(ahead.zM - behind.zM, ahead.xM - behind.xM);
    const lateral = (c.xM - best!.pointXM) * -Math.sin(headingRad) + (c.zM - best!.pointZM) * Math.cos(headingRad);
    return { cannon: c, ...best!, headingRad, lateral };
  });

  it.runIf(def.cannons.length > 0)('stands 11 m from the centre line of the road it guards, outside the road and its run-off', () => {
    for (const p of placed) {
      expect(Math.abs(p.lateral), p.cannon.id).toBeCloseTo(b.roadsideOffsetM, 1);
      const road = world.roadById(p.roadId);
      expect(Math.abs(p.lateral), p.cannon.id).toBeGreaterThan(road.widthM / 2 + road.runoffM);
    }
  });

  it.runIf(def.cannons.length > 0)('fires 30° to the road: back along it and across it (head-on) or forward and across it (kicker), toward the centre line', () => {
    for (const p of placed) {
      const want = launcherDirectionRad(p.cannon.kind, p.headingRad, p.lateral, b.angleDeg * DEG);
      const got = p.cannon.directionDeg * DEG;
      expect(Math.cos(got), p.cannon.id).toBeCloseTo(Math.cos(want), 2);
      expect(Math.sin(got), p.cannon.id).toBeCloseTo(Math.sin(want), 2);
    }
  });

  it.runIf(def.cannons.length > 0)('alternates sides along the route', () => {
    const route = def.route;
    const order = [...placed].filter((p) => route.includes(p.roadId) || def.forks.some((f) => f.roadIds.includes(p.roadId))).sort((p, q) => {
      const ri = (x: string) => {
        const i = route.indexOf(x);
        return i >= 0 ? i : route.findIndex((r) => def.forks.some((f) => f.roadIds.includes(r) && f.roadIds.includes(x)));
      };
      return ri(p.roadId) - ri(q.roadId) || p.alongM - q.alongM;
    });
    for (let i = 1; i < order.length; i++) expect(Math.sign(order[i]!.lateral), `${order[i - 1]!.cannon.id} then ${order[i]!.cannon.id}`).toBe(-Math.sign(order[i - 1]!.lateral));
  });

  it.runIf(def.cannons.length > 0)('has its crossing point on a straight road, never on ice, with no vent just before it', () => {
    for (const p of placed) {
      const road = world.roadById(p.roadId);
      const run = b.roadsideOffsetM / Math.tan(b.angleDeg * DEG);
      const crossingAlong = p.alongM + (p.cannon.kind === 'headOn' ? -run : run);
      const ahead = crossingAlong - flightWindowM(p.cannon.kind);
      for (let s = Math.max(0, ahead); s <= Math.min(road.line.lengthM, crossingAlong + 5); s += 5) {
        expect(world.curveRadiusAt(road, s), `${p.cannon.id} at ${s}`).toBeUndefined();
      }
      const x = p.pointXM + (p.cannon.kind === 'headOn' ? -1 : 1) * Math.cos(p.headingRad) * run;
      const z = p.pointZM + (p.cannon.kind === 'headOn' ? -1 : 1) * Math.sin(p.headingRad) * run;
      expect(world.surfaceIdAt(x, z), p.cannon.id).not.toBe('ice');
      for (const v of def.boosts) {
        const near = road.line.nearest(v.xM, v.zM)!;
        if (near.distM > 6) continue;
        const behind = crossingAlong - near.alongM;
        expect(behind > -5 && behind < flightWindowM(p.cannon.kind), `${p.cannon.id}: vent ${v.id} ${behind.toFixed(0)} m before its crossing`).toBe(false);
      }
    }
  });

  it.runIf(def.cannons.length > 0)('keeps two crossings at least 2 s of the fastest motor apart (hits at least 2 s apart)', () => {
    const run = b.roadsideOffsetM / Math.tan(b.angleDeg * DEG);
    const byRoad = new Map<string, number[]>();
    for (const p of placed) byRoad.set(p.roadId, [...(byRoad.get(p.roadId) ?? []), p.alongM + (p.cannon.kind === 'headOn' ? -run : run)]);
    for (const [road, xs] of byRoad) {
      const sorted = [...xs].sort((p, q) => p - q);
      for (let i = 1; i < sorted.length; i++) expect(sorted[i]! - sorted[i - 1]!, `road ${road}`).toBeGreaterThanOrEqual(b.minHitGapS * FASTEST_MPS);
    }
  });
});

describe('Geyser Canyon and Iron Ridge', () => {
  it('keep their launchers: seven in the canyon (four on the vent lane), one on Iron Ridge', () => {
    expect(loadLevelDef('geyser-canyon').cannons).toHaveLength(7);
    expect(loadLevelDef('iron-ridge').cannons).toHaveLength(1);
  });
});
