import cardsJson from './levelText.json' with { type: 'json' };

// The words on the Levels and Level intro screens (LEVELS_BUILD_PLAN A3): name, hook, goal and "New here". They live in
// `levelText.json` beside the in-level captions (merged in I1) and are placeholder text until k._muz has reviewed them.

export const LEVEL_DIAGRAMS = ['fork', 'pads', 'ring', 'lanes', 'crater', 'river', 'pylons'] as const;
export type LevelDiagram = (typeof LEVEL_DIAGRAMS)[number];

export interface LevelCard {
  id: string;
  name: string;
  hook: string;
  goal: string;
  /** 2 or 3 short sentences, no formula. */
  newHere: string[];
  diagram: LevelDiagram;
  /** Controls shown on the intro besides the usual ones. */
  extraControls: string[];
}

export interface NamedCard {
  name: string;
  hook: string;
}

export interface LevelCards {
  placeholder: boolean;
  levels: LevelCard[];
  endless: NamedCard;
  dustStorm: NamedCard;
}

type Obj = Record<string, unknown>;

function fail(path: string, problem: string): never {
  throw new Error(`Content error at ${path}: ${problem}`);
}

function obj(value: unknown, path: string): Obj {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, 'expected an object');
  return value as Obj;
}

function text(o: Obj, key: string, path: string): string {
  const v = o[key];
  if (typeof v !== 'string' || v.trim() === '') fail(`${path}.${key}`, 'expected a non-empty string');
  return v;
}

function named(value: unknown, path: string): NamedCard {
  const o = obj(value, path);
  return { name: text(o, 'name', path), hook: text(o, 'hook', path) };
}

export function validateLevelCards(raw: unknown): LevelCards {
  const root = obj(raw, 'levelCards');
  const list = root.levels;
  if (!Array.isArray(list) || list.length === 0) fail('levelCards.levels', 'expected a non-empty list');
  const seen = new Set<string>();
  const levels = list.map((item, i): LevelCard => {
    const p = `levelCards.levels[${i}]`;
    const o = obj(item, p);
    const id = text(o, 'id', p);
    if (seen.has(id)) fail(`${p}.id`, `duplicate id "${id}"`);
    seen.add(id);
    const newHere = o.newHere;
    if (!Array.isArray(newHere) || newHere.length < 2 || newHere.length > 3 || newHere.some((s) => typeof s !== 'string' || s.trim() === '')) {
      fail(`${p}.newHere`, 'expected 2 or 3 non-empty sentences');
    }
    const diagram = o.diagram;
    if (!(LEVEL_DIAGRAMS as readonly unknown[]).includes(diagram)) fail(`${p}.diagram`, `expected one of ${LEVEL_DIAGRAMS.join(', ')}`);
    const extra = o.extraControls ?? [];
    if (!Array.isArray(extra) || extra.some((s) => typeof s !== 'string')) fail(`${p}.extraControls`, 'expected a list of strings');
    return {
      id,
      name: text(o, 'name', p),
      hook: text(o, 'hook', p),
      goal: text(o, 'goal', p),
      newHere: newHere as string[],
      diagram: diagram as LevelDiagram,
      extraControls: extra as string[],
    };
  });
  return {
    placeholder: root.placeholder === true,
    levels,
    endless: named(root.endless, 'levelCards.endless'),
    dustStorm: named(root.dustStorm, 'levelCards.dustStorm'),
  };
}

export const levelCards: LevelCards = validateLevelCards(cardsJson);
