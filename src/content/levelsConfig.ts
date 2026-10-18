import levelsJson from './levels.json' with { type: 'json' };

// The shared Game v4 values (LEVELS_BUILD_PLAN A6, A10), validated when they load (NFR-5).
// Kept apart from `schema.ts` so the level tracks can extend the level-file schema without touching this.

export const FORCE_KINDS = [
  'push',
  'brake',
  'friction',
  'drag',
  'weight',
  'slope',
  'upthrust',
  'turning',
  'magnet',
  'impulse',
] as const;
export type ForceKind = (typeof FORCE_KINDS)[number];

export interface LevelsConfig {
  crater: { depthM: number; wallAngleDeg: number; rampAngleDeg: number };
  hills: { maxHeightM: number; minLengthM: number; minCrestRadiusM: number };
  ringRoad: { radiiM: number[]; widthM: number; ringRadiusM: number; ringArcDeg: number; laps: number };
  water: {
    densityKgPerM3: number;
    roverVolumeM3: number;
    submersionHeightM: number;
    dragNsPerM: number;
    depthsM: number[];
    channelWidthM: number;
  };
  magnet: {
    maxForceN: number;
    fullWithinM: number;
    cutoffM: number;
    cycleOnS: number;
    cycleOffS: number;
    sidewaysCutoffMps: number;
    startPole: 'N' | 'S';
  };
  track: { widthM: number; runoffWidthM: number };
  pacing: { levelLengthMinS: number; levelLengthMaxS: number; checkpointSpacingS: number };
  par: { factor: number; roundUpToS: number };
  /** Engine rules added by Levels B2 (all positive; see the DECISIONS row of 2026-10-18). */
  rules: {
    crashMomentS: number;
    floatStopMps: number;
    sampleRadiusM: number;
    checkpointRadiusM: number;
    captionShowS: number;
    hintMaxS: number;
    coastHintMinMps: number;
    signLookAheadM: number;
    steepSlopeDeg: number;
    descentMinDropM: number;
    magnetCaptionMinN: number;
    bendCaptionMinMps: number;
    whatIfTimeoutS: number;
  };
  captions: { minShowS: number; maxLines: number };
  forceLine: { minAccelMps2: number; minDurationS: number; balancedShowS: number };
  arrows: {
    baseLengthM: number;
    perForceM: number;
    referenceForceN: number;
    maxLengthM: number;
    hideBelowN: number;
    flashS: number;
    colours: Record<ForceKind, string>;
  };
  developerUnlockQuery: string;
}

type Obj = Record<string, unknown>;

function fail(path: string, problem: string): never {
  throw new Error(`Content error at ${path}: ${problem}`);
}

function obj(value: unknown, path: string): Obj {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, 'expected an object');
  return value as Obj;
}

function num(o: Obj, key: string, path: string): number {
  const v = o[key];
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) fail(`${path}.${key}`, 'expected a positive number');
  return v;
}

function nums(o: Obj, key: string, path: string): number[] {
  const v = o[key];
  if (!Array.isArray(v) || v.length === 0) fail(`${path}.${key}`, 'expected a non-empty list of numbers');
  v.forEach((x, i) => {
    if (typeof x !== 'number' || !Number.isFinite(x) || x <= 0) fail(`${path}.${key}[${i}]`, 'expected a positive number');
  });
  return v as number[];
}

function text(o: Obj, key: string, path: string): string {
  const v = o[key];
  if (typeof v !== 'string' || v === '') fail(`${path}.${key}`, 'expected a non-empty string');
  return v;
}

