import type { Content, GravityKind, EventKind } from '../../content/index.ts';
import { buildQuantities } from '../../physics/build.ts';
import { createFixedStepLoop } from '../../physics/loop.ts';
import { applyImpulse, shareMomentum } from '../../physics/momentum.ts';
import { createState, step, type PhysicsState } from '../../physics/step.ts';
import type { PhysicsConstants, RoverSpec, SurfaceSpec } from '../../physics/types.ts';
import { surfaceSpec } from '../buildFromParts.ts';
import { footprintCorners, footprintOverlapsCircle } from '../geometry.ts';
import { SLIDE_MARK_RAD, slideAngleRad, travelTurnLimitRadPerS, turnTravelDirection } from './drift.ts';
import { createRunCourse, type RunCourse, type WorldCannon } from './course.ts';
import { simulateOtherLane, type LaneResult } from './tunnelCompare.ts';

// The run rules of the endless canyon (docs/DEMO_BUILD_PLAN.md A2, A4, A6). Game layer: no rendering, no React.
// The student drives (DECISIONS 2026-10-16): the throttle, brake and steer keys are read each step. The run starts at
// rest with the throttle level 0. Reverse works as the physics does (S at rest flips the direction; in reverse S drives
// and W brakes); the keys are passed through as pressed. The physics is unchanged.
// Reverse and drifting (DECISIONS 2026-10-16, demo only): the game layer passes the reverse top speed from run.json, keeps
// a travel direction separate from the heading, and puts a wall behind the start line.
// With no steer key held the game steers the heading back to 0 (DECISIONS 2026-10-16); `steerSent` records what was
// really passed to step(), so replaying that record with the return switched off gives the same run (T9).

/** What the student does at a given step number: steer left (+1), right (−1) or straight. */
export type RunInputProvider = (stepIndex: number) => -1 | 0 | 1;

/** Which pedals the student holds at a given step number. */
export interface DriveKeys {
  throttleHeld: boolean;
  brakeHeld: boolean;
}
export type RunDriveProvider = (stepIndex: number) => DriveKeys;

/** Throttle held, brake free: what a session does when no `drive` is given (tests, and the tunnel comparison's other lane). */
export const HOLD_THROTTLE: RunDriveProvider = () => ({ throttleHeld: true, brakeHeld: false });

export type RunEventKind = EventKind | 'crash' | 'stuck';

/** Something that happened in the run, with the numbers that changed. Captions and the report are made from these. */
export interface RunEvent {
  kind: RunEventKind;
  timeS: number;
  xM: number;
  surfaceId?: string;
  speedBeforeMps?: number;
  speedAfterMps?: number;
  /** F_r on the surface just entered, for this rover. */
  frictionN?: number;
  weightN?: number;
  /** F_lim, the strongest force the tyres can pass on. */
  gripN?: number;
  gravityKind?: GravityKind;
  gravityMultiplier?: number;
  // The numbers behind the worked formulas (DECISIONS 2026-10-16). Signed velocities are along the heading.
  massKg?: number;
  gravityMps2?: number;
  /** μ_r and μ_g of the surface just entered; k_r and k_g of the wheels. */
  surfaceRolling?: number;
  surfaceGrip?: number;
  wheelRolling?: number;
  wheelGrip?: number;
  impulseNs?: number;
  otherMassKg?: number;
  roverVelocityMps?: number;
  otherVelocityMps?: number;
  /** u′ after the bag: negative if the hit pushed the rover into reverse. */
  resultVelocityMps?: number;
  // The numbers behind the slide caption (drifting): the speed at the start of the step, the tyres' limit and the turn rate.
  slideSpeedMps?: number;
  turnLimitRadPerS?: number;
  turnRateDegPerS?: number;
}

