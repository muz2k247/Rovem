import type { Content, GravityKind } from '../../content/index.ts';
import { levelsConfig } from '../../content/levelsConfig.ts';
import { buildQuantities } from '../../physics/build.ts';
import { createFixedStepLoop } from '../../physics/loop.ts';
import { magnetOnRover } from '../../physics/magnet.ts';
import { shareMomentum } from '../../physics/momentum.ts';
import { createState, motionSign, step, type PhysicsState } from '../../physics/step.ts';
import type { PhysicsConstants, RoverSpec, SurfaceSpec } from '../../physics/types.ts';
import { slopePullN } from '../../physics/ground.ts';
import { floats, upthrustN, waterDragNsPerM } from '../../physics/water.ts';
import { surfaceSpec } from '../buildFromParts.ts';
import type { ForceArrow, HudModel, MagnetPole, ReportModel } from '../contracts.ts';
import { footprintOverlapsCircle, pointAlongPath } from '../geometry.ts';
import {
  SLIDE_MARK_RAD, sidewaysBendRadPerS, slideAngleRad, travelTurnLimitFromNormalRadPerS, turnTravelDirection, wrapAngle,
} from '../run/drift.ts';
import { selectArrows, worldDirection } from './arrows.ts';
import { createCaptionQueue } from './captions.ts';
import { createForceLine, type ForceTerm } from './forceLine.ts';
import { buildLevelReport } from './report.ts';
import { fill, levelText, newtons, twoDecimals, type TokenValues } from './text.ts';
import type { HintDef, LevelDef, StopLineDef } from './types.ts';
import { createLevelWorld, type LevelWorld } from './world.ts';

// The level engine (LEVELS_BUILD_PLAN A2, A4, A7): one session is one attempt at one level. Game layer: no rendering,
// no React. It calls the same physics functions as the run (FR-3), adds the ground (slope, water, gravity zones, magnets)
// and keeps the rules (checkpoints, samples, stop lines, forks, stars). The HUD and report models are made from it.

const DEG = Math.PI / 180;
const SPEED_TRACE_STEP_S = 0.1;

/** What the student does at a step: the pedals and the steering. */
export interface LevelInput {
  throttleHeld: boolean;
  brakeHeld: boolean;
  steer: -1 | 0 | 1;
}

export interface DriveContext {
  stepIndex: number;
  clockS: number;
  state: PhysicsState;
  travelRad: number;
}
export type LevelDrive = (ctx: DriveContext) => LevelInput;

/** Set to ask "what would this road have taken?": a session that drives one road of a fork to its merge point, for the other-road time. */
export interface WhatIfOptions {
  roadId: string;
  mergeAt: { xM: number; zM: number; radiusM: number };
}

export interface LevelSessionOptions {
  content: Content;
  def: LevelDef;
  rover: RoverSpec;
  constants: PhysicsConstants;
  drive: LevelDrive;
  /** Test hook: start from a different state (already fast, already in water ...). */
  initialState?: Partial<PhysicsState>;
  whatIf?: WhatIfOptions;
}

export type LevelPhase = 'driving' | 'held' | 'respawning' | 'finished' | 'ended';
export type RespawnCause = 'crash' | 'stuck' | 'floated' | 'manual';
export type WhatIfOutcome = 'merged' | 'wall' | 'barrier' | 'stuck' | 'floated' | 'timeout';

export type LevelEventKind =
  | 'surface' | 'slip' | 'boost' | 'hit' | 'gravity' | 'slope' | 'descent' | 'rollback' | 'slide' | 'water' | 'float'
  | 'magnet' | 'pole' | 'sample' | 'checkpoint' | 'respawn' | 'fork' | 'stopLine' | 'finish';

/** Something that happened, with the numbers that changed. Captions and the report are made from these. */
export interface LevelEvent {
  kind: LevelEventKind;
  timeS: number;
  xM: number;
  zM: number;
  cause?: RespawnCause;
  obstacle?: 'wall' | 'barrier';
  surfaceId?: string;
  mu?: number;
  k?: number;
  normalN?: number;
  frictionN?: number;
  asphaltN?: number;
  gripN?: number;
  askN?: number;
  impulseNs?: number;
  massKg?: number;
  speedBeforeMps?: number;
  speedAfterMps?: number;
  hitKind?: 'headOn' | 'kicker';
  bagKg?: number;
  u1?: number;
  u2?: number;
  u3?: number;
  gMps2?: number;
  gravityKind?: GravityKind;
  weightN?: number;
  dropM?: number;
  energyJ?: number;
  pullN?: number;
  holdN?: number;
  angleDeg?: number;
  radiusM?: number;
  needN?: number;
  speedMps?: number;
  upN?: number;
  volM3?: number;
  depthM?: number;
  forceN?: number;
  distM?: number;
  attract?: boolean;
  pole?: MagnetPole;
  n?: number;
  sampleId?: string;
  checkpointId?: string;
  yourRoad?: string;
  otherRoad?: string;
  yourS?: number;
  otherS?: number;
  otherOutcome?: WhatIfOutcome;
}

export interface LevelResult {
  timeS: number;
  /** Beacon reached, all 3 samples, par time beaten (A2). */
  starFlags: [boolean, boolean, boolean];
  stars: 0 | 1 | 2 | 3;
}

interface Bag {
  id: string;
  cannonId: string;
  kind: 'headOn' | 'kicker';
  firedAtS: number;
  xM: number;
  zM: number;
  dirRad: number;
}

interface CannonState {
  activatedAtS: number;
  shots: number;
}

interface ForkState {
  startClockS: number | undefined;
  votes: Record<string, number>;
  done: boolean;
}

interface HintState {
  def: HintDef;
  shown: boolean;
  done: boolean;
}

/** What the last driving step worked out, for the HUD (arrows and the F = ma line). */
interface Snapshot {
  gearRad: number;
  /** +1, or −1 while the rover rolls back: the sign from a force along the gear to a force along the motion. */
  vsGear: 1 | -1;
  gMps2: number;
  normalN: number;
  frictionN: number;
  gripN: number;
  driveN: number;
  brakeN: number;
  slopeGearRad: number;
  /** Pushes the rover along its gear: −m g sin θ (negative when the gear points uphill). */
  slopePushN: number;
  dragN: number;
  upN: number;
  magnetAlongN: number;
  magnetVector: { x: number; z: number } | undefined;
  zone: GravityKind | undefined;
  inWater: boolean;
  curve: { radiusM: number; turn: 1 | -1 } | undefined;
}

