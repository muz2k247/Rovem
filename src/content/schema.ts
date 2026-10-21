import { EVENT_KINDS, FORMULA_KINDS, TRY_THIS_KEYS } from './types.ts';
import type {
  AreaLineKind,
  CannonKind,
  ChunkCannon,
  ChunkGravityZone,
  ChunkTile,
  ChunkZoneShape,
  Constants,
  Content,
  GravityKind,
  Level,
  LevelLine,
  Levels,
  Mission1Params,
  Mission2Params,
  Mission3Params,
  Part,
  PointM,
  PowerUp,
  PowerUpVariable,
  RectM,
  RunChunk,
  RunChunks,
  RunParams,
  RunText,
  SegmentLineKind,
  Slot,
  Surface,
} from './types.ts';

// Hand-written validators (NFR-5): content is data, checked when it loads. Every error names the
// path of the bad value so a data mistake can be found without a debugger.

type Obj = Record<string, unknown>;

function fail(path: string, problem: string): never {
  throw new Error(`Content error at ${path}: ${problem}`);
}

function obj(value: unknown, path: string): Obj {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, 'expected an object');
  return value as Obj;
}

function arr(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, 'expected a list');
  return value;
}

function str(o: Obj, key: string, path: string): string {
  const v = o[key];
  if (typeof v !== 'string' || v === '') fail(`${path}.${key}`, 'expected a non-empty string');
  return v;
}

function bool(o: Obj, key: string, path: string): boolean {
  const v = o[key];
  if (typeof v !== 'boolean') fail(`${path}.${key}`, 'expected true or false');
  return v;
}

function num(o: Obj, key: string, path: string, opts: { min?: number; max?: number; positive?: boolean } = {}): number {
  const v = o[key];
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(`${path}.${key}`, 'expected a number');
  if (opts.positive && v <= 0) fail(`${path}.${key}`, 'must be greater than 0');
  if (opts.min !== undefined && v < opts.min) fail(`${path}.${key}`, `must be at least ${opts.min}`);
  if (opts.max !== undefined && v > opts.max) fail(`${path}.${key}`, `must be at most ${opts.max}`);
  return v;
}

const SLOTS: readonly Slot[] = ['chassis', 'wheels', 'motor'];
const VARIABLES: readonly PowerUpVariable[] = [
  'massKg',
  'driveForceMaxN',
  'brakeForceMaxN',
  'rollingFactor',
  'gripFactor',
];

function constants(raw: unknown): Constants {
  const p = 'constants';
  const o = obj(raw, p);
  const fraction = num(o, 'reverseTopSpeedFraction', p, { positive: true });
  if (fraction > 1) fail(`${p}.reverseTopSpeedFraction`, 'must be at most 1 (reverse is never faster than forward)');
  return {
    gravityMps2: num(o, 'gravityMps2', p, { positive: true }),
    stepsPerSecond: num(o, 'stepsPerSecond', p, { positive: true }),
    throttleBuildUpS: num(o, 'throttleBuildUpS', p, { positive: true }),
    brakeBuildUpS: num(o, 'brakeBuildUpS', p, { positive: true }),
    maxBrakeForceN: num(o, 'maxBrakeForceN', p, { positive: true }),
    roverLengthM: num(o, 'roverLengthM', p, { positive: true }),
    roverWidthM: num(o, 'roverWidthM', p, { positive: true }),
    turnRateDegPerS: num(o, 'turnRateDegPerS', p, { min: 0 }),
    reverseTopSpeedFraction: fraction,
  };
}

function surfaces(raw: unknown): Surface[] {
  return arr(raw, 'surfaces').map((item, i) => {
    const p = `surfaces[${i}]`;
    const o = obj(item, p);
    return {
      id: str(o, 'id', p),
      name: str(o, 'name', p),
      rollingFriction: num(o, 'rollingFriction', p, { positive: true }),
      grip: num(o, 'grip', p, { positive: true }),
    };
  });
}

