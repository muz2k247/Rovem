import type {
  Constants,
  Content,
  Mission1Params,
  Mission2Params,
  Mission3Params,
  Part,
  PowerUp,
  PowerUpVariable,
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
  return {
    gravityMps2: num(o, 'gravityMps2', p, { positive: true }),
    stepsPerSecond: num(o, 'stepsPerSecond', p, { positive: true }),
    throttleBuildUpS: num(o, 'throttleBuildUpS', p, { positive: true }),
    brakeBuildUpS: num(o, 'brakeBuildUpS', p, { positive: true }),
    maxBrakeForceN: num(o, 'maxBrakeForceN', p, { positive: true }),
    roverLengthM: num(o, 'roverLengthM', p, { positive: true }),
    turnRateDegPerS: num(o, 'turnRateDegPerS', p, { min: 0 }),
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
  const content: Content = {
    constants: constants(o.constants),
    surfaces: surfaces(o.surfaces),
    parts: parts(o.parts),
    powerUps: powerUps(o.powerUps),
    missions: missions(o.missions),
  };
  noDuplicates(content.surfaces, 'surfaces');
  noDuplicates(content.parts, 'parts');
  noDuplicates(content.powerUps, 'powerUps');
  return content;
}
