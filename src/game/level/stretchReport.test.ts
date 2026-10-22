import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { levelsConfig } from '../../content/levelsConfig.ts';
import { STARTING_BUILD, roverFromParts } from '../buildFromParts.ts';
import { partPickup } from './report.ts';
import type { LevelEvent } from './session.ts';
import { explainStretches, suggestParts, type PartSuggestions, type StretchReportInput } from './stretchReport.ts';
import type { StretchCauses, StretchRecord } from './stretches.ts';
import { levelText } from './text.ts';

// The strip and the three lines (SHOWCASE_PLAN §9), on records worked out by hand. The gap is the clean time minus
// yours, so a negative gap is time lost.

const none = (): StretchCauses => ({
  gripLimitS: 0, gripLimitN: 0, crashes: 0, scrapes: 0, scrapeSpeedLostMps: 0, rollingBackS: 0, hits: 0, hitSpeedChangeMps: 0, boosts: 0,
  surfaceS: {}, surfaceInfo: {},
});

let clock = 0;
function rec(id: string, name: string, cleanS: number, timeS: number, causes: Partial<StretchCauses> = {}, speeds: [number, number] = [14, 15]): StretchRecord {
  const enteredAtS = clock;
  clock += timeS;
  return { id, name, cleanS, enteredAtS, entrySpeedMps: speeds[0], exitSpeedMps: speeds[1], timeS, causes: { ...none(), ...causes } };
}
const noSuggestions: PartSuggestions = {};
const input = (records: StretchRecord[], over: Partial<StretchReportInput> = {}): StretchReportInput => ({
  levelId: 'crash-site', records, events: [], roadName: (id) => id, text: levelText.stretch,
  minGapS: levelsConfig.report.minGapS, minCauseS: levelsConfig.report.minCauseS, suggest: noSuggestions, ...over,
});

// `rec` is called while the arguments of `level` are evaluated, in order, so the clock must be reset first.
const records = (...make: (() => StretchRecord)[]): StretchRecord[] => {
  clock = 0;
  return make.map((f) => f());
};

describe('the report strip (P6)', () => {
  it('shows each stretch with the gap to a clean drive: clean − yours', () => {
    const rep = explainStretches(
      input(records(() => rec('a', 'Wreck', 10, 9.7), () => rec('b', 'Dunes', 15, 15.4), () => rec('c', 'The Ring', 12, 14.6))),
    )!;
    expect(rep.stretches.map((s) => [s.id, Math.round(s.gainS * 100) / 100])).toEqual([['a', 0.3], ['b', -0.4], ['c', -2.6]]);
    expect(rep.stretches[2]).toMatchObject({ name: 'The Ring', timeS: 14.6, cleanS: 12, entrySpeedMps: 14, exitSpeedMps: 15 });
  });

  it('waits for a finished run: while a stretch is still running there is no report', () => {
    const r = records(() => rec('a', 'A', 10, 10));
    r[0] = { ...r[0]!, exitSpeedMps: null };
    expect(explainStretches(input(r))).toBeUndefined();
  });
});

describe('the headline (rule 1)', () => {
  it('is the biggest loss', () => {
    const rep = explainStretches(
      input(records(() => rec('a', 'Wreck', 10, 9.7), () => rec('b', 'Dunes', 15, 15.4), () => rec('c', 'The Ring', 12, 14.6), () => rec('d', 'Climb', 14, 14.9))),
    )!;
    expect(rep.explanation.stretchId).toBe('c');
    expect(rep.explanation.headline).toBe('You lost 2.60 s on The Ring.');
  });

  it('is the biggest gain when you were faster everywhere', () => {
    const rep = explainStretches(
      input(records(() => rec('a', 'Wreck', 10, 9.0), () => rec('b', 'Dunes', 15, 13.9), () => rec('c', 'The Ring', 12, 11.8))),
    )!;
    expect(rep.explanation.headline).toBe('You gained 1.10 s on Dunes.');
    expect(rep.explanation.why).toBe('You went in at 14.00 m/s and came out at 15.00 m/s.');
    expect(rep.tryThis.text).toBe(levelText.stretch.try.even);
  });

  it('does not call a small gap a loss or a gain', () => {
    const rep = explainStretches(input(records(() => rec('a', 'Wreck', 10, 10.3), () => rec('b', 'Dunes', 15, 14.8))))!;
    expect(rep.explanation.headline).toBe('Every stretch was within 0.50 s of a clean drive.');
    expect(rep.explanation.why).toBe(levelText.stretch.why.even);
  });

  it('counts a gap of exactly the smallest gap as a loss', () => {
    const rep = explainStretches(input(records(() => rec('a', 'Wreck', 10, 10.5), () => rec('b', 'Dunes', 15, 15))))!;
    expect(rep.explanation.headline).toBe('You lost 0.50 s on Wreck.');
  });
});