export interface RunEnd {
  cause: 'crash' | 'stuck';
  /** Crash: the speed at the start of the step that crashed. Stuck: 0. */
  speedMps: number;
  obstacle?: 'barrier' | 'wall';
  /** The crash was on the divider between the two tunnel lanes. */
  atDivider?: boolean;
  /** The gravity zone the rover was in when it ended, if any. */
  gravityKind?: GravityKind;
  /** The rover was sliding (slide angle at least 5°) in the step that crashed. */
  sliding?: boolean;
}

export interface GravityZoneUse {
  kind: GravityKind;
  speedInMps: number;
  speedOutMps: number;
  /** How the rover left the lane: out of the far end, stuck in it, or crashed in it. */
  outcome: 'out' | 'stuck' | 'crash';
  /** The other lane, driven straight from the same entry state. Undefined if the zone has no second lane. */
  other?: LaneResult;
}

/** Per-run totals for the report. Speed changes are in m/s. */
export interface RunStats {
  /** Σ (speed entering mud − speed leaving it), per patch. */
  mudLossMps: number;
  mudPatches: number;
  boostGainMps: number;
  boosts: number;
  headOnLossMps: number;
  headOnHits: number;
  kickerGainMps: number;
  kickerHits: number;
  gravityZones: GravityZoneUse[];
  maxSpeedMps: number;
  /** The student used the brake (at least one step with the brake sent). */
  brakeUsed: boolean;
  /** The first event of each kind in this run: the report works its formulas with these numbers. */
  firstEvents: Partial<Record<EventKind, RunEvent>>;
}

export interface Bag {
  id: string;
  cannonId: string;
  kind: 'headOn' | 'kicker';
  firedAtS: number;
  xM: number;
  zM: number;
}

export interface Shot {
  cannonId: string;
  timeS: number;
}

export interface RunSessionOptions {
  content: Content;
  rover: RoverSpec;
  constants: PhysicsConstants;
  seed: number;
  /** The steer key at each step. */
  input: RunInputProvider;
  /** The throttle and brake keys at each step. Default: throttle held, brake free. */
  drive?: RunDriveProvider;
  /** Stop running steps once this many have run (tests compare runs at exactly the same step). */
  stopAtStep?: number;
  /** Test hook: start from a different state (e.g. already fast, or already in mud). */
  initialState?: Partial<PhysicsState>;
  /** Test hook: a ready-made course. */
  course?: RunCourse;
}

interface CannonState {
  cannon: WorldCannon;
  activatedAtS: number;
  shotsFired: number;
}

/** How far ahead the course is always generated (A3). */
export const GENERATE_AHEAD_M = 400;

