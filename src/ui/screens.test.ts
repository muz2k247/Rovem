import { describe, expect, it } from 'vitest';
import { PLACEHOLDER_SCREENS, screenFromHash } from './screens.ts';

describe('screens (LEVELS_BUILD_PLAN A3)', () => {
  it('has a slot for every new screen of A3', () => {
    expect([...PLACEHOLDER_SCREENS].sort()).toEqual(['home', 'levelIntro', 'levels', 'pause', 'report', 'settings']);
  });

  it('opens a placeholder only from its hash, so the demo still opens on the garage', () => {
    expect(screenFromHash('')).toBeNull();
    expect(screenFromHash('#nonsense')).toBeNull();
    expect(screenFromHash('#home')).toBe('home');
    expect(screenFromHash('#levelIntro')).toBe('levelIntro');
    expect(screenFromHash('#report')).toBe('report');
  });
});
