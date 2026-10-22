import { describe, expect, it } from 'vitest';
import { LEVEL_IDS } from '../game/level/types.ts';
import { levelCards, validateLevelCards } from './levelCards.ts';

const copy = () => JSON.parse(JSON.stringify(levelCards));

describe('level cards (LEVELS_BUILD_PLAN A2, A3, A7)', () => {
  it('has the levels in play order (Crash Site first, SHOWCASE_PLAN §7), with the ids of the level files', () => {
    expect(levelCards.levels.map((l) => l.name)).toEqual([
      'Crash Site',
      'Geyser Canyon',
      'Crater Field',
      'The Crossing',
      'Polar Pass',
    ]);
    expect(levelCards.levels.map((l) => l.id)).toEqual([...LEVEL_IDS]);
  });

  it('gives each level 2 or 3 short "New here" sentences', () => {
    for (const l of levelCards.levels) {
      expect(l.newHere.length).toBeGreaterThanOrEqual(2);
      expect(l.newHere.length).toBeLessThanOrEqual(3);
    }
  });

  it('never shows a textbook chapter name or a formula', () => {
    const text = levelCards.levels
      .map((l) => [l.hook, l.goal, ...l.newHere].join(' '))
      .join(' ')
      .toLowerCase();
    for (const banned of ['chapter', 'kinematics', 'dynamics', 'turning effects', 'mechanical properties', '1/d', '÷', '=']) {
      expect(text).not.toContain(banned);
    }
  });

  it('is marked as placeholder text until k._muz has reviewed it', () => {
    expect(levelCards.placeholder).toBe(true);
  });

  it('rejects bad data and names the path', () => {
    const good = copy();
    expect(() => validateLevelCards({ ...good, levels: [] })).toThrow(/levelCards\.levels/);
    const dup = copy();
    dup.levels[1].id = dup.levels[0].id;
    expect(() => validateLevelCards(dup)).toThrow(/levelCards\.levels\[1\]\.id/);
    const few = copy();
    few.levels[2].newHere = ['only one'];
    expect(() => validateLevelCards(few)).toThrow(/levelCards\.levels\[2\]\.newHere/);
    const diagram = copy();
    diagram.levels[0].diagram = 'nope';
    expect(() => validateLevelCards(diagram)).toThrow(/levelCards\.levels\[0\]\.diagram/);
    expect(() => validateLevelCards({ ...good, endless: { name: '' } })).toThrow(/levelCards\.endless/);
  });
});
