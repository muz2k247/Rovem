import constantsJson from './constants.json' with { type: 'json' };
import surfacesJson from './surfaces.json' with { type: 'json' };
import partsJson from './parts.json' with { type: 'json' };
import powerUpsJson from './powerUps.json' with { type: 'json' };
import missionsJson from './missions.json' with { type: 'json' };
import testCourseJson from './levels/testCourse.json' with { type: 'json' };
import runJson from './run.json' with { type: 'json' };
import runChunksJson from './runChunks.json' with { type: 'json' };
import runTextJson from './runText.json' with { type: 'json' };
import { validateContent } from './schema.ts';
import type { Content } from './types.ts';

export { validateContent } from './schema.ts';
export type * from './types.ts';

/** Every game value and level, validated once when the module loads (NFR-5). */
export const content: Content = validateContent({
  constants: constantsJson,
  surfaces: surfacesJson,
  parts: partsJson,
  powerUps: powerUpsJson,
  missions: missionsJson,
  levels: { testCourse: testCourseJson },
  run: runJson,
  runChunks: runChunksJson,
  runText: runTextJson,
});

// The demo text is a draft until k._muz reviews it (CLAUDE.md, Questions).
if (content.runText.placeholder) {
  console.warn('Content: runText.json is placeholder text and has not been reviewed by k._muz.');
}
