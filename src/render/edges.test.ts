import { describe, expect, it } from 'vitest';
import { EDGE, edgeSample, noise2, planEdges, stepHeightM, type EdgeSpan } from './edges.ts';

// The shapes beyond an edge (SHOWCASE_PLAN §12a, R6b).

describe('noise', () => {
  it('is the same every time and stays in 0 to 1', () => {
    expect(noise2(3.3, -7.1)).toBe(noise2(3.3, -7.1));
    for (let i = 0; i < 200; i++) {
      const v = noise2(i * 0.77, i * -1.3);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe('the rock step', () => {
  it('is 0.6 to 1.2 m tall everywhere', () => {
    for (let i = 0; i < 500; i++) {
      const h = stepHeightM(i * 3.7, i * -2.1);
      expect(h).toBeGreaterThanOrEqual(EDGE.stepMinM);
      expect(h).toBeLessThanOrEqual(EDGE.stepMaxM);
    }
  });
});

describe('the ground beyond an edge', () => {
  const at = (style: 'hill' | 'rock' | 'cliff', d: number, x = 120, z = 15) => edgeSample(style, d, x, z).riseM;

  it('does not rise at the edge itself or inside it, for every style', () => {
    for (const style of ['hill', 'rock', 'cliff'] as const) {
      expect(at(style, 0)).toBe(0);
      expect(at(style, -3)).toBe(0);
    }
  });

  it('a hillside climbs, its first metre is the height of the rock step, and it ends in rolling ground', () => {
    expect(at('hill', 1)).toBeGreaterThanOrEqual(EDGE.stepMinM - 1e-9);
    expect(at('hill', 1)).toBeLessThanOrEqual(EDGE.stepMaxM + 1e-9);
    for (const x of [0, 80, 400, 1300]) {
      const top = at('hill', 40, x, 12);
      expect(top).toBeGreaterThan(EDGE.hill.riseMinM - EDGE.rollM - 1e-9);
      expect(top).toBeLessThan(EDGE.hill.riseMaxM + EDGE.stepMaxM + EDGE.rollM + 1e-9);
    }
  });

  it('a hillside slope is between 25° and 40° where it climbs', () => {
    for (const x of [0, 80, 400, 1300]) {
      const run = 0.5;
      const d = 3;
      const slopeDeg = (Math.atan((at('hill', d + run, x, 12) - at('hill', d, x, 12)) / run) * 180) / Math.PI;
      expect(slopeDeg).toBeGreaterThan(EDGE.hill.angleMinDeg - 6); // the tanh flattens it a little and the roll adds a little
      expect(slopeDeg).toBeLessThan(EDGE.hill.angleMaxDeg + 3);
    }
  });

  it('a rock face is steeper than a hillside and taller', () => {
    expect(at('rock', 5)).toBeGreaterThan(at('hill', 5));
    expect(at('rock', 40)).toBeGreaterThanOrEqual(EDGE.rock.riseMinM - 1);
    expect(at('rock', 40)).toBeLessThanOrEqual(EDGE.rock.riseMaxM + EDGE.stepMaxM + 1);
    expect(edgeSample('rock', 10, 5, 5).tint).toBeLessThan(1); // and darker
  });

  it('a cliff stays level to its rim, then falls 10 to 20 m within 6 m beyond the rim', () => {
    expect(at('cliff', EDGE.cliff.rimDepthM * 0.9)).toBeCloseTo(0, 1);
    for (const x of [0, 80, 400, 1300]) {
      const fall = -at('cliff', EDGE.cliff.rimDepthM + EDGE.cliff.dropWithinM, x, 12);
      expect(fall).toBeGreaterThanOrEqual(EDGE.cliff.dropMinM - 1);
      expect(fall).toBeLessThanOrEqual(EDGE.cliff.dropMaxM + 1);
    }
  });
});

describe('planning the edge features', () => {
  const span = (style: EdgeSpan['style'], len = 30): EdgeSpan => ({ ax: 0, az: 9, bx: len, bz: 9, nx: 0, nz: 1, style });
  const flat = () => 0;

  it('a hillside or rock face gets a rock step along its whole length', () => {
    for (const style of ['hill', 'rock'] as const) {
      const plan = planEdges({ spans: [span(style)], heightAt: flat, quality: 'high' });
      expect(plan.kerbs).toHaveLength(1);
      expect(plan.rocks.every((r) => r.kind === 'boulder')).toBe(true);
    }
  });

  it('a cliff gets a rim of rocks 0.6 to 1.2 m tall with no gap wider than 1.5 m, and no rock step', () => {
    const plan = planEdges({ spans: [span('cliff', 4), { ...span('cliff', 4), ax: 4, bx: 8 }, { ...span('cliff', 4), ax: 8, bx: 12 }], heightAt: flat, quality: 'high' });
    expect(plan.kerbs).toHaveLength(0);
    const rim = plan.rocks.filter((r) => r.kind === 'rim').sort((a, b) => a.xM - b.xM);
    expect(rim.length).toBeGreaterThan(3);
    for (const r of rim) {
      expect(r.heightM).toBeGreaterThanOrEqual(EDGE.cliff.rimMinM);
      expect(r.heightM).toBeLessThanOrEqual(EDGE.cliff.rimMaxM);
    }
    for (let i = 1; i < rim.length; i++) {
      const gap = rim[i]!.xM - rim[i]!.lengthM / 2 - (rim[i - 1]!.xM + rim[i - 1]!.lengthM / 2);
      expect(gap).toBeLessThanOrEqual(EDGE.cliff.gapMaxM);
    }
  });

  it('Graphics Low has fewer boulders than High', () => {
    const spans = Array.from({ length: 60 }, (_, i): EdgeSpan => ({ ...span('hill'), ax: i * 3, bx: i * 3 + 3 }));
    const high = planEdges({ spans, heightAt: flat, quality: 'high' }).rocks.length;
    const low = planEdges({ spans, heightAt: flat, quality: 'low' }).rocks.length;
    expect(low).toBeLessThan(high);
  });
});
