import { createFixedStepLoop } from '../physics/loop.ts';
import { createState, step, type PhysicsState, type StepInput } from '../physics/step.ts';
import type { PhysicsConstants, RoverSpec, SurfaceSpec } from '../physics/types.ts';

/** What the controls say at a given step number. Live play reads the keys; tests read a recording. */
export type InputProvider = (stepIndex: number) => StepInput;

export interface DriveSessionOptions {
  rover: RoverSpec;
  constants: PhysicsConstants;
  /** The surface under the rover's front, found by the game layer so `physics/` stays free of the map. */
  surfaceAt: (xM: number, zM: number) => SurfaceSpec;
  input: InputProvider;
  /** Stop running steps once this many have run (used by tests to compare runs at exactly the same step). */
  stopAtStep?: number;
}

/**
 * One drive: the fixed-step loop wired to the physics. Frames only decide how many steps to run; each
 * step takes its input by step number, so the same input record gives the same run at any frame rate (T9).
 */
export function createDriveSession(options: DriveSessionOptions) {
  const { rover, constants, surfaceAt, input, stopAtStep } = options;
  let state = createState();
  let recording: StepInput[] = [];

  const loop = createFixedStepLoop(constants.timeStepS, () => {
    if (stopAtStep !== undefined && state.stepCount >= stopAtStep) return;
    const stepInput = input(state.stepCount);
    recording.push(stepInput);
    state = step(state, stepInput, rover, surfaceAt(state.positionXM, state.positionZM), constants);
  });

  return {
    get state(): PhysicsState {
      return state;
    },
    /** The input used at each step so far, so a run can be replayed. */
    get recording(): readonly StepInput[] {
      return recording;
    },
    /** Runs the steps that fit in one frame. Returns how many ran. */
    advanceFrame: (frameS: number) => loop.advance(frameS),
    /** Back to the start line, at rest. */
    reset() {
      state = createState();
      recording = [];
    },
  };
}