function parts(raw: unknown): Part[] {
  return arr(raw, 'parts').map((item, i) => {
    const p = `parts[${i}]`;
    const o = obj(item, p);
    const slot = str(o, 'slot', p);
    if (!(SLOTS as readonly string[]).includes(slot)) fail(`${p}.slot`, `must be one of ${SLOTS.join(', ')}`);
    const part: Part = {
      id: str(o, 'id', p),
      slot: slot as Slot,
      name: str(o, 'name', p),
      massKg: num(o, 'massKg', p, { positive: true }),
      startsUnlocked: bool(o, 'startsUnlocked', p),
      unlockCost: num(o, 'unlockCost', p, { min: 0 }),
    };
    if (slot === 'wheels') {
      part.rollingFactor = num(o, 'rollingFactor', p, { positive: true });
      part.gripFactor = num(o, 'gripFactor', p, { positive: true });
    }
    if (slot === 'motor') {
      part.driveForceMaxN = num(o, 'driveForceMaxN', p, { positive: true });
      part.topSpeedMps = num(o, 'topSpeedMps', p, { positive: true });
    }
    return part;
  });
}

function powerUps(raw: unknown): PowerUp[] {
  return arr(raw, 'powerUps').map((item, i) => {
    const p = `powerUps[${i}]`;
    const o = obj(item, p);
    const variable = str(o, 'variable', p);
    if (!(VARIABLES as readonly string[]).includes(variable)) {
      fail(`${p}.variable`, `must be one of ${VARIABLES.join(', ')}`);
    }
    const missionId = num(o, 'missionId', p);
    if (missionId !== 1 && missionId !== 2 && missionId !== 3) fail(`${p}.missionId`, 'must be 1, 2 or 3');
    return {
      id: str(o, 'id', p),
      missionId,
      name: str(o, 'name', p),
      variable: variable as PowerUpVariable,
      multiplier: num(o, 'multiplier', p, { positive: true }),
    };
  });
}

function missions(raw: unknown): Content['missions'] {
  const o = obj(raw, 'missions');
  const m1 = obj(o.mission1, 'missions.mission1');
  const m2 = obj(o.mission2, 'missions.mission2');
  const m3 = obj(o.mission3, 'missions.mission3');
  const mission1: Mission1Params = {
    asphaltRouteLengthM: num(m1, 'asphaltRouteLengthM', 'missions.mission1', { positive: true }),
    sandRouteLengthM: num(m1, 'sandRouteLengthM', 'missions.mission1', { positive: true }),
    timeLimitS: num(m1, 'timeLimitS', 'missions.mission1', { positive: true }),
  };
  const mission2: Mission2Params = {
    iceLengthM: num(m2, 'iceLengthM', 'missions.mission2', { positive: true }),
    iceTimeLimitS: num(m2, 'iceTimeLimitS', 'missions.mission2', { positive: true }),
    coastTargetM: num(m2, 'coastTargetM', 'missions.mission2', { positive: true }),
  };
  const mission3: Mission3Params = {
    approachSpeedMps: num(m3, 'approachSpeedMps', 'missions.mission3', { positive: true }),
    zoneLengthM: num(m3, 'zoneLengthM', 'missions.mission3', { positive: true }),
    brakeLineBeforeZoneEndM: num(m3, 'brakeLineBeforeZoneEndM', 'missions.mission3', { positive: true }),
  };
  return { mission1, mission2, mission3 };
}

const SEGMENT_KINDS: readonly SegmentLineKind[] = ['start', 'target', 'gate'];
const AREA_KINDS: readonly AreaLineKind[] = ['gridBox', 'zone'];

function point(raw: unknown, path: string): PointM {
  const o = obj(raw, path);
  return { xM: num(o, 'xM', path), zM: num(o, 'zM', path) };
}

function points(raw: unknown, path: string, min: number, what: string): PointM[] {
  const list = arr(raw, path);
  if (list.length < min) fail(path, `a ${what} needs at least ${min} points`);
  return list.map((p, i) => point(p, `${path}[${i}]`));
}

function oneOf(o: Obj, key: string, path: string, allowed: readonly string[]): string {
  const v = str(o, key, path);
  if (!allowed.includes(v)) fail(`${path}.${key}`, `"${v}" is not one of ${allowed.join(', ')}`);
  return v;
}

function emptyLayer(o: Obj, key: string, path: string): never[] {
  const list = arr(o[key], `${path}.${key}`);
  if (list.length > 0) fail(`${path}.${key}`, 'must be empty in the MVP (future scope)');
  return [];
}

