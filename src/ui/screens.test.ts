import { describe, expect, it } from 'vitest';
import { HASH_SCREENS, screenFromHash } from './screens.ts';

describe('screens (LEVELS_BUILD_PLAN A3)', () => {
  it('has a slot for every screen of A3 except Pause and the report, which are shown over a run', () => {
    expect([...HASH_SCREENS].sort()).toEqual(['home', 'levelIntro', 'levels', 'settings']);
  });

  it('has no address for the report: it needs the data of the run that just ended', () => {
    expect(screenFromHash('#report')).toBeNull();
  });

  it('opens a screen from its hash; without one the game opens on Home', () => {
    expect(screenFromHash('')).toBeNull();
    expect(screenFromHash('#nonsense')).toBeNull();
    expect(screenFromHash('#pause')).toBeNull();
    expect(screenFromHash('#home')).toBe('home');
    expect(screenFromHash('#levelIntro')).toBe('levelIntro');
    expect(screenFromHash('#settings')).toBe('settings');
  });
});
