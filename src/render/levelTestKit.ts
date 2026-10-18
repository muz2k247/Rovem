import { content } from '../content/index.ts';
import { createLevelWorld } from '../game/level/world.ts';
import { validateLevelDef } from '../game/level/schema.ts';
import { SURFACE_IDS, testLevelRaw } from '../game/level/testLevel.ts';

// Test-only helper: a world built from the level engine's fixture level, with parts patched in.
export const worldOf = (patch: Record<string, unknown> = {}) => createLevelWorld(validateLevelDef({ ...testLevelRaw(), ...patch }, SURFACE_IDS), content);
export const defOf = (patch: Record<string, unknown> = {}) => validateLevelDef({ ...testLevelRaw(), ...patch }, SURFACE_IDS);
