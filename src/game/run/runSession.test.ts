import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import type { Content, RunChunk } from '../../content/index.ts';
import { constants, rover } from '../../../tests/helpers/physics.ts';
import { createRunCourse } from './course.ts';
import { createRunSession, type RunInputProvider } from './runSession.ts';

const close = (actual: number, expected: number) =>
  expect(Math.abs(actual - expected) / Math.abs(expected)).toBeLessThan(1e-9);

const STRAIGHT: RunInputProvider = () => 0;
const empty: RunChunk = { id: 'empty-a', difficulty: 1, lengthM: 100, tiles: [], barriers: [], boostPads: [], cannons: [], gravityZones: [] };

/** A world whose every field chunk is the given template (two copies, so "never the same twice" still has a choice). */
function worldOf(template: Partial<RunChunk>): Content {
  const a: RunChunk = { ...empty, ...template, id: 'test-a' };
  const b: RunChunk = { ...a, id: 'test-b' };
  return { ...content, runChunks: { fieldChunks: [a, b], tunnel: { ...empty, id: 'test-tunnel', difficulty: 0, lengthM: 50 } } };
}

/** A seed whose first field chunk is not mirrored, so the z values in the template are as written. */
function unmirroredSeed(world: Content): number {
  for (let seed = 1; seed < 1000; seed++) {
    const c = createRunCourse(world, seed);
    c.ensureAhead(300);
    if (!c.chunks[1]!.mirrored) return seed;
  }
  throw new Error('no seed');
}

function session(world: Content, extra: Partial<Parameters<typeof createRunSession>[0]> = {}, input: RunInputProvider = STRAIGHT) {
  return createRunSession({ content: world, rover: rover(), constants, seed: unmirroredSeed(world), input, ...extra });
}

function runUntil(s: ReturnType<typeof createRunSession>, done: () => boolean, maxSteps = 20000) {
  for (let i = 0; i < maxSteps && !done() && !s.ended; i++) s.stepOnce();
}

const eventsOf = (s: ReturnType<typeof createRunSession>, kind: string) => s.events.filter((e) => e.kind === kind);

describe('start', () => {
  it('begins at rest at the start pose with the throttle building, and never stalls on asphalt', () => {
    const s = session(worldOf({}));
    expect(s.state.positionXM).toBe(0);
    expect(s.state.speedMps).toBe(0);
    for (let i = 0; i < 120 * 5; i++) s.stepOnce();
    expect(s.ended).toBeUndefined();
    expect(s.state.speedMps).toBeGreaterThan(10);
  });

  it('ignores S and W: the session only takes a steer value', () => {
    const s = session(worldOf({}));
    for (let i = 0; i < 600; i++) s.stepOnce();
    expect(s.state.brakeLevel).toBe(0);
    expect(s.state.direction).toBe('forward');
  });
});

describe('boost pads', () => {
  const world = worldOf({ boostPads: [{ xM: [30, 40], zM: [-2, 2] }] });
  it('a pad at top speed 16 m/s gives 21.741627 m/s: u′ = u + J/m', () => {
    const s = session(world);
    runUntil(s, () => eventsOf(s, 'boost').length > 0);
    const boost = eventsOf(s, 'boost')[0]!;
    expect(boost.speedBeforeMps).toBe(16);
    close(boost.speedAfterMps!, 16 + 1200 / 209);
    expect(Math.abs(boost.speedAfterMps! - 21.741627)).toBeLessThan(1e-6);
    expect(s.stats.boosts).toBe(1);
  });
  it('works once: the rover spends many steps on a 10 m pad but gets one boost', () => {
    const s = session(world);
    runUntil(s, () => s.state.positionXM > 140);
    expect(eventsOf(s, 'boost')).toHaveLength(1);
  });
  it('after the boost the rover is above top speed: Coasting, a = −F_r/m, and an event', () => {
    const s = session(world);
    runUntil(s, () => eventsOf(s, 'boost').length > 0);
    s.stepOnce();
    expect(s.state.drivingState).toBe('Coasting');
    expect(s.state.driveForceN).toBe(0);
    expect(eventsOf(s, 'aboveTopSpeed')).toHaveLength(1);
  });
});

