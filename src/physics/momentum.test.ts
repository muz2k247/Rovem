import { describe, expect, it } from 'vitest';
import { applyImpulse, shareMomentum, shareMomentumVectors } from './momentum.ts';
import { createState } from './step.ts';

const closeRounded = (actual: number, expected: number) =>
  expect(Math.abs(actual - expected) / Math.abs(expected)).toBeLessThan(1e-5);
const close = (actual: number, expected: number) =>
  expect(Math.abs(actual - expected) / Math.abs(expected)).toBeLessThan(1e-9);

const M = 209; // starting build

describe('applyImpulse: u′ = u + J/m', () => {
  it('boost J = 1200 N·s from 16 m/s gives 21.741627 m/s', () => {
    const s = applyImpulse(createState({ speedMps: 16, throttleLevel: 1 }), M, 1200);
    close(s.speedMps, 16 + 1200 / 209);
    closeRounded(s.speedMps, 21.741627);
    expect(s.direction).toBe('forward');
  });
  it('changes nothing but speed and direction', () => {
    const before = createState({ speedMps: 16, throttleLevel: 1, headingRad: 0.2, positionXM: 7, distanceM: 9 });
    const after = applyImpulse(before, M, 1200);
    expect({ ...after, speedMps: before.speedMps }).toEqual(before);
  });
  it('does not change the input state', () => {
    const before = createState({ speedMps: 16 });
    applyImpulse(before, M, 1200);
    expect(before.speedMps).toBe(16);
  });
  it('a push along a reversing rover slows it (signed velocity)', () => {
    const s = applyImpulse(createState({ speedMps: 4, direction: 'reverse' }), M, 209);
    close(s.speedMps, 3); // u = −4, u′ = −3
    expect(s.direction).toBe('reverse');
  });
  it('an impulse against the motion that overshoots flips the direction', () => {
    const s = applyImpulse(createState({ speedMps: 1 }), M, -418);
    close(s.speedMps, 1); // u′ = 1 − 2 = −1
    expect(s.direction).toBe('reverse');
  });
});

describe('shareMomentum: m₁u₁ + m₂u₂ = (m₁ + m₂)u′', () => {
  it('head-on bag, 40 kg at 10 m/s, from 16 m/s gives 11.823293 m/s', () => {
    const s = shareMomentum(createState({ speedMps: 16 }), M, 40, -10);
    close(s.speedMps, (209 * 16 - 40 * 10) / 249);
    closeRounded(s.speedMps, 11.823293);
    expect(s.direction).toBe('forward');
  });
  it('kicker bag, 40 kg at 30 m/s, from 16 m/s gives 18.248996 m/s', () => {
    const s = shareMomentum(createState({ speedMps: 16 }), M, 40, 30);
    close(s.speedMps, (209 * 16 + 40 * 30) / 249);
    closeRounded(s.speedMps, 18.248996);
  });
  it('head-on bag at 1 m/s pushes the rover into reverse at 0.767068 m/s', () => {
    const s = shareMomentum(createState({ speedMps: 1 }), M, 40, -10);
    close(s.speedMps, 191 / 249);
    closeRounded(s.speedMps, 0.767068);
    expect(s.direction).toBe('reverse');
  });
  it('u′ = 0 stops the rover and keeps its direction', () => {
    const s = shareMomentum(createState({ speedMps: 4 }), 100, 50, -8);
    expect(s.speedMps).toBe(0);
    expect(s.direction).toBe('forward');
    const r = shareMomentum(createState({ speedMps: 4, direction: 'reverse' }), 100, 50, 8);
    expect(r.speedMps).toBe(0);
    expect(r.direction).toBe('reverse');
  });
  it('a reversing rover hit from behind uses signed velocity', () => {
    // u = −2, bag +6: (100·(−2) + 50·6)/150 = 100/150
    const s = shareMomentum(createState({ speedMps: 2, direction: 'reverse' }), 100, 50, 6);
    close(s.speedMps, 100 / 150);
    expect(s.direction).toBe('forward');
  });
  it('changes nothing but speed and direction', () => {
    const before = createState({ speedMps: 16, headingRad: 0.1, positionXM: 3, brakeLevel: 0.2 });
    const after = shareMomentum(before, M, 40, -10);
    expect({ ...after, speedMps: before.speedMps }).toEqual(before);
  });
});