/** One level file (DESIGN §8). Surface and power-up ids must exist in the rest of the content. */
function level(raw: unknown, p: string, surfaceIds: readonly string[], powerUpIds: readonly string[]): Level {
  const o = obj(raw, p);
  const placeholder = o.placeholder === undefined ? false : bool(o, 'placeholder', p);
  const start = obj(o.start, `${p}.start`);
  const lines = arr(o.lines, `${p}.lines`).map((item, i): LevelLine => {
    const lp = `${p}.lines[${i}]`;
    const l = obj(item, lp);
    const id = str(l, 'id', lp);
    const kind = oneOf(l, 'kind', lp, [...SEGMENT_KINDS, ...AREA_KINDS]);
    if ((AREA_KINDS as readonly string[]).includes(kind)) {
      return { id, kind: kind as AreaLineKind, polygon: points(l.polygon, `${lp}.polygon`, 3, 'polygon') };
    }
    return { id, kind: kind as SegmentLineKind, from: point(l.from, `${lp}.from`), to: point(l.to, `${lp}.to`) };
  });
  noDuplicates(lines, `${p}.lines`);
  return {
    name: str(o, 'name', p),
    placeholder,
    start: { xM: num(start, 'xM', `${p}.start`), zM: num(start, 'zM', `${p}.start`), headingDeg: num(start, 'headingDeg', `${p}.start`) },
    defaultSurfaceId: oneOf(o, 'defaultSurfaceId', p, surfaceIds),
    surfaces: arr(o.surfaces, `${p}.surfaces`).map((item, i) => {
      const sp = `${p}.surfaces[${i}]`;
      const s = obj(item, sp);
      return { surfaceId: oneOf(s, 'surfaceId', sp, surfaceIds), polygon: points(s.polygon, `${sp}.polygon`, 3, 'polygon') };
    }),
    props: arr(o.props, `${p}.props`).map((item, i) => {
      const pp = `${p}.props[${i}]`;
      const r = obj(item, pp);
      oneOf(r, 'kind', pp, ['rock']);
      return { kind: 'rock' as const, xM: num(r, 'xM', pp), zM: num(r, 'zM', pp), radiusM: num(r, 'radiusM', pp, { positive: true }) };
    }),
    pickups: arr(o.pickups, `${p}.pickups`).map((item, i) => {
      const pp = `${p}.pickups[${i}]`;
      const k = obj(item, pp);
      return {
        powerUpId: oneOf(k, 'powerUpId', pp, powerUpIds),
        xM: num(k, 'xM', pp),
        zM: num(k, 'zM', pp),
        radiusM: num(k, 'radiusM', pp, { positive: true }),
      };
    }),
    lines,
    path: points(o.path, `${p}.path`, 2, 'path'),
    hazards: emptyLayer(o, 'hazards', p),
    modifiers: emptyLayer(o, 'modifiers', p),
  };
}

const LEVEL_NAMES: readonly (keyof Levels)[] = ['testCourse'];

function levels(raw: unknown, surfaceIds: readonly string[], powerUpIds: readonly string[]): Levels {
  const o = obj(raw, 'levels');
  for (const name of Object.keys(o)) {
    if (!(LEVEL_NAMES as readonly string[]).includes(name)) fail(`levels.${name}`, 'unknown level');
  }
  const out: Partial<Levels> = {};
  for (const name of LEVEL_NAMES) {
    if (o[name] === undefined) fail(`levels.${name}`, 'missing level');
    out[name] = level(o[name], `levels.${name}`, surfaceIds, powerUpIds);
  }
  return out as Levels;
}

function noDuplicates(items: { id: string }[], path: string): void {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) fail(path, `duplicate id "${item.id}"`);
    seen.add(item.id);
  }
}

// ---- Demo v3: endless canyon run (docs/DEMO_BUILD_PLAN.md A3, A10, A11) ----

function range(raw: unknown, path: string): [number, number] {
  const list = arr(raw, path);
  if (list.length !== 2 || list.some((x) => typeof x !== 'number' || !Number.isFinite(x))) {
    fail(path, 'expected [from, to], two numbers');
  }
  return [list[0] as number, list[1] as number];
}

