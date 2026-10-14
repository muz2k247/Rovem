import { describe, expect, it } from 'vitest';
import {
  DEMO_STORAGE_KEY, defaultProgress, loadDemoProgress, recordRun, saveDemoProgress, type StorageLike,
} from './demoProgress.ts';

function fakeStorage(initial?: string): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(DEMO_STORAGE_KEY, initial);
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}
const throwing: StorageLike = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('full');
  },
};

describe('demo progress', () => {
  it('uses the storage key rovem.demo.v1', () => {
    expect(DEMO_STORAGE_KEY).toBe('rovem.demo.v1');
  });

  it('starts with defaults: the starting build, m/s, forces and sound on', () => {
    const p = loadDemoProgress(fakeStorage());
    expect(p).toEqual(defaultProgress());
    expect(p.build).toEqual({ chassisId: 'chassis-standard', wheelsId: 'wheels-all-terrain', motorId: 'motor-medium' });
    expect(p.lastSeed).toBeNull();
    expect(p.speedUnit).toBe('mps');
    expect(p.showForces).toBe(true);
    expect(p.soundOn).toBe(true);
  });

  it('round-trips everything', () => {
    const storage = fakeStorage();
    const p = {
      bestDistanceM: 812.5, bestScore: 4210, lastSeed: 987654, seenEvents: ['mud', 'boost'] as const,
      build: { chassisId: 'chassis-heavy', wheelsId: 'wheels-smooth', motorId: 'motor-medium' },
      speedUnit: 'kmh' as const, showForces: false, soundOn: false,
    };
    expect(saveDemoProgress({ ...p, seenEvents: [...p.seenEvents] }, storage)).toBe(true);
    expect(loadDemoProgress(storage)).toEqual({ ...p, seenEvents: [...p.seenEvents] });
  });

  it('storage that throws falls back to defaults and does not throw', () => {
    expect(loadDemoProgress(throwing)).toEqual(defaultProgress());
    expect(saveDemoProgress(defaultProgress(), throwing)).toBe(false);
    expect(saveDemoProgress(defaultProgress(), undefined)).toBe(false);
    expect(loadDemoProgress(undefined)).toEqual(defaultProgress());
  });

  it('broken or foreign data falls back field by field', () => {
    expect(loadDemoProgress(fakeStorage('not json'))).toEqual(defaultProgress());
    expect(loadDemoProgress(fakeStorage('[1,2]'))).toEqual(defaultProgress());
    const p = loadDemoProgress(fakeStorage(JSON.stringify({
      bestDistanceM: -5, bestScore: 300, lastSeed: 1.5, build: { chassisId: 3 }, seenEvents: ['mud', 'nonsense', 'ice'],
      speedUnit: 'mph', showForces: 'yes', soundOn: false,
    })));
    expect(p.bestDistanceM).toBe(0);
    expect(p.bestScore).toBe(300);
    expect(p.lastSeed).toBeNull();
    expect(p.build).toEqual(defaultProgress().build);
    expect(p.seenEvents).toEqual(['mud', 'ice']);
    expect(p.speedUnit).toBe('mps');
    expect(p.showForces).toBe(true);
    expect(p.soundOn).toBe(false);
  });

  it('recordRun keeps the better bests, stores the seed and merges the seen kinds without duplicates', () => {
    const p0 = { ...defaultProgress(), bestDistanceM: 500, bestScore: 2000, seenEvents: ['mud' as const] };
    const worse = recordRun(p0, { distanceM: 300, score: 1500.4, seed: 7, eventKinds: ['mud', 'boost'] });
    expect(worse.bestDistanceM).toBe(500);
    expect(worse.bestScore).toBe(2000);
    expect(worse.lastSeed).toBe(7);
    expect(worse.seenEvents).toEqual(['mud', 'boost']);
    const better = recordRun(worse, { distanceM: 620.5, score: 2500.6, seed: 8, eventKinds: [] });
    expect(better.bestDistanceM).toBe(620.5);
    expect(better.bestScore).toBe(2501);
    expect(better.lastSeed).toBe(8);
    expect(p0.bestDistanceM).toBe(500); // the input is not changed
  });
});
