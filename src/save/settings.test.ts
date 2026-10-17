import { describe, expect, it } from 'vitest';
import { defaultSettings, effectiveVolume, loadSettings, saveSettings, SETTINGS_STORAGE_KEY, type StorageLike } from './settings.ts';

function fakeStorage(initial?: string): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>(initial === undefined ? [] : [[SETTINGS_STORAGE_KEY, initial]]);
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe('settings storage (LEVELS_BUILD_PLAN A3)', () => {
  it('uses its own key, not the demo progress key', () => {
    expect(SETTINGS_STORAGE_KEY).toBe('rovem.settings.v1');
  });

  it('defaults: sound on, arrows and maths on, shake on, graphics high', () => {
    const d = defaultSettings();
    expect(d).toMatchObject({ muted: false, forceArrows: true, showMaths: true, cameraShake: true, graphics: 'high' });
    for (const v of [d.masterVolume, d.engineVolume, d.effectsVolume]) expect(v).toBeGreaterThan(0);
  });

  it('loads defaults when nothing is saved, the data is broken, or storage is missing', () => {
    expect(loadSettings(fakeStorage())).toEqual(defaultSettings());
    expect(loadSettings(fakeStorage('{not json'))).toEqual(defaultSettings());
    expect(loadSettings(fakeStorage('[1,2]'))).toEqual(defaultSettings());
    expect(loadSettings(undefined)).toEqual(defaultSettings());
  });

  it('round-trips every field', () => {
    const storage = fakeStorage();
    const changed = { masterVolume: 0.4, engineVolume: 0.2, effectsVolume: 0.9, muted: true, forceArrows: false, showMaths: false, cameraShake: false, graphics: 'low' as const };
    expect(saveSettings(changed, storage)).toBe(true);
    expect(loadSettings(storage)).toEqual(changed);
  });

  it('keeps every valid field when one field is bad', () => {
    const loaded = loadSettings(fakeStorage(JSON.stringify({ masterVolume: 7, engineVolume: 0.3, graphics: 'ultra', muted: true, forceArrows: 'yes' })));
    expect(loaded.engineVolume).toBe(0.3);
    expect(loaded.muted).toBe(true);
    expect(loaded.masterVolume).toBe(defaultSettings().masterVolume); // out of 0–1
    expect(loaded.graphics).toBe('high');
    expect(loaded.forceArrows).toBe(true);
  });

  it('does not fail the game when storage throws', () => {
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('full');
      },
    };
    expect(loadSettings(throwing)).toEqual(defaultSettings());
    expect(saveSettings(defaultSettings(), throwing)).toBe(false);
    expect(saveSettings(defaultSettings(), undefined)).toBe(false);
  });

  it('works out the volume of a channel: master × channel, zero while muted', () => {
    const s = { ...defaultSettings(), masterVolume: 0.5, engineVolume: 0.4, effectsVolume: 1 };
    expect(effectiveVolume(s, 'engine')).toBeCloseTo(0.2, 12);
    expect(effectiveVolume(s, 'effects')).toBeCloseTo(0.5, 12);
    expect(effectiveVolume({ ...s, muted: true }, 'engine')).toBe(0);
    expect(effectiveVolume({ ...s, muted: true }, 'effects')).toBe(0);
  });
});
