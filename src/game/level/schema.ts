import type { GravityKind, PointM } from '../../content/index.ts';
import {
  ATMOSPHERE_IDS, LEVEL_IDS,
  type BarrierDef, type BoostDef, type CannonDef, type CheckpointDef, type CraterDef, type FinishDef, type ForkDef, type ForkLineDef,
  type GravityZoneDef, type HillDef, type HintDef, type HintDone, type HintTrigger, type LevelDef, type LevelId, type PylonDef,
  type RampDef, type RidgeDef, type RoadDef, type RoadSegment, type SampleDef, type SignDef, type SurfaceZoneDef, type WaterDef,
  type Pose, type ScavengerDef, type StretchDef,
} from './types.ts';

// Level file validation (NFR-5). Throws `Content error at <path>: <problem>` like the rest of the content loaders.

type Obj = Record<string, unknown>;

function fail(path: string, problem: string): never {
  throw new Error(`Content error at ${path}: ${problem}`);
}

function obj(value: unknown, path: string): Obj {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, 'expected an object');
  return value as Obj;
}

function list(value: unknown, path: string): unknown[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) fail(path, 'expected a list');
  return value;
}

function num(o: Obj, key: string, path: string): number {
  const v = o[key];
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(`${path}.${key}`, 'expected a number');
  return v;
}

function pos(o: Obj, key: string, path: string): number {
  const v = num(o, key, path);
  if (v <= 0) fail(`${path}.${key}`, 'expected a number above 0');
  return v;
}

function optPos(o: Obj, key: string, path: string): number | undefined {
  return o[key] === undefined ? undefined : pos(o, key, path);
}

function str(o: Obj, key: string, path: string): string {
  const v = o[key];
  if (typeof v !== 'string' || v === '') fail(`${path}.${key}`, 'expected a non-empty string');
  return v;
}

function oneOf<T extends string>(o: Obj, key: string, path: string, allowed: readonly T[]): T {
  const v = str(o, key, path);
  if (!(allowed as readonly string[]).includes(v)) fail(`${path}.${key}`, `unknown value "${v}" (expected one of ${allowed.join(', ')})`);
  return v as T;
}

function optStr(o: Obj, key: string, path: string): string | undefined {
  return o[key] === undefined ? undefined : str(o, key, path);
}

function pose(raw: unknown, path: string): Pose {
  const o = obj(raw, path);
  return { xM: num(o, 'xM', path), zM: num(o, 'zM', path), headingDeg: num(o, 'headingDeg', path) };
}

function polygon(raw: unknown, path: string): PointM[] {
  const pts = list(raw, path);
  if (pts.length < 3) fail(path, 'a polygon needs at least 3 points');
  return pts.map((p, i) => {
    const o = obj(p, `${path}[${i}]`);
    return { xM: num(o, 'xM', `${path}[${i}]`), zM: num(o, 'zM', `${path}[${i}]`) };
  });
}

function segment(raw: unknown, path: string): RoadSegment {
  const o = obj(raw, path);
  if (o.kind === 'straight') return { kind: 'straight', lengthM: pos(o, 'lengthM', path) };
  if (o.kind === 'arc') {
    const angleDeg = num(o, 'angleDeg', path);
    if (angleDeg === 0 || Math.abs(angleDeg) > 360) fail(`${path}.angleDeg`, 'expected a turn between 0 and 360 degrees, left (+) or right (−)');
    return { kind: 'arc', radiusM: pos(o, 'radiusM', path), angleDeg };
  }
  return fail(`${path}.kind`, 'expected "straight" or "arc"');
}