describe('shareMomentumVectors: (m₁ + m₂) v′ = m₁ v₁ + m₂ v₂ with velocities as vectors (R11, DECISIONS 2026-10-26 (5))', () => {
  const DEG = Math.PI / 180;
  const BAG = 40;
  const along = (headingRad: number, u: number) => ({ x: u * Math.cos(headingRad), z: u * Math.sin(headingRad) });
  const dot = (a: { x: number; z: number }, headingRad: number) => a.x * Math.cos(headingRad) + a.z * Math.sin(headingRad);

  it('gives exactly the one-line rule for a bag at 0° (from behind) and 180° (head-on), at any heading and in either gear', () => {
    for (const headingRad of [0, 0.7, -2.1, Math.PI]) {
      for (const direction of ['forward', 'reverse'] as const) {
        for (const speedMps of [0, 1, 4, 16]) {
          for (const bagAlongMps of [-30, -12, -10, 10, 30]) {
            const state = createState({ speedMps, direction, headingRad });
            const old = shareMomentum(state, M, BAG, bagAlongMps);
            const u1 = direction === 'forward' ? speedMps : -speedMps;
            const v = shareMomentumVectors(M, along(headingRad, u1), BAG, along(headingRad, bagAlongMps));
            // Same speed, and the same sign of the velocity along the heading (the gear the rover ends up in).
            expect(Math.hypot(v.x, v.z)).toBeCloseTo(old.speedMps, 12);
            const u3 = dot(v, headingRad);
            if (old.speedMps > 1e-12) expect(u3 > 0 ? 'forward' : 'reverse').toBe(old.direction);
            expect(u3).toBeCloseTo(old.direction === 'forward' ? old.speedMps : -old.speedMps, 12);
          }
        }
      }
    }
  });

  it('reproduces the audit check values to 12 decimals: 209 kg at 14 m/s with a 10 m/s bag head-on gives 10.144578313253 m/s', () => {
    const v = shareMomentumVectors(209, { x: 14, z: 0 }, 40, { x: -10, z: 0 });
    expect(v.x).toBeCloseTo(10.144578313253, 12);
    expect(v.z).toBe(0);
    const k = shareMomentumVectors(209, { x: 16, z: 0 }, 40, { x: 30, z: 0 });
    expect(k.x).toBeCloseTo(18.248995983936, 12);
  });

  it('a head-on bag at 12 m/s and 30° slows the starting build at 16 m/s to 11.76 m/s along the road and bends its path 4.7°', () => {
    // The launcher is on the left; the bag flies back toward the rover and across the road: (−cos 30°, −sin 30°) × 12.
    const bag = { x: -12 * Math.cos(30 * DEG), z: -12 * Math.sin(30 * DEG) };
    const v = shareMomentumVectors(209, { x: 16, z: 0 }, 40, bag);
    close(v.x, (209 * 16 + 40 * bag.x) / 249);
    expect(v.x).toBeCloseTo(11.7603, 4);
    close(v.z, (40 * bag.z) / 249);
    expect(v.z).toBeCloseTo(-0.9639, 4);
    expect(Math.hypot(v.x, v.z)).toBeCloseTo(11.7997, 4);
    expect(Math.abs(Math.atan2(v.z, v.x)) / DEG).toBeCloseTo(4.685, 2);
  });

  it('a kicker bag at 30 m/s and 30° speeds it up to 17.60 m/s along the road and bends its path 7.8°', () => {
    const bag = { x: 30 * Math.cos(30 * DEG), z: -30 * Math.sin(30 * DEG) };
    const v = shareMomentumVectors(209, { x: 16, z: 0 }, 40, bag);
    expect(v.x).toBeCloseTo(17.6033, 4);
    expect(Math.abs(Math.atan2(v.z, v.x)) / DEG).toBeCloseTo(7.8, 1);
  });

  it('a bag from behind slower along the road than the rover slows it (20 m/s at 45°: 14.1 m/s along the road)', () => {
    const bag = { x: 20 * Math.cos(45 * DEG), z: -20 * Math.sin(45 * DEG) };
    const v = shareMomentumVectors(209, { x: 16, z: 0 }, 40, bag);
    expect(v.x).toBeLessThan(16);
    expect(v.x).toBeCloseTo(15.7015, 4);
  });

  it('keeps momentum in both directions: m₁v₁ + m₂v₂ = (m₁ + m₂)v′', () => {
    const v1 = { x: 11, z: -3 };
    const v2 = { x: -7, z: 9 };
    const v = shareMomentumVectors(251, v1, BAG, v2);
    close((251 + BAG) * v.x, 251 * v1.x + BAG * v2.x);
    close((251 + BAG) * v.z, 251 * v1.z + BAG * v2.z);
  });

  it('does not change its arguments', () => {
    const v1 = { x: 3, z: 4 };
    shareMomentumVectors(209, v1, 40, { x: 1, z: 1 });
    expect(v1).toEqual({ x: 3, z: 4 });
  });
});
