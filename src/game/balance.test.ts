import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import { balanceReport } from './balance.ts';

const report = balanceReport(content);

describe('balance report matches the Pass check sheet', () => {
  it('covers 27 builds', () => expect(report.rows).toHaveLength(27));
  it('20 of 27 pass Mission 1', () => expect(report.mission1Passes).toBe(20));
  it('9 of 27 pass Mission 2', () => expect(report.mission2Passes).toBe(9));
  it('23 of 27 pass Mission 3', () => expect(report.mission3Passes).toBe(23));
  it('17 builds are faster on the shortcut', () => expect(report.shortcutFaster).toBe(17));
  it('the starting build passes all three', () => {
    const row = report.rows.find((r) => r.name === 'Standard chassis + All-terrain wheels + Medium motor');
    expect(row?.mission1Pass && row.mission2Pass && row.mission3Pass).toBe(true);
  });
  it('6 builds pass all three', () => {
    expect(report.rows.filter((r) => r.mission1Pass && r.mission2Pass && r.mission3Pass)).toHaveLength(6);
  });
});

describe('power-up checks from the Physics Model Specification', () => {
  it('Mission 1: a power-up at the start lets 5 of the 7 failing builds pass', () => {
    expect(report.mission1Failing).toBe(7);
    expect(report.mission1PowerUpRescues).toBe(5);
  });
  it('Mission 2: Grip tyres rescue all 18 failing builds, Smooth bearings the 9 spiked-wheel builds', () => {
    expect(report.mission2Failing).toBe(18);
    expect(report.mission2GripRescues).toBe(18);
    expect(report.mission2BearingRescues).toBe(9);
  });
  it('Mission 3: Brake boost rescues all 4 failing builds, Grip tyres none', () => {
    expect(report.mission3Failing).toBe(4);
    expect(report.mission3BrakeBoostRescues).toBe(4);
    expect(report.mission3GripRescues).toBe(0);
  });
});