function road(raw: unknown, path: string): RoadDef {
  const o = obj(raw, path);
  const segments = list(o.segments, `${path}.segments`).map((s, i) => segment(s, `${path}.segments[${i}]`));
  if (segments.length === 0) fail(`${path}.segments`, 'a road needs at least one segment');
  const start = o.start === undefined ? undefined : pose(o.start, `${path}.start`);
  const after = optStr(o, 'after', path);
  if (!start && !after) fail(path, 'a road needs `start` or `after`');
  const widthM = optPos(o, 'widthM', path);
  const runoffM = optPos(o, 'runoffM', path);
  const surfaceId = optStr(o, 'surfaceId', path);
  const runoffSurfaceId = optStr(o, 'runoffSurfaceId', path);
  const name = optStr(o, 'name', path);
  let gap: { fromM: number; toM: number } | undefined;
  if (o.gap !== undefined) {
    const g = obj(o.gap, `${path}.gap`);
    gap = { fromM: num(g, 'fromM', `${path}.gap`), toM: num(g, 'toM', `${path}.gap`) };
    if (gap.fromM < 0 || gap.toM <= gap.fromM) fail(`${path}.gap`, 'expected 0 <= fromM < toM');
  }
  return {
    id: str(o, 'id', path),
    ...(name ? { name } : {}),
    ...(widthM !== undefined ? { widthM } : {}),
    ...(runoffM !== undefined ? { runoffM } : {}),
    ...(surfaceId ? { surfaceId } : {}),
    ...(runoffSurfaceId ? { runoffSurfaceId } : {}),
    ...(gap ? { gap } : {}),
    ...(start ? { start } : {}),
    ...(after ? { after } : {}),
    segments,
  };
}

const hill = (raw: unknown, path: string): HillDef => {
  const o = obj(raw, path);
  return { xM: num(o, 'xM', path), zM: num(o, 'zM', path), radiusM: pos(o, 'radiusM', path), heightM: pos(o, 'heightM', path) };
};

const crater = (raw: unknown, path: string): CraterDef => {
  const o = obj(raw, path);
  const wallAngleDeg = pos(o, 'wallAngleDeg', path);
  const rampAngleDeg = pos(o, 'rampAngleDeg', path);
  if (wallAngleDeg >= 90) fail(`${path}.wallAngleDeg`, 'must be below 90');
  if (rampAngleDeg > wallAngleDeg) fail(`${path}.rampAngleDeg`, 'must not be steeper than the wall');
  return {
    xM: num(o, 'xM', path), zM: num(o, 'zM', path), floorRadiusM: pos(o, 'floorRadiusM', path), depthM: pos(o, 'depthM', path),
    wallAngleDeg, rampAngleDeg, rampHeadingDeg: num(o, 'rampHeadingDeg', path),
  };
};

const ridge = (raw: unknown, path: string): RidgeDef => {
  const o = obj(raw, path);
  const riseAngleDeg = pos(o, 'riseAngleDeg', path);
  const fallAngleDeg = pos(o, 'fallAngleDeg', path);
  if (riseAngleDeg >= 90 || fallAngleDeg >= 90) fail(path, 'angles must be below 90');
  return {
    xM: num(o, 'xM', path), zM: num(o, 'zM', path), headingDeg: num(o, 'headingDeg', path), riseAngleDeg,
    riseLengthM: pos(o, 'riseLengthM', path), topLengthM: num(o, 'topLengthM', path), fallAngleDeg, widthM: pos(o, 'widthM', path),
  };
};

const ramp = (raw: unknown, path: string): RampDef => {
  const o = obj(raw, path);
  const angleDeg = pos(o, 'angleDeg', path);
  if (angleDeg >= 45) fail(`${path}.angleDeg`, 'must be below 45');
  return {
    id: str(o, 'id', path), xM: num(o, 'xM', path), zM: num(o, 'zM', path), headingDeg: num(o, 'headingDeg', path), angleDeg,
    lengthM: pos(o, 'lengthM', path), widthM: pos(o, 'widthM', path),
  };
};

const water = (raw: unknown, path: string): WaterDef => {
  const o = obj(raw, path);
  return { id: str(o, 'id', path), polygon: polygon(o.polygon, `${path}.polygon`), depthM: pos(o, 'depthM', path) };
};

const surfaceZone = (raw: unknown, path: string): SurfaceZoneDef => {
  const o = obj(raw, path);
  return { surfaceId: str(o, 'surfaceId', path), polygon: polygon(o.polygon, `${path}.polygon`) };
};

const gravityZone = (raw: unknown, path: string): GravityZoneDef => {
  const o = obj(raw, path);
  const kind = o.kind;
  if (kind !== 'low' && kind !== 'high') fail(`${path}.kind`, 'expected "low" or "high"');
  const ceilingM = optPos(o, 'ceilingM', path);
  return { id: str(o, 'id', path), kind: kind as GravityKind, polygon: polygon(o.polygon, `${path}.polygon`), ...(ceilingM !== undefined ? { ceilingM } : {}) };
};