const capitalise = (s: string) => (s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1));

export function createLevelSession(options: LevelSessionOptions) {
  const { content, def, rover, constants, drive, whatIf } = options;
  const cfg = levelsConfig;
  const run = content.run;
  const world: LevelWorld = createLevelWorld(def, content);
  const specs = new Map<string, SurfaceSpec>(content.surfaces.map((s) => [s.id, surfaceSpec(content, s.id)]));
  const baseConstants: PhysicsConstants = { ...constants, reverseTopSpeedFraction: run.reverseTopSpeedFactor };
  const dtS = baseConstants.timeStepS;
  const footprint = world.footprint;
  const turnRadPerS = (baseConstants.turnRateDegPerS * Math.PI) / 180;
  const bagSpec = run.sandbag;
  const hasPylons = def.pylons.length > 0;
  const maxDepthM = Math.max(...cfg.water.depthsM);
  const traceEvery = Math.round(SPEED_TRACE_STEP_S / dtS);
  const quiet = whatIf !== undefined; // a what-if drive keeps no captions, hints, samples or forks

  const startHeadingRad = def.start.headingDeg * DEG;
  const startState = (): PhysicsState =>
    createState({ positionXM: def.start.xM, positionZM: def.start.zM, headingRad: startHeadingRad, ...options.initialState });

  // --- session state ---
  let state = startState();
  let travelRad = startHeadingRad;
  let slideRad = 0;
  let wasSliding = false;
  let clockStep = 0;
  let stepIndex = 0;
  let phase: LevelPhase = 'driving';
  let respawnAtS = 0;
  let manualRespawn = false;
  let holdUntilS = 0;
  let lastCheckpoint = -1;
  let collected: string[] = [];
  let result: LevelResult | undefined;
  let whatIfEnd: { outcome: WhatIfOutcome; timeS: number } | undefined;
  let pole: MagnetPole = cfg.magnet.startPole;
  let events: LevelEvent[] = [];
  let trace: { timeS: number; speedMps: number }[] = [];
  let usedPads = new Set<string>();
  let cannonStates = new Map<string, CannonState>();
  let bags: Bag[] = [];
  let stopPassed = new Set<string>();
  let forks = new Map<string, ForkState>();
  let signsShown = new Set<string>();
  let hints: HintState[] = [];
  let currentSurfaceId = 'asphalt';
  let currentZone: GravityKind | undefined;
  let wasSlipping = false;
  let wasRollingBack = false;
  let wasInWater = false;
  let wasFloating = false;
  let deepShown = false;
  let steepNow = false;
  let descent: { startHeightM: number; startSpeedMps: number } | undefined;
  let pylonModes = new Map<string, 'attract' | 'repel' | 'none'>();
  let flashUntilS = 0;
  let flash: ForceArrow | undefined;
  let releasedSinceS: number | undefined;
  let snap: Snapshot | undefined;
  let captionNow: HudModel['caption'] = null;
  let keys: LevelInput = { throttleHeld: false, brakeHeld: false, steer: 0 };
  const queue = createCaptionQueue({ minShowS: cfg.captions.minShowS, showS: cfg.rules.captionShowS });
  const forceLine = createForceLine();

  const clockS = () => clockStep * dtS;
  const gearAngle = (s: PhysicsState) => (s.direction === 'forward' ? s.headingRad : s.headingRad + Math.PI);
  /** The front of the footprint is the physics position; the centre is half a rover length behind it. */
  const centreOf = (s: PhysicsState) => ({
    x: s.positionXM - (Math.cos(s.headingRad) * footprint.lengthM) / 2,
    z: s.positionZM - (Math.sin(s.headingRad) * footprint.lengthM) / 2,
  });
  const gravityAt = (kind: GravityKind | undefined) => baseConstants.gravityMps2 * (kind === undefined ? 1 : world.multiplierOf(kind));
  const roadName = (id: string) => capitalise(world.roadById(id).def.name ?? id);
  const pylonIsOn = (p: LevelDef['pylons'][number], atS: number): boolean => {
    if (!p.switching) return true;
    const cycle = cfg.magnet.cycleOnS + cfg.magnet.cycleOffS;
    return (((atS + p.switching.phaseS) % cycle) + cycle) % cycle < cfg.magnet.cycleOnS;
  };

  function emit(e: Omit<LevelEvent, 'timeS' | 'xM' | 'zM'> & Partial<Pick<LevelEvent, 'xM' | 'zM'>>): LevelEvent {
    const event: LevelEvent = { timeS: clockS(), xM: state.positionXM, zM: state.positionZM, ...e };
    events.push(event);
    return event;
  }

  function say(id: string, values: TokenValues, urgent = false, isDone?: () => boolean) {
    if (quiet) return;
    const text = levelText.captions[id];
    if (!text) throw new Error(`Level text: no caption "${id}"`);
    queue.push({ title: fill(text.title, values), line: fill(text.line, values), ...(urgent ? { urgent } : {}), ...(isDone ? { isDone } : {}) }, clockS());
  }

  /** Sets the rover's velocity along its heading to u. The gear is kept: a rover thrown against its gear is rolling back. */
  function withVelocityAlongHeading(s: PhysicsState, u: number): PhysicsState {
    const speedMps = Math.abs(u);
    const rollingBack = speedMps > 0 && u > 0 === (s.direction === 'reverse');
    return { ...s, speedMps, rollingBack };
  }
  const alongHeading = (s: PhysicsState) => {
    // Moving along the heading: forward gear and not rolling back, or reverse gear and rolling back.
    const along = (s.direction === 'forward') !== s.rollingBack;
    return along ? s.speedMps : -s.speedMps;
  };

  // --- starting a try, and coming back from a crash ---

  function placeAt(pose: { xM: number; zM: number; headingDeg: number }) {
    state = createState({ positionXM: pose.xM, positionZM: pose.zM, headingRad: pose.headingDeg * DEG });
    travelRad = state.headingRad;
    slideRad = 0;
    wasSliding = false;
    wasSlipping = false;
    wasRollingBack = false;
    wasInWater = false;
    wasFloating = false;
    steepNow = false;
    descent = undefined;
    releasedSinceS = undefined;
    usedPads = new Set();
    cannonStates = new Map();
    bags = [];
    stopPassed = new Set();
    signsShown = new Set();
    pylonModes = new Map();
    flash = undefined;
    flashUntilS = 0;
    snap = undefined;
    forceLine.reset();
    // An unfinished fork starts again from its stop line; a finished one stays finished.
    for (const f of forks.values()) if (!f.done) f.startClockS = undefined;
    for (const f of forks.values()) if (!f.done) for (const k of Object.keys(f.votes)) f.votes[k] = 0;
    currentSurfaceId = world.surfaceIdAt(state.positionXM, state.positionZM);
    currentZone = world.gravityKindAt(centreOf(state).x, centreOf(state).z);
  }

  function respawnNow(cause: RespawnCause) {
    const cp = lastCheckpoint >= 0 ? def.checkpoints[lastCheckpoint]! : undefined;
    placeAt(cp ?? def.start);
    phase = 'driving';
    if (cause === 'manual') emit({ kind: 'respawn', cause });
  }

  function scheduleRespawn(cause: Exclude<RespawnCause, 'manual'>, obstacle?: 'wall' | 'barrier') {
    if (whatIf) {
      whatIfEnd = { outcome: cause === 'crash' ? (obstacle ?? 'wall') : cause, timeS: clockS() };
      phase = 'ended';
      return;
    }
    phase = 'respawning';
    respawnAtS = clockS() + cfg.rules.crashMomentS;
    emit({ kind: 'respawn', cause, ...(obstacle ? { obstacle } : {}) });
    say(cause, {}, true);
  }

  // --- hints (First Tracks) ---

  function hintTriggered(h: HintState, front: { x: number; z: number }): boolean {
    const t = h.def.trigger;
    if (t.kind === 'start') return true;
    if (t.kind === 'zone') return Math.hypot(front.x - t.xM, front.z - t.zM) <= t.radiusM;
    // coast: the student has been going and let go of the throttle for a moment
    return releasedSinceS !== undefined && clockS() - releasedSinceS >= 0.3 && state.speedMps >= cfg.rules.coastHintMinMps;
  }

  const hintDone = (h: HintDef): boolean => {
    switch (h.doneWhen) {
      case 'throttle': return keys.throttleHeld;
      case 'release': return !keys.throttleHeld;
      case 'steer': return keys.steer !== 0;
      case 'brake': return keys.brakeHeld;
    }
  };

  function updateHints(front: { x: number; z: number }) {
    if (quiet) return;
    if (keys.throttleHeld) releasedSinceS = undefined;
    else if (state.speedMps >= cfg.rules.coastHintMinMps) releasedSinceS ??= clockS();
    else releasedSinceS = undefined;
    for (const h of hints) {
      if (h.shown || !hintTriggered(h, front)) continue;
      h.shown = true;
      const startedS = clockS();
      const maxS = h.def.maxS ?? cfg.rules.hintMaxS;
      const text = levelText.hints[h.def.textId];
      if (!text) throw new Error(`Level text: no hint "${h.def.textId}"`);
      queue.push({ title: 'Controls', line: text, isDone: () => hintDone(h.def) || clockS() - startedS >= maxS }, clockS());
    }
  }

  // --- forks and stop lines ---

  function crossedStopLine(line: StopLineDef, prev: { x: number; z: number }, now: { x: number; z: number }): boolean {
    const a = line.headingDeg * DEG;
    const nx = Math.cos(a);
    const nz = Math.sin(a);
    const before = (prev.x - line.xM) * nx + (prev.z - line.zM) * nz;
    const after = (now.x - line.xM) * nx + (now.z - line.zM) * nz;
    if (!(before < 0 && after >= 0)) return false;
    const lateral = -(now.x - line.xM) * nz + (now.z - line.zM) * nx;
    return Math.abs(lateral) <= line.widthM / 2;
  }

  function holdAtLine(line: StopLineDef) {
    const a = line.headingDeg * DEG;
    const nx = Math.cos(a);
    const nz = Math.sin(a);
    const over = (state.positionXM - line.xM) * nx + (state.positionZM - line.zM) * nz;
    state = createState({
      ...state,
      positionXM: state.positionXM - over * nx,
      positionZM: state.positionZM - over * nz,
      speedMps: 0, throttleLevel: 0, brakeLevel: 0, direction: 'forward', rollingBack: false, drivingState: 'Stopped',
      accelerationMps2: 0, driveForceN: 0, brakeForceN: 0, slipping: false,
    });
    travelRad = state.headingRad;
    slideRad = 0;
    phase = 'held';
    holdUntilS = clockS() + line.redS;
    emit({ kind: 'stopLine' });
    say('red', {});
  }

  function goGreen(line: StopLineDef) {
    phase = 'driving';
    say('green', {});
    for (const f of def.forks) {
      if (f.stopLineId !== line.id) continue;
      const fs = forks.get(f.id)!;
      fs.startClockS = clockS();
      for (const k of Object.keys(fs.votes)) fs.votes[k] = 0;
    }
  }

  /** The other road, driven straight from the same start with the throttle held: how long it takes to the merge, or how it ends. */
  function otherRoadResult(roadId: string, mergeAt: WhatIfOptions['mergeAt']): { outcome: WhatIfOutcome; timeS: number } {
    const road = world.roadById(roadId);
    const first = road.line.points[0]!;
    const second = road.line.points[1]!;
    const headingDeg = (Math.atan2(second.zM - first.zM, second.xM - first.xM) / DEG);
    const sim = createLevelSession({
      content, rover, constants, def: { ...def, start: { xM: first.xM, zM: first.zM, headingDeg }, stopLines: [], forks: [], hints: [], signs: [], samples: def.samples },
      whatIf: { roadId, mergeAt },
      drive: ({ state: s }) => {
        const near = road.line.nearest(s.positionXM, s.positionZM);
        const ahead = pointAlongPath(road.line.points, (near?.alongM ?? 0) + 8);
        const err = wrapAngle(Math.atan2(ahead.zM - s.positionZM, ahead.xM - s.positionXM) - s.headingRad);
        const deadband = (turnRadPerS * dtS) / 2;
        return { throttleHeld: true, brakeHeld: false, steer: Math.abs(err) <= deadband ? 0 : err > 0 ? 1 : -1 };
      },
    });
    while (sim.phase === 'driving') sim.stepOnce();
    return sim.whatIfEnd ?? { outcome: 'timeout', timeS: sim.clockS };
  }

  function checkForks(front: { x: number; z: number }) {
    for (const f of def.forks) {
      const fs = forks.get(f.id)!;
      if (fs.done || fs.startClockS === undefined) continue;
      const on = world.onRoadAt(front.x, front.z);
      if (on && f.roadIds.includes(on.road.def.id)) fs.votes[on.road.def.id] = (fs.votes[on.road.def.id] ?? 0) + 1;
      if (Math.hypot(front.x - f.mergeAt.xM, front.z - f.mergeAt.zM) > f.mergeAt.radiusM) continue;
      fs.done = true;
      const yourRoad = (fs.votes[f.roadIds[1]] ?? 0) > (fs.votes[f.roadIds[0]] ?? 0) ? f.roadIds[1] : f.roadIds[0];
      const otherRoad = yourRoad === f.roadIds[0] ? f.roadIds[1] : f.roadIds[0];
      const other = otherRoadResult(otherRoad, f.mergeAt);
      const yourS = clockS() - fs.startClockS;
      emit({ kind: 'fork', yourRoad, otherRoad, yourS, otherS: other.timeS, otherOutcome: other.outcome });
      if (other.outcome === 'merged') {
        say('fork-result', { otherRoad: roadName(otherRoad), otherS: twoDecimals(other.timeS), yourRoad: roadName(yourRoad).toLowerCase(), yourS: twoDecimals(yourS) });
      } else {
        say('fork-result-crash', { otherRoad: roadName(otherRoad).toLowerCase(), outcome: levelText.outcomes[other.outcome]! });
      }
    }
  }

  // --- the step ---

  function onStep() {
    if (phase === 'finished' || phase === 'ended') return;
    clockStep += 1;
    stepIndex += 1;
    if (clockStep % traceEvery === 0) trace.push({ timeS: clockS(), speedMps: phase === 'driving' ? state.speedMps : 0 });
    advance();
    captionNow = queue.update(clockS());
  }

  function advance() {

    if (phase === 'respawning') {
      if (clockS() >= respawnAtS) respawnNow('crash');
      return;
    }
    if (phase === 'held') {
      const line = def.stopLines.find((l) => l.id === holdingLine)!;
      if (clockS() >= holdUntilS) goGreen(line);
      return;
    }
    if (manualRespawn && !whatIf) {
      manualRespawn = false;
      respawnNow('manual');
      return;
    }
    manualRespawn = false;
    if (whatIf && clockS() >= cfg.rules.whatIfTimeoutS) {
      whatIfEnd = { outcome: 'timeout', timeS: clockS() };
      phase = 'ended';
      return;
    }
    drivingStep();
  }

  let holdingLine = '';

  function drivingStep() {
    const prev = state;
    const t = clockS();
    const centre = centreOf(prev);
    const gear = gearAngle(prev);

    // The ground under the rover: gravity, water, slope, surface.
    const zone = world.gravityKindAt(centre.x, centre.z);
    const g = gravityAt(zone);
    const depthM = world.waterDepthM(centre.x, centre.z);
    const upN = depthM > 0 ? upthrustN(cfg.water.densityKgPerM3, g, cfg.water.roverVolumeM3, cfg.water.submersionHeightM, depthM) : 0;
    const dragNsPerM = depthM > 0 ? waterDragNsPerM(cfg.water.dragNsPerM, depthM, cfg.water.submersionHeightM) : 0;
    const slopeGear = world.slopeRad(centre.x, centre.z, gear);
    const surfaceId = world.surfaceIdAt(prev.positionXM, prev.positionZM);
    const surface = specs.get(surfaceId)!;
    const floating = depthM > 0 && floats(rover.massKg, g, upN);

    // Magnets: the force of every pylon that is on, split along the gear and sideways to it.
    let alongN = 0;
    let sideN = 0;
    const modes = new Map<string, { mode: 'attract' | 'repel' | 'none'; forceN: number; distM: number }>();
    for (const p of def.pylons) {
      const distM = Math.hypot(p.xM - centre.x, p.zM - centre.z);
      if (!pylonIsOn(p, t)) {
        modes.set(p.id, { mode: 'none', forceN: 0, distM });
        continue;
      }
      const attract = p.pole !== pole;
      const m = magnetOnRover(cfg.magnet, centre.x, centre.z, p.xM, p.zM, gear, attract);
      alongN += m.alongGearN;
      sideN += m.sidewaysN;
      modes.set(p.id, { mode: m.forceN >= cfg.rules.magnetCaptionMinN ? (attract ? 'attract' : 'repel') : 'none', forceN: m.forceN, distM });
    }

    // The student's pedals, then the physics step.
    const input = drive({ stepIndex, clockS: t, state: prev, travelRad });
    keys = input;
    const next = step(prev, input, rover, surface, { ...baseConstants, gravityMps2: g }, alongN, {
      slopeRad: slopeGear, upthrustN: upN, waterDragNsPerM: dragNsPerM,
    });
    const motion = motionSign(next.direction, next.rollingBack);
    // The way the rover travels compared with its gear: +1, or −1 while it rolls back. Forces and slopes are worked out along the gear, so this is the sign that turns them into "along the motion" (not `motion`, which is against the heading and is −1 in reverse gear too).
    const vsGear: 1 | -1 = next.rollingBack ? -1 : 1;
    const q = buildQuantities(rover, surface, { gravityMps2: g }, { slopeRad: slopeGear, upthrustN: upN });

    // Travel direction (drifting): it follows the way the rover moves, no faster than the tyres can bend the path (μ_g k_g R ÷ m v),
    // plus the magnet's sideways push (F⊥ ÷ m v). A floating rover has R = 0: its path cannot be bent by the tyres at all.
    const sideBend = sidewaysBendRadPerS(sideN * vsGear, rover.massKg, prev.speedMps, cfg.magnet.sidewaysCutoffMps);
    const turnLimit = run.drift
      ? travelTurnLimitFromNormalRadPerS(surface.grip, rover.gripFactor, q.normalForceN, rover.massKg, prev.speedMps)
      : Infinity;
    const target = next.headingRad + (motion === 1 ? 0 : Math.PI);
    travelRad = turnTravelDirection(travelRad + sideBend * dtS, target, turnLimit, dtS);
    slideRad = slideAngleRad(travelRad, target);
    const sliding = slideRad >= SLIDE_MARK_RAD;

    // Move the step distance along the ground: the horizontal part is d cos θ (A6).
    const d = next.distanceM - prev.distanceM;
    const horizontal = d * Math.cos(slopeGear);
    state = {
      ...next,
      positionXM: prev.positionXM + horizontal * Math.cos(travelRad),
      positionZM: prev.positionZM + horizontal * Math.sin(travelRad),
    };

    // A crash: a wall or a barrier. The step is undone and the crash moment begins.
    const hit = world.hit(state.positionXM, state.positionZM, state.headingRad);
    if (hit) {
      state = { ...prev, speedMps: 0, rollingBack: false };
      travelRad = prev.headingRad;
      snap = undefined;
      scheduleRespawn('crash', hit.kind);
      return;
    }

    const front = { x: state.positionXM, z: state.positionZM };
    const centreNow = centreOf(state);

    // Boost pads, then cannons.
    for (const pad of def.boosts) {
      if (usedPads.has(pad.id) || Math.hypot(front.x - pad.xM, front.z - pad.zM) > pad.radiusM) continue;
      usedPads.add(pad.id);
      const before = state.speedMps;
      state = withVelocityAlongHeading(state, alongHeading(state) + (motion * run.boostImpulseNs) / rover.massKg);
      emit({ kind: 'boost', speedBeforeMps: before, speedAfterMps: state.speedMps, massKg: rover.massKg, impulseNs: run.boostImpulseNs });
      say('boost', { impulseNs: run.boostImpulseNs, massKg: rover.massKg, dv: twoDecimals(state.speedMps - before) });
      flash = { kind: 'impulse', forceN: run.boostImpulseNs / cfg.arrows.flashS, directionWorld: worldDirection(travelRad), extraLabel: `Δv +${twoDecimals(state.speedMps - before)} m/s` };
      flashUntilS = t + cfg.arrows.flashS;
    }
    fireCannons(front, t);
    moveBags(t);
    hitBags(front, t, motion);

    // Samples, checkpoints, stop lines, signs, finish.
    if (!quiet) {
      for (const s of def.samples) {
        if (collected.includes(s.id)) continue;
        if (footprintOverlapsCircle(front.x, front.z, state.headingRad, footprint.lengthM, footprint.widthM, s.xM, s.zM, cfg.rules.sampleRadiusM)) {
          collected.push(s.id);
          emit({ kind: 'sample', sampleId: s.id, n: collected.length });
          say('sample', { n: collected.length });
        }
      }
      def.checkpoints.forEach((c, i) => {
        if (i <= lastCheckpoint) return;
        if (Math.hypot(front.x - c.xM, front.z - c.zM) <= (c.radiusM ?? cfg.rules.checkpointRadiusM)) {
          lastCheckpoint = i;
          emit({ kind: 'checkpoint', checkpointId: c.id });
          say('checkpoint', {});
        }
      });
      for (const line of def.stopLines) {
        if (stopPassed.has(line.id)) continue;
        if (crossedStopLine(line, { x: prev.positionXM, z: prev.positionZM }, front)) {
          stopPassed.add(line.id);
          holdingLine = line.id;
          holdAtLine(line);
          return;
        }
      }
      for (const sign of def.signs) {
        if (signsShown.has(sign.id) || state.speedMps < cfg.rules.bendCaptionMinMps) continue;
        if (Math.hypot(front.x - sign.xM, front.z - sign.zM) > cfg.rules.signLookAheadM) continue;
        signsShown.add(sign.id);
        say('bend', {
          radiusM: sign.radiusM, massKg: rover.massKg, speed: twoDecimals(state.speedMps),
          needN: newtons((rover.massKg * state.speedMps ** 2) / sign.radiusM), gripN: newtons(q.gripLimitN),
        });
      }
      updateHints(front);
    }
    checkForks(front);

    if (whatIf) {
      if (Math.hypot(front.x - whatIf.mergeAt.xM, front.z - whatIf.mergeAt.zM) <= whatIf.mergeAt.radiusM) {
        whatIfEnd = { outcome: 'merged', timeS: t };
        phase = 'ended';
        return;
      }
    }

    // The beacon.
    if (footprintOverlapsCircle(front.x, front.z, state.headingRad, footprint.lengthM, footprint.widthM, def.finish.xM, def.finish.zM, def.finish.radiusM) && !whatIf) {
      const flags: [boolean, boolean, boolean] = [true, collected.length === def.samples.length, t <= def.parS];
      result = { timeS: t, starFlags: flags, stars: flags.filter(Boolean).length as 0 | 1 | 2 | 3 };
      phase = 'finished';
      emit({ kind: 'finish' });
      return;
    }

    // Stuck: full throttle, no brake and no movement (friction beats the motor); or floating and slowed to a stop.
    const floatStopped = floating && state.speedMps < cfg.rules.floatStopMps;
    if (floatStopped) {
      state = { ...state, speedMps: 0 };
      scheduleRespawn('floated');
      return;
    }
    if (state.speedMps === 0 && state.throttleLevel === 1 && state.brakeLevel === 0 && state.drivingState === 'Stopped') {
      scheduleRespawn('stuck');
      return;
    }

    // --- events and captions from changes of place and state ---
    const frontSurface = world.surfaceIdAt(front.x, front.z);
    const inWater = world.waterDepthM(centreNow.x, centreNow.z) > 0;
    if (!inWater && frontSurface !== currentSurfaceId) {
      currentSurfaceId = frontSurface;
      if (frontSurface === 'mud' || frontSurface === 'sand' || frontSurface === 'ice') {
        const sp = specs.get(frontSurface)!;
        const onIt = buildQuantities(rover, sp, { gravityMps2: g }, { slopeRad: slopeGear, upthrustN: upN });
        const asphalt = buildQuantities(rover, specs.get('asphalt')!, { gravityMps2: g }, { slopeRad: slopeGear, upthrustN: upN });
        emit({
          kind: 'surface', surfaceId: frontSurface, mu: sp.rollingFriction, k: rover.rollingFactor, normalN: onIt.normalForceN,
          frictionN: onIt.rollingForceN, asphaltN: asphalt.rollingForceN, gripN: onIt.gripLimitN,
        });
        say(`surface-${frontSurface}`, { frictionN: newtons(onIt.rollingForceN), asphaltN: newtons(asphalt.rollingForceN), gripN: newtons(onIt.gripLimitN) });
      }
    }

    const zoneNow = world.gravityKindAt(centreNow.x, centreNow.z);
    if (zoneNow !== currentZone) {
      currentZone = zoneNow;
      if (zoneNow !== undefined) {
        const gz = gravityAt(zoneNow);
        emit({ kind: 'gravity', gravityKind: zoneNow, gMps2: gz, weightN: rover.massKg * gz, massKg: rover.massKg });
        say(`gravity-${zoneNow}`, { g: gz.toFixed(1), weightN: newtons(rover.massKg * gz), massKg: rover.massKg });
      }
    }

    if (next.slipping && !wasSlipping && !floating) {
      const ask = next.brakeLevel > 0 ? next.brakeLevel * rover.brakeForceMaxN : next.throttleLevel * rover.driveForceMaxN;
      emit({ kind: 'slip', gripN: q.gripLimitN, askN: ask });
      say('slip', { gripN: newtons(q.gripLimitN), askN: newtons(ask) });
    }
    wasSlipping = next.slipping;

    // Slopes: a steep one pulls; a long descent turns height into speed; a rover that cannot hold rolls back.
    const slopeMotion = slopeGear * vsGear;
    const steepRad = cfg.rules.steepSlopeDeg * DEG;
    const pullN = slopePullN(rover.massKg, g, Math.abs(slopeGear));
    if (slopeMotion >= steepRad && !steepNow) {
      steepNow = true;
      emit({ kind: 'slope', pullN, angleDeg: (slopeMotion / DEG), massKg: rover.massKg, gMps2: g });
      say('slope-up', { pullN: newtons(pullN), massKg: rover.massKg, g: g.toFixed(1), angleDeg: Math.round(slopeMotion / DEG) });
    } else if (slopeMotion < steepRad / 2) steepNow = false;
    if (slopeMotion <= -steepRad && !descent) descent = { startHeightM: world.heightM(centreNow.x, centreNow.z), startSpeedMps: state.speedMps };
    else if (descent && slopeMotion > -steepRad / 2) {
      const dropM = descent.startHeightM - world.heightM(centreNow.x, centreNow.z);
      if (dropM >= cfg.rules.descentMinDropM) {
        emit({ kind: 'descent', dropM, speedBeforeMps: descent.startSpeedMps, speedAfterMps: state.speedMps, massKg: rover.massKg, gMps2: g, energyJ: rover.massKg * g * dropM });
        say('descent', { dropM: twoDecimals(dropM), before: twoDecimals(descent.startSpeedMps), after: twoDecimals(state.speedMps) });
      }
      descent = undefined;
    }
    if (state.rollingBack && !wasRollingBack) {
      const pull = Math.abs(-slopePullN(rover.massKg, g, slopeGear) + alongN);
      const holdN = state.driveForceN + q.rollingForceN;
      emit({ kind: 'rollback', pullN: pull, holdN, angleDeg: Math.abs(slopeGear) / DEG, massKg: rover.massKg, gMps2: g });
      say('rollback', { pullN: newtons(pull), holdN: newtons(holdN) });
    }
    wasRollingBack = state.rollingBack;

    // Bends: the radius under the rover, if it is on an arc.
    const on = world.onRoadAt(front.x, front.z);
    const curve = on ? world.curveRadiusAt(on.road, on.alongM) : undefined;
    if (sliding && !wasSliding) {
      const needN = curve ? (rover.massKg * prev.speedMps ** 2) / curve.radiusM : rover.massKg * prev.speedMps * turnRadPerS;
      emit({ kind: 'slide', needN, gripN: q.gripLimitN, radiusM: curve?.radiusM, speedMps: prev.speedMps, massKg: rover.massKg });
      say('slide', { needN: newtons(needN), gripN: newtons(q.gripLimitN) });
    }
    wasSliding = sliding;

    // Water.
    if (inWater && !wasInWater) {
      const vol = cfg.water.roverVolumeM3 * Math.min(depthM / cfg.water.submersionHeightM, 1);
      emit({ kind: 'water', upN, weightN: rover.massKg * g, depthM, volM3: vol, massKg: rover.massKg, gMps2: g });
      say('water-in', { upN: newtons(upN), weightN: newtons(rover.massKg * g) });
    }
    if (inWater && floating && !wasFloating) {
      emit({ kind: 'float', upN, weightN: rover.massKg * g, depthM, volM3: cfg.water.roverVolumeM3 * Math.min(depthM / cfg.water.submersionHeightM, 1), massKg: rover.massKg, gMps2: g });
      say('float', { upN: newtons(upN), weightN: newtons(rover.massKg * g) });
    }
    if (inWater && depthM >= maxDepthM && !deepShown) {
      deepShown = true;
      say('pressure', { depthM: depthM.toFixed(2), g: g.toFixed(1), pa: newtons(cfg.water.densityKgPerM3 * g * depthM) });
    }
    wasInWater = inWater;
    wasFloating = floating && inWater;

    // Magnets: say what a pylon does when it starts to pull or push, and when its coils go off.
    for (const [id, m] of modes) {
      const was = pylonModes.get(id) ?? 'none';
      if (m.mode !== was) {
        if (m.mode === 'none') {
          const p = def.pylons.find((x) => x.id === id)!;
          if (!pylonIsOn(p, t)) say('magnet-off', {});
        } else {
          emit({ kind: 'magnet', forceN: m.forceN, distM: m.distM, attract: m.mode === 'attract', pole });
          say(m.mode === 'attract' ? 'magnet-attract' : 'magnet-repel', { forceN: newtons(m.forceN), distM: m.distM.toFixed(1) });
        }
      }
      pylonModes.set(id, m.mode);
    }

    // What the HUD needs: the forces of this step.
    const gripN = q.gripLimitN;
    snap = {
      gearRad: gear, vsGear, gMps2: g, normalN: q.normalForceN, frictionN: q.rollingForceN, gripN, driveN: next.driveForceN, brakeN: next.brakeForceN,
      slopeGearRad: slopeGear, slopePushN: -slopePullN(rover.massKg, g, slopeGear), dragN: dragNsPerM * prev.speedMps, upN,
      magnetAlongN: alongN,
      magnetVector: alongN !== 0 || sideN !== 0
        ? { x: alongN * Math.cos(gear) - sideN * Math.sin(gear), z: alongN * Math.sin(gear) + sideN * Math.cos(gear) }
        : undefined,
      zone, inWater: depthM > 0, curve,
    };
    forceLineText = forceLine.update({
      timeS: t,
      accelerationMps2: next.accelerationMps2,
      terms: forceTerms(snap),
      massKg: rover.massKg,
      atTopSpeed: next.drivingState === 'At top speed',
    });
    void gripN;
  }

  let forceLineText: string | null = null;

  /** The forces along the path, signed along the motion (positive speeds the rover up). */
  function forceTerms(s: Snapshot): ForceTerm[] {
    const along = s.vsGear;
    const terms: ForceTerm[] = [];
    if (s.brakeN > 0) terms.push({ name: 'Brake', forceN: -s.brakeN });
    else terms.push({ name: 'Push', forceN: along * s.driveN });
    terms.push({ name: 'Friction', forceN: -s.frictionN });
    if (s.slopePushN !== 0) terms.push({ name: 'Slope pull', forceN: along * s.slopePushN });
    if (s.dragN > 0) terms.push({ name: 'Water drag', forceN: -s.dragN });
    if (s.magnetAlongN !== 0) terms.push({ name: 'Magnet', forceN: along * s.magnetAlongN });
    return terms;
  }

  // --- cannons ---

  function fireCannons(front: { x: number; z: number }, t: number) {
    for (const c of def.cannons) {
      const dirRad = c.directionDeg * DEG;
      if (!cannonStates.has(c.id)) {
        const triggerM = c.triggerM ?? (c.kind === 'headOn' ? bagSpec.headOnTriggerDistanceM : bagSpec.kickerWakeRearOffsetM + footprint.lengthM + 9);
        if (Math.hypot(front.x - c.xM, front.z - c.zM) <= triggerM) cannonStates.set(c.id, { activatedAtS: t, shots: 0 });
      }
      const cs = cannonStates.get(c.id);
      if (!cs) continue;
      for (;;) {
        const due = cs.activatedAtS + cs.shots * bagSpec.fireIntervalS;
        if (due > t + 1e-9) break;
        // A head-on cannon stops firing once the rover has passed it; a kicker fires a fixed number of shots.
        const ahead = (front.x - c.xM) * Math.cos(dirRad) + (front.z - c.zM) * Math.sin(dirRad);
        if (c.kind === 'headOn' ? ahead <= 0 : cs.shots >= bagSpec.kickerShots) break;
        bags.push({ id: `${c.id}#${cs.shots}`, cannonId: c.id, kind: c.kind, firedAtS: due, xM: c.xM, zM: c.zM, dirRad });
        cs.shots += 1;
      }
    }
  }

  function moveBags(t: number) {
    const kept: Bag[] = [];
    for (const bag of bags) {
      const c = def.cannons.find((x) => x.id === bag.cannonId)!;
      const travelled = (bag.kind === 'headOn' ? bagSpec.headOnSpeedMps : bagSpec.kickerSpeedMps) * (t - bag.firedAtS);
      if (travelled >= bagSpec.rangeM) continue;
      bag.xM = c.xM + travelled * Math.cos(bag.dirRad);
      bag.zM = c.zM + travelled * Math.sin(bag.dirRad);
      kept.push(bag);
    }
    bags = kept;
  }

  function hitBags(front: { x: number; z: number }, t: number, motion: 1 | -1) {
    void t;
    const remaining: Bag[] = [];
    for (const bag of bags) {
      const touching = footprintOverlapsCircle(front.x, front.z, state.headingRad, footprint.lengthM, footprint.widthM, bag.xM, bag.zM, bagSpec.radiusM);
      if (!touching) {
        remaining.push(bag);
        continue;
      }
      // m₁u₁ + m₂u₂ = (m₁ + m₂)u′, along the heading.
      const bagSpeed = bag.kind === 'headOn' ? bagSpec.headOnSpeedMps : bagSpec.kickerSpeedMps;
      const bagAlong = bagSpeed * Math.cos(bag.dirRad - state.headingRad);
      const u1 = alongHeading(state);
      const before = state.speedMps;
      const temp: PhysicsState = { ...state, direction: u1 >= 0 ? 'forward' : 'reverse', speedMps: Math.abs(u1), rollingBack: false };
      const shared = shareMomentum(temp, rover.massKg, bagSpec.massKg, bagAlong);
      const u3 = shared.direction === 'forward' ? shared.speedMps : -shared.speedMps;
      state = withVelocityAlongHeading(state, u3);
      emit({
        kind: 'hit', hitKind: bag.kind, speedBeforeMps: before, speedAfterMps: state.speedMps, massKg: rover.massKg, bagKg: bagSpec.massKg,
        u1, u2: bagAlong, u3,
      });
      say(`hit-${bag.kind}`, {
        massKg: rover.massKg, bagKg: bagSpec.massKg, u1: twoDecimals(u1), u2: twoDecimals(bagAlong), u3: twoDecimals(u3),
        before: twoDecimals(before), after: twoDecimals(state.speedMps),
      });
      flash = { kind: 'impulse', forceN: (rover.massKg * Math.abs(u3 - u1)) / cfg.arrows.flashS, directionWorld: worldDirection(travelRad, 0, u3 >= u1 ? 1 : -1), extraLabel: `Δv ${u3 - u1 >= 0 ? '+' : '−'}${twoDecimals(Math.abs(u3 - u1))} m/s` };
      flashUntilS = clockS() + cfg.arrows.flashS;
    }
    bags = remaining;
    void motion;
  }

  // --- the HUD ---

  function actingForces(): ForceArrow[] {
    if (phase !== 'driving' || !snap) return [];
    const s = snap;
    const out: ForceArrow[] = [];
    const travelDir = (sign: 1 | -1) => worldDirection(travelRad, 0, sign);
    if (s.driveN > 0) out.push({ kind: 'push', forceN: s.driveN, directionWorld: worldDirection(s.gearRad) });
    if (s.brakeN > 0) out.push({ kind: 'brake', forceN: s.brakeN, directionWorld: travelDir(-1) });
    if (state.speedMps > 0) out.push({ kind: 'friction', forceN: s.frictionN, directionWorld: travelDir(-1) });
    if (Math.abs(s.slopeGearRad) > 0 && Math.abs(s.slopePushN) > 0) {
      const down = -Math.sign(s.slopeGearRad);
      out.push({
        kind: 'slope', forceN: Math.abs(s.slopePushN),
        directionWorld: { x: down * Math.cos(s.slopeGearRad) * Math.cos(s.gearRad), y: down * Math.sin(s.slopeGearRad), z: -down * Math.cos(s.slopeGearRad) * Math.sin(s.gearRad) },
      });
    }
    if (s.zone !== undefined) out.push({ kind: 'weight', forceN: rover.massKg * s.gMps2, directionWorld: { x: 0, y: -1, z: 0 } });
    if (s.curve && state.speedMps >= cfg.rules.bendCaptionMinMps) {
      out.push({
        kind: 'turning', forceN: (rover.massKg * state.speedMps ** 2) / s.curve.radiusM,
        directionWorld: worldDirection(travelRad + (s.curve.turn * Math.PI) / 2),
        extraLabel: `tyres give up to ${newtons(s.gripN)} N`,
      });
    }
    if (s.upN > 0) out.push({ kind: 'upthrust', forceN: s.upN, directionWorld: { x: 0, y: 1, z: 0 } });
    if (s.inWater && s.dragN > 0) out.push({ kind: 'drag', forceN: s.dragN, directionWorld: travelDir(-1) });
    if (s.magnetVector) {
      const mag = Math.hypot(s.magnetVector.x, s.magnetVector.z);
      out.push({ kind: 'magnet', forceN: mag, directionWorld: { x: s.magnetVector.x, y: 0, z: -s.magnetVector.z } });
    }
    if (flash && clockS() < flashUntilS) out.push(flash);
    return selectArrows(def.id, out, cfg.arrows.hideBelowN);
  }

  function hudModel(): HudModel {
    const progress = world.progressAt(state.positionXM, state.positionZM);
    const total = def.checkpoints.length;
    return {
      speedMps: state.speedMps,
      speedKmh: state.speedMps * 3.6,
      badges: { reverse: state.direction === 'reverse', slip: phase === 'driving' && state.slipping, pole: hasPylons ? pole : null },
      levelName: def.name,
      progressText: total === 0 ? `${Math.round(progress.fraction * 100)}%` : `Checkpoint ${Math.max(0, lastCheckpoint + 1)} of ${total}`,
      progressFraction: result ? 1 : progress.fraction,
      timeS: result ? result.timeS : clockS(),
      caption: captionNow,
      forceLine: phase === 'driving' ? forceLineText : null,
      forces: actingForces(),
    };
  }

  const loop = createFixedStepLoop(dtS, onStep);

  function init() {
    state = startState();
    travelRad = startHeadingRad;
    slideRad = 0;
    wasSliding = false;
    clockStep = 0;
    stepIndex = 0;
    phase = 'driving';
    manualRespawn = false;
    lastCheckpoint = -1;
    collected = [];
    result = undefined;
    whatIfEnd = undefined;
    pole = cfg.magnet.startPole;
    events = [];
    trace = [{ timeS: 0, speedMps: state.speedMps }];
    forks = new Map(def.forks.map((f) => [f.id, { startClockS: undefined, votes: Object.fromEntries(f.roadIds.map((r) => [r, 0])), done: false }]));
    hints = def.hints.map((h) => ({ def: h, shown: false, done: false }));
    deepShown = false;
    placeAt(def.start);
    // A fork with no stop line to wait at starts when the level does.
    state = { ...state, ...options.initialState };
    captionNow = null;
    forceLineText = null;
    queue.clear();
  }
  init();

  return {
    world,
    def,
    rover,
    get state(): PhysicsState {
      return state;
    },
    get phase(): LevelPhase {
      return phase;
    },
    /** The level clock: it runs from the first step and does not stop for a crash, a respawn or a red light (A2). */
    get clockS(): number {
      return clockS();
    },
    get events(): readonly LevelEvent[] {
      return events;
    },
    get samplesCollected(): string[] {
      return [...collected];
    },
    get checkpointIndex(): number {
      return lastCheckpoint;
    },
    get result(): LevelResult | undefined {
      return result;
    },
    get whatIfEnd(): { outcome: WhatIfOutcome; timeS: number } | undefined {
      return whatIfEnd;
    },
    /** The rover's magnet pole (Space flips it). */
    get pole(): MagnetPole {
      return pole;
    },
    /** For the scene: where the rover is, which way it faces and travels, the ground height under it and its pitch. */
    get pose() {
      const c = centreOf(state);
      return {
        frontXM: state.positionXM, frontZM: state.positionZM, centreXM: c.x, centreZM: c.z,
        headingRad: state.headingRad, travelRad, slideRad, groundYM: world.heightM(c.x, c.z),
        pitchRad: world.slopeRad(c.x, c.z, state.headingRad),
        waterDepthM: world.waterDepthM(c.x, c.z),
      };
    },
    get bags(): readonly Bag[] {
      return bags;
    },
    /** For the scene: the water holds the rover up (upthrust ≥ weight), so it rides on the surface. */
    get floating(): boolean {
      return wasFloating;
    },
    /** For the scene: the stop line whose red light the rover is waiting at, if any. */
    get heldStopLineId(): string | undefined {
      return phase === 'held' ? holdingLine : undefined;
    },
    /** For the scene's bend signs: the radius and the safe speed √(μ_g k_g g r) for this build, on the surface and in the gravity under the sign. */
    signInfo(signId: string): { radiusM: number; safeSpeedMps: number } {
      const sign = def.signs.find((x) => x.id === signId);
      if (!sign) throw new Error(`Unknown sign "${signId}"`);
      const surface = specs.get(world.surfaceIdAt(sign.xM, sign.zM))!;
      const g = constants.gravityMps2 * world.gravityMultiplierAt(sign.xM, sign.zM);
      return { radiusM: sign.radiusM, safeSpeedMps: Math.sqrt(surface.grip * rover.gripFactor * g * sign.radiusM) };
    },
    get hud(): HudModel {
      return hudModel();
    },
    /** Is this pylon's current on right now? Fixed pylons are always on. */
    pylonOn(id: string): boolean {
      const p = def.pylons.find((x) => x.id === id);
      return p !== undefined && pylonIsOn(p, clockS());
    },
    /** Space: flip the rover magnet's pole between N and S. */
    flipPole(): void {
      if (!hasPylons) return;
      pole = pole === 'N' ? 'S' : 'N';
      emit({ kind: 'pole', pole });
      say('pole', { pole });
    },
    /** R: back to the last checkpoint at once. The clock keeps running. */
    requestRespawn(): void {
      if (phase === 'driving' || phase === 'held') manualRespawn = true;
    },
    report(): ReportModel {
      return buildLevelReport({ def, rover, result, events, trace, clockS: clockS(), text: levelText });
    },
    stepOnce: onStep,
    /** Runs the steps that fit in one frame. Returns how many ran. */
    advanceFrame: (frameS: number) => loop.advance(frameS),
    reset: init,
  };
}

export type LevelSession = ReturnType<typeof createLevelSession>;
