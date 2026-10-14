import type {
  AreaLineKind,
  Constants,
  Content,
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

function num(o: Obj, key: string, path: string, opts: { min?: number; positive?: boolean } = {}): number {
  const v = o[key];
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(`${path}.${key}`, 'expected a number');
  if (opts.positive && v <= 0) fail(`${path}.${key}`, 'must be greater than 0');
  if (opts.min !== undefined && v < opts.min) fail(`${path}.${key}`, `must be at least ${opts.min}`);
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

/** Checks raw JSON and returns it as typed content. Throws with the path of the first problem. */
export function validateContent(raw: unknown): Content {
  const o = obj(raw, 'content');
  const checkedSurfaces = surfaces(o.surfaces);
  const checkedPowerUps = powerUps(o.powerUps);
  noDuplicates(checkedSurfaces, 'surfaces');
  noDuplicates(checkedPowerUps, 'powerUps');
  const content: Content = {
    constants: constants(o.constants),
    surfaces: checkedSurfaces,
    parts: parts(o.parts),
    powerUps: checkedPowerUps,
    missions: missions(o.missions),
    levels: levels(
      o.levels,
      checkedSurfaces.map((s) => s.id),
      checkedPowerUps.map((x) => x.id),
    ),
  };
  noDuplicates(content.parts, 'parts');
  return content;
}
