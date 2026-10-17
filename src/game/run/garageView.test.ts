import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { roverFromParts } from '../buildFromParts.ts';
import { compareRows, displayPartName, fieldLogEntries, garageRows } from './garageView.ts';
import { garageNumbers } from './garageNumbers.ts';

const build = { chassisId: 'chassis-standard', wheelsId: 'wheels-all-terrain', motorId: 'motor-medium' };
const rows = (b: typeof build) => garageRows(garageNumbers(content, roverFromParts(content, b)), 'mps');

describe('garage rows', () => {
  it('start build: 209 kg, the boost and the sandbag line from the plan (16.00 → 11.82 m/s)', () => {
    const r = rows(build);
    expect(r.find((x) => x.label === 'Mass')!.value).toBe('209 kg');
    expect(r.find((x) => x.label === 'Sandbag hit')!.value).toBe('16.00 → 11.82 m/s');
    expect(r.find((x) => x.label === 'Boost pad')!.value).toBe('+5.74 m/s');
  });
  it('previewing the Heavy body shows before → after only where something changes', () => {
    const fitted = rows(build);
    const heavy = rows({ ...build, chassisId: 'chassis-heavy' });
    const cmp = compareRows(fitted, heavy);
    expect(cmp.find((x) => x.label === 'Mass')!.after).toBe(heavy.find((x) => x.label === 'Mass')!.value);
    expect(cmp.find((x) => x.label === 'Mass')!.after).not.toBe('209 kg');
    expect(cmp.find((x) => x.label === 'Top speed')!.after).toBeUndefined(); // same motor
    expect(compareRows(fitted, fitted).every((x) => x.after === undefined)).toBe(true);
    expect(compareRows(fitted, undefined).every((x) => x.after === undefined)).toBe(true);
  });
});

describe('field log', () => {
  it('writes each formula once: the two hit kinds share a line', () => {
    const entries = fieldLogEntries(['mud', 'headOnHit', 'kickerHit', 'boost'], content.runText);
    const formulas = entries.map((e) => e.formula).filter(Boolean);
    expect(new Set(formulas).size).toBe(formulas.length);
    expect(entries.find((e) => e.kind === 'headOnHit')!.formula).toBe(content.runText.formulas.headOnHit);
    expect(entries.find((e) => e.kind === 'kickerHit')!.formula).toBeUndefined();
    expect(entries.every((e) => e.tidbit.length > 0)).toBe(true);
  });
  it('lists only the kinds met, in a fixed order', () => {
    expect(fieldLogEntries([], content.runText)).toEqual([]);
    expect(fieldLogEntries(['boost', 'mud'], content.runText).map((e) => e.kind)).toEqual(['mud', 'boost']);
  });
});

describe('part names', () => {
  it('shows "chassis" as "body", and leaves other names alone', () => {
    expect(displayPartName('Heavy chassis')).toBe('Heavy body');
    expect(displayPartName('Chassis')).toBe('Body');
    expect(displayPartName('Smooth wheels')).toBe('Smooth wheels');
  });
});
