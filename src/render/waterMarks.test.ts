import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { content } from '../content/index.ts';
import { loadLevelDef } from '../game/level/levels.ts';
import { createLevelWorld } from '../game/level/world.ts';
import { POST_BANDS_M, createDepthPosts, createWake, createWaterLine, depthPostsFor } from './waterMarks.ts';

// The water made visible (R12, DECISIONS 2026-10-26 (6)): depth posts, a water line on the rover, a wake.

const world = createLevelWorld(loadLevelDef('the-crossing'), content);

describe('depth posts', () => {
  const posts = depthPostsFor(world);

  it('are banded at the three depths of the water rule', () => {
    expect([...POST_BANDS_M]).toEqual([0.3, 0.5, 1.0]);
    expect([...new Set(world.def.water.map((w) => w.depthM))].sort()).toEqual([...POST_BANDS_M]);
  });

  it('stand one before each pool, showing that pool’s depth', () => {
    const before = posts.filter((p) => p.where === 'water');
    expect(before.map((p) => p.depthM).sort()).toEqual([0.3, 0.5, 1.0]);
  });

  it('put a second 1.0 m post at the fork, so the deep crossing is known before the road is chosen', () => {
    const atFork = posts.filter((p) => p.where === 'fork');
    expect(atFork).toHaveLength(1);
    expect(atFork[0]!.depthM).toBe(1.0);
    const fork = world.def.forks[0]!;
    expect(Math.hypot(atFork[0]!.xM - fork.line.xM, atFork[0]!.zM - fork.line.zM)).toBeLessThan(20);
  });

  it('stand beside the road, outside its edge, and before the water on the way in', () => {
    for (const p of posts) {
      const hit = world.roadAt(p.xM, p.zM)!;
      expect(hit, `${p.depthM} m post on a road's reach`).toBeDefined();
      expect(hit.distM, `${p.depthM} m post`).toBeGreaterThan(hit.road.widthM / 2);
      expect(world.waterDepthM(p.xM, p.zM), `${p.depthM} m post is dry`).toBe(0);
    }
    for (const p of posts.filter((x) => x.where === 'water')) {
      const pool = world.def.water.find((w) => w.depthM === p.depthM)!;
      const pc = pool.polygon.reduce((a, q) => ({ x: a.x + q.xM / 4, z: a.z + q.zM / 4 }), { x: 0, z: 0 });
      // Before the pool along the way of travel: the post is behind the pool's centre.
      const ahead = (pc.x - p.xM) * Math.cos(p.headingRad) + (pc.z - p.zM) * Math.sin(p.headingRad);
      expect(ahead, `${p.depthM} m post`).toBeGreaterThan(0);
    }
  });

  it('are meshes with a pole, three bands and a board each, and give everything back on dispose', () => {
    const view = createDepthPosts(world);
    expect(view.group.children).toHaveLength(posts.length);
    for (const post of view.group.children) expect(post.children).toHaveLength(1 + POST_BANDS_M.length + 1);
    view.dispose();
  });

  it('are none on a level without water', () => {
    expect(depthPostsFor(createLevelWorld(loadLevelDef('crash-site'), content))).toEqual([]);
  });
});

describe('the water line on the rover', () => {
  it('shows only while the rover is in water, at the surface, turned with the rover', () => {
    const line = createWaterLine(2.6, 1.7);
    expect(line.group.visible).toBe(false);
    line.update({ inWater: true, xM: 10, zM: 4, headingRad: 0.5, surfaceYM: 2 });
    expect(line.group.visible).toBe(true);
    expect(line.group.position.x).toBe(10);
    expect(line.group.position.z).toBe(-4);
    expect(line.group.position.y).toBeCloseTo(2.03, 9);
    expect(line.group.rotation.y).toBe(0.5);
    line.update({ inWater: false, xM: 10, zM: 4, headingRad: 0.5, surfaceYM: 2 });
    expect(line.group.visible).toBe(false);
    line.dispose();
  });
});

describe('the wake', () => {
  const input = (inWater: boolean, speedMps: number) => ({ yM: 1, speedMps, inWater, rearXM: 10, rearZM: 0 });

  it('spreads rings behind a rover moving in water, and they die away after it leaves', () => {
    const scene = new THREE.Scene();
    const wake = createWake(scene);
    expect(wake.liveCount).toBe(0);
    for (let i = 0; i < 40; i++) wake.update(0.05, input(true, 8));
    expect(wake.liveCount).toBeGreaterThan(3);
    for (let i = 0; i < 60; i++) wake.update(0.05, input(false, 8));
    expect(wake.liveCount).toBe(0);
    wake.dispose();
  });

  it('makes none for a rover that is out of the water or hardly moving', () => {
    const wake = createWake(new THREE.Scene());
    for (let i = 0; i < 40; i++) wake.update(0.05, input(false, 12));
    for (let i = 0; i < 40; i++) wake.update(0.05, input(true, 0.2));
    expect(wake.liveCount).toBe(0);
    wake.dispose();
  });
});