describe('crash', () => {
  it('a barrier ends the run; the step is undone and v = 0; the crash speed is the speed at the start of the step', () => {
    const world = worldOf({ barriers: [{ xM: [30, 32], zM: [-15, 15] }] });
    const s = session(world);
    let before = s.state;
    while (!s.ended) {
      before = s.state;
      s.stepOnce();
    }
    expect(s.ended).toEqual({ cause: 'crash', speedMps: 16, obstacle: 'barrier', gravityKind: undefined });
    expect(s.state.speedMps).toBe(0);
    expect(s.state.positionXM).toBe(before.positionXM);
    expect(s.state.distanceM).toBe(before.distanceM);
    expect(s.state.headingRad).toBe(before.headingRad);
    expect(s.state.stepCount).toBe(before.stepCount + 1);
    expect(s.state.positionXM).toBeLessThan(90 + 1e-9);
    expect(eventsOf(s, 'crash')).toHaveLength(1);
  });

  it('a canyon wall does not end the run: the rover scrapes along it, turned along the wall, and stays inside', () => {
    const s = session(worldOf({}), { initialState: { positionXM: 100, speedMps: 16, throttleLevel: 1 } }, () => 1);
    for (let i = 0; i < 1500; i++) s.stepOnce();
    expect(s.ended).toBeUndefined();
    expect(Math.abs(s.state.positionZM)).toBeLessThan(15 - 0.85 + 0.5); // the corner stays within the corridor edge at 15 m
    expect(s.state.speedMps).toBeGreaterThan(5);
    expect(s.state.positionXM).toBeGreaterThan(200);
  });

  it('a square-on hit on the wall stops the rover without ending the run', () => {
    const s = session(worldOf({}), { initialState: { positionXM: 100, speedMps: 8, headingRad: Math.PI / 2, throttleLevel: 1 } }, () => 0);
    for (let i = 0; i < 600; i++) s.stepOnce();
    expect(s.ended).toBeUndefined();
    expect(s.state.speedMps).toBeLessThan(0.2); // the throttle keeps nudging it into the wall; each nudge is scraped away
  });

  it('no more steps run after the run ends', () => {
    const s = session(worldOf({ barriers: [{ xM: [30, 32], zM: [-15, 15] }] }));
    runUntil(s, () => false);
    const count = s.state.stepCount;
    s.advanceFrame(1);
    expect(s.state.stepCount).toBe(count);
  });
});

describe('stuck', () => {
  it('ends the run when friction beats the motor: at rest in mud with the throttle at 1', () => {
    const world = worldOf({ tiles: [{ surfaceId: 'mud', xM: [0, 100], zM: [-15, 15] }] });
    const s = session(world, { initialState: { positionXM: 100, speedMps: 3, throttleLevel: 1 } });
    runUntil(s, () => false);
    expect(s.ended?.cause).toBe('stuck');
    expect(s.state.speedMps).toBe(0);
    expect(s.state.drivingState).toBe('Stopped');
    expect(s.state.throttleLevel).toBe(1);
    expect(eventsOf(s, 'stuck')).toHaveLength(1);
  });

  it('is not triggered while the throttle is still building from rest', () => {
    const s = session(worldOf({}));
    for (let i = 0; i < 4; i++) s.stepOnce(); // the rover first moves in step 4 (T4)
    expect(s.state.speedMps).toBe(0);
    expect(s.ended).toBeUndefined();
  });
});

