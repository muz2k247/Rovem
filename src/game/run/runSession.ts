import type { Content, GravityKind, EventKind } from '../../content/index.ts';
import { buildQuantities } from '../../physics/build.ts';
import { createFixedStepLoop } from '../../physics/loop.ts';
import { applyImpulse, shareMomentum } from '../../physics/momentum.ts';
import { createState, step, type PhysicsState } from '../../physics/step.ts';
import type { PhysicsConstants, RoverSpec, SurfaceSpec } from '../../physics/types.ts';
import { surfaceSpec } from '../buildFromParts.ts';
import { footprintOverlapsCircle } from '../geometry.ts';
import { createRunCourse, type RunCourse, type WorldCannon } from './course.ts';

// The run rules of the endless canyon (docs/DEMO_BUILD_PLAN.md A2, A4, A6). Game layer: no rendering, no React.
// The rover always drives: every step gets throttleHeld true, brakeHeld false. The student only steers.

/** What the student does at a given step number: steer left (+1), right (−1) or straight. */
export type RunInputProvider = (stepIndex: number) => -1 | 0 | 1;

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
}

export interface RunEnd {
  cause: 'crash' | 'stuck';
  /** Crash: the speed at the start of the step that crashed. Stuck: 0. */
  speedMps: number;
  obstacle?: 'barrier' | 'wall';
  /** The gravity zone the rover was in when it ended, if any. */
  gravityKind?: GravityKind;
}

export interface GravityZoneUse {
  kind: GravityKind;
  speedInMps: number;
  speedOutMps: number;
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
  input: RunInputProvider;
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
  const run = content.run;
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
  let mudEntrySpeedMps = 0;
  let wasSlipping = false;
  let wasAboveTop = false;

  function emptyStats(): RunStats {
    return {
      mudLossMps: 0, mudPatches: 0, boostGainMps: 0, boosts: 0, headOnLossMps: 0, headOnHits: 0,
      kickerGainMps: 0, kickerHits: 0, gravityZones: [], maxSpeedMps: 0,
    };
  }

  const gravityAt = (zone: GravityKind | undefined): number =>
    zone === undefined ? constants.gravityMps2 : constants.gravityMps2 * run.gravityMultipliers[zone];

  const record = (event: RunEvent) => events.push(event);

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
      state = shareMomentum(state, rover.massKg, bagSpec.massKg, bagSpeed * Math.cos(state.headingRad));
      const after = state.speedMps;
      record({ kind: bag.kind === 'headOn' ? 'headOnHit' : 'kickerHit', timeS: t, xM: state.positionXM, speedBeforeMps: before, speedAfterMps: after });
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

  function endZone(speedOutMps: number) {
    if (currentZone !== undefined) stats.gravityZones.push({ kind: currentZone, speedInMps: zoneEntrySpeedMps, speedOutMps });
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
    const prevZone = course.gravityKindAt(prev.positionXM, prev.positionZM);
    course.ensureAhead(prev.positionXM + GENERATE_AHEAD_M);

    // 2–3. Surface and gravity at the front, then the physics step.
    const surface = specs.get(course.surfaceIdAt(prev.positionXM, prev.positionZM))!;
    const next = step(
      prev,
      { throttleHeld: true, brakeHeld: false, steer: input(prev.stepCount) },
      rover,
      surface,
      { ...constants, gravityMps2: gravityAt(prevZone) },
    );
    state = next;
    const t = next.timeS;

    // 4. Crash: a barrier, or a corner past the canyon wall. The step is undone (position, heading, distance) and v = 0.
    const hit = course.barrierHit(next.positionXM, next.positionZM, next.headingRad, footprint.lengthM, footprint.widthM);
    if (hit) {
      state = { ...next, positionXM: prev.positionXM, positionZM: prev.positionZM, headingRad: prev.headingRad, distanceM: prev.distanceM, speedMps: 0 };
      endZone(prev.speedMps);
      closeOpenMud(prev.speedMps);
      ended = { cause: 'crash', speedMps: prev.speedMps, obstacle: hit.kind, gravityKind: prevZone };
      record({ kind: 'crash', timeS: t, xM: state.positionXM, speedBeforeMps: prev.speedMps, speedAfterMps: 0 });
      return;
    }

    // 5. Boost pads: each works once. Impulse J·cos(heading) along the heading: u′ = u + J/m.
    const pad = course.boostPadAt(state.positionXM, state.positionZM);
    if (pad && !usedPads.has(pad.id)) {
      usedPads.add(pad.id);
      const before = state.speedMps;
      state = applyImpulse(state, rover.massKg, run.boostImpulseNs * Math.cos(state.headingRad));
      record({ kind: 'boost', timeS: t, xM: state.positionXM, speedBeforeMps: before, speedAfterMps: state.speedMps });
      stats.boosts += 1;
      stats.boostGainMps += state.speedMps - before;
    }

    // 6. Cannons: fire, move bags, hit.
    activateAndFire({ x: state.positionXM, z: state.positionZM }, t);
    moveBags(t);
    hitBags(t);

    // 7. Score and distance. Each step adds max(0, Δx) × (v̄ / v_max); v̄ is the mean of the start and end speeds.
    const dx = state.positionXM - prev.positionXM;
    score += Math.max(0, dx) * (((prev.speedMps + state.speedMps) / 2) / rover.topSpeedMps);
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
        record({ kind: surfaceId, timeS: t, xM: state.positionXM, surfaceId, frictionN: quantities(surfaceId, zone).rollingForceN });
      }
      currentSurfaceId = surfaceId;
    }
    const zone = course.gravityKindAt(state.positionXM, state.positionZM);
    if (zone !== currentZone) {
      endZone(state.speedMps);
      currentZone = zone;
      zoneEntrySpeedMps = state.speedMps;
      if (zone !== undefined) {
        const multiplier = run.gravityMultipliers[zone];
        record({ kind: 'gravity', timeS: t, xM: state.positionXM, gravityKind: zone, gravityMultiplier: multiplier, weightN: rover.massKg * gravityAt(zone) });
      }
    }
    if (next.slipping && !wasSlipping) {
      record({ kind: 'slip', timeS: t, xM: state.positionXM, gripN: quantities(surfaceId, zone).gripLimitN });
    }
    wasSlipping = next.slipping;
    const aboveTop = next.drivingState === 'Coasting' && next.throttleLevel > 0;
    if (aboveTop && !wasAboveTop) record({ kind: 'aboveTopSpeed', timeS: t, xM: state.positionXM, speedBeforeMps: state.speedMps });
    wasAboveTop = aboveTop;

    // 8. Stuck: the motor at full strength, no brake, and still at rest: friction beats the motor (FR-8).
    if (state.speedMps === 0 && state.throttleLevel === 1 && state.brakeLevel === 0 && state.drivingState === 'Stopped') {
      endZone(0);
      closeOpenMud(0);
      ended = { cause: 'stuck', speedMps: 0, gravityKind: zone };
      record({ kind: 'stuck', timeS: t, xM: state.positionXM, speedBeforeMps: 0, speedAfterMps: 0 });
    }
  }

  const loop = createFixedStepLoop(constants.timeStepS, onStep);

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
    get shots(): readonly Shot[] {
      return shots;
    },
    get score(): number {
      return score;
    },
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
      wasSlipping = false;
      wasAboveTop = false;
    },
  };
}

export type RunSession = ReturnType<typeof createRunSession>;
