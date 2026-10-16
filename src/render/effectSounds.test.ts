import { describe, expect, it } from 'vitest';
import { effectRecipe, type EffectKind } from './effectSounds.ts';

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
