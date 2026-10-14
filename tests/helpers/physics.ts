import { content } from '../../src/content/index.ts';
import { physicsConstants, roverFromParts, STARTING_BUILD, surfaceSpec } from '../../src/game/buildFromParts.ts';
import type { RoverSpec, SurfaceSpec } from '../../src/physics/types.ts';

// Test-only. Physics code itself never imports content; tests may, to get the real numbers.
export const constants = physicsConstants(content);
export const rover = (): RoverSpec => roverFromParts(content, STARTING_BUILD);
export const surface = (id: string): SurfaceSpec => surfaceSpec(content, id);
