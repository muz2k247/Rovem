import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import { physicsConstants, roverFromParts, STARTING_BUILD, surfaceSpec } from './buildFromParts.ts';
import { createDriveSession, type DriveInput } from './driveSession.ts';
import { createTrack, type Track } from './level.ts';

const constants = physicsConstants(content);
const rover = roverFromParts(content, STARTING_BUILD);
const track = createTrack(content, content.levels.testCourse);
/** The test course with every rock removed, for drives that only test steering or surfaces. */
const open: Track = { ...track, rockHit: () => undefined };
const stepsPerSecond = content.constants.stepsPerSecond;
const IDLE: DriveInput = { throttleHeld: false, brakeHeld: false, steer: 0 };

/**
 * A scripted drive with the steering assist and reverse in it:
 * 0–4 s throttle (assist on 0–3 s, a manual left turn 3–3.5 s), 4–8 s S held (brakes to a stop, then reverses;
 * steering right 6.5–7 s while reversing), 8–9.5 s W held (brakes the reverse, then drives forward), idle to 12 s.
 */
function scripted(stepIndex: number): DriveInput {
  const t = stepIndex / stepsPerSecond;
  return {
    throttleHeld: t < 4 || (t >= 8 && t < 9.5),
    brakeHeld: t >= 4 && t < 8,
    steer: t >= 3 && t < 3.5 ? 1 : t >= 6.5 && t < 7 ? -1 : 0,
    steeringAssist: t < 3,
  };
}
const TOTAL_STEPS = 12 * stepsPerSecond;

/** Plays the script at a given frame rate, stopping at exactly TOTAL_STEPS. */
function playAt(fps: number) {
  const session = createDriveSession({ rover, constants, track, input: scripted, stopAtStep: TOTAL_STEPS });
  const directions = new Set<string>();
  while (session.state.stepCount < TOTAL_STEPS) {
    session.advanceFrame(1 / fps);
    directions.add(session.state.direction);
  }
  return { session, directions };
}

function driveUntil(session: ReturnType<typeof createDriveSession>, done: () => boolean, guardSteps = 120 * 60) {
  while (!done() && session.state.stepCount < guardSteps) session.advanceFrame(1 / 60);
}

describe('T9 on the driving session: same input record, any frame rate, with reverse and the assist', () => {
  const at30 = playAt(30);
  const at60 = playAt(60);
  const at144 = playAt(144);

  it('every run covers the same number of steps', () => {
    expect(at30.session.state.stepCount).toBe(TOTAL_STEPS);
    expect(at144.session.state.stepCount).toBe(TOTAL_STEPS);
  });
  it('30 fps and 144 fps give identical final state', () => expect(at30.session.state).toEqual(at144.session.state));
  it('60 fps agrees too', () => expect(at60.session.state).toEqual(at144.session.state));
  it('the script moved, turned, reversed and came forward again', () => {
    expect(at30.session.state.distanceM).toBeGreaterThan(20);
    expect(at30.session.state.headingRad).not.toBe(0);
    expect(at30.directions).toEqual(new Set(['forward', 'reverse']));
    expect(at30.session.state.direction).toBe('forward');
  });
  it('the assist flag is part of the input record', () => {
    expect(at30.session.recording[0]!.steeringAssist).toBe(true);
    expect(at30.session.recording[TOTAL_STEPS - 1]!.steeringAssist).toBe(false);
  });
});

describe('input recording', () => {
  it('replaying a recorded live drive reproduces it exactly', () => {
    const live = createDriveSession({ rover, constants, track, input: scripted, stopAtStep: TOTAL_STEPS });
    while (live.state.stepCount < TOTAL_STEPS) live.advanceFrame(1 / 47); // an awkward frame rate
    expect(live.recording).toHaveLength(TOTAL_STEPS);

    const record = live.recording;
    const replay = createDriveSession({ rover, constants, track, input: (i) => record[i]!, stopAtStep: TOTAL_STEPS });
    while (replay.state.stepCount < TOTAL_STEPS) replay.advanceFrame(1 / 144);
    expect(replay.state).toEqual(live.state);
  });
});

describe('driving agrees with the Physics Model Specification', () => {
  it('full throttle on the asphalt strip reaches 100 m in 8.500 s (the sheet value for the starting build)', () => {
    const session = createDriveSession({ rover, constants, track, input: () => ({ ...IDLE, throttleHeld: true }) });
    driveUntil(session, () => session.state.distanceM >= 100);
    expect(session.state.timeS).toBeCloseTo(8.5, 3);
  });

  it('starts at the level start pose', () => {
    const session = createDriveSession({ rover, constants, track, input: () => IDLE });
    expect(session.state.positionXM).toBe(track.start.positionXM);
    expect(session.state.headingRad).toBe(track.start.headingRad);
  });

  it('a stopped rover does not turn', () => {
    const session = createDriveSession({ rover, constants, track, input: () => ({ ...IDLE, steer: 1 }) });
    for (let i = 0; i < 60; i++) session.advanceFrame(1 / 60);
    expect(session.state.headingRad).toBe(0);
  });

  it('steering does not change speed', () => {
    const run = (steer: -1 | 0 | 1) => {
      const s = createDriveSession({
        rover,
        constants,
        track: { ...open, surfaceAt: () => surfaceSpec(content, 'asphalt') }, // same surface everywhere
        input: (i) => ({ throttleHeld: i < 240, brakeHeld: false, steer: i > 120 ? steer : 0 }),
        stopAtStep: 480,
      });
      while (s.state.stepCount < 480) s.advanceFrame(1 / 60);
      return s.state;
    };
    const straight = run(0);
    const turning = run(1);
    expect(turning.speedMps).toBe(straight.speedMps);
    expect(turning.distanceM).toBe(straight.distanceM);
    expect(turning.headingRad).not.toBe(0);
  });

  it('the surface under the rover changes the physics: sand gives less acceleration than asphalt', () => {
    const on = (surfaceId: string) => {
      const s = createDriveSession({
        rover,
        constants,
        track: { ...open, surfaceAt: () => surfaceSpec(content, surfaceId) },
        input: () => ({ ...IDLE, throttleHeld: true }),
        stopAtStep: 240,
      });
      while (s.state.stepCount < 240) s.advanceFrame(1 / 60);
      return s.state.speedMps;
    };
    expect(on('sand')).toBeLessThan(on('asphalt'));
  });

  it('reset returns to the start and clears the recording', () => {
    const s = createDriveSession({ rover, constants, track, input: scripted });
    s.advanceFrame(1);
    s.reset();
    expect(s.state.stepCount).toBe(0);
    expect(s.state.positionXM).toBe(track.start.positionXM);
    expect(s.recording).toHaveLength(0);
    expect(s.blocked).toBe(false);
  });
});

