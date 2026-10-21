import { describe, expect, it } from 'vitest';
import { KEY_BINDINGS } from '../controls.ts';
import { levelKeyAction } from './keys.ts';

describe('level keys', () => {
  it('Space flips the pole, R returns to the checkpoint, Esc pauses', () => {
    expect(levelKeyAction('Space')).toBe('flipPole');
    expect(levelKeyAction('KeyR')).toBe('respawn');
    expect(levelKeyAction('Escape')).toBe('pause');
  });

  it('driving keys are not level actions, and R is the same key as the test-drive restart', () => {
    for (const code of [...KEY_BINDINGS.throttle, ...KEY_BINDINGS.brake, ...KEY_BINDINGS.steerLeft, ...KEY_BINDINGS.steerRight]) {
      expect(levelKeyAction(code)).toBeUndefined();
    }
    expect(KEY_BINDINGS.restart).toContain('KeyR');
  });
});

describe('the booster key (SHOWCASE_PLAN §3a)', () => {
  it('Shift, either one, fires the booster', () => {
    expect(levelKeyAction('ShiftLeft')).toBe('booster');
    expect(levelKeyAction('ShiftRight')).toBe('booster');
  });
});
