import { describe, expect, it } from 'vitest';
import { airStep, apexHeightM, flightTimeS, launch, rangeM, type AirState } from './air.ts';

const DT = 1 / 120;
const DEG = Math.PI / 180;

// T18 (E45): v = 16 m/s off a 15° lip, landing at take-off height.
//   v_y = 16 sin 15° = 4.14111 m/s, v_h = 16 cos 15° = 15.45483 m/s
//   g = 9.8: t = 2 v_y ÷ g = 0.84512 s, h = v_y² ÷ 2g = 0.87494 m, range = v_h t = 13.061 m
//   g = 4.9: t = 1.69025 s, h = 1.74987 m, range = 26.122 m
describe('launch and the closed-form flight (T18)', () => {
  const l = launch(16, 15 * DEG);

  it('splits the speed at the lip into a level and an upward part', () => {
    expect(l.horizontalMps).toBeCloseTo(15.45482, 4);
    expect(l.verticalMps).toBeCloseTo(4.14111, 4);
  });

  it('gives the flight time, apex height and range of the plan at g = 9.8', () => {
    expect(flightTimeS(l.verticalMps, 9.8)).toBeCloseTo(0.84512, 5);
    expect(apexHeightM(l.verticalMps, 9.8)).toBeCloseTo(0.87494, 5);
    expect(rangeM(l.horizontalMps, l.verticalMps, 9.8)).toBeCloseTo(13.061, 3);
  });

  it('gives twice the time, twice the height and twice the range at half the gravity', () => {
    expect(flightTimeS(l.verticalMps, 4.9)).toBeCloseTo(1.69025, 5);
    expect(apexHeightM(l.verticalMps, 4.9)).toBeCloseTo(1.74987, 5);
    expect(rangeM(l.horizontalMps, l.verticalMps, 4.9)).toBeCloseTo(26.122, 3);
  });
});

// Flying it step by step must agree with the closed form, because the step that crosses the ground is split.
describe('airStep', () => {
  const fly = (speedMps: number, angleDeg: number, g: number) => {
    const l = launch(speedMps, angleDeg * DEG);
    let s: AirState = { heightM: 0, verticalMps: l.verticalMps, horizontalMps: l.horizontalMps };
    let timeS = 0;
    let horizontalM = 0;
    let apexM = 0;
    for (let i = 0; i < 100000; i++) {
      const r = airStep(s, g, DT);
      timeS += r.usedS;
      horizontalM += r.horizontalM;
      apexM = Math.max(apexM, r.state.heightM);
      s = r.state;
      if (r.landed) return { timeS, horizontalM, apexM, steps: i + 1, landing: r };
    }
    throw new Error('never landed');
  };

  it('lands after 0.84512 s and 13.061 m at g = 9.8 (T18)', () => {
    const f = fly(16, 15, 9.8);
    expect(f.timeS).toBeCloseTo(0.84512, 5);
    expect(f.horizontalM).toBeCloseTo(13.061, 3);
    expect(f.steps).toBe(102);
  });

  it('lands after 1.69025 s and 26.122 m at g = 4.9 (T18)', () => {
    const f = fly(16, 15, 4.9);
    expect(f.timeS).toBeCloseTo(1.69025, 5);
    expect(f.horizontalM).toBeCloseTo(26.122, 3);
    expect(f.steps).toBe(203);
  });

  it('reaches the apex of the plan, within one step’s rise of the exact value', () => {
    expect(fly(16, 15, 9.8).apexM).toBeCloseTo(0.87494, 3);
  });

  it('keeps the level speed constant and lets the upward speed fall by g Δt each step', () => {
    const l = launch(16, 15 * DEG);
    const r = airStep({ heightM: 0, verticalMps: l.verticalMps, horizontalMps: l.horizontalMps }, 9.8, DT);
    expect(r.state.horizontalMps).toBe(l.horizontalMps);
    expect(r.state.verticalMps).toBeCloseTo(l.verticalMps - 9.8 * DT, 12);
    expect(r.state.heightM).toBeCloseTo(l.verticalMps * DT - 0.5 * 9.8 * DT * DT, 12);
    expect(r.usedS).toBe(DT);
    expect(r.landed).toBe(false);
  });

  it('on landing reports the downward speed, so the game can remove it', () => {
    const f = fly(16, 15, 9.8);
    // Landing at take-off height: the downward speed equals the upward speed at the lip.
    expect(f.landing.state.verticalMps).toBeCloseTo(-4.14111, 4);
    expect(f.landing.state.heightM).toBe(0);
  });

  it('a lip with a flat launch (0°) just falls', () => {
    const s: AirState = { heightM: 2, verticalMps: 0, horizontalMps: 10 };
    // t = √(2h ÷ g) = 0.63888 s, range 6.3888 m
    let cur = s;
    let t = 0;
    let x = 0;
    for (let i = 0; i < 1000; i++) {
      const r = airStep(cur, 9.8, DT);
      t += r.usedS;
      x += r.horizontalM;
      cur = r.state;
      if (r.landed) break;
    }
    expect(t).toBeCloseTo(Math.sqrt(2 * 2 / 9.8), 5);
    expect(x).toBeCloseTo(10 * Math.sqrt(2 * 2 / 9.8), 4);
  });

  it('a higher gravity gives a shorter, lower jump from the same lip', () => {
    expect(fly(16, 15, 19.6).timeS).toBeLessThan(fly(16, 15, 9.8).timeS);
    expect(fly(16, 15, 19.6).apexM).toBeLessThan(fly(16, 15, 9.8).apexM);
  });
});