// DECISIONS 2026-10-13: a step that ends with the footprint overlapping a rock is undone and v = 0; the clock advances.
describe('rocks are solid', () => {
  const reverseIntoRock = () => {
    const session = createDriveSession({ rover, constants, track, input: () => ({ ...IDLE, brakeHeld: true }) });
    let prev = session.state;
    while (!session.blocked && session.state.stepCount < 120 * 20) {
      prev = session.state;
      session.advanceFrame(constants.timeStepS); // exactly one step per frame
    }
    return { session, prev };
  };

  it('backing into the rock behind the start undoes the step: pose and distance restored, v = 0, clock advanced', () => {
    const { session, prev } = reverseIntoRock();
    const s = session.state;
    expect(session.blocked).toBe(true);
    expect(s.positionXM).toBe(prev.positionXM);
    expect(s.positionZM).toBe(prev.positionZM);
    expect(s.headingRad).toBe(prev.headingRad);
    expect(s.distanceM).toBe(prev.distanceM);
    expect(s.speedMps).toBe(0);
    expect(s.stepCount).toBe(prev.stepCount + 1);
    expect(s.timeS).toBe((prev.stepCount + 1) * constants.timeStepS);
    // The rear stopped just short of the rock: front within one step's travel of x = −5.
    expect(s.positionXM).toBeGreaterThan(-5);
    expect(s.positionXM).toBeLessThan(-5 + 0.2);
  });

  it('pushing on into the rock: it creeps up from rest and is stopped again, never overlapping', () => {
    const { session } = reverseIntoRock();
    const x = session.state.positionXM;
    let blocks = 0;
    for (let i = 0; i < 240; i++) {
      session.advanceFrame(constants.timeStepS);
      if (session.blocked) blocks += 1;
      expect(track.rockHit(session.state.positionXM, session.state.positionZM, session.state.headingRad)).toBeUndefined();
      expect(session.state.positionXM).toBeLessThanOrEqual(x);
      expect(session.state.positionXM).toBeGreaterThan(-5);
    }
    expect(blocks).toBeGreaterThan(1);
    expect(session.lastBlockedStep).toBeGreaterThan(0);
  });

  it('drives away forward after a block', () => {
    let keys: DriveInput = { ...IDLE, brakeHeld: true };
    const session = createDriveSession({ rover, constants, track, input: () => keys });
    driveUntil(session, () => session.blocked);
    keys = { ...IDLE, throttleHeld: true };
    const x = session.state.positionXM;
    for (let i = 0; i < 240; i++) session.advanceFrame(1 / 60);
    expect(session.blocked).toBe(false);
    expect(session.state.direction).toBe('forward');
    expect(session.state.positionXM).toBeGreaterThan(x);
  });
});

describe('steering assist', () => {
  it('the same straight drive with and without assist gives an identical time and speed', () => {
    const drive = (steeringAssist: boolean) => {
      const s = createDriveSession({ rover, constants, track, input: () => ({ ...IDLE, throttleHeld: true, steeringAssist }) });
      driveUntil(s, () => s.state.distanceM >= 100);
      return s.state;
    };
    const off = drive(false);
    const on = drive(true);
    expect(on.timeS).toBe(off.timeS);
    expect(on.speedMps).toBe(off.speedMps);
    expect(on).toEqual(off);
  });

  it('brings a rover that starts 2 m off the line back onto it', () => {
    const offset: Track = { ...track, start: { ...track.start, positionZM: 2 } };
    const s = createDriveSession({
      rover,
      constants,
      track: offset,
      input: () => ({ ...IDLE, throttleHeld: true, steeringAssist: true }),
    });
    driveUntil(s, () => s.state.timeS >= 6);
    expect(Math.abs(s.state.positionZM)).toBeLessThan(0.25);
    expect(Math.abs(s.state.headingRad)).toBeLessThan(0.1);
  });

  it('a held steer key overrides the assist', () => {
    const s = createDriveSession({
      rover,
      constants,
      track: open,
      input: (i) => ({ ...IDLE, throttleHeld: true, steer: i > 120 ? 1 : 0, steeringAssist: true }),
      stopAtStep: 240,
    });
    while (s.state.stepCount < 240) s.advanceFrame(1 / 60);
    // Steps 121–239 hold the left key: 119 steps of 0.5° each, exactly as with no assist.
    expect(s.state.headingRad).toBeCloseTo(((60 * Math.PI) / 180 / 120) * 119, 9);
  });
});
