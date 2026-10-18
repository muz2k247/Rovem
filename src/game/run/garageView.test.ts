import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { roverFromParts } from '../buildFromParts.ts';
import { changeBanner, changeRows, compareRows, displayPartName, fieldLogEntries, garageRows, type GarageRow } from './garageView.ts';
import { garageNumbers } from './garageNumbers.ts';

const build = { chassisId: 'chassis-standard', wheelsId: 'wheels-all-terrain', motorId: 'motor-medium' };
const numbers = (b: typeof build) => garageNumbers(content, roverFromParts(content, b));
const rows = (b: typeof build) => garageRows(numbers(b), 'mps');
const row = (list: GarageRow[], id: string) => list.find((x) => x.id === id)!;

describe('garage rows', () => {
  it('are the five numbers of A5, in order, for the starting build', () => {
    const r = rows(build);
    expect(r.map((x) => x.label)).toEqual([
      'Mass',
      'Top speed',
      'Acceleration on asphalt',
      'Safe speed in a 25 m corner',
      'Deep water',
    ]);
    expect(r.map((x) => x.value)).toEqual(['209 kg', '16.00 m/s', '4.59 m/s²', '14.00 m/s', 'Sinks · 1045 kg/m³']);
  });
  it('show speeds in km/h when asked (× 3.6)', () => {
    const r = garageRows(numbers(build), 'kmh');
    expect(r.find((x) => x.id === 'topSpeed')!.value).toBe('57.60 km/h');
    expect(r.find((x) => x.id === 'cornerSpeed')!.value).toBe('50.40 km/h');
  });
  it('say Floats for a light build', () => {
    const light = garageRows(numbers({ chassisId: 'chassis-light', wheelsId: 'wheels-smooth', motorId: 'motor-small' }), 'mps');
    expect(light.find((x) => x.id === 'water')!.value).toBe('Floats · 755 kg/m³');
  });
  it('carry no change until a part is swapped', () => {
    expect(rows(build).every((x) => x.change === undefined)).toBe(true);
  });
});

describe('change rows (▲/▼ against the build before the swap)', () => {
  const heavy = { ...build, chassisId: 'chassis-heavy' };
  const out = changeRows(numbers(build), numbers(heavy), 'mps');

  it('the Heavy body: mass ▲ +60 kg (209 → 269), acceleration ▼, water density ▲ +300 kg/m³ (269 kg in 0.2 m³)', () => {
    expect(row(out, 'mass')).toMatchObject({ value: '269 kg', change: { direction: 'up', text: '+60 kg' } });
    expect(row(out, 'acceleration').change).toMatchObject({ direction: 'down' });
    expect(row(out, 'water').change).toMatchObject({ direction: 'up', text: '+300 kg/m³' });
  });
  it('a number that does not change shows no arrow (same motor: top speed; same grip: corner speed)', () => {
    expect(row(out, 'topSpeed').change).toBeUndefined();
    expect(row(out, 'cornerSpeed').change).toBeUndefined();
  });
  it('the Small motor: top speed ▲ +2.00 m/s, in km/h ▲ +7.20 km/h', () => {
    const small = { ...build, motorId: 'motor-small' };
    expect(row(changeRows(numbers(build), numbers(small), 'mps'), 'topSpeed').change).toEqual({ direction: 'up', text: '+2.00 m/s' });
    expect(row(changeRows(numbers(build), numbers(small), 'kmh'), 'topSpeed').change).toEqual({ direction: 'up', text: '+7.20 km/h' });
  });
  it('Smooth wheels lower the corner speed (▼) and use a minus sign', () => {
    const smooth = { ...build, wheelsId: 'wheels-smooth' };
    const c = row(changeRows(numbers(build), numbers(smooth), 'mps'), 'cornerSpeed').change!;
    expect(c.direction).toBe('down');
    expect(c.text.startsWith('−')).toBe(true);
  });
  it('the same build both times has no arrows', () => {
    expect(changeRows(numbers(build), numbers(build), 'mps').every((x) => x.change === undefined)).toBe(true);
  });
});

describe('change banner', () => {
  it('names the part and the mass change, with one sentence on why it matters', () => {
    const b = changeBanner(content, build, { ...build, chassisId: 'chassis-heavy' })!;
    expect(b.title).toBe('Heavy body fitted · mass 209 → 269 kg');
    expect(b.why.length).toBeGreaterThan(10);
  });
  it('names the wheels when the wheels change', () => {
    const b = changeBanner(content, build, { ...build, wheelsId: 'wheels-spiked' })!;
    expect(b.title).toBe('Spiked wheels fitted · mass 209 → 217 kg');
  });
  it('is nothing when no part changed', () => {
    expect(changeBanner(content, build, build)).toBeNull();
  });
});

describe('previewing a part on hover', () => {
  it('shows before → after only where something changes', () => {
    const fitted = rows(build);
    const heavy = rows({ ...build, chassisId: 'chassis-heavy' });
    const cmp = compareRows(fitted, heavy);
    expect(row(cmp, 'mass')).toMatchObject({ after: '269 kg' });
    expect((row(cmp, 'topSpeed') as { after?: string }).after).toBeUndefined(); // same motor
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
