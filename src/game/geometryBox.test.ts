import { describe, expect, it } from 'vitest';
import { footprintCorners, footprintOverlapsBox } from './geometry.ts';

const L = 2;
const W = 1.7;
const box = (x0: number, x1: number, z0: number, z1: number) => ({ xM: [x0, x1] as const, zM: [z0, z1] as const });

describe('footprintOverlapsBox', () => {
  it('straight: overlaps when the box reaches into the footprint (front at x = 10 covers x 8 to 10)', () => {
    expect(footprintOverlapsBox(10, 0, 0, L, W, box(9.9, 12, -1, 1))).toBe(true);
    expect(footprintOverlapsBox(10, 0, 0, L, W, box(5, 8.1, -1, 1))).toBe(true);
    expect(footprintOverlapsBox(10, 0, 0, L, W, box(12, 14, -1, 1))).toBe(false);
  });

  it('straight: touching is not overlapping, in x and in z', () => {
    expect(footprintOverlapsBox(10, 0, 0, L, W, box(10, 12, -1, 1))).toBe(false); // front edge at x = 10
    expect(footprintOverlapsBox(10, 0, 0, L, W, box(4, 8, -1, 1))).toBe(false); // rear edge at x = 8
    expect(footprintOverlapsBox(10, 0, 0, L, W, box(8, 10, 0.85, 3))).toBe(false); // side at z = 0.85
    expect(footprintOverlapsBox(10, 0, 0, L, W, box(8, 10, 0.84, 3))).toBe(true);
  });

  it('rotated 45°: a box in the corner of the footprint\'s bounding box does not overlap', () => {
    const h = Math.PI / 4;
    // The footprint\'s corners are about (−0.60, 0.60), (0.60, −0.60), (−2.02, −0.81), (−0.81, −2.02); its bounding box reaches x, z = 0.60.
    expect(footprintOverlapsBox(0, 0, h, L, W, box(0.3, 1, 0.3, 1))).toBe(false);
    expect(footprintOverlapsBox(0, 0, h, L, W, box(0, 1, 0, 1))).toBe(false); // only touches the front edge at its centre
    expect(footprintOverlapsBox(0, 0, h, L, W, box(-0.2, 1, -0.2, 1))).toBe(true); // reaches behind the front edge
    expect(footprintOverlapsBox(0, 0, h, L, W, box(-0.5, -0.4, -0.5, -0.4))).toBe(true); // well inside
  });

  it('rotated 45°: a box that only meets the front corner by a hair overlaps', () => {
    const h = Math.PI / 4;
    // Front-left corner at (−0.601, 0.601): a box covering it overlaps.
    expect(footprintOverlapsBox(0, 0, h, L, W, box(-0.7, -0.5, 0.5, 0.7))).toBe(true);
  });

  it('corner-only overlap between a straight footprint and a box corner', () => {
    // Footprint x 8..10, z −0.85..0.85. A box whose corner pokes in by 0.01 in both axes.
    expect(footprintOverlapsBox(10, 0, 0, L, W, box(9.99, 12, 0.84, 3))).toBe(true);
    expect(footprintOverlapsBox(10, 0, 0, L, W, box(10, 12, 0.84, 3))).toBe(false);
  });
});

describe('footprintCorners', () => {
  it('straight: front edge at the position, rear edge one length behind', () => {
    const c = footprintCorners(10, 2, 0, L, W);
    const xs = c.map((p) => p.xM).sort((a, b) => a - b);
    const zs = c.map((p) => p.zM).sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(8);
    expect(xs[3]).toBeCloseTo(10);
    expect(zs[0]).toBeCloseTo(2 - 0.85);
    expect(zs[3]).toBeCloseTo(2 + 0.85);
  });
});
