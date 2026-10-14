import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { displayPartName, newlyUnlocked, nextUnlock, unlockedPartIds, unlockText } from './unlocks.ts';

describe('unlock ladder', () => {
  it('opens only the starting parts at 0 m', () => {
    expect(unlockedPartIds(content, 0)).toEqual(['chassis-standard', 'wheels-all-terrain', 'motor-medium']);
  });

  it('opens each part at exactly its step, not before', () => {
    const steps: [number, string][] = [
      [200, 'wheels-smooth'], [400, 'chassis-heavy'], [700, 'chassis-light'],
      [1000, 'motor-large'], [1500, 'wheels-spiked'], [2000, 'motor-small'],
    ];
    for (const [m, id] of steps) {
      expect(unlockedPartIds(content, m - 0.001)).not.toContain(id);
      expect(unlockedPartIds(content, m)).toContain(id);
    }
    expect(unlockedPartIds(content, 2000)).toHaveLength(9);
  });

  it('names the next step, and nothing when all are open', () => {
    expect(nextUnlock(content, 0)).toEqual({ partId: 'wheels-smooth', atBestDistanceM: 200 });
    expect(nextUnlock(content, 200)).toEqual({ partId: 'chassis-heavy', atBestDistanceM: 400 });
    expect(nextUnlock(content, 399.9)?.atBestDistanceM).toBe(400);
    expect(nextUnlock(content, 2000)).toBeUndefined();
  });

  it('reports the parts a new best opens, in order', () => {
    expect(newlyUnlocked(content, 150, 450)).toEqual(['wheels-smooth', 'chassis-heavy']);
    expect(newlyUnlocked(content, 450, 450)).toEqual([]);
    expect(newlyUnlocked(content, 0, 199)).toEqual([]);
  });

  it('shows "chassis" as "body" and the unlock text', () => {
    expect(displayPartName('Heavy chassis')).toBe('Heavy body');
    expect(displayPartName('Smooth wheels')).toBe('Smooth wheels');
    expect(unlockText(content, 'chassis-heavy')).toBe('Unlocks at 400 m best distance');
    expect(unlockText(content, 'chassis-standard')).toBeUndefined();
  });
});
