import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import type { EventKind } from '../../content/index.ts';
import { constants, rover } from '../../../tests/helpers/physics.ts';
import type { Content } from '../../content/index.ts';
import { createRunSession, type RunEnd, type RunEvent, type RunStats } from './runSession.ts';
import {
  buildReport, captionMain, emptyFeed, pushCaption, reportEffects, tryThisLine, visibleCaptions, speedText, workedLine,
  type CaptionFeed,
} from './feedback.ts';

const text = content.runText;
const none = new Set<EventKind>();
const boost = (t: number, from = 16, to = 21.741627): RunEvent => ({
  kind: 'boost', timeS: t, xM: 0, speedBeforeMps: from, speedAfterMps: to, massKg: 209, impulseNs: 1200,
});

const stats = (over: Partial<RunStats> = {}): RunStats => ({
  mudLossMps: 0, mudPatches: 0, boostGainMps: 0, boosts: 0, headOnLossMps: 0, headOnHits: 0,
  kickerGainMps: 0, kickerHits: 0, gravityZones: [], maxSpeedMps: 16, brakeUsed: true, firstEvents: {}, ...over,
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

// The worked formulas use the student's own numbers (DECISIONS 2026-10-16). Values are the A5 hand-checks.
const hit = (kind: 'headOnHit' | 'kickerHit', u1: number, u2: number, result: number): RunEvent => ({
  kind, timeS: 0, xM: 0, speedBeforeMps: Math.abs(u1), speedAfterMps: Math.abs(result),
  massKg: 209, otherMassKg: 40, roverVelocityMps: u1, otherVelocityMps: u2, resultVelocityMps: result,
});
const surfaceEvent = (kind: 'mud' | 'sand' | 'ice', mu: number, k: number, g: number): RunEvent => ({
  kind, timeS: 0, xM: 0, massKg: 209, gravityMps2: g, surfaceRolling: mu, wheelRolling: k, frictionN: mu * k * 209 * g,
});

describe('worked formulas', () => {
  it('head-on sandbag: 209 × 16.00 − 40 × 10 = 249 × v  →  v = 11.82 m/s', () => {
    expect(workedLine(hit('headOnHit', 16, -10, (209 * 16 - 40 * 10) / 249), 'mps')).toBe('209 × 16.00 − 40 × 10 = 249 × v  →  v = 11.82 m/s');
  });
  it('kicker: 209 × 16.00 + 40 × 30 = 249 × v  →  v = 18.25 m/s', () => {
    expect(workedLine(hit('kickerHit', 16, 30, (209 * 16 + 40 * 30) / 249), 'mps')).toBe('209 × 16.00 + 40 × 30 = 249 × v  →  v = 18.25 m/s');
  });
  it('a hit that pushes the rover into reverse shows the negative result (A5: u′ = −0.767068)', () => {
    expect(workedLine(hit('headOnHit', 1, -10, (209 - 400) / 249), 'mps')).toBe('209 × 1.00 − 40 × 10 = 249 × v  →  v = −0.77 m/s');
  });
  it('a rover in reverse puts its negative speed in brackets', () => {
    expect(workedLine(hit('kickerHit', -2, 30, (209 * -2 + 1200) / 249), 'mps')).toBe('209 × (−2.00) + 40 × 30 = 249 × v  →  v = 3.14 m/s');
  });
  it('boost: Δv = 1200 ÷ 209 = 5.74 m/s', () => {
    const e: RunEvent = { kind: 'boost', timeS: 0, xM: 0, massKg: 209, impulseNs: 1200, speedBeforeMps: 16, speedAfterMps: 21.741627 };
    expect(workedLine(e, 'mps')).toBe('Δv = 1200 ÷ 209 = 5.74 m/s');
  });
  it('mud: friction = 0.6 × 1 × 209 × 9.8 = 1229 N, with no k_r symbol', () => {
    const line = workedLine(surfaceEvent('mud', 0.6, 1, 9.8), 'mps');
    expect(line).toBe('Friction = 0.6 × 1 × 209 × 9.8 = 1229 N');
    expect(line).not.toContain('k_r');
  });
  it('mud in high gravity and with Smooth wheels shows its own numbers (A5: 2457.84 N)', () => {
    expect(workedLine(surfaceEvent('mud', 0.6, 1, 19.6), 'mps')).toBe('Friction = 0.6 × 1 × 209 × 19.6 = 2458 N');
    expect(workedLine({ ...surfaceEvent('mud', 0.6, 0.6, 9.8), massKg: 190, frictionN: 0.6 * 0.6 * 190 * 9.8 }, 'mps')).toBe('Friction = 0.6 × 0.6 × 190 × 9.8 = 670 N');
  });
  it('sand and ice use the same line with their own numbers', () => {
    expect(workedLine(surfaceEvent('ice', 0.01, 1, 9.8), 'mps')).toBe('Friction = 0.01 × 1 × 209 × 9.8 = 20 N');
  });
  it('gravity: weight = 209 × 19.6 = 4096 N', () => {
    const e: RunEvent = { kind: 'gravity', timeS: 0, xM: 0, massKg: 209, gravityMps2: 19.6, weightN: 209 * 19.6 };
    expect(workedLine(e, 'mps')).toBe('Weight = 209 × 19.6 = 4096 N');
  });
  it('slip: grip = 0.5 × 1 × 209 × 4.9 = 512 N (A5, mud in low gravity)', () => {
    const e: RunEvent = { kind: 'slip', timeS: 0, xM: 0, massKg: 209, gravityMps2: 4.9, surfaceGrip: 0.5, wheelGrip: 1, gripN: 512.05 };
    expect(workedLine(e, 'mps')).toBe('Grip = 0.5 × 1 × 209 × 4.9 = 512 N');
  });
  it('above top speed: a = −friction ÷ mass = −41 ÷ 209 = −0.20 m/s² (A5: −0.196)', () => {
    const e: RunEvent = { kind: 'aboveTopSpeed', timeS: 0, xM: 0, massKg: 209, frictionN: 0.02 * 209 * 9.8 };
    expect(workedLine(e, 'mps')).toBe('a = −friction ÷ mass = −41 ÷ 209 = −0.20 m/s²');
  });
  it('events that end a run have none', () => {
    expect(workedLine({ kind: 'crash', timeS: 0, xM: 0 }, 'mps')).toBeUndefined();
  });
  it('in km/h mode the speed formulas stay in m/s and say so', () => {
    const line = workedLine(hit('headOnHit', 16, -10, 11.823293), 'kmh')!;
    expect(line.endsWith('v = 11.82 m/s  (formulas use m/s)')).toBe(true);
    expect(workedLine(surfaceEvent('mud', 0.6, 1, 9.8), 'kmh')).toBe('Friction = 0.6 × 1 × 209 × 9.8 = 1229 N');
  });
});

describe('caption feed', () => {
  const add = (feed: CaptionFeed, e: RunEvent, t: number, seen: ReadonlySet<EventKind> = none) =>
    pushCaption(feed, e, t, { seenKinds: seen, unit: 'mps' });

  it('the first time a kind is seen it lasts 8 s and carries the worked formula; later it lasts 4 s without', () => {
    const first = add(emptyFeed, boost(0), 0);
    expect(first.firstTime).toBe(true);
    const c = first.feed.captions[0]!;
    expect(c.worked).toBe('Δv = 1200 ÷ 209 = 5.74 m/s');
    expect(visibleCaptions(first.feed, 7.9)).toHaveLength(1);
    expect(visibleCaptions(first.feed, 8)).toHaveLength(0);
    const later = add(emptyFeed, boost(0), 0, new Set<EventKind>(['boost']));
    expect(later.firstTime).toBe(false);
    expect(later.feed.captions[0]!.worked).toBeUndefined();
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

  it('merged hits show the total: "6 hits · 16.00 → 0.91 m/s", and the formula stays the first hit\'s', () => {
    const seen = new Set<EventKind>(['headOnHit']);
    let u = 16;
    let r = { feed: emptyFeed, firstTime: false };
    for (let i = 0; i < 6; i++) {
      const next = (209 * u - 40 * 10) / 249;
      r = add(r.feed, hit('headOnHit', u, -10, next), i * 0.5, seen);
      u = next;
    }
    const [c] = visibleCaptions(r.feed, 3);
    expect(r.feed.captions).toHaveLength(1);
    expect(c!.count).toBe(6);
    expect(c!.label).toBe('6 hits · 16.00 → 0.91 m/s'); // each bag takes 40 kg × 10 m/s of momentum
    const first = add(emptyFeed, hit('headOnHit', 16, -10, 11.823293), 0);
    const merged = add(first.feed, hit('headOnHit', 11.823293, -10, 8.5), 1);
    expect(merged.feed.captions[0]!.worked).toBe('209 × 16.00 − 40 × 10 = 249 × v  →  v = 11.82 m/s');
  });

  it('one hit reads as a single hit, a second makes "2 hits", and kicker hits add up too', () => {
    const seen = new Set<EventKind>(['headOnHit', 'kickerHit']);
    let r = add(emptyFeed, hit('headOnHit', 16, -10, 11.82), 0, seen);
    expect(r.feed.captions[0]!.label).toBe('Sandbag hit · 16.00 → 11.82 m/s');
    r = add(r.feed, hit('headOnHit', 11.82, -10, 7.73), 1, seen);
    expect(r.feed.captions[0]!.label).toBe('2 hits · 16.00 → 7.73 m/s');
    let k = add(emptyFeed, hit('kickerHit', 16, 30, 18.25), 0, seen);
    k = add(k.feed, hit('kickerHit', 18.25, 30, 20.3), 1, seen);
    expect(k.feed.captions[0]!.label).toBe('2 hits · 16.00 → 20.30 m/s');
  });

  it('every caption is one line: no line break, and the main line and the formula each fit 60 characters', () => {
    const gravity: RunEvent = { kind: 'gravity', timeS: 0, xM: 0, massKg: 209, gravityMps2: 19.6, weightN: 4096.4, gravityMultiplier: 2 };
    for (const e of [surfaceEvent('mud', 0.6, 1, 9.8), boost(0), hit('headOnHit', 16, -10, 11.82), gravity]) {
      const c = add(emptyFeed, e, 0).feed.captions[0]!;
      for (const line of [c.label, c.worked ?? '']) {
        expect(line).not.toContain('\n');
        expect(line.length).toBeLessThanOrEqual(60);
      }
    }
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
  const zone = (kind: 'low' | 'high', i: number, o: number, extra: Partial<RunStats['gravityZones'][number]> = {}) => ({
    kind, speedInMps: i, speedOutMps: o, outcome: 'out' as const, ...extra,
  });

  it("ranks by total size of speed change and works each formula with the first event's numbers", () => {
    const e = reportEffects(
      stats({
        mudLossMps: 3, mudPatches: 2, boostGainMps: 5.74, boosts: 1, headOnLossMps: 4.18, headOnHits: 1,
        gravityZones: [zone('low', 16, 15.9)],
        firstEvents: {
          mud: surfaceEvent('mud', 0.6, 1, 9.8), boost: boost(0), headOnHit: hit('headOnHit', 16, -10, 11.823293),
          gravity: { kind: 'gravity', timeS: 0, xM: 0, massKg: 209, gravityMps2: 4.9, weightN: 209 * 4.9 },
        },
      }),
      text, 'mps',
    );
    expect(e.map((x) => x.kind)).toEqual(['boost', 'headOnHit', 'mud', 'gravity']);
    expect(e[0]!.worked).toBe('Δv = 1200 ÷ 209 = 5.74 m/s');
    expect(e[1]!.worked).toBe('209 × 16.00 − 40 × 10 = 249 × v  →  v = 11.82 m/s');
    expect(e[2]!.worked).toBe('Friction = 0.6 × 1 × 209 × 9.8 = 1229 N');
    expect(e[2]!.label).toBe('Mud · lost 3.00 m/s over 2 patches');
    expect(e[3]!.worked).toBe('Weight = 209 × 4.9 = 1024 N');
    expect(e[3]!.sizeMps).toBeCloseTo(0.1, 12);
    expect(e[0]!.why).toBe(text.tidbits.boost); // the longer explanation lives in the report
  });

  it('tunnels show both lanes: "You: low gravity, out at 15.80 m/s · High gravity: out at 12.31 m/s"', () => {
    const e = reportEffects(
      stats({ gravityZones: [zone('low', 16, 15.8, { other: { kind: 'high', outcome: 'out', speedOutMps: 12.31 } })] }),
      text, 'mps',
    );
    expect(e[0]!.detail).toEqual(['You: low gravity, out at 15.80 m/s · High gravity: out at 12.31 m/s']);
  });

  it('says "stuck" for a lane that sticks, on either side, and "crashed at" for a crash in the lane', () => {
    const stuckOther = zone('low', 16, 15.8, { other: { kind: 'high', outcome: 'stuck', speedOutMps: 0 } });
    const stuckYou = zone('high', 16, 0, { outcome: 'stuck', other: { kind: 'low', outcome: 'out', speedOutMps: 15.9 } });
    const crashed = zone('high', 16, 14, { outcome: 'crash', other: { kind: 'low', outcome: 'out', speedOutMps: 16 } });
    const e = reportEffects(stats({ gravityZones: [stuckOther, stuckYou, crashed] }), text, 'mps');
    expect(e[0]!.detail).toEqual([
      'You: low gravity, out at 15.80 m/s · High gravity: stuck',
      'You: high gravity, stuck · Low gravity: out at 15.90 m/s',
      'and 1 more',
    ]);
    expect(reportEffects(stats({ gravityZones: [crashed] }), text, 'mps')[0]!.detail).toEqual([
      'You: high gravity, crashed at 14.00 m/s · Low gravity: out at 16.00 m/s',
    ]);
  });

  it('a zone with no second lane lists only your own lane; km/h follows the unit setting', () => {
    expect(reportEffects(stats({ gravityZones: [zone('high', 16, 14)] }), text, 'mps')[0]!.detail).toEqual(['You: high gravity, out at 14.00 m/s']);
    const k = reportEffects(stats({ gravityZones: [zone('low', 16, 15.8, { other: { kind: 'high', outcome: 'out', speedOutMps: 12.31 } })] }), text, 'kmh');
    expect(k[0]!.detail[0]).toBe('You: low gravity, out at 56.88 km/h · High gravity: out at 44.32 km/h');
  });

  it('lists the first two tunnels and counts the rest; the size still counts every zone', () => {
    const z = zone('high', 16, 14);
    const e = reportEffects(stats({ gravityZones: [z, z, z, z] }), text, 'mps');
    expect(e[0]!.detail).toEqual(['You: high gravity, out at 14.00 m/s', 'You: high gravity, out at 14.00 m/s', 'and 2 more']);
    expect(e[0]!.sizeMps).toBe(8);
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
  const divider: RunEnd = { cause: 'crash', speedMps: 12, obstacle: 'barrier', atDivider: true };

  it('1. stuck in high gravity → the low-gravity tunnel, before anything else', () => {
    expect(tryThisLine(stuck('high'), ranked('mud'), all, FITTED, text, true)).toBe(text.tryThis.stuckInHighGravity);
    expect(tryThisLine(stuck('low'), ranked('mud'), all, FITTED, text, true)).toBe(text.tryThis.smoothWheels);
  });
  it('2. crashed on the divider → pick a lane before the tunnel', () => {
    expect(tryThisLine(divider, ranked('boost'), start, FITTED, text, true)).toBe(text.tryThis.pickLane);
    expect(tryThisLine(divider, ranked('mud'), all, FITTED, text, true)).toBe(text.tryThis.pickLane); // before the mud advice
    expect(tryThisLine(divider, ranked('headOnHit'), all, FITTED, text, true)).toBe(text.tryThis.pickLane); // before the hit advice
    expect(tryThisLine({ ...divider, speedMps: 25 }, [], start, FITTED, text, true)).toBe(text.tryThis.pickLane); // before "steer earlier"
    expect(tryThisLine(crash(12), ranked('boost'), start, FITTED, text, true)).toBe(text.tryThis.takeBoosts); // a barrier that is not the divider
    expect(tryThisLine(stuck('high'), ranked('mud'), all, FITTED, text, true)).toBe(text.tryThis.stuckInHighGravity); // stuck still wins
  });
  it('3. mud biggest, Smooth wheels unlocked and not fitted → Smooth wheels', () => {
    expect(tryThisLine(crash(10), ranked('mud'), all, FITTED, text, true)).toBe(text.tryThis.smoothWheels);
    expect(tryThisLine(crash(10), ranked('mud'), all, { ...FITTED, wheelsId: 'wheels-smooth' }, text, true)).toBe(text.tryThis.takeBoosts);
    expect(tryThisLine(crash(10), ranked('mud'), start, FITTED, text, true)).toBe(text.tryThis.takeBoosts);
  });
  it('4. hits biggest, Heavy chassis unlocked and not fitted → Heavy chassis', () => {
    expect(tryThisLine(crash(10), ranked('headOnHit'), all, FITTED, text, true)).toBe(text.tryThis.heavyChassis);
    expect(tryThisLine(crash(10), ranked('headOnHit'), all, { ...FITTED, chassisId: 'chassis-heavy' }, text, true)).toBe(text.tryThis.takeBoosts);
  });
  it("5. hits biggest and the Heavy chassis still locked → dodge the cannon's line", () => {
    expect(tryThisLine(crash(10), ranked('headOnHit'), start, FITTED, text, true)).toBe(text.tryThis.dodgeCannon);
    expect(tryThisLine(stuck(), ranked('headOnHit'), start, FITTED, text, true)).toBe(text.tryThis.dodgeCannon);
    expect(tryThisLine(crash(25), ranked('headOnHit'), start, FITTED, text, true)).toBe(text.tryThis.dodgeCannon); // before "steer earlier"
    expect(tryThisLine(crash(10), ranked('mud'), start, FITTED, text, true)).toBe(text.tryThis.takeBoosts); // only for hits
  });
  it('6. crashed above 20 m/s → steer earlier; exactly 20 is not above', () => {
    expect(tryThisLine(crash(20.01), ranked('boost'), start, FITTED, text, true)).toBe(text.tryThis.steerEarlier);
    expect(tryThisLine(crash(20), ranked('boost'), start, FITTED, text, true)).toBe(text.tryThis.takeBoosts);
  });
  it('7. otherwise → take the boost pads', () => {
    expect(tryThisLine(stuck(), [], start, FITTED, text, true)).toBe(text.tryThis.takeBoosts);
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
  const chunk = (over: object, id: string) => ({ id, difficulty: 1, lengthM: 100, tiles: [], barriers: [], boostPads: [], cannons: [], gravityZones: [], ...over });
  const worldWith = (over: object) => ({
    ...content,
    runChunks: { fieldChunks: [chunk(over, 'a'), chunk(over, 'b')], tunnel: { ...chunk({}, 't'), difficulty: 0, lengthM: 50 } },
  });
  const firstWorked = (s: ReturnType<typeof createRunSession>, kind: EventKind) => workedLine(s.stats.firstEvents[kind]!, 'mps');
  const drive = (world: Content, stop: (s: ReturnType<typeof createRunSession>) => boolean, initialState = {}) => {
    const s = createRunSession({ content: world, rover: rover(), constants, seed: 1, input: () => 0, initialState });
    for (let i = 0; i < 20000 && !s.ended && !stop(s); i++) s.stepOnce();
    return s;
  };

  it('works the formulas with the numbers of the real events (A5)', () => {
    const boostRun = drive(worldWith({ boostPads: [{ xM: [30, 40], zM: [-2, 2] }] }), (s) => s.stats.boosts > 0, { speedMps: 16, throttleLevel: 1 });
    expect(firstWorked(boostRun, 'boost')).toBe('Δv = 1200 ÷ 209 = 5.74 m/s');
    const mudRun = drive(worldWith({ tiles: [{ surfaceId: 'mud', xM: [30, 42], zM: [-15, 15] }] }), (s) => s.stats.firstEvents.mud !== undefined, { speedMps: 16, throttleLevel: 1 });
    expect(firstWorked(mudRun, 'mud')).toBe('Friction = 0.6 × 1 × 209 × 9.8 = 1229 N');
    const gravityRun = drive(worldWith({ gravityZones: [{ kind: 'high', xM: [20, 60], zM: [-15, 15] }] }), (s) => s.stats.firstEvents.gravity !== undefined, { speedMps: 16, throttleLevel: 1 });
    expect(firstWorked(gravityRun, 'gravity')).toBe('Weight = 209 × 19.6 = 4096 N');
    const hitRun = drive(worldWith({ cannons: [{ kind: 'headOn', xM: 98, zM: 0 }] }), (s) => s.stats.headOnHits > 0, { speedMps: 16, throttleLevel: 1 });
    expect(firstWorked(hitRun, 'headOnHit')).toBe('209 × 16.00 − 40 × 10 = 249 × v  →  v = 11.82 m/s');
  });

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

describe("try this: brake before the cannon's line (DECISIONS 2026-10-16)", () => {
  const crash = (speedMps: number): RunEnd => ({ cause: 'crash', speedMps, obstacle: 'barrier' });
  const stuck = (gravityKind?: 'low' | 'high'): RunEnd => ({ cause: 'stuck', speedMps: 0, gravityKind });
  const ranked = (kind: 'mud' | 'headOnHit' | 'kickerHit' | 'boost') => reportEffects(
    stats(
      kind === 'mud' ? { mudLossMps: 5, mudPatches: 1 }
        : kind === 'headOnHit' ? { headOnLossMps: 5, headOnHits: 1 }
        : kind === 'kickerHit' ? { kickerGainMps: 5, kickerHits: 1 }
        : { boostGainMps: 5, boosts: 1 },
    ),
    text, 'mps',
  );
  const all2 = ['chassis-standard', 'wheels-all-terrain', 'motor-medium', 'wheels-smooth', 'chassis-heavy'];
  const start2 = ['chassis-standard', 'wheels-all-terrain', 'motor-medium'];
  it('hits were the biggest effect and the brake was never used → brake first', () => {
    expect(tryThisLine(crash(10), ranked('headOnHit'), start2, FITTED, text, false)).toBe(text.tryThis.brakeFirst);
    expect(tryThisLine(crash(10), ranked('kickerHit'), start2, FITTED, text, false)).toBe(text.tryThis.brakeFirst);
    expect(tryThisLine(crash(10), ranked('headOnHit'), all2, FITTED, text, false)).toBe(text.tryThis.brakeFirst); // before the Heavy chassis advice
    expect(tryThisLine(crash(25), ranked('headOnHit'), start2, FITTED, text, false)).toBe(text.tryThis.brakeFirst); // before "steer earlier"
  });
  it('is not given once the brake was used, or when hits were not the biggest effect', () => {
    expect(tryThisLine(crash(10), ranked('headOnHit'), start2, FITTED, text, true)).toBe(text.tryThis.dodgeCannon);
    expect(tryThisLine(crash(10), ranked('headOnHit'), all2, FITTED, text, true)).toBe(text.tryThis.heavyChassis);
    expect(tryThisLine(crash(10), ranked('boost'), start2, FITTED, text, false)).toBe(text.tryThis.takeBoosts);
    expect(tryThisLine(crash(10), ranked('mud'), all2, FITTED, text, false)).toBe(text.tryThis.smoothWheels); // the mud rule comes first
  });
  it('the earlier rules still win: stuck in high gravity, and the divider', () => {
    expect(tryThisLine(stuck('high'), ranked('headOnHit'), start2, FITTED, text, false)).toBe(text.tryThis.stuckInHighGravity);
    expect(tryThisLine({ ...crash(10), atDivider: true }, ranked('headOnHit'), start2, FITTED, text, false)).toBe(text.tryThis.pickLane);
  });
  it('buildReport reads the brake from the run stats', () => {
    const base = { content, ended: crash(10), distanceM: 300, score: 100, previousBestDistanceM: 0, previousBestScore: 0, fitted: FITTED, unit: 'mps' as const };
    const hits = { headOnLossMps: 5, headOnHits: 1 };
    expect(buildReport({ ...base, stats: stats({ ...hits, brakeUsed: false }) }).tryThis).toBe(text.tryThis.brakeFirst);
    expect(buildReport({ ...base, stats: stats({ ...hits, brakeUsed: true }) }).tryThis).toBe(text.tryThis.dodgeCannon);
  });
});