describe('the why line (rules 2 and 3): only a cause the session recorded in that stretch', () => {
  const lose = (causes: Partial<StretchCauses>, over: Partial<StretchReportInput> = {}, speeds: [number, number] = [14, 15]) =>
    explainStretches(input(records(() => rec('a', 'Wreck', 10, 10), () => rec('c', 'The Ring', 12, 14.6, causes, speeds)), over))!;

  it('past the grip limit: the time and what the tyres give', () => {
    const rep = lose({ gripLimitS: 1.8, gripLimitN: 1310 });
    expect(rep.explanation.why).toBe('You were past your grip limit for 1.80 s: your wheels grip with up to 1310 N.');
    expect(rep.tryThis.text).toBe('Try wheels with more grip, or a wider line.');
  });

  it('offers the garage part only if there is a better one', () => {
    expect(lose({ gripLimitS: 1.8, gripLimitN: 1310 }, { suggest: { moreGrip: 'wheels-spiked' } }).tryThis.action).toEqual({ kind: 'garage', partId: 'wheels-spiked' });
    expect(lose({ gripLimitS: 1.8, gripLimitN: 1310 }).tryThis.action).toEqual({ kind: 'retry' });
  });

  it('wall scrapes: how many, and the speed they took', () => {
    const rep = lose({ scrapes: 2, scrapeSpeedLostMps: 3.456 });
    expect(rep.explanation.why).toBe('You scraped the wall 2 time(s) and lost 3.46 m/s against it.');
    expect(rep.tryThis.action).toEqual({ kind: 'retry' });
  });

  it('rolling back: the time', () => {
    const rep = lose({ rollingBackS: 2.25 }, { suggest: { strongerMotor: 'motor-large' } });
    expect(rep.explanation.why).toMatch(/^You rolled backwards for 2\.25 s/);
    expect(rep.tryThis.action).toEqual({ kind: 'garage', partId: 'motor-large' });
  });

  it('time on soft ground: the time, and the drag against rock, from the numbers recorded', () => {
    const rep = lose({ surfaceS: { asphalt: 5, sand: 7.1 }, surfaceInfo: { sand: { frictionN: 245.4, rockN: 40.9 } } }, { suggest: { lessDrag: 'wheels-smooth' } });
    expect(rep.explanation.why).toBe('You spent 7.10 s on sand, where the ground pulls back with 245 N. On rock it pulls back with 41 N.');
    expect(rep.tryThis.action).toEqual({ kind: 'garage', partId: 'wheels-smooth' });
  });

  it('names the soft ground you spent longest on', () => {
    const rep = lose({ surfaceS: { sand: 2, mud: 4 }, surfaceInfo: { sand: { frictionN: 245, rockN: 41 }, mud: { frictionN: 1229, rockN: 41 } } });
    expect(rep.explanation.why).toContain('on mud');
  });

  it('a launcher hit that slowed you', () => {
    const rep = lose({ hits: 1, hitSpeedChangeMps: -4.2 });
    expect(rep.explanation.why).toBe('A sandbag hit took 4.20 m/s off your speed.');
  });

  it('a hit that sped you up is not a loss to blame', () => {
    const rep = lose({ hits: 1, hitSpeedChangeMps: 5 });
    expect(rep.explanation.why).toMatch(/^No crash, slide or wall scrape was recorded here/);
  });

  it('the road you took at a fork, when the other one would have been quicker', () => {
    const fork: LevelEvent = { kind: 'fork', timeS: 18, xM: 0, zM: 0, yourRoad: 'f1-ridge', otherRoad: 'f1-dunes', yourS: 5.25, otherS: 4.5, otherOutcome: 'merged' };
    const rep = lose({}, { events: [fork], roadName: (id) => (id === 'f1-ridge' ? 'Ridge' : 'Dunes') });
    expect(rep.explanation.why).toBe('You took the ridge road in 5.25 s. The dunes road would have taken 4.50 s.');
    expect(rep.tryThis.text).toBe('At the fork, try the other road.');
  });

  it('does not use a fork from another stretch, or one where the other road crashes', () => {
    const early: LevelEvent = { kind: 'fork', timeS: 3, xM: 0, zM: 0, yourRoad: 'x', otherRoad: 'y', yourS: 5, otherS: 4, otherOutcome: 'merged' };
    const crashy: LevelEvent = { kind: 'fork', timeS: 15, xM: 0, zM: 0, yourRoad: 'x', otherRoad: 'y', yourS: 5, otherS: 4, otherOutcome: 'barrier' };
    for (const e of [early, crashy]) expect(lose({}, { events: [e] }).explanation.why, e.timeS.toString()).toMatch(/^No crash, slide or wall scrape/);
  });

  it('with nothing recorded, says so and gives the speeds in and out: the two numbers it does know', () => {
    const rep = lose({}, {}, [13.256, 9.1]);
    expect(rep.explanation.why).toBe('No crash, slide or wall scrape was recorded here. You went in at 13.26 m/s and came out at 9.10 m/s.');
  });

  it('ignores a cause shorter than the shortest the report names', () => {
    const rep = lose({ gripLimitS: 0.2, gripLimitN: 1310, rollingBackS: 0.1, surfaceS: { sand: 0.2 }, surfaceInfo: { sand: { frictionN: 1, rockN: 1 } } });
    expect(rep.explanation.why).toMatch(/^No crash, slide or wall scrape/);
  });

  it('names a cause from the stretch of the headline only, not from another one', () => {
    const rs = records(() => rec('a', 'Wreck', 10, 10, { crashes: 3, gripLimitS: 4, gripLimitN: 1000 }), () => rec('c', 'The Ring', 12, 14.6, { scrapes: 1, scrapeSpeedLostMps: 2 }));
    const rep = explainStretches(input(rs))!;
    expect(rep.explanation.stretchId).toBe('c');
    expect(rep.explanation.why).toBe('You scraped the wall 1 time(s) and lost 2.00 m/s against it.');
  });
});

