import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import type { EventKind } from '../../content/index.ts';
import { testChunk, type ChunkSpec } from '../../../tests/helpers/chunks.ts';
import { constants, rover } from '../../../tests/helpers/physics.ts';
import type { Content } from '../../content/index.ts';
import { createRunSession, type RunEnd, type RunEvent, type RunStats } from './runSession.ts';
import { buildReport, reportEffects, tryThisLine, speedText, workedLine } from './feedback.ts';

const text = content.runText;
const boost = (t: number, from = 16, to = 21.741627): RunEvent => ({
  kind: 'boost', timeS: t, xM: 0, speedBeforeMps: from, speedAfterMps: to, massKg: 209, impulseNs: 1200,
});

const stats = (over: Partial<RunStats> = {}): RunStats => ({
  mudLossMps: 0, mudPatches: 0, boostGainMps: 0, boosts: 0, headOnLossMps: 0, headOnHits: 0,
  kickerGainMps: 0, kickerHits: 0, gravityZones: [], maxSpeedMps: 16, brakeUsed: true, firstEvents: {}, ...over,
});
const FITTED = { chassisId: 'chassis-standard', wheelsId: 'wheels-all-terrain', motorId: 'motor-medium' };

// The worked formulas use the student's own numbers (DECISIONS 2026-10-16). Values are the A5 hand-checks.
const hit = (kind: 'headOnHit' | 'kickerHit', u1: number, u2: number, result: number): RunEvent => ({
  kind, timeS: 0, xM: 0, speedBeforeMps: Math.abs(u1), speedAfterMps: Math.abs(result),
  massKg: 209, otherMassKg: 40, roverVelocityMps: u1, otherVelocityMps: u2, resultVelocityMps: result,
});
const surfaceEvent = (kind: 'mud' | 'sand' | 'ice', mu: number, k: number, g: number): RunEvent => ({
  kind, timeS: 0, xM: 0, massKg: 209, gravityMps2: g, surfaceRolling: mu, wheelRolling: k, frictionN: mu * k * 209 * g,
});

describe('speeds with their unit', () => {
  it('shows km/h with 2 decimals when chosen (km/h = m/s × 3.6)', () => {
    expect(speedText(16, 'mps')).toBe('16.00 m/s');
    expect(speedText(16, 'kmh')).toBe('57.60 km/h');
  });
});

