import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { levelsConfig } from '../../content/levelsConfig.ts';
import { STARTING_BUILD } from '../buildFromParts.ts';
import { loadLevel } from './levelChecks.ts';
import { versusLastRun, type LastRun } from './lastRun.ts';
import { createScavengerRun } from './scavenger.ts';
import { explainStretches, type StretchReportInput } from './stretchReport.ts';
import type { StretchCauses, StretchRecord } from './stretches.ts';
import { levelText } from './text.ts';
import { runPilot } from './autopilot.ts';

// "vs your last run" (SHOWCASE_PLAN §9 rule 5) and the Scavenger's build in the "why" line (rule 3), on numbers worked out by hand.

const none = (): StretchCauses => ({
  gripLimitS: 0, gripLimitN: 0, crashes: 0, scrapes: 0, scrapeSpeedLostMps: 0, rollingBackS: 0, hits: 0, hitSpeedChangeMps: 0, boosts: 0,
  surfaceS: {}, surfaceInfo: {},
});
const rec = (id: string, name: string, timeS: number, causes: Partial<StretchCauses> = {}): StretchRecord => ({
  id, name, cleanS: 10, enteredAtS: 0, entrySpeedMps: 10, exitSpeedMps: 12, timeS, causes: { ...none(), ...causes },
});

const smooth = { ...STARTING_BUILD, wheelsId: 'wheels-smooth' };
const spiked = { ...STARTING_BUILD, wheelsId: 'wheels-spiked' };
const last = (build = smooth): LastRun => ({ build, totalS: 100, stretches: [{ id: 'dunes', name: 'The Dunes', timeS: 16.5 }, { id: 'ring', name: 'The Ring', timeS: 15 }, { id: 'climb', name: 'The Climb', timeS: 15.7 }] });
const now = [rec('dunes', 'The Dunes', 17), rec('ring', 'The Ring', 12.6), rec('climb', 'The Climb', 15.6)];
const base = { content, records: now, totalS: 97.9, text: levelText.stretch, minGapS: levelsConfig.report.minGapS };

describe('vs your last run', () => {
  it('names the part that changed, and the two stretches that moved most, with signs', () => {
    const v = versusLastRun({ ...base, build: spiked, last: last() });
    expect(v.changed).toEqual(['the wheels (Smooth wheels → Spiked wheels)']);
    expect(v.line).toBe('vs your last run: you changed the wheels (Smooth wheels → Spiked wheels). The Ring: −2.40 s. The Dunes: +0.50 s. Whole level: −2.10 s.');
  });

  it('reads as a fair test when one part changed: only that part is named', () => {
    const v = versusLastRun({ ...base, build: spiked, last: last() });
    expect(v.changed).toHaveLength(1);
  });

  it('names every part that changed', () => {
    const v = versusLastRun({ ...base, build: { chassisId: 'chassis-heavy', wheelsId: 'wheels-spiked', motorId: 'motor-large' }, last: last() });
    expect(v.changed).toHaveLength(3);
    expect(v.line).toContain(' and ');
  });

  it('says so when nothing changed, and when no stretch moved by the smallest gap that counts', () => {
    const same = versusLastRun({ ...base, records: [rec('dunes', 'The Dunes', 16.6), rec('ring', 'The Ring', 15.1), rec('climb', 'The Climb', 15.7)], totalS: 99.9, build: smooth, last: last() });
    expect(same.changed).toEqual([]);
    expect(same.line).toBe('vs your last run: you changed nothing. No stretch moved by 0.50 s or more. Whole level: −0.10 s.');
  });

  it('skips a stretch the last run never reached', () => {
    const v = versusLastRun({ ...base, records: [{ ...rec('ring', 'The Ring', 12.6), enteredAtS: null }, rec('dunes', 'The Dunes', 18)], build: spiked, last: last() });
    expect(v.line).toContain('The Dunes: +1.50 s.');
    expect(v.line).not.toContain('The Ring');
  });
});

