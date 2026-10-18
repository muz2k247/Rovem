import { describe, expect, it } from 'vitest';
import { builtLevelIds, loadLevelDef } from './levels.ts';
import { testLevelRaw } from './testLevel.ts';
import { LEVEL_IDS } from './types.ts';

describe('level registry', () => {
  it('the seven level ids are exactly these, in play order', () => {
    expect(LEVEL_IDS).toEqual(['first-tracks', 'push-and-shove', 'crater-field', 'gravity-wells', 'ring-road', 'the-crossing', 'polar-pass']);
  });

  it('loads and validates a level file, and lists the ones that exist in play order', () => {
    const files = { 'crater-field': { ...testLevelRaw(), id: 'crater-field' }, 'first-tracks': testLevelRaw() };
    expect(builtLevelIds(files)).toEqual(['first-tracks', 'crater-field']);
    expect(loadLevelDef('first-tracks', files).name).toBe('Test level');
  });

  it('refuses an unknown id, a level with no file, and a file under the wrong id', () => {
    expect(() => loadLevelDef('fork-in-the-road', {})).toThrow(/Unknown level/);
    expect(() => loadLevelDef('ring-road', {})).toThrow(/no level file/);
    expect(() => loadLevelDef('ring-road', { 'ring-road': testLevelRaw() })).toThrow(/says "first-tracks"/);
  });

  it('every level file that is registered is valid (B4 adds them)', () => {
    for (const id of builtLevelIds()) expect(() => loadLevelDef(id)).not.toThrow();
  });
});

describe('atmosphere', () => {
  it('a level file may only ask for a known look (A8)', () => {
    const raw = { ...testLevelRaw(), atmosphere: 'sunny-day' };
    expect(() => loadLevelDef('first-tracks', { 'first-tracks': raw })).toThrow(/level\.atmosphere: unknown value "sunny-day"/);
  });
});
