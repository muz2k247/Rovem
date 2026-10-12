import constantsJson from './constants.json' with { type: 'json' };
import surfacesJson from './surfaces.json' with { type: 'json' };
import partsJson from './parts.json' with { type: 'json' };
import powerUpsJson from './powerUps.json' with { type: 'json' };
import missionsJson from './missions.json' with { type: 'json' };
import { validateContent } from './schema.ts';
import type { Content } from './types.ts';

export { validateContent } from './schema.ts';
export type * from './types.ts';

/** Every game value, validated once when the module loads (NFR-5). */
export const content: Content = validateContent({
  constants: constantsJson,
  surfaces: surfacesJson,
  parts: partsJson,
  powerUps: powerUpsJson,
  missions: missionsJson,
});
