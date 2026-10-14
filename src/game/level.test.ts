import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import type { Level } from '../content/index.ts';
import { footprintOverlapsCircle, nearestOnPath, pointAlongPath, pointInPolygon } from './geometry.ts';
import { createTrack } from './level.ts';

const level = content.levels.testCourse;
const track = createTrack(content, level);
const L = content.constants.roverLengthM;
const W = content.constants.roverWidthM;

describe('geometry', () => {
  const square = [
    { xM: 0, zM: 0 },
    { xM: 10, zM: 0 },
    { xM: 10, zM: 10 },
    { xM: 0, zM: 10 },
  ];

  it('point in polygon', () => {
    expect(pointInPolygon(5, 5, square)).toBe(true);
    expect(pointInPolygon(11, 5, square)).toBe(false);
    expect(pointInPolygon(5, -0.1, square)).toBe(false);
  });

  it('footprint: front at the position, 2 m back along the heading, width across it', () => {
    // Heading 0: the body covers x from −2 to 0 and z from −0.85 to 0.85.
    expect(footprintOverlapsCircle(0, 0, 0, L, W, 1, 0, 0.99)).toBe(false);
    expect(footprintOverlapsCircle(0, 0, 0, L, W, 1, 0, 1.01)).toBe(true);
    expect(footprintOverlapsCircle(0, 0, 0, L, W, -1, 1.0, 0.2)).toBe(true); // 0.15 m from the side
    expect(footprintOverlapsCircle(0, 0, 0, L, W, -1, 1.1, 0.2)).toBe(false); // 0.25 m from the side
    expect(footprintOverlapsCircle(0, 0, 0, L, W, -2.5, 0, 0.6)).toBe(true); // behind the rear
    // Heading 90°: the body runs from the front at (0, 0) back to (0, −2).
    expect(footprintOverlapsCircle(0, 0, Math.PI / 2, L, W, 0, -1, 0.1)).toBe(true);
    expect(footprintOverlapsCircle(0, 0, Math.PI / 2, L, W, 1, -1, 0.1)).toBe(false);
  });

  it('nearest point on a path and points along it, extended past the ends', () => {
    const path = [
      { xM: 0, zM: 0 },
      { xM: 10, zM: 0 },
      { xM: 10, zM: 10 },
    ];
    expect(nearestOnPath(path, 4, 3)).toEqual({ alongM: 4, offsetM: 3 });
    expect(nearestOnPath(path, 12, 6).alongM).toBeCloseTo(16, 12);
    expect(pointAlongPath(path, 15)).toEqual({ xM: 10, zM: 5 });
    expect(pointAlongPath(path, 25)).toEqual({ xM: 10, zM: 15 });
    expect(pointAlongPath(path, -3)).toEqual({ xM: -3, zM: 0 });
  });
});

describe('the surface under the rover comes from the level', () => {
  it('asphalt along the track, sand (the default) beside it', () => {
    expect(track.surfaceIdAt(50, 0)).toBe('asphalt');
    expect(track.surfaceIdAt(50, 20)).toBe('sand');
    expect(track.surfaceAt(50, 0)).toEqual({ rollingFriction: 0.02, grip: 0.8 });
  });

  it('a later region is drawn over an earlier one (friction tiles go on top)', () => {
    const tiled: Level = {
      ...level,
      surfaces: [
        ...level.surfaces,
        {
          surfaceId: 'ice',
          polygon: [
            { xM: 40, zM: -4 },
            { xM: 50, zM: -4 },
            { xM: 50, zM: 4 },
            { xM: 40, zM: 4 },
          ],
        },
      ],
    };
    const t = createTrack(content, tiled);
    expect(t.surfaceIdAt(45, 0)).toBe('ice');
    expect(t.surfaceIdAt(55, 0)).toBe('asphalt');
  });
});

describe('rocks in the test level', () => {
  it('the start pose is clear of every rock', () => {
    expect(track.rockHit(track.start.positionXM, track.start.positionZM, track.start.headingRad)).toBeUndefined();
  });

  it('a rock sits behind the start, on the track', () => {
    // Rock at x = −8, radius 1: the rear (2 m behind the front) reaches it when the front is at x = −5.
    expect(track.rockHit(-4.9, 0, 0)).toBeUndefined();
    expect(track.rockHit(-5.1, 0, 0)).toMatchObject({ kind: 'rock', xM: -8 });
  });

  it('the footprint uses the content width', () => {
    expect(track.footprint).toEqual({ lengthM: 2, widthM: 1.7 });
  });
});
