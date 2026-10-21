import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import type { Content, RunChunk } from '../../content/index.ts';
import { createState, step } from '../../physics/step.ts';
import { constants, rover, surface } from '../../../tests/helpers/physics.ts';
import { createRunCourse } from './course.ts';
import { createRunSession, type RunInputProvider } from './runSession.ts';

// Reverse in the run and drifting (DECISIONS 2026-10-16, both demo only, provisional). Written before the code.

const close = (actual: number, expected: number) => expect(Math.abs(actual - expected) / Math.abs(expected)).toBeLessThan(1e-9);

const STRAIGHT: RunInputProvider = () => 0;
const W = { throttleHeld: true, brakeHeld: false };
const S = { throttleHeld: false, brakeHeld: true };
const NONE = { throttleHeld: false, brakeHeld: false };
const empty: RunChunk = { id: 'empty-a', difficulty: 1, lengthM: 100, tiles: [], barriers: [], boostPads: [], cannons: [], gravityZones: [] };

/** A world whose every field chunk is the given template (two copies, so "never the same twice" still has a choice). */
function worldOf(template: Partial<RunChunk>): Content {
  const a: RunChunk = { ...empty, ...template, id: 'test-a' };
  const b: RunChunk = { ...a, id: 'test-b' };
  return { ...content, runChunks: { fieldChunks: [a, b], tunnel: { ...empty, id: 'test-tunnel', difficulty: 0, lengthM: 50 } } };
}

function unmirroredSeed(world: Content): number {
  for (let seed = 1; seed < 1000; seed++) {
    const c = createRunCourse(world, seed);
    c.ensureAhead(300);
    if (!c.chunks[1]!.mirrored) return seed;
  }
  throw new Error('no seed');
}

type Drive = (i: number) => { throttleHeld: boolean; brakeHeld: boolean };
const make = (drive: Drive, initialState = {}, w: Content = worldOf({}), input: RunInputProvider = STRAIGHT) =>
  createRunSession({ content: w, rover: rover(), constants, seed: unmirroredSeed(w), input, drive, initialState });
const run = (s: ReturnType<typeof make>, n: number) => {
  for (let i = 0; i < n && !s.ended; i++) s.stepOnce();
  return s;
};
const eventsOf = (s: ReturnType<typeof make>, kind: string) => s.events.filter((e) => e.kind === kind);

