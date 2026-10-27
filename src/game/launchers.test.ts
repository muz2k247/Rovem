import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import { bagVelocity, launcherDirectionRad, launcherShouldFire as shouldFire } from './launchers.ts';

// Roadside launchers (R11, DECISIONS 2026-10-26 (5)): 30° to the road, aimed where the rover will be if it keeps its current velocity.

const DEG = Math.PI / 180;
const SPEED_HEAD_ON = 12;
const SPEED_KICKER = 30;
const MIN_AIM = content.run.sandbag.minAimSpeedMps;
const launcherShouldFire = (l: Parameters<typeof shouldFire>[0], p: Parameters<typeof shouldFire>[1], v: Parameters<typeof shouldFire>[2]) => shouldFire(l, p, v, MIN_AIM);

describe('the direction a launcher fires', () => {
  it('a head-on launcher on the left of an east-bound road fires back along it and across it, 30° off the road', () => {
    // Road heading 0 (east); left is +z. The bag flies west and toward the centre line (z decreasing).
    const d = launcherDirectionRad('headOn', 0, 11, 30 * DEG);
    expect(Math.cos(d)).toBeCloseTo(-Math.cos(30 * DEG), 12);
    expect(Math.sin(d)).toBeCloseTo(-Math.sin(30 * DEG), 12);
  });

  it('a kicker on the right fires forward and across, toward the centre line', () => {
    const d = launcherDirectionRad('kicker', 0, -11, 30 * DEG);
    expect(Math.cos(d)).toBeCloseTo(Math.cos(30 * DEG), 12);
    expect(Math.sin(d)).toBeCloseTo(Math.sin(30 * DEG), 12); // right is −z, so toward the road is +z
  });

  it('follows the road heading: on a road heading +z the same launcher turns with it', () => {
    const d = launcherDirectionRad('headOn', 90 * DEG, 11, 30 * DEG);
    // Left of a road heading +z is −x; the bag flies along −z and toward +x.
    expect(Math.cos(d)).toBeCloseTo(Math.sin(30 * DEG), 12);
    expect(Math.sin(d)).toBeCloseTo(-Math.cos(30 * DEG), 12);
  });

  it('makes a velocity of the bag speed', () => {
    const v = bagVelocity(launcherDirectionRad('kicker', 0, 11, 30 * DEG), SPEED_KICKER);
    expect(Math.hypot(v.x, v.z)).toBeCloseTo(30, 12);
  });
});

describe('when a launcher fires: so that the bag meets a rover that keeps its velocity', () => {
  const headOnLeft = { position: { x: 100, z: 11 }, velocity: bagVelocity(launcherDirectionRad('headOn', 0, 11, 30 * DEG), SPEED_HEAD_ON) };
  const fires = (xM: number) => launcherShouldFire(headOnLeft, { x: xM, z: 0 }, { x: 16, z: 0 });

  it('the bag crosses the centre line 11 ÷ tan 30° = 19.05 m back along the road from the launcher, after 22 m of flight (1.833 s at 12 m/s)', () => {
    // The crossing point is x = 100 − 19.05 = 80.95. The rover needs (80.95 − x) ÷ 16 s to get there and must be 1.833 s away:
    // x = 80.95 − 16 × 1.833 = 51.62.
    expect(fires(20)).toBe(false); // still too far: the bag would arrive before the rover
    expect(fires(51.5)).toBe(false);
    expect(fires(51.7)).toBe(true); // from here on the rover has no more than the bag's flight to go
  });

  it('does not fire when the rover has already passed the crossing point', () => {
    expect(fires(95)).toBe(false);
  });

  it('does not aim at a rover slower than 1 m/s (run.sandbag.minAimSpeedMps)', () => {
    expect(MIN_AIM).toBe(1);
    expect(launcherShouldFire(headOnLeft, { x: 90, z: 0 }, { x: 0.9, z: 0 })).toBe(false);
  });

  it('does not fire at a rover that is standing still or driving away from the crossing point', () => {
    expect(launcherShouldFire(headOnLeft, { x: 60, z: 0 }, { x: 0, z: 0 })).toBe(false);
    expect(launcherShouldFire(headOnLeft, { x: 60, z: 0 }, { x: -16, z: 0 })).toBe(false);
  });

  it('a kicker fires just after the rover has passed it, and meets it', () => {
    const kicker = { position: { x: 0, z: -11 }, velocity: bagVelocity(launcherDirectionRad('kicker', 0, -11, 30 * DEG), SPEED_KICKER) };
    // Crossing point: z = 0 at x = 19.05, flight 22 m ÷ 30 = 0.733 s. The rover at 16 m/s is 0.733 s from it at x = 19.05 − 11.73 = 7.3.
    expect(launcherShouldFire(kicker, { x: 7.5, z: 0 }, { x: 16, z: 0 })).toBe(true);
    expect(launcherShouldFire(kicker, { x: 4, z: 0 }, { x: 16, z: 0 })).toBe(false); // the bag, faster, would get there first
  });

  it('a rover that slows after the shot is no longer where the bag arrives', () => {
    // Fired at x = 51.62 at 16 m/s: the rover would reach the crossing point after 29.33 m ÷ 16 = 1.833 s. At 8 m/s it takes 3.67 s.
    const bagArrivesS = 22 / SPEED_HEAD_ON;
    const roverS = (speed: number) => (100 - 11 / Math.tan(30 * DEG) - 51.62) / speed;
    expect(roverS(16)).toBeCloseTo(bagArrivesS, 2);
    expect(Math.abs(roverS(8) - bagArrivesS)).toBeGreaterThan(1.5);
  });
});
