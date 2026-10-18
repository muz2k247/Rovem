import { describe, expect, it } from 'vitest';
import type { SpeedSample } from '../../game/contracts.ts';
import { buildGraph, niceStep, speedAt } from './graph.ts';

const trace: SpeedSample[] = [
  { timeS: 0, speedMps: 0 },
  { timeS: 1, speedMps: 8 },
  { timeS: 2, speedMps: 16 },
  { timeS: 3, speedMps: 12 },
];
const size = { width: 400, height: 200, left: 40, right: 10, top: 10, bottom: 30 };

describe('niceStep', () => {
  it('picks 1, 2 or 5 times a power of ten', () => {
    expect(niceStep(10, 5)).toBe(2);
    expect(niceStep(16, 4)).toBe(5);
    expect(niceStep(3, 3)).toBe(1);
    expect(niceStep(0.8, 4)).toBe(0.2);
    expect(niceStep(120, 5)).toBe(20);
  });
  it('never returns 0, even for an empty range', () => {
    expect(niceStep(0, 5)).toBeGreaterThan(0);
  });
});

describe('speedAt', () => {
  it('interpolates between samples and clamps at the ends', () => {
    expect(speedAt(trace, 0.5)).toBe(4);
    expect(speedAt(trace, 2.5)).toBe(14);
    expect(speedAt(trace, -1)).toBe(0);
    expect(speedAt(trace, 9)).toBe(12);
    expect(speedAt([], 1)).toBe(0);
  });
});

describe('buildGraph', () => {
  const g = buildGraph(trace, [1.5, 3], 'mps', size);

  it('maps the first and last sample to the plot corners (y grows downward on screen)', () => {
    const plotW = 400 - 40 - 10;
    const plotH = 200 - 10 - 30;
    expect(g.points[0]).toEqual({ x: 40, y: 10 + plotH });
    expect(g.points[3]!.x).toBeCloseTo(40 + plotW, 9);
    // the fastest sample (16 m/s) sits at 16 / yMax of the height
    expect(g.points[2]!.y).toBeCloseTo(10 + plotH * (1 - 16 / g.yMax), 9);
  });

  it('rounds the speed axis up to a tick, so nothing is clipped', () => {
    expect(g.yMax).toBeGreaterThanOrEqual(16);
    expect(g.yTicks.at(-1)!.value).toBe(g.yMax);
    expect(g.yTicks[0]!.value).toBe(0);
  });

  it('has x ticks from 0 within the run time', () => {
    expect(g.xTicks[0]!.value).toBe(0);
    expect(g.xTicks.at(-1)!.value).toBeLessThanOrEqual(3);
    expect(g.xTicks.every((t) => t.pos >= 40 - 1e-9 && t.pos <= 390 + 1e-9)).toBe(true);
  });

  it('numbers the markers from 1 and puts each on the line at its time', () => {
    expect(g.markers.map((m) => m.n)).toEqual([1, 2]);
    expect(g.markers[0]!.x).toBeCloseTo(40 + ((1.5 / 3) * 350), 9);
    expect(g.markers[0]!.y).toBeCloseTo(10 + 160 * (1 - 12 / g.yMax), 9);
  });

  it('shows km/h as m/s × 3.6', () => {
    const k = buildGraph(trace, [], 'kmh', size);
    expect(k.yMax).toBeGreaterThanOrEqual(57.6);
    expect(k.points[2]!.y).toBeCloseTo(10 + 160 * (1 - 57.6 / k.yMax), 9);
    expect(k.unitLabel).toBe('km/h');
    expect(g.unitLabel).toBe('m/s');
  });

  it('draws a flat line for an empty or one-sample trace instead of dividing by zero', () => {
    for (const t of [[], [{ timeS: 0, speedMps: 0 }]] as SpeedSample[][]) {
      const e = buildGraph(t, [0], 'mps', size);
      expect(e.path).not.toMatch(/NaN|Infinity/);
      expect(e.markers.every((m) => Number.isFinite(m.x) && Number.isFinite(m.y))).toBe(true);
    }
  });

  it('keeps a marker past the end of the run on the plot', () => {
    const late = buildGraph(trace, [99], 'mps', size);
    expect(late.markers[0]!.x).toBeLessThanOrEqual(390 + 1e-9);
  });

  it('builds an SVG path that starts with M and has one L per later sample', () => {
    expect(g.path.startsWith('M')).toBe(true);
    expect(g.path.match(/L/g)).toHaveLength(3);
  });
});
