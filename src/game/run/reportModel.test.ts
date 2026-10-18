import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { MAX_REPORT_CARDS } from '../contracts.ts';
import { buildReport } from './feedback.ts';
import { buildWithPart, createTraceRecorder, endlessReportModel, TRACE_HZ, tryThisAction } from './reportModel.ts';
import type { RunEnd, RunEvent, RunStats } from './runSession.ts';

const stats = (over: Partial<RunStats> = {}): RunStats => ({
  mudLossMps: 0, mudPatches: 0, boostGainMps: 0, boosts: 0, headOnLossMps: 0, headOnHits: 0,
  kickerGainMps: 0, kickerHits: 0, gravityZones: [], maxSpeedMps: 16, brakeUsed: true, firstEvents: {}, ...over,
});
const FITTED = { chassisId: 'chassis-standard', wheelsId: 'wheels-all-terrain', motorId: 'motor-medium' };
const crash: RunEnd = { cause: 'crash', speedMps: 12 };
const boostEvent: RunEvent = {
  kind: 'boost', timeS: 4.5, xM: 0, speedBeforeMps: 16, speedAfterMps: 21.741627, massKg: 209, impulseNs: 1200,
};
const mudEvent: RunEvent = {
  kind: 'mud', timeS: 2.25, xM: 0, massKg: 209, gravityMps2: 9.8, surfaceRolling: 0.6, wheelRolling: 0.02, frictionN: 100,
};

const report = (s: RunStats, fitted = FITTED, ended: RunEnd = crash) =>
  buildReport({ content, ended, stats: s, distanceM: 812.4, score: 640.2, previousBestDistanceM: 500, previousBestScore: 900, fitted, unit: 'mps' });

describe('speed trace recorder', () => {
  it('keeps one sample every 0.1 s (10 Hz) however often it is called', () => {
    expect(TRACE_HZ).toBe(10);
    const rec = createTraceRecorder();
    for (let step = 0; step <= 240; step++) rec.record(step / 120, step / 120 * 8); // 2 s at 120 steps/s
    const s = rec.samples();
    expect(s).toHaveLength(21);
    expect(s[0]).toEqual({ timeS: 0, speedMps: 0 });
    expect(s[10]!.timeS).toBeCloseTo(1, 9);
    expect(s[10]!.speedMps).toBeCloseTo(8, 9);
  });

  it('adds the final moment so the graph reaches the end of the run', () => {
    const rec = createTraceRecorder();
    rec.record(0, 0);
    rec.record(0.04, 3);
    rec.finish(0.07, 5);
    expect(rec.samples().at(-1)).toEqual({ timeS: 0.07, speedMps: 5 });
  });

  it('does not repeat a sample when finish lands on a sample time', () => {
    const rec = createTraceRecorder();
    rec.record(0, 0);
    rec.record(0.1, 2);
    rec.finish(0.1, 2);
    expect(rec.samples()).toHaveLength(2);
  });
});

describe('tryThisAction', () => {
  it('opens the garage on the part named in the advice, otherwise retries', () => {
    expect(tryThisAction('smoothWheels')).toEqual({ kind: 'garage', partId: 'wheels-smooth' });
    expect(tryThisAction('heavyChassis')).toEqual({ kind: 'garage', partId: 'chassis-heavy' });
    for (const k of ['pickLane', 'brakeFirst', 'dodgeCannon', 'steerEarlier', 'takeBoosts', 'stuckInHighGravity', 'brakeBeforeCorner'] as const) {
      expect(tryThisAction(k)).toEqual({ kind: 'retry' });
    }
  });
  it('only names parts that exist', () => {
    const ids = content.parts.map((p) => p.id);
    for (const k of ['smoothWheels', 'heavyChassis'] as const) {
      const a = tryThisAction(k);
      expect(a.kind === 'garage' && ids.includes(a.partId)).toBe(true);
    }
  });
});

