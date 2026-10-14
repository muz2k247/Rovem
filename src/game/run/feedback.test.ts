import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import type { EventKind } from '../../content/index.ts';
import { constants, rover } from '../../../tests/helpers/physics.ts';
import { createRunSession, type RunEnd, type RunEvent, type RunStats } from './runSession.ts';
import {
  buildReport, captionMain, emptyFeed, pushCaption, reportEffects, tryThisLine, visibleCaptions, speedText,
  type CaptionFeed,
} from './feedback.ts';

const text = content.runText;
const none = new Set<EventKind>();
const boost = (t: number, from = 16, to = 21.741627): RunEvent => ({ kind: 'boost', timeS: t, xM: 0, speedBeforeMps: from, speedAfterMps: to });

const stats = (over: Partial<RunStats> = {}): RunStats => ({
  mudLossMps: 0, mudPatches: 0, boostGainMps: 0, boosts: 0, headOnLossMps: 0, headOnHits: 0,
  kickerGainMps: 0, kickerHits: 0, gravityZones: [], maxSpeedMps: 16, ...over,
});
const FITTED = { chassisId: 'chassis-standard', wheelsId: 'wheels-all-terrain', motorId: 'motor-medium' };

describe('caption main lines (A7)', () => {
  it('matches the examples in the plan', () => {
    const m = (e: RunEvent) => captionMain(e, 'mps');
    expect(m({ kind: 'mud', timeS: 0, xM: 0, frictionN: 1228.92 })).toBe('Mud · friction 1229 N');
    expect(m(boost(0))).toBe('Boost · 16.00 → 21.74 m/s');
    expect(m({ kind: 'headOnHit', timeS: 0, xM: 0, speedBeforeMps: 16, speedAfterMps: 11.823293 })).toBe('Sandbag hit · 16.00 → 11.82 m/s');
    expect(m({ kind: 'kickerHit', timeS: 0, xM: 0, speedBeforeMps: 16, speedAfterMps: 18.248996 })).toBe('Kicker hit · 16.00 → 18.25 m/s');
    expect(m({ kind: 'gravity', timeS: 0, xM: 0, gravityMultiplier: 2, weightN: 4096.4 })).toBe('Gravity ×2 · weight 4096 N');
    expect(m({ kind: 'slip', timeS: 0, xM: 0, gripN: 512.05 })).toBe('Wheels slipping · grip 512 N');
    expect(m({ kind: 'aboveTopSpeed', timeS: 0, xM: 0 })).toBe("Above top speed · motor can't push");
    expect(m({ kind: 'crash', timeS: 0, xM: 0 })).toBeUndefined();
  });

  it('shows km/h with 2 decimals when chosen (km/h = m/s × 3.6)', () => {
    expect(speedText(16, 'kmh')).toBe('57.60 km/h');
    expect(captionMain(boost(0), 'kmh')).toBe('Boost · 57.60 → 78.27 km/h');
  });
});

