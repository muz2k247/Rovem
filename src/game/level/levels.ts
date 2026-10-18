import { content } from '../../content/index.ts';
import firstTracks from '../../content/levels/first-tracks.json' with { type: 'json' };
import pushAndShove from '../../content/levels/push-and-shove.json' with { type: 'json' };
import craterField from '../../content/levels/crater-field.json' with { type: 'json' };
import gravityWells from '../../content/levels/gravity-wells.json' with { type: 'json' };
import ringRoad from '../../content/levels/ring-road.json' with { type: 'json' };
import { validateLevelDef } from './schema.ts';
import { LEVEL_IDS, type LevelDef, type LevelId } from './types.ts';

// The level files (LEVELS_BUILD_PLAN A9). Each level is one JSON file in `src/content/levels/`; B4 adds them here as it
// writes them, in play order. A level with no file yet is "Coming soon" on the Levels screen.

const LEVEL_FILES: Partial<Record<LevelId, unknown>> = {
  'first-tracks': firstTracks,
  'push-and-shove': pushAndShove,
  'crater-field': craterField,
  'gravity-wells': gravityWells,
  'ring-road': ringRoad,
};

const surfaceIds = content.surfaces.map((s) => s.id);

/** The ids of the levels that have a file, in play order. */
export function builtLevelIds(files: Partial<Record<LevelId, unknown>> = LEVEL_FILES): LevelId[] {
  return LEVEL_IDS.filter((id) => files[id] !== undefined);
}

/** Loads and validates one level (NFR-5). Throws if the level is unknown or has no file yet. */
export function loadLevelDef(id: string, files: Partial<Record<LevelId, unknown>> = LEVEL_FILES): LevelDef {
  if (!(LEVEL_IDS as readonly string[]).includes(id)) throw new Error(`Unknown level "${id}"`);
  const raw = files[id as LevelId];
  if (raw === undefined) throw new Error(`Level "${id}" has no level file yet`);
  const def = validateLevelDef(raw, surfaceIds);
  if (def.id !== id) throw new Error(`Content error at level.id: file for "${id}" says "${def.id}"`);
  return def;
}
