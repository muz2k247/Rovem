import type { Content, GravityKind, EventKind } from '../../content/index.ts';
import { buildQuantities } from '../../physics/build.ts';
import { createFixedStepLoop } from '../../physics/loop.ts';
import { movingIntoEdge, scrapeAlongEdge, type EdgeContact } from '../../physics/collision.ts';
import { applyImpulse, shareMomentumVectors } from '../../physics/momentum.ts';
import { createState, step, type PhysicsState } from '../../physics/step.ts';
import type { PhysicsConstants, RoverSpec, SurfaceSpec } from '../../physics/types.ts';
import { surfaceSpec } from '../buildFromParts.ts';
import { footprintCorners, footprintOverlapsCircle } from '../geometry.ts';
import { SLIDE_MARK_RAD, slideAngleRad, travelTurnLimitRadPerS, turnTravelDirection, wrapAngle } from './drift.ts';
import { bagVelocity, crossingTimes, launcherDirectionRad, launcherShouldFire } from '../launchers.ts';
import { createRunCourse, type CourseChunk, type RunCourse, type WorldCannon } from './course.ts';
import { simulateOtherLane, type LaneResult } from './tunnelCompare.ts';

// The run rules of the endless canyon (docs/DEMO_BUILD_PLAN.md A2, A4, A6). Game layer: no rendering, no React.
// The student drives (DECISIONS 2026-10-16): the throttle, brake and steer keys are read each step. The run starts at
// rest with the throttle level 0. Reverse works as the physics does (S at rest flips the direction; in reverse S drives
// and W brakes); the keys are passed through as pressed. The physics is unchanged.
// Reverse and drifting (DECISIONS 2026-10-16, demo only): the game layer passes the reverse top speed from run.json, keeps
// a travel direction separate from the heading, and puts a wall behind the start line.
// Walls scrape and obstacles end the run (Physics Model Specification 11.2, E46; SHOWCASE_PLAN P2).
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

export type RunEventKind = EventKind | 'crash' | 'stuck' | 'scrape';

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
  /** A scrape: the angle between the way the rover was going and the wall, 0 to 90°. Speeds are in speedBeforeMps and speedAfterMps. */
  angleDeg?: number;
}

export interface RunEnd {
  cause: 'crash' | 'stuck';
  /** Crash: the speed at the start of the step that crashed. Stuck: 0. */
  speedMps: number;
  /** What ended the run. A canyon wall never does: the rover scrapes along it (E46). */
  obstacle?: 'barrier';
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
  /** The way the bag flies, and how fast (R11: across the corridor at an angle). */
  dirRad: number;
  speedMps: number;
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

/** A launcher wakes when the rover comes near (its lamp charges) and then fires once, aimed (launchers.ts). */
interface CannonState {
  cannon: WorldCannon;
  activatedAtS: number;
  firedAtS: number | undefined;
}

/** How far ahead the course is always generated (A3). */
export const GENERATE_AHEAD_M = 400;
/** A rover scraping a wall is placed this far inside it, so it does not touch it again at once. */
const WALL_CLEARANCE_M = 0.002;
const WALL_PUSH_TRIES = 8;

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
  /** When the last launcher hit landed: a bag that arrives within `minHitGapS` of it does nothing. */
  let lastHitS = -Infinity;
  /** The side of the screen a kicker's warning shows on while one is about to fire or its bag flies (R11); null when none is. */
  let launcherWarning: 'left' | 'right' | null = null;
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
  let wasScraping = false;

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


  const record = (event: RunEvent) => {
    events.push(event);
    if (event.kind !== 'crash' && event.kind !== 'stuck' && event.kind !== 'scrape') stats.firstEvents[event.kind] ??= event;
  };

  /** Recomputed from the build for the surface and gravity in force (for the captions). */
  const quantities = (surfaceId: string, zone: GravityKind | undefined) =>
    buildQuantities(rover, specs.get(surfaceId)!, { gravityMps2: gravityAt(zone) });

  // Roadside launchers (R11, DECISIONS 2026-10-26 (5)): they stand at the corridor edges and fire across it at angleDeg to the road (the x
  // axis). One shot each, aimed so the bag meets the rover where their paths cross if the rover keeps its velocity (launchers.ts).
  const bagAngleRad = (bagSpec.angleDeg * Math.PI) / 180;
  const bagSpeedOf = (kind: 'headOn' | 'kicker') => (kind === 'headOn' ? bagSpec.headOnSpeedMps : bagSpec.kickerSpeedMps);
  const roverVelocity = () => ({ x: state.speedMps * Math.cos(travelRad), z: state.speedMps * Math.sin(travelRad) });

