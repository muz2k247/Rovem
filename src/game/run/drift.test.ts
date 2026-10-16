import { describe, expect, it } from 'vitest';
import { slideAngleRad, travelTurnLimitRadPerS, turnTravelDirection, wrapAngle } from './drift.ts';

const deg = (rad: number) => (rad * 180) / Math.PI;
const rad = (d: number) => (d * Math.PI) / 180;

// Tyres bend the path at most (grip × wheel grip factor × g) ÷ v: the centripetal acceleration v·ω can be at most μ g.
describe('how fast the tyres can turn the path (DECISIONS 2026-10-16, drifting)', () => {
  it('asphalt, All-terrain, g = 9.8, 16 m/s: 0.8 × 9.8 ÷ 16 = 0.49 rad/s = 28.07°/s', () => {
    const limit = travelTurnLimitRadPerS(0.8, 1, 9.8, 16);
    expect(limit).toBeCloseTo(0.49, 12);
    expect(deg(limit)).toBeCloseTo(28.07, 2);
  });
  it('mud: 17.5°/s; ice: 3.5°/s (same rover, same speed)', () => {
    expect(deg(travelTurnLimitRadPerS(0.5, 1, 9.8, 16))).toBeCloseTo(17.5, 1);
    expect(deg(travelTurnLimitRadPerS(0.1, 1, 9.8, 16))).toBeCloseTo(3.5, 1);
  });
  it('the wheels and the zone matter: Spiked wheels grip more, high gravity presses harder', () => {
    expect(travelTurnLimitRadPerS(0.8, 1.4, 9.8, 16)).toBeCloseTo(1.4 * 0.49, 12);
    expect(travelTurnLimitRadPerS(0.8, 1, 19.6, 16)).toBeCloseTo(2 * 0.49, 12);
  });
  it('slower = turns faster: half the speed, twice the limit; at rest there is no limit', () => {
    expect(travelTurnLimitRadPerS(0.8, 1, 9.8, 8)).toBeCloseTo(2 * travelTurnLimitRadPerS(0.8, 1, 9.8, 16), 12);
    expect(travelTurnLimitRadPerS(0.8, 1, 9.8, 0)).toBe(Infinity);
  });
});

describe('the travel direction follows the way the rover points, at most as fast as the tyres allow', () => {
  const dt = 1 / 120;
  it('no slide below the limit: a turn slower than the limit is followed exactly', () => {
    // Steering 20°/s at 16 m/s on asphalt (limit 28.07°/s): the travel direction equals the target at every step.
    let travel = 0;
    let target = 0;
    for (let i = 0; i < 240; i++) {
      target += rad(20) * dt;
      travel = turnTravelDirection(travel, target, travelTurnLimitRadPerS(0.8, 1, 9.8, 16), dt);
      expect(travel).toBe(target);
    }
    expect(slideAngleRad(travel, target)).toBe(0);
  });
  it('above the limit the travel direction turns at the limit and the slide angle grows: 60°/s for 1 s on asphalt at 16 m/s', () => {
    let travel = 0;
    let target = 0;
    const limit = travelTurnLimitRadPerS(0.8, 1, 9.8, 16);
    for (let i = 0; i < 120; i++) {
      target += rad(60) * dt;
      travel = turnTravelDirection(travel, target, limit, dt);
    }
    expect(deg(travel)).toBeCloseTo(28.07, 1); // 120 steps of limit × Δt
    expect(deg(slideAngleRad(travel, target))).toBeCloseTo(60 - 28.07, 1);
  });
  it('slower = less slide: the same steering at 8 m/s slides less than at 16 m/s', () => {
    const slideAfter = (v: number) => {
      let travel = 0;
      let target = 0;
      for (let i = 0; i < 120; i++) {
        target += rad(60) * dt;
        travel = turnTravelDirection(travel, target, travelTurnLimitRadPerS(0.8, 1, 9.8, v), dt);
      }
      return slideAngleRad(travel, target);
    };
    expect(slideAfter(8)).toBeLessThan(slideAfter(16));
    expect(deg(slideAfter(8))).toBeCloseTo(60 - deg(0.98), 1); // 8 m/s: limit 0.98 rad/s = 56.15°/s, so only a small slide
  });
  it('catches up when the steering stops, at the limit', () => {
    const limit = travelTurnLimitRadPerS(0.8, 1, 9.8, 16);
    let travel = 0;
    const target = rad(30);
    let steps = 0;
    while (slideAngleRad(travel, target) > 0 && steps < 1000) {
      travel = turnTravelDirection(travel, target, limit, dt);
      steps++;
    }
    expect(travel).toBe(target);
    expect(steps).toBe(Math.ceil(target / (limit * dt)));
  });
  it('turns the short way round (through ±180°)', () => {
    const limit = 1;
    const next = turnTravelDirection(rad(170), rad(-170), limit, 0.01);
    expect(next).toBeCloseTo(rad(170) + 0.01, 12);
    expect(wrapAngle(rad(190))).toBeCloseTo(rad(-170), 12);
  });
  it('at rest it snaps: an infinite limit gives the target at once', () => {
    expect(turnTravelDirection(0, rad(120), Infinity, dt)).toBe(rad(120));
  });
});