function run(raw: unknown): RunParams {
  const p = 'run';
  const o = obj(raw, p);
  const s = obj(o.sandbag, `${p}.sandbag`);
  const sp = `${p}.sandbag`;
  const g = obj(o.gravityMultipliers, `${p}.gravityMultipliers`);
  const starts = arr(o.difficultyStartsM, `${p}.difficultyStartsM`);
  if (starts.length !== 3 || starts.some((x) => typeof x !== 'number' || !Number.isFinite(x))) {
    fail(`${p}.difficultyStartsM`, 'expected three numbers (where difficulty 1, 2 and 3 start)');
  }
  const [d1, d2, d3] = starts as [number, number, number];
  if (d1 < 0 || !(d1 < d2 && d2 < d3)) fail(`${p}.difficultyStartsM`, 'must start at 0 or more and rise: difficulty 1, then 2, then 3');
  const between = num(o, 'fieldChunksBetweenTunnels', p, { positive: true });
  if (!Number.isInteger(between)) fail(`${p}.fieldChunksBetweenTunnels`, 'must be a whole number');
  const bends = obj(o.minBendRadiusM, `${p}.minBendRadiusM`);
  const minBendRadiusM: Record<string, number> = {};
  for (const id of Object.keys(bends)) minBendRadiusM[id] = num(bends, id, `${p}.minBendRadiusM`, { positive: true });
  return {
    corridorHalfWidthM: num(o, 'corridorHalfWidthM', p, { positive: true }),
    warmUpLengthM: num(o, 'warmUpLengthM', p, { min: 0 }),
    steerReturnToStraight: bool(o, 'steerReturnToStraight', p),
    reverseTopSpeedFactor: num(o, 'reverseTopSpeedFactor', p, { positive: true }),
    drift: bool(o, 'drift', p),
    startWallXM: num(o, 'startWallXM', p, { max: 0 }),
    fieldChunksBetweenTunnels: between,
    sectionMinLengthM: num(o, 'sectionMinLengthM', p, { positive: true }),
    mudPatchMaxLengthM: num(o, 'mudPatchMaxLengthM', p, { positive: true }),
    minBendRadiusM,
    difficultyStartsM: [d1, d2, d3],
    gravityMultipliers: {
      low: num(g, 'low', `${p}.gravityMultipliers`, { positive: true }),
      high: num(g, 'high', `${p}.gravityMultipliers`, { positive: true }),
    },
    boostImpulseNs: num(o, 'boostImpulseNs', p, { positive: true }),
    sandbag: {
      massKg: num(s, 'massKg', sp, { positive: true }),
      radiusM: num(s, 'radiusM', sp, { positive: true }),
      headOnSpeedMps: num(s, 'headOnSpeedMps', sp, { positive: true }),
      kickerSpeedMps: num(s, 'kickerSpeedMps', sp, { positive: true }),
      fireIntervalS: num(s, 'fireIntervalS', sp, { positive: true }),
      headOnTriggerDistanceM: num(s, 'headOnTriggerDistanceM', sp, { positive: true }),
      kickerShots: num(s, 'kickerShots', sp, { positive: true }),
      kickerWakeRearOffsetM: num(s, 'kickerWakeRearOffsetM', sp, { positive: true }),
      rangeM: num(s, 'rangeM', sp, { positive: true }),
    },
  };
}

/** A rectangle: from < to on both axes, inside the chunk in x and inside the corridor in z. */
function rect(raw: unknown, path: string, lengthM: number, halfWidthM: number): RectM {
  const o = obj(raw, path);
  const xM = range(o.xM, `${path}.xM`);
  const zM = range(o.zM, `${path}.zM`);
  if (!(xM[0] < xM[1])) fail(`${path}.xM`, 'from must be less than to');
  if (!(zM[0] < zM[1])) fail(`${path}.zM`, 'from must be less than to');
  if (xM[0] < 0 || xM[1] > lengthM) fail(`${path}.xM`, `must lie inside the chunk (0 to ${lengthM} m)`);
  if (zM[0] < -halfWidthM || zM[1] > halfWidthM) fail(`${path}.zM`, `must lie inside the corridor (±${halfWidthM} m)`);
  return { xM, zM };
}

function chunkPoint(raw: unknown, path: string, lengthM: number, halfWidthM: number): PointM {
  const o = obj(raw, path);
  const xM = num(o, 'xM', path);
  const zM = num(o, 'zM', path);
  if (xM < 0 || xM > lengthM) fail(`${path}.xM`, `must lie inside the chunk (0 to ${lengthM} m)`);
  if (Math.abs(zM) > halfWidthM) fail(`${path}.zM`, `must lie inside the corridor (±${halfWidthM} m)`);
  return { xM, zM };
}