describe('cannons', () => {
  const headOn = worldOf({ cannons: [{ kind: 'headOn', xM: 98, zM: 0 }] }); // world x 158
  it('wakes at the end of the first step with the front at x ≥ 158 − 90, and fires at that step\'s time', () => {
    const s = session(headOn);
    let previousX = s.state.positionXM;
    runUntil(s, () => s.shots.length > 0);
    expect(s.shots).toHaveLength(1);
    expect(s.state.positionXM).toBeGreaterThanOrEqual(68);
    expect(previousX).toBeLessThan(68);
    expect(s.shots[0]!.timeS).toBe(s.state.timeS);
    previousX = 0;
  });

  it('fires every 1.2 s after that, for as long as the front is before the cannon', () => {
    const s = session(headOn);
    runUntil(s, () => s.shots.length >= 3);
    const [a, b, c] = s.shots.map((x) => x.timeS);
    expect(b! - a!).toBeCloseTo(1.2, 9);
    expect(c! - b!).toBeCloseTo(1.2, 9);
  });

  it('a head-on bag (40 kg at 10 m/s) hits a rover at 16 m/s: 16 → 11.823293 m/s', () => {
    const s = session(headOn);
    runUntil(s, () => eventsOf(s, 'headOnHit').length > 0);
    const hit = eventsOf(s, 'headOnHit')[0]!;
    expect(hit.speedBeforeMps).toBe(16);
    close(hit.speedAfterMps!, (209 * 16 - 40 * 10) / 249);
    expect(Math.abs(hit.speedAfterMps! - 11.823293)).toBeLessThan(1e-6);
    expect(s.stats.headOnHits).toBe(1);
    expect(s.bags.every((b) => b.id !== `${s.shots[0]!.cannonId}#0`)).toBe(true); // the bag that hit is gone
  });

  it('a kicker (40 kg at 30 m/s) catches a rover at 16 m/s: 16 → 18.248996 m/s', () => {
    const s = session(worldOf({ cannons: [{ kind: 'kicker', xM: 5, zM: 0 }] }));
    runUntil(s, () => eventsOf(s, 'kickerHit').length > 0);
    const hit = eventsOf(s, 'kickerHit')[0]!;
    expect(hit.speedBeforeMps).toBe(16);
    close(hit.speedAfterMps!, (209 * 16 + 40 * 30) / 249);
    expect(Math.abs(hit.speedAfterMps! - 18.248996)).toBeLessThan(1e-6);
  });

  it('a kicker wakes only when the rover\'s rear edge is 3 m past the cannon (OI-15)', () => {
    const s = session(worldOf({ cannons: [{ kind: 'kicker', xM: 5, zM: 0 }] }));
    s.course.ensureAhead(300);
    const cannonXM = s.course.chunks[1]!.startXM + 5;
    const wakeFrontXM = cannonXM + 3 + content.constants.roverLengthM;
    runUntil(s, () => s.shots.length > 0);
    expect(s.shots[0]!.cannonId.startsWith('1:')).toBe(true);
    expect(s.state.positionXM).toBeGreaterThanOrEqual(wakeFrontXM);
    expect(s.state.positionXM - s.state.speedMps * constants.timeStepS).toBeLessThan(wakeFrontXM);
  });

  it('the first kicker bag does not hit a rover that is faster than the bags', () => {
    const world = worldOf({ cannons: [{ kind: 'kicker', xM: 5, zM: 0 }] });
    const probe = session(world);
    probe.course.ensureAhead(300);
    const cannonXM = probe.course.chunks[1]!.startXM + 5;
    const s = session(world, { initialState: { positionXM: cannonXM + 3 + content.constants.roverLengthM - 0.5, speedMps: 40, throttleLevel: 1 } });
    for (let i = 0; i < 120 * 3; i++) s.stepOnce();
    expect(s.shots.filter((x) => x.cannonId.startsWith('1:'))).toHaveLength(3);
    expect(eventsOf(s, 'kickerHit').filter((e) => e.xM < cannonXM + 60)).toHaveLength(0);
  });

  it('a kicker misses a rover that is faster than its bags, and fires exactly 3 shots', () => {
    const world = worldOf({ cannons: [{ kind: 'kicker', xM: 5, zM: 0 }] });
    const s = session(world, { initialState: { positionXM: 70, speedMps: 40, throttleLevel: 1 } });
    for (let i = 0; i < 120 * 5; i++) s.stepOnce();
    // The test world repeats the chunk, so count only the first cannon (chunk 1).
    expect(s.shots.filter((x) => x.cannonId.startsWith('1:'))).toHaveLength(3);
    // The later cannons of this repeated world do hit a rover that passes them while in their lane (OI-15), so look at the first cannon only.
    expect(eventsOf(s, 'kickerHit').filter((e) => e.xM < 150)).toHaveLength(0);
    expect(s.ended).toBeUndefined();
  });

  it('bags are removed once they have travelled the range', () => {
    const world = worldOf({ cannons: [{ kind: 'kicker', xM: 5, zM: 0 }] });
    const s = session(world, { initialState: { positionXM: 70, speedMps: 40, throttleLevel: 1 } });
    for (let i = 0; i < 120 * 12; i++) s.stepOnce();
    expect(s.ended).toBeUndefined();
    expect(s.bags.filter((b) => b.cannonId.startsWith('1:'))).toHaveLength(0); // 150 m at 30 m/s takes 5 s; the last shot left at 2.4 s
  });
});

