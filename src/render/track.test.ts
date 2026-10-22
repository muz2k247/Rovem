import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { worldOf } from './levelTestKit.ts';
import { createTrack, DASH_PERIOD_M, roadMarks, directionAt } from './track.ts';

describe('road geometry helpers', () => {
  it('directionAt gives the heading of the road at a distance along it', () => {
    const world = worldOf();
    expect(directionAt(world.roads[0]!.line, 150)).toBeCloseTo(0, 9);
    // the bend turns left 90°, so it ends heading +z
    const bend = world.roads[1]!.line;
    expect(directionAt(bend, bend.lengthM - 0.01)).toBeCloseTo(Math.PI / 2, 1);
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