describe('Endless report model', () => {
  const trace = [{ timeS: 0, speedMps: 0 }, { timeS: 5, speedMps: 16 }];

  it('carries the distance, the trace and the try-this text', () => {
    const r = report(stats({ boosts: 1, boostGainMps: 5.74, firstEvents: { boost: boostEvent } }));
    const m = endlessReportModel(r, trace);
    expect(m.result).toEqual({ kind: 'endless', distanceM: 812.4 });
    expect(m.speedTrace).toBe(trace);
    expect(m.tryThis!.text).toBe(r.tryThis);
  });

  it('makes one card per effect, in the same top-3 order as before, with the marker time of its first event', () => {
    const r = report(stats({
      boosts: 1, boostGainMps: 5.74, mudPatches: 2, mudLossMps: 3, firstEvents: { boost: boostEvent, mud: mudEvent },
    }));
    const m = endlessReportModel(r, trace);
    expect(m.cards.map((c) => c.title)).toEqual(r.effects.map((e) => e.label.split(' · ')[0]));
    expect(m.cards.map((c) => c.markerTimeS)).toEqual(r.effects.map((e) => e.markerTimeS));
    expect(m.cards.find((c) => c.title === 'Boosts')!.markerTimeS).toBe(4.5);
    expect(m.cards.find((c) => c.title === 'Mud')!.markerTimeS).toBe(2.25);
  });

  it('keeps the student\'s numbers in the sentence and the worked formula in the maths lines', () => {
    const r = report(stats({ boosts: 1, boostGainMps: 5.74, firstEvents: { boost: boostEvent } }));
    const card = endlessReportModel(r, trace).cards[0]!;
    expect(card.sentence).toContain('gained 5.74 m/s from 1 pad');
    expect(card.mathsLines.join(' ')).toContain('1200');
    expect(card.mathsLines.length).toBeGreaterThan(0);
  });

  it('never makes more than three cards', () => {
    const lots = stats({
      boosts: 1, boostGainMps: 5, mudPatches: 1, mudLossMps: 2, headOnHits: 1, headOnLossMps: 4, kickerHits: 1, kickerGainMps: 3,
      gravityZones: [{ kind: 'low', speedInMps: 16, speedOutMps: 15, outcome: 'out' }],
    });
    expect(endlessReportModel(report(lots), trace).cards.length).toBeLessThanOrEqual(MAX_REPORT_CARDS);
  });

  it('has no cards for a run with no effects', () => {
    expect(endlessReportModel(report(stats()), trace).cards).toEqual([]);
  });

  it('turns the mud advice into a garage button on Smooth wheels', () => {
    const r = report(stats({ mudPatches: 2, mudLossMps: 3, firstEvents: { mud: mudEvent } }));
    expect(endlessReportModel(r, trace).tryThis!.action).toEqual({ kind: 'garage', partId: 'wheels-smooth' });
  });

  it('puts the tunnel lane comparison in the card, as maths lines', () => {
    const r = report(stats({ gravityZones: [{ kind: 'low', speedInMps: 16, speedOutMps: 15.8, outcome: 'out', other: { kind: 'high', outcome: 'out', speedOutMps: 12.31 } }] }));
    const card = endlessReportModel(r, trace).cards[0]!;
    expect(card.mathsLines.some((l) => l.includes('Other lane'))).toBe(true);
  });
});

describe('buildWithPart', () => {
  it('fits the part in its own slot and leaves the other two alone', () => {
    expect(buildWithPart(content, FITTED, 'wheels-smooth')).toEqual({ ...FITTED, wheelsId: 'wheels-smooth' });
    expect(buildWithPart(content, FITTED, 'chassis-heavy')).toEqual({ ...FITTED, chassisId: 'chassis-heavy' });
    expect(buildWithPart(content, FITTED, 'motor-large')).toEqual({ ...FITTED, motorId: 'motor-large' });
  });
  it('ignores an id that is not a part', () => {
    expect(buildWithPart(content, FITTED, 'nonsense')).toEqual(FITTED);
  });
});