/**
 * A ground or gravity zone: a rectangle (`xM`, `zM` ranges, so old data still loads) or a `polygon` of at least 3 points.
 * Either way the result has the polygon, and the ranges are its bounding box (P3, SHOWCASE_PLAN §4).
 */
function zoneShape(raw: unknown, path: string, lengthM: number, halfWidthM: number): ChunkZoneShape {
  const o = obj(raw, path);
  if (o.polygon === undefined) {
    const r = rect(raw, path, lengthM, halfWidthM);
    const polygon: PointM[] = [
      { xM: r.xM[0], zM: r.zM[0] },
      { xM: r.xM[1], zM: r.zM[0] },
      { xM: r.xM[1], zM: r.zM[1] },
      { xM: r.xM[0], zM: r.zM[1] },
    ];
    return { ...r, polygon };
  }
  if (o.xM !== undefined || o.zM !== undefined) fail(path, 'give either xM and zM or a polygon, not both');
  const points = arr(o.polygon, `${path}.polygon`);
  if (points.length < 3) fail(`${path}.polygon`, 'needs at least 3 points');
  const polygon = points.map((pt, i) => chunkPoint(pt, `${path}.polygon[${i}]`, lengthM, halfWidthM));
  const xs = polygon.map((pt) => pt.xM);
  const zs = polygon.map((pt) => pt.zM);
  const xM: [number, number] = [Math.min(...xs), Math.max(...xs)];
  const zM: [number, number] = [Math.min(...zs), Math.max(...zs)];
  if (!(xM[0] < xM[1]) || !(zM[0] < zM[1])) fail(`${path}.polygon`, 'must cover some area');
  return { xM, zM, polygon };
}

function chunk(raw: unknown, path: string, run: RunParams, surfaceIds: readonly string[]): RunChunk {
  const o = obj(raw, path);
  const lengthM = num(o, 'lengthM', path, { positive: true });
  if (lengthM < run.sectionMinLengthM) fail(`${path}.lengthM`, `a section is at least ${run.sectionMinLengthM} m long`);
  const halfWidthM = run.corridorHalfWidthM;
  const difficulty = num(o, 'difficulty', path);
  if (![1, 2, 3].includes(difficulty)) fail(`${path}.difficulty`, 'must be 1, 2 or 3');
  const entryPostXM = num(o, 'entryPostXM', path, { min: 0 });
  if (entryPostXM > lengthM) fail(`${path}.entryPostXM`, 'must lie inside the section');
  const line = arr(o.line, `${path}.line`).map((item, i) => chunkPoint(item, `${path}.line[${i}]`, lengthM, halfWidthM));
  if (line.length < 2) fail(`${path}.line`, 'needs at least 2 points');
  for (let i = 1; i < line.length; i++) if (!(line[i]!.xM > line[i - 1]!.xM)) fail(`${path}.line[${i}].xM`, 'must be further on than the point before');
  const list = (key: string) => arr(o[key], `${path}.${key}`);
  const tiles = list('tiles').map((item, i): ChunkTile => {
    const tp = `${path}.tiles[${i}]`;
    const shape = zoneShape(item, tp, lengthM, halfWidthM);
    const surfaceId = oneOf(obj(item, tp), 'surfaceId', tp, surfaceIds);
    if (surfaceId === 'mud' && shape.xM[1] - shape.xM[0] > run.mudPatchMaxLengthM) {
      fail(tp, `a mud patch is at most ${run.mudPatchMaxLengthM} m long`);
    }
    return { ...shape, surfaceId };
  });
  return {
    id: str(o, 'id', path),
    place: str(o, 'place', path),
    name: str(o, 'name', path),
    difficulty,
    lengthM,
    entryPostXM,
    line,
    tiles,
    barriers: list('barriers').map((item, i) => rect(item, `${path}.barriers[${i}]`, lengthM, halfWidthM)),
    boostPads: list('boostPads').map((item, i) => rect(item, `${path}.boostPads[${i}]`, lengthM, halfWidthM)),
    cannons: list('cannons').map((item, i): ChunkCannon => {
      const cp = `${path}.cannons[${i}]`;
      const c = obj(item, cp);
      const kind = oneOf(c, 'kind', cp, CANNON_KINDS) as CannonKind;
      const xM = num(c, 'xM', cp);
      const zM = num(c, 'zM', cp);
      if (xM < 0 || xM > lengthM) fail(`${cp}.xM`, `must lie inside the chunk (0 to ${lengthM} m)`);
      if (Math.abs(zM) > halfWidthM) fail(`${cp}.zM`, `must lie inside the corridor (±${halfWidthM} m)`);
      return { kind, xM, zM };
    }),
    gravityZones: list('gravityZones').map((item, i): ChunkGravityZone => {
      const zp = `${path}.gravityZones[${i}]`;
      return { ...zoneShape(item, zp, lengthM, halfWidthM), kind: oneOf(obj(item, zp), 'kind', zp, GRAVITY_KINDS) as GravityKind };
    }),
  };
}

