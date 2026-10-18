import { describe, expect, it } from 'vitest';
import type { ForceArrow } from '../contracts.ts';
import { createCaptionQueue } from './captions.ts';
import { createForceLine, formatForceLine } from './forceLine.ts';
import { selectArrows, worldDirection } from './arrows.ts';
import { fill, levelText, validateLevelText } from './text.ts';

describe('caption queue', () => {
  const queue = () => createCaptionQueue({ minShowS: 2.5, showS: 5 });

  it('shows one caption at a time, each at least 2.5 s, then the next', () => {
    const q = queue();
    q.push({ title: 'A', line: 'a' }, 0);
    q.push({ title: 'B', line: 'b' }, 0.1);
    expect(q.update(0.2)?.title).toBe('A');
    expect(q.update(2.4)?.title).toBe('A'); // B waits: A has not had 2.5 s
    expect(q.update(2.5)?.title).toBe('B');
  });

  it('a lone caption stays until it has been up 5 s, then goes', () => {
    const q = queue();
    q.push({ title: 'A', line: 'a' }, 0);
    expect(q.update(4.9)?.title).toBe('A');
    expect(q.update(5)).toBeNull();
  });

  it('keeps at most two waiting: a third pushes the oldest waiting one out', () => {
    const q = queue();
    q.push({ title: 'A', line: '' }, 0);
    for (const t of ['B', 'C', 'D']) q.push({ title: t, line: '' }, 0.1);
    expect(q.update(2.5)?.title).toBe('C'); // B was dropped
  });

  it('an urgent caption goes next in the queue', () => {
    const q = queue();
    q.push({ title: 'A', line: '' }, 0);
    q.push({ title: 'B', line: '' }, 0.1);
    q.push({ title: 'Crash', line: '', urgent: true }, 0.2);
    expect(q.update(2.5)?.title).toBe('Crash');
  });

  it('a hint stays until it is done, but not before 2.5 s and not after 5 s', () => {
    let done = false;
    const q = queue();
    q.push({ title: 'Controls', line: 'Hold W', isDone: () => done }, 0);
    done = true;
    expect(q.update(1)?.title).toBe('Controls'); // done, but shown for less than 2.5 s
    expect(q.update(2.5)).toBeNull();
    done = false;
    q.push({ title: 'Controls', line: 'Steer', isDone: () => done }, 10);
    expect(q.update(14)?.line).toBe('Steer');
    expect(q.update(15)).toBeNull(); // expired
  });
});

describe('F = ma line', () => {
  it('formats the A4 example: Push 1000 N − Friction 41 N = 959 N → a = 959 ÷ 209 = 4.59 m/s²', () => {
    const line = formatForceLine(
      [
        { name: 'Push', forceN: 1000 },
        { name: 'Friction', forceN: -40.964 },
      ],
      209,
    );
    expect(line).toBe('Push 1000 N − Friction 41 N = 959 N → a = 959 ÷ 209 = 4.59 m/s²');
  });

  it('lists slope pull, brake and magnet with their signs, and leaves out a force that rounds to 0 N', () => {
    const line = formatForceLine(
      [
        { name: 'Push', forceN: 1000 },
        { name: 'Friction', forceN: -40.07 },
        { name: 'Slope pull', forceN: -425.84 },
        { name: 'Water drag', forceN: -0.2 },
        { name: 'Magnet', forceN: 300 },
      ],
      209,
    );
    expect(line).toBe('Push 1000 N − Friction 40 N − Slope pull 426 N + Magnet 300 N = 834 N → a = 834 ÷ 209 = 3.99 m/s²');
  });

  it('a slowing rover starts with a minus and shows a negative a', () => {
    const line = formatForceLine([{ name: 'Brake', forceN: -1500 }, { name: 'Friction', forceN: -41 }], 209);
    expect(line).toBe('−Brake 1500 N − Friction 41 N = −1541 N → a = −1541 ÷ 209 = −7.37 m/s²');
  });

  it('appears only after |a| ≥ 0.1 m/s² for 0.3 s, and hides when the speed stops changing', () => {
    const fl = createForceLine();
    const terms = [{ name: 'Push', forceN: 1000 }];
    const at = (timeS: number, a: number) => fl.update({ timeS, accelerationMps2: a, terms, massKg: 209, atTopSpeed: false });
    expect(at(0, 4.5)).toBeNull();
    expect(at(0.2, 4.5)).toBeNull();
    expect(at(0.3, 4.5)).not.toBeNull();
    expect(at(0.5, 0.05)).toBeNull();
    expect(at(0.6, 4.5)).toBeNull(); // the 0.3 s starts again
  });

  it('says "Balanced: constant speed" for 2 s on first reaching top speed, once', () => {
    const fl = createForceLine();
    const terms = [{ name: 'Push', forceN: 41 }, { name: 'Friction', forceN: -41 }];
    const at = (timeS: number, top: boolean) => fl.update({ timeS, accelerationMps2: 0, terms, massKg: 209, atTopSpeed: top });
    expect(at(10, true)).toBe('Balanced: constant speed');
    expect(at(11.9, true)).toBe('Balanced: constant speed');
    expect(at(12, true)).toBeNull();
    expect(at(30, false)).toBeNull();
    expect(at(31, true)).toBeNull(); // only the first time
  });
});

