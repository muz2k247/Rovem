import { describe, expect, it } from 'vitest';
import { mulberry32 } from './rng.ts';

describe('mulberry32', () => {
  it('gives the known first outputs for seeds 0, 1 and 42', () => {
    // Pinned from the reference algorithm; seed 1 gives 0.6270739405881613 in the published implementations.
    const first = (seed: number) => {
      const r = mulberry32(seed);
      return [r(), r(), r()];
    };
    expect(first(0)).toEqual([0.26642920868471265, 0.0003297457005828619, 0.2232720274478197]);
    expect(first(1)).toEqual([0.6270739405881613, 0.002735721180215478, 0.5274470399599522]);
    expect(first(42)).toEqual([0.6011037519201636, 0.44829055899754167, 0.8524657934904099]);
  });

  it('is the same sequence every time and stays in [0, 1)', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    for (let i = 0; i < 1000; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('differs between seeds', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});