const pylon = (raw: unknown, path: string): PylonDef => {
  const o = obj(raw, path);
  if (o.pole !== 'N' && o.pole !== 'S') fail(`${path}.pole`, 'expected "N" or "S"');
  const switching = o.switching === undefined ? undefined : { phaseS: num(obj(o.switching, `${path}.switching`), 'phaseS', `${path}.switching`) };
  return { id: str(o, 'id', path), xM: num(o, 'xM', path), zM: num(o, 'zM', path), pole: o.pole as 'N' | 'S', ...(switching ? { switching } : {}) };
};

const boost = (raw: unknown, path: string): BoostDef => {
  const o = obj(raw, path);
  return { id: str(o, 'id', path), xM: num(o, 'xM', path), zM: num(o, 'zM', path), radiusM: optPos(o, 'radiusM', path) ?? 2 };
};

const cannon = (raw: unknown, path: string): CannonDef => {
  const o = obj(raw, path);
  if (o.kind !== 'headOn' && o.kind !== 'kicker') fail(`${path}.kind`, 'expected "headOn" or "kicker"');
  const triggerM = optPos(o, 'triggerM', path);
  return {
    id: str(o, 'id', path), kind: o.kind, xM: num(o, 'xM', path), zM: num(o, 'zM', path), directionDeg: num(o, 'directionDeg', path),
    ...(triggerM !== undefined ? { triggerM } : {}),
  };
};

const barrier = (raw: unknown, path: string): BarrierDef => {
  const o = obj(raw, path);
  if (o.look !== undefined && o.look !== 'boulder') fail(`${path}.look`, 'expected "boulder"');
  return {
    id: str(o, 'id', path), xM: num(o, 'xM', path), zM: num(o, 'zM', path), headingDeg: num(o, 'headingDeg', path),
    lengthM: pos(o, 'lengthM', path), widthM: pos(o, 'widthM', path), ...(o.look === 'boulder' ? { look: 'boulder' as const } : {}),
  };
};

const checkpoint = (raw: unknown, path: string): CheckpointDef => {
  const o = obj(raw, path);
  const radiusM = optPos(o, 'radiusM', path);
  return {
    id: str(o, 'id', path), xM: num(o, 'xM', path), zM: num(o, 'zM', path), headingDeg: num(o, 'headingDeg', path),
    ...(radiusM !== undefined ? { radiusM } : {}),
  };
};

const forkLine = (raw: unknown, path: string): ForkLineDef => {
  const o = obj(raw, path);
  return { xM: num(o, 'xM', path), zM: num(o, 'zM', path), headingDeg: num(o, 'headingDeg', path), widthM: pos(o, 'widthM', path) };
};

const fork = (raw: unknown, path: string): ForkDef => {
  const o = obj(raw, path);
  const ids = list(o.roadIds, `${path}.roadIds`);
  if (ids.length !== 2 || ids.some((id) => typeof id !== 'string')) fail(`${path}.roadIds`, 'expected two road ids');
  const m = obj(o.mergeAt, `${path}.mergeAt`);
  return {
    id: str(o, 'id', path), line: forkLine(o.line, `${path}.line`), roadIds: [ids[0] as string, ids[1] as string],
    mergeAt: { xM: num(m, 'xM', `${path}.mergeAt`), zM: num(m, 'zM', `${path}.mergeAt`), radiusM: pos(m, 'radiusM', `${path}.mergeAt`) },
  };
};

const sample = (raw: unknown, path: string): SampleDef => {
  const o = obj(raw, path);
  return { id: str(o, 'id', path), xM: num(o, 'xM', path), zM: num(o, 'zM', path) };
};

const sign = (raw: unknown, path: string): SignDef => {
  const o = obj(raw, path);
  return { id: str(o, 'id', path), xM: num(o, 'xM', path), zM: num(o, 'zM', path), radiusM: pos(o, 'radiusM', path) };
};

