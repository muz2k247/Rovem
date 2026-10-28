import type { Content, PointM } from '../../content/index.ts';
import { levelsConfig } from '../../content/levelsConfig.ts';
import { roverFromParts, physicsConstants, STARTING_BUILD, type BuildSelection } from '../buildFromParts.ts';
import { wrapAngle } from '../run/drift.ts';
import type { ScavengerRun } from './scavenger.ts';
import { createLevelSession, type LevelInput, type LevelSession, type RespawnCause } from './session.ts';
import type { LevelDef } from './types.ts';
import { createPolyline, type LevelWorld } from './world.ts';

// The scripted driver (B4; moved out of the tests in R4, SHOWCASE_PLAN P5): the level tests use it, and it drives the Scavenger's run
// at level load (scavenger.ts). It follows a path made of the roads
// a plan names, keeps to the safe speed in bends (√(μ_g k_g g r) × a margin), brakes ahead of every slower stretch, and
// flips the magnet pole where the plan says. It exists to answer "can this build finish this level, and where does it
// fail?" with the real session, not to be a good driver.

const DEG = Math.PI / 180;
const SAMPLE_M = 1;
const VIA_BLEND_M = 30;

export interface PilotPlan {
  /** Road ids in driving order; each must start where the one before ends. See `routeWith`. */
  roads: string[];
  /** Points the path must pass through, in driving order (for example the samples). */
  via?: PointM[];
  /** Speed limits on a stretch of a road, by distance along that road. */
  caps?: { roadId: string; fromM: number; toM: number; speedMps: number }[];
  /** The pole the rover should carry from this point of a road on. The path starts with the rover's own pole, S. */
  poles?: { roadId: string; fromM: number; pole: 'N' | 'S' }[];
  /** Fraction of the safe bend speed to drive at. Default 0.9. */
  bendMargin?: number;
  /** Braking the speed plan allows for, m/s². Default 3. */
  decelMps2?: number;
  /** Never exceed this speed. Default: no limit. */
  maxSpeedMps?: number;
  /** Hold the throttle the whole way and never brake (the "simple drive" of the checks). */
  throttleOnly?: boolean;
  /** After the first respawn the pilot carries on with this plan (for example: try the mud, bog down, then take the asphalt). */
  afterRespawn?: PilotPlan;
}

export interface PilotResult {
  session: LevelSession;
  finished: boolean;
  timeS: number;
  stars: number;
  starFlags: [boolean, boolean, boolean] | undefined;
  samples: string[];
  respawns: Record<RespawnCause, number>;
  /** Road lengths, for a plan's distances. */
  pathLengthM: number;
}

/** Every chassis × wheels × motor in the parts list: the 27 builds. */
export function allBuilds(content: Content): BuildSelection[] {
  const ids = (slot: string) => content.parts.filter((p) => p.slot === slot).map((p) => p.id);
  const out: BuildSelection[] = [];
  for (const chassisId of ids('chassis')) for (const wheelsId of ids('wheels')) for (const motorId of ids('motor')) out.push({ chassisId, wheelsId, motorId });
  return out;
}

/** Every way through the level: the main route with each fork's road swapped, for every combination of choices (a level with no fork has one). */
export function allRoutes(def: LevelDef): { choices: Record<string, string>; roads: string[] }[] {
  let combos: Record<string, string>[] = [{}];
  for (const f of def.forks) combos = combos.flatMap((c) => f.roadIds.map((r) => ({ ...c, [f.id]: r })));
  return combos.map((choices) => ({ choices, roads: routeWith(def, choices) }));
}

/** The road ids of the main route with each fork's road swapped for the one chosen (default: the one the route names). */
export function routeWith(def: LevelDef, choices: Record<string, string> = {}): string[] {
  return def.route.map((id) => {
    const fork = def.forks.find((f) => f.roadIds.includes(id));
    return fork && choices[fork.id] ? choices[fork.id]! : id;
  });
}

