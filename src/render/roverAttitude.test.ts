import { describe, expect, it } from 'vitest';
import { easeOutBack, leanRad, MAX_LEAN_RAD, MAX_STEER_RAD, steerAngleRad } from './roverAttitude.ts';

describe('lean in turns (presentation only)', () => {
  it('no turn, no lean; no speed, no lean', () => {
    expect(leanRad(10, 0)).toBe(0);
    expect(leanRad(0, 1)).toBe(0);
  });
  it('leans outward: a left turn (positive turn rate) gives a positive lean, a right turn a negative one', () => {
    expect(leanRad(8, 0.5)).toBeGreaterThan(0);
    expect(leanRad(8, -0.5)).toBeLessThan(0);
    expect(leanRad(8, -0.5)).toBeCloseTo(-leanRad(8, 0.5), 12);
  });
  it('grows with the sideways acceleration v × ω, until it reaches the small limit', () => {
    expect(leanRad(8, 0.3)).toBeLessThan(leanRad(8, 0.6));
    expect(leanRad(100, 3)).toBe(MAX_LEAN_RAD);
    expect(leanRad(100, -3)).toBe(-MAX_LEAN_RAD);
  });
  it('stays a little: the limit is under 5 degrees', () => {
    expect((MAX_LEAN_RAD * 180) / Math.PI).toBeLessThan(5);
  });
});

describe('front wheel angle', () => {
  it('straight when no steer key; left is positive, right negative', () => {
    expect(steerAngleRad(0, 'forward')).toBe(0);
    expect(steerAngleRad(1, 'forward')).toBe(MAX_STEER_RAD);
    expect(steerAngleRad(-1, 'forward')).toBe(-MAX_STEER_RAD);
  });
  it('steering is mirrored in reverse, so the wheels turn the other way', () => {
    expect(steerAngleRad(1, 'reverse')).toBe(-MAX_STEER_RAD);
  });
});

describe('swap animation easing', () => {
  it('starts at 0, ends at 1, and overshoots a little on the way', () => {
    expect(easeOutBack(0)).toBe(0);
    expect(easeOutBack(1)).toBeCloseTo(1, 12);
    expect(Math.max(...[0.5, 0.6, 0.7, 0.8].map(easeOutBack))).toBeGreaterThan(1);
  });
  it('clamps outside 0..1', () => {
    expect(easeOutBack(-1)).toBe(0);
    expect(easeOutBack(2)).toBeCloseTo(1, 12);
  });
});
