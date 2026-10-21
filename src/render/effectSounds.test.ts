import { describe, expect, it } from 'vitest';
import { SLIDE_MARK_DEG, SLIDE_SOUND_DEG } from '../game/run/drift.ts';
import { MOMENT_SOUNDS } from '../game/moments.ts';
import { effectForSound, effectRecipe, rollTone, squealTone, type EffectKind } from './effectSounds.ts';

const KINDS: EffectKind[] = ['boost', 'sandbagHit', 'kickerHit', 'thud', 'hiss', 'squelch', 'skid', 'crunch', 'scrape', 'rumble', 'hum', 'splash'];

describe('effect recipes', () => {
  it('every effect makes some sound: a tone or a burst of noise, with positive frequencies and short, audible lengths', () => {
    for (const kind of KINDS) {
      const r = effectRecipe(kind);
      expect(r.tones.length + (r.noise ? 1 : 0), kind).toBeGreaterThan(0);
      if (r.noise) {
        expect(r.noise.durationS, kind).toBeLessThan(1);
        expect(r.noise.gain, kind).toBeGreaterThan(0);
        expect(r.noise.gain, kind).toBeLessThanOrEqual(0.5);
        expect(r.noise.filterHz, kind).toBeGreaterThan(0);
      }
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
  it('every sound a moment names is made by a recipe (squeal is the continuous hiss)', () => {
    for (const sound of MOMENT_SOUNDS) {
      const kind = effectForSound(sound);
      if (sound === 'squeal') expect(kind).toBeUndefined();
      else expect(KINDS, sound).toContain(kind);
    }
    expect(effectForSound('thump')).toBe('sandbagHit');
    expect(effectForSound('thump', { gained: true })).toBe('kickerHit');
    expect(effectForSound('whoosh')).toBe('boost');
  });
  it('the new sounds fit what they are: sand is dry and bright, mud is low and dull, the cave rumbles deeper than a sandbag thump', () => {
    expect(effectRecipe('hiss').noise!.filterHz).toBeGreaterThan(effectRecipe('squelch').noise!.filterHz * 4);
    expect(effectRecipe('squelch').noise!.filterHz).toBeLessThan(1000);
    expect(effectRecipe('rumble').tones[0]!.toHz).toBeLessThan(effectRecipe('sandbagHit').tones[0]!.toHz);
    expect(effectRecipe('crunch').noise!.gain).toBeGreaterThan(effectRecipe('scrape').noise!.gain);
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

describe('tyres on each surface', () => {
  it('are silent at rest and rise with speed, on every surface', () => {
    for (const id of ['asphalt', 'sand', 'mud', 'ice']) {
      expect(rollTone(id, 0).gain, id).toBe(0);
      expect(rollTone(id, 1).gain, id).toBeGreaterThan(rollTone(id, 0.5).gain);
      expect(rollTone(id, 1).frequencyHz, id).toBeGreaterThan(rollTone(id, 0).frequencyHz);
    }
  });
  it('sound different: sand is bright and clear, mud is low and loud, rock is faint, ice is nearly silent', () => {
    expect(rollTone('sand', 1).frequencyHz).toBeGreaterThan(rollTone('mud', 1).frequencyHz * 4);
    expect(rollTone('mud', 1).gain).toBeGreaterThan(rollTone('asphalt', 1).gain);
    expect(rollTone('ice', 1).gain).toBeLessThan(rollTone('asphalt', 1).gain);
    expect(rollTone('asphalt', 1).gain).toBeLessThan(0.02); // far quieter than the engine
  });
  it('clamps the speed and treats an unknown surface as rock', () => {
    expect(rollTone('sand', 7)).toEqual(rollTone('sand', 1));
    expect(rollTone('lava', 0.5)).toEqual(rollTone('asphalt', 0.5));
  });
});