describe('gravity zones', () => {
  const world = worldOf({ gravityZones: [{ kind: 'high', xM: [20, 60], zM: [-15, 15] }] });
  it('the zone sets g for the step: weight and friction scale, the event shows the new weight', () => {
    const s = session(world);
    runUntil(s, () => eventsOf(s, 'gravity').length > 0);
    const g = eventsOf(s, 'gravity')[0]!;
    expect(g.gravityMultiplier).toBe(2);
    close(g.weightN!, 209 * 9.8 * 2);
    expect(Math.round(g.weightN!)).toBe(4096);
    expect(s.gravityKind).toBe('high');
  });
  it('at top speed in the high zone on asphalt the rover still holds 16 m/s (F_r = 82 N < 1000 N)', () => {
    const s = session(world);
    runUntil(s, () => s.state.positionXM > 120);
    expect(s.state.speedMps).toBe(16);
    expect(s.stats.gravityZones).toHaveLength(1);
    expect(s.stats.gravityZones[0]).toMatchObject({ kind: 'high', speedInMps: 16, speedOutMps: 16 });
  });
});

describe('surfaces', () => {
  it('mud slows the rover at top speed with a = −1.095311 m/s², and the stats count the loss', () => {
    const world = worldOf({ tiles: [{ surfaceId: 'mud', xM: [30, 42], zM: [-15, 15] }] });
    const s = session(world);
    runUntil(s, () => eventsOf(s, 'mud').length > 0);
    expect(eventsOf(s, 'mud')[0]!.frictionN).toBeCloseTo(1228.92, 2);
    s.stepOnce();
    s.stepOnce();
    expect(Math.abs(s.state.accelerationMps2 - -1.095311)).toBeLessThan(1e-6);
    runUntil(s, () => s.state.positionXM > 150);
    expect(s.stats.mudPatches).toBe(1);
    // 12 m at a = −1.095311 from 16 m/s: v = √(16² − 2·1.095311·12) = 15.1 m/s, a loss of about 0.85 m/s.
    expect(s.stats.mudLossMps).toBeCloseTo(16 - Math.sqrt(256 - 2 * 1.095311 * 12), 1);
  });
});

describe('score and progress (A6)', () => {
  it('each step adds max(0, Δx)·v̄/v_max', () => {
    const s = session(worldOf({}));
    let expected = 0;
    for (let i = 0; i < 120 * 12; i++) {
      const before = s.state;
      s.stepOnce();
      const dx = s.state.positionXM - before.positionXM;
      expected += Math.max(0, dx) * (((before.speedMps + s.state.speedMps) / 2) / 16);
    }
    close(s.score, expected);
    expect(s.score).toBeGreaterThan(100);
    expect(s.multiplier).toBe(1);
  });

  it('progress is the largest x reached, not the path length: weaving does not inflate it', () => {
    const weave: RunInputProvider = (i) => (Math.floor(i / 30) % 2 === 0 ? 1 : -1);
    const s = session(worldOf({}), {}, weave);
    let last = 0;
    for (let i = 0; i < 120 * 8; i++) {
      s.stepOnce();
      expect(s.progressM).toBeGreaterThanOrEqual(last);
      last = s.progressM;
    }
    expect(s.progressM).toBe(Math.max(s.progressM, s.state.positionXM));
    expect(s.progressM).toBeLessThan(s.state.distanceM);
  });
});

