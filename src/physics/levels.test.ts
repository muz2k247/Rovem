import { describe, expect, it } from 'vitest';
import { createState, motionSign, step, type PhysicsState, type StepEnvironment, type StepInput } from './step.ts';
import { buildQuantities } from './build.ts';
import { normalForceN, slopePullN } from './ground.ts';
import { floats, submersionFraction, upthrustN, waterDragNsPerM } from './water.ts';
import { magnetForceN, magnetOnRover } from './magnet.ts';
import { levelsConfig } from '../content/levelsConfig.ts';
import { constants, rover, roverOf, surface } from '../../tests/helpers/physics.ts';

// Game v4 physics (LEVELS_BUILD_PLAN A6). Standard build: m = 209 kg, g = 9.8, W = 2048.2 N, asphalt.
const rad = (deg: number) => (deg * Math.PI) / 180;
const closeTo = (actual: number, expected: number, rel = 1e-5) =>
  expect(Math.abs(actual - expected) / Math.abs(expected)).toBeLessThan(rel);

const HOLD: StepInput = { throttleHeld: true, brakeHeld: false, steer: 0 };
const NONE: StepInput = { throttleHeld: false, brakeHeld: false, steer: 0 };
const BRAKE: StepInput = { throttleHeld: false, brakeHeld: true, steer: 0 };
const W = 209 * 9.8;

function stepOnce(
  prev: PhysicsState,
  input: StepInput,
  env?: StepEnvironment,
  surfaceId = 'asphalt',
  externalForceN = 0,
  r = rover(),
) {
  return step(prev, input, r, surface(surfaceId), constants, externalForceN, env);
}

describe('ground push and slope pull (A6)', () => {
  it('R = m g cos θ − U, never below 0; flat dry ground is m g', () => {
    expect(normalForceN(209, 9.8, 0, 0)).toBe(209 * 9.8);
    closeTo(normalForceN(209, 9.8, rad(12), 0), 2003.44, 1e-5);
    expect(normalForceN(209, 9.8, 0, 3000)).toBe(0);
  });
  it('slope pull is m g sin θ: 425.84 N on 12°, 865.61 N on 25°', () => {
    closeTo(slopePullN(209, 9.8, rad(12)), 425.84, 2e-5);
    closeTo(slopePullN(209, 9.8, rad(25)), 865.61, 2e-5);
    expect(slopePullN(209, 9.8, 0)).toBe(0);
  });
  it('build quantities use the pushed-down R for F_r and F_lim, but weight stays m g', () => {
    const q = buildQuantities(rover(), surface('asphalt'), constants, { slopeRad: rad(12) });
    closeTo(q.rollingForceN, 40.07, 1e-4);
    closeTo(q.weightN, W, 1e-12);
    closeTo(q.gripLimitN, 0.8 * 2003.44, 1e-5);
  });
  it('12° ramp, full throttle: R 2003.44 N, F_r 40.07 N, pull 425.84 N, a = 2.5554 m/s²', () => {
    const s = stepOnce(createState({ speedMps: 2, throttleLevel: 1 }), HOLD, { slopeRad: rad(12) });
    closeTo(s.accelerationMps2, 2.5554, 1e-4);
    expect(s.drivingState).toBe('Driving');
    expect(s.rollingBack).toBe(false);
  });
  it('downhill the pull helps: the slope is negative along the gear', () => {
    const up = stepOnce(createState({ speedMps: 2, throttleLevel: 1 }), HOLD, { slopeRad: rad(12) });
    const down = stepOnce(createState({ speedMps: 2, throttleLevel: 1 }), HOLD, { slopeRad: -rad(12) });
    expect(down.accelerationMps2).toBeGreaterThan(up.accelerationMps2);
    closeTo(down.accelerationMps2, (1000 + 425.84 - 40.07) / 209, 1e-4);
  });
});