describe('a crash is never blamed on the parts (rule 2)', () => {
  it('a crash comes first, even with a grip loss, a scrape and a roll back recorded in the same stretch', () => {
    const rs = records(
      () => rec('a', 'Wreck', 10, 10),
      () => rec('c', 'The Ring', 12, 19, { crashes: 1, gripLimitS: 3, gripLimitN: 1310, scrapes: 2, scrapeSpeedLostMps: 4, rollingBackS: 2 }),
    );
    const rep = explainStretches(input(rs, { suggest: { moreGrip: 'wheels-spiked', lessDrag: 'wheels-smooth', strongerMotor: 'motor-large' } }))!;
    expect(rep.explanation.why).toBe('You hit a boulder: back to the checkpoint.');
    expect(rep.tryThis.action).toEqual({ kind: 'retry' });
    expect(`${rep.explanation.headline} ${rep.explanation.why} ${rep.tryThis.text}`).not.toMatch(/wheel|motor|chassis|grip|part|friction/i);
  });

  it('calls the obstacle what the level calls it, and "an obstacle" elsewhere', () => {
    const crash = (levelId: string) =>
      explainStretches(input(records(() => rec('a', 'A', 10, 10), () => rec('c', 'C', 12, 19, { crashes: 1 })), { levelId }))!.explanation.why;
    expect(crash('crash-site')).toBe('You hit a boulder: back to the checkpoint.');
    expect(crash('geyser-canyon')).toBe('You hit an obstacle: back to the checkpoint.');
  });
});

describe('which parts the try line may offer', () => {
  it('for the starting rover: spiked wheels for grip, smooth wheels for less drag, the large motor for more push', () => {
    const rover = roverFromParts(content, STARTING_BUILD);
    expect(suggestParts(content, rover)).toEqual({ moreGrip: 'wheels-spiked', lessDrag: 'wheels-smooth', strongerMotor: 'motor-large' });
  });

  it('offers nothing a rover already has', () => {
    const grippy = roverFromParts(content, { chassisId: 'chassis-standard', wheelsId: 'wheels-spiked', motorId: 'motor-large' });
    expect(suggestParts(content, grippy)).toEqual({ lessDrag: 'wheels-smooth' });
    const smooth = roverFromParts(content, { chassisId: 'chassis-standard', wheelsId: 'wheels-smooth', motorId: 'motor-large' });
    expect(suggestParts(content, smooth)).toEqual({ moreGrip: 'wheels-spiked' });
  });
});

describe('the part pickup (SHOWCASE_PLAN §12)', () => {
  it('brings home the landing brakes with the student’s grip in the line', () => {
    const p = partPickup('crash-site', levelText, { grip: '1639' })!;
    expect(p.partName).toBe('Landing brakes');
    expect(p.line).toBe('On the Ring, grip gave you up to 1639 N of sideways force. These brakes use friction too: they stop the ship on the runway.');
  });

  it('brings home the thruster with the vent impulse in the line', () => {
    const p = partPickup('geyser-canyon', levelText, { impulse: '1200' })!;
    expect(p.partName).toBe('Thruster');
    expect(p.line).toBe('Each vent gave you 1200 N·s of push. A thruster throws gas back, and the ship gains equal momentum forward.');
  });

  it('brings home nothing from a level that is not a Showcase level yet', () => {
    expect(partPickup('crater-field', levelText, {})).toBeUndefined();
  });
});