describe('T9 for the run: same seed, same steering record, any frame rate', () => {
  const steering: RunInputProvider = (i) => (Math.floor(i / 70) % 3 === 0 ? 1 : Math.floor(i / 70) % 3 === 1 ? -1 : 0);
  const play = (fps: number) => {
    const s = createRunSession({ content, rover: rover(), constants, seed: 12345, input: steering, stopAtStep: 4000 });
    let frames = 0;
    while (s.state.stepCount < 4000 && frames++ < 100000) s.advanceFrame(1 / fps);
    return s;
  };
  it('gives an identical state, score, events and end at 30 and 144 fps', () => {
    const a = play(30);
    const b = play(144);
    expect(a.state.stepCount).toBe(b.state.stepCount);
    expect(a.state).toEqual(b.state);
    expect(a.score).toBe(b.score);
    expect(a.progressM).toBe(b.progressM);
    expect(a.ended).toEqual(b.ended);
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
    expect(a.stats).toEqual(b.stats);
    expect(a.events.length).toBeGreaterThan(0);
  });
});

describe('the course stays ahead', () => {
  it('keeps at least 400 m generated beyond the front', () => {
    const s = session(worldOf({}));
    for (let i = 0; i < 1200; i++) {
      s.stepOnce();
      expect(s.course.generatedToXM).toBeGreaterThanOrEqual(s.state.positionXM + 400 - 16);
    }
  });
});

// The return is switched OFF in run.json (DECISIONS 2026-10-16, second change); the code and these tests stay.
// They turn it on in their own world.
describe('steering returns to straight (code kept, switched off in run.json)', () => {
  const plain = worldOf({});
  const world: Content = { ...plain, run: { ...plain.run, steerReturnToStraight: true } };
  const tap: RunInputProvider = (i) => (i >= 240 && i < 288 ? 1 : 0); // a 0.4 s tap at 120 steps per second, once moving
  const deadbandRad = (constants.turnRateDegPerS * Math.PI / 180) * constants.timeStepS / 2;
  const drive = (w: Content, input: RunInputProvider, steps: number) => {
    const s = session(w, {}, input);
    for (let i = 0; i < steps; i++) s.stepOnce();
    return s;
  };

  it('is off in the shipped content: a tap leaves the heading where it was left', () => {
    expect(content.run.steerReturnToStraight).toBe(false);
    const s = drive(plain, tap, 420); // before the rover reaches the canyon wall, which would turn it along itself (E46)
    expect(s.state.headingRad).toBeGreaterThan(0.3);
    expect(s.steerSent.every((x) => x === 0 || x === 1)).toBe(true);
  });

  it('a 0.4 s tap leaves a sideways offset and a heading back to about 0', () => {
    const s = drive(world, tap, 600);
    expect(Math.abs(s.state.positionZM)).toBeGreaterThan(0.5);
    expect(Math.abs(s.state.headingRad)).toBeLessThanOrEqual(deadbandRad + 1e-12);
    expect(s.ended).toBeUndefined();
  });

  it('sends the steer input that turns back: the tap is 48 steps left, so about as many steps right', () => {
    const s = drive(world, tap, 600);
    const returned = s.steerSent.slice(288).filter((x) => x === -1).length;
    expect(returned).toBeGreaterThanOrEqual(47);
    expect(returned).toBeLessThanOrEqual(49);
    expect(s.steerSent.slice(288).filter((x) => x === 1).length).toBe(0);
  });

  it('can be switched off: the heading then stays where the tap left it', () => {
    const off: Content = { ...world, run: { ...world.run, steerReturnToStraight: false } };
    const s = drive(off, tap, 420);
    expect(s.state.headingRad).toBeGreaterThan(0.3);
    expect(s.steerSent.every((x) => x === 0 || x === 1)).toBe(true);
  });

  it('does nothing to a straight rover, and a stopped rover does not turn', () => {
    expect(drive(world, STRAIGHT, 300).steerSent.every((x) => x === 0)).toBe(true);
  });

  it('T9: replaying the recorded input with the return off gives the same run', () => {
    const a = drive(world, tap, 900);
    const off: Content = { ...world, run: { ...world.run, steerReturnToStraight: false } };
    const record = a.steerSent;
    const b = createRunSession({ content: off, rover: rover(), constants, seed: a.seed, input: (i) => record[i] ?? 0 });
    for (let i = 0; i < 900; i++) b.stepOnce();
    expect(b.state).toEqual(a.state);
    expect(b.score).toBe(a.score);
    expect(b.steerSent).toEqual(a.steerSent);
  });

  it('steers back from the other side too, and mirrored in reverse', () => {
    const left = drive(world, (i) => (i >= 240 && i < 288 ? -1 : 0), 600);
    expect(left.state.positionZM).toBeLessThan(-0.5);
    expect(Math.abs(left.state.headingRad)).toBeLessThanOrEqual(deadbandRad + 1e-12);
    const rev = createRunSession({ content: world, rover: rover(), constants, seed: unmirroredSeed(world), input: STRAIGHT, initialState: { speedMps: 3, direction: 'reverse', headingRad: 0.2, positionXM: 100 } });
    rev.stepOnce();
    expect(rev.steerSent[0]).toBe(1); // reverse mirrors the input, so +1 turns the heading down
    expect(rev.state.headingRad).toBeLessThan(0.2);
  });
});

