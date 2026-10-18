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
export interface LevelText {
  placeholder: boolean;
  captions: Record<string, CaptionText>;
  outcomes: Record<string, string>;
  hints: Record<string, string>;
  cards: Record<string, CardText>;
  tryThis: Record<string, string>;
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
  return {
    placeholder: root.placeholder === true,
    captions,
    outcomes: strings(root.outcomes, 'levelText.outcomes'),
    hints: strings(root.hints, 'levelText.hints'),
    cards,
    tryThis: strings(root.tryThis, 'levelText.tryThis'),
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
