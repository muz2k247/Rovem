import { describe, expect, it } from 'vitest';
import { CRASH_SHAKE_PEAK_M, crashShakeM, shouldRefreshHud } from './levelScreenLogic.ts';

describe('level screen logic', () => {
  it('the crash shake starts at its peak and dies away over the crash moment', () => {
    expect(crashShakeM(0, 0.5)).toBe(CRASH_SHAKE_PEAK_M);
    expect(crashShakeM(0.25, 0.5)).toBeCloseTo(CRASH_SHAKE_PEAK_M / 2, 9);
    expect(crashShakeM(0.5, 0.5)).toBe(0);
    expect(crashShakeM(2, 0.5)).toBe(0);
    expect(crashShakeM(0, 0)).toBe(0);
  });

  it('the HUD refreshes every other frame, and at once when forced', () => {
    expect([0, 1, 2, 3].map((f) => shouldRefreshHud(f, false))).toEqual([true, false, true, false]);
    expect(shouldRefreshHud(1, true)).toBe(true);
  });
});