describe('reverse in the run', () => {
  const world = worldOf({});

  it('reverse top speed is v_max (run.json reverseTopSpeedFactor 1.0), not the v2 half; the v2 constant is untouched', () => {
    expect(content.run.reverseTopSpeedFactor).toBe(1);
    expect(constants.reverseTopSpeedFraction).toBe(0.5);
    const s = run(make(() => S, { positionXM: 400 }), 120 * 8);
    expect(s.state.direction).toBe('reverse');
    expect(s.state.speedMps).toBe(16);
    expect(s.state.drivingState).toBe('At top speed');
  });

  it('steering is mirrored in reverse: holding left (+1) turns the heading down', () => {
    const s = run(make(() => S, { positionXM: 400 }, world, () => 1), 240);
    expect(s.state.headingRad).toBeLessThan(0);
  });

  it('the rover moves along heading × direction: x falls and distance grows', () => {
    const s = run(make(() => S, { positionXM: 400 }), 240);
    expect(s.state.positionXM).toBeLessThan(400);
    expect(s.state.distanceM).toBeGreaterThan(0);
  });

  it('distance, score and progress count only new ground: reversing adds nothing, and nor does driving back over old ground', () => {
    const s = make((i) => (i < 300 ? S : W), { positionXM: 200 });
    let behindScore = 0;
    for (let i = 0; i < 2000 && !s.ended; i++) {
      s.stepOnce();
      if (s.state.positionXM <= 200) behindScore = Math.max(behindScore, s.score);
    }
    expect(behindScore).toBe(0);
    expect(s.state.positionXM).toBeGreaterThan(200); // it did drive back past the old furthest point
    expect(s.progressM).toBe(Math.max(200, s.state.positionXM));
    expect(s.score).toBeGreaterThan(0);
    // Only the ground beyond x = 200 earned score, at a multiplier of at most 1 (v ≤ v_max here).
    expect(s.score).toBeLessThanOrEqual(s.state.positionXM - 200 + 1e-9);
  });

  it('reverse speed counts in full in the multiplier: v / v_max uses the same v_max', () => {
    const s = run(make(() => S, { positionXM: 400 }), 120 * 8);
    expect(s.multiplier).toBe(1);
  });

  it('the course behind the rover stays solid: reversing into a barrier ends the run', () => {
    const w = worldOf({ barriers: [{ xM: [30, 32], zM: [-15, 15] }] });
    const s = run(make(() => S, { positionXM: 110 }, w), 3000); // the barrier is at world x 90–92, behind the rover
    expect(s.ended).toMatchObject({ cause: 'crash', obstacle: 'barrier' });
    expect(s.state.speedMps).toBe(0);
  });

  it('a wall at the start line stops the rover (v = 0) without ending the run; its rear edge never passes it', () => {
    const s = make(() => S, { speedMps: 8, direction: 'reverse', positionXM: 3 });
    let min = Infinity;
    for (let i = 0; i < 600; i++) {
      s.stepOnce();
      min = Math.min(min, s.state.positionXM - content.constants.roverLengthM);
    }
    expect(s.startWallXM).toBe(-10);
    expect(min).toBeGreaterThanOrEqual(s.startWallXM - 1e-12);
    expect(s.state.speedMps).toBe(0);
    expect(s.ended).toBeUndefined();
    // And it can drive away again.
    const away = make((i) => (i < 600 ? S : W), { speedMps: 8, direction: 'reverse', positionXM: 3 });
    run(away, 2400);
    expect(away.state.positionXM).toBeGreaterThan(20);
    expect(away.ended).toBeUndefined();
  });

  it('a rover with its back to the wall can still turn and drive away (the wall only stops a step toward it)', () => {
    const s = make(() => W, {}, world, (i) => (i < 40 ? 1 : 0));
    run(s, 120 * 4);
    expect(s.ended).toBeUndefined();
    expect(s.state.positionXM).toBeGreaterThan(5);
    expect(s.state.speedMps).toBeGreaterThan(5);
  });

  it('the wall stops a rotated rover too: no corner goes behind it while the rover moves backward', () => {
    const s = make(() => S, { speedMps: 8, direction: 'reverse', positionXM: 6, headingRad: 0.5 });
    let behind = 0;
    for (let i = 0; i < 600; i++) {
      const before = s.state.positionXM;
      s.stepOnce();
      if (s.state.positionXM < before) {
        const h = s.state.headingRad;
        const corners = [-1, 1].flatMap((side) => [0, 2].map((back) => s.state.positionXM - back * Math.cos(h) - side * 0.85 * Math.sin(h)));
        behind = Math.max(behind, s.startWallXM - Math.min(...corners));
      }
    }
    expect(behind).toBeLessThan(1e-9);
    expect(s.ended).toBeUndefined();
  });

  it('a boost pad speeds the rover up in reverse too: J/m along the way it is moving', () => {
    const w = worldOf({ boostPads: [{ xM: [30, 40], zM: [-2, 2] }] }); // world x 90–100
    const s = make(() => NONE, { speedMps: 5, direction: 'reverse', positionXM: 110 }, w);
    run(s, 120 * 6);
    const boost = eventsOf(s, 'boost')[0]!;
    expect(boost).toBeDefined();
    expect(s.state.direction).toBe('reverse');
    close(boost.speedAfterMps! - boost.speedBeforeMps!, 1200 / 209);
    expect(boost.impulseNs).toBeCloseTo(1200, 9);
  });

  it('a head-on bag hits a reversing rover in world directions: u = −5, bag −10 → u′ = (209u + 40·(−10))/249, faster in reverse', () => {
    const w = worldOf({ cannons: [{ kind: 'headOn', xM: 98, zM: 0 }] }); // world x 158
    const s = make(() => NONE, { speedMps: 5, direction: 'reverse', positionXM: 100 }, w);
    run(s, 120 * 20);
    const hit = eventsOf(s, 'headOnHit')[0]!;
    expect(hit).toBeDefined();
    expect(hit.roverVelocityMps).toBeLessThan(0);
    expect(hit.otherVelocityMps).toBe(-10);
    close(hit.resultVelocityMps!, (209 * hit.roverVelocityMps! + 40 * -10) / 249);
    expect(hit.speedAfterMps!).toBeGreaterThan(hit.speedBeforeMps!);
    expect(s.state.direction).toBe('reverse');
  });

  it('a kicker bag from behind hits a reversing rover: u′ = (209u + 40·30)/249 can push it forward', () => {
    const w = worldOf({ cannons: [{ kind: 'kicker', xM: 5, zM: 0 }] }); // world x 65
    const s = make(() => NONE, { speedMps: 5, direction: 'reverse', positionXM: 75 }, w);
    run(s, 120 * 3);
    const hit = eventsOf(s, 'kickerHit')[0]!;
    expect(hit).toBeDefined();
    close(hit.resultVelocityMps!, (209 * hit.roverVelocityMps! + 40 * 30) / 249);
    expect(hit.resultVelocityMps!).toBeGreaterThan(0);
  });

  it('stuck: either drive key held at rest in mud — W going forward, S in reverse (and S held at rest in mud flips, then gets stuck)', () => {
    const mud = worldOf({ tiles: [{ surfaceId: 'mud', xM: [0, 100], zM: [-15, 15] }] });
    const forward = run(make(() => W, { positionXM: 100 }, mud), 600);
    expect(forward.ended?.cause).toBe('stuck');
    const reverse = run(make(() => S, { positionXM: 100, direction: 'reverse' }, mud), 600);
    expect(reverse.ended?.cause).toBe('stuck');
    const flipped = run(make(() => S, { positionXM: 100 }, mud), 600);
    expect(flipped.ended?.cause).toBe('stuck');
    expect(flipped.state.direction).toBe('reverse');
    const idle = run(make(() => NONE, { positionXM: 100 }, mud), 600);
    expect(idle.ended).toBeUndefined();
  });

  it('T9: a key record with reversing gives the same run at 30 and 144 fps', () => {
    const pedals: Drive = (i) => (i < 200 ? W : i < 500 ? S : i < 900 ? W : NONE);
    const steer: RunInputProvider = (i) => (Math.floor(i / 90) % 3 === 1 ? 1 : 0);
    const play = (fps: number) => {
      const s = createRunSession({ content: world, rover: rover(), constants, seed: 7, input: steer, drive: pedals, stopAtStep: 1500 });
      let frames = 0;
      while (s.state.stepCount < 1500 && frames++ < 100000) s.advanceFrame(1 / fps);
      return s;
    };
    const a = play(30);
    const b = play(144);
    expect(a.state).toEqual(b.state);
    expect(a.score).toBe(b.score);
    expect(a.travelRad).toBe(b.travelRad);
  });
});