describe('the student drives (DECISIONS 2026-10-16)', () => {
  const world = worldOf({});
  const W = { throttleHeld: true, brakeHeld: false };
  const S = { throttleHeld: false, brakeHeld: true };
  const NONE = { throttleHeld: false, brakeHeld: false };
  const make = (drive: (i: number) => { throttleHeld: boolean; brakeHeld: boolean }, initialState = {}) =>
    createRunSession({ content: world, rover: rover(), constants, seed: unmirroredSeed(world), input: STRAIGHT, drive, initialState });
  const run = (s: ReturnType<typeof make>, n: number) => {
    for (let i = 0; i < n && !s.ended; i++) s.stepOnce();
    return s;
  };

  it('starts at rest with the throttle level 0, and stays there until the student presses', () => {
    const s = make(() => NONE);
    expect(s.state.speedMps).toBe(0);
    expect(s.state.throttleLevel).toBe(0);
    run(s, 600);
    expect(s.state.speedMps).toBe(0);
    expect(s.state.positionXM).toBe(0);
    expect(s.ended).toBeUndefined(); // sitting still at the start is not "stuck"
  });

  it('W drives, with the usual 1.0 s build-up', () => {
    const s = run(make(() => W), 120);
    expect(s.state.throttleLevel).toBeCloseTo(1, 12);
    expect(s.state.speedMps).toBeGreaterThan(0);
    expect(s.state.drivingState).toBe('Driving');
  });

  it('S at v = 0 at the start line backs up to the wall 10 m behind it, stops there, and the run goes on', () => {
    const s = run(make(() => S), 600);
    expect(s.state.speedMps).toBe(0);
    expect(s.state.positionXM).toBeGreaterThanOrEqual(-10 + content.constants.roverLengthM - 1e-9); // rear edge at the wall
    expect(s.state.positionXM).toBeLessThan(-7.9);
    expect(s.ended).toBeUndefined();
    expect(s.state.direction).toBe('reverse'); // the physics did flip; the wall holds the rover
  });

  it('S held at rest elsewhere reverses, as the physics does', () => {
    const s = run(make(() => S, { positionXM: 100 }), 300);
    expect(s.state.direction).toBe('reverse');
    expect(s.state.speedMps).toBeGreaterThan(0);
    expect(s.state.positionXM).toBeLessThan(100);
    expect(s.driveSent.every((k) => k.brakeHeld)).toBe(true); // the key is sent as it was pressed
    expect(s.stats.brakeUsed).toBe(false); // driving in reverse is not braking
  });

  it('S pressed at rest first, then W: W brakes the reverse and the rover drives on forward', () => {
    const s = run(make((i) => (i < 60 ? S : W), { positionXM: 100 }), 1500);
    expect(s.state.direction).toBe('forward');
    expect(s.state.speedMps).toBeGreaterThan(0);
  });

  it('S and W together once rolling: the brake wins (FR-6), never a reverse', () => {
    const s = run(make(() => ({ throttleHeld: true, brakeHeld: true }), { speedMps: 5, positionXM: 100 }), 2000);
    expect(s.state.direction).toBe('forward');
    expect(s.state.speedMps).toBe(0);
    expect(s.state.positionXM).toBeGreaterThanOrEqual(100);
    expect(s.stats.brakeUsed).toBe(true);
  });

  it('release = coast: only friction acts, a = −F_r/m (−0.196 m/s² on asphalt)', () => {
    const s = make(() => NONE, { speedMps: 10 });
    s.stepOnce();
    expect(s.state.drivingState).toBe('Coasting');
    close(s.state.accelerationMps2, -0.196);
    close(s.state.speedMps, 10 - 0.196 / 120);
  });

  it('S while rolling brakes, and the stats remember the brake was used', () => {
    const s = make(() => S, { speedMps: 10, positionXM: 100 });
    s.stepOnce();
    expect(s.driveSent[0]).toEqual(S);
    run(s, 50);
    expect(s.state.drivingState).toBe('Braking');
    expect(s.state.speedMps).toBeLessThan(10);
    expect(s.stats.brakeUsed).toBe(true);
  });

  it('braking to a stop and then letting go does not reverse; holding S on does', () => {
    const released = make((i) => (i < 150 ? S : NONE), { speedMps: 10, positionXM: 100 }); // lets go with the rover still rolling
    run(released, 1500);
    expect(released.state.speedMps).toBe(0);
    expect(released.state.direction).toBe('forward');
    expect(released.ended).toBeUndefined();
    const held = make(() => S, { speedMps: 10, positionXM: 100 });
    run(held, 400);
    expect(held.state.direction).toBe('reverse');
    expect(held.state.speedMps).toBeGreaterThan(0);
  });

  it('a rover that a sandbag pushed into reverse: W brakes it, flips it forward and it drives on (S would drive it further back)', () => {
    const s = make(() => W, { speedMps: 2, direction: 'reverse', throttleLevel: 0, positionXM: 100 });
    s.stepOnce();
    expect(s.driveSent[0]).toEqual(W);
    run(s, 1500);
    expect(s.state.direction).toBe('forward');
    expect(s.state.speedMps).toBeGreaterThan(0);
    const back = make(() => S, { speedMps: 2, direction: 'reverse', positionXM: 100 });
    run(back, 60);
    expect(back.state.direction).toBe('reverse');
    expect(back.state.speedMps).toBeGreaterThan(2);
  });

  it('stuck needs full throttle held at rest in mud; stopping in mud and not pressing is not stuck', () => {
    const mud = worldOf({ tiles: [{ surfaceId: 'mud', xM: [0, 100], zM: [-15, 15] }] });
    const start = { positionXM: 70 }; // inside the mud chunk, at rest
    const held = createRunSession({ content: mud, rover: rover(), constants, seed: unmirroredSeed(mud), input: STRAIGHT, drive: () => W, initialState: start });
    for (let i = 0; i < 400 && !held.ended; i++) held.stepOnce();
    expect(held.ended?.cause).toBe('stuck');
    const idle = createRunSession({ content: mud, rover: rover(), constants, seed: unmirroredSeed(mud), input: STRAIGHT, drive: () => NONE, initialState: start });
    for (let i = 0; i < 400; i++) idle.stepOnce();
    expect(idle.ended).toBeUndefined();
  });

  it('T9: the same seed and the same key record give the same run at 30 and 144 fps', () => {
    const steer: RunInputProvider = (i) => (Math.floor(i / 80) % 4 === 0 ? 1 : Math.floor(i / 80) % 4 === 2 ? -1 : 0);
    const pedals = (i: number) => (i < 300 ? W : i < 700 ? NONE : i < 900 ? S : W);
    const play = (fps: number) => {
      const s = createRunSession({ content: world, rover: rover(), constants, seed: 99, input: steer, drive: pedals, stopAtStep: 1500 });
      let frames = 0;
      while (s.state.stepCount < 1500 && frames++ < 100000) s.advanceFrame(1 / fps);
      return s;
    };
    const a = play(30);
    const b = play(144);
    expect(a.state).toEqual(b.state);
    expect(a.driveSent).toEqual(b.driveSent);
    expect(a.score).toBe(b.score);
    expect(a.stats.brakeUsed).toBe(true);
  });
});
