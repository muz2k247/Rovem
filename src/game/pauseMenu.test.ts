import { describe, expect, it } from 'vitest';
import { pauseMenuItems } from './pauseMenu.ts';

describe('pause menu (LEVELS_BUILD_PLAN A3)', () => {
  it('in a level: resume, back to checkpoint, restart, garage, settings, level select, home', () => {
    expect(pauseMenuItems('level').map((i) => i.action)).toEqual(['resume', 'checkpoint', 'restart', 'garage', 'settings', 'levels', 'home']);
  });

  it('in the endless run: the same without the checkpoint, which Endless does not have', () => {
    expect(pauseMenuItems('endless').map((i) => i.action)).toEqual(['resume', 'restart', 'garage', 'settings', 'levels', 'home']);
  });

  it('resume comes first, and every item has a label', () => {
    for (const mode of ['level', 'endless'] as const) {
      const items = pauseMenuItems(mode);
      expect(items[0]!.action).toBe('resume');
      expect(items.every((i) => i.label !== '')).toBe(true);
    }
  });

  it('says what a choice costs: garage restarts the level; leaving ends the run', () => {
    const level = pauseMenuItems('level');
    expect(level.find((i) => i.action === 'garage')!.note).toBe('restarts the level');
    const endless = pauseMenuItems('endless');
    expect(endless.find((i) => i.action === 'home')!.note).toBe('ends this run');
  });
});