describe('the Scavenger’s build in the "why" line (rule 3)', () => {
  const rival = { wheelsName: 'smooth wheels', gripN: (id: string) => (id === 'sand' ? 788.2 : 1311.4), rollingN: (id: string) => (id === 'sand' ? 400.2 : 100) };
  const input = (records: StretchRecord[]): StretchReportInput => ({
    levelId: 'crash-site', records, events: [], roadName: (id) => id, text: levelText.stretch,
    minGapS: levelsConfig.report.minGapS, minCauseS: levelsConfig.report.minCauseS, suggest: {}, rival,
  });
  const lose = (causes: Partial<StretchCauses>) => [{ ...rec('ring', 'The Ring', 14.6, causes), cleanS: 12 }];

  it('is mentioned after a grip cause', () => {
    const why = explainStretches(input(lose({ gripLimitS: 1.8, gripLimitN: 1310 })))!.explanation.why;
    expect(why).toBe("You were past your grip limit for 1.80 s: your wheels grip with up to 1310 N. The Scavenger's smooth wheels grip with up to 1311 N there.");
  });

  it('works its grip out on the same ground as yours, so the same wheels give the same number', () => {
    const why = explainStretches(input(lose({ gripLimitS: 1.8, gripLimitN: 788, gripSurfaceId: 'sand' })))!.explanation.why;
    expect(why).toContain('grip with up to 788 N. The Scavenger\'s smooth wheels grip with up to 788 N there.');
  });

  it('is mentioned after a rolling-friction cause', () => {
    const why = explainStretches(input(lose({ surfaceS: { sand: 3 }, surfaceInfo: { sand: { frictionN: 500, rockN: 80 } } })))!.explanation.why;
    expect(why).toContain("The Scavenger's smooth wheels meet 400 N there.");
  });

  it('is never mentioned after a crash, a scrape or a roll back', () => {
    for (const causes of [{ crashes: 1 }, { scrapes: 2, scrapeSpeedLostMps: 3 }, { rollingBackS: 2 }] as Partial<StretchCauses>[]) {
      expect(explainStretches(input(lose(causes)))!.explanation.why).not.toContain('Scavenger');
    }
  });
});

describe('the report of a race (Crash Site)', () => {
  const { def, plans } = loadLevel('crash-site');
  const ghost = createScavengerRun(content, def)!;

  it('compares the strip with the Scavenger’s time on each stretch, not with the file’s clean drive', () => {
    const r = runPilot({ content, def, plan: plans.stars, scavenger: ghost });
    const report = r.session.report();
    expect(report.stretches!.map((s) => s.cleanS)).toEqual([...ghost.stretchTimesS]);
    expect(report.result.kind === 'level' && report.result.scavengerS).toBe(ghost.finishAtS);
  });

  it('adds "vs your last run" after a retry with a changed part, kept only in memory', () => {
    const first = runPilot({ content, def, build: { ...STARTING_BUILD, wheelsId: 'wheels-smooth' }, plan: plans.stars, scavenger: ghost });
    const record = first.session.lastRunRecord({ ...STARTING_BUILD, wheelsId: 'wheels-smooth' })!;
    expect(record.stretches.map((s) => s.id)).toEqual(def.stretches.map((s) => s.id));
    // The spiked wheels drag on the dunes; the firm ridge road is the way every build finishes.
    const second = runPilot({ content, def, build: { ...STARTING_BUILD, wheelsId: 'wheels-spiked' }, plan: plans.safe, scavenger: ghost });
    expect(second.finished).toBe(true);
    const report = second.session.report({ build: { ...STARTING_BUILD, wheelsId: 'wheels-spiked' }, last: record });
    expect(report.versusLast?.changed).toEqual(['the wheels (Smooth wheels → Spiked wheels)']);
    // The first run has no last run to compare with.
    expect(first.session.report({ build: STARTING_BUILD }).versusLast).toBeUndefined();
  });
});