describe('caption feed', () => {
  const add = (feed: CaptionFeed, e: RunEvent, t: number, seen: ReadonlySet<EventKind> = none) =>
    pushCaption(feed, e, t, { seenKinds: seen, text, unit: 'mps' });

  it('the first time a kind is seen it lasts 8 s and carries the tidbit; later it lasts 4 s without', () => {
    const first = add(emptyFeed, boost(0), 0);
    expect(first.firstTime).toBe(true);
    const c = first.feed.captions[0]!;
    expect(c.tidbit).toBe(text.tidbits.boost);
    expect(visibleCaptions(first.feed, 7.9)).toHaveLength(1);
    expect(visibleCaptions(first.feed, 8)).toHaveLength(0);
    const later = add(emptyFeed, boost(0), 0, new Set<EventKind>(['boost']));
    expect(later.firstTime).toBe(false);
    expect(later.feed.captions[0]!.tidbit).toBeUndefined();
    expect(visibleCaptions(later.feed, 3.99)).toHaveLength(1);
    expect(visibleCaptions(later.feed, 4)).toHaveLength(0);
  });

  it('merges the same kind within 3 s into "×n" with the latest numbers, and keeps the clock running from the latest', () => {
    const seen = new Set<EventKind>(['boost']);
    let r = add(emptyFeed, boost(0, 16, 21.74), 0, seen);
    r = add(r.feed, boost(2.5, 17, 22.74), 2.5, seen);
    r = add(r.feed, boost(5.5, 18, 23.74), 5.5, seen);
    const [c] = visibleCaptions(r.feed, 5.6);
    expect(r.feed.captions).toHaveLength(1);
    expect(c!.count).toBe(3);
    expect(c!.label).toBe('Boost · 18.00 → 23.74 m/s ×3');
    expect(visibleCaptions(r.feed, 9.4)).toHaveLength(1);
    expect(visibleCaptions(r.feed, 9.5)).toHaveLength(0);
  });

  it('does not merge after 3 s', () => {
    const seen = new Set<EventKind>(['boost']);
    let r = add(emptyFeed, boost(0), 0, seen);
    r = add(r.feed, boost(3.01), 3.01, seen);
    expect(visibleCaptions(r.feed, 3.02)).toHaveLength(2);
  });

  it('shows at most 3, newest on top, and drops expired ones', () => {
    const seen = new Set<EventKind>(['boost', 'mud', 'slip', 'gravity']);
    let r = add(emptyFeed, boost(0), 0, seen);
    r = add(r.feed, { kind: 'mud', timeS: 0.5, xM: 0, frictionN: 1229 }, 0.5, seen);
    r = add(r.feed, { kind: 'slip', timeS: 1, xM: 0, gripN: 512 }, 1, seen);
    r = add(r.feed, { kind: 'gravity', timeS: 1.5, xM: 0, gravityMultiplier: 2, weightN: 4096 }, 1.5, seen);
    const v = visibleCaptions(r.feed, 1.6);
    expect(v.map((c) => c.kind)).toEqual(['gravity', 'slip', 'mud']);
    expect(visibleCaptions(r.feed, 4.6).map((c) => c.kind)).toEqual(['gravity', 'slip']); // boost (0 + 4 s) and mud (0.5 + 4 s) are gone
  });

  it('events that end a run make no caption', () => {
    const r = add(emptyFeed, { kind: 'crash', timeS: 1, xM: 0 }, 1);
    expect(r.feed.captions).toHaveLength(0);
    expect(r.firstTime).toBe(false);
  });
});

describe('report effects', () => {
  it('ranks by total size of speed change and keeps the formula line', () => {
    const e = reportEffects(
      stats({ mudLossMps: 3, mudPatches: 2, boostGainMps: 5.74, boosts: 1, headOnLossMps: 4.18, headOnHits: 1,
        gravityZones: [{ kind: 'low', speedInMps: 16, speedOutMps: 15.9 }] }),
      text, 'mps',
    );
    expect(e.map((x) => x.kind)).toEqual(['boost', 'headOnHit', 'mud', 'gravity']);
    expect(e[0]!.formula).toBe(text.formulas.boost);
    expect(e[2]!.label).toBe('Mud · lost 3.00 m/s over 2 patches');
    expect(e[3]!.label).toContain('Low gravity 16.00 → 15.90 m/s');
    expect(e[3]!.sizeMps).toBeCloseTo(0.1, 12);
  });

  it('leaves out effects that did not happen', () => {
    expect(reportEffects(stats(), text, 'mps')).toEqual([]);
  });
});