  function activateAndFire(front: { x: number; z: number }, t: number) {
    // Launchers near the rover that have not woken yet. A kicker may be a little behind: it fires once the rover has gone by.
    for (const cannon of course.cannonsInRange(front.x - 40, front.x + bagSpec.headOnTriggerDistanceM + 5)) {
      if (cannonStates.has(cannon.id)) continue;
      const wake = cannon.kind === 'headOn' ? cannon.xM - bagSpec.headOnTriggerDistanceM : cannon.xM + bagSpec.kickerWakeRearOffsetM + footprint.lengthM;
      if (front.x >= wake) cannonStates.set(cannon.id, { cannon, activatedAtS: t, firedAtS: undefined });
    }
    const v = roverVelocity();

    // A kicker warns before it fires: an edge marker on its side, and the screen plays a beep when the warning starts. It stays until its bag has gone.
    let alert: 'left' | 'right' | null = null;
    const sideOf = (cannon: WorldCannon) =>
      -Math.sin(state.headingRad) * (cannon.xM - front.x) + Math.cos(state.headingRad) * (cannon.zM - front.z) > 0 ? ('left' as const) : ('right' as const);
    for (const cannon of course.cannonsInRange(front.x - 40, front.x + bagSpec.kickerWarnM + 5)) {
      if (cannon.kind !== 'kicker' || cannonStates.get(cannon.id)?.firedAtS !== undefined) continue;
      if (front.x < cannon.xM && Math.hypot(cannon.xM - front.x, cannon.zM - front.z) <= bagSpec.kickerWarnM && v.x > 0) alert = sideOf(cannon);
    }

    for (const cs of cannonStates.values()) {
      const { cannon } = cs;
      if (cs.firedAtS !== undefined) continue;
      const dirRad = launcherDirectionRad(cannon.kind, 0, cannon.zM, bagAngleRad);
      const speedMps = bagSpeedOf(cannon.kind);
      const launcher = { position: { x: cannon.xM, z: cannon.zM }, velocity: bagVelocity(dirRad, speedMps) };
      if (cannon.kind === 'kicker' && front.x < cannon.xM) continue; // from behind: after the rover has gone by
      if (!launcherShouldFire(launcher, front, v, bagSpec.minAimSpeedMps)) continue;
      const cross = crossingTimes(launcher, front, v)!;
      if (cross.bagS * speedMps > bagSpec.rangeM) continue;
      // Never across ice: a shove there cannot be steered out of.
      if (course.surfaceIdAt(cannon.xM + launcher.velocity.x * cross.bagS, cannon.zM + launcher.velocity.z * cross.bagS) === 'ice') continue;
      cs.firedAtS = t;
      bags.push({ id: `${cannon.id}#0`, cannonId: cannon.id, kind: cannon.kind, firedAtS: t, xM: cannon.xM, zM: cannon.zM, dirRad, speedMps });
      shots.push({ cannonId: cannon.id, timeS: t });
    }
    // Its bag in flight: the marker stays until the bag has gone by the rover's front.
    for (const bag of bags) {
      if (bag.kind === 'kicker' && bag.xM < front.x + footprint.lengthM) alert = sideOf(cannonStates.get(bag.cannonId)!.cannon);
    }
    launcherWarning = alert;
  }

  function moveBags(t: number) {
    const kept: Bag[] = [];
    for (const bag of bags) {
      const cannon = cannonStates.get(bag.cannonId)!.cannon;
      const travelled = bag.speedMps * (t - bag.firedAtS);
      if (travelled >= bagSpec.rangeM) continue;
      bag.xM = cannon.xM + travelled * Math.cos(bag.dirRad);
      bag.zM = cannon.zM + travelled * Math.sin(bag.dirRad);
      kept.push(bag);
    }
    bags = kept;
  }

