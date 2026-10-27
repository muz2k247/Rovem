import type { Content } from '../../content/index.ts';
import { levelsConfig } from '../../content/levelsConfig.ts';
import type { RoverSpec } from '../../physics/types.ts';
import { physicsConstants, roverFromParts, type BuildSelection } from '../buildFromParts.ts';
import { wrapAngle } from '../run/drift.ts';
import { runPilot } from './autopilot.ts';
import type { LevelDef } from './types.ts';

// The Scavenger (SHOWCASE_PLAN §8, P5): a ghost replay of an honest run. At level load the autopilot drives the level headless
// with the Scavenger's own build and route, on the same physics and the same session as the student, and every step is kept. The
// scene then plays the trace back. It never collides with the rover and nothing about it is faked: its pace is what its build, its
// worn motor and its route give. Polish round (DECISIONS 2026-10-26): the same parts on every level, a worn motor tuned per level
// (`topSpeedFactor`), no start delay, and it fires its booster when it is ready, on the ground, in forward gear and at least 0.5 m/s
// below its top speed; the ghost's replay includes its burns.

export interface ScavengerPose {
  frontXM: number;
  frontZM: number;
  headingRad: number;
  travelRad: number;
  speedMps: number;
  /** Its own clock has not reached 0 yet (a positive start delay): it waits at the start. */
  waiting: boolean;
  /** Its booster is burning in this step (R11). */
  boosting: boolean;
  /** It has driven the whole way and stands at the part. */
  finished: boolean;
}

export interface ScavengerRun {
  readonly build: BuildSelection;
  /** Its rover as it drove: the build, with the motor's top speed worn down by the level's `topSpeedFactor`. */
  readonly rover: RoverSpec;
  /** Times its booster started a burn, on its own clock. */
  readonly burnStartsS: readonly number[];
  /** `scavengerStartDelayS`: it starts this long after the student (negative: before). */
  readonly delayS: number;
  /** Its own drive time, start to part. */
  readonly finishS: number;
  /** The student's clock when it reaches the part: `delayS + finishS`. A student who finishes sooner has beaten it. */
  readonly finishAtS: number;
  /** Its time on each of the level's stretches (the report compares with these). */
  readonly stretchTimesS: readonly number[];
  /** Its own clock when its front crossed the gate that begins stretch `index` (0 for the first), or null if it never did. */
  gateS(index: number): number | null;
  /** Where it is when the student's clock reads `playerClockS`. */
  poseAt(playerClockS: number): ScavengerPose;
}

interface Trace {
  dtS: number;
  x: Float64Array;
  z: Float64Array;
  heading: Float64Array;
  travel: Float64Array;
  speed: Float64Array;
  /** 1 where its booster is burning. */
  burn: Uint8Array;
}

/** Further apart than this between two steps is a respawn, not driving: the picture jumps instead of sliding across the level. */
const JUMP_M = 4;

function build(def: LevelDef, content: Content, trace: Trace, finishS: number, stretches: { enteredAtS: number | null; timeS: number }[], burnStartsS: number[]): ScavengerRun {
  const sd = def.scavenger!;
  const fresh = roverFromParts(content, sd.build);
  const rover = { ...fresh, topSpeedMps: fresh.topSpeedMps * (sd.topSpeedFactor ?? 1) };
  const last = trace.x.length - 1;
  return {
    build: sd.build,
    rover,
    burnStartsS,
    delayS: sd.startDelayS,
    finishS,
    finishAtS: sd.startDelayS + finishS,
    stretchTimesS: stretches.map((s) => s.timeS),
    gateS: (index) => stretches[index]?.enteredAtS ?? null,
    poseAt(playerClockS) {
      const tg = playerClockS - sd.startDelayS;
      const f = Math.max(0, Math.min(last, tg / trace.dtS));
      const i = Math.min(last - 1, Math.floor(f));
      const j = Math.min(last, i + 1);
      const t = f - i;
      const near = Math.hypot(trace.x[j]! - trace.x[i]!, trace.z[j]! - trace.z[i]!) <= JUMP_M;
      const at = near ? t : 0;
      const lerp = (a: Float64Array) => a[i]! + (a[j]! - a[i]!) * at;
      const lerpAngle = (a: Float64Array) => a[i]! + wrapAngle(a[j]! - a[i]!) * at;
      return {
        frontXM: lerp(trace.x), frontZM: lerp(trace.z), headingRad: lerpAngle(trace.heading), travelRad: lerpAngle(trace.travel),
        speedMps: lerp(trace.speed), waiting: tg < 0, finished: f >= last, boosting: trace.burn[i] === 1 && f < last,
      };
    },
  };
}

const cache = new Map<string, ScavengerRun>();

/**
 * Drives the level headless with the Scavenger's build and route and keeps the run. Undefined for a level with no Scavenger.
 * The result is cached, because a retry loads the same level again; the key holds everything the run depends on.
 * Throws if the Scavenger's parts are unknown or it does not finish: that is a level-file error.
 */
export function createScavengerRun(content: Content, def: LevelDef): ScavengerRun | undefined {
  const sd = def.scavenger;
  if (!sd) return undefined;
  const key = JSON.stringify([def.id, sd, def.start, def.finish, def.route, def.roads.length, def.barriers.length, def.cannons, def.boosts, def.stretches.map((s) => s.id)]);
  const hit = cache.get(key);
  if (hit) return hit;

  const { scavenger: _own, ...ghostDef } = def; // the ghost races no one
  void _own;
  const maxS = levelsConfig.scavenger.maxRunS;
  const x: number[] = [];
  const z: number[] = [];
  const heading: number[] = [];
  const travel: number[] = [];
  const speed: number[] = [];
  const burn: number[] = [];
  const r = runPilot({
    content,
    def: ghostDef,
    build: sd.build,
    plan: { roads: sd.roads, ...(sd.via ? { via: sd.via } : {}), ...(sd.bendMargin !== undefined ? { bendMargin: sd.bendMargin } : {}), ...(sd.poles ? { poles: sd.poles } : {}) },
    maxS,
    booster: true,
    ...(sd.topSpeedFactor !== undefined ? { topSpeedFactor: sd.topSpeedFactor } : {}),
    onStep: (s) => {
      const p = s.pose;
      x.push(p.frontXM);
      z.push(p.frontZM);
      heading.push(p.headingRad);
      travel.push(p.travelRad);
      speed.push(s.state.speedMps);
      burn.push(s.hud.booster?.state === 'firing' ? 1 : 0);
    },
  });
  if (!r.finished) throw new Error(`Level "${def.id}": the Scavenger (${sd.build.chassisId}, ${sd.build.wheelsId}, ${sd.build.motorId}) does not finish within ${maxS} s`);
  const run = build(
    def, content,
    { dtS: physicsConstants(content).timeStepS, x: Float64Array.from(x), z: Float64Array.from(z), heading: Float64Array.from(heading), travel: Float64Array.from(travel), speed: Float64Array.from(speed), burn: Uint8Array.from(burn) },
    r.timeS,
    r.session.stretches,
    r.session.events.filter((e) => e.kind === 'booster').map((e) => e.timeS),
  );
  cache.set(key, run);
  return run;
}

/** Test hook: forget the cached runs. */
export function clearScavengerCache(): void {
  cache.clear();
}
