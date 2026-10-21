import textJson from '../../content/levelText.json' with { type: 'json' };

// The words of the level engine (LEVELS_BUILD_PLAN A4, A7): captions, hints, report cards. Templates with {tokens};
// the engine fills them with the student's numbers. Draft text until k._muz reviews it (`placeholder`).

export interface CaptionText {
  title: string;
  line: string;
}
export interface CardText {
  title: string;
  sentence: string;
  maths: string[];
}
/** The words of the stretch report (Showcase P6, SHOWCASE_PLAN §9). */
export interface StretchText {
  legend: string;
  headlineLoss: string;
  headlineGain: string;
  headlineEven: string;
  why: Record<string, string>;
  try: Record<string, string>;
  /** What a crash is called in each level ("a boulder"); `default` for the others. */
  obstacles: Record<string, string>;
  surfaces: Record<string, string>;
}

/** One of the five ship parts (SHOWCASE_PLAN §12). `built` is true once the level that brings it home is a Showcase level. */
export interface ShipPartText {
  levelId: string;
  name: string;
  built: boolean;
  pickupLine: string;
}
export interface ShipText {
  openingLine: string;
  recoveredTitle: string;
  parts: ShipPartText[];
}

export interface LevelText {
  placeholder: boolean;
  captions: Record<string, CaptionText>;
  outcomes: Record<string, string>;
  hints: Record<string, string>;
  cards: Record<string, CardText>;
  /** Caption cards for the elements only levels have (a slope, water, a magnet); the Endless text has the others (R2). */
  elementCards: Record<string, { title: string; line: string }>;
  tryThis: Record<string, string>;
  stretch: StretchText;
  ship: ShipText;
}

type Obj = Record<string, unknown>;

function fail(path: string, problem: string): never {
  throw new Error(`Content error at ${path}: ${problem}`);
}

function obj(value: unknown, path: string): Obj {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, 'expected an object');
  return value as Obj;
}

function str(o: Obj, key: string, path: string, allowEmpty = false): string {
  const v = o[key];
  if (typeof v !== 'string' || (!allowEmpty && v === '')) fail(`${path}.${key}`, 'expected a string');
  return v;
}

function strings(raw: unknown, path: string): Record<string, string> {
  const o = obj(raw, path);
  return Object.fromEntries(Object.keys(o).map((k) => [k, str(o, k, path)]));
}

export function validateLevelText(raw: unknown): LevelText {
  const root = obj(raw, 'levelText');
  const captions: Record<string, CaptionText> = {};
  const capRaw = obj(root.captions, 'levelText.captions');
  for (const id of Object.keys(capRaw)) {
    const c = obj(capRaw[id], `levelText.captions.${id}`);
    captions[id] = { title: str(c, 'title', `levelText.captions.${id}`, true), line: str(c, 'line', `levelText.captions.${id}`, true) };
  }
  const cards: Record<string, CardText> = {};
  const cardRaw = obj(root.cards, 'levelText.cards');
  for (const id of Object.keys(cardRaw)) {
    const c = obj(cardRaw[id], `levelText.cards.${id}`);
    const maths = c.maths;
    if (!Array.isArray(maths) || maths.some((m) => typeof m !== 'string')) fail(`levelText.cards.${id}.maths`, 'expected a list of strings');
    cards[id] = { title: str(c, 'title', `levelText.cards.${id}`), sentence: str(c, 'sentence', `levelText.cards.${id}`), maths: maths as string[] };
  }
  const elementCards: Record<string, { title: string; line: string }> = {};
  const elementRaw = root.elementCards === undefined ? {} : obj(root.elementCards, 'levelText.elementCards');
  for (const id of Object.keys(elementRaw)) {
    const c = obj(elementRaw[id], `levelText.elementCards.${id}`);
    elementCards[id] = { title: str(c, 'title', `levelText.elementCards.${id}`), line: str(c, 'line', `levelText.elementCards.${id}`) };
  }
  const st = obj(root.stretch, 'levelText.stretch');
  const stretch: StretchText = {
    legend: str(st, 'legend', 'levelText.stretch'),
    headlineLoss: str(st, 'headlineLoss', 'levelText.stretch'),
    headlineGain: str(st, 'headlineGain', 'levelText.stretch'),
    headlineEven: str(st, 'headlineEven', 'levelText.stretch'),
    why: strings(st.why, 'levelText.stretch.why'),
    try: strings(st.try, 'levelText.stretch.try'),
    obstacles: strings(st.obstacles, 'levelText.stretch.obstacles'),
    surfaces: strings(st.surfaces, 'levelText.stretch.surfaces'),
  };
  if (stretch.obstacles.default === undefined) fail('levelText.stretch.obstacles.default', 'expected a string');
  const sh = obj(root.ship, 'levelText.ship');
  const partsRaw = sh.parts;
  if (!Array.isArray(partsRaw) || partsRaw.length === 0) fail('levelText.ship.parts', 'expected a non-empty list');
  const ship: ShipText = {
    openingLine: str(sh, 'openingLine', 'levelText.ship'),
    recoveredTitle: str(sh, 'recoveredTitle', 'levelText.ship'),
    parts: partsRaw.map((raw, i) => {
      const p = obj(raw, `levelText.ship.parts[${i}]`);
      if (typeof p.built !== 'boolean') fail(`levelText.ship.parts[${i}].built`, 'expected true or false');
      return { levelId: str(p, 'levelId', `levelText.ship.parts[${i}]`), name: str(p, 'name', `levelText.ship.parts[${i}]`), built: p.built, pickupLine: str(p, 'pickupLine', `levelText.ship.parts[${i}]`) };
    }),
  };
  return {
    placeholder: root.placeholder === true,
    captions,
    outcomes: strings(root.outcomes, 'levelText.outcomes'),
    hints: strings(root.hints, 'levelText.hints'),
    cards,
    elementCards,
    tryThis: strings(root.tryThis, 'levelText.tryThis'),
    stretch,
    ship,
  };
}

export const levelText: LevelText = validateLevelText(textJson);

export type TokenValues = Record<string, string | number>;

/** Fills `{token}` in a template. A token with no value is a bug in the engine, so it throws rather than print `{token}`. */
export function fill(template: string, values: TokenValues): string {
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const v = values[name];
    if (v === undefined) throw new Error(`Level text: no value for {${name}} in "${template}"`);
    return String(v);
  });
}

/** Whole newtons, as everywhere (CLAUDE.md display rules). */
export const newtons = (n: number): string => String(Math.round(n));
/** Speeds, accelerations, times and distances to 2 decimals. */
export const twoDecimals = (n: number): string => n.toFixed(2);
