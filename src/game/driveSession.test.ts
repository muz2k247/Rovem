import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import type { StepInput } from '../physics/step.ts';
import { physicsConstants, roverFromParts, STARTING_BUILD, surfaceSpec } from './buildFromParts.ts';
import { createDriveSession } from './driveSession.ts';
import { courseSurfaceIdAt } from './testCourse.ts';

const constants = physicsConstants(content);
const rover = roverFromParts(content, STARTING_BUILD);
const surfaceAt = (x: number, z: number) => surfaceSpec(content, courseSurfaceIdAt(x, z));
const stepsPerSecond = content.constants.stepsPerSecond;

/** A scripted drive: throttle 0–6 s, brake 6–9 s, steering left 1–2 s and right 3–3.5 s, then idle to 12 s. */
function scripted(stepIndex: number): StepInput {
  const t = stepIndex / stepsPerSecond;
  return {
    throttleHeld: t < 6,
    brakeHeld: t >= 6 && t < 9,
    steer: t >= 1 && t < 2 ? 1 : t >= 3 && t < 3.5 ? -1 : 0,
  };
}
const TOTAL_STEPS = 12 * stepsPerSecond;

/** Plays the script at a given frame rate, stopping at exactly TOTAL_STEPS. */
function playAt(fps: number) {
  const session = createDriveSession({ rover, constants, surfaceAt, input: scripted, stopAtStep: TOTAL_STEPS });
  while (session.state.stepCount < TOTAL_STEPS) session.advanceFrame(1 / fps);
  return session;
}

describe('T9 on the driving session: same input record, any frame rate', () => {
  const at30 = playAt(30);
  const at60 = playAt(60);
  const at144 = playAt(144);

  it('every run covers the same number of steps', () => {
    expect(at30.state.stepCount).toBe(TOTAL_STEPS);
    expect(at144.state.stepCount).toBe(TOTAL_STEPS);
  });
  it('30 fps and 144 fps give identical final state', () => expect(at30.state).toEqual(at144.state));
  it('60 fps agrees too', () => expect(at60.state).toEqual(at144.state));
  it('the script actually moved and turned the rover', () => {
    expect(at30.state.distanceM).toBeGreaterThan(20);
    expect(at30.state.headingRad).not.toBe(0);
  });
});

describe('input recording', () => {
  it('replaying a recorded live drive reproduces it exactly', () => {
    const live = createDriveSession({ rover, constants, surfaceAt, input: scripted, stopAtStep: TOTAL_STEPS });
    while (live.state.stepCount < TOTAL_STEPS) live.advanceFrame(1 / 47); // an awkward frame rate
    expect(live.recording).toHaveLength(TOTAL_STEPS);

    const record = live.recording;
    const replay = createDriveSession({ rover, constants, surfaceAt, input: (i) => record[i]!, stopAtStep: TOTAL_STEPS });
    while (replay.state.stepCount < TOTAL_STEPS) replay.advanceFrame(1 / 144);
    expect(replay.state).toEqual(live.state);
  });
});

describe('driving agrees with the Physics Model Specification', () => {
  it('full throttle on the asphalt strip reaches 100 m in 8.500 s (the sheet value for the starting build)', () => {
    const session = createDriveSession({
      rover,
      constants,
      surfaceAt,
      input: () => ({ throttleHeld: true, brakeHeld: false, steer: 0 }),
    });
    while (session.state.distanceM < 100) session.advanceFrame(1 / 60);
    expect(session.state.timeS).toBeCloseTo(8.5, 3);
  });

  it('a stopped rover does not turn', () => {
    const session = createDriveSession({
      rover,
      constants,
      surfaceAt,
      input: () => ({ throttleHeld: false, brakeHeld: false, steer: 1 }),
    });
    for (let i = 0; i < 60; i++) session.advanceFrame(1 / 60);
    expect(session.state.headingRad).toBe(0);
  });

  it('steering does not change speed', () => {
    const run = (steer: -1 | 0 | 1) => {
      const s = createDriveSession({
        rover,
        constants,
        surfaceAt: () => surfaceSpec(content, 'asphalt'), // same surface everywhere, so only steering differs
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
        surfaceAt: () => surfaceSpec(content, surfaceId),
        input: () => ({ throttleHeld: true, brakeHeld: false, steer: 0 }),
        stopAtStep: 240,
      });
      while (s.state.stepCount < 240) s.advanceFrame(1 / 60);
      return s.state.speedMps;
    };
    expect(on('sand')).toBeLessThan(on('asphalt'));
  });

  it('reset returns to the start and clears the recording', () => {
    const s = createDriveSession({ rover, constants, surfaceAt, input: scripted });
    s.advanceFrame(1);
    s.reset();
    expect(s.state.stepCount).toBe(0);
    expect(s.recording).toHaveLength(0);
  });
});

describe('test course layout', () => {
  it('asphalt along the track, sand beside it', () => {
    expect(courseSurfaceIdAt(50, 0)).toBe('asphalt');
    expect(courseSurfaceIdAt(50, 20)).toBe('sand');
  });
});