describe('rolling back (A6)', () => {
  it('at rest on a 25° wall, no keys: it rolls back with a = 3.9640 m/s², speed grows', () => {
    const s = stepOnce(createState(), NONE, { slopeRad: rad(25) });
    expect(s.rollingBack).toBe(true);
    expect(s.direction).toBe('forward');
    closeTo(s.accelerationMps2, 3.964, 1e-4);
    expect(s.speedMps).toBeGreaterThan(0);
    expect(motionSign(s.direction, s.rollingBack)).toBe(-1);
    // position moved backwards along the heading (+x), so x went negative
    expect(s.positionXM).toBeLessThan(0);
    expect(s.distanceM).toBeGreaterThan(0);
  });
  it('keeps rolling back while speed > 0, and the keys keep their meaning', () => {
    const env = { slopeRad: rad(25) };
    let s = stepOnce(createState(), NONE, env);
    for (let i = 0; i < 100; i++) s = stepOnce(s, NONE, env);
    expect(s.rollingBack).toBe(true);
    // S brakes the roll (it does not drive): the flag stays true
    const braked = stepOnce(s, BRAKE, env);
    expect(braked.drivingState).toBe('Braking');
    expect(braked.rollingBack).toBe(true);
    // W pushes forwards against the roll: less speed gain than coasting
    const coast = stepOnce(s, NONE, env);
    const driven = stepOnce({ ...s, throttleLevel: 1 }, HOLD, env);
    expect(driven.speedMps).toBeLessThan(coast.speedMps);
  });
  it('resisting forces never reverse the motion: braking a roll stops at 0, then rollingBack is false', () => {
    let s = createState({ speedMps: 0.05, rollingBack: true, brakeLevel: 1 });
    s = stepOnce(s, BRAKE, { slopeRad: 0 });
    expect(s.speedMps).toBe(0);
    expect(s.rollingBack).toBe(false);
    expect(s.positionXM).toBeLessThan(0);
  });
  it('a gentle slope holds a parked rover: |N| ≤ F_r (F_r = 0.02 × R)', () => {
    const s = stepOnce(createState(), NONE, { slopeRad: rad(0.5) });
    expect(s.speedMps).toBe(0);
    expect(s.rollingBack).toBe(false);
    expect(s.drivingState).toBe('Stopped');
  });
  it('the brake holds a rover on the wall, with both keys down (throttle counts as released)', () => {
    const s = stepOnce(createState({ brakeLevel: 1 }), { throttleHeld: true, brakeHeld: true, steer: 0 }, { slopeRad: rad(25) });
    expect(s.speedMps).toBe(0);
    expect(s.rollingBack).toBe(false);
  });
  it('from rest the Small motor (199 kg, 700 N) climbs 19.8° but not 20.1°; the limit solves 700 = 1950.2 (sin θ + 0.02 cos θ)', () => {
    const small = roverOf({ chassisId: 'chassis-standard', wheelsId: 'wheels-all-terrain', motorId: 'motor-small' });
    expect(small.massKg).toBe(199);
    const climb = (deg: number) => stepOnce(createState({ throttleLevel: 1 }), HOLD, { slopeRad: rad(deg) }, 'asphalt', 0, small);
    const ok = climb(19.8);
    expect(ok.speedMps).toBeGreaterThan(0);
    expect(ok.rollingBack).toBe(false);
    // just past the limit it stays put (|N| ≤ F_r); well past it, it rolls back
    expect(climb(20.1).speedMps).toBe(0);
    expect(climb(20.1).rollingBack).toBe(false);
    expect(climb(25).rollingBack).toBe(true);
    const g = 9.8 * 199;
    const f = (t: number) => g * (Math.sin(t) + 0.02 * Math.cos(t)) - 700;
    let lo = 0;
    let hi = Math.PI / 2;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      if (f(mid) > 0) hi = mid;
      else lo = mid;
    }
    expect((lo * 180) / Math.PI).toBeGreaterThan(19.8);
    expect((lo * 180) / Math.PI).toBeLessThan(20.0);
  });
  it('downhill gravity carries the rover past its top speed (the motor then gives no force); rolling back has no cap', () => {
    const top = rover().topSpeedMps;
    const s = createState({ speedMps: top, throttleLevel: 1 });
    const flat = stepOnce(s, HOLD);
    expect(flat.drivingState).toBe('At top speed');
    expect(flat.speedMps).toBe(top);
    const down = stepOnce(s, HOLD, { slopeRad: -rad(12) });
    expect(down.drivingState).toBe('Coasting');
    expect(down.driveForceN).toBe(0);
    expect(down.speedMps).toBeGreaterThan(top);
    const more = stepOnce(createState({ speedMps: top + 5, rollingBack: true }), NONE, { slopeRad: rad(25) });
    expect(more.speedMps).toBeGreaterThan(top + 5);
  });
  it('a gear flip at rest turns the slope sign: facing the wall, S alone flips and the rover rolls down it', () => {
    const s = stepOnce(createState(), BRAKE, { slopeRad: rad(25) });
    expect(s.direction).toBe('reverse');
    expect(s.rollingBack).toBe(false);
    expect(s.positionXM).toBeLessThan(0); // moved backwards down the slope
    // after the flip S is the drive key, and its level has begun to rise: a is just over 3.9640
    expect(s.accelerationMps2).toBeGreaterThan(3.964);
    expect(s.accelerationMps2).toBeLessThan(4.1);
  });
  it('a floating rover cannot turn', () => {
    const s = stepOnce(createState({ speedMps: 5 }), { ...NONE, steer: 1 }, { upthrustN: 2 * W });
    expect(s.headingRad).toBe(0);
    expect(stepOnce(createState({ speedMps: 5 }), { ...NONE, steer: 1 }).headingRad).toBeGreaterThan(0);
  });
  it('steering is mirrored while rolling back, as in reverse', () => {
    const s = stepOnce(createState({ speedMps: 5, rollingBack: true }), { ...NONE, steer: 1 });
    expect(s.headingRad).toBeLessThan(0);
  });
});