interface PathPoint {
  xM: number;
  zM: number;
  /** Safe speed from the bend here, before braking ahead. */
  limitMps: number;
}

function buildPath(world: LevelWorld, plan: PilotPlan, gripFactor: number, gravityMps2: number, surfaceGrip: (id: string) => number) {
  // The road centrelines end to end, resampled every metre.
  const raw: { xM: number; zM: number; roadId: string; alongRoadM: number }[] = [];
  for (const id of plan.roads) {
    const road = world.roadById(id);
    const len = road.line.lengthM;
    for (let s = 0; s <= len + 1e-6; s += SAMPLE_M) {
      const a = Math.min(s, len);
      const p = at(road.line.points, road.line.alongAt, a);
      if (raw.length > 0 && s === 0) continue; // the joint is already there
      raw.push({ xM: p.xM, zM: p.zM, roadId: id, alongRoadM: a });
    }
  }
  // Via points: the path is bent sideways, smoothly over VIA_BLEND_M metres either side, so it passes through each one.
  const withVia = raw.map((p) => ({ ...p }));
  let from = 0;
  for (const v of plan.via ?? []) {
    let best = from;
    let bestD = Infinity;
    for (let i = from; i < raw.length; i++) {
      const d = Math.hypot(raw[i]!.xM - v.xM, raw[i]!.zM - v.zM);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    const a = raw[Math.max(0, best - 1)]!;
    const b = raw[Math.min(raw.length - 1, best + 1)]!;
    const len = Math.hypot(b.xM - a.xM, b.zM - a.zM) || 1;
    const nx = -(b.zM - a.zM) / len;
    const nz = (b.xM - a.xM) / len;
    const offset = (v.xM - raw[best]!.xM) * nx + (v.zM - raw[best]!.zM) * nz;
    for (let i = Math.max(0, best - VIA_BLEND_M); i <= Math.min(raw.length - 1, best + VIA_BLEND_M); i++) {
      const w = 0.5 * (1 + Math.cos((Math.PI * (i - best)) / VIA_BLEND_M));
      withVia[i]!.xM += nx * offset * w;
      withVia[i]!.zM += nz * offset * w;
    }
    from = best;
  }
  const line = createPolyline(withVia.map((p) => ({ xM: p.xM, zM: p.zM })));

  // The speed limit at each point: bends and the plan's caps.
  const margin = plan.bendMargin ?? 0.9;
  const points: PathPoint[] = withVia.map((p) => {
    let limit = plan.maxSpeedMps ?? Infinity;
    const road = world.roadById(p.roadId);
    const curve = world.curveRadiusAt(road, p.alongRoadM);
    if (curve) {
      const g = gravityMps2 * world.gravityMultiplierAt(p.xM, p.zM);
      limit = Math.min(limit, margin * Math.sqrt(surfaceGrip(world.surfaceIdAt(p.xM, p.zM)) * gripFactor * g * curve.radiusM));
    }
    for (const c of plan.caps ?? []) if (c.roadId === p.roadId && p.alongRoadM >= c.fromM && p.alongRoadM <= c.toM) limit = Math.min(limit, c.speedMps);
    return { xM: p.xM, zM: p.zM, limitMps: limit };
  });
  // Brake ahead: the speed here may not be more than can be slowed to the next limit.
  const decel = plan.decelMps2 ?? 3;
  const allowed = points.map((p) => p.limitMps);
  for (let i = allowed.length - 2; i >= 0; i--) {
    const step = line.alongAt[i + 1]! - line.alongAt[i]!;
    allowed[i] = Math.min(allowed[i]!, Math.sqrt(allowed[i + 1]! ** 2 + 2 * decel * step));
  }
  // The pole wanted at each point: the last entry of the plan the path has reached.
  const poleAt: ('N' | 'S')[] = [];
  let wanted: 'N' | 'S' = 'S';
  // A pole entry for a road the plan does not drive is skipped: waiting for it would hold back every pole after it (R13: the Scavenger on Iron Ridge takes the switchback road).
  const pending = (plan.poles ?? []).filter((p) => plan.roads.includes(p.roadId));
  for (const p of withVia) {
    while (pending.length > 0 && pending[0]!.roadId === p.roadId && p.alongRoadM >= pending[0]!.fromM) wanted = pending.shift()!.pole;
    poleAt.push(wanted);
  }
  return { line, allowed, points, poleAt };
}

function at(points: readonly PointM[], alongAt: readonly number[], alongM: number): { xM: number; zM: number } {
  let lo = 0;
  let hi = points.length - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (alongAt[mid]! <= alongM) lo = mid;
    else hi = mid - 1;
  }
  const a = points[lo]!;
  const b = points[lo + 1]!;
  const len = alongAt[lo + 1]! - alongAt[lo]!;
  const t = len === 0 ? 0 : (alongM - alongAt[lo]!) / len;
  return { xM: a.xM + (b.xM - a.xM) * t, zM: a.zM + (b.zM - a.zM) * t };
}