const hint = (raw: unknown, path: string): HintDef => {
  const o = obj(raw, path);
  const t = obj(o.trigger, `${path}.trigger`);
  let trigger: HintTrigger;
  if (t.kind === 'start') trigger = { kind: 'start' };
  else if (t.kind === 'coast') trigger = { kind: 'coast' };
  else if (t.kind === 'zone') trigger = { kind: 'zone', xM: num(t, 'xM', `${path}.trigger`), zM: num(t, 'zM', `${path}.trigger`), radiusM: pos(t, 'radiusM', `${path}.trigger`) };
  else return fail(`${path}.trigger.kind`, 'expected "start", "coast" or "zone"');
  const done = o.doneWhen;
  if (done !== 'throttle' && done !== 'release' && done !== 'steer' && done !== 'brake') fail(`${path}.doneWhen`, 'expected "throttle", "release", "steer" or "brake"');
  const maxS = optPos(o, 'maxS', path);
  return { id: str(o, 'id', path), textId: str(o, 'textId', path), trigger, doneWhen: done as HintDone, ...(maxS !== undefined ? { maxS } : {}) };
};

const finish = (raw: unknown, path: string): FinishDef => {
  const o = obj(raw, path);
  return { xM: num(o, 'xM', path), zM: num(o, 'zM', path), radiusM: pos(o, 'radiusM', path) };
};

const stretch = (raw: unknown, path: string): StretchDef => {
  const o = obj(raw, path);
  const startsAfterRoad = optStr(o, 'startsAfterRoad', path);
  return { id: str(o, 'id', path), name: str(o, 'name', path), ...(startsAfterRoad ? { startsAfterRoad } : {}), cleanS: pos(o, 'cleanS', path) };
};

const scavenger = (raw: unknown, path: string): ScavengerDef => {
  const o = obj(raw, path);
  const b = obj(o.build, `${path}.build`);
  const roads = list(o.roads, `${path}.roads`).map((r, i) => (typeof r === 'string' ? r : fail(`${path}.roads[${i}]`, 'expected a road id')));
  if (roads.length === 0) fail(`${path}.roads`, 'the Scavenger needs a route');
  const via = o.via === undefined ? undefined : list(o.via, `${path}.via`).map((p, i) => ({ xM: num(obj(p, `${path}.via[${i}]`), 'xM', `${path}.via[${i}]`), zM: num(obj(p, `${path}.via[${i}]`), 'zM', `${path}.via[${i}]`) }));
  const bendMargin = optPos(o, 'bendMargin', path);
  return {
    build: { chassisId: str(b, 'chassisId', `${path}.build`), wheelsId: str(b, 'wheelsId', `${path}.build`), motorId: str(b, 'motorId', `${path}.build`) },
    roads, ...(via ? { via } : {}), ...(bendMargin !== undefined ? { bendMargin } : {}), startDelayS: num(o, 'startDelayS', path),
  };
};

function each<T>(raw: unknown, path: string, parse: (item: unknown, path: string) => T): T[] {
  return list(raw, path).map((item, i) => parse(item, `${path}[${i}]`));
}

function unique(ids: string[], path: string): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) fail(path, `duplicate id "${id}"`);
    seen.add(id);
  }
}

