import { describe, expect, it } from 'vitest';
import { content } from './index.ts';
import { garageText, validateGarageText } from './garage.ts';

const ids = content.parts.map((p) => p.id);

describe('garage text', () => {
  it('has the 25 m corner of A5 and a sentence for each of the nine parts', () => {
    expect(garageText.cornerRadiusM).toBe(25);
    expect(ids).toHaveLength(9);
    for (const id of ids) expect(garageText.why[id]!.length).toBeGreaterThan(10);
  });
  it('is marked placeholder until k._muz has reviewed it', () => {
    expect(garageText.placeholder).toBe(true);
  });
  it('rejects a part with no sentence, and a bad radius', () => {
    expect(() => validateGarageText({ cornerRadiusM: 25, why: {} }, ['chassis-light'])).toThrow(/garage\.why\.chassis-light/);
    expect(() => validateGarageText({ cornerRadiusM: 0, why: {} }, [])).toThrow(/cornerRadiusM/);
    expect(() => validateGarageText(null, [])).toThrow(/garage/);
  });
});
