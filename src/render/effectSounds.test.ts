import { describe, expect, it } from 'vitest';
import { SLIDE_MARK_DEG, SLIDE_SOUND_DEG } from '../game/run/drift.ts';
import { effectRecipe, squealTone, type EffectKind } from './effectSounds.ts';

const KINDS: EffectKind[] = ['boost', 'sandbagHit', 'kickerHit', 'thud'];

describe('effect recipes', () => {
  it('every effect has at least one tone, all with positive frequencies and short, audible lengths', () => {
    for (const kind of KINDS) {
      const r = effectRecipe(kind);
      expect(r.tones.length).toBeGreaterThan(0);
      for (const t of r.tones) {
        expect(t.fromHz).toBeGreaterThan(0);
        expect(t.toHz).toBeGreaterThan(0); // exponential ramps cannot reach 0
        expect(t.durationS).toBeGreaterThan(0);
        expect(t.durationS).toBeLessThan(1);
        expect(t.gain).toBeGreaterThan(0);
        expect(t.gain).toBeLessThanOrEqual(0.5);
      }
    }
  });
  it('a boost rises, a sandbag hit falls, and the crash is the lowest and longest', () => {
    expect(effectRecipe('boost').tones[0]!.toHz).toBeGreaterThan(effectRecipe('boost').tones[0]!.fromHz);
    expect(effectRecipe('sandbagHit').tones[0]!.toHz).toBeLessThan(effectRecipe('sandbagHit').tones[0]!.fromHz);
    expect(effectRecipe('thud').tones[0]!.toHz).toBeLessThan(effectRecipe('sandbagHit').tones[0]!.toHz);
    expect(effectRecipe('thud').tones[0]!.durationS).toBeGreaterThan(effectRecipe('sandbagHit').tones[0]!.durationS);
  });
});

describe('tyre squeal', () => {
  it('is audible but quiet, and rises in pitch and volume with speed', () => {
    const slow = squealTone(0);
    const fast = squealTone(1);
    expect(slow.gain).toBeGreaterThan(0);
    expect(fast.gain).toBeLessThanOrEqual(0.03 + 1e-12); // about half of the old two-tone squeal (0.06 at top speed)
    expect(slow.gain).toBeCloseTo(0.0125, 9);
    expect(fast.gain).toBeCloseTo(0.03, 9);
    expect(fast.frequencyHz).toBeGreaterThan(slow.frequencyHz);
    expect(fast.gain).toBeGreaterThan(slow.gain);
    expect(squealTone(5)).toEqual(fast); // clamped
    expect(squealTone(-1)).toEqual(slow);
  });
  it('is a hiss of filtered noise: a high, wide band, not a tone', () => {
    const t = squealTone(0.5);
    expect(t.frequencyHz).toBeGreaterThan(2000);
    expect(t.q).toBeLessThan(1.5);
  });
  it('starts at a 10° slide; skid marks start earlier, at 5°', () => {
    expect(SLIDE_SOUND_DEG).toBe(10);
    expect(SLIDE_MARK_DEG).toBe(5);
  });
});
