import { describe, expect, it } from 'vitest';
import { createLaunchScene, thrustOverWeight } from './launchScene.ts';

const run = (scene: ReturnType<typeof createLaunchScene>, toS: number) => {
  while (scene.timeS < toS - 1e-9) scene.update(Math.min(1 / 60, toS - scene.timeS));
};

describe('the launch scene (SHOWCASE_PLAN §12, R8)', () => {
  it('thrust over weight is 0 before ignition, rises, and stops at its ceiling', () => {
    expect(thrustOverWeight(-1)).toBe(0);
    expect(thrustOverWeight(0)).toBe(0);
    expect(thrustOverWeight(2)).toBeCloseTo(1, 12);
    expect(thrustOverWeight(100)).toBe(1.5);
  });

  it('the ship stays on the pad until thrust beats weight, then climbs', () => {
    const s = createLaunchScene(3.5);
    run(s, 3.4);
    expect(s.heightM).toBe(0);
    run(s, 5.5); // thrust = weight exactly 2 s after ignition: still no net force
    expect(s.heightM).toBe(0);
    run(s, 7);
    expect(s.heightM).toBeGreaterThan(0);
    const at7 = s.heightM;
    run(s, 10);
    expect(s.heightM).toBeGreaterThan(at7);
  });

  it('climbs by the hand-worked rule: a = g (ratio − 1), checked at 10 s', () => {
    // ratio = 0.5 (t − 3.5), so ratio − 1 = 0.5 (t − 5.5); the ceiling 1.5 is reached at t = 6.5 s.
    // For 5.5 ≤ t ≤ 6.5: v = 9.8 · 0.25 (t − 5.5)², so v(6.5) = 2.45 and h(6.5) = 9.8 · 0.25 / 3 = 0.8167.
    // After that a = 9.8 · 0.5 = 4.9: h(10) = 0.8167 + 2.45 · 3.5 + ½ · 4.9 · 3.5² = 39.4.
    const s = createLaunchScene(3.5);
    run(s, 10);
    expect(s.heightM).toBeCloseTo(0.8167 + 2.45 * 3.5 + 0.5 * 4.9 * 3.5 ** 2, 0);
  });

  it('is the same however the frames are cut', () => {
    const a = createLaunchScene(3.5);
    const b = createLaunchScene(3.5);
    for (let i = 0; i < 600; i++) a.update(1 / 60);
    for (let i = 0; i < 300; i++) b.update(1 / 30);
    expect(a.heightM).toBeCloseTo(b.heightM, 9);
  });

  it('keeps the camera finite and looking at the ship, and disposes cleanly', () => {
    const s = createLaunchScene(3.5);
    s.setAspect(0.6);
    run(s, 10);
    for (const v of s.camera.position.toArray()) expect(Number.isFinite(v)).toBe(true);
    expect(s.camera.position.y).toBeGreaterThan(3);
    s.dispose();
  });
});