describe('worked formulas', () => {
  const slideEvent = (grip: number, wheel: number, g: number, v: number, rate = 60): RunEvent => ({
    kind: 'slide', timeS: 0, xM: 0, surfaceGrip: grip, wheelGrip: wheel, gravityMps2: g, slideSpeedMps: v,
    turnLimitRadPerS: (grip * wheel * g) / v, turnRateDegPerS: rate,
  });
  it('slide: Tyres bend your path at most 0.8 × 9.8 ÷ 16 = 0.49 rad/s (28°/s); you steer 60°/s → you slide', () => {
    expect(workedLine(slideEvent(0.8, 1, 9.8, 16), 'mps')).toBe('Tyres bend your path at most 0.8 × 9.8 ÷ 16 = 0.49 rad/s (28°/s); you steer 60°/s → you slide');
  });
  it('slide: a wheel factor other than 1 is shown, and the speed is always m/s', () => {
    expect(workedLine(slideEvent(0.5, 1.4, 9.8, 15.37), 'kmh')).toBe(
      'Tyres bend your path at most 0.5 × 1.4 × 9.8 ÷ 15.37 = 0.45 rad/s (26°/s); you steer 60°/s → you slide  (formulas use m/s)',
    );
  });
  it('slide: no "you slide" tail if the tyres could keep up with the steering', () => {
    expect(workedLine(slideEvent(0.8, 1, 9.8, 5), 'mps')).toBe('Tyres bend your path at most 0.8 × 9.8 ÷ 5 = 1.57 rad/s (90°/s)');
  });
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

  it('tunnels show both lanes: "You: low gravity, out at 15.80 m/s · Other lane, throttle held: high gravity, out at 12.31 m/s"', () => {
    const e = reportEffects(
      stats({ gravityZones: [zone('low', 16, 15.8, { other: { kind: 'high', outcome: 'out', speedOutMps: 12.31 } })] }),
      text, 'mps',
    );
    expect(e[0]!.detail).toEqual(['You: low gravity, out at 15.80 m/s · Other lane, throttle held: high gravity, out at 12.31 m/s']);
  });

  it('says "stuck" for a lane that sticks, on either side, and "crashed at" for a crash in the lane', () => {
    const stuckOther = zone('low', 16, 15.8, { other: { kind: 'high', outcome: 'stuck', speedOutMps: 0 } });
    const stuckYou = zone('high', 16, 0, { outcome: 'stuck', other: { kind: 'low', outcome: 'out', speedOutMps: 15.9 } });
    const crashed = zone('high', 16, 14, { outcome: 'crash', other: { kind: 'low', outcome: 'out', speedOutMps: 16 } });
    const e = reportEffects(stats({ gravityZones: [stuckOther, stuckYou, crashed] }), text, 'mps');
    expect(e[0]!.detail).toEqual([
      'You: low gravity, out at 15.80 m/s · Other lane, throttle held: high gravity, stuck',
      'You: high gravity, stuck · Other lane, throttle held: low gravity, out at 15.90 m/s',
      'and 1 more',
    ]);
    expect(reportEffects(stats({ gravityZones: [crashed] }), text, 'mps')[0]!.detail).toEqual([
      'You: high gravity, crashed at 14.00 m/s · Other lane, throttle held: low gravity, out at 16.00 m/s',
    ]);
  });

  it('a zone with no second lane lists only your own lane; km/h follows the unit setting', () => {
    expect(reportEffects(stats({ gravityZones: [zone('high', 16, 14)] }), text, 'mps')[0]!.detail).toEqual(['You: high gravity, out at 14.00 m/s']);
    const k = reportEffects(stats({ gravityZones: [zone('low', 16, 15.8, { other: { kind: 'high', outcome: 'out', speedOutMps: 12.31 } })] }), text, 'kmh');
    expect(k[0]!.detail[0]).toBe('You: low gravity, out at 56.88 km/h · Other lane, throttle held: high gravity, out at 44.32 km/h');
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
  const divider: RunEnd = { cause: 'crash', speedMps: 12, obstacle: 'barrier', atDivider: true };

  it('1. stuck in high gravity → the low-gravity tunnel, before anything else', () => {
    expect(tryThisLine(stuck('high'), ranked('mud'), FITTED, text, true)).toBe(text.tryThis.stuckInHighGravity);
    expect(tryThisLine(stuck('low'), ranked('mud'), FITTED, text, true)).toBe(text.tryThis.smoothWheels);
  });
  it('2. crashed on the divider → pick a lane before the tunnel', () => {
    expect(tryThisLine(divider, ranked('boost'), FITTED, text, true)).toBe(text.tryThis.pickLane);
    expect(tryThisLine(divider, ranked('mud'), FITTED, text, true)).toBe(text.tryThis.pickLane); // before the mud advice
    expect(tryThisLine(divider, ranked('headOnHit'), FITTED, text, true)).toBe(text.tryThis.pickLane); // before the hit advice
    expect(tryThisLine({ ...divider, speedMps: 25 }, [], FITTED, text, true)).toBe(text.tryThis.pickLane); // before "steer earlier"
    expect(tryThisLine(crash(12), ranked('boost'), FITTED, text, true)).toBe(text.tryThis.takeBoosts); // a barrier that is not the divider
    expect(tryThisLine(stuck('high'), ranked('mud'), FITTED, text, true)).toBe(text.tryThis.stuckInHighGravity); // stuck still wins
  });
  it('3. mud biggest, Smooth wheels not fitted → Smooth wheels (every part is open)', () => {
    expect(tryThisLine(crash(10), ranked('mud'), FITTED, text, true)).toBe(text.tryThis.smoothWheels);
    expect(tryThisLine(crash(10), ranked('mud'), { ...FITTED, wheelsId: 'wheels-smooth' }, text, true)).toBe(text.tryThis.takeBoosts);
  });
  it('4. hits biggest, Heavy chassis not fitted → Heavy chassis', () => {
    expect(tryThisLine(crash(10), ranked('headOnHit'), FITTED, text, true)).toBe(text.tryThis.heavyChassis);
    expect(tryThisLine(crash(10), ranked('headOnHit'), { ...FITTED, chassisId: 'chassis-heavy' }, text, true)).toBe(text.tryThis.dodgeCannon);
  });
  it("5. hits biggest and the Heavy chassis already fitted → dodge the cannon's line", () => {
    const heavy = { ...FITTED, chassisId: 'chassis-heavy' };
    expect(tryThisLine(crash(10), ranked('headOnHit'), heavy, text, true)).toBe(text.tryThis.dodgeCannon);
    expect(tryThisLine(stuck(), ranked('headOnHit'), heavy, text, true)).toBe(text.tryThis.dodgeCannon);
    expect(tryThisLine(crash(25), ranked('headOnHit'), heavy, text, true)).toBe(text.tryThis.dodgeCannon); // before "steer earlier"
    expect(tryThisLine(crash(10), ranked('boost'), heavy, text, true)).toBe(text.tryThis.takeBoosts); // only for hits
  });
  it('6. crashed above 20 m/s → steer earlier; exactly 20 is not above', () => {
    expect(tryThisLine(crash(20.01), ranked('boost'), FITTED, text, true)).toBe(text.tryThis.steerEarlier);
    expect(tryThisLine(crash(20), ranked('boost'), FITTED, text, true)).toBe(text.tryThis.takeBoosts);
  });
  it('7. otherwise → take the boost pads', () => {
    expect(tryThisLine(stuck(), [], FITTED, text, true)).toBe(text.tryThis.takeBoosts);
  });
});

describe('buildReport', () => {
  const base = { content, stats: stats(), distanceM: 450.5, score: 812.4, previousBestDistanceM: 150, previousBestScore: 900, fitted: FITTED, unit: 'mps' as const };

  it('names the cause, rounds the score, and reports new bests', () => {
    const r = buildReport({ ...base, ended: { cause: 'crash', speedMps: 18.31, obstacle: 'barrier' } });
    expect(r.headline).toBe('Crashed at 18.31 m/s');
    expect(r.score).toBe(812);
    expect(r.newBestDistance).toBe(true);
    expect(r.newBestScore).toBe(false);
    expect(r.bestDistanceM).toBe(450.5);
    expect(r.bestScore).toBe(900);
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
  const worldWith = (over: ChunkSpec) => ({
    ...content,
    runChunks: { fieldChunks: [testChunk({ lengthM: 100, ...over, id: 'a' }), testChunk({ lengthM: 100, ...over, id: 'b' })], tunnel: testChunk({ id: 't', lengthM: 50 }) },
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
    const mud: ChunkSpec = { lengthM: 100, tiles: [{ surfaceId: 'mud', xM: [0, 100], zM: [-15, 15] }] };
    const world = { ...content, runChunks: { fieldChunks: [testChunk({ ...mud, id: 'mud-a' }), testChunk({ ...mud, id: 'mud-b' })], tunnel: testChunk({ id: 't', lengthM: 50 }) } };
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
  it('hits were the biggest effect and the brake was never used → brake first', () => {
    expect(tryThisLine(crash(10), ranked('headOnHit'), FITTED, text, false)).toBe(text.tryThis.brakeFirst);
    expect(tryThisLine(crash(10), ranked('kickerHit'), FITTED, text, false)).toBe(text.tryThis.brakeFirst);
    expect(tryThisLine(crash(10), ranked('headOnHit'), FITTED, text, false)).toBe(text.tryThis.brakeFirst); // before the Heavy chassis advice
    expect(tryThisLine(crash(25), ranked('headOnHit'), FITTED, text, false)).toBe(text.tryThis.brakeFirst); // before "steer earlier"
  });
  it('is not given once the brake was used, or when hits were not the biggest effect', () => {
    expect(tryThisLine(crash(10), ranked('headOnHit'), FITTED, text, true)).toBe(text.tryThis.heavyChassis);
    expect(tryThisLine(crash(10), ranked('boost'), FITTED, text, false)).toBe(text.tryThis.takeBoosts);
    expect(tryThisLine(crash(10), ranked('mud'), FITTED, text, false)).toBe(text.tryThis.smoothWheels); // the mud rule comes first
  });
  it('a slide caused the crash → brake before the corner (after stuck-in-high-gravity and the divider, before the rest)', () => {
    const slid = (over: Partial<RunEnd> = {}): RunEnd => ({ ...crash(10), sliding: true, ...over });
    expect(tryThisLine(slid(), ranked('boost'), FITTED, text, true)).toBe(text.tryThis.brakeBeforeCorner);
    expect(tryThisLine(slid(), ranked('headOnHit'), FITTED, text, false)).toBe(text.tryThis.brakeBeforeCorner);
    expect(tryThisLine(slid({ speedMps: 25 }), ranked('mud'), FITTED, text, true)).toBe(text.tryThis.brakeBeforeCorner);
    expect(tryThisLine(slid({ atDivider: true }), ranked('boost'), FITTED, text, true)).toBe(text.tryThis.pickLane);
    expect(tryThisLine(crash(10), ranked('boost'), FITTED, text, true)).toBe(text.tryThis.takeBoosts); // no slide, no advice
  });
  it('the earlier rules still win: stuck in high gravity, and the divider', () => {
    expect(tryThisLine(stuck('high'), ranked('headOnHit'), FITTED, text, false)).toBe(text.tryThis.stuckInHighGravity);
    expect(tryThisLine({ ...crash(10), atDivider: true }, ranked('headOnHit'), FITTED, text, false)).toBe(text.tryThis.pickLane);
  });
  it('buildReport reads the brake from the run stats', () => {
    const base = { content, ended: crash(10), distanceM: 300, score: 100, previousBestDistanceM: 0, previousBestScore: 0, fitted: FITTED, unit: 'mps' as const };
    const hits = { headOnLossMps: 5, headOnHits: 1 };
    expect(buildReport({ ...base, stats: stats({ ...hits, brakeUsed: false }) }).tryThis).toBe(text.tryThis.brakeFirst);
    expect(buildReport({ ...base, stats: stats({ ...hits, brakeUsed: true }) }).tryThis).toBe(text.tryThis.heavyChassis);
  });
});
