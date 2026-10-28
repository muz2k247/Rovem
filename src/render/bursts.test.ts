import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BURSTS, BURST_POOL, createBursts, type BurstKind } from './bursts.ts';

const KINDS = Object.keys(BURSTS) as BurstKind[];

describe('burst recipes', () => {
  it('cover the particles of §10 (spray, splash, shards, steam, sparks, debris, water) and the gold sparkle of a sample (R14)', () => {
    expect(KINDS.sort()).toEqual(['debris', 'goldSparkle', 'iceShards', 'mudSplash', 'sandSpray', 'sparks', 'steam', 'waterSplash']);
  });

  it('are small, short and sensible: a few dozen particles living a second or less, steam the longest', () => {
    for (const k of KINDS) {
      const b = BURSTS[k];
      expect(b.count, k).toBeGreaterThan(5);
      expect(b.count, k).toBeLessThanOrEqual(60);
      expect(b.lifeS, k).toBeGreaterThan(0.2);
      expect(b.lifeS, k).toBeLessThanOrEqual(1.2);
      expect(b.size, k).toBeGreaterThan(0.04);
    }
    expect(BURSTS.steam.lifeS).toBe(Math.max(...KINDS.map((k) => BURSTS[k].lifeS)));
    expect(BURSTS.steam.gravity).toBeLessThan(0); // steam rises
    expect(BURSTS.sandSpray.gravity).toBeGreaterThan(0); // sand falls
  });

  it('each is its own colour, so a student can tell them apart', () => {
    expect(new Set(KINDS.map((k) => BURSTS[k].colour)).size).toBe(KINDS.length);
  });
});

describe('the burst pool', () => {
  const make = () => {
    const scene = new THREE.Scene();
    return { scene, bursts: createBursts(scene) };
  };

  it('adds a burst of the recipe size, and the particles are gone after their life', () => {
    const { bursts } = make();
    bursts.emit('sandSpray', 10, 0.2, -3, 1, 0);
    expect(bursts.liveCount).toBe(BURSTS.sandSpray.count);
    bursts.update(BURSTS.sandSpray.lifeS * 0.5);
    expect(bursts.liveCount).toBe(BURSTS.sandSpray.count);
    bursts.update(BURSTS.sandSpray.lifeS * 0.6);
    expect(bursts.liveCount).toBe(0);
  });

  it('flies away from the point it was made, and sand falls back to the ground and stays above it', () => {
    const { scene, bursts } = make();
    bursts.emit('sandSpray', 0, 0.3, 0, 1, 0);
    const points = scene.getObjectByName('burst-sandSpray') as THREE.Points;
    const pos = points.geometry.getAttribute('position');
    for (let i = 0; i < 30; i++) bursts.update(0.02);
    let moved = false;
    for (let i = 0; i < BURSTS.sandSpray.count; i++) {
      if (Math.hypot(pos.getX(i), pos.getZ(i)) > 0.2) moved = true;
      expect(pos.getY(i)).toBeGreaterThanOrEqual(0);
    }
    expect(moved).toBe(true);
  });

  it('never grows past the pool: the oldest particles are reused', () => {
    const { bursts } = make();
    for (let i = 0; i < 40; i++) bursts.emit('debris', 0, 0.2, 0, 1, 0);
    expect(bursts.liveCount).toBeLessThanOrEqual(BURST_POOL); // one pool for each kind
  });

  it('makes the same burst every time (a fixed-seed generator: the look is the same every run)', () => {
    const a = make();
    const b = make();
    a.bursts.emit('sparks', 1, 0.5, 2, 0, 1);
    b.bursts.emit('sparks', 1, 0.5, 2, 0, 1);
    a.bursts.update(0.1);
    b.bursts.update(0.1);
    const pa = (a.scene.getObjectByName('burst-sparks') as THREE.Points).geometry.getAttribute('position').array;
    const pb = (b.scene.getObjectByName('burst-sparks') as THREE.Points).geometry.getAttribute('position').array;
    expect([...pa]).toEqual([...pb]);
  });

  it('removes itself from the scene when disposed', () => {
    const { scene, bursts } = make();
    bursts.dispose();
    expect(scene.getObjectByName('bursts')).toBeUndefined();
  });
});