describe('the tunnel comparison only counts a lane left through its far end', () => {
  const found = () => {
    const seed = 3;
    const course = createRunCourse(content, seed);
    course.ensureAhead(400);
    const tunnel = course.chunks.find((c) => c.kind === 'tunnel')!;
    const low = tunnel.gravityZones.find((z) => z.kind === 'low')!;
    return { seed, low, laneZM: (low.zM[0] + low.zM[1]) / 2 };
  };

  it('driving through the far end records the lane and the other lane', () => {
    const { seed, low, laneZM } = found();
    const s = createRunSession({
      content, rover: rover(), constants, seed, input: STRAIGHT, drive: () => W,
      initialState: { positionXM: low.xM[0] - 3, positionZM: laneZM, speedMps: 10, throttleLevel: 1 },
    });
    for (let i = 0; i < 3000 && !s.ended && s.state.positionXM <= low.xM[1] + 3; i++) s.stepOnce();
    expect(s.stats.gravityZones).toHaveLength(1);
    expect(s.stats.gravityZones[0]!.outcome).toBe('out');
    expect(s.stats.gravityZones[0]!.other).toBeDefined();
  });

  it('backing out of the near end records nothing', () => {
    const { seed, low, laneZM } = found();
    const s = createRunSession({
      content, rover: rover(), constants, seed, input: STRAIGHT, drive: () => S,
      initialState: { positionXM: low.xM[0] + 4, positionZM: laneZM, speedMps: 6, direction: 'reverse' },
    });
    for (let i = 0; i < 3000 && !s.ended && s.state.positionXM >= low.xM[0] - 3; i++) s.stepOnce();
    expect(s.state.positionXM).toBeLessThan(low.xM[0] - 3);
    expect(s.stats.gravityZones).toHaveLength(0);
  });

  it('a lane entered by reversing in from the far end has no comparison', () => {
    const { seed, low, laneZM } = found();
    const s = createRunSession({
      content, rover: rover(), constants, seed, input: STRAIGHT, drive: () => S,
      initialState: { positionXM: low.xM[1] + 3, positionZM: laneZM, speedMps: 6, direction: 'reverse' },
    });
    for (let i = 0; i < 4000 && !s.ended && s.state.positionXM >= low.xM[0] - 3; i++) s.stepOnce();
    expect(s.stats.gravityZones.every((z) => z.other === undefined)).toBe(true);
  });
});