export interface PilotOptions {
  content: Content;
  def: LevelDef;
  build?: BuildSelection;
  plan: PilotPlan;
  /** Give up after this much level time. Default 400 s. */
  maxS?: number;
  /** Stop as soon as this is true (checked every step). */
  until?: (s: LevelSession) => boolean;
  /** Filled with what the pilot pressed, per step, so a browser run can replay it (I1 play-check). `inputs[k]` is the input of step k + 1; `flips` are the steps a pole flip came just before. */
  record?: { inputs: LevelInput[]; flips: number[] };
  /** Called with the session before the first step and after every step: `onStep` is how the Scavenger's run is recorded (SHOWCASE_PLAN P5). */
  onStep?: (s: LevelSession) => void;
  /** The rival the session races, if any (the third star). */
  scavenger?: ScavengerRun;
  /** A worn motor (R11): its top speed is multiplied by this. Default 1. */
  topSpeedFactor?: number;
  /**
   * Fire the booster whenever it is ready, the rover is on the ground in forward gear and at least `scavenger.boosterMarginMps` below its top
   * speed (R11, DECISIONS 2026-10-26 (3)): the Scavenger's rule, and the one the audit used for the starting rover's clean best. Default off.
   */
  booster?: boolean;
}

/** Drives a level with a plan and reports how it went. */
export function runPilot(o: PilotOptions): PilotResult {
  const { content, def, plan } = o;
  const fresh = roverFromParts(content, o.build ?? STARTING_BUILD);
  const rover = o.topSpeedFactor !== undefined ? { ...fresh, topSpeedMps: fresh.topSpeedMps * o.topSpeedFactor } : fresh;
  const constants = physicsConstants(content);
  let input: LevelInput = { throttleHeld: false, brakeHeld: false, steer: 0 };
  const session = createLevelSession({ content, def, rover, constants, drive: () => input, ...(o.scavenger ? { scavenger: o.scavenger } : {}) });
  const world = session.world;
  const gripOf = (id: string) => content.surfaces.find((s) => s.id === id)!.grip;
  let current = plan;
  let { line, allowed, poleAt } = buildPath(world, current, rover.gripFactor, constants.gravityMps2, gripOf);
  const turnRadPerS = constants.turnRateDegPerS * DEG;
  const dt = constants.timeStepS;
  const deadband = (turnRadPerS * dt) / 2;
  const maxS = o.maxS ?? 400;
  const respawns: Record<RespawnCause, number> = { crash: 0, stuck: 0, floated: 0, fell: 0, manual: 0 };
  let seen = 0;
  let index = 0;
  let lastFlipS = -1;

  const nearestIndex = (x: number, z: number): number => {
    const n = line.points.length;
    let best = -1;
    let bestD = Infinity;
    const scan = (from: number, to: number) => {
      for (let i = Math.max(0, from); i <= Math.min(n - 1, to); i++) {
        const d = Math.hypot(line.points[i]!.xM - x, line.points[i]!.zM - z);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
    };
    scan(index - 40, index + 80);
    if (bestD > 14) scan(0, n - 1);
    return best;
  };

  o.onStep?.(session);
  while (session.phase !== 'finished' && session.clockS < maxS && !(o.until && o.until(session))) {
    const s = session.state;
    if (session.phase === 'driving') {
      index = nearestIndex(s.positionXM, s.positionZM);
      const along = line.alongAt[index]!;
      const lookM = 5 + 0.5 * s.speedMps;
      const target = at(line.points, line.alongAt, Math.min(line.lengthM, along + lookM));
      const err = wrapAngle(Math.atan2(target.zM - s.positionZM, target.xM - s.positionXM) - s.headingRad);
      const steer: -1 | 0 | 1 = Math.abs(err) <= deadband ? 0 : err > 0 ? 1 : -1;
      if (current.throttleOnly) {
        input = { throttleHeld: true, brakeHeld: false, steer };
      } else {
        const want = allowed[Math.min(allowed.length - 1, index + Math.round(1 + s.speedMps * 0.15))]!;
        input = { throttleHeld: s.speedMps < want - 0.1, brakeHeld: s.speedMps > want + 0.8, steer };
      }
      if (current.poles && session.clockS - lastFlipS > 0.25) {
        if (poleAt[index] !== session.pole) {
          session.flipPole();
          o.record?.flips.push(o.record.inputs.length);
          lastFlipS = session.clockS;
        }
      }
    } else {
      input = { throttleHeld: false, brakeHeld: false, steer: 0 };
    }
    if (o.booster && session.phase === 'driving' && !session.airborne && session.boosterReady) {
      const st = session.state;
      if (st.direction === 'forward' && !st.rollingBack && st.speedMps <= rover.topSpeedMps - levelsConfig.scavenger.boosterMarginMps) session.fireBooster();
    }
    o.record?.inputs.push(input);
    session.stepOnce();
    o.onStep?.(session);
    for (; seen < session.events.length; seen++) {
      const e = session.events[seen]!;
      if (e.kind === 'respawn' && e.cause) {
        respawns[e.cause] += 1;
        if (current.afterRespawn) {
          current = current.afterRespawn;
          ({ line, allowed, poleAt } = buildPath(world, current, rover.gripFactor, constants.gravityMps2, gripOf));
          index = 0;
        }
      }
    }
  }
  const result = session.result;
  return {
    session,
    finished: session.phase === 'finished',
    timeS: result?.timeS ?? session.clockS,
    stars: result?.stars ?? 0,
    starFlags: result?.starFlags,
    samples: session.samplesCollected,
    respawns,
    pathLengthM: line.lengthM,
  };
}

/** A point `alongM` down a road and `latM` to its left (negative: right), with the road's heading there. */
export function roadPoint(world: LevelWorld, roadId: string, alongM: number, latM = 0): PointM & { headingRad: number } {
  const line = world.roadById(roadId).line;
  const a = at(line.points, line.alongAt, alongM);
  const b = at(line.points, line.alongAt, Math.min(line.lengthM, alongM + 0.5));
  const back = at(line.points, line.alongAt, Math.max(0, alongM - 0.5));
  const h = Math.atan2(b.zM - back.zM, b.xM - back.xM);
  return { xM: a.xM - Math.sin(h) * latM, zM: a.zM + Math.cos(h) * latM, headingRad: h };
}

/** Where a path of these roads is, `alongM` from its start (for placing plan caps and poles). */
export function pathPoint(world: LevelWorld, roads: string[], alongM: number): PointM {
  let rest = alongM;
  for (const id of roads) {
    const line = world.roadById(id).line;
    if (rest <= line.lengthM) return at(line.points, line.alongAt, rest);
    rest -= line.lengthM;
  }
  const last = world.roadById(roads[roads.length - 1]!).line;
  return at(last.points, last.alongAt, last.lengthM);
}