describe('water (A6, The Crossing)', () => {
  const cfg = levelsConfig.water;
  it('upthrust is ρ g V_sub: 980 N at 0.50 m, 1960 N at 1.0 m and deeper', () => {
    expect(submersionFraction(0.5, cfg.submersionHeightM)).toBe(0.5);
    expect(submersionFraction(3, cfg.submersionHeightM)).toBe(1);
    closeTo(upthrustN(cfg.densityKgPerM3, 9.8, cfg.roverVolumeM3, cfg.submersionHeightM, 0.5), 980, 1e-12);
    closeTo(upthrustN(cfg.densityKgPerM3, 9.8, cfg.roverVolumeM3, cfg.submersionHeightM, 1.0), 1960, 1e-12);
    expect(waterDragNsPerM(cfg.dragNsPerM, 0.5, cfg.submersionHeightM)).toBe(75);
  });
  it('pressure is shown, not simulated: ρ g h = 4900 Pa at 0.50 m', () => {
    closeTo(cfg.densityKgPerM3 * 9.8 * 0.5, 4900, 1e-12);
  });
  it('starting build, 0.50 m, 4.00 m/s, full throttle on sand: a = 0.50677 m/s², wheels slip', () => {
    const env: StepEnvironment = { upthrustN: 980, waterDragNsPerM: 75 };
    const s = stepOnce(createState({ speedMps: 4, throttleLevel: 1 }), HOLD, env, 'sand');
    closeTo(s.accelerationMps2, 0.50677, 1e-4);
    expect(s.slipping).toBe(true);
    const q = buildQuantities(rover(), surface('sand'), constants, env);
    closeTo(q.gripLimitN, 534.1, 1e-5);
    closeTo(q.rollingForceN, 128.18, 1e-4);
  });
  it('floats when U ≥ m g: no grip, no drive, only drag slows it; a 169 kg rover coasts m v0 / b = 18 m from 16 m/s', () => {
    expect(floats(209, 9.8, 1960)).toBe(false);
    expect(floats(190, 9.8, 1960)).toBe(true);
    const env: StepEnvironment = { upthrustN: 1960, waterDragNsPerM: 150 };
    const m = 169;
    const light = { ...roverOf({ chassisId: 'chassis-light', wheelsId: 'wheels-smooth', motorId: 'motor-small' }), massKg: m };
    const driven = stepOnce(createState({ speedMps: 4, throttleLevel: 1 }), HOLD, env, 'sand', 0, light);
    expect(driven.driveForceN).toBe(0);
    expect(driven.accelerationMps2).toBeLessThan(0);
    let c = createState({ speedMps: 16 });
    let guard = 0;
    while (c.speedMps > 0.001 && guard++ < 200000) c = stepOnce(c, NONE, env, 'sand', 0, light);
    closeTo(c.distanceM, (m * 16) / 150, 0.02);
  });
  it('every Light build floats (density 755–960), the starting build sinks (1045), Heavy builds always grip', () => {
    const U = upthrustN(cfg.densityKgPerM3, 9.8, cfg.roverVolumeM3, cfg.submersionHeightM, 1.0);
    for (const c of ['chassis-light', 'chassis-standard', 'chassis-heavy'])
      for (const w of ['wheels-smooth', 'wheels-all-terrain', 'wheels-spiked'])
        for (const mo of ['motor-small', 'motor-medium', 'motor-large']) {
          const m = roverOf({ chassisId: c, wheelsId: w, motorId: mo }).massKg;
          const density = m / cfg.roverVolumeM3;
          if (c === 'chassis-light') {
            expect(floats(m, 9.8, U)).toBe(true);
            expect(density).toBeGreaterThanOrEqual(754);
            expect(density).toBeLessThanOrEqual(961);
          }
          if (c === 'chassis-heavy') {
            expect(density).toBeGreaterThan(1000);
            expect(floats(m, 9.8, U)).toBe(false);
          }
        }
    closeTo(209 / cfg.roverVolumeM3, 1045, 1e-12);
    expect(floats(209, 9.8, U)).toBe(false);
  });
});

