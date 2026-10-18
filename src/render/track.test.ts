import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { worldOf } from './levelTestKit.ts';
import { canyonWallSpans, createTrack, DASH_PERIOD_M, roadMarks, WALL_HEIGHT_M, buildCanyonWalls, directionAt } from './track.ts';

const REACH = 9; // 5 m of road each side of the centre line plus 4 m of run-off

const branch = { id: 'branch', start: { xM: 100, zM: 0, headingDeg: 90 }, segments: [{ kind: 'straight', lengthM: 60 }] };

describe('road geometry helpers', () => {
  it('directionAt gives the heading of the road at a distance along it', () => {
    const world = worldOf();
    expect(directionAt(world.roads[0]!.line, 150)).toBeCloseTo(0, 9);
    // the bend turns left 90°, so it ends heading +z
    const bend = world.roads[1]!.line;
    expect(directionAt(bend, bend.lengthM - 0.01)).toBeCloseTo(Math.PI / 2, 1);
  });
});

describe('canyon walls', () => {
  it('stand at the edge of the run-off on both sides of the road', () => {
    const world = worldOf();
    const { sides } = canyonWallSpans(world);
    const straight = sides.filter((s) => s.ax > 20 && s.bx < 280);
    expect(straight.length).toBeGreaterThan(80);
    for (const s of straight) {
      expect(Math.abs(s.az)).toBeCloseTo(REACH, 6);
      expect(Math.abs(s.bz)).toBeCloseTo(REACH, 6);
    }
    expect(straight.some((s) => s.az > 0)).toBe(true);
    expect(straight.some((s) => s.az < 0)).toBe(true);
  });

  it('leave a gap where another road joins', () => {
    const plain = canyonWallSpans(worldOf()).sides.filter((s) => s.az > 0 && s.ax > 95 && s.bx < 105);
    const joined = canyonWallSpans(worldOf({ roads: [...(worldOf().def.roads as unknown[]), branch] })).sides.filter((s) => s.az > 0 && s.ax > 95 && s.bx < 105);
    expect(plain.length).toBeGreaterThan(0);
    expect(joined).toHaveLength(0);
  });

  it('close the road at its two ends, but not where the next road carries on', () => {
    const world = worldOf();
    const { caps } = canyonWallSpans(world);
    // behind the start: a wall across at x = −9
    expect(caps.some((c) => Math.abs(c.ax + REACH) < 1e-6 && Math.abs(c.bx + REACH) < 1e-6)).toBe(true);
    // the straight runs into the bend: no cap across the road at x = 300 + 9
    expect(caps.some((c) => c.ax > 300 && c.ax < 320 && Math.abs(c.ax - c.bx) < 1e-6 && Math.abs(c.az - c.bz) > 10)).toBe(false);
  });

  it('are drawn up from the ground, following the hills, and are tall', () => {
    const world = worldOf({ hills: [{ xM: 100, zM: 0, radiusM: 40, heightM: 4 }] });
    const geo = buildCanyonWalls(world);
    const p = geo.getAttribute('position');
    let highest = -Infinity;
    for (let i = 0; i < p.count; i++) {
      if (Math.abs(p.getX(i) - 100) < 2 && p.getY(i) > highest) highest = p.getY(i);
    }
    expect(highest).toBeGreaterThan(4 + WALL_HEIGHT_M - 1.5); // base at the hill top, plus the wall height (hill falls off to the side)
  });
});

describe('road marks', () => {
  it('dashes run down the middle of asphalt roads only', () => {
    const asphalt = roadMarks(worldOf());
    expect(asphalt.dashes.length).toBeGreaterThan(300 / DASH_PERIOD_M - 3);
    const sandy = roadMarks(worldOf({ roads: [{ id: 'main', surfaceId: 'sand', start: { xM: 0, zM: 0, headingDeg: 0 }, segments: [{ kind: 'straight', lengthM: 300 }] }], route: ['main'] }));
    expect(sandy.dashes).toHaveLength(0);
  });

  it('reflector posts stand along both edges of the road', () => {
    const { posts } = roadMarks(worldOf());
    expect(posts.some((p) => Math.abs(p.zM - 5.4) < 0.01)).toBe(true);
    expect(posts.some((p) => Math.abs(p.zM + 5.4) < 0.01)).toBe(true);
  });

  it('builds instanced meshes, cheap enough for Graphics Low', () => {
    const track = createTrack(worldOf(), { quality: 'low' });
    const kinds: string[] = [];
    track.group.traverse((o) => {
      if (o instanceof THREE.InstancedMesh) kinds.push(o.name);
    });
    expect(kinds.sort()).toEqual(['dashes', 'posts']);
    track.dispose();
  });
});