export function validateLevelsConfig(raw: unknown): LevelsConfig {
  const root = obj(raw, 'levels');
  const sec = (name: string) => obj(root[name], `levels.${name}`);
  const p = (name: string) => `levels.${name}`;

  const cr = sec('crater');
  const crater = {
    depthM: num(cr, 'depthM', p('crater')),
    wallAngleDeg: num(cr, 'wallAngleDeg', p('crater')),
    rampAngleDeg: num(cr, 'rampAngleDeg', p('crater')),
  };
  if (crater.wallAngleDeg >= 90) fail('levels.crater.wallAngleDeg', 'must be below 90');
  if (crater.rampAngleDeg >= crater.wallAngleDeg) fail('levels.crater.rampAngleDeg', 'must be gentler than the wall');

  const hi = sec('hills');
  const hills = {
    maxHeightM: num(hi, 'maxHeightM', p('hills')),
    minLengthM: num(hi, 'minLengthM', p('hills')),
    minCrestRadiusM: num(hi, 'minCrestRadiusM', p('hills')),
  };

  const rr = sec('ringRoad');
  const ringRoad = {
    radiiM: nums(rr, 'radiiM', p('ringRoad')),
    widthM: num(rr, 'widthM', p('ringRoad')),
    ringRadiusM: num(rr, 'ringRadiusM', p('ringRoad')),
    ringArcDeg: num(rr, 'ringArcDeg', p('ringRoad')),
    laps: num(rr, 'laps', p('ringRoad')),
  };
  if (!ringRoad.radiiM.includes(ringRoad.ringRadiusM)) fail('levels.ringRoad.ringRadiusM', 'must be one of radiiM');
  if (ringRoad.ringArcDeg > 360) fail('levels.ringRoad.ringArcDeg', 'must be at most 360');

  const wa = sec('water');
  const water = {
    densityKgPerM3: num(wa, 'densityKgPerM3', p('water')),
    roverVolumeM3: num(wa, 'roverVolumeM3', p('water')),
    submersionHeightM: num(wa, 'submersionHeightM', p('water')),
    dragNsPerM: num(wa, 'dragNsPerM', p('water')),
    depthsM: nums(wa, 'depthsM', p('water')),
    channelWidthM: num(wa, 'channelWidthM', p('water')),
  };

  const mg = sec('magnet');
  const pole: 'N' | 'S' = mg.startPole === 'N' ? 'N' : mg.startPole === 'S' ? 'S' : fail('levels.magnet.startPole', 'expected "N" or "S"');
  const magnet = {
    maxForceN: num(mg, 'maxForceN', p('magnet')),
    fullWithinM: num(mg, 'fullWithinM', p('magnet')),
    cutoffM: num(mg, 'cutoffM', p('magnet')),
    cycleOnS: num(mg, 'cycleOnS', p('magnet')),
    cycleOffS: num(mg, 'cycleOffS', p('magnet')),
    sidewaysCutoffMps: num(mg, 'sidewaysCutoffMps', p('magnet')),
    startPole: pole,
  };
  if (magnet.cutoffM <= magnet.fullWithinM) fail('levels.magnet.cutoffM', 'must be beyond fullWithinM');

  const tr = sec('track');
  const track = { widthM: num(tr, 'widthM', p('track')), runoffWidthM: num(tr, 'runoffWidthM', p('track')) };

  const pa = sec('pacing');
  const pacing = {
    levelLengthMinS: num(pa, 'levelLengthMinS', p('pacing')),
    levelLengthMaxS: num(pa, 'levelLengthMaxS', p('pacing')),
    checkpointSpacingS: num(pa, 'checkpointSpacingS', p('pacing')),
  };
  if (pacing.levelLengthMaxS < pacing.levelLengthMinS) fail('levels.pacing.levelLengthMaxS', 'must not be below the minimum');

  const pr = sec('par');
  const par = { factor: num(pr, 'factor', p('par')), roundUpToS: num(pr, 'roundUpToS', p('par')) };

  const ru = sec('rules');
  const rules = {
    crashMomentS: num(ru, 'crashMomentS', p('rules')),
    floatStopMps: num(ru, 'floatStopMps', p('rules')),
    sampleRadiusM: num(ru, 'sampleRadiusM', p('rules')),
    checkpointRadiusM: num(ru, 'checkpointRadiusM', p('rules')),
    captionShowS: num(ru, 'captionShowS', p('rules')),
    hintMaxS: num(ru, 'hintMaxS', p('rules')),
    coastHintMinMps: num(ru, 'coastHintMinMps', p('rules')),
    signLookAheadM: num(ru, 'signLookAheadM', p('rules')),
    steepSlopeDeg: num(ru, 'steepSlopeDeg', p('rules')),
    descentMinDropM: num(ru, 'descentMinDropM', p('rules')),
    magnetCaptionMinN: num(ru, 'magnetCaptionMinN', p('rules')),
    bendCaptionMinMps: num(ru, 'bendCaptionMinMps', p('rules')),
    whatIfTimeoutS: num(ru, 'whatIfTimeoutS', p('rules')),
  };

  const ca = sec('captions');
  const captions = { minShowS: num(ca, 'minShowS', p('captions')), maxLines: num(ca, 'maxLines', p('captions')) };

  const fl = sec('forceLine');
  const forceLine = {
    minAccelMps2: num(fl, 'minAccelMps2', p('forceLine')),
    minDurationS: num(fl, 'minDurationS', p('forceLine')),
    balancedShowS: num(fl, 'balancedShowS', p('forceLine')),
  };

  const ar = sec('arrows');
  const coloursRaw = obj(ar.colours, 'levels.arrows.colours');
  const colours = {} as Record<ForceKind, string>;
  for (const kind of FORCE_KINDS) {
    const c = coloursRaw[kind];
    if (typeof c !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(c)) fail(`levels.arrows.colours.${kind}`, 'expected a #RRGGBB colour');
    colours[kind] = c;
  }
  const arrows = {
    baseLengthM: num(ar, 'baseLengthM', p('arrows')),
    perForceM: num(ar, 'perForceM', p('arrows')),
    referenceForceN: num(ar, 'referenceForceN', p('arrows')),
    maxLengthM: num(ar, 'maxLengthM', p('arrows')),
    hideBelowN: num(ar, 'hideBelowN', p('arrows')),
    flashS: num(ar, 'flashS', p('arrows')),
    colours,
  };

  return {
    crater,
    hills,
    ringRoad,
    water,
    magnet,
    track,
    pacing,
    par,
    rules,
    captions,
    forceLine,
    arrows,
    developerUnlockQuery: text(root, 'developerUnlockQuery', 'levels'),
  };
}

export const levelsConfig: LevelsConfig = validateLevelsConfig(levelsJson);
