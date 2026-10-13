import { describe, expect, it } from 'vitest';
import { createKeyTracker } from './controls.ts';

const idle = { throttleHeld: false, brakeHeld: false, steer: 0 };

describe('key tracker', () => {
  it('reads nothing when no key is held', () => {
    expect(createKeyTracker().read()).toEqual(idle);
  });

  it('W and the up arrow both mean throttle; S and the down arrow both mean brake', () => {
    for (const code of ['KeyW', 'ArrowUp']) {
      const k = createKeyTracker();
      k.down(code);
      expect(k.read()).toEqual({ ...idle, throttleHeld: true });
    }
    for (const code of ['KeyS', 'ArrowDown']) {
      const k = createKeyTracker();
      k.down(code);
      expect(k.read()).toEqual({ ...idle, brakeHeld: true });
    }
  });

  it('A and left arrow steer left (+1); D and right arrow steer right (−1)', () => {
    for (const code of ['KeyA', 'ArrowLeft']) {
      const k = createKeyTracker();
      k.down(code);
      expect(k.read().steer).toBe(1);
    }
    for (const code of ['KeyD', 'ArrowRight']) {
      const k = createKeyTracker();
      k.down(code);
      expect(k.read().steer).toBe(-1);
    }
  });

  it('both sets work at the same time: releasing one key of a pair keeps the action while the other is held', () => {
    const k = createKeyTracker();
    k.down('KeyW');
    k.down('ArrowUp');
    k.up('KeyW');
    expect(k.read().throttleHeld).toBe(true);
    k.up('ArrowUp');
    expect(k.read().throttleHeld).toBe(false);
  });

  it('left and right together cancel; throttle and brake are both reported (the physics lets the brake win)', () => {
    const k = createKeyTracker();
    ['KeyA', 'KeyD', 'KeyW', 'KeyS'].forEach((c) => k.down(c));
    expect(k.read()).toEqual({ throttleHeld: true, brakeHeld: true, steer: 0 });
  });

  it('reports which codes it handles, and clears everything on blur', () => {
    const k = createKeyTracker();
    expect(k.handles('ArrowUp')).toBe(true);
    expect(k.handles('KeyQ')).toBe(false);
    k.down('KeyW');
    k.clear();
    expect(k.read()).toEqual(idle);
  });
});
