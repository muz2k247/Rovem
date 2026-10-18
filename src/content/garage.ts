import garageJson from './garage.json' with { type: 'json' };
import partsJson from './parts.json' with { type: 'json' };

// The words and the one setting of the garage (LEVELS_BUILD_PLAN A5): the corner radius of the "safe speed" number
// and one plain sentence per part saying why it matters. Placeholder text until k._muz has reviewed it.

export interface GarageText {
  placeholder: boolean;
  /** Radius of the corner in "Safe speed in a 25 m corner", in metres. */
  cornerRadiusM: number;
  /** Part id → one plain sentence, no formula. */
  why: Record<string, string>;
}

function fail(path: string, problem: string): never {
  throw new Error(`Content error at ${path}: ${problem}`);
}

/** Checks the shape, and that every part in `partIds` has a sentence. */
export function validateGarageText(raw: unknown, partIds: readonly string[]): GarageText {
  if (typeof raw !== 'object' || raw === null) fail('garage', 'expected an object');
  const o = raw as Record<string, unknown>;
  const radius = o.cornerRadiusM;
  if (typeof radius !== 'number' || !(radius > 0)) fail('garage.cornerRadiusM', 'expected a number above 0');
  const why = o.why;
  if (typeof why !== 'object' || why === null) fail('garage.why', 'expected an object');
  const sentences = why as Record<string, unknown>;
  for (const id of partIds) {
    const s = sentences[id];
    if (typeof s !== 'string' || s.trim() === '') fail(`garage.why.${id}`, 'expected a sentence');
  }
  return { placeholder: o.placeholder === true, cornerRadiusM: radius, why: sentences as Record<string, string> };
}

export const garageText: GarageText = validateGarageText(
  garageJson,
  partsJson.map((p) => p.id),
);