describe('force arrows', () => {
  const arrow = (kind: ForceArrow['kind'], forceN: number): ForceArrow => ({ kind, forceN, directionWorld: worldDirection(0) });

  it('shows at most 3, the level’s new element first, then push, then friction', () => {
    const acting = [arrow('friction', 41), arrow('push', 1000), arrow('slope', 426), arrow('weight', 1024), arrow('magnet', 300)];
    expect(selectArrows('crater-field', acting).map((a) => a.kind)).toEqual(['slope', 'push', 'friction']);
    expect(selectArrows('polar-pass', acting).map((a) => a.kind)).toEqual(['magnet', 'push', 'friction']);
    expect(selectArrows('gravity-wells', acting).map((a) => a.kind)).toEqual(['weight', 'push', 'friction']);
  });

  it('shows only forces that act: nothing under 20 N, no slope arrow on flat ground', () => {
    const acting = [arrow('push', 1000), arrow('friction', 15), arrow('slope', 0)];
    expect(selectArrows('first-tracks', acting).map((a) => a.kind)).toEqual(['push']);
  });

  it('the impulse flash comes on top of the three', () => {
    const acting = [arrow('push', 1000), arrow('friction', 41), arrow('slope', 426), arrow('impulse', 2000)];
    const shown = selectArrows('push-and-shove', acting).map((a) => a.kind);
    expect(shown).toHaveLength(4);
    expect(shown[3]).toBe('impulse');
  });

  it('turns physics directions into world directions (z flips)', () => {
    const d = worldDirection(Math.PI / 2);
    expect(d.x).toBeCloseTo(0, 12);
    expect(d.z).toBeCloseTo(-1, 12);
  });
});

describe('level text', () => {
  it('fills tokens and refuses to print a missing one', () => {
    expect(fill('{a} + {b}', { a: 1, b: 'x' })).toBe('1 + x');
    expect(() => fill('{a} {c}', { a: 1 })).toThrow(/no value for \{c\}/);
  });

  it('every caption, hint, outcome and card the engine can ask for exists', () => {
    for (const id of ['surface-mud', 'slip', 'boost', 'hit-headOn', 'gravity-low', 'descent', 'rollback', 'bend', 'slide', 'float', 'magnet-attract', 'pole', 'sample', 'checkpoint', 'crash', 'stuck', 'floated', 'red', 'green', 'fork-result']) {
      expect(levelText.captions[id], id).toBeDefined();
    }
    expect(Object.keys(levelText.hints)).toEqual(['hold-w', 'coast', 'steer', 'brake']);
    expect(levelText.placeholder).toBe(true);
  });

  it('rejects a card without maths', () => {
    expect(() => validateLevelText({ captions: {}, outcomes: {}, hints: {}, cards: { x: { title: 't', sentence: 's' } }, tryThis: {} })).toThrow(/maths/);
  });
});
