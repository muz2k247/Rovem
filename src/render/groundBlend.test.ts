import { describe, expect, it } from 'vitest';
import { FRINGE_M, blendColour, dipDepthM, groundLiftM, surfaceWeights, warpM } from './groundBlend.ts';

// A straight edge at x = 0: sand for x > 0, rock for x ≤ 0.
const sandAfterZero = (x: number) => (x > 0 ? 'sand' : 'asphalt');

describe('surface weights (the colour fringe)', () => {
  it('are 1 for the surface well inside and 0 for the one well outside', () => {
    expect(surfaceWeights(sandAfterZero, 3, 5).get('sand')).toBe(1);
    expect(surfaceWeights(sandAfterZero, -3, 5).get('sand') ?? 0).toBe(0);
  });

  it('always add up to 1', () => {
    for (let x = -1.2; x <= 1.2; x += 0.1) {
      const total = [...surfaceWeights(sandAfterZero, x, 2).values()].reduce((a, b) => a + b, 0);
      expect(total).toBeCloseTo(1, 12);
    }
  });

  it('change over about FRINGE_M (1 m) across an edge, and never go backwards', () => {
    expect(FRINGE_M).toBe(1);
    for (const z of [-7, 0, 3.3, 11]) {
      let last = 0;
      let firstMixed = Infinity;
      let lastMixed = -Infinity;
      for (let x = -1.5; x <= 1.5; x += 0.02) {
        const w = surfaceWeights(sandAfterZero, x, z).get('sand') ?? 0;
        expect(w).toBeGreaterThanOrEqual(last - 1e-12);
        last = w;
        if (w > 0 && w < 1) {
          firstMixed = Math.min(firstMixed, x);
          lastMixed = Math.max(lastMixed, x);
        }
      }
      expect(lastMixed - firstMixed).toBeLessThanOrEqual(FRINGE_M + 0.05);
      expect(lastMixed - firstMixed).toBeGreaterThan(0.3);
    }
  });

  it('are warped by noise, so the edge is not a straight line', () => {
    const edgeAt = (z: number) => {
      for (let x = -1; x <= 1; x += 0.01) if ((surfaceWeights(sandAfterZero, x, z).get('sand') ?? 0) >= 0.5) return x;
      return NaN;
    };
    const edges = [0, 4, 8, 12, 16, 20, 24, 28].map(edgeAt);
    expect(Math.max(...edges) - Math.min(...edges)).toBeGreaterThan(0.05);
    expect(warpM(1.5, 2.5)).toEqual(warpM(1.5, 2.5)); // the same point always warps the same way
  });

  it('are the same for the same point however many times they are asked for (no random generator)', () => {
    const a = surfaceWeights(sandAfterZero, 0.1, 9.9);
    const b = surfaceWeights(sandAfterZero, 0.1, 9.9);
    expect([...a]).toEqual([...b]);
  });
});

describe('colour', () => {
  const colours: Record<string, readonly [number, number, number]> = { sand: [1, 0.5, 0], asphalt: [0, 0, 0] };
  it('is the weighted mix of the surface colours', () => {
    const half = blendColour(new Map([['sand', 0.5], ['asphalt', 0.5]]), colours, [1, 1, 1]);
    expect(half).toEqual([0.5, 0.25, 0]);
    expect(blendColour(new Map([['sand', 1]]), colours, [1, 1, 1])).toEqual([1, 0.5, 0]);
  });
  it('uses the ground colour for a surface it does not know the colour of', () => {
    expect(blendColour(new Map([['ground', 1]]), colours, [0.2, 0.3, 0.4])).toEqual([0.2, 0.3, 0.4]);
  });
});

describe('mud and ice lie in dips', () => {
  it('mud is dug down further than ice, and rock is not dug at all', () => {
    expect(dipDepthM(new Map([['mud', 1]]))).toBeGreaterThan(dipDepthM(new Map([['ice', 1]])));
    expect(dipDepthM(new Map([['ice', 1]]))).toBeGreaterThan(0);
    expect(dipDepthM(new Map([['asphalt', 1]]))).toBe(0);
  });
  it('the dip deepens smoothly with the weight, so the edge of a dip has no step', () => {
    const half = dipDepthM(new Map([['mud', 0.5], ['asphalt', 0.5]]));
    expect(half).toBeCloseTo(dipDepthM(new Map([['mud', 1]])) / 2, 12);
  });
  it('sand ripples: sand is lifted a little in ridges, other surfaces are not', () => {
    expect(groundLiftM(new Map([['asphalt', 1]]), 12, 3)).toBe(0);
    const lifts = [0, 0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1].map((x) => groundLiftM(new Map([['sand', 1]]), x, 0));
    expect(Math.max(...lifts)).toBeGreaterThan(0.02);
    expect(Math.max(...lifts)).toBeLessThanOrEqual(0.12); // low enough that the rover never looks to float
    expect(Math.min(...lifts)).toBeGreaterThanOrEqual(0);
  });
});