const CANNON_KINDS: readonly CannonKind[] = ['headOn', 'kicker'];
const GRAVITY_KINDS: readonly GravityKind[] = ['low', 'high'];

function runChunks(raw: unknown, runParams: RunParams, surfaceIds: readonly string[]): RunChunks {
  const o = obj(raw, 'runChunks');
  const fieldChunks = arr(o.fieldChunks, 'runChunks.fieldChunks').map((item, i) =>
    chunk(item, `runChunks.fieldChunks[${i}]`, runParams, surfaceIds),
  );
  noDuplicates(fieldChunks, 'runChunks.fieldChunks');
  for (const d of [1, 2, 3]) {
    if (!fieldChunks.some((c) => c.difficulty === d)) fail('runChunks.fieldChunks', `no chunk of difficulty ${d}`);
  }
  if (new Set(fieldChunks.map((c) => c.place)).size < 2) fail('runChunks.fieldChunks', 'needs at least 2 places so the same place is never used twice in a row');
  return { fieldChunks, tunnel: chunk(o.tunnel, 'runChunks.tunnel', runParams, surfaceIds) };
}

function textMap<K extends string>(raw: unknown, path: string, keys: readonly K[]): Record<K, string> {
  const o = obj(raw, path);
  const out = {} as Record<K, string>;
  for (const k of keys) out[k] = str(o, k, path);
  return out;
}

function runText(raw: unknown): RunText {
  const p = 'runText';
  const o = obj(raw, p);
  const b = obj(o.briefing, `${p}.briefing`);
  const hazards = arr(b.hazards, `${p}.briefing.hazards`);
  if (hazards.length === 0) fail(`${p}.briefing.hazards`, 'needs at least one line');
  hazards.forEach((h, i) => {
    if (typeof h !== 'string' || h === '') fail(`${p}.briefing.hazards[${i}]`, 'expected a non-empty string');
  });
  return {
    placeholder: bool(o, 'placeholder', p),
    briefing: { headline: str(b, 'headline', `${p}.briefing`), hazards: hazards as string[] },
    tidbits: textMap(o.tidbits, `${p}.tidbits`, EVENT_KINDS),
    titles: textMap(o.titles, `${p}.titles`, EVENT_KINDS),
    formulas: textMap(o.formulas, `${p}.formulas`, FORMULA_KINDS),
    tunnelQuestion: str(o, 'tunnelQuestion', p),
    tryThis: textMap(o.tryThis, `${p}.tryThis`, TRY_THIS_KEYS),
  };
}

/** Checks raw JSON and returns it as typed content. Throws with the path of the first problem. */
export function validateContent(raw: unknown): Content {
  const o = obj(raw, 'content');
  const checkedSurfaces = surfaces(o.surfaces);
  const checkedPowerUps = powerUps(o.powerUps);
  noDuplicates(checkedSurfaces, 'surfaces');
  noDuplicates(checkedPowerUps, 'powerUps');
  const checkedParts = parts(o.parts);
  const checkedRun = run(o.run);
  const content: Content = {
    constants: constants(o.constants),
    surfaces: checkedSurfaces,
    parts: checkedParts,
    powerUps: checkedPowerUps,
    missions: missions(o.missions),
    levels: levels(
      o.levels,
      checkedSurfaces.map((s) => s.id),
      checkedPowerUps.map((x) => x.id),
    ),
    run: checkedRun,
    runChunks: runChunks(o.runChunks, checkedRun, checkedSurfaces.map((x) => x.id)),
    runText: runText(o.runText),
  };
  noDuplicates(content.parts, 'parts');
  return content;
}
