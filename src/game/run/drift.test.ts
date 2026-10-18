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

// Game v4 (LEVELS_BUILD_PLAN A6): the grip limit uses the normal force R, and a magnet's sideways part bends the path.
import { sidewaysBendRadPerS, travelTurnLimitFromNormalRadPerS } from './drift.ts';

describe('turning limit with R: ω_max = μ_g k_g R ÷ (m v)', () => {
  it('flat dry ground (R = m g) gives exactly the old limit', () => {
    const today = travelTurnLimitRadPerS(0.8, 1, 9.8, 16);
    expect(travelTurnLimitFromNormalRadPerS(0.8, 1, 209 * 9.8, 209, 16)).toBeCloseTo(today, 12);
  });
  it('a ramp presses less (cos 12°), and R = 0 cannot turn at all', () => {
    const flat = travelTurnLimitFromNormalRadPerS(0.8, 1, 2048.2, 209, 16);
    const ramp = travelTurnLimitFromNormalRadPerS(0.8, 1, 2003.44, 209, 16);
    expect(ramp / flat).toBeCloseTo(2003.44 / 2048.2, 12);
    expect(travelTurnLimitFromNormalRadPerS(0.8, 1, 0, 209, 16)).toBe(0);
    expect(travelTurnLimitFromNormalRadPerS(0.8, 1, 0, 209, 0)).toBe(0);
    expect(travelTurnLimitFromNormalRadPerS(0.8, 1, 2048.2, 209, 0)).toBe(Infinity);
  });
  it('Ring Road: at the safe speed √(μ_g k_g g r) the limit equals v ÷ r', () => {
    for (const [r, safe] of [[12, 9.7], [25, 14.0], [30, 15.34], [40, 17.71]] as const) {
      const v = Math.sqrt(0.8 * 9.8 * r);
      expect(v).toBeCloseTo(safe, 1);
      expect(travelTurnLimitFromNormalRadPerS(0.8, 1, 209 * 9.8, 209, v)).toBeCloseTo(v / r, 10);
    }
  });
});

describe('sideways force bends the path by ω = F⊥ ÷ (m v)', () => {
  it('625 N on 209 kg at 10 m/s: 0.299 rad/s; the sign follows the force', () => {
    expect(sidewaysBendRadPerS(625, 209, 10, 0.5)).toBeCloseTo(625 / 2090, 12);
    expect(sidewaysBendRadPerS(-625, 209, 10, 0.5)).toBeCloseTo(-625 / 2090, 12);
  });
  it('is ignored below 0.5 m/s, so ω stays finite', () => {
    expect(sidewaysBendRadPerS(1600, 209, 0.49, 0.5)).toBe(0);
    expect(sidewaysBendRadPerS(1600, 209, 0, 0.5)).toBe(0);
    expect(Number.isFinite(sidewaysBendRadPerS(1600, 209, 0.5, 0.5))).toBe(true);
  });
});