describe('magnets (A6, Polar Pass)', () => {
  const mg = levelsConfig.magnet;
  const params = { maxForceN: mg.maxForceN, fullWithinM: mg.fullWithinM, cutoffM: mg.cutoffM };
  it('force: 1600 N within 5 m, 1600 (5/d)² to 25 m, 0 beyond; d = 8 m gives 625 N', () => {
    expect(magnetForceN(0, params)).toBe(1600);
    expect(magnetForceN(5, params)).toBe(1600);
    closeTo(magnetForceN(8, params), 625, 1e-12);
    closeTo(magnetForceN(25, params), 64, 1e-12);
    expect(magnetForceN(25.01, params)).toBe(0);
  });
  it('splits along the gear and sideways; attract pulls towards the pylon, repel away', () => {
    const ahead = magnetOnRover(params, 0, 0, 8, 0, 0, true);
    closeTo(ahead.alongGearN, 625, 1e-12);
    expect(Math.abs(ahead.sidewaysN)).toBeLessThan(1e-9);
    closeTo(magnetOnRover(params, 0, 0, 8, 0, 0, false).alongGearN, -625, 1e-12);
    const left = magnetOnRover(params, 0, 0, 0, 8, 0, true);
    expect(Math.abs(left.alongGearN)).toBeLessThan(1e-9);
    closeTo(left.sidewaysN, 625, 1e-12);
    // gear pointing −x: a pylon at +x is behind
    closeTo(magnetOnRover(params, 0, 0, 8, 0, Math.PI, true).alongGearN, -625, 1e-12);
    // 3-4-5: d = 5, full 1600 N, split 960 / 1280
    const diag = magnetOnRover(params, 0, 0, 3, 4, 0, true);
    closeTo(diag.alongGearN, 960, 1e-12);
    closeTo(diag.sidewaysN, 1280, 1e-12);
  });
  it('a magnet ahead pulls a moving rover along the path through externalForceN: a gains F ÷ m', () => {
    const base = stepOnce(createState({ speedMps: 3 }), NONE);
    const pulled = stepOnce(createState({ speedMps: 3 }), NONE, undefined, 'asphalt', 625);
    closeTo(pulled.accelerationMps2 - base.accelerationMps2, 625 / 209, 1e-9);
  });
  it('a magnet starts a parked rover only when it beats rolling friction (F_r = 41 N); a repel pole rolls it back', () => {
    expect(stepOnce(createState(), NONE, undefined, 'asphalt', 30).speedMps).toBe(0);
    const strong = stepOnce(createState(), NONE, undefined, 'asphalt', 625);
    expect(strong.speedMps).toBeGreaterThan(0);
    expect(strong.rollingBack).toBe(false);
    expect(stepOnce(createState(), NONE, undefined, 'asphalt', -625).rollingBack).toBe(true);
  });
  it('a pole pulling backwards never takes the speed below 0 inside a step', () => {
    expect(stepOnce(createState({ speedMps: 0.001 }), NONE, undefined, 'asphalt', -1600).speedMps).toBe(0);
  });
});

describe('defaults leave everything unchanged', () => {
  it('an empty environment equals no environment, bit for bit, over a mixed drive', () => {
    const inputAt = (i: number): StepInput => ({
      throttleHeld: i < 700 || (i > 900 && i < 1000),
      brakeHeld: (i >= 700 && i < 800) || (i > 1100 && i < 1200),
      steer: i % 300 < 50 ? 1 : 0,
    });
    let a = createState();
    let b = createState();
    for (let i = 0; i < 1500; i++) {
      a = step(a, inputAt(i), rover(), surface('asphalt'), constants);
      b = step(b, inputAt(i), rover(), surface('asphalt'), constants, 0, { slopeRad: 0, upthrustN: 0, waterDragNsPerM: 0 });
      expect(b).toStrictEqual(a);
    }
    expect(a.rollingBack).toBe(false);
  });
});