  /** (m₁ + m₂) v′ = m₁ v₁ + m₂ v₂ with arrows (momentum.ts); the numbers on screen are the ones along the heading. */
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
      if (t - lastHitS < bagSpec.minHitGapS) continue; // hits at least minHitGapS apart: this bag is spent
      lastHitS = t;
      const hx = Math.cos(state.headingRad);
      const hz = Math.sin(state.headingRad);
      const along = (w: { x: number; z: number }) => w.x * hx + w.z * hz;
      const before = state.speedMps;
      const v1 = roverVelocity();
      const v2 = bagVelocity(bag.dirRad, bag.speedMps);
      const v3 = shareMomentumVectors(rover.massKg, v1, bagSpec.massKg, v2);
      const u3 = along(v3);
      const speedAfter = Math.hypot(v3.x, v3.z);
      state = { ...state, speedMps: speedAfter, direction: u3 > 0 ? 'forward' : u3 < 0 ? 'reverse' : state.direction };
      if (speedAfter > 0) travelRad = Math.atan2(v3.z, v3.x);
      const after = state.speedMps;
      record({
        kind: bag.kind === 'headOn' ? 'headOnHit' : 'kickerHit', timeS: t, xM: state.positionXM, speedBeforeMps: before, speedAfterMps: after,
        massKg: rover.massKg, otherMassKg: bagSpec.massKg, roverVelocityMps: along(v1), otherVelocityMps: along(v2), resultVelocityMps: u3,
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

  /**
   * The rover's corner is past the canyon wall. Its velocity into the wall is removed and the rest kept (collision.ts: v′ = v cos α);
   * the heading turns along the wall, and the rover is placed back against it. Returns false if no place against the wall was found.
   */
  function scrapeAgainstWall(contact: EdgeContact, motion: 1 | -1): boolean {
    const speedBeforeMps = state.speedMps;
    let speedMps = speedBeforeMps;
    let alphaRad = 0;
    let headingRad = state.headingRad;
    let newTravelRad = travelRad;
    if (movingIntoEdge(travelRad, contact.outwardRad)) {
      const scrape = scrapeAlongEdge(travelRad, speedBeforeMps, contact.edgeRad);
      speedMps = scrape.speedMps;
      alphaRad = scrape.alphaRad;
      if (speedMps > 0) {
        newTravelRad = wrapAngle(scrape.directionRad);
        headingRad = wrapAngle(scrape.directionRad + (motion === 1 ? 0 : Math.PI));
      }
    }
    let c = contact;
    let x = state.positionXM;
    let z = state.positionZM;
    for (let i = 0; i < WALL_PUSH_TRIES; i++) {
      x -= Math.cos(c.outwardRad) * (c.depthM + WALL_CLEARANCE_M);
      z -= Math.sin(c.outwardRad) * (c.depthM + WALL_CLEARANCE_M);
      const again = course.barrierHit(x, z, headingRad, footprint.lengthM, footprint.widthM);
      if (again?.kind === 'barrier') return false;
      if (!again) {
        state = { ...state, positionXM: x, positionZM: z, headingRad, speedMps };
        travelRad = newTravelRad;
        // One event for each contact, not one for each step spent against the wall.
        if (!wasScraping && speedBeforeMps > 0) {
          record({ kind: 'scrape', timeS: state.timeS, xM: x, speedBeforeMps, speedAfterMps: speedMps, angleDeg: (alphaRad * 180) / Math.PI });
        }
        wasScraping = true;
        return true;
      }
      c = again.contact;
    }
    return false;
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

    // 4. Crash: a barrier. The step is undone (position, heading, distance) and v = 0, and the run ends.
    // A corner past the canyon wall is not a crash: the rover is placed against the wall and scrapes along it.
    let hit = course.barrierHit(state.positionXM, state.positionZM, state.headingRad, footprint.lengthM, footprint.widthM);
    if (hit?.kind !== 'wall') wasScraping = false;
    if (hit?.kind === 'wall') {
      // No place against the wall was found: the step is undone and v = 0, as in a level (not a crash).
      if (!scrapeAgainstWall(hit.contact, state.direction === 'forward' ? 1 : -1)) {
        state = { ...next, positionXM: prev.positionXM, positionZM: prev.positionZM, headingRad: prev.headingRad, distanceM: prev.distanceM, speedMps: 0 };
        travelRad = travelBefore;
      }
      slideRad = 0;
      hit = undefined;
    }
    if (hit?.kind === 'barrier') {
      wasScraping = false;
      state = { ...next, positionXM: prev.positionXM, positionZM: prev.positionZM, headingRad: prev.headingRad, distanceM: prev.distanceM, speedMps: 0 };
      travelRad = travelBefore;
      slideRad = 0;
      endZone(prev.speedMps, 'crash');
      closeOpenMud(prev.speedMps);
      ended = {
        cause: 'crash', speedMps: prev.speedMps, obstacle: 'barrier', ...(hit.atDivider ? { atDivider: true } : {}), gravityKind: prevZone,
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
          kind: surfaceId, timeS: t, xM: state.positionXM, surfaceId, frictionN: quantities(surfaceId, zone).rollingForceN, gripN: quantities(surfaceId, zone).gripLimitN,
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
    /** The section (the named place) under the rover's front: its name is on the entry post and in the HUD. */
    get section(): CourseChunk {
      course.ensureAhead(state.positionXM + GENERATE_AHEAD_M);
      return course.sectionAt(state.positionXM) ?? course.chunks[course.chunks.length - 1]!;
    },
    /** A kicker is about to fire from behind, or its bag flies: the side its edge marker shows on (R11). */
    get launcherWarning(): 'left' | 'right' | null {
      return launcherWarning;
    },
    /** Has this cannon woken (its trigger was reached)? An awake cannon charges: the scene shows it. */
    cannonAwake: (id: string): boolean => cannonStates.has(id),
    /** Developer tool (`?dev=1`): put the rover at x (on the middle line unless `zM` says otherwise), moving at a speed, as if it had driven there. */
    devSkipTo(xM: number, speedMps: number, zM = 0) {
      course.ensureAhead(xM + GENERATE_AHEAD_M);
      state = { ...state, positionXM: xM, positionZM: zM, headingRad: 0, speedMps, throttleLevel: speedMps > 0 ? 1 : 0, direction: 'forward', distanceM: Math.max(state.distanceM, xM) };
      travelRad = 0;
      slideRad = 0;
      progressM = Math.max(progressM, xM);
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
      lastHitS = -Infinity;
      launcherWarning = null;
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
      wasScraping = false;
    },
  };
}

export type RunSession = ReturnType<typeof createRunSession>;