describe('try this (A7 order)', () => {
  const crash = (speedMps: number): RunEnd => ({ cause: 'crash', speedMps, obstacle: 'barrier' });
  const stuck = (gravityKind?: 'low' | 'high'): RunEnd => ({ cause: 'stuck', speedMps: 0, gravityKind });
  const ranked = (kind: 'mud' | 'headOnHit' | 'boost') => reportEffects(
    stats(kind === 'mud' ? { mudLossMps: 5, mudPatches: 1 } : kind === 'headOnHit' ? { headOnLossMps: 5, headOnHits: 1 } : { boostGainMps: 5, boosts: 1 }),
    text, 'mps',
  );
  const all = ['chassis-standard', 'wheels-all-terrain', 'motor-medium', 'wheels-smooth', 'chassis-heavy'];
  const start = ['chassis-standard', 'wheels-all-terrain', 'motor-medium'];

  it('1. stuck in high gravity → the low-gravity tunnel, before anything else', () => {
    expect(tryThisLine(stuck('high'), ranked('mud'), all, FITTED, text)).toBe(text.tryThis.stuckInHighGravity);
    expect(tryThisLine(stuck('low'), ranked('mud'), all, FITTED, text)).toBe(text.tryThis.smoothWheels);
  });
  it('2. mud biggest, Smooth wheels unlocked and not fitted → Smooth wheels', () => {
    expect(tryThisLine(crash(10), ranked('mud'), all, FITTED, text)).toBe(text.tryThis.smoothWheels);
    expect(tryThisLine(crash(10), ranked('mud'), all, { ...FITTED, wheelsId: 'wheels-smooth' }, text)).toBe(text.tryThis.takeBoosts);
    expect(tryThisLine(crash(10), ranked('mud'), start, FITTED, text)).toBe(text.tryThis.takeBoosts);
  });
  it('3. hits biggest, Heavy chassis unlocked and not fitted → Heavy chassis', () => {
    expect(tryThisLine(crash(10), ranked('headOnHit'), all, FITTED, text)).toBe(text.tryThis.heavyChassis);
    expect(tryThisLine(crash(10), ranked('headOnHit'), all, { ...FITTED, chassisId: 'chassis-heavy' }, text)).toBe(text.tryThis.takeBoosts);
  });
  it('4. crashed above 20 m/s → steer earlier; exactly 20 is not above', () => {
    expect(tryThisLine(crash(20.01), ranked('boost'), start, FITTED, text)).toBe(text.tryThis.steerEarlier);
    expect(tryThisLine(crash(20), ranked('boost'), start, FITTED, text)).toBe(text.tryThis.takeBoosts);
  });
  it('5. otherwise → take the boost pads', () => {
    expect(tryThisLine(stuck(), [], start, FITTED, text)).toBe(text.tryThis.takeBoosts);
  });
});

describe('buildReport', () => {
  const base = { content, stats: stats(), distanceM: 450.5, score: 812.4, previousBestDistanceM: 150, previousBestScore: 900, fitted: FITTED, unit: 'mps' as const };

  it('names the cause, rounds the score, and reports new bests and the parts this run opened', () => {
    const r = buildReport({ ...base, ended: { cause: 'crash', speedMps: 18.31, obstacle: 'barrier' } });
    expect(r.headline).toBe('Crashed at 18.31 m/s');
    expect(r.score).toBe(812);
    expect(r.newBestDistance).toBe(true);
    expect(r.newBestScore).toBe(false);
    expect(r.bestDistanceM).toBe(450.5);
    expect(r.bestScore).toBe(900);
    expect(r.unlocked).toEqual(['wheels-smooth', 'chassis-heavy']);
  });

  it('"Stuck in mud" and at most 3 effects', () => {
    const r = buildReport({
      ...base,
      ended: { cause: 'stuck', speedMps: 0 },
      stats: stats({ mudLossMps: 1, mudPatches: 1, boostGainMps: 2, boosts: 1, headOnLossMps: 3, headOnHits: 1, kickerGainMps: 4, kickerHits: 1 }),
    });
    expect(r.headline).toBe('Stuck in mud');
    expect(r.effects.map((e) => e.kind)).toEqual(['kickerHit', 'headOnHit', 'boost']);
  });
});

describe('a real run feeds the report', () => {
  it('a run that ends stuck in mud counts the patch it died in', () => {
    const mudChunk = { id: 'mud-a', difficulty: 1, lengthM: 100, tiles: [{ surfaceId: 'mud', xM: [0, 100] as [number, number], zM: [-15, 15] as [number, number] }], barriers: [], boostPads: [], cannons: [], gravityZones: [] };
    const world = { ...content, runChunks: { fieldChunks: [mudChunk, { ...mudChunk, id: 'mud-b' }], tunnel: { ...mudChunk, id: 't', difficulty: 0, tiles: [] } } };
    const s = createRunSession({ content: world, rover: rover(), constants, seed: 1, input: () => 0, initialState: { positionXM: 100, speedMps: 3, throttleLevel: 1 } });
    for (let i = 0; i < 2000 && !s.ended; i++) s.stepOnce();
    expect(s.ended?.cause).toBe('stuck');
    expect(s.stats.mudPatches).toBe(1);
    expect(s.stats.mudLossMps).toBeCloseTo(3, 1); // entry is read at the end of the first step, so just under 3
  });
});