/** Checks a level file and returns it with the optional lists filled in. `surfaceIds` are the known surfaces. */
export function validateLevelDef(raw: unknown, surfaceIds: readonly string[]): LevelDef {
  const o = obj(raw, 'level');
  const id = str(o, 'id', 'level');
  if (!(LEVEL_IDS as readonly string[]).includes(id)) fail('level.id', `unknown level id "${id}"`);
  const def: LevelDef = {
    id: id as LevelId,
    name: str(o, 'name', 'level'),
    placeholder: o.placeholder === true,
    atmosphere: oneOf(o, 'atmosphere', 'level', ATMOSPHERE_IDS),
    parS: pos(o, 'parS', 'level'),
    start: pose(o.start, 'level.start'),
    defaultSurfaceId: optStr(o, 'defaultSurfaceId', 'level') ?? 'asphalt',
    roads: each(o.roads, 'level.roads', road),
    route: list(o.route, 'level.route').map((r, i) => (typeof r === 'string' ? r : fail(`level.route[${i}]`, 'expected a road id'))),
    hills: each(o.hills, 'level.hills', hill),
    craters: each(o.craters, 'level.craters', crater),
    ridges: each(o.ridges, 'level.ridges', ridge),
    ramps: each(o.ramps, 'level.ramps', ramp),
    water: each(o.water, 'level.water', water),
    surfaceZones: each(o.surfaceZones, 'level.surfaceZones', surfaceZone),
    gravityZones: each(o.gravityZones, 'level.gravityZones', gravityZone),
    pylons: each(o.pylons, 'level.pylons', pylon),
    boosts: each(o.boosts, 'level.boosts', boost),
    cannons: each(o.cannons, 'level.cannons', cannon),
    barriers: each(o.barriers, 'level.barriers', barrier),
    checkpoints: each(o.checkpoints, 'level.checkpoints', checkpoint),
    forks: each(o.forks, 'level.forks', fork),
    samples: each(o.samples, 'level.samples', sample),
    signs: each(o.signs, 'level.signs', sign),
    hints: each(o.hints, 'level.hints', hint),
    finish: finish(o.finish, 'level.finish'),
    stretches: each(o.stretches, 'level.stretches', stretch),
    ...(o.scavenger === undefined ? {} : { scavenger: scavenger(o.scavenger, 'level.scavenger') }),
    ...(o.wreck === undefined ? {} : { wreck: pose(o.wreck, 'level.wreck') }),
  };

  if (def.roads.length === 0) fail('level.roads', 'a level needs at least one road');
  if (def.samples.length !== 3) fail('level.samples', 'a level has exactly 3 samples (A2)');
  if (def.route.length === 0) fail('level.route', 'a level needs a route');
  unique(def.roads.map((r) => r.id), 'level.roads');
  unique(def.samples.map((s) => s.id), 'level.samples');
  unique(def.checkpoints.map((c) => c.id), 'level.checkpoints');
  unique(def.forks.map((f) => f.id), 'level.forks');
  unique(def.pylons.map((p) => p.id), 'level.pylons');
  unique(def.boosts.map((b) => b.id), 'level.boosts');
  unique(def.ramps.map((r) => r.id), 'level.ramps');
  unique(def.cannons.map((c) => c.id), 'level.cannons');

  unique(def.stretches.map((s) => s.id), 'level.stretches');
  if (def.stretches.length > 0 && (def.stretches.length < 4 || def.stretches.length > 6)) fail('level.stretches', 'a level names 4 to 6 stretches (SHOWCASE_PLAN §9)');

  const roadIds = new Set(def.roads.map((r) => r.id));
  const needRoad = (rid: string, path: string) => {
    if (!roadIds.has(rid)) fail(path, `unknown road "${rid}"`);
  };
  const needSurface = (sid: string, path: string) => {
    if (!surfaceIds.includes(sid)) fail(path, `unknown surface "${sid}"`);
  };
  def.route.forEach((r, i) => needRoad(r, `level.route[${i}]`));
  def.roads.forEach((r, i) => {
    if (r.after) needRoad(r.after, `level.roads[${i}].after`);
    if (r.surfaceId) needSurface(r.surfaceId, `level.roads[${i}].surfaceId`);
    if (r.runoffSurfaceId) needSurface(r.runoffSurfaceId, `level.roads[${i}].runoffSurfaceId`);
  });
  // Each stretch after the first begins where a road of the route ends, in route order.
  let lastRouteIndex = -1;
  def.stretches.forEach((s, i) => {
    const path = `level.stretches[${i}]`;
    if (i === 0) {
      if (s.startsAfterRoad) fail(`${path}.startsAfterRoad`, 'the first stretch begins at the start');
      return;
    }
    if (!s.startsAfterRoad) fail(`${path}.startsAfterRoad`, 'expected a road id');
    const at = def.route.indexOf(s.startsAfterRoad);
    if (at < 0) fail(`${path}.startsAfterRoad`, `road "${s.startsAfterRoad}" is not on the route`);
    if (at <= lastRouteIndex) fail(`${path}.startsAfterRoad`, 'stretches must follow the route in order');
    lastRouteIndex = at;
  });
  def.scavenger?.roads.forEach((r, i) => needRoad(r, `level.scavenger.roads[${i}]`));
  needSurface(def.defaultSurfaceId, 'level.defaultSurfaceId');
  def.surfaceZones.forEach((z, i) => needSurface(z.surfaceId, `level.surfaceZones[${i}].surfaceId`));
  def.forks.forEach((f, i) => {
    f.roadIds.forEach((r, k) => needRoad(r, `level.forks[${i}].roadIds[${k}]`));
  });
  return def;
}
