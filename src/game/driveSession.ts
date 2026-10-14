import { createFixedStepLoop } from '../physics/loop.ts';
import { createState, step, type PhysicsState, type StepInput } from '../physics/step.ts';
import type { PhysicsConstants, RoverSpec } from '../physics/types.ts';
import type { Track } from './level.ts';
import { assistSteer } from './steeringAssist.ts';

/** One step's input record: the keys, plus whether the steering assist was on (DESIGN §6). */
export interface DriveInput extends StepInput {
  steeringAssist?: boolean;
}

/** What the controls say at a given step number. Live play reads the keys; tests read a recording. */
export type InputProvider = (stepIndex: number) => DriveInput;

export interface DriveSessionOptions {
  rover: RoverSpec;
  constants: PhysicsConstants;
  /** The level: start pose, the surface under the rover's front, rocks and the ideal line. */
  track: Track;
  input: InputProvider;
  /** Stop running steps once this many have run (used by tests to compare runs at exactly the same step). */
  stopAtStep?: number;
}

/**
 * One drive: the fixed-step loop wired to the physics. Frames only decide how many steps to run; each
 * step takes its input by step number, so the same input record gives the same run at any frame rate (T9).
 */
export function createDriveSession(options: DriveSessionOptions) {
  const { rover, constants, track, input, stopAtStep } = options;
  const atStart = () => createState({ ...track.start });
  let state = atStart();
  let blocked = false;
  let lastBlockedStep = -1;
  let recording: DriveInput[] = [];

  const loop = createFixedStepLoop(constants.timeStepS, () => {
    if (stopAtStep !== undefined && state.stepCount >= stopAtStep) return;
    const recorded = input(state.stepCount);
    recording.push(recorded);
    // The assist steers only when the student is not steering; a held steer key wins.
    const steer =
      recorded.steeringAssist && recorded.steer === 0
        ? assistSteer(state, track.path, constants, track.footprint.lengthM)
        : recorded.steer;
    const next = step(state, { ...recorded, steer }, rover, track.surfaceAt(state.positionXM, state.positionZM), constants);
    // Rocks are solid (DECISIONS 2026-10-13): a step that ends with the footprint overlapping a rock is undone
    // (position, heading and distance) and v = 0; the clock still advances. The heading is undone too, so the
    // rover can never be left turned into a rock.
    blocked = track.rockHit(next.positionXM, next.positionZM, next.headingRad) !== undefined;
    if (blocked) lastBlockedStep = next.stepCount;
    state = blocked
      ? {
          ...next,
          positionXM: state.positionXM,
          positionZM: state.positionZM,
          headingRad: state.headingRad,
          distanceM: state.distanceM,
          speedMps: 0,
        }
      : next;
  });

  return {
    get state(): PhysicsState {
      return state;
    },
    /** True when the last step was undone by a rock (HUD "Blocked"). */
    get blocked(): boolean {
      return blocked;
    },
    /** Step number of the last step a rock undid; -1 if none. The HUD holds "Blocked" briefly after it. */
    get lastBlockedStep(): number {
      return lastBlockedStep;
    },
    /** The input used at each step so far, so a run can be replayed. */
    get recording(): readonly DriveInput[] {
      return recording;
    },
    /** Runs the steps that fit in one frame. Returns how many ran. */
    advanceFrame: (frameS: number) => loop.advance(frameS),
    /** Back to the start pose, at rest. */
    reset() {
      state = atStart();
      blocked = false;
      lastBlockedStep = -1;
      recording = [];
    },
  };
}
