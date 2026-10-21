import { content } from '../../content/index.ts';
import crashSite from '../../content/levels/crash-site.json' with { type: 'json' };
import pushAndShove from '../../content/levels/push-and-shove.json' with { type: 'json' };
import craterField from '../../content/levels/crater-field.json' with { type: 'json' };
import gravityWells from '../../content/levels/gravity-wells.json' with { type: 'json' };
import theCrossing from '../../content/levels/the-crossing.json' with { type: 'json' };
import polarPass from '../../content/levels/polar-pass.json' with { type: 'json' };
import { validateLevelDef } from './schema.ts';
import { LEVEL_IDS, type LevelDef, type LevelId } from './types.ts';

// The level files (LEVELS_BUILD_PLAN A9). Each level is one JSON file in `src/content/levels/`, the v4 ones written in B4, Crash Site in R3.
// A level with no file would be "Coming soon" on the Levels screen; the table stays partial so a level can be taken out.

const LEVEL_FILES: Partial<Record<LevelId, unknown>> = {
  'crash-site': crashSite,
  'push-and-shove': pushAndShove,
  'crater-field': craterField,
  'gravity-wells': gravityWells,
  'the-crossing': theCrossing,
  'polar-pass': polarPass,
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

/** What the level card says about the Scavenger: the names of its three parts and its start delay; null if the level has none (R4). */
export function levelScavengerInfo(id: string, files: Partial<Record<LevelId, unknown>> = LEVEL_FILES): { buildNames: string[]; delayS: number } | null {
  try {
    const sd = loadLevelDef(id, files).scavenger;
    if (!sd) return null;
    const nameOf = (partId: string) => content.parts.find((p) => p.id === partId)?.name ?? partId;
    return { buildNames: [nameOf(sd.build.chassisId), nameOf(sd.build.wheelsId), nameOf(sd.build.motorId)], delayS: sd.startDelayS };
  } catch {
    return null;
  }
}

/** The par time of a level in seconds (the third star), or null if the level has no file. */
export function levelParS(id: string, files: Partial<Record<LevelId, unknown>> = LEVEL_FILES): number | null {
  try {
    return loadLevelDef(id, files).parS;
  } catch {
    return null;
  }
}
