import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { worldOf } from './levelTestKit.ts';
import { BANK_M, BODY_HALF_HEIGHT_M, createSplashes, createWater, roverRideHeightM, waterBedDropM, waterSurfaceYM } from './water.ts';

const pool = { id: 'river', depthM: 1, polygon: [{ xM: 100, zM: -10 }, { xM: 120, zM: -10 }, { xM: 120, zM: 10 }, { xM: 100, zM: 10 }] };

describe('water', () => {
  it('the bed drops by the depth, easing in over the bank, and is zero outside', () => {
    const world = worldOf({ water: [pool] });
    expect(waterBedDropM(world, 90, 0)).toBe(0);
    expect(waterBedDropM(world, 110, 0)).toBe(1);
    expect(waterBedDropM(world, 100 + BANK_M / 2, 0)).toBeCloseTo(0.5, 9);
    expect(waterBedDropM(world, 100, 0)).toBeCloseTo(0, 9);
  });

  it('the surface is flush with the ground around the pool', () => {
    const world = worldOf({ water: [pool], hills: [{ xM: 110, zM: 0, radiusM: 60, heightM: 2 }] });
    const y = waterSurfaceYM(world, world.def.water[0]!);
    const edge = world.heightM(100, 10);
    expect(y).toBeGreaterThan(0);
    expect(Math.abs(y - edge)).toBeLessThan(0.5);
  });

  it('a rover that sinks rides on the bed; one that floats rides with the water line half way up its body', () => {
    const surfaceY = 3;
    expect(roverRideHeightM({ groundYM: surfaceY, bedDropM: 1, floating: false })).toBeCloseTo(2, 9);
    expect(roverRideHeightM({ groundYM: surfaceY, bedDropM: 1, floating: true })).toBeCloseTo(surfaceY - BODY_HALF_HEIGHT_M, 9);
    // a float in water too shallow to lift the body does not sink below the bed
    expect(roverRideHeightM({ groundYM: surfaceY, bedDropM: 0.2, floating: true })).toBeCloseTo(surfaceY - 0.2, 9);
  });

  it('builds one translucent surface per pool, and removes it on dispose', () => {
    const world = worldOf({ water: [pool, { ...pool, id: 'second', polygon: pool.polygon.map((p) => ({ xM: p.xM + 60, zM: p.zM })) }] });
    const water = createWater(world);
    const surfaces: THREE.Mesh[] = [];
    water.group.traverse((o) => {
      if (o.name === 'water') surfaces.push(o as THREE.Mesh);
    });
    expect(surfaces).toHaveLength(2);
    expect((surfaces[0]!.material as THREE.Material).transparent).toBe(true);
    water.update(1);
    water.dispose();
  });

  it('splashes appear while the rover moves in water, grow with speed and die away', () => {
    const scene = new THREE.Scene();
    const splashes = createSplashes(scene);
    expect(splashes.liveCount).toBe(0);
    for (let i = 0; i < 20; i++) splashes.update(0.05, { xM: 110, yM: 1, zM: 0, speedMps: 8, inWater: true, headingRad: 0 });
    const fast = splashes.liveCount;
    expect(fast).toBeGreaterThan(5);
    const slow = createSplashes(new THREE.Scene());
    for (let i = 0; i < 20; i++) slow.update(0.05, { xM: 110, yM: 1, zM: 0, speedMps: 1, inWater: true, headingRad: 0 });
    expect(slow.liveCount).toBeLessThan(fast);
    for (let i = 0; i < 100; i++) splashes.update(0.05, { xM: 110, yM: 1, zM: 0, speedMps: 8, inWater: false, headingRad: 0 });
    expect(splashes.liveCount).toBe(0);
    splashes.dispose();
  });

  it('entering the water throws a burst', () => {
    const splashes = createSplashes(new THREE.Scene());
    splashes.update(0.016, { xM: 100, yM: 1, zM: 0, speedMps: 6, inWater: false, headingRad: 0 });
    splashes.update(0.016, { xM: 100, yM: 1, zM: 0, speedMps: 6, inWater: true, headingRad: 0 });
    expect(splashes.liveCount).toBeGreaterThan(10);
  });
});
