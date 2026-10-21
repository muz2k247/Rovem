import { describe, expect, it } from 'vitest';
import { controlsList, formatClock, keyLabel } from './controlsText.ts';

describe('key labels and the controls list (A3: shown on Home, the intro and the hint)', () => {
  it('turns key codes into the labels on the keys', () => {
    expect(keyLabel('KeyW')).toBe('W');
    expect(keyLabel('ArrowUp')).toBe('↑');
    expect(keyLabel('ArrowLeft')).toBe('←');
    expect(keyLabel('Space')).toBe('Space');
    expect(keyLabel('Escape')).toBe('Esc');
  });

  it('lists throttle, brake (with reverse), steer and pause, both key sets', () => {
    const list = controlsList();
    expect(list.map((c) => c.does)).toEqual(['Throttle', 'Brake. Keep holding after you stop to reverse', 'Steer', 'Pause']);
    expect(list[0]!.keys).toBe('W / ↑');
    expect(list[1]!.keys).toBe('S / ↓');
    expect(list[2]!.keys).toBe('A D / ← →');
    expect(list[3]!.keys).toBe('Esc');
  });

  it('adds the level keys when asked', () => {
    const list = controlsList({ levels: true, extra: ['Space: flip your magnet'] });
    expect(list.map((c) => c.keys)).toContain('R');
    expect(list.find((c) => c.keys === 'R')!.does).toBe('Back to the last checkpoint');
    expect(list.find((c) => c.keys === 'Shift')!.does).toBe('Booster: a big push, once per try');
    expect(list[list.length - 1]).toEqual({ keys: 'Space', does: 'flip your magnet' });
  });
});

describe('clock text (CLAUDE.md: times to 2 decimals)', () => {
  it('shows seconds under a minute and m:ss.cc after', () => {
    expect(formatClock(0)).toBe('0.00 s');
    expect(formatClock(8.5)).toBe('8.50 s');
    expect(formatClock(59.994)).toBe('59.99 s');
    expect(formatClock(60)).toBe('1:00.00');
    expect(formatClock(65.4321)).toBe('1:05.43');
    expect(formatClock(605)).toBe('10:05.00');
  });

  it('never shows a rounded-up 60.00 s', () => {
    expect(formatClock(59.996)).toBe('1:00.00');
  });
});
