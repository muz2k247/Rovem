import type { GravityKind } from '../../content/index.ts';
import { step, type PhysicsState } from '../../physics/step.ts';
import type { PhysicsConstants, RoverSpec, SurfaceSpec } from '../../physics/types.ts';
import type { RunCourse } from './course.ts';

// The tunnel comparison (DECISIONS 2026-10-16): when the rover leaves a gravity lane, the same build is driven down
// the other lane at the same entry state, straight, with the same step() and that lane's g. Game layer: no rendering.

export interface LaneResult {
  kind: GravityKind;
  /** `out`: the front left the lane. `stuck`: v = 0 with the motor at full strength (FR-8), as in the run itself. */
  outcome: 'out' | 'stuck';
  /** The speed at the end of the step in which the front left the lane (0 if stuck). */
  speedOutMps: number;
}

export interface OtherLaneInput {
  course: RunCourse;
  rover: RoverSpec;
  constants: PhysicsConstants;
  surfaces: ReadonlyMap<string, SurfaceSpec>;
  gravityMultipliers: Record<GravityKind, number>;
  /** The state at the end of the step in which the front entered the lane the rover used. */
  entry: PhysicsState;
}

/** A guard against a rover that crawls for ever: 2 minutes of steps. Not a game value. */
const MAX_STEPS = 120 * 120;

/** The other lane of the tunnel the rover entered, or undefined if the chunk at the entry has no second lane. */
export function simulateOtherLane(input: OtherLaneInput): LaneResult | undefined {
  const { course, rover, constants, surfaces, gravityMultipliers, entry } = input;
  const zones = course.gravityZonesAt(entry.positionXM);
  const used = zones.find((z) => entry.positionXM >= z.xM[0] && entry.positionXM <= z.xM[1] && entry.positionZM >= z.zM[0] && entry.positionZM <= z.zM[1]);
  const other = used && zones.find((z) => z.kind !== used.kind && z.xM[0] === used.xM[0] && z.xM[1] === used.xM[1]);
  if (!other) return undefined;

  // Straight down the middle of the other lane, from the same place along the canyon.
  const laneZM = (other.zM[0] + other.zM[1]) / 2;
  let s: PhysicsState = { ...entry, positionZM: laneZM, headingRad: 0 };
  for (let i = 0; i < MAX_STEPS; i++) {
    const zoneKind = course.gravityKindAt(s.positionXM, s.positionZM);
    const g = zoneKind === undefined ? constants.gravityMps2 : constants.gravityMps2 * gravityMultipliers[zoneKind];
    const surface = surfaces.get(course.surfaceIdAt(s.positionXM, s.positionZM))!;
    // The other lane is always driven with the throttle held and no brake: a fixed, repeatable what-if, whatever the student did.
    s = step(s, { throttleHeld: true, brakeHeld: false, steer: 0 }, rover, surface, { ...constants, gravityMps2: g });
    if (course.gravityKindAt(s.positionXM, s.positionZM) !== other.kind) return { kind: other.kind, outcome: 'out', speedOutMps: s.speedMps };
    if (s.speedMps === 0 && s.throttleLevel === 1 && s.brakeLevel === 0 && s.drivingState === 'Stopped') {
      return { kind: other.kind, outcome: 'stuck', speedOutMps: 0 };
    }
  }
  return { kind: other.kind, outcome: 'stuck', speedOutMps: 0 };
}