export function createRunSession(options: RunSessionOptions) {
  const { content, rover, constants, seed, input, stopAtStep } = options;
  const drive = options.drive ?? HOLD_THROTTLE;
  const run = content.run;
  // The game layer passes the demo's reverse top speed (run.json) to step(); constants.json keeps the v2 value.
  const baseConstants: PhysicsConstants = { ...constants, reverseTopSpeedFraction: run.reverseTopSpeedFactor };
  const bagSpec = run.sandbag;
  const footprint = { lengthM: content.constants.roverLengthM, widthM: content.constants.roverWidthM };
  const course = options.course ?? createRunCourse(content, seed);
  const specs = new Map<string, SurfaceSpec>(content.surfaces.map((s) => [s.id, surfaceSpec(content, s.id)]));

  const start = () => createState({ ...options.initialState });
  let state = start();
  let ended: RunEnd | undefined;
  let score = 0;
  let progressM = state.positionXM;
  let bags: Bag[] = [];
  let events: RunEvent[] = [];
  let shots: Shot[] = [];
  let usedPads = new Set<string>();
  let cannonStates = new Map<string, CannonState>();
  let stats: RunStats = emptyStats();
  let currentSurfaceId = 'asphalt';
  let currentZone: GravityKind | undefined;
  let zoneEntrySpeedMps = 0;
  let zoneEntryState: PhysicsState = state;
  let mudEntrySpeedMps = 0;
  let wasSlipping = false;
  let wasAboveTop = false;
  let steerSent: (-1 | 0 | 1)[] = [];
  let driveSent: DriveKeys[] = [];
  const turnRadPerS = (baseConstants.turnRateDegPerS * Math.PI) / 180;
  const returnDeadbandRad = (turnRadPerS * baseConstants.timeStepS) / 2;
  /** The wall behind the start line (content), well behind the chase camera. */
  const startWallXM = run.startWallXM;
  /** The way the rover is driving: its heading, or the opposite way in reverse. */
  const drivingAngle = (s: PhysicsState) => (s.direction === 'forward' ? s.headingRad : s.headingRad + Math.PI);
  /** The way the rover is travelling (differs from the driving angle while it slides). */
  let travelRad = drivingAngle(state);
  let slideRad = 0;
  let wasSliding = false;
  let zoneEnteredForward = false;

  /**
   * The steer input that turns the heading back toward 0 at the normal turn rate; 0 when the heading is within half
   * of one step's turn, when the rover is stopped (a stopped rover does not turn) or when the setting is off.
   * Steering is mirrored in reverse, so the input flips with the direction.
   */
  function returnToStraight(s: PhysicsState): -1 | 0 | 1 {
    if (!run.steerReturnToStraight || s.speedMps === 0 || Math.abs(s.headingRad) <= returnDeadbandRad) return 0;
    const wanted = s.headingRad > 0 ? -1 : 1; // the way the heading must turn
    return s.direction === 'forward' ? wanted : wanted === 1 ? -1 : 1;
  }

  function emptyStats(): RunStats {
    return {
      mudLossMps: 0, mudPatches: 0, boostGainMps: 0, boosts: 0, headOnLossMps: 0, headOnHits: 0,
      kickerGainMps: 0, kickerHits: 0, gravityZones: [], maxSpeedMps: 0, brakeUsed: false, firstEvents: {},
    };
  }

  const gravityAt = (zone: GravityKind | undefined): number =>
    zone === undefined ? baseConstants.gravityMps2 : baseConstants.gravityMps2 * run.gravityMultipliers[zone];

  /** u: +v forward, −v in reverse (momentum.ts). */
  const signed = (s: PhysicsState) => (s.direction === 'forward' ? s.speedMps : -s.speedMps);

  const record = (event: RunEvent) => {
    events.push(event);
    if (event.kind !== 'crash' && event.kind !== 'stuck') stats.firstEvents[event.kind] ??= event;
  };

  /** Recomputed from the build for the surface and gravity in force (for the captions). */
  const quantities = (surfaceId: string, zone: GravityKind | undefined) =>
    buildQuantities(rover, specs.get(surfaceId)!, { gravityMps2: gravityAt(zone) });

  function activateAndFire(front: { x: number; z: number }, t: number) {
    // Cannons near the rover that have not woken yet.
    for (const cannon of course.cannonsInRange(front.x - 10, front.x + bagSpec.headOnTriggerDistanceM + 5)) {
      if (cannonStates.has(cannon.id)) continue;
      const wake = cannon.kind === 'headOn' ? cannon.xM - bagSpec.headOnTriggerDistanceM : cannon.xM + bagSpec.kickerWakeRearOffsetM + footprint.lengthM;
      if (front.x >= wake) cannonStates.set(cannon.id, { cannon, activatedAtS: t, shotsFired: 0 });
    }
    // Fire every shot that is due: the first at the activation step's time, then every fireIntervalS.
    for (const cs of cannonStates.values()) {
      const { cannon } = cs;
      for (;;) {
        const due = cs.activatedAtS + cs.shotsFired * bagSpec.fireIntervalS;
        if (due > t + 1e-9) break;
        if (cannon.kind === 'headOn' ? front.x >= cannon.xM : cs.shotsFired >= bagSpec.kickerShots) break;
        bags.push({ id: `${cannon.id}#${cs.shotsFired}`, cannonId: cannon.id, kind: cannon.kind, firedAtS: due, xM: cannon.xM, zM: cannon.zM });
        shots.push({ cannonId: cannon.id, timeS: due });
        cs.shotsFired += 1;
      }
    }
  }

  function moveBags(t: number) {
    const kept: Bag[] = [];
    for (const bag of bags) {
      const cannon = cannonStates.get(bag.cannonId)!.cannon;
      const travelled = (bag.kind === 'headOn' ? bagSpec.headOnSpeedMps : bagSpec.kickerSpeedMps) * (t - bag.firedAtS);
      if (travelled >= bagSpec.rangeM) continue;
      bag.xM = bag.kind === 'headOn' ? cannon.xM - travelled : cannon.xM + travelled;
      kept.push(bag);
    }
    bags = kept;
  }

  function hitBags(t: number) {
    const remaining: Bag[] = [];
    for (const bag of bags) {
      const hit = footprintOverlapsCircle(
        state.positionXM, state.positionZM, state.headingRad, footprint.lengthM, footprint.widthM, bag.xM, bag.zM, bagSpec.radiusM,
      );
      if (!hit) {
        remaining.push(bag);
        continue;
      }
      // The bag and the rover move off together: m₁u₁ + m₂u₂ = (m₁ + m₂)u′, along the heading.
      const bagSpeed = bag.kind === 'headOn' ? -bagSpec.headOnSpeedMps : bagSpec.kickerSpeedMps;
      const before = state.speedMps;
      const roverBefore = state;
      const bagAlongHeading = bagSpeed * Math.cos(state.headingRad);
      state = shareMomentum(state, rover.massKg, bagSpec.massKg, bagAlongHeading);
      const after = state.speedMps;
      record({
        kind: bag.kind === 'headOn' ? 'headOnHit' : 'kickerHit', timeS: t, xM: state.positionXM, speedBeforeMps: before, speedAfterMps: after,
        massKg: rover.massKg, otherMassKg: bagSpec.massKg, roverVelocityMps: signed(roverBefore), otherVelocityMps: bagAlongHeading, resultVelocityMps: signed(state),
      });
      if (bag.kind === 'headOn') {
        stats.headOnHits += 1;
        stats.headOnLossMps += before - after;
      } else {
        stats.kickerHits += 1;
        stats.kickerGainMps += after - before;
      }
    }
    bags = remaining;
  }

  function endZone(speedOutMps: number, outcome: GravityZoneUse['outcome']) {
    if (currentZone === undefined) return;
    // Only a lane that was entered at its near end, driving forward, has a "same entry state" to compare (DECISIONS 2026-10-16).
    const other = !zoneEnteredForward ? undefined : simulateOtherLane({ course, rover, constants: baseConstants, surfaces: specs, gravityMultipliers: run.gravityMultipliers, entry: zoneEntryState });
    stats.gravityZones.push({ kind: currentZone, speedInMps: zoneEntrySpeedMps, speedOutMps, outcome, ...(other ? { other } : {}) });
  }

  /** A run that ends inside a mud patch still counts the speed lost in it. */
  function closeOpenMud(speedMps: number) {
    if (currentSurfaceId !== 'mud') return;
    stats.mudPatches += 1;
    stats.mudLossMps += mudEntrySpeedMps - speedMps;
    currentSurfaceId = 'asphalt';
  }

  function onStep() {
    if (ended) return;
    if (stopAtStep !== undefined && state.stepCount >= stopAtStep) return;
    const prev = state;
    course.ensureAhead(prev.positionXM + GENERATE_AHEAD_M);
    const prevZone = course.gravityKindAt(prev.positionXM, prev.positionZM);

    // 2–3. Surface and gravity at the front, then the physics step.
    const surface = specs.get(course.surfaceIdAt(prev.positionXM, prev.positionZM))!;
    const held = input(prev.stepCount);
    const steer = held !== 0 ? held : returnToStraight(prev);
    steerSent.push(steer);
    // The keys go to step() as pressed. S at rest flips to reverse; in reverse S drives and W brakes (the physics decides).
    const keys = drive(prev.stepCount);
    driveSent.push({ throttleHeld: keys.throttleHeld, brakeHeld: keys.brakeHeld });
    // The brake pedal is S going forward and W in reverse; it counts as used only while the rover is rolling.
    if ((prev.direction === 'forward' ? keys.brakeHeld : keys.throttleHeld) && prev.speedMps > 0) stats.brakeUsed = true;
    const gStep = gravityAt(prevZone);
    const next = step(
      prev,
      { throttleHeld: keys.throttleHeld, brakeHeld: keys.brakeHeld, steer },
      rover,
      surface,
      { ...baseConstants, gravityMps2: gStep },
    );
    state = next;
    const t = next.timeS;

    // Drifting: the heading turned in step(); the travel direction follows the way the rover is driving, at most as fast
    // as the tyres can bend the path (ω = μ_g k_g g / v at the speed the step started with), and the step distance is
    // moved along it. At rest the limit is infinite, so it snaps. Sliding does not change the speed or the distance.
    const travelBefore = travelRad;
    const target = drivingAngle(next);
    const turnLimit = run.drift ? travelTurnLimitRadPerS(surface.grip, rover.gripFactor, gStep, prev.speedMps) : Infinity;
    travelRad = turnTravelDirection(travelRad, target, turnLimit, baseConstants.timeStepS);
    slideRad = slideAngleRad(travelRad, target);
    if (slideRad > 0) {
      const d = next.distanceM - prev.distanceM;
      state = { ...next, positionXM: prev.positionXM + d * Math.cos(travelRad), positionZM: prev.positionZM + d * Math.sin(travelRad) };
    }
    const sliding = slideRad >= SLIDE_MARK_RAD;

    // 4. Crash: a barrier, or a corner past the canyon wall. The step is undone (position, heading, distance) and v = 0.
    const hit = course.barrierHit(state.positionXM, state.positionZM, state.headingRad, footprint.lengthM, footprint.widthM);
    if (hit) {
      state = { ...next, positionXM: prev.positionXM, positionZM: prev.positionZM, headingRad: prev.headingRad, distanceM: prev.distanceM, speedMps: 0 };
      travelRad = travelBefore;
      slideRad = 0;
      endZone(prev.speedMps, 'crash');
      closeOpenMud(prev.speedMps);
      ended = {
        cause: 'crash', speedMps: prev.speedMps, obstacle: hit.kind, ...(hit.atDivider ? { atDivider: true } : {}), gravityKind: prevZone,
        ...(sliding ? { sliding: true } : {}),
      };
      record({ kind: 'crash', timeS: t, xM: state.positionXM, speedBeforeMps: prev.speedMps, speedAfterMps: 0 });
      return;
    }

    // 4b. The wall behind the start line: a step that moves the rover backward (x falls) and leaves a corner of the footprint
    // behind it is undone and v = 0. The run goes on (this is not a crash). Like the rocks, the whole pose is undone. Only a
    // step toward the wall counts, so a rover with its back to the wall can still turn and drive away: turning swings a
    // rear corner a few centimetres behind the line while the rover moves forward.
    if (
      state.positionXM < prev.positionXM &&
      footprintCorners(state.positionXM, state.positionZM, state.headingRad, footprint.lengthM, footprint.widthM).some((c) => c.xM < startWallXM)
    ) {
      state = { ...next, positionXM: prev.positionXM, positionZM: prev.positionZM, headingRad: prev.headingRad, distanceM: prev.distanceM, speedMps: 0 };
      travelRad = travelBefore;
      slideRad = 0;
    }

    // 5. Boost pads: each works once. The impulse J·|cos(heading)| goes along the way the rover is moving, so it always
    // speeds the rover up: u′ = u + J/m with u signed along the heading (negative in reverse).
    const pad = course.boostPadAt(state.positionXM, state.positionZM);
    if (pad && !usedPads.has(pad.id)) {
      usedPads.add(pad.id);
      const before = state.speedMps;
      const impulseNs = run.boostImpulseNs * Math.abs(Math.cos(state.headingRad));
      state = applyImpulse(state, rover.massKg, state.direction === 'forward' ? impulseNs : -impulseNs);
      record({
        kind: 'boost', timeS: t, xM: state.positionXM, speedBeforeMps: before, speedAfterMps: state.speedMps,
        massKg: rover.massKg, impulseNs,
      });
      stats.boosts += 1;
      stats.boostGainMps += state.speedMps - before;
    }

    // 6. Cannons: fire, move bags, hit.
    activateAndFire({ x: state.positionXM, z: state.positionZM }, t);
    moveBags(t);
    hitBags(t);

    // 7. Score and distance count only new ground (DECISIONS 2026-10-16): each step adds the ground beyond the furthest x
    // reached so far × (v̄ / v_max); v̄ is the mean of the start and end speeds, in either direction. Reverse adds nothing
    // by itself, and nor does driving back over old ground.
    const newGroundM = Math.max(0, state.positionXM - progressM);
    score += newGroundM * (((prev.speedMps + state.speedMps) / 2) / rover.topSpeedMps);
    progressM = Math.max(progressM, state.positionXM);
    stats.maxSpeedMps = Math.max(stats.maxSpeedMps, state.speedMps);

    // Events from changes of place and state.
    const surfaceId = course.surfaceIdAt(state.positionXM, state.positionZM);
    if (surfaceId !== currentSurfaceId) {
      if (currentSurfaceId === 'mud') {
        stats.mudPatches += 1;
        stats.mudLossMps += mudEntrySpeedMps - state.speedMps;
      }
      if (surfaceId === 'mud') mudEntrySpeedMps = state.speedMps;
      if (surfaceId === 'mud' || surfaceId === 'sand' || surfaceId === 'ice') {
        const zone = course.gravityKindAt(state.positionXM, state.positionZM);
        record({
          kind: surfaceId, timeS: t, xM: state.positionXM, surfaceId, frictionN: quantities(surfaceId, zone).rollingForceN,
          massKg: rover.massKg, gravityMps2: gravityAt(zone), surfaceRolling: specs.get(surfaceId)!.rollingFriction, wheelRolling: rover.rollingFactor,
        });
      }
      currentSurfaceId = surfaceId;
    }
    const zone = course.gravityKindAt(state.positionXM, state.positionZM);
    if (zone !== currentZone) {
      // A lane is "left" only through its far end (driving forward). Backing out of the near end records nothing.
      const movedForward = state.positionXM > prev.positionXM;
      if (movedForward) endZone(state.speedMps, 'out');
      currentZone = zone;
      zoneEntrySpeedMps = state.speedMps;
      zoneEntryState = state;
      zoneEnteredForward = movedForward;
      if (zone !== undefined) {
        const multiplier = run.gravityMultipliers[zone];
        record({ kind: 'gravity', timeS: t, xM: state.positionXM, gravityKind: zone, gravityMultiplier: multiplier, weightN: rover.massKg * gravityAt(zone),
          massKg: rover.massKg, gravityMps2: gravityAt(zone),
        });
      }
    }
    if (next.slipping && !wasSlipping) {
      record({
        kind: 'slip', timeS: t, xM: state.positionXM, gripN: quantities(surfaceId, zone).gripLimitN,
        massKg: rover.massKg, gravityMps2: gravityAt(zone), surfaceGrip: specs.get(surfaceId)!.grip, wheelGrip: rover.gripFactor,
      });
    }
    wasSlipping = next.slipping;
    if (sliding && !wasSliding) {
      record({
        kind: 'slide', timeS: t, xM: state.positionXM, slideSpeedMps: prev.speedMps, turnLimitRadPerS: turnLimit,
        massKg: rover.massKg, gravityMps2: gStep, surfaceGrip: surface.grip, wheelGrip: rover.gripFactor, turnRateDegPerS: baseConstants.turnRateDegPerS,
      });
    }
    wasSliding = sliding;
    const aboveTop = next.drivingState === 'Coasting' && next.throttleLevel > 0;
    if (aboveTop && !wasAboveTop) {
      record({
        kind: 'aboveTopSpeed', timeS: t, xM: state.positionXM, speedBeforeMps: state.speedMps,
        frictionN: quantities(surfaceId, zone).rollingForceN, massKg: rover.massKg,
      });
    }
    wasAboveTop = aboveTop;

    // 8. Stuck: the student holds full throttle, no brake, and the rover is still at rest: friction beats the motor (FR-8).
    // A rover that merely stopped (throttle level below 1) is not stuck: the student can still drive off.
    if (state.speedMps === 0 && state.throttleLevel === 1 && state.brakeLevel === 0 && state.drivingState === 'Stopped') {
      endZone(0, 'stuck');
      closeOpenMud(0);
      ended = { cause: 'stuck', speedMps: 0, gravityKind: zone };
      record({ kind: 'stuck', timeS: t, xM: state.positionXM, speedBeforeMps: 0, speedAfterMps: 0 });
    }
  }

  const loop = createFixedStepLoop(baseConstants.timeStepS, onStep);

  return {
    get state(): PhysicsState {
      return state;
    },
    course,
    rover,
    seed,
    get bags(): readonly Bag[] {
      return bags;
    },
    /** The steer input passed to step() at each step, in step order (the input record of this run). */
    get steerSent(): readonly (-1 | 0 | 1)[] {
      return steerSent;
    },
    /** The throttle and brake inputs passed to step() at each step, in step order. */
    get driveSent(): readonly DriveKeys[] {
      return driveSent;
    },
    get shots(): readonly Shot[] {
      return shots;
    },
    get score(): number {
      return score;
    },
    /** The way the rover is travelling, radians (physics axes). Equals the driving angle unless it slides; the camera follows it. */
    get travelRad(): number {
      return travelRad;
    },
    /** The angle between the travel direction and the way the rover is driving. At least 5° shows squeal and skid marks. */
    get slideAngleRad(): number {
      return slideRad;
    },
    /** The wall behind the start line (x, physics axes). */
    startWallXM,
    /** The largest x the front has reached (A6). */
    get progressM(): number {
      return progressM;
    },
    /** v / v_max, shown live as "×1.36". */
    get multiplier(): number {
      return state.speedMps / rover.topSpeedMps;
    },
    get ended(): RunEnd | undefined {
      return ended;
    },
    get events(): readonly RunEvent[] {
      return events;
    },
    get stats(): RunStats {
      return stats;
    },
    /** The gravity zone under the front right now (for the screen tint). */
    get gravityKind(): GravityKind | undefined {
      return course.gravityKindAt(state.positionXM, state.positionZM);
    },
    /** One step directly (tests); live play uses `advanceFrame`. */
    stepOnce: onStep,
    /** Runs the steps that fit in one frame. After the run ends no more steps run. Returns how many ran. */
    advanceFrame: (frameS: number) => loop.advance(frameS),
    reset() {
      state = start();
      ended = undefined;
      score = 0;
      progressM = state.positionXM;
      bags = [];
      events = [];
      shots = [];
      usedPads = new Set();
      cannonStates = new Map();
      stats = emptyStats();
      currentSurfaceId = 'asphalt';
      currentZone = undefined;
      zoneEntryState = state;
      wasSlipping = false;
      wasAboveTop = false;
      steerSent = [];
      driveSent = [];
      travelRad = drivingAngle(state);
      slideRad = 0;
      wasSliding = false;
      zoneEnteredForward = false;
    },
  };
}

export type RunSession = ReturnType<typeof createRunSession>;
