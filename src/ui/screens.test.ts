import { describe, expect, it } from 'vitest';
import { HASH_SCREENS, PLACEHOLDER_SCREENS, screenFromHash } from './screens.ts';

describe('screens (LEVELS_BUILD_PLAN A3)', () => {
  it('has a slot for every screen of A3 except Pause, which is an overlay', () => {
    expect([...HASH_SCREENS].sort()).toEqual(['home', 'levelIntro', 'levels', 'report', 'settings']);
  });

  it('only the report is still a placeholder (A3 session)', () => {
    expect([...PLACEHOLDER_SCREENS]).toEqual(['report']);
  });

  it('opens a screen from its hash; without one the game opens on Home', () => {
    expect(screenFromHash('')).toBeNull();
    expect(screenFromHash('#nonsense')).toBeNull();
    expect(screenFromHash('#pause')).toBeNull();
    expect(screenFromHash('#home')).toBe('home');
    expect(screenFromHash('#levelIntro')).toBe('levelIntro');
    expect(screenFromHash('#settings')).toBe('settings');
    expect(screenFromHash('#report')).toBe('report');
  });
});
