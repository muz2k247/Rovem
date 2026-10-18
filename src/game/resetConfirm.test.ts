import { describe, expect, it } from 'vitest';
import { disarmReset, pressReset, resetIdle } from './resetConfirm.ts';

describe('reset progress needs two presses (A3)', () => {
  it('the first press only arms it', () => {
    const r = pressReset(resetIdle);
    expect(r.confirmed).toBe(false);
    expect(r.state.armed).toBe(true);
  });

  it('the second press confirms and disarms', () => {
    const r = pressReset(pressReset(resetIdle).state);
    expect(r.confirmed).toBe(true);
    expect(r.state.armed).toBe(false);
  });

  it('a third press starts over: it arms again and does not confirm', () => {
    const r = pressReset(pressReset(pressReset(resetIdle).state).state);
    expect(r.confirmed).toBe(false);
    expect(r.state.armed).toBe(true);
  });

  it('doing anything else disarms it, so the next press arms again', () => {
    const armed = pressReset(resetIdle).state;
    expect(pressReset(disarmReset()).confirmed).toBe(false);
    expect(armed.armed).toBe(true);
  });
});
