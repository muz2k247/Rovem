import { describe, expect, it } from 'vitest';
import { levelsConfig } from '../content/levelsConfig.ts';
import { createForceLine, formatForceLine, type ForceLineInput } from './forceLine.ts';

const MASS = 209;
const base: ForceLineInput = { timeS: 0, massKg: MASS, pushN: 1000, brakeN: 0, frictionN: 40.9, netN: 959.1, balanced: false };
const at = (timeS: number, over: Partial<ForceLineInput> = {}): ForceLineInput => ({ ...base, timeS, ...over });

describe('F = ma line text (LEVELS_BUILD_PLAN A4)', () => {
  it('names the forces, the net and a: the plan example', () => {
    // 1000 − 41 = 959; 959 ÷ 209 = 4.5885 → 4.59
    expect(formatForceLine({ pushN: 1000, brakeN: 0, frictionN: 40.9, massKg: MASS })).toBe('Push 1000 N − Friction 41 N = 959 N → a = 959 ÷ 209 = 4.59 m/s²');
  });

  it('coasting: friction only, a negative', () => {
    expect(formatForceLine({ pushN: 0, brakeN: 0, frictionN: 41, massKg: MASS })).toBe('−Friction 41 N = −41 N → a = −41 ÷ 209 = −0.20 m/s²');
  });

  it('braking: brake and friction, the start build brakes at 7.37 m/s² (M3 table)', () => {
    expect(formatForceLine({ pushN: 0, brakeN: 1500, frictionN: 41, massKg: MASS })).toBe(
      '−Brake 1500 N − Friction 41 N = −1541 N → a = −1541 ÷ 209 = −7.37 m/s²',
    );
  });

  it('adds up the numbers it prints, so a student can check them by hand', () => {
    // 1000.4 and 40.6 print as 1000 and 41; the net printed is 959, not 959.8
    const line = formatForceLine({ pushN: 1000.4, brakeN: 0, frictionN: 40.6, massKg: MASS });
    expect(line).toContain('Push 1000 N − Friction 41 N = 959 N');
  });

  it('shows 0.00 and never "−0.00"', () => {
    expect(formatForceLine({ pushN: 41, brakeN: 0, frictionN: 41, massKg: MASS })).toBe('Push 41 N − Friction 41 N = 0 N → a = 0 ÷ 209 = 0.00 m/s²');
  });

  it('shows the mass as a whole number', () => {
    expect(formatForceLine({ pushN: 1000, brakeN: 0, frictionN: 40, massKg: 208.6 })).toContain('÷ 209 =');
  });
});

describe('F = ma line rule (A4: shown while the speed is changing)', () => {
  const { minAccelMps2, minDurationS, balancedShowS } = levelsConfig.forceLine; // 0.1, 0.3, 2

  it('is hidden at first, then shows once |a| ≥ 0.1 m/s² has lasted 0.3 s', () => {
    const line = createForceLine();
    expect(line.update(at(0))).toBeNull();
    expect(line.update(at(minDurationS - 0.001))).toBeNull();
    expect(line.update(at(minDurationS))).toMatch(/^Push 1000 N − Friction 41 N = 959 N/);
  });

  it('hides at once when the acceleration drops below 0.1 m/s²', () => {
    const line = createForceLine();
    line.update(at(0));
    line.update(at(0.4));
    // net 20 N ÷ 209 kg = 0.0957 m/s² < 0.1
    expect(line.update(at(0.5, { netN: 20 }))).toBeNull();
  });

  it('counts exactly 0.1 m/s² as changing', () => {
    const line = createForceLine();
    const net = minAccelMps2 * MASS;
    line.update(at(0, { netN: net }));
    expect(line.update(at(minDurationS, { netN: net }))).not.toBeNull();
  });

  it('starts the 0.3 s again after a dip', () => {
    const line = createForceLine();
    line.update(at(0));
    line.update(at(0.4));
    line.update(at(0.5, { netN: 0 }));
    expect(line.update(at(0.6))).toBeNull(); // changing again, but only for 0 s so far
    expect(line.update(at(0.6 + minDurationS))).not.toBeNull();
  });

  it('shows a negative acceleration (coasting, braking) the same way', () => {
    const line = createForceLine();
    const coast = { pushN: 0, frictionN: 41, netN: -41 };
    line.update(at(0, coast));
    expect(line.update(at(minDurationS, coast))).toMatch(/^−Friction 41 N/);
  });

  it('on first reaching top speed shows "Balanced: constant speed" for 2 s, once', () => {
    const line = createForceLine();
    const bal = { pushN: 41, brakeN: 0, frictionN: 41, netN: 0, balanced: true };
    expect(line.update(at(10, bal))).toBe('Balanced: constant speed');
    expect(line.update(at(10 + balancedShowS - 0.001, bal))).toBe('Balanced: constant speed');
    expect(line.update(at(10 + balancedShowS, bal))).toBeNull();
    // slows and reaches top speed again: not announced a second time
    expect(line.update(at(30, bal))).toBeNull();
  });

  it('the balanced message beats the F = ma line while it shows', () => {
    const line = createForceLine();
    line.update(at(0));
    line.update(at(0.4));
    expect(line.update(at(0.5, { balanced: true, netN: 0.0 }))).toBe('Balanced: constant speed');
  });

  it('a new tracker (a new run) announces top speed again', () => {
    const bal = { pushN: 41, brakeN: 0, frictionN: 41, netN: 0, balanced: true };
    createForceLine().update(at(10, bal));
    expect(createForceLine().update(at(10, bal))).toBe('Balanced: constant speed');
  });
});
