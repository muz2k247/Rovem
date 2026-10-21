import { describe, expect, it } from 'vitest';
import { movingIntoEdge, scrapeAlongEdge } from './collision.ts';

const DEG = Math.PI / 180;

describe('scrapeAlongEdge: v′ = v cos α (E46, T19)', () => {
  it('12 m/s into an edge at α = 30° leaves 10.392 m/s along it', () => {
    const s = scrapeAlongEdge(30 * DEG, 12, 0);
    expect(s.speedMps).toBeCloseTo(12 * Math.cos(30 * DEG), 12);
    expect(Math.abs(s.speedMps - 10.392)).toBeLessThanOrEqual(0.0005);
    expect(s.alphaRad).toBeCloseTo(30 * DEG, 12);
    expect(s.directionRad).toBe(0);
  });

  it('α = 60° leaves 6.000 m/s', () => {
    expect(Math.abs(scrapeAlongEdge(60 * DEG, 12, 0).speedMps - 6)).toBeLessThanOrEqual(0.0005);
  });

  it('a square-on hit (α = 90°) leaves exactly 0', () => {
    const s = scrapeAlongEdge(90 * DEG, 12, 0);
    expect(s.speedMps).toBe(0);
    expect(s.alphaRad).toBeCloseTo(90 * DEG, 9);
  });

  it('a rover travelling along the edge loses nothing', () => {
    expect(scrapeAlongEdge(0, 12, 0).speedMps).toBe(12);
  });

  it('keeps the side it was going: against the edge line’s direction it goes the other way', () => {
    const s = scrapeAlongEdge(180 * DEG - 30 * DEG, 12, 0);
    expect(s.speedMps).toBeCloseTo(12 * Math.cos(30 * DEG), 12);
    expect(s.directionRad).toBeCloseTo(Math.PI, 12);
  });

  it('works for an edge in any direction: the angle is between the travel direction and the edge', () => {
    const edge = 40 * DEG;
    const s = scrapeAlongEdge(edge + 30 * DEG, 12, edge);
    expect(s.speedMps).toBeCloseTo(10.392304845413264, 9);
    expect(s.directionRad).toBe(edge);
  });

  it('never makes the rover faster', () => {
    for (let a = -180; a <= 180; a += 7) expect(scrapeAlongEdge(a * DEG, 9, 0.3).speedMps).toBeLessThanOrEqual(9);
  });
});

describe('movingIntoEdge', () => {
  it('is true toward the outside, false along it and away from it', () => {
    expect(movingIntoEdge(10 * DEG, 0)).toBe(true);
    expect(movingIntoEdge(90 * DEG, 0)).toBe(false);
    expect(movingIntoEdge(170 * DEG, 0)).toBe(false);
  });
});