describe('drifting', () => {
  const plain = worldOf({});
  const off: Content = { ...plain, run: { ...plain.run, drift: false } };
  const on: Content = { ...plain, run: { ...plain.run, drift: true } };
  const swerve: RunInputProvider = (i) => (i >= 240 && i < 300 ? 1 : i >= 300 && i < 360 ? -1 : 0);
  const hard: RunInputProvider = (i) => (i >= 240 && i < 360 ? 1 : 0);
  const play = (w: Content, input: RunInputProvider, steps: number, extra: Partial<Parameters<typeof createRunSession>[0]> = {}) => {
    const s = createRunSession({ content: w, rover: rover(), constants, seed: unmirroredSeed(w), input, ...extra });
    for (let i = 0; i < steps && !s.ended; i++) s.stepOnce();
    return s;
  };

  it('is on in the shipped content', () => {
    expect(content.run.drift).toBe(true);
  });

  it('OFF = current runs: the session equals a plain chain of step() calls (T9 replay), whatever the steering', () => {
    const s = play(off, swerve, 900);
    let state = createState();
    const flat = { ...constants, gravityMps2: 9.8, reverseTopSpeedFraction: 1 };
    for (let i = 0; i < 900; i++) state = step(state, { throttleHeld: true, brakeHeld: false, steer: swerve(i) }, rover(), surface('asphalt'), flat);
    expect(s.state).toEqual(state);
    expect(s.travelRad).toBe(s.state.headingRad);
    expect(s.slideAngleRad).toBe(0);
  });

  it('OFF: replaying the recorded input at 30 and 144 fps gives the same run', () => {
    const at = (fps: number) => {
      const s = createRunSession({ content: off, rover: rover(), constants, seed: 5, input: swerve, stopAtStep: 1200 });
      let frames = 0;
      while (s.state.stepCount < 1200 && frames++ < 100000) s.advanceFrame(1 / fps);
      return s;
    };
    expect(at(30).state).toEqual(at(144).state);
  });

  it('ON, no slide: the same run as OFF (the position is the physics position, bit for bit)', () => {
    expect(play(on, STRAIGHT, 900).state).toEqual(play(off, STRAIGHT, 900).state);
    const gentle: RunInputProvider = (i) => (i >= 240 && i < 250 ? 1 : 0); // 10 steps of turn: 5°, far below the limit
    expect(play(on, gentle, 900).state).toEqual(play(off, gentle, 900).state);
  });

  it('ON, steering harder than the tyres allow: the travel direction lags the heading and the rover slides', () => {
    const s = play(on, hard, 359);
    expect(s.state.headingRad).toBeGreaterThan(0.9);
    expect(s.travelRad).toBeLessThan(s.state.headingRad);
    expect(s.slideAngleRad).toBeGreaterThan((5 * Math.PI) / 180);
    expect(eventsOf(s, 'slide')).toHaveLength(1);
  });

  it('sliding does not change speed: ON and OFF have the same speed and distance at every step, on different paths', () => {
    const a = createRunSession({ content: on, rover: rover(), constants, seed: unmirroredSeed(on), input: swerve });
    const b = createRunSession({ content: off, rover: rover(), constants, seed: unmirroredSeed(off), input: swerve });
    for (let i = 0; i < 900; i++) {
      a.stepOnce();
      b.stepOnce();
      expect(a.state.speedMps).toBe(b.state.speedMps);
      expect(a.state.distanceM).toBe(b.state.distanceM);
    }
    expect(Math.hypot(a.state.positionXM - b.state.positionXM, a.state.positionZM - b.state.positionZM)).toBeGreaterThan(0.1);
  });

  it('the rover moves its step distance along the travel direction, not the heading', () => {
    const s = createRunSession({ content: on, rover: rover(), constants, seed: unmirroredSeed(on), input: hard });
    for (let i = 0; i < 300; i++) s.stepOnce();
    const before = s.state;
    const travelBefore = s.travelRad;
    s.stepOnce();
    const d = s.state.distanceM - before.distanceM;
    expect(s.state.positionXM - before.positionXM).toBeCloseTo(d * Math.cos(s.travelRad), 12);
    expect(s.state.positionZM - before.positionZM).toBeCloseTo(d * Math.sin(s.travelRad), 12);
    expect(s.travelRad).toBeGreaterThan(travelBefore);
  });

  it('the surface sets the limit: the same steering slides more on ice than on asphalt', () => {
    const ice = worldOf({ tiles: [{ surfaceId: 'ice', xM: [0, 100], zM: [-15, 15] }] });
    const iceOn: Content = { ...ice, run: { ...ice.run, drift: true } };
    const turn: RunInputProvider = (i) => (i >= 30 && i < 90 ? 1 : 0);
    const start = { initialState: { positionXM: 70, speedMps: 16, throttleLevel: 1 } };
    const a = play(iceOn, turn, 100, start);
    const b = play(on, turn, 100, start);
    expect(a.slideAngleRad).toBeGreaterThan(b.slideAngleRad);
    expect(eventsOf(a, 'slide').length).toBeGreaterThan(0);
  });

  it('the slide event carries the numbers of the caption: grip 0.8, wheels 1, g 9.8, the speed and the limit', () => {
    const s = play(on, hard, 359);
    const e = eventsOf(s, 'slide')[0]!;
    expect(e.surfaceGrip).toBe(0.8);
    expect(e.wheelGrip).toBe(1);
    expect(e.gravityMps2).toBe(9.8);
    expect(e.slideSpeedMps).toBeGreaterThan(0);
    close(e.turnLimitRadPerS!, (0.8 * 1 * 9.8) / e.slideSpeedMps!);
    expect(e.turnRateDegPerS).toBe(60);
  });

  it('a crash while sliding is flagged; a crash in a straight line is not', () => {
    // A barrier across the corridor 78 m into the first field chunk (the warm-up is 60 m), met while the 1 s hard turn is still sliding.
    const withBarrier = worldOf({ barriers: [{ xM: [78, 80], zM: [-15, 15] }] });
    const slidingBarrier = play({ ...withBarrier, run: { ...withBarrier.run, drift: true } }, hard, 3000, { initialState: { positionXM: 100, speedMps: 16, throttleLevel: 1 } });
    expect(slidingBarrier.ended).toMatchObject({ cause: 'crash', obstacle: 'barrier', sliding: true });
    const barrier = play(worldOf({ barriers: [{ xM: [30, 32], zM: [-15, 15] }] }), STRAIGHT, 3000);
    expect(barrier.ended?.cause).toBe('crash');
    expect(barrier.ended?.sliding).toBeUndefined();
  });

  it('at rest it snaps: a stopped rover travels the way it drives, and reverse points that the other way', () => {
    const s = play(on, STRAIGHT, 10, { drive: () => S, initialState: { positionXM: 100 } });
    expect(s.state.direction).toBe('reverse');
    expect(Math.abs(Math.cos(s.travelRad) + 1)).toBeLessThan(1e-12);
    expect(s.slideAngleRad).toBe(0);
  });
});
